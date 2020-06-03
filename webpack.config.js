const TerserPlugin = require('terser-webpack-plugin');
const path = require('path');

module.exports = {
  entry: './src/sfx-rum.js',
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
    filename: 'sfx-rum.js',
    path: path.resolve(__dirname, 'dist'),
  },
};
