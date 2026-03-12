import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguageSwitcher } from "../LanguageSwitcher";

// Mock react-i18next
const mockChangeLanguage = vi.fn();
const mockI18n = {
  language: "en",
  resolvedLanguage: "en",
  changeLanguage: mockChangeLanguage,
};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: mockI18n,
  }),
}));

// Mock the i18n module to expose supportedLanguages
vi.mock("../../i18n", () => ({
  resolveSupportedLanguage: (lang: string) => {
    const normalized = lang?.trim().toLowerCase().split("-")[0];
    return ["en", "hu"].includes(normalized ?? "") ? normalized : "en";
  },
  supportedLanguages: [
    { code: "en", label: "English", flag: "GB" },
    { code: "hu", label: "Magyar", flag: "HU" },
  ],
}));

describe("LanguageSwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockI18n.language = "en";
    mockI18n.resolvedLanguage = "en";
    mockChangeLanguage.mockResolvedValue(undefined);
  });

  it("renders the language toggle button", () => {
    render(<LanguageSwitcher />);
    const button = screen.getByRole("button", { name: "common:language" });
    expect(button).toBeInTheDocument();
  });

  it("button has aria-haspopup='listbox'", () => {
    render(<LanguageSwitcher />);
    const button = screen.getByRole("button", { name: "common:language" });
    expect(button).toHaveAttribute("aria-haspopup", "listbox");
  });

  it("button has aria-expanded='false' when closed", () => {
    render(<LanguageSwitcher />);
    const button = screen.getByRole("button", { name: "common:language" });
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("renders the current language label", () => {
    render(<LanguageSwitcher />);
    expect(screen.getByText("English")).toBeInTheDocument();
  });

  it("does not render the dropdown initially", () => {
    render(<LanguageSwitcher />);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("opens dropdown when button is clicked", () => {
    render(<LanguageSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: "common:language" }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("button shows aria-expanded='true' when open", () => {
    render(<LanguageSwitcher />);
    const button = screen.getByRole("button", { name: "common:language" });
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
  });

  it("renders both language options in dropdown", () => {
    render(<LanguageSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: "common:language" }));
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
  });

  it("renders English and Magyar language options", () => {
    render(<LanguageSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: "common:language" }));
    expect(screen.getAllByText("English")).toHaveLength(2); // button label + option
    expect(screen.getByText("Magyar")).toBeInTheDocument();
  });

  it("marks the current language as selected", () => {
    render(<LanguageSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: "common:language" }));
    const englishOption = screen.getAllByRole("option")[0];
    expect(englishOption).toHaveAttribute("aria-selected", "true");
  });

  it("calls i18n.changeLanguage when a language option is selected", () => {
    render(<LanguageSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: "common:language" }));
    fireEvent.click(screen.getByText("Magyar"));
    expect(mockChangeLanguage).toHaveBeenCalledWith("hu");
  });

  it("closes the dropdown after selecting a language", () => {
    render(<LanguageSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: "common:language" }));
    fireEvent.click(screen.getByText("Magyar"));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("closes dropdown on outside click", () => {
    render(<LanguageSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: "common:language" }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("toggles dropdown closed when button is clicked again", () => {
    render(<LanguageSwitcher />);
    const button = screen.getByRole("button", { name: "common:language" });
    fireEvent.click(button);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.click(button);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("renders with Magyar as current language when i18n.language is hu", () => {
    mockI18n.language = "hu";
    mockI18n.resolvedLanguage = "hu";
    render(<LanguageSwitcher />);
    // Magyar should be the current selection shown in the button
    expect(screen.getByText("Magyar")).toBeInTheDocument();
  });

  it("has correct listbox aria-label", () => {
    render(<LanguageSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: "common:language" }));
    expect(screen.getByRole("listbox", { name: "common:language" })).toBeInTheDocument();
  });
});
