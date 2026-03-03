/**
 * Template system for My-Apps (Campaign Tools)
 *
 * This module defines the types and interfaces for the app template system.
 * Templates provide pre-built starting points for common campaign use cases.
 */

/**
 * Template purpose categories that map to campaign use cases
 */
export type TemplatePurpose =
  | "link-in-bio" // Social media link aggregation pages
  | "campaign-landing" // Marketing campaign landing pages
  | "poll" // Interactive polls and surveys
  | "contest"; // Contest entry forms

/**
 * Template metadata - describes a template's purpose and content
 */
export interface TemplateMetadata {
  /** Unique template identifier */
  id: string;

  /** Display name for the template */
  name: string;

  /** Brief description of what the template does */
  description: string;

  /** Template purpose/category */
  purpose: TemplatePurpose;

  /** Tags for filtering/search */
  tags: string[];

  /** Preview image URL (optional) */
  previewImage?: string;
}

/**
 * Complete template definition including code
 */
export interface Template extends TemplateMetadata {
  /** Default starter code for this template */
  code: string;
}
