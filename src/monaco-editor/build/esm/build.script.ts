import path = require('path');
import { run } from '../../scripts/lib/index';

export async function buildESM() {
	const rootPath = __dirname;
	await run(`npx rollup -c ${path.join(rootPath, 'rollup.config.mjs')}`, { cwd: rootPath });
	await run(`npx rollup -c ${path.join(rootPath, 'rollup-types.config.mjs')}`, { cwd: rootPath });
}
