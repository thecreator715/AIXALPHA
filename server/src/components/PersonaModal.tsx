import React, { useState } from 'react';
import { X, Sparkles, Plus, Check, Zap, Globe, Code2, Briefcase, GraduationCap, Bot, Sliders } from 'lucide-react';
import { Persona } from '../types';

interface PersonaModalProps {
  isOpen: boolean;
  onClose: () => void;
  personas: Persona[];
  activePersonaId: string;
  onSelectPersona: (persona: Persona) => void;
  onSaveCustomPersona: (persona: Persona) => void;
}

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  Zap: Zap,
  Globe: Globe,
  Code2: Code2,
  Briefcase: Briefcase,
  GraduationCap: GraduationCap,
  Sparkles: Sparkles,
  Bot: Bot,
};

export const PersonaModal: React.FC<PersonaModalProps> = ({
  isOpen,
  onClose,
  personas,
  activePersonaId,
  onSelectPersona,
  onSaveCustomPersona,
}) => {
  const [tab, setTab] = useState<'select' | 'create' | 'train'>('select');

  // Custom persona form state
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [systemInstruction, setSystemInstruction] = useState('');
  const [defaultSearchGrounding, setDefaultSearchGrounding] = useState(true);
  const [temperature, setTemperature] = useState(0.7);
  const [avatarIcon, setAvatarIcon] = useState('Bot');

  // Agent training state
  const [trainingStatus, setTrainingStatus] = useState<'idle' | 'reading' | 'tokenizing' | 'embedding' | 'complete'>('idle');
  const [trainedTokens, setTrainedTokens] = useState(0);
  const [trainingFile, setTrainingFile] = useState<File | null>(null);
  const [trainedFilesList, setTrainedFilesList] = useState<Array<{ name: string; size: number; tokens: number; date: string }>>(() => {
    const saved = localStorage.getItem('aix_trained_files');
    return saved ? JSON.parse(saved) : [
      { name: 'general_business_logic.json', size: 10421, tokens: 412500, date: '2026-09-08' },
      { name: 'customer_support_faqs.txt', size: 4120, tokens: 180000, date: '2026-09-09' },
      { name: 'api_endpoints_documentation.json', size: 15124, tokens: 648000, date: '2026-09-10' }
    ];
  });

  const handleTrainFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    startTrainingSimulation(file);
  };

  const startTrainingSimulation = (file: File) => {
    setTrainingFile(file);
    setTrainingStatus('reading');
    
    setTimeout(() => {
      setTrainingStatus('tokenizing');
      const mockTokens = Math.floor(file.size * 0.4) + 1200;
      setTrainedTokens(mockTokens);
      
      setTimeout(() => {
        setTrainingStatus('embedding');
        
        setTimeout(() => {
          setTrainingStatus('complete');
          const newDoc = {
            name: file.name,
            size: file.size,
            tokens: mockTokens,
            date: new Date().toISOString().split('T')[0]
          };
          const updatedList = [newDoc, ...trainedFilesList];
          setTrainedFilesList(updatedList);
          localStorage.setItem('aix_trained_files', JSON.stringify(updatedList));
        }, 1500);
      }, 1200);
    }, 1000);
  };

  if (!isOpen) return null;

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !systemInstruction) return;

    const newPersona: Persona = {
      id: `custom_${Date.now()}`,
      name,
      tagline: tagline || 'Custom AI Assistant Persona',
      description: description || 'User defined custom system instructions',
      avatarIcon,
      systemInstruction,
      defaultSearchGrounding,
      modelAlias: 'claude-haiku-5-5',
      temperature,
      voiceName: 'Kore',
      badgeColor: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
      isCustom: true,
    };

    onSaveCustomPersona(newPersona);
    onSelectPersona(newPersona);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-black border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden font-mono">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-zinc-900 text-white border border-zinc-700">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wider uppercase">Persona & Specialization Matrix</h3>
              <p className="text-[11px] text-zinc-500">Configure persona heuristics, temperature & directives</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800">
              <button
                onClick={() => setTab('select')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  tab === 'select' ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-white'
                }`}
              >
                SELECT
              </button>
              <button
                onClick={() => setTab('create')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  tab === 'create' ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Plus className="w-3.5 h-3.5" /> NEW
              </button>
              <button
                onClick={() => setTab('train')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  tab === 'train' ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-400" /> TRAIN
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-900 rounded-lg transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 bg-black">
          {tab === 'select' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {personas.map((persona) => {
                const IconComponent = ICON_MAP[persona.avatarIcon] || Bot;
                const isSelected = persona.id === activePersonaId;

                return (
                  <div
                    key={persona.id}
                    onClick={() => {
                      onSelectPersona(persona);
                      onClose();
                    }}
                    className={`p-4 rounded-xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                      isSelected
                        ? 'bg-zinc-900 border-white ring-1 ring-white/50 text-white shadow-xl'
                        : 'bg-zinc-950 border-zinc-800/80 hover:bg-zinc-900/60 hover:border-zinc-600 text-zinc-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2.5">
                          <div className={`p-2 rounded-lg border ${isSelected ? 'bg-white text-black border-white' : 'bg-zinc-900 text-white border-zinc-700'}`}>
                            <IconComponent className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-white tracking-wide uppercase">{persona.name}</h4>
                            <p className="text-[10px] text-zinc-500 truncate max-w-[150px]">{persona.tagline}</p>
                          </div>
                        </div>
                        {isSelected && (
                          <span className="p-1 rounded-full bg-white text-black">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-zinc-400 leading-relaxed mt-2 line-clamp-2">
                        {persona.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-2 border-t border-zinc-800/80 text-[10px] text-zinc-500">
                      <span>{persona.defaultSearchGrounding ? 'WEB SEARCH ON' : 'OFFLINE DIRECT'}</span>
                      <span className="uppercase font-mono">{persona.voiceName} VOICE</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : tab === 'create' ? (
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 mb-1">PERSONA CODENAME</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Finance Analyst AI"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-zinc-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 mb-1">TAGLINE</label>
                  <input
                    type="text"
                    placeholder="e.g. Wall Street Quantitative Specialist"
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-zinc-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 mb-1">DESCRIPTION</label>
                <input
                  type="text"
                  placeholder="Summary of persona directives and domain expertise"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-zinc-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 mb-1">SYSTEM INSTRUCTION MATRIX</label>
                <textarea
                  required
                  rows={5}
                  placeholder="Define role, tone, output format rules, domain knowledge constraints..."
                  value={systemInstruction}
                  onChange={(e) => setSystemInstruction(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-zinc-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setTab('select')}
                  className="px-4 py-2 rounded-xl text-xs font-mono text-zinc-400 hover:text-white"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold font-mono bg-white hover:bg-zinc-200 text-black shadow-sm active:scale-95 transition-all"
                >
                  SAVE & ACTIVATE
                </button>
              </div>
            </form>
          ) : (
            /* TRAIN TAB - COGNITIVE AGENT TRAINING CENTER */
            <div className="space-y-6 text-zinc-300 font-mono">
              <div className="bg-zinc-950 border border-zinc-800/80 p-5 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-white">
                  <Sparkles className="w-5 h-5 text-purple-400 animate-pulse" />
                  <h4 className="text-sm font-bold uppercase tracking-wider">Cognitive Agent Training Lab</h4>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed text-left">
                  Train the AI agents using raw JSON conversation logs, system mock responses, or text knowledge documents. 
                  Once ingested, the document's facts, patterns, and logic matrices are vectorized and directly integrated 
                  into the model's active context window.
                </p>
              </div>

              {/* Upload Drag and Drop Area */}
              <div className="border border-dashed border-zinc-800 hover:border-purple-500/80 rounded-2xl bg-zinc-950/40 p-8 text-center transition-all relative">
                <input
                  type="file"
                  accept=".json,.txt"
                  onChange={handleTrainFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="flex flex-col items-center justify-center gap-3">
                  <div className="p-3.5 rounded-full bg-zinc-900 text-zinc-400 border border-zinc-800">
                    <Sparkles className="w-6 h-6 text-purple-400 animate-bounce" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">DRAG & DROP TRAINING FILE HERE</p>
                    <p className="text-[10px] text-zinc-500 mt-1">Supports raw JSON structured datasets or raw .txt documentation files</p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-300">
                    OR CHOOSE FILE
                  </span>
                </div>
              </div>

              {/* Progress Tracker Simulation */}
              {trainingStatus !== 'idle' && (
                <div className="bg-zinc-950 border border-purple-900/60 p-4.5 rounded-2xl space-y-3">
                  <div className="flex justify-between text-xs font-bold text-white">
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-spin" />
                      {trainingStatus === 'reading' && 'READING FILE STREAM...'}
                      {trainingStatus === 'tokenizing' && 'EXTRACTING & TOKENIZING COGNITIVE BLOCKS...'}
                      {trainingStatus === 'embedding' && 'COMPILING SEMANTIC EMBEDDINGS...'}
                      {trainingStatus === 'complete' && 'TRAINING COMPLETE & SYSTEM RELOADED!'}
                    </span>
                    <span className="text-purple-400 uppercase font-bold">
                      {trainingStatus === 'reading' && '20%'}
                      {trainingStatus === 'tokenizing' && '50%'}
                      {trainingStatus === 'embedding' && '85%'}
                      {trainingStatus === 'complete' && '100% SUCCESS'}
                    </span>
                  </div>

                  <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden border border-zinc-800">
                    <div 
                      className={`h-full bg-purple-500 transition-all duration-500 ease-out`}
                      style={{ 
                        width: 
                          trainingStatus === 'reading' ? '20%' : 
                          trainingStatus === 'tokenizing' ? '50%' : 
                          trainingStatus === 'embedding' ? '85%' : '100%' 
                      }}
                    />
                  </div>

                  {trainingFile && (
                    <div className="text-[10px] text-zinc-400 flex items-center justify-between border-t border-zinc-900 pt-2 font-mono">
                      <span>FILE: {trainingFile.name} ({(trainingFile.size / 1024).toFixed(1)} KB)</span>
                      {trainedTokens > 0 && <span className="text-purple-400">{trainedTokens} TOKENS GENERATED</span>}
                    </div>
                  )}
                </div>
              )}

              {/* List of Trained Documents */}
              <div className="space-y-2.5">
                <div className="text-xs font-bold text-white flex items-center justify-between">
                  <span>ACTIVE COGNITIVE DATABASES ({trainedFilesList.length})</span>
                  <span className="text-[10px] text-zinc-500">DYNAMIC WEIGHT LOAD</span>
                </div>

                <div className="space-y-2">
                  {trainedFilesList.map((doc, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-zinc-950 border border-zinc-900 hover:border-zinc-800 transition-all">
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                        </div>
                        <div className="truncate text-left">
                          <p className="text-xs font-semibold text-white truncate">{doc.name}</p>
                          <p className="text-[9px] text-zinc-500">Size: {(doc.size / 1024).toFixed(1)} KB • Ingested: {doc.date}</p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-800 text-[9px] font-bold">
                        {doc.tokens.toLocaleString()} TOKENS
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
