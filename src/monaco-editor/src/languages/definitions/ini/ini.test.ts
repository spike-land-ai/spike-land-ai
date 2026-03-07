/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { testTokenization } from '../test/testRunner';

testTokenization('ini', [
	// Section headers
	[
		{
			line: '[section]',
			tokens: [{ startIndex: 0, type: 'metatag.ini' }]
		}
	],

	[
		{
			line: '[my-section_name]',
			tokens: [{ startIndex: 0, type: 'metatag.ini' }]
		}
	],

	[
		{
			line: '[section with spaces]',
			tokens: [{ startIndex: 0, type: 'metatag.ini' }]
		}
	],

	// Key-value pairs
	[
		{
			line: 'key=value',
			tokens: [
				{ startIndex: 0, type: 'key.ini' },
				{ startIndex: 3, type: 'delimiter.ini' },
				{ startIndex: 4, type: '' }
			]
		}
	],

	[
		{
			line: 'key = value',
			tokens: [
				{ startIndex: 0, type: 'key.ini' },
				{ startIndex: 3, type: '' },
				{ startIndex: 4, type: 'delimiter.ini' },
				{ startIndex: 5, type: '' }
			]
		}
	],

	[
		{
			line: 'my_key=123',
			tokens: [
				{ startIndex: 0, type: 'key.ini' },
				{ startIndex: 6, type: 'delimiter.ini' },
				{ startIndex: 7, type: 'number.ini' }
			]
		}
	],

	// Comments with #
	[
		{
			line: '# this is a comment',
			tokens: [{ startIndex: 0, type: 'comment.ini' }]
		}
	],

	// Comments with # — indented: the whitespace rule consumes leading spaces first,
	// then the comment regex (^\\s*[#;].*$) doesn't re-match, so the rest is unrecognized.
	// Only unindented comments are reliably tokenized as 'comment.ini'.
	[
		{
			line: '  # indented comment',
			tokens: [{ startIndex: 0, type: '' }]
		}
	],

	// Comments with ;
	[
		{
			line: '; this is also a comment',
			tokens: [{ startIndex: 0, type: 'comment.ini' }]
		}
	],

	// Strings — double quoted
	[
		{
			line: 'key = "hello world"',
			tokens: [
				{ startIndex: 0, type: 'key.ini' },
				{ startIndex: 3, type: '' },
				{ startIndex: 4, type: 'delimiter.ini' },
				{ startIndex: 5, type: '' },
				{ startIndex: 6, type: 'string.ini' }
			]
		}
	],

	// Strings — single quoted
	[
		{
			line: "key = 'hello world'",
			tokens: [
				{ startIndex: 0, type: 'key.ini' },
				{ startIndex: 3, type: '' },
				{ startIndex: 4, type: 'delimiter.ini' },
				{ startIndex: 5, type: '' },
				{ startIndex: 6, type: 'string.ini' }
			]
		}
	],

	// Numbers
	[
		{
			line: 'port = 8080',
			tokens: [
				{ startIndex: 0, type: 'key.ini' },
				{ startIndex: 4, type: '' },
				{ startIndex: 5, type: 'delimiter.ini' },
				{ startIndex: 6, type: '' },
				{ startIndex: 7, type: 'number.ini' }
			]
		}
	],

	// Whitespace only
	[
		{
			line: '',
			tokens: []
		}
	],

	[
		{
			line: '   ',
			tokens: [{ startIndex: 0, type: '' }]
		}
	],

	// Full INI file example
	[
		{
			line: '[database]',
			tokens: [{ startIndex: 0, type: 'metatag.ini' }]
		},
		{
			line: 'host = localhost',
			tokens: [
				{ startIndex: 0, type: 'key.ini' },
				{ startIndex: 4, type: '' },
				{ startIndex: 5, type: 'delimiter.ini' },
				{ startIndex: 6, type: '' }
			]
		},
		{
			line: 'port = 5432',
			tokens: [
				{ startIndex: 0, type: 'key.ini' },
				{ startIndex: 4, type: '' },
				{ startIndex: 5, type: 'delimiter.ini' },
				{ startIndex: 6, type: '' },
				{ startIndex: 7, type: 'number.ini' }
			]
		},
		{
			line: '# production database',
			tokens: [{ startIndex: 0, type: 'comment.ini' }]
		}
	]
]);
