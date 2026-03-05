import { describe, it, expect, beforeEach } from "vitest";
import { createElement, useState, useEffect } from "../../src/react-ts-worker/react/index.js";
import { createRoot } from "../../src/react-ts-worker/react-dom/client.js";

describe("react-ts-worker rendering", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  it("should render a simple component", () => {
    const root = createRoot(container);
    root.render(createElement("div", { id: "test" }, "Hello World"));

    // React rendering is async, but our reconciler might be sync for simple cases
    // or we might need a small delay.
    expect(container.innerHTML).toContain('id="test"');
    expect(container.textContent).toBe("Hello World");
  });

  it("should handle state updates", async () => {
    function Counter() {
      const [count, setCount] = useState(0);
      
      useEffect(() => {
        setCount(1);
      }, []);

      return createElement("div", { id: "counter" }, `Count: ${count}`);
    }

    const root = createRoot(container);
    root.render(createElement(Counter));

    // Wait for useEffect and re-render
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(container.textContent).toBe("Count: 1");
  });
});
