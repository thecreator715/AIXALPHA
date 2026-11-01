import React, { useState } from 'react';
import {
  Cpu,
  Zap,
  Code2,
  Globe,
  Briefcase,
  GraduationCap,
  Sparkles,
  ShieldAlert,
  ArrowLeft,
  Plus,
  Check,
  Sliders,
  Download,
  Upload,
  Copy,
  Trash2,
  Play,
  RotateCcw,
  Search,
  ExternalLink,
  Layers,
  Terminal,
} from 'lucide-react';
import { Persona } from '../types';
import {
  AIX_ALPHA_QUANTUM_SYSTEM_PROMPT,
  AIX_ALPHA_LE_SYSTEM_PROMPT,
  PRESET_PERSONAS,
} from '../data/personas';
import { exportPersonasAsJSON } from '../utils/storage';

interface PersonaHubPageProps {
  personas: Persona[];
  activePersonaId: string;
  onSelectPersona: (persona: Persona) => void;
  onSaveCustomPersona: (persona: Persona) => void;
  onDeleteCustomPersona: (personaId: string) => void;
  onNavigateToChat: () => void;
  onUseTemplate?: (persona: Persona, prompt: string) => void;
}

const ICON_COMPONENTS: Record<string, React.FC<{ className?: string }>> = {
  Cpu,
  Zap,
  Code2,
  Globe,
  Briefcase,
  GraduationCap,
  Sparkles,
  ShieldAlert,
};

export const PersonaHubPage: React.FC<PersonaHubPageProps> = ({
  personas,
  activePersonaId,
  onSelectPersona,
  onSaveCustomPersona,
  onDeleteCustomPersona,
  onNavigateToChat,
  onUseTemplate,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPromptId, setExpandedPromptId] = useState<string | null>(null);

  // New/Edit Model Drawer State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState<Partial<Persona> | null>(null);

  // Scratchpad test state
  const [scratchpadPrompt, setScratchpadPrompt] = useState('Explain how quantum superposition applies to decision theory under uncertainty.');
  const [scratchpadOutput, setScratchpadOutput] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testActivePersona, setTestActivePersona] = useState<Persona | null>(null);

  const activePersona = personas.find((p) => p.id === activePersonaId) || personas[0];

  // Filtering
  const filteredPersonas = personas.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.tagline.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeCategory === 'all') return true;
    if (activeCategory === 'quantum') return p.id.includes('quantum') || p.id.includes('alpha');
    if (activeCategory === 'engineering') return p.avatarIcon === 'Code2' || p.id.includes('code');
    if (activeCategory === 'research') return p.avatarIcon === 'Globe' || p.id.includes('research');
    if (activeCategory === 'strategy') return p.avatarIcon === 'Briefcase' || p.avatarIcon === 'GraduationCap';
    if (activeCategory === 'custom') return !!p.isCustom;

    return true;
  });

  const handleOpenCreate = () => {
    setEditingPersona({
      id: `custom_quantum_${Date.now()}`,
      name: '',
      tagline: 'Custom Quantum Intelligence Model',
      description: '',
      avatarIcon: 'Cpu',
      systemInstruction: AIX_ALPHA_QUANTUM_SYSTEM_PROMPT,
      defaultSearchGrounding: true,
      modelAlias: 'claude-haiku-5-5',
      temperature: 0.5,
      thinkingLevel: 'HIGH',
      voiceName: 'Kore',
      isCustom: true,
      capabilities: {
        searchWeb: true,
        generateImages: true,
        generate3D: true,
        generateVideo: false,
        codeExecution: true,
      },
    });
    setIsDrawerOpen(true);
  };

  const handleOpenEdit = (p: Persona) => {
    setEditingPersona({ ...p });
    setIsDrawerOpen(true);
  };

  const handleSaveDrawer = () => {
    if (!editingPersona || !editingPersona.name || !editingPersona.systemInstruction) return;

    const saved: Persona = {
      id: editingPersona.id || `custom_${Date.now()}`,
      name: editingPersona.name,
      tagline: editingPersona.tagline || 'Specialized AI Engine',
      description: editingPersona.description || 'Custom configured AI model',
      avatarIcon: editingPersona.avatarIcon || 'Cpu',
      systemInstruction: editingPersona.systemInstruction,
      defaultSearchGrounding: editingPersona.defaultSearchGrounding ?? true,
      modelAlias: editingPersona.modelAlias || 'claude-haiku-5-5',
      temperature: editingPersona.temperature ?? 0.6,
      thinkingLevel: editingPersona.thinkingLevel || 'HIGH',
      voiceName: editingPersona.voiceName || 'Kore',
      badgeColor: 'bg-zinc-900 text-white border-zinc-700',
      isCustom: true,
      capabilities: editingPersona.capabilities || {
        searchWeb: true,
        generateImages: true,
        generate3D: true,
        generateVideo: false,
        codeExecution: true,
      },
    };

    onSaveCustomPersona(saved);
    setIsDrawerOpen(false);
    setEditingPersona(null);
  };

  const handleExportSingleModelJSON = (personaToExport: Partial<Persona>) => {
    const filename = `${(personaToExport.name || 'fine-tuned-model').toLowerCase().replace(/[^a-z0-9]/g, '-')}-config.json`;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(personaToExport, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", filename);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          parsed.forEach((item) => {
            if (item.name && item.systemInstruction) {
              onSaveCustomPersona({
                ...item,
                id: item.id || `imported_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                isCustom: true,
              });
            }
          });
        } else if (parsed.name && parsed.systemInstruction) {
          onSaveCustomPersona({
            ...parsed,
            id: parsed.id || `imported_${Date.now()}`,
            isCustom: true,
          });
        }
      } catch (err) {
        console.error('Failed to parse imported personas:', err);
      }
    };
    reader.readAsText(file);
  };

  const handleRunScratchpadTest = async (personaToTest: Persona) => {
    setTestActivePersona(personaToTest);
    setIsTesting(true);
    setScratchpadOutput('');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'persona-test',
          loopMode: 'eco',
          messages: [{ role: 'user', content: scratchpadPrompt }],
          systemInstruction: personaToTest.systemInstruction,
          useSearchGrounding: personaToTest.defaultSearchGrounding,
          model: personaToTest.modelAlias || 'claude-haiku-5-5',
          temperature: personaToTest.temperature,
          thinkingLevel: personaToTest.thinkingLevel,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setScratchpadOutput(data.text);
      } else {
        setScratchpadOutput(`Error: ${data.error || 'Execution failed'}`);
      }
    } catch (e: any) {
      setScratchpadOutput(`Network Exception: ${e.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans flex flex-col selection:bg-white selection:text-black">
      {/* Top Navigation Bar */}
      <div className="h-16 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-xl px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <button
            onClick={onNavigateToChat}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 text-xs font-semibold tracking-[-0.02em] transition-all glow-subtle"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Return to Chat
          </button>

          <div className="h-4 w-px bg-zinc-800" />

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold tracking-tight text-white flex items-center gap-1.5">
                Quantum Model & Persona Hub
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-white text-black font-bold">
                v3.0 SUITE
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 font-mono hidden sm:block">
              ACTIVE IN CHAT: <span className="text-zinc-200 font-bold">{activePersona.name}</span> ({activePersona.modelAlias})
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 text-xs font-medium cursor-pointer transition-colors">
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Import JSON</span>
            <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
          </label>

          <button
            onClick={() => exportPersonasAsJSON(personas)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 text-xs font-medium transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export All</span>
          </button>

          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-bold font-mono transition-all shadow-sm active:scale-95"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>NEW MODEL</span>
          </button>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8 space-y-6">
        {/* Banner / Category Filter */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-zinc-900">
          <div className="flex flex-wrap gap-1.5 p-1 bg-zinc-950 rounded-xl border border-zinc-800 self-start">
            {[
              { id: 'all', label: 'All Models' },
              { id: 'quantum', label: 'Quantum Superposed' },
              { id: 'engineering', label: 'Engineering & Code' },
              { id: 'research', label: 'Web Research' },
              { id: 'strategy', label: 'Strategy & STEM' },
              { id: 'custom', label: 'Custom Architectures' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeCategory === cat.id
                    ? 'bg-white text-black font-bold shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search bar */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search models, variables, or tags..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 font-mono"
            />
          </div>
        </div>

        {/* Model Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredPersonas.map((p) => {
            const IconComponent = ICON_COMPONENTS[p.avatarIcon] || Cpu;
            const isEquipped = p.id === activePersonaId;
            const isPromptOpen = expandedPromptId === p.id;

            return (
              <div
                key={p.id}
                className={`p-5 rounded-2xl border transition-all flex flex-col justify-between relative overflow-hidden group ${
                  isEquipped
                    ? 'bg-zinc-950 border-white/60 shadow-xl shadow-white/5'
                    : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl border flex items-center justify-center shadow-md ${
                          isEquipped
                            ? 'bg-white text-black border-white'
                            : 'bg-zinc-900 text-white border-zinc-700'
                        }`}
                      >
                        <IconComponent className="w-5 h-5" />
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-white tracking-tight font-mono">
                            {p.name}
                          </h3>
                          {p.isCustom && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-900 text-zinc-400 border border-zinc-700">
                              CUSTOM
                            </span>
                          )}
                          {isEquipped && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-white text-black font-bold flex items-center gap-1">
                              <Check className="w-3 h-3 stroke-[3]" /> EQUIPPED
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-400 font-sans">{p.tagline}</p>
                      </div>
                    </div>

                    {/* Model Base Badge */}
                    <div className="text-right">
                      <span className="px-2 py-1 rounded-lg text-[10px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-300 inline-block font-semibold">
                        {p.modelAlias}
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-zinc-300 leading-relaxed font-sans mb-4">
                    {p.description}
                  </p>

                  {/* Spec Chips */}
                  <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] text-zinc-400 mb-4">
                    <span className="px-2 py-0.5 rounded bg-black border border-zinc-800">
                      TEMP: {p.temperature}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-black border border-zinc-800">
                      THINKING: {p.thinkingLevel || 'HIGH'}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-black border border-zinc-800">
                      VOICE: {p.voiceName}
                    </span>
                    <span className={`px-2 py-0.5 rounded border ${p.defaultSearchGrounding ? 'bg-zinc-900 border-zinc-700 text-zinc-200' : 'bg-black border-zinc-900 text-zinc-600'}`}>
                      {p.defaultSearchGrounding ? '🌐 WEB GROUNDED' : '⚡ OFFLINE CORE'}
                    </span>
                  </div>

                  {/* System Prompt Accordion */}
                  <div className="mb-4">
                    <button
                      onClick={() => setExpandedPromptId(isPromptOpen ? null : p.id)}
                      className="text-[11px] font-mono text-zinc-400 hover:text-white flex items-center gap-1.5 transition-colors"
                    >
                      <Terminal className="w-3 h-3 text-zinc-500" />
                      <span>{isPromptOpen ? 'Collapse System Directives' : 'Inspect Quantum System Prompt'}</span>
                    </button>

                    {isPromptOpen && (
                      <div className="mt-2 p-3 rounded-xl bg-black border border-zinc-800 font-mono text-[11px] text-zinc-300 max-h-56 overflow-y-auto space-y-2">
                        <div className="flex items-center justify-between border-b border-zinc-900 pb-1 text-zinc-500 text-[10px]">
                          <span>SYSTEM INSTRUCTION // {p.name}</span>
                          <button
                            onClick={() => navigator.clipboard.writeText(p.systemInstruction)}
                            className="hover:text-white flex items-center gap-1"
                          >
                            <Copy className="w-3 h-3" /> Copy
                          </button>
                        </div>
                        <pre className="whitespace-pre-wrap leading-relaxed">{p.systemInstruction}</pre>
                      </div>
                    )}
                  </div>

                  {/* Model Prompt Templates */}
                  {p.templates && p.templates.length > 0 && (
                    <div className="mb-4 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 font-semibold">
                        <span className="flex items-center gap-1.5 text-zinc-300">
                          <Sparkles className="w-3 h-3 text-white" /> MODEL PROMPT TEMPLATES ({p.templates.length})
                        </span>
                        <span className="text-[10px] text-zinc-500 font-normal">Click to launch in Chat</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {p.templates.map((tmpl) => (
                          <button
                            key={tmpl.id}
                            onClick={() => {
                              if (onUseTemplate) {
                                onUseTemplate(p, tmpl.prompt);
                              } else {
                                onSelectPersona(p);
                                onNavigateToChat();
                              }
                            }}
                            className="text-left p-2 rounded-xl bg-black border border-zinc-800/90 hover:border-zinc-500 hover:bg-zinc-900/80 transition-all text-xs group/tmpl glow-subtle"
                          >
                            <div className="font-semibold text-zinc-200 group-hover/tmpl:text-white font-mono text-[11px] flex items-center justify-between">
                              <span className="truncate">{tmpl.title}</span>
                              <Play className="w-2.5 h-2.5 text-zinc-500 group-hover/tmpl:text-white shrink-0 ml-1" />
                            </div>
                            <p className="text-[10px] text-zinc-500 line-clamp-1 mt-0.5 font-sans group-hover/tmpl:text-zinc-400">
                              {tmpl.prompt}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Actions Toolbar */}
                <div className="flex items-center justify-between pt-3 border-t border-zinc-900 gap-2 font-mono">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleRunScratchpadTest(p)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 text-[11px] transition-colors"
                      title="Test this model in Sandbox"
                    >
                      <Play className="w-3 h-3" /> Test in Sandbox
                    </button>

                    <button
                      onClick={() => handleOpenEdit(p)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 text-[11px] transition-colors"
                      title="Edit model directives or fine-tune parameters"
                    >
                      <Sliders className="w-3 h-3" /> Edit
                    </button>

                    <button
                      onClick={() => handleExportSingleModelJSON(p)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 text-[11px] transition-colors"
                      title="Export JSON settings for this model"
                    >
                      <Download className="w-3 h-3" /> JSON
                    </button>

                    {p.isCustom && (
                      <button
                        onClick={() => onDeleteCustomPersona(p.id)}
                        className="p-1 text-zinc-600 hover:text-red-400 transition-colors"
                        title="Delete custom model"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Primary Equip Button */}
                  <button
                    onClick={() => {
                      onSelectPersona(p);
                      onNavigateToChat();
                    }}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      isEquipped
                        ? 'bg-zinc-800 text-zinc-400 cursor-default'
                        : 'bg-white hover:bg-zinc-200 text-black shadow-md active:scale-95'
                    }`}
                  >
                    {isEquipped ? (
                      <>
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" /> Active in Chat
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5 fill-current" /> Equip for Chat
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Live Model Scratchpad / Quantum Sandbox */}
        <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4 font-mono shadow-2xl">
          <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-white text-black flex items-center justify-center font-bold">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-wider uppercase">
                  Quantum Model Sandbox // Immediate Verification
                </h3>
                <p className="text-[11px] text-zinc-500 font-sans">
                  Execute test queries across any fine-tuned model without polluting your primary chat history
                </p>
              </div>
            </div>

            {testActivePersona && (
              <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-300 text-xs">
                TESTING: {testActivePersona.name}
              </span>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-[11px] text-zinc-400 font-semibold">TEST PROMPT // QUERY</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={scratchpadPrompt}
                onChange={(e) => setScratchpadPrompt(e.target.value)}
                placeholder="Enter test prompt..."
                className="flex-1 bg-black border border-zinc-800 rounded-xl px-4 py-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
              />
              <button
                onClick={() => handleRunScratchpadTest(testActivePersona || activePersona)}
                disabled={isTesting}
                className="px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                {isTesting ? <RotateCcw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                <span>{isTesting ? 'EXECUTING...' : 'RUN TEST'}</span>
              </button>
            </div>
          </div>

          {scratchpadOutput && (
            <div className="p-4 rounded-xl bg-black border border-zinc-800 space-y-2 animate-in fade-in duration-300">
              <div className="flex items-center justify-between text-[11px] text-zinc-500 border-b border-zinc-900 pb-1">
                <span>SANDBOX OUTPUT // TELEMETRY OK</span>
                <button
                  onClick={() => navigator.clipboard.writeText(scratchpadOutput)}
                  className="hover:text-white flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" /> Copy Output
                </button>
              </div>
              <div className="text-xs text-zinc-200 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                {scratchpadOutput}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit Model Drawer Modal */}
      {isDrawerOpen && editingPersona && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200 font-mono">
          <div className="bg-black border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950">
              <div className="flex items-center gap-2.5">
                <Sliders className="w-4 h-4 text-white" />
                <h3 className="text-sm font-bold text-white tracking-wider uppercase">
                  {editingPersona.name ? `Configure // ${editingPersona.name}` : 'Create Fine-Tuned Model'}
                </h3>
              </div>

              <button
                onClick={() => setIsDrawerOpen(false)}
                className="text-zinc-500 hover:text-white text-xs px-2 py-1 rounded bg-zinc-900"
              >
                ESC / CLOSE
              </button>
            </div>

            {/* Drawer Form Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-zinc-400 mb-1">MODEL / PERSONA NAME</label>
                  <input
                    type="text"
                    value={editingPersona.name || ''}
                    onChange={(e) => setEditingPersona({ ...editingPersona, name: e.target.value })}
                    placeholder="e.g. AIX-ALPHA-QUANTUM-V2"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-zinc-500"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1">TAGLINE</label>
                  <input
                    type="text"
                    value={editingPersona.tagline || ''}
                    onChange={(e) => setEditingPersona({ ...editingPersona, tagline: e.target.value })}
                    placeholder="e.g. Hyperdimensional Reasoning"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-zinc-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">DESCRIPTION</label>
                <input
                  type="text"
                  value={editingPersona.description || ''}
                  onChange={(e) => setEditingPersona({ ...editingPersona, description: e.target.value })}
                  placeholder="Summary of cognitive specialization and reasoning mode"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-zinc-400 mb-1">BASE MODEL</label>
                  <select
                    value={editingPersona.modelAlias || 'claude-haiku-5-5'}
                    onChange={(e) => setEditingPersona({ ...editingPersona, modelAlias: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-zinc-500"
                  >
                    <option value="claude-haiku-5-5">claude-haiku-5-5 (cheapest Claude · loop engine)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1">TEMPERATURE: {editingPersona.temperature ?? 0.6}</label>
                  <input
                    type="range"
                    min="0"
                    max="1.2"
                    step="0.1"
                    value={editingPersona.temperature ?? 0.6}
                    onChange={(e) => setEditingPersona({ ...editingPersona, temperature: parseFloat(e.target.value) })}
                    className="w-full accent-white mt-2"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1">THINKING LEVEL</label>
                  <select
                    value={editingPersona.thinkingLevel || 'HIGH'}
                    onChange={(e) => setEditingPersona({ ...editingPersona, thinkingLevel: e.target.value as any })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-zinc-500"
                  >
                    <option value="HIGH">HIGH (Multi-pass)</option>
                    <option value="LOW">LOW</option>
                    <option value="MINIMAL">MINIMAL</option>
                  </select>
                </div>
              </div>

              {/* Template Injectors */}
              <div>
                <label className="block text-zinc-400 mb-1.5">INJECT PRESET TEMPLATE DIRECTIVE</label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditingPersona({ ...editingPersona, systemInstruction: AIX_ALPHA_QUANTUM_SYSTEM_PROMPT })}
                    className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[10px] text-zinc-300"
                  >
                    + AIX Quantum Mainframe (Ψ, Ω, Φ, Δ, Λ, Θ)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingPersona({ ...editingPersona, systemInstruction: AIX_ALPHA_LE_SYSTEM_PROMPT })}
                    className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[10px] text-zinc-300"
                  >
                    + AIX Distilled Lean Core
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">SYSTEM INSTRUCTION / QUANTUM DIRECTIVES</label>
                <textarea
                  rows={8}
                  value={editingPersona.systemInstruction || ''}
                  onChange={(e) => setEditingPersona({ ...editingPersona, systemInstruction: e.target.value })}
                  placeholder="System instructions guiding cognitive operations, confidence standards, and output formats..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-200 font-mono text-xs focus:outline-none focus:border-zinc-500 leading-relaxed"
                />
              </div>

              {/* Search Grounding Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                <div>
                  <span className="font-bold text-zinc-200 block">Real-Time Web Search Grounding</span>
                  <span className="text-[11px] text-zinc-500">Query live Google indexes and synthesize citations</span>
                </div>
                <input
                  type="checkbox"
                  checked={editingPersona.defaultSearchGrounding ?? true}
                  onChange={(e) => setEditingPersona({ ...editingPersona, defaultSearchGrounding: e.target.checked })}
                  className="w-4 h-4 accent-white"
                />
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => handleExportSingleModelJSON(editingPersona)}
                className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 text-xs font-mono flex items-center gap-1.5 transition-colors"
                title="Export fine-tuned model settings as JSON"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Settings JSON</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="px-4 py-2 rounded-xl text-zinc-400 hover:text-white text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveDrawer}
                  className="px-5 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-bold transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-black" />
                  <span>Save Locally & Deploy</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
