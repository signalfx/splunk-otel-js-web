import * as assert from 'assert';
import * as api from '@opentelemetry/api';

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
      }, 1000);
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
      }, 1000);
    });
  });
});
