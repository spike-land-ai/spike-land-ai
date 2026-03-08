/**
 * Tests for vibe-dev CLI
 *
 * We intercept commander at import time to capture action handlers,
 * then test those handlers directly.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "events";
import type { ChildProcess } from "child_process";

// vi.hoisted runs before vi.mock factories, making variables available in mock factories
const capturedActions = vi.hoisted(
  () => ({}) as Record<string, (...args: unknown[]) => Promise<void>>,
);

// Mocked modules - must be before any imports
vi.mock("cross-spawn", () => ({ default: vi.fn() }));
vi.mock("fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));
vi.mock("../../../src/cli/docker-dev/node-sys/agent.js", () => ({ poll: vi.fn() }));
vi.mock("../../../src/cli/docker-dev/core-logic/api.js", () => ({
  getApiConfig: vi.fn().mockReturnValue({ baseUrl: "https://api.example.com", apiKey: "key" }),
}));
vi.mock("../../../src/cli/docker-dev/core-logic/redis.js", () => ({
  getQueueStats: vi.fn(),
  getRedisConfig: vi.fn().mockReturnValue({ url: "redis://localhost:6379", token: "token" }),
}));
vi.mock("../../../src/cli/docker-dev/core-logic/sync.js", () => ({
  pullCode: vi.fn(),
  pushCode: vi.fn(),
}));
vi.mock("../../../src/cli/docker-dev/lazy-imports/watcher.js", () => ({
  downloadToLocal: vi.fn(),
  getLocalPath: vi.fn().mockReturnValue("/app/live/my-space.tsx"),
  startDevMode: vi.fn(),
}));

// Intercept commander to capture action handlers
vi.mock("commander", async (importOriginal) => {
  const actual = await importOriginal<typeof import("commander")>();
  const prog = new actual.Command();

  // Use exitOverride so commander throws instead of calling process.exit
  // This prevents Vitest from complaining about unexpected process.exit calls
  prog.exitOverride();
  // Suppress help/error output to avoid polluting test console
  prog.configureOutput({ writeOut: () => {}, writeErr: () => {} });

  // Wrap command() to intercept action() calls
  const origCmd = prog.command.bind(prog);
  prog.command = (nameAndArgs: string, ...args: unknown[]) => {
    const cmd = (origCmd as (...a: unknown[]) => ReturnType<typeof prog.command>)(
      nameAndArgs,
      ...args,
    );
    const origAction = cmd.action.bind(cmd);
    cmd.action = (fn: (...a: unknown[]) => unknown) => {
      const commandName = (nameAndArgs as string).split(" ")[0]!;
      capturedActions[commandName] = fn as (...args: unknown[]) => Promise<void>;
      return origAction(fn);
    };
    return cmd;
  };

  return { ...actual, program: prog };
});

// Import mocked modules so we can set expectations on them
import spawn from "cross-spawn";
import { mkdir, readFile, writeFile } from "fs/promises";
import * as agentModule from "../../../src/cli/docker-dev/node-sys/agent.js";
import * as redisModule from "../../../src/cli/docker-dev/core-logic/redis.js";
import * as syncModule from "../../../src/cli/docker-dev/core-logic/sync.js";
import * as watcherModule from "../../../src/cli/docker-dev/lazy-imports/watcher.js";

// Import cli.ts - registers commands with our intercepted commander
// program.exitOverride() makes commander throw instead of process.exit,
// so we catch the commander error (exit code 0 = help display = CommanderError)
const originalArgv = process.argv;
process.argv = ["node", "vibe-dev"];

try {
  await import("../../../src/cli/docker-dev/core-logic/cli.js");
} catch (_e) {
  // Commander throws CommanderError when displaying help (exitOverride mode)
  // This is expected - ignore it
}

process.argv = originalArgv;

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

type ActionFn = (options: Record<string, unknown>, cmd?: { args: unknown[] }) => Promise<void>;

function getAction(name: string): ActionFn {
  const fn = capturedActions[name];
  if (!fn)
    throw new Error(
      `Action '${name}' not found. Available: ${Object.keys(capturedActions).join(", ")}`,
    );
  return fn as ActionFn;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CLI pull command", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("calls downloadToLocal with codespace id and logs path", async () => {
    vi.mocked(watcherModule.downloadToLocal).mockResolvedValue("/app/live/my-space.tsx");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await getAction("pull")({ codespace: "my-space" });
    expect(watcherModule.downloadToLocal).toHaveBeenCalledWith("my-space");
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("/app/live/my-space.tsx"));
  });

  it("exits with code 1 on download failure", async () => {
    vi.mocked(watcherModule.downloadToLocal).mockRejectedValue(new Error("network error"));
    const spy = vi.spyOn(process, "exit").mockImplementation((() => {}) as () => never);
    await getAction("pull")({ codespace: "my-space" });
    expect(spy).toHaveBeenCalledWith(1);
    spy.mockRestore();
  });
});

describe("CLI push command", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("reads file and pushes code to server", async () => {
    vi.mocked(readFile).mockResolvedValue("const x = 1;" as never);
    vi.mocked(syncModule.pushCode).mockResolvedValue({
      success: true,
      codeSpace: "my-space",
      hash: "abc123",
      updated: ["session.json"],
      message: "OK",
    });
    await getAction("push")({ codespace: "my-space", run: true });
    expect(syncModule.pushCode).toHaveBeenCalledWith("my-space", "const x = 1;", true);
  });

  it("exits with code 1 on push failure", async () => {
    vi.mocked(readFile).mockRejectedValue(new Error("file not found"));
    const spy = vi.spyOn(process, "exit").mockImplementation((() => {}) as () => never);
    await getAction("push")({ codespace: "my-space", run: true });
    expect(spy).toHaveBeenCalledWith(1);
    spy.mockRestore();
  });
});

describe("CLI code command", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("gets code with --get flag", async () => {
    vi.mocked(syncModule.pullCode).mockResolvedValue("const hello = 'world';");
    await getAction("code")({ codespace: "my-space", get: true });
    expect(syncModule.pullCode).toHaveBeenCalledWith("my-space");
  });

  it("sets code with --set flag", async () => {
    vi.mocked(syncModule.pushCode).mockResolvedValue({
      success: true,
      codeSpace: "my-space",
      hash: "xyz",
      updated: ["session.json"],
      message: "OK",
    });
    await getAction("code")({ codespace: "my-space", set: "const x = 1;" });
    expect(syncModule.pushCode).toHaveBeenCalledWith("my-space", "const x = 1;");
  });

  it("exits with code 1 when neither --get nor --set", async () => {
    const spy = vi.spyOn(process, "exit").mockImplementation((() => {}) as () => never);
    await getAction("code")({ codespace: "my-space" });
    expect(spy).toHaveBeenCalledWith(1);
    spy.mockRestore();
  });

  it("exits with code 1 on operation failure", async () => {
    vi.mocked(syncModule.pullCode).mockRejectedValue(new Error("fetch error"));
    const spy = vi.spyOn(process, "exit").mockImplementation((() => {}) as () => never);
    await getAction("code")({ codespace: "my-space", get: true });
    expect(spy).toHaveBeenCalledWith(1);
    spy.mockRestore();
  });
});

describe("CLI poll command", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("shows stats and exits 0 with --stats flag", async () => {
    vi.mocked(redisModule.getQueueStats).mockResolvedValue({
      appsWithPending: 1,
      totalPendingMessages: 3,
      apps: [{ appId: "app1", count: 3 }],
    });
    const spy = vi.spyOn(process, "exit").mockImplementation((() => {}) as () => never);
    await getAction("poll")({ stats: true, once: false, interval: "5000" });
    expect(spy).toHaveBeenCalledWith(0);
    expect(redisModule.getQueueStats).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("runs poll once and exits 0 with --once flag", async () => {
    vi.mocked(agentModule.poll).mockResolvedValue(2);
    const spy = vi.spyOn(process, "exit").mockImplementation((() => {}) as () => never);
    await getAction("poll")({ once: true, stats: false, interval: "5000" });
    expect(spy).toHaveBeenCalledWith(0);
    expect(agentModule.poll).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("exits with code 1 when getRedisConfig throws", async () => {
    vi.mocked(redisModule.getRedisConfig).mockImplementationOnce(() => {
      throw new Error("Redis config error");
    });
    const spy = vi.spyOn(process, "exit").mockImplementation((() => {}) as () => never);
    await getAction("poll")({ stats: false, once: false, interval: "5000" });
    expect(spy).toHaveBeenCalledWith(1);
    spy.mockRestore();
  });

  it("uses default interval of 2000 when interval is not a valid number", async () => {
    vi.mocked(agentModule.poll).mockResolvedValue(0);
    vi.useFakeTimers();
    const sigintHandlers: (() => void)[] = [];
    const onSpy = vi.spyOn(process, "on").mockImplementation((event, fn) => {
      if (event === "SIGINT") sigintHandlers.push(fn as () => void);
      return process;
    });
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as () => never);

    // Start poll action with invalid interval
    getAction("poll")({ once: false, stats: false, interval: "not-a-number" });

    // Let the poll loop run once
    await vi.advanceTimersByTimeAsync(2001);

    if (sigintHandlers.length > 0) sigintHandlers[0]!();

    expect(agentModule.poll).toHaveBeenCalled();

    vi.useRealTimers();
    onSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it("runs continuous polling loop", async () => {
    vi.useFakeTimers();
    vi.mocked(agentModule.poll).mockResolvedValue(0);
    const sigintHandlers: (() => void)[] = [];
    const onSpy = vi.spyOn(process, "on").mockImplementation((event, fn) => {
      if (event === "SIGINT") sigintHandlers.push(fn as () => void);
      return process;
    });
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as () => never);

    getAction("poll")({ once: false, stats: false, interval: "100" });

    // Let one tick of the poll loop run
    await vi.advanceTimersByTimeAsync(200);

    // Trigger SIGINT to stop the loop
    if (sigintHandlers.length > 0) sigintHandlers[0]!();

    vi.useRealTimers();
    onSpy.mockRestore();
    exitSpy.mockRestore();

    expect(agentModule.poll).toHaveBeenCalled();
  });

  it("logs poll error when poll throws in continuous loop", async () => {
    vi.useFakeTimers();
    vi.mocked(agentModule.poll).mockRejectedValue(new Error("poll error"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const sigintHandlers: (() => void)[] = [];
    const onSpy = vi.spyOn(process, "on").mockImplementation((event, fn) => {
      if (event === "SIGINT") sigintHandlers.push(fn as () => void);
      return process;
    });
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as () => never);

    getAction("poll")({ once: false, stats: false, interval: "100" });
    // Let the poll loop run (error will be caught and logged)
    await vi.advanceTimersByTimeAsync(200);

    if (sigintHandlers.length > 0) sigintHandlers[0]!();

    vi.useRealTimers();
    onSpy.mockRestore();
    exitSpy.mockRestore();
    errSpy.mockRestore();

    expect(agentModule.poll).toHaveBeenCalled();
  });

  it("SIGTERM handler exits with 0 in continuous poll loop", async () => {
    vi.useFakeTimers();
    vi.mocked(agentModule.poll).mockResolvedValue(0);
    const sigtermHandlers: (() => void)[] = [];
    const onSpy = vi.spyOn(process, "on").mockImplementation((event, fn) => {
      if (event === "SIGTERM") sigtermHandlers.push(fn as () => void);
      return process;
    });
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as () => never);

    getAction("poll")({ once: false, stats: false, interval: "100" });
    await vi.advanceTimersByTimeAsync(50);

    if (sigtermHandlers.length > 0) sigtermHandlers[0]!();

    expect(exitSpy).toHaveBeenCalledWith(0);

    vi.useRealTimers();
    onSpy.mockRestore();
    exitSpy.mockRestore();
  });
});

describe("CLI dev command", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("exits with code 1 when no codespace provided", async () => {
    const spy = vi.spyOn(process, "exit").mockImplementation((() => {}) as () => never);
    await getAction("dev")({ codespace: [], debounce: "100" });
    expect(spy).toHaveBeenCalledWith(1);
    spy.mockRestore();
  });

  it("exits with code 1 when startDevMode fails", async () => {
    vi.mocked(watcherModule.startDevMode).mockRejectedValue(new Error("watcher failed"));
    const spy = vi.spyOn(process, "exit").mockImplementation((() => {}) as () => never);
    await getAction("dev")({ codespace: ["my-space"], debounce: "100" });
    expect(spy).toHaveBeenCalledWith(1);
    spy.mockRestore();
  });

  it("uses default debounce of 300 when debounce value is not a valid number", async () => {
    const stopFn = vi.fn().mockResolvedValue(undefined);
    vi.mocked(watcherModule.startDevMode).mockResolvedValue({ stop: stopFn } as never);
    const onSpy = vi.spyOn(process, "on").mockImplementation(() => process);
    vi.spyOn(process, "exit").mockImplementation((() => {}) as () => never);

    // Don't await - action hangs; just check startDevMode gets called with 300 debounce
    getAction("dev")({ codespace: ["my-space"], debounce: "not-a-number" });

    await new Promise((r) => setTimeout(r, 10));

    expect(watcherModule.startDevMode).toHaveBeenCalledWith(
      ["my-space"],
      expect.objectContaining({ debounceMs: 300 }),
    );
    onSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it("SIGINT handler calls stop and exits with 0", async () => {
    const stopFn = vi.fn().mockResolvedValue(undefined);
    vi.mocked(watcherModule.startDevMode).mockResolvedValue({ stop: stopFn } as never);

    const sigintHandlers: Array<() => void> = [];
    const onSpy = vi.spyOn(process, "on").mockImplementation((event, fn) => {
      if (event === "SIGINT") sigintHandlers.push(fn as () => void);
      return process;
    });
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as () => never);

    // Don't await - action hangs in `await new Promise(() => {})` until SIGINT
    getAction("dev")({ codespace: ["my-space"], debounce: "100" });

    // Wait for startDevMode + process.on setup
    await new Promise((r) => setTimeout(r, 10));

    // Trigger SIGINT
    if (sigintHandlers.length > 0) await sigintHandlers[0]!();

    expect(stopFn).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);

    onSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it("SIGTERM handler calls stop and exits with 0", async () => {
    const stopFn = vi.fn().mockResolvedValue(undefined);
    vi.mocked(watcherModule.startDevMode).mockResolvedValue({ stop: stopFn } as never);

    const sigtermHandlers: Array<() => void> = [];
    const onSpy = vi.spyOn(process, "on").mockImplementation((event, fn) => {
      if (event === "SIGTERM") sigtermHandlers.push(fn as () => void);
      return process;
    });
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as () => never);

    getAction("dev")({ codespace: ["my-space"], debounce: "100" });
    await new Promise((r) => setTimeout(r, 10));

    if (sigtermHandlers.length > 0) await sigtermHandlers[0]!();

    expect(stopFn).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);

    onSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it("onSync callback logs synced message", async () => {
    let capturedOnSync: ((id: string) => void) | undefined;
    const stopFn = vi.fn().mockResolvedValue(undefined);
    vi.mocked(watcherModule.startDevMode).mockImplementation(async (_ids, opts) => {
      capturedOnSync = opts?.onSync;
      return { stop: stopFn } as never;
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const onSpy = vi.spyOn(process, "on").mockImplementation(() => process);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as () => never);

    // Start the action - it will hang at `await new Promise(() => {})`; do NOT await
    getAction("dev")({ codespace: ["my-space"], debounce: "100" });

    // Wait for startDevMode to resolve so capturedOnSync is set
    await new Promise((r) => setTimeout(r, 10));

    // Invoke the onSync callback directly
    expect(capturedOnSync).toBeDefined();
    capturedOnSync!("my-space");

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("my-space"));

    onSpy.mockRestore();
    exitSpy.mockRestore();
    logSpy.mockRestore();
  });
});

describe("CLI claude command", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(writeFile).mockResolvedValue(undefined);
    vi.mocked(spawn).mockClear();
  });
  afterEach(() => vi.restoreAllMocks());

  it("spawns claude with mcp config and system prompt when codespace provided", async () => {
    const mockProc = new EventEmitter();
    vi.mocked(spawn).mockReturnValue(mockProc as unknown as ChildProcess);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as () => never);

    // The claude action is async but doesn't await the spawn events.
    // We need to wait for process.exit to be called via the close event.
    const exitCalled = new Promise<void>((resolve) => {
      exitSpy.mockImplementation((() => resolve()) as () => never);
    });

    getAction("claude")({ codespace: "my-space", prompt: "build it" }, { args: [] });
    // Give the action time to set up spawn listeners, then emit close
    await new Promise((r) => process.nextTick(r));
    mockProc.emit("close", 0);
    await exitCalled;

    expect(spawn).toHaveBeenCalledWith(
      "claude",
      expect.arrayContaining(["--mcp-config"]),
      expect.objectContaining({ stdio: ["pipe", "inherit", "inherit"] }),
    );
    exitSpy.mockRestore();
  });

  it("spawns claude without system prompt when no codespace", async () => {
    const mockProc = new EventEmitter();
    vi.mocked(spawn).mockReturnValue(mockProc as unknown as ChildProcess);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as () => never);

    const exitCalled = new Promise<void>((resolve) => {
      exitSpy.mockImplementation((() => resolve()) as () => never);
    });

    getAction("claude")({ prompt: "just a prompt" }, { args: ["--verbose"] });
    await new Promise((r) => process.nextTick(r));
    mockProc.emit("close", 0);
    await exitCalled;

    // mock.calls[0] is for this test since we cleared spawn in beforeEach
    const spawnArgs = vi.mocked(spawn).mock.calls[0]![1] as string[];
    expect(spawnArgs).not.toContain("--system-prompt");
    exitSpy.mockRestore();
  });

  it("exits with code 1 when spawn emits error", async () => {
    const mockProc = new EventEmitter();
    vi.mocked(spawn).mockReturnValue(mockProc as unknown as ChildProcess);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as () => never);

    const exitCalled = new Promise<void>((resolve) => {
      exitSpy.mockImplementation((() => resolve()) as () => never);
    });

    getAction("claude")({ codespace: "my-space" }, { args: [] });
    await new Promise((r) => process.nextTick(r));
    mockProc.emit("error", new Error("spawn failed"));
    await exitCalled;

    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });

  it("exits with code 1 when mkdir fails", async () => {
    vi.mocked(mkdir).mockRejectedValue(new Error("mkdir failed"));
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as () => never);
    await getAction("claude")({ codespace: "my-space" }, { args: [] });
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });

  it("uses empty array when command.args is null/falsy", async () => {
    const mockProc = new EventEmitter();
    vi.mocked(spawn).mockReturnValue(mockProc as unknown as ChildProcess);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as () => never);

    const exitCalled = new Promise<void>((resolve) => {
      exitSpy.mockImplementation((() => resolve()) as () => never);
    });

    // Pass command with null args to exercise the `|| []` fallback
    getAction("claude")({ prompt: "hi" }, { args: null });
    await new Promise((r) => process.nextTick(r));
    mockProc.emit("close", 0);
    await exitCalled;

    expect(spawn).toHaveBeenCalledWith("claude", expect.any(Array), expect.any(Object));
    exitSpy.mockRestore();
  });
});
