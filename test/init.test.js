import * as assert from 'assert';
import * as api from '@opentelemetry/api';
import Tracekit from 'tracekit';

require('../src/sfx-rum.js');
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
      window.SfxRum.init({noBeaconUrl: true});
      assert.ok(window.SfxRum.inited === false);
    });
  });
  describe('successful', () => {
    it('should have been inited and created a session cookie', () => {
      window.SfxRum.init({
        beaconUrl: 'http://127.0.0.1:9999/foo',
        app: 'my-app'
      });
      assert.ok(window.SfxRum.inited);
      assert.ok(document.cookie.includes("_sfx_rum_sid"));
      window.SfxRum._provider.addSpanProcessor(capturer);
    });
  });
  describe('double-init has no effect', () => {
    it('should have been inited only once', () => {
      window.SfxRum.init({beaconUrl: 'http://127.0.0.1:8888/bar'});
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
      assert.ok(!!span.attributes['sfx.rumSessionId']);
      assert.ok(!!span.attributes['location.href']);
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

function throwError() {
  // Note that a simple "throw new Error" here will fail the test.  Several hours were
  // spent trying to find ways around this involving mocha's allowUncaught and
  // Mocha.process.removeListener("uncaughtException").  Nothing worked.
  Tracekit.report(new Error('You can\'t fight in here; this is the war room!'));
}

function callChain() {
  throwError();
}


describe('test error', () => {
  it('should capture an error span', (done) => {
    capturer.clear();
    // cause the error
    try {
      callChain();
      assert.ok(false); // shouldn't get here
    } catch (e) {
      // swallow
    }
    // and later look for it
    setTimeout(() => {
      const span = capturer.spans[capturer.spans.length - 1];
      assert.ok(span.attributes.component === 'error');
      assert.ok(span.attributes['error.stack'].includes('callChain'));
      assert.ok(span.attributes['error.stack'].includes('throwError'));
      assert.ok(span.attributes['error.message'].includes('war room'));
      done();
    }, 100);
  });
});

// very uncommon case that would produce a useless span;
// logic added to not emit in that case.
describe('test TraceKit.report(string)', () => {
  it('should not make a useless span', (done) => {
    capturer.clear();
    try {
      throw 'stringy';
    } catch (e) {
      try {
        Tracekit.report(e);
      } catch (e2) {
        // swallow
      }
    }
    setTimeout(() => {
      assert.ok(capturer.spans.length === 0);
      done();
    }, 3000); // TraceKit has a goofy 2000 timeout to see if more data comes in...
  });
});

function recurAndThrow(i) {
  if (i == 0) {
    throw new Error('pancakes');
  }
  recurAndThrow(i-1);
}

describe('test length of stack traces', () => {
  it('should be limited', (done) => {
    capturer.clear();
    try {
      recurAndThrow(50);
    } catch (e) {
      try {
        Tracekit.report(e);
      } catch (e2) {
        // swallow
      }
    }
    setTimeout(() => {
      const span = capturer.spans[capturer.spans.length - 1];
      assert.ok(span.attributes.component === 'error');
      assert.ok(span.attributes['error.stack'].includes('recurAndThrow'));
      assert.ok(span.attributes['error.stack'].length <= 4096);
      assert.ok(span.attributes['error.message'].includes('pancakes'));
      done();
    }, 100);

  });
});
