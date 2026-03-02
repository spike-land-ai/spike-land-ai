// Worker-DOM Bridge - public API re-exports

// Protocol types
export { MutationType } from "./protocol.js";
export type {
  EventMessage,
  MainToWorkerMessage,
  Mutation,
  MutationBatchMessage,
  WorkerToMainMessage,
} from "./protocol.js";

// Worker-side virtual document
export {
  createContainerNode,
  MutationCollector,
  nodeMap,
  WorkerDocumentImpl,
  WorkerElementImpl,
  WorkerNodeImpl,
  WorkerTextImpl,
} from "./worker-document.js";

// Main-thread applier
export { MainThreadApplier } from "./main-applier.js";

// Event serialization (main thread)
export { serializeEvent } from "./event-serializer.js";

// Event dispatch (worker side)
export {
  setupWorkerEventReceiver,
  WorkerEventRegistry,
} from "./worker-events.js";
export type { WorkerSyntheticEvent } from "./worker-events.js";
