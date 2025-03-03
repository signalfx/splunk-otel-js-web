# Splunk Web Build Plugins

> :construction: This project is currently **UNDER DEVELOPMENT**.

## Usage

```js
// webpack.config.js

const { SplunkRumWebpackPlugin } = require('@splunk/olly-web-build-plugins');

module.exports = {
  /* ... */
  plugins: [
    new SplunkRumWebpackPlugin({
      sourceMaps: {
        realm: 'us0',
        token: process.env.SPLUNK_API_TOKEN,
      }
    })
  ]
}
```
