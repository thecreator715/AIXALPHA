import React, { useState, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import {
  ArrowLeft,
  Play,
  Code,
  Copy,
  Check,
  Plus,
  Trash2,
  Download,
  Folder,
  Sparkles,
  RefreshCw,
  Terminal,
  ExternalLink,
  Laptop,
  Smartphone,
  Tablet,
  FileCode,
  Send,
  Upload,
  Layers,
  Sliders,
  FileText,
  Boxes,
  Eye,
  Settings,
  ChevronDown,
  Cpu,
  Zap,
  MessageSquare,
  Maximize2,
  Minimize2,
  Columns,
  CheckCircle2,
  Save,
  RotateCcw,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Wand2,
  Scissors,
  CheckSquare,
  Link2,
} from 'lucide-react';
import { ChatSession, ChatMessage, Persona, Attachment, ExecutionStep } from '../types';
import { ChatMessageItem } from './ChatMessageItem';

export interface AppFile {
  name: string;
  content: string;
  language: string;
}

export interface AppProject {
  id: string;
  title: string;
  description: string;
  files: AppFile[];
}

const DEFAULT_PROJECT_PRESETS: AppProject[] = [
  {
    id: 'preset_multipage',
    title: 'Multi-Page Web & TSX App',
    description: 'Linked multi-page application with navigation router, numbers.html sub-page, and interactive React TSX component',
    files: [
      {
        name: 'index.html',
        language: 'html',
        content: `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Multi-Page App Hub</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="styles.css" />
</head>
<body class="bg-black text-zinc-100 font-sans min-h-screen selection:bg-zinc-800">
  <!-- Top Global Navigation Bar -->
  <header class="border-b border-zinc-800 bg-zinc-950/90 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-50">
    <div class="flex items-center gap-3">
      <div class="w-8 h-8 rounded-xl bg-white text-black font-bold flex items-center justify-center text-sm shadow">
        ⌘
      </div>
      <div>
        <span class="font-bold text-sm text-white tracking-tight">Quantum App Matrix</span>
        <span class="text-[10px] font-mono text-zinc-400 block">Session Multi-File Router</span>
      </div>
    </div>
    <nav class="flex items-center gap-2">
      <a href="index.html" class="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs font-mono text-white font-bold transition-all">
        HOME (index.html)
      </a>
      <a href="numbers.html" class="px-3 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-mono text-zinc-300 hover:text-white transition-all flex items-center gap-1">
        <span>NUMBERS</span>
        <span class="text-[10px] text-zinc-500">.html</span>
      </a>
      <a href="dashboard.tsx" class="px-3 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-mono text-zinc-300 hover:text-white transition-all flex items-center gap-1">
        <span>DASHBOARD</span>
        <span class="text-[10px] text-blue-400">.tsx</span>
      </a>
    </nav>
  </header>

  <!-- Hero & Router Showcase -->
  <main class="max-w-4xl mx-auto px-6 py-12 space-y-8">
    <div class="p-8 rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl space-y-6">
      <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-mono text-emerald-400">
        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <span>SESSION MULTI-PAGE LINKING VERIFIED</span>
      </div>

      <div class="space-y-3">
        <h1 class="text-3xl sm:text-5xl font-semibold tracking-tight text-white">
          Seamless In-Session <span class="text-zinc-400">Page Navigation</span>
        </h1>
        <p class="text-sm text-zinc-400 font-sans leading-relaxed">
          Click any link below or in the navigation bar to navigate between <code class="text-white bg-zinc-900 px-1.5 py-0.5 rounded font-mono">numbers.html</code>, <code class="text-white bg-zinc-900 px-1.5 py-0.5 rounded font-mono">dashboard.tsx</code>, and your project files directly inside the sandbox viewport.
        </p>
      </div>

      <!-- Quick Page Links Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
        <a href="numbers.html" class="p-5 rounded-2xl bg-black border border-zinc-800 hover:border-zinc-500 transition-all group flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="font-mono text-xs font-bold text-white group-hover:text-emerald-400">numbers.html</span>
              <span class="text-[10px] px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 font-mono">HTML + JS</span>
            </div>
            <p class="text-xs text-zinc-400">Interactive quantum calculator and live numeric matrix simulator.</p>
          </div>
          <div class="text-xs font-mono text-zinc-300 mt-4 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
            <span>Open numbers.html</span> &rarr;
          </div>
        </a>

        <a href="dashboard.tsx" class="p-5 rounded-2xl bg-black border border-zinc-800 hover:border-zinc-500 transition-all group flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="font-mono text-xs font-bold text-white group-hover:text-blue-400">dashboard.tsx</span>
              <span class="text-[10px] px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-900 font-mono">React TSX</span>
            </div>
            <p class="text-xs text-zinc-400">Compiled React component with stateful widgets and live metrics counter.</p>
          </div>
          <div class="text-xs font-mono text-zinc-300 mt-4 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
            <span>Open dashboard.tsx</span> &rarr;
          </div>
        </a>
      </div>
    </div>
  </main>

  <script src="app.js"></script>
</body>
</html>`,
      },
      {
        name: 'numbers.html',
        language: 'html',
        content: `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Numbers Calculator</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="styles.css" />
</head>
<body class="bg-black text-zinc-100 font-sans min-h-screen p-6 max-w-4xl mx-auto space-y-8">
  <!-- Nav header back -->
  <header class="flex items-center justify-between border-b border-zinc-800 pb-4">
    <a href="index.html" class="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-mono text-zinc-200 flex items-center gap-2 transition-colors">
      <span>&larr; BACK TO INDEX.HTML</span>
    </a>
    <div class="text-xs font-mono text-zinc-400">
      PATH: <span class="text-white font-bold">/numbers.html</span>
    </div>
  </header>

  <!-- Number Generator / Calculator -->
  <div class="p-8 rounded-3xl bg-zinc-950 border border-zinc-800 space-y-6">
    <div>
      <h1 class="text-2xl sm:text-3xl font-bold text-white">Quantum Number Matrix</h1>
      <p class="text-xs text-zinc-400 font-mono mt-1">Live numeric stream and deterministic entropy calculator</p>
    </div>

    <!-- Live Counter Widget -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div class="p-4 rounded-xl bg-black border border-zinc-800">
        <span class="text-[10px] font-mono text-zinc-500 uppercase">PRIME ACCUMULATOR</span>
        <div id="prime-val" class="text-3xl font-bold text-white font-mono mt-1">7919</div>
      </div>
      <div class="p-4 rounded-xl bg-black border border-zinc-800">
        <span class="text-[10px] font-mono text-zinc-500 uppercase">VECTOR HASH</span>
        <div id="hash-val" class="text-3xl font-bold text-emerald-400 font-mono mt-1">0xFA71</div>
      </div>
      <div class="p-4 rounded-xl bg-black border border-zinc-800">
        <span class="text-[10px] font-mono text-zinc-500 uppercase">SEED CYCLES</span>
        <div id="cycles-val" class="text-3xl font-bold text-zinc-300 font-mono mt-1">42</div>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-3 pt-2">
      <button onclick="generateNextNumbers()" class="px-5 py-2.5 bg-white text-black font-bold text-xs rounded-xl hover:bg-zinc-200 transition-all active:scale-95 shadow">
        ⚡ GENERATE RANDOM NUMBERS
      </button>
      <a href="dashboard.tsx" class="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-mono text-zinc-200 rounded-xl transition-colors">
        GO TO DASHBOARD.TSX &rarr;
      </a>
    </div>
  </div>

  <script>
    function generateNextNumbers() {
      const prime = Math.floor(Math.random() * 9000 + 1000);
      const hash = "0x" + Math.floor(Math.random() * 0xFFFF).toString(16).toUpperCase();
      const cycles = Math.floor(Math.random() * 100 + 1);
      document.getElementById('prime-val').innerText = prime;
      document.getElementById('hash-val').innerText = hash;
      document.getElementById('cycles-val').innerText = cycles;
    }
  </script>
</body>
</html>`,
      },
      {
        name: 'dashboard.tsx',
        language: 'typescript',
        content: `// React TSX Component (Runs automatically in sandbox viewport!)
function DashboardApp() {
  const [count, setCount] = React.useState(100);
  const [nodes, setNodes] = React.useState([
    { id: 'node-alpha', load: 34, status: 'ONLINE' },
    { id: 'node-beta', load: 78, status: 'OPTIMAL' },
    { id: 'node-gamma', load: 12, status: 'IDLE' },
  ]);

  return (
    <div className="bg-black text-white min-h-screen p-6 max-w-4xl mx-auto space-y-6 font-sans">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <a href="index.html" className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-mono text-zinc-200">
          &larr; BACK TO INDEX.HTML
        </a>
        <span className="text-xs font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-900">
          TSX REACT COMPONENT ACTIVE
        </span>
      </div>

      <div className="p-8 rounded-3xl bg-zinc-950 border border-zinc-800 space-y-6">
        <h1 className="text-2xl font-bold text-white">Quantum Node Telemetry (TSX)</h1>
        
        {/* Interactive React Counter */}
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-black border border-zinc-800">
          <div className="text-xs font-mono text-zinc-400">ACTIVE COMPUTE RATE:</div>
          <div className="text-2xl font-mono font-bold text-emerald-400">{count} GFLOPS</div>
          <button 
            onClick={() => setCount(c => c + 25)}
            className="ml-auto px-4 py-1.5 rounded-xl bg-white text-black font-bold text-xs hover:bg-zinc-200"
          >
            + BOOST COMPUTE
          </button>
        </div>

        {/* Dynamic Nodes Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {nodes.map(n => (
            <div key={n.id} className="p-4 rounded-xl bg-black border border-zinc-800">
              <div className="text-xs font-mono font-bold text-white">{n.id}</div>
              <div className="text-sm font-mono text-zinc-400 mt-2">Load: {n.load}%</div>
              <div className="text-[10px] font-mono text-emerald-400 mt-1 font-bold">{n.status}</div>
            </div>
          ))}
        </div>

        <div className="pt-2">
          <a href="numbers.html" className="text-xs font-mono text-zinc-400 hover:text-white underline">
            &rarr; Switch to numbers.html
          </a>
        </div>
      </div>
    </div>
  );
}

// Mount to sandbox root
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<DashboardApp />);`,
      },
      {
        name: 'styles.css',
        language: 'css',
        content: `/* Multi-page styling */
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&display=swap');

code, pre {
  font-family: 'JetBrains Mono', monospace;
}`,
      },
      {
        name: 'app.js',
        language: 'javascript',
        content: `// Project shared utilities
console.log("[Quantum Router] Session files loaded successfully.");`,
      },
    ],
  },
  {
    id: 'preset_saas',
    title: 'Quantum SaaS Web Platform',
    description: 'Ultra-modern monochromatic SaaS application with Tailwind CSS, animated metrics, interactive pricing, and dark interface',
    files: [
      {
        name: 'index.html',
        language: 'html',
        content: `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>NexusAI Platform</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="styles.css" />
</head>
<body class="bg-black text-zinc-100 font-sans min-h-screen selection:bg-zinc-700">
  <!-- Navigation Header -->
  <header class="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-50">
    <div class="flex items-center gap-3">
      <div class="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center font-bold text-white text-sm shadow-sm">
        Ψ
      </div>
      <span class="font-bold text-base tracking-tight text-white">Quantum Matrix</span>
      <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">PRO V2</span>
    </div>
    <div class="flex items-center gap-3">
      <button onclick="toggleTheme()" class="px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-xs font-mono text-zinc-300">
        THEME TOGGLE
      </button>
      <button onclick="handleLaunchApp()" class="px-4 py-1.5 rounded-lg bg-white hover:bg-zinc-200 text-black font-semibold text-xs transition-all shadow-sm active:scale-95">
        DEPLOY CLUSTER
      </button>
    </div>
  </header>

  <!-- Hero Section -->
  <main class="max-w-5xl mx-auto px-6 py-16 space-y-12 text-center">
    <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-400">
      <span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
      <span>AI-ENGINEERED MULTI-FILE ARCHITECTURE</span>
    </div>

    <div class="space-y-4">
      <h1 class="text-4xl sm:text-6xl font-semibold tracking-tight text-white max-w-3xl mx-auto">
        Compute Intelligence at <span class="text-zinc-400">Sub-Millisecond Speed</span>
      </h1>
      <p class="text-sm sm:text-base text-zinc-400 max-w-xl mx-auto font-mono leading-relaxed">
        High-throughput serverless execution matrix equipped with live web grounding, distributed nodes, and neural DOM synthesis.
      </p>
    </div>

    <!-- Metrics Bento Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 text-left">
      <div class="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 hover:border-zinc-600 transition-all group">
        <span class="text-xs font-mono text-zinc-500 uppercase">Throughput</span>
        <div class="text-3xl font-bold text-white mt-2 mb-1 group-hover:text-zinc-200">14.8 GB/s</div>
        <p class="text-xs text-zinc-400">Real-time vector streams processed in parallel neural buffers.</p>
      </div>

      <div class="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 hover:border-zinc-600 transition-all group">
        <span class="text-xs font-mono text-zinc-500 uppercase">Latency</span>
        <div class="text-3xl font-bold text-white mt-2 mb-1 group-hover:text-zinc-200">&lt; 1.2 ms</div>
        <p class="text-xs text-zinc-400">Global edge routing with zero cold-start penalty.</p>
      </div>

      <div class="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 hover:border-zinc-600 transition-all group">
        <span class="text-xs font-mono text-zinc-500 uppercase">Reliability</span>
        <div class="text-3xl font-bold text-white mt-2 mb-1 group-hover:text-zinc-200">99.999%</div>
        <p class="text-xs text-zinc-400">Multi-region distributed quorum consensus protocol.</p>
      </div>
    </div>

    <!-- Interactive Interactive Console Simulation -->
    <div class="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-left font-mono text-xs shadow-2xl">
      <div class="flex items-center justify-between pb-3 mb-3 border-b border-zinc-800 text-zinc-400">
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full bg-zinc-700"></span>
          <span class="w-2.5 h-2.5 rounded-full bg-zinc-700"></span>
          <span class="w-2.5 h-2.5 rounded-full bg-zinc-700"></span>
          <span class="text-zinc-500 ml-2">matrix-runtime // active_node.sh</span>
        </div>
        <button onclick="runDiagnostic()" class="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-white text-[11px] border border-zinc-700">
          EXECUTE PROBE
        </button>
      </div>
      <div id="terminal-output" class="space-y-1.5 text-zinc-300 min-h-[110px]">
        <div class="text-zinc-500">// Quantum Matrix telemetry initialized</div>
        <div>[STATUS: OK] Connected to local cluster port 3000</div>
        <div>[MEMORY: OPTIMAL] 256MB allocated for sub-graph execution</div>
      </div>
    </div>
  </main>

  <script src="app.js"></script>
</body>
</html>`,
      },
      {
        name: 'styles.css',
        language: 'css',
        content: `/* Custom Typography & Animations */
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&display=swap');

code, pre {
  font-family: 'JetBrains Mono', monospace;
}

.terminal-glow {
  box-shadow: 0 0 30px -5px rgba(255, 255, 255, 0.08);
}

button {
  cursor: pointer;
}`,
      },
      {
        name: 'app.js',
        language: 'javascript',
        content: `// Interactive Application Logic
console.log("Quantum Matrix client loaded successfully.");

function handleLaunchApp() {
  alert("Quantum Cluster deployed! Live monitoring activated.");
  const term = document.getElementById('terminal-output');
  if (term) {
    const entry = document.createElement('div');
    entry.className = "text-white font-bold";
    entry.innerText = ">> [DEPLOYED] Cluster ID: " + Math.random().toString(36).substring(7).toUpperCase() + " is now active.";
    term.appendChild(entry);
  }
}

function runDiagnostic() {
  const term = document.getElementById('terminal-output');
  if (term) {
    const times = [
      "Running quantum matrix parity check...",
      "Validating neural tensor shapes: 512x512 verified.",
      "All 8 worker threads reporting 0 error packets.",
      "System health: 100% NOMINAL."
    ];
    times.forEach((t, i) => {
      setTimeout(() => {
        const line = document.createElement('div');
        line.innerText = ">> " + t;
        term.appendChild(line);
        term.scrollTop = term.scrollHeight;
      }, i * 350);
    });
  }
}

function toggleTheme() {
  document.documentElement.classList.toggle('dark');
}`,
      },
      {
        name: 'data.json',
        language: 'json',
        content: `{
  "appVersion": "2.5.0",
  "name": "Quantum Matrix",
  "nodes": [
    { "id": "node-1", "region": "us-east", "status": "online" },
    { "id": "node-2", "region": "eu-central", "status": "online" },
    { "id": "node-3", "region": "ap-southeast", "status": "standby" }
  ],
  "author": "AIX Alpha Engine"
}`,
      },
    ],
  },
  {
    id: 'preset_portfolio',
    title: 'Minimalist Portfolio & Studio',
    description: 'Clean Apple-style portfolio showcase with responsive bento gallery, project drawer, and contact form',
    files: [
      {
        name: 'index.html',
        language: 'html',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Minimal Design Studio</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="styles.css">
</head>
<body class="bg-black text-zinc-100 min-h-screen px-6 py-12 max-w-4xl mx-auto space-y-12">
  <header class="flex justify-between items-center border-b border-zinc-800 pb-6">
    <div>
      <h1 class="text-2xl font-bold tracking-tight text-white">Studio Atelier</h1>
      <p class="text-xs text-zinc-400 font-mono">Architecture, Web Systems & Spatial Computing</p>
    </div>
    <button class="px-4 py-2 bg-white text-black text-xs font-bold rounded-full hover:bg-zinc-200">
      CONTACT
    </button>
  </header>
  <main class="grid grid-cols-1 md:grid-cols-2 gap-6">
    <div class="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 hover:border-zinc-600 transition-all">
      <h3 class="font-bold text-white mb-2">Project Zero</h3>
      <p class="text-xs text-zinc-400">Spatial user interface designed for gesture navigation and neural devices.</p>
    </div>
    <div class="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 hover:border-zinc-600 transition-all">
      <h3 class="font-bold text-white mb-2">Vector Synthesis</h3>
      <p class="text-xs text-zinc-400">High-fidelity generative visual algorithms running on WebGL.</p>
    </div>
  </main>
</body>
</html>`,
      },
      {
        name: 'styles.css',
        language: 'css',
        content: `body { font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif; }`,
      },
    ],
  },
  {
    id: 'preset_game',
    title: 'HTML5 Canvas Retro Arcade',
    description: 'Full 60fps HTML5 Canvas space dodge game with physics loop, keyboard controls, and score tracking',
    files: [
      {
        name: 'index.html',
        language: 'html',
        content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Arcade Dodger</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="styles.css" />
</head>
<body class="bg-black text-white flex flex-col items-center justify-center min-h-screen p-4 font-mono">
  <h1 class="text-xl font-bold mb-2">QUANTUM DODGER 60FPS</h1>
  <p class="text-xs text-zinc-400 mb-4">Use Left & Right Arrow keys (or A / D) to avoid falling asteroids</p>
  <div class="relative border-2 border-zinc-800 rounded-xl overflow-hidden bg-zinc-950 shadow-2xl">
    <canvas id="gameCanvas" width="480" height="400"></canvas>
    <div id="scoreDisplay" class="absolute top-3 left-4 text-xs font-bold text-white">SCORE: 0</div>
  </div>
  <script src="app.js"></script>
</body>
</html>`,
      },
      {
        name: 'styles.css',
        language: 'css',
        content: `canvas { display: block; background: #09090b; }`,
      },
      {
        name: 'app.js',
        language: 'javascript',
        content: `const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('scoreDisplay');

let player = { x: 220, y: 350, w: 28, h: 28, speed: 6 };
let asteroids = [];
let score = 0;
let keys = {};
let gameOver = false;

window.addEventListener('keydown', e => keys[e.key] = true);
window.addEventListener('keyup', e => keys[e.key] = false);

function spawnAsteroid() {
  if (Math.random() < 0.05) {
    asteroids.push({
      x: Math.random() * (canvas.width - 20),
      y: -20,
      size: 15 + Math.random() * 20,
      speed: 2 + Math.random() * 3
    });
  }
}

function update() {
  if (gameOver) return;
  if ((keys['ArrowLeft'] || keys['a']) && player.x > 0) player.x -= player.speed;
  if ((keys['ArrowRight'] || keys['d']) && player.x < canvas.width - player.w) player.x += player.speed;

  spawnAsteroid();

  for (let i = asteroids.length - 1; i >= 0; i--) {
    let a = asteroids[i];
    a.y += a.speed;

    // collision check
    if (
      player.x < a.x + a.size &&
      player.x + player.w > a.x &&
      player.y < a.y + a.size &&
      player.y + player.h > a.y
    ) {
      gameOver = true;
      scoreDisplay.innerText = "GAME OVER! FINAL SCORE: " + score + " (Refresh to replay)";
    }

    if (a.y > canvas.height) {
      asteroids.splice(i, 1);
      score += 10;
      scoreDisplay.innerText = "SCORE: " + score;
    }
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // player
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(player.x, player.y, player.w, player.h);

  // asteroids
  ctx.fillStyle = '#71717a';
  for (let a of asteroids) {
    ctx.fillRect(a.x, a.y, a.size, a.size);
  }

  if (gameOver) {
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.font = "20px monospace";
    ctx.textAlign = "center";
    ctx.fillText("COLLISION DETECTED", canvas.width / 2, canvas.height / 2);
  }
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

loop();`,
      },
    ],
  },
];

interface AppStudioPageProps {
  onBackToChat: () => void;
  initialCode?: string;
  initialLanguage?: string;
  activeSession?: ChatSession | null;
  activePersona?: Persona;
  onSendMessage?: (text: string, attachments?: Attachment[]) => Promise<void>;
  isLoading?: boolean;
  executionSteps?: ExecutionStep[];
  credits?: number;
  onDeductCredit?: () => boolean;
  onOpenCreditStore?: () => void;
}

export const AppStudioPage: React.FC<AppStudioPageProps> = ({
  onBackToChat,
  initialCode,
  initialLanguage,
  activeSession,
  activePersona,
  onSendMessage,
  isLoading = false,
  executionSteps,
  credits,
  onDeductCredit,
  onOpenCreditStore,
}) => {
  const [project, setProject] = useState<AppProject>(() => DEFAULT_PROJECT_PRESETS[0]);
  const [activeFileName, setActiveFileName] = useState<string>('index.html');
  const [activePreviewFileName, setActivePreviewFileName] = useState<string>('index.html');
  const [previewHistory, setPreviewHistory] = useState<string[]>(['index.html']);
  const [previewHistoryIndex, setPreviewHistoryIndex] = useState<number>(0);
  const [previewUrlInput, setPreviewUrlInput] = useState<string>('http://localhost:3000/index.html');
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [copied, setCopied] = useState<boolean>(false);
  const [copiedZip, setCopiedZip] = useState<boolean>(false);
  const [key, setKey] = useState<number>(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [showConsole, setShowConsole] = useState<boolean>(false);

  // Drag and Drop File Upload State
  const [isDraggingFiles, setIsDraggingFiles] = useState<boolean>(false);

  // Code Highlight & Advanced Selection Action Bar
  const [selectedCodeText, setSelectedCodeText] = useState<string>('');
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null);
  const [selectionPrompt, setSelectionPrompt] = useState<string>('');
  const [isAiSelectionFixing, setIsAiSelectionFixing] = useState<boolean>(false);
  const [selectionActionSuccess, setSelectionActionSuccess] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Diagnostics & Syntax Error Radar State
  const [diagnostics, setDiagnostics] = useState<{ line: number; message: string; severity: 'error' | 'warning' }[]>([]);
  const [isFixingAllDiagnostics, setIsFixingAllDiagnostics] = useState<boolean>(false);

  // Column visibility states
  const [showFilesColumn, setShowFilesColumn] = useState<boolean>(true);
  const [showEditorColumn, setShowEditorColumn] = useState<boolean>(true);
  const [showPreviewColumn, setShowPreviewColumn] = useState<boolean>(true);
  const [showChatColumn, setShowChatColumn] = useState<boolean>(true);

  // Chat Matrix expansion: 'normal' (360px), 'expanded' (560px), 'fullscreen' (100% overlay/width)
  const [chatSize, setChatSize] = useState<'normal' | 'expanded' | 'fullscreen'>('normal');

  // Chat input within App Studio
  const [studioChatInput, setStudioChatInput] = useState<string>('');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeSession?.messages?.length, isLoading]);

  // Real-time syntax and error diagnostics checker
  useEffect(() => {
    const current = project.files.find((f) => f.name === activeFileName);
    if (!current) return;
    const errors: { line: number; message: string; severity: 'error' | 'warning' }[] = [];
    const lines = current.content.split('\n');

    if (current.name.endsWith('.html')) {
      const tagMatches = current.content.match(/<([a-zA-Z0-9]+)(\s|>)/g) || [];
      const closeMatches = current.content.match(/<\/([a-zA-Z0-9]+)>/g) || [];
      const selfClosing = ['img', 'br', 'hr', 'input', 'meta', 'link'];
      const openTags = tagMatches
        .map((t) => t.replace(/<|\s|>/g, '').toLowerCase())
        .filter((t) => !selfClosing.includes(t));
      const closeTags = closeMatches.map((t) => t.replace(/<\/|>/g, '').toLowerCase());
      
      openTags.forEach((tag) => {
        if (!closeTags.includes(tag) && !['html', 'body', 'head', '!doctype'].includes(tag)) {
          errors.push({ line: 1, message: `Potential unclosed <${tag}> tag in ${current.name}`, severity: 'warning' });
        }
      });
    }

    if (current.name.endsWith('.json')) {
      try {
        JSON.parse(current.content);
      } catch (err: any) {
        errors.push({ line: 1, message: `Invalid JSON syntax: ${err.message}`, severity: 'error' });
      }
    }

    // Bracket balance check for JS/TSX
    if (current.name.endsWith('.js') || current.name.endsWith('.tsx') || current.name.endsWith('.jsx')) {
      let openCurly = (current.content.match(/{/g) || []).length;
      let closeCurly = (current.content.match(/}/g) || []).length;
      if (openCurly !== closeCurly) {
        errors.push({ line: lines.length, message: `Mismatched curly braces: { ${openCurly} vs } ${closeCurly}`, severity: 'error' });
      }
      let openParen = (current.content.match(/\(/g) || []).length;
      let closeParen = (current.content.match(/\)/g) || []).length;
      if (openParen !== closeParen) {
        errors.push({ line: lines.length, message: `Mismatched parentheses: ( ${openParen} vs ) ${closeParen}`, severity: 'warning' });
      }
    }

    setDiagnostics(errors);
  }, [project.files, activeFileName]);

  const handleSendStudioChatMessage = async (e?: React.FormEvent, presetPrompt?: string) => {
    if (e) e.preventDefault();
    const textToSend = presetPrompt || studioChatInput;
    if (!textToSend.trim() || isLoading) return;
    if (onSendMessage) {
      setStudioChatInput('');
      await onSendMessage(textToSend, []);
    }
  };

  // Preset layouts
  const applyLayoutPreset = (preset: 'all' | 'chat-preview' | 'code-preview' | 'full-chat' | 'full-preview') => {
    if (preset === 'all') {
      setShowFilesColumn(true);
      setShowEditorColumn(true);
      setShowPreviewColumn(true);
      setShowChatColumn(true);
      setChatSize('normal');
    } else if (preset === 'chat-preview') {
      setShowFilesColumn(false);
      setShowEditorColumn(false);
      setShowPreviewColumn(true);
      setShowChatColumn(true);
      setChatSize('expanded');
    } else if (preset === 'code-preview') {
      setShowFilesColumn(true);
      setShowEditorColumn(true);
      setShowPreviewColumn(true);
      setShowChatColumn(false);
      setChatSize('normal');
    } else if (preset === 'full-chat') {
      setShowFilesColumn(false);
      setShowEditorColumn(false);
      setShowPreviewColumn(false);
      setShowChatColumn(true);
      setChatSize('fullscreen');
    } else if (preset === 'full-preview') {
      setShowFilesColumn(false);
      setShowEditorColumn(false);
      setShowPreviewColumn(true);
      setShowChatColumn(false);
      setChatSize('normal');
    }
  };

  // File explorer controls
  const [isCreatingFile, setIsCreatingFile] = useState<boolean>(false);
  const [newFileNameInput, setNewFileNameInput] = useState<string>('');
  const [editingFileName, setEditingFileName] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState<string>('');

  // AI Prompting
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [isAiGenerating, setIsAiGenerating] = useState<boolean>(false);
  const [aiFramework, setAiFramework] = useState<string>('tailwind');

  // Visual Edit Mode State
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [selectedElement, setSelectedElement] = useState<{
    tagName: string;
    innerText: string;
    color: string;
    backgroundColor: string;
    fontSize?: string;
  } | null>(null);
  const [editTextColor, setEditTextColor] = useState<string>('#ffffff');
  const [editBgColor, setEditBgColor] = useState<string>('#000000');
  const [pendingEditsCount, setPendingEditsCount] = useState<number>(0);
  const [stagedHtml, setStagedHtml] = useState<string | null>(null);
  const [showSaveToast, setShowSaveToast] = useState<boolean>(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Load initial code if provided from chat
  useEffect(() => {
    if (initialCode) {
      const ext = initialLanguage === 'css' ? 'css' : initialLanguage === 'javascript' || initialLanguage === 'js' ? 'js' : initialLanguage === 'tsx' || initialLanguage === 'typescript' ? 'tsx' : 'html';
      const name = ext === 'css' ? 'styles.css' : ext === 'js' ? 'app.js' : ext === 'tsx' ? 'dashboard.tsx' : 'index.html';
      setProject({
        id: `chat_import_${Date.now()}`,
        title: 'App from Chat Code',
        description: 'Web application generated from chat code block',
        files: [
          {
            name,
            language: initialLanguage || 'html',
            content: initialCode,
          },
          ...(ext !== 'css' ? [{ name: 'styles.css', language: 'css', content: '/* Custom CSS */\nbody { margin: 0; }' }] : []),
          ...(ext !== 'js' ? [{ name: 'app.js', language: 'javascript', content: '// Custom Javascript\nconsole.log("App loaded");' }] : []),
        ],
      });
      setActiveFileName(name);
      setActivePreviewFileName(name);
      setPreviewUrlInput(`http://localhost:3000/${name}`);
    }
  }, [initialCode, initialLanguage]);

  // Synchronize active preview file when the active editor file changes
  useEffect(() => {
    if (activeFileName) {
      setActivePreviewFileName(activeFileName);
      setPreviewUrlInput(`http://localhost:3000/${activeFileName}`);
      setKey((prev) => prev + 1);
    }
  }, [activeFileName]);

  // Handle postMessage logs, Page Navigation router, and Visual Edit updates from iframe
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (!e.data) return;
      if (e.data.type === 'CONSOLE_LOG') {
        setLogs((prev) => [...prev.slice(-40), e.data.text]);
      } else if (e.data.type === 'PREVIEW_NAVIGATE') {
        const rawPath = e.data.path || '';
        let target = rawPath.replace(/^\.\//, '').replace(/^\//, '').split('?')[0].split('#')[0];
        if (!target) target = 'index.html';

        // Match against project files
        const match =
          project.files.find((f) => f.name.toLowerCase() === target.toLowerCase()) ||
          project.files.find((f) => f.name.toLowerCase().startsWith(target.toLowerCase())) ||
          project.files.find((f) => f.name.toLowerCase().replace(/\.[^/.]+$/, '') === target.toLowerCase());

        if (match) {
          setActivePreviewFileName(match.name);
          setPreviewUrlInput(`http://localhost:3000/${match.name}`);
          setPreviewHistory((prev) => [...prev.slice(0, previewHistoryIndex + 1), match.name]);
          setPreviewHistoryIndex((prev) => prev + 1);
          setLogs((prev) => [...prev.slice(-40), `[ROUTER] Navigated to ${match.name}`]);
        } else {
          setLogs((prev) => [...prev.slice(-40), `[ROUTER 404] Page "${target}" not found in project files.`]);
        }
      } else if (e.data.type === 'ELEMENT_SELECTED') {
        setSelectedElement({
          tagName: e.data.tagName,
          innerText: e.data.innerText,
          color: e.data.color,
          backgroundColor: e.data.backgroundColor,
          fontSize: e.data.fontSize,
        });
      } else if (e.data.type === 'VISUAL_EDIT_STAGED') {
        if (e.data.html) {
          setStagedHtml(e.data.html);
          setPendingEditsCount((prev) => prev + 1);
        }
      } else if (e.data.type === 'CLEAN_HTML_RESPONSE') {
        if (e.data.html) {
          saveStagedHtmlToSource(e.data.html);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [project.files, previewHistoryIndex]);

  const navigatePreviewTo = (targetFileName: string) => {
    const match = project.files.find((f) => f.name.toLowerCase() === targetFileName.toLowerCase());
    if (match) {
      setActivePreviewFileName(match.name);
      setPreviewUrlInput(`http://localhost:3000/${match.name}`);
      setPreviewHistory((prev) => [...prev.slice(0, previewHistoryIndex + 1), match.name]);
      setPreviewHistoryIndex((prev) => prev + 1);
      setKey((prev) => prev + 1);
    }
  };

  const handlePreviewBack = () => {
    if (previewHistoryIndex > 0) {
      const nextIndex = previewHistoryIndex - 1;
      setPreviewHistoryIndex(nextIndex);
      const target = previewHistory[nextIndex];
      setActivePreviewFileName(target);
      setPreviewUrlInput(`http://localhost:3000/${target}`);
      setKey((prev) => prev + 1);
    }
  };

  const handlePreviewForward = () => {
    if (previewHistoryIndex < previewHistory.length - 1) {
      const nextIndex = previewHistoryIndex + 1;
      setPreviewHistoryIndex(nextIndex);
      const target = previewHistory[nextIndex];
      setActivePreviewFileName(target);
      setPreviewUrlInput(`http://localhost:3000/${target}`);
      setKey((prev) => prev + 1);
    }
  };

  const saveStagedHtmlToSource = (htmlContent: string) => {
    setProject((prev) => ({
      ...prev,
      files: prev.files.map((f) => (f.name === activePreviewFileName ? { ...f, content: htmlContent } : f)),
    }));
    setPendingEditsCount(0);
    setStagedHtml(null);
    setShowSaveToast(true);
    setTimeout(() => setShowSaveToast(false), 3000);
  };

  const handleSaveVisualEdits = () => {
    if (stagedHtml) {
      saveStagedHtmlToSource(stagedHtml);
    } else {
      iframeRef.current?.contentWindow?.postMessage({ type: 'REQUEST_CLEAN_HTML' }, '*');
    }
  };

  const handleDiscardVisualEdits = () => {
    setPendingEditsCount(0);
    setStagedHtml(null);
    setSelectedElement(null);
    setKey((prev) => prev + 1);
  };

  const activeFile = project.files.find((f) => f.name === activeFileName) || project.files[0];

  const handleUpdateFileContent = (newContent: string) => {
    setProject((prev) => ({
      ...prev,
      files: prev.files.map((f) => (f.name === activeFileName ? { ...f, content: newContent } : f)),
    }));
  };

  // Text selection tracking in code editor
  const handleTextareaSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    if (start !== end && end > start) {
      const selected = target.value.substring(start, end);
      setSelectedCodeText(selected);
      setSelectionRange({ start, end });
    } else {
      setSelectedCodeText('');
      setSelectionRange(null);
    }
  };

  // Advanced AI Modify / Fix for Highlighted Selection
  const handleAiModifySelection = async (customPrompt?: string) => {
    if (!selectedCodeText || !selectionRange) return;
    const promptToUse = customPrompt || selectionPrompt || 'Optimize, fix any syntax issues, and improve styling for this highlighted code.';

    // Credit deduction check
    if (onDeductCredit) {
      const success = onDeductCredit();
      if (!success) return;
    } else if (credits !== undefined && credits <= 0) {
      if (onOpenCreditStore) onOpenCreditStore();
      else alert('Insufficient prompt credits. Please refuel your credits via XRPL.');
      return;
    }

    setIsAiSelectionFixing(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'studio',
          loopMode: 'balanced',
          messages: [
            {
              role: 'user',
              content: `You are an elite developer modifying a highlighted snippet in file '${activeFile.name}' (${activeFile.language}).
Full context file:
\`\`\`${activeFile.language}
${activeFile.content}
\`\`\`

USER HIGHLIGHTED THIS EXACT CODE SNIPPET TO EDIT:
\`\`\`${activeFile.language}
${selectedCodeText}
\`\`\`

USER INSTRUCTION:
${promptToUse}

CRITICAL: Return ONLY the replacement code snippet for the highlighted portion inside a single code block (\`\`\`${activeFile.language} ... \`\`\`). Do not include any surrounding code outside the snippet. Do not include markdown explanations.`,
            },
          ],
        }),
      });

      const data = await response.json();
      if (data.success && data.text) {
        let cleanSnippet = data.text;
        const match = data.text.match(/```(?:\w+)?\n([\s\S]*?)```/);
        if (match) cleanSnippet = match[1];

        const before = activeFile.content.substring(0, selectionRange.start);
        const after = activeFile.content.substring(selectionRange.end);
        const updated = before + cleanSnippet + after;

        handleUpdateFileContent(updated);
        setSelectedCodeText('');
        setSelectionRange(null);
        setSelectionPrompt('');
        setSelectionActionSuccess('Highlighted code successfully updated by AIX Alpha!');
        setTimeout(() => setSelectionActionSuccess(null), 3000);
      }
    } catch (err) {
      console.error('Error modifying selection:', err);
      alert('Failed to modify highlighted selection.');
    } finally {
      setIsAiSelectionFixing(false);
    }
  };

  // Fix All Diagnostics using AI
  const handleFixAllDiagnostics = async () => {
    if (onDeductCredit) {
      const success = onDeductCredit();
      if (!success) return;
    } else if (credits !== undefined && credits <= 0) {
      if (onOpenCreditStore) onOpenCreditStore();
      else alert('Insufficient credits. Please refuel via XRPL.');
      return;
    }

    setIsFixingAllDiagnostics(true);
    try {
      const diagStr = diagnostics.map((d) => `Line ${d.line}: ${d.message}`).join('\n');
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'studio',
          loopMode: 'balanced',
          messages: [
            {
              role: 'user',
              content: `Fix all syntax and structural diagnostics in '${activeFile.name}' (${activeFile.language}).
DIAGNOSTICS DETECTED:
${diagStr}

CURRENT FILE CONTENT:
\`\`\`${activeFile.language}
${activeFile.content}
\`\`\`

CRITICAL: Provide the 100% complete, fully repaired, and bug-free file inside a single code block (\`\`\`${activeFile.language} ... \`\`\`). No explanations.`,
            },
          ],
        }),
      });

      const data = await response.json();
      if (data.success && data.text) {
        let cleanCode = data.text;
        const match = data.text.match(/```(?:\w+)?\n([\s\S]*?)```/);
        if (match) cleanCode = match[1];
        handleUpdateFileContent(cleanCode);
        setLogs((prev) => [...prev.slice(-40), `[DIAGNOSTICS] All errors in ${activeFile.name} resolved.`]);
      }
    } catch (err) {
      console.error('Failed to fix diagnostics:', err);
      alert('Failed to fix diagnostics.');
    } finally {
      setIsFixingAllDiagnostics(false);
    }
  };

  // Drag and Drop File Importer
  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFiles(false);
    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;

    Array.from(e.dataTransfer.files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        const ext = file.name.split('.').pop()?.toLowerCase() || 'html';
        const lang =
          ext === 'css'
            ? 'css'
            : ext === 'js'
            ? 'javascript'
            : ext === 'tsx' || ext === 'ts'
            ? 'typescript'
            : ext === 'json'
            ? 'json'
            : 'html';

        setProject((prev) => {
          const idx = prev.files.findIndex((f) => f.name === file.name);
          if (idx >= 0) {
            const copy = [...prev.files];
            copy[idx] = { name: file.name, content, language: lang };
            return { ...prev, files: copy };
          } else {
            return { ...prev, files: [...prev.files, { name: file.name, content, language: lang }] };
          }
        });
        setActiveFileName(file.name);
      };
      reader.readAsText(file);
    });
  };

  // Download individual file
  const handleDownloadSingleFile = (file: AppFile) => {
    const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Add new file
  const handleCreateFile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileNameInput.trim()) return;

    const fileName = newFileNameInput.trim();
    if (project.files.some((f) => f.name === fileName)) {
      alert('A file with this name already exists.');
      return;
    }

    const ext = fileName.split('.').pop()?.toLowerCase() || 'html';
    const lang =
      ext === 'css'
        ? 'css'
        : ext === 'js'
        ? 'javascript'
        : ext === 'tsx' || ext === 'ts'
        ? 'typescript'
        : ext === 'json'
        ? 'json'
        : 'html';

    const defaultContent =
      ext === 'html'
        ? '<!DOCTYPE html>\n<html>\n<head>\n  <script src="https://cdn.tailwindcss.com"></script>\n</head>\n<body class="bg-black text-white p-6">\n  <h1 class="text-xl font-bold">New Page</h1>\n  <a href="index.html" class="text-xs text-zinc-400">&larr; Back to Index</a>\n</body>\n</html>'
        : ext === 'tsx' || ext === 'jsx'
        ? '// React Component\nfunction PageComponent() {\n  return (\n    <div className="p-6 bg-black text-white min-h-screen">\n      <h1 className="text-xl font-bold">React Page</h1>\n      <a href="index.html" className="text-xs text-zinc-400 mt-2 block">&larr; Back to Index</a>\n    </div>\n  );\n}\nconst root = ReactDOM.createRoot(document.getElementById("root"));\nroot.render(<PageComponent />);'
        : ext === 'css'
        ? '/* Stylesheet */\n'
        : ext === 'js'
        ? '// Script file\n'
        : ext === 'json'
        ? '{\n  "data": []\n}'
        : '';

    const newFile: AppFile = {
      name: fileName,
      language: lang,
      content: defaultContent,
    };

    setProject((prev) => ({ ...prev, files: [...prev.files, newFile] }));
    setActiveFileName(fileName);
    setNewFileNameInput('');
    setIsCreatingFile(false);
  };

  // Delete file
  const handleDeleteFile = (fileName: string) => {
    if (project.files.length <= 1) {
      alert('Cannot delete the last remaining file in the project.');
      return;
    }
    const filtered = project.files.filter((f) => f.name !== fileName);
    setProject((prev) => ({ ...prev, files: filtered }));
    if (activeFileName === fileName) {
      setActiveFileName(filtered[0].name);
    }
  };

  // Rename file
  const handleRenameFile = (oldName: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!renameInput.trim() || renameInput === oldName) {
      setEditingFileName(null);
      return;
    }
    const trimmed = renameInput.trim();
    if (project.files.some((f) => f.name === trimmed)) {
      alert('A file with this name already exists.');
      return;
    }
    const ext = trimmed.split('.').pop()?.toLowerCase() || 'html';
    const lang =
      ext === 'css'
        ? 'css'
        : ext === 'js'
        ? 'javascript'
        : ext === 'tsx' || ext === 'ts'
        ? 'typescript'
        : ext === 'json'
        ? 'json'
        : 'html';

    setProject((prev) => ({
      ...prev,
      files: prev.files.map((f) => (f.name === oldName ? { ...f, name: trimmed, language: lang } : f)),
    }));
    if (activeFileName === oldName) {
      setActiveFileName(trimmed);
    }
    setEditingFileName(null);
  };

  // Import individual or multiple local files
  const handleImportLocalFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) return;

    Array.from(uploadedFiles).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        const ext = file.name.split('.').pop()?.toLowerCase() || 'html';
        const lang =
          ext === 'css'
            ? 'css'
            : ext === 'js'
            ? 'javascript'
            : ext === 'tsx' || ext === 'ts'
            ? 'typescript'
            : ext === 'json'
            ? 'json'
            : 'html';

        setProject((prev) => {
          const existingIndex = prev.files.findIndex((f) => f.name === file.name);
          if (existingIndex >= 0) {
            const updated = [...prev.files];
            updated[existingIndex] = { name: file.name, content, language: lang };
            return { ...prev, files: updated };
          } else {
            return {
              ...prev,
              files: [...prev.files, { name: file.name, content, language: lang }],
            };
          }
        });
        setActiveFileName(file.name);
      };
      reader.readAsText(file);
    });
    e.target.value = '';
  };

  // Compile project files into a bundled srcDoc iframe HTML string with TSX / React & Multi-Page Link Router support
  const generateBundleSrcDoc = () => {
    const targetFile =
      project.files.find((f) => f.name === activePreviewFileName) ||
      project.files.find((f) => f.name.endsWith('.html')) ||
      project.files[0];

    const cssFiles = project.files.filter((f) => f.name.endsWith('.css'));
    const jsFiles = project.files.filter((f) => f.name.endsWith('.js') && f.name !== targetFile.name);
    const jsonFiles = project.files.filter((f) => f.name.endsWith('.json'));

    let html = '';

    // If target file is a TSX or JSX file, wrap in React 18 & Babel Standalone boilerplate
    if (targetFile.name.endsWith('.tsx') || targetFile.name.endsWith('.jsx')) {
      html = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${targetFile.name}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
</head>
<body class="bg-black text-white">
  <div id="root"></div>
  <script type="text/babel">
${targetFile.content}
  </script>
</body>
</html>`;
    } else {
      html = targetFile?.content || '<html><body></body></html>';
    }

    // Inject inline CSS for all project CSS files
    let cssInjections = cssFiles
      .map((c) => `<style id="app_css_${c.name.replace(/[^a-zA-Z0-9]/g, '_')}">\n${c.content}\n</style>`)
      .join('\n');

    // Inject JSON data objects onto window
    let jsonInjections = jsonFiles
      .map((j) => {
        const keyName = j.name.replace('.json', '').replace(/[^a-zA-Z0-9]/g, '_');
        return `<script>
try {
  window['${keyName}'] = ${j.content || '{}'};
} catch (e) {
  console.error("Invalid JSON in ${j.name}:", e.message);
}
</script>`;
      })
      .join('\n');

    // Inject JS scripts
    let jsInjections = jsFiles
      .map(
        (j) => `<script>
try {
  ${j.content}
} catch (err) {
  console.error("Script Error in ${j.name}:", err.message);
}
</script>`
      )
      .join('\n');

    // In-Session Multi-Page Router Interceptor & Console Bridge
    const routerAndConsoleInterceptor = `<script>
(function() {
  // Console log interceptor
  const _log = console.log;
  const _err = console.error;
  const _warn = console.warn;
  console.log = function(...args) {
    _log.apply(console, args);
    window.parent.postMessage({ type: 'CONSOLE_LOG', text: args.join(' ') }, '*');
  };
  console.error = function(...args) {
    _err.apply(console, args);
    window.parent.postMessage({ type: 'CONSOLE_LOG', text: 'ERR: ' + args.join(' ') }, '*');
  };
  console.warn = function(...args) {
    _warn.apply(console, args);
    window.parent.postMessage({ type: 'CONSOLE_LOG', text: 'WARN: ' + args.join(' ') }, '*');
  };

  // Intercept relative page navigation links (e.g. href="numbers.html" or href="./dashboard.tsx")
  document.addEventListener('click', function(e) {
    const a = e.target.closest('a');
    if (a && a.getAttribute('href')) {
      const href = a.getAttribute('href');
      if (
        !href.startsWith('http://') &&
        !href.startsWith('https://') &&
        !href.startsWith('//') &&
        !href.startsWith('#') &&
        !href.startsWith('mailto:') &&
        !href.startsWith('tel:') &&
        !href.startsWith('javascript:')
      ) {
        e.preventDefault();
        window.parent.postMessage({ type: 'PREVIEW_NAVIGATE', path: href }, '*');
      }
    }
  });
})();
</script>`;

    // Visual Edit Mode Inspector Script
    const visualEditScript = isEditMode
      ? `<script id="aix_edit_mode_script">
(function() {
  let activeEl = null;

  const style = document.createElement('style');
  style.id = 'aix_edit_styles';
  style.innerHTML = \`
    .aix-hover-highlight {
      outline: 2px dashed #10b981 !important;
      outline-offset: 2px !important;
    }
    .aix-selected-highlight {
      outline: 2px solid #3b82f6 !important;
      outline-offset: 2px !important;
    }
    [contenteditable="true"] {
      cursor: text !important;
      min-height: 1em;
    }
    [contenteditable="true"]:focus {
      outline: 2px solid #10b981 !important;
      outline-offset: 2px !important;
      background-color: rgba(16, 185, 129, 0.08) !important;
    }
  \`;
  document.head.appendChild(style);

  function makeEditable() {
    const selector = 'h1, h2, h3, h4, h5, h6, p, span, button, a, div, li, td, th, label, b, i, strong, em';
    document.querySelectorAll(selector).forEach(el => {
      if (!el.querySelector('h1, h2, h3, h4, h5, h6, p, div, table, form')) {
        el.setAttribute('contenteditable', 'true');
        el.setAttribute('spellcheck', 'false');
      }
    });
  }

  makeEditable();

  document.addEventListener('mouseover', function(e) {
    if (e.target.tagName === 'BODY' || e.target.tagName === 'HTML') return;
    e.target.classList.add('aix-hover-highlight');
  });

  document.addEventListener('mouseout', function(e) {
    e.target.classList.remove('aix-hover-highlight');
  });

  document.addEventListener('click', function(e) {
    if (e.target.tagName === 'BODY' || e.target.tagName === 'HTML') return;
    if (activeEl) activeEl.classList.remove('aix-selected-highlight');
    activeEl = e.target;
    activeEl.classList.remove('aix-hover-highlight');
    activeEl.classList.add('aix-selected-highlight');

    const comp = window.getComputedStyle(activeEl);
    window.parent.postMessage({
      type: 'ELEMENT_SELECTED',
      tagName: activeEl.tagName.toLowerCase(),
      innerText: activeEl.innerText || activeEl.textContent || '',
      color: comp.color,
      backgroundColor: comp.backgroundColor,
      fontSize: comp.fontSize
    }, '*');
  }, true);

  // Direct typing inside preview canvas listener
  document.addEventListener('input', function(e) {
    sendStagedHtml();
  });

  window.addEventListener('message', function(e) {
    if (!e.data) return;
    if (e.data.type === 'APPLY_ELEMENT_EDIT') {
      if (activeEl) {
        if (e.data.text !== undefined) {
          activeEl.innerText = e.data.text;
        }
        if (e.data.textColor) {
          activeEl.style.color = e.data.textColor;
        }
        if (e.data.bgColor) {
          activeEl.style.backgroundColor = e.data.bgColor;
        }
        if (e.data.fontSize) {
          activeEl.style.fontSize = e.data.fontSize;
        }
        if (e.data.action === 'delete') {
          const parent = activeEl.parentElement;
          activeEl.remove();
          activeEl = parent;
        }
        if (e.data.action === 'duplicate') {
          const clone = activeEl.cloneNode(true);
          activeEl.parentNode.insertBefore(clone, activeEl.nextSibling);
        }
        sendStagedHtml();
      }
    } else if (e.data.type === 'REQUEST_CLEAN_HTML') {
      sendCleanHtmlResponse();
    }
  });

  function getCleanOuterHtml() {
    const clone = document.documentElement.cloneNode(true);
    clone.querySelectorAll('.aix-hover-highlight, .aix-selected-highlight').forEach(el => {
      el.classList.remove('aix-hover-highlight', 'aix-selected-highlight');
      if (el.getAttribute('class') === '') el.removeAttribute('class');
    });
    clone.querySelectorAll('[contenteditable]').forEach(el => {
      el.removeAttribute('contenteditable');
      el.removeAttribute('spellcheck');
    });
    const editStyle = clone.querySelector('#aix_edit_styles');
    if (editStyle) editStyle.remove();
    const editScript = clone.querySelector('#aix_edit_mode_script');
    if (editScript) editScript.remove();
    return clone.outerHTML;
  }

  function sendStagedHtml() {
    window.parent.postMessage({
      type: 'VISUAL_EDIT_STAGED',
      html: getCleanOuterHtml()
    }, '*');
  }

  function sendCleanHtmlResponse() {
    window.parent.postMessage({
      type: 'CLEAN_HTML_RESPONSE',
      html: getCleanOuterHtml()
    }, '*');
  }
})();
</script>`
      : '';

    // Insert into html head or at the beginning
    if (html.includes('<head>')) {
      html = html.replace('<head>', `<head>\n${routerAndConsoleInterceptor}\n${cssInjections}\n${jsonInjections}\n${visualEditScript}`);
    } else if (html.includes('<html>')) {
      html = html.replace('<html>', `<html><head>${routerAndConsoleInterceptor}\n${cssInjections}\n${jsonInjections}\n${visualEditScript}</head>`);
    } else {
      html = `${routerAndConsoleInterceptor}\n${cssInjections}\n${jsonInjections}\n${visualEditScript}\n${html}`;
    }

    // Insert scripts before </body> or append
    if (html.includes('</body>')) {
      html = html.replace('</body>', `${jsInjections}\n</body>`);
    } else {
      html += `\n${jsInjections}`;
    }

    return html;
  };

  // Download entire project as a .ZIP file using JSZip!
  const handleExportZip = async () => {
    try {
      const zip = new JSZip();
      project.files.forEach((file) => {
        zip.file(file.name, file.content);
      });

      // Add a helpful README.md
      zip.file(
        'README.md',
        `# ${project.title}\n\n${project.description}\n\nGenerated by AIX Quantum Matrix Web Studio.\n\nTo view, simply open \`index.html\` in any web browser.`
      );

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      const slug = project.title.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30) || 'app-project';
      a.download = `${slug}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setCopiedZip(true);
      setTimeout(() => setCopiedZip(false), 2000);
    } catch (err) {
      console.error('Failed to create ZIP:', err);
      alert('Failed to generate ZIP archive.');
    }
  };

  // Download active individual file
  const handleDownloadActiveFile = () => {
    if (!activeFile) return;
    const blob = new Blob([activeFile.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFile.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Copy bundled HTML
  const handleCopyBundleHtml = () => {
    navigator.clipboard.writeText(generateBundleSrcDoc());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Open live preview in a new window/tab
  const handlePopoutPreview = () => {
    const bundled = generateBundleSrcDoc();
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.open();
      newWindow.document.write(bundled);
      newWindow.document.close();
    }
  };

  // AI Code Modify / Full App Generation
  const handleAiCodeModify = async (customInstruction?: string) => {
    const promptToUse = customInstruction || aiPrompt;
    if (!promptToUse.trim()) return;

    // Check credit balance before running AI prompt
    if (onDeductCredit) {
      const success = onDeductCredit();
      if (!success) return;
    } else if (credits !== undefined && credits <= 0) {
      if (onOpenCreditStore) {
        onOpenCreditStore();
      } else {
        alert('Insufficient prompt credits. Please refuel your credits using XRP on the XRPL Mainnet.');
      }
      return;
    } else {
      // Local storage fallback deduction
      const current = parseInt(localStorage.getItem('aix_prompt_credits') || '999', 10);
      if (current <= 0) {
        onOpenCreditStore?.();
        return;
      }
      localStorage.setItem('aix_prompt_credits', Math.max(0, current - 1).toString());
    }

    setIsAiGenerating(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'studio',
          loopMode: 'balanced',
          messages: [
            {
              role: 'user',
              content: `You are an elite web app architect. The current file is named '${activeFile.name}' (${activeFile.language}) in project '${project.title}'.
Here is the current content:
\`\`\`${activeFile.language}
${activeFile.content}
\`\`\`

USER INSTRUCTION:
${promptToUse}

Framework context: ${aiFramework} (Tailwind CSS is available via CDN).
CRITICAL: Respond with the COMPLETE updated file content inside a single code block (\`\`\`${activeFile.language} ... \`\`\`). Do not output explanations or ellipses. Output the full functional code ready to run directly.`,
            },
          ],
        }),
      });

      const data = await response.json();
      if (data.success && data.text) {
        let cleanCode = data.text;
        const codeBlockMatch = data.text.match(/```(?:\w+)?\n([\s\S]*?)```/);
        if (codeBlockMatch) {
          cleanCode = codeBlockMatch[1];
        }
        handleUpdateFileContent(cleanCode);
        if (!customInstruction) setAiPrompt('');
      }
    } catch (err) {
      console.error('AI Code Modify Error:', err);
      alert('Failed to generate code with AI.');
    } finally {
      setIsAiGenerating(false);
    }
  };

  const deviceWidthClass =
    deviceMode === 'mobile' ? 'max-w-[375px]' : deviceMode === 'tablet' ? 'max-w-[768px]' : 'w-full';

  return (
    <div className="h-[100dvh] min-h-[100dvh] w-screen flex flex-col bg-black text-zinc-100 overflow-hidden font-sans select-none">
      {/* Top Command Bar */}
      <header className="h-13 sm:h-14 border-b border-zinc-800 bg-zinc-950 px-3 sm:px-6 flex items-center justify-between shrink-0 z-30 pt-[env(safe-area-inset-top,0px)]">
        {/* Left: Back to Chat + Project Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-600 text-xs font-mono text-zinc-200 transition-all active:scale-95 glow-subtle"
            title="Return to Main Chat Thread"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">CHAT MATRIX</span>
          </button>

          <div className="h-5 w-[1px] bg-zinc-800 hidden sm:block" />

          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center text-white">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider">{project.title}</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-900 text-zinc-400 border border-zinc-800">
                  FULL WORKSTATION
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Center: Template & Layout Presets */}
        <div className="hidden lg:flex items-center gap-2">
          {/* Layout Presets */}
          <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800 text-[11px] font-mono text-zinc-400">
            <span className="text-[10px] text-zinc-500 uppercase px-1">LAYOUT:</span>
            <button
              onClick={() => applyLayoutPreset('all')}
              className={`px-2 py-0.5 rounded transition-colors ${
                showFilesColumn && showEditorColumn && showPreviewColumn && showChatColumn
                  ? 'bg-white text-black font-bold'
                  : 'hover:text-white'
              }`}
              title="Show All 4 Columns"
            >
              QUAD
            </button>
            <button
              onClick={() => applyLayoutPreset('chat-preview')}
              className={`px-2 py-0.5 rounded transition-colors ${
                !showFilesColumn && !showEditorColumn && showPreviewColumn && showChatColumn
                  ? 'bg-white text-black font-bold'
                  : 'hover:text-white'
              }`}
              title="Chat Matrix + Live App Preview"
            >
              CHAT+APP
            </button>
            <button
              onClick={() => applyLayoutPreset('code-preview')}
              className={`px-2 py-0.5 rounded transition-colors ${
                showFilesColumn && showEditorColumn && showPreviewColumn && !showChatColumn
                  ? 'bg-white text-black font-bold'
                  : 'hover:text-white'
              }`}
              title="Code Editor + Live Preview"
            >
              CODE+APP
            </button>
            <button
              onClick={() => applyLayoutPreset('full-chat')}
              className={`px-2 py-0.5 rounded transition-colors ${
                chatSize === 'fullscreen' ? 'bg-white text-black font-bold' : 'hover:text-white'
              }`}
              title="Full Window Chat Matrix"
            >
              FULL CHAT
            </button>
          </div>

          <span className="text-zinc-700">|</span>

          <span className="text-[11px] font-mono text-zinc-500 uppercase">PRESET:</span>
          <select
            value={project.id}
            onChange={(e) => {
              const found = DEFAULT_PROJECT_PRESETS.find((p) => p.id === e.target.value);
              if (found) {
                setProject(found);
                setActiveFileName(found.files[0].name);
              }
            }}
            className="bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-zinc-500 cursor-pointer glow-subtle"
          >
            {DEFAULT_PROJECT_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        {/* Right: Column Toggles, Viewport Resizer, Actions */}
        <div className="flex items-center gap-2">
          {/* Column Toggle Toggles */}
          <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800 text-xs font-mono">
            <button
              onClick={() => setShowFilesColumn(!showFilesColumn)}
              className={`px-2 py-1 rounded text-xs transition-colors flex items-center gap-1 ${
                showFilesColumn ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Toggle File Explorer Column"
            >
              <Folder className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Files</span>
            </button>
            <button
              onClick={() => setShowEditorColumn(!showEditorColumn)}
              className={`px-2 py-1 rounded text-xs transition-colors flex items-center gap-1 ${
                showEditorColumn ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Toggle Code Editor Column"
            >
              <FileCode className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Code</span>
            </button>
            <button
              onClick={() => setShowPreviewColumn(!showPreviewColumn)}
              className={`px-2 py-1 rounded text-xs transition-colors flex items-center gap-1 ${
                showPreviewColumn ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Toggle Live Preview Column"
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Preview</span>
            </button>
            <button
              onClick={() => setShowChatColumn(!showChatColumn)}
              className={`px-2 py-1 rounded text-xs transition-colors flex items-center gap-1 ${
                showChatColumn ? 'bg-white text-black font-bold shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Toggle Session Chat Matrix Column"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Chat</span>
            </button>
          </div>
          {/* Viewport Resizer */}
          <div className="hidden md:flex bg-zinc-900 p-1 rounded-lg border border-zinc-800">
            <button
              onClick={() => setDeviceMode('desktop')}
              className={`p-1.5 rounded text-xs transition-colors ${
                deviceMode === 'desktop' ? 'bg-white text-black font-bold shadow-sm' : 'text-zinc-400 hover:text-white'
              }`}
              title="Desktop View (100%)"
            >
              <Laptop className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setDeviceMode('tablet')}
              className={`p-1.5 rounded text-xs transition-colors ${
                deviceMode === 'tablet' ? 'bg-white text-black font-bold shadow-sm' : 'text-zinc-400 hover:text-white'
              }`}
              title="Tablet View (768px)"
            >
              <Tablet className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setDeviceMode('mobile')}
              className={`p-1.5 rounded text-xs transition-colors ${
                deviceMode === 'mobile' ? 'bg-white text-black font-bold shadow-sm' : 'text-zinc-400 hover:text-white'
              }`}
              title="Mobile View (375px)"
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Refresh Frame */}
          <button
            onClick={() => setKey((k) => k + 1)}
            className="p-2 bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-lg border border-zinc-800 text-xs transition-colors glow-subtle"
            title="Reload Sandbox Frame"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {/* Popout preview in new tab */}
          <button
            onClick={handlePopoutPreview}
            className="p-2 bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-lg border border-zinc-800 text-xs transition-colors glow-subtle hidden sm:flex"
            title="Open Live App in New Window"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>

          {/* Prompt Credits Counter & Refuel Modal trigger */}
          {credits !== undefined && (
            <button
              onClick={onOpenCreditStore}
              className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-mono text-zinc-200 flex items-center gap-1.5 transition-all active:scale-95 glow-subtle"
              title="XRPL Prompt Credits (Used for App & Web generations)"
            >
              <Zap className="w-3.5 h-3.5 text-white fill-white" />
              <span className="font-bold text-white">{credits}</span>
              <span className="text-[10px] text-zinc-400 hidden md:inline">CREDITS</span>
            </button>
          )}

          {/* Download Active File */}
          <button
            onClick={handleDownloadActiveFile}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-600 text-zinc-300 hover:text-white text-xs font-mono font-medium rounded-lg transition-all active:scale-95 glow-subtle"
            title={`Download ${activeFile?.name}`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>SAVE FILE</span>
          </button>

          {/* Export Full ZIP */}
          <button
            onClick={handleExportZip}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-zinc-200 text-black text-xs font-bold font-mono rounded-lg shadow-sm active:scale-95 transition-all glow-subtle"
            title="Download entire project as a .ZIP archive"
          >
            {copiedZip ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Download className="w-3.5 h-3.5 stroke-[2.5]" />}
            <span>{copiedZip ? 'ARCHIVE CREATED' : 'EXPORT .ZIP'}</span>
          </button>
        </div>
      </header>

      {/* Main Studio Body: Split View */}
      <div className="flex-1 flex overflow-hidden bg-black relative">
        {/* Left Column: File Explorer & Project Assets with Drag & Drop */}
        {showFilesColumn && (
          <aside
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingFiles(true);
            }}
            onDragLeave={() => setIsDraggingFiles(false)}
            onDrop={handleFileDrop}
            className={`w-64 border-r border-zinc-800 bg-zinc-950 flex flex-col shrink-0 transition-colors ${
              isDraggingFiles ? 'bg-zinc-900 border-zinc-500 ring-2 ring-zinc-400 inset-0' : ''
            }`}
          >
            <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-white" /> PROJECT FILES ({project.files.length})
              </span>
              <div className="flex items-center gap-1">
                <label
                  className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded cursor-pointer transition-colors"
                  title="Upload / Import Files to Project"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <input
                    type="file"
                    multiple
                    accept=".html,.css,.js,.json,.svg,.txt,.md,.tsx,.jsx,.ts"
                    onChange={handleImportLocalFiles}
                    className="hidden"
                  />
                </label>

                <button
                  onClick={() => setIsCreatingFile(!isCreatingFile)}
                  className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded transition-colors"
                  title="Add New File"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Drag and Drop Visual Zone Indicator */}
            {isDraggingFiles && (
              <div className="p-4 m-2 border-2 border-dashed border-zinc-500 rounded-xl bg-zinc-900 text-center space-y-1">
                <Upload className="w-5 h-5 text-white mx-auto animate-bounce" />
                <div className="text-xs font-mono font-bold text-white">DROP FILES HERE</div>
                <div className="text-[10px] text-zinc-400">Import HTML, CSS, JS, TSX into project</div>
              </div>
            )}

            {/* New File Inline Form */}
            {isCreatingFile && (
              <form onSubmit={handleCreateFile} className="p-2 border-b border-zinc-800 bg-black">
                <input
                  type="text"
                  autoFocus
                  placeholder="e.g. numbers.html or dashboard.tsx"
                  value={newFileNameInput}
                  onChange={(e) => setNewFileNameInput(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-white font-mono"
                />
                <p className="text-[10px] text-zinc-500 font-mono mt-1">Press Enter to create file</p>
              </form>
            )}

            {/* Files List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {project.files.map((file) => {
                const isActive = file.name === activeFileName;
                const isCurrentPreview = file.name === activePreviewFileName;
                return (
                  <div
                    key={file.name}
                    onClick={() => setActiveFileName(file.name)}
                    className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-mono cursor-pointer group transition-all glow-subtle ${
                      isActive
                        ? 'bg-zinc-900 text-white font-bold border border-zinc-600 shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate flex-1">
                      <FileCode
                        className={`w-4 h-4 shrink-0 ${
                          file.name.endsWith('.tsx')
                            ? 'text-blue-400'
                            : file.name.endsWith('.html')
                            ? 'text-emerald-400'
                            : isActive
                            ? 'text-white'
                            : 'text-zinc-600'
                        }`}
                      />
                      {editingFileName === file.name ? (
                        <form onSubmit={(e) => handleRenameFile(file.name, e)} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            autoFocus
                            value={renameInput}
                            onChange={(e) => setRenameInput(e.target.value)}
                            onBlur={(e) => handleRenameFile(file.name, e)}
                            className="bg-black border border-zinc-500 rounded px-1 text-xs text-white w-28"
                          />
                        </form>
                      ) : (
                        <div className="truncate flex items-center gap-1.5">
                          <span className="truncate">{file.name}</span>
                          {isCurrentPreview && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" title="Active in Preview" />
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* Individual File Download */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadSingleFile(file);
                        }}
                        className="p-1 text-zinc-500 hover:text-white"
                        title={`Download ${file.name}`}
                      >
                        <Download className="w-3 h-3" />
                      </button>

                      {/* Rename File */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingFileName(file.name);
                          setRenameInput(file.name);
                        }}
                        className="p-1 text-zinc-500 hover:text-white"
                        title="Rename"
                      >
                        <Sliders className="w-3 h-3" />
                      </button>

                      {/* Delete File */}
                      {project.files.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFile(file.name);
                          }}
                          className="p-1 text-zinc-500 hover:text-rose-400"
                          title="Delete File"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick Presets & Boilerplates */}
            <div className="p-3 border-t border-zinc-800 bg-black/60 space-y-2">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">QUICK SNIPPETS</span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() =>
                    handleUpdateFileContent(
                      activeFile.content +
                        '\n<button class="px-4 py-2 bg-white text-black font-bold text-xs rounded-xl hover:bg-zinc-200">Action</button>'
                    )
                  }
                  className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[10px] font-mono text-zinc-400 hover:text-white rounded"
                >
                  + Tailwind Btn
                </button>
                <button
                  onClick={() =>
                    handleUpdateFileContent(
                      activeFile.content +
                        '\n<div class="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 text-white"><h3 class="font-bold">Card</h3></div>'
                    )
                  }
                  className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[10px] font-mono text-zinc-400 hover:text-white rounded"
                >
                  + Bento Card
                </button>
              </div>
            </div>
          </aside>
        )}

        {/* Middle Column: Code Editor + Highlight Action Bar + Diagnostics Radar */}
        {showEditorColumn && (
          <div className="flex-1 flex flex-col border-r border-zinc-800 bg-black min-w-[320px] relative">
            {/* File Tab Bar with Diagnostics Status */}
            <div className="h-10 border-b border-zinc-800 bg-zinc-950 px-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
                  <FileCode className="w-3.5 h-3.5 text-zinc-400" /> {activeFile.name}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 uppercase font-mono border border-zinc-800">
                  {activeFile.language}
                </span>
                {diagnostics.length > 0 && (
                  <span className="px-2 py-0.5 rounded bg-amber-950/80 border border-amber-800 text-amber-300 font-mono text-[10px] flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    <span>{diagnostics.length} diagnostic issue(s)</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {diagnostics.length > 0 && (
                  <button
                    onClick={handleFixAllDiagnostics}
                    disabled={isFixingAllDiagnostics}
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono text-black font-bold bg-amber-400 hover:bg-amber-300 rounded transition-all active:scale-95 shadow"
                    title="Fix all detected errors and diagnostics automatically using AI credits"
                  >
                    {isFixingAllDiagnostics ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                    <span>{isFixingAllDiagnostics ? 'FIXING ERRORS...' : 'FIX ALL ERRORS'}</span>
                  </button>
                )}

                <button
                  onClick={handleCopyBundleHtml}
                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono text-zinc-300 bg-zinc-900 hover:bg-zinc-800 rounded border border-zinc-800 hover:border-zinc-600 transition-colors"
                >
                  {copied ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'COPIED' : 'COPY ALL'}</span>
                </button>
              </div>
            </div>

            {/* Highlight Selection Floating Toolbar & Quick Editor */}
            {selectedCodeText && (
              <div className="bg-zinc-900 border-b border-zinc-700 p-2 px-3 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-white shadow-xl animate-in slide-in-from-top-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 text-[10px] font-bold">
                    HIGHLIGHTED ({selectedCodeText.length} chars)
                  </span>
                  <span className="text-zinc-400 text-[11px] max-w-xs truncate">
                    "{selectedCodeText.slice(0, 40)}..."
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-1 justify-end">
                  <input
                    type="text"
                    placeholder="Instructions for highlighted snippet (e.g. 'Add hover animation')..."
                    value={selectionPrompt}
                    onChange={(e) => setSelectionPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAiModifySelection();
                      }
                    }}
                    className="bg-black border border-zinc-700 rounded px-2 py-1 text-xs text-white placeholder-zinc-500 w-64 focus:outline-none focus:border-white font-mono"
                  />

                  <button
                    onClick={() => handleAiModifySelection()}
                    disabled={isAiSelectionFixing}
                    className="px-3 py-1 bg-white hover:bg-zinc-200 text-black font-bold rounded text-xs flex items-center gap-1 transition-all active:scale-95"
                    title="Apply AI instruction to highlighted code snippet"
                  >
                    {isAiSelectionFixing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    <span>{isAiSelectionFixing ? 'EDITING...' : 'APPLY TO SELECTION'}</span>
                  </button>

                  <button
                    onClick={() => handleAiModifySelection('Fix all syntax issues, format cleanly, and remove any bugs in this selection.')}
                    disabled={isAiSelectionFixing}
                    className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-xs flex items-center gap-1 transition-colors"
                    title="Fix syntax in highlighted selection"
                  >
                    <Wand2 className="w-3 h-3" />
                    <span>FIX SELECTION</span>
                  </button>
                </div>
              </div>
            )}

            {/* Selection Success Toast */}
            {selectionActionSuccess && (
              <div className="bg-emerald-950 border-b border-emerald-800 text-emerald-200 px-3 py-1 text-xs font-mono flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>{selectionActionSuccess}</span>
              </div>
            )}

            {/* Editor Area with Textarea Selection Support */}
            <div className="flex-1 relative font-mono text-xs bg-black p-3 overflow-hidden">
              <textarea
                ref={textareaRef}
                value={activeFile.content}
                onChange={(e) => handleUpdateFileContent(e.target.value)}
                onSelect={handleTextareaSelect}
                onMouseUp={handleTextareaSelect}
                onKeyUp={handleTextareaSelect}
                className="w-full h-full bg-transparent text-zinc-200 focus:outline-none resize-none font-mono leading-relaxed selection:bg-zinc-800"
                spellCheck={false}
              />
            </div>

            {/* AI Build & Generator Console */}
            <div className="border-t border-zinc-800 bg-zinc-950 p-3 space-y-2.5">
              {/* Quick Prompts Row */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px] font-mono text-zinc-400">
                <span className="text-zinc-600 shrink-0 uppercase">AI PROMPTS:</span>
                <button
                  onClick={() =>
                    handleAiCodeModify(
                      'Enhance this design into a luxury monochromatic Apple-like web landing page with high contrast, elegant typography, responsive grid cards, and clean buttons.'
                    )
                  }
                  disabled={isAiGenerating}
                  className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-600 text-zinc-300 shrink-0 glow-subtle transition-colors"
                >
                  ⚡ Polish to Apple Aesthetic
                </button>
                <button
                  onClick={() =>
                    handleAiCodeModify(
                      'Add an interactive data table with search filter and local state sorting into this page.'
                    )
                  }
                  disabled={isAiGenerating}
                  className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-600 text-zinc-300 shrink-0 glow-subtle transition-colors"
                >
                  📊 Add Searchable Data Table
                </button>
                <button
                  onClick={() =>
                    handleAiCodeModify(
                      'Audit this code for errors, improve responsive mobile styling, and optimize DOM performance.'
                    )
                  }
                  disabled={isAiGenerating}
                  className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-600 text-zinc-300 shrink-0 glow-subtle transition-colors"
                >
                  🛠️ Fix Bugs & Mobile View
                </button>
              </div>

              {/* AI Prompt Input Bar */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAiCodeModify();
                }}
                className="flex items-center gap-2"
              >
                <div className="relative flex-1">
                  <Sparkles className="w-3.5 h-3.5 text-white absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder={`Describe changes for ${activeFile.name} (e.g. "Add dark mode navbar and numbers.html router link")...`}
                    className="w-full bg-black border border-zinc-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 font-mono glow-subtle"
                  />
                </div>

                {/* Credit Status & Prompt Action */}
                {credits !== undefined && (
                  <button
                    type="button"
                    onClick={onOpenCreditStore}
                    className="hidden sm:flex items-center gap-1 px-2 py-2 rounded-xl bg-black border border-zinc-800 hover:border-zinc-600 text-xs font-mono text-zinc-300 transition-colors"
                    title="Prompt Credits Balance - Click to Refuel"
                  >
                    <Zap className="w-3.5 h-3.5 text-white fill-white" />
                    <span className="font-bold text-white">{credits}</span>
                    <span className="text-[10px] text-zinc-500">CREDITS</span>
                  </button>
                )}

                <button
                  type="submit"
                  disabled={isAiGenerating || !aiPrompt.trim()}
                  className="px-4 py-2 bg-white hover:bg-zinc-200 disabled:opacity-30 text-black rounded-xl text-xs font-bold font-mono flex items-center gap-1.5 transition-all active:scale-95 shadow-sm glow-subtle shrink-0"
                >
                  {isAiGenerating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>{isAiGenerating ? 'SYNTHESIZING...' : 'AI BUILD'}</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Right Column: Live Web App Sandbox + Browser Router Navigation Bar */}
        {showPreviewColumn && (
          <div className="flex-1 flex flex-col bg-zinc-950 overflow-hidden min-w-[340px]">
            {/* Top Preview Bar */}
            <div className="h-10 border-b border-zinc-800 bg-zinc-950 px-4 flex items-center justify-between text-xs font-mono text-zinc-400 shrink-0">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <span className="font-bold text-white text-[11px] uppercase tracking-wider">LIVE APPLICATION VIEWPORT</span>

                {/* Edit Mode Toggle Button */}
                <button
                  onClick={() => {
                    setIsEditMode(!isEditMode);
                    setSelectedElement(null);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all glow-subtle ${
                    isEditMode
                      ? 'bg-emerald-400 text-black shadow-lg shadow-emerald-400/20 ring-1 ring-emerald-300'
                      : 'bg-zinc-900 text-zinc-300 hover:text-white border border-zinc-800'
                  }`}
                  title="Toggle visual WYSIWYG edit mode"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>{isEditMode ? 'EDIT MODE: ACTIVE' : 'VISUAL EDIT MODE'}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowConsole(!showConsole)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-colors ${
                    showConsole ? 'bg-zinc-800 text-white border-zinc-600' : 'text-zinc-500 border-zinc-800 hover:text-white'
                  }`}
                >
                  CONSOLE ({logs.length})
                </button>
                <span className="text-[10px] text-zinc-500 uppercase">SANDBOX ISOLATED</span>
              </div>
            </div>

            {/* Browser Navigation Bar (Back, Forward, Reload, Address Bar & Page Switcher Pills) */}
            <div className="border-b border-zinc-800 bg-zinc-900/90 p-2 px-3 flex flex-wrap items-center gap-2 text-xs font-mono">
              <div className="flex items-center gap-1">
                <button
                  onClick={handlePreviewBack}
                  disabled={previewHistoryIndex <= 0}
                  className="p-1 rounded text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
                  title="Navigate Back in Preview"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handlePreviewForward}
                  disabled={previewHistoryIndex >= previewHistory.length - 1}
                  className="p-1 rounded text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
                  title="Navigate Forward in Preview"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setKey((k) => k + 1)}
                  className="p-1 rounded text-zinc-400 hover:text-white transition-colors"
                  title="Reload Active Viewport"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* URL Address Bar */}
              <div className="flex-1 min-w-[200px] flex items-center gap-1.5 bg-black border border-zinc-800 rounded-lg px-2.5 py-1">
                <Link2 className="w-3 h-3 text-zinc-500 shrink-0" />
                <input
                  type="text"
                  value={previewUrlInput}
                  onChange={(e) => setPreviewUrlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const clean = previewUrlInput.replace(/^http:\/\/localhost:3000\//, '').replace(/^\//, '');
                      navigatePreviewTo(clean || 'index.html');
                    }
                  }}
                  className="w-full bg-transparent text-zinc-200 text-xs font-mono focus:outline-none"
                />
              </div>

              {/* Quick Page Navigation Switcher Pills */}
              <div className="flex items-center gap-1 overflow-x-auto">
                <span className="text-[10px] text-zinc-500 uppercase shrink-0">PAGES:</span>
                {project.files
                  .filter((f) => f.name.endsWith('.html') || f.name.endsWith('.tsx') || f.name.endsWith('.jsx'))
                  .map((page) => {
                    const isCur = page.name === activePreviewFileName;
                    return (
                      <button
                        key={page.name}
                        onClick={() => navigatePreviewTo(page.name)}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono shrink-0 transition-colors ${
                          isCur
                            ? 'bg-white text-black font-bold shadow-sm'
                            : 'bg-black text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                        }`}
                      >
                        {page.name}
                      </button>
                    );
                  })}
              </div>
            </div>

          {/* Visual Edit Mode Active Inspector Bar */}
          {isEditMode && (
            <div className="bg-zinc-900 border-b border-zinc-800 p-2.5 px-4 flex flex-col gap-2 font-mono text-xs text-white animate-in slide-in-from-top-2 duration-200">
              {/* Top Row: Pending Edits status + SAVE & DISCARD Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-zinc-800/80">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-400 font-bold text-[10px]">
                    EDIT MODE ACTIVE
                  </span>
                  <span className="text-zinc-300 text-xs">
                    {pendingEditsCount > 0 ? (
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" /> {pendingEditsCount} unsaved visual edit(s) pending
                      </span>
                    ) : (
                      'Click & type directly on any element in the preview canvas, or use inspector controls below:'
                    )}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {pendingEditsCount > 0 && (
                    <button
                      onClick={handleDiscardVisualEdits}
                      className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-mono flex items-center gap-1 transition-colors"
                      title="Discard staged edits and reload preview"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>DISCARD</span>
                    </button>
                  )}

                  <button
                    onClick={handleSaveVisualEdits}
                    className={`px-4 py-1.5 rounded-lg font-bold text-xs font-mono flex items-center gap-1.5 transition-all shadow-md active:scale-95 ${
                      pendingEditsCount > 0
                        ? 'bg-emerald-400 text-black hover:bg-emerald-300 shadow-emerald-400/20 ring-1 ring-emerald-300'
                        : 'bg-white text-black hover:bg-zinc-200'
                    }`}
                    title="Commit all staged visual edits directly to index.html source code"
                  >
                    <Save className="w-4 h-4" />
                    <span>SAVE & APPLY TO SOURCE CODE</span>
                  </button>
                </div>
              </div>

              {/* Toast Notification when Saved */}
              {showSaveToast && (
                <div className="bg-emerald-950 border border-emerald-700 text-emerald-200 px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-2 animate-in fade-in duration-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Success! All visual edits have been committed to index.html.</span>
                </div>
              )}

              {/* Inspector Controls for Selected Element */}
              {selectedElement && (
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800 text-[10px] font-bold">
                      &lt;{selectedElement.tagName}&gt;
                    </span>

                    {/* Inline Text Field */}
                    <div className="flex items-center gap-1.5 bg-black border border-zinc-800 rounded-lg px-2 py-1">
                      <span className="text-[10px] text-zinc-500">TEXT:</span>
                      <input
                        type="text"
                        value={selectedElement.innerText}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedElement((prev) => (prev ? { ...prev, innerText: val } : null));
                          iframeRef.current?.contentWindow?.postMessage(
                            { type: 'APPLY_ELEMENT_EDIT', text: val },
                            '*'
                          );
                        }}
                        className="bg-transparent text-white font-mono text-xs w-48 focus:outline-none"
                      />
                    </div>

                    {/* Font Size Quick Buttons */}
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-zinc-500">SIZE:</span>
                      {['12px', '16px', '24px', '36px', '48px'].map((sz) => (
                        <button
                          key={sz}
                          onClick={() => {
                            iframeRef.current?.contentWindow?.postMessage(
                              { type: 'APPLY_ELEMENT_EDIT', fontSize: sz },
                              '*'
                            );
                          }}
                          className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] font-mono text-zinc-300"
                        >
                          {sz}
                        </button>
                      ))}
                    </div>

                    {/* Text Color Selection */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-zinc-500">TEXT COLOR:</span>
                      <div className="flex items-center gap-1">
                        {['#ffffff', '#000000', '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7'].map((c) => (
                          <button
                            key={c}
                            onClick={() => {
                              iframeRef.current?.contentWindow?.postMessage(
                                { type: 'APPLY_ELEMENT_EDIT', textColor: c },
                                '*'
                              );
                            }}
                            className="w-4 h-4 rounded-full border border-zinc-700 hover:scale-125 transition-transform"
                            style={{ backgroundColor: c }}
                          />
                        ))}
                        <input
                          type="color"
                          onChange={(e) => {
                            iframeRef.current?.contentWindow?.postMessage(
                              { type: 'APPLY_ELEMENT_EDIT', textColor: e.target.value },
                              '*'
                            );
                          }}
                          className="w-5 h-5 bg-transparent border-0 cursor-pointer rounded"
                          title="Custom Text Color"
                        />
                      </div>
                    </div>

                    {/* Background Color Selection */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-zinc-500">BG COLOR:</span>
                      <div className="flex items-center gap-1">
                        {['#000000', '#ffffff', '#18181b', '#022c22', '#082f49', '#450a0a'].map((c) => (
                          <button
                            key={c}
                            onClick={() => {
                              iframeRef.current?.contentWindow?.postMessage(
                                { type: 'APPLY_ELEMENT_EDIT', bgColor: c },
                                '*'
                              );
                            }}
                            className="w-4 h-4 rounded-full border border-zinc-700 hover:scale-125 transition-transform"
                            style={{ backgroundColor: c }}
                          />
                        ))}
                        <input
                          type="color"
                          onChange={(e) => {
                            iframeRef.current?.contentWindow?.postMessage(
                              { type: 'APPLY_ELEMENT_EDIT', bgColor: e.target.value },
                              '*'
                            );
                          }}
                          className="w-5 h-5 bg-transparent border-0 cursor-pointer rounded"
                          title="Custom Background Color"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Element Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        iframeRef.current?.contentWindow?.postMessage(
                          { type: 'APPLY_ELEMENT_EDIT', action: 'duplicate' },
                          '*'
                        );
                      }}
                      className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] rounded flex items-center gap-1"
                      title="Duplicate Selected Element"
                    >
                      <Copy className="w-3 h-3" /> DUPLICATE
                    </button>
                    <button
                      onClick={() => {
                        iframeRef.current?.contentWindow?.postMessage(
                          { type: 'APPLY_ELEMENT_EDIT', action: 'delete' },
                          '*'
                        );
                        setSelectedElement(null);
                      }}
                      className="px-2.5 py-1 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 text-[10px] rounded flex items-center gap-1"
                      title="Delete Selected Element"
                    >
                      <Trash2 className="w-3 h-3" /> DELETE
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Interactive Preview Canvas */}
          <div className="flex-1 bg-black flex items-center justify-center p-3 overflow-hidden relative">
            <div
              className={`h-full ${deviceWidthClass} bg-white rounded-xl shadow-2xl overflow-hidden transition-all duration-300 border border-zinc-800 flex flex-col`}
            >
              <iframe
                ref={iframeRef}
                key={key}
                title="App Studio Live Output"
                srcDoc={generateBundleSrcDoc()}
                className="w-full h-full border-0 bg-white"
                sandbox="allow-scripts allow-modals allow-forms allow-same-origin"
              />
            </div>
          </div>

          {/* Console Drawer */}
          {showConsole && (
            <div className="h-40 border-t border-zinc-800 bg-black p-3 overflow-y-auto font-mono text-xs text-zinc-300 space-y-1">
              <div className="flex items-center justify-between pb-1 border-b border-zinc-900 text-[10px] text-zinc-500 uppercase">
                <span>SANDBOX TELEMETRY LOGS</span>
                <button onClick={() => setLogs([])} className="hover:text-white">
                  CLEAR LOGS
                </button>
              </div>
              {logs.length === 0 ? (
                <div className="text-zinc-600 text-[11px] pt-2">No runtime messages received.</div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="text-zinc-400 leading-snug break-all">
                    <span className="text-zinc-600">[{new Date().toLocaleTimeString()}]</span> {log}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        )}

        {/* Fourth Column: Session Chat Matrix Window */}
        {showChatColumn && (
          <div
            className={`${
              chatSize === 'fullscreen'
                ? 'absolute inset-0 z-40 bg-black flex flex-col'
                : chatSize === 'expanded'
                ? 'w-[540px] xl:w-[640px] shrink-0 border-l border-zinc-800 bg-zinc-950 flex flex-col'
                : 'w-80 xl:w-96 shrink-0 border-l border-zinc-800 bg-zinc-950 flex flex-col'
            } overflow-hidden transition-all duration-200 shadow-2xl`}
          >
            {/* Chat Matrix Top Bar */}
            <div className="h-10 border-b border-zinc-800 bg-zinc-950 px-3 flex items-center justify-between text-xs font-mono shrink-0">
              <div className="flex items-center gap-2 truncate">
                <MessageSquare className="w-3.5 h-3.5 text-white shrink-0" />
                <span className="font-bold text-white text-[11px] truncate">
                  {activeSession?.title || 'Chat Matrix'}
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800 shrink-0">
                  {activePersona?.name || 'Quantum V1'}
                </span>
              </div>

              {/* Expansion & Close Options */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() =>
                    setChatSize(
                      chatSize === 'normal' ? 'expanded' : chatSize === 'expanded' ? 'fullscreen' : 'normal'
                    )
                  }
                  className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
                  title={
                    chatSize === 'fullscreen'
                      ? 'Restore Window Size'
                      : chatSize === 'normal'
                      ? 'Expand Chat Window to Wide'
                      : 'Expand Chat to Fullscreen'
                  }
                >
                  {chatSize === 'fullscreen' ? (
                    <Minimize2 className="w-3.5 h-3.5 text-white" />
                  ) : (
                    <Maximize2 className="w-3.5 h-3.5 text-zinc-300" />
                  )}
                </button>

                <button
                  onClick={() => setShowChatColumn(false)}
                  className="p-1 rounded text-zinc-500 hover:text-white hover:bg-zinc-900 transition-colors"
                  title="Hide Chat Column"
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Message Stream */}
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              {!activeSession || activeSession.messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
                    <MessageSquare className="w-5 h-5 text-zinc-300" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-white font-mono">SESSION CHAT MATRIX READY</h4>
                    <p className="text-[11px] text-zinc-400 font-sans leading-relaxed max-w-xs">
                      Type instructions at the bottom to have AIX Alpha synthesize and inject code directly into your active files.
                    </p>
                  </div>
                </div>
              ) : (
                activeSession.messages.map((msg) => (
                  <ChatMessageItem
                    key={msg.id}
                    message={msg}
                    persona={
                      activePersona || {
                        id: 'aix-alpha-quantum-v1',
                        name: 'AIX-ALPHA-QUANTUM-V1.0',
                        tagline: 'Quantum State Vector AI',
                        description: '',
                        avatarIcon: 'Cpu',
                        systemInstruction: '',
                        defaultSearchGrounding: true,
                        modelAlias: 'claude-haiku-5-5',
                        temperature: 0.5,
                        voiceName: 'Puck',
                      }
                    }
                    onOpenCodePreview={(code) => handleUpdateFileContent(code)}
                    onOpenAppStudio={(code) => code && handleUpdateFileContent(code)}
                  />
                ))
              )}

              {isLoading && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs font-mono text-zinc-300 animate-pulse">
                  <RefreshCw className="w-3.5 h-3.5 text-white animate-spin" />
                  <span>AIX Quantum Engine synthesizing...</span>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Quick Prompts Bar */}
            <div className="px-3 pt-2 border-t border-zinc-900 bg-black/60 flex items-center gap-1.5 overflow-x-auto text-[10px] font-mono text-zinc-400 shrink-0">
              <button
                onClick={() =>
                  handleSendStudioChatMessage(
                    undefined,
                    `Enhance file ${activeFile.name} with an ultra-modern dark theme, Apple typography, and smooth transitions.`
                  )
                }
                className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 shrink-0 transition-colors"
              >
                ✨ Polish Design
              </button>
              <button
                onClick={() =>
                  handleSendStudioChatMessage(
                    undefined,
                    `Audit ${activeFile.name} for any syntax errors, logic bugs, or unhandled events and provide the complete fixed file.`
                  )
                }
                className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 shrink-0 transition-colors"
              >
                🛠️ Fix Bugs
              </button>
              <button
                onClick={() =>
                  handleSendStudioChatMessage(
                    undefined,
                    `Add an interactive particle canvas animation to this project in JavaScript.`
                  )
                }
                className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 shrink-0 transition-colors"
              >
                🌌 Add FX
              </button>
            </div>

            {/* Bottom Input Area */}
            <form
              onSubmit={handleSendStudioChatMessage}
              className="p-3 bg-zinc-950 border-t border-zinc-800 flex items-center gap-2 shrink-0"
            >
              <input
                type="text"
                value={studioChatInput}
                onChange={(e) => setStudioChatInput(e.target.value)}
                placeholder={`Type in session chat...`}
                className="flex-1 bg-black border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 font-mono glow-subtle"
              />
              <button
                type="submit"
                disabled={isLoading || !studioChatInput.trim()}
                className="px-3 py-2 bg-white hover:bg-zinc-200 disabled:opacity-30 text-black rounded-xl text-xs font-bold font-mono transition-all flex items-center gap-1 shadow-sm active:scale-95 shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">SEND</span>
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
