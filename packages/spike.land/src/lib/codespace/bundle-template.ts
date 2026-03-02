import { ESM_CDN } from "./constants";
import { IMPORT_MAP } from "./html-template";

export function buildBundleHtml(opts: {
  js: string;
  css: string;
  html: string;
  codeSpace: string;
}): string {
  // Sanitize inputs to prevent XSS via tag injection (same as buildEmbedHtml)
  const safeJs = (opts.js || "").replace(/<\/script/gi, "<\\/script");
  const safeCss = (opts.css || "").replace(/<\/style/gi, "<\\/style");
  const safeHtml = (opts.html || "")
    .replace(/<script/gi, "&lt;script")
    .replace(/<\/script/gi, "&lt;/script");
  const safeCodeSpace = (opts.codeSpace || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeCodeSpace} - spike.land</title>
    <script>window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = { isDisabled: true };</script>
    <link
      rel="preload"
      href="https://fonts.googleapis.com/css2?family=Roboto+Flex:opsz,wght@8..144,100..1000&display=swap"
      as="style"
    />
    <link
      href="https://fonts.googleapis.com/css2?family=Roboto+Flex:opsz,wght@8..144,100..1000&display=swap"
      rel="stylesheet"
    />

    <style type="text/tailwindcss">
    @import "tailwindcss";

    @custom-variant dark (&:where(.dark, .dark *));

    @theme inline {
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
      --color-sidebar: hsl(var(--sidebar-background));
      --color-sidebar-foreground: hsl(var(--sidebar-foreground));
      --color-sidebar-primary: hsl(var(--sidebar-primary));
      --color-sidebar-primary-foreground: hsl(var(--sidebar-primary-foreground));
      --color-sidebar-accent: hsl(var(--sidebar-accent));
      --color-sidebar-accent-foreground: hsl(var(--sidebar-accent-foreground));
      --color-sidebar-border: hsl(var(--sidebar-border));
      --color-sidebar-ring: hsl(var(--sidebar-ring));
      --radius-lg: var(--radius);
      --radius-md: calc(var(--radius) - 2px);
      --radius-sm: calc(var(--radius) - 4px);
      --animate-accordion-down: accordion-down 0.2s ease-out;
      --animate-accordion-up: accordion-up 0.2s ease-out;
      --animate-gradient-x-slow: gradient-x 30s ease infinite;
      --animate-gradient-x-normal: gradient-x 20s ease infinite;
      --animate-gradient-x-fast: gradient-x 10s ease infinite;
    }

    :root {
      --background: 0 0% 100%;
      --foreground: 222.2 84% 4.9%;
      --card: 0 0% 100%;
      --card-foreground: 222.2 84% 4.9%;
      --popover: 0 0% 100%;
      --popover-foreground: 222.2 84% 4.9%;
      --primary: 222.2 47.4% 11.2%;
      --primary-foreground: 210 40% 98%;
      --secondary: 210 40% 96.1%;
      --secondary-foreground: 222.2 47.4% 11.2%;
      --muted: 210 40% 96.1%;
      --muted-foreground: 215.4 16.3% 46.9%;
      --accent: 210 40% 96.1%;
      --accent-foreground: 222.2 47.4% 11.2%;
      --destructive: 0 84.2% 60.2%;
      --destructive-foreground: 210 40% 98%;
      --border: 214.3 31.8% 91.4%;
      --input: 214.3 31.8% 91.4%;
      --ring: 222.2 84% 4.9%;
      --radius: 0.5rem;
      --sidebar-background: 0 0% 98%;
      --sidebar-foreground: 240 5.3% 26.1%;
      --sidebar-primary: 240 5.9% 10%;
      --sidebar-primary-foreground: 0 0% 98%;
      --sidebar-accent: 240 4.8% 95.9%;
      --sidebar-accent-foreground: 240 5.9% 10%;
      --sidebar-border: 220 13% 91%;
      --sidebar-ring: 217.2 91.2% 59.8%;
    }

    @layer base {
      * {
        border-color: hsl(var(--border));
      }
      body {
        background-color: hsl(var(--background));
        color: hsl(var(--foreground));
      }
    }

    @keyframes accordion-down {
      from {
        height: 0;
      }
      to {
        height: var(--radix-accordion-content-height);
      }
    }
    @keyframes accordion-up {
      from {
        height: var(--radix-accordion-content-height);
      }
      to {
        height: 0;
      }
    }
    @keyframes gradient-x {
      0%, 100% {
        background-position: 0% 50%;
      }
      50% {
        background-position: 100% 50%;
      }
    }
    </style>

    <script type="importmap">
    ${JSON.stringify(IMPORT_MAP, null, 2)}
    </script>
    <script type="module">import "${ESM_CDN}/@tailwindcss/browser"</script>

    <style>
    ${safeCss}
    </style>
  </head>
  <body>
    <div id="embed">${safeHtml}</div>
    <script>
    (function() {
      var reported = false;
      var cs = ${JSON.stringify(opts.codeSpace)};
      function report(msg, stack) {
        if (reported) return;
        reported = true;
        try {
          parent.postMessage({
            type: "iframe-error",
            source: "spike-land-bundle",
            codeSpace: cs,
            message: String(msg),
            stack: stack || ""
          }, "*");
        } catch { /* postMessage to detached parent — expected */ }
      }
      window.onerror = function(msg, url, line, col, err) {
        report(msg, err && err.stack ? err.stack : url + ":" + line + ":" + col);
      };
      window.addEventListener("unhandledrejection", function(ev) {
        var r = ev.reason;
        report(
          r && r.message ? r.message : String(r),
          r && r.stack ? r.stack : ""
        );
      });
      var timer = setTimeout(function() {
        var el = document.getElementById("embed");
        if (el && el.children.length === 0) {
          report("Render timeout: #embed is still empty after 15s");
        }
      }, 15000);
      var el = document.getElementById("embed");
      if (el && typeof MutationObserver !== "undefined") {
        var obs = new MutationObserver(function(mutations) {
          for (var i = 0; i < mutations.length; i++) {
            if (mutations[i].addedNodes.length > 0) {
              clearTimeout(timer);
              obs.disconnect();
              return;
            }
          }
        });
        obs.observe(el, { childList: true });
      }
    })();
    </script>
    <script>${safeJs}</script>
  </body>
</html>`;
}
