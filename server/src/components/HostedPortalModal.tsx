import React, { useState } from 'react';
import { X, Globe, Copy, Check, ExternalLink, Settings, Shield, Sparkles, Terminal, Sliders, Share2 } from 'lucide-react';
import { Persona } from '../types';

interface HostedPortalConfig {
  portalId: string;
  appTitle: string;
  customPrompt: string;
  themeColor: 'monochrome' | 'dark-luxury' | 'cyan-glow' | 'emerald';
  allowWebSearch: boolean;
  allowImageGen: boolean;
  allowCodeExecution: boolean;
  requirePassword: boolean;
  accessPassword?: string;
  isHostedLive: boolean;
}

interface HostedPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
  activePersona: Persona;
  onLaunchPublicPortal: (config: HostedPortalConfig) => void;
}

export const HostedPortalModal: React.FC<HostedPortalModalProps> = ({
  isOpen,
  onClose,
  activePersona,
  onLaunchPublicPortal,
}) => {
  const [config, setConfig] = useState<HostedPortalConfig>({
    portalId: 'app_' + Math.random().toString(36).substring(2, 9),
    appTitle: `${activePersona.name} Customer Portal`,
    customPrompt: activePersona.systemInstruction || 'You are a dedicated customer assistant app...',
    themeColor: 'monochrome',
    allowWebSearch: true,
    allowImageGen: true,
    allowCodeExecution: true,
    requirePassword: false,
    accessPassword: '',
    isHostedLive: true,
  });

  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const publicUrl = `${window.location.origin}/?portal=${config.portalId}`;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLaunch = () => {
    onLaunchPublicPortal(config);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white text-black flex items-center justify-center shadow-md">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-wide">
                Host Your Own App & Customer Chat Portal
              </h2>
              <p className="text-xs text-zinc-400 font-mono">
                DEPLOYS A STANDALONE SITE PAGE FOR PLAYERS & CUSTOMERS
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg border border-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Form */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Account Billing & Credit Integration Callout */}
          <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-800/40 space-y-2 text-left font-mono">
            <div className="flex items-center gap-2 text-purple-400">
              <Sparkles className="w-4 h-4 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider">Host Credit Synchronization</span>
            </div>
            <p className="text-[10px] text-zinc-400 leading-relaxed">
              When public players or customers interact with your hosted chatbot live, prompt credits are automatically 
              deducted in real-time from your account's central balance. Refuel credits anytime using our XRPL Billing hub.
            </p>
          </div>

          {/* Public Share URL Box */}
          <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
            <label className="text-xs font-mono text-zinc-400 uppercase tracking-wider block">
              Public Site Page Endpoint URL //
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={publicUrl}
                className="flex-1 bg-black border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 font-mono focus:outline-none"
              />
              <button
                onClick={handleCopyUrl}
                className="px-3 py-2 bg-white text-black hover:bg-zinc-200 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'COPIED' : 'COPY'}</span>
              </button>
            </div>
          </div>

          {/* Settings Fields */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-mono text-zinc-300 block mb-1">
                Hosted Application Title //
              </label>
              <input
                type="text"
                value={config.appTitle}
                onChange={(e) => setConfig({ ...config, appTitle: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
              />
            </div>

            <div>
              <label className="text-xs font-mono text-zinc-300 block mb-1">
                Hosted System Prompt & Behavior Instructions //
              </label>
              <textarea
                rows={3}
                value={config.customPrompt}
                onChange={(e) => setConfig({ ...config, customPrompt: e.target.value })}
                placeholder="Instructions for players or customers accessing this site page..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 font-mono resize-none"
              />
            </div>

            {/* Allowed Capabilities Toggles */}
            <div className="space-y-2">
              <label className="text-xs font-mono text-zinc-300 block">
                Public Player / Customer Capabilities //
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, allowWebSearch: !config.allowWebSearch })}
                  className={`p-2.5 rounded-xl border text-xs font-mono flex items-center justify-between transition-all ${
                    config.allowWebSearch
                      ? 'bg-zinc-900 text-white border-zinc-600'
                      : 'bg-zinc-950 text-zinc-500 border-zinc-800'
                  }`}
                >
                  <span>Live Web Search</span>
                  <div className={`w-2 h-2 rounded-full ${config.allowWebSearch ? 'bg-emerald-400' : 'bg-zinc-700'}`} />
                </button>

                <button
                  type="button"
                  onClick={() => setConfig({ ...config, allowImageGen: !config.allowImageGen })}
                  className={`p-2.5 rounded-xl border text-xs font-mono flex items-center justify-between transition-all ${
                    config.allowImageGen
                      ? 'bg-zinc-900 text-white border-zinc-600'
                      : 'bg-zinc-950 text-zinc-500 border-zinc-800'
                  }`}
                >
                  <span>Image Generation</span>
                  <div className={`w-2 h-2 rounded-full ${config.allowImageGen ? 'bg-emerald-400' : 'bg-zinc-700'}`} />
                </button>

                <button
                  type="button"
                  onClick={() => setConfig({ ...config, allowCodeExecution: !config.allowCodeExecution })}
                  className={`p-2.5 rounded-xl border text-xs font-mono flex items-center justify-between transition-all ${
                    config.allowCodeExecution
                      ? 'bg-zinc-900 text-white border-zinc-600'
                      : 'bg-zinc-950 text-zinc-500 border-zinc-800'
                  }`}
                >
                  <span>Code Sandbox</span>
                  <div className={`w-2 h-2 rounded-full ${config.allowCodeExecution ? 'bg-emerald-400' : 'bg-zinc-700'}`} />
                </button>
              </div>
            </div>

            {/* Access Control Security */}
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-white" />
                  <span className="text-xs font-mono text-zinc-200">Require Access Password</span>
                </div>
                <input
                  type="checkbox"
                  checked={config.requirePassword}
                  onChange={(e) => setConfig({ ...config, requirePassword: e.target.checked })}
                  className="w-4 h-4 accent-white rounded cursor-pointer"
                />
              </div>

              {config.requirePassword && (
                <input
                  type="password"
                  value={config.accessPassword}
                  onChange={(e) => setConfig({ ...config, accessPassword: e.target.value })}
                  placeholder="Set secret password for customers or players..."
                  className="w-full bg-black border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 font-mono"
                />
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-xs font-mono"
          >
            Cancel
          </button>

          <button
            onClick={handleLaunch}
            className="px-5 py-2.5 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-bold font-mono flex items-center gap-2 shadow-lg transition-all active:scale-95"
          >
            <Share2 className="w-4 h-4" />
            <span>Deploy & Host Site Page</span>
          </button>
        </div>
      </div>
    </div>
  );
};
