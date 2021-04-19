# Data sending

Data is sent to `beaconUrl` in every five seconds using `beacon` or `XHR` depending on browser capabilities and limitations. 

Splunk Browser Agent has built-in limitations for situations where the instrumentations would capture too much telemetry:

- Up to 100 spans in 30 seconds per component. If this limit is exceeded, the spans will not be sent to the ingest.
- Tag values can be up to 4096 characters long, longer tag values will be truncated
- Frequency of sending data batches, set to 5,000ms
- Batch size in number of spans, set to 20 spans per batch. 
