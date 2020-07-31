const path = require('path');
const aliases = require('./webpack.alias.js');

module.exports = {
  entry: './src/main.js',
  // don't mess with source maps, etc.; just don't minimize the code
  mode: 'production',
  resolve: {
    alias: aliases,
  },
  optimization: {
    minimize: false,
  },
  output: {
    filename: 'splunk-rum.debug.js',
    path: path.resolve(__dirname, 'dist'),
  },
};
