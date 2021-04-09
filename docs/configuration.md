# Configuration

This chapter describes the configuration parameters for the Splunk Browser Agents. Adjusting the parameter defaults along with an example how to do so is also included.

## General configuration options
Below are the different initialization options available for the Agent:

| Option  | Default value | Description |
| ------------- | ------------- |  ------------- |
| beaconUrl string [required]  | Provided by installation wizard | Sets the destination URL to which captured telemetry is sent to be ingested. Notice that the URL is specific to the actual realm you are using (i.e. us0, us1). | 
| rumAuth string [required]  |  Provided by installation wizard | Defines a token authorizing the Agent to send the telemetry to the backend. You can find (or generate) the token here. Notice that RUM and APM auth tokens are different. |


## Configuring instrumentations

## Changing the configuration: examples

In situation, where you need to change the default configuration, you need to change the object passed to `SplunkRum.init()` call:

```
<script src="/location/to/splunk-otel-web.js"></script>
<script>
  window.SplunkRum.init(
    {
      beaconUrl: 'https://rum-ingest.us0.signalfx.com/v1/rum'
      rumAuth: 'ABC123...789',
      app: 'my-awesome-app',
      // Any additional options
    });
</script>
```
