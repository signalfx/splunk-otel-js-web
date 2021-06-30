/*
Copyright 2021 Splunk Inc.

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

import { context, propagation } from '@opentelemetry/api';
import {
  RandomIdGenerator,
  HttpBaggagePropagator,
} from '@opentelemetry/core';
import { InMemorySpanExporter } from '@opentelemetry/tracing';
import { expect } from 'chai';
import * as sinon from 'sinon';
import SplunkRum from '../src';
import { SYNTHETIC_RUN_ID_FIELD } from '../src/SplunkBatchSpanProcessor';

describe('propagation', () => {
  const sandbox = sinon.createSandbox();
  let setGlobalPropagatorSpy: sinon.SinonSpy;
  let exporter: InMemorySpanExporter;

  beforeEach(function () {
    setGlobalPropagatorSpy = sandbox.spy(propagation, 'setGlobalPropagator');

    exporter = new InMemorySpanExporter();
    SplunkRum._internalInit({
      beaconUrl: 'https://127.0.0.1:8888/bar',
      app: 'app',
      rumAuth: undefined,
      exporter: {
        _factory: () => exporter,
      },
    });
  });

  afterEach(function () {
    SplunkRum.deinit();
    sandbox.restore();
  });

  it('must use HttpBaggagePropagator', () => {
    expect(setGlobalPropagatorSpy.calledOnce).to.be.true;
    expect(setGlobalPropagatorSpy.getCalls()[0].args[0]).to.be.instanceOf(HttpBaggagePropagator);
    SplunkRum.deinit();
  });

  it('must attach synthetic run id as an attribute', done => {
    const tracer = SplunkRum.provider.getTracer('test-tracer');

    const syntheticsTraceId = new RandomIdGenerator().generateTraceId();
    const incomingCarrier = {
      baggage: 'Synthetics-RunId=' + syntheticsTraceId,
    };
    const newContext = propagation.extract(context.active(), incomingCarrier);
    tracer.startSpan('request handler', {}, newContext).end();

    (SplunkRum as any)._processor.forceFlush().then(() => {
      expect(exporter.getFinishedSpans().length).to.eql(1);
      expect(
        exporter.getFinishedSpans()[0].attributes[SYNTHETIC_RUN_ID_FIELD],
      ).to.eql(syntheticsTraceId);

      done();
    });
  });

  it('must not attach synthetic run id as an attribute', done => {
    const tracer = SplunkRum.provider.getTracer('test-tracer');

    const incomingCarrier = {
      baggage: 'Synthetics-RunId=invalid',
    };
    const newContext = propagation.extract(context.active(), incomingCarrier);
    tracer.startSpan('request handler', {}, newContext).end();

    (SplunkRum as any)._processor.forceFlush().then(() => {
      expect(exporter.getFinishedSpans().length).to.eql(1);
      expect(
        exporter.getFinishedSpans()[0].attributes[SYNTHETIC_RUN_ID_FIELD],
      ).to.eql(undefined);
      done();
    });
  });
});
