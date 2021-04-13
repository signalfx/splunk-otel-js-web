# Server Trace Context

## Rationale

`splunk-otel-web.js` captures the server trace context from a `Server-Timing` header in the `traceparent` format.  SignalFx
server-side instrumentation generates this automatically.  This document describes how to recreate this if you want to 
use an alternate form of instrumentation (i.e., creating this header manually).

## Specification

Please familiarize yourself with these specifications:
- <https://www.w3.org/TR/server-timing/>
- <https://www.w3.org/TR/trace-context/#traceparent-header>

We expect a Server-Timing entry with the name `traceparent` where the `desc` field holds the
corresponding value, and the sampling bit is set:

```http
Server-Timing: traceparent;desc="00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
```

This example would resolve to a context containing:

```.properties
version=00
trace-id=4bf92f3577b34da6a3ce929d0e0e4736
parent-id=00f067aa0ba902b7
trace-flags=01
```

Note that only version `00` is supported (as of the date of this document it is the only 
version that exists).  `trace-flags` must be `01` for the trace link to be picked up.

## CORS

If you are using CORS-related headers (e.g., `Access-Control-*`, you may need to grant the javascript permission to
read the server-timing header:

```http
Access-Control-Expose-Headers: Server-Timing
```
