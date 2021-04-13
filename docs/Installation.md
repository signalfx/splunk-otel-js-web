# Installing

## CDN
To start monitoring with Splunk RUM distributed via CDN:
1. Include & initialize the Splunk RUM by copying the following to HEAD section for all the HTML files or templates in your application

    ```html
    <script src="https://cdn.signalfx.com/o11y-gdi-rum/latest/splunk-otel-web.js" crossorigin="anonymous"></script>
    <script>
      SplunkRum.init({
          beaconUrl: 'https://rum-ingest.<REALM>.signalfx.com/v1/rum',
          rumAuth: 'RUM access token',
          app: 'enter-your-application-name'
        });
    </script>
    ```

1. Modify the initialization parameters to specify:
   - `beaconUrl` - the destination URL to which captured telemetry is sent to be ingested. Replace the `<REALM>` with the actual realm you are using (i.e. us0, us1). 
   - `rumAuth` - token authorizing the Agent to send the telemetry to the backend. You can find (or generate) the token [here](https://app.signalfx.com/o11y/#/organization/current?selectedKeyValue=sf_section:accesstokens). 
     Notice that RUM and APM auth tokens are different.
   - `app` - naming the application that will be monitored so it can be distinguished from other applications.
1. Deploy the changes to your application and make sure that the application is being used.
1. Verify that the data is appearing in the [RUM dashboard](http://TODO-ENTER-CORRECT-URL). 

The method above is the recommendation to get started with Splunk RUM. This approach picks up the latest stable version of the Browser Agent distributed via CDN and loads the agent synchronously. 

However if the synchronous auto-updating CDN distribution is not suitable to your needs, the following sections expose alternatives in depth.

## Self-hosted script
If you choose to self-host the Splunk RUM script you need to go through the following steps:

1. Download Splunk RUM asset(s) from the [Github repository](https://github.com/signalfx/splunk-otel-js-browser/releases/latest):
   - Splunk RUM [Agent](https://github.com/signalfx/splunk-otel-js-browser/releases/download/v0.4.2/splunk-otel-web.js)
   - Splunk RUM Agent [source map](https://github.com/signalfx/splunk-otel-js-browser/releases/download/v0.4.2/splunk-otel-web.js.map) (optional)
2. Host the assets in the domain of your choice, next to other JS assets, as a separate file. If served on a separate subdomain from webapp (e.g. static.example.com), make sure the server is configured to serve CORS headers.
3. Carry out the steps 1-4, similar to the previous section describing distribution over CDN.  

## NPM

To start monitoring using Splunk RUM distributed via NPM:

1. Execute `npm install @splunk/otel-web --save` which installs the Splunk RUM NPM package and adds it to your application runtime dependencies in `package.json`
2. Create a file dedicated to initialising instrumentation named `splunk-instrumentation.js`, next to your bundle root file. Within this file include the following snippet:
    ```html
       import SplunkOtelWeb from '@splunk/otel-web';
       SplunkOtelWeb.init({
         beaconUrl: https://rum-ingest.<REALM>.signalfx.com/v1/rum,
         rumAuth: '<RUM access token>',
         app: '<application-name>',
       });
    ```
3. Modify the initialization parameters to specify:
   - `beaconUrl` - the destination URL to which captured telemetry is sent to be ingested. Replace the `<REALM>` with the actual realm you are using (i.e. us0, us1). 
   - `rumAuth` - token authorizing the Agent to send the telemetry to the backend. You can find (or generate) the token [here](https://app.signalfx.com/o11y/#/organization/current?selectedKeyValue=sf_section:accesstokens). 
     Notice that RUM and APM auth tokens are different.
   - `app` - naming the application that will be monitored so it can be distinguished from other applications.
4. Import or require the file above other application code files in your bundle root ensuring the instrumentation runs before the application code. 

You can find an example NPM installation in our [Github examples](https://github.com/signalfx/splunk-otel-js-web/tree/cc69ea1e7c16a0ae2f9f144b7be8a139a708774d/examples/installing-npm).

Bear in mind that choosing this approach will require updating to new versions of Splunk RUM Agent by you, vs choosing the CDN which automatically receives version upgrades as they are rolled out by Splunk. 

## Loading and initializing the Splunk RUM
## Versioning the agent
## Linking with APM traces
## Miscellaneous
