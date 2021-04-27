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

import { InstrumentationConfig } from '@opentelemetry/instrumentation';
import { DocumentLoadInstrumentation } from '@opentelemetry/instrumentation-document-load';
import * as api from '@opentelemetry/api';
import { captureTraceParentFromPerformanceEntries } from './servertiming';
import { PerformanceEntries } from '@opentelemetry/web';
import { Span } from '@opentelemetry/tracing';

const excludedInitiatorTypes = ['beacon', 'fetch', 'xmlhttprequest'];

function addExtraDocLoadTags(span: api.Span) {
  if (document.referrer && document.referrer !== '') {
    span.setAttribute('document.referrer', document.referrer);
  }
  if (window.screen) {
    span.setAttribute('screen.xy', window.screen.width + 'x' + window.screen.height);
  }
}

type ExposedSuper = {
  _endSpan(span: api.Span | undefined, performanceName: string, entries: PerformanceEntries): void;
  _getEntries(): PerformanceEntries;
  _initResourceSpan(resource: PerformanceResourceTiming, parentSpan: api.Span): void;
}

export class SplunkDocumentLoadInstrumentation extends DocumentLoadInstrumentation {
  constructor(config: InstrumentationConfig = {}) {
    super(config);

    const exposedSuper = (this as any as ExposedSuper);

    const _superEndSpan: ExposedSuper['_endSpan'] = exposedSuper._endSpan.bind(this);
    exposedSuper._endSpan = (span, performanceName, entries) => {
      // TODO: upstream exposed name on api.Span, then fix
      const exposedSpan = (span as any as Span);

      if (span && exposedSpan.name !== 'documentLoad') { // only apply links to document/resource fetch
        captureTraceParentFromPerformanceEntries(entries, span);
      }
      if (span && exposedSpan.name === 'documentLoad') {
        addExtraDocLoadTags(span);
      }
      return _superEndSpan(span, performanceName, entries);
    }

    const _superInitResourceSpan: ExposedSuper['_initResourceSpan'] = exposedSuper._initResourceSpan.bind(this);
    exposedSuper._initResourceSpan = (resource, parentSpan) => {
      if (excludedInitiatorTypes.indexOf(resource.initiatorType) !== -1) {
        return;
      }
      _superInitResourceSpan(resource, parentSpan);
    };

    // To maintain compatibility, getEntries copies out select items from
    // different versions of the performance API into its own structure for the
    // initial document load (but leaves the entries undisturbed for resource loads).
    const _superGetEntries: ExposedSuper['_getEntries'] = exposedSuper._getEntries.bind(this);
    exposedSuper._getEntries = () => {
      const entries = _superGetEntries();
      if (entries) { //this is always empty object and truthy iirc
        const navEntries = performance?.getEntriesByType('navigation') as any;
        if (navEntries?.[0]?.serverTiming) {
          (entries as any).serverTiming = navEntries[0].serverTiming;
        }
      }
      return entries;
    }
  }
}
