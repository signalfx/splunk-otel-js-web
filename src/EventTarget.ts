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

export interface SplunkOtelWebEventTarget {
  _experimental_addEventListener(name: SplunkOtelWebEventType.SessionChanged, callback: (event: SessionIdChangedEvent) => void);
  _experimental_addEventListener(name: SplunkOtelWebEventType.GlobalAttributesChanged, callback: (event: GlobalAttributesChangedEvent) => void);

  _experimental_removeEventListener(name: SplunkOtelWebEventType.SessionChanged, callback: (event: SessionIdChangedEvent) => void);
  _experimental_removeEventListener(name: SplunkOtelWebEventType.GlobalAttributesChanged, callback: (event: GlobalAttributesChangedEvent) => void);
}

export class NativeEventTarget implements SplunkOtelWebEventTarget {
  // we're using DOM API to save on bytes a little bit
  // using EventTarget directly has low browser compatibility
  private readonly target = document.createElement('div');

  _experimental_addEventListener(name: SplunkOtelWebEventType, callback: (event: never) => void): void {
    this.target.addEventListener(name, callback);
  }

  _experimental_removeEventListener(name: SplunkOtelWebEventType, callback: (event: never) => void): void {
    this.target.removeEventListener(name, callback);
  }

  dispatchEvent(event: SessionIdChangedEvent | GlobalAttributesChangedEvent): void {
    this.target.dispatchEvent(event);
  }
}
