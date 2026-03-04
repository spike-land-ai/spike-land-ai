const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/spike-land-mcp/mcp/manifest.ts');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  /try \{ ([a-zA-Z0-9_]+)\(registry, userId, db, env\?\.kv, env\?\.vaultSecret\); \} catch \(err\) \{/g,
  'try { ($1 as any)(registry, userId, db, env?.kv, env?.vaultSecret); } catch (err) {'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed arguments');
