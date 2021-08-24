# Changelog
If the version of Open Telemetry is unspecified for a version, then it is the same as in the previous release.

## Unreleased
- Fix Internet Explorer compatibility
- Add `skipExport` configuration option [#240](https://github.com/signalfx/splunk-otel-js-web/issues/240)

## 0.8.0

| Open Telemetry API | Core   | Contrib |
|--------------------|--------|---------|
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
|--------------------|--------|---------|
| 1.0.0             | 0.22.0 | 0.22.0  |

## 0.6.0
| Open Telemetry API | Core   | Contrib |
|--------------------|--------|---------|
| 0.21.0             | 0.21.0 | 0.21.0  |

Changes:

- Upgrade OpenTelemetry packages to 0.21.0 - [See OpenTelemetry API changelog](https://github.com/open-telemetry/opentelemetry-js-api#0200-to-0210)
- New `SplunkContextManager` for limited causality support in Promise-based, React, and Vue frameworks

## 0.5.1
- Include TS types and esm in release

## 0.5.0
| Open Telemetry API | Core   | Contrib |
|--------------------|--------|---------|
| 1.0.0-rc.0         | 0.19.0 | 0.16.0  |

Changes:

- `@opentelemetry/*` core packages updated to `0.19` or latest compatible versions
- Expose *_experimental_*-prefixed API for accessing and watching global attributes and session ID

## 0.4.3
- Added legacy build for IE

## 0.4.2
- Fixed environment setting

## 0.4.1
- Fixed TypeScript definitions

## 0.4.0
| Open Telemetry API | Core   | Contrib |
|--------------------|--------|---------|
| 0.18.1             | 0.18.2 | 0.15.0  |

Changes:

- New configuration option cookieDomain. This can be used to manually set session cookie domain.
- New option `exporter.onAttributesSerializing`
- Wrap event listeners on document
- Upgrade to Otel 0.18.2

## 0.3.1
| Open Telemetry API | Core   | Contrib |
|--------------------|--------|---------|
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
|--------------------|--------|---------|
| n/a                | 0.15.0 | 0.12.1  |
