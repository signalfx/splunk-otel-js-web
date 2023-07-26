/* eslint-disable header/header */

import json from '@rollup/plugin-json';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';

import {
  babelPlugin,
  nodeResolvePlugin,
} from '../../rollup.shared.mjs';

export default [
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/artifacts/splunk-otel-web-session-recorder.js',
      format: 'iife',
      name: 'SplunkSessionRecorder',
      sourcemap: true,
    },
    plugins: [
      json(),
      nodeResolvePlugin,
      commonjs({
        include: /node_modules/,
        sourceMap: true,
        transformMixedEsModules: true,
      }),
      typescript({ tsconfig: './tsconfig.base.json' }),
      babelPlugin,
      terser({ output: { comments: false } }),
    ],
    context: 'window',
  },
];
