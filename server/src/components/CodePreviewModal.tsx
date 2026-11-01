import React, { useState } from 'react';
import { X, Play, Code, Copy, Check, Maximize2, RefreshCw } from 'lucide-react';

interface CodePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  code: string;
  language: string;
}

export const CodePreviewModal: React.FC<CodePreviewModalProps> = ({
  isOpen,
  onClose,
  code,
  language,
}) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
  const [copied, setCopied] = useState(false);
  const [key, setKey] = useState(0); // for iframe reload

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Generate full HTML doc for iframe if code is HTML/SVG/JS
  const getIframeSrc = () => {
    if (language.toLowerCase() === 'svg') {
      return `<!DOCTYPE html><html><body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#0f172a;">${code}</body></html>`;
    }
    if (code.includes('<html') || code.includes('<!DOCTYPE html>')) {
      return code;
    }
    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
      body { margin: 0; padding: 1.5rem; font-family: system-ui, -apple-system, sans-serif; background-color: #0f172a; color: #f8fafc; }
    </style>
  </head>
  <body>
    ${code}
  </body>
</html>`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-black border border-zinc-800 rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden font-mono">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-zinc-900 text-white border border-zinc-700">
              <Code className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Live Artifact Sandbox</h3>
              <p className="text-[11px] text-zinc-500">Executing {language.toUpperCase()} execution matrix</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800">
              <button
                onClick={() => setActiveTab('preview')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  activeTab === 'preview'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Play className="w-3.5 h-3.5 fill-current" /> PREVIEW
              </button>
              <button
                onClick={() => setActiveTab('code')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  activeTab === 'code'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Code className="w-3.5 h-3.5" /> SOURCE
              </button>
            </div>

            {activeTab === 'preview' && (
              <button
                onClick={() => setKey((prev) => prev + 1)}
                title="Refresh Sandbox"
                className="p-1.5 text-zinc-400 hover:text-white bg-zinc-950 hover:bg-zinc-900 rounded-lg border border-zinc-800 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-300 bg-zinc-950 hover:bg-zinc-900 rounded-lg border border-zinc-800 hover:border-zinc-600 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-white stroke-[3]" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'COPIED' : 'COPY'}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-900 rounded-lg transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 bg-black relative overflow-hidden">
          {activeTab === 'preview' ? (
            <iframe
              key={key}
              title="Code Artifact Preview"
              srcDoc={getIframeSrc()}
              className="w-full h-full border-0 bg-white"
              sandbox="allow-scripts allow-modals"
            />
          ) : (
            <div className="h-full overflow-auto p-6 font-mono text-xs text-zinc-300 bg-black">
              <pre className="whitespace-pre-wrap break-words">{code}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
