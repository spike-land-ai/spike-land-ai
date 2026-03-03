import { describe, expect, it } from "vitest";
import {
  cursorBlinkAnimation,
  fadeScaleVariants,
  gestures,
  progressBarAnimation,
  scalePopVariants,
  slideDownVariants,
  slideUpVariants,
  staggerDelay,
  subtleSlideUpVariants,
  transitions,
} from "./animation-variants";

describe("animation-variants", () => {
  describe("fadeScaleVariants", () => {
    it("should have initial, animate, and exit states", () => {
      expect(fadeScaleVariants).toHaveProperty("initial");
      expect(fadeScaleVariants).toHaveProperty("animate");
      expect(fadeScaleVariants).toHaveProperty("exit");
    });

    it("should start with 0 opacity and end with 1", () => {
      expect(fadeScaleVariants.initial).toEqual({ opacity: 0, scale: 0.95 });
      expect(fadeScaleVariants.animate).toEqual({ opacity: 1, scale: 1 });
    });
  });

  describe("slideUpVariants", () => {
    it("should translate from y:20 to y:0", () => {
      expect(slideUpVariants.initial).toEqual({ opacity: 0, y: 20 });
      expect(slideUpVariants.animate).toEqual({ opacity: 1, y: 0 });
    });
  });

  describe("slideDownVariants", () => {
    it("should translate from y:-20 to y:0", () => {
      expect(slideDownVariants.initial).toEqual({ opacity: 0, y: -20 });
      expect(slideDownVariants.animate).toEqual({ opacity: 1, y: 0 });
    });
  });

  describe("subtleSlideUpVariants", () => {
    it("should have smaller y offset than slideUp", () => {
      expect(subtleSlideUpVariants.initial).toEqual({ opacity: 0, y: 10 });
    });
  });

  describe("scalePopVariants", () => {
    it("should scale from 0.5 to 1", () => {
      expect(scalePopVariants.initial).toEqual({ opacity: 0, scale: 0.5 });
      expect(scalePopVariants.animate).toEqual({ opacity: 1, scale: 1 });
    });
  });

  describe("transitions", () => {
    it("should define standard, quick, slow, smooth, and spring presets", () => {
      expect(transitions.standard.duration).toBe(0.3);
      expect(transitions.quick.duration).toBe(0.2);
      expect(transitions.slow.duration).toBe(0.5);
      expect(transitions.smooth.ease).toBe("easeOut");
      expect(transitions.spring.type).toBe("spring");
    });
  });

  describe("gestures", () => {
    it("should define hover and tap presets", () => {
      expect(gestures.hoverScale.scale).toBe(1.05);
      expect(gestures.hoverScaleLarge.scale).toBe(1.1);
      expect(gestures.tap.scale).toBe(0.95);
      expect(gestures.tapSubtle.scale).toBe(0.98);
    });
  });

  describe("staggerDelay", () => {
    it("should calculate delay based on index and base delay", () => {
      expect(staggerDelay(0)).toEqual({ delay: 0 });
      expect(staggerDelay(3)).toEqual({ delay: 0.30000000000000004 });
      expect(staggerDelay(2, 0.2)).toEqual({ delay: 0.4 });
    });
  });

  describe("progressBarAnimation", () => {
    it("should start from width 0 with easeOut transition", () => {
      expect(progressBarAnimation.initial).toEqual({ width: 0 });
      expect(progressBarAnimation.transition.ease).toBe("easeOut");
    });
  });

  describe("cursorBlinkAnimation", () => {
    it("should animate opacity between 1 and 0 infinitely", () => {
      expect(cursorBlinkAnimation.animate.opacity).toEqual([1, 0]);
      expect(cursorBlinkAnimation.transition.repeat).toBe(Infinity);
    });
  });
});
