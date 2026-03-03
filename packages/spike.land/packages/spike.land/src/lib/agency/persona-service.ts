import type { AgencyPersona } from "@/generated/prisma";
import prisma from "@/lib/prisma";

export type CreatePersonaInput = {
  slug: string;
  name: string;
  tagline: string;
  demographics: {
    age?: string;
    gender?: string;
    income?: string;
    location?: string;
    platform?: string;
    jobTitle?: string;
  };
  psychographics: string[];
  painPoints: string[];
  triggers: string[];
  primaryHook: string;
  adCopyVariations: string[];
  predictedProfit: number;
  stressLevel: number;
  rank: number;
  landingPageSlug?: string | null;
};

export type UpdatePersonaInput = Partial<CreatePersonaInput>;

/**
 * Get all personas, sorted by rank
 */
export async function getPersonas(options?: {
  limit?: number;
  minProfit?: number;
  minStress?: number;
}): Promise<AgencyPersona[]> {
  return prisma.agencyPersona.findMany({
    where: {
      ...(options?.minProfit !== undefined
        && { predictedProfit: { gte: options.minProfit } }),
      ...(options?.minStress !== undefined
        && { stressLevel: { gte: options.minStress } }),
    },
    orderBy: { rank: "asc" },
    take: options?.limit,
  });
}

/**
 * Get a single persona by slug
 */
export async function getPersonaBySlug(
  slug: string,
): Promise<AgencyPersona | null> {
  return prisma.agencyPersona.findUnique({
    where: { slug },
  });
}

/**
 * Get top personas by predicted profit
 */
export async function getTopPersonasByProfit(
  limit = 10,
): Promise<AgencyPersona[]> {
  return prisma.agencyPersona.findMany({
    orderBy: { predictedProfit: "desc" },
    take: limit,
  });
}

/**
 * Get most stressed personas (highest urgency)
 */
export async function getMostStressedPersonas(
  limit = 10,
): Promise<AgencyPersona[]> {
  return prisma.agencyPersona.findMany({
    orderBy: { stressLevel: "desc" },
    take: limit,
  });
}

/**
 * Create a new persona
 */
export async function createPersona(
  input: CreatePersonaInput,
): Promise<AgencyPersona> {
  return prisma.agencyPersona.create({
    data: {
      slug: input.slug,
      name: input.name,
      tagline: input.tagline,
      demographics: input.demographics,
      psychographics: input.psychographics,
      painPoints: input.painPoints,
      triggers: input.triggers,
      primaryHook: input.primaryHook,
      adCopyVariations: input.adCopyVariations,
      predictedProfit: input.predictedProfit,
      stressLevel: input.stressLevel,
      rank: input.rank,
      landingPageSlug: input.landingPageSlug,
    },
  });
}

/**
 * Update an existing persona
 */
export async function updatePersona(
  slug: string,
  input: UpdatePersonaInput,
): Promise<AgencyPersona> {
  return prisma.agencyPersona.update({
    where: { slug },
    data: input,
  });
}

/**
 * Delete a persona
 */
export async function deletePersona(slug: string): Promise<void> {
  await prisma.agencyPersona.delete({
    where: { slug },
  });
}

/**
 * Bulk create personas
 */
export async function bulkCreatePersonas(
  personas: CreatePersonaInput[],
): Promise<number> {
  const result = await prisma.agencyPersona.createMany({
    data: personas.map(p => ({
      slug: p.slug,
      name: p.name,
      tagline: p.tagline,
      demographics: p.demographics,
      psychographics: p.psychographics,
      painPoints: p.painPoints,
      triggers: p.triggers,
      primaryHook: p.primaryHook,
      adCopyVariations: p.adCopyVariations,
      predictedProfit: p.predictedProfit,
      stressLevel: p.stressLevel,
      rank: p.rank,
      landingPageSlug: p.landingPageSlug,
    })),
    skipDuplicates: true,
  });

  return result.count;
}

/**
 * Recalculate ranks based on a composite score
 */
export async function recalculateRanks(): Promise<void> {
  const personas = await prisma.agencyPersona.findMany({
    select: { id: true, predictedProfit: true, stressLevel: true },
  });

  // Score = (profit * 0.6) + (stress * 0.4) - higher is better
  const scored = personas.map(p => ({
    id: p.id,
    score: p.predictedProfit * 0.6 + p.stressLevel * 40, // stress is 0-10, normalize to 0-400
  }));

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Update ranks
  await Promise.all(
    scored.map((p, index) =>
      prisma.agencyPersona.update({
        where: { id: p.id },
        data: { rank: index + 1 },
      })
    ),
  );
}

/**
 * Get persona count
 */
export async function getPersonaCount(): Promise<number> {
  return prisma.agencyPersona.count();
}
