# Next.js client instrumentation

This package provides an example of how to instrument a Next.js application with Splunk. 
It focuses on the client-side instrumentation of the application.
The package contains simple application bootstrapped using [`npx create-next-app@latest` command](https://nextjs.org/docs/app/getting-started/installation).

There are two ways to instrument a Next.js application:
- [Using the Splunk CDN (**recommended**)](#using-the-splunk-cdn-recommended)
- [Using the NPM package](#using-the-npm-package)


### Prerequisites
Set up an [environment variables](./.env.example). Create `.env` file in the root with the following content:

```env
NEXT_PUBLIC_SPLUNK_RUM_ACCESS_TOKEN=
NEXT_PUBLIC_SPLUNK_RUM_APPLICATION_NAME=
NEXT_PUBLIC_SPLUNK_RUM_DEPLOYMENT_ENVIROMENT=
NEXT_PUBLIC_SPLUNK_RUM_BEACON_ENDPOINT=
NEXT_PUBLIC_SPLUNK_RUM_SESSION_REPLAY_BEACON_ENDPOINT=
NEXT_PUBLIC_SPLUNK_REALM=
NEXT_PUBLIC_SPLUNK_CDN_VERSION=
```

## Using the Splunk CDN (Recommended)
The process of instrumenting a Next.js application with the Splunk CDN is straightforward. 
You just need to add the Splunk CDN script to your application. 
You can do that by adjusting the [`_layout.tsx` file in your Next.js application](./app/layout.tsx). See the example below:

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
							applicationName: "${process.env.NEXT_PUBLIC_SPLUNK_RUM_DEPLOYMENT_ENVIROMENT}",
							deploymentEnvironment: "${process.env.NEXT_PUBLIC_SPLUNK_RUM_DEPLOYMENT_ENVIROMENT}",
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
					id="splunk-rum-init"
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

## Using the NPM package

To instrument a Next.js application with the Splunk NPM package,
you need to adjust the next.config.js file in your Next.js application. 
You need to insert the Splunk instrumentation script to all client side code.

Override the webpack configuration in your [`next.config.js` file with the following content](./next.config.ts):

```js
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
	webpack: (config, options) => {
		if (options.dev) {
			// Do not instrument code in development
			return config
		}

		if (options.isServer) {
			// Do not instrument server code
			return config
		}

		const previousEntryFunction = config.entry

		config.entry = async () => {
			const newEntries = await previousEntryFunction()
			for (const [key, value] of Object.entries(newEntries)) {
				if (!['main-app', 'pages/_app'].includes(key)) {
					continue
				}

				if (!Array.isArray(value)) {
					continue
				}

				newEntries[key] = ['./instrumentation.client.ts', ...value]
			}

			return newEntries
		}

		return config
	},
}

export default nextConfig
```

Then, create a [file called `instrumentation.client.ts` in the root of your Next.js application](./instrumentation.client.ts) with the following content:

```ts
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
```

### Backend Instrumentation

To instrument the backend of your Next.js application please refer to [Next.js instrumentation docs](https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation) and [`@splunk/otel` repository](https://github.com/signalfx/splunk-otel-js#readme).
