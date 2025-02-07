const path = require('path');
module.exports = {
	getBaseConfig: (configFilename) => {
		return {
			entry: {
				main: './src/index.js',
				other: './src/other-entry.js',
			},
			output: {
				filename: '[name].js',
				path: path.resolve(__dirname, 'dist/' + path.basename(configFilename).replaceAll('.', '-')),
			},
			mode: 'production'
		}
	}
}
