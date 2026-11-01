import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Copy,
  Check,
  Play,
  Terminal,
  Cpu,
  Globe,
  Code2,
  Database,
  Key,
  Shield,
  Layers,
  Plug,
  ExternalLink,
  RefreshCw,
  Sparkles,
  FileCode,
  CheckCircle2,
  Sliders,
  Send,
  Download,
  Share2,
  X,
} from 'lucide-react';

interface McpSystemPageProps {
  onBackToChat: () => void;
  onNavigateToAppStudio?: () => void;
}

interface McpTool {
  name: string;
  description: string;
  defaultArgs: Record<string, any>;
  category: 'quantum' | 'web' | 'code' | 'files' | 'memory';
}

const MCP_TOOLS: McpTool[] = [
  {
    name: 'aix_quantum_reason',
    description: 'Execute hyperdimensional multi-variable reasoning (Ψ, Ω, Φ, Δ, Λ, Θ) across quantum superposition state spaces.',
    category: 'quantum',
    defaultArgs: {
      prompt: 'Evaluate the optimal balance between high-frequency trading latency and multi-region consistency under network partition.',
      depth: 'deep',
      temperature: 0.5,
      thinkingLevel: 'HIGH',
    },
  },
  {
    name: 'search_live_web',
    description: 'Perform real-time Google search grounding across the live internet and return synthesized findings with verified URLs.',
    category: 'web',
    defaultArgs: {
      query: 'Quantum computing breakthroughs and commercially viable qubits 2026',
      maxResults: 5,
    },
  },
  {
    name: 'generate_web_app',
    description: 'Synthesize production-ready multi-file web applications, HTML/CSS/JS artifacts, and components.',
    category: 'code',
    defaultArgs: {
      specification: 'Build an interactive 3D WebGL particle sphere with sound wave reactive pulsing and a dark luxury aesthetic.',
      framework: 'tailwind',
    },
  },
  {
    name: 'execute_sandbox_code',
    description: 'Safely execute a JavaScript or TypeScript snippet in an isolated sandbox context and capture stdout and return values.',
    category: 'code',
    defaultArgs: {
      code: 'const matrix = [1, 2, 3, 4].map(x => Math.pow(x, 3));\nconsole.log("Computed cubic tensor:", matrix);\nreturn matrix.reduce((a, b) => a + b, 0);',
    },
  },
  {
    name: 'manage_workspace_file',
    description: 'Perform file operations (read, write, list, delete) on the connected project workspace for external IDEs.',
    category: 'files',
    defaultArgs: {
      action: 'write',
      filename: 'quantum_manifest.json',
      content: '{\n  "engine": "AIX Alpha v2.0",\n  "status": "synchronized",\n  "mcpTransport": "sse"\n}',
    },
  },
  {
    name: 'store_memory_kv',
    description: 'Store or retrieve contextual key-value memory records shared across AI agents and sessions.',
    category: 'memory',
    defaultArgs: {
      operation: 'set',
      key: 'agent_quantum_cluster_id',
      value: { cluster: 'us-east-qubit-01', coherence: 0.9992 },
    },
  },
];

interface PluginItem {
  id: string;
  name: string;
  category: string;
  description: string;
  enabled: boolean;
  version: string;
  toolsProvided: string[];
}

const DEFAULT_PLUGINS: PluginItem[] = [
  {
    id: 'plugin-github',
    name: 'GitHub Workspace Sync',
    category: 'Developer Tools',
    description: 'Bi-directional synchronization of repositories, branch commits, and pull request audits.',
    enabled: true,
    version: '1.4.2',
    toolsProvided: ['github_list_repos', 'github_create_pr', 'github_commit_files'],
  },
  {
    id: 'plugin-postgres',
    name: 'PostgreSQL & Vector DB',
    category: 'Database & Storage',
    description: 'Query relational tables and execute pgvector cosine similarity searches over embedding indexes.',
    enabled: true,
    version: '2.1.0',
    toolsProvided: ['db_query', 'db_vector_search', 'db_get_schema'],
  },
  {
    id: 'plugin-figma',
    name: 'Figma Design Token Bridge',
    category: 'Design Systems',
    description: 'Extract design tokens, color variables, typography styles, and component vectors into Tailwind classes.',
    enabled: false,
    version: '1.0.8',
    toolsProvided: ['figma_extract_tokens', 'figma_render_component'],
  },
  {
    id: 'plugin-slack',
    name: 'Slack & Webhook Gateway',
    category: 'Communication',
    description: 'Broadcast real-time deployment alerts, telemetry reports, and chat responses to Slack channels.',
    enabled: false,
    version: '1.2.0',
    toolsProvided: ['slack_post_message', 'slack_upload_snippet'],
  },
  {
    id: 'plugin-brave',
    name: 'Brave Search & Crawler',
    category: 'Search & Crawling',
    description: 'Deep web content extraction and independent crawler for real-time document parsing.',
    enabled: true,
    version: '1.1.5',
    toolsProvided: ['brave_web_search', 'brave_fetch_dom'],
  },
];

export const McpSystemPage: React.FC<McpSystemPageProps> = ({ onBackToChat, onNavigateToAppStudio }) => {
  const [activeTab, setActiveTab] = useState<'setup' | 'sandbox' | 'plugins' | 'security'>('setup');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Demo Popup States
  const [isDemoOpen, setIsDemoOpen] = useState(false);
  const [demoType, setDemoType] = useState<'api' | 'mcp' | 'webhook'>('api');
  const [demoStatus, setDemoStatus] = useState<'idle' | 'running' | 'success'>('idle');
  const [demoLogs, setDemoLogs] = useState<string[]>([]);

  const handleRunDemoSimulation = (type: 'api' | 'mcp' | 'webhook') => {
    setDemoType(type);
    setDemoStatus('running');
    setDemoLogs([]);

    const logSteps = {
      api: [
        '>> [TRANSPORT] Connecting to WebSocket ws://localhost:3000/api/v2/stream...',
        '>> [AUTH] Token handshake verified with bearer aix_live_sec_9948fae17b3c2009d.',
        '>> [BILLING] Checking host account quota balance (3.0 credits available).',
        '>> [EXECUTION] Requesting POST /api/chat with thinking level "HIGH".',
        '>> [CREDITS] Deducting 1.0 credit for quantum LLM inference...',
        '>> [MODEL] Routing to Claude Haiku 5.5 via the loop engine.',
        '>> [STREAM] Chunk received: "Evaluating quantum cluster nodes..."',
        '>> [STREAM] Chunk received: "Compiling semantic matrices with 100% coherence..."',
        '>> [SUCCESS] Response complete. Generated 450 tokens. Host balance: 2.0 credits.'
      ],
      mcp: [
        '>> [SSE] Exposing SSE connection stream on http://localhost:3000/api/mcp/sse...',
        '>> [TRANSPORT] Connected client: Claude Desktop App (Node client transport).',
        '>> [DISCOVERY] Client requesting list_tools capability...',
        '>> [SERVER] Exposing 6 active tools (aix_quantum_reason, search_live_web, ...).',
        '>> [INVOCATION] Client executing tool: "search_live_web"',
        '>> [ARGS] Arguments: {"query": "Bitcoin price parity in XRP", "maxResults": 3}',
        '>> [CREDITS] Deducting 1.0 credit from hosting account for live search query...',
        '>> [SUCCESS] Returned 3 organic results. Latency: 480ms.'
      ],
      webhook: [
        '>> [HTTP] Registered endpoint POST /api/webhooks/xrp-billing-events...',
        '>> [GATEWAY] Live web socket listener synchronized with XRPL ledger...',
        '>> [EVENT] XRP Transfer detected! TxHash: 0x992fa1b439e...',
        '>> [CREDITS] Refueling account balance with +50.0 prompt credits!',
        '>> [ALERT] Broadcasting telemetry payload to connected slack channels.',
        '>> [SUCCESS] Webhook event resolved with status 200 OK.'
      ]
    }[type];

    logSteps.forEach((log, index) => {
      setTimeout(() => {
        setDemoLogs((prev) => [...prev, log]);
        if (index === logSteps.length - 1) {
          setDemoStatus('success');
        }
      }, (index + 1) * 600);
    });
  };

  // Sandbox State
  const [selectedTool, setSelectedTool] = useState<McpTool>(MCP_TOOLS[0]);
  const [toolArgsJson, setToolArgsJson] = useState<string>(JSON.stringify(MCP_TOOLS[0].defaultArgs, null, 2));
  const [isExecutingTool, setIsExecutingTool] = useState(false);
  const [toolExecutionOutput, setToolExecutionOutput] = useState<string | null>(null);
  const [toolLatency, setToolLatency] = useState<number | null>(null);

  // Plugins State
  const [plugins, setPlugins] = useState<PluginItem[]>(DEFAULT_PLUGINS);

  // Security / API Key state
  const [apiKey, setApiKey] = useState<string>('aix_live_sec_9948fae17b3c2009d');
  const [keyCopied, setKeyCopied] = useState(false);

  // Update JSON args when switching tools
  const handleSelectTool = (tool: McpTool) => {
    setSelectedTool(tool);
    setToolArgsJson(JSON.stringify(tool.defaultArgs, null, 2));
    setToolExecutionOutput(null);
    setToolLatency(null);
  };

  const handleCopy = (text: string, keyId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyId);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Execute MCP Call against /api/mcp
  const handleExecuteMcpCall = async () => {
    setIsExecutingTool(true);
    setToolExecutionOutput(null);
    const startTime = performance.now();

    try {
      let parsedArgs = {};
      try {
        parsedArgs = JSON.parse(toolArgsJson);
      } catch (e: any) {
        setToolExecutionOutput(JSON.stringify({ error: 'Invalid JSON in parameters: ' + e.message }, null, 2));
        setIsExecutingTool(false);
        return;
      }

      const response = await fetch('/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: `req_${Date.now()}`,
          method: 'tools/call',
          params: {
            name: selectedTool.name,
            arguments: parsedArgs,
          },
        }),
      });

      const data = await response.json();
      const endTime = performance.now();
      setToolLatency(Math.round(endTime - startTime));
      setToolExecutionOutput(JSON.stringify(data, null, 2));
    } catch (err: any) {
      const endTime = performance.now();
      setToolLatency(Math.round(endTime - startTime));
      setToolExecutionOutput(JSON.stringify({ error: err?.message || 'Failed to call MCP tool' }, null, 2));
    } finally {
      setIsExecutingTool(false);
    }
  };

  const togglePlugin = (id: string) => {
    setPlugins((prev) =>
      prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p))
    );
  };

  const generateNewKey = () => {
    const rand = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    setApiKey(`aix_live_sec_${rand}`);
  };

  // Config snippets for external applications
  const claudeDesktopConfig = JSON.stringify(
    {
      mcpServers: {
        "aix-alpha-suite": {
          url: "http://localhost:3000/api/mcp/sse",
          transport: "sse",
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
        "aix-alpha-quantum": {
          url: "http://localhost:3000/api/mcp/sse",
          transport: "sse",
        },
      },
    },
    null,
    2
  );

  const pythonClientSnippet = `# AIX Alpha v2.0 MCP Client in Python
import asyncio
from mcp import ClientSession, StdioServerParameters
from mcp.client.sse import sse_client

async def main():
    headers = {"Authorization": "Bearer ${apiKey}"}
    async with sse_client("http://localhost:3000/api/mcp/sse", headers=headers) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            
            # List available AIX Alpha tools
            tools = await session.list_tools()
            print("Connected to AIX Alpha MCP Tools:", [t.name for t in tools.tools])
            
            # Execute quantum reasoning pass
            result = await session.call_tool(
                "aix_quantum_reason",
                arguments={"prompt": "Analyze architectural trade-offs in distributed event stores."}
            )
            print("Reasoning Result:\\n", result.content[0].text)

if __name__ == "__main__":
    asyncio.run(main())`;

  const nodeClientSnippet = `// AIX Alpha v2.0 MCP Client in TypeScript / Node
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

async function run() {
  const transport = new SSEClientTransport(
    new URL("http://localhost:3000/api/mcp/sse"),
    {
      eventSourceInit: {
        headers: { Authorization: "Bearer ${apiKey}" },
      },
    }
  );

  const client = new Client(
    { name: "remote-agent", version: "1.0.0" },
    { capabilities: {} }
  );

  await client.connect(transport);
  console.log("Connected to AIX Alpha MCP Server");

  // Call the live web search tool
  const searchResult = await client.callTool({
    name: "search_live_web",
    arguments: { query: "Latest AI benchmark breakthroughs" },
  });

  console.log("Output:", searchResult.content[0].text);
}

run().catch(console.error);`;

  const curlSnippet = `curl -X POST http://localhost:3000/api/mcp \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "tools/call",
    "params": {
      "name": "aix_quantum_reason",
      "arguments": {
        "prompt": "Evaluate optimal cache eviction strategy for low-latency neural inference."
      }
    }
  }'`;

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col font-sans select-none">
      {/* Top Header Command Bar */}
      <header className="h-16 border-b border-zinc-800 bg-zinc-950 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-xs font-mono text-zinc-300 transition-all glow-subtle active:scale-95"
            title="Return to Main Chat"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>RETURN TO CHAT</span>
          </button>

          <div className="h-5 w-[1px] bg-zinc-800 hidden sm:block" />

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-700 flex items-center justify-center text-white shadow-sm glow-subtle">
              <Plug className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold tracking-[-0.02em] text-white">
                  MCP & API <span className="text-zinc-400 font-normal">SYSTEM ENGINE</span>
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-zinc-900 text-zinc-300 border border-zinc-800">
                  SPEC 2024-11-05
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 font-mono hidden sm:block">
                EXPOSE AIX ALPHA V2.0 TO CURSOR, CLAUDE DESKTOP, WINDSURF & CUSTOM APIS
              </p>
            </div>
          </div>
        </div>

        {/* Server Status Pill */}
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-zinc-300">SSE & HTTP LIVE</span>
            <span className="text-zinc-600">//</span>
            <span>PORT 3000</span>
          </div>

          {onNavigateToAppStudio && (
            <button
              onClick={onNavigateToAppStudio}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-mono text-zinc-300 transition-all glow-subtle"
            >
              <Terminal className="w-3.5 h-3.5 text-white" />
              <span className="hidden sm:inline">APP STUDIO</span>
            </button>
          )}
        </div>
      </header>

      {/* Navigation Sub-Tabs */}
      <div className="border-b border-zinc-800 bg-zinc-950/80 px-4 sm:px-6 flex items-center justify-between py-2 overflow-x-auto text-xs font-mono">
        <div className="flex items-center gap-1 sm:gap-3">
          <button
            onClick={() => setActiveTab('setup')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-semibold transition-all glow-subtle ${
              activeTab === 'setup'
                ? 'bg-white text-black font-bold shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>SERVER & CONNECT</span>
          </button>

          <button
            onClick={() => setActiveTab('sandbox')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-semibold transition-all glow-subtle ${
              activeTab === 'sandbox'
                ? 'bg-white text-black font-bold shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            <span>TOOLS EXPLORER ({MCP_TOOLS.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('plugins')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-semibold transition-all glow-subtle ${
              activeTab === 'plugins'
                ? 'bg-white text-black font-bold shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>PLUGINS & INTEGRATIONS ({plugins.filter((p) => p.enabled).length})</span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-semibold transition-all glow-subtle ${
              activeTab === 'security'
                ? 'bg-white text-black font-bold shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>API TOKENS & HEADERS</span>
          </button>
        </div>

        <button
          onClick={() => {
            setIsDemoOpen(true);
            handleRunDemoSimulation('api');
          }}
          className="px-3.5 py-1.5 rounded-lg bg-purple-950 hover:bg-purple-900 text-purple-300 border border-purple-800/80 hover:border-purple-600 transition-all flex items-center gap-1.5 animate-pulse shrink-0 font-bold"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>RUN DEMO MODE</span>
        </button>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8 space-y-6">
        {/* ========================================================================= */}
        {/* TAB 1: SERVER & CONNECTION GUIDES */}
        {/* ========================================================================= */}
        {activeTab === 'setup' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Server Overview Banner */}
            <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 glow-card space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 mb-1">
                    <span className="w-2 h-2 rounded-full bg-white" />
                    <span>ACTIVE MCP PROTOCOL ENDPOINTS</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    Connect Any IDE or Agent to AIX Alpha v2.0
                  </h2>
                  <p className="text-xs sm:text-sm text-zinc-400 font-sans mt-1 max-w-2xl leading-relaxed">
                    AIX Alpha provides native Model Context Protocol (MCP) server endpoints allowing Claude Desktop, Cursor, Windsurf, LangChain, or custom programs to tap directly into AIX's quantum reasoning, web search grounding, and multi-file code sandbox.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="p-3 rounded-xl bg-black border border-zinc-800 font-mono text-xs">
                    <span className="text-[10px] text-zinc-500 block uppercase">HTTP JSON-RPC:</span>
                    <span className="text-zinc-200 font-semibold">POST /api/mcp</span>
                  </div>
                  <div className="p-3 rounded-xl bg-black border border-zinc-800 font-mono text-xs">
                    <span className="text-[10px] text-zinc-500 block uppercase">SSE STREAMING:</span>
                    <span className="text-zinc-200 font-semibold">GET /api/mcp/sse</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Connection Configurations Bento Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* 1. Claude Desktop Config */}
              <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-col justify-between glow-card">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-white" />
                      <h3 className="text-sm font-semibold text-white">Claude Desktop Configuration</h3>
                    </div>
                    <button
                      onClick={() => handleCopy(claudeDesktopConfig, 'claude')}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-[11px] font-mono text-zinc-300 border border-zinc-800 transition-colors"
                    >
                      {copiedKey === 'claude' ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'claude' ? 'COPIED' : 'COPY JSON'}</span>
                    </button>
                  </div>
                  <p className="text-xs text-zinc-400 mb-3">
                    Add this snippet into your <code className="text-zinc-300">claude_desktop_config.json</code> under <code className="text-zinc-300">mcpServers</code>.
                  </p>
                  <pre className="p-3.5 rounded-xl bg-black border border-zinc-800/80 font-mono text-[11px] text-zinc-300 overflow-x-auto leading-relaxed">
                    {claudeDesktopConfig}
                  </pre>
                </div>
                <p className="text-[10px] font-mono text-zinc-500 mt-3">
                  Config Path: ~/Library/Application Support/Claude/claude_desktop_config.json (macOS)
                </p>
              </div>

              {/* 2. Cursor / Windsurf MCP Config */}
              <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-col justify-between glow-card">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Code2 className="w-4 h-4 text-white" />
                      <h3 className="text-sm font-semibold text-white">Cursor / Windsurf MCP Config</h3>
                    </div>
                    <button
                      onClick={() => handleCopy(cursorMcpConfig, 'cursor')}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-[11px] font-mono text-zinc-300 border border-zinc-800 transition-colors"
                    >
                      {copiedKey === 'cursor' ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'cursor' ? 'COPIED' : 'COPY JSON'}</span>
                    </button>
                  </div>
                  <p className="text-xs text-zinc-400 mb-3">
                    Paste into Cursor Settings &rarr; Features &rarr; MCP &rarr; Add New MCP Server.
                  </p>
                  <pre className="p-3.5 rounded-xl bg-black border border-zinc-800/80 font-mono text-[11px] text-zinc-300 overflow-x-auto leading-relaxed">
                    {cursorMcpConfig}
                  </pre>
                </div>
                <p className="text-[10px] font-mono text-zinc-500 mt-3">
                  Enables Cursor Composer to call AIX Quantum tools in real time.
                </p>
              </div>

              {/* 3. Python SDK */}
              <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-col justify-between glow-card">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <FileCode className="w-4 h-4 text-white" />
                      <h3 className="text-sm font-semibold text-white">Python MCP Client</h3>
                    </div>
                    <button
                      onClick={() => handleCopy(pythonClientSnippet, 'py')}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-[11px] font-mono text-zinc-300 border border-zinc-800 transition-colors"
                    >
                      {copiedKey === 'py' ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'py' ? 'COPIED' : 'COPY CODE'}</span>
                    </button>
                  </div>
                  <p className="text-xs text-zinc-400 mb-3">
                    Run via official <code className="text-zinc-300">pip install mcp</code> Python package.
                  </p>
                  <pre className="p-3.5 rounded-xl bg-black border border-zinc-800/80 font-mono text-[11px] text-zinc-300 overflow-x-auto leading-relaxed max-h-56">
                    {pythonClientSnippet}
                  </pre>
                </div>
              </div>

              {/* 4. TypeScript / Node SDK & cURL */}
              <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-col justify-between glow-card">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-white" />
                      <h3 className="text-sm font-semibold text-white">cURL Direct Call</h3>
                    </div>
                    <button
                      onClick={() => handleCopy(curlSnippet, 'curl')}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-[11px] font-mono text-zinc-300 border border-zinc-800 transition-colors"
                    >
                      {copiedKey === 'curl' ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'curl' ? 'COPIED' : 'COPY CURL'}</span>
                    </button>
                  </div>
                  <p className="text-xs text-zinc-400 mb-3">
                    Standard JSON-RPC 2.0 HTTP POST request from command line or automated CI/CD script.
                  </p>
                  <pre className="p-3.5 rounded-xl bg-black border border-zinc-800/80 font-mono text-[11px] text-zinc-300 overflow-x-auto leading-relaxed max-h-56">
                    {curlSnippet}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: INTERACTIVE TOOLS EXPLORER & SANDBOX */}
        {/* ========================================================================= */}
        {activeTab === 'sandbox' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-200">
            {/* Left: Tools List (4 cols) */}
            <div className="lg:col-span-4 space-y-3">
              <div className="flex items-center justify-between text-xs font-mono text-zinc-400 px-1">
                <span>AVAILABLE MCP TOOLS</span>
                <span className="text-zinc-600">{MCP_TOOLS.length} REGISTERED</span>
              </div>

              <div className="space-y-2">
                {MCP_TOOLS.map((tool) => {
                  const isSelected = tool.name === selectedTool.name;
                  return (
                    <div
                      key={tool.name}
                      onClick={() => handleSelectTool(tool)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all glow-subtle ${
                        isSelected
                          ? 'bg-zinc-900 border-zinc-500 text-white shadow-lg'
                          : 'bg-zinc-950 border-zinc-800/80 text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5 font-mono text-xs">
                        <span className="font-bold text-white flex items-center gap-1.5">
                          {tool.category === 'quantum' && <Cpu className="w-3.5 h-3.5 text-white" />}
                          {tool.category === 'web' && <Globe className="w-3.5 h-3.5 text-white" />}
                          {tool.category === 'code' && <Code2 className="w-3.5 h-3.5 text-white" />}
                          {tool.category === 'files' && <FileCode className="w-3.5 h-3.5 text-white" />}
                          {tool.category === 'memory' && <Database className="w-3.5 h-3.5 text-white" />}
                          {tool.name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-black text-zinc-400 border border-zinc-800 uppercase">
                          {tool.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 font-sans leading-relaxed line-clamp-2">
                        {tool.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Live Interactive Test Runner (8 cols) */}
            <div className="lg:col-span-8 flex flex-col space-y-4">
              <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 flex-1 flex flex-col glow-card space-y-4">
                {/* Tool Header */}
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3 font-mono">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-white font-bold">
                        {selectedTool.name}
                      </span>
                      <span className="text-xs text-zinc-500">rpc: tools/call</span>
                    </div>
                    <p className="text-xs text-zinc-400 font-sans mt-1">
                      {selectedTool.description}
                    </p>
                  </div>

                  <button
                    onClick={handleExecuteMcpCall}
                    disabled={isExecutingTool}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 disabled:opacity-40 text-black font-bold font-mono text-xs transition-all active:scale-95 shadow-sm glow-subtle"
                  >
                    {isExecutingTool ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{isExecutingTool ? 'EXECUTING...' : 'RUN MCP TOOL'}</span>
                  </button>
                </div>

                {/* Parameters JSON Input */}
                <div className="space-y-1.5 font-mono text-xs">
                  <div className="flex items-center justify-between text-zinc-400">
                    <span>CALL ARGUMENTS (JSON)</span>
                    <button
                      onClick={() => setToolArgsJson(JSON.stringify(selectedTool.defaultArgs, null, 2))}
                      className="text-[10px] text-zinc-500 hover:text-zinc-300 underline"
                    >
                      Reset Defaults
                    </button>
                  </div>
                  <textarea
                    value={toolArgsJson}
                    onChange={(e) => setToolArgsJson(e.target.value)}
                    rows={6}
                    className="w-full p-3 bg-black border border-zinc-800 rounded-xl font-mono text-xs text-zinc-200 focus:outline-none focus:border-zinc-500 leading-relaxed glow-subtle"
                  />
                </div>

                {/* Response / Execution Output Area */}
                <div className="flex-1 flex flex-col space-y-1.5 font-mono text-xs">
                  <div className="flex items-center justify-between text-zinc-400">
                    <span className="flex items-center gap-2">
                      <span>JSON-RPC 2.0 RESPONSE</span>
                      {toolLatency !== null && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 border border-zinc-800">
                          {toolLatency}ms latency
                        </span>
                      )}
                    </span>
                    {toolExecutionOutput && (
                      <button
                        onClick={() => handleCopy(toolExecutionOutput, 'output')}
                        className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-white"
                      >
                        {copiedKey === 'output' ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedKey === 'output' ? 'COPIED' : 'COPY OUTPUT'}</span>
                      </button>
                    )}
                  </div>

                  <div className="flex-1 min-h-[220px] max-h-[360px] p-3.5 bg-black border border-zinc-800 rounded-xl overflow-y-auto font-mono text-xs text-zinc-300 leading-relaxed">
                    {toolExecutionOutput ? (
                      <pre className="whitespace-pre-wrap">{toolExecutionOutput}</pre>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-2 py-12">
                        <Terminal className="w-6 h-6 text-zinc-700" />
                        <span className="text-[11px]">Click "RUN MCP TOOL" above to execute real-time call</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: PLUGINS & EXTERNAL INTEGRATIONS */}
        {/* ========================================================================= */}
        {activeTab === 'plugins' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 rounded-2xl bg-zinc-950 border border-zinc-800 glow-card">
              <div>
                <h3 className="text-base font-bold text-white">AIX Alpha Plugins & Connectors</h3>
                <p className="text-xs text-zinc-400 font-sans mt-0.5">
                  Expand AIX Alpha's tool graph with external services, databases, code hosts, and messaging webhooks.
                </p>
              </div>

              <div className="flex items-center gap-2 font-mono text-xs text-zinc-400">
                <span className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800">
                  {plugins.filter((p) => p.enabled).length} ACTIVE PLUGINS
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {plugins.map((plugin) => (
                <div
                  key={plugin.id}
                  className={`p-5 rounded-2xl border flex flex-col justify-between transition-all glow-card ${
                    plugin.enabled ? 'bg-zinc-950 border-zinc-700' : 'bg-black/60 border-zinc-900 opacity-70'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800 uppercase">
                        {plugin.category}
                      </span>
                      <button
                        onClick={() => togglePlugin(plugin.id)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold transition-colors ${
                          plugin.enabled
                            ? 'bg-white text-black'
                            : 'bg-zinc-900 text-zinc-500 border border-zinc-800 hover:text-white'
                        }`}
                      >
                        {plugin.enabled ? 'ENABLED' : 'DISABLED'}
                      </button>
                    </div>

                    <h4 className="text-sm font-bold text-white mb-1 tracking-tight">{plugin.name}</h4>
                    <p className="text-xs text-zinc-400 font-sans leading-relaxed mb-3">
                      {plugin.description}
                    </p>
                  </div>

                  <div className="border-t border-zinc-900 pt-3 space-y-1.5 font-mono text-[10px]">
                    <span className="text-zinc-500 block uppercase">EXPOSED MCP TOOLS:</span>
                    <div className="flex flex-wrap gap-1">
                      {plugin.toolsProvided.map((t) => (
                        <span key={t} className="px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-300 border border-zinc-800">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: API TOKENS & SECURITY */}
        {/* ========================================================================= */}
        {activeTab === 'security' && (
          <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-200">
            <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 glow-card space-y-5">
              <div>
                <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 mb-1">
                  <Shield className="w-3.5 h-3.5 text-white" />
                  <span>AUTHORIZATION & ACCESS TOKENS</span>
                </div>
                <h3 className="text-lg font-bold text-white tracking-tight">
                  AIX Alpha API Key & Headers
                </h3>
                <p className="text-xs text-zinc-400 font-sans mt-1 leading-relaxed">
                  Use this secret bearer token to authenticate external tools (Cursor, Claude Desktop, Python scripts, cURL) connecting to the AIX Alpha MCP server.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-black border border-zinc-800 space-y-3 font-mono">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>ACTIVE SECRET API KEY</span>
                  <button onClick={generateNewKey} className="text-[11px] text-zinc-400 hover:text-white underline">
                    Generate New Key
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={apiKey}
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 font-mono focus:outline-none"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(apiKey);
                      setKeyCopied(true);
                      setTimeout(() => setKeyCopied(false), 2000);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-zinc-200 text-black font-bold text-xs rounded-lg transition-all active:scale-95"
                  >
                    {keyCopied ? <Check className="w-3.5 h-3.5 text-black" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{keyCopied ? 'COPIED' : 'COPY'}</span>
                  </button>
                </div>
              </div>

              {/* Authorization Header Preview */}
              <div className="space-y-1.5 font-mono text-xs">
                <span className="text-zinc-400">HTTP REQUEST HEADER:</span>
                <pre className="p-3 bg-black border border-zinc-800 rounded-xl text-zinc-300 overflow-x-auto">
                  Authorization: Bearer {apiKey}
                </pre>
              </div>

              {/* Scopes Overview */}
              <div className="border-t border-zinc-800/80 pt-4 space-y-2 font-mono text-xs">
                <span className="text-zinc-400 block uppercase">PERMITTED MCP CAPABILITIES:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="flex items-center gap-2 text-zinc-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                    <span>tools:call (Quantum, Web, Code, File, KV)</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                    <span>resources:read (Architectural specs, manifests)</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                    <span>prompts:get (Quantum decision matrices)</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                    <span>sse:stream (Real-time token and event streams)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* INTERACTIVE LIVE API & MCP DEMO MODAL POPUP */}
      {/* ========================================================================= */}
      {isDemoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 font-mono">
          <div className="w-full max-w-xl bg-zinc-950 border border-purple-900/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/40">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-950 border border-purple-800/80 flex items-center justify-center text-purple-300">
                  <Sparkles className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white tracking-wider uppercase">Live API & MCP Demo Engine</h3>
                  <p className="text-[10px] text-zinc-500 font-mono">SIMULATED HANDSHAKES & CREDIT DEDUCTIONS</p>
                </div>
              </div>
              <button 
                onClick={() => setIsDemoOpen(false)}
                className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-lg border border-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-5 space-y-4">
              <div className="text-[11px] text-zinc-400 leading-relaxed text-left">
                Test and debug the backend API & MCP endpoints directly in this sandbox interface. 
                Running a simulator will execute realistic, time-delayed token exchange flows, complete with credit allocation checks and routing operations.
              </div>

              {/* Selector Tabs */}
              <div className="grid grid-cols-3 gap-2 p-1 bg-zinc-950 border border-zinc-900 rounded-xl">
                <button
                  onClick={() => handleRunDemoSimulation('api')}
                  className={`py-2 rounded-lg text-[10px] font-bold text-center transition-all ${
                    demoType === 'api' ? 'bg-purple-950 text-purple-300 border border-purple-800/80' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  CHATBOT API
                </button>
                <button
                  onClick={() => handleRunDemoSimulation('mcp')}
                  className={`py-2 rounded-lg text-[10px] font-bold text-center transition-all ${
                    demoType === 'mcp' ? 'bg-purple-950 text-purple-300 border border-purple-800/80' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  MCP ROUTER
                </button>
                <button
                  onClick={() => handleRunDemoSimulation('webhook')}
                  className={`py-2 rounded-lg text-[10px] font-bold text-center transition-all ${
                    demoType === 'webhook' ? 'bg-purple-950 text-purple-300 border border-purple-800/80' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  XRP WEBHOOK
                </button>
              </div>

              {/* Console Logs Display */}
              <div className="p-4 rounded-xl bg-black border border-zinc-900 h-56 flex flex-col justify-between overflow-hidden shadow-inner">
                <div className="overflow-y-auto space-y-1.5 flex-1 pr-2 scrollbar-thin text-left">
                  {demoLogs.length === 0 ? (
                    <div className="text-[10px] text-zinc-600 italic">Initializing console matrix... Click a tab above to execute.</div>
                  ) : (
                    demoLogs.map((log, idx) => {
                      let color = 'text-zinc-400';
                      if (log.includes('[SUCCESS]')) color = 'text-emerald-400 font-bold';
                      else if (log.includes('[CREDITS]')) color = 'text-purple-400 font-bold';
                      else if (log.includes('[EVENT]')) color = 'text-yellow-400';
                      else if (log.includes('[AUTH]')) color = 'text-blue-400';
                      return (
                        <div key={idx} className={`text-[10px] leading-relaxed break-all ${color}`}>
                          {log}
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-zinc-900 pt-2 text-[9px] text-zinc-500">
                  <span className="flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${demoStatus === 'running' ? 'bg-purple-400 animate-pulse' : demoStatus === 'success' ? 'bg-emerald-400' : 'bg-zinc-700'}`} />
                    STATUS: {demoStatus.toUpperCase()}
                  </span>
                  <span>TRANSPORT: SSE/HTTP/WSS</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 border-t border-zinc-900 bg-zinc-950 flex items-center justify-between">
              <span className="text-[9px] text-zinc-600">AIX ALPHA PROTOCOL SPEC V2.0</span>
              <button
                onClick={() => handleRunDemoSimulation(demoType)}
                className="px-4 py-1.5 rounded-lg bg-white hover:bg-zinc-200 text-black font-bold text-[10px] transition-all active:scale-95 flex items-center gap-1.5 shadow"
              >
                <RefreshCw className={`w-3 h-3 ${demoStatus === 'running' ? 'animate-spin' : ''}`} />
                <span>RE-RUN TEST</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
