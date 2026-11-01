import { MODEL_ID } from './config';
import { SystemBlock } from './prompt';
import { Usage, emptyUsage, estTokens } from './tokens';

export interface ApiRequest {
  model: string;
  max_tokens: number;
  system: SystemBlock[];
  messages: Array<{ role: 'user' | 'assistant'; content: any }>;
  effort?: 'low' | 'medium' | 'high';
  tools?: any[];
}

export interface ApiResponse {
  text: string;
  stopReason: string | null;
  usage: Usage;
  sources: Array<{ title: string; url: string }>;
  searchQueries: string[];
  notes: string[];
}

export type Transport = (req: ApiRequest) => Promise<ApiResponse>;

const API_URL = 'https://api.anthropic.com/v1/messages';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Learned at runtime: if the API rejects an optional feature once, stop sending it.
const unsupported = { effort: false, tools: false };

export function parseResponse(json: any): ApiResponse {
  const usage = emptyUsage();
  const u = json?.usage || {};
  usage.input = u.input_tokens || 0;
  usage.output = u.output_tokens || 0;
  usage.cacheRead = u.cache_read_input_tokens || 0;
  usage.cacheWrite = u.cache_creation_input_tokens || 0;
  usage.webSearches = u.server_tool_use?.web_search_requests || 0;

  let text = '';
  const sources: ApiResponse['sources'] = [];
  const searchQueries: string[] = [];
  const seen = new Set<string>();
  const addSource = (url?: string, title?: string) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    sources.push({ url, title: title || url });
  };
  for (const b of json?.content || []) {
    if (b.type === 'text') {
      text += b.text || '';
      for (const c of b.citations || []) addSource(c.url, c.title);
    } else if (b.type === 'server_tool_use' && b.input?.query) {
      searchQueries.push(String(b.input.query));
    } else if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) {
      for (const r of b.content) addSource(r.url, r.title);
    }
  }
  return { text, stopReason: json?.stop_reason ?? null, usage, sources, searchQueries, notes: [] };
}

export function createAnthropicTransport(apiKey: string): Transport {
  return async function send(req: ApiRequest): Promise<ApiResponse> {
    const notes: string[] = [];
    let dropEffort = unsupported.effort;
    let dropTools = unsupported.tools;

    for (let attempt = 0; attempt < 4; attempt++) {
      const body: any = {
        model: req.model || MODEL_ID,
        max_tokens: req.max_tokens,
        system: req.system,
        messages: req.messages,
      };
      if (req.effort && !dropEffort) body.output_config = { effort: req.effort };
      if (req.tools?.length && !dropTools) body.tools = req.tools;

      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const parsed = parseResponse(await res.json());
        parsed.notes.push(...notes);
        return parsed;
      }

      const errText = await res.text();
      // Optional features: degrade gracefully instead of failing the user's request.
      if (res.status === 400) {
        if (!dropEffort && /output_config|effort/i.test(errText)) {
          unsupported.effort = dropEffort = true;
          notes.push('effort-param-unsupported');
          continue;
        }
        if (!dropTools && body.tools && /tool|web_search/i.test(errText)) {
          unsupported.tools = dropTools = true;
          notes.push('search-unavailable');
          continue;
        }
      }
      if ((res.status === 429 || res.status === 500 || res.status === 529) && attempt < 3) {
        const ra = Number(res.headers.get('retry-after'));
        await sleep(Math.min(4000, Number.isFinite(ra) && ra > 0 ? ra * 1000 : 500 * 2 ** attempt));
        continue;
      }
      let msg = errText.slice(0, 300);
      try {
        msg = JSON.parse(errText)?.error?.message || msg;
      } catch {
        /* keep raw */
      }
      throw new Error(`Anthropic API ${res.status}: ${msg}`);
    }
    throw new Error('Anthropic API: retries exhausted');
  };
}

/** Offline transport for local UI work and tests (AIX_MOCK=1). Clearly labelled; never used implicitly. */
export function createMockTransport(): Transport {
  return async (req) => {
    const lastUser = [...req.messages].reverse().find((m) => m.role === 'user');
    const prompt = typeof lastUser?.content === 'string' ? lastUser.content : JSON.stringify(lastUser?.content || '').slice(0, 400);
    const sysTokens = req.system.reduce((s, b) => s + estTokens(b.text), 0);
    const msgTokens = req.messages.reduce((s, m) => s + estTokens(typeof m.content === 'string' ? m.content : JSON.stringify(m.content)), 0);
    const text = `[MOCK · no API call made]\nEcho (${req.effort || 'default'} effort): ${prompt.slice(0, 160)}`;
    const usage = emptyUsage();
    const cached = sysTokens >= 512;
    usage.input = msgTokens + (cached ? 0 : sysTokens);
    usage.cacheRead = cached ? sysTokens : 0;
    usage.output = estTokens(text);
    return { text, stopReason: 'end_turn', usage, sources: [], searchQueries: [], notes: ['mock'] };
  };
}
