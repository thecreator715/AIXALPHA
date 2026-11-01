import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { callCostUsd, emptyUsage } from './tokens';
import { route } from './router';
import { promptDiet } from './prompt';
import { windowStart, buildMessages, stubOldCode } from './context';
import { verify } from './verify';
import { ApiRequest, ApiResponse, Transport, parseResponse } from './anthropic';
import { runChat, mergeContinuation } from './loop';
import { resetStateForTests } from './state';
import { Budgets } from './config';
import { AIX_ALPHA_QUANTUM_SYSTEM_PROMPT } from '../../src/data/personas';

const budgets: Budgets = { requestMaxUsd: 0.01, sessionMaxUsd: 0.25, dailyMaxUsd: 2 };

function reply(text: string, over: Partial<ApiResponse> = {}, out = 100): ApiResponse {
  const usage = emptyUsage();
  usage.input = 400;
  usage.output = out;
  return { text, stopReason: 'end_turn', usage, sources: [], searchQueries: [], notes: [], ...over };
}
function scripted(responses: ApiResponse[]) {
  const calls: ApiRequest[] = [];
  const t: Transport = async (req) => {
    calls.push(JSON.parse(JSON.stringify(req)));
    const r = responses[Math.min(calls.length - 1, responses.length - 1)];
    return r;
  };
  return { t, calls };
}
let n = 0;
const sid = () => `s${++n}`;
beforeEach(() => resetStateForTests());

test('cost math: Haiku 5.5 short-prompt rates and cache read', () => {
  const u = emptyUsage();
  u.input = 1000;
  u.output = 500;
  assert.equal(callCostUsd(u), (1000 * 0.1 + 500 * 0.5) / 1e6);
  u.cacheRead = 10_000;
  assert.ok(Math.abs(callCostUsd(u) - (1000 * 0.1 + 500 * 0.5 + 10_000 * 0.01) / 1e6) < 1e-12);
});

test('cost math: >100K prompt bills at the long-context rate', () => {
  const u = emptyUsage();
  u.input = 101_000;
  u.output = 1000;
  assert.ok(Math.abs(callCostUsd(u) - (101_000 * 0.5 + 1000 * 2.5) / 1e6) < 1e-12);
});

test('router: reflex, commands, tiers', () => {
  assert.ok(route('hi', { mode: 'eco' }).reflex);
  assert.equal(route('/budget', { mode: 'eco' }).command, 'budget');
  assert.equal(route('what is a mutex?', { mode: 'eco' }).tier, 'MICRO');
  const app = route('build me a snake game as a single html file with scores', { mode: 'eco' });
  assert.equal(app.tier, 'DEEP');
  assert.ok(app.intents.app);
  assert.ok(app.maxTokens > route('what is a mutex?', { mode: 'eco' }).maxTokens);
  assert.ok(route('what is the latest bitcoin price today', { mode: 'eco', searchEnabled: true }).allowSearch);
  assert.equal(route('what is the latest bitcoin price today', { mode: 'eco', searchEnabled: false }).allowSearch, false);
});

test('prompt diet shrinks the v2 quantum prompt without losing instructions', () => {
  const { text, savedTokens } = promptDiet(AIX_ALPHA_QUANTUM_SYSTEM_PROMPT);
  assert.ok(savedTokens > 0);
  assert.ok(text.includes('QUANTUM VARIABLE SYSTEM'));
  assert.ok(!/█{4,}/.test(text));
});

test('stepped window keeps the cached prefix stable across turns', () => {
  const starts = [10, 11, 12, 13].map((total) => windowStart(total, 6, 4));
  assert.deepEqual(starts, [4, 4, 4, 4]);
  assert.equal(windowStart(14, 6, 4), 8);
});

test('old code blocks are stubbed, recent ones kept', () => {
  const big = '```js\n' + Array.from({ length: 30 }, (_, i) => `line${i}();`).join('\n') + '\n```';
  assert.ok(stubOldCode(big).includes('30 lines omitted'));
  const msgs = [
    { role: 'user' as const, content: 'make it' },
    { role: 'assistant' as const, content: big },
    { role: 'user' as const, content: 'tweak' },
    { role: 'assistant' as const, content: 'ok' },
    { role: 'user' as const, content: 'now this' },
  ];
  const ctx = buildMessages(msgs, { keep: 10 });
  assert.ok((ctx.messages[1].content as string).includes('omitted'));
  assert.ok(ctx.sentTokens < ctx.originalTokens);
});

test('verify catches open fences, cut-off html, bad json, word limits, loops', () => {
  const i = (o = {}) => ({ code: false, app: false, json: false, fresh: false, image: false, model3d: false, video: false, ...o });
  assert.deepEqual(verify('ok', { prompt: 'x', stopReason: 'end_turn', intents: i() }), []);
  assert.equal(verify('```js\nfoo', { prompt: 'x', stopReason: 'end_turn', intents: i() })[0].kind, 'open-fence');
  assert.equal(verify('<html><body>', { prompt: 'x', stopReason: 'end_turn', intents: i({ app: true }) })[0].kind, 'html-incomplete');
  assert.equal(verify('```json\n{bad}\n```', { prompt: 'return json', stopReason: 'end_turn', intents: i({ json: true }) })[0].kind, 'bad-json');
  assert.equal(verify('word '.repeat(80), { prompt: 'explain in 20 words', stopReason: 'end_turn', intents: i() })[0].kind, 'length');
  assert.equal(verify('x', { prompt: 'x', stopReason: 'max_tokens', intents: i() })[0].kind, 'truncated');
  assert.equal(verify('the quick brown fox jumps over the lazy dog again and again. '.repeat(20), { prompt: 'x', stopReason: 'end_turn', intents: i() })[0].kind, 'degenerate');
});

test('mergeContinuation removes repeated overlap', () => {
  const acc = 'function add(a, b) { return a + b; }\nconst totalValue = add(1, 2);';
  const cont = 'const totalValue = add(1, 2);\nconsole.log(totalValue);';
  assert.equal(mergeContinuation(acc, cont), acc + '\nconsole.log(totalValue);');
});

test('parseResponse reads usage, cache fields, citations and search queries', () => {
  const r = parseResponse({
    stop_reason: 'end_turn',
    usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 100, cache_creation_input_tokens: 7, server_tool_use: { web_search_requests: 1 } },
    content: [
      { type: 'server_tool_use', input: { query: 'btc price' } },
      { type: 'web_search_tool_result', content: [{ url: 'https://a.test', title: 'A' }] },
      { type: 'text', text: 'Hello', citations: [{ url: 'https://b.test', title: 'B' }] },
    ],
  });
  assert.equal(r.text, 'Hello');
  assert.equal(r.usage.cacheRead, 100);
  assert.equal(r.usage.cacheWrite, 7);
  assert.equal(r.usage.webSearches, 1);
  assert.deepEqual(r.searchQueries, ['btc price']);
  assert.equal(r.sources.length, 2);
});

test('reflex and commands cost zero tokens and never touch the API', async () => {
  const { t, calls } = scripted([reply('should not be called')]);
  const id = sid();
  const a = await runChat({ sessionId: id, messages: [{ role: 'user', content: 'thanks' }] }, t, budgets);
  const b = await runChat({ sessionId: id, messages: [{ role: 'user', content: '/budget' }] }, t, budgets);
  assert.equal(calls.length, 0);
  assert.equal(a.telemetry.costUsd, 0);
  assert.ok(b.text.includes('Session spend'));
});

test('simple answer: one call, verified, system block carries the cache breakpoint', async () => {
  const { t, calls } = scripted([reply('A mutex is a lock for exclusive access.')]);
  const r = await runChat({ sessionId: sid(), messages: [{ role: 'user', content: 'what is a mutex?' }] }, t, budgets);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].model, 'claude-haiku-5-5');
  assert.equal(calls[0].effort, 'low');
  assert.ok(calls[0].system[0].cache_control);
  assert.equal(r.telemetry.verified, true);
  assert.ok(r.telemetry.costUsd > 0 && r.telemetry.costUsd < 0.001);
});

test('truncated app build is continued (append-only), not regenerated', async () => {
  const { t, calls } = scripted([
    reply('```html\n<!DOCTYPE html><html><body><script>let a=1;', { stopReason: 'max_tokens' }, 900),
    reply('\nalert(a);</script></body></html>\n```', {}, 40),
  ]);
  const r = await runChat({ sessionId: sid(), messages: [{ role: 'user', content: 'build me a tiny html game' }] }, t, budgets);
  assert.equal(calls.length, 2);
  assert.ok(r.text.includes('alert(a);</script></body></html>'));
  assert.ok(r.telemetry.protocol.some((p) => p.startsWith('cont#1')));
  assert.equal(r.telemetry.verified, true);
  assert.equal(r.telemetry.loops, 1);
  // continuation call is delta-only: it must not resend the whole conversation
  assert.equal(calls[1].messages.length, 3);
});

test('length-constraint failure triggers one targeted refine at higher effort', async () => {
  const { t, calls } = scripted([reply('word '.repeat(90)), reply('Short and sweet answer here.')]);
  const r = await runChat({ sessionId: sid(), messages: [{ role: 'user', content: 'explain recursion in 20 words' }] }, t, budgets);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].effort, 'medium');
  assert.ok(String(calls[1].messages[0].content).includes('Revision required'));
  assert.equal(r.text, 'Short and sweet answer here.');
});

test('loop stops on no-progress and respects the mode refine cap (eco = 1)', async () => {
  const bad = 'word '.repeat(90);
  const { t, calls } = scripted([reply(bad), reply(bad), reply(bad)]);
  const r = await runChat({ sessionId: sid(), messages: [{ role: 'user', content: 'explain recursion in 20 words' }], mode: 'eco' }, t, budgets);
  assert.ok(calls.length <= 2);
  assert.equal(r.telemetry.verified, false);
});

test('identical prompt is served from the response cache for 0 tokens', async () => {
  const { t, calls } = scripted([reply('Because of the CAP theorem trade-offs.')]);
  const id = sid();
  const msgs = [{ role: 'user' as const, content: 'why do distributed databases drop consistency?' }];
  const a = await runChat({ sessionId: id, messages: msgs }, t, budgets);
  const b = await runChat({ sessionId: id, messages: msgs }, t, budgets);
  assert.equal(calls.length, 1);
  assert.equal(b.telemetry.responseCacheHit, true);
  assert.equal(b.telemetry.costUsd, 0);
  assert.equal(b.text, a.text);
});

test('refusals are returned as-is without looping', async () => {
  const { t, calls } = scripted([reply('', { stopReason: 'refusal' })]);
  const r = await runChat({ sessionId: sid(), messages: [{ role: 'user', content: 'what is a mutex?' }] }, t, budgets);
  assert.equal(calls.length, 1);
  assert.ok(r.telemetry.protocol.includes('stop:refusal'));
});

test('session cap blocks before any API call', async () => {
  const { t, calls } = scripted([reply('hello there friend')]);
  const id = sid();
  const tiny: Budgets = { ...budgets, sessionMaxUsd: 0.000001 };
  await runChat({ sessionId: id, messages: [{ role: 'user', content: 'what is a mutex?' }] }, t, tiny);
  const r = await runChat({ sessionId: id, messages: [{ role: 'user', content: 'and a semaphore, how does it differ?' }] }, t, tiny);
  assert.equal(calls.length, 1);
  assert.equal(r.telemetry.blocked, 'session');
});

test('per-request cap shrinks max_tokens to fit, or blocks when nothing fits', async () => {
  const { t, calls } = scripted([reply('ok then')]);
  await runChat({ sessionId: sid(), messages: [{ role: 'user', content: 'build me a full html dashboard app' }] }, t, { ...budgets, requestMaxUsd: 0.0005 });
  assert.ok(calls[0].max_tokens < 9000 && calls[0].max_tokens >= 150);
  const none = scripted([reply('x')]);
  const r = await runChat({ sessionId: sid(), messages: [{ role: 'user', content: 'build me a complete html analytics portal app' }] }, none.t, { ...budgets, requestMaxUsd: 0.00001 });
  assert.equal(none.calls.length, 0);
  assert.ok(r.text.includes('Budget guard'));
});

test('LLM evaluator runs only in llm mode on DEEP tier and can trigger one fix', async () => {
  const { t, calls } = scripted([reply('<html>' + 'a'.repeat(50) + '</html>'), reply('FIX: the page has no title'), reply('<html><title>T</title></html>')]);
  const r = await runChat({ sessionId: sid(), messages: [{ role: 'user', content: 'build a landing page in html' }], verifyMode: 'llm', mode: 'balanced' }, t, budgets);
  assert.equal(calls.length, 3);
  assert.equal(calls[1].max_tokens <= 90, true);
  assert.ok(r.text.includes('<title>T</title>'));
  const off = scripted([reply('<html>' + 'a'.repeat(50) + '</html>')]);
  await runChat({ sessionId: sid(), messages: [{ role: 'user', content: 'build a landing page in html' }], verifyMode: 'local' }, off.t, budgets);
  assert.equal(off.calls.length, 1);
});

test('session notes are captured locally and sent after the cached core', async () => {
  const { t, calls } = scripted([reply('Noted, using Vite.')]);
  const id = sid();
  await runChat({ sessionId: id, messages: [{ role: 'user', content: 'Remember we are using Vite and Tailwind. what is HMR?' }] }, t, budgets);
  assert.equal(calls[0].system.length, 2);
  assert.ok(calls[0].system[1].text.includes('Vite'));
  assert.equal(calls[0].system[1].cache_control, undefined);
});

test('missing transport raises a clear setup error (no fake answers)', async () => {
  await assert.rejects(runChat({ sessionId: sid(), messages: [{ role: 'user', content: 'what is a mutex?' }] }, null, budgets), /ANTHROPIC_API_KEY/);
});
