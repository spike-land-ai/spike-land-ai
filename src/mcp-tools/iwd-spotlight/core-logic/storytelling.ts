/**
 * iwd_story_album + iwd_timeline
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createZodTool, jsonResult } from "@spike-land-ai/mcp-server-base";
import type { ToolClient } from "../mcp/types.js";
import { IWD_MILESTONES, IWD_BRAND, timelinePrompt } from "../mcp/types.js";

const ALBUM_THEMES = ["pioneers", "leaders", "innovators", "future_vision", "community"] as const;

export function registerStorytellingTools(server: McpServer, client: ToolClient): void {
  createZodTool(server, {
    name: "iwd_story_album",
    description:
      "Create a themed image album celebrating women in tech. Generates multiple images around a theme (pioneers, leaders, innovators, future_vision, community).",
    schema: {
      theme: z.enum(ALBUM_THEMES).describe("Album theme"),
      image_count: z.number().int().min(1).max(8).default(4).describe("Number of images to generate"),
      title: z.string().optional().describe("Custom album title"),
    },
    async handler({ theme, image_count, title }) {
      const albumTitle = title ?? `${IWD_BRAND.tagline} — ${theme.charAt(0).toUpperCase() + theme.slice(1)}`;

      const themePrompts: Record<string, string[]> = {
        pioneers: [
          "Ada Lovelace writing the first algorithm, Victorian era with modern tech overlay",
          "Grace Hopper at a computer console, pioneering compiler technology",
          "Katherine Johnson calculating orbital trajectories at NASA",
          "Hedy Lamarr inventing frequency-hopping spread spectrum",
          "Radia Perlman designing network protocols on a whiteboard",
          "Margaret Hamilton standing next to Apollo guidance code printouts",
          "Annie Easley working on rocket propulsion at NASA",
          "Sister Mary Kenneth Keller receiving first CS PhD in America",
        ],
        leaders: [
          "Woman CEO presenting at a tech conference, commanding stage presence",
          "Diverse women board meeting in a modern tech office",
          "Woman CTO leading an architecture design review",
          "Female venture capitalist reviewing startup pitches",
          "Woman engineering director mentoring junior developers",
          "Tech executive speaking at a product launch event",
          "Woman leading a hackathon team to victory",
          "Female founder ringing the stock exchange bell",
        ],
        innovators: [
          "Woman engineer building a robot in a modern lab",
          "Female data scientist visualizing breakthrough patterns",
          "Woman designing next-generation AI interface",
          "Female blockchain developer creating decentralized systems",
          "Woman biotech researcher making a discovery",
          "Female game developer creating immersive worlds",
          "Woman cybersecurity expert protecting digital infrastructure",
          "Female quantum computing researcher at the frontier",
        ],
        future_vision: [
          "Diverse women shaping AI ethics policy of the future",
          "Woman astronaut leading Mars colony establishment",
          "Female robotics engineer with humanoid AI companion",
          "Woman architect designing sustainable smart cities",
          "Girls coding in a futuristic classroom",
          "Woman scientist achieving fusion energy breakthrough",
          "Female tech leader at a global innovation summit",
          "Women collaborating on open source in a virtual workspace",
        ],
        community: [
          "Women at a coding bootcamp supporting each other",
          "Girls Who Code workshop with enthusiastic participants",
          "Women's tech meetup with diverse speakers and audience",
          "Female mentorship circle in a modern co-working space",
          "Women hackathon team celebrating their project",
          "Online women-in-tech community virtual meetup",
          "Women-led open source contributors collaborating",
          "Intergenerational women in tech sharing knowledge",
        ],
      };

      const prompts = themePrompts[theme]!.slice(0, image_count);
      const albumResult = await client.callTool("img_album_create", {
        name: albumTitle,
        description: `IWD 2026 album: ${theme}`,
      });

      const imageResults = await Promise.all(
        prompts.map((prompt) =>
          client.callTool("img_generate", {
            prompt: `${prompt}. Style: ${IWD_BRAND.tagline} celebration, purple (#A020F0) and green (#44B78B) accents, empowering, modern art.`,
            aspect_ratio: "16:9",
          })
        ),
      );

      return jsonResult({
        album: extractContent(albumResult),
        theme,
        title: albumTitle,
        images: imageResults.map((r, i) => ({
          prompt: prompts[i],
          result: extractContent(r),
        })),
      });
    },
  });

  createZodTool(server, {
    name: "iwd_timeline",
    description:
      "Generate a visual timeline of women-in-tech milestones as a diagram image. Uses curated historical data from 1843 to present.",
    schema: {
      start_year: z.number().int().optional().describe("Filter: start year (default: show all)"),
      end_year: z.number().int().optional().describe("Filter: end year (default: show all)"),
    },
    async handler({ start_year, end_year }) {
      const milestones = IWD_MILESTONES.filter((m) => {
        if (start_year && m.year < start_year) return false;
        if (end_year && m.year > end_year) return false;
        return true;
      });

      const mermaidDiagram = [
        "timeline",
        `    title ${IWD_BRAND.tagline} — Women in Tech Milestones`,
        ...milestones.map((m) => `    ${m.year} : ${m.title} : ${m.description}`),
      ].join("\n");

      const diagramResult = await client.callTool("img_diagram", {
        diagram: mermaidDiagram,
        format: "png",
      });

      return jsonResult({
        milestones,
        diagram: extractContent(diagramResult),
        prompt_used: timelinePrompt(),
      });
    },
  });
}

function extractContent(result: { content: Array<{ text: string }> }): string {
  return result.content[0]?.text ?? "";
}
