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

import { context, setSpan } from '@opentelemetry/api';
import { SpanProcessor } from '@opentelemetry/tracing';
import { expect } from 'chai';
import SplunkOtelWeb, { INSTRUMENTATIONS_ALL_DISABLED } from '../src/index';
import { SpanCapturer } from './utils';

describe('async context propagation', () => {
  const capturer = new SpanCapturer();
  beforeEach(() => {
    SplunkOtelWeb.init({
      app: 'my-app',
      beaconUrl: 'https://localhost:9411/api/traces',
      rumAuth: 'xxx',
      instrumentations: INSTRUMENTATIONS_ALL_DISABLED,
    });

    SplunkOtelWeb.provider?.addSpanProcessor(capturer as any as SpanProcessor);
  });
  afterEach(() => {
    SplunkOtelWeb.deinit();
    capturer.clear();
  });

  it('setTimeout', (done) => {
    const tracer = SplunkOtelWeb.provider.getTracer('test');
    const span = tracer.startSpan('test-span');
    context.with(setSpan(context.active(), span), () => {
      setTimeout(() => {
        tracer.startSpan('child-span').end();
        span.end();

        expect(capturer.spans).to.have.length(2);
        const [childSpan, parentSpan] = capturer.spans;
        expect(childSpan.parentSpanId).to.eq(parentSpan.spanContext.spanId);
        expect(childSpan.spanContext.traceId).to.eq(parentSpan.spanContext.traceId);
        done();
      });
    });
  });

  it('Promise.then', (done) => {
    const tracer = SplunkOtelWeb.provider.getTracer('test');
    const span = tracer.startSpan('test-span');
    context.with(setSpan(context.active(), span), () => {
      Promise.resolve().then(() => {
        tracer.startSpan('child-span').end();
        span.end();

        expect(capturer.spans).to.have.length(2);
        const [childSpan, parentSpan] = capturer.spans;
        expect(childSpan.parentSpanId).to.eq(parentSpan.spanContext.spanId);
        expect(childSpan.spanContext.traceId).to.eq(parentSpan.spanContext.traceId);
        done();
      });
    });
  });

  it('Promise.then - catch', (done) => {
    const tracer = SplunkOtelWeb.provider.getTracer('test');
    const span = tracer.startSpan('test-span');
    context.with(setSpan(context.active(), span), () => {
      Promise.reject().then(() => null, () => {
        tracer.startSpan('child-span').end();
        span.end();

        expect(capturer.spans).to.have.length(2);
        const [childSpan, parentSpan] = capturer.spans;
        expect(childSpan.parentSpanId).to.eq(parentSpan.spanContext.spanId);
        expect(childSpan.spanContext.traceId).to.eq(parentSpan.spanContext.traceId);
        done();
      });
    });
  });

  it('Promise.catch', (done) => {
    const tracer = SplunkOtelWeb.provider.getTracer('test');
    const span = tracer.startSpan('test-span');
    context.with(setSpan(context.active(), span), () => {
      Promise.reject().catch(() => {
        tracer.startSpan('child-span').end();
        span.end();

        expect(capturer.spans).to.have.length(2);
        const [childSpan, parentSpan] = capturer.spans;
        expect(childSpan.parentSpanId).to.eq(parentSpan.spanContext.spanId);
        expect(childSpan.spanContext.traceId).to.eq(parentSpan.spanContext.traceId);
        done();
      });
    });
  });

  it('mutation observer on chardata', (done) => {
    const tracer = SplunkOtelWeb.provider.getTracer('test');
    const span = tracer.startSpan('test-span');

    const observer = new MutationObserver(function () {
      tracer.startSpan('child-span').end();
      span.end();

      expect(capturer.spans).to.have.length(2);
      const [childSpan, parentSpan] = capturer.spans;
      expect(childSpan.parentSpanId).to.eq(parentSpan.spanContext.spanId);
      expect(childSpan.spanContext.traceId).to.eq(parentSpan.spanContext.traceId);
      done();
    });

    let counter = 1;
    const textNode = document.createTextNode(String(counter));
    observer.observe(textNode, {
      characterData: true
    });

    context.with(setSpan(context.active(), span), () => {
      textNode.data = String(counter++);
    });
  });

  it('xhr event', (done) => {
    const tracer = SplunkOtelWeb.provider.getTracer('test');
    const span = tracer.startSpan('test-span');
    context.with(setSpan(context.active(), span), () => {
      const req = new XMLHttpRequest();
      req.open('GET', location.href);
      req.send();

      req.addEventListener('load', () => {
        tracer.startSpan('child-span').end();
        span.end();

        expect(capturer.spans).to.have.length(2);
        const [childSpan, parentSpan] = capturer.spans;
        expect(childSpan.parentSpanId).to.eq(parentSpan.spanContext.spanId);
        expect(childSpan.spanContext.traceId).to.eq(parentSpan.spanContext.traceId);
        done();
      });
    });
  });

  it('xhr onevent', (done) => {
    const tracer = SplunkOtelWeb.provider.getTracer('test');
    const span = tracer.startSpan('test-span');
    context.with(setSpan(context.active(), span), () => {
      const req = new XMLHttpRequest();
      req.open('GET', location.href);
      req.send();

      req.onload = () => {
        tracer.startSpan('child-span').end();
        span.end();

        expect(capturer.spans).to.have.length(2);
        const [childSpan, parentSpan] = capturer.spans;
        expect(childSpan.parentSpanId).to.eq(parentSpan.spanContext.spanId);
        expect(childSpan.spanContext.traceId).to.eq(parentSpan.spanContext.traceId);
        done();
      };
    });
  });

  it('MessagePort', (done) => {
    const tracer = SplunkOtelWeb.provider.getTracer('test');
    const span = tracer.startSpan('test-span');

    const channel = new MessageChannel();
    channel.port1.onmessage = function () {
      tracer.startSpan('child-span').end();
      span.end();

      expect(capturer.spans).to.have.length(2);
      const [childSpan, parentSpan] = capturer.spans;
      expect(childSpan.parentSpanId).to.eq(parentSpan.spanContext.spanId);
      expect(childSpan.spanContext.traceId).to.eq(parentSpan.spanContext.traceId);
      done();
    };

    context.with(setSpan(context.active(), span), () => {
      channel.port2.postMessage(null);
    });
  });

});
