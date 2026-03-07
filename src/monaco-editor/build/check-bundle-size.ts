/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { globSync } from 'glob';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '../out/monaco-editor');
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB sanity threshold

if (!existsSync(OUTPUT_DIR)) {
	console.log(`Output directory not found: ${OUTPUT_DIR}`);
	console.log('Build has not been run yet. Skipping bundle size check.');
	process.exit(0);
}

const patterns = [
	'esm/vs/editor/editor.main.js',
	'esm/vs/editor/editor.main.d.ts',
	'esm/vs/index.js',
	'esm/vs/language/typescript/ts.worker.js',
	'esm/vs/language/css/css.worker.js',
	'esm/vs/language/html/html.worker.js',
	'esm/vs/language/json/json.worker.js',
	'min/vs/editor/editor.main.js',
	'min/vs/editor/editor.main.css'
];

interface FileEntry {
	path: string;
	size: number;
}

const files: FileEntry[] = [];

// Check explicit paths
for (const pattern of patterns) {
	const fullPath = join(OUTPUT_DIR, pattern);
	if (existsSync(fullPath)) {
		files.push({ path: pattern, size: statSync(fullPath).size });
	}
}

// Also find any worker files via glob
const workerFiles = globSync('esm/vs/**/worker.js', { cwd: OUTPUT_DIR });
for (const wf of workerFiles) {
	if (!files.some((f) => f.path === wf)) {
		const fullPath = join(OUTPUT_DIR, wf);
		files.push({ path: wf, size: statSync(fullPath).size });
	}
}

if (files.length === 0) {
	console.log('No bundle files found in output directory.');
	process.exit(0);
}

// Sort by size descending
files.sort((a, b) => b.size - a.size);

function formatSize(bytes: number): string {
	if (bytes >= 1024 * 1024) {
		return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
	}
	return `${(bytes / 1024).toFixed(2)} KB`;
}

// Print table
const maxPathLen = Math.max(...files.map((f) => f.path.length), 4);
const header = 'File'.padEnd(maxPathLen) + '  ' + 'Size'.padStart(12);
const separator = '-'.repeat(header.length);

console.log('\nBundle Size Report');
console.log(separator);
console.log(header);
console.log(separator);

let hasOversized = false;
for (const file of files) {
	const flag = file.size > MAX_FILE_SIZE_BYTES ? ' !!OVER 5MB!!' : '';
	if (file.size > MAX_FILE_SIZE_BYTES) {
		hasOversized = true;
	}
	console.log(file.path.padEnd(maxPathLen) + '  ' + formatSize(file.size).padStart(12) + flag);
}

console.log(separator);

const totalSize = files.reduce((sum, f) => sum + f.size, 0);
console.log('Total'.padEnd(maxPathLen) + '  ' + formatSize(totalSize).padStart(12));
console.log('');

if (hasOversized) {
	console.error('ERROR: One or more files exceed the 5MB sanity threshold.');
	process.exit(1);
}

console.log('All files within size limits.');
