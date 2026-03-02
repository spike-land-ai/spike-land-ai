import type { ICodeSession } from "@spike-land-ai/code";
import type { Code } from "../chatRoom";
import {
  applyLineEdits,
  editTools,
  executeEditCode,
  executeSearchAndReplace,
  executeUpdateCode,
} from "./tools/edit-tools";
import {
  executeDeleteFile,
  executeListFiles,
  executeReadFile,
  executeWriteFile,
  fileTools,
} from "./tools/file-tools";
import { executeFindLines, findTools } from "./tools/find-tools";
import {
  executeReadCode,
  executeReadHtml,
  executeReadSession,
  readTools,
} from "./tools/read-tools";
import type {
  CallToolResult,
  LineEdit,
  McpRequest,
  McpResponse,
  Resource,
  ResourceTemplate,
  Tool,
} from "./types";

const PROTOCOL_VERSION = "2024-11-05";
const SERVER_NAME = "spike.land-mcp-server";
const SERVER_VERSION = "1.0.1";

const RESPONSE_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export class McpHandler {
  tools: Tool[] = [...readTools, ...editTools, ...findTools, ...fileTools];

  private resourceTemplates: ResourceTemplate[] = [
    {
      uriTemplate: "codespace://{codeSpace}/code",
      name: "CodeSpace Source Code",
      description: "Current source code for a codespace session",
      mimeType: "text/plain",
    },
    {
      uriTemplate: "codespace://{codeSpace}/html",
      name: "CodeSpace HTML Output",
      description: "Current HTML rendering output for a codespace session",
      mimeType: "text/html",
    },
    {
      uriTemplate: "codespace://{codeSpace}/session",
      name: "CodeSpace Full Session",
      description: "Full session data (code, html, css) for a codespace",
      mimeType: "application/json",
    },
  ];

  constructor(private durableObject: Code) {}

  private async getSessionForCodeSpace(codeSpace: string): Promise<ICodeSession> {
    const currentSession = this.durableObject.getSession();

    if (currentSession.codeSpace !== codeSpace) {
      console.log(`Switching session from '${currentSession.codeSpace}' to '${codeSpace}'`);

      const url = new URL(`http://localhost:8787/?room=${codeSpace}`);

      await this.durableObject.initializeSession(url);

      const updatedSession = this.durableObject.getSession();
      if (updatedSession.codeSpace !== codeSpace) {
        throw new Error(`Failed to switch to codeSpace '${codeSpace}'`);
      }

      return updatedSession;
    }

    return currentSession;
  }

  private getResourcesForCodeSpace(codeSpace: string): Resource[] {
    return [
      {
        uri: `codespace://${codeSpace}/code`,
        name: `${codeSpace} - Source Code`,
        description: `Current source code for codespace '${codeSpace}'`,
        mimeType: "text/plain",
      },
      {
        uri: `codespace://${codeSpace}/html`,
        name: `${codeSpace} - HTML Output`,
        description: `Current HTML rendering for codespace '${codeSpace}'`,
        mimeType: "text/html",
      },
      {
        uri: `codespace://${codeSpace}/session`,
        name: `${codeSpace} - Full Session`,
        description: `Full session data for codespace '${codeSpace}'`,
        mimeType: "application/json",
      },
    ];
  }

  async handleRequest(request: Request, _url: URL, _path: string[]): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: RESPONSE_HEADERS });
    }

    if (request.method === "GET") {
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          result: {
            capabilities: {
              tools: { listChanged: true },
              resources: { subscribe: false, listChanged: true },
            },
            serverInfo: {
              name: SERVER_NAME,
              version: SERVER_VERSION,
            },
          },
        }),
        { headers: RESPONSE_HEADERS },
      );
    }

    if (request.method === "POST") {
      try {
        const mcpRequest: McpRequest = await request.json();
        const response = await this.handleMcpRequest(mcpRequest);
        return new Response(JSON.stringify(response), {
          headers: RESPONSE_HEADERS,
        });
      } catch (_error) {
        const errorResponse: McpResponse = {
          jsonrpc: "2.0",
          id: 0,
          error: {
            code: -32700,
            message: "Parse error",
            data: "An error occurred while processing the request",
          },
        };
        return new Response(JSON.stringify(errorResponse), {
          status: 400,
          headers: RESPONSE_HEADERS,
        });
      }
    }

    return new Response("Method not allowed", {
      status: 405,
      headers: RESPONSE_HEADERS,
    });
  }

  private async handleMcpRequest(request: McpRequest): Promise<McpResponse> {
    const { method, params, id } = request;

    try {
      switch (method) {
        case "initialize":
          return {
            jsonrpc: "2.0",
            id,
            result: {
              protocolVersion: PROTOCOL_VERSION,
              capabilities: {
                tools: { listChanged: true },
                resources: { subscribe: false, listChanged: true },
              },
              serverInfo: {
                name: SERVER_NAME,
                version: SERVER_VERSION,
              },
            },
          };

        case "tools/list":
          return {
            jsonrpc: "2.0",
            id,
            result: {
              tools: this.tools,
            },
          };

        case "tools/call": {
          if (!params?.name || typeof params.name !== "string") {
            throw new Error("Tool name is required and must be a string");
          }
          const result = await this.executeTool(
            params.name,
            (params.arguments as Record<string, unknown>) || {},
          );
          return {
            jsonrpc: "2.0",
            id,
            result,
          };
        }

        case "resources/list": {
          const currentSession = this.durableObject.getSession();
          const codeSpace = currentSession.codeSpace;
          return {
            jsonrpc: "2.0",
            id,
            result: {
              resources: this.getResourcesForCodeSpace(codeSpace),
            },
          };
        }

        case "resources/templates/list":
          return {
            jsonrpc: "2.0",
            id,
            result: {
              resourceTemplates: this.resourceTemplates,
            },
          };

        case "resources/read": {
          if (!params?.uri || typeof params.uri !== "string") {
            throw new Error("Resource URI is required and must be a string");
          }
          const resourceContents = await this.readResource(params.uri);
          return {
            jsonrpc: "2.0",
            id,
            result: {
              contents: resourceContents,
            },
          };
        }

        default:
          throw new Error(`Method ${method} not found`);
      }
    } catch (error) {
      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32603,
          message: "Internal error",
          data: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  private async readResource(
    uri: string,
  ): Promise<Array<{ uri: string; mimeType: string; text: string }>> {
    const match = uri.match(/^codespace:\/\/([^/]+)\/(.+)$/);
    if (!match) {
      throw new Error(`Invalid resource URI: ${uri}`);
    }

    const codeSpace = match[1];
    const resourceType = match[2];

    if (!codeSpace) {
      throw new Error(`Missing codeSpace in resource URI: ${uri}`);
    }

    const session = await this.getSessionForCodeSpace(codeSpace);

    switch (resourceType) {
      case "code":
        return [
          {
            uri,
            mimeType: "text/plain",
            text: session.code || "",
          },
        ];

      case "html":
        return [
          {
            uri,
            mimeType: "text/html",
            text: session.html || "",
          },
        ];

      case "session":
        return [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(
              {
                code: session.code || "",
                html: session.html || "",
                css: session.css || "",
                codeSpace,
              },
              null,
              2,
            ),
          },
        ];

      default:
        throw new Error(`Unknown resource type: ${resourceType}`);
    }
  }

  public async executeTool(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<CallToolResult> {
    const requestedCodeSpace = args.codeSpace as string;
    if (!requestedCodeSpace) {
      throw new Error(`codeSpace parameter is required for tool '${toolName}'`);
    }

    const session = await this.getSessionForCodeSpace(requestedCodeSpace);

    console.log(`MCP Tool '${toolName}' executing for codeSpace: ${requestedCodeSpace}`);

    if (!session.codeSpace) {
      throw new Error("Session codeSpace is missing. The session may not be properly initialized.");
    }

    const updateSession = async (updatedSession: ICodeSession) => {
      await this.durableObject.updateAndBroadcastSession(updatedSession);
    };

    let result: Record<string, unknown>;

    switch (toolName) {
      case "read_code":
        result = executeReadCode(session, requestedCodeSpace);
        break;

      case "read_html":
        result = executeReadHtml(session, requestedCodeSpace);
        break;

      case "read_session":
        result = executeReadSession(session, requestedCodeSpace);
        break;

      case "update_code": {
        if (!args.code || typeof args.code !== "string") {
          throw new Error("Code parameter is required and must be a string");
        }
        const origin = this.durableObject.getOrigin();
        result = await executeUpdateCode(
          session,
          requestedCodeSpace,
          args.code,
          updateSession,
          origin,
        );
        break;
      }

      case "edit_code": {
        if (!args.edits || !Array.isArray(args.edits)) {
          throw new Error("Edits parameter is required and must be an array");
        }
        const editOrigin = this.durableObject.getOrigin();
        result = await executeEditCode(
          session,
          requestedCodeSpace,
          args.edits as LineEdit[],
          updateSession,
          editOrigin,
        );
        break;
      }

      case "find_lines": {
        if (!args.pattern || typeof args.pattern !== "string") {
          throw new Error("Pattern parameter is required and must be a string");
        }
        result = executeFindLines(session, requestedCodeSpace, args.pattern, args.isRegex === true);
        break;
      }

      case "search_and_replace": {
        if (!args.search || typeof args.search !== "string") {
          throw new Error("Search parameter is required and must be a string");
        }
        if (typeof args.replace !== "string") {
          throw new Error("Replace parameter is required and must be a string");
        }
        const replaceOrigin = this.durableObject.getOrigin();
        result = await executeSearchAndReplace(
          session,
          requestedCodeSpace,
          args.search,
          args.replace,
          args.isRegex === true,
          args.global !== false,
          updateSession,
          replaceOrigin,
        );
        break;
      }

      case "list_files": {
        const files = this.durableObject.getFiles();
        result = executeListFiles(files, session.code, requestedCodeSpace);
        break;
      }

      case "read_file": {
        if (!args.path || typeof args.path !== "string") {
          throw new Error("Path parameter is required and must be a string");
        }
        const files = this.durableObject.getFiles();
        result = executeReadFile(files, session.code, requestedCodeSpace, args.path);
        break;
      }

      case "write_file": {
        if (!args.path || typeof args.path !== "string") {
          throw new Error("Path parameter is required and must be a string");
        }
        if (typeof args.content !== "string") {
          throw new Error("Content parameter is required and must be a string");
        }
        const wFiles = this.durableObject.getFiles();
        result = await executeWriteFile(
          wFiles,
          session.code,
          requestedCodeSpace,
          args.path,
          args.content,
          (p, c) => this.durableObject.setFile(p, c),
          wFiles.size,
        );
        break;
      }

      case "delete_file": {
        if (!args.path || typeof args.path !== "string") {
          throw new Error("Path parameter is required and must be a string");
        }
        const dFiles = this.durableObject.getFiles();
        result = await executeDeleteFile(dFiles, requestedCodeSpace, args.path, (p) =>
          this.durableObject.deleteFile(p),
        );
        break;
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }

    return {
      content: [
        {
          type: "text",
          text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  addTool(tool: Tool): void {
    this.tools.push(tool);
  }

  removeTool(toolName: string): boolean {
    const index = this.tools.findIndex((tool) => tool.name === toolName);
    if (index !== -1) {
      this.tools.splice(index, 1);
      return true;
    }
    return false;
  }

  getTools(): Tool[] {
    return [...this.tools];
  }

  applyLineEdits(originalCode: string, edits: LineEdit[]): { newCode: string; diff: string } {
    return applyLineEdits(originalCode, edits);
  }
}
