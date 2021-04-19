import { expect } from 'chai';
import { context, setSpan, getSpan, SpanStatusCode, trace } from '@opentelemetry/api';

import SplunkOtelWeb, { INSTRUMENTATIONS_ALL_DISABLED } from '..';
import { SpanCapturer } from './utils';
import { SpanProcessor } from '@opentelemetry/tracing';

// note: we've added these tests mainly to keep track of substantial changes in the Open Telemetry API
describe('Transitive API', () => {
  let spanCapturer = new SpanCapturer();

  beforeEach(() => {
    SplunkOtelWeb.init({ 
      app: 'my-app',
      beaconUrl: 'https://localhost:9411/api/traces',
      rumAuth: 'xxx',
      instrumentations: INSTRUMENTATIONS_ALL_DISABLED,
    });

    spanCapturer = new SpanCapturer();
    SplunkOtelWeb.provider!.addSpanProcessor(spanCapturer as any as SpanProcessor);
  });

  afterEach(() => {
    SplunkOtelWeb.deinit();
  });

  describe('Tracer', () => {
    function subject() {
      return SplunkOtelWeb.provider!.getTracer('test');
    }

    it('should return a tracer', () => {
      const tracer = subject();
      expect(typeof tracer.startSpan).to.eql('function');
      expect(typeof tracer.getActiveSpanProcessor).to.eql('function');
      expect(typeof tracer.getActiveTraceParams).to.eql('function');
    });

    it('can start a span', () => {
      const span = subject().startSpan('span.test');

      expect(typeof span.end).to.eql('function');
      expect(typeof span.context).to.eql('function');
      expect(typeof span.recordException).to.eql('function');
      expect(typeof span.setAttributes).to.eql('function');
      expect(typeof span.setStatus).to.eql('function');

      span.end();
    });
  });

  describe('Span', () => {
    const startTime = new Date(2021, 1, 1, 0, 0, 0, 0);
    function subject() {
      return SplunkOtelWeb.provider!.getTracer('test').startSpan('test.span', { startTime });
    }

    it('can set duration', () => {
      const span = subject();
      span.end(new Date(2021, 1, 1, 0, 1, 1, 0));

      expect(spanCapturer.spans[0].duration).to.deep.eq([61, 0]);
    });

    it('can set attributes', () => {
      const span = subject();
      span.setAttributes({
        attr1: 'val1',
        attr2: 'val2',
      });
      span.end();

      expect(spanCapturer.spans[0].attributes['attr1']).to.eq('val1');
      expect(spanCapturer.spans[0].attributes['attr2']).to.eq('val2');
    });

    it('can set status', () => {
      const span = subject();
      span.setStatus({ code: SpanStatusCode.UNSET });
      span.setStatus({ code: SpanStatusCode.OK });
      span.setStatus({ code: SpanStatusCode.ERROR });
      span.end();

      expect(spanCapturer.spans[0].status.code).to.eq(SpanStatusCode.ERROR);
    });

    it('can set record an exception', () => {
      const span = subject();
      class CustomError extends Error {}
      span.recordException(new CustomError('Exception to be recorded.'));
      span.end();

      expect(spanCapturer.spans[0].status.code).to.eq(SpanStatusCode.UNSET);
      expect(spanCapturer.spans[0].events[0].name).to.eq('exception');
      expect(spanCapturer.spans[0].events[0].attributes['exception.type']).to.eq('Error');
      expect(spanCapturer.spans[0].events[0].attributes['exception.message']).to.eq('Exception to be recorded.');
    });
  });

  describe('api.context', () => {
    it('can set span as active', () => {
      const tracer = SplunkOtelWeb.provider.getTracer('test');
      const span = tracer.startSpan('test-span');
      context.with(setSpan(context.active(), span), () => {
        expect(getSpan(context.active())).to.eq(span);
      });
    });

    it('can create a child of an active span', () => {
      const tracer = SplunkOtelWeb.provider.getTracer('test');
      const span = tracer.startSpan('test-span');
      context.with(setSpan(context.active(), span), () => {
        tracer.startSpan('child-span').end();
      });
      span.end();

      expect(spanCapturer.spans).to.have.length(2);

      const [childSpan, parentSpan] = spanCapturer.spans;
      expect(childSpan.parentSpanId).to.eq(parentSpan.spanContext.spanId);
      expect(childSpan.spanContext.traceId).to.eq(parentSpan.spanContext.traceId);
    });
  });
});
