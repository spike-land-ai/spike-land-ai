/**
 * Template Registry
 *
 * Central registry for all My-Apps templates.
 * Provides template lookup and listing functionality.
 */

import { campaignLandingCode } from "./campaign-landing/code";
import { campaignLandingMetadata } from "./campaign-landing/metadata";
import { contestEntryCode } from "./contest-entry/code";
import { contestEntryMetadata } from "./contest-entry/metadata";
import { interactivePollCode } from "./interactive-poll/code";
import { interactivePollMetadata } from "./interactive-poll/metadata";
import { linkInBioCode } from "./link-in-bio/code";
import { linkInBioMetadata } from "./link-in-bio/metadata";
import type { Template } from "./types";

/**
 * All available templates
 */
export const templates: Template[] = [
  {
    ...linkInBioMetadata,
    code: linkInBioCode,
  },
  {
    ...campaignLandingMetadata,
    code: campaignLandingCode,
  },
  {
    ...interactivePollMetadata,
    code: interactivePollCode,
  },
  {
    ...contestEntryMetadata,
    code: contestEntryCode,
  },
];

/**
 * Get a template by ID
 *
 * @param id - Template ID to look up
 * @returns Template if found, undefined otherwise
 */
export function getTemplateById(id: string): Template | undefined {
  return templates.find((template) => template.id === id);
}

/**
 * Get all templates
 *
 * @returns Array of all available templates
 */
export function getAllTemplates(): Template[] {
  return templates;
}

// Re-export types for convenience
export type { Template, TemplateMetadata, TemplatePurpose } from "./types";
