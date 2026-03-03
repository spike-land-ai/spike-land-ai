import { describe, expect, it } from "vitest";

import { PERSONAS } from "./personas";
import { getLandingPageBySlug, LANDING_PAGES } from "./landing-pages";

describe("landing pages data", () => {
  it("has exactly 16 landing pages", () => {
    expect(LANDING_PAGES).toHaveLength(16);
  });

  it("has a landing page for every persona slug", () => {
    for (const persona of PERSONAS) {
      const landing = getLandingPageBySlug(persona.slug);
      expect(landing, `Missing landing page for persona: ${persona.slug}`)
        .toBeDefined();
    }
  });

  it("has unique slugs", () => {
    const slugs = LANDING_PAGES.map(lp => lp.slug);
    expect(new Set(slugs).size).toBe(16);
  });

  it("every landing page has a non-empty headline", () => {
    for (const lp of LANDING_PAGES) {
      expect(lp.headline.length, `Empty headline for ${lp.slug}`)
        .toBeGreaterThan(0);
    }
  });

  it("every landing page has a non-empty subheadline", () => {
    for (const lp of LANDING_PAGES) {
      expect(lp.subheadline.length, `Empty subheadline for ${lp.slug}`)
        .toBeGreaterThan(0);
    }
  });

  it("every landing page has exactly 3 pain points", () => {
    for (const lp of LANDING_PAGES) {
      expect(lp.painPoints, `Wrong pain point count for ${lp.slug}`)
        .toHaveLength(3);
    }
  });

  it("every pain point has a non-empty title and description", () => {
    for (const lp of LANDING_PAGES) {
      for (const pp of lp.painPoints) {
        expect(pp.title.length, `Empty pain point title in ${lp.slug}`)
          .toBeGreaterThan(0);
        expect(
          pp.description.length,
          `Empty pain point description in ${lp.slug}`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("every landing page has 3-4 features", () => {
    for (const lp of LANDING_PAGES) {
      expect(lp.features.length, `Wrong feature count for ${lp.slug}`)
        .toBeGreaterThanOrEqual(3);
      expect(lp.features.length, `Too many features for ${lp.slug}`)
        .toBeLessThanOrEqual(4);
    }
  });

  it("every feature has non-empty title, description, and appSlug", () => {
    for (const lp of LANDING_PAGES) {
      for (const feat of lp.features) {
        expect(feat.title.length, `Empty feature title in ${lp.slug}`)
          .toBeGreaterThan(0);
        expect(
          feat.description.length,
          `Empty feature description in ${lp.slug}`,
        ).toBeGreaterThan(0);
        expect(feat.appSlug.length, `Empty feature appSlug in ${lp.slug}`)
          .toBeGreaterThan(0);
      }
    }
  });

  it("feature appSlugs match the persona's recommendedAppSlugs", () => {
    for (const persona of PERSONAS) {
      const landing = getLandingPageBySlug(persona.slug);
      if (!landing) continue;
      const featureSlugs = landing.features.map(f => f.appSlug);
      for (const slug of featureSlugs) {
        expect(
          persona.recommendedAppSlugs,
          `Feature appSlug "${slug}" in ${persona.slug} not in recommendedAppSlugs`,
        ).toContain(slug);
      }
    }
  });

  it("every landing page has a non-empty brightonMessage", () => {
    for (const lp of LANDING_PAGES) {
      expect(lp.brightonMessage.length, `Empty brightonMessage for ${lp.slug}`)
        .toBeGreaterThan(0);
    }
  });

  it("every landing page has a non-empty ctaLabel and ctaHref", () => {
    for (const lp of LANDING_PAGES) {
      expect(lp.ctaLabel.length, `Empty ctaLabel for ${lp.slug}`)
        .toBeGreaterThan(0);
      expect(lp.ctaHref.length, `Empty ctaHref for ${lp.slug}`).toBeGreaterThan(
        0,
      );
    }
  });

  it("returns undefined for unknown slug", () => {
    expect(getLandingPageBySlug("nonexistent")).toBeUndefined();
  });
});
