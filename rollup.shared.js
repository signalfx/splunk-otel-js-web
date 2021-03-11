/* eslint-disable header/header */

const { nodeResolve } = require('@rollup/plugin-node-resolve');
const { babel } = require('@rollup/plugin-babel');
const commonjs = require('@rollup/plugin-commonjs');

module.exports.babelPlugin = babel({ 
  babelHelpers: 'runtime',
  include: /node_modules/,
});

module.exports.nodeResolvePlugin = nodeResolve({
  browser: true,
  preferBuiltins: false,
});

module.exports.commonjsPlugin = commonjs({
  browser: true,
  preferBuiltins: false,
});
