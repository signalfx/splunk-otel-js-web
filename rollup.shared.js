/* eslint-disable header/header */

const { nodeResolve } = require('@rollup/plugin-node-resolve');
const { babel } = require('@rollup/plugin-babel');
const commonjs = require('@rollup/plugin-commonjs');
const replace = require('@rollup/plugin-replace');

module.exports.babelPlugin = babel({
  babelHelpers: 'runtime',
  extensions: ['.js', '.es6', '.es', 'mjs', '.ts']
});

module.exports.nodeResolvePlugin = nodeResolve({
  browser: true,
  preferBuiltins: false,
});

module.exports.commonjsPlugin = commonjs({
  browser: true,
  preferBuiltins: false,
});

module.exports.replacePlugin = replace({
  __SPLUNK_OTEL_WEB_BUILD_VERSION: JSON.stringify(require('./package.json').version),
});
