import SplunkOtelWeb from '@splunk/otel-web'
import SplunkSessionRecorder from '@splunk/otel-web-session-recorder'

SplunkOtelWeb.init({
	beaconEndpoint: process.env.NEXT_PUBLIC_SPLUNK_RUM_BEACON_ENDPOINT,
	rumAccessToken: process.env.NEXT_PUBLIC_SPLUNK_RUM_ACCESS_TOKEN,
	applicationName: process.env.NEXT_PUBLIC_SPLUNK_RUM_APPLICATION_NAME,
	deploymentEnvironment: process.env.NEXT_PUBLIC_SPLUNK_RUM_DEPLOYMENT_ENVIROMENT,
})

SplunkSessionRecorder.init({
	rumAccessToken: process.env.NEXT_PUBLIC_SPLUNK_RUM_ACCESS_TOKEN,
	beaconEndpoint: process.env.NEXT_PUBLIC_SPLUNK_RUM_SESSION_REPLAY_BEACON_ENDPOINT,
})
