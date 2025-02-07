const { ollyWebWebpackPlugin } = require('@splunk/olly-web-build-plugins')
const path = require('path');
const { getBaseConfig } = require('./webpack-utils');

module.exports = {
	...getBaseConfig(__filename),
	plugins: [
		ollyWebWebpackPlugin({
			sourceMaps: {
				applicationName: 'sample-app',
				disableUpload: true,
				realm: 'us0',
				token: '<token>',
				version: '0.1.0'
			}
		})
	]
};
