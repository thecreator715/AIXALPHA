import React, { useState } from 'react';
import {
  Globe,
  Volume2,
  VolumeX,
  Sun,
  Moon,
  Menu,
  Plus,
  Settings2,
  Terminal,
  Cpu,
  Sliders,
  Download,
  Upload,
  ChevronDown,
  MessageSquare,
  Sparkles,
  Plug,
  BarChart3,
  Share2,
  CreditCard,
  History,
} from 'lucide-react';
import { Persona, AppViewMode } from '../types';

interface HeaderProps {
  activePersona: Persona;
  onOpenPersonaModal: () => void;
  searchGroundingEnabled: boolean;
  onToggleSearchGrounding: () => void;
  autoVoiceEnabled: boolean;
  onToggleAutoVoice: () => void;
  onOpenVoiceSettings: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onToggleMobileSidebar: () => void;
  onNewSession: () => void;
  currentView: AppViewMode;
  onChangeView: (view: AppViewMode) => void;
  onExportChatJSON?: () => void;
  onExportChatMD?: () => void;
  onImportChatJSON?: (file: File) => void;
  onOpenHostPortalModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activePersona,
  onOpenPersonaModal,
  searchGroundingEnabled,
  onToggleSearchGrounding,
  autoVoiceEnabled,
  onToggleAutoVoice,
  onOpenVoiceSettings,
  theme,
  onToggleTheme,
  onToggleMobileSidebar,
  onNewSession,
  currentView,
  onChangeView,
  onExportChatJSON,
  onExportChatMD,
  onImportChatJSON,
  onOpenHostPortalModal,
}) => {
  const [showExportMenu, setShowExportMenu] = useState(false);

  return (
    <header className="border-b border-zinc-800 bg-black/95 backdrop-blur-xl sticky top-0 z-30 select-none font-sans pt-[env(safe-area-inset-top,0px)]">
      {/* Top Main Bar */}
      <div className="h-13 sm:h-16 px-2 sm:px-6 flex items-center justify-between w-full">
        {/* Left: Mobile Drawer Trigger + Brand Logo */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            onClick={onToggleMobileSidebar}
            className="p-1.5 sm:p-2 text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl border border-zinc-800 transition-all glow-subtle"
            title="Open Navigation"
          >
            <Menu className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 sm:gap-3 cursor-pointer" onClick={() => onChangeView('chat')}>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-zinc-900 border border-zinc-700/90 flex items-center justify-center shadow-lg shadow-black/60 glow-subtle">
              <Cpu className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-white" />
            </div>

            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="text-sm sm:text-lg font-bold tracking-tight text-white flex items-center gap-1 font-mono">
                  AIX Alpha v3.0
                </h1>
                <span className="hidden lg:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-zinc-900 text-zinc-300 border border-zinc-800 tracking-wider">
                  AI SUITE
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  FREE TIER
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 font-mono tracking-wide hidden xl:block">
                100% SOFTWARE WORKSTATION
              </p>
            </div>
          </div>
        </div>

        {/* Desktop Center: Full-page View Switcher (Visible on md+ screens) */}
        <div className="hidden md:flex flex-1 justify-center items-center px-2 min-w-0">
          <div className="flex items-center p-1 bg-zinc-950 rounded-xl border border-zinc-800 shadow-inner max-w-full">
            <button
              onClick={() => onChangeView('chat')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-[-0.02em] whitespace-nowrap transition-all glow-subtle ${
                currentView === 'chat'
                  ? 'bg-white text-black shadow-sm font-bold'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Chat</span>
            </button>

            <button
              onClick={() => onChangeView('appStudio')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-[-0.02em] whitespace-nowrap transition-all glow-subtle ${
                currentView === 'appStudio'
                  ? 'bg-white text-black shadow-sm font-bold'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
              }`}
            >
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span>App Studio</span>
            </button>

            <button
              onClick={() => onChangeView('hosted')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-[-0.02em] whitespace-nowrap transition-all glow-subtle ${
                currentView === 'hosted'
                  ? 'bg-white text-black shadow-sm font-bold'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-blue-400" />
              <span>Hosted Sites</span>
            </button>

            <button
              onClick={() => onChangeView('personas')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-[-0.02em] whitespace-nowrap transition-all glow-subtle ${
                currentView === 'personas'
                  ? 'bg-white text-black shadow-sm font-bold'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Models</span>
            </button>

            <button
              onClick={() => onChangeView('mcp')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-[-0.02em] whitespace-nowrap transition-all glow-subtle ${
                currentView === 'mcp'
                  ? 'bg-white text-black shadow-sm font-bold'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
              }`}
            >
              <Plug className="w-3.5 h-3.5" />
              <span>MCP & API</span>
            </button>

            <button
              onClick={() => onChangeView('analytics')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-[-0.02em] whitespace-nowrap transition-all glow-subtle ${
                currentView === 'analytics'
                  ? 'bg-white text-black shadow-sm font-bold'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Analytics</span>
            </button>

            <button
              onClick={() => onChangeView('billing')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-[-0.02em] whitespace-nowrap transition-all glow-subtle ${
                currentView === 'billing'
                  ? 'bg-white text-black shadow-sm font-bold'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5 text-amber-400" />
              <span>XRPL Billing</span>
            </button>

            <button
              onClick={() => onChangeView('about')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-[-0.02em] whitespace-nowrap transition-all glow-subtle ${
                currentView === 'about'
                  ? 'bg-white text-black shadow-sm font-bold'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>About</span>
            </button>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Quick Host Site Button */}
          <button
            onClick={() => onChangeView('hosted')}
            className={`flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl border text-xs font-mono transition-all glow-subtle ${
              currentView === 'hosted'
                ? 'bg-emerald-950 border-emerald-700 text-emerald-300'
                : 'bg-zinc-950 hover:bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-300'
            }`}
            title="Manage and Deploy Hosted Sites"
          >
            <Globe className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline text-[10px] sm:text-[11px] text-emerald-400 font-bold">HOST SITES</span>
          </button>

          {/* Chat Export & Import Dropdown */}
          <div className="relative hidden lg:block">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-mono text-zinc-300 transition-all glow-subtle"
              title="Import / Export Chat Files"
            >
              <Download className="w-3.5 h-3.5 text-zinc-400" />
              <span className="text-[11px]">DATA</span>
              <ChevronDown className="w-3 h-3 text-zinc-500" />
            </button>

            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-zinc-950 border border-zinc-800 rounded-xl p-1.5 shadow-2xl z-50 font-mono text-xs animate-in fade-in zoom-in-95 duration-150">
                <button
                  onClick={() => {
                    onExportChatJSON?.();
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-zinc-900 text-zinc-300 hover:text-white flex items-center justify-between transition-colors"
                >
                  <span>Export Chat (JSON)</span>
                  <Download className="w-3 h-3 text-zinc-500" />
                </button>

                <button
                  onClick={() => {
                    onExportChatMD?.();
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-zinc-900 text-zinc-300 hover:text-white flex items-center justify-between transition-colors"
                >
                  <span>Export Chat (MD)</span>
                  <Download className="w-3 h-3 text-zinc-500" />
                </button>

                <div className="h-[1px] bg-zinc-800 my-1" />

                <label className="w-full text-left px-3 py-2 rounded-lg hover:bg-zinc-900 text-zinc-300 hover:text-white flex items-center justify-between cursor-pointer transition-colors">
                  <span>Import Chat (JSON)</span>
                  <Upload className="w-3 h-3 text-zinc-500" />
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        onImportChatJSON?.(f);
                      }
                      setShowExportMenu(false);
                    }}
                  />
                </label>
              </div>
            )}
          </div>

          {/* Real-Time Web Search Grounding Toggle */}
          <button
            onClick={onToggleSearchGrounding}
            className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl border text-xs font-mono transition-all glow-subtle ${
              searchGroundingEnabled
                ? 'bg-zinc-900 text-white border-zinc-600 shadow-sm'
                : 'bg-black text-zinc-500 border-zinc-800 hover:text-zinc-300 hover:border-zinc-700'
            }`}
            title="Toggle Google Real-Time Web Search Grounding"
          >
            <Globe className={`w-3.5 h-3.5 ${searchGroundingEnabled ? 'text-white animate-pulse' : 'text-zinc-600'}`} />
            <span className="hidden sm:inline text-[11px]">WEB SEARCH</span>
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                searchGroundingEnabled ? 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'bg-zinc-700'
              }`}
            />
          </button>

          {/* Audio Read-Aloud Toggle */}
          <div className="flex items-center rounded-xl bg-zinc-950 border border-zinc-800 p-0.5">
            <button
              onClick={onToggleAutoVoice}
              className={`p-1.5 rounded-lg text-xs transition-colors glow-subtle ${
                autoVoiceEnabled ? 'text-white bg-zinc-800' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title={autoVoiceEnabled ? 'Voice Output: Active' : 'Voice Output: Muted'}
            >
              {autoVoiceEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={onOpenVoiceSettings}
              className="p-1.5 text-zinc-500 hover:text-zinc-300 rounded-lg transition-colors glow-subtle hidden sm:block"
              title="Voice Synthesizer Settings"
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Theme Toggle Button (Light/Dark mode) */}
          <button
            onClick={onToggleTheme}
            className="p-1.5 sm:p-2 text-zinc-400 hover:text-white bg-zinc-950 hover:bg-zinc-900 rounded-xl border border-zinc-800 transition-all glow-subtle flex items-center justify-center"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400 animate-in fade-in" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-500 animate-in fade-in" />
            )}
          </button>

          {/* New Session Button */}
          <button
            onClick={() => {
              onNewSession();
              onChangeView('chat');
            }}
            className="px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-xs transition-all shadow-md active:scale-95 flex items-center gap-1 glow-subtle shrink-0"
            title="New Chat Session"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span className="hidden sm:inline">New Session</span>
          </button>
        </div>
      </div>

      {/* Mobile Sub-Row: Dedicated View Switcher Tabs Bar (Visible on < md screens) */}
      <div className="md:hidden border-t border-zinc-800/80 bg-zinc-950/90 px-2 py-1.5 flex items-center justify-start overflow-x-auto scrollbar-none gap-1">
        <button
          onClick={() => onChangeView('chat')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold tracking-[-0.02em] whitespace-nowrap transition-all ${
            currentView === 'chat'
              ? 'bg-white text-black font-bold shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Chat</span>
        </button>

        <button
          onClick={() => onChangeView('appStudio')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold tracking-[-0.02em] whitespace-nowrap transition-all ${
            currentView === 'appStudio'
              ? 'bg-white text-black font-bold shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
          }`}
        >
          <Terminal className="w-3.5 h-3.5 text-emerald-400" />
          <span>App Studio</span>
        </button>

        <button
          onClick={() => onChangeView('hosted')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold tracking-[-0.02em] whitespace-nowrap transition-all ${
            currentView === 'hosted'
              ? 'bg-white text-black font-bold shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
          }`}
        >
          <Globe className="w-3.5 h-3.5 text-blue-400" />
          <span>Hosted Sites</span>
        </button>

        <button
          onClick={() => onChangeView('personas')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold tracking-[-0.02em] whitespace-nowrap transition-all ${
            currentView === 'personas'
              ? 'bg-white text-black font-bold shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Models</span>
        </button>

        <button
          onClick={() => onChangeView('mcp')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold tracking-[-0.02em] whitespace-nowrap transition-all ${
            currentView === 'mcp'
              ? 'bg-white text-black font-bold shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
          }`}
        >
          <Plug className="w-3.5 h-3.5" />
          <span>MCP & API</span>
        </button>

        <button
          onClick={() => onChangeView('analytics')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold tracking-[-0.02em] whitespace-nowrap transition-all ${
            currentView === 'analytics'
              ? 'bg-white text-black font-bold shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Analytics</span>
        </button>

        <button
          onClick={() => onChangeView('billing')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold tracking-[-0.02em] whitespace-nowrap transition-all ${
            currentView === 'billing'
              ? 'bg-white text-black font-bold shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5 text-amber-400" />
          <span>XRPL Billing</span>
        </button>

        <button
          onClick={() => onChangeView('about')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold tracking-[-0.02em] whitespace-nowrap transition-all ${
            currentView === 'about'
              ? 'bg-white text-black font-bold shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>About</span>
        </button>
      </div>
    </header>
  );
};



