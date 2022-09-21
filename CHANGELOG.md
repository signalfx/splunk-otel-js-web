# Changelog

If the version of Open Telemetry is unspecified for a version, then it is the same as in the previous release.

## Unreleased

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
