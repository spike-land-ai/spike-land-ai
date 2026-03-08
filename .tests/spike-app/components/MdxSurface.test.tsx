import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MdxSurface } from "@/ui/components/MdxSurface";

vi.mock("@/ui/src/hooks/useMcp", () => ({
  useMcpToolCall: () => ({
    mutate: vi.fn(),
    isPending: false,
    data: undefined,
    error: undefined,
  }),
}));

describe("MdxSurface", () => {
  it("renders executable cards for supported bash blocks", () => {
    render(
      <MdxSurface
        appSlug="qa-studio"
        content={"```bash\nopen https://spike.land\nread main\n```"}
      />,
    );

    expect(screen.getAllByText("Executable Bash")).toHaveLength(2);
    expect(screen.getByText("web_navigate")).toBeInTheDocument();
    expect(screen.getByText("web_read")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Run web_/i })).toHaveLength(2);
  });

  it("leaves unsupported bash blocks as normal code", () => {
    render(
      <MdxSurface
        appSlug="qa-studio"
        content={"```bash\nnpm install react\n```"}
      />,
    );

    expect(screen.queryByText("Executable Bash")).not.toBeInTheDocument();
    expect(screen.getByText("npm install react")).toBeInTheDocument();
  });
});
