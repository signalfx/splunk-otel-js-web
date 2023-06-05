/* globals process */
import SplunkOtelWeb from '@splunk/otel-web';

SplunkOtelWeb.init({
  beaconEndpoint: process.env.NEXT_PUBLIC_SPLUNK_RUM_BEACON_URL,
  rumAccessToken: process.env.NEXT_PUBLIC_SPLUNK_RUM_AUTH,
  applicationName: process.env.NEXT_PUBLIC_SPLUNK_RUM_APP,
  deploymentEnvironment: process.env.NEXT_PUBLIC_SPLUNK_RUM_ENV,
});
