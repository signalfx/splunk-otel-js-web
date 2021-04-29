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

import { ReadableSpan, SpanProcessor } from '@opentelemetry/tracing';
import SplunkRum from '../src/index';

export class SpanCapturer implements SpanProcessor {
  public readonly spans: ReadableSpan[] = [];
  forceFlush() { return Promise.resolve(); }
  onStart() {}
  shutdown() { return Promise.resolve(); }
  onEnd(span) {
    this.spans.push(span);
  }
  clear() {
    this.spans.length = 0;
  }
}

export function initWithDefaultConfig(capturer, additionalOptions = {}) {
  SplunkRum._internalInit(Object.assign({}, additionalOptions, {
    beaconUrl: 'http://127.0.0.1:8888/v1/trace',
    allowInsecureBeacon: true,
    app: 'my-app',
    environment: 'my-env',
    globalAttributes: {customerType: 'GOLD'},
    bufferTimeout: 0,
    rumAuth: undefined,
  }));
  SplunkRum.provider.addSpanProcessor(capturer);
}

export function deinit() {
  SplunkRum.deinit();
}
