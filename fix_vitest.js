const fs = require('fs');
let file = 'packages/spike.land/vitest.setup.ts';
if (fs.existsSync(file)) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/import \{ mcpMatchers \}.*\n/g, '');
  content = content.replace(/expect\.extend\(mcpMatchers\);\n/g, '');
  fs.writeFileSync(file, content);
}
