# Server Trace Context

## Rationale

`splunk-rum.js` captures the server trace context from a `Server-Timing` header in the `traceparent` format.  Our
server-side instrumentation generates this automatically.  This document describes how to recreate this if you want to 
use an alternate form of instrumentation (i.e., creating this header manually).

## Specification

Please familiarize yourself with these specifications:
- <https://www.w3.org/TR/server-timing/>
- <https://www.w3.org/TR/trace-context/#traceparent-header>

We expect a Server-Timing entry with the name `traceparent` where the `desc` field holds the
corresponding value:

```http
Server-Timing: traceparent;desc="00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00"
```

This example would resolve to a context containing:

```.properties
version=00
trace-id=4bf92f3577b34da6a3ce929d0e0e4736
parent-id=00f067aa0ba902b7
trace-flags=00
```

Note that only version `00` is supported (as of the date of this document it is the only 
version that exists) and that the `trace-flags` field is ignored.
