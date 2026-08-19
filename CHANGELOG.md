# Changelog

If the version of Open Telemetry is unspecified for a version, then it is the same as in the previous release.

## 3.1.0

### Upgrade impact

No mandatory code or configuration changes are required for customers upgrading from 3.0.x. Before upgrading, review
the changes in default behavior below.

### Changes in Default Configuration

- `@splunk/otel-web`
    - **All frustration signals are enabled by default** [#1806](https://github.com/signalfx/splunk-otel-js-web/pull/1806)
        - **Changed from 3.0:** Previously, only rage-click detection was enabled without configuration. Rage click, error click, dead click, and thrashed-cursor detection are now all enabled.
        - **Why:** Applications receive all four types of frustration telemetry without having to enable each detector separately.
        - **Customer action:** No action is required to collect all signals. To retain the 3.0 behavior, set `deadClick`, `errorClick`, and `thrashedCursor` to `false` under `instrumentations.frustrationSignals`. Set `instrumentations.frustrationSignals: false` to disable all frustration detection.
    - **The PCT quiet period changed from five seconds to one second** [#1812](https://github.com/signalfx/splunk-otel-js-web/pull/1812)
        - **Changed from 3.0:** Page Completion Time (PCT) now completes after 1000 ms, instead of 5000 ms, without monitored network, media, resource-timing, or configured loading-element activity.
        - **Why:** The shorter quiet period reduces the chance that unrelated background activity keeps resetting the timer and extending page completion.
        - **Customer action:** No action is required for most applications. If meaningful page-loading work can start after a gap longer than one second, set `spaMetrics.quietTime: 5000` to retain the 3.0 behavior or choose another value appropriate for the application.

To retain the relevant 3.0 defaults:

```js
SplunkRum.init({
	instrumentations: {
		frustrationSignals: {
			deadClick: false,
			errorClick: false,
			thrashedCursor: false,
		},
	},
	spaMetrics: {
		quietTime: 5000,
	},
	// Existing application, realm/token, and other options...
})
```

- `@splunk/otel-web-session-recorder`
    - **Failed replay uploads use IndexedDB and OTLP/protobuf by default** [#1792](https://github.com/signalfx/splunk-otel-js-web/pull/1792), [#1857](https://github.com/signalfx/splunk-otel-js-web/pull/1857), [#1890](https://github.com/signalfx/splunk-otel-js-web/pull/1890)
        - **Changed from 3.0:** `persistFailedReplayData: true` queues failed uploads in IndexedDB with a 100 MB limit and retries them on later page loads. Previously, persistence used a 2 MB localStorage limit and JSON encoding. Replay exports now use OTLP/protobuf.
        - **Why:** IndexedDB can retain more failed uploads during temporary network or server outages, while protobuf reduces replay payload size.
        - **Customer action:** No action is required to use the new default. Set `persistFailedReplayData: 'localstorage'` to retain the previous 2 MB localStorage/JSON behavior, or `false` when browser-storage policy prohibits failed-upload persistence.
    - **Packed replay asset content is hashed by default** [#1869](https://github.com/signalfx/splunk-otel-js-web/pull/1869)
        - **Changed from 3.0:** `hashAssetContent` is now enabled and replaces repeated embedded stylesheet content with hash references.
        - **Why:** Identical content can be cached instead of sent repeatedly, reducing replay payload size.
        - **Customer action:** None.

### Automatically enabled improvements

- `@splunk/otel-web`
    - **Navigation operation attribution** [#1883](https://github.com/signalfx/splunk-otel-js-web/pull/1883)
        - The agent adds `browser.navigation.operation` to show which type of navigation a span belongs to or occurred during. The value is `documentLoad` for the initial page load and `routeChange` for an SPA navigation.
    - **Synthetics test correlation** [#1803](https://github.com/signalfx/splunk-otel-js-web/pull/1803)
        - The agent previously attached only the Synthetics run ID. It now also adds `Synthetics-TestId` when the Splunk Synthetics runtime exposes it, allowing spans from separate runs to be grouped under the test that produced them.

### Optional features

- **Application-specific interaction metadata** [#1844](https://github.com/signalfx/splunk-otel-js-web/pull/1844), [#1890](https://github.com/signalfx/splunk-otel-js-web/pull/1890)
    - **Default:** The agent does not copy application `data-*` attributes into spans.
    - **Captured identifiers:** `dataAttributesToCapture` is an allowlist of `data-*` attributes to copy from clicked elements into click and rage-click spans as `element.dataset.*` attributes. Use it for stable identifiers such as `data-component-id` when the default element path and text are not enough to identify the control.
    - **Privacy:** Avoid sensitive or high-cardinality data-attribute values.

```js
SplunkRum.init({
	dataAttributesToCapture: ['data-component-id'],
	// Existing application, realm/token, and other options...
})
```

#### Regular expressions in URL-matching configuration

([#1802](https://github.com/signalfx/splunk-otel-js-web/pull/1802), [#1890](https://github.com/signalfx/splunk-otel-js-web/pull/1890))

URL-matching settings accept native JavaScript `RegExp` values or strings using the
`regex/<pattern>/<flags>` syntax. This includes:

- Top-level `ignoreUrls`
- Instrumentation-specific `ignoreUrls`
- `spaMetrics.ignoreUrls`
- `spaMetrics.urlOverrides[].ignoreUrls`
- `spaMetrics.urlOverrides[].match`

The string form is useful when providing configuration in JSON, which does not support native `RegExp` values.

JavaScript configuration:

```typescript
SplunkRum.init({
	ignoreUrls: [/^https:\/\/analytics\./i],
	spaMetrics: {
		urlOverrides: [
			{
				match: /\/checkout\//,
				ignoreUrls: ['regex/^https:\\/\\/metrics\\./i'],
			},
		],
	},
})
```

Equivalent serialized JSON configuration:

```json
{
	"ignoreUrls": ["regex/^https:\\/\\/analytics\\./i"],
	"spaMetrics": {
		"urlOverrides": [
			{
				"match": "regex/\\/checkout\\//",
				"ignoreUrls": ["regex/^https:\\/\\/metrics\\./i"]
			}
		]
	}
}
```

### Fixes

- **More reliable PCT resource and interruption tracking for SPA route changes** [#1807](https://github.com/signalfx/splunk-otel-js-web/pull/1807), [#1816](https://github.com/signalfx/splunk-otel-js-web/pull/1816), [#1818](https://github.com/signalfx/splunk-otel-js-web/pull/1818), [#1847](https://github.com/signalfx/splunk-otel-js-web/pull/1847), [#1848](https://github.com/signalfx/splunk-otel-js-web/pull/1848), [#1849](https://github.com/signalfx/splunk-otel-js-web/pull/1849)
    - Each resource request is now tracked independently. Previously, concurrent requests to the same URL shared a tracking key, so completion of one request could incorrectly mark another in-flight request as finished and produce an inaccurate PCT.
    - Media that fails, is aborted, is removed from the DOM, or changes its source now releases its pending PCT activity instead of potentially leaving the page waiting indefinitely.
    - Pending resources discovered during the previous page are cleared when a new navigation starts by default, so unrelated earlier work does not extend the new page's PCT.
    - When another navigation starts or the browser emits `pagehide`, the current calculation finishes at the interruption time instead of leaving its route-change span unfinished. Route-change span duration continues to use PCT when `spaMetrics` is enabled, which remains the default.
- **Correct post-load resource association for relative URLs** [#1872](https://github.com/signalfx/splunk-otel-js-web/pull/1872)
    - When an image or script uses a relative URL such as `assets/app.js`, the agent now resolves it against `document.baseURI`. This produces the same absolute URL reported by the browser's Resource Timing entry, including the current document path or a `<base>` element. Matching the two records allows the resource span to inherit the trace context that was active when the element was added instead of being reported as an unrelated root span.
- **Oversized W3C baggage is safely bounded** [#1864](https://github.com/signalfx/splunk-otel-js-web/pull/1864). Baggage extraction and injection are now limited to 180 entries, 4096 characters per entry, and 8192 characters in total. Entries exceeding these limits are ignored, preventing an oversized baggage header from causing unbounded resource allocation and remediating [CVE-2026-54285](https://nvd.nist.gov/vuln/detail/CVE-2026-54285). No customer configuration or unsafe OpenTelemetry 2.x override is required.
- **Route-change URLs remain associated with the navigation that captured them** [#1845](https://github.com/signalfx/splunk-otel-js-web/pull/1845). When several hash changes occur before their callbacks execute, each route-change span now uses the URL captured for its own navigation instead of a later value from `location.href`.
- **Full build identity is available for locked and commit-based CDN builds** [#1865](https://github.com/signalfx/splunk-otel-js-web/pull/1865), [#1868](https://github.com/signalfx/splunk-otel-js-web/pull/1868). `splunk.rumVersionFull` now includes the Git-derived build identity, allowing a span to identify the exact CDN artifact under test instead of reporting only the package version.

### Experimental features

- **Web Vitals attribution, FCP, and TTFB** [#1796](https://github.com/signalfx/splunk-otel-js-web/pull/1796)
    - **Default:** CLS, INP, and LCP continue to be collected without detailed attribution. Attribution, First Contentful Paint (FCP), and Time to First Byte (TTFB) are disabled until explicitly enabled.
    - **Attribution:** `_experimental_attribution` adds diagnostic details to existing Web Vitals spans: the element and layout shift for CLS, interaction processing and presentation phases for INP, and the element, resource, and load phases for LCP. Enable it when a metric value alone does not explain the cause of poor performance.
    - **Additional metrics:** `_experimental_fcp` emits FCP spans, and `_experimental_ttfb` emits TTFB spans. When attribution is also enabled, FCP includes the time from first byte to first contentful paint, while TTFB includes cache, DNS, connection, request, and server-wait timing breakdowns.

```js
SplunkRum.init({
	instrumentations: {
		webvitals: {
			_experimental_attribution: true,
			_experimental_fcp: true,
			_experimental_ttfb: true,
		},
	},
	// Existing application, realm/token, and other options...
})
```

- **Custom interactive-element selectors** [#1852](https://github.com/signalfx/splunk-otel-js-web/pull/1852), [#1890](https://github.com/signalfx/splunk-otel-js-web/pull/1890)
    - `experimental_interactiveElementSelectors` identifies controls implemented with non-native markup, such as a clickable `<div>`. Elements matching a configured selector are treated as interactive when the agent decides whether a click should be considered a dead-click candidate.

```js
SplunkRum.init({
	instrumentations: {
		interactions: {
			experimental_interactiveElementSelectors: ['.custom-control'],
		},
	},
	// Existing application, realm/token, and other options...
})
```

### Internal and dependency updates

- Upgraded the upstream Session Replay dependency to 2.18.1 [#1861](https://github.com/signalfx/splunk-otel-js-web/pull/1861).
- Updated runtime, development, build, test, and example dependencies [#1853](https://github.com/signalfx/splunk-otel-js-web/pull/1853), [#1854](https://github.com/signalfx/splunk-otel-js-web/pull/1854), [#1835](https://github.com/signalfx/splunk-otel-js-web/pull/1835), [#1836](https://github.com/signalfx/splunk-otel-js-web/pull/1836), [#1838](https://github.com/signalfx/splunk-otel-js-web/pull/1838), [#1842](https://github.com/signalfx/splunk-otel-js-web/pull/1842), [#1840](https://github.com/signalfx/splunk-otel-js-web/pull/1840), [#1841](https://github.com/signalfx/splunk-otel-js-web/pull/1841), [#1837](https://github.com/signalfx/splunk-otel-js-web/pull/1837), [#1839](https://github.com/signalfx/splunk-otel-js-web/pull/1839), [#1828](https://github.com/signalfx/splunk-otel-js-web/pull/1828), [#1829](https://github.com/signalfx/splunk-otel-js-web/pull/1829), [#1826](https://github.com/signalfx/splunk-otel-js-web/pull/1826), [#1832](https://github.com/signalfx/splunk-otel-js-web/pull/1832), [#1833](https://github.com/signalfx/splunk-otel-js-web/pull/1833), [#1823](https://github.com/signalfx/splunk-otel-js-web/pull/1823), [#1830](https://github.com/signalfx/splunk-otel-js-web/pull/1830), [#1831](https://github.com/signalfx/splunk-otel-js-web/pull/1831), [#1825](https://github.com/signalfx/splunk-otel-js-web/pull/1825), [#1824](https://github.com/signalfx/splunk-otel-js-web/pull/1824), [#1817](https://github.com/signalfx/splunk-otel-js-web/pull/1817), [#1814](https://github.com/signalfx/splunk-otel-js-web/pull/1814), [#1805](https://github.com/signalfx/splunk-otel-js-web/pull/1805), [#1799](https://github.com/signalfx/splunk-otel-js-web/pull/1799), [#1800](https://github.com/signalfx/splunk-otel-js-web/pull/1800), [#1707](https://github.com/signalfx/splunk-otel-js-web/pull/1707), [#1795](https://github.com/signalfx/splunk-otel-js-web/pull/1795), [#1875](https://github.com/signalfx/splunk-otel-js-web/pull/1875), [#1876](https://github.com/signalfx/splunk-otel-js-web/pull/1876), [#1877](https://github.com/signalfx/splunk-otel-js-web/pull/1877), [#1878](https://github.com/signalfx/splunk-otel-js-web/pull/1878), [#1881](https://github.com/signalfx/splunk-otel-js-web/pull/1881), [#1882](https://github.com/signalfx/splunk-otel-js-web/pull/1882), [#1885](https://github.com/signalfx/splunk-otel-js-web/pull/1885), [#1886](https://github.com/signalfx/splunk-otel-js-web/pull/1886), [#1889](https://github.com/signalfx/splunk-otel-js-web/pull/1889), [#1893](https://github.com/signalfx/splunk-otel-js-web/pull/1893), [#1894](https://github.com/signalfx/splunk-otel-js-web/pull/1894).

## 3.0.0

### Breaking Changes

- `@splunk/otel-web`
    - **Domain migration from `signalfx.com` to `observability.splunkcloud.com`** [#1695](https://github.com/signalfx/splunk-otel-js-web/pull/1695)
        - All endpoints have moved to new domains:
            - CDN: `cdn.signalfx.com` → `cdn.observability.splunkcloud.com`
            - RUM ingest: `rum-ingest.{realm}.signalfx.com` → `rum-ingest.{realm}.observability.splunkcloud.com`
            - Source map upload API: `api.{realm}.signalfx.com` → `api.{realm}.observability.splunkcloud.com`
            - Session Replay ingest: `rum-ingest.{realm}.signalfx.com` → `rum-ingest.{realm}.observability.splunkcloud.com`
        - **Content Security Policy (CSP):** If your application uses a CSP, you **must** update your directives before upgrading:
            - `script-src`: add `cdn.observability.splunkcloud.com` (for loading the agent and session replay via CDN)
            - `connect-src`: add `rum-ingest.{realm}.observability.splunkcloud.com` (for telemetry and replay data export) and `api.{realm}.observability.splunkcloud.com` (if using source map upload via build plugins)
            - The old `signalfx.com` domains can be removed from your CSP after all agents are upgraded
        - **`latest` CDN tag discontinued:** The `latest` tag is permanently pinned to v2.5.1 and will **not** receive any future updates — including v3.0.0 and beyond. Users loading the agent via `cdn.signalfx.com/o11y-gdi-rum/latest/splunk-otel-web.js` will remain on v2.5.1 indefinitely. Migrate to a versioned URL on the new CDN domain:
            ```diff
            - <script src="https://cdn.signalfx.com/o11y-gdi-rum/latest/splunk-otel-web.js"></script>
            + <script src="https://cdn.observability.splunkcloud.com/o11y-gdi-rum/v3/splunk-otel-web.js"></script>
            ```
            Available version locks:
            - `v3` — major version lock (recommended), receives all minor and patch updates
            - `v3.0` — minor version lock, receives patch updates only
            - `v3.0.0` — exact version pin
    - **OTLP exporter enabled by default** [#1791](https://github.com/signalfx/splunk-otel-js-web/pull/1791)
        - OTLP is now the default export format when `beaconEndpoint` is not specified
        - A deprecation warning is emitted when `beaconEndpoint` is explicitly provided without `exporter.otlp: true`, indicating Zipkin will be removed in a future version
        - **Migration:** Set `exporter.otlp: false` to opt out.
    - **Promoted experimental flags to stable defaults** [#1780](https://github.com/signalfx/splunk-otel-js-web/pull/1780)
        - `_experimental_adjustSessionStartToTimeOrigin` → `adjustSessionStartToTimeOrigin` (default: `true`) — session start time is backdated to `performance.timeOrigin`
        - `_experimental_discardDataAfterInactivity` → `discardDataAfterInactivity` (default: `true`) — telemetry is discarded after 15 minutes of user inactivity
        - `spaMetrics` now defaults to `true` — SPA route metrics collected by default
        - `experimental_alignWebVitalsSpansWithDocumentLoad` → `instrumentations.webvitals.alignWebVitalsSpansWithDocumentLoad` — LCP, CLS, and INP spans are anchored to the documentLoad span timestamp by default
        - **Migration:** Set individual flags to `false` to opt out of new defaults.

### New Features and Improvements

- `@splunk/otel-web`
    - **Add `http.cache.hit` attribute to resource spans** [#1768](https://github.com/signalfx/splunk-otel-js-web/pull/1768)
        - Boolean attribute on resource fetch spans (document-load and post-document-load) indicating cache status
        - Detects cache hits via 304 response status or zero transfer size with non-zero decoded body size
        - Attribute is omitted for cross-origin requests without `Timing-Allow-Origin` headers
    - **Add `_experimental_captureBrowserDebugAttributes` option** [#1793](https://github.com/signalfx/splunk-otel-js-web/pull/1793)
        - Experimental flag that collects browser diagnostics (hardware concurrency, device memory, viewport/screen data, network hints, JS heap memory, storage quota, User-Agent Client Hints) and attaches them as global span attributes
        - High cardinality — intended for temporary debugging only

- `@splunk/otel-web-session-recorder`
    - **Add option to store failed segments to IndexedDB** [#1766](https://github.com/signalfx/splunk-otel-js-web/pull/1766)
        - New `persistFailedReplayData: 'indexeddb'` configuration option for storing failed replay segments in IndexedDB instead of localStorage
        - Automatic retry on subsequent page loads

- **Updated dependencies** [#1771](https://github.com/signalfx/splunk-otel-js-web/pull/1771), [#1772](https://github.com/signalfx/splunk-otel-js-web/pull/1772), [#1773](https://github.com/signalfx/splunk-otel-js-web/pull/1773), [#1774](https://github.com/signalfx/splunk-otel-js-web/pull/1774), [#1775](https://github.com/signalfx/splunk-otel-js-web/pull/1775), [#1777](https://github.com/signalfx/splunk-otel-js-web/pull/1777), [#1778](https://github.com/signalfx/splunk-otel-js-web/pull/1778), [#1779](https://github.com/signalfx/splunk-otel-js-web/pull/1779), [#1782](https://github.com/signalfx/splunk-otel-js-web/pull/1782), [#1783](https://github.com/signalfx/splunk-otel-js-web/pull/1783), [#1784](https://github.com/signalfx/splunk-otel-js-web/pull/1784), [#1785](https://github.com/signalfx/splunk-otel-js-web/pull/1785), [#1786](https://github.com/signalfx/splunk-otel-js-web/pull/1786), [#1787](https://github.com/signalfx/splunk-otel-js-web/pull/1787), [#1788](https://github.com/signalfx/splunk-otel-js-web/pull/1788), [#1789](https://github.com/signalfx/splunk-otel-js-web/pull/1789), [#1790](https://github.com/signalfx/splunk-otel-js-web/pull/1790)

## 2.5.1

- `@splunk/otel-web`
    - **Trace separation of XHR and Fetch from parent trace** [#1693](https://github.com/signalfx/splunk-otel-js-web/pull/1693)
        - New `separateTraces` configuration option that gives XHR and Fetch requests their own trace IDs instead of inheriting the parent click event's trace ID
        - Preserves the relationship through `parent.traceId` and `parent.spanId` attributes, enabling proper Business Transaction correlation in backend APM while maintaining RUM trace correlation
        - Supports top-level config, per-instrumentation config, and mixed configurations with overrides
    - **Add `user_agent.is_bot` and `user_agent.is_automated` attributes** [#1760](https://github.com/signalfx/splunk-otel-js-web/pull/1760)
        - New global span attribute `user_agent.is_bot` that uses regex detection to flag bot/crawler user agents
        - New global span attribute `user_agent.is_automated` that checks `navigator.webdriver` to identify browsers controlled by automation frameworks like Selenium, Puppeteer, and Playwright
        - Enables downstream filtering and analysis of synthetic versus real user traffic
    - **Add `splunk.rum.is_latest_tag` attribute** [#1762](https://github.com/signalfx/splunk-otel-js-web/pull/1762)
        - Adds a global span attribute `splunk.rum.is_latest_tag: true` when the agent loads via the "latest" CDN tag
        - Updates deprecation warnings to clarify that the "latest" tag remains pinned to v2.5.x
    - **Improve dead click detection for `role=button` and anchor elements** [#1756](https://github.com/signalfx/splunk-otel-js-web/pull/1756)
        - Elements with `role="button"` are now treated as interactive components for dead click detection
        - Excludes `<a>` elements with actual href attributes from detection since they trigger navigation
        - Keeps anchors without href or with `javascript:` hrefs as candidates for detection
    - **Upgrade upstream to v2.11.1** [#1758](https://github.com/signalfx/splunk-otel-js-web/pull/1758)

- **Updated dependencies** [#1759](https://github.com/signalfx/splunk-otel-js-web/pull/1759), [#1761](https://github.com/signalfx/splunk-otel-js-web/pull/1761)

### ⚠️ Upcoming breaking changes in v3.0.0

> **Action required before upgrading to v3.0.0:**

- **Domain migration**: All domains are changing from `signalfx.com` to `observability.splunkcloud.com`. This includes both the CDN (`cdn.signalfx.com` → `cdn.observability.splunkcloud.com`) and the ingest endpoint (`rum-ingest.{realm}.signalfx.com` → `rum-ingest.{realm}.observability.splunkcloud.com`). If your application uses a Content Security Policy (CSP), update your `script-src` and `connect-src` directives to allow the new domains before upgrading.
- **`latest` CDN tag discontinued**: The `latest` CDN tag will stop being updated after v2.5.0. Users relying on the `latest` tag should migrate to a versioned URL:

```diff
- <script src="https://cdn.signalfx.com/o11y-gdi-rum/latest/splunk-otel-web.js"></script>
+ <script src="https://cdn.observability.splunkcloud.com/o11y-gdi-rum/v3/splunk-otel-web.js"></script>
```

The following experimental config options will be removed in v3.0.0 and their behavior will be enabled by default. This may affect how sessions and data are counted:

- **`_experimental_adjustSessionStartToTimeOrigin`**: Session start time will be automatically backdated to `performance.timeOrigin`.
- **`_experimental_discardDataAfterInactivity`**: Will be enabled by default. Data will be automatically discarded after 15 minutes of user inactivity. Set `_experimental_discardDataAfterInactivity: false` to opt out.
- **OTLP exporter enabled by default**: The OTLP exporter will replace Zipkin as the default export format. Set `exporter.otlp: false` to opt out.
- **`spaMetrics`**: Will be enabled by default. Set `spaMetrics: false` to opt out.
- **`experimental_alignWebVitalsSpansWithDocumentLoad`**: All web vitals spans (LCP, CLS, INP) will be automatically anchored to the document load span — start time will match the documentLoad span timestamp rather than the time the metric was reported, and `location.href` will reflect the original page load URL rather than the current URL after SPA navigation.

## 2.5.0

- `@splunk/otel-web`
    - **Frustration signals - dead clicks detection** [#1697](https://github.com/signalfx/splunk-otel-js-web/pull/1697)
        - Detects when a user clicks an interactive element (button, link, or submit input) that produces no meaningful response — no DOM mutation and no network activity within a configurable time window
        - Enabled via `instrumentations.frustrationSignals.deadClick: true` or with custom options (`timeWindowMs`, `ignoreUrls`)
        - Default detection window is 1000ms
    - **Frustration signals - error clicks detection** [#1681](https://github.com/signalfx/splunk-otel-js-web/pull/1681)
        - Detects when a user clicks on a UI element and a JavaScript error occurs shortly afterward
        - The frustration span captures the error message, error type, clicked element, and links to the original click and error spans
        - Enabled via `instrumentations.frustrationSignals.errorClick: true` or with custom options (`timeWindowMs`, `ignoreUrls`)
        ```js
        SplunkRum.init({
        	instrumentations: {
        		frustrationSignals: {
        			deadClick: true,
        			errorClick: true,
        		},
        	},
        })
        ```
    - **Add `_experimental_adjustSessionStartToTimeOrigin` config option** [#1705](https://github.com/signalfx/splunk-otel-js-web/pull/1705)
        - Backdates session start time using `performance.timeOrigin` to reflect when the tab opened rather than when the SDK initialized
        - Drops spans whose start time predates the session start time by not assigning a session ID
        - Anchors `session.start` span to the precise session start moment
    - **Use nanoid for IDs to prevent collisions** [#1701](https://github.com/signalfx/splunk-otel-js-web/pull/1701), [#1752](https://github.com/signalfx/splunk-otel-js-web/pull/1752)
        - Cryptographically secure ID generation using nanoid is now used by default for all IDs, preventing duplicate session IDs from Googlebot's seeded Math.random()
    - **Add retry strategy for anonymous user ID persistence** [#1703](https://github.com/signalfx/splunk-otel-js-web/pull/1703)
        - Adds write-back verification with retry capability (up to 3 attempts) when persisting the anonymous user ID cookie
    - **Fix init session missing from sessionHistory and notifications** [#1747](https://github.com/signalfx/splunk-otel-js-web/pull/1747)
        - Session initialization now follows the same processing path as subsequent updates, ensuring the initial session is added to `sessionHistory`, persisted to storage, and triggers subscriber notifications
    - **Fix timestamp of webvitals spans** [#1700](https://github.com/signalfx/splunk-otel-js-web/pull/1700)
        - Fixed incorrect start times on web vitals spans when `experimental_alignWebVitalsSpansWithDocumentLoad` is enabled

- `@splunk/otel-web-session-recorder`
    - **Update session replay upstream** [#1698](https://github.com/signalfx/splunk-otel-js-web/pull/1698), [#1694](https://github.com/signalfx/splunk-otel-js-web/pull/1694), [#1692](https://github.com/signalfx/splunk-otel-js-web/pull/1692), [#1691](https://github.com/signalfx/splunk-otel-js-web/pull/1691)

- **Updated dependencies** [#1750](https://github.com/signalfx/splunk-otel-js-web/pull/1750), [#1744](https://github.com/signalfx/splunk-otel-js-web/pull/1744), [#1745](https://github.com/signalfx/splunk-otel-js-web/pull/1745), [#1742](https://github.com/signalfx/splunk-otel-js-web/pull/1742), [#1746](https://github.com/signalfx/splunk-otel-js-web/pull/1746), [#1738](https://github.com/signalfx/splunk-otel-js-web/pull/1738), [#1739](https://github.com/signalfx/splunk-otel-js-web/pull/1739), [#1737](https://github.com/signalfx/splunk-otel-js-web/pull/1737), [#1740](https://github.com/signalfx/splunk-otel-js-web/pull/1740), [#1741](https://github.com/signalfx/splunk-otel-js-web/pull/1741), [#1726](https://github.com/signalfx/splunk-otel-js-web/pull/1726), [#1730](https://github.com/signalfx/splunk-otel-js-web/pull/1730), [#1727](https://github.com/signalfx/splunk-otel-js-web/pull/1727), [#1731](https://github.com/signalfx/splunk-otel-js-web/pull/1731), [#1729](https://github.com/signalfx/splunk-otel-js-web/pull/1729), [#1728](https://github.com/signalfx/splunk-otel-js-web/pull/1728), [#1734](https://github.com/signalfx/splunk-otel-js-web/pull/1734), [#1732](https://github.com/signalfx/splunk-otel-js-web/pull/1732), [#1720](https://github.com/signalfx/splunk-otel-js-web/pull/1720), [#1718](https://github.com/signalfx/splunk-otel-js-web/pull/1718), [#1721](https://github.com/signalfx/splunk-otel-js-web/pull/1721), [#1723](https://github.com/signalfx/splunk-otel-js-web/pull/1723), [#1722](https://github.com/signalfx/splunk-otel-js-web/pull/1722), [#1719](https://github.com/signalfx/splunk-otel-js-web/pull/1719), [#1724](https://github.com/signalfx/splunk-otel-js-web/pull/1724), [#1717](https://github.com/signalfx/splunk-otel-js-web/pull/1717), [#1708](https://github.com/signalfx/splunk-otel-js-web/pull/1708), [#1706](https://github.com/signalfx/splunk-otel-js-web/pull/1706), [#1711](https://github.com/signalfx/splunk-otel-js-web/pull/1711), [#1712](https://github.com/signalfx/splunk-otel-js-web/pull/1712), [#1715](https://github.com/signalfx/splunk-otel-js-web/pull/1715), [#1714](https://github.com/signalfx/splunk-otel-js-web/pull/1714), [#1713](https://github.com/signalfx/splunk-otel-js-web/pull/1713), [#1709](https://github.com/signalfx/splunk-otel-js-web/pull/1709), [#1699](https://github.com/signalfx/splunk-otel-js-web/pull/1699)

### ⚠️ Upcoming breaking changes in v3.0.0

> **Action required before upgrading to v3.0.0:**

- **Domain migration**: All domains are changing from `signalfx.com` to `observability.splunkcloud.com`. This includes both the CDN (`cdn.signalfx.com` → `cdn.observability.splunkcloud.com`) and the ingest endpoint (`rum-ingest.{realm}.signalfx.com` → `rum-ingest.{realm}.observability.splunkcloud.com`). If your application uses a Content Security Policy (CSP), update your `script-src` and `connect-src` directives to allow the new domains before upgrading.
- **`latest` CDN tag discontinued**: The `latest` CDN tag will stop being updated after v2.5.0. Users relying on the `latest` tag should migrate to a versioned URL:

```diff
- <script src="https://cdn.signalfx.com/o11y-gdi-rum/latest/splunk-otel-web.js"></script>
+ <script src="https://cdn.observability.splunkcloud.com/o11y-gdi-rum/v3/splunk-otel-web.js"></script>
```

The following experimental config options will be removed in v3.0.0 and their behavior will be enabled by default. This may affect how sessions and data are counted:

- **`_experimental_adjustSessionStartToTimeOrigin`**: Session start time will be automatically backdated to `performance.timeOrigin`.
- **`_experimental_discardDataAfterInactivity`**: Will be enabled by default. Data will be automatically discarded after 15 minutes of user inactivity. Set `_experimental_discardDataAfterInactivity: false` to opt out.
- **OTLP exporter enabled by default**: The OTLP exporter will replace Zipkin as the default export format. Set `exporter.otlp: false` to opt out.
- **`spaMetrics`**: Will be enabled by default. Set `spaMetrics: false` to opt out.
- **`experimental_alignWebVitalsSpansWithDocumentLoad`**: All web vitals spans (LCP, CLS, INP) will be automatically anchored to the document load span — start time will match the documentLoad span timestamp rather than the time the metric was reported, and `location.href` will reflect the original page load URL rather than the current URL after SPA navigation.

## 2.4.0

- `@splunk/otel-web`
    - **Align webvitals spans with document load span** [#1673](https://github.com/signalfx/splunk-otel-js-web/pull/1673)
        - All webvitals spans (LCP, CLS, INP) can now be anchored to the document load span
        - Start time is set to the same timestamp as the documentLoad span, rather than the time the metric was reported
        - `location.href` is copied from the documentLoad span onto the webvitals span, reflecting where the page originally loaded rather than the current URL after SPA navigation
        - This feature must be explicitly enabled via the `experimental_alignWebVitalsSpansWithDocumentLoad` option:
            ```js
            SplunkRum.init({
            	// ...
            	instrumentations: {
            		webvitals: {
            			experimental_alignWebVitalsSpansWithDocumentLoad: true,
            		},
            	},
            })
            ```
    - **Debug mode** [#1678](https://github.com/signalfx/splunk-otel-js-web/pull/1678)
        - Adds the ability to enable debug logging at runtime via localStorage, without requiring a config change
    - **Add polyfills to npm target** [#1688](https://github.com/signalfx/splunk-otel-js-web/pull/1688)
        - Polyfills are now applied to the npm build target as well, not just CDN artifacts
    - **Improve anonymous user persistence between tabs** [#1687](https://github.com/signalfx/splunk-otel-js-web/pull/1687)
        - Fixes a race condition where another tab could persist a different anonymous user ID simultaneously

- `@splunk/otel-web-session-recorder`
    - **Fix duplicate `isRecording` spans** [#1677](https://github.com/signalfx/splunk-otel-js-web/pull/1677)
        - Prevents duplicate isRecording spans being created when session changes
    - **Update session replay upstream** [#1679](https://github.com/signalfx/splunk-otel-js-web/pull/1679) [#1680](https://github.com/signalfx/splunk-otel-js-web/pull/1680)

- **Updated dependencies** [#1685](https://github.com/signalfx/splunk-otel-js-web/pull/1685), [#1662](https://github.com/signalfx/splunk-otel-js-web/pull/1662)

## 2.3.0

- `@splunk/otel-web`
    - **External session support** [#1648](https://github.com/signalfx/splunk-otel-js-web/pull/1648)
        - Enables sharing a single RUM session between mobile and browser agents by transferring session metadata across application boundaries
        - New `sessionMetadata` configuration parameter to initialize with externally provided session data
        - New `SplunkRum.getSessionMetadata()` method to expose current session metadata for transfer
        - Prevents fragmented sessions when users navigate from native app contexts to browser environments
    - **Introduce `_experimental_discardDataAfterInactivity`** [#1670](https://github.com/signalfx/splunk-otel-js-web/pull/1670)
        - Experimental flag to discard all data once user activity expires after 15 minutes of inactivity
        - Also fixes a bug involving missing previous session state
    - **Initialize anonymous ID on load** [#1674](https://github.com/signalfx/splunk-otel-js-web/pull/1674)
        - Fixed a race condition where the anonymous user ID was persisted lazily, causing a second tab to generate its own ID if opened before the first span fired

- **Updated dependencies** [#1649](https://github.com/signalfx/splunk-otel-js-web/pull/1649), [#1650](https://github.com/signalfx/splunk-otel-js-web/pull/1650), [#1651](https://github.com/signalfx/splunk-otel-js-web/pull/1651), [#1652](https://github.com/signalfx/splunk-otel-js-web/pull/1652), [#1654](https://github.com/signalfx/splunk-otel-js-web/pull/1654), [#1655](https://github.com/signalfx/splunk-otel-js-web/pull/1655), [#1656](https://github.com/signalfx/splunk-otel-js-web/pull/1656), [#1657](https://github.com/signalfx/splunk-otel-js-web/pull/1657), [#1658](https://github.com/signalfx/splunk-otel-js-web/pull/1658), [#1659](https://github.com/signalfx/splunk-otel-js-web/pull/1659), [#1660](https://github.com/signalfx/splunk-otel-js-web/pull/1660), [#1661](https://github.com/signalfx/splunk-otel-js-web/pull/1661), [#1663](https://github.com/signalfx/splunk-otel-js-web/pull/1663), [#1664](https://github.com/signalfx/splunk-otel-js-web/pull/1664), [#1665](https://github.com/signalfx/splunk-otel-js-web/pull/1665), [#1666](https://github.com/signalfx/splunk-otel-js-web/pull/1666), [#1667](https://github.com/signalfx/splunk-otel-js-web/pull/1667), [#1668](https://github.com/signalfx/splunk-otel-js-web/pull/1668), [#1669](https://github.com/signalfx/splunk-otel-js-web/pull/1669), [#1672](https://github.com/signalfx/splunk-otel-js-web/pull/1672)

## 2.2.0

- `@splunk/otel-web`
    - **Enable rage clicks by default** [#1641](https://github.com/signalfx/splunk-otel-js-web/pull/1641)
        - Rage clicks frustration signal is now enabled by default
    - **Remove `_experimental` prefix from `spaMetrics`** [#1640](https://github.com/signalfx/splunk-otel-js-web/pull/1640)
        - The spaMetrics feature is now stable and no longer marked as experimental
    - **Prevent `session.start` spans and session replay for native sessions** [#1638](https://github.com/signalfx/splunk-otel-js-web/pull/1638)
        - Prevents duplicate `session.start` spans and session replay when receiving a session ID from the mobile agent (MRUM)

- `@splunk/otel-web-session-recorder`
    - **Update session-replay CDN module to v2.6.7** [#1643](https://github.com/signalfx/splunk-otel-js-web/pull/1643)

- `@splunk/otel-web-build-plugins`
    - **Fix build of `@splunk/rum-build-plugins`** [#1644](https://github.com/signalfx/splunk-otel-js-web/pull/1644)
        - Fixed broken source map upload functionality for both CommonJS and ES Module consumers
        - Added webpack example for end-to-end validation of upload behavior

- **Updated dependencies** [#1626](https://github.com/signalfx/splunk-otel-js-web/pull/1626)

## 2.1.0

- `@splunk/otel-web`
    - **Change Rage Click Type to Frustration** [#1593](https://github.com/signalfx/splunk-otel-js-web/pull/1593)
        - Renamed rage click feature to "frustration" to enable future expansion to additional frustration categories
        - Added new `frustration_type` and `interaction_type` attributes
        - This allows future support for error clicks and dead clicks
    - **Increase Default Rage Click Limit from 3 to 4** [#1590](https://github.com/signalfx/splunk-otel-js-web/pull/1590)
        - Raised the threshold for detecting rage clicks from 3 to 4 occurrences within a one-second timeframe
    - **Emit Session Start Span** [#1584](https://github.com/signalfx/splunk-otel-js-web/pull/1584)
        - Added automatic emission of a `session.start` span when a new session begins
        - Each session generates exactly one span for tracking session lifecycles
    - **Fix Secret Scanning False Positives in Bundle** [#1594](https://github.com/signalfx/splunk-otel-js-web/pull/1594)
        - Fixed an issue where GitHub's secret scanning triggered false alerts when including the library's bundle in repositories
        - Replaced occurrences of unused "OTEL_EXPORTER_JAEGER_PASSWORD" environment variable name
    - **Internal: Ensure Fresh Session State is Returned** [#1589](https://github.com/signalfx/splunk-otel-js-web/pull/1589)
    - **Internal: Fix Optimised Parameter in getElementXPath** [#1588](https://github.com/signalfx/splunk-otel-js-web/pull/1588)

- `@splunk/otel-web-session-recorder`
    - **Updated Session Replay CDN Module** [#1630](https://github.com/signalfx/splunk-otel-js-web/pull/1630)
        - Bumped session-replay to latest upstream version

- **Updated dependencies** [#1592](https://github.com/signalfx/splunk-otel-js-web/pull/1592), [#1595](https://github.com/signalfx/splunk-otel-js-web/pull/1595), [#1596](https://github.com/signalfx/splunk-otel-js-web/pull/1596), [#1597](https://github.com/signalfx/splunk-otel-js-web/pull/1597), [#1599](https://github.com/signalfx/splunk-otel-js-web/pull/1599), [#1601](https://github.com/signalfx/splunk-otel-js-web/pull/1601), [#1602](https://github.com/signalfx/splunk-otel-js-web/pull/1602), [#1603](https://github.com/signalfx/splunk-otel-js-web/pull/1603), [#1604](https://github.com/signalfx/splunk-otel-js-web/pull/1604), [#1605](https://github.com/signalfx/splunk-otel-js-web/pull/1605), [#1608](https://github.com/signalfx/splunk-otel-js-web/pull/1608), [#1609](https://github.com/signalfx/splunk-otel-js-web/pull/1609), [#1610](https://github.com/signalfx/splunk-otel-js-web/pull/1610), [#1611](https://github.com/signalfx/splunk-otel-js-web/pull/1611), [#1616](https://github.com/signalfx/splunk-otel-js-web/pull/1616), [#1620](https://github.com/signalfx/splunk-otel-js-web/pull/1620), [#1621](https://github.com/signalfx/splunk-otel-js-web/pull/1621), [#1622](https://github.com/signalfx/splunk-otel-js-web/pull/1622), [#1623](https://github.com/signalfx/splunk-otel-js-web/pull/1623), [#1624](https://github.com/signalfx/splunk-otel-js-web/pull/1624), [#1625](https://github.com/signalfx/splunk-otel-js-web/pull/1625), [#1627](https://github.com/signalfx/splunk-otel-js-web/pull/1627), [#1628](https://github.com/signalfx/splunk-otel-js-web/pull/1628), [#1632](https://github.com/signalfx/splunk-otel-js-web/pull/1632), [#1633](https://github.com/signalfx/splunk-otel-js-web/pull/1633), [#1634](https://github.com/signalfx/splunk-otel-js-web/pull/1634), [#1635](https://github.com/signalfx/splunk-otel-js-web/pull/1635), [#1636](https://github.com/signalfx/splunk-otel-js-web/pull/1636)

## 2.0.0

### Breaking Changes

- `@splunk/otel-web`
    - **Anonymous User Tracking Enabled by Default** [#1579](https://github.com/signalfx/splunk-otel-js-web/pull/1579)
        - Changed the default value of `user.trackingMode` from `noTracking` to `anonymousTracking`
        - The agent now generates a persistent anonymous user ID (`_splunk_rum_user_anonymousId`) stored via the configured persistence method (default: cookie)
        - This enables:
            - User journey correlation across sessions
            - Issue diagnosis by tracking user behavior patterns
            - Digital experience analytics without identifying individual users
        - **Migration**: Users who do not want this behavior can explicitly set `user.trackingMode: 'noTracking'` in their configuration
        - Example:
            ```javascript
            SplunkRum.init({
            	realm: 'us0',
            	rumAccessToken: '....',
            	user: {
            		trackingMode: 'noTracking', // Opt out of anonymous tracking
            	},
            })
            ```

### New Features and Improvements

- `@splunk/otel-web-session-recorder`
    - **Added Session Replay Sampling** [#1577](https://github.com/signalfx/splunk-otel-js-web/pull/1577)
        - Introduced `SessionBasedSampler` to control the percentage of sessions that get recorded by session recorder
        - SplunkRum takes a `ratio` of all possible sessions, e.g. `0.8` means 80% of all possible sessions will be sent to the backend
        - SplunkSessionRecorder also takes a `ratio` of all possible sessions, e.g. `0.02` means that replay will be recorded for the 2% of all possible sessions
        - Note that if you record 20% of the sessions, and you want the replay for 10% of recorded sessions then you need to multiply: `0.2 * 0.1 = 0.02`, so the ratio for `SplunkRum` is `0.2` and the ratio for `SplunkSessionRecorder` is `0.02`
        - We ensure that if the replay is recorded then the session itself is recorded and that the ratios are preserved
        - Example usage:

            ```javascript
            // Example 1: Record 30% of all sessions (independent of agent sampling)
            SplunkSessionRecorder.init({
            	realm: 'us0',
            	rumAccessToken: '....',
            	sampler: new SplunkRum.SessionBasedSampler({ ratio: 0.3 }), // records 30% of sessions
            })

            // Example 2: If agent samples 80% and you want session recorder to record 20% of ALL sessions
            // (not 20% of the agent-sampled sessions), use:
            SplunkRum.init({
            	realm: 'us0',
            	rumAccessToken: '....',
            	sampler: new SplunkRum.SessionBasedSampler({ ratio: 0.8 }), // agent samples 80%
            })
            SplunkSessionRecorder.init({
            	realm: 'us0',
            	rumAccessToken: '....',
            	sampler: new SplunkRum.SessionBasedSampler({ ratio: 0.2 }), // records 20% of all sessions
            })
            // Result: 20% of all sessions will have session replay

            // Example 3: If agent samples 80% and you want session recorder to record 20% of of the agent-sampled sessions, use:
            SplunkRum.init({
            	realm: 'us0',
            	rumAccessToken: '....',
            	sampler: new SplunkRum.SessionBasedSampler({ ratio: 0.8 }), // agent samples 80%
            })
            SplunkSessionRecorder.init({
            	realm: 'us0',
            	rumAccessToken: '....',
            	sampler: new SplunkRum.SessionBasedSampler({ ratio: 0.16 }), // 0.8 * 0.2 = 0.16
            })
            ```

            - **Bug fixes included**:
                - Replay export is now scoped to the current session. This fixes a case where the last chunk from the previous session could be attached to a new session
                - Recording now re-checks sampling when a new session starts, not just on the first page load. This prevents sessions from being skipped when sampling changes across sessions

- `@splunk/otel-web`
    - **Added Experimental Data Attributes Capture** [#1537](https://github.com/signalfx/splunk-otel-js-web/pull/1537)
        - Added `__experimental_dataAttributesToCapture` config option to capture custom `data-*` attributes from clicked elements
        - Captured attributes are attached to click and rage click spans
        - Supports both hyphenated and camelCase format for attribute names
        - Example:
            ```javascript
            SplunkRum.init({
            	realm: 'us0',
            	rumAccessToken: 'YOUR_TOKEN',
            	applicationName: 'my-app',
            	__experimental_dataAttributesToCapture: [
            		'data-testid', // hyphenated format
            		'track', // camelCase format (looks up data-track)
            		'userName', // camelCase format (looks up data-user-name)
            	],
            })
            ```
        - When a button with these attributes is clicked, the span will include:
            - `element.dataset.testid: "submit-btn"`
            - `element.dataset.track: "purchase"`
            - `element.dataset.userName: "john-doe"`
    - **Added Page Completion Time (PCT) Metric for SPAs** [#1536](https://github.com/signalfx/splunk-otel-js-web/pull/1536)
        - Introduced a new `SpaMetricsManager` for measuring page load times in Single Page Applications (SPAs)
        - Unlike traditional page load metrics that rely on browser navigation events, this monitors actual resource loading activity to determine when a page has finished loading
        - **When enabled, PCT is automatically recorded as the duration of every `routeChange` span in your application**
        - **How PCT is calculated**:
            - When a user navigates within your SPA (clicking links, tabs, or menu items), the timer starts
            - Monitors all resource loading activity (API calls, images, stylesheets, etc.)
            - Uses a quiet period detection algorithm - waits for a configurable period (default: 5 seconds) with no new resource activity
            - The total time is recorded as the duration of the `routeChange` span
        - **Disabled by default** - must be explicitly enabled in configuration
        - **How to enable**:

            ```javascript
            // Option 1: Enable with defaults
            SplunkOtelWeb.init({
            	realm: 'us0',
            	rumAccessToken: 'your-token',
            	applicationName: 'my-spa-app',
            	_experimental_spaMetrics: true,
            })

            // Option 2: Enable with custom configuration
            SplunkOtelWeb.init({
            	realm: 'us0',
            	rumAccessToken: 'your-token',
            	applicationName: 'my-spa-app',
            	_experimental_spaMetrics: {
            		quietTime: 3000, // 3 seconds quiet period (default: 5000ms)
            		maxResourcesToWatch: 50, // Limit tracked resources (default: 100)
            		ignoreUrls: [/analytics/], // Additional URLs to ignore
            	},
            })
            ```

## 1.2.0

- `@splunk/otel-web`
    - **Added Rage Click Detection** [#1484](https://github.com/signalfx/splunk-otel-js-web/pull/1484)
        - Automatically detects and reports rage click events (multiple rapid clicks on the same element)
        - Helps identify user frustration signals and usability issues
        - **Disabled by default** - must be explicitly enabled in configuration
        - Example of how to enable rage click detection:
            ```javascript
            SplunkRum.init({
            	// ... other config options
            	instrumentations: {
            		frustrationSignals: {
            			rageClick: {
            				count: 3, // Number of clicks to trigger rage click (default: 3)
            				timeframeSeconds: 1, // Timeframe in seconds (default: 1)
            				ignoreSelectors: ['#no-rage'], // CSS selectors to ignore (optional)
            			},
            		},
            	},
            })
            ```
        - Set `rageClick: true` or `rageClick: {}` to use default settings (3 clicks within 1 second)
    - **Added Platform Attributes Including OS Version** [#1482](https://github.com/signalfx/splunk-otel-js-web/pull/1482)
        - Spans now include detailed platform information such as operating system name and version
        - Uses the User Agent Client Hints API to obtain enhanced platform data
        - Automatically falls back to basic platform information if the API is not available
    - **Removed FID (First Input Delay) Metric** [#1448](https://github.com/signalfx/splunk-otel-js-web/pull/1448)
        - Removed FID metric collection as it has been deprecated by Chrome
        - FID was previously replaced by INP (Interaction to Next Paint) metric which provides better insights into page responsiveness
        - Updated web-vitals dependency to latest version

- `@splunk/otel-web-session-recorder`
    - **Fixed Session Replay Sampling** [#1486](https://github.com/signalfx/splunk-otel-js-web/pull/1486)
        - Session replay now properly respects the configured sampling rate
    - **Fixed Session Recording on Session Expiration** [#1488](https://github.com/signalfx/splunk-otel-js-web/pull/1488)
        - Recording now stops correctly when a session expires
    - **Change span names for session replay lifecycle events** [#1485](https://github.com/signalfx/splunk-otel-js-web/pull/1485)
    - **Updated Session Replay CDN Module** [#1525](https://github.com/signalfx/splunk-otel-js-web/pull/1525)
        - Updated to the latest version of the session replay CDN script

## 1.1.1

- `@splunk/otel-web`
    - **Fixed service.name attribute handling** [#1451](https://github.com/signalfx/splunk-otel-js-web/pull/1451)
        - Prevents the default `unknown_service` value from being included in exported spans when no explicit service name is configured
    - **Reduced click text capture length** [#1455](https://github.com/signalfx/splunk-otel-js-web/pull/1455)
        - Decreased maximum captured click text length from 128 to 50 characters
    - **Updated dependencies**
        - Updated various dependencies

- `@splunk/otel-web-session-recorder`
    - **Updated session replay CDN package** [#1468](https://github.com/signalfx/splunk-otel-js-web/pull/1468)
        - Updated session replay module from v2.5.2 to v2.5.4
        - Fixes potential website crashes in Safari in certain scenarios related to WebKit bug ([WebKit Bug 301688](https://bugs.webkit.org/show_bug.cgi?id=301688))

## 1.1.0

- `@splunk/otel-web`
    - **Collect Text from Clicked Elements** [#1332](https://github.com/signalfx/splunk-otel-js-web/pull/1332)
        - Click events now capture text content from the clicked elements with privacy-first defaults
        - **Default Behavior**: By default, only the element's tag name is collected (e.g., `[Button]`), ensuring no sensitive information is captured
        - **Masking & Unmasking**: Use `maskAllText` and `sensitiveRules` configuration options to control text capture behavior, similar to session replay functionality
        - **Examples**:
            - Default: `Clicked to '[Button]'` for `<button>Potentially sensitive text</button>`
            - After explicitly unmasking: `Clicked to 'Potentially sensitive text'`
        - See [documentation](https://help.splunk.com/en/splunk-observability-cloud/monitor-end-user-experience/real-user-monitoring/replay-user-sessions/record-browser-sessions) for details on masking configuration

- `@splunk/otel-web-session-recorder`
    - **Add browser compatibility guard and enable polyfills for session recorder CDN bundle** [#1450](https://github.com/signalfx/splunk-otel-js-web/pull/1450)
        - Prevents session recorder initialization in unsupported browsers and enables automatic polyfill injection for the CDN bundle.

## 1.0.1

- `@splunk/otel-web`
    - **Improved Configuration Error Handling** [#1431](https://github.com/signalfx/splunk-otel-js-web/pull/1431)
        - Invalid configuration options no longer throw errors that can break initialization. Instead, the SDK now logs an error message and gracefully stops initialization, preventing application crashes due to misconfiguration.

## 1.0.0

🎉 **We're out of beta!** This is the first stable release of Splunk OpenTelemetry JavaScript Web SDK.

### Breaking Changes

This release includes several breaking changes as we graduate from beta to stable:

- `@splunk/otel-web`
    - **Removed Legacy Build Support** [#1366](https://github.com/signalfx/splunk-otel-js-web/pull/1366)
        - Dropped support for legacy browsers (Internet Explorer)
        - The legacy build that provided IE compatibility has been removed

    - **Removed Deprecated and Experimental APIs** [#1331](https://github.com/signalfx/splunk-otel-js-web/pull/1331)
        - All APIs marked as deprecated in previous versions have been removed
        - All experimental APIs (prefixed with `_experimental_`) have been removed or promoted to stable
        - **Removed deprecated configuration options:**
            - `app` - Use `applicationName` instead
            - `beaconUrl` - Use `beaconEndpoint` instead
            - `environment` - Use `deploymentEnvironment` instead
            - `rumAuth` - Use `rumAccessToken` instead
        - **Removed deprecated API methods:**
            - `SplunkRum._experimental_getGlobalAttributes()` - Use `SplunkRum.getGlobalAttributes()` instead
            - `SplunkRum.error(...args)` - Use `SplunkRum.reportError(error, context)` instead
            - `SplunkRum._experimental_addEventListener(name, callback)` - Use `SplunkRum.addEventListener(name, callback)` instead
            - `SplunkRum._experimental_removeEventListener(name, callback)` - Use `SplunkRum.removeEventListener(name, callback)` instead
            - `SplunkRum._experimental_getSessionId()` - Use `SplunkRum.getSessionId()` instead

    - **Session Management Changes** [#1289](https://github.com/signalfx/splunk-otel-js-web/pull/1289)
        - Session lifecycle management has been simplified and now works independently
        - Sessions are extended only when `click`, `scroll`, `touch`, and `keydown` events are detected
        - Previously, we extended sessions based on the `_experimental_allSpansExtendSession` and `_experimental_longtaskNoStartSession` config options. These options are no longer supported and can be removed from your configuration.

- `@splunk/otel-web-session-recorder`
    - **Session Recorder Breaking Changes** [#1330](https://github.com/signalfx/splunk-otel-js-web/pull/1330)
        - **Removed rrweb dependency** - The session recorder no longer uses the external rrweb library
        - **Replaced with Splunk's native recorder** - Session recording is now handled by Splunk's proprietary, more efficient recording engine
        - **Removed `recorderType` configuration option** - The `recorder: 'rrweb|splunk'` option is no longer supported
        - Please refer to the [Record browser sessions docs](https://help.splunk.com/en/splunk-observability-cloud/monitor-end-user-experience/real-user-monitoring/replay-user-sessions/record-browser-sessions) for more details.

    - **Session Replay Enhancements** [#1368](https://github.com/signalfx/splunk-otel-js-web/pull/1368)
        - Added `persistFailedReplayData` option to improve replay data reliability (set to `true` by default)
        - When `persistFailedReplayData` is enabled, data that we are unable to send to Splunk is persisted to local storage and sent again when the page is reloaded.
        - There is a 2MB limit for data stored in local storage

### Migration Guide

If you're upgrading from a previous version, please ensure:

1. **Update your configuration** to use the new option names:

    ```javascript
    // Before (deprecated)
    SplunkRum.init({
    	app: 'my-app',
    	beaconUrl: 'https://...',
    	environment: 'production',
    	rumAuth: 'token',
    })

    // After (stable)
    SplunkRum.init({
    	applicationName: 'my-app',
    	beaconEndpoint: 'https://...',
    	deploymentEnvironment: 'production',
    	rumAccessToken: 'token',
    })
    ```

2. **Update your API calls** to use the stable methods:

    ```javascript
    // Before (deprecated)
    SplunkRum._experimental_getGlobalAttributes()
    SplunkRum.error('Something went wrong')

    // After (stable)
    SplunkRum.getGlobalAttributes()
    SplunkRum.reportError('Something went wrong')
    ```

## 0.24.0

- `@splunk/otel-web`
    - **Deprecation Warnings**: Added console warning messages for better visibility of previously deprecated APIs and configuration options. [#1345](https://github.com/signalfx/splunk-otel-js-web/pull/1345)
    - These items were deprecated in earlier versions but now show explicit deprecation warnings to help users migrate before they are removed in a future major version:
        - **Configuration Options**: The following configuration options have been renamed and the old names will show deprecation warnings:
            - `app` → Use `applicationName` instead
            - `beaconUrl` → Use `beaconEndpoint` instead
            - `environment` → Use `deploymentEnvironment` instead
            - `rumAuth` → Use `rumAccessToken` instead
        - **API Methods**: The following methods are deprecated:
            - `SplunkRum._experimental_getGlobalAttributes()` → Use `SplunkRum.getGlobalAttributes()` instead
            - `SplunkRum.error(...args)` → Use `SplunkRum.reportError(error, context)` instead
            - `SplunkRum._experimental_addEventListener(name, callback)` → Use `SplunkRum.addEventListener(name, callback)` instead
            - `SplunkRum._experimental_removeEventListener(name, callback)` → Use `SplunkRum.removeEventListener(name, callback)` instead
            - `SplunkRum._experimental_getSessionId()` → Use `SplunkRum.getSessionId()` instead

## 0.23.1

- `@splunk/otel-web`
    - Added a new `SplunkRum.reportError(error, context)` API for error reporting. This replaces the deprecated `SplunkRum.error()` method and allows optional context to be attached to errors [#1197](https://github.com/signalfx/splunk-otel-js-web/pull/1197)
        - API signature:
            ```typescript
            reportError: (
              error: string | Event | Error | ErrorEvent,
              context?: Record<string, string | number | boolean>,
            ) => void
            ```
        - The `SplunkRum.error()` method will be removed in the next major release. Please update your code to use `reportError`.
    - Errors can now include a `splunkContext` property (`Record<string, string | number | boolean>`) [#1200](https://github.com/signalfx/splunk-otel-js-web/pull/1200)
        - This context will be automatically extracted and added as attributes to the corresponding error span.
        - Example:
            ```typescript
            try {
            	throw new Error('Just an error')
            } catch (e) {
            	e.splunkContext = {
            		errorValueString: 'errorValue',
            		errorValueNumber: 123,
            	}
            	console.error(e)
            }
            ```
    - Throttle error spans [#1208](https://github.com/signalfx/splunk-otel-js-web/pull/1208)
        - Error reporting is throttled to reduce noise and avoid duplicate spans. Each unique error span is identified by its attributes. We only report the same error (based on its attributes) once per second.
    - Allow transforming errors before they're sent to the backend [#1275](https://github.com/signalfx/splunk-otel-js-web/pull/1275)
        - Example:

            ```typescript
            SplunkOtelWeb.init({
                ...,
                intrumentations: {
                   errors: {
                      onError: (error, context) => {
                        if (error instanceof Error) {
                            error.message = 'Modified message'
                        }

                        return { error, context }
                    },
                  },
                },
                ...
            })
            ```

    - Improved error messages for resources that fail to load, making troubleshooting easier [#1317](https://github.com/signalfx/splunk-otel-js-web/pull/1317)

- `@splunk/otel-web-session-recorder`
    - Added a new `recorderType` option to the session recorder. You can now choose between the default `rrweb` recorder and the new, more efficient `splunk` recorder.
    - Example of how to enable new `splunk` session replay capabilities
        ```typescript
        SplunkSessionRecorder.init({
        	app: '<appName>',
        	realm: '<realm>',
        	rumAccessToken: '<token>',
        	recorder: 'splunk',
        })
        ```
    - Session replay do not have text and inputs recorded by default. It can be enabled using `maskAllText` and `maskAllInputs` set to `false`.
        - Example
        ```typescript
        SplunkSessionRecorder.init({
        	app: '<appName>',
        	realm: '<realm>',
        	rumAccessToken: '<token>',
        	recorder: 'splunk',
        	maskAllInputs: false,
        	maskAllText: false,
        })
        ```
    - Session replay do not have some texts or inputs captured. It can be solved by using mask/unmask/exclude on specific elements using `sensitivityRules`.
      They are in the format of `sensitivityRules: [{ type: 'mask' | 'unmask' | 'exclude', selector: '<css selector>' }]`
        - Example
        ```typescript
        SplunkSessionRecorder.init({
        	app: '<appName>',
        	realm: '<realm>',
        	rumAccessToken: '<token>',
        	recorder: 'splunk',
        	sensitivityRules: [
        		{ type: 'unmask', selector: 'p' },
        		{ type: 'exclude', selector: 'img' },
        		{ type: 'mask', selector: '.user-class' },
        		{ type: 'exclude', selector: '#user-detail' },
        	],
        })
        ```
    - Session replay is missing assets like fonts or images. It can be solved by packing assets into the recordings. It might increase data throughput. Utilize `features.packAssets` and `features.cacheAssets`.
        - Example
            ```typescript
            SplunkSessionRecorder.init({
            	app: '<appName>',
            	realm: '<realm>',
            	rumAccessToken: '<token>',
            	recorder: 'splunk',
            	features: {
            		packAssets: true,
            		cacheAssets: true,
            	},
            })
            ```
    - Canvas element capturing must be enabled using `features.canvas`.
        - Example
        ```typescript
        SplunkSessionRecorder.init({
        	app: '<appName>',
        	realm: '<realm>',
        	rumAccessToken: '<token>',
        	recorder: 'splunk',
        	features: {
        		canvas: true,
        	},
        })
        ```
    - Video element capturing must be enabled using `features.video`. - Example
        ```typescript
        SplunkSessionRecorder.init({
        	app: '<appName>',
        	realm: '<realm>',
        	rumAccessToken: '<token>',
        	recorder: 'splunk',
        	features: {
        		video: true,
        	},
        })
        ```
- Internal
    - Updated dependencies
    - Improved release scripts [#1123](https://github.com/signalfx/splunk-otel-js-web/pull/1123)
    - switch to using `pnpm` [#1182](https://github.com/signalfx/splunk-otel-js-web/pull/1182) and use `turborepo` [#1188](https://github.com/signalfx/splunk-otel-js-web/pull/1188)

## 0.22.0

- @splunk/rum-build-plugins
    - feat: Add `@splunk/rum-build-plugins` and new `SplunkRumWebpackPlugin`.
        - This is part of the symbolication effort, and is one of the ways that browser customers can make
        - use of symbolication feature. [#1098](https://github.com/signalfx/splunk-otel-js-web/pull/1098)

## 0.21.0

- @splunk/otel-web
    - feat: respect `ignoreUrls` option for `routeChange` span creation [#1112](https://github.com/signalfx/splunk-otel-js-web/pull/1112)
        - **Route change spans will no longer be created for URLs that match the `ignoreUrls` pattern.**
        - This is especially useful for single-page applications (SPAs) where you want to avoid tracking certain route changes.
        - To take advantage of this, set the `ignoreUrls` option when configuring the SDK.
- internal
    - Updated dependencies

## 0.20.4

- @splunk/otel-web
    - fix: compatibility with Internet Explorer [#1108](https://github.com/signalfx/splunk-otel-js-web/pull/1108) [#1099](https://github.com/signalfx/splunk-otel-js-web/pull/1099)
- internal
    - Updated dependencies

## 0.20.3

- @splunk/otel-web
    - fix: throw exception with a proper message when running in non-browser environment [#1083](https://github.com/signalfx/splunk-otel-js-web/pull/1083) [#1088](https://github.com/signalfx/splunk-otel-js-web/pull/1088)
        - **There is a possibly breaking change if the package was used incorrectly. Do not `init` SplunkRum in non-browser environments**
- @splunk/otel-web-session-recorder
    - fix: rrweb 'load' handlers clean up fix bypass [#1089](https://github.com/signalfx/splunk-otel-js-web/pull/1089)
    - fix: throw exception when running in non-browser environment [#1089](https://github.com/signalfx/splunk-otel-js-web/pull/1089)
        - **There is a possibly breaking change if the package was used incorrectly. Do not `init` SplunkSessionRecorder in non-browser environments**

## 0.20.2

- @splunk/otel-web
    - fix: handle case when "load" event is triggered multiple times [PR description](https://github.com/signalfx/splunk-otel-js-web/pull/1065)
    - fix: add missing SplunkOtelWebConfig and SplunkOtelWebExporterOptions types [PR description](https://github.com/signalfx/splunk-otel-js-web/pull/1077)
        - Fixes [issue 1076](https://github.com/signalfx/splunk-otel-js-web/issues/1076)
- @splunk/otel-web-session-recorder
    - fix: replace deprecated "unload" event and improve data sending on window/tab unloading [PR description](https://github.com/signalfx/splunk-otel-js-web/pull/1066)
- internal
    - Updated dependencies

## 0.20.1

- @splunk/otel-web
    - fix: error-instrumentation and null-prototype objects missing toString method [PR description](https://github.com/signalfx/splunk-otel-js-web/pull/1042)
        - Fixes [issue 1041](https://github.com/signalfx/splunk-otel-js-web/issues/1041)
    - fix: SessionBasedSampler returning error after session expires [PR description](https://github.com/signalfx/splunk-otel-js-web/pull/1048)
        - There's an error which starts happening after the session expires when using a SessionBasedSampler
        - Fixes [issue 1040](https://github.com/signalfx/splunk-otel-js-web/issues/1040)
- internal
    - Added integration tests
    - Added instructions on how to debug unit tests
    - Updated dependencies

## 0.20.0

- @splunk/otel-web
    - fix: do not extend session from discarded session replay spans
        - Session is not extended when span is discarded by session replay. Please see detailed info in [PR description](https://github.com/signalfx/splunk-otel-js-web/pull/939).
        - **There is a possibly breaking change as the `Splunk.getSessionId()` can return undefined when previous session expired and there are no new spans. The API already was typed as returning `string | undefined` hence not considered as a breaking change. See PR for explanation. ([#939](https://github.com/signalfx/splunk-otel-js-web/pull/939))**
    - internal: session management improvements
        - Session state contains now `expiresAt` field. Session is only extended/created when span is emitted. The 1-minute periodic interval is removed. Thanks to that the session start time matches the first span time and the session will not contain blank time at the beginning. ([#899](https://github.com/signalfx/splunk-otel-js-web/pull/899))
    - fix: decode correct part of the cookie
        - Cookie decode could fail if document.cookie contained unescaped characters. ([#962](https://github.com/signalfx/splunk-otel-js-web/pull/962))
    - feat: added `disableBots` config parameter ([docs](https://docs.splunk.com/observability/en/gdi/get-data-in/rum/browser/configure-rum-browser-instrumentation.html#general-settings))
        - When enabled, bots traffic will be blocked. ([#950](https://github.com/signalfx/splunk-otel-js-web/pull/950), [#959](https://github.com/signalfx/splunk-otel-js-web/pull/959))
    - feat: added `disableAutomationFrameworks` config parameter ([docs](https://docs.splunk.com/observability/en/gdi/get-data-in/rum/browser/configure-rum-browser-instrumentation.html#general-settings))
        - When enabled, automation frameworks traffic will be blocked. ([#950](https://github.com/signalfx/splunk-otel-js-web/pull/950), [#959](https://github.com/signalfx/splunk-otel-js-web/pull/959))
    - feat: added `persistence` config parameter ([docs](https://docs.splunk.com/observability/en/gdi/get-data-in/rum/browser/configure-rum-browser-instrumentation.html#general-settings))
        - The session state can now be persisted to local storage instead of cookie. ([#900](https://github.com/signalfx/splunk-otel-js-web/pull/900), [#904](https://github.com/signalfx/splunk-otel-js-web/pull/904))
    - feat: add `http.status_code` to all resources spans
        - Resource spans now contain status code. The status code is set always when browser reports it.
        - Browser does not report status code for [cross-origin resources](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming/responseStatus#value) that do not have [`crossorigin` attribute set](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/crossorigin). In such cases, status code is omitted. ([#936](https://github.com/signalfx/splunk-otel-js-web/pull/936))
    - feat: added `_experimental_longtaskNoStartSession` config parameter.
        - When enabled, `longtasks` spans will not start the new session when previous expired. They will be ignored. ([#899](https://github.com/signalfx/splunk-otel-js-web/pull/899))

- internal
    - Update dependencies, improve examples, and refactor tests

## 0.20.0-beta.4

- `@splunk/otel-web`
    - feat: add `http.status_code` to all resources spans
        - Resource spans now contain status code. The status code is set always when browser reports it.
          Browser does not report status code for [cross-origin resources](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming/responseStatus#value) that do not have [`crossorigin` attribute set](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/crossorigin).
          in such cases, status code is omitted. ([#936](https://github.com/signalfx/splunk-otel-js-web/pull/936))
    - fix: do not extend session from discarded session replay spans
        - Session is not extended when span is discarded by session replay. Please see detailed info in [PR description](https://github.com/signalfx/splunk-otel-js-web/pull/939).
        - There is a possibly breaking change as the `Splunk.getSessionId()` can return `undefined` when previous session
          expired and there are no new spans. The API already was typed as returning `string | undefined` hence not
          considered as a breaking change. See PR for explanation. ([#939](https://github.com/signalfx/splunk-otel-js-web/pull/939))

## 0.20.0-beta.3

- `@splunk/otel-web`
    - fix: rename `http.response.status_code` to `http.status_code` in documentFetch span ([#934](https://github.com/signalfx/splunk-otel-js-web/pull/934))

## 0.20.0-beta.2

- `@splunk/otel-web`
    - fix: add `http.response.status_code` to documentFetch span ([#928](https://github.com/signalfx/splunk-otel-js-web/pull/928))
- `root - internal changes`
    - chore(internal): deps bump ([#890](https://github.com/signalfx/splunk-otel-js-web/pull/890), [#915](https://github.com/signalfx/splunk-otel-js-web/pull/915), [#921](https://github.com/signalfx/splunk-otel-js-web/pull/921), [#911](https://github.com/signalfx/splunk-otel-js-web/pull/911))
    - chore(internal): update license headers to reflect new year ([#920](https://github.com/signalfx/splunk-otel-js-web/pull/920))
    - chore(internal): use playwright for e2e tests ([#887](https://github.com/signalfx/splunk-otel-js-web/pull/887))

## 0.20.0-beta.0

- `@splunk/otel-web`
    - feat: added `persistence` config parameter.
      The session state can now be persisted to local storage instead of cookie. ([#900](https://github.com/signalfx/splunk-otel-js-web/pull/900), [#904](https://github.com/signalfx/splunk-otel-js-web/pull/904))
    - feat: added `_experimental_longtaskNoStartSession` config parameter.
      When enabled, `longtasks` spans will not start the new session when previous expired.
      They will be simply ignored. ([#899](https://github.com/signalfx/splunk-otel-js-web/pull/899))
    - internal: session management improvements. Session state contains now `expiresAt` field
      and cookie age is set to 4 hours (session duration). Session is only extended/created when span
      is emitted. The 1-minute periodic interval is removed. Thanks to that the session start time matches the first
      span time and the session will not contain blank time at the beginning. ([#899](https://github.com/signalfx/splunk-otel-js-web/pull/899))

## 0.19.3

- `@splunk/otel-web-session-recorder`
    - Fix incrementing ids [#892](https://github.com/signalfx/splunk-otel-js-web/pull/892)

## 0.19.2

- `@splunk/otel-web`
    - Send `browser.instance.visibility_state` in spans ([#878](https://github.com/signalfx/splunk-otel-js-web/pull/878))
    - Send `browser.instance.id` in spans ([#878](https://github.com/signalfx/splunk-otel-js-web/pull/878))

- Internal: Update linting tooling ([#879](https://github.com/signalfx/splunk-otel-js-web/pull/879), [#882](https://github.com/signalfx/splunk-otel-js-web/pull/882), [#883](https://github.com/signalfx/splunk-otel-js-web/pull/883))
- Internal: Update `todolist` example dependencies ([#884](https://github.com/signalfx/splunk-otel-js-web/pull/884))

## 0.19.1

- `@splunk/otel-web`
    - Optionally allow all spans to count as activity ([#818](https://github.com/signalfx/splunk-otel-js-web/pull/818))
    - Protect against multiple instances running in the same context ([#819](https://github.com/signalfx/splunk-otel-js-web/pull/819))

## 0.19.0

| Open Telemetry API | Core    | Instrumentations & Contrib |
| ------------------ | ------- | -------------------------- |
| ^1.9.0             | ^1.25.1 | ^0.52.1 & compatible       |

- `@splunk/otel-web`
    - Allow broader Element, rather than HTMLELement in user interactions ([#801](https://github.com/signalfx/splunk-otel-js-web/pull/801))
    - Make webvitals metrics individually disableable/configurable ([#806](https://github.com/signalfx/splunk-otel-js-web/pull/806))

## 0.18.0

Changelog since v0.17.0:

- `@splunk/otel-web`
    - fix fetch instrumentation not handling headers array correctly ([#790](https://github.com/signalfx/splunk-otel-js-web/pull/790))
- `@splunk/otel-web-session-recorder`
    - Switch from using otlp/protobuf to otlp/json. This removes dependency on protobuf.js, allowing the library to be ran on sites where unsafe-eval is blocked via CSP and reducing the bundle size by half ([#765](https://github.com/signalfx/splunk-otel-js-web/pull/756))

## 0.18.0-beta.0

- `@splunk/otel-web-session-recorder`
    - Switch from using otlp/protobuf to otlp/json. This removes dependency on protobuf.js, allowing the library to be ran on sites where unsafe-eval is blocked via CSP and reducing the bundle size by half ([#765](https://github.com/signalfx/splunk-otel-js-web/pull/756))

## 0.17.0

| Open Telemetry API | Core    | Instrumentations & Contrib |
| ------------------ | ------- | -------------------------- |
| ^1.8.0             | ^1.23.0 | ^0.50.0 & compatible       |

Changelog since v0.16.5:

- `@splunk/otel-web`
    - remove zone.js from user-interaction instrumentation ([#719](https://github.com/signalfx/splunk-otel-js-web/pull/719))
    - Preprations for OTLP export support ([#745](https://github.com/signalfx/splunk-otel-js-web/pull/745))
- `@splunk/otel-web-session-recorder`
    - Internal changes in how data is shared with `@splunk/otel-web`
      **Note**: make sure that to use the same version of `@splunk/otel-web` and `@splunk/otel-web-session-recorder` libraries

## 0.17.0-beta.1

- Fix folders being ignored while packing for npm ([#726](https://github.com/signalfx/splunk-otel-js-web/pull/726))

## 0.17.0-beta.0

- `@splunk/otel-web`
    - remove zone.js from user-interaction instrumentation ([#719](https://github.com/signalfx/splunk-otel-js-web/pull/719))

## 0.16.5

| Open Telemetry API | Core    | Instrumentations & Contrib |
| ------------------ | ------- | -------------------------- |
| ^1.6.0             | ^1.17.0 | ^0.44.1 & compatible       |

- `@splunk/otel-web-session-recorder`
    - Update SessionRecorder type-definitions to match their use ([#684](https://github.com/signalfx/splunk-otel-js-web/pull/684))

## 0.16.4

- `@splunk/otel-web`
    - fix(socketio-instrumentation): use apply instead of call method when invoking the 'on' callback ([#652](https://github.com/signalfx/splunk-otel-js-web/pull/652))
- `@splunk/otel-web-session-recorder`
    - session recorder: add realm config option ([#646](https://github.com/signalfx/splunk-otel-js-web/pull/646))

## 0.16.3 (& 0.16.2)

| Open Telemetry API | Core    | Instrumentations & Contrib |
| ------------------ | ------- | -------------------------- |
| ^1.4.1             | ^1.15.1 | ^0.41.1 & compatible       |

- `@splunk/otel-web`
    - Filter inaccurate CORS timings in case of more precise timeOrigin ([#624](https://github.com/signalfx/splunk-otel-js-web/pull/624))
- `@splunk/otel-web-session-recorder`
    - Updated protobufjs to v7.2.4 to avoid warnings about CVE-2023-36665 ([#615](https://github.com/signalfx/splunk-otel-js-web/pull/615))

## 0.16.1

- Remove extranous time drift patches, preferring to use the ones released in otel ([#592](https://github.com/signalfx/splunk-otel-js-web/pull/592))

## 0.16.0

| Open Telemetry API | Core    | Instrumentations & Contrib |
| ------------------ | ------- | -------------------------- |
| ^1.4.1             | ^1.14.0 | ^0.40.0 & compatible       |

The following configuration options have been renamed:

| Old           | New                     |
| ------------- | ----------------------- |
| `beaconUrl`   | `beaconEndpoint`        |
| `rumAuth`     | `rumAccessToken`        |
| `app`         | `applicationName`       |
| `environment` | `deploymentEnvironment` |

While we'll keep the old keys working for near future it is recommended to change your init call to use the new keys:

```diff
SplunkRum.init({
-  beaconUrl: 'https://rum-ingest.<REALM>.observability.splunkcloud.com/v1/rum',
+  beaconEndpoint: 'https://rum-ingest.<REALM>.observability.splunkcloud.com/v1/rum',
   // Alternatively you can now use the realm option:
+  realm: '<REALM>',

-  rumAuth: 'RUM access token',
+  rumAccessToken: 'RUM access token',

-  app: 'enter-your-application-name',
+  applicationName: 'enter-your-application-name',

-  environment: 'production',
+  deploymentEnvironment: 'production',
});
```

- Renamed configuration options to match other Splunk RUM libraries & Splunk's GDI Specification
- Added `realm` config option which can be used as shorthand instead of `beaconEndpoint`

## 0.15.3

- Disable async context manager by default

## 0.15.2

- Add extra saftey check for value in async context manager ([#572](https://github.com/signalfx/splunk-otel-js-web/pull/572))

## 0.15.1 (& 0.15.0 & 0.15.0-rc.0)

Changelog since last general release:

| Open Telemetry API | Core    | Instrumentations & Contrib |
| ------------------ | ------- | -------------------------- |
| ^1.4.1             | ^1.12.0 | ^0.38.0 & compatible       |

- Compatibility with importing in node (/ apps with SSR support) ([#557](https://github.com/signalfx/splunk-otel-js-web/pull/557))
- Use XHR sender by default, increase throughput ([#537](https://github.com/signalfx/splunk-otel-js-web/pull/537))
- Add web-vitals INP ([#548](https://github.com/signalfx/splunk-otel-js-web/pull/548))
- Enable async context manager by default ([#539](https://github.com/signalfx/splunk-otel-js-web/pull/539))
- Downgrade error when init is called multiple times to warning ([#526](https://github.com/signalfx/splunk-otel-js-web/pull/526))

> 0.15.0 & 0.15.0-rc.0 were released under beta tag in npm, while 0.15.1 was released as latest version

## 0.14.0

Changelog since last general release:

| Open Telemetry API | Core   | Instrumentations & Contrib |
| ------------------ | ------ | -------------------------- |
| ^1.3.0             | ^1.8.0 | ^0.34.0 & compatible       |

- Don't count parent spans against 100 spans per component limit ([#493](https://github.com/signalfx/splunk-otel-js-web/pull/493))
- Integrate otel's performance clock drift fix ([#498](https://github.com/signalfx/splunk-otel-js-web/pull/498))
- Session recorder package

## 0.14.0-rc.5

- Session recorder:
    - Updates to data transport ([#503](https://github.com/signalfx/splunk-otel-js-web/pull/503))

## 0.14.0-rc.4

- Don't count parent spans against 100 spans per component limit ([#493](https://github.com/signalfx/splunk-otel-js-web/pull/493))
- Integrate otel's performance clock drift fix ([#498](https://github.com/signalfx/splunk-otel-js-web/pull/498))

## 0.14.0-rc.3

| Open Telemetry API | Core   | Instrumentations & Contrib |
| ------------------ | ------ | -------------------------- |
| ^1.3.0             | ^1.8.0 | ^0.34.0 & compatible       |

- Update OpenTelemetry JS packages

## 0.13.0

| Open Telemetry API | Core   | Instrumentations & Contrib |
| ------------------ | ------ | -------------------------- |
| ^1.2.0             | ^1.7.0 | ^0.33.0 & compatible       |

- Updated versioning strategy to use caret version range ([#432](https://github.com/signalfx/splunk-otel-js-web/pull/432))
  This will reduce the amount of duplicate packages in NPM installations (which would lead to larger app bundle size) and improve compatibility with otel API package version used for custom instrumentations in applications

## 0.12.3 & 0.12.2

- Fix errors caused by disabled postload instrumentation ([#433](https://github.com/signalfx/splunk-otel-js-web/pull/433))

## 0.12.1

- Add app version configuration option ([#419](https://github.com/signalfx/splunk-otel-js-web/pull/419))
- Add http method to {document,resource}Fetch spans ([#424](https://github.com/signalfx/splunk-otel-js-web/pull/424))
- Filter out invalid CORS network timings ([#422](https://github.com/signalfx/splunk-otel-js-web/pull/422))

## 0.12.0

- make SplunkPostDocLoadResourceInstrumentation aware of upstream context ([#398](https://github.com/signalfx/splunk-otel-js-web/pull/398))
- Graduate experimental APIs ([#403](https://github.com/signalfx/splunk-otel-js-web/pull/403))

## 0.11.4

- add ignoreUrls config in docload instrumentation ([#392](https://github.com/signalfx/splunk-otel-js-web/pull/392))

## 0.11.3

- Fix polyfilled fetch in IE ([#383](https://github.com/signalfx/splunk-otel-js-web/pull/383))

## 0.11.2

- Add extra check for IE compatibility in xhr instrumentation ([#380](https://github.com/signalfx/splunk-otel-js-web/pull/380))

## 0.11.1

- Hotfix: Fix event listeners throwing when useCapture = null ([#374](https://github.com/signalfx/splunk-otel-js-web/pull/374))

## 0.11.0

| Open Telemetry API | Core  | Contrib & Instrumentations |
| ------------------ | ----- | -------------------------- |
| 1.1.0              | 1.2.0 | 0.28.0                     |

## 0.10.3

| Open Telemetry API | Core  | Contrib & Instrumentations |
| ------------------ | ----- | -------------------------- |
| 1.0.4              | 1.0.1 | 0.27.0                     |

- Cleanup upstreamed patches and update OTEL components

## 0.10.2

- Socket.io client instrumentation ([#304](https://github.com/signalfx/splunk-otel-js-web/pull/304))

## 0.10.1

- Cleanup upstreamed patches & fix angular ([#291](https://github.com/signalfx/splunk-otel-js-web/pull/291))

## 0.10.0

| Open Telemetry API | Core  | Contrib & Instrumentations |
| ------------------ | ----- | -------------------------- |
| 1.0.3              | 1.0.0 | 0.26.0                     |

- Expose tracer config ([#287](https://github.com/signalfx/splunk-otel-js-web/pull/287))
- Add session based sampler ([#287](https://github.com/signalfx/splunk-otel-js-web/pull/287))

## 0.9.3

- Correct longtask span end for buffered spans ([#280](https://github.com/signalfx/splunk-otel-js-web/pull/280))
- Move span attribute setting to spanprocessor / fix stack overflow bug ([#279](https://github.com/signalfx/splunk-otel-js-web/pull/279))

## 0.9.2

- Use SplunkRumNative.getNativeSessionId when present

## 0.9.0 & 0.9.1

| Open Telemetry API | Core   | Contrib |
| ------------------ | ------ | ------- |
| 1.0.2              | 0.25.0 | 0.25.0  |

Changes:

- Update web-vitals library to 2.0.0 [#249](https://github.com/signalfx/splunk-otel-js-web/pull/249)
- Handle undefined errors more gracefully [#255](https://github.com/signalfx/splunk-otel-js-web/pull/255)

(This version was re-released as v0.9.1 due to issues during release)

## 0.8.1

Changes:

- Fix Internet Explorer compatibility
- Backport `fetch(Request)` fix
- Backport `this` in event listeners fix

## 0.8.0

| Open Telemetry API | Core   | Contrib |
| ------------------ | ------ | ------- |
| 1.0.2              | 0.24.0 | 0.24.0  |

Changes:

- Support for Splunk Synthetics [#217](https://github.com/signalfx/splunk-otel-js-web/pull/217)
- Capturing visibility events [#219](https://github.com/signalfx/splunk-otel-js-web/pull/219)
- Improve asynchronous context for hash-based routers [#224](https://github.com/signalfx/splunk-otel-js-web/pull/224)
- Support both types of quotes on server-timings header values [#231](https://github.com/signalfx/splunk-otel-js-web/pull/231)

## 0.7.1

Changes:

- Fix: Remove maximum queue size from BatchSpanProcessor [#213](https://github.com/signalfx/splunk-otel-js-web/pull/213)
- Move common attributes to resource attributes [#212](https://github.com/signalfx/splunk-otel-js-web/pull/212)

## 0.7.0

| Open Telemetry API | Core   | Contrib |
| ------------------ | ------ | ------- |
| 1.0.0              | 0.22.0 | 0.22.0  |

## 0.6.0

| Open Telemetry API | Core   | Contrib |
| ------------------ | ------ | ------- |
| 0.21.0             | 0.21.0 | 0.21.0  |

Changes:

- Upgrade OpenTelemetry packages to 0.21.0 - [See OpenTelemetry API changelog](https://github.com/open-telemetry/opentelemetry-js-api#0200-to-0210)
- New `SplunkContextManager` for limited causality support in Promise-based, React, and Vue frameworks

## 0.5.1

- Include TS types and esm in release

## 0.5.0

| Open Telemetry API | Core   | Contrib |
| ------------------ | ------ | ------- |
| 1.0.0-rc.0         | 0.19.0 | 0.16.0  |

Changes:

- `@opentelemetry/*` core packages updated to `0.19` or latest compatible versions
- Expose _experimental_-prefixed API for accessing and watching global attributes and session ID

## 0.4.3

- Added legacy build for IE

## 0.4.2

- Fixed environment setting

## 0.4.1

- Fixed TypeScript definitions

## 0.4.0

| Open Telemetry API | Core   | Contrib |
| ------------------ | ------ | ------- |
| 0.18.1             | 0.18.2 | 0.15.0  |

Changes:

- New configuration option cookieDomain. This can be used to manually set session cookie domain.
- New option `exporter.onAttributesSerializing`
- Wrap event listeners on document
- Upgrade to Otel 0.18.2

## 0.3.1

| Open Telemetry API | Core   | Contrib |
| ------------------ | ------ | ------- |
| 0.18.1             | 0.18.0 | 0.14.0  |

Changes:

- New meta version `latest` is now available from CDN, it is always updated, even if there are changes, which are not backwards-compatible
- Fix for issues in Safari 10 caused by array-like non-iterable types

## 0.3.0-rc.1

- New configuration format <https://github.com/signalfx/splunk-otel-js-web#all-configuration-options>

## 0.2.0-rc.3

- Transpile runtime to es2015 in browser build (#82)

## 0.2.0-rc.2

## 0.2.0-rc.1

- Upgrade to OTel 0.18 and convert dependencies from git submodules to NPM (#80)
- Safety check before asking for xhr headers (#77)

## earlier versions

| Open Telemetry API | Core   | Contrib |
| ------------------ | ------ | ------- |
| n/a                | 0.15.0 | 0.12.1  |
