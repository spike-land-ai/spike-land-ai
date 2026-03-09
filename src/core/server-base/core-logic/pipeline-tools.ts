import type { Tool } from "@modelcontextprotocol/sdk/types.js";

export const pipelineRunTestsTool: Tool = {
  name: "pipeline_run_tests",
  description: "execute test suite, return structured results",
  inputSchema: {
    type: "object",
    properties: {
      suite: { type: "string" }
    }
  }
};

export const pipelineBuildTool: Tool = {
  name: "pipeline_build",
  description: "trigger Next.js build, stream output",
  inputSchema: {
    type: "object",
    properties: {}
  }
};

export const pipelineDeployPreviewTool: Tool = {
  name: "pipeline_deploy_preview",
  description: "deploy to Vercel preview, return URL",
  inputSchema: {
    type: "object",
    properties: {}
  }
};

export const pipelineCheckTypesTool: Tool = {
  name: "pipeline_check_types",
  description: "TypeScript type checking",
  inputSchema: {
    type: "object",
    properties: {}
  }
};

export const pipelineLintTool: Tool = {
  name: "pipeline_lint",
  description: "ESLint with file:line violations",
  inputSchema: {
    type: "object",
    properties: {}
  }
};

export const pipelineRunTool: Tool = {
  name: "pipeline_run",
  description: "execute named pipeline sequence",
  inputSchema: {
    type: "object",
    properties: {
      sequence: { type: "string" }
    },
    required: ["sequence"]
  }
};

export const pipelineTools: Tool[] = [
  pipelineRunTestsTool,
  pipelineBuildTool,
  pipelineDeployPreviewTool,
  pipelineCheckTypesTool,
  pipelineLintTool,
  pipelineRunTool
];
