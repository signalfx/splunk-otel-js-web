/**
 *
 * Copyright 2020-2025 Splunk Inc.
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
import json from '@rollup/plugin-json'
import commonjs from '@rollup/plugin-commonjs'
import terser from '@rollup/plugin-terser'
import typescript from '@rollup/plugin-typescript'

import { babelPlugin, nodeResolvePlugin } from '../../rollup.shared.mjs'

export default [
	{
		input: 'src/index.ts',
		output: {
			file: 'dist/artifacts/splunk-otel-web-session-recorder.js',
			format: 'iife',
			name: 'SplunkSessionRecorder',
			sourcemap: true,
		},
		plugins: [
			json(),
			nodeResolvePlugin,
			commonjs({
				include: /node_modules/,
				sourceMap: true,
				transformMixedEsModules: true,
			}),
			typescript({ tsconfig: './tsconfig.base.json' }),
			babelPlugin,
			terser({ output: { comments: false } }),
		],
		context: 'window',
	},
]
