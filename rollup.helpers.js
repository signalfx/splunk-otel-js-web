const path = require('path');
const fs = require('fs');

module.exports.nodeToBrowser = function() {
  return {
    name: 'node-to-browser resolver',
    load(id) {
      if (id.includes('platform/node')) {
        const filename = id.replace('platform/node', 'platform/browser');
        return fs.readFileSync(filename, 'utf8');
      }
      return null;
    }
  };
};

module.exports.aliases = [
  { find: '@opentelemetry/api', replacement: path.resolve(__dirname, 'deps/opentelemetry-js/packages/opentelemetry-api/src/index.ts') },
  { find: '@opentelemetry/context-base', replacement: path.resolve(__dirname, 'deps/opentelemetry-js/packages/opentelemetry-context-base/src/index.ts') },
  { find: '@opentelemetry/core', replacement: path.resolve(__dirname, 'deps/opentelemetry-js/packages/opentelemetry-core/src/index.ts') },
  { find: '@opentelemetry/instrumentation-xml-http-request', replacement: path.resolve(__dirname, 'deps/opentelemetry-js/packages/opentelemetry-instrumentation-xml-http-request/src/index.ts') },
  { find: '@opentelemetry/instrumentation', replacement: path.resolve(__dirname, 'deps/opentelemetry-js/packages/opentelemetry-instrumentation/src/index.ts') },
  { find: '@opentelemetry/plugin-document-load', replacement: path.resolve(__dirname, 'deps/opentelemetry-js-contrib/plugins/web/opentelemetry-plugin-document-load/src/index.ts') },
  { find: '@opentelemetry/plugin-fetch', replacement: path.resolve(__dirname, 'deps/opentelemetry-js/packages/opentelemetry-plugin-fetch/src/index.ts') },
  { find: '@opentelemetry/plugin-user-interaction', replacement: path.resolve(__dirname, 'deps/opentelemetry-js-contrib/plugins/web/opentelemetry-plugin-user-interaction/src/index.ts') },
  { find: '@opentelemetry/resources', replacement: path.resolve(__dirname, 'deps/opentelemetry-js/packages/opentelemetry-resources/src/index.ts') },
  { find: '@opentelemetry/semantic-conventions', replacement: path.resolve(__dirname, 'deps/opentelemetry-js/packages/opentelemetry-semantic-conventions/src/index.ts') },
  { find: '@opentelemetry/tracing', replacement: path.resolve(__dirname, 'deps/opentelemetry-js/packages/opentelemetry-tracing/src/index.ts') },
  { find: '@opentelemetry/web', replacement: path.resolve(__dirname, 'deps/opentelemetry-js/packages/opentelemetry-web/src/index.ts') },
  // Reaching in and borrowing specific zipkin source rather than the whole thing
  { find: '../deps/opentelemetry-js/packages/opentelemetry-exporter-zipkin/src/transform', replacement: path.resolve(__dirname, 'deps/opentelemetry-js/packages/opentelemetry-exporter-zipkin/src/transform.ts') },
];
