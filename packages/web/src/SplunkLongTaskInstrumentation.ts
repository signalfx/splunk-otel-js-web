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

const LONGTASK_PERFORMANCE_TYPE = 'longtask';
const MODULE_NAME = 'splunk-longtask';

export class SplunkLongTaskInstrumentation extends InstrumentationBase {
  private _longtaskObserver: PerformanceObserver | undefined;

  constructor(config: InstrumentationConfig = {}) {
    super(MODULE_NAME, VERSION, Object.assign({}, config));
  }

  init(): void {}

  enable(): void {
    if (!this.isSupported()) {
      return;
    }

    this._longtaskObserver = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => this._createSpanFromEntry(entry));
    });
    this._longtaskObserver.observe({ type: LONGTASK_PERFORMANCE_TYPE, buffered: true });
  }

  disable(): void {
    if (!this.isSupported()) {
      return;
    }

    this._longtaskObserver.disconnect();
  }

  private _createSpanFromEntry(entry: PerformanceEntry) {
    const span = this.tracer.startSpan(
      LONGTASK_PERFORMANCE_TYPE,
      {
        startTime: entry.startTime,
      }
    );
    span.setAttribute('component', MODULE_NAME);
    span.setAttribute('longtask.name', entry.name);
    span.setAttribute('longtask.entry_type', entry.entryType);
    span.setAttribute('longtask.duration', entry.duration);

    const attributionList = (entry as any).attribution;
    if (Array.isArray(attributionList)) {
      attributionList.forEach((attribution, index) => {
        const prefix = attribution > 1 ? `longtask.attribution[${index}]` : 'longtask.attribution';
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

    span.end(entry.startTime + entry.duration);
  }

  // TODO: change name, _isSupported is taken by parent
  private isSupported() {
    // note: PerformanceObserver.supportedEntryTypes has better browser support than LongTask
    const supportedEntryTypes = window.PerformanceObserver && PerformanceObserver.supportedEntryTypes;
    const effectiveEntryTypes = supportedEntryTypes || [];
    return effectiveEntryTypes.includes(LONGTASK_PERFORMANCE_TYPE);
  }
}
