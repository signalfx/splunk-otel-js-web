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
import headers from 'eslint-plugin-headers'
import perfectionist from 'eslint-plugin-perfectionist'
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'
import unicorn from 'eslint-plugin-unicorn'
import globals from 'globals'
import tseslint from 'typescript-eslint'

/**
 * @type {import('eslint').Linter.Config[]}
 */
const config = [
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
			perfectionist,
			unicorn,
		},
		rules: {
			'@stylistic/lines-between-class-members': ['error', 'always'],
			'@stylistic/member-delimiter-style': [
				'error',
				{
					multiline: { delimiter: 'none', requireLast: true },
					singleline: { delimiter: 'semi', requireLast: false },
				},
			],
			'@stylistic/space-before-blocks': 'error',
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
			'@typescript-eslint/no-explicit-any': 'off', // TODO: temporarily disabled
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

			'headers/header-format': [
				'error',
				{
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
					source: 'string',
				},
			],
			'no-console': 'off',
			'no-duplicate-imports': 'error',
			'no-plusplus': ['error', { allowForLoopAfterthoughts: true }],
			'padding-line-between-statements': ['error', { blankLine: 'always', next: '*', prev: 'if' }],

			'perfectionist/sort-exports': ['error', { order: 'asc', type: 'natural' }],
			'perfectionist/sort-imports': [
				'error',
				{
					groups: [
						'builtin',
						['type', 'external'],
						'internal-type',
						'internal',
						['parent-type', 'sibling-type', 'index-type'],
						['parent', 'sibling', 'index'],
						'side-effect',
						'style',
						'object',
						'unknown',
					],
					newlinesBetween: 'always',
					order: 'asc',
					type: 'alphabetical',
				},
			],

			'perfectionist/sort-named-exports': ['error', { order: 'asc', type: 'alphabetical' }],
			'perfectionist/sort-named-imports': ['error', { order: 'asc', type: 'alphabetical' }],
			'perfectionist/sort-objects': [
				'error',
				{
					order: 'asc',
					type: 'alphabetical',
				},
			],
			'prettier/prettier': 'error',
			'space-before-blocks': 'off',

			...unicorn.configs.recommended.rules,
			'unicorn/custom-error-definition': 'off',
			'unicorn/no-abusive-eslint-disable': 'off',
			'unicorn/no-array-callback-reference': 'off',
			'unicorn/no-array-for-each': 'off',
			'unicorn/no-array-reduce': 'off',
			'unicorn/no-await-expression-member': 'off',
			'unicorn/no-document-cookie': 'off',
			'unicorn/no-keyword-prefix': 'off',
			'unicorn/no-lonely-if': 'off',
			'unicorn/no-nested-ternary': 'off',
			'unicorn/no-null': 'off',
			'unicorn/no-process-exit': 'off',
			'unicorn/no-static-only-class': 'off',
			'unicorn/no-this-assignment': 'off',
			'unicorn/no-unnecessary-polyfills': 'off',
			'unicorn/prefer-dom-node-remove': 'off',
			'unicorn/prefer-dom-node-text-content': 'off',
			'unicorn/prefer-global-this': 'off',
			'unicorn/prefer-module': 'off',
			'unicorn/prefer-spread': 'off',
			'unicorn/prefer-structured-clone': 'off',
			'unicorn/prevent-abbreviations': 'off',
		},
	},

	{
		files: ['**/*.{js,jsx,mjs,cjs}'],
		...tseslint.configs.disableTypeChecked,
	},

	{
		files: [
			'scripts/*.{js,mjs,cjs}',
			'packages/web/utils/**/*.{js,mjs,cjs}',
			'packages/web/test/plugins/**/*.{js,mjs,cjs}',
			'packages/web/performance-tests/**/*.{js,mjs,cjs}',
			'packages/web/integration-tests/**/*.{js,mjs,cjs}',
			'**/*.conf.js',
			'**/*.config.js',
			'.size-limit.cjs',
			'.prettierrc.cjs',
			'packages/build-plugins/tests/project/webpack*.js',
			'packages/build-plugins/tests/build-webpack.mjs',
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
		files: ['examples/electron/**/*.ts'],
		rules: {
			'@typescript-eslint/no-require-imports': 'off',
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
			'examples/nextjs/next-env.d.ts',
			'examples/electron/.webpack/',
		],
	},
]

export default config
