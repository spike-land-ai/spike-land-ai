import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AttentionSpotlightCore } from "./AttentionSpotlightCore";
import { FiveLayerStackCore } from "./FiveLayerStackCore";
import { DarwinianTreeCore } from "./DarwinianTreeCore";
import { RecursiveZoomCore } from "./RecursiveZoomCore";
import { AgentLoopCore } from "./AgentLoopCore";
import { BayesianConfidenceCore } from "./BayesianConfidenceCore";
import { ModelCascadeCore } from "./ModelCascadeCore";
import { SplitScreenCore } from "./SplitScreenCore";

import { GlassmorphismCardCore } from "./ui/GlassmorphismCardCore";
import { clamp, interpolate, seededRandom } from "../../lib/animation-utils";

describe("Animation Utils", () => {
  it("interpolates values correctly", () => {
    expect(interpolate(0.5, [0, 1], [0, 100])).toBe(50);
    expect(interpolate(0, [0, 1], [0, 100])).toBe(0);
    expect(interpolate(1, [0, 1], [0, 100])).toBe(100);
  });

  it("handles out of bounds interpolation (clamping)", () => {
    expect(interpolate(-1, [0, 1], [0, 100])).toBe(0);
    expect(interpolate(2, [0, 1], [0, 100])).toBe(100);
  });

  it("interpolates piecewise linear functions", () => {
    const input = [0, 0.5, 1];
    const output = [0, 100, 50];
    expect(interpolate(0.25, input, output)).toBe(50);
    expect(interpolate(0.75, input, output)).toBe(75);
  });

  it("guards against division by zero", () => {
    // Input range has zero width: val (0.5) >= input.last (0), so right-bound
    // output is returned — same clamping behavior as out-of-range values.
    expect(interpolate(0.5, [0, 0], [0, 100])).toBe(100);
  });

  it("clamps values", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it("generates deterministic random numbers", () => {
    expect(seededRandom(123)).toBe(seededRandom(123));
    expect(seededRandom(123)).not.toBe(seededRandom(456));
  });
});

describe("Core Components Smoke Tests", () => {
  it("renders AttentionSpotlightCore with correct tokens", () => {
    const { container } = render(<AttentionSpotlightCore progress={0.5} tokenCount={10} />);
    expect(container.querySelector("svg")).toBeTruthy();
    // Component renders background glow, spotlight ring, and flare circles
    expect(container.querySelectorAll("circle").length).toBeGreaterThan(0);
    // tokenCount is rendered inline — SVG tspan concatenates without space
    expect(container.textContent).toContain("10");
  });

  it("renders FiveLayerStackCore layers", () => {
    render(<FiveLayerStackCore progress={1} revealCount={5} />);
    // Check for layer names in the new design
    expect(screen.getByText("Identity")).toBeTruthy();
    expect(screen.getByText("Knowledge")).toBeTruthy();
  });

  it("renders DarwinianTreeCore branches", () => {
    const { container } = render(
      <DarwinianTreeCore progress={1} generations={3} width={1920} height={1080} />,
    );
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    // Should have paths for branches in the new design
    expect(svg?.querySelectorAll("path").length).toBeGreaterThan(0);
  });

  it("renders RecursiveZoomCore with depth", () => {
    render(<RecursiveZoomCore progress={0.5} depth={3} width={1920} height={1080} />);
    // Check for the HUD
    expect(screen.getByText("DEPTH METRICS")).toBeTruthy();
  });

  it("renders AgentLoopCore states and active highlight", () => {
    render(<AgentLoopCore progress={1} activeState="planning" width={1920} height={1080} />);
    // The new design uses uppercase Planning or similar
    expect(screen.getByText("Planning")).toBeTruthy();
  });

  it("renders BayesianConfidenceCore stats", () => {
    render(
      <BayesianConfidenceCore
        progress={1}
        successes={10}
        failures={2}
        width={1920}
        height={1080}
      />,
    );
    expect(screen.getByText("10")).toBeTruthy(); // Successes count
    expect(screen.getByText("2")).toBeTruthy(); // Failures count
  });

  it("renders ModelCascadeCore rows", () => {
    render(<ModelCascadeCore progress={1} hoveredTier={null} width={1920} height={1080} />);
    expect(screen.getByText("Claude 3.5 Opus")).toBeTruthy();
    expect(screen.getByText("Claude 3.5 Sonnet")).toBeTruthy();
    expect(screen.getByText("Claude 3.5 Haiku")).toBeTruthy();
  });

  it("renders SplitScreenCore content", () => {
    render(
      <SplitScreenCore
        progress={0.5}
        leftContent={<div>AGENTIC</div>}
        rightContent={<div>VIBE CODING</div>}
        width={1920}
        height={1080}
      />,
    );
    expect(screen.getByText("AGENTIC")).toBeTruthy();
    expect(screen.getByText("VIBE CODING")).toBeTruthy();
  });

  it("renders GlassmorphismCardCore with style props", () => {
    const { container } = render(
      <GlassmorphismCardCore className="test-card" style={{ marginTop: 20 }}>
        <div>Card Content</div>
      </GlassmorphismCardCore>,
    );
    expect(screen.getByText("Card Content")).toBeTruthy();
    const card = container.firstChild as HTMLElement;
    expect(card.style.marginTop).toBe("20px");
  });
});
