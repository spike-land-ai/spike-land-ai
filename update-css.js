const fs = require('fs');

let css = fs.readFileSync('packages/code/src/index.css', 'utf8');

// The original Next.js globals.css was pasted over index.css.
// But we need to make sure we also import app.css from assets since we lost it.
if (!css.includes('@import "./assets/app.css";')) {
  css = '@import "./assets/app.css";\n' + css;
}

// Write back
fs.writeFileSync('packages/code/src/index.css', css);
console.log("Updated index.css");
