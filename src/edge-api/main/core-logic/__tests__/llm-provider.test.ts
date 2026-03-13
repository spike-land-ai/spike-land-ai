import { afterEach, describe, expect, it, vi } from "vitest";
import {
  normalizeProviderName,
  inferProviderFromRawModel,
  parseModelSelection,
  getPlatformKey,
  resolveSynthesisTarget,
  PUBLIC_MODEL_ID,
} from "../llm-provider";
import type { Env } from "../env";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("normalizeProviderName", () => {
  it("normalizes known providers", () => {
    expect(normalizeProviderName("openai")).toBe("openai");
    expect(normalizeProviderName("anthropic")).toBe("anthropic");
    expect(normalizeProviderName("google")).toBe("google");
    expect(normalizeProviderName("gemini")).toBe("google");
    expect(normalizeProviderName("xai")).toBe("xai");
    expect(normalizeProviderName("grok")).toBe("xai");
  });

  it("returns undefined for unknown providers", () => {
    expect(normalizeProviderName("unknown")).toBeUndefined();
    expect(normalizeProviderName("")).toBeUndefined();
  });

  it("trims and lowercases", () => {
    expect(normalizeProviderName("  OpenAI  ")).toBe("openai");
  });
});

describe("inferProviderFromRawModel", () => {
  it("infers openai from gpt models", () => {
    expect(inferProviderFromRawModel("gpt-4.1")).toBe("openai");
    expect(inferProviderFromRawModel("o3-mini")).toBe("openai");
  });

  it("infers anthropic from claude models", () => {
    expect(inferProviderFromRawModel("claude-sonnet-4-20250514")).toBe("anthropic");
  });

  it("infers google from gemini models", () => {
    expect(inferProviderFromRawModel("gemini-2.5-flash")).toBe("google");
  });

  it("infers xai from grok models", () => {
    expect(inferProviderFromRawModel("grok-4-1")).toBe("xai");
  });

  it("returns undefined for unknown models", () => {
    expect(inferProviderFromRawModel("llama-3")).toBeUndefined();
  });
});

describe("parseModelSelection", () => {
  it("defaults to auto with spike-agent-v1", () => {
    const result = parseModelSelection({});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.publicModel).toBe(PUBLIC_MODEL_ID);
      expect(result.value.provider).toBe("auto");
    }
  });

  it("parses provider/model format", () => {
    const result = parseModelSelection({ model: "openai/gpt-4.1" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.provider).toBe("openai");
      expect(result.value.upstreamModel).toBe("gpt-4.1");
    }
  });

  it("rejects unsupported provider", () => {
    const result = parseModelSelection({ provider: "meta" });
    expect(result.ok).toBe(false);
  });

  it("rejects provider/model mismatch", () => {
    const result = parseModelSelection({ model: "openai/gpt-4.1", provider: "anthropic" });
    expect(result.ok).toBe(false);
  });

  it("infers provider from raw model name", () => {
    const result = parseModelSelection({ model: "grok-4-1" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.provider).toBe("xai");
      expect(result.value.upstreamModel).toBe("grok-4-1");
    }
  });
});

describe("getPlatformKey", () => {
  const env = {
    OPENAI_API_KEY: "sk-openai",
    CLAUDE_OAUTH_TOKEN: "sk-anthropic",
    GEMINI_API_KEY: "sk-gemini",
    XAI_API_KEY: "sk-xai",
  } as unknown as Env;

  it("returns correct keys for each provider", () => {
    expect(getPlatformKey(env, "openai")).toBe("sk-openai");
    expect(getPlatformKey(env, "anthropic")).toBe("sk-anthropic");
    expect(getPlatformKey(env, "google")).toBe("sk-gemini");
    expect(getPlatformKey(env, "xai")).toBe("sk-xai");
  });

  it("returns null when key missing", () => {
    const emptyEnv = {} as unknown as Env;
    expect(getPlatformKey(emptyEnv, "openai")).toBeNull();
  });
});

describe("resolveSynthesisTarget", () => {
  it("resolves auto target using platform keys", async () => {
    const env = {
      XAI_API_KEY: "sk-xai",
      MCP_SERVICE: { fetch: vi.fn(async () => new Response(JSON.stringify({}), { status: 404 })) },
    } as unknown as Env;

    const target = await resolveSynthesisTarget(env, undefined, {
      publicModel: PUBLIC_MODEL_ID,
      provider: "auto",
      upstreamModel: undefined,
    });

    expect(target).not.toBeNull();
    expect(target?.provider).toBe("xai");
    expect(target?.keySource).toBe("platform");
  });

  it("returns null when no provider available", async () => {
    const env = {
      MCP_SERVICE: { fetch: vi.fn(async () => new Response(JSON.stringify({}), { status: 404 })) },
    } as unknown as Env;

    const target = await resolveSynthesisTarget(env, undefined, {
      publicModel: PUBLIC_MODEL_ID,
      provider: "auto",
      upstreamModel: undefined,
    });

    expect(target).toBeNull();
  });

  it("resolves explicit provider", async () => {
    const env = {
      OPENAI_API_KEY: "sk-openai",
      MCP_SERVICE: { fetch: vi.fn(async () => new Response(JSON.stringify({}), { status: 404 })) },
    } as unknown as Env;

    const target = await resolveSynthesisTarget(env, undefined, {
      publicModel: "openai/gpt-4.1",
      provider: "openai",
      upstreamModel: "gpt-4.1",
    });

    expect(target?.provider).toBe("openai");
    expect(target?.upstreamModel).toBe("gpt-4.1");
    expect(target?.keySource).toBe("platform");
  });
});
