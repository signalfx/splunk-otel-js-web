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
import { nodeResolve } from '@rollup/plugin-node-resolve'
import { babel } from '@rollup/plugin-babel'
import commonjs from '@rollup/plugin-commonjs'

export const babelPlugin = babel({
	babelHelpers: 'runtime',
	extensions: ['.js', '.es6', '.es', 'mjs', '.ts'],
})

export const nodeResolvePlugin = nodeResolve({
	browser: true,
	preferBuiltins: false,
})

export const commonjsPlugin = commonjs({
	browser: true,
	preferBuiltins: false,
	transformMixedEsModules: true,
})
