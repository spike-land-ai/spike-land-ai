import { describe, expect, it } from "vitest";

import { getAllTemplates, getTemplateById, templates } from "./index";

describe("templates/index", () => {
  describe("templates array", () => {
    it("should contain exactly 4 templates", () => {
      expect(templates).toHaveLength(4);
    });

    it("should have the expected template IDs", () => {
      const ids = templates.map(t => t.id);
      expect(ids).toContain("link-in-bio");
      expect(ids).toContain("campaign-landing");
      expect(ids).toContain("interactive-poll");
      expect(ids).toContain("contest-entry");
    });

    it("should have all required fields on each template", () => {
      for (const template of templates) {
        expect(template.id).toEqual(expect.any(String));
        expect(template.name).toEqual(expect.any(String));
        expect(template.description).toEqual(expect.any(String));
        expect(template.purpose).toEqual(expect.any(String));
        expect(template.tags).toEqual(expect.any(Array));
        expect(template.code).toEqual(expect.any(String));
        expect(template.id.length).toBeGreaterThan(0);
        expect(template.name.length).toBeGreaterThan(0);
        expect(template.description.length).toBeGreaterThan(0);
        expect(template.code.length).toBeGreaterThan(0);
        expect(template.tags.length).toBeGreaterThan(0);
      }
    });

    it("should have unique IDs across all templates", () => {
      const ids = templates.map(t => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe("getTemplateById", () => {
    it("should return the correct template for a valid ID", () => {
      const template = getTemplateById("link-in-bio");
      expect(template).toBeDefined();
      expect(template?.id).toBe("link-in-bio");
      expect(template?.name).toBe("Link-in-Bio Page");
    });

    it("should return each template by its ID", () => {
      for (const expected of templates) {
        const result = getTemplateById(expected.id);
        expect(result).toBeDefined();
        expect(result?.id).toBe(expected.id);
        expect(result?.name).toBe(expected.name);
        expect(result?.code).toBe(expected.code);
      }
    });

    it("should return undefined for an unknown ID", () => {
      expect(getTemplateById("nonexistent")).toBeUndefined();
    });

    it("should return undefined for an empty string", () => {
      expect(getTemplateById("")).toBeUndefined();
    });
  });

  describe("getAllTemplates", () => {
    it("should return all templates", () => {
      const all = getAllTemplates();
      expect(all).toHaveLength(4);
    });

    it("should return the same array as the templates export", () => {
      const all = getAllTemplates();
      expect(all).toBe(templates);
    });
  });
});
