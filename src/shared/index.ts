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

// Utilities
export * from "./utils";

// Tool Builder
export * from "./tool-builder";

// Logger
export { createLogger, type Logger, type LogLevel, type LogEntry } from "./utils/logger.js";

// Error Reporter
export { createErrorReporter, type ErrorReporter, type ErrorReport } from "./utils/error-reporter.js";
