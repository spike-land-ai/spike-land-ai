export default {
  "*.{ts,tsx,js,jsx,mjs,cjs,json,jsonc,css,md,mdx,yaml,yml,toml}": ["dprint fmt --"],
  "*.{ts,tsx,js,jsx,mjs,cjs}": ["eslint --no-warn-ignored --cache --cache-location .eslintcache"],
};
