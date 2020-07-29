const path = require('path');

module.exports = {
  entry: './src/main.js',
  // don't mess with source maps, etc.; just don't minimize the code
  mode: 'production',
  optimization: {
    minimize: false,
  },
  output: {
    filename: 'splunk-rum.debug.js',
    path: path.resolve(__dirname, 'dist'),
  },
};
