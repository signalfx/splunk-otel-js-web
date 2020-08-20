import * as assert from 'assert';
import {DocumentLoad} from '@opentelemetry/plugin-document-load';
import {UserInteractionPlugin} from '@opentelemetry/plugin-user-interaction';
import {XMLHttpRequestPlugin} from '@opentelemetry/plugin-xml-http-request';
import {FetchPlugin} from '@opentelemetry/plugin-fetch';

// These are test-time checks that the methods we're patching at least still exist
// when new upstream versions are pulled.
describe('check patching assumptions', () => {
  it('docload', () => {
    assert.ok(typeof new DocumentLoad()._endSpan === 'function');
    assert.ok(typeof new DocumentLoad()._getEntries === 'function');
  });
  it('userinteraction', () => {
    assert.ok(typeof new UserInteractionPlugin()._allowEventType === 'function');
    assert.ok(typeof new UserInteractionPlugin()._patchHistoryMethod === 'function');
  });
  it('xhr', () => {
    assert.ok(typeof new XMLHttpRequestPlugin()._createSpan === 'function');
  });
  it('fetch', () => {
    assert.ok(typeof new FetchPlugin()._addFinalSpanAttributes === 'function');
  });
  // WebTracerProvider/getTracer/startSpan chain is entirely public APIs and well tested already
});
