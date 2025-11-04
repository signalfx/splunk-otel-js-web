# Next.js Client Instrumentation

This example demonstrates how to instrument a Next.js application with Splunk OpenTelemetry.
It focuses on client-side instrumentation of the application.
The example contains a simple application bootstrapped using the [`npx create-next-app@latest` command](https://nextjs.org/docs/app/getting-started/installation).

There are two ways to instrument a Next.js application:

- [Using the Splunk CDN (**recommended**)](#using-the-splunk-cdn-recommended)
- [Using the NPM package](#using-the-npm-package)

## Prerequisites

Set up environment variables by creating a `.env` file in the root directory. See [.env.example](./.env.example) for reference:

```env
NEXT_PUBLIC_SPLUNK_RUM_ACCESS_TOKEN=
NEXT_PUBLIC_SPLUNK_RUM_APPLICATION_NAME=
NEXT_PUBLIC_SPLUNK_RUM_DEPLOYMENT_ENVIRONMENT=
NEXT_PUBLIC_SPLUNK_RUM_BEACON_ENDPOINT=
NEXT_PUBLIC_SPLUNK_RUM_SESSION_REPLAY_BEACON_ENDPOINT=
NEXT_PUBLIC_SPLUNK_REALM=
NEXT_PUBLIC_SPLUNK_CDN_VERSION=
```

## Using the Splunk CDN (Recommended)

Instrumenting a Next.js application with the Splunk CDN is straightforward.
Simply add the Splunk CDN scripts to your application by adjusting the [`layout.tsx` file](./app/layout.tsx):

```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<Script
					src={`https://cdn.signalfx.com/o11y-gdi-rum/${process.env.NEXT_PUBLIC_SPLUNK_CDN_VERSION}/splunk-otel-web.js`}
					strategy="beforeInteractive"
					crossOrigin="anonymous"
				/>
				<Script
					id="splunk-rum-init"
					strategy="beforeInteractive"
					dangerouslySetInnerHTML={{
						__html: `
						  SplunkRum.init({
							realm: "${process.env.NEXT_PUBLIC_SPLUNK_REALM}",
							rumAccessToken: "${process.env.NEXT_PUBLIC_SPLUNK_RUM_ACCESS_TOKEN}",
							applicationName: "${process.env.NEXT_PUBLIC_SPLUNK_RUM_APPLICATION_NAME}",
							deploymentEnvironment: "${process.env.NEXT_PUBLIC_SPLUNK_RUM_DEPLOYMENT_ENVIRONMENT}",
						  });
						`,
					}}
				/>
				<Script
					src={`https://cdn.signalfx.com/o11y-gdi-rum/${process.env.NEXT_PUBLIC_SPLUNK_CDN_VERSION}/splunk-otel-web-session-recorder.js`}
					strategy="beforeInteractive"
					crossOrigin="anonymous"
				/>
				<Script
					id="splunk-session-recorder-init"
					strategy="beforeInteractive"
					dangerouslySetInnerHTML={{
						__html: `
							SplunkSessionRecorder.init({
								realm: "${process.env.NEXT_PUBLIC_SPLUNK_REALM}",
								rumAccessToken: "${process.env.NEXT_PUBLIC_SPLUNK_RUM_ACCESS_TOKEN}"
							});
						`,
					}}
				/>
			</head>
			<body>{children}</body>
		</html>
	)
}
```

## Using the NPM Package

To instrument a Next.js application with the Splunk NPM package, create a file called [`instrumentation-client.ts` in the root of your Next.js application](./instrumentation-client.ts).
See the Next.js [docs for client-side instrumentation](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation-client) for more information.

```ts
import SplunkOtelWeb from '@splunk/otel-web'
import SplunkSessionRecorder from '@splunk/otel-web-session-recorder'

SplunkOtelWeb.init({
	beaconEndpoint: process.env.NEXT_PUBLIC_SPLUNK_RUM_BEACON_ENDPOINT,
	rumAccessToken: process.env.NEXT_PUBLIC_SPLUNK_RUM_ACCESS_TOKEN,
	applicationName: process.env.NEXT_PUBLIC_SPLUNK_RUM_APPLICATION_NAME,
	deploymentEnvironment: process.env.NEXT_PUBLIC_SPLUNK_RUM_DEPLOYMENT_ENVIRONMENT,
})

SplunkSessionRecorder.init({
	rumAccessToken: process.env.NEXT_PUBLIC_SPLUNK_RUM_ACCESS_TOKEN,
	beaconEndpoint: process.env.NEXT_PUBLIC_SPLUNK_RUM_SESSION_REPLAY_BEACON_ENDPOINT,
})
```

## Backend Instrumentation

To instrument the backend of your Next.js application, refer to the [Next.js instrumentation docs](https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation) and the [`@splunk/otel` repository](https://github.com/signalfx/splunk-otel-js#readme).
