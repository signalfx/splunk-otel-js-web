/* eslint-disable header/header */

import json from '@rollup/plugin-json';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';
import { babel } from '@rollup/plugin-babel';
import typescript from '@rollup/plugin-typescript';

const {
  babelPlugin,
  nodeResolvePlugin,
  replacePlugin,
} = require('./rollup.shared');

export default [
  {
    input: 'src/indexBrowser.ts',
    output: {
      file: 'dist/browser/splunk-otel-web.js',
      format: 'iife',
      name: 'SplunkRum',
      sourcemap: true,
    },
    plugins: [
      json(),
      replacePlugin,
      nodeResolvePlugin,
      commonjs({
        include: /node_modules/,
        sourceMap: true,
      }),
      typescript(),
      babelPlugin,
      terser({ output: { comments: false } }),
    ],
  },
  {
    input: 'src/indexBrowser.ts',
    output: {
      file: 'dist/browser/splunk-otel-web-legacy.js',
      format: 'iife',
      name: 'SplunkRum',
      sourcemap: true,
    },
    plugins: [
      json(),
      replacePlugin,
      nodeResolvePlugin,
      commonjs({
        include: /node_modules/,
        sourceMap: true,
      }),
      typescript(),
      babel({
        babelHelpers: 'runtime',
        envName: 'legacy',
        extensions: ['.js', '.es6', '.es', 'mjs', '.ts'],
        exclude: [
          /node_modules\/core-js/
        ]
      }),
      terser({
        ecma: 5,
        output: {
          comments: false
        }
      }),
    ],
  },
  {
    input: 'src/index.ts',
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
      replacePlugin,
      nodeResolvePlugin,
      commonjs({
        include: /node_modules/,
        sourceMap: true,
      }),
      typescript(),
    ],
  },
  {
    input: 'src/inlineErrorReporter.ts',
    output: {
      file: 'dist/browser/splunk-otel-web-inline.js',
      format: 'iife',
      name: '__SplunkRumInline',
      sourcemap: false,
    },
    plugins: [
      json(),
      replacePlugin,
      nodeResolvePlugin,
      commonjs({
        include: /node_modules/,
        sourceMap: false,
      }),
      typescript(),
      babelPlugin,
      terser({
        output: {
          comments: false,
        },
        compress: true,
      }),
    ],
  },
];
