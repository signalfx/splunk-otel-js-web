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
import { setSpan, context, getSpan } from '@opentelemetry/api';
import { PatchedZipkinExporter } from '../src/zipkin';
import { deinit, initWithDefaultConfig, SpanCapturer } from './utils';

function doesBeaconUrlEndWith(suffix) {
  const sps = SplunkRum.provider.getActiveSpanProcessor()._spanProcessors;
  const beaconUrl = sps[0]._exporter.beaconUrl;
  assert.ok(beaconUrl.endsWith(suffix), `Checking beaconUrl if (${beaconUrl}) ends with ${suffix}`);
}

describe('test init', () => {
  const capturer = new SpanCapturer();

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
      SplunkRum.deinit();
    });
    it('can be forced via allowInsecureBeacon option', () => {
      const path = '/insecure';
      SplunkRum.init({beaconUrl: `http://127.0.0.1:8888/${path}`, allowInsecureBeacon: true});
      assert.ok(SplunkRum.inited);      
      doesBeaconUrlEndWith(path);
      SplunkRum.deinit();
    });
  });
  describe('successful', () => {
    it('should have been inited properly with doc load spans', (done) => {
      SplunkRum.init({
        beaconUrl: 'https://127.0.0.1:9999/foo',
        app: 'my-app',
        environment: 'my-env',
        globalAttributes: {customerType: 'GOLD'},
        capture: {
          websocket: true
        }
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

        SplunkRum.deinit();
        done();
      }, 1000);
    });
  });
  describe('double-init has no effect', () => {
    it('should have been inited only once', () => {
      SplunkRum.init({beaconUrl: 'https://127.0.0.1:8888/foo'});
      SplunkRum.init({beaconUrl: 'https://127.0.0.1:8888/bar'});
      doesBeaconUrlEndWith('/foo');
      SplunkRum.deinit();
    });
  });

});

describe('creating spans is possible', () => {
  const capturer = new SpanCapturer();
  beforeEach(() => {
    initWithDefaultConfig(capturer);
  });
  afterEach(() => {
    deinit();
  });

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
    assert.strictEqual(4096, zspan.tags.somekey.length);
  });
});

describe('setGlobalAttributes', () => {
  const capturer = new SpanCapturer();
  beforeEach(() => {
    initWithDefaultConfig(capturer);
  });
  afterEach(() => {
    deinit();
  });

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
  const capturer = new SpanCapturer();
  beforeEach(() => {
    initWithDefaultConfig(capturer);
  });
  afterEach(() => {
    deinit();
  });

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
  const capturer = new SpanCapturer();
  beforeEach(() => {
    initWithDefaultConfig(capturer);
  });
  afterEach(() => {
    deinit();
  });

  it('should capture a fetch span', (done) => {
    window.fetch(location.href).then(() => {
      setTimeout(() => {
        const fetchSpan = capturer.spans.find(span => span.attributes.component === 'fetch');
        assert.ok(fetchSpan, 'Check if fetch span is present.');
        assert.strictEqual(fetchSpan.name, 'HTTP GET');
        
        // note: temporarily disabled because of instabilities in OTel's code
        // assert.ok(fetchSpan.attributes['http.response_content_length'] > 0, 'Checking response_content_length.');
        
        assert.strictEqual(fetchSpan.attributes['link.spanId'], '0000000000000002');
        assert.strictEqual(fetchSpan.attributes['http.url'], location.href);
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
  const capturer = new SpanCapturer();
  beforeEach(() => {
    initWithDefaultConfig(capturer);
  });
  afterEach(() => {
    deinit();
  });

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
  const capturer = new SpanCapturer();
  beforeEach(() => {
    initWithDefaultConfig(capturer);
  });
  afterEach(() => {
    deinit();
  });

  it('should limit length of stack', (done) => {
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
      const errorSpan = capturer.spans.find(span => span.attributes.component === 'error');
      assert.ok(errorSpan);
      assert.ok(errorSpan.attributes['error.stack'].includes('recurAndThrow'));
      assert.ok(errorSpan.attributes['error.stack'].length <= 4096);
      assert.ok(errorSpan.attributes['error.message'].includes('something'));
      assert.ok(errorSpan.attributes['error.message'].includes('bad thing'));
      done();
    }, 100);
  });
});

function throwBacon() {
  throw new Error('bacon');
}
describe('test unhandled promise rejection', () => {
  const capturer = new SpanCapturer();
  beforeEach(() => {
    initWithDefaultConfig(capturer);
  });
  afterEach(() => {
    deinit();
  });

  it ('should report a span', (done) => {
    Promise.resolve('ok').then(() => {
      throwBacon();
    });
    setTimeout(() => {
      const errorSpan = capturer.spans.find(span => span.attributes.component === 'error');
      assert.ok(errorSpan);
      assert.ok(errorSpan.attributes.error);
      assert.ok(errorSpan.attributes['error.stack'].includes('throwBacon'));
      assert.ok(errorSpan.attributes['error.message'].includes('bacon'));
      done();
    }, 100);
  });
});

describe('test console.error', () => {
  const capturer = new SpanCapturer();
  beforeEach(() => {
    initWithDefaultConfig(capturer);
  });
  afterEach(() => {
    deinit();
  });

  it ('should report a span', (done) => {
    console.error('has', 'some', 'args');
    setTimeout(() => {
      const errorSpan = capturer.spans.find(span => span.attributes.component === 'error');
      assert.ok(errorSpan);
      assert.strictEqual(errorSpan.attributes['error.message'], 'has some args');
      done();
    }, 100);
  });
});

describe('test unloaded img', () => {
  const capturer = new SpanCapturer();
  beforeEach(() => {
    initWithDefaultConfig(capturer);
  });
  afterEach(() => {
    deinit();
  });

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
  const capturer = new SpanCapturer();
  beforeEach(() => {
    initWithDefaultConfig(capturer);
  });
  afterEach(() => {
    deinit();
  });

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
  let capturer = undefined;
  beforeEach(() => {
    capturer = new SpanCapturer();
    initWithDefaultConfig(capturer);
  });
  afterEach(() => {
    deinit();
  });

  it('should report a span', () => {
    const oldUrl = location.href;
    capturer.clear();
    history.pushState({}, 'title', '/thisIsAChange#WithAHash');
    const span = capturer.spans.find( s => s.attributes.component === 'user-interaction');
    assert.ok(span, 'Check if user-interaction span is present.');
    assert.strictEqual(span.name, 'routeChange');
    assert.ok(span.attributes['location.href'].includes('/thisIsAChange#WithAHash'));
    assert.strictEqual(oldUrl, span.attributes['prev.href']);
    history.pushState({}, 'title', '/');
  });
  it('should capture location.hash changes', (done) => {
    const oldUrl = location.href;
    location.hash = '#hashChange';
    setTimeout(()=>{
      const span = capturer.spans.find(s => s.attributes.component === 'user-interaction');
      assert.ok(span, 'Check if user-interaction span is present.');
      assert.strictEqual(span.name, 'routeChange');
      assert.ok(span.attributes['location.href'].includes('#hashChange'));
      assert.strictEqual(oldUrl, span.attributes['prev.href']);
      history.pushState({}, 'title', '/');
      done();
    }, 0);
  });
});

describe('can remove wrapped event listeners', () => {
  const capturer = new SpanCapturer();
  beforeEach(() => {
    initWithDefaultConfig(capturer);
  });
  afterEach(() => {
    deinit();
  });

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
  const capturer = new SpanCapturer();
  beforeEach(() => {
    initWithDefaultConfig(capturer);
  });
  afterEach(() => {
    deinit();
  });

  it('creates a span for them', () => {
    capturer.clear();
    document.body.addEventListener('dblclick', function() { /* nop */});
    document.body.dispatchEvent(new Event('dblclick'));
    assert.strictEqual(capturer.spans.length, 1);
    assert.strictEqual(capturer.spans[0].name, 'dblclick');
    assert.strictEqual(capturer.spans[0].attributes.component, 'user-interaction');
  });
});
