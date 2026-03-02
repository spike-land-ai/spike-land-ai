// Main-thread DOM applier.
// Receives MutationBatch messages from the worker, creates real DOM nodes,
// and forwards captured user events back to the worker.

import { CAPTURED_EVENTS } from "../events.js";
import type { TransferrableEventData } from "../events.js";
import { MutationType } from "./protocol.js";
import type { EventMessage, Mutation, MutationBatchMessage } from "./protocol.js";
import { serializeEvent } from "./event-serializer.js";

export class MainThreadApplier {
  private worker: Worker;
  private nodeMap = new Map<number, Node>();
  private reverseMap = new WeakMap<Node, number>();
  private eventAbortController = new AbortController();

  constructor(
    private container: HTMLElement,
    workerBlobUrl: string,
  ) {
    // Pre-register the container as node 0
    this.nodeMap.set(0, container);
    this.reverseMap.set(container, 0);

    this.worker = new Worker(workerBlobUrl, { type: "module" });
    this.worker.onmessage = (ev: MessageEvent<MutationBatchMessage>) => {
      if (ev.data.kind === "mutations") {
        for (const mut of ev.data.mutations) {
          this.applyMutation(mut);
        }
      }
    };

    this.setupEventCapture();
  }

  private applyMutation(mut: Mutation): void {
    switch (mut.type) {
      case MutationType.CREATE_ELEMENT: {
        const el = document.createElement(mut.tagName!);
        this.register(mut.targetId, el);
        break;
      }
      case MutationType.CREATE_ELEMENT_NS: {
        const el = document.createElementNS(mut.namespace!, mut.tagName!);
        this.register(mut.targetId, el);
        break;
      }
      case MutationType.CREATE_TEXT: {
        const text = document.createTextNode(mut.value ?? "");
        this.register(mut.targetId, text);
        break;
      }
      case MutationType.APPEND_CHILD: {
        const parent = this.nodeMap.get(mut.parentId!);
        const child = this.nodeMap.get(mut.targetId);
        if (parent && child) parent.appendChild(child);
        break;
      }
      case MutationType.INSERT_BEFORE: {
        const parent = this.nodeMap.get(mut.parentId!);
        const child = this.nodeMap.get(mut.targetId);
        const ref = this.nodeMap.get(mut.refId!);
        if (parent && child) parent.insertBefore(child, ref ?? null);
        break;
      }
      case MutationType.REMOVE_CHILD: {
        const parent = this.nodeMap.get(mut.parentId!);
        const child = this.nodeMap.get(mut.targetId);
        if (parent && child && child.parentNode === parent) {
          parent.removeChild(child);
        }
        break;
      }
      case MutationType.SET_ATTRIBUTE: {
        const el = this.nodeMap.get(mut.targetId);
        if (el && el instanceof Element) {
          el.setAttribute(mut.name!, mut.value!);
        }
        break;
      }
      case MutationType.REMOVE_ATTRIBUTE: {
        const el = this.nodeMap.get(mut.targetId);
        if (el && el instanceof Element) {
          el.removeAttribute(mut.name!);
        }
        break;
      }
      case MutationType.SET_STYLE: {
        const el = this.nodeMap.get(mut.targetId);
        if (el && el instanceof HTMLElement) {
          el.style.setProperty(mut.name!, mut.value!);
        }
        break;
      }
      case MutationType.SET_TEXT: {
        const node = this.nodeMap.get(mut.targetId);
        if (node && node instanceof Text) {
          node.data = mut.value ?? "";
        }
        break;
      }
      case MutationType.SET_TEXT_CONTENT: {
        const node = this.nodeMap.get(mut.targetId);
        if (node) {
          node.textContent = mut.value ?? "";
        }
        break;
      }
    }
  }

  private register(id: number, node: Node): void {
    this.nodeMap.set(id, node);
    this.reverseMap.set(node, id);
  }

  private setupEventCapture(): void {
    const signal = this.eventAbortController.signal;

    for (const eventName of CAPTURED_EVENTS) {
      this.container.addEventListener(
        eventName,
        (nativeEvent: Event) => {
          const target = nativeEvent.target as Node | null;
          const targetId = target ? (this.reverseMap.get(target) ?? 0) : 0;

          const data: TransferrableEventData = serializeEvent(nativeEvent, targetId);
          const msg: EventMessage = { kind: "event", event: data };
          this.worker.postMessage(msg);
        },
        { capture: true, signal },
      );
    }
  }

  destroy(): void {
    this.worker.terminate();
    this.eventAbortController.abort();
    this.nodeMap.clear();
  }
}
