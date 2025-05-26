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
import js from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import headers from 'eslint-plugin-headers'
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'

export default [
	js.configs.recommended,
	eslintPluginPrettierRecommended,
	...tseslint.configs.recommendedTypeChecked,
	{
		files: ['**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}'],
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parser: tseslint.parser,
			parserOptions: {
				ecmaVersion: 2020,
				project: true,
			},
		},
		plugins: {
			'@stylistic': stylistic,
			'@typescript-eslint': tseslint.plugin,
			headers,
		},
		rules: {
			'headers/header-format': [
				'error',
				{
					source: 'string',
					content: [
						'',
						`Copyright 2020-${new Date().getFullYear()} Splunk Inc.`,
						'',
						'Licensed under the Apache License, Version 2.0 (the "License");',
						'you may not use this file except in compliance with the License.',
						'You may obtain a copy of the License at',
						'',
						'https://www.apache.org/licenses/LICENSE-2.0',
						'',
						'Unless required by applicable law or agreed to in writing, software',
						'distributed under the License is distributed on an "AS IS" BASIS,',
						'WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.',
						'See the License for the specific language governing permissions and',
						'limitations under the License.',
						'',
					].join('\n'),
				},
			],
			'prettier/prettier': 'error',
			'@stylistic/lines-between-class-members': ['error', 'always'],
			'@stylistic/space-before-blocks': 'error',

			'@stylistic/member-delimiter-style': [
				'error',
				{
					multiline: { delimiter: 'none', requireLast: true },
					singleline: { delimiter: 'semi', requireLast: false },
				},
			],
			'@typescript-eslint/explicit-function-return-type': 'off',
			'@typescript-eslint/interface-name-prefix': 'off',
			'@typescript-eslint/member-ordering': [
				'error',
				{
					default: {
						memberTypes: [
							// Index signature
							'signature',

							// Fields
							'public-static-field',
							'protected-static-field',
							'private-static-field',

							'public-decorated-field',
							'protected-decorated-field',
							'private-decorated-field',

							'public-instance-field',
							'protected-instance-field',
							'private-instance-field',

							'public-abstract-field',
							'protected-abstract-field',

							'public-field',
							'protected-field',
							'private-field',

							'static-field',
							'instance-field',
							'abstract-field',

							'decorated-field',

							'field',

							// Constructors
							'public-constructor',
							'protected-constructor',
							'private-constructor',

							'constructor',

							// Methods
							'public-decorated-method',
							'public-static-method',
							'public-instance-method',
							'protected-decorated-method',
							'protected-static-method',
							'protected-instance-method',
							'private-decorated-method',
							'private-static-method',
							'private-instance-method',

							'public-abstract-method',
							'protected-abstract-method',

							'public-method',
							'protected-method',
							'private-method',

							'static-method',
							'instance-method',
							'abstract-method',

							'decorated-method',

							'method',
						],
						order: 'alphabetically',
					},
				},
			],
			'@typescript-eslint/naming-convention': ['error', { format: ['UPPER_CASE'], selector: ['enumMember'] }],
			'@typescript-eslint/no-base-to-string': 'off',
			'@typescript-eslint/no-empty-interface': 'off',
			'@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }],
			'@typescript-eslint/no-shadow': [
				'error',
				{
					allow: ['resolve', 'reject', 'callback', 'ctx', 'args', 'done'],
					builtinGlobals: false,
					hoist: 'all',
				},
			],
			'@typescript-eslint/no-this-alias': [
				'error',
				{
					// when we apply proxies we often need to access some variable
					// from outer scope, and we cannot really use arrow functions
					allowedNames: ['instrumentation', 'that', 'capturedThis'],
				},
			],
			'@typescript-eslint/no-explicit-any': 'off', // TODO: temporarily disabled
			'@typescript-eslint/no-unsafe-argument': 'off', // TODO: temporarily disabled
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-call': 'off',
			'@typescript-eslint/no-unsafe-enum-comparison': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
			'@typescript-eslint/no-unsafe-return': 'off',
			'@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
			'@typescript-eslint/restrict-plus-operands': 'warn',
			'@typescript-eslint/restrict-template-expressions': 'off',
			'@typescript-eslint/unbound-method': 'off',

			'arrow-body-style': ['error', 'as-needed'],
			'curly': 'error',
			'no-console': 'off',
			'no-plusplus': ['error', { allowForLoopAfterthoughts: true }],
			'padding-line-between-statements': ['error', { blankLine: 'always', next: '*', prev: 'if' }],

			'space-before-blocks': 'off',
		},
	},

	{
		files: ['**/*.{js,jsx,mjs,cjs}'],
		...tseslint.configs.disableTypeChecked,
	},

	{
		files: [
			'scripts/*.{js,mjs,cjs}',
			'packages/build-plugins/integration-test/**/*.{js,mjs,cjs}',
			'packages/web/utils/**/*.{js,mjs,cjs}',
			'packages/web/test/plugins/**/*.{js,mjs,cjs}',
			'packages/web/performance-tests/**/*.{js,mjs,cjs}',
			'packages/web/integration-tests/**/*.{js,mjs,cjs}',
			'**/*.conf.js',
			'**/*.config.js',
			'.size-limit.cjs',
			'.prettierrc.cjs',
		],
		languageOptions: {
			globals: {
				...globals.node,
			},
		},
		rules: {
			'@typescript-eslint/no-require-imports': 'off',
		},
	},
	{
		files: ['examples/todolist/src/**/*.{js,jsx}'],
		languageOptions: {
			globals: {
				process: true,
			},
		},
	},
	{
		files: ['**/*.test.ts', '**/tests/utils/**/*.ts'],
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parser: tseslint.parser,
			parserOptions: {
				ecmaVersion: 2020,
				project: 'tsconfig.eslint.json',
			},
		},
	},
	{
		files: ['scripts/**/*.ts', 'scripts/**/*.mts'],
		languageOptions: {
			globals: {
				...globals.node,
			},
			parser: tseslint.parser,
			parserOptions: {
				ecmaVersion: 2020,
				project: 'tsconfig.json',
			},
		},
	},
	{
		ignores: [
			'**/dist/',
			'**/node_modules/',
			'.git/',
			'.github/',
			'.idea',
			'.vscode/',
			'**/.next/',
			'vitest-report',
			'**/html/',
			'**/playwright-report/',
			'**/artifacts/',
		],
	},
]
