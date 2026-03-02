import type { AsyncDispatcher, Dispatcher, Transition } from "./ReactTypes.js";

export interface SharedState {
  H: Dispatcher | null; // Current hook dispatcher
  A: AsyncDispatcher | null; // Async dispatcher (cache)
  T: Transition | null; // Current transition
  S: ((transition: Transition, value: unknown) => void) | null; // Transition finish callback
}

const ReactSharedInternals: SharedState = {
  H: null,
  A: null,
  T: null,
  S: null,
};

export default ReactSharedInternals;
