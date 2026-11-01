import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Play,
  Code,
  Copy,
  Check,
  Plus,
  Trash2,
  FileText,
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
  Zap,
} from 'lucide-react';

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
    id: 'preset_saas',
    title: 'SaaS Web Application',
    description: 'Modern landing page with Tailwind CSS, hero animations, and interactive dashboard',
    files: [
      {
        name: 'index.html',
        language: 'html',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>NexusAI Platform</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="styles.css" />
</head>
<body class="bg-slate-950 text-slate-100 font-sans min-h-screen">
  <header class="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
    <div class="flex items-center gap-2">
      <div class="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white">N</div>
      <span class="font-bold text-lg">NexusAI Studio</span>
    </div>
    <button id="cta-btn" onclick="handleStart()" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-medium text-sm transition-all shadow-lg shadow-indigo-600/30">
      Launch App
    </button>
  </header>

  <main class="max-w-4xl mx-auto px-6 py-16 text-center space-y-6">
    <span class="px-3 py-1 rounded-full text-xs font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
      v2.4 Powered by AIX-ALPHA
    </span>
    <h1 class="text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
      Build Web Apps at <span class="text-indigo-400">Quantum Speed</span>
    </h1>
    <p class="text-slate-400 text-base max-w-xl mx-auto">
      Create multi-file web applications, full HTML sites, interactive dashboards, and client-side micro-services with real-time preview.
    </p>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-8">
      <div class="p-5 rounded-2xl bg-slate-900 border border-slate-800 text-left">
        <h3 class="font-bold text-indigo-400 mb-1">⚡ Fast Rendering</h3>
        <p class="text-xs text-slate-400">Instant HTML/CSS/JS DOM compilation with hot reloading.</p>
      </div>
      <div class="p-5 rounded-2xl bg-slate-900 border border-slate-800 text-left">
        <h3 class="font-bold text-emerald-400 mb-1">📁 Multi-File</h3>
        <p class="text-xs text-slate-400">Seamless linking of external stylesheets and scripts.</p>
      </div>
      <div class="p-5 rounded-2xl bg-slate-900 border border-slate-800 text-left">
        <h3 class="font-bold text-amber-400 mb-1">🎨 Tailwind Ready</h3>
        <p class="text-xs text-slate-400">Pre-loaded CDN utilities for professional modern UI design.</p>
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
        content: `/* Custom App Styles */
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

#cta-btn:active {
  transform: scale(0.96);
}`,
      },
      {
        name: 'app.js',
        language: 'javascript',
        content: `// Interactive Application Logic
console.log('NexusAI App initialized successfully!');

function handleStart() {
  alert('Welcome to your custom Web App created in AIX App Studio!');
}`,
      },
    ],
  },
  {
    id: 'preset_game',
    title: 'HTML5 Arcade Game',
    description: 'Interactive HTML5 Canvas game with controls and score keeping',
    files: [
      {
        name: 'index.html',
        language: 'html',
        content: `<!DOCTYPE html>
<html>
<head>
  <title>Cyber Orb Dodge</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-950 text-white flex flex-col items-center justify-center min-h-screen p-4">
  <h1 class="text-2xl font-bold mb-2 text-indigo-400">Cyber Orb Dodge</h1>
  <p class="text-xs text-slate-400 mb-4">Move your cursor/touch inside canvas to avoid falling red obstacles!</p>
  <div id="score" class="text-sm font-mono mb-2 text-emerald-400">Score: 0</div>
  <canvas id="gameCanvas" width="400" height="400" class="border border-slate-800 rounded-xl bg-slate-900 shadow-2xl cursor-none"></canvas>
  <script src="game.js"></script>
</body>
</html>`,
      },
      {
        name: 'game.js',
        language: 'javascript',
        content: `const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let score = 0;

let player = { x: 200, y: 350, radius: 12, color: '#6366f1' };
let obstacles = [];

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  player.x = e.clientX - rect.left;
  player.y = e.clientY - rect.top;
});

function spawnObstacle() {
  obstacles.push({
    x: Math.random() * (canvas.width - 20) + 10,
    y: 0,
    radius: Math.random() * 10 + 8,
    speed: Math.random() * 3 + 2,
    color: '#ef4444'
  });
}

setInterval(spawnObstacle, 600);

function update() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Draw Player
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fillStyle = player.color;
  ctx.fill();
  
  // Update & Draw Obstacles
  for (let i = 0; i < obstacles.length; i++) {
    let o = obstacles[i];
    o.y += o.speed;
    
    ctx.beginPath();
    ctx.arc(o.x, o.y, o.radius, 0, Math.PI * 2);
    ctx.fillStyle = o.color;
    ctx.fill();
    
    // Collision check
    let dist = Math.hypot(player.x - o.x, player.y - o.y);
    if (dist < player.radius + o.radius) {
      score = 0;
      obstacles = [];
      document.getElementById('score').innerText = 'Game Over! Resetting Score...';
      return requestAnimationFrame(update);
    }
    
    if (o.y > canvas.height) {
      obstacles.splice(i, 1);
      score += 10;
      document.getElementById('score').innerText = 'Score: ' + score;
    }
  }
  
  requestAnimationFrame(update);
}

update();`,
      },
    ],
  },
];

interface AppStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCode?: string;
  initialLanguage?: string;
}

export const AppStudioModal: React.FC<AppStudioModalProps> = ({
  isOpen,
  onClose,
  initialCode,
  initialLanguage,
}) => {
  const [project, setProject] = useState<AppProject>(DEFAULT_PROJECT_PRESETS[0]);
  const [activeFileName, setActiveFileName] = useState<string>('index.html');
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [newFileNameInput, setNewFileNameInput] = useState('');
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [copied, setCopied] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const [key, setKey] = useState(0); // for refresh

  // If initial code passed from chat
  useEffect(() => {
    if (initialCode) {
      const ext = initialLanguage === 'css' ? 'css' : initialLanguage === 'js' || initialLanguage === 'javascript' ? 'js' : 'html';
      const name = `index.${ext}`;
      setProject({
        id: `custom_${Date.now()}`,
        title: 'Chat Imported App',
        description: 'Web application generated from conversation code block',
        files: [
          {
            name,
            language: initialLanguage || 'html',
            content: initialCode,
          },
          ...(ext !== 'css' ? [{ name: 'styles.css', language: 'css', content: '/* Custom Styles */\nbody { margin: 0; }' }] : []),
          ...(ext !== 'js' ? [{ name: 'app.js', language: 'javascript', content: '// Custom JS' }] : []),
        ],
      });
      setActiveFileName(name);
    }
  }, [initialCode, initialLanguage]);

  if (!isOpen) return null;

  const activeFile = project.files.find((f) => f.name === activeFileName) || project.files[0];

  const handleUpdateFileContent = (newContent: string) => {
    setProject((prev) => ({
      ...prev,
      files: prev.files.map((f) => (f.name === activeFileName ? { ...f, content: newContent } : f)),
    }));
  };

  const handleCreateFile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileNameInput.trim()) return;

    const fileName = newFileNameInput.trim();
    if (project.files.some((f) => f.name === fileName)) {
      alert('File already exists with this name.');
      return;
    }

    const ext = fileName.split('.').pop() || 'html';
    const lang = ext === 'css' ? 'css' : ext === 'js' ? 'javascript' : ext === 'json' ? 'json' : 'html';

    const newFile: AppFile = {
      name: fileName,
      language: lang,
      content: ext === 'html' ? '<!DOCTYPE html>\n<html>\n<body>\n</body>\n</html>' : '',
    };

    setProject((prev) => ({ ...prev, files: [...prev.files, newFile] }));
    setActiveFileName(fileName);
    setNewFileNameInput('');
    setIsCreatingFile(false);
  };

  const handleDeleteFile = (fileName: string) => {
    if (project.files.length <= 1) {
      alert('Project must have at least one file.');
      return;
    }
    const filtered = project.files.filter((f) => f.name !== fileName);
    setProject((prev) => ({ ...prev, files: filtered }));
    if (activeFileName === fileName) {
      setActiveFileName(filtered[0].name);
    }
  };

  // Compile project files into a bundled srcDoc iframe HTML string
  const generateBundleSrcDoc = () => {
    const htmlFile = project.files.find((f) => f.name.endsWith('.html')) || project.files[0];
    const cssFiles = project.files.filter((f) => f.name.endsWith('.css'));
    const jsFiles = project.files.filter((f) => f.name.endsWith('.js'));

    let html = htmlFile?.content || '<html><body></body></html>';

    // Inject inline CSS for external CSS references
    let cssInjections = cssFiles.map((c) => `<style id="app_${c.name}">${c.content}</style>`).join('\n');
    // Inject JS
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

    // Add console interceptor script to catch logs in GUI
    const consoleInterceptor = `<script>
(function() {
  const _log = console.log;
  const _err = console.error;
  console.log = function(...args) {
    _log.apply(console, args);
    window.parent.postMessage({ type: 'CONSOLE_LOG', text: args.join(' ') }, '*');
  };
  console.error = function(...args) {
    _err.apply(console, args);
    window.parent.postMessage({ type: 'CONSOLE_LOG', text: 'ERROR: ' + args.join(' ') }, '*');
  };
})();
</script>`;

    if (html.includes('</head>')) {
      html = html.replace('</head>', `${cssInjections}\n${consoleInterceptor}\n</head>`);
    } else {
      html = `${cssInjections}\n${consoleInterceptor}\n${html}`;
    }

    if (html.includes('</body>')) {
      html = html.replace('</body>', `${jsInjections}\n</body>`);
    } else {
      html += `\n${jsInjections}`;
    }

    return html;
  };

  const handleAiCodeModify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;

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
              content: `Modify or enhance this web app code file (${activeFileName}). 
Instruction: ${aiPrompt}

Current Code:
\`\`\`${activeFile.language}
${activeFile.content}
\`\`\`

Return ONLY the complete raw updated code inside a single code block.`,
            },
          ],
        }),
      });

      const data = await response.json();
      if (data.success && data.text) {
        // extract code block if present
        let cleanCode = data.text;
        const codeBlockMatch = data.text.match(/```(?:\w+)?\n([\s\S]*?)```/);
        if (codeBlockMatch) {
          cleanCode = codeBlockMatch[1];
        }
        handleUpdateFileContent(cleanCode);
        setAiPrompt('');
      }
    } catch (err) {
      console.error('AI Code Modify Error:', err);
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleCopyBundleHtml = () => {
    navigator.clipboard.writeText(generateBundleSrcDoc());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const deviceWidthClass =
    deviceMode === 'mobile' ? 'max-w-[375px]' : deviceMode === 'tablet' ? 'max-w-[768px]' : 'w-full';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-black border border-zinc-800 rounded-2xl w-full max-w-7xl h-[92vh] flex flex-col shadow-2xl overflow-hidden font-mono">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-zinc-800 bg-zinc-950">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white shadow-md">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">{project.title}</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-900 text-zinc-300 border border-zinc-700 uppercase">
                  APP & WEB STUDIO GUI
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 hidden sm:block">{project.description}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Presets dropdown */}
            <select
              value={project.id}
              onChange={(e) => {
                const found = DEFAULT_PROJECT_PRESETS.find((p) => p.id === e.target.value);
                if (found) {
                  setProject(found);
                  setActiveFileName(found.files[0].name);
                }
              }}
              className="bg-zinc-900 border border-zinc-700 text-xs font-mono text-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-zinc-500"
            >
              {DEFAULT_PROJECT_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  TEMPLATE: {p.title.toUpperCase()}
                </option>
              ))}
            </select>

            {/* Device Mode Controls */}
            <div className="hidden sm:flex bg-zinc-900 p-1 rounded-lg border border-zinc-800">
              <button
                onClick={() => setDeviceMode('desktop')}
                className={`p-1.5 rounded text-xs transition-colors ${deviceMode === 'desktop' ? 'bg-white text-black font-bold' : 'text-zinc-400 hover:text-white'}`}
                title="Desktop View"
              >
                <Laptop className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setDeviceMode('tablet')}
                className={`p-1.5 rounded text-xs transition-colors ${deviceMode === 'tablet' ? 'bg-white text-black font-bold' : 'text-zinc-400 hover:text-white'}`}
                title="Tablet View"
              >
                <Tablet className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setDeviceMode('mobile')}
                className={`p-1.5 rounded text-xs transition-colors ${deviceMode === 'mobile' ? 'bg-white text-black font-bold' : 'text-zinc-400 hover:text-white'}`}
                title="Mobile View"
              >
                <Smartphone className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Refresh Frame */}
            <button
              onClick={() => setKey((k) => k + 1)}
              className="p-1.5 bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-lg border border-zinc-700 text-xs transition-colors"
              title="Reload Frame"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Copy Full HTML */}
            <button
              onClick={handleCopyBundleHtml}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-zinc-200 text-black text-xs font-bold rounded-lg shadow-sm active:scale-95 transition-all"
            >
              {copied ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'COPIED' : 'EXPORT BUNDLE'}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-900 rounded-lg ml-1 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Split Grid: Files Sidebar | Code Editor | Live App Preview */}
        <div className="flex-1 flex overflow-hidden bg-black">
          {/* Files Explorer Column */}
          <div className="w-52 border-r border-zinc-800 bg-zinc-950 flex flex-col shrink-0">
            <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-zinc-300" /> PROJECT FILES
              </span>
              <button
                onClick={() => setIsCreatingFile(!isCreatingFile)}
                className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded transition-colors"
                title="Add New File"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* New File Input */}
            {isCreatingFile && (
              <form onSubmit={handleCreateFile} className="p-2 border-b border-zinc-800">
                <input
                  type="text"
                  autoFocus
                  placeholder="e.g. style.css"
                  value={newFileNameInput}
                  onChange={(e) => setNewFileNameInput(e.target.value)}
                  className="w-full bg-black border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-zinc-400"
                />
              </form>
            )}

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {project.files.map((file) => {
                const isActive = file.name === activeFileName;
                return (
                  <div
                    key={file.name}
                    onClick={() => setActiveFileName(file.name)}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono cursor-pointer group transition-all ${
                      isActive
                        ? 'bg-zinc-900 text-white font-semibold border border-zinc-600'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileCode className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-zinc-600'}`} />
                      <span className="truncate">{file.name}</span>
                    </div>

                    {project.files.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFile(file.name);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-500 hover:text-white"
                        title="Delete File"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Middle Column: Interactive Multi-file Code Editor */}
          <div className="flex-1 flex flex-col border-r border-zinc-800 bg-black min-w-[320px]">
            {/* Editor File Tab bar */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 bg-zinc-950">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-white">{activeFile.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 uppercase font-mono border border-zinc-800">
                  {activeFile.language}
                </span>
              </div>
            </div>

            {/* Code Textarea Area */}
            <div className="flex-1 relative font-mono text-xs bg-black p-3 overflow-hidden">
              <textarea
                value={activeFile.content}
                onChange={(e) => handleUpdateFileContent(e.target.value)}
                className="w-full h-full bg-transparent text-zinc-200 focus:outline-none resize-none font-mono leading-relaxed selection:bg-zinc-700"
                spellCheck={false}
              />
            </div>

            {/* AI Assistant Generator Bar inside Code Editor */}
            <form onSubmit={handleAiCodeModify} className="p-2.5 border-t border-zinc-800 bg-zinc-950 flex items-center gap-2">
              <div className="relative flex-1">
                <Terminal className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder={`Instruct AIX-ALPHA to rewrite ${activeFile.name}...`}
                  className="w-full bg-black border border-zinc-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-500 font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={isAiGenerating || !aiPrompt.trim()}
                className="px-3.5 py-1.5 bg-white hover:bg-zinc-200 disabled:opacity-30 text-black rounded-xl text-xs font-bold font-mono flex items-center gap-1.5 transition-all active:scale-95"
              >
                {isAiGenerating ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                <span>APPLY</span>
              </button>
            </form>
          </div>

          {/* Right Column: Live Web App GUI Preview */}
          <div className="flex-1 flex flex-col bg-zinc-950 overflow-hidden min-w-[340px]">
            <div className="px-4 py-2 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between text-xs font-mono text-zinc-400">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <span className="font-bold text-white uppercase tracking-wider text-[11px]">SANDBOX PREVIEW</span>
              </div>
              <span className="text-[10px] text-zinc-500 uppercase">STANDALONE DOM</span>
            </div>

            {/* Iframe Viewport Container */}
            <div className="flex-1 bg-black flex items-center justify-center p-2 overflow-hidden">
              <div className={`h-full ${deviceWidthClass} bg-white rounded-xl shadow-2xl overflow-hidden transition-all duration-300 border border-zinc-800`}>
                <iframe
                  key={key}
                  title="App Studio Live Output"
                  srcDoc={generateBundleSrcDoc()}
                  className="w-full h-full border-0"
                  sandbox="allow-scripts allow-modals allow-forms"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
