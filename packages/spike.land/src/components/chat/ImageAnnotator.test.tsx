import { fireEvent, render, screen } from "@testing-library/react";
import { ImageAnnotator } from "./ImageAnnotator";
import { beforeAll, describe, expect, it, vi } from "vitest";

// Mock canvas context
const mockContext = {
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  closePath: vi.fn(),
  drawImage: vi.fn(),
  canvas: {
    width: 0,
    height: 0,
  },
};

// Mock Image
global.Image = class {
  onload: () => void = () => {};
  src: string = "";
  width: number = 100;
  height: number = 100;
  constructor() {
    setTimeout(() => this.onload(), 0);
  }
} as unknown as typeof globalThis.Image;

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => mockContext,
  ) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.toDataURL = vi.fn(() => "data:image/png;base64,saved");
});

describe("ImageAnnotator", () => {
  const defaultProps = {
    initialImage: "data:image/png;base64,mock",
    onSave: vi.fn(),
    onCancel: vi.fn(),
  };

  it("renders correctly", () => {
    render(<ImageAnnotator {...defaultProps} />);
    expect(screen.getByText("Draw on screenshot")).toBeDefined();
  });

  it("draws on canvas", async () => {
    const { container } = render(<ImageAnnotator {...defaultProps} />);
    const canvas = container.querySelector("canvas");

    if (!canvas) throw new Error("Canvas not found");

    // Mock getBoundingClientRect
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
      x: 0,
      y: 0,
      bottom: 100,
      right: 100,
      toJSON: () => {},
    } as DOMRect);

    // Wait for image to load and context to be set
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Simulate drawing
    fireEvent.mouseDown(canvas, { clientX: 10, clientY: 10 });
    expect(mockContext.beginPath).toHaveBeenCalled();
    expect(mockContext.moveTo).toHaveBeenCalledWith(10, 10);

    fireEvent.mouseMove(canvas, { clientX: 20, clientY: 20 });
    expect(mockContext.lineTo).toHaveBeenCalledWith(20, 20);
    expect(mockContext.stroke).toHaveBeenCalled();

    fireEvent.mouseUp(canvas);
    expect(mockContext.closePath).toHaveBeenCalled();
  });
});
