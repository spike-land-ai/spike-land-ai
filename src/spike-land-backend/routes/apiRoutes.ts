import type { ICodeSession } from "@spike-land-ai/code";
import { computeSessionHash, sanitizeSession } from "@spike-land-ai/code";
import type { Code } from "../chatRoom";

interface CodeUpdateRequest {
  code: string;
  run?: boolean;
}

interface ValidationResult {
  valid: boolean;
  errors: Array<{ line?: number; column?: number; message: string }>;
  warnings: Array<{ line?: number; column?: number; message: string }>;
}

export class ApiRoutes {
  constructor(private code: Code) {}

  async handleApiRoute(request: Request, url: URL, path: string[]): Promise<Response> {
    // path comes in as ["api", "code"] or ["api", "run"] etc.
    const action = path[1];

    switch (action) {
      case "code":
        if (request.method === "PUT") {
          return this.handleCodePut(request, url);
        }
        if (request.method === "GET") {
          return this.handleCodeGet();
        }
        return new Response("Method not allowed", { status: 405 });

      case "run":
        if (request.method === "POST") {
          return this.handleRunPost(request, url);
        }
        return new Response("Method not allowed", { status: 405 });

      case "screenshot":
        if (request.method === "GET") {
          return this.handleScreenshotGet(url);
        }
        return new Response("Method not allowed", { status: 405 });

      case "session":
        if (request.method === "GET") {
          return this.handleSessionGet();
        }
        return new Response("Method not allowed", { status: 405 });

      case "validate":
        if (request.method === "POST") {
          return this.handleValidatePost(request);
        }
        return new Response("Method not allowed", { status: 405 });

      default:
        return new Response("Not found", { status: 404 });
    }
  }

  private async handleCodeGet(): Promise<Response> {
    const session = this.code.getSession();
    return this.jsonResponse({
      success: true,
      codeSpace: session.codeSpace,
      code: session.code,
      hash: computeSessionHash(session),
    });
  }

  private async handleCodePut(request: Request, _url: URL): Promise<Response> {
    let body: CodeUpdateRequest;
    try {
      body = (await request.json()) as CodeUpdateRequest;
    } catch {
      return this.errorResponse("Invalid JSON body", 400);
    }

    if (!body.code || typeof body.code !== "string") {
      return this.errorResponse("Missing or invalid 'code' field", 400);
    }

    const session = this.code.getSession();
    const updated: string[] = ["code"];

    let updatedSession: ICodeSession = sanitizeSession({
      ...session,
      code: body.code,
      transpiled: "",
      html: "",
      css: "",
    });

    if (body.run) {
      try {
        const transpileResult = await this.transpileCode(body.code);
        updatedSession = sanitizeSession({
          ...updatedSession,
          transpiled: transpileResult,
        });
        updated.push("transpiled");
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Transpilation failed";
        return this.errorResponse(errorMessage, 400);
      }
    }

    await this.code.updateAndBroadcastSession(updatedSession);

    return this.jsonResponse({
      success: true,
      codeSpace: session.codeSpace,
      hash: computeSessionHash(updatedSession),
      updated,
      message: body.run
        ? "Code updated and transpiled successfully"
        : "Code updated successfully. Transpilation delegated to connected clients.",
    });
  }

  private async handleRunPost(_request: Request, _url: URL): Promise<Response> {
    const session = this.code.getSession();

    if (!session.code) {
      return this.errorResponse("No code to transpile", 400);
    }

    try {
      const transpiled = await this.transpileCode(session.code);

      const updatedSession = sanitizeSession({
        ...session,
        transpiled,
        html: "",
        css: "",
      });

      await this.code.updateAndBroadcastSession(updatedSession);

      return this.jsonResponse({
        success: true,
        codeSpace: session.codeSpace,
        hash: computeSessionHash(updatedSession),
        updated: ["transpiled"],
        message: "Code transpiled successfully. HTML/CSS rendering delegated to connected clients.",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Transpilation failed";
      return this.errorResponse(errorMessage, 400);
    }
  }

  private async handleScreenshotGet(_url: URL): Promise<Response> {
    // Screenshot service has been removed - the spike-land-renderer worker is deprecated
    return this.errorResponse(
      "Screenshot service unavailable - the rendering service has been deprecated",
      503,
    );
  }

  private async handleSessionGet(): Promise<Response> {
    const session = this.code.getSession();
    return this.jsonResponse({
      success: true,
      codeSpace: session.codeSpace,
      hash: computeSessionHash(session),
      session: {
        code: session.code,
        transpiled: session.transpiled,
        html: session.html,
        css: session.css,
        codeSpace: session.codeSpace,
      },
    });
  }

  /**
   * Validate code without updating the session.
   * Returns validation errors and warnings for better agent feedback.
   */
  private async handleValidatePost(request: Request): Promise<Response> {
    let body: { code: string };
    try {
      body = (await request.json()) as { code: string };
    } catch {
      return this.errorResponse("Invalid JSON body", 400);
    }

    if (!body.code || typeof body.code !== "string") {
      return this.errorResponse("Missing or invalid 'code' field", 400);
    }

    try {
      // Attempt to transpile the code to validate it
      await this.transpileCode(body.code);

      // If transpilation succeeds, the code is valid
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      return this.jsonResponse({
        success: true,
        ...result,
      });
    } catch (error) {
      // Parse the error to extract line numbers and detailed messages
      const errorMessage = error instanceof Error ? error.message : "Transpilation failed";

      const parsedErrors = this.parseTranspileErrors(errorMessage);

      const result: ValidationResult = {
        valid: false,
        errors: parsedErrors,
        warnings: [],
      };

      return this.jsonResponse({
        success: false,
        ...result,
      });
    }
  }

  /**
   * Parse transpilation error messages to extract line numbers and structured errors.
   */
  private parseTranspileErrors(
    errorMessage: string,
  ): Array<{ line?: number; column?: number; message: string }> {
    const errors: Array<{ line?: number; column?: number; message: string }> = [];

    // Common error patterns from esbuild/typescript
    // Pattern: "ERROR: <message>" or "<filename>:<line>:<col>: error: <message>"
    const lines = errorMessage.split("\n");

    for (const line of lines) {
      // Match patterns like: "X error(s)"
      if (/^\d+ error\(s\)/.test(line.trim())) continue;

      // Match pattern: "file.tsx:10:5: error: <message>"
      const lineColMatch = line.match(/:(\d+):(\d+):\s*(error|warning)?:?\s*(.+)/i);
      if (lineColMatch) {
        errors.push({
          line: parseInt(lineColMatch[1], 10),
          column: parseInt(lineColMatch[2], 10),
          message: lineColMatch[4].trim(),
        });
        continue;
      }

      // Match pattern: "line 10: <message>"
      const lineMatch = line.match(/line\s+(\d+):\s*(.+)/i);
      if (lineMatch) {
        errors.push({
          line: parseInt(lineMatch[1], 10),
          message: lineMatch[2].trim(),
        });
        continue;
      }

      // Generic error message
      const trimmed = line.trim();
      if (trimmed && !errors.some((e) => e.message === trimmed)) {
        errors.push({ message: trimmed });
      }
    }

    // If no specific errors were parsed, return the whole message
    if (errors.length === 0 && errorMessage.trim()) {
      errors.push({ message: errorMessage.trim() });
    }

    return errors;
  }

  private async transpileCode(code: string): Promise<string> {
    const origin = this.code.getOrigin();

    const response = await fetch("https://js.spike.land", {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        TR_ORIGIN: origin,
      },
      body: code,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Transpilation failed: ${errorText}`);
    }

    return await response.text();
  }

  private jsonResponse(data: Record<string, unknown>, status = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  private errorResponse(message: string, status: number): Response {
    return this.jsonResponse(
      {
        success: false,
        error: message,
      },
      status,
    );
  }
}
