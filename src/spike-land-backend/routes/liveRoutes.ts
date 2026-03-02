import { HTML, importMap, importMapReplace, md5 } from "@spike-land-ai/code";
import type { Code } from "../chatRoom";
import { AiRoutes } from "./aiRoutes";

/**
 * Sanitizes a codeSpace parameter to prevent XSS attacks.
 * Only allows alphanumeric characters, hyphens, underscores, and periods.
 */
function sanitizeCodeSpace(codeSpace: string | null): string {
  if (!codeSpace) return "empty";
  // Only allow safe characters: alphanumeric, hyphens, underscores, periods
  return codeSpace.replace(/[^a-zA-Z0-9_.-]/g, "");
}

export class LiveRoutes {
  private aiRoutes: AiRoutes;

  constructor(private code: Code) {
    this.aiRoutes = new AiRoutes(code);
  }

  /**
   * Handle /version/{N}/* routes (short path format inside Durable Object)
   * When fetchHandler delegates to DO, path is ["version", "N", ...] not ["live", "cs", "version", ...]
   */
  async handleVersionRoute(_request: Request, _url: URL, path: string[]): Promise<Response> {
    // path = ["version", "N", "embed"?]
    const versionStr = path[1];
    if (!versionStr) {
      return new Response(JSON.stringify({ error: "Version number required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const versionNumber = parseInt(versionStr);
    if (isNaN(versionNumber) || versionNumber < 1) {
      return new Response(JSON.stringify({ error: "Invalid version number" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const subRoute = path[2];

    // /version/{N} - Version info JSON
    if (!subRoute) {
      return this.handleVersionInfoRoute(versionNumber);
    }

    // /version/{N}/embed or /version/{N}/iframe - Full HTML page
    if (subRoute === "embed" || subRoute === "iframe") {
      return this.handleVersionedContentRoute(versionNumber, "embed");
    }

    // /version/{N}/index.mjs or /version/{N}/index.js - Transpiled JS
    if (subRoute === "index.mjs" || subRoute === "index.js" || subRoute === "js") {
      return this.handleVersionedContentRoute(versionNumber, "js");
    }

    // /version/{N}/index.css - CSS
    if (subRoute === "index.css") {
      return this.handleVersionedContentRoute(versionNumber, "css");
    }

    // /version/{N}/index.tsx or /version/{N}/code - Source code
    if (subRoute === "index.tsx" || subRoute === "code") {
      return this.handleVersionedContentRoute(versionNumber, "code");
    }

    // /version/{N}/html - HTML fragment
    if (subRoute === "html") {
      return this.handleVersionedContentRoute(versionNumber, "html");
    }

    return new Response("Invalid version route", { status: 404 });
  }

  /**
   * Handle /versions route (short path format inside Durable Object)
   * Delegates to the existing handleVersionsListRoute
   */
  async handleVersionsRoute(_request: Request, _url: URL, _path: string[]): Promise<Response> {
    return this.handleVersionsListRoute();
  }

  async handleLiveRoute(request: Request, url: URL, path: string[]): Promise<Response> {
    // /live/${codeSpace}/messages
    if (path[2] === "messages") {
      return this.aiRoutes.handleMessagesRoute(request, url, path);
    }

    // /live/${codeSpace}/mcp
    if (path[2] === "mcp") {
      return this.handleMcpRoute(request, url, path);
    }

    // /live/${codeSpace}/versions - List all versions
    if (path[2] === "versions") {
      return this.handleVersionsListRoute();
    }

    // /live/${codeSpace}/version/{N}/* - Versioned content
    if (path[2] === "version" && path[3]) {
      const versionNumber = parseInt(path[3]);
      if (isNaN(versionNumber) || versionNumber < 1) {
        return new Response(JSON.stringify({ error: "Invalid version number" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // /live/{codeSpace}/version/{N} - Version info JSON
      if (!path[4]) {
        return this.handleVersionInfoRoute(versionNumber);
      }

      // /live/{codeSpace}/version/{N}/embed - Full HTML page
      if (path[4] === "embed" || path[4] === "iframe") {
        return this.handleVersionedContentRoute(versionNumber, "embed");
      }

      // /live/{codeSpace}/version/{N}/index.mjs - Transpiled JS
      if (path[4] === "index.mjs" || path[4] === "index.js" || path[4] === "js") {
        return this.handleVersionedContentRoute(versionNumber, "js");
      }

      // /live/{codeSpace}/version/{N}/index.css - CSS
      if (path[4] === "index.css") {
        return this.handleVersionedContentRoute(versionNumber, "css");
      }

      // /live/{codeSpace}/version/{N}/index.tsx - Source code
      if (path[4] === "index.tsx" || path[4] === "code") {
        return this.handleVersionedContentRoute(versionNumber, "code");
      }

      // /live/{codeSpace}/version/{N}/html - HTML fragment
      if (path[4] === "html") {
        return this.handleVersionedContentRoute(versionNumber, "html");
      }

      return new Response("Invalid version route", { status: 404 });
    }

    if (path[3] === "index.tsx" && path[4]) {
      const timestamp = parseInt(path[4]);
      const savedVersion = await this.code.getState().storage.get(`savedVersion_${timestamp}`);

      if (savedVersion) {
        return new Response(savedVersion as string, {
          status: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Cross-Origin-Embedder-Policy": "require-corp",
            "Cache-Control": "no-cache",
            "Content-Type": "application/javascript; charset=UTF-8",
          },
        });
      }
    }

    return new Response("Not found", { status: 404 });
  }

  /**
   * GET /live/{codeSpace}/versions
   * Returns list of all versions with metadata
   */
  private async handleVersionsListRoute(): Promise<Response> {
    const versions = await this.code.getVersionsList();
    const versionCount = this.code.getVersionCount();

    return new Response(
      JSON.stringify({
        codeSpace: this.code.getSession().codeSpace,
        versionCount,
        versions,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-cache",
        },
      },
    );
  }

  /**
   * GET /live/{codeSpace}/version/{N}
   * Returns full version data including code
   */
  private async handleVersionInfoRoute(versionNumber: number): Promise<Response> {
    const version = await this.code.getVersion(versionNumber);

    if (!version) {
      return new Response(JSON.stringify({ error: "Version not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(version), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=31536000, immutable", // Versions are immutable
      },
    });
  }

  /**
   * Serve versioned code content (index.tsx, index.mjs, index.css, etc.)
   */
  async handleVersionedContentRoute(
    versionNumber: number,
    contentType: "code" | "js" | "css" | "html" | "embed",
  ): Promise<Response> {
    const version = await this.code.getVersion(versionNumber);

    if (!version) {
      return new Response("Version not found", { status: 404 });
    }

    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cache-Control": "public, max-age=31536000, immutable",
    };

    switch (contentType) {
      case "code":
        return new Response(version.code, {
          status: 200,
          headers: {
            ...headers,
            "Content-Type": "application/javascript; charset=UTF-8",
            content_hash: md5(version.code),
          },
        });

      case "js": {
        const replaced = importMapReplace(version.transpiled);
        return new Response(replaced, {
          status: 200,
          headers: {
            ...headers,
            "Content-Type": "application/javascript; charset=UTF-8",
            "x-typescript-types": this.code.getOrigin() + "/live/index.tsx",
            content_hash: md5(replaced),
          },
        });
      }

      case "css":
        return new Response(version.css, {
          status: 200,
          headers: {
            ...headers,
            "Content-Type": "text/css; charset=UTF-8",
            content_hash: md5(version.css),
          },
        });

      case "html":
      case "embed": {
        const { codeSpace } = this.code.getSession();
        const respText = HTML.replace("// IMPORTMAP", JSON.stringify(importMap))
          .replace(
            `<!-- Inline LINK for initial theme -->`,
            `<!-- Inline LINK for initial theme -->
              <link rel="preload" href="/live/${codeSpace}/version/${versionNumber}/index.css" as="style">
              <link rel="stylesheet" href="/live/${codeSpace}/version/${versionNumber}/index.css">
        `,
          )
          .replace('<div id="embed"></div>', `<div id="embed">${version.html}</div>`)
          .replace("/start.mjs", `/live/${codeSpace}/version/${versionNumber}/index.mjs`);

        return new Response(respText, {
          status: 200,
          headers: {
            ...headers,
            "Content-Type": "text/html; charset=UTF-8",
            content_hash: md5(respText),
          },
        });
      }

      default:
        return new Response("Invalid content type", { status: 400 });
    }
  }

  // Handles /live/${codeSpace}/mcp - This is just a legacy route that should not be used
  // The actual MCP server is available at /mcp
  private async handleMcpRoute(_request: Request, _url: URL, _path: string[]): Promise<Response> {
    // This route should not be used anymore - return an error directing to the correct endpoint
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        id: crypto.randomUUID(),
        error: {
          code: -32601,
          message: "This MCP route is deprecated. Please use POST /mcp instead",
        },
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  async handleLazyRoute(_request: Request, url: URL): Promise<Response> {
    const codeSpace = sanitizeCodeSpace(url.searchParams.get("room"));

    return new Response(
      `import { jsx as jsX } from "@emotion/react";
       import {LoadRoom} from "/live/lazy/js";
       export default ()=>jsX(LoadRoom, { room:"${codeSpace}"}) ;
       `,
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Encoding": "gzip",
          "Cross-Origin-Embedder-Policy": "require-corp",
          "Cache-Control": "no-cache",
          "Content-Type": "application/javascript; charset=UTF-8",
        },
      },
    );
  }

  async handleWrapRoute(_request: Request, url: URL): Promise<Response> {
    const codeSpace = sanitizeCodeSpace(url.searchParams.get("room"));
    const origin: string = this.code.getOrigin();

    const code = `import App from "${origin}/live/${codeSpace}/index";
    import { renderApp } from "${origin}/@/lib/render-app.mjs";
    
    window.renderedApp = renderApp({ App, rootElement: document.getElementById("embed") });

    `;

    return new Response(code, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cross-Origin-Embedder-Policy": "require-corp",
        "Cache-Control": "no-cache",
        "x-typescript-types": this.code.getOrigin() + "/live/index.tsx",
        content_hash: md5(code),
        "Content-Type": "application/javascript; charset=UTF-8",
      },
    });
  }

  async handleWrapHTMLRoute(): Promise<Response> {
    const { html, codeSpace } = this.code.getSession();

    const respText = HTML.replace("// IMPORTMAP", JSON.stringify(importMap))
      .replace(
        `<!-- Inline LINK for initial theme -->`,
        `<!-- Inline LINK for initial theme -->
              <link rel="preload" href="/live/${codeSpace}/index.css" as="style">
              <link rel="stylesheet" href="/live/${codeSpace}/index.css">
        `,
      )
      .replace('<div id="embed"></div>', `<div id="embed">${html}</div>`)
      .replace("/start.mjs", `https://js.spike.land?codeSpace=${codeSpace}`);

    return new Response(respText, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cross-Origin-Embedder-Policy": "require-corp",
        "Cache-Control": "no-cache",
        content_hash: md5(respText),
        "Content-Type": "text/html; charset=UTF-8",
      },
    });
  }

  async handleRenderToStr(_request: Request, url: URL): Promise<Response> {
    const codeSpace = sanitizeCodeSpace(url.searchParams.get("room"));
    const origin: string = this.code.getOrigin();

    const code = `import App from "${origin}/live/${codeSpace}/index";
    import { jsx } from "@emotion/react/jsx-runtime";
     import { renderToString } from "react-dom/server";
    
    const str = renderToString( /*#__PURE__*/_jsx(App, {}));
    
    globalThis.renderedStr = str;


  }
    `;

    return new Response(code, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cross-Origin-Embedder-Policy": "require-corp",
        "Cache-Control": "no-cache",
        "x-typescript-types": this.code.getOrigin() + "/live/index.tsx",
        content_hash: md5(code),
        "Content-Type": "application/javascript; charset=UTF-8",
      },
    });
  }

  async handleScreenShotRoute(_request: Request, _url: URL): Promise<Response> {
    // Screenshot service has been removed - the spike-land-renderer worker is deprecated
    return new Response(
      JSON.stringify({
        error: "Screenshot service unavailable",
        message: "The screenshot rendering service has been deprecated",
      }),
      {
        status: 503,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }
}
