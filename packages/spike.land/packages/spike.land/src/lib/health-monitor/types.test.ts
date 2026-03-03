import { describe, expect, it } from "vitest";

import { DEFAULT_HEALTH_WEIGHTS, HEALTH_THRESHOLDS } from "./types";

describe("DEFAULT_HEALTH_WEIGHTS", () => {
  it("weights sum to 1.0", () => {
    const sum = DEFAULT_HEALTH_WEIGHTS.syncStatus
      + DEFAULT_HEALTH_WEIGHTS.rateLimitUsage
      + DEFAULT_HEALTH_WEIGHTS.errorFrequency
      + DEFAULT_HEALTH_WEIGHTS.tokenHealth;
    expect(sum).toBeCloseTo(1.0);
  });

  it("syncStatus is 30%", () => {
    expect(DEFAULT_HEALTH_WEIGHTS.syncStatus).toBeCloseTo(0.30);
  });

  it("rateLimitUsage is 25%", () => {
    expect(DEFAULT_HEALTH_WEIGHTS.rateLimitUsage).toBeCloseTo(0.25);
  });

  it("errorFrequency is 25%", () => {
    expect(DEFAULT_HEALTH_WEIGHTS.errorFrequency).toBeCloseTo(0.25);
  });

  it("tokenHealth is 20%", () => {
    expect(DEFAULT_HEALTH_WEIGHTS.tokenHealth).toBeCloseTo(0.20);
  });

  it("all weights are positive", () => {
    expect(DEFAULT_HEALTH_WEIGHTS.syncStatus).toBeGreaterThan(0);
    expect(DEFAULT_HEALTH_WEIGHTS.rateLimitUsage).toBeGreaterThan(0);
    expect(DEFAULT_HEALTH_WEIGHTS.errorFrequency).toBeGreaterThan(0);
    expect(DEFAULT_HEALTH_WEIGHTS.tokenHealth).toBeGreaterThan(0);
  });
});

describe("HEALTH_THRESHOLDS", () => {
  it("HEALTHY threshold is 80", () => {
    expect(HEALTH_THRESHOLDS.HEALTHY).toBe(80);
  });

  it("DEGRADED threshold is 50", () => {
    expect(HEALTH_THRESHOLDS.DEGRADED).toBe(50);
  });

  it("UNHEALTHY threshold is 20", () => {
    expect(HEALTH_THRESHOLDS.UNHEALTHY).toBe(20);
  });

  it("CRITICAL threshold is 0", () => {
    expect(HEALTH_THRESHOLDS.CRITICAL).toBe(0);
  });

  it("thresholds are in descending order", () => {
    expect(HEALTH_THRESHOLDS.HEALTHY).toBeGreaterThan(HEALTH_THRESHOLDS.DEGRADED);
    expect(HEALTH_THRESHOLDS.DEGRADED).toBeGreaterThan(HEALTH_THRESHOLDS.UNHEALTHY);
    expect(HEALTH_THRESHOLDS.UNHEALTHY).toBeGreaterThan(HEALTH_THRESHOLDS.CRITICAL);
  });
});
