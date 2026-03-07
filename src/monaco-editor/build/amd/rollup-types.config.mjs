/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// @ts-check

import nodeResolve from '@rollup/plugin-node-resolve';
import { join } from 'path';
import { defineConfig } from 'rollup';
import { dts } from 'rollup-plugin-dts';
import { dtsDeprecationWarning, mapModuleId } from '../shared.mjs';

/** Strip `declare global { ... }` blocks that rollup misinterprets as named exports. */
function stripDeclareGlobal() {
	return {
		name: 'strip-declare-global',
		transform(code, id) {
			if (id.endsWith('.d.ts') && code.includes('declare global')) {
				return code.replace(/declare\s+global\s*\{[^}]*\}/gs, '/* declare global stripped */');
			}
			return null;
		}
	};
}

export default defineConfig({
	input: {
		types: join(import.meta.dirname, './src/types.ts')
	},
	output: {
		dir: join(import.meta.dirname, './out'),
		format: 'es',
		preserveModules: false,
		entryFileNames: function (chunkInfo) {
			const moduleId = chunkInfo.facadeModuleId;
			if (moduleId) {
				const m = mapModuleId(moduleId, '.d.ts');
				if (m !== undefined) {
					return m;
				}
			}
			return '[name].d.ts';
		}
	},
	external: [/.*\.css/],
	plugins: [
		stripDeclareGlobal(),
		nodeResolve(),
		dts({
			compilerOptions: {
				stripInternal: true
			},
			includeExternal: ['monaco-editor-core', '@vscode/monaco-lsp-client']
		}),
		dtsDeprecationWarning()
	]
});
