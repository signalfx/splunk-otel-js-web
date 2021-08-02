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

const MODULE_NAME = 'splunk-online';

export class SplunkConnectivityInstrumentation extends InstrumentationBase {
  offlineListener: any;
  onlineListener: any;
  offlineStart: any;

  constructor(config: InstrumentationConfig = {}) {
    super(MODULE_NAME, VERSION, Object.assign({}, config));
    // For apps with offline support 
    this.offlineStart = navigator.onLine ? null : hrTime();
  }

  init(): void {}

  enable(): void {
    this.offlineListener = window.addEventListener('offline', () => {
      this.offlineStart = hrTime();
    });

    this.onlineListener = window.addEventListener('online', () => {
      if (this.offlineStart) {
        this.tracer.startSpan('offline', { startTime: this.offlineStart }).end();
      }
    });
  }

  disable(): void {
    window.removeEventListener('offline', this.offlineListener);
    window.removeEventListener('online', this.onlineListener);
  }
}
 