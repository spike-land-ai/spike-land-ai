"use client";

import { HeroSection } from "../../components/bazdmeg/HeroSection";
import { PrinciplesList } from "../../components/bazdmeg/PrinciplesList";
import { EffortSplit } from "../../components/bazdmeg/EffortSplit";
import { CTASection } from "../../components/bazdmeg/CTASection";

export function BazdmegPage() {
  return (
    <>
      <HeroSection />
      <PrinciplesList />
      <EffortSplit />
      <CTASection />
    </>
  );
}
