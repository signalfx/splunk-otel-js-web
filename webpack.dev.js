const path = require('path');

module.exports = {
  entry: './src/main.js',
  mode: 'development',
  optimization: {
    minimize: false,
  },
  output: {
    filename: 'splunk-rum.debug.js',
    path: path.resolve(__dirname, 'dist'),
  },
};
