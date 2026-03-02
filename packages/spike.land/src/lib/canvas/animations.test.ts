import { describe, expect, it } from "vitest";
import {
  ANIMATION_DURATIONS,
  ANIMATION_EASINGS,
  calculateHeroTransform,
  HERO_TRANSFORM_CSS_VARS,
} from "./animations";

describe("canvas animations", () => {
  describe("ANIMATION_DURATIONS", () => {
    it("should have positive duration values", () => {
      expect(ANIMATION_DURATIONS.heroExpand).toBeGreaterThan(0);
      expect(ANIMATION_DURATIONS.heroCollapse).toBeGreaterThan(0);
      expect(ANIMATION_DURATIONS.gridFade).toBeGreaterThan(0);
      expect(ANIMATION_DURATIONS.thumbnailSwap).toBeGreaterThan(0);
      expect(ANIMATION_DURATIONS.peekTransition).toBeGreaterThan(0);
    });

    it("should have hero durations equal", () => {
      expect(ANIMATION_DURATIONS.heroExpand).toBe(ANIMATION_DURATIONS.heroCollapse);
    });
  });

  describe("ANIMATION_EASINGS", () => {
    it("should have cubic-bezier values", () => {
      expect(ANIMATION_EASINGS.standard).toMatch(/^cubic-bezier/);
      expect(ANIMATION_EASINGS.enter).toMatch(/^cubic-bezier/);
      expect(ANIMATION_EASINGS.exit).toMatch(/^cubic-bezier/);
      expect(ANIMATION_EASINGS.elastic).toMatch(/^cubic-bezier/);
    });
  });

  describe("HERO_TRANSFORM_CSS_VARS", () => {
    it("should have CSS custom property names starting with --", () => {
      expect(HERO_TRANSFORM_CSS_VARS.x).toMatch(/^--/);
      expect(HERO_TRANSFORM_CSS_VARS.y).toMatch(/^--/);
      expect(HERO_TRANSFORM_CSS_VARS.scaleX).toMatch(/^--/);
      expect(HERO_TRANSFORM_CSS_VARS.scaleY).toMatch(/^--/);
      expect(HERO_TRANSFORM_CSS_VARS.scale).toMatch(/^--/);
    });
  });

  describe("calculateHeroTransform", () => {
    it("should return zero transform when rects are identical", () => {
      const rect = { x: 100, y: 100, width: 200, height: 150 } as DOMRect;
      const result = calculateHeroTransform(rect, rect);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
      expect(result.scaleX).toBe(1);
      expect(result.scaleY).toBe(1);
    });

    it("should calculate correct translation between rects", () => {
      const fromRect = {
        x: 50,
        y: 50,
        width: 100,
        height: 100,
      } as DOMRect;
      const toRect = {
        x: 0,
        y: 0,
        width: 200,
        height: 200,
      } as DOMRect;

      const result = calculateHeroTransform(fromRect, toRect);

      // fromCenter = (100, 100), toCenter = (100, 100)
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
      expect(result.scaleX).toBe(0.5);
      expect(result.scaleY).toBe(0.5);
    });

    it("should calculate positive translation for offset rect", () => {
      const fromRect = {
        x: 300,
        y: 200,
        width: 50,
        height: 50,
      } as DOMRect;
      const toRect = {
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      } as DOMRect;

      const result = calculateHeroTransform(fromRect, toRect);

      // fromCenter = (325, 225), toCenter = (50, 50)
      expect(result.x).toBe(275);
      expect(result.y).toBe(175);
      expect(result.scaleX).toBe(0.5);
      expect(result.scaleY).toBe(0.5);
    });

    it("should handle non-square rects", () => {
      const fromRect = {
        x: 0,
        y: 0,
        width: 160,
        height: 90,
      } as DOMRect;
      const toRect = {
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
      } as DOMRect;

      const result = calculateHeroTransform(fromRect, toRect);

      expect(result.scaleX).toBeCloseTo(160 / 1920, 5);
      expect(result.scaleY).toBeCloseTo(90 / 1080, 5);
    });

    it("should use default viewport when toRect not provided", () => {
      const fromRect = {
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      } as DOMRect;

      const result = calculateHeroTransform(fromRect);

      // In test env (jsdom), window exists with innerWidth/innerHeight
      // Scale should be fraction of viewport
      expect(result.scaleX).toBeGreaterThan(0);
      expect(result.scaleX).toBeLessThan(1);
      expect(result.scaleY).toBeGreaterThan(0);
      expect(result.scaleY).toBeLessThan(1);
    });
  });
});
