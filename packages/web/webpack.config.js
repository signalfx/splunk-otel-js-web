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
const { execSync } = require('node:child_process')
const path = require('node:path')

const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin')
const TerserPlugin = require('terser-webpack-plugin')
const webpack = require('webpack')

const { DevPresetsPlugin } = require('./webpack/dev-presets-plugin')

// ── Build helpers ─────────────────────────────────────────────────────────

const getCommitHash = () => {
	try {
		return execSync('git describe --tags --always --long', { encoding: 'utf8' }).trim()
	} catch {
		return ''
	}
}

const artifactsPath = path.resolve(__dirname, './dist/artifacts')

const isDevelopmentMode = (argv) => argv.mode === 'development'

const getBoundedDelay = (value) => {
	const rawValue = Array.isArray(value) ? value[0] : value
	const delay = Number.parseInt(rawValue ?? '0', 10)
	if (Number.isNaN(delay) || delay < 0) {
		return 0
	}

	return Math.min(delay, 5000)
}

const addDevServerRoutes = (devServer) => {
	devServer.app?.get('/__splunk-rum-dev/vct-image.svg', (req, res) => {
		const delay = getBoundedDelay(req.query.delay)
		setTimeout(() => {
			res.setHeader('Cache-Control', 'no-store')
			res.setHeader('Content-Type', 'image/svg+xml')
			res.end(`
<svg xmlns="http://www.w3.org/2000/svg" width="440" height="248" viewBox="0 0 440 248">
	<rect width="440" height="248" rx="12" fill="#010409"/>
	<rect x="18" y="18" width="404" height="212" rx="10" fill="#161b22" stroke="#30363d"/>
	<circle cx="84" cy="124" r="42" fill="#3fb950"/>
	<path d="M63 125l14 14 31-34" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
	<text x="150" y="112" fill="#e6edf3" font-family="system-ui, sans-serif" font-size="28" font-weight="700">VCT test image</text>
	<text x="150" y="148" fill="#8b949e" font-family="system-ui, sans-serif" font-size="18">${delay}ms delayed response</text>
</svg>
`)
		}, delay)
	})
}

const swcEnv = {
	coreJs: '3.45.1',
	mode: 'usage',
	targets: ['defaults', 'chrome >= 71', 'firefox >= 65', 'safari >= 12.1'],
}

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
					env: swcEnv,
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
					env: swcEnv,
					jsc: {
						externalHelpers: true,
						parser: {
							syntax: 'typescript',
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
			allowedUris: ['https://cdn.observability.splunkcloud.com/'],
			cacheLocation: false,
			frozen: !isDevelopmentMode(argv),
		},
	},
	optimization: {
		minimize: !isDevelopmentMode(argv),
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
		...(isDevelopmentMode(argv) && {
			devServer: {
				devMiddleware: { writeToDisk: true },
				headers: { 'Access-Control-Allow-Origin': '*' },
				hot: true,
				liveReload: true,
				open: false,
				port: Number(process.env.DEV_SERVE_PORT) || 3030,
				setupMiddlewares: (middlewares, devServer) => {
					addDevServerRoutes(devServer)
					return middlewares
				},
				static: [
					{ directory: path.resolve(__dirname, 'dev') },
					{ directory: path.resolve(__dirname, '../session-recorder/dist/artifacts') },
				],
			},
		}),
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
		plugins: [
			makeTsCheckerPlugin('tsconfig.base.json'),
			new webpack.DefinePlugin({
				__COMMIT_HASH__: JSON.stringify(getCommitHash()),
			}),
			...(isDevelopmentMode(argv) ? [new DevPresetsPlugin({ envPath: path.resolve(__dirname, '.env') })] : []),
		],
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
