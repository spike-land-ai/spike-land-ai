const fs = require('fs');

let dbPath = 'src/mcp-image-studio/db-spacetime.ts';
let dbCode = fs.readFileSync(dbPath, 'utf8');
dbCode = dbCode.replace(/import \{\n    typedTables as tables,\n    typedReducers as reducers,\n    type Image as SpacetimeImage,[\s\S]*?\} from "@spike-land-ai\/spacetimedb-platform";/, `import {
    typedTables as tables,
    typedReducers as reducers,
} from "@spike-land-ai/spacetimedb-platform";
import type {
    Image as SpacetimeImage,
    EnhancementJob as SpacetimeEnhancementJob,
    Album as SpacetimeAlbum,
    AlbumImage as SpacetimeAlbumImage,
    Pipeline as SpacetimePipeline,
    GenerationJob as SpacetimeGenerationJob,
    Subject as SpacetimeSubject,
} from "@spike-land-ai/spacetimedb-platform";`);
fs.writeFileSync(dbPath, dbCode);

let cliPath = 'src/mcp-image-studio/cli-server.ts';
let cliCode = fs.readFileSync(cliPath, 'utf8');
cliCode = cliCode.replace('#!/usr/bin/env node\n', '');
fs.writeFileSync(cliPath, cliCode);

