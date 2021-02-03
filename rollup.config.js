import json from '@rollup/plugin-json';
import alias from '@rollup/plugin-alias';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import typescript from 'rollup-plugin-typescript2';
import { terser } from 'rollup-plugin-terser';
import babel from '@rollup/plugin-babel';
const helpers = require('./rollup.helpers');

export default {
  input: 'src/main.js',
  output: {
    file: process.env.DEBUG_BUILD ? 'dist/splunk-rum.debug.js' : 'dist/splunk-rum.js',
    format: 'iife'
  },
  plugins: [
    json(),
    helpers.nodeToBrowser(),
    alias({
      entries: helpers.aliases,
    }),
    resolve({
      browser: true,
    }),
    typescript({
      typescript: require('typescript'),
      useTsConfigDeclarationDir: true,
      clean: true,
      check: false,
      esModuleInterop: true,
    }),
    babel({ 
      babelHelpers: 'bundled',
      exclude: /node_modules/,
    }),
    commonjs({
      include: /node_modules/,
    }),
    process.env.DEBUG_BUILD ? {} :
    terser({
      output: { comments: false, },
      keep_fnames: false,
    }),
  ],
};
