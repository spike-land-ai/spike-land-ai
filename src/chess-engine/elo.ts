/**
 * ELO rating — re-exports core functions from shared package.
 */

import {
  expectedScore,
  getKFactor,
  calculateEloChange,
} from "@spike-land-ai/shared";

export { expectedScore, getKFactor, calculateEloChange };
