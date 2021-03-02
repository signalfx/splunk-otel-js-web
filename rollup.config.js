/* eslint-disable header/header */

import json from '@rollup/plugin-json';
import alias from '@rollup/plugin-alias';
import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import typescript from 'rollup-plugin-typescript2';
import { terser } from 'rollup-plugin-terser';
import babel from '@rollup/plugin-babel';
const helpers = require('./rollup.helpers');

const typescriptPlugin = typescript({
  typescript: require('typescript'),
  useTsConfigDeclarationDir: true,
  clean: true,
  check: false,
  esModuleInterop: true,
});

const babelPlugin = babel({ 
  babelHelpers: 'bundled',
  exclude: /node_modules/,
});

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
      helpers.nodeToBrowser(),
      alias({
        entries: helpers.aliases,
      }),
      nodeResolve(),
      typescriptPlugin,
      babelPlugin,
      commonjs({
        include: /node_modules/,
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
      helpers.nodeToBrowser(),
      alias({
        entries: helpers.aliases,
      }),
      nodeResolve(),
      typescriptPlugin,
      babelPlugin,
      commonjs({
        include: /node_modules/,
      }),
    ],
  },
];
