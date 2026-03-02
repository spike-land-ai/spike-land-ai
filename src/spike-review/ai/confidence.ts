/**
 * Confidence Scoring
 *
 * Filters review findings by confidence threshold
 * to reduce false positives.
 */

import type { ConfidenceLevel, ReviewFinding } from "../types.js";

const HIGH_CONFIDENCE_THRESHOLD = 90;
const MEDIUM_CONFIDENCE_THRESHOLD = 80;
const LOW_CONFIDENCE_THRESHOLD = 60;

export const DEFAULT_CONFIDENCE_THRESHOLD = MEDIUM_CONFIDENCE_THRESHOLD;

export function confidenceToLevel(confidence: number): ConfidenceLevel {
  if (confidence >= HIGH_CONFIDENCE_THRESHOLD) return "critical";
  if (confidence >= MEDIUM_CONFIDENCE_THRESHOLD) return "high";
  if (confidence >= LOW_CONFIDENCE_THRESHOLD) return "medium";
  return "low";
}

export function filterByConfidence(
  findings: ReviewFinding[],
  threshold: number = DEFAULT_CONFIDENCE_THRESHOLD,
): ReviewFinding[] {
  return findings.filter((f) => f.confidence >= threshold);
}

export function sortByConfidence(findings: ReviewFinding[]): ReviewFinding[] {
  return [...findings].sort((a, b) => b.confidence - a.confidence);
}
