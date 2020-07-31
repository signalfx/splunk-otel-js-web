const TerserPlugin = require('terser-webpack-plugin');
const path = require('path');
const aliases = require('./webpack.alias.js');

module.exports = {
  entry: './src/main.js',
  mode: 'production',
  resolve: {
    alias: aliases,
  },
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        extractComments: true,
      }),
    ]
  },
  output: {
    filename: 'splunk-rum.js',
    path: path.resolve(__dirname, 'dist'),
  },
};
