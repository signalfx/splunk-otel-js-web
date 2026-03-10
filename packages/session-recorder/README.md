# @splunk/otel-web-session-recorder

<p align="center">
  <strong>
    <a href="#-installation--setup">🚀 Installation & Setup</a>
	&bull;
	<a href="#️-configuration-options">⚙️ Configuration</a>
    &bull;
    <a href="#️-troubleshooting">🛠️ Troubleshooting</a>
    &bull;
    <a href="#-api-reference">📚 API Reference</a>
  </strong>
</p>

<p align="center">
  <a href="https://github.com/signalfx/splunk-otel-js-web/releases">
    <img alt="Latest GitHub release version" src="https://img.shields.io/github/v/release/signalfx/splunk-otel-js-web?include_prereleases&style=for-the-badge">
  </a>
  <a href="https://www.npmjs.com/package/@splunk/otel-web-session-recorder">
    <img alt="npm package version" src="https://img.shields.io/npm/v/@splunk/otel-web-session-recorder?style=for-the-badge">
  </a>
  <a href="../../LICENSE">
    <img alt="Apache 2.0 License" src="https://img.shields.io/badge/license-Apache%202.0-blue.svg?style=for-the-badge">
  </a>
  <a href="https://bundlephobia.com/package/@splunk/otel-web-session-recorder">
    <img alt="Bundle size" src="https://img.shields.io/bundlephobia/minzip/@splunk/otel-web-session-recorder?style=for-the-badge">
  </a>
</p>

---

> For complete instructions for how to get started with the Splunk distribution of OpenTelemetry JavaScript for Web, see [Install the Browser RUM agent for Splunk RUM](https://quickdraw.splunk.com/redirect/?product=Observability&location=github.rum.get.started&version=current), [Instrument browser-based web applications for Splunk RUM](https://quickdraw.splunk.com/redirect/?product=Observability&location=github.browser.rum&version=current) and [Record browser sessions](https://help.splunk.com/en/splunk-observability-cloud/monitor-end-user-experience/real-user-monitoring/replay-user-sessions/record-browser-sessions).

**Privacy-aware visual session replay for web applications.** The Splunk Session Recorder extends [`@splunk/otel-web`](../web/) with comprehensive session recording capabilities, correlating visual user interactions with OpenTelemetry telemetry for enhanced debugging and user experience analysis.

## 🚀 Installation & Setup

### Package Manager Installation

#### 1. Install the Packages

```bash
# Install both core RUM and session recorder
npm install @splunk/otel-web @splunk/otel-web-session-recorder
# or
pnpm add @splunk/otel-web @splunk/otel-web-session-recorder
# or
yarn add @splunk/otel-web @splunk/otel-web-session-recorder
```

#### 2. Initialize RUM and Session Recorder

```typescript
import { SplunkRum } from '@splunk/otel-web'
import SplunkSessionRecorder from '@splunk/otel-web-session-recorder'

// Initialize core RUM first
SplunkRum.init({
	realm: 'us1',
	rumAccessToken: 'YOUR_RUM_ACCESS_TOKEN',
	applicationName: 'my-web-app',
	deploymentEnvironment: 'production',
})

// Then initialize session recorder
SplunkSessionRecorder.init({
	realm: 'us1',
	rumAccessToken: 'YOUR_RUM_ACCESS_TOKEN',
})
```

### CDN Installation

#### 1. Load the Scripts

Choose a versioning strategy based on your needs:

**Major Version Lock (Recommended)**

```html
<!-- Locks to v2.x.x - gets latest minor and patch updates -->
<script src="https://cdn.signalfx.com/o11y-gdi-rum/v2/splunk-otel-web.js" crossorigin="anonymous"></script>
<script
	src="https://cdn.signalfx.com/o11y-gdi-rum/v2/splunk-otel-web-session-recorder.js"
	crossorigin="anonymous"
></script>
```

**Minor Version Lock**

```html
<!-- Locks to v2.3.x - gets latest patch updates only -->
<script src="https://cdn.signalfx.com/o11y-gdi-rum/v2.3/splunk-otel-web.js" crossorigin="anonymous"></script>
<script
	src="https://cdn.signalfx.com/o11y-gdi-rum/v2.3/splunk-otel-web-session-recorder.js"
	crossorigin="anonymous"
></script>
```

**Exact Version Lock**

```html
<!-- Locks to exact version v2.3.0 - no automatic updates -->
<script
	src="https://cdn.signalfx.com/o11y-gdi-rum/v2.3.0/splunk-otel-web.js"
	crossorigin="anonymous"
	integrity="sha384-<integrity>"
></script>
<script
	src="https://cdn.signalfx.com/o11y-gdi-rum/v2.3.0/splunk-otel-web-session-recorder.js"
	crossorigin="anonymous"
	integrity="sha384-<integrity>"
></script>
```

**Latest Version (Not Recommended)**

```html
<!-- Always pulls the latest released version -->
<script src="https://cdn.signalfx.com/o11y-gdi-rum/latest/splunk-otel-web.js" crossorigin="anonymous"></script>
<script
	src="https://cdn.signalfx.com/o11y-gdi-rum/latest/splunk-otel-web-session-recorder.js"
	crossorigin="anonymous"
></script>
```

> ⚠️ **Warning:** Using `latest` automatically pulls the newest released version of the RUM agent and session recorder, which may introduce breaking changes without notice. This can cause unexpected behavior in production. Use a version lock strategy instead.

> 📖 For version numbers and integrity hashes, see [GitHub Releases](https://github.com/signalfx/splunk-otel-js-web/releases).
>
> 📚 For detailed CDN setup instructions, see the [official documentation](https://quickdraw.splunk.com/redirect/?product=Observability&location=github.rum.get.started&version=current).

#### 2. Initialize RUM and Session Recorder

```html
<script>
	// Initialize core RUM first
	SplunkRum.init({
		realm: 'us1',
		rumAccessToken: 'YOUR_RUM_ACCESS_TOKEN',
		applicationName: 'my-web-app',
		deploymentEnvironment: 'production',
	})

	// Then initialize session recorder
	SplunkSessionRecorder.init({
		realm: 'us1',
		rumAccessToken: 'YOUR_RUM_ACCESS_TOKEN',
	})
</script>
```

#### Complete CDN Example

```html
<!DOCTYPE html>
<html>
	<head>
		<title>My Web App with Session Recording</title>

		<!-- Load Splunk RUM (using major version lock) -->
		<script src="https://cdn.signalfx.com/o11y-gdi-rum/v1/splunk-otel-web.js" crossorigin="anonymous"></script>

		<!-- Load Session Recorder (using major version lock) -->
		<script
			src="https://cdn.signalfx.com/o11y-gdi-rum/v1/splunk-otel-web-session-recorder.js"
			crossorigin="anonymous"
		></script>

		<script>
			// Initialize RUM first
			SplunkRum.init({
				realm: 'us1',
				rumAccessToken: 'YOUR_RUM_ACCESS_TOKEN',
				applicationName: 'my-web-app',
				deploymentEnvironment: 'production',
			})

			// Then initialize session recorder
			SplunkSessionRecorder.init({
				realm: 'us1',
				rumAccessToken: 'YOUR_RUM_ACCESS_TOKEN',
				debug: false, // Set to true for development
			})
		</script>
	</head>
	<body>
		<!-- Your app content -->
	</body>
</html>
```

> ⚠️ **Important**: Always call `SplunkRum.init()` before `SplunkSessionRecorder.init()`.

## ⚙️ Configuration Options

| Option                       | Type                                     | Required | Default  | Description                                                |
| ---------------------------- | ---------------------------------------- | -------- | -------- | ---------------------------------------------------------- |
| `realm`                      | `string`                                 | ✅       | -        | Splunk realm (us0, us1, eu0, etc.)                         |
| `rumAccessToken`             | `string`                                 | ✅       | -        | RUM access token for authentication                        |
| `beaconEndpoint`             | `string`                                 | ❌       | -        | Custom destination URL for captured data (overrides realm) |
| `debug`                      | `boolean`                                | ❌       | `false`  | Enable debug logging                                       |
| `persistFailedReplayData`    | `boolean`                                | ❌       | `true`   | Store failed uploads in localStorage for retry             |
| `maskAllInputs`              | `boolean`                                | ❌       | `true`   | Mask all form input values                                 |
| `maskAllText`                | `boolean`                                | ❌       | `false`  | Mask all text content                                      |
| `sensitivityRules`           | `SensitivityRule[]`                      | ❌       | `[]`     | Custom rules for masking, unmasking, or excluding elements |
| `features.backgroundService` | `string \| boolean`                      | ❌       | `false`  | Custom URL for background service worker                   |
| `features.canvas`            | `boolean`                                | ❌       | `false`  | Record canvas elements                                     |
| `features.iframes`           | `boolean`                                | ❌       | `false`  | Record iframe content                                      |
| `features.video`             | `boolean`                                | ❌       | `false`  | Record video elements                                      |
| `features.cacheAssets`       | `boolean`                                | ❌       | `true`   | Cache assets for replay                                    |
| `features.packAssets`        | `boolean \| PackAssetsConfig`            | ❌       | `true`   | Pack assets to reduce payload size                         |
| `maxExportIntervalMs`        | `number`                                 | ❌       | `5000`   | Maximum interval between data exports (milliseconds)       |
| `logLevel`                   | `'debug' \| 'info' \| 'warn' \| 'error'` | ❌       | `'warn'` | Logging level for session recorder                         |

### Sensitivity Rules Configuration

```typescript
interface SensitivityRule {
	rule: 'mask' | 'unmask' | 'exclude'
	selector: string // CSS selector
}

// Example usage
SplunkSessionRecorder.init({
	realm: 'us1',
	rumAccessToken: 'YOUR_RUM_ACCESS_TOKEN',
	sensitivityRules: [
		{ rule: 'mask', selector: '.sensitive-data' },
		{ rule: 'exclude', selector: '.payment-form' },
		{ rule: 'unmask', selector: '.public-content' },
	],
})
```

### Background Service Configuration

The background service is used to offload session replay processing to a 3rd party iframe (separate thread), improving performance by preventing the session replay logic from blocking the main thread.
**It is required for image compression** - the background service handles compressing captured images to reduce payload size during session replay.

**When to customize:**

- Self-hosting the session recorder files
- Using a custom Content Security Policy (CSP)
- Deploying behind a firewall that blocks CDN access

```typescript
// Example: Self-hosted background service - ensure the domain is different from the main domain to ensure the background service is loaded in a separate thread.
SplunkSessionRecorder.init({
	realm: 'us1',
	rumAccessToken: 'YOUR_RUM_ACCESS_TOKEN',
	features: {
		backgroundService: 'https://my-other-domain.com/assets/background-service.html',
	},
})

// Example: spunk domain
// It will load an 3rd party iframe (background service) from this domain 'https://cdn.signalfx.com/o11y-gdi-rum/<version>/background-service.html'
// Ensure you have this domain whitelisted in your CSP config
SplunkSessionRecorder.init({
	realm: 'us1',
	rumAccessToken: 'YOUR_RUM_ACCESS_TOKEN',
	features: {
		backgroundService: true,
	},
})
```

> 💡 **Default behavior:** If not specified, asset processing is not offloaded and is handled on the main page thread.
>
> 📁 **File location:** When using npm installation, find `background-service.html` in `node_modules/@splunk/otel-web-session-recorder/dist/artifacts` to copy to your static assets or use `true` and load it from CDN.

### Asset Packing Configuration

```typescript
interface PackAssetsConfig {
	fonts?: boolean // Pack font assets
	styles?: boolean // Pack CSS styles
	images?:
		| boolean
		| {
				onlyViewportImages?: boolean // Only pack visible images
				pack?: boolean // Enable image packing
				quality?: number // JPEG quality (0-1). Only available when backgroundService is set, otherwise silently ignored
		  }
}

// Example usage
SplunkSessionRecorder.init({
	realm: 'us1',
	rumAccessToken: 'YOUR_RUM_ACCESS_TOKEN',
	features: {
		packAssets: {
			fonts: true,
			styles: true,
			images: {
				onlyViewportImages: true,
				pack: true,
				quality: 0.8,
			},
		},
	},
})
```

### Complete Configuration Example

```typescript
import SplunkSessionRecorder from '@splunk/otel-web-session-recorder'

SplunkSessionRecorder.init({
	// Required settings
	realm: 'us1',
	rumAccessToken: 'YOUR_RUM_ACCESS_TOKEN',

	// Optional: Custom endpoint (overrides realm)
	beaconEndpoint: 'https://custom-endpoint.com/v1/rumreplay',

	// Privacy & Security
	maskAllInputs: true,
	maskAllText: false,
	sensitivityRules: [
		{ rule: 'exclude', selector: '.payment-form' },
		{ rule: 'mask', selector: '.sensitive-data' },
		{ rule: 'unmask', selector: '.public-info' },
	],

	// Feature Control
	features: {
		backgroundService: true,,
		canvas: false, // Skip canvas recording for privacy
		iframes: false, // Skip iframe content
		video: false, // Skip video elements
		cacheAssets: true, // Cache assets for better replay
		packAssets: {
			// Optimize asset packing
			fonts: true,
			styles: true,
			images: {
				onlyViewportImages: true,
				pack: true,
				quality: 0.7,
			},
		},
	},

	// Performance
	maxExportIntervalMs: 5000, // Export data every 5 seconds
	logLevel: 'warn', // Log warnings and errors only

	// Advanced
	debug: false, // Disable debug logging
	persistFailedReplayData: true, // Store failed uploads for retry
})
```

## 🛠️ Troubleshooting

For troubleshooting issues with the Splunk Session Recorder, see [Troubleshoot browser instrumentation for Splunk Observability Cloud](https://quickdraw.splunk.com/redirect/?product=Observability&version=current&location=web.rum.troubleshooting) in the official documentation.

## 📚 API Reference

### SplunkSessionRecorder Class

#### Static Methods

| Method         | Parameters              | Returns | Description                     |
| -------------- | ----------------------- | ------- | ------------------------------- |
| `init(config)` | `SessionRecorderConfig` | `void`  | Initialize session recorder     |
| `start()`      | -                       | `void`  | Start recording current session |
| `stop()`       | -                       | `void`  | Stop recording current session  |

```typescript
interface SessionRecorderConfig {
	// Required
	realm: string
	rumAccessToken: string

	// Privacy
	maskAllInputs?: boolean
	maskAllText?: boolean
	sensitivityRules?: SensitivityRule[]

	// Feature Control
	features?: {
		backgroundService?: string | boolean
		canvas?: boolean
		iframes?: boolean
		video?: boolean
		cacheAssets?: boolean
		packAssets?: boolean | PackAssetsConfig
	}

	// Performance
	maxExportIntervalMs?: number
	logLevel?: 'debug' | 'info' | 'warn' | 'error'

	// Advanced
	debug?: boolean
	beaconEndpoint?: string
	persistFailedReplayData?: boolean
}

interface SensitivityRule {
	rule: 'mask' | 'unmask' | 'exclude'
	selector: string
}

interface UserInfo {
	id?: string
	email?: string
	attributes?: Record<string, string>
}
```

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](../../LICENSE) for the full license text.

---

> ℹ️&nbsp;&nbsp;SignalFx was acquired by Splunk in October 2019. See [Splunk SignalFx](https://www.splunk.com/en_us/investor-relations/acquisitions/signalfx.html) for more information.
