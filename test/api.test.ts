import { expect } from 'chai';
import { context, setSpan, getSpan } from '@opentelemetry/api';

import SplunkOtelWeb, { SplunkWebTracerProvider } from '..';

describe.only('Transitive API', () => {
  beforeEach(() => {
    SplunkOtelWeb.init({ 
      app: 'my-app',
      beaconUrl: 'https://localhost:9411/api/traces',
      rumAuth: 'xxx',
      instrumentations: {
        
      },
    })
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
      span.end(new Date(2021, 1, 1, 0, 0, 0, 100));

      
    });

    it('can set attributes');
    it('can set status');
    it('can set record an exception');
  });

  describe('api.context', () => {
    it('can set span as active', () => {
      const tracer = SplunkOtelWeb.provider.getTracer('test');
      const span = tracer.startSpan('testSpan');
      context.with(setSpan(context.active(), span), () => {
        expect(getSpan(context.active())).to.eq(span);
      });
    });
  });
});
