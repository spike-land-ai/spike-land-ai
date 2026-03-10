export const SUPPORT_CURRENCY_CODE = "gbp";
export const SUPPORT_CURRENCY_SYMBOL = "£";
export const SUPPORT_AMOUNT_MIN = 1;
export const SUPPORT_AMOUNT_MAX = 999;
export const SUPPORT_MAGIC_AMOUNT = 420;
export const SUPPORT_MAGIC_RANGE_MIN = 411;
export const SUPPORT_MAGIC_RANGE_MAX = 429;

export function snapSupportAmount(amount: number): number {
  if (amount >= SUPPORT_MAGIC_RANGE_MIN && amount <= SUPPORT_MAGIC_RANGE_MAX) {
    return SUPPORT_MAGIC_AMOUNT;
  }

  return amount;
}

export function formatSupportAmount(amount: number): string {
  const roundedAmount = Math.round(amount * 100) / 100;

  if (Number.isInteger(roundedAmount)) {
    return String(roundedAmount);
  }

  const fixed = roundedAmount.toFixed(2);
  if (fixed.endsWith("00")) {
    return fixed.slice(0, -3);
  }
  if (fixed.endsWith("0")) {
    return fixed.slice(0, -1);
  }

  return fixed;
}

export function parseSupportAmount(rawAmount: string): number | null {
  const trimmedAmount = rawAmount.trim();
  if (!trimmedAmount) {
    return null;
  }

  const parsedAmount = Number(trimmedAmount);
  if (!Number.isFinite(parsedAmount)) {
    return null;
  }

  return snapSupportAmount(parsedAmount);
}

export function normalizeSupportAmountInput(rawAmount: string): string {
  const trimmedAmount = rawAmount.trim();
  if (!trimmedAmount) {
    return "";
  }

  const parsedAmount = Number(trimmedAmount);
  if (!Number.isFinite(parsedAmount)) {
    return rawAmount;
  }

  const snappedAmount = snapSupportAmount(parsedAmount);
  if (snappedAmount === parsedAmount) {
    return rawAmount;
  }

  return formatSupportAmount(snappedAmount);
}

export function isValidSupportAmount(amount: number | null): amount is number {
  return amount !== null && amount >= SUPPORT_AMOUNT_MIN && amount <= SUPPORT_AMOUNT_MAX;
}
