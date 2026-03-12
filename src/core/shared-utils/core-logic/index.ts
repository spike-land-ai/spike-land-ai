/**
 * @spike-npm-land/shared
 *
 * Shared types, constants, validations, and utilities
 * for web and mobile applications
 */

// Types
export * from "./types-index";

// Constants
export * from "./constants-index";

// Validations
export * from "./validations-index";

// Tool Builder
export * from "./tool-builder-index";

// Logger
export { createLogger, type Logger, type LogLevel, type LogEntry } from "./logger.js";

// Error Reporter
export { createErrorReporter, type ErrorReporter, type ErrorReport } from "./error-reporter.js";

// UI Utilities
export { cn } from "../styling/cn.js";

// UI Components
export { Button, buttonVariants, Link } from "./ui-index.js";

// Async Utilities
export { tryCatch, type Result as TryCatchResult } from "./try-catch.js";

// ELO Rating
export {
  expectedScore,
  getKFactor,
  calculateEloChange,
  type GameResult as EloGameResult,
  type EloUpdate,
} from "./elo.js";

// Badge Token
export {
  generateBadgeToken,
  verifyBadgeToken,
  type BadgePayload,
} from "./badge-token.js";

// Support Amounts
export {
  SUPPORT_AMOUNT_MAX,
  SUPPORT_AMOUNT_MIN,
  SUPPORT_CURRENCY_CODE,
  SUPPORT_CURRENCY_SYMBOL,
  SUPPORT_MAGIC_AMOUNT,
  SUPPORT_MAGIC_RANGE_MAX,
  SUPPORT_MAGIC_RANGE_MIN,
  formatSupportAmount,
  isValidSupportAmount,
  normalizeSupportAmountInput,
  parseSupportAmount,
  snapSupportAmount,
} from "./support-amount.js";
