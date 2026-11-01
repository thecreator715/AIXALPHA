/**
 * AIX Alpha v3 — Loop Engine configuration.
 * One model on purpose: the cheapest Claude. Everything else is coerced to it.
 */
export const MODEL_ID = 'claude-haiku-5-5';

/** USD per million tokens. Source: Anthropic pricing (Oct 2026). Prompts >100K tokens bill at the "long" rate. */
export const PRICING = {
  shortIn: 0.10,
  shortOut: 0.50,
  shortCacheRead: 0.01,
  shortCacheWrite: 0.125, // 5-minute cache write
  longIn: 0.50,
  longOut: 2.50,
  longCacheRead: 0.05,
  longCacheWrite: 0.625,
  longThreshold: 100_000,
  webSearchPerCall: 0.01, // $10 / 1,000 searches
};

/** Haiku 5.5 minimum cacheable prefix (tokens). Shorter prefixes simply are not cached. */
export const MIN_CACHE_TOKENS = 512;

export type LoopMode = 'eco' | 'balanced' | 'thorough';
export type VerifyMode = 'local' | 'llm';
export type Effort = 'low' | 'medium' | 'high';

export interface ModeProfile {
  /** max refine/continue passes after the first generation */
  maxRefines: number;
  /** effort used for DEEP tier first pass */
  deepEffort: Effort;
  /** multiplier on history window (messages) */
  histScale: number;
  /** multiplier on max_tokens caps */
  capScale: number;
}

export const MODES: Record<LoopMode, ModeProfile> = {
  eco: { maxRefines: 1, deepEffort: 'low', histScale: 1, capScale: 0.85 },
  balanced: { maxRefines: 2, deepEffort: 'medium', histScale: 1.5, capScale: 1 },
  thorough: { maxRefines: 3, deepEffort: 'medium', histScale: 2, capScale: 1.5 },
};

export interface Budgets {
  requestMaxUsd: number;
  sessionMaxUsd: number;
  dailyMaxUsd: number;
}

export function readBudgets(env: NodeJS.ProcessEnv = process.env): Budgets {
  const num = (v: string | undefined, d: number) => {
    const n = v === undefined ? NaN : Number(v);
    return Number.isFinite(n) && n > 0 ? n : d;
  };
  return {
    requestMaxUsd: num(env.AIX_REQUEST_MAX_USD, 0.01),
    sessionMaxUsd: num(env.AIX_SESSION_MAX_USD, 0.25),
    dailyMaxUsd: num(env.AIX_DAILY_MAX_USD, 2.0),
  };
}
