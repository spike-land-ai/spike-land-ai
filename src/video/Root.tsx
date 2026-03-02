import { type FC, type ReactNode } from "react";
import { AbsoluteFill, Composition, Folder } from "remotion";
import {
  Scene01_Hook,
  Scene02_PhysicsOfAttention,
  Scene03_BeforeState,
  Scene04_FiveLayerStack,
  Scene05_FixLoop,
  Scene06_AgentMemory,
  Scene07_SkillMatching,
  Scene08_MetaBuild,
  Scene09_Results,
  Scene10_EndCard,
  VibeCodingParadox,
} from "./compositions/vibe-coding-paradox";
import { COLORS, TYPOGRAPHY, VCP_DURATIONS, VCP_TIMING, VIDEO_CONFIG } from "./lib/constants";
import { N404_DURATIONS, N404_TIMING } from "./lib/n404-constants";
import {
  VERITASIUM_SCENE_DURATION,
  VeritasiumPitch,
} from "./compositions/veritasium/VeritasiumPitch";
import {
  NoMore404s,
  Scene01_Hook as N404_Scene01_Hook,
  Scene02_Platform as N404_Scene02_Platform,
  Scene03_Codespace as N404_Scene03_Codespace,
  Scene04_LearnIT as N404_Scene04_LearnIT,
  Scene05_Generate as N404_Scene05_Generate,
  Scene07_BAZDMEG as N404_Scene07_BAZDMEG,
  Scene08_Breakthrough as N404_Scene08_Breakthrough,
  Scene09_Agents as N404_Scene09_Agents,
  Scene10_EndCard as N404_Scene10_EndCard,
} from "./compositions/no-more-404s";

// Component imports for preview compositions
import { TokenVisualization } from "./components/animations/TokenVisualization";
import { SoftmaxEquation } from "./components/ui/SoftmaxEquation";
import { FiveLayerStack } from "./components/diagrams/FiveLayerStack";
import { DarwinianTree } from "./components/animations/DarwinianTree";
import { PetriDishAnimation } from "./components/animations/PetriDishAnimation";
import { RecursiveZoom } from "./components/animations/RecursiveZoom";
import { AttentionSpotlight } from "./components/animations/AttentionSpotlight";
import { SkillMatchingDiagram } from "./components/diagrams/SkillMatchingDiagram";
import { TakeawayCards } from "./components/ui/TakeawayCards";

// Wrapper for component previews
const PreviewWrapper: FC<{ children: ReactNode }> = ({ children }) => (
  <AbsoluteFill
    style={{
      backgroundColor: COLORS.darkBg,
      fontFamily: TYPOGRAPHY.fontFamily.sans,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    {children}
  </AbsoluteFill>
);

// Component preview compositions
const TokenVisualizationPreview: FC = () => (
  <TokenVisualization text="The quick brown fox jumps over the lazy dog" delay={5} />
);

const SoftmaxEquationPreview: FC = () => (
  <PreviewWrapper>
    <SoftmaxEquation variant="softmax" delay={5} />
  </PreviewWrapper>
);

const FiveLayerStackPreview: FC = () => (
  <PreviewWrapper>
    <FiveLayerStack revealCount={5} delay={5} />
  </PreviewWrapper>
);

const DarwinianTreePreview: FC = () => <DarwinianTree generations={3} delay={5} />;

const PetriDishPreview: FC = () => (
  <PetriDishAnimation
    organisms={[
      { label: "Import fix", status: "active", confidence: 0.85 },
      { label: "ESM pattern", status: "active", confidence: 0.7 },
      { label: "Wrong approach", status: "deprecated", confidence: 0.2 },
      { label: "New pattern", status: "candidate", confidence: 0.5 },
    ]}
    delay={5}
  />
);

const RecursiveZoomPreview: FC = () => <RecursiveZoom depth={5} delay={5} />;

const AttentionSpotlightPreview: FC = () => <AttentionSpotlight tokenCount={12} delay={5} />;

const SkillMatchingPreview: FC = () => (
  <PreviewWrapper>
    <SkillMatchingDiagram url="spike.land/create/games/tetris" delay={5} />
  </PreviewWrapper>
);

const TakeawayCardsPreview: FC = () => (
  <PreviewWrapper>
    <TakeawayCards delay={5} />
  </PreviewWrapper>
);

const PREVIEW_DURATION = 300;

export const RemotionRoot = () => {
  return (
    <>
      {/* Main 11-minute composition */}
      <Composition
        id="VibeCodingParadox"
        component={VibeCodingParadox}
        durationInFrames={VCP_TIMING.totalFrames}
        fps={VCP_TIMING.fps}
        width={VIDEO_CONFIG.width}
        height={VIDEO_CONFIG.height}
      />

      <Composition
        id="VeritasiumPitch"
        component={VeritasiumPitch}
        durationInFrames={VERITASIUM_SCENE_DURATION * 7}
        fps={VCP_TIMING.fps}
        width={VIDEO_CONFIG.width}
        height={VIDEO_CONFIG.height}
      />

      {/* No More 404s — 5m30s portrait composition */}
      <Composition
        id="NoMore404s"
        component={NoMore404s}
        durationInFrames={N404_TIMING.totalFrames}
        fps={N404_TIMING.fps}
        width={1080}
        height={1920}
      />

      {/* Individual scenes for preview */}
      <Folder name="Scenes">
        <Composition
          id="VCP-Scene01-Hook"
          component={Scene01_Hook}
          durationInFrames={VCP_DURATIONS.hook}
          fps={VCP_TIMING.fps}
          width={VIDEO_CONFIG.width}
          height={VIDEO_CONFIG.height}
        />
        <Composition
          id="VCP-Scene02-PhysicsOfAttention"
          component={Scene02_PhysicsOfAttention}
          durationInFrames={VCP_DURATIONS.physicsOfAttention}
          fps={VCP_TIMING.fps}
          width={VIDEO_CONFIG.width}
          height={VIDEO_CONFIG.height}
        />
        <Composition
          id="VCP-Scene03-BeforeState"
          component={Scene03_BeforeState}
          durationInFrames={VCP_DURATIONS.beforeState}
          fps={VCP_TIMING.fps}
          width={VIDEO_CONFIG.width}
          height={VIDEO_CONFIG.height}
        />
        <Composition
          id="VCP-Scene04-FiveLayerStack"
          component={Scene04_FiveLayerStack}
          durationInFrames={VCP_DURATIONS.fiveLayerStack}
          fps={VCP_TIMING.fps}
          width={VIDEO_CONFIG.width}
          height={VIDEO_CONFIG.height}
        />
        <Composition
          id="VCP-Scene05-FixLoop"
          component={Scene05_FixLoop}
          durationInFrames={VCP_DURATIONS.fixLoop}
          fps={VCP_TIMING.fps}
          width={VIDEO_CONFIG.width}
          height={VIDEO_CONFIG.height}
        />
        <Composition
          id="VCP-Scene06-AgentMemory"
          component={Scene06_AgentMemory}
          durationInFrames={VCP_DURATIONS.agentMemory}
          fps={VCP_TIMING.fps}
          width={VIDEO_CONFIG.width}
          height={VIDEO_CONFIG.height}
        />
        <Composition
          id="VCP-Scene07-SkillMatching"
          component={Scene07_SkillMatching}
          durationInFrames={VCP_DURATIONS.skillMatching}
          fps={VCP_TIMING.fps}
          width={VIDEO_CONFIG.width}
          height={VIDEO_CONFIG.height}
        />
        <Composition
          id="VCP-Scene08-MetaBuild"
          component={Scene08_MetaBuild}
          durationInFrames={VCP_DURATIONS.metaBuild}
          fps={VCP_TIMING.fps}
          width={VIDEO_CONFIG.width}
          height={VIDEO_CONFIG.height}
        />
        <Composition
          id="VCP-Scene09-Results"
          component={Scene09_Results}
          durationInFrames={VCP_DURATIONS.results}
          fps={VCP_TIMING.fps}
          width={VIDEO_CONFIG.width}
          height={VIDEO_CONFIG.height}
        />
        <Composition
          id="VCP-Scene10-EndCard"
          component={Scene10_EndCard}
          durationInFrames={VCP_DURATIONS.endCard}
          fps={VCP_TIMING.fps}
          width={VIDEO_CONFIG.width}
          height={VIDEO_CONFIG.height}
        />
      </Folder>

      {/* N404 individual scenes for preview (portrait 1080×1920) */}
      <Folder name="N404-Scenes">
        <Composition
          id="N404-Scene01-Hook"
          component={N404_Scene01_Hook}
          durationInFrames={N404_DURATIONS.hook}
          fps={N404_TIMING.fps}
          width={1080}
          height={1920}
        />
        <Composition
          id="N404-Scene02-Platform"
          component={N404_Scene02_Platform}
          durationInFrames={N404_DURATIONS.platform}
          fps={N404_TIMING.fps}
          width={1080}
          height={1920}
        />
        <Composition
          id="N404-Scene03-Codespace"
          component={N404_Scene03_Codespace}
          durationInFrames={N404_DURATIONS.codespace}
          fps={N404_TIMING.fps}
          width={1080}
          height={1920}
        />
        <Composition
          id="N404-Scene04-LearnIT"
          component={N404_Scene04_LearnIT}
          durationInFrames={N404_DURATIONS.learnit}
          fps={N404_TIMING.fps}
          width={1080}
          height={1920}
        />
        <Composition
          id="N404-Scene05-Generate"
          component={N404_Scene05_Generate}
          durationInFrames={N404_DURATIONS.generate}
          fps={N404_TIMING.fps}
          width={1080}
          height={1920}
        />
        <Composition
          id="N404-Scene07-BAZDMEG"
          component={N404_Scene07_BAZDMEG}
          durationInFrames={N404_DURATIONS.bazdmeg}
          fps={N404_TIMING.fps}
          width={1080}
          height={1920}
        />
        <Composition
          id="N404-Scene08-Breakthrough"
          component={N404_Scene08_Breakthrough}
          durationInFrames={N404_DURATIONS.breakthrough}
          fps={N404_TIMING.fps}
          width={1080}
          height={1920}
        />
        <Composition
          id="N404-Scene09-Agents"
          component={N404_Scene09_Agents}
          durationInFrames={N404_DURATIONS.agents}
          fps={N404_TIMING.fps}
          width={1080}
          height={1920}
        />
        <Composition
          id="N404-Scene10-EndCard"
          component={N404_Scene10_EndCard}
          durationInFrames={N404_DURATIONS.endCard}
          fps={N404_TIMING.fps}
          width={1080}
          height={1920}
        />
      </Folder>

      {/* Component test compositions (300 frames each) */}
      <Folder name="Components">
        <Composition
          id="Preview-TokenVisualization"
          component={TokenVisualizationPreview}
          durationInFrames={PREVIEW_DURATION}
          fps={VCP_TIMING.fps}
          width={VIDEO_CONFIG.width}
          height={VIDEO_CONFIG.height}
        />
        <Composition
          id="Preview-SoftmaxEquation"
          component={SoftmaxEquationPreview}
          durationInFrames={PREVIEW_DURATION}
          fps={VCP_TIMING.fps}
          width={VIDEO_CONFIG.width}
          height={VIDEO_CONFIG.height}
        />
        <Composition
          id="Preview-FiveLayerStack"
          component={FiveLayerStackPreview}
          durationInFrames={PREVIEW_DURATION}
          fps={VCP_TIMING.fps}
          width={VIDEO_CONFIG.width}
          height={VIDEO_CONFIG.height}
        />
        <Composition
          id="Preview-DarwinianTree"
          component={DarwinianTreePreview}
          durationInFrames={PREVIEW_DURATION}
          fps={VCP_TIMING.fps}
          width={VIDEO_CONFIG.width}
          height={VIDEO_CONFIG.height}
        />
        <Composition
          id="Preview-PetriDish"
          component={PetriDishPreview}
          durationInFrames={PREVIEW_DURATION}
          fps={VCP_TIMING.fps}
          width={VIDEO_CONFIG.width}
          height={VIDEO_CONFIG.height}
        />
        <Composition
          id="Preview-RecursiveZoom"
          component={RecursiveZoomPreview}
          durationInFrames={PREVIEW_DURATION}
          fps={VCP_TIMING.fps}
          width={VIDEO_CONFIG.width}
          height={VIDEO_CONFIG.height}
        />
        <Composition
          id="Preview-AttentionSpotlight"
          component={AttentionSpotlightPreview}
          durationInFrames={PREVIEW_DURATION}
          fps={VCP_TIMING.fps}
          width={VIDEO_CONFIG.width}
          height={VIDEO_CONFIG.height}
        />
        <Composition
          id="Preview-SkillMatching"
          component={SkillMatchingPreview}
          durationInFrames={PREVIEW_DURATION}
          fps={VCP_TIMING.fps}
          width={VIDEO_CONFIG.width}
          height={VIDEO_CONFIG.height}
        />
        <Composition
          id="Preview-TakeawayCards"
          component={TakeawayCardsPreview}
          durationInFrames={PREVIEW_DURATION}
          fps={VCP_TIMING.fps}
          width={VIDEO_CONFIG.width}
          height={VIDEO_CONFIG.height}
        />
      </Folder>
    </>
  );
};
