// Worker-side virtual DOM implementation.
// Creates lightweight WorkerElement / WorkerText nodes that record mutations
// and flush them to the main thread via postMessage in a microtask batch.

import type {
  WorkerDocument,
  WorkerElement,
  WorkerNode,
  WorkerText,
} from "../../host-config/WorkerDOMHostConfig.js";
import { MutationType } from "./protocol.js";
import type { Mutation, MutationBatchMessage } from "./protocol.js";

// ---- Global state ----

let nextNodeId = 1; // 0 is reserved for the container
export const nodeMap = new Map<number, WorkerNodeImpl>();

// ---- Mutation collector ----

export class MutationCollector {
  private queue: Mutation[] = [];
  private scheduled = false;

  record(mutation: Mutation): void {
    this.queue.push(mutation);
    if (!this.scheduled) {
      this.scheduled = true;
      queueMicrotask(() => this.flush());
    }
  }

  private flush(): void {
    this.scheduled = false;
    if (this.queue.length === 0) return;

    const batch: MutationBatchMessage = {
      kind: "mutations",
      mutations: this.queue,
    };
    this.queue = [];

    (self as unknown as { postMessage(msg: MutationBatchMessage): void }).postMessage(batch);
  }
}

// Shared collector instance
const collector = new MutationCollector();

// ---- WorkerNode base ----

export class WorkerNodeImpl implements WorkerNode {
  readonly __nodeId: number;
  parentNode: WorkerNode | null = null;
  private _children: WorkerNodeImpl[] = [];

  constructor(id?: number) {
    this.__nodeId = id ?? nextNodeId++;
    nodeMap.set(this.__nodeId, this);
  }

  get childNodes(): ArrayLike<WorkerNode> {
    return this._children;
  }

  get textContent(): string | null {
    return this._children.map((c) => c.textContent ?? "").join("");
  }

  set textContent(value: string | null) {
    // Remove all children
    while (this._children.length > 0) {
      this.removeChild(this._children[this._children.length - 1]!);
    }
    collector.record({
      type: MutationType.SET_TEXT_CONTENT,
      targetId: this.__nodeId,
      value: value ?? "",
    });
  }

  appendChild(child: WorkerNode): void {
    const impl = child as WorkerNodeImpl;
    // Remove from old parent if needed
    if (impl.parentNode) {
      (impl.parentNode as WorkerNodeImpl).removeChildInternal(impl);
    }
    this._children.push(impl);
    impl.parentNode = this;
    collector.record({
      type: MutationType.APPEND_CHILD,
      targetId: impl.__nodeId,
      parentId: this.__nodeId,
    });
  }

  insertBefore(child: WorkerNode, before: WorkerNode): void {
    const impl = child as WorkerNodeImpl;
    const beforeImpl = before as WorkerNodeImpl;
    if (impl.parentNode) {
      (impl.parentNode as WorkerNodeImpl).removeChildInternal(impl);
    }
    const idx = this._children.indexOf(beforeImpl);
    if (idx === -1) {
      this._children.push(impl);
    } else {
      this._children.splice(idx, 0, impl);
    }
    impl.parentNode = this;
    collector.record({
      type: MutationType.INSERT_BEFORE,
      targetId: impl.__nodeId,
      parentId: this.__nodeId,
      refId: beforeImpl.__nodeId,
    });
  }

  removeChild(child: WorkerNode): void {
    const impl = child as WorkerNodeImpl;
    this.removeChildInternal(impl);
    collector.record({
      type: MutationType.REMOVE_CHILD,
      targetId: impl.__nodeId,
      parentId: this.__nodeId,
    });
  }

  /** Internal removal without recording a mutation (used when moving nodes). */
  private removeChildInternal(child: WorkerNodeImpl): void {
    const idx = this._children.indexOf(child);
    if (idx !== -1) {
      this._children.splice(idx, 1);
    }
    child.parentNode = null;
  }
}

// ---- WorkerElement ----

export class WorkerElementImpl extends WorkerNodeImpl implements WorkerElement {
  readonly tagName: string;
  readonly namespaceURI: string | null;
  readonly style: Record<string, string>;

  constructor(tagName: string, namespaceURI: string | null = null) {
    super();
    this.tagName = tagName.toUpperCase();
    this.namespaceURI = namespaceURI;

    // Style proxy that records SET_STYLE mutations
    const nodeId = this.__nodeId;
    const backing: Record<string, string> = {};
    this.style = new Proxy(backing, {
      set(_target, prop: string, value: string) {
        _target[prop] = value;
        collector.record({
          type: MutationType.SET_STYLE,
          targetId: nodeId,
          name: prop,
          value: String(value),
        });
        return true;
      },
      get(target, prop: string) {
        return target[prop] ?? "";
      },
    });
  }

  setAttribute(name: string, value: string): void {
    collector.record({
      type: MutationType.SET_ATTRIBUTE,
      targetId: this.__nodeId,
      name,
      value,
    });
  }

  removeAttribute(name: string): void {
    collector.record({
      type: MutationType.REMOVE_ATTRIBUTE,
      targetId: this.__nodeId,
      name,
    });
  }
}

// ---- WorkerText ----

export class WorkerTextImpl extends WorkerNodeImpl implements WorkerText {
  private _data: string;

  constructor(text: string) {
    super();
    this._data = text;
  }

  get data(): string {
    return this._data;
  }

  set data(value: string) {
    this._data = value;
    collector.record({
      type: MutationType.SET_TEXT,
      targetId: this.__nodeId,
      value,
    });
  }

  get nodeValue(): string | null {
    return this._data;
  }

  set nodeValue(value: string | null) {
    this.data = value ?? "";
  }

  override get textContent(): string | null {
    return this._data;
  }

  override set textContent(value: string | null) {
    this.data = value ?? "";
  }
}

// ---- WorkerDocument ----

export class WorkerDocumentImpl implements WorkerDocument {
  createElement(type: string): WorkerElement {
    const el = new WorkerElementImpl(type);
    collector.record({
      type: MutationType.CREATE_ELEMENT,
      targetId: el.__nodeId,
      tagName: type,
    });
    return el;
  }

  createElementNS(namespace: string, type: string): WorkerElement {
    const el = new WorkerElementImpl(type, namespace);
    collector.record({
      type: MutationType.CREATE_ELEMENT_NS,
      targetId: el.__nodeId,
      tagName: type,
      namespace,
    });
    return el;
  }

  createTextNode(text: string): WorkerText {
    const node = new WorkerTextImpl(text);
    collector.record({
      type: MutationType.CREATE_TEXT,
      targetId: node.__nodeId,
      value: text,
    });
    return node;
  }
}

// Pre-register a container root node with id 0 so the main-thread applier
// and worker agree on the container identity.
export function createContainerNode(): WorkerElementImpl {
  const container = new WorkerElementImpl("DIV");
  // Override the auto-generated id — constructor already called super()
  // so we re-register under id 0.
  nodeMap.delete(container.__nodeId);
  Object.defineProperty(container, "__nodeId", { value: 0 });
  nodeMap.set(0, container);
  return container;
}
