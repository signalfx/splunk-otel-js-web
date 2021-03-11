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
      babelPlugin,
      commonjs({
        include: /node_modules/,
        sourceMap: true,
      }),
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
    plugins: [
      json(),
      nodeResolvePlugin,
      babelPlugin,
      commonjs({
        include: /node_modules/,
        sourceMap: true,
      }),
    ],
  },
];
