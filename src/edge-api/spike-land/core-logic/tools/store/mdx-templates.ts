/**
 * MDX Template Generator for MCP App Store
 *
 * Generates structured MDX content for an app given its metadata and tool list.
 * The output uses <toolsurface> custom elements that the MdxSurface component
 * renders as interactive, executable tool cards.
 */

export interface AppToolSchema {
  type: string;
  properties?: Record<string, { type: string; description?: string; enum?: string[] }>;
  required?: string[];
}

export interface AppToolDef {
  name: string;
  description?: string;
  category?: string;
  inputSchema?: AppToolSchema;
  examples?: Array<{ label?: string; args?: Record<string, unknown> }>;
}

export interface AppMdxContext {
  slug: string;
  name: string;
  description: string;
  emoji: string;
  category: string;
  tagline?: string;
  pricing?: string;
  tags?: string[];
  tools: AppToolDef[];
}

/**
 * Generates a Getting Started section with installation instructions.
 */
function generateGettingStarted(ctx: AppMdxContext): string {
  const toolNames = ctx.tools.slice(0, 3).map((t) => `\`${t.name}\``);
  const exampleTools = toolNames.length > 0 ? toolNames.join(", ") : `\`${ctx.slug}_*\``;

  return `## Getting Started

Add **${ctx.name}** to your MCP client to access ${ctx.tools.length} tool${ctx.tools.length === 1 ? "" : "s"} directly from your AI assistant.

\`\`\`json
{
  "mcpServers": {
    "${ctx.slug}": {
      "url": "https://mcp.spike.land/mcp",
      "headers": { "Authorization": "Bearer YOUR_TOKEN" }
    }
  }
}
\`\`\`

Once connected, your AI assistant can invoke ${exampleTools}${ctx.tools.length > 3 ? ` and ${ctx.tools.length - 3} more tools` : ""} directly in conversation.`;
}

/**
 * Generates an Examples section showing concrete use cases.
 */
function generateExamplesSection(ctx: AppMdxContext): string {
  if (ctx.tools.length === 0) return "";

  const exampleLines: string[] = [];
  const shown = ctx.tools.slice(0, 3);

  for (const tool of shown) {
    const toolExamples = tool.examples ?? [];
    if (toolExamples.length > 0 && toolExamples[0]?.args) {
      const args = toolExamples[0].args;
      const argPreview = Object.entries(args)
        .slice(0, 2)
        .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
        .join(", ");
      exampleLines.push(`- Ask your AI: *"Use \`${tool.name}\` with ${argPreview}"*`);
    } else if (tool.description) {
      exampleLines.push(`- Ask your AI: *"${tool.description.replace(/\.$/, "")}"*`);
    }
  }

  if (exampleLines.length === 0) return "";

  return `## Examples

Here are some things you can do with **${ctx.name}**:

${exampleLines.join("\n")}`;
}

/**
 * Generates the interactive tool surfaces section — one <toolsurface> per tool.
 */
function generateToolsSection(ctx: AppMdxContext): string {
  if (ctx.tools.length === 0) {
    return `## Tools\n\nNo tools registered for this app yet.`;
  }

  const toolBlocks = ctx.tools
    .map((tool) => {
      const descLine = tool.description ? `\n${tool.description}\n` : "";
      return `### \`${tool.name}\`\n${descLine}\n<toolsurface name="${tool.name}" />`;
    })
    .join("\n\n");

  return `## Tools

This app provides ${ctx.tools.length} interactive tool${ctx.tools.length === 1 ? "" : "s"}. Click any tool below to expand it, fill in parameters, and execute it directly.

${toolBlocks}`;
}

/**
 * Generates the full MDX document for an app.
 *
 * Structure:
 * - Header (h1 with emoji, tagline, tags)
 * - Overview paragraph
 * - Tools section (interactive <toolsurface> embeds)
 * - Examples section
 * - Getting Started section
 */
export function generateAppMdx(ctx: AppMdxContext): string {
  const tagBadges =
    ctx.tags && ctx.tags.length > 0
      ? ctx.tags
          .slice(0, 5)
          .map((t) => `\`${t}\``)
          .join(" ")
      : "";

  const pricingNote =
    ctx.pricing && ctx.pricing !== "free"
      ? `\n\n> **Pricing**: ${ctx.pricing}`
      : "";

  const categoryNote = ctx.category ? `**Category**: ${ctx.category}` : "";
  const metaLine = [categoryNote, tagBadges].filter(Boolean).join(" &mdash; ");

  const overviewSection = `# ${ctx.emoji} ${ctx.name}

${ctx.tagline || ctx.description}
${pricingNote}

${metaLine ? `${metaLine}\n` : ""}
${ctx.description && ctx.description !== ctx.tagline ? `${ctx.description}\n` : ""}`;

  const toolsSection = generateToolsSection(ctx);
  const examplesSection = generateExamplesSection(ctx);
  const gettingStarted = generateGettingStarted(ctx);

  const parts = [overviewSection, toolsSection, examplesSection, gettingStarted].filter(Boolean);

  return parts.join("\n\n---\n\n");
}
