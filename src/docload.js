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

import {DocumentLoad} from '@opentelemetry/plugin-document-load';
import {captureTraceParentFromPerformanceEntries} from './servertiming';


function addExtraDocLoadTags(span) {
  if (document.referrer && document.referrer !== '') {
    span.setAttribute('document.referrer', document.referrer);
  }
  if (window.screen) {
    span.setAttribute('screen.xy', window.screen.width+'x'+window.screen.height);
  }
}

export class SplunkDocumentLoad extends DocumentLoad {

  _endSpan(span, performanceName, entries) {
    if (span && span.name !== 'documentLoad') { // only apply links to document/resource fetch
      captureTraceParentFromPerformanceEntries(entries, span);
    }
    if (span && span.name === 'documentLoad') {
      addExtraDocLoadTags(span);
    }
    return super._endSpan(span, performanceName, entries);
  }
  // To maintain compatibility, getEntries copies out select items from
  // different versions of the performance API into its own structure for the
  // initial document load (but leaves the entries undisturbed for resource loads).
  _getEntries() {
    const answer = super._getEntries();
    if (answer) { //this is always empty object and truthy iirc
      const navEntries = performance.getEntriesByType && performance.getEntriesByType('navigation');
      if (navEntries && navEntries[0] && navEntries[0].serverTiming) {
        answer.serverTiming = navEntries[0].serverTiming;
      }
    }
    return answer;
  }
}
