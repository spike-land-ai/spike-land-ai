/**
 * @vitest-environment jsdom
 */
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { BlogPoll } from "./BlogPoll";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("BlogPoll", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.cookie = "spike-persona=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  });

  afterEach(() => {
    cleanup();
    document.cookie = "spike-persona=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  });

  it("should render the default question when no persona cookie", () => {
    render(<BlogPoll slug="test-article" />);
    expect(screen.getByText("Do you believe in A/B tests?")).toBeDefined();
  });

  it("should render persona-specific question when persona cookie is set", () => {
    document.cookie = "spike-persona=ml-engineer";

    render(<BlogPoll slug="test-article" />);
    expect(
      screen.getByText(
        "Is A/B testing just a crude Bayesian bandit with extra steps?",
      ),
    ).toBeDefined();
  });

  it("should render Yes and No buttons", () => {
    render(<BlogPoll slug="test-article" />);
    const buttons = screen.getAllByRole("button");
    const yesButton = buttons.find(b => b.textContent === "Yes");
    const noButton = buttons.find(b => b.textContent === "No");
    expect(yesButton).toBeDefined();
    expect(noButton).toBeDefined();
  });

  it("should submit vote and show results on click", async () => {
    (mockFetch as Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, visitorId: "v1" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            personas: {
              unknown: { votes_yes: 1, votes_no: 0 },
            },
          }),
      });

    render(<BlogPoll slug="test-article" />);
    const buttons = screen.getAllByRole("button");
    const yesButton = buttons.find(b => b.textContent === "Yes");
    expect(yesButton).toBeDefined();
    fireEvent.click(yesButton!);

    await waitFor(() => {
      expect(screen.getByText(/You voted/)).toBeDefined();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/blog/poll",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });

  it("should disable buttons while submitting", async () => {
    (mockFetch as Mock).mockImplementation(() => new Promise(() => {}));

    render(<BlogPoll slug="test-article" />);
    const buttons = screen.getAllByRole("button");
    const yesButton = buttons.find(b => b.textContent === "Yes") as HTMLButtonElement;
    expect(yesButton).toBeDefined();
    fireEvent.click(yesButton);

    await waitFor(() => {
      expect(yesButton.disabled).toBe(true);
    });
  });
});
