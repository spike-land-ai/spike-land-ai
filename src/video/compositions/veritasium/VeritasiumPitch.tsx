import { Series } from "remotion";
import { Scene01_Hook } from "./Scene01_Hook";
import { Scene02_Attention } from "./Scene02_Attention";
import { Scene03_Stack } from "./Scene03_Stack";
import { Scene04_Darwin } from "./Scene04_Darwin";
import { Scene05_Memory } from "./Scene05_Memory";
import { Scene06_Cascade } from "./Scene06_Cascade";
import { Scene07_CTA } from "./Scene07_CTA";

export const VERITASIUM_SCENE_DURATION = 90;

export function VeritasiumPitch() {
  return (
    <Series>
      <Series.Sequence durationInFrames={VERITASIUM_SCENE_DURATION}>
        <Scene01_Hook />
      </Series.Sequence>
      <Series.Sequence durationInFrames={VERITASIUM_SCENE_DURATION}>
        <Scene02_Attention />
      </Series.Sequence>
      <Series.Sequence durationInFrames={VERITASIUM_SCENE_DURATION}>
        <Scene03_Stack />
      </Series.Sequence>
      <Series.Sequence durationInFrames={VERITASIUM_SCENE_DURATION}>
        <Scene04_Darwin />
      </Series.Sequence>
      <Series.Sequence durationInFrames={VERITASIUM_SCENE_DURATION}>
        <Scene05_Memory />
      </Series.Sequence>
      <Series.Sequence durationInFrames={VERITASIUM_SCENE_DURATION}>
        <Scene06_Cascade />
      </Series.Sequence>
      <Series.Sequence durationInFrames={VERITASIUM_SCENE_DURATION}>
        <Scene07_CTA />
      </Series.Sequence>
    </Series>
  );
}
