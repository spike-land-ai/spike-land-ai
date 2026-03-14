/**
 * Math Engine — Blog Generator
 *
 * Generates MDX blog posts from math exploration session results.
 */

import type { LLMProvider, SessionState } from "./types.js";
import { getProblemById } from "./problem-registry.js";
import { getBlogGenerationPrompt } from "./prompt-templates.js";

export interface BlogPost {
  filename: string;
  frontmatter: {
    title: string;
    date: string;
    description: string;
    tags: string[];
  };
  content: string;
  fullMdx: string;
}

export async function generateBlogPost(session: SessionState, llm: LLMProvider): Promise<BlogPost> {
  const problem = getProblemById(session.problemId);
  if (!problem) {
    throw new Error(`Problem not found: ${session.problemId}`);
  }

  const prompt = getBlogGenerationPrompt(session, problem);

  const mdxContent = await llm.complete({
    temperature: 0.7,
    maxTokens: 4000,
    systemPrompt: `You are a mathematical writer who creates engaging, accessible blog posts
about mathematical explorations. Combine rigorous mathematics with clear explanations.
Use LaTeX notation ($$...$$ for display math, $...$ for inline) where appropriate.
Write in MDX format with proper frontmatter.`,
    userPrompt: prompt,
  });

  const frontmatter = extractFrontmatter(mdxContent);
  const date = new Date().toISOString().split("T")[0] ?? "unknown";
  const title = frontmatter.title ?? `Exploring: ${problem.title}`;
  const slug = generateSlug(title);

  const post: BlogPost = {
    filename: `${slug}.mdx`,
    frontmatter: {
      title,
      date,
      description: frontmatter.description ?? `AI-assisted exploration of ${problem.title}`,
      tags: frontmatter.tags ?? ["mathematics", "ai-exploration"],
    },
    content: extractContent(mdxContent),
    fullMdx: mdxContent,
  };

  return post;
}

function extractFrontmatter(mdx: string): {
  title: string | undefined;
  description: string | undefined;
  tags: string[] | undefined;
} {
  const fmMatch = mdx.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!fmMatch?.[1]) return { title: undefined, description: undefined, tags: undefined };

  const fm = fmMatch[1];
  const title = fm.match(/title:\s*"([^"]+)"/)?.[1];
  const description = fm.match(/description:\s*"([^"]+)"/)?.[1];
  const tagsMatch = fm.match(/tags:\s*\[(.*?)\]/);
  const tagsStr = tagsMatch?.[1];
  const tags = tagsStr ? tagsStr.split(",").map((t) => t.trim().replace(/"/g, "")) : undefined;

  return { title, description, tags };
}

function extractContent(mdx: string): string {
  const contentMatch = mdx.match(/^---\s*\n[\s\S]*?\n---\s*\n([\s\S]*)$/);
  return contentMatch?.[1]?.trim() ?? mdx;
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}
