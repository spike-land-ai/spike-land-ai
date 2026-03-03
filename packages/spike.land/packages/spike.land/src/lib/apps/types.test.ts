import { describe, expect, it } from "vitest";

import type {
  AgentStage,
  AppData,
  AppMessage,
  PageMode,
  PendingFile,
  PendingImage,
} from "./types";

describe("apps/types", () => {
  describe("AppMessage", () => {
    it("should allow creating a valid AppMessage", () => {
      const message: AppMessage = {
        id: "msg-1",
        role: "USER",
        content: "Hello world",
        createdAt: "2026-02-18T12:00:00Z",
      };

      expect(message.id).toBe("msg-1");
      expect(message.role).toBe("USER");
      expect(message.content).toBe("Hello world");
      expect(message.createdAt).toBe("2026-02-18T12:00:00Z");
    });

    it("should allow all valid role values", () => {
      const roles: AppMessage["role"][] = ["USER", "AGENT", "SYSTEM"];
      expect(roles).toHaveLength(3);
    });

    it("should allow optional attachments", () => {
      const withAttachments: AppMessage = {
        id: "msg-2",
        role: "AGENT",
        content: "Here is an image",
        createdAt: "2026-02-18T12:00:00Z",
        attachments: [
          {
            image: {
              id: "img-1",
              originalUrl: "https://example.com/image.png",
            },
          },
        ],
      };

      expect(withAttachments.attachments).toHaveLength(1);
      expect(withAttachments.attachments?.[0]?.image.id).toBe("img-1");
    });

    it("should allow optional codeVersion", () => {
      const withVersion: AppMessage = {
        id: "msg-3",
        role: "AGENT",
        content: "Code updated",
        createdAt: "2026-02-18T12:00:00Z",
        codeVersion: {
          id: "v1",
          createdAt: "2026-02-18T12:00:00Z",
        },
      };

      expect(withVersion.codeVersion?.id).toBe("v1");
    });
  });

  describe("AppData", () => {
    it("should allow creating a valid AppData object", () => {
      const app: AppData = {
        id: "app-1",
        name: "My App",
        description: "A test app",
        status: "LIVE",
        codespaceId: "cs-1",
        codespaceUrl: "https://example.com/cs",
        isPublic: true,
        isCurated: false,
        lastAgentActivity: "2026-02-18T12:00:00Z",
        agentWorking: false,
        createdAt: "2026-02-01T00:00:00Z",
        updatedAt: "2026-02-18T12:00:00Z",
        requirements: [{ id: "req-1", content: "Must be fast" }],
        monetizationModels: [{ id: "mon-1", model: "free" }],
        statusHistory: [
          {
            id: "sh-1",
            status: "LIVE",
            message: "Deployed",
            createdAt: "2026-02-18T12:00:00Z",
          },
        ],
        _count: { messages: 10, images: 3 },
      };

      expect(app.id).toBe("app-1");
      expect(app.name).toBe("My App");
      expect(app.status).toBe("LIVE");
      expect(app.isPublic).toBe(true);
      expect(app._count.messages).toBe(10);
    });

    it("should allow nullable fields", () => {
      const app: AppData = {
        id: "app-2",
        name: "Minimal App",
        description: null,
        status: "PROMPTING",
        codespaceId: null,
        codespaceUrl: null,
        isPublic: false,
        isCurated: false,
        lastAgentActivity: null,
        agentWorking: false,
        createdAt: "2026-02-01T00:00:00Z",
        updatedAt: "2026-02-01T00:00:00Z",
        requirements: [],
        monetizationModels: [],
        statusHistory: [],
        _count: { messages: 0, images: 0 },
      };

      expect(app.description).toBeNull();
      expect(app.codespaceId).toBeNull();
      expect(app.codespaceUrl).toBeNull();
      expect(app.lastAgentActivity).toBeNull();
    });
  });

  describe("PendingImage", () => {
    it("should have expected properties", () => {
      // PendingImage requires a File object - we verify the type shape
      const img: PendingImage = {
        id: "img-1",
        file: new File(["data"], "test.png", { type: "image/png" }),
        previewUrl: "blob:http://localhost/abc",
      };

      expect(img.id).toBe("img-1");
      expect(img.file).toBeInstanceOf(File);
      expect(img.previewUrl).toContain("blob:");
    });
  });

  describe("PendingFile", () => {
    it("should have expected properties", () => {
      const file: PendingFile = {
        id: "file-1",
        file: new File(["data"], "doc.pdf", { type: "application/pdf" }),
      };

      expect(file.id).toBe("file-1");
      expect(file.file.name).toBe("doc.pdf");
    });
  });

  describe("PageMode", () => {
    it("should allow all valid page modes", () => {
      const modes: PageMode[] = ["loading", "prompt", "workspace"];
      expect(modes).toHaveLength(3);
    });
  });

  describe("AgentStage", () => {
    it("should allow all valid agent stages", () => {
      const stages: AgentStage[] = [
        "initialize",
        "processing",
        "executing_tool",
        "validating",
        "complete",
        "error",
      ];
      expect(stages).toHaveLength(6);
    });
  });
});
