/**
 * @spike-npm-land/shared
 *
 * Shared types, constants, validations, and utilities
 * for web and mobile applications
 */

// Types
export * from "./types-index.ts";

// Constants
export * from "./constants-index.ts";

// Validations
export * from "./validations-index.ts";

// Tool Builder
export * from "./tool-builder-index.ts";

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

// Hash Utilities
export { fnv1a } from "./hash.js";

// Statistical Sampling
export { sampleBeta } from "./stats.js";

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
