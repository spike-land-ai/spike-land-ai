import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import {
  ContextProvider,
  useAppContext,
  type PersonaSlug,
} from "@/ui/components/context/ContextProvider";
import { ConditionalBlock } from "@/ui/components/context/ConditionalBlock";
import { PersonaVariant } from "@/ui/components/context/PersonaVariant";
import { DynamicLayout, useLayoutGroup } from "@/ui/components/context/DynamicLayout";
import { ContextBlock } from "@/ui/components/context/ContextBlock";

// ── Mocks ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

function mockFetch(responses: Record<string, unknown> = {}): void {
  vi.spyOn(global, "fetch").mockImplementation(async (input) => {
    const url = typeof input === "string" ? input : (input as Request).url;
    const body = responses[url] ?? null;
    return {
      ok: body !== null,
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as Response;
  });
}

function renderWithProvider(
  ui: React.ReactNode,
  {
    featureFlagsUrl = null,
    sessionUrl = null,
    initialPersonaSlug,
  }: {
    featureFlagsUrl?: string | null;
    sessionUrl?: string | null;
    initialPersonaSlug?: PersonaSlug;
  } = {},
) {
  return render(
    <ContextProvider
      featureFlagsUrl={featureFlagsUrl}
      sessionUrl={sessionUrl}
      initialPersonaSlug={initialPersonaSlug ?? null}
    >
      {ui}
    </ContextProvider>,
  );
}

// ── ContextProvider ───────────────────────────────────────────────────────────

describe("ContextProvider", () => {
  it("exposes default context values", () => {
    mockFetch();
    let ctx!: ReturnType<typeof useAppContext>;
    function Probe() {
      ctx = useAppContext();
      return null;
    }
    renderWithProvider(<Probe />);
    expect(ctx.personaSlug).toBeNull();
    expect(ctx.session.isAuthenticated).toBe(false);
    expect(ctx.session.role).toBe("guest");
    expect(ctx.flags).toEqual({});
  });

  it("loads personaSlug from initialPersonaSlug prop", () => {
    mockFetch();
    let ctx!: ReturnType<typeof useAppContext>;
    function Probe() {
      ctx = useAppContext();
      return null;
    }
    renderWithProvider(<Probe />, { initialPersonaSlug: "ai-indie" });
    expect(ctx.personaSlug).toBe("ai-indie");
  });

  it("persists persona to localStorage via setPersona", () => {
    mockFetch();
    let ctx!: ReturnType<typeof useAppContext>;
    function Probe() {
      ctx = useAppContext();
      return null;
    }
    renderWithProvider(<Probe />);

    act(() => {
      ctx.setPersona("ml-engineer");
    });

    expect(ctx.personaSlug).toBe("ml-engineer");
    expect(localStorage.getItem("spike_persona_slug")).toBe("ml-engineer");
  });

  it("clears persona via clearPersona", () => {
    mockFetch();
    localStorage.setItem("spike_persona_slug", "ai-indie");
    let ctx!: ReturnType<typeof useAppContext>;
    function Probe() {
      ctx = useAppContext();
      return null;
    }
    renderWithProvider(<Probe />);
    expect(ctx.personaSlug).toBe("ai-indie");

    act(() => {
      ctx.clearPersona();
    });

    expect(ctx.personaSlug).toBeNull();
    expect(localStorage.getItem("spike_persona_slug")).toBeNull();
  });

  it("reads feature flags from API", async () => {
    mockFetch({ "/api/ff": { "beta-features": true, "new-ui": false } });
    let ctx!: ReturnType<typeof useAppContext>;
    function Probe() {
      ctx = useAppContext();
      return null;
    }
    await act(async () => {
      renderWithProvider(<Probe />, { featureFlagsUrl: "/api/ff" });
    });
    expect(ctx.flags["beta-features"]).toBe(true);
    expect(ctx.flags["new-ui"]).toBe(false);
  });

  it("reads session data from API", async () => {
    mockFetch({
      "/api/session": { userId: "u1", isAuthenticated: true, role: "pro", email: "a@b.com" },
    });
    let ctx!: ReturnType<typeof useAppContext>;
    function Probe() {
      ctx = useAppContext();
      return null;
    }
    await act(async () => {
      renderWithProvider(<Probe />, { sessionUrl: "/api/session" });
    });
    expect(ctx.session.isAuthenticated).toBe(true);
    expect(ctx.session.role).toBe("pro");
    expect(ctx.session.email).toBe("a@b.com");
  });

  it("setRole overrides role immediately", () => {
    mockFetch();
    let ctx!: ReturnType<typeof useAppContext>;
    function Probe() {
      ctx = useAppContext();
      return null;
    }
    renderWithProvider(<Probe />);
    act(() => {
      ctx.setRole("admin");
    });
    expect(ctx.session.role).toBe("admin");
  });
});

// ── ConditionalBlock ──────────────────────────────────────────────────────────

describe("ConditionalBlock", () => {
  it("shows children when persona matches", () => {
    mockFetch();
    renderWithProvider(
      <ConditionalBlock when={{ persona: "ai-indie" }}>
        <span>for builders</span>
      </ConditionalBlock>,
      { initialPersonaSlug: "ai-indie" },
    );
    expect(screen.getByText("for builders")).toBeInTheDocument();
  });

  it("hides children when persona does not match", () => {
    mockFetch();
    renderWithProvider(
      <ConditionalBlock when={{ persona: "ai-indie" }}>
        <span>for builders</span>
      </ConditionalBlock>,
      { initialPersonaSlug: "solo-explorer" },
    );
    expect(screen.queryByText("for builders")).not.toBeInTheDocument();
  });

  it("shows fallback when condition fails", () => {
    mockFetch();
    renderWithProvider(
      <ConditionalBlock when={{ persona: "ai-indie" }} fallback={<span>fallback</span>}>
        <span>hidden</span>
      </ConditionalBlock>,
      { initialPersonaSlug: "solo-explorer" },
    );
    expect(screen.getByText("fallback")).toBeInTheDocument();
    expect(screen.queryByText("hidden")).not.toBeInTheDocument();
  });

  it("handles unless exclusion", () => {
    mockFetch();
    renderWithProvider(
      <ConditionalBlock unless={{ persona: "solo-explorer" }}>
        <span>not for explorers</span>
      </ConditionalBlock>,
      { initialPersonaSlug: "solo-explorer" },
    );
    expect(screen.queryByText("not for explorers")).not.toBeInTheDocument();
  });

  it("supports OR logic across persona array", () => {
    mockFetch();
    renderWithProvider(
      <ConditionalBlock when={[{ persona: "ai-indie" }, { persona: "ml-engineer" }]} logic="or">
        <span>ai section</span>
      </ConditionalBlock>,
      { initialPersonaSlug: "ml-engineer" },
    );
    expect(screen.getByText("ai section")).toBeInTheDocument();
  });

  it("supports AND logic requiring all conditions", async () => {
    mockFetch({ "/api/ff": { "beta-features": true } });
    await act(async () => {
      renderWithProvider(
        <ConditionalBlock when={{ role: "admin", flag: "beta-features" }} logic="and">
          <span>admin beta</span>
        </ConditionalBlock>,
        { featureFlagsUrl: "/api/ff" },
      );
    });
    // role is guest by default — AND should fail
    expect(screen.queryByText("admin beta")).not.toBeInTheDocument();
  });

  it("shows content when no conditions are provided", () => {
    mockFetch();
    renderWithProvider(
      <ConditionalBlock>
        <span>always visible</span>
      </ConditionalBlock>,
    );
    expect(screen.getByText("always visible")).toBeInTheDocument();
  });
});

// ── PersonaVariant ────────────────────────────────────────────────────────────

describe("PersonaVariant", () => {
  it("renders matching variant for current persona", () => {
    mockFetch();
    renderWithProvider(
      <PersonaVariant
        variants={{ "ai-indie": <span>builder view</span>, default: <span>default view</span> }}
        transitionDuration={0}
      />,
      { initialPersonaSlug: "ai-indie" },
    );
    expect(screen.getByText("builder view")).toBeInTheDocument();
    expect(screen.queryByText("default view")).not.toBeInTheDocument();
  });

  it("renders default when persona is null", () => {
    mockFetch();
    renderWithProvider(
      <PersonaVariant
        variants={{ "ai-indie": <span>builder view</span>, default: <span>default view</span> }}
        transitionDuration={0}
      />,
    );
    expect(screen.getByText("default view")).toBeInTheDocument();
  });

  it("renders default when persona has no matching variant", () => {
    mockFetch();
    renderWithProvider(
      <PersonaVariant
        variants={{ "ai-indie": <span>builder view</span>, default: <span>default view</span> }}
        transitionDuration={0}
      />,
      { initialPersonaSlug: "solo-explorer" },
    );
    expect(screen.getByText("default view")).toBeInTheDocument();
  });
});

// ── DynamicLayout ─────────────────────────────────────────────────────────────

describe("DynamicLayout", () => {
  it("renders all sections", () => {
    mockFetch();
    renderWithProvider(
      <DynamicLayout
        sections={{ tools: <span>tools section</span>, tutorials: <span>tutorials</span> }}
      />,
      { initialPersonaSlug: "ai-indie" },
    );
    expect(screen.getByText("tools section")).toBeInTheDocument();
    expect(screen.getByText("tutorials")).toBeInTheDocument();
  });

  it("orders tools first for builder personas", () => {
    mockFetch();
    const { container } = renderWithProvider(
      <DynamicLayout
        sections={{
          tutorials: <span>tutorials</span>,
          tools: <span>tools section</span>,
          featured: <span>featured</span>,
        }}
      />,
      { initialPersonaSlug: "ai-indie" },
    );

    const sections = container.querySelectorAll("[data-section]");
    const keys = Array.from(sections).map((el) => el.getAttribute("data-section"));
    expect(keys[0]).toBe("tools");
  });

  it("orders dashboard first for analyst personas", () => {
    mockFetch();
    const { container } = renderWithProvider(
      <DynamicLayout
        sections={{
          tools: <span>tools</span>,
          dataTools: <span>data tools</span>,
          dashboard: <span>dashboard</span>,
        }}
      />,
      { initialPersonaSlug: "ml-engineer" },
    );

    const sections = container.querySelectorAll("[data-section]");
    const keys = Array.from(sections).map((el) => el.getAttribute("data-section"));
    expect(keys[0]).toBe("dashboard");
  });
});

// ── useLayoutGroup ────────────────────────────────────────────────────────────

describe("useLayoutGroup", () => {
  it("returns 'builder' for ai-indie persona", () => {
    mockFetch();
    let group!: string;
    function Probe() {
      group = useLayoutGroup();
      return null;
    }
    renderWithProvider(<Probe />, { initialPersonaSlug: "ai-indie" });
    expect(group).toBe("builder");
  });

  it("returns 'default' when no persona set", () => {
    mockFetch();
    let group!: string;
    function Probe() {
      group = useLayoutGroup();
      return null;
    }
    renderWithProvider(<Probe />);
    expect(group).toBe("default");
  });
});

// ── ContextBlock ──────────────────────────────────────────────────────────────

describe("ContextBlock", () => {
  it("renders children when persona attribute matches", () => {
    mockFetch();
    renderWithProvider(
      <ContextBlock persona="ai-indie">
        <span>context block content</span>
      </ContextBlock>,
      { initialPersonaSlug: "ai-indie" },
    );
    expect(screen.getByText("context block content")).toBeInTheDocument();
  });

  it("hides children when persona does not match", () => {
    mockFetch();
    renderWithProvider(
      <ContextBlock persona="ai-indie">
        <span>hidden content</span>
      </ContextBlock>,
      { initialPersonaSlug: "solo-explorer" },
    );
    expect(screen.queryByText("hidden content")).not.toBeInTheDocument();
  });

  it("supports comma-separated personas attribute", () => {
    mockFetch();
    renderWithProvider(
      <ContextBlock personas="ai-indie,ml-engineer">
        <span>ai content</span>
      </ContextBlock>,
      { initialPersonaSlug: "ml-engineer" },
    );
    expect(screen.getByText("ai content")).toBeInTheDocument();
  });

  it("supports unless-persona exclusion", () => {
    mockFetch();
    renderWithProvider(
      <ContextBlock unless-persona="solo-explorer">
        <span>excluded</span>
      </ContextBlock>,
      { initialPersonaSlug: "solo-explorer" },
    );
    expect(screen.queryByText("excluded")).not.toBeInTheDocument();
  });

  it("renders unconditionally when no attributes provided", () => {
    mockFetch();
    renderWithProvider(
      <ContextBlock>
        <span>always shown</span>
      </ContextBlock>,
    );
    expect(screen.getByText("always shown")).toBeInTheDocument();
  });
});
