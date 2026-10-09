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
NEXT_PUBLIC_SPLUNK_RUM_APPLICATION_VERSION=
SPLUNK_ACCESS_TOKEN=
```

For source map uploads, also provide `SPLUNK_ACCESS_TOKEN` as an organization access token with API token scope and the `power` role. This is a CLI credential; do not prefix it with `NEXT_PUBLIC_` or expose it to the browser.

## Using the Splunk CDN (Recommended)

Instrumenting a Next.js application with the Splunk CDN is straightforward.
Simply add the Splunk CDN scripts to your application by adjusting the [`layout.tsx` file](./app/layout.tsx):

```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<Script
					src={`https://cdn.observability.splunkcloud.com/o11y-gdi-rum/${process.env.NEXT_PUBLIC_SPLUNK_CDN_VERSION}/splunk-otel-web.js`}
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
							version: "${process.env.NEXT_PUBLIC_SPLUNK_RUM_APPLICATION_VERSION}",
							deploymentEnvironment: "${process.env.NEXT_PUBLIC_SPLUNK_RUM_DEPLOYMENT_ENVIRONMENT}",
						  });
						`,
					}}
				/>
				<Script
					src={`https://cdn.observability.splunkcloud.com/o11y-gdi-rum/${process.env.NEXT_PUBLIC_SPLUNK_CDN_VERSION}/splunk-otel-web-session-recorder.js`}
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
	applicationName: process.env.NEXT_PUBLIC_SPLUNK_RUM_APPLICATION_NAME,
	beaconEndpoint: process.env.NEXT_PUBLIC_SPLUNK_RUM_BEACON_ENDPOINT,
	deploymentEnvironment: process.env.NEXT_PUBLIC_SPLUNK_RUM_DEPLOYMENT_ENVIRONMENT,
	realm: process.env.NEXT_PUBLIC_SPLUNK_REALM,
	rumAccessToken: process.env.NEXT_PUBLIC_SPLUNK_RUM_ACCESS_TOKEN,
	version: process.env.NEXT_PUBLIC_SPLUNK_RUM_APPLICATION_VERSION,
})

SplunkSessionRecorder.init({
	beaconEndpoint: process.env.NEXT_PUBLIC_SPLUNK_RUM_SESSION_REPLAY_BEACON_ENDPOINT,
	realm: process.env.NEXT_PUBLIC_SPLUNK_REALM,
	rumAccessToken: process.env.NEXT_PUBLIC_SPLUNK_RUM_ACCESS_TOKEN,
})
```

## Backend Instrumentation

To instrument the backend of your Next.js application, refer to the [Next.js instrumentation docs](https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation) and the [`@splunk/otel` repository](https://github.com/signalfx/splunk-otel-js#readme).

## Production source maps with `splunk-rum-cli`

This example enables Next.js production browser source maps in [`next.config.ts`](./next.config.ts) and installs `@splunk/rum-cli` version `1.0.1` as a development dependency. Its injection script runs after `next build`, adding a `sourceMapId` to each matching browser JavaScript bundle in `.next/static`. The matching `.map` files are produced by Next.js alongside those bundles.

The CLI injects a `sourceMapId` only when it can associate a JavaScript file with a source map. Next.js can also emit JavaScript files that have no source map, such as compatibility polyfills or build manifests. The CLI reports and skips those files; seeing fewer injected bundles than JavaScript files is expected.

The dry-run upload command reads `.env`, checks that the local example app has been configured, then runs `splunk-rum sourcemaps upload` directly. It uses the same `NEXT_PUBLIC_SPLUNK_REALM`, `NEXT_PUBLIC_SPLUNK_RUM_APPLICATION_NAME`, and `NEXT_PUBLIC_SPLUNK_RUM_APPLICATION_VERSION` values as the RUM initialization, so the uploaded maps match the instrumented app. If values are missing, the helper tells you which `.env` entries to fill in. Set these values in `.env`:

```env
NEXT_PUBLIC_SPLUNK_REALM=your-realm
NEXT_PUBLIC_SPLUNK_RUM_APPLICATION_NAME=your-application-name
NEXT_PUBLIC_SPLUNK_RUM_APPLICATION_VERSION=your-application-version
SPLUNK_ACCESS_TOKEN=your-organization-access-token
```

From this example's directory, build the production assets and inject their source map IDs:

```sh
pnpm build
```

For CLI debug output during injection, run `pnpm build:debug`. To preview an upload with CLI debug output, run `pnpm run sourcemaps:upload:dry-run:debug`.

Review the source maps that would be uploaded without sending them:

```sh
pnpm run sourcemaps:upload:dry-run
```

The upload command passes the configured realm, application name, and version with the CLI options and reads `SPLUNK_ACCESS_TOKEN` from the environment. For a real upload, run the same `splunk-rum sourcemaps upload` command without `--dry-run`. Upload the maps before deploying the corresponding injected production bundles.
