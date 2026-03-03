export { computeSessionHash } from "./hash-utils";
export {
  getOrCreateSession,
  getSession,
  getVersion,
  getVersionsList,
  initializeSession,
  saveVersion,
  updateSession,
  upsertSession,
} from "./session-service";

export { CORS_HEADERS, corsOptions } from "./cors";
// Note: transpileCode is NOT re-exported here to avoid pulling esbuild-wasm
// into client bundles. Import directly from "@/lib/codespace/transpile" instead.
export {
  broadcastToCodespace,
  getCodespaceInstanceId,
  getCodespaceSSEEvents,
} from "./broadcast";
export type {
  CodespaceSSEEvent,
  CodespaceSSEEventType,
  CodespaceSSEEventWithSource,
} from "./broadcast";
