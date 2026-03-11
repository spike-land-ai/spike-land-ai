/**
 * Token usage tracking for Claude API conversations.
 * Monitors context window consumption and signals when summarization is needed.
 */

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null | undefined;
  cache_read_input_tokens?: number | null | undefined;
}

export interface TurnRecord {
  turn: number;
  usage: TokenUsage;
  timestamp: number;
}

const DEFAULT_CONTEXT_LIMIT = 200000;

export class TokenTracker {
  private turns: TurnRecord[] = [];
  private turnCounter = 0;
  private readonly contextLimit: number;

  constructor(contextLimit: number = DEFAULT_CONTEXT_LIMIT) {
    this.contextLimit = contextLimit;
  }

  recordTurn(usage: TokenUsage): void {
    this.turnCounter++;
    this.turns.push({
      turn: this.turnCounter,
      usage,
      timestamp: Date.now(),
    });
  }

  /** Latest input_tokens represents current context size */
  get currentContextUsage(): number {
    if (this.turns.length === 0) return 0;
    return this.turns[this.turns.length - 1]?.usage.input_tokens ?? 0;
  }

  /** Total output tokens generated across all turns */
  get totalOutputTokens(): number {
    return this.turns.reduce((sum, t) => sum + t.usage.output_tokens, 0);
  }

  /** Total input tokens across all turns */
  get totalInputTokens(): number {
    return this.turns.reduce((sum, t) => sum + t.usage.input_tokens, 0);
  }

  get contextUtilization(): number {
    return this.currentContextUsage / this.contextLimit;
  }

  /** green: 0-69%, yellow: 70-89%, red: 90-100% */
  get contextHealth(): "green" | "yellow" | "red" {
    const pct = this.contextUtilization;
    if (pct >= 0.9) return "red";
    if (pct >= 0.7) return "yellow";
    return "green";
  }

  /** True when context is at red level (90%+) */
  get shouldSummarize(): boolean {
    return this.contextHealth === "red";
  }

  get turnCount(): number {
    return this.turns.length;
  }

  /** Get all turn records (for /usage display) */
  getTurns(): readonly TurnRecord[] {
    return this.turns;
  }

  /** Format a human-readable usage summary */
  formatSummary(): string {
    const pct = Math.round(this.contextUtilization * 100);
    const health = this.contextHealth;
    const indicator = health === "green" ? "●" : health === "yellow" ? "◐" : "○";
    return [
      `Context: ${this.currentContextUsage.toLocaleString()} / ${this.contextLimit.toLocaleString()} tokens (${pct}%) ${indicator}`,
      `Turns: ${this.turnCount}`,
      `Total output: ${this.totalOutputTokens.toLocaleString()} tokens`,
    ].join("\n");
  }

  reset(): void {
    this.turns = [];
    this.turnCounter = 0;
  }
}
