# Supported browsers

Splunk RUM Agent supports all the modern browsers. The support is available for the following browser families that embed support for `ES6` and `ResourceTiming API`:

|Browser family|Versions supported|Comments|
|---|---|---|
|Chrome & Chrome Android|51+||
|Safari & Safari iOS|10.1+|Initial page load spans are not linked with server-side spans, as Safari does not support `server-timing` header. In addition, Safari 10.1 is missing `resourceFetch` spans.|
|Firefox|36+||
|Edge|12+||
|Internet Explorer|11|Requires a different build of the Browser Agent, available [under release assets as `splunk-otel-web-legacy.js`](https://github.com/signalfx/splunk-otel-js-web/releases/latest). Due to the extra size (+40Kb) required, the IE support is not distributed in the standard bundle|
