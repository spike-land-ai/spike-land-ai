const { execSync } = require('child_process');
try {
  execSync('npx vitest run --project chess-engine -t "updates game status on check$"', { stdio: 'inherit' });
} catch (e) {
  // failed
}
