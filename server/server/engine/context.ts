import { estTokens } from './tokens';

export interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

/** Replace big code blocks in OLD turns with a stub — code is the #1 token hog in long chats. */
export function stubOldCode(text: string, minLines = 12): string {
  return text.replace(/```([\w+-]*)\n([\s\S]*?)```/g, (m, lang: string, body: string) => {
    const lines = body.replace(/\n+$/, '').split('\n').length;
    if (lines < minLines) return m;
    const first = body.split('\n').find((l) => l.trim()) || '';
    return `[${lang || 'code'} block, ${lines} lines omitted — starts: ${first.trim().slice(0, 60)}]`;
  });
}

/** Zero-cost extractive digest of dropped turns (no model call). */
export function digest(dropped: Msg[], maxChars = 700): string {
  const lines: string[] = [];
  for (const m of dropped) {
    const clean = stubOldCode(m.content).replace(/\s+/g, ' ').trim();
    if (!clean) continue;
    const head = clean.split(/(?<=[.!?])\s/)[0].slice(0, 140);
    lines.push(`${m.role === 'user' ? 'U' : 'A'}: ${head}`);
  }
  let out = lines.join('\n');
  if (out.length > maxChars) out = out.slice(out.length - maxChars);
  return out;
}

/**
 * Stepped sliding window. The window start only moves in steps of `step`
 * messages, so the verbatim prefix stays byte-identical for several turns —
 * which is what lets the prompt cache keep hitting.
 */
export function windowStart(total: number, keep: number, step = 4): number {
  const raw = Math.max(0, total - keep);
  return raw - (raw % step);
}

export interface BuiltContext {
  messages: Array<{ role: 'user' | 'assistant'; content: any }>;
  dropped: number;
  digestText: string;
  originalTokens: number;
  sentTokens: number;
}

export function buildMessages(
  all: Msg[],
  opts: { keep: number; priorSummary?: string; step?: number },
): BuiltContext {
  // Anthropic requires alternating roles starting with user; coalesce neighbours defensively.
  const clean: Msg[] = [];
  for (const m of all) {
    if (!m.content || !m.content.trim()) continue;
    const last = clean[clean.length - 1];
    if (last && last.role === m.role) last.content += '\n\n' + m.content;
    else clean.push({ role: m.role, content: m.content });
  }
  while (clean.length && clean[0].role !== 'user') clean.shift();

  const originalTokens = clean.reduce((s, m) => s + estTokens(m.content), 0);
  const start = windowStart(clean.length, opts.keep, opts.step ?? 4);
  const dropped = clean.slice(0, start);
  const kept = clean.slice(start);
  // the final message must be the user's current turn; stub code in all but the last 2 kept messages
  const msgs = kept.map((m, i) => ({
    role: m.role,
    content: i >= kept.length - 2 ? m.content : stubOldCode(m.content),
  }));
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();

  const digestText = dropped.length ? digest(dropped) : '';
  const sentTokens = msgs.reduce((s, m) => s + estTokens(typeof m.content === 'string' ? m.content : ''), 0);
  return { messages: msgs, dropped: dropped.length, digestText, originalTokens, sentTokens };
}
