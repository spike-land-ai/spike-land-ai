const fs = require('fs');

let css = fs.readFileSync('packages/code/src/index.css', 'utf8');

const themeAdditions = `
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
  --color-card: hsl(var(--card));
  --color-card-foreground: hsl(var(--card-foreground));
  --color-popover: hsl(var(--popover));
  --color-popover-foreground: hsl(var(--popover-foreground));
  --color-primary: hsl(var(--primary));
  --color-primary-foreground: hsl(var(--primary-foreground));
  --color-secondary: hsl(var(--secondary));
  --color-secondary-foreground: hsl(var(--secondary-foreground));
  --color-muted: hsl(var(--muted));
  --color-muted-foreground: hsl(var(--muted-foreground));
  --color-accent: hsl(var(--accent));
  --color-accent-foreground: hsl(var(--accent-foreground));
  --color-destructive: hsl(var(--destructive));
  --color-destructive-foreground: hsl(var(--destructive-foreground));
  --color-border: hsl(var(--border));
  --color-input: hsl(var(--input));
  --color-ring: hsl(var(--ring));
  --radius-md: calc(var(--radius) - 2px);
  --radius-sm: calc(var(--radius) - 4px);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
`;

// Replace the existing @theme block to include the new additions.
css = css.replace(/@theme \{[\s\S]*?\}/, (match) => {
    // If it already has --color-background, just return
    if (match.includes('--color-background')) return match;
    // Strip the last bracket and append additions
    return match.replace(/}$/, themeAdditions + '\n}');
});

fs.writeFileSync('packages/code/src/index.css', css);
console.log("Updated @theme block");
