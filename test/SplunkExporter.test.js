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

import sinon from 'sinon';
import { expect } from 'chai';

import * as api from '@opentelemetry/api';
import { timeInputToHrTime } from '@opentelemetry/core';
import { SplunkExporter } from '../src/SplunkExporter';

function buildDummySpan({
  name = '<name>',
  attributes = {},
} = {}) {
  return {
    spanContext: {
      traceId: '0000',
      spanId: '0001',
    },
    parentSpanId: '0002',
    name,
    attributes,
    kind: api.SpanKind.CLIENT,
    startTime: timeInputToHrTime(new Date()),
    duration: timeInputToHrTime(1000),
    status: { code: api.SpanStatusCode.UNSET },
    resource: { attributes: {} },
    events: [],
  };
}

describe('SplunkExporter', () => {
  let sendBeaconMock;
  let xhrFactoryMock;
  let xhrMock;
  let exporter;

  beforeEach(() => {
    sendBeaconMock = sinon.stub(navigator, 'sendBeacon').returns(true);

    xhrMock = {
      open: sinon.fake(),
      setRequestHeader: sinon.fake(),
      send: sinon.fake(),
    };
    xhrFactoryMock = sinon.fake.returns(xhrMock);
  });

  afterEach(() => {
    exporter.shutdown();
    sendBeaconMock.restore();
  });

  it('uses Beacon API if available', () => {
    exporter = new SplunkExporter({
      beaconUrl: 'https://localhost',
      xhrFactoryMock: xhrFactoryMock,
    });

    const dummySpan = buildDummySpan();
    exporter.export([dummySpan], () => {});

    const sentSpan = JSON.parse(sendBeaconMock.getCall(0).args[1])[0];
    expect(sentSpan.name).to.equal('<name>');
    expect(sentSpan.id).to.equal('0001');

    expect(xhrFactoryMock.called).to.eq(false);
  });

  it('uses XHR if Beacon API is unavailable', () => {
    exporter = new SplunkExporter({
      beaconUrl: 'https://localhost',
      beaconSender: null,
      xhrFactory: xhrFactoryMock,
    });

    const dummySpan = buildDummySpan();
    exporter.export([dummySpan], () => {});

    const sentSpan = JSON.parse(xhrMock.send.getCall(0).args[0])[0];
    expect(sentSpan.name).to.equal('<name>');
    expect(sentSpan.id).to.equal('0001');
  });

  it('limits spans sent', () => {
    exporter = new SplunkExporter({
      beaconUrl: 'https://localhost',
    });

    const dummySpan = buildDummySpan();
    const spans = [];
    for (let i = 0; i < 110; i++) { spans.push(dummySpan); }
    exporter.export(spans, () => {});

    const sentSpans = JSON.parse(sendBeaconMock.getCall(0).args[1]);
    expect(sentSpans).to.have.lengthOf(100);
  });

  it('truncates long values', () => {
    exporter = new SplunkExporter({
      beaconUrl: 'https://localhost',
    });

    const dummySpan = buildDummySpan({
      name: 'a'.repeat(5000),
      attributes: {
        longValue: 'b'.repeat(5001),
        shortValue: 'c'.repeat(4000),
      },
    });
    exporter.export([dummySpan], () => {});

    const sentSpan = JSON.parse(sendBeaconMock.getCall(0).args[1])[0];
    expect(sentSpan.name).to.eq('a'.repeat(4096));
    expect(sentSpan.tags['longValue']).to.eq('b'.repeat(4096));
    expect(sentSpan.tags['shortValue']).to.eq('c'.repeat(4000));
  });

  it('allows hooking into serialization', () => {
    exporter = new SplunkExporter({
      beaconUrl: 'https://localhost',
      onAttributesSerializing: () => ({
        key1: 'new value1',
        key3: 'value3',
      }),
    });

    const dummySpan = buildDummySpan({
      attributes: {
        key1: 'value1',
        key2: 'value2',
      },
    });
    exporter.export([dummySpan], () => {});

    const sentSpan = JSON.parse(sendBeaconMock.getCall(0).args[1])[0];
    expect(sentSpan.name).to.eq('<name>');
    console.log(sentSpan.tags);
    expect(sentSpan.tags).to.deep.equal({
      key1: 'new value1',
      key3: 'value3',
      'ot.status_code': 'UNSET'
    });
  });
});
