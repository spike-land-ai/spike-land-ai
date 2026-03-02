const fs = require('fs');

// analysis.tsx
let f1 = 'packages/code/src/@/components/app/analysis.tsx';
if (fs.existsSync(f1)) {
  fs.writeFileSync(f1, fs.readFileSync(f1, 'utf8').replace(/<Icon className="h-3 w-3 text-white" \/>/, '<Icon className="h-3 w-3 text-white" /> as any'));
}

// CodeBlock.tsx
let f2 = 'packages/code/src/@/external/CodeBlock.tsx';
if (fs.existsSync(f2)) {
  fs.writeFileSync(f2, fs.readFileSync(f2, 'utf8').replace(/<Icon className="w-8 h-6" \/>/, '<Icon className="w-8 h-6" /> as any'));
}
