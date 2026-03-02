/**
 * Alias configuration types.
 */

export interface CompositeAlias {
  tool: string;
  args?: Record<string, unknown>;
}

export interface AliasConfig {
  version: number;
  commands: Record<string, string>;
  tools: Record<string, string>;
  servers: Record<string, string>;
  composite: Record<string, CompositeAlias>;
}

export const ALIAS_CONFIG_VERSION = 1;
