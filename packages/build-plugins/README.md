# @splunk/rum-build-plugins

<p align="center">
  <strong>
    <a href="https://quickdraw.splunk.com/redirect/?product=Observability&location=github.rum.get.started&version=current">🚀 Get Started</a>
    &nbsp;&nbsp;&bull;&nbsp;&nbsp;
    <a href="https://quickdraw.splunk.com/redirect/?product=Observability&location=github.browser.rum&version=current">📖 Documentation</a>
    &nbsp;&nbsp;&bull;&nbsp;&nbsp;
    <a href="https://github.com/signalfx/splunk-otel-js-web/blob/main/CONTRIBUTING.md">🤝 Contributing</a>
  </strong>
</p>

<p align="center">
  <a href="https://github.com/signalfx/splunk-otel-js-web/releases">
    <img alt="Latest GitHub release version" src="https://img.shields.io/github/v/release/signalfx/splunk-otel-js-web?include_prereleases&style=for-the-badge">
  </a>
  <a href="https://www.npmjs.com/package/@splunk/rum-build-plugins">
    <img alt="npm package version" src="https://img.shields.io/npm/v/@splunk/rum-build-plugins?style=for-the-badge">
  </a>
  <a href="https://bundlephobia.com/package/@splunk/rum-build-plugins">
    <img alt="Bundle size" src="https://img.shields.io/bundlephobia/minzip/@splunk/rum-build-plugins?style=for-the-badge">
  </a>
</p>

---

**Automated source map uploads for enhanced error debugging.** The Splunk RUM Build Plugins package provides seamless integration with popular build tools to automatically upload source maps to Splunk Observability Cloud, enabling readable stack traces and enhanced error debugging for production applications.

## 🚀 Installation

```bash
npm install @splunk/rum-build-plugins --save-dev
# or
pnpm add @splunk/rum-build-plugins --save-dev
# or
yarn add @splunk/rum-build-plugins --dev
```

## ⚡ Quick Start

### Webpack Integration

```javascript
// webpack.config.js
const { SplunkRumWebpackPlugin } = require('@splunk/rum-build-plugins')

module.exports = {
	// Source maps are required for upload
	devtool: 'source-map',

	plugins: [
		new SplunkRumWebpackPlugin({
			sourceMaps: {
				realm: 'us1',
				token: process.env.SPLUNK_ORG_ACCESS_TOKEN,

				// Conditional upload (recommended)
				disableUpload: process.env.NODE_ENV !== 'production',
			},
		}),
	],
}
```

### Environment Setup

```bash
# Set your organization access token
export SPLUNK_ORG_ACCESS_TOKEN="your-org-access-token-here"

# Build your application
npm run build
```

## 📜 License

Licensed under the Apache License, Version 2.0. See [LICENSE](./LICENSE) for the full license text.

---
