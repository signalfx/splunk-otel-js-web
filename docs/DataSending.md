> The official Splunk documentation for this page is [RUM data model for browser-based web applications](https://quickdraw.splunk.com/redirect/?product=Observability&location=github.rum.browser.data&version=current). For instructions on how to contribute to the docs, see [CONTRIBUTING.md](../CONTRIBUTING.md#documentation).

# Data sending

Data is sent to `beaconUrl` in every five seconds using `beacon` or `XHR` depending on each browser's capabilities and limits. 

## Limits

The Splunk Browser agent has built-in limits for situations where the instrumentations would capture too much telemetry:

- Up to 100 spans in 30 seconds per component. If this limit is exceeded, spans are not sent to the ingest endpoint.
- Tag values can be up to 4096 characters long; longer tag values are truncated.
- Frequency of sending data batches is set to 5000 ms.
- Batch size, as determined by the number of spans, is set to 20 spans. 

## Geolocation data

The browser agents sends the IP addresses of all beacon connections. Collected IP addresses are used in the APM back end to map the geographical location of the user (country, city, etc.). 

> IP addresses are not persisted in RUM and are dropped within 6 hours. Only geo metadata (country, city, and region) is calculated from the IPs.
