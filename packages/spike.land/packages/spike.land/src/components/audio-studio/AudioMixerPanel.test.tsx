/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { AudioMixerPanel } from "./AudioMixerPanel";

afterEach(cleanup);

describe("AudioMixerPanel", () => {
  const mockTracks = [
    { id: "1", name: "Drums", volume: 80, isMuted: false, isSolo: false, color: "#ff5555" },
    { id: "2", name: "Bass", volume: 65, isMuted: false, isSolo: false, color: "#55ff55" },
  ];

  it("renders all tracks", () => {
    render(<AudioMixerPanel tracks={mockTracks} masterVolume={100} />);
    expect(screen.getByText("Drums")).toBeDefined();
    expect(screen.getByText("Bass")).toBeDefined();
  });

  it("shows master volume", () => {
    render(<AudioMixerPanel tracks={mockTracks} masterVolume={75} />);
    expect(screen.getByText(/75/)).toBeDefined();
  });

  it("mute button toggles muted state", () => {
    render(<AudioMixerPanel tracks={mockTracks} masterVolume={100} />);
    const muteButtons = screen.getAllByRole("button", { name: /mute drums/i });
    expect(muteButtons.length).toBeGreaterThan(0);
    fireEvent.click(muteButtons[0]!);
    const unmuteButton = screen.getByRole("button", { name: /unmute drums/i });
    expect(unmuteButton).toBeDefined();
  });

  it("solo button toggles solo state", () => {
    render(<AudioMixerPanel tracks={mockTracks} masterVolume={100} />);
    const soloButtons = screen.getAllByRole("button", { name: /solo drums/i });
    expect(soloButtons.length).toBeGreaterThan(0);
    fireEvent.click(soloButtons[0]!);
    const unsoloButton = screen.getByRole("button", { name: /unsolo drums/i });
    expect(unsoloButton).toBeDefined();
  });
});
