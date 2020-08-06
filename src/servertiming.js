function addMatchToSpan(match, span) {
  if (match && match[1] && match[2]) {
    const traceId = match[1];
    const spanId = match[2];
    span.setAttribute('link.traceId', traceId);
    span.setAttribute('link.spanId', spanId);
  }
}


const regex = new RegExp('traceparent;desc="00-([0-9a-f]{32})-([0-9a-f]{16})-01"');

export function captureTraceParent(serverTimingValues, span) {
  // getResponseHeader returns multiple Server-Timing headers concat with ', '
  // fetch returns concat with ','.
  // split the difference
  for(var header of serverTimingValues.split(',')) {
    header = header.trim();
    const match = header.match(regex);
    addMatchToSpan(match, span);
  }
}

export function captureTraceParentFromPerformanceEntries(entries, span) {
  if (!entries.serverTiming) {
    return;
  }
  for(const st of entries.serverTiming) {
    if (st.name === 'traceparent' && st.description) {
      // Note slightly different regex as above
      const regex = new RegExp('00-([0-9a-f]{32})-([0-9a-f]{16})-01');
      const match = st.description.match(regex);
      addMatchToSpan(match, span);
    }
  }
}

