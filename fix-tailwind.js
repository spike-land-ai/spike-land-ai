const fs = require('fs');

let css = fs.readFileSync('packages/code/src/index.css', 'utf8');

// Switch the order of the imports - tailwindcss needs to be first in v4!
css = css.replace(/@import "\.\/assets\/app\.css";\n@import "tailwindcss";/g, '@import "tailwindcss";\n@import "./assets/app.css";');

fs.writeFileSync('packages/code/src/index.css', css);
console.log("Fixed tailwind imports in index.css");
