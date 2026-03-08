const fs = require('fs');
let content = fs.readFileSync('src/frontend/platform-frontend/ui/router.ts', 'utf8');

const oldRedirectRoute = `// Backwards-compat redirect: /bazdmeg → /vibe-code
const bazdmegRedirectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/bazdmeg",
  beforeLoad: () => {
    throw redirect({ to: "/vibe-code" });
  },
});`;

const newRoute = `// BAZDMEG Method Presentation
const bazdmegRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/bazdmeg",
  component: withSuspense(() => import("../../../app/bazdmeg/page"), "BazdmegPage"),
});`;

content = content.replace(oldRedirectRoute, newRoute);
content = content.replace('bazdmegRedirectRoute,', 'bazdmegRoute,');

fs.writeFileSync('src/frontend/platform-frontend/ui/router.ts', content);
