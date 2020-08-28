// And now for patching in docload to look for Server-Timing
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
    if (answer) {
      const navEntries = performance.getEntriesByType('navigation');
      if (navEntries && navEntries[0] && navEntries[0].serverTiming) {
        answer.serverTiming = navEntries[0].serverTiming;
      }
    }
    return answer;
  }
}
