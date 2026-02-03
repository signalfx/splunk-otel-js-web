# Changelog

If the version of Open Telemetry is unspecified for a version, then it is the same as in the previous release.

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
-  beaconUrl: 'https://rum-ingest.<REALM>.signalfx.com/v1/rum',
+  beaconEndpoint: 'https://rum-ingest.<REALM>.signalfx.com/v1/rum',
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
