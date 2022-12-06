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

import {
  INVALID_SPAN_CONTEXT,
  Context,
  HrTime,
  SpanOptions,
  SpanAttributes,
  Span as APISpan,
  SpanContext,
  SpanKind,
  Link,
  TimeInput,
  TraceFlags,
  diag,
  propagation, context, trace, 
} from '@opentelemetry/api';
import {
  Clock,
  hrTimeDuration,
  isTimeInput,
  isTracingSuppressed,
  otperformance,
  sanitizeAttributes,
  isTimeInputHrTime,
} from '@opentelemetry/core';
import {
  Span as BaseSpan,
  Tracer as BaseTracer
} from '@opentelemetry/sdk-trace-base';
import {
  SamplingDecision,
  WebTracerProvider as BaseWebTracerProvider
} from '@opentelemetry/sdk-trace-web';

// Integrate fix for time drift
// https://github.com/open-telemetry/opentelemetry-js/pull/3434

// Since currently we can get HrTimes from non-corrected sources (currently
// released ver of @otel/core) add a flagging system that flags when we are
// confident the timestamp doesn't have drift
interface FlaggedHrTime extends HrTime {
  correct: true;
}

function flagCorrectHrTime(input: HrTime | FlaggedHrTime): FlaggedHrTime {
  (input as FlaggedHrTime).correct = true;
  return input as FlaggedHrTime;
}

const NANOSECOND_DIGITS = 9;
const SECOND_TO_NANOSECONDS = Math.pow(10, NANOSECOND_DIGITS);

function getTimeOrigin(): number {
  let timeOrigin = performance.timeOrigin;
  if (typeof timeOrigin !== 'number') {
    const perf = performance;
    timeOrigin = perf.timing && perf.timing.fetchStart;
  }
  return timeOrigin;
}

function epochMillisToHrTime(epochMillis: number): HrTime {
  const epochSeconds = epochMillis / 1000;
  // Decimals only.
  const seconds = Math.trunc(epochSeconds);
  // Round sub-nanosecond accuracy to nanosecond.
  const nanos =
    Number((epochSeconds - seconds).toFixed(NANOSECOND_DIGITS)) *
    SECOND_TO_NANOSECONDS;
  return [seconds, nanos];
}

function addHrTimes(time1: HrTime, time2: HrTime): HrTime {
  const out: HrTime = [time1[0] + time2[0], time1[1] + time2[1]];

  if (out[1] > SECOND_TO_NANOSECONDS) {
    out[0] = out[0] + Math.floor(out[1] / SECOND_TO_NANOSECONDS);
    out[1] = out[1] % SECOND_TO_NANOSECONDS;
  }

  return out;
}

function hrTime(performanceNow?: number): HrTime {
  const timeOrigin = epochMillisToHrTime(getTimeOrigin());
  const now = epochMillisToHrTime(
    typeof performanceNow === 'number' ? performanceNow : performance.now()
  );

  return addHrTimes(timeOrigin, now);
}

// packages/opentelemetry-sdk-trace-base/src/Span.ts
class Span extends BaseSpan {
  private readonly _performanceStartTime: number;
  private readonly _performanceOffset: number;
  private readonly _startTimeProvided: boolean;

  constructor(
    parentTracer: BaseTracer,
    context: Context,
    spanName: string,
    spanContext: SpanContext,
    kind: SpanKind,
    parentSpanId?: string,
    links: Link[] = [],
    startTime?: TimeInput,
    _deprecatedClock: Clock = otperformance
  ) {
    super(
      parentTracer,
      context,
      spanName,
      spanContext,
      kind,
      parentSpanId,
      links,
      startTime,
      _deprecatedClock
    );

    // PR changes START
    const now = Date.now();
    this._performanceStartTime = otperformance.now();
    this._performanceOffset = now - (this._performanceStartTime + getTimeOrigin());
    // eslint-disable-next-line eqeqeq
    this._startTimeProvided = startTime != null;

    // @ts-expect-error private
    // eslint-disable-next-line eqeqeq
    this.startTime = this._getTime(startTime ?? now);
    // PR CHANGES END
  }

  addEvent(
    name: string,
    attributesOrStartTime?: SpanAttributes | TimeInput,
    timeStamp?: TimeInput
  ): this {
    // @ts-expect-error private
    if (this._isSpanEnded()) {return this;}
    // @ts-expect-error private
    if (this._spanLimits.eventCountLimit === 0) {
      diag.warn('No events allowed.');
      return this;
    }
    // @ts-expect-error private
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    if (this.events.length >= this._spanLimits.eventCountLimit!) {
      diag.warn('Dropping extra events.');
      this.events.shift();
    }

    if (isTimeInput(attributesOrStartTime)) {
      if (!isTimeInput(timeStamp)) {
        timeStamp = attributesOrStartTime;
      }
      attributesOrStartTime = undefined;
    }

    const attributes = sanitizeAttributes(attributesOrStartTime);
    this.events.push({
      name,
      attributes,
      time: this._getTime(timeStamp),
    });
    return this;
  }

  end(endTime?: TimeInput): void {
    // @ts-expect-error private
    if (this._isSpanEnded()) {
      diag.error('You can only call end() on a span once.');
      return;
    }
    // @ts-expect-error private
    this._ended = true;

    // PR CHANGES START
    this.endTime = this._getTime(endTime);
    // PR CHANGES END
    // @ts-expect-error private
    this._duration = hrTimeDuration(this.startTime, this.endTime);

    // @ts-expect-error private
    if (this._duration[0] < 0) {
      diag.warn(
        'Inconsistent start and end time, startTime > endTime. Setting span duration to 0ms.',
        this.startTime,
        this.endTime
      );
      this.endTime = this.startTime.slice() as HrTime;
      // @ts-expect-error private
      this._duration = [0, 0];
    }

    // @ts-expect-error private
    this._spanProcessor.onEnd(this);
  }

  private _getTime(inp?: TimeInput): HrTime {
    if (typeof inp === 'number' && inp < otperformance.now()) {
      // must be a performance timestamp
      // apply correction and convert to hrtime
      return flagCorrectHrTime(hrTime(inp + this._performanceOffset));
    }

    if (typeof inp === 'number') {
      return flagCorrectHrTime(epochMillisToHrTime(inp));
    }

    if (inp instanceof Date) {
      return flagCorrectHrTime(epochMillisToHrTime(inp.valueOf()));
    }

    if (isTimeInputHrTime(inp)) {
      if ((inp as FlaggedHrTime).correct) {
        return inp;
      }

      // Likely from non-corrected source (eg. @otel/core), adjust with drift
      return addHrTimes(inp, [0, this._performanceOffset * 1e6]);
    }

    if (this._startTimeProvided) {
      // if user provided a time for the start manually
      // we can't use duration to calculate event/end times
      return flagCorrectHrTime(epochMillisToHrTime(Date.now()));
    }

    const msDuration = otperformance.now() - this._performanceStartTime;
    return flagCorrectHrTime(addHrTimes(this.startTime, epochMillisToHrTime(msDuration)));
  }
}

BaseTracer.prototype.startSpan = function (
  name: string,
  options: SpanOptions = {},
  ctx = context.active()
): APISpan {
  // remove span from context in case a root span is requested via options
  if (options.root) {
    ctx = trace.deleteSpan(ctx);
  }
  const parentSpan = trace.getSpan(ctx);

  if (isTracingSuppressed(ctx)) {
    diag.debug('Instrumentation suppressed, returning Noop Span');
    const nonRecordingSpan = trace.wrapSpanContext(
      INVALID_SPAN_CONTEXT
    );
    return nonRecordingSpan;
  }

  const parentSpanContext = parentSpan?.spanContext();
  const spanId = this._idGenerator.generateSpanId();
  let traceId: string;
  let traceState;
  let parentSpanId;
  if (
    !parentSpanContext ||
    !trace.isSpanContextValid(parentSpanContext)
  ) {
    // New root span.
    traceId = this._idGenerator.generateTraceId();
  } else {
    // New child span.
    traceId = parentSpanContext.traceId;
    traceState = parentSpanContext.traceState;
    parentSpanId = parentSpanContext.spanId;
  }

  const spanKind = options.kind ?? SpanKind.INTERNAL;
  const links = (options.links ?? []).map(link => {
    return {
      context: link.context,
      attributes: sanitizeAttributes(link.attributes),
    };
  });
  const attributes = sanitizeAttributes(options.attributes);
  // make sampling decision
  const samplingResult = this._sampler.shouldSample(
    ctx,
    traceId,
    name,
    spanKind,
    attributes,
    links
  );

  const traceFlags =
    samplingResult.decision === SamplingDecision.RECORD_AND_SAMPLED
      ? TraceFlags.SAMPLED
      : TraceFlags.NONE;
  const spanContext = { traceId, spanId, traceFlags, traceState };
  if (samplingResult.decision === SamplingDecision.NOT_RECORD) {
    diag.debug(
      'Recording is off, propagating context in a non-recording span'
    );
    const nonRecordingSpan = trace.wrapSpanContext(spanContext);
    return nonRecordingSpan;
  }

  const span = new Span(
    this,
    ctx,
    name,
    spanContext,
    spanKind,
    parentSpanId,
    links,
    options.startTime
  );
  // Set initial span attributes. The attributes object may have been mutated
  // by the sampler, so we sanitize the merged attributes before setting them.
  const initAttributes = sanitizeAttributes(
    Object.assign(attributes, samplingResult.attributes)
  );
  span.setAttributes(initAttributes);
  return span;
};

export class SplunkWebTracerProvider extends BaseWebTracerProvider {
  shutdown(): Promise<void> {
    return new Promise<void>((resolve) => {
      // TODO: upstream
      // note: BasicTracerProvider registers the propagator given to it in config
      // if the global propagator is the same as the one we registered, then we should deregister it
      propagation.disable();
      context.disable();
      trace.disable();
      resolve();
    }).then(() => super.shutdown());
  }
}
