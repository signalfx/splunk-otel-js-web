const path = require('path');

// Yes, this is cumbersome.  But, it's tractable and makes the submodule/latest-upstream-code approach possible
module.exports = {
	'@opentelemetry/api': path.resolve(__dirname, 'deps/opentelemetry-js/packages/opentelemetry-api/build/src/index.js'),
	'@opentelemetry/web': path.resolve(__dirname, 'deps/opentelemetry-js/packages/opentelemetry-web/build/src/index.js'),
	'@opentelemetry/core': path.resolve(__dirname, 'deps/opentelemetry-js/packages/opentelemetry-core/build/src/index.js'),
	'@opentelemetry/tracing': path.resolve(__dirname, 'deps/opentelemetry-js/packages/opentelemetry-tracing/build/src/index.js'),
	'@opentelemetry/context-base': path.resolve(__dirname, 'deps/opentelemetry-js/packages/opentelemetry-context-base/build/src/index.js'),
	'@opentelemetry/plugin-xml-http-request': path.resolve(__dirname, 'deps/opentelemetry-js/packages/opentelemetry-plugin-xml-http-request/build/src/index.js'),
	'@opentelemetry/plugin-fetch': path.resolve(__dirname, 'deps/opentelemetry-js/packages/opentelemetry-plugin-fetch/build/src/index.js'),
	'@opentelemetry/plugin-document-load': path.resolve(__dirname, 'deps/opentelemetry-js-contrib/plugins/web/opentelemetry-plugin-document-load/build/src/index.js'),
	'@opentelemetry/plugin-user-interaction': path.resolve(__dirname, 'deps/opentelemetry-js-contrib/plugins/web/opentelemetry-plugin-user-interaction/build/src/index.js'),
};
