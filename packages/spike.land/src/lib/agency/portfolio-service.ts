import type { AgencyPortfolioCategory, AgencyPortfolioItem } from "@/generated/prisma";
import prisma from "@/lib/prisma";

export type CreatePortfolioItemInput = {
  slug: string;
  name: string;
  description: string;
  url?: string | null;
  githubUrl?: string | null;
  screenshots?: string[];
  technologies?: string[];
  category: AgencyPortfolioCategory;
  featured?: boolean;
  sortOrder?: number;
};

export type UpdatePortfolioItemInput = Partial<CreatePortfolioItemInput>;

/**
 * Get all portfolio items, optionally filtered by category
 */
export async function getPortfolioItems(options?: {
  category?: AgencyPortfolioCategory;
  featured?: boolean;
  limit?: number;
}): Promise<AgencyPortfolioItem[]> {
  return prisma.agencyPortfolioItem.findMany({
    where: {
      ...(options?.category && { category: options.category }),
      ...(options?.featured !== undefined && { featured: options.featured }),
    },
    orderBy: [{ featured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    ...(options?.limit !== undefined ? { take: options.limit } : {}),
  });
}

/**
 * Get a single portfolio item by slug
 */
export async function getPortfolioItemBySlug(slug: string): Promise<AgencyPortfolioItem | null> {
  return prisma.agencyPortfolioItem.findUnique({
    where: { slug },
  });
}

/**
 * Create a new portfolio item
 */
export async function createPortfolioItem(
  input: CreatePortfolioItemInput,
): Promise<AgencyPortfolioItem> {
  return prisma.agencyPortfolioItem.create({
    data: {
      slug: input.slug,
      name: input.name,
      description: input.description,
      ...(input.url !== undefined ? { url: input.url } : {}),
      ...(input.githubUrl !== undefined ? { githubUrl: input.githubUrl } : {}),
      screenshots: input.screenshots ?? [],
      technologies: input.technologies ?? [],
      category: input.category,
      featured: input.featured ?? false,
      sortOrder: input.sortOrder ?? 0,
    },
  });
}

/**
 * Update an existing portfolio item
 */
export async function updatePortfolioItem(
  slug: string,
  input: UpdatePortfolioItemInput,
): Promise<AgencyPortfolioItem> {
  return prisma.agencyPortfolioItem.update({
    where: { slug },
    data: input,
  });
}

/**
 * Delete a portfolio item
 */
export async function deletePortfolioItem(slug: string): Promise<void> {
  await prisma.agencyPortfolioItem.delete({
    where: { slug },
  });
}

/**
 * Get featured portfolio items for the homepage
 */
export async function getFeaturedPortfolioItems(limit = 3): Promise<AgencyPortfolioItem[]> {
  return getPortfolioItems({ featured: true, limit });
}

/**
 * Get portfolio items grouped by category
 */
export async function getPortfolioItemsByCategory(): Promise<
  Record<AgencyPortfolioCategory, AgencyPortfolioItem[]>
> {
  const items = await getPortfolioItems();

  const grouped = {
    AI_INTEGRATION: [] as AgencyPortfolioItem[],
    WEB_APP: [] as AgencyPortfolioItem[],
    MOBILE_APP: [] as AgencyPortfolioItem[],
    PROTOTYPE: [] as AgencyPortfolioItem[],
    OPEN_SOURCE: [] as AgencyPortfolioItem[],
  };

  for (const item of items) {
    grouped[item.category].push(item);
  }

  return grouped;
}
