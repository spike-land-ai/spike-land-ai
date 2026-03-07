import path = require('path');
import { run } from '../../scripts/lib/index';

export async function buildAmdMinDev() {
	const rootPath = __dirname;
	await run(`npx vite build --mode development --config ${path.join(rootPath, 'vite.config.mjs')}`, { cwd: rootPath });
	await run(`npx vite build --config ${path.join(rootPath, 'vite.config.mjs')}`, { cwd: rootPath });
	await run(`npx rollup -c ${path.join(rootPath, 'rollup-types.config.mjs')}`, { cwd: rootPath });
}
