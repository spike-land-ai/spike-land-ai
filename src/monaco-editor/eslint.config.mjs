// @ts-check
import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import globals from 'globals';

/** @type {import('eslint').Linter.Config[]} */
export default [
	// Base JS recommended rules
	js.configs.recommended,

	// TypeScript files
	{
		files: ['**/*.ts', '**/*.tsx'],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				ecmaVersion: 'latest',
				sourceType: 'module'
			},
			globals: {
				...globals.node,
				...globals.browser
			}
		},
		plugins: {
			'@typescript-eslint': tsPlugin
		},
		rules: {
			// Warn on bare `any` — use named type aliases with comments instead
			// TODO: upgrade to 'error' once remaining `as any` casts in src/ are cleaned up
			// (workers.ts globalThis casts, less.ts array casts, workerManager proxies, languageFeatures.ts)
			'@typescript-eslint/no-explicit-any': 'warn',
			// TODO: enable '@typescript-eslint/no-unnecessary-type-assertion' once typed linting
			// is configured (requires project: true + root tsconfig.json)
			// Catch unused variables (common source of bugs)
			'@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
			// Prefer `const` for variables that are never reassigned
			'prefer-const': 'warn',
			// Allow Node.js globals
			'no-undef': 'off'
		}
	},

	// JavaScript/MJS build files
	{
		files: ['**/*.mjs', '**/*.js'],
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'module',
			globals: {
				...globals.node
			}
		},
		rules: {
			'prefer-const': 'warn',
			'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
		}
	},

	// Ignore generated and vendored directories
	{
		ignores: [
			'out/**',
			'node_modules/**',
			'src/language/typescript/lib/**',
			'website/**',
			'samples/**/node_modules/**',
			'test/smoke/out/**'
		]
	}
];
