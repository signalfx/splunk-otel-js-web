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

export interface SplunkOtelWebEventTypes {
  'session-changed': {
    sessionId: string
  };
  'global-attributes-changed': {
    attributes: Attributes
  }
}

type SplunkEventListener<type extends keyof SplunkOtelWebEventTypes> =
  (event: {payload: SplunkOtelWebEventTypes[type]}) => void;

export class InternalEventTarget {
  protected events: Partial<{[T in keyof SplunkOtelWebEventTypes]: SplunkEventListener<T>[]}> = {};

  addEventListener<T extends keyof SplunkOtelWebEventTypes>(type: T, listener: SplunkEventListener<T>): void {
    if (!this.events[type]) {
      this.events[type] = [];
    }
    (this.events[type] as SplunkEventListener<T>[]).push(listener);
  }

  removeEventListener<T extends keyof SplunkOtelWebEventTypes>(type: T, listener: SplunkEventListener<T>): void {
    if (!this.events[type]) {
      return;
    }

    const i = (this.events[type] as SplunkEventListener<T>[]).indexOf(listener);

    if (i >= 0) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.events[type]!.splice(i, 1);
    }
  }

  emit<T extends keyof SplunkOtelWebEventTypes>(type: T, payload: SplunkOtelWebEventTypes[T]): void {
    const listeners = this.events[type];
    if (!listeners) {
      return;
    }

    listeners.forEach(listener => {
      // Run it as promise so any broken code inside listener doesn't break the agent
      Promise.resolve({ payload }).then(listener);
    });
  }
}



export interface SplunkOtelWebEventTarget {
  addEventListener: InternalEventTarget['addEventListener'];
  /**
   * @deprecated Use {@link addEventListener}
   */
  _experimental_addEventListener: InternalEventTarget['addEventListener'];
  removeEventListener: InternalEventTarget['removeEventListener'];
  /**
   * @deprecated Use {@link removeEventListener}
   */
  _experimental_removeEventListener: InternalEventTarget['removeEventListener'];
}
