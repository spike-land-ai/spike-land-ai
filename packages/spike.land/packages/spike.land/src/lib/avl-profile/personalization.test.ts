import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  avlProfileTree: {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  avlProfileNode: {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  avlTraversalSession: {
    findUniqueOrThrow: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  },
  avlUserProfile: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  $transaction: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

const mockStoreApps = vi.hoisted(() => ({
  STORE_APPS: [
    {
      id: "app1",
      slug: "dev-tool",
      name: "Dev Tool",
      category: "developer",
      tags: ["developer"],
    },
    {
      id: "app2",
      slug: "creative-app",
      name: "Creative App",
      category: "creative",
      tags: ["creative"],
    },
    {
      id: "app3",
      slug: "chat-app",
      name: "Chat App",
      category: "communication",
      tags: [],
    },
  ],
}));
vi.mock("@/app/store/data/store-apps", () => mockStoreApps);

import {
  buildProfileVector,
  deriveTagsFromAnswerPath,
  getPersonalizedApps,
} from "./personalization";

describe("personalization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getPersonalizedApps", () => {
    it("returns all apps when no profile exists", async () => {
      mockPrisma.avlUserProfile.findUnique.mockResolvedValue(null);

      const result = await getPersonalizedApps("user-1");
      expect(result).toHaveLength(3);
    });

    it("filters developer apps for non-developers", async () => {
      mockPrisma.avlUserProfile.findUnique.mockResolvedValue({
        id: "profile-1",
        userId: "user-1",
        derivedTags: ["creative"],
      });

      const result = await getPersonalizedApps("user-1");
      expect(result).toHaveLength(2);
      expect(result.find(app => app.id === "app1")).toBeUndefined();
      expect(result.find(app => app.id === "app2")).toBeDefined();
      expect(result.find(app => app.id === "app3")).toBeDefined();
    });

    it("keeps developer apps for developers", async () => {
      mockPrisma.avlUserProfile.findUnique.mockResolvedValue({
        id: "profile-1",
        userId: "user-1",
        derivedTags: ["developer"],
      });

      const result = await getPersonalizedApps("user-1");
      expect(result).toHaveLength(3);
      expect(result.find(app => app.id === "app1")).toBeDefined();
    });
  });

  describe("deriveTagsFromAnswerPath", () => {
    it("collects tags from yes answers", () => {
      const path = [
        {
          nodeId: "n1",
          question: "Q1?",
          questionTags: ["developer", "technical"],
          answer: true,
        },
        {
          nodeId: "n2",
          question: "Q2?",
          questionTags: ["creative"],
          answer: true,
        },
      ];

      const result = deriveTagsFromAnswerPath(path);
      expect(result).toEqual(["creative", "developer", "technical"]);
    });

    it("ignores no answers", () => {
      const path = [
        {
          nodeId: "n1",
          question: "Q1?",
          questionTags: ["developer"],
          answer: true,
        },
        {
          nodeId: "n2",
          question: "Q2?",
          questionTags: ["creative"],
          answer: false,
        },
      ];

      const result = deriveTagsFromAnswerPath(path);
      expect(result).toEqual(["developer"]);
      expect(result).not.toContain("creative");
    });

    it("deduplicates and sorts", () => {
      const path = [
        {
          nodeId: "n1",
          question: "Q1?",
          questionTags: ["developer", "technical"],
          answer: true,
        },
        {
          nodeId: "n2",
          question: "Q2?",
          questionTags: ["developer", "api"],
          answer: true,
        },
      ];

      const result = deriveTagsFromAnswerPath(path);
      expect(result).toEqual(["api", "developer", "technical"]);
      // No duplicates
      expect(result.filter(t => t === "developer")).toHaveLength(1);
    });
  });

  describe("buildProfileVector", () => {
    it("maps tags to 1.0/0.0", () => {
      const path = [
        {
          nodeId: "n1",
          question: "Q1?",
          questionTags: ["developer"],
          answer: true,
        },
        {
          nodeId: "n2",
          question: "Q2?",
          questionTags: ["creative"],
          answer: false,
        },
      ];

      const allTags = ["developer", "creative", "marketing"];
      const result = buildProfileVector(path, allTags);

      expect(result).toEqual({
        developer: 1.0,
        creative: 0.0,
        marketing: 0.0,
      });
    });

    it("returns empty object when no tags provided", () => {
      const result = buildProfileVector([], []);
      expect(result).toEqual({});
    });
  });
});
