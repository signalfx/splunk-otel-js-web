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

Choose a versioning strategy based on your needs:

**Major Version Lock (Recommended)**

```html
<!-- Locks to v3.x.x - gets latest minor and patch updates -->
<script
	src="https://cdn.observability.splunkcloud.com/o11y-gdi-rum/v3/splunk-otel-web.js"
	crossorigin="anonymous"
></script>
```

**Minor Version Lock**

```html
<!-- Locks to v3.0.x - gets latest patch updates only -->
<script
	src="https://cdn.observability.splunkcloud.com/o11y-gdi-rum/v3.0/splunk-otel-web.js"
	crossorigin="anonymous"
></script>
```

**Exact Version Lock**

```html
<!-- Locks to exact version v3.0.0 - no automatic updates -->
<script
	src="https://cdn.observability.splunkcloud.com/o11y-gdi-rum/v3.0.0/splunk-otel-web.js"
	crossorigin="anonymous"
	integrity="sha384-<integrity>"
></script>
```

**Latest Version (Not Recommended)**

> ⚠️ **Warning:** The `latest` tag has been deprecated and now defaults to version `2.5.1`. To receive future updates while avoiding breaking changes, we recommend pinning your configuration to a specific major version (e.g., `v3` or `v2`).

> 📖 For version numbers and integrity hashes, see [GitHub Releases](https://github.com/signalfx/splunk-otel-js-web/releases).
>
> 📚 For detailed CDN setup instructions, see the [official documentation](https://quickdraw.splunk.com/redirect/?product=Observability&location=github.rum.get.started&version=current).

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
		<!-- Load Splunk RUM (using major version lock) -->
		<script
			src="https://cdn.observability.splunkcloud.com/o11y-gdi-rum/v1/splunk-otel-web.js"
			crossorigin="anonymous"
		></script>
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

| Option                                | Type                                                  | Required | Default                                        | Description                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------- | ----------------------------------------------------- | -------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `realm`                               | `string`                                              | ✅       | -                                              | Splunk realm (us0, us1, eu0, etc.)                                                                                                                                                                                                                                                                                                                                      |
| `rumAccessToken`                      | `string`                                              | ✅       | -                                              | Publicly-visible RUM access token                                                                                                                                                                                                                                                                                                                                       |
| `applicationName`                     | `string`                                              | ❌       | `'unknown-browser-app'`                        | Application name identifier                                                                                                                                                                                                                                                                                                                                             |
| `deploymentEnvironment`               | `string`                                              | ❌       | -                                              | Sets the `environment` attribute                                                                                                                                                                                                                                                                                                                                        |
| `version`                             | `string`                                              | ❌       | -                                              | Sets the `app.version` attribute                                                                                                                                                                                                                                                                                                                                        |
| `beaconEndpoint`                      | `string`                                              | ❌       | -                                              | Custom destination URL (overrides realm)                                                                                                                                                                                                                                                                                                                                |
| `debug`                               | `boolean`                                             | ❌       | `false`                                        | Enable internal debug logging                                                                                                                                                                                                                                                                                                                                           |
| `cookieDomain`                        | `string`                                              | ❌       | `window.location.hostname`                     | Domain for session cookies                                                                                                                                                                                                                                                                                                                                              |
| `ignoreUrls`                          | `Array<string\|RegExp>`                               | ❌       | `[]`                                           | URLs to exclude from tracing                                                                                                                                                                                                                                                                                                                                            |
| `spaMetrics`                          | `boolean\|Config`                                     | ❌       | `true`                                         | SPA page completion metrics. Supports global settings and ordered `urlOverrides` for page-specific `clearLoadingResourcesOnNewPage`, `quietTime`, `ignoreUrls`, `loadingElementSelectors`, `maxPageLoadWaitTime`, `maxResourcesToWatch`, and `monitors`.                                                                                                                |
| `globalAttributes`                    | `Attributes`                                          | ❌       | `{}`                                           | Attributes added to every span                                                                                                                                                                                                                                                                                                                                          |
| `persistence`                         | `'cookie'\|'localStorage'`                            | ❌       | `'cookie'`                                     | Where to store session data                                                                                                                                                                                                                                                                                                                                             |
| `disableAutomationFrameworks`         | `boolean`                                             | ❌       | `false`                                        | Block automation frameworks                                                                                                                                                                                                                                                                                                                                             |
| `disableBots`                         | `boolean`                                             | ❌       | `false`                                        | Block bots (Google bot, Bing bot, etc.)                                                                                                                                                                                                                                                                                                                                 |
| `user`                                | `{ trackingMode: 'noTracking'\|'anonymousTracking' }` | ❌       | -                                              | `user.trackingMode` controls whether the agent creates and attaches an anonymous user ID to spans. In `noTracking` mode, no anonymous user ID is generated or stored. In `anonymousTracking` mode, the agent generates a persistent anonymous user ID (stored using the configured persistence method) and attaches it to spans to enable session and user correlation. |
| `user.trackingMode`                   | `'noTracking'\|'anonymousTracking'`                   | ❌       | `v1.x: 'noTracking'; v2+: 'anonymousTracking'` | User tracking behavior                                                                                                                                                                                                                                                                                                                                                  |
| `exporter.otlp`                       | `boolean`                                             | ❌       | `true` (`false` if `beaconEndpoint` is set)    | Use OTLP format instead of Zipkin                                                                                                                                                                                                                                                                                                                                       |
| `exporter.onAttributesSerializing`    | `function`                                            | ❌       | -                                              | Transform attributes before export                                                                                                                                                                                                                                                                                                                                      |
| `privacy.maskAllText`                 | `boolean`                                             | ❌       | `true`                                         | Mask all text from text nodes                                                                                                                                                                                                                                                                                                                                           |
| `privacy.sensitivityRules`            | `Array<SensitivityRule>`                              | ❌       | `[]`                                           | Rules for text sensitivity by selector                                                                                                                                                                                                                                                                                                                                  |
| **Instrumentations**                  |                                                       |          |                                                |                                                                                                                                                                                                                                                                                                                                                                         |
| `instrumentations.connectivity`       | `boolean\|Config`                                     | ❌       | `false`                                        | Network connectivity monitoring                                                                                                                                                                                                                                                                                                                                         |
| `instrumentations.document`           | `boolean\|Config`                                     | ❌       | `true`                                         | Document load instrumentation                                                                                                                                                                                                                                                                                                                                           |
| `instrumentations.errors`             | `boolean\|Config`                                     | ❌       | `true`                                         | Error capture                                                                                                                                                                                                                                                                                                                                                           |
| `instrumentations.fetch`              | `boolean\|Config`                                     | ❌       | `true`                                         | Fetch API monitoring                                                                                                                                                                                                                                                                                                                                                    |
| `instrumentations.frustrationSignals` | `boolean\|Config`                                     | ❌       | `true`                                         | User frustration detection (rage clicks enabled by default, error clicks and thrashed cursor opt-in). See [Frustration Signals](#frustration-signals) below                                                                                                                                                                                                             |
| `instrumentations.interactions`       | `boolean\|Config`                                     | ❌       | `true`                                         | User interaction tracking                                                                                                                                                                                                                                                                                                                                               |
| `instrumentations.loaf`               | `boolean\|Config`                                     | ❌       | `false`                                        | Long Animation Frames tracking in supported Chromium browsers. When enabled and supported, this suppresses longtask spans for the page session.                                                                                                                                                                                                                         |
| `instrumentations.longtask`           | `boolean\|Config`                                     | ❌       | `true`                                         | Deprecated. Long task detection (>50ms). Prefer `instrumentations.loaf` for Long Animation Frames; keep enabled for fallback coverage where LoAF is unsupported.                                                                                                                                                                                                        |
| `instrumentations.postload`           | `boolean\|Config`                                     | ❌       | `true`                                         | Post-load resource timing                                                                                                                                                                                                                                                                                                                                               |
| `instrumentations.socketio`           | `boolean\|Config`                                     | ❌       | `false`                                        | Socket.IO client monitoring                                                                                                                                                                                                                                                                                                                                             |
| `instrumentations.visibility`         | `boolean\|Config`                                     | ❌       | `false`                                        | Page visibility changes                                                                                                                                                                                                                                                                                                                                                 |
| `instrumentations.webvitals`          | `boolean\|Config`                                     | ❌       | `true`                                         | Web Vitals collection                                                                                                                                                                                                                                                                                                                                                   |
| `instrumentations.websocket`          | `boolean\|Config`                                     | ❌       | `false`                                        | WebSocket monitoring                                                                                                                                                                                                                                                                                                                                                    |
| `instrumentations.xhr`                | `boolean\|Config`                                     | ❌       | `true`                                         | XMLHttpRequest monitoring                                                                                                                                                                                                                                                                                                                                               |

### SPA Metrics

The `spaMetrics` option controls page completion time (PCT) calculation for document loads and SPA route changes. When `spaMetrics` is `true`, the default monitor types are enabled with the default timing settings. Use `spaMetrics.monitors` globally, or inside `spaMetrics.urlOverrides`, to control which resource sources can keep PCT waiting for a specific page.

By default, `spaMetrics.clearLoadingResourcesOnNewPage` is `true`, so pending resources discovered on a previous page are ignored when PCT calculation starts for a new page. Set it to `false` to keep carrying pending resources into the next page calculation unless they are filtered by the active `monitors` or `ignoreUrls` config.

| Monitor       | Tracks                                                                                                                                        | Typical use                                                                                                                                         |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `network`     | `fetch` and `XMLHttpRequest` lifecycle events. Requests discovered before they settle keep PCT waiting until they finish or error.            | Keep enabled for pages whose useful content depends on API calls. Disable for polling, analytics, or background requests that should not delay PCT. |
| `media`       | Image, audio, and video elements observed in the DOM. Pending media loads keep PCT waiting until they load or error.                          | Keep enabled when above-the-fold media is part of page readiness. Disable for lazy media, autoplay, or decorative assets that can load later.       |
| `performance` | Resource Timing entries reported through `PerformanceObserver`, including browser-loaded resources that do not flow through fetch/XHR events. | Keep enabled to include CSS, script, and other resource timing entries. Disable when resource timing noise makes PCT too broad.                     |
| `elements`    | Visible elements matching `loadingElementSelectors`. Matching elements keep PCT waiting until they are hidden, removed, or stop matching.     | Enable for app-controlled loading indicators that mark page readiness after async rendering work.                                                   |

The `elements` monitor is opt-in. Add `'elements'` to `spaMetrics.monitors` and configure `loadingElementSelectors` to wait for visible loading indicators. Hidden elements, elements with `display: none`, and elements with `visibility: hidden` or `collapse` do not block PCT.

Array fields in URL overrides replace the inherited arrays for matched URLs. For example, `monitors: ['network']` waits only for fetch/XHR activity on that page, while `monitors: ['media', 'performance']` ignores fetch/XHR activity but still watches media and resource timing entries. If an override specifies `ignoreUrls` or `loadingElementSelectors`, include any global entries that should still apply on that page.

### Long Animation Frames

The `loaf` instrumentation reports browser Long Animation Frames as `long-animation-frame` spans. It is the preferred path for long task visibility, replacing the deprecated `longtask` instrumentation where browser support is available. It is opt-in because browser support is currently Chromium-only.

```typescript
SplunkRum.init({
	beaconEndpoint: 'https://rum-ingest.example.com/v1/rum',
	rumAccessToken: '<token>',
	instrumentations: {
		loaf: true,
	},
})
```

When `instrumentations.loaf` is enabled and the browser supports `long-animation-frame`, the default `longtask` instrumentation is suppressed for that page session to avoid double-reporting overlapping main-thread work. Keep `instrumentations.longtask` enabled to retain fallback coverage in browsers without LoAF support; longtask behavior is unchanged there unless it is explicitly disabled.

LoAF spans include frame timing attributes such as `loaf.duration`, `loaf.blocking_duration`, `loaf.paint_time`, `loaf.presentation_time`, `loaf.render_start`, `loaf.style_and_layout_start`, and `loaf.first_ui_event_timestamp`. They also include bounded script attribution: `loaf.script_count` reports the original number of scripts, while only the top three scripts by duration are exported as `loaf.script[0..2].*` attributes, including script timing fields such as `duration`, `start_time`, `execution_start`, `pause_duration`, `forced_style_and_layout_duration`, and `source_char_position`. Script source attribution is reported as provided by the browser; use `exporter.onAttributesSerializing` if your application needs to redact or transform those attributes before export.

To bound payload volume, the SDK emits up to 50 LoAF spans per source in any rolling minute. Additional
LoAF entries from the same source are dropped silently to reduce repeated noise from particular scripts while
preserving LoAFs from other sources.

### Privacy Configuration

The `privacy` configuration allows you to control how text content is collected from user interactions:

- **`maskAllText`**: When `true` (default), all text from text nodes is masked unless an unmask rule applies
- **`sensitivityRules`**: Array of rules that determine text sensitivity based on CSS selectors. Rules are applied in order, with later rules overriding earlier ones

**Rule Types:**

- `mask`: Mask text content in matching elements
- `unmask`: Unmask text content in matching elements
- `exclude`: Exclude matching elements from text collection entirely

**Example:**

```typescript
privacy: {
  maskAllText: true,
  sensitivityRules: [
    { rule: 'unmask', selector: '.public-content' },
    { rule: 'exclude', selector: '.sensitive-data' },
    { rule: 'mask', selector: '.public-content .private-info' }
  ]
}
```

### Frustration Signals

The `frustrationSignals` instrumentation detects user frustration patterns and emits `frustration` spans. Rage click detection is enabled by default. Dead click, error click, and thrashed cursor detection are disabled by default and must be explicitly enabled.

**Rage Clicks** detect rapid repeated clicks on the same element, indicating the user is frustrated because the UI is unresponsive.

| Option                       | Type                      | Default | Description                                    |
| ---------------------------- | ------------------------- | ------- | ---------------------------------------------- |
| `rageClick`                  | `false \| object \| true` | `true`  | Set to `false` to disable rage click detection |
| `rageClick.count`            | `number`                  | `4`     | Number of clicks to trigger detection          |
| `rageClick.timeframeSeconds` | `number`                  | `1`     | Time window in seconds                         |
| `rageClick.ignoreSelectors`  | `string[]`                | `[]`    | CSS selectors to exclude from detection        |

**Dead Clicks** detect when a user clicks on an interactive element (link, button, or submit input) but nothing happens — no DOM mutation and no network request occur within the configured time window. Dead click detection is disabled by default and must be explicitly enabled.

| Option                   | Type                      | Default | Description                                                       |
| ------------------------ | ------------------------- | ------- | ----------------------------------------------------------------- |
| `deadClick`              | `false \| object \| true` | `false` | Set to `true` or an options object to enable dead click detection |
| `deadClick.timeWindowMs` | `number`                  | `1000`  | Time window in milliseconds to wait for a DOM or network response |
| `deadClick.ignoreUrls`   | `Array<string\|RegExp>`   | `[]`    | URLs where detection is skipped                                   |

**Error Clicks** detect when a user clicks on an element and a JavaScript error occurs shortly after, indicating the click triggered a broken interaction. Error click detection is disabled by default and must be explicitly enabled.

| Option                    | Type                      | Default | Description                                                   |
| ------------------------- | ------------------------- | ------- | ------------------------------------------------------------- |
| `errorClick`              | `false \| object \| true` | `false` | Set to `true` or an options object to enable detection        |
| `errorClick.timeWindowMs` | `number`                  | `1000`  | Time window in milliseconds after a click to watch for errors |
| `errorClick.ignoreUrls`   | `Array<string\|RegExp>`   | `[]`    | URLs where detection is skipped                               |

**Thrashed Cursor** detects erratic back-and-forth mouse movements, indicating the user is confused or annoyed.

| Option                                       | Type                      | Default | Description                                                                    |
| -------------------------------------------- | ------------------------- | ------- | ------------------------------------------------------------------------------ |
| `thrashedCursor`                             | `false \| object \| true` | `false` | Set to `true` or an options object to enable thrashed cursor detection         |
| `thrashedCursor.timeWindowMs`                | `number`                  | `2000`  | Analysis time window in milliseconds. Also used as cooldown between detections |
| `thrashedCursor.throttleMs`                  | `number`                  | `16`    | Minimum interval between samples (min: 16ms)                                   |
| `thrashedCursor.minDirectionChanges`         | `number`                  | `4`     | Minimum direction changes to consider                                          |
| `thrashedCursor.minDirectionChangeDegrees`   | `number`                  | `45`    | Minimum angle change (degrees) to count as a direction change                  |
| `thrashedCursor.minTotalDistance`            | `number`                  | `300`   | Minimum total distance in pixels                                               |
| `thrashedCursor.minMovementDistance`         | `number`                  | `5`     | Dead zone radius in pixels; movements smaller than this are ignored            |
| `thrashedCursor.minAverageVelocity`          | `number`                  | `300`   | Minimum average velocity in px/s                                               |
| `thrashedCursor.maxVelocity`                 | `number`                  | `5000`  | Maximum velocity in px/s; samples above this are discarded as noise            |
| `thrashedCursor.maxConfinedAreaSize`         | `number`                  | `200`   | Maximum bounding box size (px) for the confined-area score component           |
| `thrashedCursor.thrashingScoreThreshold`     | `number`                  | `0.6`   | Score threshold (0–1) to trigger detection                                     |
| `thrashedCursor.scoreWeightDirectionChanges` | `number`                  | `0.4`   | Weight of direction-changes component in the thrashing score                   |
| `thrashedCursor.scoreWeightVelocity`         | `number`                  | `0.3`   | Weight of velocity component in the thrashing score                            |
| `thrashedCursor.scoreWeightConfinedArea`     | `number`                  | `0.3`   | Weight of confined-area component in the thrashing score                       |
| `thrashedCursor.ignoreUrls`                  | `Array<string\|RegExp>`   | `[]`    | URLs where detection is skipped                                                |

**Example:**

```typescript
instrumentations: {
	frustrationSignals: {
		rageClick: {
			count: 4,
			timeframeSeconds: 1,
			ignoreSelectors: ['#interactive-canvas'],
		},
		deadClick: {
			timeWindowMs: 1000,
			ignoreUrls: [/\/expected-no-response/],
		},
		errorClick: {
			timeWindowMs: 1000,
			ignoreUrls: [/\/expected-errors/],
		},
		thrashedCursor: {
			thrashingScoreThreshold: 0.7,
			ignoreUrls: [/\/game/, /\/drawing-tool/],
		},
	},
}
```

To enable dead click, error click, and thrashed cursor detection while disabling rage clicks:

```typescript
instrumentations: {
	frustrationSignals: {
		rageClick: false,     // Disable rage click detection
		deadClick: true,      // Enable dead click detection (disabled by default)
		errorClick: true,     // Enable error click detection (disabled by default)
		thrashedCursor: true, // Enable thrashed cursor detection (disabled by default)
	},
}
```

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
	spaMetrics: {
		clearLoadingResourcesOnNewPage: true,
		quietTime: 1000,
		ignoreUrls: ['/analytics/track'],
		loadingElementSelectors: ['.loading-spinner'],
		maxResourcesToWatch: 100,
		monitors: ['media', 'network', 'performance', 'elements'],
		urlOverrides: [
			{
				// Plain strings match by substring.
				match: '/cart/',
				quietTime: 1000,
				// Override arrays replace inherited arrays, so repeat global SPA metric ignores if needed.
				ignoreUrls: ['/analytics/track', '/cart/poll'],
				maxResourcesToWatch: 50,
			},
			{
				// Use RegExp, or the regex string convention, for pattern matching.
				match: /\/checkout\/.*/,
				maxPageLoadWaitTime: 5000,
				loadingElementSelectors: ['[data-checkout-loading]'],
				quietTime: 2000,
				monitors: ['network', 'elements'],
			},
		],
	},

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

	// Privacy configuration
	privacy: {
		maskAllText: true, // Mask all text from text nodes by default
		sensitivityRules: [
			// Unmask text in specific elements
			{ rule: 'unmask', selector: '.public-content' },
			{ rule: 'unmask', selector: 'h1, h2, h3' },
			// Exclude sensitive elements entirely
			{ rule: 'exclude', selector: '.sensitive-data' },
			// Override previous rules for specific cases
			{ rule: 'mask', selector: '.public-content .private-info' },
		],
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
		frustrationSignals: {
			rageClick: { count: 4 },
			deadClick: true, // Opt-in: disabled by default
			errorClick: true, // Opt-in: disabled by default
			thrashedCursor: true, // Opt-in: disabled by default
		},
		interactions: true,
		loaf: false, // Opt-in: disabled by default
		longtask: true,
		postload: true,
		webvitals: true,
		xhr: true,

		// Optional instrumentations (disabled by default)
		connectivity: false,
		socketio: false,
		visibility: false,
		websocket: false,
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
