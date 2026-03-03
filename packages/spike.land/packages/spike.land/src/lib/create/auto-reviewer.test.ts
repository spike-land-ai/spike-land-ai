import { beforeEach, describe, expect, it, vi } from "vitest";
import { runAutoReview } from "./auto-reviewer";

vi.mock("@/lib/codespace/transpile", () => ({
  transpileCode: vi.fn(),
}));

vi.mock("./codespace-health", () => ({
  isCodespaceHealthy: vi.fn(),
}));

vi.mock("@/lib/codespace/session-service", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { transpileCode } = await import("@/lib/codespace/transpile");
const { isCodespaceHealthy } = await import("./codespace-health");
const { getSession } = await import("@/lib/codespace/session-service");

const mockTranspile = vi.mocked(transpileCode);
const mockHealthy = vi.mocked(isCodespaceHealthy);
const mockGetSession = vi.mocked(getSession);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runAutoReview", () => {
  it("passes when all checks succeed", async () => {
    mockTranspile.mockResolvedValue("transpiled code");
    mockGetSession.mockResolvedValue(
      {
        code: "const x = 1; export default function App() { return <div>hello</div>; }",
        transpiled:
          "var x = 1; export default function App() { return React.createElement('div', null, 'hello'); }",
        html: "",
        css: "",
      } as ReturnType<typeof getSession> extends Promise<infer T> ? T : never,
    );
    mockHealthy.mockResolvedValue(true);

    const result = await runAutoReview("test-codespace", "const x = 1;");

    expect(result.passed).toBe(true);
    expect(result.score).toBe(1);
    expect(result.checks.transpile.passed).toBe(true);
    expect(result.checks.bundle.passed).toBe(true);
    expect(result.checks.health.passed).toBe(true);
  });

  it("fails when transpile fails", async () => {
    mockTranspile.mockRejectedValue(new Error("Syntax error"));
    mockGetSession.mockResolvedValue(
      {
        code: "bad code",
        transpiled:
          "var x = 1; export default function App() { return React.createElement('div'); }",
        html: "",
        css: "",
      } as ReturnType<typeof getSession> extends Promise<infer T> ? T : never,
    );
    mockHealthy.mockResolvedValue(true);

    const result = await runAutoReview("test-codespace", "bad code");

    expect(result.passed).toBe(false);
    expect(result.checks.transpile.passed).toBe(false);
    expect(result.checks.transpile.error).toBe("Syntax error");
  });

  it("fails when health check fails", async () => {
    mockTranspile.mockResolvedValue("transpiled");
    mockGetSession.mockResolvedValue(
      {
        code: "good code",
        transpiled:
          "var x = 1; export default function App() { return React.createElement('div'); }",
        html: "",
        css: "",
      } as ReturnType<typeof getSession> extends Promise<infer T> ? T : never,
    );
    mockHealthy.mockResolvedValue(false);

    const result = await runAutoReview("test-codespace", "good code");

    expect(result.passed).toBe(false);
    expect(result.checks.health.passed).toBe(false);
  });

  it("fails when bundle check finds no transpiled output", async () => {
    mockTranspile.mockResolvedValue("transpiled");
    mockGetSession.mockResolvedValue(
      {
        code: "good code",
        transpiled: "",
        html: "",
        css: "",
      } as ReturnType<typeof getSession> extends Promise<infer T> ? T : never,
    );
    mockHealthy.mockResolvedValue(true);

    const result = await runAutoReview("test-codespace", "good code");

    expect(result.passed).toBe(false);
    expect(result.checks.bundle.passed).toBe(false);
  });

  it("calculates score as fraction of passing checks", async () => {
    mockTranspile.mockResolvedValue("transpiled");
    mockGetSession.mockResolvedValue(
      {
        code: "good code",
        transpiled:
          "var x = 1; export default function App() { return React.createElement('div'); }",
        html: "",
        css: "",
      } as ReturnType<typeof getSession> extends Promise<infer T> ? T : never,
    );
    mockHealthy.mockResolvedValue(false);

    const result = await runAutoReview("test-codespace", "good code");

    // transpile passes, bundle passes, health fails => 2/3
    expect(result.score).toBeCloseTo(2 / 3, 5);
  });

  it("fetches code from session when not provided", async () => {
    const sessionCode = "const y = 2; export default function App() { return <div/>; }";
    mockGetSession.mockResolvedValue(
      {
        code: sessionCode,
        transpiled:
          "var y = 2; export default function App() { return React.createElement('div'); }",
        html: "",
        css: "",
      } as ReturnType<typeof getSession> extends Promise<infer T> ? T : never,
    );
    mockTranspile.mockResolvedValue("transpiled");
    mockHealthy.mockResolvedValue(true);

    const result = await runAutoReview("test-codespace");

    expect(result.passed).toBe(true);
    expect(mockTranspile).toHaveBeenCalledWith(sessionCode);
  });
});
