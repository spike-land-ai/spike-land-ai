// Worker-DOM Bridge Protocol
// Defines the message format for mutations (worker -> main) and events (main -> worker).

export const enum MutationType {
  CREATE_ELEMENT = 0,
  CREATE_TEXT = 1,
  APPEND_CHILD = 2,
  INSERT_BEFORE = 3,
  REMOVE_CHILD = 4,
  SET_ATTRIBUTE = 5,
  REMOVE_ATTRIBUTE = 6,
  SET_STYLE = 7,
  SET_TEXT = 8,
  SET_TEXT_CONTENT = 9,
  CREATE_ELEMENT_NS = 10,
}

export interface Mutation {
  type: MutationType;
  targetId: number;
  parentId?: number;
  refId?: number;
  name?: string;
  value?: string;
  namespace?: string;
  tagName?: string;
}

/** Worker -> Main: batch of DOM mutations to apply. */
export interface MutationBatchMessage {
  kind: "mutations";
  mutations: Mutation[];
}

/** Main -> Worker: a user event forwarded to the worker for React dispatch. */
export interface EventMessage {
  kind: "event";
  event: import("../events.js").TransferrableEventData;
}

export type WorkerToMainMessage = MutationBatchMessage;
export type MainToWorkerMessage = EventMessage;
