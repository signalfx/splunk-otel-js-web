# Exporters

Splunk's RUM uses Zipkin exporter for sending data to `beaconUrl` endpoint. Other exporters can be registered to the OpenTelemetry provider available on `SplunkRum.provider`:

```html
import SplunkRum from '@splunk/otel-js-browser'
import {BatchSpanProcessor} from '@opentelemetry/sdk-trace-base'
import {CollectorTraceExporter} from '@opentelemetry/exporter-collector'
 
const exporter = new CollectorTraceExporter({
   url: 'https://collector.example.com'
});
SplunkRum.provider.addSpanProcessor(new BatchSpanProcessor(exporter));
```
