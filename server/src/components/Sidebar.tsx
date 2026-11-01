import React, { useState } from 'react';
import {
  Plus,
  Search,
  Pin,
  MessageSquare,
  Trash2,
  Download,
  Upload,
  Edit2,
  Check,
  X,
  ChevronRight,
  Terminal,
  Cpu,
  Layers,
  Sliders,
  Sparkles,
  Globe,
  CreditCard,
} from 'lucide-react';
import { ChatSession, Persona } from '../types';
import { exportSessionAsJSON, exportSessionAsMarkdown, exportAllSessionsAsJSON } from '../utils/storage';

interface SidebarProps {
  isOpen: boolean;
  onCloseMobile: () => void;
  sessions: ChatSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  onTogglePinSession: (id: string) => void;
  onRenameSession: (id: string, newTitle: string) => void;
  personas: Persona[];
  activePersonaId: string;
  onOpenPersonaModal: () => void;
  onImportSession: (session: ChatSession) => void;
  onOpenAppStudio?: () => void;
  onOpenHostedSites?: () => void;
  onOpenBilling?: () => void;
  onOpenAbout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onCloseMobile,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onTogglePinSession,
  onRenameSession,
  personas,
  activePersonaId,
  onOpenPersonaModal,
  onImportSession,
  onOpenAppStudio,
  onOpenHostedSites,
  onOpenBilling,
  onOpenAbout,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const activePersona = personas.find((p) => p.id === activePersonaId) || personas[0];

  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pinnedSessions = filteredSessions.filter((s) => s.isPinned);
  const unpinnedSessions = filteredSessions.filter((s) => !s.isPinned);

  const handleStartRename = (session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(session.id);
    setEditTitle(session.title);
  };

  const handleSaveRename = (id: string, e: React.MouseEvent | React.FormEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (editTitle.trim()) {
      onRenameSession(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed && parsed.id && parsed.messages) {
          onImportSession(parsed);
        } else {
          alert('Invalid chat session JSON format.');
        }
      } catch (err) {
        alert('Failed to parse JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 sm:hidden"
        />
      )}

      <aside
        className={`fixed sm:static top-0 left-0 bottom-0 z-40 w-72 bg-black border-r border-zinc-800/80 flex flex-col justify-between transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0'
        }`}
      >
        {/* Top: Branding + New Chat */}
        <div className="p-4 border-b border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-white" />
              <span className="font-mono font-bold text-white text-xs tracking-wider uppercase">
                AIX <span className="text-zinc-500">WORKSPACE</span>
              </span>
            </div>
            <button
              onClick={onCloseMobile}
              className="p-1 text-zinc-400 hover:text-white sm:hidden"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* New Chat Button: Crisp White */}
          <button
            onClick={() => {
              onNewSession();
              onCloseMobile();
            }}
            className="w-full py-2.5 px-4 bg-white hover:bg-zinc-200 text-black font-semibold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 font-mono tracking-tight"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" /> NEW CHAT THREAD
          </button>

          {onOpenAppStudio && (
            <button
              onClick={() => {
                onOpenAppStudio();
                onCloseMobile();
              }}
              className="w-full py-2 px-3 bg-zinc-950 hover:bg-zinc-900 text-white font-mono text-xs rounded-xl border border-zinc-700 hover:border-zinc-500 flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95"
            >
              <Terminal className="w-3.5 h-3.5 text-zinc-300" /> APP STUDIO GUI
            </button>
          )}

          {onOpenHostedSites && (
            <button
              onClick={() => {
                onOpenHostedSites();
                onCloseMobile();
              }}
              className="w-full py-2 px-3 bg-zinc-950 hover:bg-zinc-900 text-zinc-300 hover:text-white font-mono text-xs rounded-xl border border-zinc-800 hover:border-zinc-600 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Globe className="w-3.5 h-3.5 text-blue-400" /> HOSTED SITES & APPS
            </button>
          )}

          {onOpenBilling && (
            <button
              onClick={() => {
                onOpenBilling();
                onCloseMobile();
              }}
              className="w-full py-2 px-3 bg-zinc-950 hover:bg-zinc-900 text-zinc-300 hover:text-white font-mono text-xs rounded-xl border border-zinc-800 hover:border-zinc-600 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <CreditCard className="w-3.5 h-3.5 text-amber-400" /> XRPL BILLING & CREDITS
            </button>
          )}

          {onOpenAbout && (
            <button
              onClick={() => {
                onOpenAbout();
                onCloseMobile();
              }}
              className="w-full py-2 px-3 bg-zinc-950 hover:bg-zinc-900 text-zinc-300 hover:text-white font-mono text-xs rounded-xl border border-zinc-800 hover:border-zinc-600 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5 text-white" /> ABOUT AIX ALPHA
            </button>
          )}

          {/* Search sessions input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Filter threads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors font-mono"
            />
          </div>
        </div>

        {/* Middle: Sessions List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* Pinned Section */}
          {pinnedSessions.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-mono font-semibold text-zinc-400 uppercase tracking-widest px-2 mb-1.5">
                <Pin className="w-3 h-3 text-zinc-300" /> PINNED ({pinnedSessions.length})
              </div>
              <div className="space-y-1">
                {pinnedSessions.map((s) => (
                  <SessionItem
                    key={s.id}
                    session={s}
                    isActive={s.id === activeSessionId}
                    isEditing={editingId === s.id}
                    editTitle={editTitle}
                    setEditTitle={setEditTitle}
                    onSelect={() => {
                      onSelectSession(s.id);
                      onCloseMobile();
                    }}
                    onTogglePin={(e) => {
                      e.stopPropagation();
                      onTogglePinSession(s.id);
                    }}
                    onDelete={(e) => {
                      e.stopPropagation();
                      onDeleteSession(s.id);
                    }}
                    onStartRename={(e) => handleStartRename(s, e)}
                    onSaveRename={(e) => handleSaveRename(s.id, e)}
                    onExportJSON={(e) => {
                      e.stopPropagation();
                      exportSessionAsJSON(s);
                    }}
                    onExportMD={(e) => {
                      e.stopPropagation();
                      exportSessionAsMarkdown(s);
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* All Chats Section */}
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono font-semibold text-zinc-500 uppercase tracking-widest px-2 mb-1.5">
              <MessageSquare className="w-3 h-3" /> THREADS ({unpinnedSessions.length})
            </div>

            {unpinnedSessions.length === 0 && pinnedSessions.length === 0 ? (
              <div className="text-center py-8 px-4 text-zinc-600 text-xs font-mono">
                NO ACTIVE THREADS
              </div>
            ) : (
              <div className="space-y-1">
                {unpinnedSessions.map((s) => (
                  <SessionItem
                    key={s.id}
                    session={s}
                    isActive={s.id === activeSessionId}
                    isEditing={editingId === s.id}
                    editTitle={editTitle}
                    setEditTitle={setEditTitle}
                    onSelect={() => {
                      onSelectSession(s.id);
                      onCloseMobile();
                    }}
                    onTogglePin={(e) => {
                      e.stopPropagation();
                      onTogglePinSession(s.id);
                    }}
                    onDelete={(e) => {
                      e.stopPropagation();
                      onDeleteSession(s.id);
                    }}
                    onStartRename={(e) => handleStartRename(s, e)}
                    onSaveRename={(e) => handleSaveRename(s.id, e)}
                    onExportJSON={(e) => {
                      e.stopPropagation();
                      exportSessionAsJSON(s);
                    }}
                    onExportMD={(e) => {
                      e.stopPropagation();
                      exportSessionAsMarkdown(s);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bottom: Persona Switcher & Import Session */}
        <div className="p-3 border-t border-zinc-800 space-y-2 bg-black">
          {/* Active Persona Box */}
          <button
            onClick={onOpenPersonaModal}
            className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-600 flex items-center justify-between text-left transition-all group"
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="p-1.5 rounded-lg bg-zinc-900 text-zinc-300 border border-zinc-700 group-hover:border-zinc-500 transition-colors">
                <Sliders className="w-4 h-4" />
              </div>
              <div className="truncate font-mono">
                <p className="text-xs font-semibold text-zinc-200 truncate">{activePersona.name}</p>
                <p className="text-[10px] text-zinc-500 truncate">{activePersona.tagline}</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-300 transition-colors" />
          </button>

          {/* Import & Export Session Controls */}
          <div className="flex items-center justify-between px-1 text-xs pt-1 border-t border-zinc-900">
            <label className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-200 cursor-pointer py-1 transition-colors font-mono text-[11px] glow-subtle">
              <Upload className="w-3.5 h-3.5" />
              <span>IMPORT</span>
              <input type="file" accept=".json" onChange={handleImportFile} className="hidden" />
            </label>

            <button
              onClick={() => exportAllSessionsAsJSON(sessions)}
              className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-200 py-1 transition-colors font-mono text-[11px] glow-subtle"
              title="Backup & export all conversations"
            >
              <Download className="w-3.5 h-3.5" />
              <span>BACKUP ALL</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

interface SessionItemProps {
  session: ChatSession;
  isActive: boolean;
  isEditing: boolean;
  editTitle: string;
  setEditTitle: (val: string) => void;
  onSelect: () => void;
  onTogglePin: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onStartRename: (e: React.MouseEvent) => void;
  onSaveRename: (e: React.FormEvent | React.MouseEvent) => void;
  onExportJSON: (e: React.MouseEvent) => void;
  onExportMD: (e: React.MouseEvent) => void;
}

const SessionItem: React.FC<SessionItemProps> = ({
  session,
  isActive,
  isEditing,
  editTitle,
  setEditTitle,
  onSelect,
  onTogglePin,
  onDelete,
  onStartRename,
  onSaveRename,
  onExportJSON,
  onExportMD,
}) => {
  return (
    <div
      onClick={onSelect}
      className={`group relative flex items-center justify-between p-2 rounded-lg border text-xs transition-all cursor-pointer font-mono glow-subtle ${
        isActive
          ? 'bg-zinc-900 border-zinc-600 text-white font-medium'
          : 'bg-zinc-950/60 border-zinc-900 text-zinc-400 hover:bg-zinc-900/80 hover:text-zinc-200 hover:border-zinc-800'
      }`}
    >
      <div className="flex items-center gap-2 truncate pr-20 flex-1">
        <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-zinc-600'}`} />
        {isEditing ? (
          <form onSubmit={onSaveRename} className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              autoFocus
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="bg-black border border-zinc-500 text-xs px-2 py-0.5 rounded text-white w-full focus:outline-none"
            />
            <button type="submit" className="text-white hover:text-zinc-300 p-0.5">
              <Check className="w-3.5 h-3.5" />
            </button>
          </form>
        ) : (
          <span className="truncate">{session.title}</span>
        )}
      </div>

      {!isEditing && (
        <div className="absolute right-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-950 px-1 py-0.5 rounded border border-zinc-800">
          <button
            onClick={onTogglePin}
            className={`p-1 hover:text-white transition-colors ${session.isPinned ? 'text-white' : 'text-zinc-500'}`}
            title={session.isPinned ? 'Unpin' : 'Pin'}
          >
            <Pin className="w-3 h-3" />
          </button>
          <button
            onClick={onStartRename}
            className="p-1 text-zinc-500 hover:text-white transition-colors"
            title="Rename"
          >
            <Edit2 className="w-3 h-3" />
          </button>
          <button
            onClick={onExportJSON}
            className="p-1 text-zinc-500 hover:text-white transition-colors text-[10px] font-mono px-1"
            title="Export Session as JSON"
          >
            JSON
          </button>
          <button
            onClick={onExportMD}
            className="p-1 text-zinc-500 hover:text-white transition-colors"
            title="Export Markdown (.md)"
          >
            <Download className="w-3 h-3" />
          </button>
          <button
            onClick={onDelete}
            className="p-1 text-zinc-500 hover:text-zinc-200 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
};

