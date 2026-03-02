import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CodeHistoryCarousel } from "../../components/AutoSaveHistory";
import { cSessMock } from "../config/cSessMock";

// Mock the Wrapper component to avoid complex renderApp setup
vi.mock("@/components/app/wrapper", () => ({
  Wrapper: ({ code }: { code?: string }) => (
    <div data-testid="wrapper-mock">{code?.substring(0, 30) ?? ""}</div>
  ),
}));

// Mock the useVirtualizer hook
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: vi.fn().mockReturnValue({
    getVirtualItems: () => [
      { index: 0, key: "0", size: 150, start: 0 },
      { index: 1, key: "1", size: 150, start: 150 },
    ],
    getTotalSize: () => 300,
  }),
}));

// Mock the getCodeSpace hook
vi.mock("@/hooks/getCodeSpace", () => ({
  getCodeSpace: () => "test-code-space",
}));

const mockHistoryData = [
  { timestamp: 1625097600000, code: 'console.warn("Version 1");' },
  { timestamp: 1625184000000, code: 'console.warn("Version 2");' },
];

describe("CodeHistoryCarousel", () => {
  const mockOnRestore = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock fetch for loadVersionHistory and restore calls
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockHistoryData),
      }),
    ) as unknown as typeof fetch;
  });

  it("renders history items and handles restore", async () => {
    render(
      <CodeHistoryCarousel
        codeSpace="test"
        cSess={cSessMock}
        onRestore={mockOnRestore}
        onClose={mockOnClose}
      />,
    );

    // Wait for the history items to be rendered
    await waitFor(
      () => {
        expect(screen.getByText("Version 2")).toBeInTheDocument();
        expect(screen.getByText("Version 1")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    // Find and click the first "Restore" button
    const restoreButtons = screen.getAllByText("Restore");
    if (restoreButtons[0]) {
      fireEvent.click(restoreButtons[0]);
    }

    // Check if onRestore was called with the correct item
    await waitFor(
      () => {
        expect(mockOnRestore).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'console.warn("Version 2");',
            timestamp: 1625184000000,
          }),
        );
      },
      { timeout: 5000 },
    );
  });

  it("handles close button click", async () => {
    render(
      <CodeHistoryCarousel
        codeSpace="test"
        cSess={cSessMock}
        onRestore={mockOnRestore}
        onClose={mockOnClose}
      />,
    );

    // Wait for the component to render
    await waitFor(
      () => {
        expect(screen.getByText("Code History")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    // Find and click the "Close" button
    const closeButton = screen.getByText("Close");
    fireEvent.click(closeButton);

    // Check if onClose was called
    expect(mockOnClose).toHaveBeenCalled();
  });
});
