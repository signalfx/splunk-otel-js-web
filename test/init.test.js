/*
Copyright 2020 Splunk Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import * as assert from 'assert';

import SplunkRum from '../src/index';
import {SpanKind, setSpan, context, getSpan} from '@opentelemetry/api';
import {PatchedZipkinExporter} from '../src/zipkin';

class SpanCapturer {
  constructor() {
    this.spans = [];
  }
  forceFlush() {}
  onStart() {}
  shutdown() {}
  onEnd(span) {
    this.spans.push(span);
  }
  clear() {
    this.spans = [];
  }
}
const capturer = new SpanCapturer();

function doesBeaconUrlEndWith(path) {
  const sps = SplunkRum.provider.getActiveSpanProcessor()._spanProcessors;
  assert.ok(sps[0]._exporter.beaconUrl.endsWith(path));
}

describe('test init', () => {
  describe('not specifying beaconUrl', () => {
    it('should not be inited', () => {
      try {
        SplunkRum.init({noBeaconUrl: true});
        assert.ok(false); // should not get here
      } catch (expected) {
        assert.ok(SplunkRum.inited === false);
      }
    });
  });
  describe('should enforce secure beacon url', () => {
    afterEach(() => {
      // Ugly way to create a "clean" state in order to test consecutive successful init calls
      Object.defineProperty(SplunkRum, 'provider', {value:undefined, configurable: true});  
      SplunkRum.inited = false;
    });
    it('should not be inited with http', () => {
      try {        
        SplunkRum.init({beaconUrl: 'http://127.0.0.1:8888/insecure'});
        assert.ok(false);
      } catch(e) {
        assert.ok(SplunkRum.inited === false);
      }
    });
    it('should init with https', () => {
      const path = '/secure';
      SplunkRum.init({beaconUrl: `https://127.0.0.1:8888/${path}`});
      assert.ok(SplunkRum.inited);
      doesBeaconUrlEndWith(path);
    });
    it('can be forced via allowInsecureBeacon option', () => {
      const path = '/insecure';
      SplunkRum.init({beaconUrl: `http://127.0.0.1:8888/${path}`, allowInsecureBeacon: true});
      assert.ok(SplunkRum.inited);      
      doesBeaconUrlEndWith(path);
    });
  });
  describe('successful', () => {
    it('should have been inited properly with doc load spans', (done) => {
      SplunkRum.init({
        beaconUrl: 'https://127.0.0.1:9999/foo',
        app: 'my-app',
        environment: 'my-env',
        globalAttributes: {customerType: 'GOLD'},
      });
      assert.ok(SplunkRum.inited);
      SplunkRum.provider.addSpanProcessor(capturer);
      setTimeout(()=> {
        assert.ok(capturer.spans.length >= 3);
        const docLoadTraceId = capturer.spans[0].traceId;
        capturer.spans.forEach(span => {
          assert.strictEqual(span.traceId, docLoadTraceId);
        });

        capturer.spans.filter(span => span.attributes['component'] === 'document-load').forEach(span => {
          assert.strictEqual(span.attributes['component'], 'document-load');
          assert.strictEqual(span.traceId, docLoadTraceId);
        });

        const documentFetchSpan = capturer.spans.find(span => span.name === 'documentFetch');
        assert.ok(documentFetchSpan, 'documentFetch span presence.');
        if (!navigator.userAgent.includes('Firefox')) {
          assert.strictEqual(documentFetchSpan.attributes['link.spanId'], '0000000000000002');
        }

        const documentLoadSpan = capturer.spans.find(span => span.name === 'documentLoad');
        assert.ok(documentLoadSpan, 'documentLoad span presence.');
        assert.ok(/^[0-9]+x[0-9]+$/.test(documentLoadSpan.attributes['screen.xy']));

        const resourceFetchSpan = capturer.spans.find(span => span.name === 'resourceFetch');
        assert.ok(resourceFetchSpan, 'resourceFetch span presence.');

        done();
      }, 1000);
    });
  });
  describe('double-init has no effect', () => {
    it('should have been inited only once', () => {
      SplunkRum.init({beaconUrl: 'https://127.0.0.1:8888/bar'});
      doesBeaconUrlEndWith('/foo');
    });
  });

});

describe('creating spans is possible', () => {
  // FIXME figure out ways to validate zipkin 'export', sendBeacon, etc. etc.
  it('should have extra fields added', () => {
    const tracer = SplunkRum.provider.getTracer('test');
    const span = tracer.startSpan('testSpan');
    context.with(setSpan(context.active(), span), () => {
      assert.ok(getSpan(context.active()) === span);
      assert.ok(!!span.attributes['splunk.rumSessionId']);
      assert.ok(!!span.attributes['splunk.rumVersion']);
      assert.ok(!!span.attributes['location.href']);
      assert.ok(!!span.attributes['splunk.scriptInstance']);
      assert.strictEqual(span.attributes['app'], 'my-app');
      assert.strictEqual(span.attributes['environment'], 'my-env');
      assert.strictEqual(span.attributes.customerType, 'GOLD');
    });
    span.end();
  });
  it('should truncate long values when sent through zipkin', () => {
    const tracer = SplunkRum.provider.getTracer('test');
    const span = tracer.startSpan('testSpan');
    span.setAttribute('somekey', 'a'.repeat(10000));
    const zspan = new PatchedZipkinExporter('no_beacon').modZipkinSpan(span);
    console.log(zspan);
    assert.strictEqual(4096, zspan.tags.somekey.length);
  });
});
describe('setGlobalAttributes', () => {
  it('should have extra fields added', () => {
    const tracer = SplunkRum.provider.getTracer('test');
    SplunkRum.setGlobalAttributes({newKey: 'newVal'});
    const span = tracer.startSpan('testSpan');
    context.with(setSpan(context.active(), span), () => {
      assert.strictEqual(span.attributes.newKey, 'newVal');
      assert.ok(!span.attributes.customerType); // old key from init() not there anymore
    });
    span.end();
  });
});

// Doesn't actually test the xhr additions we've made (with Server-Timing), but just that
// we didn't mess up the basic flow/behavior of the plugin
describe('test xhr', () => {
  it('should capture an xhr span', (done) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', location.href);
    xhr.addEventListener('loadend', () => {
      setTimeout(() => {
        const span = capturer.spans[capturer.spans.length-1];
        assert.strictEqual(span.name, 'HTTP GET');
        assert.strictEqual(span.attributes.component, 'xml-http-request');
        assert.ok(span.attributes['http.response_content_length'] > 0);
        assert.strictEqual(span.attributes['link.spanId'], '0000000000000002');
        assert.strictEqual(span.attributes['http.url'], location.href);
        done();
      }, 3000);
    });
    capturer.clear();
    xhr.send();
  });
});

// See above comment on xhr test
describe('test fetch', () => {
  it('should capture a fetch span', (done) => {
    capturer.clear();
    window.fetch(location.href).then(() => {
      setTimeout(() => {
        const span = capturer.spans[capturer.spans.length-1];
        assert.strictEqual(span.name, 'HTTP GET');
        assert.strictEqual(span.attributes.component, 'fetch');
        assert.ok(span.attributes['http.response_content_length'] > 0);
        assert.strictEqual(span.attributes['link.spanId'], '0000000000000002');
        assert.strictEqual(span.attributes['http.url'], location.href);
        done();
      }, 3000);
    });
  });
});

function reportError() {
  throw new Error('You can\'t fight in here; this is the war room!');
}

function callChain() {
  reportError();
}


describe('test error', () => {
  it('should capture an error span', (done) => {
    const origOnError = window.onerror;
    window.onerror = function() {
      // nop to prevent failing the test
    };
    capturer.clear();
    // cause the error
    setTimeout(() => {
      callChain();
    }, 10);
    // and later look for it
    setTimeout(() => {
      window.onerror = origOnError; // restore proper error handling
      const span = capturer.spans[capturer.spans.length - 1];
      assert.strictEqual(span.attributes.component, 'error');
      assert.strictEqual(span.name, 'onerror');
      assert.ok(span.attributes['error.stack'].includes('callChain'));
      assert.ok(span.attributes['error.stack'].includes('reportError'));
      assert.ok(span.attributes['error.message'].includes('war room'));
      done();
    }, 100);
  });
});

function recurAndThrow(i) {
  if (i === 0) {
    throw new Error('bad thing');
  }
  recurAndThrow(i-1);
}

describe('test stack length', () => {
  it('should limit length of stack', (done) => {
    capturer.clear();
    try {
      recurAndThrow(50);
    } catch (e) {
      try {
        SplunkRum.error('something happened: ', e); // try out the API
      } catch (e2) {
        // swallow
      }
    }
    setTimeout(() => {
      const span = capturer.spans[capturer.spans.length - 1];
      assert.strictEqual(span.attributes.component, 'error');
      assert.ok(span.attributes['error.stack'].includes('recurAndThrow'));
      assert.ok(span.attributes['error.stack'].length <= 4096);
      assert.ok(span.attributes['error.message'].includes('something'));
      assert.ok(span.attributes['error.message'].includes('bad thing'));
      done();
    }, 100);

  });
});

function throwBacon() {
  throw new Error('bacon');
}
describe('test unhandled promise rejection', () => {
  it ('should report a span', (done) => {
    capturer.clear();
    Promise.resolve('ok').then(()=>{
      throwBacon();
    });
    setTimeout(() => {
      const span = capturer.spans[capturer.spans.length - 1];
      assert.strictEqual(span.attributes.component, 'error');
      assert.ok(span.attributes.error);
      assert.ok(span.attributes['error.stack'].includes('throwBacon'));
      assert.ok(span.attributes['error.message'].includes('bacon'));
      done();
    }, 100);
  });
});

describe('test console.error', () => {
  it ('should report a span', (done) => {
    capturer.clear();
    console.error('has', 'some', 'args');
    setTimeout(() => {
      const span = capturer.spans[capturer.spans.length - 1];
      assert.strictEqual(span.attributes.component, 'error');
      assert.strictEqual(span.attributes['error.message'], 'has some args');
      done();
    }, 100);
  });
});

describe('test unloaded img', () => {
  it('should report a span', (done) => {
    capturer.clear();

    const img = document.createElement('img');
    img.src = location.href+'/IAlwaysWantToUseVeryVerboseDescriptionsWhenIHaveToEnsureSomethingDoesNotExist.jpg';
    document.body.appendChild(img);
    setTimeout(() => {
      const span = capturer.spans.find( s => s.attributes.component === 'error');
      assert.ok(span);
      assert.strictEqual(span.name, 'eventListener.error');
      assert.ok(span.attributes.target_src.endsWith('DoesNotExist.jpg'));

      done();
    }, 100);
  });
});

describe('test manual report', () => {
  it('should not report useless items', () => {
    capturer.clear();
    SplunkRum.error('');
    SplunkRum.error();
    SplunkRum.error([]);
    SplunkRum.error({});
    assert.strictEqual(capturer.spans.length, 0);
  });
});

describe('test route change', () => {
  it('should report a span', () => {
    const oldUrl = location.href;
    capturer.clear();
    history.pushState({}, 'title', '/thisIsAChange#WithAHash');
    const span = capturer.spans[capturer.spans.length - 1];
    assert.strictEqual(span.name, 'routeChange');
    assert.ok(span.attributes['location.href'].includes('/thisIsAChange#WithAHash'));
    assert.strictEqual(oldUrl, span.attributes['prev.href']);
    assert.strictEqual(span.attributes['component'], 'user-interaction');
    history.pushState({}, 'title', '/');
  });
  it('should capture location.hash changes', (done) => {
    capturer.clear();
    const oldUrl = location.href;
    location.hash = '#hashChange';
    setTimeout(()=>{
      const span = capturer.spans[capturer.spans.length - 1];
      assert.strictEqual(span.name, 'routeChange');
      assert.ok(span.attributes['location.href'].includes('#hashChange'));
      assert.strictEqual(oldUrl, span.attributes['prev.href']);
      assert.strictEqual(span.attributes['component'], 'user-interaction');
      history.pushState({}, 'title', '/');
      done();
    }, 0);
  });
});

describe('can remove wrapped event listeners', () => {
  it('does not break behavior', () => {
    let called = false;
    const listener = function() {
      called = true;
    };
    document.body.addEventListener('testy', listener);
    document.body.dispatchEvent(new Event('testy'));
    assert.strictEqual(called, true);
    called = false;
    document.body.removeEventListener('testy', listener);
    document.body.dispatchEvent(new Event('testy'));
    assert.strictEqual(called, false);
  });
});

describe('can produce click events', () => {
  it('creates a span for them', () => {
    capturer.clear();
    document.body.addEventListener('dblclick', function() { /* nop */});
    document.body.dispatchEvent(new Event('dblclick'));
    assert.strictEqual(capturer.spans.length, 1);
    assert.strictEqual(capturer.spans[0].name, 'dblclick');
    assert.strictEqual(capturer.spans[0].attributes.component, 'user-interaction');
  });
});

describe('can produce websocket events', () => {
  it ('can produce a series of spans from basic usage', (done) => {
    capturer.clear();
    const socket = new WebSocket('ws://127.0.0.1:8979/', 'foo');
    const openListener = function() {
      socket.send('Hello server');
      socket.removeEventListener('open', openListener);
    };
    const msgListener = function() {
      socket.removeEventListener('message', msgListener);
      // last span won't happen until my message callback is done
      setTimeout(() => {
        assert.strictEqual(3, capturer.spans.length);
        capturer.spans.forEach( span => {
          assert.strictEqual('websocket', span.attributes.component);
          assert.strictEqual('ws://127.0.0.1:8979/', span.attributes['http.url']);
        });
        assert.strictEqual('connect', capturer.spans[0].name);
        assert.strictEqual(SpanKind.CLIENT, capturer.spans[0].kind);
        assert.strictEqual('foo', capturer.spans[0].attributes.protocols);
        assert.strictEqual('send', capturer.spans[1].name);
        assert.strictEqual(SpanKind.PRODUCER, capturer.spans[1].kind);
        assert.strictEqual(12, capturer.spans[1].attributes['http.request_content_length']);
        assert.strictEqual('foo', capturer.spans[1].attributes.protocol);
        assert.strictEqual('onmessage', capturer.spans[2].name);
        assert.strictEqual(SpanKind.CONSUMER, capturer.spans[2].kind);
        assert.strictEqual(8, capturer.spans[2].attributes['http.response_content_length']);
        assert.strictEqual('foo', capturer.spans[2].attributes.protocol);
        socket.close();
        done();
      }, 100);
    };
    socket.addEventListener('open', openListener);
    socket.addEventListener('message', msgListener);
    // Handful of misc listener calls to exercise some code while we have a test fixture handy
    socket.addEventListener('message', msgListener); // has no effect
    socket.removeEventListener('message', function() { /* never actually added */ });
  });

  it ('can handle EventListener', (done) => {
    capturer.clear();
    const socket = new WebSocket('ws://127.0.0.1:8979/', ['foo', 'bar']);
    socket.addEventListener('open', () => {
      socket.send('Hello server');
    });
    socket.addEventListener('message', {
      handleEvent() {
        setTimeout(() => {
          assert.strictEqual(3, capturer.spans.length);
          assert.strictEqual('["foo","bar"]', capturer.spans[0].attributes.protocols);
          assert.strictEqual('foo', capturer.spans[1].attributes.protocol);
          socket.close();
          done();
        }, 100);
      }
    }, {once:true});
  });

  // FIXME find a way to make send throw..

  it ('can report failed connect to non-listening port', (done) => {
    capturer.clear();
    const socket = new WebSocket('ws://127.0.0.1:31874/', ['foo', 'bar']); // assuming no ws server running there...
    socket.addEventListener('error', () => {
      setTimeout(() => {
        assert.strictEqual(1, capturer.spans.length);
        assert.strictEqual('ws://127.0.0.1:31874/', capturer.spans[0].attributes['http.url']);
        assert.strictEqual('websocket', capturer.spans[0].attributes.component);
        assert.strictEqual('connect', capturer.spans[0].name);
        assert.strictEqual(true, capturer.spans[0].attributes.error);
        done();
      }, 100);
    });
  });
  // note: skipping, because it breaks in chrome 88
  it.skip('can report failed connect to blocked port', () => {
    capturer.clear();
    try {
      new WebSocket('ws://127.0.0.1:53/'); // assuming no ws server running there...
      assert.ok(false); // shouldn't get here
    } catch (expectedErr) {
      assert.strictEqual(1, capturer.spans.length);
      assert.strictEqual('ws://127.0.0.1:53/', capturer.spans[0].attributes['http.url']);
      assert.strictEqual('websocket', capturer.spans[0].attributes.component);
      assert.strictEqual('connect', capturer.spans[0].name);
      assert.strictEqual(true, capturer.spans[0].attributes.error);
    }
  });
  it ('can report invalid WebSocket constructor', () => {
    capturer.clear();
    try {
      new WebSocket('invalid url format'); // assuming no ws server running there...
      assert.ok(false); // shouldn't get here
    } catch (expectedErr) {
      assert.strictEqual(1, capturer.spans.length);
      assert.strictEqual('invalid url format', capturer.spans[0].attributes['http.url']);
      assert.strictEqual('websocket', capturer.spans[0].attributes.component);
      assert.strictEqual('connect', capturer.spans[0].name);
      assert.strictEqual(true, capturer.spans[0].attributes.error);
    }
  });
});

