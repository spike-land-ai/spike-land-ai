import { registerRoot } from "remotion";
import { RemotionRoot } from "../../src/media/educational-videos/video/Root";

export * from "../../src/media/educational-videos/core-logic/lib-index";
export { RemotionRoot };

registerRoot(RemotionRoot);
