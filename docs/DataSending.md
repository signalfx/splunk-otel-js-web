# Data sending

Data is sent to `beaconUrl` in every five seconds using `beacon` or `XHR` depending on each browser's capabilities and limits. 

## Limits

The Splunk Browser agent has built-in limits for situations where the instrumentations would capture too much telemetry:

- Up to 100 spans in 30 seconds per component. If this limit is exceeded, spans are not sent to the ingest endpoint.
- Tag values can be up to 4096 characters long; longer tag values are truncated.
- Frequency of sending data batches is set to 5000 ms.
- Batch size, as determined by the number of spans, is set to 20 spans. 

## Geolocation data

The beacon sends IP addresses as part of the data payload. Collected IP addresses are used in the APM back end to map the geographical location of the user (country, city, etc.).
