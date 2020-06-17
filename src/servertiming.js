
export function captureTraceParent(serverTimingValues, span) {
  // getResponseHeader returns multiple Server-Timing headers concat with ', '
  // fetch returns concat with ','.
  // split the difference
  const regex = new RegExp('traceparent;desc="00-([0-9a-f]{32})-([0-9a-f]{16})-01"');
  for(var header of serverTimingValues.split(',')) {
    header = header.trim();
    const match = header.match(regex);
    if (match && match[1] && match[2]) {
      const traceId = match[1];
      const spanId = match[2];
      span.setAttribute('link.traceId', traceId);
      span.setAttribute('link.spanId', spanId);
    }
  }
}

