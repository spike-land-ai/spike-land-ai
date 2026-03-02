import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Use vi.hoisted to create mock functions that are available at mock definition time
const mockHasWebGLSupport = vi.hoisted(() => vi.fn(() => true));

// Mock the WebGL support utility
vi.mock("@/lib/webgl-support", () => ({
  hasWebGLSupport: mockHasWebGLSupport,
  isWebGLContextError: vi.fn(() => false),
}));

// Mock ErrorBoundary - render children normally
vi.mock("@/components/errors/error-boundary", () => ({
  ErrorBoundary: ({
    children,
  }: {
    children: React.ReactNode;
    fallback?: React.ReactNode;
    onError?: () => void;
  }) => <div data-testid="error-boundary">{children}</div>,
}));

// Mock Three.js with proper constructors (must be callable with `new`)
vi.mock("three", () => {
  function SphereGeometry() {
    return { dispose: vi.fn() };
  }
  function Vector3() {
    return { set: vi.fn() };
  }
  function MeshStandardMaterial() {
    return { dispose: vi.fn() };
  }
  return { SphereGeometry, Vector3, MeshStandardMaterial };
});

// Mock @react-three/fiber
vi.mock("@react-three/fiber", () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="r3f-canvas">{children}</div>
  ),
  useFrame: vi.fn(),
}));

// Mock @react-three/rapier
vi.mock("@react-three/rapier", () => ({
  Physics: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  RigidBody: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  CuboidCollider: () => null,
}));

// Mock framer-motion
vi.mock("framer-motion", () => ({
  useScroll: () => ({ scrollYProgress: { get: () => 0 } }),
}));

import { PhysicsBackground } from "./PhysicsBackground";

describe("PhysicsBackground", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasWebGLSupport.mockReturnValue(true);
  });

  it("renders Canvas when WebGL is supported", () => {
    render(<PhysicsBackground />);
    expect(screen.getByTestId("r3f-canvas")).toBeInTheDocument();
  });

  it("renders static fallback when WebGL is not supported", () => {
    mockHasWebGLSupport.mockReturnValue(false);

    const { container } = render(<PhysicsBackground />);

    expect(screen.queryByTestId("r3f-canvas")).not.toBeInTheDocument();
    // Should render the static fallback div
    expect(container.querySelector(".bg-zinc-950")).toBeInTheDocument();
  });

  it("wraps Canvas in ErrorBoundary", () => {
    render(<PhysicsBackground />);

    const errorBoundary = screen.getByTestId("error-boundary");
    expect(errorBoundary).toBeInTheDocument();
    // Canvas should be inside the error boundary
    expect(errorBoundary.querySelector("[data-testid='r3f-canvas']")).toBeInTheDocument();
  });
});
