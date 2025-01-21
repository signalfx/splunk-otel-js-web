# Splunk Web Build Plugins

> :construction: This project is currently **UNDER DEVELOPMENT**.

## Usage

```js
// webpack.config.js

const { ollyWebWebpackPlugin } = require('@splunk/olly-web-build-plugins');

module.exports = {
  /* ... */
  plugins: [
    ollyWebWebpackPlugin({
      sourceMaps: {
        realm: 'us0',
        token: process.env.SPLUNK_API_TOKEN,
      }
    })
  ]
}
```
