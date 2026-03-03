import type { Metadata } from "next";
import { cookies } from "next/headers";

import { BlogPostsGrid } from "@/components/blog/BlogPostsGrid";
import { getAllPosts } from "@/lib/blog/get-posts";
import type { BlogPostMeta } from "@/lib/blog/types";
import { getPersonaBySlug, PERSONAS } from "@/lib/onboarding/personas";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog | Spike Land",
  description:
    "Latest news, tutorials, and updates from spike.land. Learn about AI-powered development, MCP tools, deploying apps with AI, and more.",
  openGraph: {
    title: "Blog | Spike Land",
    description:
      "Latest news, tutorials, and updates from spike.land. Learn about AI-powered development, MCP tools, deploying apps with AI, and more.",
    type: "website",
    url: "https://spike.land/blog",
  },
  twitter: {
    card: "summary_large_image",
    title: "Blog | Spike Land",
    description:
      "Latest news, tutorials, and updates from spike.land. Learn about AI-powered development, MCP tools, deploying apps with AI, and more.",
  },
};

/**
 * Build a set of tags/categories that are relevant for a persona.
 * Uses the persona's recommended app slugs as keywords to match against post tags.
 */
function getPersonaRelevantTags(personaSlug: string): Set<string> {
  const persona = getPersonaBySlug(personaSlug);
  if (!persona) return new Set();

  // Use persona keywords from description + name as matching terms
  const keywords = new Set<string>();
  const words = `${persona.name} ${persona.description}`.toLowerCase().split(
    /\s+/,
  );
  for (const w of words) {
    if (w.length > 2) keywords.add(w);
  }
  return keywords;
}

function isPostRelevantToPersona(
  post: BlogPostMeta,
  relevantTags: Set<string>,
): boolean {
  if (relevantTags.size === 0) return false;

  const postTerms = [
    post.frontmatter.category.toLowerCase(),
    ...post.frontmatter.tags.map(t => t.toLowerCase()),
  ];

  return postTerms.some(term => relevantTags.has(term));
}

export default async function BlogPage() {
  const jar = await cookies();
  const personaSlug = jar.get("spike-persona")?.value ?? null;
  const posts = getAllPosts();

  // Determine which posts are persona-relevant and reorder
  const relevantTags = personaSlug
    ? getPersonaRelevantTags(personaSlug)
    : new Set<string>();
  const personaName = personaSlug
    ? (PERSONAS.find(p => p.slug === personaSlug)?.name ?? null)
    : null;

  // Partition posts: relevant first, then the rest (stable order within each group)
  const relevantPosts: BlogPostMeta[] = [];
  const otherPosts: BlogPostMeta[] = [];
  const relevantSlugs = new Set<string>();

  for (const post of posts) {
    if (personaSlug && isPostRelevantToPersona(post, relevantTags)) {
      relevantPosts.push(post);
      relevantSlugs.add(post.slug);
    } else {
      otherPosts.push(post);
    }
  }

  const orderedPosts = [...relevantPosts, ...otherPosts];

  return (
    <div className="relative">
      <div className="container mx-auto px-4 md:px-6 max-w-7xl pt-24 pb-24">
        {/* Header */}
        <header className="flex flex-col items-center justify-center text-center mb-20 space-y-6 pt-10">
          {/* Animated eyebrow badge */}
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/10 backdrop-blur-md shadow-glow-primary text-primary transition-all duration-300 hover:bg-primary/15 hover:border-primary/50">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            <span className="text-sm font-bold tracking-widest uppercase">
              Engineering & Design
            </span>
          </div>

          {/* Main title with layered gradient */}
          <h1 className="font-heading text-6xl md:text-8xl font-extrabold tracking-tighter text-foreground drop-shadow-sm leading-none pb-2">
            Blog
          </h1>

          {/* Decorative divider */}
          <div className="flex items-center gap-4 w-full max-w-xs" aria-hidden="true">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/40 to-primary/20" />
            <div className="h-1.5 w-1.5 rounded-full bg-primary/60" />
            <div className="h-px flex-1 bg-gradient-to-l from-transparent via-accent/40 to-accent/20" />
          </div>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed font-medium">
            Deep dives, tutorials, and updates from the team at{" "}
            <span className="text-foreground font-semibold">Spike Land</span>.
          </p>

          {personaName && (
            <div className="mt-6 px-5 py-2.5 glass-1 rounded-full border border-primary/20 shadow-glow-primary">
              <p className="text-sm font-medium text-muted-foreground">
                Personalized collection for{" "}
                <span className="font-bold text-primary">{personaName}</span>
              </p>
            </div>
          )}
        </header>

        {/* Posts Grid */}
        <BlogPostsGrid
          orderedPosts={orderedPosts}
          relevantSlugs={[...relevantSlugs]}
        />
      </div>
    </div>
  );
}
