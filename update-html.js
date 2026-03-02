const fs = require('fs');
let html = fs.readFileSync('packages/code/index.html', 'utf8');

if (!html.includes('class="dark"')) {
  html = html.replace('<html lang="en">', '<html lang="en" class="dark">');
  fs.writeFileSync('packages/code/index.html', html);
  console.log("Added class=dark to html");
} else {
  console.log("Already has class=dark");
}
