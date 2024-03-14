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

import { Attributes } from '@opentelemetry/api';
import { Span, SpanProcessor } from '@opentelemetry/sdk-trace-base';
import { getRumSessionId } from './session';

export class SplunkSpanAttributesProcessor implements SpanProcessor {
  private readonly _globalAttributes: Attributes;

  constructor(globalAttributes: Attributes) {
    this._globalAttributes = globalAttributes ?? {};
  }

  setGlobalAttributes(attributes?: Attributes): void {
    if (attributes) {
      Object.assign(this._globalAttributes, attributes);
    } else {
      for (const key of Object.keys(this._globalAttributes)) {
        delete this._globalAttributes[key];
      }
    }
  }

  getGlobalAttributes(): Attributes {
    return this._globalAttributes;
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  onStart(span: Span): void {
    span.setAttribute('location.href', location.href);
    span.setAttributes(this._globalAttributes);
    span.setAttribute('splunk.rumSessionId', getRumSessionId());
  }

  onEnd(): void {
    // Intentionally empty
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }

}
