import json from '@rollup/plugin-json';
import alias from '@rollup/plugin-alias';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import typescript from 'rollup-plugin-typescript2';
import { terser } from 'rollup-plugin-terser';
const helpers = require('./rollup.helpers');

export default {
  input: 'src/main.js',
  output: {
    file: 'dist/splunk-rum.js',
    format: 'iife'
  },
  plugins: [
    json(),
    helpers.nodeToBrowser(),
    alias({
      entries: helpers.aliases,
    }),
    typescript({
      typescript: require('typescript'),
      useTsConfigDeclarationDir: true,
      clean: true,
      check: false,
    }),
    resolve({
      browser: true,
    }),
    commonjs({
      include: /node_modules/,
    }),
    terser({
      output: { comments: false, },
    }),
  ],
};
