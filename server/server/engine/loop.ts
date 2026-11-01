import { Budgets, LoopMode, MODEL_ID, MODES, PRICING, VerifyMode, readBudgets } from './config';
import { ApiRequest, ApiResponse, Transport } from './anthropic';
import { BREVITY, buildSystem } from './prompt';
import { Msg, buildMessages } from './context';
import { Route, Tier, route as routeRequest } from './router';
import { Failure, describe, isContinuation, verify } from './verify';
import {
  SessionState,
  addDaily,
  addNotes,
  cacheGet,
  cacheKey,
  cachePut,
  dailySpend,
  extractNotes,
  getSession,
  memoryBlock,
  recordSpend,
} from './state';
import { Usage, addUsage, callCostUsd, emptyUsage, estTokens } from './tokens';
import { imageFromPrompt, model3dFromPrompt } from './media';
import { createHash } from 'node:crypto';

export interface Attachment {
  mimeType: string;
  data: string;
}

export interface ChatInput {
  sessionId: string;
  messages: Msg[];
  systemInstruction?: string;
  personaId?: string;
  thinkingLevel?: string;
  useSearchGrounding?: boolean;
  mode?: LoopMode;
  verifyMode?: VerifyMode;
  attachments?: Attachment[];
  noCache?: boolean;
  /** MCP search tool: allow the single web search regardless of wording */
  forceSearch?: boolean;
}

export interface Telemetry {
  tier: Tier;
  mode: LoopMode;
  protocol: string[];
  loops: number;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  webSearches: number;
  costUsd: number;
  naiveCostUsd: number;
  savedPct: number;
  responseCacheHit: boolean;
  verified: boolean;
  stopReason: string | null;
  maxTokens: number;
  effort: string;
  promptTokensTrimmed: number;
  session: { costUsd: number; capUsd: number; requests: number };
  daily: { costUsd: number; capUsd: number };
  blocked?: string;
  notes: string[];
}

export interface ChatResult {
  text: string;
  model: string;
  grounding: { used: boolean; webSearchQueries: string[]; sources: Array<{ title: string; url: string }> };
  telemetry: Telemetry;
  generatedImages?: any[];
  model3D?: any;
}

const SUPPORTED_IMG = /^image\/(png|jpeg|gif|webp)$/;
const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

function userContent(text: string, atts: Attachment[], notes: string[]) {
  const blocks: any[] = [];
  for (const a of atts) {
    const data = (a.data || '').replace(/^data:[^;]+;base64,/, '');
    if (!data) continue;
    if (SUPPORTED_IMG.test(a.mimeType)) blocks.push({ type: 'image', source: { type: 'base64', media_type: a.mimeType, data } });
    else if (a.mimeType === 'application/pdf') blocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } });
    else notes.push(`attachment-skipped:${a.mimeType}`);
  }
  if (!blocks.length) return text;
  blocks.push({ type: 'text', text });
  return blocks;
}

export function mergeContinuation(acc: string, cont: string): string {
  const max = Math.min(200, acc.length, cont.length);
  for (let k = max; k >= 20; k--) if (acc.endsWith(cont.slice(0, k))) return acc + cont.slice(k);
  return acc + cont;
}

function fitMaxTokens(promptTokens: number, wanted: number, remainingUsd: number): number {
  const inputCost = (promptTokens * PRICING.shortIn) / 1e6;
  const room = Math.floor(((remainingUsd - inputCost) / PRICING.shortOut) * 1e6);
  return Math.max(0, Math.min(wanted, room));
}

function baseTelemetry(tier: Tier, mode: LoopMode, s: SessionState, b: Budgets): Telemetry {
  return {
    tier,
    mode,
    protocol: [],
    loops: 0,
    calls: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    webSearches: 0,
    costUsd: 0,
    naiveCostUsd: 0,
    savedPct: 0,
    responseCacheHit: false,
    verified: true,
    stopReason: null,
    maxTokens: 0,
    effort: '-',
    promptTokensTrimmed: 0,
    session: { costUsd: round6(s.costUsd), capUsd: b.sessionMaxUsd, requests: s.requests },
    daily: { costUsd: round6(dailySpend()), capUsd: b.dailyMaxUsd },
    notes: [],
  };
}

function localCommand(cmd: NonNullable<Route['command']>, s: SessionState, b: Budgets, mode: LoopMode): string {
  const u = s.usage;
  switch (cmd) {
    case 'budget':
      return [
        `**Session spend:** $${s.costUsd.toFixed(5)} of $${b.sessionMaxUsd.toFixed(2)} cap · ${s.requests} requests · ${s.calls} model calls`,
        `**Tokens:** ${u.input} in · ${u.cacheRead} cached-read · ${u.cacheWrite} cache-write · ${u.output} out`,
        `**Today (all sessions):** $${dailySpend().toFixed(5)} of $${b.dailyMaxUsd.toFixed(2)} cap`,
        `**Answers served free from cache:** ${s.cacheServed}`,
        `**Model:** ${MODEL_ID} · **Loop mode:** ${mode.toUpperCase()}`,
      ].join('\n');
    case 'notes':
      return s.notes.length ? '**Session notes** (sent with every request, ~' + estTokens(s.notes.join('\n')) + ' tokens):\n' + s.notes.map((n) => `- ${n}`).join('\n') : 'No session notes yet. Say "remember …", "always …" or "use …" and I will keep it.';
    case 'forget':
      s.notes = [];
      return 'Session notes cleared.';
    case 'mode':
      return `Loop mode is **${mode.toUpperCase()}**. Change it from the LOOP bar above the prompt box: ECO (cheapest) · BALANCED · THOROUGH.`;
    default:
      return [
        '**AIX Alpha v3 local commands (cost 0 tokens):**',
        '- `/budget` — spend, tokens, caps',
        '- `/notes` — what I am remembering for this chat',
        '- `/forget` — clear notes',
        '- `/mode` — current loop mode',
      ].join('\n');
  }
}

export async function runChat(input: ChatInput, transport: Transport | null, budgets: Budgets = readBudgets()): Promise<ChatResult> {
  const mode: LoopMode = MODES[input.mode as LoopMode] ? (input.mode as LoopMode) : 'eco';
  const verifyMode: VerifyMode = input.verifyMode === 'llm' ? 'llm' : 'local';
  const session = getSession(input.sessionId || 'anon');
  session.requests++;

  const lastUser = [...input.messages].reverse().find((m) => m.role === 'user');
  const prompt = (lastUser?.content || '').toString();
  const atts = input.attachments || [];
  const personaEffort = input.thinkingLevel === 'LOW' || input.thinkingLevel === 'MINIMAL' ? ('low' as const) : undefined;
  const r = routeRequest(prompt, { mode, hasAttachments: atts.length > 0, searchEnabled: !!input.useSearchGrounding, personaEffort });

  if (input.forceSearch && input.useSearchGrounding) r.allowSearch = true;
  const t = baseTelemetry(r.tier, mode, session, budgets);
  t.protocol.push(`route:${r.tier}`);
  const result = (text: string, extra: Partial<ChatResult> = {}): ChatResult => {
    t.session = { costUsd: round6(session.costUsd), capUsd: budgets.sessionMaxUsd, requests: session.requests };
    t.daily = { costUsd: round6(dailySpend()), capUsd: budgets.dailyMaxUsd };
    t.costUsd = round6(t.costUsd);
    return {
      text,
      model: t.calls || t.responseCacheHit ? MODEL_ID : 'local',
      grounding: { used: t.webSearches > 0, webSearchQueries: [], sources: [] },
      telemetry: t,
      ...extra,
    };
  };

  // ── Layer 0: reflexes & commands (0 tokens) ──────────────────────────────
  if (r.command) {
    t.protocol.push(`local:/${r.command}`);
    t.naiveCostUsd = 0.0002;
    t.savedPct = 100;
    return result(localCommand(r.command, session, budgets, mode));
  }
  if (r.reflex) {
    t.protocol.push('reflex');
    t.naiveCostUsd = 0.0002;
    t.savedPct = 100;
    return result(r.reflex);
  }

  // Media intents with no coding ask are answered by local generators (0 tokens).
  const words = prompt.trim().split(/\s+/).filter(Boolean).length;
  if (!r.intents.code && words <= 40 && atts.length === 0) {
    if (r.intents.model3d) {
      t.protocol.push('local:3d');
      t.savedPct = 100;
      return result('3D mesh generated locally — orbit, zoom and restyle it in the viewer below.', { model3D: model3dFromPrompt(prompt) });
    }
    if (r.intents.image) {
      t.protocol.push('local:image');
      t.savedPct = 100;
      return result('Image generated — see below.', { generatedImages: imageFromPrompt(prompt) });
    }
  }

  // ── Budget guards (0 tokens) ─────────────────────────────────────────────
  if (dailySpend() >= budgets.dailyMaxUsd) {
    t.blocked = 'daily';
    t.protocol.push('blocked:daily');
    return result(`⛔ **Budget guard:** the daily cap of $${budgets.dailyMaxUsd.toFixed(2)} is reached. No tokens were used. Raise \`AIX_DAILY_MAX_USD\` or wait for the daily reset.`);
  }
  if (session.costUsd >= budgets.sessionMaxUsd) {
    t.blocked = 'session';
    t.protocol.push('blocked:session');
    return result(`⛔ **Budget guard:** this chat reached its $${budgets.sessionMaxUsd.toFixed(2)} cap. No tokens were used. Start a new chat or raise \`AIX_SESSION_MAX_USD\`.`);
  }
  if (!transport) throw new Error('ANTHROPIC_API_KEY is not set on the server.');

  // ── Layer 1: context engineering (0 tokens) ──────────────────────────────
  addNotes(session, extractNotes(prompt));
  const ctx = buildMessages(input.messages, { keep: r.historyMsgs });
  const memory = memoryBlock(session, ctx.digestText);
  const sys = buildSystem({ personaId: input.personaId, systemInstruction: input.systemInstruction, memory, brevity: BREVITY[r.tier] || BREVITY.STANDARD });
  t.promptTokensTrimmed = Math.max(0, sys.savedTokens + (ctx.originalTokens - ctx.sentTokens));
  if (ctx.dropped) t.protocol.push(`ctx:-${ctx.dropped}msg`);
  if (sys.savedTokens) t.protocol.push(`sys:-${sys.savedTokens}t`);

  const messages = ctx.messages.map((m) => ({ ...m }));
  if (!messages.length) messages.push({ role: 'user', content: prompt });
  const lastMsg = messages[messages.length - 1];
  if (lastMsg.role === 'user') lastMsg.content = userContent(typeof lastMsg.content === 'string' ? lastMsg.content : prompt, atts, t.notes);
  // history cache breakpoint: everything before the live user turn
  if (messages.length >= 2) {
    const prev = messages[messages.length - 2];
    const txt = typeof prev.content === 'string' ? prev.content : '';
    if (txt) prev.content = [{ type: 'text', text: txt, cache_control: { type: 'ephemeral' } }] as any;
  }

  const attTokens = atts.reduce((s, a) => s + (a.mimeType === 'application/pdf' ? 3000 : 1600), 0);
  const promptTokens = sys.blocks.reduce((s, b) => s + estTokens(b.text), 0) + ctx.sentTokens + attTokens;
  // What an unoptimised call would have sent: full raw persona prompt + entire history, nothing cached.
  const naiveIn = (sys.rawTokens || sys.coreTokens) + ctx.originalTokens + attTokens;

  // ── Layer 1b: response cache (0 tokens) ──────────────────────────────────
  const cacheable = !input.noCache && !atts.length && !r.intents.fresh && !r.allowSearch && process.env.AIX_CACHE !== '0';
  const ckey = cacheKey([MODEL_ID, input.personaId || createHash('sha1').update(input.systemInstruction || '').digest('hex'), r.tier, mode, JSON.stringify(messages), memory]);
  if (cacheable) {
    const hit = cacheGet(ckey);
    if (hit) {
      session.cacheServed++;
      t.responseCacheHit = true;
      t.protocol.push('cache:hit');
      t.naiveCostUsd = round6((naiveIn * PRICING.shortIn + estTokens(hit.text) * PRICING.shortOut) / 1e6);
      t.savedPct = 100;
      return result(hit.text, { grounding: hit.meta?.grounding, generatedImages: undefined });
    }
    t.protocol.push('cache:miss');
  }

  // ── Layer 2: generate → verify → (continue | refine) loop ────────────────
  let spent = 0;
  let totalUsage: Usage = emptyUsage();
  const sources = new Map<string, string>();
  const queries: string[] = [];

  const doCall = async (req: ApiRequest, label: string): Promise<ApiResponse | null> => {
    const reqPrompt = req.system.reduce((s, b) => s + estTokens(b.text), 0) + req.messages.reduce((s, m) => s + estTokens(typeof m.content === 'string' ? m.content : JSON.stringify(m.content)), 0) + attTokens;
    const fit = fitMaxTokens(reqPrompt, req.max_tokens, budgets.requestMaxUsd - spent);
    if (fit < Math.min(150, req.max_tokens)) {
      t.protocol.push(`stop:budget(${label})`);
      t.notes.push('request-budget-exhausted');
      return null;
    }
    req.max_tokens = fit;
    const res = await transport(req);
    const c = callCostUsd(res.usage);
    spent += c;
    totalUsage = addUsage(totalUsage, res.usage);
    t.calls++;
    t.costUsd += c;
    t.notes.push(...res.notes);
    for (const s of res.sources) sources.set(s.url, s.title);
    queries.push(...res.searchQueries);
    t.protocol.push(`${label}:${res.usage.output}out`);
    return res;
  };

  const tools = r.allowSearch ? [{ type: 'web_search_20250305', name: 'web_search', max_uses: 1 }] : undefined;
  t.effort = r.effort;
  t.maxTokens = r.maxTokens;

  let first: ApiResponse | null;
  try {
    first = await doCall({ model: MODEL_ID, max_tokens: r.maxTokens, system: sys.blocks, messages, effort: r.effort, tools }, 'gen');
  } catch (e) {
    recordSpend(session, totalUsage, t.costUsd, t.calls);
    addDaily(t.costUsd);
    throw e;
  }
  if (!first) {
    return result('⛔ **Budget guard:** the per-request cap leaves no room for a reply. Raise `AIX_REQUEST_MAX_USD`.');
  }

  let text = first.text;
  let stopReason = first.stopReason;
  let prevHash = '';
  let failures: Failure[] = [];
  const maxRefines = Math.min(r.maxRefines, MODES[mode].maxRefines);

  const check = () => verify(text, { prompt, stopReason, intents: r.intents });
  failures = stopReason === 'refusal' ? [] : check();
  t.protocol.push(failures.length ? `verify:${failures.map((f) => f.kind).join('+')}` : 'verify:pass');

  let refines = 0;
  while (failures.length && refines < maxRefines && stopReason !== 'refusal') {
    refines++;
    t.loops = refines;
    const origUser = (prompt || '').slice(0, 3000);
    let res: ApiResponse | null;

    if (failures.every(isContinuation)) {
      const tail = text.length > 24000 ? text.slice(0, 1500) + '\n[… omitted …]\n' + text.slice(-20000) : text;
      res = await doCall(
        {
          model: MODEL_ID,
          max_tokens: Math.min(r.maxTokens, 6000),
          system: sys.blocks,
          messages: [
            { role: 'user', content: origUser },
            { role: 'assistant', content: tail.replace(/\s+$/, '') || '(start)' },
            { role: 'user', content: 'Continue exactly where you stopped. Output only the remainder — no repetition, no preface. Close every open code fence and tag.' },
          ],
          effort: 'low',
        },
        `cont#${refines}`,
      );
      if (!res) break;
      text = mergeContinuation(text, res.text);
    } else {
      const prev = text.slice(0, 1200);
      res = await doCall(
        {
          model: MODEL_ID,
          max_tokens: r.maxTokens,
          system: sys.blocks,
          messages: [{ role: 'user', content: `${origUser}\n\n[Revision required — ${describe(failures)}. Rejected attempt began:\n${prev}\n]\nReturn the corrected complete answer only.` }],
          effort: r.effort === 'low' ? 'medium' : r.effort,
        },
        `refine#${refines}`,
      );
      if (!res) break;
      const h = createHash('sha1').update(res.text).digest('hex');
      if (h === prevHash || res.text === text) {
        t.protocol.push('stop:no-progress');
        break;
      }
      prevHash = h;
      text = res.text;
    }
    stopReason = res.stopReason;
    failures = stopReason === 'refusal' ? [] : check();
    t.protocol.push(failures.length ? `verify:${failures.map((f) => f.kind).join('+')}` : 'verify:pass');
  }

  // Optional evaluator (LLM judge): one tiny call, DEEP tier only, only when local checks passed.
  if (verifyMode === 'llm' && r.tier === 'DEEP' && !failures.length && stopReason !== 'refusal' && refines < maxRefines) {
    const judge = await doCall(
      {
        model: MODEL_ID,
        max_tokens: 90,
        system: [{ type: 'text', text: 'You are a strict reviewer. Reply exactly "OK" if the answer fully and correctly satisfies the request. Otherwise reply "FIX: <one sentence naming the concrete defect>".' }],
        messages: [{ role: 'user', content: `Request:\n${prompt.slice(0, 1500)}\n\nAnswer (${text.length} chars; head/tail):\n${text.slice(0, 1800)}\n…\n${text.slice(-1200)}` }],
        effort: 'low',
      },
      'judge',
    );
    if (judge && /^\s*FIX:/i.test(judge.text)) {
      refines++;
      t.loops = refines;
      t.protocol.push('judge:fix');
      const fixed = await doCall(
        {
          model: MODEL_ID,
          max_tokens: r.maxTokens,
          system: sys.blocks,
          messages: [{ role: 'user', content: `${prompt.slice(0, 3000)}\n\n[Reviewer found: ${judge.text.replace(/^\s*FIX:\s*/i, '').slice(0, 300)}]\nReturn the corrected complete answer only.` }],
          effort: 'medium',
        },
        'refine-judge',
      );
      if (fixed && fixed.text.trim() && fixed.stopReason !== 'max_tokens') {
        text = fixed.text;
        stopReason = fixed.stopReason;
      }
    } else if (judge) {
      t.protocol.push('judge:ok');
    }
  }

  t.verified = failures.length === 0;
  t.stopReason = stopReason;
  if (stopReason === 'refusal') {
    t.verified = false;
    t.protocol.push('stop:refusal');
    if (!text.trim()) text = 'The model declined this request.';
  } else {
    t.protocol.push(t.verified ? 'stop:pass' : refines >= maxRefines ? 'stop:max-loops' : 'stop:unverified');
  }

  // ── Ledger ───────────────────────────────────────────────────────────────
  t.inputTokens = totalUsage.input;
  t.outputTokens = totalUsage.output;
  t.cacheReadTokens = totalUsage.cacheRead;
  t.cacheWriteTokens = totalUsage.cacheWrite;
  t.webSearches = totalUsage.webSearches;
  recordSpend(session, totalUsage, t.costUsd, t.calls);
  addDaily(t.costUsd);
  t.naiveCostUsd = round6((naiveIn * PRICING.shortIn + Math.max(totalUsage.output, estTokens(text)) * PRICING.shortOut) / 1e6);
  t.savedPct = t.naiveCostUsd > 0 ? Math.max(0, Math.min(100, Math.round((1 - t.costUsd / t.naiveCostUsd) * 100))) : 0;

  const grounding = {
    used: totalUsage.webSearches > 0 || sources.size > 0,
    webSearchQueries: queries,
    sources: [...sources].map(([url, title]) => ({ url, title })),
  };
  if (cacheable && t.verified && stopReason === 'end_turn' && t.calls > 0) cachePut(ckey, text, { grounding });
  return result(text, { grounding });
}
