const fs = require('fs');
const content = fs.readFileSync('src/mcp-image-studio/cli-server.ts', 'utf8');
console.log("cli-server.ts pos 429 context:");
console.log(content.substring(400, 450));

const dbContent = fs.readFileSync('src/mcp-image-studio/db-spacetime.ts', 'utf8');
console.log("db-spacetime.ts pos 76 context:");
console.log(dbContent.substring(50, 100));
