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

import { ReadableSpan, SimpleSpanProcessor, SpanProcessor } from '@opentelemetry/tracing';
import SplunkRum, { SplunkExporter, ZipkinSpan } from '../src/index';

export class SpanCapturer implements SpanProcessor {
  public readonly spans: ReadableSpan[] = [];
  forceFlush(): Promise<void> { return Promise.resolve(); }
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onStart(): void {}
  shutdown(): Promise<void> { return Promise.resolve(); }
  onEnd(span: ReadableSpan): void {
    this.spans.push(span);
  }
  clear(): void {
    this.spans.length = 0;
  }
}

export function buildInMemorySplunkExporter(): {
  exporter: SplunkExporter,
  getFinishedSpans: () => ZipkinSpan[],
  } {
  const spans: ZipkinSpan[] = [];
  const exporter = new SplunkExporter({
    beaconUrl: null,
    beaconSender: null,
    xhrSender: (_, data) => {
      if (typeof data === 'string') {
        const newSpans = (JSON.parse(data) as ZipkinSpan[]);
        spans.splice(spans.length, 0, ...newSpans);
      }
    },
  });

  return {
    exporter,
    getFinishedSpans: () => spans,
  };
}

export function initWithDefaultConfig(capturer: SpanCapturer, additionalOptions = {}): void {
  SplunkRum._internalInit({
    beaconUrl: 'http://127.0.0.1:8888/v1/trace',
    allowInsecureBeacon: true,
    app: 'my-app',
    environment: 'my-env',
    globalAttributes: { customerType: 'GOLD' },
    bufferTimeout: 0,
    rumAuth: undefined,
    ...additionalOptions,
  });
  SplunkRum.provider.addSpanProcessor(capturer);
}

export function initWithSyncPipeline(additionalOptions = {}): {
  forceFlush: () => Promise<void>,
  getFinishedSpans: () => ZipkinSpan[],
} {
  const { exporter, getFinishedSpans } = buildInMemorySplunkExporter();
  const processor = new SimpleSpanProcessor(exporter);

  SplunkRum._internalInit({
    beaconUrl: 'http://127.0.0.1:8888/v1/trace',
    allowInsecureBeacon: true,
    app: 'my-app',
    environment: 'my-env',
    bufferTimeout: 0,
    rumAuth: undefined,
    exporter: { factory: () => exporter },
    spanProcessor: { factory: () => processor },
    ...additionalOptions,
  });

  return {
    forceFlush: () => processor.forceFlush(),
    getFinishedSpans,
  };
}

export function deinit(): void {
  SplunkRum.deinit();
}
