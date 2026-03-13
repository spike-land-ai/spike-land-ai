export { CollabProvider, useCollab } from "./CollabProvider";
export type { CollabUser, ConnectionStatus, EditOperation, SelectionRange, UserStatus } from "./CollabProvider";

export { CursorOverlay } from "./CursorOverlay";
export { PresenceBar } from "./PresenceBar";
export { CollabIndicator } from "./CollabIndicator";
export {
  useSharedState,
  useSharedSelection,
  dispatchSharedStateEvent,
  dispatchSelectionEvent,
} from "./useSharedState";
export type { RemoteSelection } from "./useSharedState";
