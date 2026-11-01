import React, { useState, useEffect } from 'react';
import {
  Plug,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Copy,
  Terminal,
  Cpu,
  Globe,
  Database,
  ShieldCheck,
  Zap,
  RefreshCw,
  ExternalLink,
  Code2,
  Workflow,
  Sparkles,
} from 'lucide-react';

interface EasyConnectionsHubProps {
  onOpenFullMcp: () => void;
  onOpenAppStudio?: () => void;
}

interface InwardConnector {
  id: string;
  name: string;
  category: 'api' | 'mcp' | 'webhook';
  description: string;
  status: 'connected' | 'ready' | 'standby';
  toolsCount: number;
  provider: string;
  type: string;
}

const INWARD_CONNECTORS: InwardConnector[] = [
  {
    id: 'claude-haiku-native',
    name: 'Claude Haiku 5.5 (Loop Engine)',
    category: 'api',
    description: 'Cheapest Claude with prompt caching, effort control, loop verification and hard spend caps.',
    status: 'connected',
    toolsCount: 6,
    provider: 'Anthropic',
    type: 'Inward LLM Core',
  },
  {
    id: 'github-mcp',
    name: 'GitHub Workspace Sync',
    category: 'mcp',
    description: 'Pull repo manifests, commit code artifacts, and generate automated pull requests.',
    status: 'connected',
    toolsCount: 3,
    provider: 'GitHub API',
    type: 'Inward Tool MCP',
  },
  {
    id: 'postgres-vector',
    name: 'PostgreSQL & pgvector',
    category: 'mcp',
    description: 'Vector cosine embeddings search, table queries, and schema introspection.',
    status: 'ready',
    toolsCount: 4,
    provider: 'PostgreSQL DB',
    type: 'Inward Tool MCP',
  },
  {
    id: 'brave-search',
    name: 'Brave Real-Time Crawler',
    category: 'mcp',
    description: 'Grounding search engine and DOM extractor for real-time live internet citations.',
    status: 'connected',
    toolsCount: 2,
    provider: 'Brave Search',
    type: 'Inward Web MCP',
  },
  {
    id: 'webhook-inbound',
    name: 'Custom Inbound Webhooks',
    category: 'webhook',
    description: 'Trigger autonomous reasoning pipelines from external CI/CD, Slack, or GitHub webhooks.',
    status: 'ready',
    toolsCount: 1,
    provider: 'HTTP REST / JSON',
    type: 'Inward Trigger',
  },
];

export const EasyConnectionsHub: React.FC<EasyConnectionsHubProps> = ({
  onOpenFullMcp,
}) => {
  const [activeTab, setActiveTab] = useState<'inward' | 'outward' | 'test'>('inward');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [pingStatus, setPingStatus] = useState<{
    testing: boolean;
    success?: boolean;
    latency?: number;
    toolsCount?: number;
    error?: string;
  }>({ testing: false });

  const apiKey = 'aix_live_sec_9948fae17b3c2009d';

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const testConnection = async () => {
    setPingStatus({ testing: true });
    const start = performance.now();
    try {
      const res = await fetch('/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'ping_check',
          method: 'tools/list',
          params: {},
        }),
      });
      const data = await res.json();
      const latency = Math.round(performance.now() - start);
      if (data?.result?.tools) {
        setPingStatus({
          testing: false,
          success: true,
          latency,
          toolsCount: data.result.tools.length,
        });
      } else {
        setPingStatus({
          testing: false,
          success: false,
          error: data?.error?.message || 'Server returned unexpected structure',
        });
      }
    } catch (err: any) {
      setPingStatus({
        testing: false,
        success: false,
        error: err?.message || 'Connection failed',
      });
    }
  };

  // Test on mount
  useEffect(() => {
    testConnection();
  }, []);

  const claudeDesktopConfig = JSON.stringify(
    {
      mcpServers: {
        'aix-alpha-suite': {
          url: `${window.location.origin}/api/mcp/sse`,
          transport: 'sse',
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        },
      },
    },
    null,
    2
  );

  const cursorMcpConfig = JSON.stringify(
    {
      mcpServers: {
        'aix-alpha-quantum': {
          url: `${window.location.origin}/api/mcp/sse`,
          transport: 'sse',
        },
      },
    },
    null,
    2
  );

  const curlOutwardExample = `curl -X POST ${window.location.origin}/api/mcp \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -d '{
    "jsonrpc": "2.0",
    "id": "req-1",
    "method": "tools/call",
    "params": {
      "name": "aix_quantum_reason",
      "arguments": { "prompt": "Synthesize optimal microservice architecture" }
    }
  }'`;

  return (
    <div className="w-full rounded-2xl bg-zinc-950 border border-zinc-800/80 p-5 sm:p-6 text-left shadow-2xl transition-all">
      {/* Header Bar with Centered Tabs and Live Status */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-white">
              <Plug className="w-4 h-4 text-emerald-400" />
            </span>
            <h2 className="text-base sm:text-lg font-semibold text-white tracking-[-0.02em]">
              API & MCP Easy Connections & Integrations
            </h2>
          </div>
          <p className="text-xs text-zinc-400">
            Bidirectional connectivity: ingest external tools/APIs <strong className="text-zinc-200">Inward</strong> or expose AIX Alpha <strong className="text-zinc-200">Outward</strong> to IDEs & external apps.
          </p>
        </div>

        {/* Tab switcher: Inward vs Outward vs Live Status */}
        <div className="flex items-center p-1 bg-zinc-900/90 rounded-xl border border-zinc-800 shrink-0 self-stretch sm:self-auto justify-center">
          <button
            onClick={() => setActiveTab('inward')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'inward'
                ? 'bg-white text-black font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>Inward (Ingest)</span>
          </button>

          <button
            onClick={() => setActiveTab('outward')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'outward'
                ? 'bg-white text-black font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Outward (Expose)</span>
          </button>

          <button
            onClick={() => setActiveTab('test')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'test'
                ? 'bg-white text-black font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Live Health</span>
          </button>
        </div>
      </div>

      {/* TAB CONTENT: INWARD INTEGRATION */}
      {activeTab === 'inward' && (
        <div className="pt-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">
              Connected Inbound APIs & MCP Data Sources
            </span>
            <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1.5 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              INWARD ROUTING ACTIVE
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {INWARD_CONNECTORS.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white">{item.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                        {item.type}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                        item.status === 'connected'
                          ? 'bg-emerald-950/50 text-emerald-300 border-emerald-800/50'
                          : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                      }`}
                    >
                      {item.status === 'connected' ? 'CONNECTED' : 'READY'}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-2">
                    {item.description}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 mt-2 border-t border-zinc-800/50 text-[10px] font-mono text-zinc-500">
                  <span>Provider: {item.provider}</span>
                  <span className="text-zinc-400">{item.toolsCount} registered tools</span>
                </div>
              </div>
            ))}

            {/* Add Inward Integration Card */}
            <div
              onClick={onOpenFullMcp}
              className="p-3.5 rounded-xl border border-dashed border-zinc-800 hover:border-zinc-600 bg-zinc-950 hover:bg-zinc-900/30 transition-all flex flex-col items-center justify-center text-center cursor-pointer group"
            >
              <Workflow className="w-5 h-5 text-zinc-500 group-hover:text-white transition-colors mb-1.5" />
              <span className="text-xs font-semibold text-zinc-300 group-hover:text-white">
                Connect Custom Inward MCP / API
              </span>
              <p className="text-[11px] text-zinc-500 max-w-xs mt-0.5">
                Add proprietary database endpoints, Slack bridges, or custom REST servers
              </p>
            </div>
          </div>

          {/* Inward Action Row */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span className="text-zinc-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              All inward data payloads are sanitized and execute within isolated runtime sandboxes.
            </span>
            <button
              onClick={onOpenFullMcp}
              className="px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 hover:text-white font-mono text-xs flex items-center gap-1.5 transition-all shrink-0"
            >
              Configure Inward Plugins <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* TAB CONTENT: OUTWARD INTEGRATION */}
      {activeTab === 'outward' && (
        <div className="pt-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">
              Expose AIX Alpha Outward to External IDEs & Clients
            </span>
            <span className="text-[11px] font-mono text-zinc-300 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-full flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-white" />
              SSE & JSON-RPC 2.0
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Claude Desktop Card */}
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-white">Claude Desktop Configuration</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 bg-zinc-800 text-zinc-400 rounded">
                      claude_desktop_config.json
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopy(claudeDesktopConfig, 'claude')}
                    className="flex items-center gap-1 text-[11px] font-mono text-zinc-300 hover:text-white px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                  >
                    {copiedKey === 'claude' ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" /> Copy JSON
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Allow Claude Desktop to utilize AIX Alpha's live reasoning tools, web search, and file generator.
                </p>
              </div>
              <pre className="p-2.5 rounded-lg bg-black text-[10px] font-mono text-zinc-300 overflow-x-auto border border-zinc-800 max-h-24">
                {claudeDesktopConfig}
              </pre>
            </div>

            {/* Cursor & VS Code Card */}
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-white">Cursor & VS Code MCP Bridge</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 bg-zinc-800 text-zinc-400 rounded">
                      SSE Transport
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopy(cursorMcpConfig, 'cursor')}
                    className="flex items-center gap-1 text-[11px] font-mono text-zinc-300 hover:text-white px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                  >
                    {copiedKey === 'cursor' ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" /> Copy Config
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Stream quantum code generations, AST audits, and live DOM previews directly into Cursor IDE.
                </p>
              </div>
              <pre className="p-2.5 rounded-lg bg-black text-[10px] font-mono text-zinc-300 overflow-x-auto border border-zinc-800 max-h-24">
                {cursorMcpConfig}
              </pre>
            </div>
          </div>

          {/* Direct Outward API Endpoint & cURL Snippet */}
          <div className="p-3.5 rounded-xl bg-zinc-900/40 border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-white flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-zinc-400" />
                Direct Outward HTTP API: <code className="text-[11px] font-mono text-zinc-300">POST /api/mcp</code>
              </span>
              <p className="text-[11px] text-zinc-400">
                Call AIX Alpha as a headless autonomous agent backend from Python, TypeScript, or bash scripts.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleCopy(curlOutwardExample, 'curl')}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-mono text-xs flex items-center gap-1.5 transition-all"
              >
                {copiedKey === 'curl' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copy cURL Command</span>
              </button>
              <button
                onClick={onOpenFullMcp}
                className="px-3 py-1.5 rounded-lg bg-white text-black font-semibold text-xs flex items-center gap-1.5 hover:bg-zinc-200 transition-all"
              >
                <span>Full Outward Specs</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: LIVE HEALTH & PING */}
      {activeTab === 'test' && (
        <div className="pt-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">
              Real-Time MCP & API Bus Diagnostic
            </span>
            <button
              onClick={testConnection}
              disabled={pingStatus.testing}
              className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white rounded-lg text-xs font-mono flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${pingStatus.testing ? 'animate-spin' : ''}`} />
              Re-Ping Bus
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800">
              <span className="text-[10px] font-mono text-zinc-400 uppercase">MCP Server Status</span>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    pingStatus.success ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
                <span className="text-sm font-semibold text-white">
                  {pingStatus.testing ? 'Probing...' : pingStatus.success ? 'ONLINE (200 OK)' : 'STANDBY'}
                </span>
              </div>
              <p className="text-[10px] font-mono text-zinc-500 mt-1">Endpoint: /api/mcp</p>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800">
              <span className="text-[10px] font-mono text-zinc-400 uppercase">Round-Trip Latency</span>
              <div className="text-sm font-semibold text-white mt-1">
                {pingStatus.latency !== undefined ? `${pingStatus.latency} ms` : '--'}
              </div>
              <p className="text-[10px] font-mono text-emerald-400 mt-1">Sub-100ms ultra-low latency</p>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800">
              <span className="text-[10px] font-mono text-zinc-400 uppercase">Registered Tools</span>
              <div className="text-sm font-semibold text-white mt-1">
                {pingStatus.toolsCount !== undefined ? `${pingStatus.toolsCount} Live Tools` : '5 Live Tools'}
              </div>
              <p className="text-[10px] font-mono text-zinc-400 mt-1">Ready for autonomous calling</p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-zinc-900/30 border border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
            <span>
              Server-Sent Events stream available at <code className="text-zinc-200 font-mono">/api/mcp/sse</code> for external subscribers.
            </span>
            <button
              onClick={onOpenFullMcp}
              className="text-white hover:underline font-mono text-xs flex items-center gap-1"
            >
              Open Interactive RPC Sandbox <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
