/* eslint-disable header/header */

import json from '@rollup/plugin-json';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';

const {
  babelPlugin,
  nodeResolvePlugin,
} = require('./rollup.shared');

export default [
  {
    input: 'src/indexBrowser.js',
    output: {
      file: 'dist/browser/splunk-otel-web.js',
      format: 'iife',
      name: 'SplunkRum',
      sourcemap: true,
    },
    plugins: [
      json(),
      nodeResolvePlugin,
      commonjs({
        include: /node_modules/,
        sourceMap: true,
      }),
      babelPlugin,
      terser({ output: { comments: false } }),
    ],
  },
  {
    input: 'src/index.js',
    output: {
      dir: 'dist/cjs',
      format: 'cjs',
      exports: 'named',
      sourcemap: true,
    },
    external: [
      '@opentelemetry/api-metrics',
      '@opentelemetry/api',
      '@opentelemetry/core',
      '@opentelemetry/exporter-zipkin',

      // note: seems like rollup (or one of its plugins) doesn't understand that if you reach into a package, it's still
      // part of the package.
      '@opentelemetry/exporter-zipkin/build/src/transform.js',
      
      '@opentelemetry/instrumentation-document-load',
      '@opentelemetry/instrumentation-fetch',
      '@opentelemetry/instrumentation-user-interaction',
      '@opentelemetry/instrumentation-xml-http-request',
      '@opentelemetry/instrumentation',
      '@opentelemetry/semantic-conventions',
      '@opentelemetry/tracing',
      '@opentelemetry/web',
      'shimmer',
      'web-vitals',

      // note: seems like rollup (or one of its plugins) doesn't understand that if you reach into a package, it's still
      // part of the package.
      '@opentelemetry/exporter-zipkin/build/src/transform.js',
    ],
    plugins: [
      json(),
      nodeResolvePlugin,
      commonjs({
        include: /node_modules/,
        sourceMap: true,
      }),
    ],
  },
];
