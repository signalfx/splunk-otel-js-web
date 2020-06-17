import * as assert from 'assert';
import {captureTraceParent} from '../src/servertiming';

describe('test captureTraceParent', () => {
  it('should deal with simple value', () => {
    const span = { setAttribute: function(k,v){this[k] = v}};
    captureTraceParent('traceparent;desc="00-000000000000000078499d3266d75d5f-7e1c10b3c482edbe-01"',span);
    assert.ok('000000000000000078499d3266d75d5f' === span['link.traceId']);
    assert.ok('7e1c10b3c482edbe' === span['link.spanId']);
  });
  it('should deal with multiple values', () => {
    const span = { setAttribute: function(k,v){this[k] = v}};
    captureTraceParent('other;dur=1234, traceparent;desc="00-000000000000000078499d3266d75d5f-7e1c10b3c482edbe-01",misc;desc="stuff"',span);
    assert.ok('000000000000000078499d3266d75d5f' === span['link.traceId']);
    assert.ok('7e1c10b3c482edbe' === span['link.spanId']);
  });
});