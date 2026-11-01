import { Intents } from './router';

export type Failure =
  | { kind: 'empty' }
  | { kind: 'truncated' }
  | { kind: 'open-fence' }
  | { kind: 'html-incomplete'; detail: string }
  | { kind: 'bad-json' }
  | { kind: 'length'; detail: string }
  | { kind: 'degenerate' };

/** Failures that mean "the answer is cut off": fix by appending, never by regenerating. */
export const isContinuation = (f: Failure) => f.kind === 'truncated' || f.kind === 'open-fence' || f.kind === 'html-incomplete';

const count = (s: string, re: RegExp) => (s.match(re) || []).length;

function firstJson(text: string): string | null {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1];
  const t = text.trim();
  if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) return t;
  return null;
}

/**
 * Layer 2 of the loop: deterministic verification. Costs zero tokens, so the
 * model is only called again when something is provably wrong.
 */
export function verify(text: string, ctx: { prompt: string; stopReason: string | null; intents: Intents }): Failure[] {
  const f: Failure[] = [];
  const t = text || '';
  if (!t.trim()) return [{ kind: 'empty' }];
  if (ctx.stopReason === 'max_tokens') f.push({ kind: 'truncated' });

  if (count(t, /^```/gm) % 2 === 1) f.push({ kind: 'open-fence' });

  if (ctx.intents.app || /<!doctype html|<html/i.test(t)) {
    const hasHtml = /<html[\s>]/i.test(t);
    if (hasHtml && !/<\/html>/i.test(t)) f.push({ kind: 'html-incomplete', detail: 'missing </html>' });
    else if (count(t, /<script[\s>]/gi) > count(t, /<\/script>/gi)) f.push({ kind: 'html-incomplete', detail: 'unclosed <script>' });
    else if (count(t, /<style[\s>]/gi) > count(t, /<\/style>/gi)) f.push({ kind: 'html-incomplete', detail: 'unclosed <style>' });
  }

  if (ctx.intents.json) {
    const j = firstJson(t);
    if (j) {
      try {
        JSON.parse(j);
      } catch {
        f.push({ kind: 'bad-json' });
      }
    }
  }

  // explicit length constraints in the prompt: "in 50 words", "under 100 words", "3 bullets"
  const w = ctx.prompt.match(/\b(?:in|under|within|max(?:imum)?(?: of)?|at most|less than)\s+(\d{1,4})\s+words?\b/i);
  if (w) {
    const limit = Number(w[1]);
    const words = t.replace(/```[\s\S]*?```/g, ' ').split(/\s+/).filter(Boolean).length;
    if (words > limit * 1.25) f.push({ kind: 'length', detail: `must be ≤ ${limit} words (was ${words})` });
  }
  const b = ctx.prompt.match(/\b(\d{1,2})\s+(?:bullets?|bullet points?)\b/i);
  if (b) {
    const n = Number(b[1]);
    const bullets = count(t, /^\s*[-*•]\s+/gm);
    if (bullets && bullets !== n) f.push({ kind: 'length', detail: `exactly ${n} bullets (was ${bullets})` });
  }

  // degenerate repetition: a 120-char window sampled across the text recurs 5+ times
  const norm = t.replace(/\s+/g, ' ');
  if (norm.length > 800) {
    for (const frac of [0.25, 0.5, 0.75]) {
      const at = Math.floor(norm.length * frac);
      const win = norm.slice(at, at + 120);
      if (new Set(win).size < 15) continue; // ignore ASCII-art / separator runs
      let c = 0;
      for (let i = norm.indexOf(win); i !== -1; i = norm.indexOf(win, i + win.length)) c++;
      if (c >= 5) {
        f.push({ kind: 'degenerate' });
        break;
      }
    }
  }
  return f;
}

export function describe(f: Failure[]): string {
  return f
    .map((x) => {
      switch (x.kind) {
        case 'empty':
          return 'empty reply';
        case 'truncated':
          return 'cut off at token limit';
        case 'open-fence':
          return 'unclosed code fence';
        case 'html-incomplete':
        case 'length':
          return x.detail;
        case 'bad-json':
          return 'invalid JSON';
        case 'degenerate':
          return 'repetition loop';
      }
    })
    .join('; ');
}
