/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { AgentNodeCard } from "./AgentNodeCard";

afterEach(cleanup);

describe("AgentNodeCard", () => {
  const baseProps = {
    agentId: "agent-1",
    agentName: "ResearchBot",
    agentType: "researcher" as const,
    status: "active" as const,
    currentTask: "Gathering data",
    completedTasks: 5,
  };

  it("renders agent name", () => {
    render(<AgentNodeCard {...baseProps} />);
    expect(screen.getByText("ResearchBot")).toBeDefined();
  });

  it("renders agent type badge", () => {
    render(<AgentNodeCard {...baseProps} />);
    expect(screen.getByText("researcher")).toBeDefined();
  });

  it("renders current task", () => {
    render(<AgentNodeCard {...baseProps} />);
    expect(screen.getByText("Gathering data")).toBeDefined();
  });

  it("renders idle status", () => {
    render(<AgentNodeCard {...baseProps} status="idle" currentTask={undefined} />);
    expect(screen.getByText("idle")).toBeDefined();
  });
});
