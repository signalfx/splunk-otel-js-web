const TerserPlugin = require('terser-webpack-plugin');
const path = require('path');

module.exports = {
  entry: './src/splunk-rum.js',
  mode: 'production',
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
