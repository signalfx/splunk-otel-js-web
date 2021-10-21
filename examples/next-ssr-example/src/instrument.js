/* globals process */
import SplunkOtelWeb from '@splunk/otel-web';

SplunkOtelWeb.init({
  beaconUrl: process.env.NEXT_PUBLIC_SPLUNK_RUM_BEACON_URL,
  rumAuth: process.env.NEXT_PUBLIC_SPLUNK_RUM_AUTH,
  app: process.env.NEXT_PUBLIC_SPLUNK_RUM_APP,
  env: process.env.NEXT_PUBLIC_SPLUNK_RUM_ENV,
});
