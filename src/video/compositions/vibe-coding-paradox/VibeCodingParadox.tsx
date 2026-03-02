import { Fragment, type FC } from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { COLORS, TYPOGRAPHY, VCP_DURATIONS, VCP_TIMING } from "../../lib/constants";
import { musicVolumeAtFrame } from "../../lib/audio-helpers";
import { getSceneAudioEntries, getVoiceActiveFrames } from "../../lib/narration";

import { Scene01_Hook } from "./Scene01_Hook";
import { Scene02_PhysicsOfAttention } from "./Scene02_PhysicsOfAttention";
import { Scene03_BeforeState } from "./Scene03_BeforeState";
import { Scene04_FiveLayerStack } from "./Scene04_FiveLayerStack";
import { Scene05_FixLoop } from "./Scene05_FixLoop";
import { Scene06_AgentMemory } from "./Scene06_AgentMemory";
import { Scene07_SkillMatching } from "./Scene07_SkillMatching";
import { Scene08_MetaBuild } from "./Scene08_MetaBuild";
import { Scene09_Results } from "./Scene09_Results";
import { Scene10_EndCard } from "./Scene10_EndCard";

const SCENES = [
  { component: Scene01_Hook, duration: VCP_DURATIONS.hook },
  {
    component: Scene02_PhysicsOfAttention,
    duration: VCP_DURATIONS.physicsOfAttention,
  },
  { component: Scene03_BeforeState, duration: VCP_DURATIONS.beforeState },
  { component: Scene04_FiveLayerStack, duration: VCP_DURATIONS.fiveLayerStack },
  { component: Scene05_FixLoop, duration: VCP_DURATIONS.fixLoop },
  { component: Scene06_AgentMemory, duration: VCP_DURATIONS.agentMemory },
  { component: Scene07_SkillMatching, duration: VCP_DURATIONS.skillMatching },
  { component: Scene08_MetaBuild, duration: VCP_DURATIONS.metaBuild },
  { component: Scene09_Results, duration: VCP_DURATIONS.results },
  { component: Scene10_EndCard, duration: VCP_DURATIONS.endCard },
] as const;

const voiceActiveFrames = getVoiceActiveFrames();
const sceneAudioEntries = getSceneAudioEntries();

export const VibeCodingParadox: FC = () => {
  const transitionDuration = VCP_TIMING.transitionFrames;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.darkBg,
        fontFamily: TYPOGRAPHY.fontFamily.sans,
      }}
    >
      {/* Background music — full duration, auto-ducked when voiceover is active */}
      <Audio
        src={staticFile("audio/background-music.mp3")}
        volume={(f) => musicVolumeAtFrame(f, voiceActiveFrames)}
        startFrom={0}
      />

      {/* Per-scene voiceover audio */}
      {sceneAudioEntries.map(({ sceneId, startFrame }) => (
        <Sequence
          key={sceneId}
          from={startFrame}
          durationInFrames={VCP_DURATIONS[sceneId as keyof typeof VCP_DURATIONS]}
        >
          <Audio src={staticFile(`audio/vcp-${sceneId}.mp3`)} volume={1.0} />
        </Sequence>
      ))}

      {/* Visual scenes */}
      <TransitionSeries>
        {SCENES.map((scene, index) => {
          const SceneComponent = scene.component;
          return (
            <Fragment key={index}>
              <TransitionSeries.Sequence durationInFrames={scene.duration}>
                <SceneComponent />
              </TransitionSeries.Sequence>
              {index < SCENES.length - 1 && (
                <TransitionSeries.Transition
                  presentation={fade()}
                  timing={linearTiming({
                    durationInFrames: transitionDuration,
                  })}
                />
              )}
            </Fragment>
          );
        })}
      </TransitionSeries>
    </AbsoluteFill>
  );
};
