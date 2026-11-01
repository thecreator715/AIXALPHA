import { createHash } from 'node:crypto';
import { Usage, addUsage, emptyUsage } from './tokens';

/** Per-session working memory: structured notes (Anthropic's "note-taking" pattern) + spend ledger. */
export interface SessionState {
  notes: string[];
  usage: Usage;
  costUsd: number;
  calls: number;
  requests: number;
  cacheServed: number;
  touched: number;
}

const sessions = new Map<string, SessionState>();
const MAX_SESSIONS = 500;
const TTL_MS = 6 * 60 * 60 * 1000;

export function getSession(id: string): SessionState {
  const now = Date.now();
  let s = sessions.get(id);
  if (!s) {
    if (sessions.size >= MAX_SESSIONS) {
      for (const [k, v] of sessions) if (now - v.touched > TTL_MS) sessions.delete(k);
      if (sessions.size >= MAX_SESSIONS) sessions.delete(sessions.keys().next().value as string);
    }
    s = { notes: [], usage: emptyUsage(), costUsd: 0, calls: 0, requests: 0, cacheServed: 0, touched: now };
    sessions.set(id, s);
  }
  s.touched = now;
  return s;
}

export function recordSpend(s: SessionState, u: Usage, cost: number, calls: number) {
  s.usage = addUsage(s.usage, u);
  s.costUsd += cost;
  s.calls += calls;
}

const NOTE_LIMIT = 12;
const NOTE_CHARS = 160;

/** Cheap local note extraction: decisions the user states ("use X", "always Y", "remember …"). */
export function extractNotes(userText: string): string[] {
  const out: string[] = [];
  const re = /(?:^|[.!?\n]\s*)((?:remember|note|always|never|from now on|use|prefer|my (?:name|stack|project|app|site) is|we(?:'| a)re using|the goal is)\b[^.!?\n]{4,})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(userText)) && out.length < 3) out.push(m[1].trim().slice(0, NOTE_CHARS));
  return out;
}

export function addNotes(s: SessionState, notes: string[]) {
  for (const n of notes) {
    if (!s.notes.some((x) => x.toLowerCase() === n.toLowerCase())) s.notes.push(n);
  }
  if (s.notes.length > NOTE_LIMIT) s.notes = s.notes.slice(-NOTE_LIMIT);
}

export function memoryBlock(s: SessionState, digestText: string): string {
  const parts: string[] = [];
  if (s.notes.length) parts.push('Session notes:\n' + s.notes.map((n) => `- ${n}`).join('\n'));
  if (digestText) parts.push('Earlier in this chat (digest):\n' + digestText);
  return parts.join('\n\n');
}

// ---- global daily ledger (hard stop on runaway spend) ----
let day = new Date().toISOString().slice(0, 10);
let dayCost = 0;
export function dailySpend(): number {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== day) {
    day = today;
    dayCost = 0;
  }
  return dayCost;
}
export function addDaily(cost: number) {
  dailySpend();
  dayCost += cost;
}
export function resetStateForTests() {
  sessions.clear();
  respCache.clear();
  dayCost = 0;
}

// ---- tiny response cache (exact repeat prompts cost 0 tokens) ----
interface CacheEntry {
  text: string;
  at: number;
  meta: any;
}
const respCache = new Map<string, CacheEntry>();
const RESP_TTL = 30 * 60 * 1000;
const RESP_MAX = 200;

export const cacheKey = (parts: string[]) => createHash('sha256').update(parts.join('\u0001')).digest('hex');

export function cacheGet(key: string): CacheEntry | undefined {
  const e = respCache.get(key);
  if (!e) return undefined;
  if (Date.now() - e.at > RESP_TTL) {
    respCache.delete(key);
    return undefined;
  }
  return e;
}
export function cachePut(key: string, text: string, meta: any) {
  if (respCache.size >= RESP_MAX) respCache.delete(respCache.keys().next().value as string);
  respCache.set(key, { text, at: Date.now(), meta });
}
