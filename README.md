# Splunk OpenTelemetry JavaScript for Web

<p align="center">
  <strong>
    <a href="https://quickdraw.splunk.com/redirect/?product=Observability&location=github.rum.get.started&version=current">🚀 Get Started</a>
	&bull;
	<a href="https://quickdraw.splunk.com/redirect/?product=Observability&location=github.browser.rum&version=current">📖 Documentation</a>
    &bull;
    <a href="./CONTRIBUTING.md">🤝 Contributing</a>
    &bull;
    <a href="#-troubleshooting">🛠️ Troubleshooting</a>
    &bull;
    <a href="./LICENSE">📜 License</a>
  </strong>
</p>

<p align="center">
  <a href="https://github.com/signalfx/splunk-otel-js-web/releases">
    <img alt="Latest GitHub release version" src="https://img.shields.io/github/v/release/signalfx/splunk-otel-js-web?include_prereleases&style=for-the-badge">
  </a>
  <a href="https://www.npmjs.com/package/@splunk/otel-web">
    <img alt="npm package version" src="https://img.shields.io/npm/v/@splunk/otel-web?style=for-the-badge">
  </a>
  <a href="./LICENSE">
    <img alt="Apache 2.0 License" src="https://img.shields.io/badge/license-Apache%202.0-blue.svg?style=for-the-badge">
  </a>
</p>

---

> [!IMPORTANT]
> For complete instructions for how to get started with the Splunk distribution of OpenTelemetry JavaScript for Web, see [Install the Browser RUM agent for Splunk RUM](https://quickdraw.splunk.com/redirect/?product=Observability&location=github.rum.get.started&version=current)
>
> The official Splunk documentation for this repository is [Instrument browser-based web applications for Splunk RUM](https://quickdraw.splunk.com/redirect/?product=Observability&location=github.browser.rum&version=current).

Gain insights into the issues affecting real users of your front-end browser and mobile applications with Splunk Real User Monitoring (RUM). This repository contains several packages that provide core instrumentation, session recording, and build tooling to accelerate RUM adoption.

## 📦 Packages

| Package                                                             | Description                                                                                                              | Version                                                                                                                                   | Documentation                                      |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| [`@splunk/otel-web`](./packages/web/)                               | **Core RUM Library** - Automated instrumentation for page loads, network requests, errors, Web Vitals, user interactions | [![npm](https://img.shields.io/npm/v/@splunk/otel-web)](https://www.npmjs.com/package/@splunk/otel-web)                                   | [📖 README](./packages/web/README.md)              |
| [`@splunk/otel-web-session-recorder`](./packages/session-recorder/) | **Session Replay** - Privacy-aware visual session recording with timeline correlation for synchronized debugging         | [![npm](https://img.shields.io/npm/v/@splunk/otel-web-session-recorder)](https://www.npmjs.com/package/@splunk/otel-web-session-recorder) | [📖 README](./packages/session-recorder/README.md) |
| [`@splunk/rum-build-plugins`](./packages/build-plugins/)            | **Build Integration** - Webpack plugins for automated source map uploads and enhanced debugging                          | [![npm](https://img.shields.io/npm/v/@splunk/rum-build-plugins)](https://www.npmjs.com/package/@splunk/rum-build-plugins)                 | [📖 README](./packages/build-plugins/README.md)    |

## 🚀 Quick Start

### 1. Install RUM Packages

```bash
# Using npm
npm install @splunk/otel-web @splunk/otel-web-session-recorder

# Using pnpm
pnpm add @splunk/otel-web @splunk/otel-web-session-recorder

# Using yarn
yarn add @splunk/otel-web @splunk/otel-web-session-recorder
```

### 2. Initialize RUM packages

```typescript
import { SplunkRum } from '@splunk/otel-web'

SplunkRum.init({
	realm: 'us1', // Your Splunk realm (us0, us1, eu0, etc.)
	rumAccessToken: 'YOUR_RUM_ACCESS_TOKEN',
	applicationName: 'my-app',
	deploymentEnvironment: 'production',
})

SplunkSessionRecorder.init({
	realm: 'us1',
	rumAccessToken: 'YOUR_RUM_ACCESS_TOKEN',
})
```

### 3. Configure source map upload (optional)

```bash
npm install --save-dev @splunk/rum-build-plugins
```

```javascript
// webpack.config.js
const { SplunkRumWebpackPlugin } = require('@splunk/rum-build-plugins')

module.exports = {
	devtool: 'source-map', // Required for source map upload
	plugins: [
		new SplunkRumWebpackPlugin({
			sourceMaps: {
				realm: 'us1',
				token: process.env.SPLUNK_ORG_ACCESS_TOKEN,
				disableUpload: process.env.NODE_ENV !== 'production',
			},
		}),
	],
}
```

## 📚 Documentation

- **[Getting Started Guide](https://quickdraw.splunk.com/redirect/?product=Observability&location=github.rum.get.started&version=current)** - Complete setup instructions
- **[Browser RUM Documentation](https://quickdraw.splunk.com/redirect/?product=Observability&location=github.browser.rum&version=current)** - Advanced configuration and features
- **[API Reference](./packages/web/README.md#api-reference)** - Detailed API documentation
- **[Examples](./examples/)** - Integration examples for popular frameworks

## 🔧 Development

### Prerequisites

- **[Node.js](https://nodejs.org/)**: >=22
- **[pnpm](https://pnpm.io/)**: >=10

### Setup

```bash
# Clone the repository
git clone https://github.com/signalfx/splunk-otel-js-web.git
cd splunk-otel-js-web

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Start development mode
pnpm dev
```

### Commands

| Command          | Description                    |
| ---------------- | ------------------------------ |
| `pnpm build`     | Build all packages             |
| `pnpm test`      | Run unit and integration tests |
| `pnpm test:unit` | Run unit tests only            |
| `pnpm test:e2e`  | Run end-to-end tests           |
| `pnpm lint`      | Run linting checks             |
| `pnpm lint:fix`  | Fix linting issues             |
| `pnpm dev`       | Start development watch mode   |

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details on:

- Setting up the development environment
- Code style and testing requirements
- Pull request process
- Issue reporting guidelines

## 🛠️ Troubleshooting

For troubleshooting issues with the Splunk Distribution of OpenTelemetry JS for Web, see [Troubleshoot browser instrumentation for Splunk Observability Cloud](https://quickdraw.splunk.com/redirect/?product=Observability&version=current&location=web.rum.troubleshooting) in the official documentation.

## 📜 License

Licensed under the Apache License, Version 2.0. See [LICENSE](./LICENSE) for the full license text.

---

> ℹ️&nbsp;&nbsp;SignalFx was acquired by Splunk in October 2019. See [Splunk SignalFx](https://www.splunk.com/en_us/investor-relations/acquisitions/signalfx.html) for more information.
