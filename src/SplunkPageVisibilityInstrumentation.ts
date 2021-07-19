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

import { hrTime } from '@opentelemetry/core';
import { InstrumentationBase, InstrumentationConfig } from '@opentelemetry/instrumentation';
import { VERSION } from './version';

const MODULE_NAME = 'splunk-visibility';
let listener: any;

export class SplunkPageVisibilityInstrumentation extends InstrumentationBase {

  constructor(config: InstrumentationConfig = {}) {
    super(MODULE_NAME, VERSION, Object.assign({}, config));
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  init(): void {}

  enable(): void {
    if (document.hidden) {
        console.log('enable doc hidden')
        this._createSpan(document.hidden);
    }

    listener = window.addEventListener('visibilitychange', () => {
        console.log('enable visibility change')
        this._createSpan(document.hidden);
    })
  }

  disable(): void {
      window.removeEventListener('visibilitychange', listener);
  }

  private _createSpan(hidden: boolean) {
    const now = hrTime();
    const span = this.tracer.startSpan('visibility', { startTime: now });
    span.setAttribute('hidden', hidden);
    span.end(now);
  }
}
 