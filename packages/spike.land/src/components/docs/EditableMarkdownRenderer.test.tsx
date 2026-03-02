import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { EditableMarkdownRenderer } from "./EditableMarkdownRenderer";
import { toast } from "sonner";

// Mock sonner and lucide-react
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    promise: vi.fn((promise, options) => {
      promise.then(options.success).catch(options.error);
      return promise;
    }),
  },
}));

// Mock fetch for GitHub API
global.fetch = vi.fn();

// Mock the MarkdownRenderer correctly. It takes a content prop.
vi.mock("./MarkdownRenderer", () => ({
  MarkdownRenderer: ({ content }: { content: string }) => (
    <div data-testid="mock-markdown-renderer">{content}</div>
  ),
}));

describe("EditableMarkdownRenderer", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it("renders standard mode with MarkdownRenderer correctly", () => {
    render(<EditableMarkdownRenderer content="# Hello Markdown" contentId="md-test-id" />);
    // Initial render should have the mock MarkdownRenderer
    expect(screen.getByTestId("mock-markdown-renderer")).toBeDefined();
    expect(screen.getByText("# Hello Markdown")).toBeDefined();
    // No textarea should be shown
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("loads content from sessionStorage automatically if available", () => {
    sessionStorage.setItem("edit_md_md-test-id", "## Loaded session content");
    render(<EditableMarkdownRenderer content="Original fallback" contentId="md-test-id" />);
    expect(screen.getByTestId("mock-markdown-renderer")).toBeDefined();
    expect(screen.getByText("## Loaded session content")).toBeDefined();
  });

  it("enters edit mode when clicking the edit button on hover", () => {
    render(<EditableMarkdownRenderer content="Markdown content" contentId="md-test-id" />);
    // The edit button should be present
    const editButton = screen.getByText(/Edit Page/i);
    fireEvent.click(editButton);

    // Test that the textarea is now visible
    expect(screen.getByRole("textbox")).toBeDefined();
    expect(screen.getByDisplayValue("Markdown content")).toBeDefined();
    // The rendered output should vanish while editing
    expect(screen.queryByTestId("mock-markdown-renderer")).toBeNull();
  });

  it("saves changes locally and opens GitHub issue successfully", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ number: 999 }),
    });

    render(<EditableMarkdownRenderer content="Old Markdown" contentId="md-test-id" />);

    // Enter edit mode
    fireEvent.click(screen.getByText(/Edit Page/i));

    // Modify text
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Brand New Markdown" } });

    // Click save
    fireEvent.click(screen.getByText(/Save Edits/i));

    await waitFor(() => {
      // Expect sessionStorage to be updated
      expect(sessionStorage.getItem("edit_md_md-test-id")).toBe("Brand New Markdown");

      // Expect component to revert to MarkdownRenderer showing updated text
      expect(screen.getByTestId("mock-markdown-renderer")).toBeDefined();
      expect(screen.getByText("Brand New Markdown")).toBeDefined();

      // Expect toast to be called
      expect(toast.success).toHaveBeenCalledWith("Saved your edits locally!");

      // Expect fetch to be called for GitHub issue formatted as markdown codeblock
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/github/issue",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("```markdown\\nBrand New Markdown\\n```"),
        }),
      );
    });
  });

  it("cancels edits and restores previous markdown content", () => {
    render(<EditableMarkdownRenderer content="Base version" contentId="md-test-id" />);

    // Enter edit mode
    fireEvent.click(screen.getByText(/Edit Page/i));

    // Modify text
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Draft changes" } });

    // Click cancel
    fireEvent.click(screen.getByText(/Cancel/i));

    // Expect original text to be displayed and NOT the modified edit
    expect(screen.getByTestId("mock-markdown-renderer")).toBeDefined();
    expect(screen.getByText("Base version")).toBeDefined();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});
