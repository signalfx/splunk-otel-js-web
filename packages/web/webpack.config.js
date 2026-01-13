/**
 *
 * Copyright 2020-2026 Splunk Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
const path = require('node:path')

const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin')
const TerserPlugin = require('terser-webpack-plugin')

const artifactsPath = path.resolve(__dirname, './dist/artifacts')

const isDevelopmentMode = (argv) => argv.mode === 'development'

const sourceMapRule = {
	enforce: 'pre',
	test: /\.js$/,
	use: ['source-map-loader'],
}

const makeTsCheckerPlugin = (configFile) =>
	new ForkTsCheckerWebpackPlugin({
		typescript: {
			configFile,
			diagnosticOptions: { semantic: true, syntactic: true },
		},
	})

const makeBrowserModuleRules = () => [
	{
		exclude: (filePath) => {
			const normalizedPath = filePath.replaceAll('\\', '/')
			return normalizedPath.includes('node_modules')
		},
		test: /\.(ts|js)$/,
		use: [
			{
				loader: 'swc-loader',
				options: {
					env: {
						coreJs: '3.45.1',
						mode: 'usage',
						targets: ['defaults', 'chrome >= 71', 'firefox >= 65', 'safari >= 12.1'],
					},
					jsc: {
						externalHelpers: true,
						parser: {
							syntax: 'typescript',
						},
					},
				},
			},
		],
	},
	sourceMapRule,
]

const makeLibModuleRules = (moduleType) => [
	{
		exclude: /node_modules/,
		test: /\.ts$/,
		use: [
			{
				loader: 'swc-loader',
				options: {
					jsc: {
						externalHelpers: true,
						parser: {
							syntax: 'typescript',
						},
						target: 'es2020',
						transform: {
							useDefineForClassFields: false,
						},
					},
					module: {
						type: moduleType,
					},
				},
			},
		],
	},
	sourceMapRule,
]

const getBaseConfig = (env, argv) => ({
	devtool: isDevelopmentMode(argv) ? 'inline-source-map' : 'source-map',
	experiments: {
		buildHttp: {
			allowedUris: ['https://cdn.signalfx.com/'],
			cacheLocation: false,
			frozen: true,
		},
	},
	optimization: {
		minimize: true,
		minimizer: [
			new TerserPlugin({
				extractComments: false,
				terserOptions: {
					ecma: 6,
					format: {
						comments: false,
					},
				},
			}),
		],
	},
	output: {
		crossOriginLoading: 'anonymous',
		environment: {
			// without this line, webpack would wrap our code to an arrow function
			arrowFunction: false,
			bigIntLiteral: false,
			const: false,
			destructuring: false,
			dynamicImport: false,
			forOf: false,
			module: false,
		},
		iife: true,
		path: artifactsPath,
	},
	resolve: {
		extensionAlias: {
			'.js': ['.ts', '.js'],
		},
		extensions: ['.ts', '.js', '.json'],
	},
})

const browserConfig = (env, argv) => {
	const baseConfig = getBaseConfig(env, argv)
	return {
		...baseConfig,
		entry: path.resolve(__dirname, './src/index-browser.ts'),
		module: {
			rules: makeBrowserModuleRules(),
		},
		output: {
			...baseConfig.output,
			chunkFilename: '[name].min.js',
			filename: 'splunk-otel-web.js',
			library: {
				export: 'default',
				name: 'SplunkRum',
				type: 'window',
			},
		},
		plugins: [makeTsCheckerPlugin('tsconfig.base.json')],
	}
}

const otelApiGlobalsConfig = (env, argv) => {
	const baseConfig = getBaseConfig(env, argv)
	return {
		...baseConfig,
		entry: path.resolve(__dirname, './src/otel-api-globals.ts'),
		module: {
			rules: makeBrowserModuleRules(),
		},
		output: {
			...baseConfig.output,
			filename: 'otel-api-globals.js',
			library: {
				name: 'OtelApiGlobals',
				type: 'window',
			},
		},
		plugins: [makeTsCheckerPlugin('tsconfig.base.json')],
	}
}

const makeLibConfig = (env, argv, { moduleType, outDir, outputModule, tsconfigFile }) => {
	const baseConfig = getBaseConfig(env, argv)
	return {
		...baseConfig,
		entry: path.resolve(__dirname, './src/index.ts'),
		experiments: outputModule ? { ...baseConfig.experiments, outputModule: true } : baseConfig.experiments,
		module: {
			rules: makeLibModuleRules(moduleType),
		},
		output: {
			clean: !isDevelopmentMode(argv),
			filename: 'index.js',
			library: {
				type: outputModule ? 'module' : 'commonjs2',
			},
			path: path.resolve(__dirname, outDir),
		},
		plugins: [makeTsCheckerPlugin(tsconfigFile)],
	}
}

const cjsConfig = (env, argv) =>
	makeLibConfig(env, argv, {
		moduleType: 'commonjs',
		outDir: './dist/cjs',
		outputModule: false,
		tsconfigFile: 'tsconfig.cjs.json',
	})

const esmConfig = (env, argv) =>
	makeLibConfig(env, argv, {
		moduleType: 'es6',
		outDir: './dist/esm',
		outputModule: true,
		tsconfigFile: 'tsconfig.esm.json',
	})

module.exports = [browserConfig, otelApiGlobalsConfig, cjsConfig, esmConfig]
