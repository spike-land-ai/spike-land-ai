/**
 * Tool Module Discovery
 *
 * On CF Workers there is no filesystem scanning, so auto-discovery is
 * replaced by explicit registration in manifest.ts.
 *
 * This module defines the shared ToolModuleExport interface used by
 * both the manifest and any tool file that wants to export modules.
 */

import type { ToolRegistry } from "./registry";
import type { DrizzleDB } from "../db/index";

export interface ToolModuleExport {
  register: (registry: ToolRegistry, userId: string, db: DrizzleDB) => void;
  categories?: string[];
  condition?: () => boolean;
}

export interface ToolModuleEntry {
  register: (registry: ToolRegistry, userId: string, db: DrizzleDB) => void;
  categories?: string[];
  condition?: () => boolean;
}
