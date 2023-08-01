/* eslint-disable header/header */

import { nodeResolve } from '@rollup/plugin-node-resolve';
import { babel } from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';

export const babelPlugin = babel({ 
  babelHelpers: 'runtime',
  extensions: ['.js', '.es6', '.es', 'mjs', '.ts']
});

export const nodeResolvePlugin = nodeResolve({
  browser: true,
  preferBuiltins: false,
});

export const commonjsPlugin = commonjs({
  browser: true,
  preferBuiltins: false,
  transformMixedEsModules: true,
});
