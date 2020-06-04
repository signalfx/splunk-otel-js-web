import * as assert from 'assert';
import * as api from '@opentelemetry/api';

require('../src/sfx-rum.js');

describe('test init', () => {
  describe('not specifying beaconUrl', () => {
    it('should not be inited', () => {
      window.SfxRum.init({noBeaconUrl: true});
      assert.ok(window.SfxRum.inited === false);
    });
  });
  describe('successful', () => {
    it('should have been inited and created a session cookie', () => {
      window.SfxRum.init({beaconUrl: 'http://127.0.0.1:9999/foo'});
      assert.ok(window.SfxRum.inited);
      assert.ok(document.cookie.includes("rumSessionID"));
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
    });
    span.end();
  });
});
