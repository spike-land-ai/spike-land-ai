import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { EditableText } from "./EditableText";
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

describe("EditableText", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it("renders correctly in view mode", () => {
    render(<EditableText content="Initial docs content" contentId="test-id" />);
    expect(screen.getByText("Initial docs content")).toBeDefined();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("loads content from sessionStorage if available", () => {
    sessionStorage.setItem("edit_text_test-id", "Saved session content");
    render(<EditableText content="Initial docs content" contentId="test-id" />);
    expect(screen.getByText("Saved session content")).toBeDefined();
  });

  it("enters edit mode when clicking the edit button", () => {
    render(<EditableText content="Initial docs content" contentId="test-id" />);
    const editButtons = screen.getAllByRole("button");
    fireEvent.click(editButtons[0]!); // Click the ghost edit button
    expect(screen.getByRole("textbox")).toBeDefined();
    expect(screen.getByDisplayValue("Initial docs content")).toBeDefined();
  });

  it("saves changes locally and opens GitHub issue on save", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ number: 123 }),
    });

    render(<EditableText content="Initial docs content" contentId="test-id" />);

    // Enter edit mode
    fireEvent.click(screen.getAllByRole("button")[0]!);

    // Modify text
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Updated content!" } });

    // Click save
    fireEvent.click(screen.getByText(/Save/i));

    await waitFor(() => {
      // Expect sessionStorage to be updated
      expect(sessionStorage.getItem("edit_text_test-id")).toBe("Updated content!");
      // Expect component to show updated text
      expect(screen.getByText("Updated content!")).toBeDefined();
      // Expect toast to be called
      expect(toast.success).toHaveBeenCalledWith("Saved your edits locally!");
      // Expect fetch to be called for GitHub issue
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/github/issue",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("Updated content!"),
        }),
      );
    });
  });

  it("cancels edits and restores previous content", () => {
    render(<EditableText content="Original content" contentId="test-id" />);

    // Enter edit mode
    fireEvent.click(screen.getAllByRole("button")[0]!);

    // Modify text
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Oops mistake" } });

    // Click cancel
    fireEvent.click(screen.getByText(/Cancel/i));

    // Expect original text to be displayed and NOT the modified version
    expect(screen.getByText("Original content")).toBeDefined();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});
