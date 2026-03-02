import "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      mesh: Record<string, unknown>;
      ambientLight: Record<string, unknown>;
      pointLight: Record<string, unknown>;
    }
  }
}
