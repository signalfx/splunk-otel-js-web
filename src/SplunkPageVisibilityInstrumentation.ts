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

export class SplunkPageVisibilityInstrumentation extends InstrumentationBase {
  unloading: boolean;
  visibilityListener: any;
  unloadListener: any;

  constructor(config: InstrumentationConfig = {}) {
    super(MODULE_NAME, VERSION, Object.assign({}, config));
    this.unloading = false;
  }

  init(): void {}

  enable(): void {
    if (document.hidden) {
      this._createSpan(document.hidden);
    }

    this.visibilityListener = window.addEventListener('beforeunload', () => {
      this.unloading = true;
    });

    this.visibilityListener = window.addEventListener('visibilitychange', () => {
      //ignore when page is unloading as it is expected then
      if (!this.unloading) {
        this._createSpan(document.hidden);
      }
    });
  }

  disable(): void {
    window.removeEventListener('beforeunload', this.unloadListener);
    window.removeEventListener('visibilitychange', this.visibilityListener);
  }

  private _createSpan(hidden: boolean) {
    const now = hrTime();
    const span = this.tracer.startSpan('visibility', { startTime: now });
    span.setAttribute('hidden', hidden);
    span.end(now);
  }
}
 