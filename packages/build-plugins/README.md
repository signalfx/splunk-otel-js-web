# Splunk RUM Build Plugins

Use the `SplunkRumWebpackPlugin` to upload your application's source maps to Splunk RUM.  This enables automatic source mapping of your JavaScript errors, resulting in more readable stack traces that are easier to debug.

Current plugin support is for Webpack 5 only.

## Installation

```
npm install @splunk/rum-build-plugins --save-dev
```

## Usage

Make sure that your `webpack.config.js` is configured to generate source maps,
then add the `SplunkRumWebpackPlugin` to the list of plugins:
```js
// webpack.config.js

const { SplunkRumWebpackPlugin } = require('@splunk/rum-build-plugins');

module.exports = {
  /* ... */
  plugins: [
    new SplunkRumWebpackPlugin({
      sourceMaps: {
        realm: '<realm>',
        token: '<splunk-org-access-token>',

        // Optional: conditionally set 'disableUpload' so that file uploads
        // are only performed during your production builds on your CI pipeline
        disableUpload: '<boolean>'
      }
    })
  ]
}
```

The `token` must be an [org access token](https://docs.splunk.com/observability/en/admin/authentication/authentication-tokens/org-tokens.html)
with an authorization scope of API token (not RUM token) and `power` role.
