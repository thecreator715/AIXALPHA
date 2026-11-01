import express from 'express';
import path from 'path';
import fs from 'node:fs';
import vm from 'node:vm';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

import { MODEL_ID, readBudgets } from './server/engine/config';
import { Transport, createAnthropicTransport, createMockTransport } from './server/engine/anthropic';
import { runChat, ChatResult } from './server/engine/loop';
import { getSession, dailySpend } from './server/engine/state';
import { model3dFromPrompt, imageFromPrompt } from './server/engine/media';
import { accountRoutes, authAccount, charge, costUsd, usdToCredits, isOwner } from './server/accounts';

dotenv.config({ path: ['.env.local', '.env'] });

const app = express();
const PORT = Number(process.env.PORT) || 3000;
// CORS: the static front end (e.g. GitHub Pages) calls this server. Set AIX_ALLOWED_ORIGINS="https://you.github.io,https://..."
const ORIGINS = (process.env.AIX_ALLOWED_ORIGINS || '').split(',').map((x) => x.trim()).filter(Boolean);
app.use((req, res, next) => {
  const o = String(req.headers.origin || '');
  if (o && (ORIGINS.includes('*') || ORIGINS.includes(o))) {
    res.setHeader('Access-Control-Allow-Origin', o); res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization'); res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  }
  if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
  next();
});
app.use((req, res, next) => (req.path === '/api/stripe/webhook' ? next() : express.json({ limit: '25mb' })(req, res, next)));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// ----------------------------------------------------
// Transport: real Claude Haiku, or an explicit offline mock (AIX_MOCK=1)
// ----------------------------------------------------
const MOCK = process.env.AIX_MOCK === '1';
const API_KEY = ((process.env.ANTHROPIC_API_KEY || '').match(/sk-ant-[A-Za-z0-9_-]+/) || [process.env.ANTHROPIC_API_KEY || ''])[0];
const transport: Transport | null = MOCK ? createMockTransport() : API_KEY ? createAnthropicTransport(API_KEY) : null;

// ----------------------------------------------------
// Abuse / runaway-spend protection: per-IP rate limit on endpoints that can spend tokens
// ----------------------------------------------------
const hits = new Map<string, number[]>();
const RATE_PER_MIN = Number(process.env.AIX_RATE_PER_MIN) || 30;
function rateLimit(req: express.Request, res: express.Response, next: express.NextFunction) {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  if (recent.length >= RATE_PER_MIN) {
    res.status(429).json({ success: false, error: `Rate limit: max ${RATE_PER_MIN} requests/min.` });
    return;
  }
  recent.push(now);
  hits.set(ip, recent);
  next();
}

accountRoutes(app, rateLimit);

// Metered model proxy for the front end: the browser never sees the API key.
// Bearer account token -> balance check -> Anthropic (streamed) -> deduct credits -> final aix_balance event.
app.post('/api/sample', rateLimit, async (req, res) => {
  const acct = authAccount(req);
  if (!acct) { res.status(401).json({ error: 'Sign in to use AIX.' }); return; }
  if (!API_KEY) { res.status(503).json({ error: 'Server has no ANTHROPIC_API_KEY.' }); return; }
  if (acct.credits <= 0 && !isOwner(acct)) { res.status(402).json({ error: 'Out of credits. Top up to continue.' }); return; }
  const prompt = String(req.body?.prompt || ''); const stream = !!req.body?.stream;
  if (!prompt) { res.status(400).json({ error: 'prompt required' }); return; }
  const maxTok = Math.min(Number(req.body?.max_tokens) || 4096, 8192);
  const content: any[] = Array.isArray(req.body?.images) ? req.body.images.slice(0, 4).map((i: any) => ({ type: 'image', source: { type: 'base64', media_type: String(i.media_type || 'image/png'), data: String(i.data || '') } })) : [];
  content.push({ type: 'text', text: prompt });
  const up = await fetch(process.env.AIX_UPSTREAM_URL || 'https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: MODEL_ID, max_tokens: maxTok, stream, messages: [{ role: 'user', content }] }) });
  if (!up.ok) { const bad = up.status === 401 || up.status === 403; if (bad) console.error('>>> Anthropic rejected ANTHROPIC_API_KEY (' + up.status + '). Fix .env.local and restart.'); res.status(up.status === 429 ? 429 : 502).json({ error: bad ? 'The server API key was rejected by Anthropic. The owner must fix ANTHROPIC_API_KEY in .env.local.' : 'Model request failed (' + up.status + ').' }); return; }
  const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const bill = () => { charge(acct, costUsd(usage), usage.input + usage.output); return { credits: +acct.credits.toFixed(2), spentCredits: +usdToCredits(costUsd(usage)).toFixed(3) }; };
  if (!stream) {
    const j: any = await up.json(); usage.input = j.usage?.input_tokens || 0; usage.output = j.usage?.output_tokens || 0;
    res.json({ text: (j.content || []).map((c: any) => c.text || '').join(''), truncated: j.stop_reason === 'max_tokens', ...bill() }); return;
  }
  res.setHeader('content-type', 'text/event-stream'); res.setHeader('cache-control', 'no-cache');
  const rd = (up.body as any).getReader(); const dec = new TextDecoder(); let buf = '';
  for (;;) {
    const { done, value } = await rd.read(); if (done) break;
    const chunk = dec.decode(value, { stream: true }); res.write(chunk); buf += chunk;
    const lines = buf.split('\n'); buf = lines.pop() || '';
    for (const ln of lines) if (ln.startsWith('data:')) { try { const e = JSON.parse(ln.slice(5)); if (e.type === 'message_start') usage.input = e.message?.usage?.input_tokens || 0; if (e.type === 'message_delta') usage.output = e.usage?.output_tokens || usage.output; } catch {} }
  }
  res.write('data: ' + JSON.stringify({ type: 'aix_balance', ...bill() }) + '\n\n'); res.end();
});

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', engine: 'aix-alpha-v3-loop', model: MODEL_ID, hasApiKey: !!API_KEY, mock: MOCK, budgets: readBudgets(), timestamp: new Date().toISOString() });
});

app.post('/api/log-client-error', (req, res) => {
  console.error('>>> CLIENT ERROR RECEIVED FROM BROWSER:', JSON.stringify(req.body, null, 2));
  res.json({ status: 'logged' });
});

function toExecutionSteps(r: ChatResult) {
  const now = Date.now();
  const label = (p: string): string => {
    if (p.startsWith('route:')) return `🧭 Router → ${p.slice(6)} tier (local, 0 tokens)`;
    if (p === 'reflex') return '⚡ Reflex reply (0 tokens)';
    if (p.startsWith('local:')) return `🛠 Handled locally (${p.slice(6)}) — 0 tokens`;
    if (p === 'cache:hit') return '💾 Response cache hit — 0 tokens';
    if (p === 'cache:miss') return '🔎 Cache miss';
    if (p.startsWith('ctx:')) return `✂️ Context trimmed (${p.slice(4)})`;
    if (p.startsWith('sys:')) return `🗜 Prompt diet (${p.slice(4)})`;
    if (p.startsWith('gen:')) return `🧠 Claude Haiku generated (${p.slice(4)})`;
    if (p.startsWith('cont#')) return `➕ Continuation pass (${p.slice(5)})`;
    if (p.startsWith('refine')) return `🔁 Refine pass (${p.split(':')[1] || ''})`;
    if (p.startsWith('judge')) return `⚖️ Evaluator ${p.split(':')[1] || ''}`;
    if (p === 'verify:pass') return '✅ Local verification passed (0 tokens)';
    if (p.startsWith('verify:')) return `🔬 Verification failed: ${p.slice(7)}`;
    if (p.startsWith('stop:')) return `⏹ Loop stop: ${p.slice(5)}`;
    if (p.startsWith('blocked:')) return `⛔ Budget guard (${p.slice(8)})`;
    return p;
  };
  return r.telemetry.protocol.map((p, i) => ({ id: String(i + 1), text: label(p), status: 'completed', timestamp: now + i }));
}

app.post('/api/chat', rateLimit, async (req, res) => {
  try {
    const b = req.body || {};
    const messages = Array.isArray(b.messages) ? b.messages.filter((m: any) => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant')) : [];
    if (!messages.length) {
      res.status(400).json({ success: false, error: 'messages[] is required.' });
      return;
    }
    const r = await runChat(
      {
        sessionId: String(b.sessionId || `ip:${req.ip}`),
        messages,
        systemInstruction: typeof b.systemInstruction === 'string' ? b.systemInstruction : undefined,
        personaId: typeof b.personaId === 'string' ? b.personaId : undefined,
        thinkingLevel: b.thinkingLevel,
        useSearchGrounding: !!b.useSearchGrounding,
        mode: b.loopMode,
        verifyMode: b.verifyMode,
        attachments: Array.isArray(b.attachments) ? b.attachments : [],
        noCache: !!b.noCache,
      },
      transport,
    );
    res.json({
      success: true,
      text: r.text,
      model: r.model,
      grounding: r.grounding,
      generatedImages: r.generatedImages,
      model3D: r.model3D,
      executionSteps: toExecutionSteps(r),
      telemetry: r.telemetry,
    });
  } catch (error: any) {
    console.error('Error in /api/chat:', error?.message || error);
    const noKey = /ANTHROPIC_API_KEY/.test(error?.message || '');
    res.status(noKey ? 503 : 502).json({ success: false, error: error?.message || 'Chat failed.' });
  }
});

// Session ledger for the UI meter
app.get('/api/budget', (req, res) => {
  const b = readBudgets();
  const s = getSession(String(req.query.sessionId || 'anon'));
  res.json({ success: true, session: { costUsd: s.costUsd, requests: s.requests, calls: s.calls, usage: s.usage, notes: s.notes, cacheServed: s.cacheServed }, daily: dailySpend(), budgets: b });
});

// Image / 3D: local, zero-token
app.post('/api/generate-image', (req, res) => {
  const { prompt } = req.body || {};
  if (!prompt) {
    res.status(400).json({ error: 'Prompt is required.' });
    return;
  }
  res.json({ success: true, imageUrl: imageFromPrompt(String(prompt))[0].url, prompt });
});

app.post('/api/generate-3d', (req, res) => {
  res.json({ success: true, model3D: model3dFromPrompt(String(req.body?.prompt || '')) });
});

// Voice: Claude has no audio endpoints — the UI's native Web Speech fallback handles both directions.
app.post('/api/tts', (_req, res) => {
  res.json({ success: true, audioBase64: null, useNativeVoice: true, message: 'Using native browser voice synthesis' });
});
app.post('/api/transcribe', (_req, res) => {
  res.status(501).json({ success: false, error: 'Server transcription is not available in v3. Use the browser microphone (Web Speech) input.' });
});

// ----------------------------------------------------
// MODEL CONTEXT PROTOCOL (MCP)
// ----------------------------------------------------
const mcpWorkspaceFiles: Record<string, { name: string; content: string; updatedAt: number }> = {
  'index.html': { name: 'index.html', content: '<!DOCTYPE html>\n<html><head><title>AIX Alpha MCP App</title></head><body><h1>Running via AIX MCP</h1></body></html>', updatedAt: Date.now() },
};
const mcpKvStore: Record<string, any> = { system_state: 'ACTIVE', engine_version: '3.0.0', model: MODEL_ID };

const SANDBOX_ENABLED = process.env.AIX_ENABLE_SANDBOX === '1';

const MCP_TOOLS_CATALOG = [
  {
    name: 'aix_quantum_reason',
    description: `Multi-path reasoning on ${MODEL_ID} using the AIX loop protocol (route → generate → verify → refine).`,
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'The analytical question or problem.' },
        depth: { type: 'string', enum: ['standard', 'deep', 'hyperdimensional'], default: 'standard', description: 'Maps to loop mode: eco / balanced / thorough.' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'search_live_web',
    description: 'One grounded web search via Claude (max 1 search per call) with cited URLs.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
  },
  {
    name: 'generate_web_app',
    description: 'Synthesize a complete single-file HTML app. Output is verified for unclosed tags/scripts and auto-continued if cut off.',
    inputSchema: {
      type: 'object',
      properties: { specification: { type: 'string' }, framework: { type: 'string', default: 'tailwind', enum: ['tailwind', 'vanilla', 'canvas', 'threejs'] } },
      required: ['specification'],
    },
  },
  {
    name: 'execute_sandbox_code',
    description: SANDBOX_ENABLED ? 'Run a short JavaScript snippet in a restricted VM context (1s timeout).' : 'DISABLED. Set AIX_ENABLE_SANDBOX=1 on the server to enable.',
    inputSchema: { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] },
  },
  {
    name: 'manage_workspace_file',
    description: 'Read, write, list or delete files in the in-memory MCP workspace.',
    inputSchema: {
      type: 'object',
      properties: { action: { type: 'string', enum: ['read', 'write', 'list', 'delete'] }, filename: { type: 'string' }, content: { type: 'string' } },
      required: ['action'],
    },
  },
  {
    name: 'store_memory_kv',
    description: 'Get/set/list/delete shared key-value memory records.',
    inputSchema: {
      type: 'object',
      properties: { operation: { type: 'string', enum: ['get', 'set', 'list', 'delete'] }, key: { type: 'string' }, value: {} },
      required: ['operation'],
    },
  },
];

function mcpAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = process.env.AIX_MCP_TOKEN;
  if (token && req.headers.authorization !== `Bearer ${token}`) {
    res.status(401).json({ jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Unauthorized: bearer token required (AIX_MCP_TOKEN).' } });
    return;
  }
  next();
}

app.get('/api/mcp', (_req, res) => {
  res.json({
    status: 'online',
    name: 'AIX Alpha v3 Model Context Protocol Server',
    version: '3.0.0',
    protocolVersion: '2024-11-05',
    transports: { http: '/api/mcp', sse: '/api/mcp/sse' },
    toolsCount: MCP_TOOLS_CATALOG.length,
    capabilities: ['tools', 'resources', 'prompts', 'logging'],
    authRequired: !!process.env.AIX_MCP_TOKEN,
  });
});

async function mcpAsk(prompt: string, opts: { personaId?: string; mode?: 'eco' | 'balanced' | 'thorough'; search?: boolean; sessionId: string }) {
  const r = await runChat(
    { sessionId: opts.sessionId, messages: [{ role: 'user', content: prompt }], personaId: opts.personaId, mode: opts.mode || 'eco', useSearchGrounding: !!opts.search, forceSearch: !!opts.search },
    transport,
  );
  const cites = r.grounding.sources.length ? '\n\nSources:\n' + r.grounding.sources.map((s) => `- ${s.title}: ${s.url}`).join('\n') : '';
  return r.text + cites;
}

app.post('/api/mcp', rateLimit, mcpAuth, async (req, res) => {
  const { id, method, params } = req.body || {};
  const responseId = id ?? null;
  try {
    switch (method) {
      case 'initialize':
        return res.json({
          jsonrpc: '2.0',
          id: responseId,
          result: {
            protocolVersion: '2024-11-05',
            serverInfo: { name: 'aix-alpha-v3-mcp', version: '3.0.0', vendor: 'AIX' },
            capabilities: { tools: { listChanged: true }, resources: { subscribe: true, listChanged: true }, prompts: { listChanged: true }, logging: {} },
          },
        });
      case 'notifications/initialized':
        return res.json({ jsonrpc: '2.0', id: responseId, result: { status: 'ready' } });
      case 'tools/list':
        return res.json({ jsonrpc: '2.0', id: responseId, result: { tools: MCP_TOOLS_CATALOG } });
      case 'tools/call': {
        const { name, arguments: args = {} } = params || {};
        let outputText = '';
        let isError = false;
        const sid = 'mcp';
        try {
          if (name === 'aix_quantum_reason') {
            const mode = args.depth === 'hyperdimensional' ? 'thorough' : args.depth === 'deep' ? 'balanced' : 'eco';
            outputText = await mcpAsk(String(args.prompt || ''), { personaId: 'aix-alpha-quantum-v1', mode, sessionId: sid });
          } else if (name === 'search_live_web') {
            outputText = await mcpAsk(`Search the web and answer with verified facts and citations: ${args.query}`, { search: true, sessionId: sid });
          } else if (name === 'generate_web_app') {
            outputText = await mcpAsk(`Build a complete, self-contained single-file HTML web app using ${args.framework || 'tailwind'}. Return only the HTML in one code block. Spec: ${args.specification}`, { mode: 'balanced', sessionId: sid });
          } else if (name === 'execute_sandbox_code') {
            if (!SANDBOX_ENABLED) {
              isError = true;
              outputText = 'Sandbox is disabled. Set AIX_ENABLE_SANDBOX=1 to enable.';
            } else {
              const logs: string[] = [];
              const ctx = vm.createContext({ console: { log: (...a: any[]) => logs.push(a.join(' ')), error: (...a: any[]) => logs.push('ERR: ' + a.join(' ')) } });
              let result: any;
              try {
                result = vm.runInContext(String(args.code || ''), ctx, { timeout: 1000 });
              } catch (e: any) {
                logs.push('Exception: ' + e.message);
              }
              outputText = JSON.stringify({ logs, result: result === undefined ? null : String(result) }, null, 2);
            }
          } else if (name === 'manage_workspace_file') {
            const action = args.action;
            if (action === 'list') outputText = JSON.stringify(Object.values(mcpWorkspaceFiles).map((f) => ({ name: f.name, updatedAt: f.updatedAt })), null, 2);
            else if (action === 'read') {
              const f = mcpWorkspaceFiles[args.filename];
              if (f) outputText = f.content;
              else (isError = true), (outputText = `File '${args.filename}' not found.`);
            } else if (action === 'write') {
              mcpWorkspaceFiles[args.filename] = { name: args.filename, content: args.content || '', updatedAt: Date.now() };
              outputText = `File '${args.filename}' written (${(args.content || '').length} bytes).`;
            } else if (action === 'delete') {
              delete mcpWorkspaceFiles[args.filename];
              outputText = `File '${args.filename}' deleted.`;
            } else (isError = true), (outputText = `Unknown file action: ${action}`);
          } else if (name === 'store_memory_kv') {
            const op = args.operation;
            if (op === 'get') outputText = JSON.stringify(mcpKvStore[args.key] ?? null);
            else if (op === 'set') (mcpKvStore[args.key] = args.value), (outputText = `Key '${args.key}' stored.`);
            else if (op === 'list') outputText = JSON.stringify(mcpKvStore, null, 2);
            else if (op === 'delete') (delete mcpKvStore[args.key]), (outputText = `Key '${args.key}' deleted.`);
            else (isError = true), (outputText = `Unknown KV operation: ${op}`);
          } else {
            isError = true;
            outputText = `Tool '${name}' is not recognized by AIX MCP server.`;
          }
        } catch (e: any) {
          isError = true;
          outputText = `Tool error: ${e?.message || e}`;
        }
        return res.json({ jsonrpc: '2.0', id: responseId, result: { content: [{ type: 'text', text: outputText }], isError } });
      }
      case 'resources/list':
        return res.json({
          jsonrpc: '2.0',
          id: responseId,
          result: {
            resources: [
              { uri: 'aix://system/architecture', name: 'AIX v3 Loop Architecture', mimeType: 'text/markdown', description: 'Route → generate → verify → refine protocol and budget guards.' },
              { uri: 'aix://workspace/manifest', name: 'Active Project Files Manifest', mimeType: 'application/json', description: 'JSON array of workspace files.' },
            ],
          },
        });
      case 'resources/read': {
        const uri = params?.uri;
        if (uri === 'aix://system/architecture')
          return res.json({ jsonrpc: '2.0', id: responseId, result: { contents: [{ uri, mimeType: 'text/markdown', text: `# AIX ALPHA V3\nModel: ${MODEL_ID}. Layers: reflex → router → context diet → response cache → generate → deterministic verify → continue/refine → budget ledger.` }] } });
        if (uri === 'aix://workspace/manifest')
          return res.json({ jsonrpc: '2.0', id: responseId, result: { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(Object.values(mcpWorkspaceFiles), null, 2) }] } });
        return res.status(404).json({ jsonrpc: '2.0', id: responseId, error: { code: -32602, message: `Resource not found: ${uri}` } });
      }
      case 'prompts/list':
        return res.json({
          jsonrpc: '2.0',
          id: responseId,
          result: {
            prompts: [
              { name: 'quantum_decision_matrix', description: 'Evaluate options under uncertainty with multi-path reasoning.', arguments: [{ name: 'problem', description: 'Problem or choice', required: true }] },
              { name: 'zero_trust_security_audit', description: 'Audit code or infrastructure with zero-trust assumptions.', arguments: [{ name: 'targetCode', description: 'Code to inspect', required: true }] },
            ],
          },
        });
      default:
        return res.status(404).json({ jsonrpc: '2.0', id: responseId, error: { code: -32601, message: `Method not found: ${method}` } });
    }
  } catch (err: any) {
    console.error('MCP RPC execution error:', err);
    return res.status(500).json({ jsonrpc: '2.0', id: responseId, error: { code: -32603, message: err.message || 'Internal MCP server error' } });
  }
});

app.get('/api/mcp/sse', mcpAuth, (req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.write(`event: endpoint\ndata: /api/mcp\n\n`);
  const heartbeat = setInterval(() => res.write(`event: ping\ndata: {"timestamp":${Date.now()}}\n\n`), 15000);
  req.on('close', () => clearInterval(heartbeat));
});

// The AIX Alpha app, served by the master node itself. The server's own address is injected so the
// app signs in and streams through this machine automatically (works on localhost and through a tunnel).
app.get(['/alpha', '/alpha/'], (req, res) => {
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol).split(',')[0];
  const origin = `${proto}://${req.headers['x-forwarded-host'] || req.headers.host}`;
  const html = fs.readFileSync(path.join(process.cwd(), 'public', 'alpha.html'), 'utf8').replace('<meta name="aix-backend" content="">', `<meta name="aix-backend" content="${origin}">`);
  res.type('html').send(html);
});

// ----------------------------------------------------
// VITE & STATIC FILES
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html'), (err) => { if (err) res.redirect('/alpha'); }));
  }
  app.listen(PORT, '0.0.0.0', () => {
    const b = readBudgets();
    console.log(`AIX Alpha v3 (Loop Engine · ${MODEL_ID}) on http://0.0.0.0:${PORT}`);
    console.log(transport ? (MOCK ? '  ⚠ MOCK transport (no API calls)' : '  ✓ ANTHROPIC_API_KEY loaded') : '  ✗ ANTHROPIC_API_KEY missing — chat will return a setup error');
    console.log(`  Caps: $${b.requestMaxUsd}/request · $${b.sessionMaxUsd}/chat · $${b.dailyMaxUsd}/day`);
  });
}

startServer();
