import { describe, expect, it } from "vitest";

import {
  formatSupportAmount,
  normalizeSupportAmountInput,
  parseSupportAmount,
  snapSupportAmount,
  SUPPORT_MAGIC_AMOUNT,
} from "../../src/core/shared-utils/core-logic/support-amount.js";

describe("support amount helpers", () => {
  it("snaps the magnetic range to 420", () => {
    expect(snapSupportAmount(411)).toBe(SUPPORT_MAGIC_AMOUNT);
    expect(snapSupportAmount(420)).toBe(SUPPORT_MAGIC_AMOUNT);
    expect(snapSupportAmount(429)).toBe(SUPPORT_MAGIC_AMOUNT);
  });

  it("leaves values outside the magnetic range unchanged", () => {
    expect(snapSupportAmount(410)).toBe(410);
    expect(snapSupportAmount(430)).toBe(430);
  });

  it("normalizes custom input only when the magnetic rule applies", () => {
    expect(normalizeSupportAmountInput("417")).toBe("420");
    expect(normalizeSupportAmountInput("429")).toBe("420");
    expect(normalizeSupportAmountInput("410")).toBe("410");
    expect(normalizeSupportAmountInput("1.5")).toBe("1.5");
  });

  it("parses snapped custom amounts", () => {
    expect(parseSupportAmount("411")).toBe(SUPPORT_MAGIC_AMOUNT);
    expect(parseSupportAmount("418.75")).toBe(SUPPORT_MAGIC_AMOUNT);
    expect(parseSupportAmount("")).toBeNull();
  });

  it("formats integers and decimals cleanly", () => {
    expect(formatSupportAmount(420)).toBe("420");
    expect(formatSupportAmount(12.5)).toBe("12.5");
    expect(formatSupportAmount(12.75)).toBe("12.75");
  });
});
