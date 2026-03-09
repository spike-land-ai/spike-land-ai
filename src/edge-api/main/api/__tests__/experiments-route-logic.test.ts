import { describe, expect, it } from "vitest";
import {
  buildEvaluationGate,
  detectZeroImpressionAnomalies,
  getMonitorWindow,
  groupMetricsByVariant,
  isValidAssignClientId,
  mapRevenueCentsToDollars,
  normalizeTrackEvents,
  type MetricRow,
  type TrackEventInput,
  type VariantDef,
} from "../routes/experiments-route-logic.js";

const VARIANTS: VariantDef[] = [
  { id: "control", config: { color: "blue" }, weight: 50 },
  { id: "variant-a", config: { color: "red" }, weight: 50 },
];

describe("experiments route logic", () => {
  it("validates assign client ids", () => {
    expect(isValidAssignClientId("client-123")).toBe(true);
    expect(isValidAssignClientId("")).toBe(false);
    expect(isValidAssignClientId("x".repeat(101))).toBe(false);
    expect(isValidAssignClientId(undefined)).toBe(false);
  });

  it("groups metrics by variant and metric name", () => {
    const byVariant = groupMetricsByVariant([
      {
        variant_id: "control",
        metric_name: "impressions",
        metric_value: 100,
        sample_size: 100,
      },
      {
        variant_id: "control",
        metric_name: "donations",
        metric_value: 4,
        sample_size: 4,
      },
      {
        variant_id: "variant-a",
        metric_name: "impressions",
        metric_value: 120,
        sample_size: 120,
      },
    ]);

    expect(byVariant).toEqual({
      control: {
        impressions: { value: 100, sampleSize: 100 },
        donations: { value: 4, sampleSize: 4 },
      },
      "variant-a": {
        impressions: { value: 120, sampleSize: 120 },
      },
    });
  });

  it("normalizes valid track events and derives metric updates", () => {
    const input: TrackEventInput[] = [
      {
        clientId: "client-1",
        slug: "my-post",
        eventType: "widget_impression",
        experimentId: "exp-1",
        variantId: "control",
      },
      {
        clientId: "client-1",
        slug: "my-post",
        eventType: "donate_click",
        experimentId: "exp-1",
        variantId: "variant-a",
        eventData: { amount: 5 },
      },
      {
        clientId: "client-1",
        slug: "my-post",
        eventType: "invalid_event",
      },
    ];

    const normalized = normalizeTrackEvents(input);

    expect(normalized.acceptedEvents).toHaveLength(2);
    expect(normalized.acceptedEvents[1]).toMatchObject({
      eventType: "donate_click",
      eventData: { amount: 5 },
    });
    expect(normalized.metricUpdates).toEqual([
      {
        experimentId: "exp-1",
        variantId: "control",
        metricName: "impressions",
        value: 1,
      },
      {
        experimentId: "exp-1",
        variantId: "variant-a",
        metricName: "donations",
        value: 1,
      },
    ]);
  });

  it("caps track events to 150 items", () => {
    const events = Array.from({ length: 200 }, (_, index) => ({
      clientId: `client-${index}`,
      slug: "bulk-post",
      eventType: "widget_impression",
      experimentId: "exp-1",
      variantId: "control",
    }));

    const normalized = normalizeTrackEvents(events);

    expect(normalized.acceptedEvents).toHaveLength(150);
    expect(normalized.metricUpdates).toHaveLength(150);
  });

  it("builds monitor windows with clamping but preserves the requested hours", () => {
    expect(getMonitorWindow(undefined, 10_000)).toEqual({
      requestedHours: 4,
      clampedHours: 4,
      since: 10_000 - 4 * 60 * 60 * 1000,
    });

    expect(getMonitorWindow("9999", 10_000)).toEqual({
      requestedHours: 9999,
      clampedHours: 168,
      since: 10_000 - 168 * 60 * 60 * 1000,
    });

    expect(getMonitorWindow("0", 10_000).clampedHours).toBe(1);
  });

  it("detects active variants with zero impressions in the monitor window", () => {
    const anomalies = detectZeroImpressionAnomalies(
      [{ experiment_id: "exp-1", variant_id: "control", event_type: "widget_impression", cnt: 10 }],
      [{ id: "exp-1", name: "Experiment 1", variants: JSON.stringify(VARIANTS) }],
      8,
    );

    expect(anomalies).toEqual([
      {
        experimentId: "exp-1",
        variantId: "variant-a",
        issue: "Zero impressions in last 8h",
      },
    ]);
  });

  it("blocks evaluation before the minimum runtime", () => {
    const gate = buildEvaluationGate({
      createdAt: 100 * 60 * 60 * 1000,
      now: 120 * 60 * 60 * 1000,
      variants: VARIANTS,
      byVariant: {},
    });

    expect(gate).toEqual({
      ready: false,
      reason: "Minimum 48h runtime not met",
      runtimeHours: 20,
    });
  });

  it("blocks evaluation when a variant has insufficient impressions", () => {
    const metrics: MetricRow[] = [
      {
        variant_id: "control",
        metric_name: "impressions",
        metric_value: 700,
        sample_size: 700,
      },
      {
        variant_id: "variant-a",
        metric_name: "impressions",
        metric_value: 120,
        sample_size: 120,
      },
    ];

    const gate = buildEvaluationGate({
      createdAt: 0,
      now: 72 * 60 * 60 * 1000,
      variants: VARIANTS,
      byVariant: groupMetricsByVariant(metrics),
    });

    expect(gate).toEqual({
      ready: false,
      reason: "Variant variant-a has 120 impressions (need 500)",
    });
  });

  it("builds evaluation variant data when runtime and sample thresholds are met", () => {
    const gate = buildEvaluationGate({
      createdAt: 0,
      now: 72 * 60 * 60 * 1000,
      variants: VARIANTS,
      byVariant: groupMetricsByVariant([
        {
          variant_id: "control",
          metric_name: "impressions",
          metric_value: 1000,
          sample_size: 1000,
        },
        {
          variant_id: "control",
          metric_name: "donations",
          metric_value: 45,
          sample_size: 45,
        },
        {
          variant_id: "variant-a",
          metric_name: "impressions",
          metric_value: 1100,
          sample_size: 1100,
        },
        {
          variant_id: "variant-a",
          metric_name: "donations",
          metric_value: 78,
          sample_size: 78,
        },
      ]),
    });

    expect(gate).toEqual({
      ready: true,
      variantData: [
        { id: "control", impressions: 1000, donations: 45 },
        { id: "variant-a", impressions: 1100, donations: 78 },
      ],
    });
  });

  it("maps dashboard revenue from cents to dollars", () => {
    expect(mapRevenueCentsToDollars(1500)).toBe(15);
    expect(mapRevenueCentsToDollars(null)).toBe(0);
    expect(mapRevenueCentsToDollars(undefined)).toBe(0);
  });
});
