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

import { SpanAttributes } from '@opentelemetry/api';

export const enum SplunkOtelWebEventType {
  SessionChanged = 'session-changed',
  GlobalAttributesChanged = 'global-attributes-changed',
}

export class SessionIdChangedEvent extends Event {
  constructor(
    public payload: {
      sessionId: string,
    },
  ) {
    super(SplunkOtelWebEventType.SessionChanged);
  }
}

export class GlobalAttributesChangedEvent extends Event {
  constructor(
    public payload: {
      attributes: SpanAttributes,
    },
  ) {
    super(SplunkOtelWebEventType.GlobalAttributesChanged);
  }
}

export interface InternalEventTarget {
  addEventListener(name: SplunkOtelWebEventType.SessionChanged, callback: (event: SessionIdChangedEvent) => void): void;
  addEventListener(name: SplunkOtelWebEventType.GlobalAttributesChanged, callback: (event: GlobalAttributesChangedEvent) => void): void;

  removeEventListener(name: SplunkOtelWebEventType.SessionChanged, callback: (event: SessionIdChangedEvent) => void): void;
  removeEventListener(name: SplunkOtelWebEventType.GlobalAttributesChanged, callback: (event: GlobalAttributesChangedEvent) => void): void;

  dispatchEvent(event: SessionIdChangedEvent | GlobalAttributesChangedEvent);
}

export interface SplunkOtelWebEventTarget {
  _experimental_addEventListener: InternalEventTarget['addEventListener'];
  _experimental_removeEventListener: InternalEventTarget['removeEventListener']
}

export function buildInternalEventTarget(): InternalEventTarget {
  return document.createElement('div');
}
