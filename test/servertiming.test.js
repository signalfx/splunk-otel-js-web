import * as assert from 'assert';
import {captureTraceParent, captureTraceParentFromPerformanceEntries} from '../src/servertiming';

describe('test captureTraceParent', () => {
  it('should deal with simple value', () => {
    const span = { setAttribute: function(k,v){this[k] = v;}};
    captureTraceParent('traceparent;desc="00-000000000000000078499d3266d75d5f-7e1c10b3c482edbe-01"',span);
    assert.equal('000000000000000078499d3266d75d5f', span['link.traceId']);
    assert.equal('7e1c10b3c482edbe', span['link.spanId']);
  });
  it('should deal with multiple values', () => {
    const span = { setAttribute: function(k,v){this[k] = v;}};
    captureTraceParent('other;dur=1234, traceparent;desc="00-000000000000000078499d3266d75d5f-7e1c10b3c482edbe-01",misc;desc="stuff"',span);
    assert.equal('000000000000000078499d3266d75d5f', span['link.traceId']);
    assert.equal('7e1c10b3c482edbe', span['link.spanId']);
  });
});

describe('test captureTraceParentFromPerformanceEntries', () => {
  it('should handle absence of serverTiming', () => {
    const entries = {};
    const span = { setAttribute: function(k,v){this[k] = v;}};
    captureTraceParentFromPerformanceEntries(entries, span);
    assert.ok(span['link.traceId'] === undefined);
  });
  it('should deal with multiple entries', () => {
    const entries = {
      serverTiming: [
        {name: 'nomatch'},
        {name: 'traceparent', description: '00-000000000000000078499d3266d75d5f-7e1c10b3c482edbe-01'}
      ]
    };
    const span = { setAttribute: function(k,v){this[k] = v;}};
    captureTraceParentFromPerformanceEntries(entries, span);
    assert.equal('000000000000000078499d3266d75d5f', span['link.traceId']);
    assert.equal('7e1c10b3c482edbe', span['link.spanId']);
  });
});
