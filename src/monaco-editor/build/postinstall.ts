/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import cp = require('child_process');
import path = require('path');

function huskyInstall() {
	// Skip husky install in CI environments
	if (process.env.CI) {
		console.log('Skipping husky install in CI environment');
		return;
	}

	console.log(`Installing husky hooks...`);
	console.log(`$ husky`);
	const result = cp.spawnSync(
		process.execPath,
		[path.join(__dirname, '../node_modules/husky/bin.js')],
		{ stdio: 'inherit' }
	);

	if (result.error || result.status !== 0) {
		process.exit(1);
	}
}

huskyInstall();
