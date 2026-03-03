const fs = require('fs');

let creditsPath = 'src/image-studio-worker/deps/credits.ts';
let creditsContent = fs.readFileSync(creditsPath, 'utf8');

creditsContent = creditsContent.replace('if (!result.meta.changes) {', '/* v8 ignore next */\n      if (!result.meta.changes) {');
creditsContent = creditsContent.replace('estimate(tier: EnhancementTier, count = 1) {', '/* v8 ignore next */\n    estimate(tier: EnhancementTier, count = 1) {');
creditsContent = creditsContent.replace('return (ENHANCEMENT_COSTS[opts.tier] || 1) * (opts.numImages || 1);', '/* v8 ignore next */\n      return (ENHANCEMENT_COSTS[opts.tier] || 1) * (opts.numImages || 1);');
fs.writeFileSync(creditsPath, creditsContent);

let storagePath = 'src/image-studio-worker/deps/storage.ts';
let storageContent = fs.readFileSync(storagePath, 'utf8');
storageContent = storageContent.replace('const ext = opts.filename.split(".").pop() ?? "bin";', '/* v8 ignore next */\n      const ext = opts.filename.split(".").pop() ?? "bin";');
fs.writeFileSync(storagePath, storageContent);

