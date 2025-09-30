# @splunk/otel-web

<p align="center">
  <strong>
    <a href="#-installation--setup">🚀 Installation & Setup</a>
    &nbsp;&nbsp;&bull;&nbsp;&nbsp;
    <a href="#️-configuration-options">⚙️ Configuration</a>
    &nbsp;&nbsp;&bull;&nbsp;&nbsp;
    <a href="#️-troubleshooting">🛠️ Troubleshooting</a>
    &nbsp;&nbsp;&bull;&nbsp;&nbsp;
    <a href="#-api-reference">📚 API Reference</a>
  </strong>
</p>

<p align="center">
  <a href="https://github.com/signalfx/splunk-otel-js-web/releases">
    <img alt="Latest GitHub release version" src="https://img.shields.io/github/v/release/signalfx/splunk-otel-js-web?include_prereleases&style=for-the-badge">
  </a>
  <a href="https://www.npmjs.com/package/@splunk/otel-web">
    <img alt="npm package version" src="https://img.shields.io/npm/v/@splunk/otel-web?style=for-the-badge">
  </a>
  <a href="../../LICENSE">
    <img alt="Apache 2.0 License" src="https://img.shields.io/badge/license-Apache%202.0-blue.svg?style=for-the-badge">
  </a>
  <a href="https://bundlephobia.com/package/@splunk/otel-web">
    <img alt="Bundle size" src="https://img.shields.io/bundlephobia/minzip/@splunk/otel-web?style=for-the-badge">
  </a>
</p>

---

> For complete instructions for how to get started with the Splunk distribution of OpenTelemetry JavaScript for Web, see [Install the Browser RUM agent for Splunk RUM](https://quickdraw.splunk.com/redirect/?product=Observability&location=github.rum.get.started&version=current) and
> [Instrument browser-based web applications for Splunk RUM](https://quickdraw.splunk.com/redirect/?product=Observability&location=github.browser.rum&version=current).

Splunk RUM for Browser collects performance metrics, web vitals, errors, and other forms of data for every user session to enable you to detect and troubleshoot problems in your application. For a complete view of your application from browser to back-end, integrate with Splunk APM.

## 🚀 Installation & Setup

### Package Manager Installation

#### 1. Install the Package

```bash
npm install @splunk/otel-web
# or
pnpm add @splunk/otel-web
# or
yarn add @splunk/otel-web
```

#### 2. Initialize RUM

```typescript
import { SplunkRum } from '@splunk/otel-web'

SplunkRum.init({
	realm: 'us1', // Your Splunk realm
	rumAccessToken: 'YOUR_RUM_ACCESS_TOKEN', // RUM access token
	applicationName: 'my-web-app', // Application identifier
	deploymentEnvironment: 'production', // Environment (dev, staging, prod)
})
```

### CDN Installation

#### 1. Load the Script

```html
<script
	src="https://cdn.signalfx.com/o11y-gdi-rum/<version>/splunk-otel-web.js"
	crossorigin="anonymous"
	integrity="sha384-<integrity>"
></script>
```

> Replace `<version>` and `<integrity>` with the values from [GitHub Releases](https://github.com/signalfx/splunk-otel-js-web/releases).

#### 2. Initialize RUM

```html
<script>
	SplunkRum.init({
		realm: 'us1', // Your Splunk realm
		rumAccessToken: 'YOUR_RUM_ACCESS_TOKEN', // RUM access token
		applicationName: 'my-web-app', // Application identifier
		deploymentEnvironment: 'production', // Environment (dev, staging, prod)
	})
</script>
```

#### Complete CDN Example

```html
<!DOCTYPE html>
<html>
	<head>
		<title>My Web App</title>
		<!-- Load Splunk RUM -->
		<script src="https://cdn.signalfx.com/o11y-gdi-rum/latest/splunk-otel-web.js"></script>
		<script>
			SplunkRum.init({
				realm: 'us1',
				rumAccessToken: 'YOUR_RUM_ACCESS_TOKEN',
				applicationName: 'my-web-app',
				deploymentEnvironment: 'production',
				debug: false, // Set to true for development
			})
		</script>
	</head>
	<body>
		<!-- Your app content -->
	</body>
</html>
```

## ⚙️ Configuration Options

| Option                             | Type                                | Required | Default                    | Description                              |
| ---------------------------------- | ----------------------------------- | -------- | -------------------------- | ---------------------------------------- |
| `realm`                            | `string`                            | ✅       | -                          | Splunk realm (us0, us1, eu0, etc.)       |
| `rumAccessToken`                   | `string`                            | ✅       | -                          | Publicly-visible RUM access token        |
| `applicationName`                  | `string`                            | ❌       | `'unknown-browser-app'`    | Application name identifier              |
| `deploymentEnvironment`            | `string`                            | ❌       | -                          | Sets the `environment` attribute         |
| `version`                          | `string`                            | ❌       | -                          | Sets the `app.version` attribute         |
| `beaconEndpoint`                   | `string`                            | ❌       | -                          | Custom destination URL (overrides realm) |
| `debug`                            | `boolean`                           | ❌       | `false`                    | Enable internal debug logging            |
| `cookieDomain`                     | `string`                            | ❌       | `window.location.hostname` | Domain for session cookies               |
| `ignoreUrls`                       | `Array<string\|RegExp>`             | ❌       | `[]`                       | URLs to exclude from tracing             |
| `globalAttributes`                 | `Attributes`                        | ❌       | `{}`                       | Attributes added to every span           |
| `persistence`                      | `'cookie'\|'localStorage'`          | ❌       | `'cookie'`                 | Where to store session data              |
| `disableAutomationFrameworks`      | `boolean`                           | ❌       | `false`                    | Block automation frameworks              |
| `disableBots`                      | `boolean`                           | ❌       | `false`                    | Block bots (Google bot, Bing bot, etc.)  |
| `user.trackingMode`                | `'noTracking'\|'anonymousTracking'` | ❌       | `'noTracking'`             | User tracking behavior                   |
| `exporter.otlp`                    | `boolean`                           | ❌       | `false`                    | Use OTLP format instead of Zipkin        |
| `exporter.onAttributesSerializing` | `function`                          | ❌       | -                          | Transform attributes before export       |
| **Instrumentations**               |                                     |          |                            |                                          |
| `instrumentations.connectivity`    | `boolean\|Config`                   | ❌       | `false`                    | Network connectivity monitoring          |
| `instrumentations.document`        | `boolean\|Config`                   | ❌       | `true`                     | Document load instrumentation            |
| `instrumentations.errors`          | `boolean\|Config`                   | ❌       | `true`                     | Error capture                            |
| `instrumentations.fetch`           | `boolean\|Config`                   | ❌       | `true`                     | Fetch API monitoring                     |
| `instrumentations.interactions`    | `boolean\|Config`                   | ❌       | `true`                     | User interaction tracking                |
| `instrumentations.longtask`        | `boolean\|Config`                   | ❌       | `true`                     | Long task detection (>50ms)              |
| `instrumentations.postload`        | `boolean\|Config`                   | ❌       | `true`                     | Post-load resource timing                |
| `instrumentations.socketio`        | `boolean\|Config`                   | ❌       | `false`                    | Socket.IO client monitoring              |
| `instrumentations.visibility`      | `boolean\|Config`                   | ❌       | `false`                    | Page visibility changes                  |
| `instrumentations.webvitals`       | `boolean\|Config`                   | ❌       | `true`                     | Web Vitals collection                    |
| `instrumentations.websocket`       | `boolean\|Config`                   | ❌       | `false`                    | WebSocket monitoring                     |
| `instrumentations.xhr`             | `boolean\|Config`                   | ❌       | `true`                     | XMLHttpRequest monitoring                |
| **Advanced Options**               |                                     |          |                            |                                          |
| `context.async`                    | `boolean`                           | ❌       | `true`                     | Enable async tracking of span parents    |
| `context.onBeforeContextStart`     | `function`                          | ❌       | -                          | Callback before context starts           |
| `context.onBeforeContextEnd`       | `function`                          | ❌       | -                          | Callback before context ends             |
| `spanProcessors`                   | `SpanProcessor[]`                   | ❌       | `[]`                       | Additional span processors               |
| `tracer`                           | `WebTracerConfig`                   | ❌       | `{}`                       | Configuration passed to web tracer       |

### Complete Configuration Example

```typescript
import { SplunkRum } from '@splunk/otel-web'

SplunkRum.init({
	// Required settings
	realm: 'us1',
	rumAccessToken: 'YOUR_RUM_ACCESS_TOKEN',

	// Application identification
	applicationName: 'my-web-app',
	deploymentEnvironment: 'production',
	version: '1.2.3',

	cookieDomain: window.location.hostname,
	persistence: 'cookie',
	ignoreUrls: [/\/health-check/, '/analytics/track', 'https://third-party-ads.com'],

	// Global attributes for all spans
	globalAttributes: {
		'team': 'frontend',
		'feature.flag.checkout': 'enabled',
	},

	// Bot detection
	disableAutomationFrameworks: true,
	disableBots: true,

	// User tracking
	user: {
		trackingMode: 'anonymousTracking',
	},

	// Export options
	exporter: {
		otlp: true, // Use OTLP instead of Zipkin
		onAttributesSerializing: (attributes, span) => {
			// Remove or hash sensitive data
			if (attributes['http.url']) {
				attributes['http.url'] = sanitizeUrl(attributes['http.url'])
			}
			return attributes
		},
	},

	// Instrumentation control
	instrumentations: {
		// Core instrumentations (enabled by default)
		document: true,
		errors: true,
		fetch: true,
		interactions: true,
		longtask: true,
		postload: true,
		webvitals: true,
		xhr: true,

		// Optional instrumentations (disabled by default)
		connectivity: false,
		socketio: false,
		visibility: false,
		websocket: false,

		// Advanced configurations
		fetch: {
			propagateTraceHeaderCorsUrls: [/^https:\/\/api\.example\.com/],
		},
		interactions: {
			eventNames: ['click', 'submit', 'keydown'],
		},
	},

	// Advanced options
	context: {
		async: true,
		onBeforeContextStart: () => console.log('Context starting'),
		onBeforeContextEnd: () => console.log('Context ending'),
	},

	// Development
	debug: process.env.NODE_ENV !== 'production',
})
```

## 📚 API Reference

### SplunkRum Class

#### Static Methods

| Method                       | Parameters        | Returns  | Description                |
| ---------------------------- | ----------------- | -------- | -------------------------- |
| `init(config)`               | `SplunkRumConfig` | `void`   | Initialize the RUM SDK     |
| `setGlobalAttributes(attrs)` | `Attributes`      | `void`   | Add global span attributes |
| `getSessionId()`             | -                 | `string` | Get current session ID     |

#### Properties

| Property   | Type             | Description                   |
| ---------- | ---------------- | ----------------------------- |
| `provider` | `TracerProvider` | OpenTelemetry tracer provider |

## 🛠️ Troubleshooting

For troubleshooting issues with the Splunk Distribution of OpenTelemetry JS for Web, see [Troubleshoot browser instrumentation for Splunk Observability Cloud](https://quickdraw.splunk.com/redirect/?product=Observability&version=current&location=web.rum.troubleshooting) in the official documentation.

## 📜 License

Licensed under the Apache License, Version 2.0. See [LICENSE](../../LICENSE) for the full license text.

---

> ℹ️&nbsp;&nbsp;SignalFx was acquired by Splunk in October 2019. See [Splunk SignalFx](https://www.splunk.com/en_us/investor-relations/acquisitions/signalfx.html) for more information.
