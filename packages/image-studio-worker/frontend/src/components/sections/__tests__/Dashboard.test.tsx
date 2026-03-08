import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { Dashboard } from "../Dashboard";
import { callTool, parseToolResult } from "@/api/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  callTool: vi.fn(),
  parseToolResult: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

describe("Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      user: { name: "Test User", email: "test@example.com", image: null },
      isLoggedIn: true,
      login: vi.fn(),
      logout: vi.fn(),
      loading: false,
      error: null,
    });
  });

  it("renders the loading skeleton initially", () => {
    // Setup callTool to never resolve so it stays in loading state
    vi.mocked(callTool).mockImplementation(() => new Promise(() => {}));

    const { container } = render(<Dashboard />);

    // Using container.querySelector since it doesn't have a test id or specific aria role
    const pulseElement = container.querySelector(".animate-pulse");
    expect(pulseElement).toBeInTheDocument();
  });

  it("fetches and displays stats successfully", async () => {
    // Setup mocks to return dummy successful data
    const mockBalRes = { content: [{ type: "text", text: '{"remaining": 450}' }] };
    const mockLibRes = { content: [{ type: "text", text: '{"count": 12, "images": []}' }] };

    vi.mocked(callTool).mockImplementation((toolName) => {
      if (toolName === "img_credits") return Promise.resolve(mockBalRes) as any;
      if (toolName === "img_list") return Promise.resolve(mockLibRes) as any;
      return Promise.resolve({ content: [] });
    });

    vi.mocked(parseToolResult).mockImplementation((res: any) => {
      if (res === mockBalRes) return { remaining: 450 };
      if (res === mockLibRes) return { count: 12, images: [] };
      return {};
    });

    render(<Dashboard />);

    // Check stats are rendered after fetching
    await waitFor(() => {
      // 450 formatted is "450"
      expect(screen.getByText("450")).toBeInTheDocument();
      // 12 image count
      expect(screen.getByText("12")).toBeInTheDocument();
    });

    expect(callTool).toHaveBeenCalledWith("img_credits");
    expect(callTool).toHaveBeenCalledWith("img_list", { limit: 1 });
  });

  it("handles errors during fetching and shows a toast", async () => {
    const error = new Error("Failed to fetch");
    vi.mocked(callTool).mockRejectedValue(error);

    render(<Dashboard />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to fetch");
    });
  });

  it("renders static cost references correctly", async () => {
    // Keep it simple and resolve quickly for this test
    vi.mocked(callTool).mockResolvedValue({ content: [] } as any);
    vi.mocked(parseToolResult).mockReturnValue({ remaining: 0, count: 0 });

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("Dashboard")).toBeInTheDocument();
    });

    // Check headings for the cost references sections
    expect(screen.getByText("Enhancement Tiers")).toBeInTheDocument();
    expect(screen.getByText("Advanced Features")).toBeInTheDocument();

    // Check some of the specific static reference items are rendered
    // from ENHANCEMENT_TIERS
    expect(screen.getAllByText("FREE").length).toBeGreaterThan(0);
    expect(screen.getAllByText("TIER 1K").length).toBeGreaterThan(0);

    // from ADVANCED_FEATURE_COSTS
    expect(screen.getByText("Subject Ref", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Grounding", { exact: false })).toBeInTheDocument();
  });
});
