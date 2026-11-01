import { PRICING } from './config';

/** Rough estimator (Haiku 5.5's tokenizer runs ~30% denser than older Claude models). Used only for pre-flight decisions. */
export const estTokens = (s: string): number => Math.ceil((s || '').length / 3.2);

export interface Usage {
  input: number; // uncached input tokens
  output: number;
  cacheRead: number;
  cacheWrite: number;
  webSearches: number;
}

export const emptyUsage = (): Usage => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0, webSearches: 0 });

export function addUsage(a: Usage, b: Usage): Usage {
  return {
    input: a.input + b.input,
    output: a.output + b.output,
    cacheRead: a.cacheRead + b.cacheRead,
    cacheWrite: a.cacheWrite + b.cacheWrite,
    webSearches: a.webSearches + b.webSearches,
  };
}

/** Cost of ONE API call. The 100K cliff is evaluated per request on total prompt length. */
export function callCostUsd(u: Usage): number {
  const promptLen = u.input + u.cacheRead + u.cacheWrite;
  const long = promptLen > PRICING.longThreshold;
  const inR = long ? PRICING.longIn : PRICING.shortIn;
  const outR = long ? PRICING.longOut : PRICING.shortOut;
  const crR = long ? PRICING.longCacheRead : PRICING.shortCacheRead;
  const cwR = long ? PRICING.longCacheWrite : PRICING.shortCacheWrite;
  const tokens = u.input * inR + u.output * outR + u.cacheRead * crR + u.cacheWrite * cwR;
  return tokens / 1e6 + u.webSearches * PRICING.webSearchPerCall;
}

/** Worst-case cost of a call before sending it: all prompt uncached + full max_tokens output. */
export function worstCaseUsd(promptTokens: number, maxTokens: number): number {
  return callCostUsd({ input: promptTokens, output: maxTokens, cacheRead: 0, cacheWrite: 0, webSearches: 0 });
}
