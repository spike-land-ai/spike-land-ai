import { getCodeSpace } from "../core-logic/hooks/use-code-space";
import type { ICode, ICodeSession, ImageData, Message } from "../ui/@/lib/interfaces";
import { computeSessionHash, sanitizeSession } from "../core-logic/lib/make-sess";
import { tryCatch } from "../lazy-imports/try-catch";
import { wait } from "../core-logic/lib/wait";
import { CodeProcessor } from "../core-logic/services/CodeProcessor";
import { screenshot } from "../core-logic/services/editorUtils";
import { ModelManager } from "../core-logic/services/ModelManager";
import { SessionManager } from "../core-logic/services/SessionManager";
import { Mutex } from "async-mutex";

// Mutex for thread-safe code access
const mutex = new Mutex();

/**
 * Main class that coordinates code processing, session management,
 * and model relationships.
 */
export class Code implements ICode {
  // private sessionManager: SessionManager
  // private codeSpace = getCodeSpace(location.pathname);
  private modelManager: ModelManager;
  private codeProcessor: CodeProcessor;
  private releaseWorker: () => void = () => {};
  private setCodeController: AbortController | null = null;
  private isRunning = false;
  private codeSpace: string;
  private pendingRun: string | null = null;

  private sessionManager: SessionManager;
  private currentSession: ICodeSession;

  constructor(private session: ICodeSession) {
    this.currentSession = sanitizeSession(session);
    this.session = this.currentSession;
    const codeSpace = this.session.codeSpace;

    this.codeSpace = this.session.codeSpace;
    this.sessionManager = new SessionManager(codeSpace);
    this.sessionManager.init(this.session);

    this.codeProcessor = new CodeProcessor(codeSpace);
    this.modelManager = new ModelManager(codeSpace, this);

    // Set up re-render handling for transpiled code changes and auto-transpilation for code changes
    this.sessionManager.subscribe(async (session) => {
      // Check if session has sender property (extended interface)
      const sessionWithSender = session as ICodeSession & {
        sender?: string;
        requiresReRender?: boolean;
        requiresTranspilation?: boolean;
      };

      if (
        sessionWithSender.requiresReRender &&
        sessionWithSender.sender === "WORKER_TRANSPILED_CHANGE"
      ) {
        await this.handleRemoteTranspiledChange(sessionWithSender);
        return; // Exit early to avoid double processing
      }

      // Check if transpilation is explicitly required (e.g., from MCP server updates)
      if (sessionWithSender.requiresTranspilation) {
        await this.handleExternalCodeChange(sessionWithSender);
        return; // Exit early to avoid double processing
      }

      // Check if code changed but transpiled is potentially stale (from external sources like MCP)
      if (this.shouldTriggerAutoTranspilation(this.currentSession, sessionWithSender)) {
        await this.handleExternalCodeChange(sessionWithSender);
      }
    });

    this.setSession({
      ...this.currentSession,
      codeSpace,
    });
  }

  async getSession(): Promise<ICodeSession> {
    return this.sessionManager.getSession();
  }

  setSession(session: ICodeSession & { sender?: string }): void {
    // Extract the sender property if it exists
    const { sender: _sender, ...sessionWithoutSender } = session;

    if (computeSessionHash(sessionWithoutSender) === computeSessionHash(this.currentSession)) {
      return;
    }

    this.currentSession = sanitizeSession(sessionWithoutSender);
    this.session = this.currentSession;
    this.sessionManager.updateSession(sessionWithoutSender);
  }

  async init(session: ICodeSession | null = null): Promise<ICodeSession> {
    if (session) {
      const initializedSession = await this.sessionManager.init(session);
      this.setSession(initializedSession);
      return initializedSession;
    }

    const { data: response, error: fetchError } = await tryCatch(
      fetch(`/live/${this.codeSpace}/session.json`),
    );

    if (fetchError) {
      throw new Error(`Failed to fetch session: ${fetchError?.message || "Unknown error"}`);
    }

    const { data: sessionData, error: jsonError } = await tryCatch(response!.json());

    if (jsonError) {
      throw new Error(`Failed to parse session JSON: ${jsonError.message}`);
    }

    const initializedSession = await this.sessionManager.init(sessionData);
    this.setSession(initializedSession);
    return initializedSession;
  }

  getCodeSpace(): string {
    return this.codeSpace;
  }

  async getCode(): Promise<string> {
    if (mutex.isLocked()) {
      const { error: mutexError } = await tryCatch(mutex.waitForUnlock());
      if (mutexError) {
        // Non-fatal: proceed with current session state
      }
    }
    return this.currentSession?.code || "";
  }

  async setCode(
    rawCode: string,
    skipRunning = false,
    replaceIframe?: (newIframe: HTMLIFrameElement) => void,
  ): Promise<string> {
    // Store current code before any updates
    const currentCode = this.currentSession?.code || "";

    if (this.isRunning) {
      this.pendingRun = rawCode;
      while (this.isRunning) {
        await wait(100);
      }
      if (this.pendingRun !== rawCode) {
        return currentCode;
      }
    }

    this.isRunning = true;
    this.pendingRun = null;

    const { data: result, error } = await tryCatch(
      this.updateCodeInternal(rawCode, skipRunning, replaceIframe),
    );

    this.isRunning = false;

    if (error) {
      return currentCode;
    }

    return result;
  }

  private async updateCodeInternal(
    rawCode: string,
    skipRunning: boolean,
    replaceIframe?: (newIframe: HTMLIFrameElement) => void,
  ): Promise<string> {
    // Store current code for fallback
    const currentCode = this.currentSession?.code || "";

    // The 'skipRunning' parameter is passed from Editor.tsx.
    // It's true if Editor.tsx is attempting a "force save" (e.g. for comment-only changes).
    // It's false for regular saves where the editor expects the app to run/be validated by the processor.

    if (this.setCodeController) {
      this.setCodeController.abort();
    }
    this.setCodeController = new AbortController();
    const signal = this.setCodeController.signal;

    // Always call the processor. The 'skipRunning' flag informs the processor's behavior.
    const { data: processorResult, error: processError } = await tryCatch(
      this.codeProcessor.process(
        rawCode,
        skipRunning, // Pass the flag to the processor
        signal,
        () => this.currentSession,
        replaceIframe,
      ),
    );

    if (processError || !processorResult) {
      return currentCode;
    }

    // CodeProcessor succeeded. Now, prepare the session data based on its result.
    const processedSessionData = sanitizeSession({
      ...this.currentSession,
      ...processorResult, // Apply changes/data from the processor
    });

    if (skipRunning) {
      // This is a "force save" path (e.g., comment-only change where Editor.tsx set skipRunning=true)
      // AND the processor was successful (e.g., it might do lighter validation or just format).
      // We directly update the current session state and inform the sessionManager,
      // bypassing this.setSession()'s computeSessionHash check. This ensures changes
      // like comments (which might not alter the structural hash) are persisted.

      // Small optimization: if the processed code is truly identical to what's already
      // in currentSession (both content and structural hash), no need to update.
      const currentSessionHash = computeSessionHash(this.currentSession);
      const processedSessionHash = computeSessionHash(processedSessionData);

      if (
        processedSessionData.code !== this.currentSession.code ||
        processedSessionHash !== currentSessionHash
      ) {
        this.currentSession = processedSessionData; // Update internal state
        this.sessionManager.updateSession(processedSessionData); // Inform the manager
      }
    } else {
      // This is a regular save path (skipRunning=false). Processor succeeded.
      // Use the standard this.setSession, which includes its own hash checks
      // to prevent redundant updates if the code is structurally the same.
      this.setSession(processedSessionData);
    }

    // Wait a small amount of time to ensure the session update is processed by subscribers
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Return the code that was effectively set in the session.
    return processedSessionData.code;
  }

  async setModelsByCurrentCode(newCodes: string): Promise<string> {
    const { data: result, error } = await tryCatch(this.modelManager.updateModelsByCode(newCodes));

    if (error) {
      throw error;
    }

    return result;
  }

  async currentCodeWithExtraModels(): Promise<string> {
    const { data: result, error } = await tryCatch(
      this.modelManager.getCurrentCodeWithExtraModels(),
    );

    if (error) {
      throw error;
    }

    return result;
  }

  sub(callback: (session: ICodeSession) => void): () => void {
    return this.sessionManager.subscribe(callback);
  }

  async release(): Promise<void> {
    this.releaseWorker();

    const { error } = await tryCatch(
      Promise.all([this.sessionManager.release(), this.modelManager.release()]),
    );

    if (error) {
      // Release errors are non-fatal; resources may already be cleaned up
    }
  }

  screenshot(): Promise<ImageData> {
    return screenshot();
  }

  /**
   * Adds a message to the current session's message history
   * @param message - The message to add
   */
  async addMessage(message: Message): Promise<void> {
    const currentMessages = this.currentSession.messages || [];
    const updatedMessages = [...currentMessages, message];

    this.setSession({
      ...this.currentSession,
      messages: updatedMessages,
      sender: "ADD_MESSAGE",
    });
  }

  /**
   * Handles remote transpiled code changes by re-rendering the app
   * and updating the session with new HTML/CSS values
   */
  private async handleRemoteTranspiledChange(
    session: ICodeSession & { requiresReRender?: boolean },
  ): Promise<void> {
    try {
      // Use the CodeProcessor to re-render with the new transpiled code
      const processorResult = await this.codeProcessor.reRenderFromTranspiled(
        session.transpiled,
        new AbortController().signal,
        () => session,
        undefined, // replaceIframe not needed for background re-render
      );

      if (processorResult !== false) {
        // Update session with new HTML/CSS from rendering
        // Remove the requiresReRender flag to prevent loops
        const { requiresReRender: _requiresReRender, ...sessionWithoutFlag } =
          processorResult as ICodeSession & { requiresReRender?: boolean };

        this.setSession({
          ...sessionWithoutFlag,
          sender: "CODE_SESSION_RERENDER",
        });
      }
    } catch (_error) {
      // Re-render failure is non-fatal; session remains at previous state
    }
  }

  /**
   * Determines if auto-transpilation should be triggered based on session changes
   */
  private shouldTriggerAutoTranspilation(
    oldSession: ICodeSession,
    newSession: ICodeSession & { sender?: string },
  ): boolean {
    // Don't auto-transpile if:
    // 1. Code hasn't changed
    // 2. This update is from our own re-render process (to prevent loops)
    // 3. This update is from the user's editor (which handles transpilation itself)
    // 4. This update is from a transpiled change handler
    if (
      oldSession.code === newSession.code ||
      newSession.sender === "CODE_SESSION_RERENDER" ||
      newSession.sender === "EDITOR_CODE_CHANGE" ||
      newSession.sender === "WORKER_TRANSPILED_CHANGE"
    ) {
      return false;
    }

    // Check if transpiled code appears to be stale relative to the code
    // This is a heuristic - if the code changed but transpiled contains old content or is empty/default
    const hasStaleTranspiled =
      !newSession.transpiled ||
      newSession.transpiled.includes("Write your code here!") || // Default content
      (newSession.transpiled.includes("stdin_default") && !newSession.code.includes("default")); // Generic transpiled but code changed

    // Trigger auto-transpilation for external updates (like MCP) with stale transpiled code
    return hasStaleTranspiled;
  }

  /**
   * Handles external code changes by triggering transpilation
   */
  private async handleExternalCodeChange(
    session: ICodeSession & { sender?: string },
  ): Promise<void> {
    try {
      // Temporarily update our current session to match the new session
      // This prevents the setCode process from thinking nothing changed
      this.currentSession = sanitizeSession(session);

      // Use setCode to trigger full transpilation pipeline
      // skipRunning=false ensures full processing including HTML/CSS generation
      await this.setCode(session.code, false);

      // After transpilation, get the updated session with new transpiled code
      const updatedSession = this.currentSession;

      // If this was triggered by MCP server (requiresTranspilation flag),
      // we need to send the transpiled code back to the server
      if ((session as ICodeSession & { requiresTranspilation?: boolean }).requiresTranspilation) {
        // Mark the session as coming from CODE_SESSION_RERENDER to trigger server update
        this.sessionManager.updateSession({
          ...updatedSession,
          sender: "CODE_SESSION_RERENDER",
        } as ICodeSession & { sender: string });
      }
    } catch (_error) {
      // Transpilation failure is non-fatal; session remains at previous state
    }
  }

  async run(): Promise<void> {
    const { error } = await tryCatch(this.init());

    if (error) {
      throw error;
    }
  }
}

/**
 * Cache for storing code sessions by codeSpace identifier
 */
const codeSessionCache: Record<string, Code> = {};

/**
 * Fetches a code session from the API
 * @param codeSpaceId - The identifier for the code space
 * @returns Promise resolving to the session data
 */
async function fetchCodeSession(codeSpaceId: string): Promise<ICodeSession> {
  const { data: response, error: fetchError } = await tryCatch(
    fetch(`/live/${codeSpaceId}/session.json`),
  );

  if (fetchError) {
    throw new Error(`Failed to fetch code session: ${fetchError.message}`);
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch code session: ${response.status}`);
  }

  const { data: sessionData, error: jsonError } = await tryCatch(response.json());

  if (jsonError) {
    throw new Error(`Failed to parse code session JSON: ${jsonError.message}`);
  }

  return sessionData;
}

/**
 * Gets or creates a code session for the specified code space
 * @param codeSpaceId - The identifier for the code space (defaults to current URL's code space)
 * @returns Promise resolving to a Code instance
 */
export async function getCodeSession(
  codeSpaceId = getCodeSpace(location.pathname),
): Promise<ICode> {
  // Return cached session if it exists
  if (codeSessionCache[codeSpaceId]) {
    return codeSessionCache[codeSpaceId];
  }

  // Fetch and create a new session

  const { data: sessionData, error: fetchError } = await tryCatch(fetchCodeSession(codeSpaceId));

  if (fetchError) {
    throw fetchError;
  }

  if (!sessionData) {
    throw new Error(`Failed to get code session for ${codeSpaceId}: sessionData is undefined`);
  }
  const codeSession = new Code(sessionData);

  const { error: initError } = await tryCatch(codeSession.init(sessionData));

  if (initError) {
    throw initError;
  }

  // Cache the session
  codeSessionCache[codeSpaceId] = codeSession;

  return codeSession;
}
