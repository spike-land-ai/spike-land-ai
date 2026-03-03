"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BayesianConfidenceCore,
  type EvidencePoint,
  type EvidenceType,
} from "./BayesianConfidenceCore";
import { useInViewProgress } from "./useInViewProgress";

let evidenceCounter = 0;

function makeEvidence(type: EvidenceType, successRatio: number): EvidencePoint {
  evidenceCounter += 1;
  const base = type === "positive"
    ? 0.65 + Math.random() * 0.3
    : type === "negative"
    ? 0.05 + Math.random() * 0.3
    : 0.35 + Math.random() * 0.3;
  const value = Math.min(0.98, Math.max(0.02, base * 0.7 + successRatio * 0.3));
  return { id: `ev-${evidenceCounter}`, type, value };
}

export function BayesianConfidenceDemo() {
  const { ref, progress } = useInViewProgress();
  const [successes, setSuccesses] = useState(0);
  const [failures, setFailures] = useState(0);
  const [neutrals, setNeutrals] = useState(0);
  const [evidencePoints, setEvidencePoints] = useState<EvidencePoint[]>([]);
  const [flashActive, setFlashActive] = useState(false);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerFlash = useCallback(() => {
    setFlashActive(true);
    if (flashTimerRef.current !== null) {
      clearTimeout(flashTimerRef.current);
    }
    flashTimerRef.current = setTimeout(() => {
      setFlashActive(false);
    }, 400);
  }, []);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current !== null) {
        clearTimeout(flashTimerRef.current);
      }
    };
  }, []);

  const total = successes + failures + neutrals;
  const successRatio = total > 0 ? successes / total : 0.5;

  const addPositive = useCallback(() => {
    const pt = makeEvidence("positive", successRatio);
    setEvidencePoints(prev => [...prev.slice(-29), pt]);
    setSuccesses(s => s + 1);
    triggerFlash();
  }, [successRatio, triggerFlash]);

  const addNegative = useCallback(() => {
    const pt = makeEvidence("negative", successRatio);
    setEvidencePoints(prev => [...prev.slice(-29), pt]);
    setFailures(f => f + 1);
    triggerFlash();
  }, [successRatio, triggerFlash]);

  const addNeutral = useCallback(() => {
    const pt = makeEvidence("neutral", successRatio);
    setEvidencePoints(prev => [...prev.slice(-29), pt]);
    setNeutrals(n => n + 1);
    triggerFlash();
  }, [successRatio, triggerFlash]);

  const reset = useCallback(() => {
    setSuccesses(0);
    setFailures(0);
    setNeutrals(0);
    setEvidencePoints([]);
    setFlashActive(false);
  }, []);

  return (
    <div ref={ref} className="my-8 flex flex-col gap-6 group">
      <div className="rounded-xl overflow-hidden border border-slate-800 shadow-2xl shadow-emerald-900/10 aspect-[16/10] sm:aspect-video bg-slate-950 relative">
        <BayesianConfidenceCore
          successes={successes}
          failures={failures}
          neutrals={neutrals}
          evidencePoints={evidencePoints}
          progress={progress}
          flashActive={flashActive}
          className="w-full h-full"
        />

        {/* Glow corner accents */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/10 blur-3xl pointer-events-none" />
      </div>

      <div className="flex flex-col sm:flex-row gap-6 p-6 sm:p-8 rounded-xl bg-slate-950/80 backdrop-blur-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
          <svg
            width="40"
            height="40"
            viewBox="0 0 100 100"
            className="stroke-emerald-500"
          >
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              strokeWidth="2"
              strokeDasharray="4 8"
            />
            <circle cx="50" cy="50" r="20" fill="none" strokeWidth="2" />
          </svg>
        </div>

        <div className="flex-1 space-y-4 z-10 w-full">
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm font-bold text-emerald-500 uppercase tracking-[0.15em] font-mono flex items-center gap-3">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
              Beta Distribution Learning
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <button
              onClick={addPositive}
              className="flex-1 py-3 px-4 text-sm font-mono rounded-md border transition-all bg-emerald-500/10 text-emerald-400 border-emerald-900 hover:border-emerald-500 hover:bg-emerald-500/20"
            >
              + Positive Evidence
            </button>
            <button
              onClick={addNegative}
              className="flex-1 py-3 px-4 text-sm font-mono rounded-md border transition-all bg-red-500/10 text-red-400 border-red-900 hover:border-red-500 hover:bg-red-500/20"
            >
              + Negative Evidence
            </button>
            <button
              onClick={addNeutral}
              className="flex-1 py-3 px-4 text-sm font-mono rounded-md border transition-all bg-slate-700/20 text-slate-400 border-slate-700 hover:border-slate-500 hover:bg-slate-700/40"
            >
              + Neutral Evidence
            </button>
          </div>
          <p className="text-sm text-slate-400 font-mono leading-relaxed border-l-2 border-slate-800 pl-4 mt-6">
            The prior belief (a wide bell curve) shifts physically as real evidence is gathered. The
            peak moves to reflect the highest probability, and it gets taller and narrower as
            certainty increases.
          </p>
        </div>

        <div className="flex items-center justify-center sm:pl-6 sm:border-l border-slate-800 z-10 w-full sm:w-auto mt-4 sm:mt-0">
          <button
            onClick={reset}
            className="flex items-center justify-center gap-2 px-6 w-full sm:w-32 py-4 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-slate-500 rounded-lg font-mono text-sm uppercase tracking-widest transition-all text-slate-400"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
