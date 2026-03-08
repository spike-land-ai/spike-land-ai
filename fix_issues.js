const fs = require('fs');
const path = require('path');

// 1. Create lib/prisma.ts
const libPrismaPath = path.join('src', 'core', 'chess', 'lib', 'prisma.ts');
fs.mkdirSync(path.dirname(libPrismaPath), { recursive: true });
fs.writeFileSync(libPrismaPath, `// Injectable prisma client — tests mock this module via vi.mock("@/lib/prisma")
export { default, type ChessTimeControl, type ChessGameStatus } from "../core-logic/prisma";
`);

// 2. Fix player-manager.ts
const pmPath = path.join('src', 'core', 'chess', 'core-logic', 'player-manager.ts');
let pmContent = fs.readFileSync(pmPath, 'utf8');
pmContent = 'import prisma from "@/lib/prisma";\n\n' + pmContent;
pmContent = pmContent.replace(/  const prisma = \(await import\("\.\/prisma"\)\)\.default;\n/g, '');
fs.writeFileSync(pmPath, pmContent);

// 3. Fix game-manager.ts
const gmPath = path.join('src', 'core', 'chess', 'core-logic', 'game-manager.ts');
let gmContent = fs.readFileSync(gmPath, 'utf8');
gmContent = gmContent.replace(
  'import { createGame, getGameState, makeMove } from "../chess-core/engine";',
  'import prisma from "@/lib/prisma";\nimport type { ChessTimeControl, ChessGameStatus } from "@/lib/prisma";\nimport { createGame, getGameState, makeMove } from "../chess-core/engine";'
);
gmContent = gmContent.replace(/  const prisma = \(await import\("\.\/prisma"\)\)\.default;\n/g, '');
gmContent = gmContent.replace(/import\("\.\/prisma"\)\.ChessTimeControl/g, 'ChessTimeControl');
gmContent = gmContent.replace(/  type ChessGameStatus = import\("\.\/prisma"\)\.ChessGameStatus;\n/g, '');
gmContent = gmContent.replace(/import\("\.\/prisma"\)\.ChessGameStatus/g, 'ChessGameStatus');
fs.writeFileSync(gmPath, gmContent);

// 4. Fix challenge-manager.ts
const cmPath = path.join('src', 'core', 'chess', 'core-logic', 'challenge-manager.ts');
let cmContent = fs.readFileSync(cmPath, 'utf8');
cmContent = 'import prisma from "@/lib/prisma";\nimport type { ChessTimeControl } from "@/lib/prisma";\n\n' + cmContent;
cmContent = cmContent.replace(/  const prisma = \(await import\("\.\/prisma"\)\)\.default;\n/g, '');
cmContent = cmContent.replace(/import\("\.\/prisma"\)\.ChessTimeControl/g, 'ChessTimeControl');
fs.writeFileSync(cmPath, cmContent);

// 5. Fix SpikeChatEmbed.test.tsx
const testPath = path.join('.tests', 'block-website', 'SpikeChatEmbed.test.tsx');
let testContent = fs.readFileSync(testPath, 'utf8');
testContent = testContent.replace(
  'vi.mock("react", () => ({',
  'vi.mock("lucide-react", () => ({\n  Loader2: () => null,\n}));\n\nvi.mock("react", () => ({'
);
fs.writeFileSync(testPath, testContent);

// 6. Fix $sessionId.tsx
const sessionPath = path.join('src', 'frontend', 'platform-frontend', 'ui', 'routes', 'learn', '$sessionId.tsx');
let sessionContent = fs.readFileSync(sessionPath, 'utf8');
const replacementLogic = `    const correctIndex = Math.floor(Math.random() * 4);
    const varOpts: [string, string, string, string] = [
      "Concept effectively applies here",
      "Contradicts the core principle",
      "Lacks direct relevance",
      "Misses important nuances"
    ];
    // Randomize the texts so they aren't identical every question
    const shuffledOpts = [...varOpts].sort(() => Math.random() - 0.5);
    const opts: [string, string, string, string] = [
      shuffledOpts[0]!,
      shuffledOpts[1]!,
      shuffledOpts[2]!,
      shuffledOpts[3]!
    ];
    if (correctIndex !== 0) {
      [opts[0], opts[correctIndex]] = [opts[correctIndex]!, opts[0]!];
    }`;

// Replacing the first occurrence
sessionContent = sessionContent.replace(
  /    const correctIndex = Math\.floor\(Math\.random\(\) \* 4\);\n    const opts: \[string, string, string, string\] = \[\n      "This accurately reflects the concept",\n      "This contradicts the concept",\n      "This is unrelated to the concept",\n      "This oversimplifies the concept",\n    \];\n    if \(correctIndex !== 0\) {\n      \[opts\[0\], opts\[correctIndex\]\] = \[opts\[correctIndex\]!, opts\[0\]!\];\n    }/,
  replacementLogic
);

// Replacing the second occurrence
sessionContent = sessionContent.replace(
  /    const correctIndex = Math\.floor\(Math\.random\(\) \* 4\);\n    const opts: \[string, string, string, string\] = \[\n      "This accurately reflects the concept",\n      "This contradicts the concept",\n      "This is unrelated to the concept",\n      "This oversimplifies the concept",\n    \];\n    if \(correctIndex !== 0\) {\n      \[opts\[0\], opts\[correctIndex\]\] = \[opts\[correctIndex\]!, opts\[0\]!\];\n    }/,
  replacementLogic
);
fs.writeFileSync(sessionPath, sessionContent);

// 7. Fix pricing.tsx
const pricingPath = path.join('src', 'frontend', 'platform-frontend', 'ui', 'routes', 'pricing.tsx');
let pricingContent = fs.readFileSync(pricingPath, 'utf8');
pricingContent = pricingContent.replace(/80\+/g, '250+');
fs.writeFileSync(pricingPath, pricingContent);

// 8. Blog 404
// Inspecting blog.ts, wait we will just print its issues to be safe or maybe we can test first.
console.log("Done");
