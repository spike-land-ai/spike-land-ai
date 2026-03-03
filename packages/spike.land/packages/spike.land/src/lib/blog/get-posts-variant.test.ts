import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockFs = vi.hoisted(() => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  readdirSync: vi.fn(() => []),
}));

vi.mock("fs", () => {
  const mod = { ...mockFs, default: mockFs };
  return mod;
});

vi.mock("react", () => ({
  cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

import { getPersonaVariant, readVariantData } from "./get-posts";

const BLOG_DIR = path.join(process.cwd(), "content/blog");

const validFrontmatter = `---
title: "Test Post for AI Indie"
slug: "test-post"
description: "A test post variant"
date: "2026-01-15"
author: "Test Author"
category: "Technology"
tags: ["ai", "indie"]
personaSlug: "ai-indie"
canonicalSlug: "test-post"
---

This is the variant content for the AI indie persona.`;

describe("readVariantData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should return null for invalid slug", () => {
    const result = readVariantData("../evil", "ai-indie");
    expect(result).toBeNull();
  });

  it("should return null for invalid personaSlug", () => {
    const result = readVariantData("test-post", "../evil");
    expect(result).toBeNull();
  });

  it("should return null for slug with spaces", () => {
    const result = readVariantData("test post", "ai-indie");
    expect(result).toBeNull();
  });

  it("should return null for personaSlug with dots", () => {
    const result = readVariantData("test-post", "ai.indie");
    expect(result).toBeNull();
  });

  it("should return null when variant file does not exist", () => {
    mockFs.existsSync.mockReturnValue(false);
    const result = readVariantData("test-post", "ai-indie");
    expect(result).toBeNull();
    expect(mockFs.existsSync).toHaveBeenCalledWith(
      path.join(BLOG_DIR, "test-post", "ai-indie.mdx"),
    );
  });

  it("should parse a valid variant MDX file", () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(validFrontmatter);

    const result = readVariantData("test-post", "ai-indie");

    expect(result).not.toBeNull();
    expect(result!.frontmatter.title).toBe("Test Post for AI Indie");
    expect(result!.frontmatter.personaSlug).toBe("ai-indie");
    expect(result!.frontmatter.canonicalSlug).toBe("test-post");
    expect(result!.slug).toBe("test-post");
    expect(result!.content).toContain("variant content");
    expect(result!.readingTime).toBeDefined();
  });

  it("should return null when readFileSync throws", () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockImplementation(() => {
      throw new Error("Read error");
    });

    const result = readVariantData("test-post", "ai-indie");
    expect(result).toBeNull();
  });

  it("should return null for invalid frontmatter", () => {
    const badFrontmatter = `---
title: ""
slug: ""
---

Content without required fields.`;

    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(badFrontmatter);

    const result = readVariantData("test-post", "ai-indie");
    expect(result).toBeNull();
  });
});

describe("getPersonaVariant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should return a variant when it exists", () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(validFrontmatter);

    const result = getPersonaVariant("test-post", "ai-indie");

    expect(result).not.toBeNull();
    expect(result!.frontmatter.personaSlug).toBe("ai-indie");
  });

  it("should return null for non-existent variant", () => {
    mockFs.existsSync.mockReturnValue(false);

    const result = getPersonaVariant("test-post", "nonexistent");
    expect(result).toBeNull();
  });

  it("should accept slugs with underscores and numbers", () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(validFrontmatter);

    const result = getPersonaVariant("post_123", "persona_v2");
    expect(result).not.toBeNull();
  });
});
