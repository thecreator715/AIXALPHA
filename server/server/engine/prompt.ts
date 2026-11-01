import { estTokens } from './tokens';

/**
 * "Prompt diet": strips decoration that costs tokens but carries no instruction
 * (box-drawing banners, horizontal rules, blank-line runs, trailing spaces).
 * Pure string work — zero API cost. Meaning-bearing text is untouched.
 */
export function promptDiet(text: string): { text: string; savedTokens: number } {
  const before = estTokens(text);
  const out = (text || '')
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      if (!t) return true;
      // pure decoration: ████ ==== ---- ____ ★★★ or "# ████…" banners
      if (/^[#>\s]*[█▓▒░=\-_*~·•─━═│┃┌┐└┘╔╗╚╝]{4,}[#>\s]*$/.test(t)) return false;
      return true;
    })
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { text: out, savedTokens: Math.max(0, before - estTokens(out)) };
}

/**
 * Hand-distilled cores for the built-in personas. Same behaviour contract,
 * a fraction of the tokens. Custom personas fall back to promptDiet().
 */
export const PERSONA_CORES: Record<string, string> = {
  'aix-alpha-v3': `You are AIX-ALPHA-V3, a precise, high-signal assistant.
Rules: answer first, no filler or preamble; match depth to the question (one fact → one line; hard problem → structured steps).
Hold 2–3 candidate solutions internally, compare, then output only the best one with a one-line reason if non-obvious.
Label confidence only when it matters: [C] certain, [~] probable, [?] uncertain/unverified.
Code: complete, runnable, no placeholders, no commentary outside the code block unless needed. Never leave a code fence or tag open.
If information may be stale or you lack it, say so in one line instead of guessing.`,

  'aix-alpha-quantum-v1': `You are AIX-ALPHA-QUANTUM-V1.0, a rigorous multi-path reasoning engine.
Method: hold several solution paths in parallel (Ψ), cross-link domains and constraints (Ω), weigh paths by evidence and coherence (Φ), track what changes the answer (Δ), keep only verified conclusions (Λ), and when classical routes are blocked look for a non-obvious reframing (Θ).
Output: direct, maximum-signal, rigorous. Show the chosen path and the key reason, not every discarded path.
Tag confidence where useful: [C] verified, [~] probable, [?] hypothesis.`,

  'aix-alpha-le': `You are AIX-ALPHA-LE-V1.0, lightweight edition: maximum intelligence, minimum tokens, zero waste.
Every word must carry signal. Answer starts at word one. Tiers: NANO = 1–3 sentences; MICRO = 3–8; STANDARD = multi-step; DEEP = complex/high-stakes.
Confidence labels when needed: [C] certain, [~] probable, [?] uncertain.`,
};

export interface SystemBlock {
  type: 'text';
  text: string;
  cache_control?: { type: 'ephemeral' };
}

/** Build the system array. Stable persona core is the cache breakpoint; volatile memory sits after it. */
export function buildSystem(opts: {
  personaId?: string;
  systemInstruction?: string;
  memory?: string;
  brevity: string;
}): { blocks: SystemBlock[]; coreTokens: number; rawTokens: number; savedTokens: number } {
  const raw = opts.systemInstruction || '';
  const rawTokens = estTokens(raw);
  const core =
    (opts.personaId && PERSONA_CORES[opts.personaId]) ||
    (raw ? promptDiet(raw).text : PERSONA_CORES['aix-alpha-v3']);
  const stable = `${core}\n\n${opts.brevity}`;
  const blocks: SystemBlock[] = [{ type: 'text', text: stable, cache_control: { type: 'ephemeral' } }];
  if (opts.memory && opts.memory.trim()) blocks.push({ type: 'text', text: opts.memory.trim() });
  const coreTokens = estTokens(stable);
  return { blocks, coreTokens, rawTokens, savedTokens: Math.max(0, rawTokens - coreTokens) };
}

/** Short tier-specific style rule appended to the stable block (identical per tier => cache friendly). */
export const BREVITY: Record<string, string> = {
  MICRO: 'Style: reply in at most 4 sentences.',
  STANDARD: 'Style: be concise; use a list only when comparing or sequencing.',
  DEEP: 'Style: complete but economical. No restating the question, no closing summary unless asked.',
};
