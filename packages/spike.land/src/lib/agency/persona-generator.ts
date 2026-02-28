import { generateStructuredResponse } from "@/lib/ai/gemini-client";
import logger from "@/lib/logger";
import { z } from "zod";

import {
  bulkCreatePersonas,
  type CreatePersonaInput,
  recalculateRanks,
} from "./persona-service";

/**
 * Schema for AI-generated persona
 */
const GeneratedPersonaSchema = z.object({
  slug: z.string(),
  name: z.string(),
  tagline: z.string(),
  demographics: z.object({
    age: z.string().optional(),
    gender: z.string().optional(),
    income: z.string().optional(),
    location: z.string().optional(),
    platform: z.string().optional(),
    jobTitle: z.string().optional(),
  }),
  psychographics: z.array(z.string()),
  painPoints: z.array(z.string()),
  triggers: z.array(z.string()),
  primaryHook: z.string(),
  adCopyVariations: z.array(z.string()),
  predictedProfit: z.number(),
  stressLevel: z.number(),
});

type GeneratedPersona = z.infer<typeof GeneratedPersonaSchema>;

/**
 * Generate AI customer personas for the AI agency
 *
 * @param count Number of personas to generate
 * @param industry Optional industry focus
 * @returns Array of generated personas
 */
export async function generatePersonas(
  count: number,
  industry?: string,
): Promise<GeneratedPersona[]> {
  const industryContext = industry
    ? `Focus on personas from the ${industry} industry.`
    : "Cover a diverse range of industries including tech startups, SMBs, enterprises, and individual entrepreneurs.";

  const prompt =
    `You are an expert marketing strategist creating customer personas for an AI development agency.

The agency offers:
- AI Integration & Automation (adding AI to existing products)
- Rapid MVP Development (vibe-coded prototypes in days)
- Legacy System Modernization
- Full-stack Web/Mobile Development

Target market: Business decision-makers who need AI development services.

Generate ${count} unique customer personas. ${industryContext}

For each persona, provide:
1. A memorable name (e.g., "Frustrated CTO Frank", "Startup Steve", "Corporate Carol")
2. A catchy tagline (10-15 words max)
3. Demographics (age range, job title, company size, location, income level)
4. Psychographics (3-5 values/attitudes)
5. Pain points (3-5 specific problems they face)
6. Triggers (what makes them actively seek help)
7. A primary hook for ads (one compelling sentence)
8. 3 ad copy variations (different angles/messaging)
9. Predicted profit score (1-100, based on budget and likelihood to convert)
10. Stress level (1-10, how urgent their need is)

Return a JSON array of objects with these fields:
- slug: URL-friendly slug (e.g., "frustrated-cto-frank")
- name: Full persona name
- tagline: Short memorable description
- demographics: { age, gender, income, location, platform, jobTitle }
- psychographics: string[]
- painPoints: string[]
- triggers: string[]
- primaryHook: string
- adCopyVariations: string[]
- predictedProfit: number (1-100)
- stressLevel: number (1-10)

Ensure personas are diverse in:
- Industry (tech, finance, healthcare, retail, etc.)
- Company size (startup, SMB, enterprise)
- Urgency level (urgent vs planning ahead)
- Budget level (bootstrapped vs well-funded)`;

  try {
    const result = await generateStructuredResponse<GeneratedPersona[]>({
      prompt,
      maxTokens: 8192,
      temperature: 0.7, // Higher creativity for diverse personas
    });

    // Validate each persona
    const validPersonas: GeneratedPersona[] = [];
    for (const persona of result) {
      const parsed = GeneratedPersonaSchema.safeParse(persona);
      if (parsed.success) {
        validPersonas.push(parsed.data);
      } else {
        logger.warn("Invalid persona generated:", { errors: parsed.error });
      }
    }

    return validPersonas;
  } catch (error) {
    logger.error("Failed to generate personas:", { error });
    throw error;
  }
}

/**
 * Generate and save personas to the database
 *
 * @param count Number of personas to generate
 * @param industry Optional industry focus
 * @returns Number of personas saved
 */
export async function generateAndSavePersonas(
  count: number,
  industry?: string,
): Promise<{ generated: number; saved: number; }> {
  const personas = await generatePersonas(count, industry);

  // Assign initial ranks based on generation order (will be recalculated)
  const personasWithRanks: CreatePersonaInput[] = personas.map((p, index) => ({
    slug: p.slug,
    name: p.name,
    tagline: p.tagline,
    demographics: {
      ...(p.demographics.age !== undefined ? { age: p.demographics.age } : {}),
      ...(p.demographics.gender !== undefined ? { gender: p.demographics.gender } : {}),
      ...(p.demographics.income !== undefined ? { income: p.demographics.income } : {}),
      ...(p.demographics.location !== undefined ? { location: p.demographics.location } : {}),
      ...(p.demographics.platform !== undefined ? { platform: p.demographics.platform } : {}),
      ...(p.demographics.jobTitle !== undefined ? { jobTitle: p.demographics.jobTitle } : {}),
    },
    psychographics: p.psychographics,
    painPoints: p.painPoints,
    triggers: p.triggers,
    primaryHook: p.primaryHook,
    adCopyVariations: p.adCopyVariations,
    predictedProfit: p.predictedProfit,
    stressLevel: p.stressLevel,
    rank: index + 1,
  }));

  const saved = await bulkCreatePersonas(personasWithRanks);

  // Recalculate ranks based on profit and stress
  await recalculateRanks();

  return {
    generated: personas.length,
    saved,
  };
}

/**
 * Generate a single persona based on specific criteria
 */
export async function generateTargetedPersona(criteria: {
  industry: string;
  companySize: "startup" | "smb" | "enterprise";
  urgency: "low" | "medium" | "high";
  budget: "low" | "medium" | "high";
}): Promise<GeneratedPersona | null> {
  const urgencyMap = { low: "1-3", medium: "4-6", high: "7-10" };
  const budgetMap = { low: "10-30", medium: "30-60", high: "60-100" };

  const prompt =
    `Generate ONE customer persona for an AI development agency with these specific characteristics:

- Industry: ${criteria.industry}
- Company size: ${criteria.companySize}
- Urgency/stress level: ${urgencyMap[criteria.urgency]} out of 10
- Budget/profit potential: ${budgetMap[criteria.budget]} out of 100

Return a single JSON object (not an array) with:
- slug: URL-friendly slug
- name: Memorable persona name
- tagline: 10-15 word description
- demographics: { age, gender, income, location, platform, jobTitle }
- psychographics: string[]
- painPoints: string[]
- triggers: string[]
- primaryHook: string
- adCopyVariations: string[]
- predictedProfit: number
- stressLevel: number`;

  try {
    const result = await generateStructuredResponse<GeneratedPersona>({
      prompt,
      maxTokens: 2048,
      temperature: 0.7,
    });

    const parsed = GeneratedPersonaSchema.safeParse(result);
    if (parsed.success) {
      return parsed.data;
    }

    logger.warn("Invalid targeted persona generated:", {
      errors: parsed.error,
    });
    return null;
  } catch (error) {
    logger.error("Failed to generate targeted persona:", { error });
    return null;
  }
}
