const path = require('path');
const { getBaseConfig } = require('./webpack-utils');

module.exports = {
	...getBaseConfig(__filename),
	devtool: 'source-map'
};
