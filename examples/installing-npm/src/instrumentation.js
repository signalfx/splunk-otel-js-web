import SplunkOtelWeb from '@splunk/otel-web';

SplunkOtelWeb.init({
  beaconEndpoint: 'http://localhost:9101/api/v2/spans',
  debug: true,
  allowInsecureBeacon: true,
  applicationName: 'splunk-otel-web-example-npm',

  // uncomment to start sending to Splunk RUM backend
  // beaconEndpoint: 'https://rum-ingest.signalfx.com/api/v2/spans',
  
  // get the token by going to https://app.signalfx.com/#/organization/current?selectedKeyValue=sf_section:accesstokens
  rumAccessToken: 'ABC123...789',
});
