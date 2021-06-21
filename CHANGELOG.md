# Changelog

## Unreleased
- Upgrade OpenTelemetry packages to 0.21.0 - [See OpenTelemetry API changelog](https://github.com/open-telemetry/opentelemetry-js-api#0200-to-0210)

## 0.5.1
- Include TS types and esm in release

## 0.5.0
- `@opentelemetry/*` core packages updated to `0.19` or latest compatible versions
- Expose *_experimental_*-prefixed API for accessing and watching global attributes and session ID

## 0.4.3
- Added legacy build for IE

## 0.4.2
- Fixed environment setting

## 0.4.1
- Fixed TypeScript definitions

## 0.4.0
- New configuration option cookieDomain. This can be used to manually set session cookie domain.
- New option `exporter.onAttributesSerializing`
- Wrap event listeners on document
- Upgrade to Otel 0.18.2

## 0.3.1
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
