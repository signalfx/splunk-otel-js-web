import * as assert from 'assert';

import '../src/main.js';
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

describe('test init', () => {
  describe('not specifying beaconUrl', () => {
    it('should not be inited', () => {
      try {
        window.SplunkRum.init({noBeaconUrl: true});
        assert.ok(false); // should not get here
      } catch (expected) {
        assert.ok(window.SplunkRum.inited === false);
      }
    });
  });
  describe('successful', () => {
    it('should have been inited properly with doc load spans', (done) => {
      window.SplunkRum.init({
        beaconUrl: 'http://127.0.0.1:9999/foo',
        app: 'my-app',
        debug: true,
        globalAttributes: {customerType: 'GOLD'},
      });
      assert.ok(window.SplunkRum.inited);
      assert.ok(document.cookie.includes('_splunk_rum_sid'));
      window.SplunkRum._provider.addSpanProcessor(capturer);
      setTimeout(()=> {
        if (navigator.userAgent.includes('Firefox')) {
          done(); // Firefox produces doc load spans; why aren't they visible in this test in this way?
          return;
        }
        assert.ok(capturer.spans.length >= 3);
        const docLoadTraceId = capturer.spans[0].traceId;
        let foundFetch = false;
        let foundDocLoad = false;
        let foundResource = false;
        capturer.spans.forEach( span => {
          // all spans so far should be from the same component and have the same traceId
          assert.ok(span.attributes['component'] === 'document-load');
          assert.ok(span.traceId === docLoadTraceId);
          if (span.name === 'documentFetch') {
            foundFetch = true;
            assert.strictEqual(span.attributes['link.spanId'], '0000000000000002');
          } else if (span.name === 'documentLoad') {
            foundDocLoad = true;
            assert.ok(/^[0-9]+x[0-9]+$/.test(span.attributes['screen.xy']));
          } else {
            foundResource = true;
            assert.ok(span.name.startsWith('http://localhost')); // FIXME again, otel spec/cardinality issue here
          }
        });
        assert.ok(foundFetch);
        assert.ok(foundResource);
        assert.ok(foundDocLoad);
        done();
      }, 1000);
    });
  });
  describe('double-init has no effect', () => {
    it('should have been inited only once', () => {
      window.SplunkRum.init({beaconUrl: 'http://127.0.0.1:8888/bar'});
      const sps = window.SplunkRum._provider.getActiveSpanProcessor()._spanProcessors;
      assert.ok(sps[0]._exporter.beaconUrl.endsWith('/foo'));
    });
  });
});

describe('creating spans is possible', () => {
  // FIXME figure out ways to validate zipkin 'export', sendBeacon, etc. etc.
  it('should have extra fields added', () => {
    const tracer = window.SplunkRum._provider.getTracer('test');
    const span = tracer.startSpan('testSpan');
    tracer.withSpan(span, () => {
      assert.ok(tracer.getCurrentSpan() === span);
      assert.ok(!!span.attributes['splunk.rumSessionId']);
      assert.ok(!!span.attributes['splunk.rumVersion']);
      assert.ok(!!span.attributes['location.href']);
      assert.ok(!!span.attributes['splunk.scriptInstance']);
      assert.strictEqual(span.attributes['app'], 'my-app');
      assert.strictEqual(span.attributes.customerType, 'GOLD');
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
        window.SplunkRum.error('something happened: ', e); // try out the API
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
      assert.strictEqual(capturer.spans.length, 1);
      const span = capturer.spans[0];
      assert.strictEqual(span.attributes.component, 'error');
      assert.strictEqual(span.name, 'eventListener.error');
      assert.ok(span.attributes.target_src.endsWith('DoesNotExist.jpg'));

      done();
    }, 100);
  });
});

describe('test manual report', () => {
  it('should not report useless items', () => {
    capturer.clear();
    window.SplunkRum.error('');
    window.SplunkRum.error();
    window.SplunkRum.error([]);
    window.SplunkRum.error({});
    assert.strictEqual(capturer.spans.length, 0);
  });
});

describe('test route change', () => {
  it('should report a span', () => {
    capturer.clear();
    history.pushState({}, 'title', '/thisIsAChange#WithAHash');
    const span = capturer.spans[capturer.spans.length - 1];
    assert.strictEqual(span.name, 'routeChange');
    assert.ok(span.attributes['location.href'].includes('/thisIsAChange#WithAHash'));
    assert.ok(span.attributes['prev.href'].length > 0);
    assert.strictEqual(span.attributes['component'], 'user-interaction');
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

