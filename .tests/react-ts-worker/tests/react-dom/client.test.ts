import { afterEach, beforeEach, describe, expect, it, _vi } from "vitest";
import { createElement } from "../../../../src/core/react-engine/react/index.js";
import { createRoot, hydrateRoot } from "../../../../src/core/react-engine/react-dom/client.js";

describe("createRoot", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("throws if container is falsy", () => {
    expect(() => createRoot(null as unknown as Element)).toThrow(
      "createRoot(...): Target container is not a DOM element.",
    );
  });

  it("creates a root and renders a simple element", async () => {
    const root = createRoot(container);
    root.render(createElement("div", null, "Hello Root"));
    // Wait for microtask queue to flush
    await new Promise((r) => queueMicrotask(r as () => void));
    expect(container.innerHTML).toContain("Hello Root");
  });

  it("renders null unmounts content", async () => {
    const root = createRoot(container);
    root.render(createElement("div", null, "content"));
    await new Promise((r) => queueMicrotask(r as () => void));
    root.render(null);
    await new Promise((r) => queueMicrotask(r as () => void));
  });

  it("unmount clears content", async () => {
    const root = createRoot(container);
    root.render(createElement("div", null, "unmount test"));
    await new Promise((r) => queueMicrotask(r as () => void));
    root.unmount();
    await new Promise((r) => queueMicrotask(r as () => void));
  });

  it("renders a function component", async () => {
    const Greeting = ({ name }: { name: string }) => createElement("h1", null, `Hello, ${name}!`);
    const root = createRoot(container);
    root.render(createElement(Greeting, { name: "React" }));
    await new Promise((r) => queueMicrotask(r as () => void));
    expect(container.innerHTML).toContain("Hello, React!");
  });

  it("renders nested elements", async () => {
    const el = createElement(
      "ul",
      null,
      createElement("li", { key: "a" }, "Item A"),
      createElement("li", { key: "b" }, "Item B"),
    );
    const root = createRoot(container);
    root.render(el);
    await new Promise((r) => queueMicrotask(r as () => void));
    expect(container.innerHTML).toContain("Item A");
    expect(container.innerHTML).toContain("Item B");
  });

  it("renders a function component", async () => {
    const Greeting = ({ name }: { name: string }) => createElement("h1", null, `Hello, ${name}!`);
    const root = createRoot(container);
    root.render(createElement(Greeting, { name: "React" }));
    await new Promise((r) => queueMicrotask(r as () => void));
    expect(container.innerHTML).toContain("Hello, React!");
  });

  it("accepts a Document as container", () => {
    // Document is a valid container type
    expect(() => createRoot(document)).not.toThrow();
  });
});

describe("hydrateRoot", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("creates a root and renders initial children", async () => {
    const el = createElement("div", null, "Hydrated");
    hydrateRoot(container, el);
    await new Promise((r) => queueMicrotask(r as () => void));
    expect(container.innerHTML).toContain("Hydrated");
  });
});
