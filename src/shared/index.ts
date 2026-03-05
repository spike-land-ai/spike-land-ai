/**
 * @spike-npm-land/shared
 *
 * Shared types, constants, validations, and utilities
 * for web and mobile applications
 */

// Types
export * from "./types";

// Constants
export * from "./constants";

// Validations
export * from "./validations";

// Tool Builder
export * from "./tool-builder";

// Logger
export { createLogger, type Logger, type LogLevel, type LogEntry } from "./utils/logger.js";

// Error Reporter
export { createErrorReporter, type ErrorReporter, type ErrorReport } from "./utils/error-reporter.js";

// UI Utilities
export { cn } from "./utils/cn.js";

// UI Components
export { Button, buttonVariants, Link } from "./ui/index.js";

// Async Utilities
export { tryCatch, type Result as TryCatchResult } from "./utils/try-catch.js";

// Hash Utilities
export { fnv1a } from "./utils/hash.js";

// Statistical Sampling
export { randn, sampleGamma, sampleBeta } from "./utils/stats.js";

// ELO Rating
export {
  expectedScore,
  getKFactor,
  calculateEloChange,
  type GameResult as EloGameResult,
  type EloUpdate,
} from "./utils/elo.js";

// Badge Token
export {
  generateBadgeToken,
  verifyBadgeToken,
  type BadgePayload,
} from "./utils/badge-token.js";
