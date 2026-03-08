/**
 * Mock for cloudflare:workers module used in Vitest (Node.js environment).
 */
export class DurableObject {
  ctx: unknown;
  env: unknown;
  constructor(ctx?: unknown, env?: unknown) {
    this.ctx = ctx;
    this.env = env;
  }
}
