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

import { HrTime } from '@opentelemetry/api';
import { hrTime } from '@opentelemetry/core';
import { InstrumentationBase, InstrumentationConfig } from '@opentelemetry/instrumentation';
import { VERSION } from './version';

const MODULE_NAME = 'splunk-connectivity';

export class SplunkConnectivityInstrumentation extends InstrumentationBase {
  offlineListener: any;
  onlineListener: any;
  offlineStart: HrTime;

  constructor(config: InstrumentationConfig = {}) {
    super(MODULE_NAME, VERSION, Object.assign({}, config));
    // For apps with offline support 
    this.offlineStart = navigator.onLine ? null : hrTime();
  }

  init(): void {}

  enable(): void {
    this.offlineListener = () => {
      this.offlineStart = hrTime();
    };

    this.onlineListener = () => {
      if (this.offlineStart) {
        // this could be a span but let's keep it as an "event" for now.
        this._createSpan(false, this.offlineStart);
        this._createSpan(true, hrTime());
      }
    };

    window.addEventListener('offline', this.offlineListener);
    window.addEventListener('online', this.onlineListener);
  }

  disable(): void {
    window.removeEventListener('offline', this.offlineListener);
    window.removeEventListener('online', this.onlineListener);
  }

  private _createSpan(online: boolean, startTime: HrTime) {
    const span = this.tracer.startSpan('connectivity', { startTime });
    span.setAttribute('online', online);
    span.end(startTime);
  }
}
