import * as assert from 'assert';
import * as api from '@opentelemetry/api';

require('../src/splunk-rum.js');
class SpanCapturer {
  constructor() {
    this.spans = [];
  }
  forceFlush() {}
  onStart(span) {}
  shutdown() {}
  onEnd(span) {
    this.spans.push(span)
  }
  clear() {
    this.spans = [];
  }
}
const capturer = new SpanCapturer();

describe('test init', () => {
  describe('not specifying beaconUrl', () => {
    it('should not be inited', () => {
      window.SplunkRum.init({noBeaconUrl: true});
      assert.ok(window.SplunkRum.inited === false);
    });
  });
  describe('successful', () => {
    it('should have been inited and created a session cookie', () => {
      window.SplunkRum.init({
        beaconUrl: 'http://127.0.0.1:9999/foo',
        app: 'my-app'
      });
      assert.ok(window.SplunkRum.inited);
      assert.ok(document.cookie.includes("_splunk_rum_sid"));
      window.SplunkRum._provider.addSpanProcessor(capturer);
    });
  });
  describe('double-init has no effect', () => {
    it('should have been inited only once', () => {
      window.SplunkRum.init({beaconUrl: 'http://127.0.0.1:8888/bar'});
      // FIXME way to check this state (e.g., capture beaconUrl and ensure it hasn't changed
    });
  });
});

describe('creating spans is possible', () => {
  // FIXME figure out ways to validate zipkin 'export', sendBeacon, etc. etc.
  it('should have extra fields added', () => {
    let tracer = api.trace.getTracer('test');
    let span = tracer.startSpan('testSpan');
    tracer.withSpan(span, () => {
      assert.ok(tracer.getCurrentSpan() === span);
      assert.ok(!!span.attributes['splunk.rumSessionId']);
      assert.ok(!!span.attributes['location.href']);
      assert.ok(!!span.attributes['scriptInstance']);
      assert.equal(span.attributes['app'], 'my-app');
    });
    span.end();
  });
});

// Doesn't actually test the xhr additions we've made (with Server-Timing), but just that
// we didn't mess up the basic flow/behavior of the plugin
describe('test xhr', () => {
  it('should capture an xhr span', (done) => {
    capturer.clear();
    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'client.html');
    xhr.addEventListener('loadend', () => {
      setTimeout(() => {
        assert.ok(capturer.spans[capturer.spans.length-1].attributes.component === 'xml-http-request');
        done();
      }, 3000);
    });
    xhr.send();
  });
});

// See above comment on xhr test
describe('test fetch', () => {
  it('should capture a fetch span', (done) => {
    capturer.clear();
    window.fetch('client.html').then(() => {
      setTimeout(() => {
        assert.ok(capturer.spans[capturer.spans.length-1].attributes.component === 'fetch');
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
      assert.ok(span.attributes.component === 'error');
      assert.ok(span.attributes['error.stack'].includes('callChain'));
      assert.ok(span.attributes['error.stack'].includes('reportError'));
      assert.ok(span.attributes['error.message'].includes('war room'));
      done();
    }, 100);
  });
});

function recurAndThrow(i) {
  if (i == 0) {
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
      assert.ok(span.attributes.component === 'error');
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
      assert.ok(span.attributes.component === 'error');
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
      assert.ok(span.attributes.component === 'error');
      assert.ok(span.attributes['error.message'] === 'has some args');
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
    assert.ok(capturer.spans.length === 0);
  });
});

describe('test route change', () => {
  it('should report a span', () => {
    capturer.clear();
    history.pushState({}, 'title', '/thisIsAChange');
    const span = capturer.spans[capturer.spans.length - 1];
    assert.ok(span.name === 'route change');
    assert.ok(span.attributes['location.href'].includes('/thisIsAChange'));
    assert.ok(span.attributes['prev.href'].length > 0);
  });
});