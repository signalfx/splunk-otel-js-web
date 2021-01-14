/*
Copyright 2020 Splunk Inc.

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

import { BasePlugin, hrTime } from '@opentelemetry/core';
import { version } from '../package.json';

const LONGTASK_PERFORMANCE_TYPE = 'longtask';
const MODULE_NAME = 'longtask';

export class SplunkLongTaskPlugin extends BasePlugin {
  constructor() {
    super('longtask', version);
  }

  patch() {
    if (!this._isSupported()) {
      return;
    }

    this._longtaskObserver = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => this._createSpanFromEntry(entry));
    });
    this._longtaskObserver.observe({entryTypes: [LONGTASK_PERFORMANCE_TYPE]});
  }

  unpatch() {
    if (!this._isSupported()) {
      return;
    }

    this._longtaskObserver.disconnect();
  }

  _createSpanFromEntry(entry) {
    const span = this._tracer.startSpan(
      'longtask',
      {
        startTime: hrTime(entry.startTime),
      }
    );
    span.setAttribute('component', MODULE_NAME);
    span.setAttribute('longtask.name', entry.name);
    span.setAttribute('longtask.entry_type', entry.entryType);
    span.setAttribute('longtask.duration', entry.duration);

    if (Array.isArray(entry.attribution)) {
      entry.attribution.forEach((attribution, index) => {
        const prefix = `longtask.attribution[${index}]`;
        span.setAttribute(`${prefix}.name`, attribution.name);
        span.setAttribute(`${prefix}.entry_type`, attribution.entryType);
        span.setAttribute(`${prefix}.start_time`, attribution.startTime);
        span.setAttribute(`${prefix}.duration`, attribution.duration);
        span.setAttribute(`${prefix}.container_type`, attribution.containerType);
        span.setAttribute(`${prefix}.container_src`, attribution.containerSrc);
        span.setAttribute(`${prefix}.container_id`, attribution.containerId);
        span.setAttribute(`${prefix}.container_name`, attribution.containerName);
      });
    }

    span.end();
  }

  _isSupported() {
    return !!window.PerformanceObserver;
  }
}
