import { describe, expect, it } from "vitest";

import {
  DEFAULT_INTERVAL,
  DEFAULT_ORDER,
  DEFAULT_ROTATION,
  MASONRY_BREAKPOINTS_GALLERY,
  MASONRY_BREAKPOINTS_LANDING,
  MASONRY_CLASSES,
  MASONRY_ITEM_MARGIN,
} from "./constants";

describe("MASONRY_BREAKPOINTS_GALLERY", () => {
  it("has 4 columns by default", () => {
    expect(MASONRY_BREAKPOINTS_GALLERY.default).toBe(4);
  });

  it("reduces columns for smaller screens", () => {
    expect(MASONRY_BREAKPOINTS_GALLERY[1024]).toBe(3);
    expect(MASONRY_BREAKPOINTS_GALLERY[768]).toBe(2);
    expect(MASONRY_BREAKPOINTS_GALLERY[640]).toBe(2);
  });
});

describe("MASONRY_BREAKPOINTS_LANDING", () => {
  it("has 3 columns by default", () => {
    expect(MASONRY_BREAKPOINTS_LANDING.default).toBe(3);
  });

  it("goes to 1 column on mobile", () => {
    expect(MASONRY_BREAKPOINTS_LANDING[640]).toBe(1);
  });
});

describe("MASONRY_CLASSES", () => {
  it("has container and column classes", () => {
    expect(MASONRY_CLASSES.container).toBeDefined();
    expect(MASONRY_CLASSES.column).toBeDefined();
  });
});

describe("defaults", () => {
  it("MASONRY_ITEM_MARGIN is defined", () => {
    expect(MASONRY_ITEM_MARGIN).toBe("mb-6");
  });

  it("DEFAULT_INTERVAL is 10", () => {
    expect(DEFAULT_INTERVAL).toBe(10);
  });

  it("DEFAULT_ROTATION is 0", () => {
    expect(DEFAULT_ROTATION).toBe(0);
  });

  it("DEFAULT_ORDER is album", () => {
    expect(DEFAULT_ORDER).toBe("album");
  });
});
