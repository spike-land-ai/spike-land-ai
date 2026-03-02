/**
 * Config file watcher with debounced change detection.
 * Watches all discovered config files and triggers reconnection on changes.
 */

import { type FSWatcher, watch } from "node:fs";
import { discoverConfig, type DiscoveryOptions } from "./discovery";
import type { ResolvedConfig } from "./types";
import { log, warn } from "../util/logger";

export interface ConfigWatcherOptions {
  configPaths: string[];
  discoveryOptions: DiscoveryOptions;
  onChange: (newConfig: ResolvedConfig) => void;
  debounceMs?: number;
}

export class ConfigWatcher {
  private watchers: FSWatcher[] = [];
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private options: ConfigWatcherOptions;
  private debounceMs: number;

  constructor(options: ConfigWatcherOptions) {
    this.options = options;
    this.debounceMs = options.debounceMs ?? 300;
  }

  start(): void {
    for (const configPath of this.options.configPaths) {
      try {
        const watcher = watch(configPath, () => {
          this.handleChange();
        });
        this.watchers.push(watcher);
        log(`Watching config: ${configPath}`);
      } catch (err) {
        warn(`Cannot watch ${configPath}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  private handleChange(): void {
    // Debounce rapid changes
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(async () => {
      log("Config file changed, reloading...");
      try {
        const newConfig = await discoverConfig(this.options.discoveryOptions);
        this.options.onChange(newConfig);
      } catch (err) {
        warn(`Config reload failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }, this.debounceMs);
  }

  stop(): void {
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }
}
