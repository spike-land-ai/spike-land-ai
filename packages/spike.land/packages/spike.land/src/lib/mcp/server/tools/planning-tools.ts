/**
 * Planning MCP Tools
 *
 * Architect tools for feature decomposition and design validation.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  jsonResult,
  safeToolCall,
} from "./tool-helpers";
import { createFilePlan, decomposeFeature } from "../../../architect/engine";
import type {
  ArchitectureDesign,
  ComponentSpec,
  FilePlanTask,
} from "../../../architect/types";

// ── Architect types & state ──

export interface MCPTool {
  name: string;
  description: string;
  schema: z.ZodObject<z.ZodRawShape>;
  handler: (args: unknown) => Promise<CallToolResult>;
}

const designs = new Map<string, ArchitectureDesign>();
const filePlans = new Map<string, FilePlanTask[]>();

export const architectTools: MCPTool[] = [
  {
    name: "architect_decompose",
    description: "Decompose a feature request into architectural components",
    schema: z.object({
      feature: z.string(),
      context: z.array(z.string()).optional(),
    }),
    handler: async (args: unknown) => {
      const a = args as { feature: string; context?: string[]; };
      return safeToolCall("architect_decompose", async () => {
        const design = decomposeFeature(a.feature, a.context || []);
        designs.set(design.id, design);
        return jsonResult("Feature decomposed", design);
      });
    },
  },
  {
    name: "architect_create_file_plan",
    description: "Create a detailed file-level implementation plan",
    schema: z.object({
      design_id: z.string(),
    }),
    handler: async (args: unknown) => {
      const a = args as { design_id: string; };
      return safeToolCall("architect_create_file_plan", async () => {
        const design = designs.get(a.design_id);
        if (!design) throw new Error(`Design ${a.design_id} not found`);
        const plan = createFilePlan(design);
        filePlans.set(a.design_id, plan);
        return jsonResult("File plan created", plan);
      });
    },
  },
  {
    name: "architect_design_component",
    description: "Design a specific component with interface and dependencies",
    schema: z.object({
      design_id: z.string(),
      name: z.string(),
      type: z.enum(["page", "component", "hook", "service", "api", "util"]),
      description: z.string(),
      dependencies: z.array(z.string()).optional(),
    }),
    handler: async (args: unknown) => {
      const a = args as {
        design_id: string;
        name: string;
        type: ComponentSpec["type"];
        description: string;
        dependencies?: string[];
      };
      return safeToolCall("architect_design_component", async () => {
        const design = designs.get(a.design_id);
        if (!design) throw new Error(`Design ${a.design_id} not found`);

        const spec: ComponentSpec = {
          name: a.name,
          type: a.type,
          description: a.description,
          filePath: `src/${a.type}s/${a.name}.tsx`,
          dependencies: a.dependencies ?? [],
        };

        design.components.push(spec);

        return jsonResult(
          `Component ${a.name} added to design ${a.design_id}`,
          spec,
        );
      });
    },
  },
  {
    name: "architect_get_design",
    description: "Retrieve a complete architectural design",
    schema: z.object({
      design_id: z.string(),
    }),
    handler: async (args: unknown) => {
      const a = args as { design_id: string; };
      return safeToolCall("architect_get_design", async () => {
        const design = designs.get(a.design_id);
        if (!design) throw new Error(`Design ${a.design_id} not found`);
        return jsonResult(`Design details for ${a.design_id}`, design);
      });
    },
  },
  {
    name: "architect_validate_design",
    description: "Validate an architectural design for completeness and circular dependencies",
    schema: z.object({
      design_id: z.string(),
    }),
    handler: async (args: unknown) => {
      const a = args as { design_id: string; };
      return safeToolCall("architect_validate_design", async () => {
        const design = designs.get(a.design_id);
        if (!design) throw new Error(`Design ${a.design_id} not found`);

        const warnings: string[] = [];
        if (design.components.length === 0) {
          warnings.push("Design has no components defined");
        }

        // Check for circular dependencies
        const depGraph = new Map<string, string[]>();
        for (const comp of design.components) {
          depGraph.set(comp.name, comp.dependencies);
        }

        const visited = new Set<string>();
        const inStack = new Set<string>();

        function hasCycle(node: string): boolean {
          if (inStack.has(node)) return true;
          if (visited.has(node)) return false;
          visited.add(node);
          inStack.add(node);
          for (const dep of depGraph.get(node) ?? []) {
            if (hasCycle(dep)) return true;
          }
          inStack.delete(node);
          return false;
        }

        for (const name of depGraph.keys()) {
          if (hasCycle(name)) {
            warnings.push(`Circular dependency detected involving ${name}`);
            break;
          }
        }

        const isValid = warnings.length === 0;
        return jsonResult(
          isValid
            ? `Design ${a.design_id} is valid`
            : `Design ${a.design_id} has ${warnings.length} warning(s)`,
          { isValid, warnings, componentCount: design.components.length },
        );
      });
    },
  },
];
