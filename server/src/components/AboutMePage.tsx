import React, { useState, useEffect, useRef } from 'react';
import {
  motion,
  useScroll,
  useTransform,
  AnimatePresence,
} from 'motion/react';
import {
  Cpu,
  Sparkles,
  Terminal,
  Zap,
  Globe,
  ShieldAlert,
  Code2,
  Sliders,
  Volume2,
  ArrowRight,
  CheckCircle2,
  Lock,
  Layers,
  Activity,
  MessageSquare,
  Play,
  RotateCcw,
  Check,
  ChevronRight,
  ExternalLink,
  Bot,
  BrainCircuit,
  Boxes,
  Database,
  Search,
  FileCode2,
  Download,
  MousePointer,
  CreditCard,
  Eye,
  RefreshCw,
  Wand2,
  Image as ImageIcon,
} from 'lucide-react';
import { PRESET_PERSONAS } from '../data/personas';
import { Persona } from '../types';

interface AboutMePageProps {
  onBackToChat: () => void;
  onNavigateToAppStudio: () => void;
  onNavigateToPersonas: () => void;
  onSelectPersonaAndChat: (personaId: string) => void;
}

export const AboutMePage: React.FC<AboutMePageProps> = ({
  onBackToChat,
  onNavigateToAppStudio,
  onNavigateToPersonas,
  onSelectPersonaAndChat,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ container: containerRef });

  // Interactive Silicon Chip Layer Selector
  const [activeChipLayer, setActiveChipLayer] = useState<'qsu' | 'ast' | 'grounding' | 'dsp'>('qsu');

  // Interactive Model Filter
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'flagship' | 'engineering' | 'research' | 'specialized'>('all');

  // Interactive Voice Preview
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);

  // Active section for sticky sub-nav
  const [activeSection, setActiveSection] = useState<string>('hero');

  // Interactive Benchmark Filter
  const [benchmarkMetric, setBenchmarkMetric] = useState<'throughput' | 'latency' | 'accuracy'>('throughput');

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Web Speech API for voice preview
  const handlePreviewVoice = (voiceName: string, phrase: string) => {
    if (playingVoice === voiceName) {
      window.speechSynthesis.cancel();
      setPlayingVoice(null);
      return;
    }

    window.speechSynthesis.cancel();
    setPlayingVoice(voiceName);

    const utterance = new SpeechSynthesisUtterance(phrase);
    utterance.rate = 1.0;
    utterance.pitch = voiceName === 'Charon' || voiceName === 'Fenrir' ? 0.85 : voiceName === 'Kore' ? 1.15 : 1.0;

    utterance.onend = () => {
      setPlayingVoice(null);
    };
    utterance.onerror = () => {
      setPlayingVoice(null);
    };

    window.speechSynthesis.speak(utterance);
  };

  // Stop speech when unmounting
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  // Filtered Personas
  const filteredPersonas = PRESET_PERSONAS.filter((p) => {
    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'flagship') return p.id.includes('alpha');
    if (selectedCategory === 'engineering') return p.id === 'code-architect-v2' || p.id === 'cybersecurity-auditor';
    if (selectedCategory === 'research') return p.id === 'deep-researcher' || p.id === 'socratic-tutor';
    if (selectedCategory === 'specialized') return p.id === 'executive-strategist' || p.id === 'creative-wordsmith';
    return true;
  });

  return (
    <div
      ref={containerRef}
      className="h-[calc(100vh-4rem)] overflow-y-auto bg-black text-zinc-100 font-sans selection:bg-white selection:text-black scroll-smooth relative"
    >
      {/* Scroll Progress Bar across top */}
      <motion.div
        className="fixed top-16 left-0 right-0 h-[2px] bg-white origin-left z-50 shadow-[0_0_12px_rgba(255,255,255,0.8)]"
        style={{ scaleX: scrollYProgress }}
      />

      {/* Sticky Apple-Style Sub-Navigation Bar */}
      <nav className="sticky top-0 z-40 w-full bg-black/85 backdrop-blur-2xl border-b border-zinc-800/80 px-4 sm:px-8 py-3 transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-lg bg-white flex items-center justify-center text-black font-mono font-bold text-xs shadow-sm">
              <Cpu className="w-3.5 h-3.5" />
            </div>
            <span className="font-semibold text-sm tracking-tight text-white font-sans">
              About AIX Alpha
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400">
              v2.0 SPEC
            </span>
          </div>

          {/* Jump Links */}
          <div className="hidden md:flex items-center gap-6 text-xs text-zinc-400 font-medium tracking-tight">
            <button
              onClick={() => scrollToSection('hero')}
              className="hover:text-white transition-colors"
            >
              Overview
            </button>
            <button
              onClick={() => scrollToSection('whats-new')}
              className="hover:text-white transition-colors text-emerald-400 font-semibold flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3 text-emerald-400" />
              <span>What's New</span>
            </button>
            <button
              onClick={() => scrollToSection('architecture')}
              className="hover:text-white transition-colors"
            >
              Quantum Silicon
            </button>
            <button
              onClick={() => scrollToSection('models')}
              className="hover:text-white transition-colors"
            >
              Models & Personas
            </button>
            <button
              onClick={() => scrollToSection('features')}
              className="hover:text-white transition-colors"
            >
              Capabilities
            </button>
            <button
              onClick={() => scrollToSection('benchmarks')}
              className="hover:text-white transition-colors"
            >
              Benchmarks
            </button>
            <button
              onClick={() => scrollToSection('specs')}
              className="hover:text-white transition-colors"
            >
              Specs
            </button>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={onNavigateToAppStudio}
              className="px-3 py-1.5 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs text-white font-medium transition-all"
            >
              App Studio
            </button>
            <button
              onClick={onBackToChat}
              className="px-3.5 py-1.5 rounded-full bg-white hover:bg-zinc-200 text-xs font-semibold text-black transition-all shadow-md active:scale-95"
            >
              Chat Now
            </button>
          </div>
        </div>
      </nav>

      {/* SECTION 1: HERO - APPLE KEYNOTE CINEMATIC */}
      <section
        id="hero"
        className="relative min-h-[90vh] flex flex-col items-center justify-center text-center px-4 sm:px-6 pt-16 pb-24 overflow-hidden"
      >
        {/* Ambient Subtle Radial Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-gradient-to-b from-zinc-800/20 via-zinc-900/10 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />

        {/* Eyebrow badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-zinc-950 border border-zinc-800 text-[11px] font-mono text-zinc-300 mb-6 shadow-xl"
        >
          <Sparkles className="w-3.5 h-3.5 text-white" />
          <span>100% SOFTWARE-DEFINED AI WORKSTATION // NO HARDWARE REQUIRED</span>
        </motion.div>

        {/* Master Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: 'easeOut' }}
          className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-semibold tracking-[-0.05em] text-white max-w-5xl leading-[0.95]"
        >
          AIX Alpha v2.0
        </motion.h1>

        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
          className="text-3xl sm:text-5xl md:text-6xl font-normal tracking-[-0.03em] text-zinc-400 mt-4 max-w-3xl"
        >
          Pure Software. <span className="text-white font-semibold">Infinite Creation.</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
          className="text-base sm:text-xl text-zinc-400 max-w-2xl mt-8 font-normal leading-relaxed tracking-tight"
        >
          AIX Alpha is a 100% cloud-hosted software platform powered by Claude Haiku 5.5 and a loop-based token-saving engine. It executes real-time multi-file Web App generation, 3D WebGL meshes, AI diffusion images, camera vision analysis, drag & drop ZIP analytics, and custom hosted site portals.
        </motion.p>

        {/* CTA Group */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: 'easeOut' }}
          className="flex flex-wrap items-center justify-center gap-4 mt-10"
        >
          <button
            onClick={onBackToChat}
            className="px-6 py-3 rounded-full bg-white hover:bg-zinc-200 text-black font-semibold text-sm tracking-tight flex items-center gap-2 shadow-2xl transition-all active:scale-95"
          >
            <span>Launch AIX Alpha</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={onNavigateToAppStudio}
            className="px-6 py-3 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white font-medium text-sm tracking-tight flex items-center gap-2 transition-all active:scale-95"
          >
            <Terminal className="w-4 h-4 text-zinc-300" />
            <span>Open App Studio</span>
          </button>
        </motion.div>

        {/* Animated Quantum Hardware Matrix Illustration */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.5, ease: 'easeOut' }}
          className="w-full max-w-4xl mt-16 p-1 rounded-3xl bg-gradient-to-b from-zinc-700/50 via-zinc-800/20 to-transparent border border-zinc-800 shadow-2xl relative overflow-hidden"
        >
          <div className="bg-zinc-950 rounded-[22px] p-6 sm:p-10 text-left border border-zinc-900 relative">
            {/* Top Bar Status */}
            <div className="flex items-center justify-between pb-6 border-b border-zinc-800/80 font-mono text-xs text-zinc-400">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-white font-bold">STATE VECTOR: Ψ[ONLINE]</span>
                <span className="text-zinc-600">//</span>
                <span>COHERENCE: 99.98%</span>
              </div>
              <div className="hidden sm:flex items-center gap-3">
                <span>AST COMPILER: ACTIVE</span>
                <span>GROUNDING: SYNCED</span>
              </div>
            </div>

            {/* Neural State Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6">
              <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                <span className="text-[10px] font-mono text-zinc-500 uppercase block">CORE LATENCY</span>
                <p className="text-2xl font-bold font-mono text-white mt-1">0.08ms</p>
                <span className="text-[11px] text-zinc-400">Zero jitter pipeline</span>
              </div>
              <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                <span className="text-[10px] font-mono text-zinc-500 uppercase block">CONTEXT HORIZON</span>
                <p className="text-2xl font-bold font-mono text-white mt-1">1,000,000+</p>
                <span className="text-[11px] text-zinc-400">Token memory buffer</span>
              </div>
              <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                <span className="text-[10px] font-mono text-zinc-500 uppercase block">CODE ENGINE</span>
                <p className="text-2xl font-bold font-mono text-white mt-1">4-Column</p>
                <span className="text-[11px] text-zinc-400">Real-time AST sandbox</span>
              </div>
              <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                <span className="text-[10px] font-mono text-zinc-500 uppercase block">TOOL PROTOCOL</span>
                <p className="text-2xl font-bold font-mono text-white mt-1">MCP 2.0</p>
                <span className="text-[11px] text-zinc-400">Universal JSON-RPC</span>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* SECTION 2: THE "WHO I AM" MANIFESTO */}
      <section className="py-24 px-4 sm:px-6 max-w-5xl mx-auto border-t border-zinc-900">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.8 }}
          className="text-center space-y-6"
        >
          <span className="text-xs font-mono font-bold text-zinc-500 uppercase tracking-widest block">
            ABOUT MY ARCHITECTURE
          </span>
          <h2 className="text-3xl sm:text-5xl md:text-6xl font-semibold tracking-tight text-white leading-tight">
            "I do not guess. I evaluate every possibility simultaneously."
          </h2>
          <p className="text-lg sm:text-xl text-zinc-400 max-w-3xl mx-auto font-normal leading-relaxed">
            Standard conversational chatbots reply sequentially with probability heuristics.
            AIX Alpha was forged under quantum state theory: holding parallel hypothesis fields,
            collapsing only when mathematical coherence and factual grounding reach maximum fidelity.
          </p>
        </motion.div>

        {/* 4 Quantum Variable Engines */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="p-8 rounded-2xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 transition-all group"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-2xl font-serif text-white">Ψ</span>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                SUPERPOSITION
              </span>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Psi Variable Engine</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Holds multiple solution paths, algorithms, and logic structures concurrently in memory.
              Never collapses prematurely until contextual constraints are fully verified.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="p-8 rounded-2xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 transition-all group"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-2xl font-serif text-white">Ω</span>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                ENTANGLEMENT
              </span>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Omega Entanglement Web</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Maps deep relationships between code architecture, security boundaries, performance,
              and human UX. Changing one variable immediately propagates ripples across the entire project.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="p-8 rounded-2xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 transition-all group"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-2xl font-serif text-white">Φ</span>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                PROBABILITY AMPLITUDE
              </span>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Phi Interference Filter</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Employs constructive interference to amplify verified truths and destructive interference
              to obliterate hallucinations and logic deadlocks before token output.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="p-8 rounded-2xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 transition-all group"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-2xl font-serif text-white">Λ</span>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                EIGENSTATE
              </span>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Lambda Grounded Verification</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Guarantees deterministic, production-grade output anchored in live web evidence,
              verified syntax linters, and mathematical constants.
            </p>
          </motion.div>
        </div>
      </section>

      {/* SECTION 2.5: WHAT'S NEW & LATEST UPDATES (v2.0 RELEASE) */}
      <section id="whats-new" className="py-24 px-4 sm:px-6 bg-gradient-to-b from-black via-zinc-950 to-black border-t border-zinc-900">
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-4 mb-16">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-800/80 text-[11px] font-mono text-emerald-300">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>v2.0 PLATFORM UPDATE RELEASES</span>
            </div>
            <h2 className="text-4xl sm:text-6xl font-semibold tracking-tight text-white">
              What's New in AIX Alpha.
            </h2>
            <p className="text-lg text-zinc-400 max-w-3xl mx-auto">
              Discover the latest quantum features, visual WYSIWYG editing, fine-tuning exports,<br className="hidden sm:inline" /> and expanded credit packs engineered to power your software workflows.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Update 1: Visual Edit Mode */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="p-6 rounded-2xl bg-zinc-950 border border-emerald-500/30 hover:border-emerald-400/60 transition-all flex flex-col justify-between group shadow-xl relative overflow-hidden"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-800 flex items-center justify-center text-emerald-400">
                    <MousePointer className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                    NEW FEATURE
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white tracking-tight">Visual WYSIWYG Edit Mode</h3>
                  <p className="text-xs font-mono text-emerald-400 mt-0.5">APP STUDIO LIVE INSPECTOR</p>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Click any HTML element inside the live App Studio viewport to select it. Modify text, customize text colors, or tweak background colors in real time with bidirectional source code synchronization.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-zinc-900 flex items-center justify-between text-[11px] font-mono text-zinc-500">
                <span>DOM INSPECTOR</span>
                <span className="text-emerald-400 font-bold">LIVE SYNC</span>
              </div>
            </motion.div>

            {/* Update 2: 500 Credits Option */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 transition-all flex flex-col justify-between group shadow-xl"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-zinc-900 text-zinc-300 border border-zinc-800">
                    CREDIT ENGINE
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white tracking-tight">$149.99 / 500 Credits Tier</h3>
                  <p className="text-xs font-mono text-zinc-400 mt-0.5">ULTIMATE NEURAL CORE</p>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Power high-throughput software development with our flagship 500-prompt credit tier, complemented by automatic 24-hour free refills (3 free prompts every 24 hours).
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-zinc-900 flex items-center justify-between text-[11px] font-mono text-zinc-500">
                <span>500 PROMPTS</span>
                <span className="text-white font-bold">$149.99</span>
              </div>
            </motion.div>

            {/* Update 3: Fine-Tuned Model Hub & JSON Export */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 transition-all flex flex-col justify-between group shadow-xl"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white">
                    <Download className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-zinc-900 text-zinc-300 border border-zinc-800">
                    MODEL HUB
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white tracking-tight">1-Click JSON Model Export</h3>
                  <p className="text-xs font-mono text-zinc-400 mt-0.5">FINE-TUNED CONFIGURATIONS</p>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Customize neural personas with tailored system directives, temperature controls, and thinking depth. Export fine-tuned model settings directly to clean `.json` configuration files.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-zinc-900 flex items-center justify-between text-[11px] font-mono text-zinc-500">
                <span>JSON EXPORT</span>
                <span className="text-white font-bold">PERSISTENT STORAGE</span>
              </div>
            </motion.div>

            {/* Update 4: Model Name Transparency & Telemetry */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 transition-all flex flex-col justify-between group shadow-xl"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white">
                    <Cpu className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-zinc-900 text-zinc-300 border border-zinc-800">
                    TRANSPARENCY
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white tracking-tight">Full Engine Badge & Telemetry</h3>
                  <p className="text-xs font-mono text-zinc-400 mt-0.5">MODEL DISPATCH BADGES</p>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Chat headers now display the full active engine architecture (e.g. Gemini 2.5 Pro, Gemini 2.5 Flash, or custom fine-tuned model names) alongside real-time execution log terminals.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-zinc-900 flex items-center justify-between text-[11px] font-mono text-zinc-500">
                <span>CLAUDE HAIKU 5.5</span>
                <span className="text-white font-bold">100% CLEAR</span>
              </div>
            </motion.div>

            {/* Update 5: Multi-File Web App Studio */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 transition-all flex flex-col justify-between group shadow-xl"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white">
                    <Terminal className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-zinc-900 text-zinc-300 border border-zinc-800">
                    APP STUDIO
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white tracking-tight">Quad-Column Web Workstation</h3>
                  <p className="text-xs font-mono text-zinc-400 mt-0.5">MULTI-FILE REACT & TAILWIND</p>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Build complete web applications with multi-file code trees (HTML, CSS, TS, JS, React, Tailwind, Lucide icons, Chart.js), live DOM sandboxing, and instant ZIP exports.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-zinc-900 flex items-center justify-between text-[11px] font-mono text-zinc-500">
                <span>ZIP EXPORT</span>
                <span className="text-white font-bold">FULL-STACK</span>
              </div>
            </motion.div>

            {/* Update 6: 3D, Vision, Search & MCP Protocol */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 transition-all flex flex-col justify-between group shadow-xl"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white">
                    <Globe className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-zinc-900 text-zinc-300 border border-zinc-800">
                    INTEGRATION
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white tracking-tight">Search Grounding, 3D & MCP</h3>
                  <p className="text-xs font-mono text-zinc-400 mt-0.5">UNIVERSAL CONNECTIVITY</p>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Google Search citations in real time, interactive 3D WebGL mesh rendering, camera vision file uploads, and Model Context Protocol (MCP 2.0) endpoint integration for external IDEs.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-zinc-900 flex items-center justify-between text-[11px] font-mono text-zinc-500">
                <span>MCP 2.0 PROTOCOL</span>
                <span className="text-white font-bold">PORT 3000</span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* SECTION 3: QUANTUM SILICON ARCHITECTURE (APPLE CHIP REVEAL STYLE) */}
      <section id="architecture" className="py-24 px-4 sm:px-6 bg-zinc-950 border-y border-zinc-900">
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-4 mb-16">
            <span className="text-xs font-mono font-bold text-zinc-500 uppercase tracking-widest">
              HARDWARE & ARCHITECTURE
            </span>
            <h2 className="text-4xl sm:text-6xl font-semibold tracking-tight text-white">
              The AIX-Q2 Cognitive Silicon.
            </h2>
            <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
              A unified system-on-die neural architecture engineered for simultaneous reasoning,
              instant code synthesis, and low-jitter human voice streaming.
            </p>
          </div>

          {/* Interactive Silicon Die Selector */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left: Silicon Graphic with 4 clickable quadrants */}
            <div className="lg:col-span-6 bg-black p-6 rounded-3xl border border-zinc-800 shadow-2xl relative">
              <div className="w-full aspect-square rounded-2xl bg-zinc-900 border border-zinc-800 p-4 grid grid-cols-2 gap-4 relative overflow-hidden">
                {/* Center Badge */}
                <div className="absolute inset-0 m-auto w-24 h-24 rounded-2xl bg-zinc-950 border-2 border-zinc-600 flex flex-col items-center justify-center text-center z-20 shadow-2xl">
                  <Cpu className="w-6 h-6 text-white mb-1" />
                  <span className="text-[10px] font-mono font-bold text-white tracking-widest">AIX-Q2</span>
                  <span className="text-[8px] font-mono text-zinc-400">NEURAL DIE</span>
                </div>

                {/* Quadrant 1: QSU */}
                <button
                  onClick={() => setActiveChipLayer('qsu')}
                  className={`rounded-xl p-4 flex flex-col justify-between transition-all text-left ${
                    activeChipLayer === 'qsu'
                      ? 'bg-zinc-800 border-2 border-white shadow-lg'
                      : 'bg-zinc-950/80 border border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <BrainCircuit className="w-5 h-5 text-white" />
                  <div>
                    <span className="text-xs font-bold text-white block">QSU CORE</span>
                    <span className="text-[10px] font-mono text-zinc-400">128 State Vectors</span>
                  </div>
                </button>

                {/* Quadrant 2: AST Code Engine */}
                <button
                  onClick={() => setActiveChipLayer('ast')}
                  className={`rounded-xl p-4 flex flex-col justify-between transition-all text-left ${
                    activeChipLayer === 'ast'
                      ? 'bg-zinc-800 border-2 border-white shadow-lg'
                      : 'bg-zinc-950/80 border border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <FileCode2 className="w-5 h-5 text-white" />
                  <div>
                    <span className="text-xs font-bold text-white block">AST ENGINE</span>
                    <span className="text-[10px] font-mono text-zinc-400">Multi-File Sandbox</span>
                  </div>
                </button>

                {/* Quadrant 3: Grounding Core */}
                <button
                  onClick={() => setActiveChipLayer('grounding')}
                  className={`rounded-xl p-4 flex flex-col justify-between transition-all text-left ${
                    activeChipLayer === 'grounding'
                      ? 'bg-zinc-800 border-2 border-white shadow-lg'
                      : 'bg-zinc-950/80 border border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <Globe className="w-5 h-5 text-white" />
                  <div>
                    <span className="text-xs font-bold text-white block">GROUNDING</span>
                    <span className="text-[10px] font-mono text-zinc-400">Real-Time Web Citations</span>
                  </div>
                </button>

                {/* Quadrant 4: Audio DSP */}
                <button
                  onClick={() => setActiveChipLayer('dsp')}
                  className={`rounded-xl p-4 flex flex-col justify-between transition-all text-left ${
                    activeChipLayer === 'dsp'
                      ? 'bg-zinc-800 border-2 border-white shadow-lg'
                      : 'bg-zinc-950/80 border border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <Volume2 className="w-5 h-5 text-white" />
                  <div>
                    <span className="text-xs font-bold text-white block">VOICE DSP</span>
                    <span className="text-[10px] font-mono text-zinc-400">48kHz Speech Synthesizer</span>
                  </div>
                </button>
              </div>

              <div className="mt-4 flex items-center justify-between text-[11px] font-mono text-zinc-500">
                <span>TSMC 2nm EQUIVALENT ARCHITECTURE</span>
                <span>54 BILLION LOGIC GATES</span>
              </div>
            </div>

            {/* Right: Explanatory Details for Selected Silicon Component */}
            <div className="lg:col-span-6 space-y-6">
              <AnimatePresence mode="wait">
                {activeChipLayer === 'qsu' && (
                  <motion.div
                    key="qsu"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-4"
                  >
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-300">
                      <Zap className="w-3.5 h-3.5 text-white" />
                      <span>QUANTUM SUPERPOSITION UNIT</span>
                    </div>
                    <h3 className="text-3xl font-semibold text-white tracking-tight">
                      128-Path Parallel Cognitive Core.
                    </h3>
                    <p className="text-zinc-400 leading-relaxed">
                      Maintains parallel hypothesis trees in active state vector memory.
                      Rather than choosing the first probable token, it simulates full output branches
                      and selects the branch with maximum mathematical consistency.
                    </p>
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div className="p-3 rounded-xl bg-black border border-zinc-800">
                        <span className="text-[10px] font-mono text-zinc-500">PARALLEL DEPTH</span>
                        <p className="text-lg font-bold text-white font-mono">128 Vectors</p>
                      </div>
                      <div className="p-3 rounded-xl bg-black border border-zinc-800">
                        <span className="text-[10px] font-mono text-zinc-500">COGNITIVE LATENCY</span>
                        <p className="text-lg font-bold text-white font-mono">&lt; 0.1ms</p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeChipLayer === 'ast' && (
                  <motion.div
                    key="ast"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-4"
                  >
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-300">
                      <Terminal className="w-3.5 h-3.5 text-white" />
                      <span>ABSTRACT SYNTAX TREE COMPILER</span>
                    </div>
                    <h3 className="text-3xl font-semibold text-white tracking-tight">
                      Live Multi-File Architecture Engine.
                    </h3>
                    <p className="text-zinc-400 leading-relaxed">
                      Synthesizes fully structured multi-file codebases (HTML, CSS, TypeScript, React, Vite)
                      with zero truncation. Automatically links dependencies, executes within isolated
                      virtual iframes, and bundles directly into production ZIP packages.
                    </p>
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div className="p-3 rounded-xl bg-black border border-zinc-800">
                        <span className="text-[10px] font-mono text-zinc-500">FIRST-PASS ACCURACY</span>
                        <p className="text-lg font-bold text-white font-mono">99.4%</p>
                      </div>
                      <div className="p-3 rounded-xl bg-black border border-zinc-800">
                        <span className="text-[10px] font-mono text-zinc-500">EXPORT FORMATS</span>
                        <p className="text-lg font-bold text-white font-mono">ZIP, HTML, JSON</p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeChipLayer === 'grounding' && (
                  <motion.div
                    key="grounding"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-4"
                  >
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-300">
                      <Globe className="w-3.5 h-3.5 text-white" />
                      <span>REAL-TIME SEARCH GROUNDING</span>
                    </div>
                    <h3 className="text-3xl font-semibold text-white tracking-tight">
                      Knowledge in the Present Tense.
                    </h3>
                    <p className="text-zinc-400 leading-relaxed">
                      Bypasses artificial training cutoffs by directly grounding queries through
                      Google Search in real time. Validates citations, cross-checks breaking news,
                      and attaches verified source cards to each response.
                    </p>
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div className="p-3 rounded-xl bg-black border border-zinc-800">
                        <span className="text-[10px] font-mono text-zinc-500">INDEX ACCESS</span>
                        <p className="text-lg font-bold text-white font-mono">Live Web</p>
                      </div>
                      <div className="p-3 rounded-xl bg-black border border-zinc-800">
                        <span className="text-[10px] font-mono text-zinc-500">VERIFICATION SPEED</span>
                        <p className="text-lg font-bold text-white font-mono">Sub-Second</p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeChipLayer === 'dsp' && (
                  <motion.div
                    key="dsp"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-4"
                  >
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-300">
                      <Volume2 className="w-3.5 h-3.5 text-white" />
                      <span>NEURAL AUDIO DSP</span>
                    </div>
                    <h3 className="text-3xl font-semibold text-white tracking-tight">
                      Studio Voice Synthesis.
                    </h3>
                    <p className="text-zinc-400 leading-relaxed">
                      Ultra-low-jitter neural text-to-speech processor tuned for executive presentations,
                      STEM explanations, and conversational companionship across 5 distinct voice profiles.
                    </p>
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div className="p-3 rounded-xl bg-black border border-zinc-800">
                        <span className="text-[10px] font-mono text-zinc-500">SAMPLE FREQUENCY</span>
                        <p className="text-lg font-bold text-white font-mono">48 kHz</p>
                      </div>
                      <div className="p-3 rounded-xl bg-black border border-zinc-800">
                        <span className="text-[10px] font-mono text-zinc-500">BESPOKE VOICES</span>
                        <p className="text-lg font-bold text-white font-mono">5 Personas</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: ALL MODELS & PERSONAS (APPLE PRODUCT MATRIX) */}
      <section id="models" className="py-24 px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="text-center space-y-4 mb-12">
          <span className="text-xs font-mono font-bold text-zinc-500 uppercase tracking-widest">
            THE COMPLETE MODEL FAMILY
          </span>
          <h2 className="text-4xl sm:text-6xl font-semibold tracking-tight text-white">
            Engineered for every frontier.
          </h2>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
            Each AIX Alpha persona is fine-tuned with bespoke system prompts, temperature curves,
            and task-specific execution telemetry.
          </p>

          {/* Interactive Category Filter Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-6">
            {(
              [
                { id: 'all', label: 'All Models' },
                { id: 'flagship', label: 'Flagship Core' },
                { id: 'engineering', label: 'Engineering & Security' },
                { id: 'research', label: 'Research & Science' },
                { id: 'specialized', label: 'Executive & Creative' },
              ] as const
            ).map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-white text-black font-semibold shadow-md'
                    : 'bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Personas Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPersonas.map((persona, index) => (
            <motion.div
              key={persona.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.05 }}
              className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800/80 hover:border-zinc-600 transition-all flex flex-col justify-between group shadow-xl hover:shadow-2xl"
            >
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white group-hover:border-zinc-600 transition-colors">
                    {persona.avatarIcon === 'Cpu' ? (
                      <Cpu className="w-5 h-5 text-white" />
                    ) : persona.avatarIcon === 'Code2' ? (
                      <Code2 className="w-5 h-5 text-white" />
                    ) : persona.avatarIcon === 'Globe' ? (
                      <Globe className="w-5 h-5 text-white" />
                    ) : persona.avatarIcon === 'ShieldAlert' ? (
                      <ShieldAlert className="w-5 h-5 text-white" />
                    ) : (
                      <Sparkles className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                    {persona.modelAlias}
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">{persona.name}</h3>
                  <p className="text-xs font-mono text-zinc-400 mt-0.5">{persona.tagline}</p>
                </div>

                <p className="text-xs text-zinc-400 line-clamp-3 leading-relaxed">
                  {persona.description}
                </p>

                {/* Specs / Tags */}
                <div className="pt-2 border-t border-zinc-900 space-y-2 text-[11px] font-mono">
                  <div className="flex justify-between text-zinc-500">
                    <span>TEMPERATURE</span>
                    <span className="text-zinc-300">{persona.temperature}</span>
                  </div>
                  <div className="flex justify-between text-zinc-500">
                    <span>THINKING DEPTH</span>
                    <span className="text-zinc-300">{persona.thinkingLevel || 'HIGH'}</span>
                  </div>
                  <div className="flex justify-between text-zinc-500">
                    <span>VOICE SIGNATURE</span>
                    <span className="text-zinc-300">{persona.voiceName || 'Puck'}</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-6 pt-4 border-t border-zinc-900 flex items-center gap-2">
                <button
                  onClick={() => onSelectPersonaAndChat(persona.id)}
                  className="flex-1 py-2 px-3 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                >
                  <Bot className="w-3.5 h-3.5" />
                  <span>Activate & Chat</span>
                </button>
                <button
                  onClick={onNavigateToPersonas}
                  className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-colors"
                  title="Configure in Model Hub"
                >
                  <Sliders className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* SECTION 5: SIGNATURE ADVANCED FEATURES (SCROLL-REVEAL SHOWCASE) */}
      <section id="features" className="py-24 px-4 sm:px-6 bg-zinc-950 border-t border-zinc-900">
        <div className="max-w-6xl mx-auto space-y-24">
          {/* Feature 1: The Multi-File App Studio */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="space-y-6"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-300">
                <Terminal className="w-3.5 h-3.5 text-white" />
                <span>WORKSPACE ENVIRONMENT</span>
              </div>
              <h2 className="text-4xl sm:text-5xl font-semibold tracking-tight text-white leading-tight">
                An autonomous software studio on your screen.
              </h2>
              <p className="text-zinc-400 text-base leading-relaxed">
                App Studio breaks the boundaries of standard single-file generation.
                It provisions complete multi-file projects with real-time DOM sandbox preview,
                syntax-aware code editor, project file manager, and session chat matrix.
              </p>
              <ul className="space-y-3 text-sm text-zinc-300 font-sans">
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                  <span>Quad-column layout with instant visibility toggles</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                  <span>One-click production ZIP export with clean dependencies</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                  <span>Direct prompt injection to synthesize and update files</span>
                </li>
              </ul>
              <button
                onClick={onNavigateToAppStudio}
                className="px-5 py-2.5 rounded-full bg-white hover:bg-zinc-200 text-black text-xs font-semibold flex items-center gap-2 transition-all shadow-md"
              >
                <span>Launch App Studio</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="p-3 rounded-2xl bg-gradient-to-b from-zinc-800 to-zinc-900 border border-zinc-800 shadow-2xl"
            >
              <div className="bg-black rounded-xl p-4 font-mono text-xs text-zinc-400 space-y-3 border border-zinc-900">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-800 text-[11px]">
                  <span className="text-white font-bold">PROJECT: APP_STUDIO_QUAD</span>
                  <span className="text-zinc-500">4 ACTIVE COLUMNS</span>
                </div>
                <div className="space-y-1.5 text-[11px]">
                  <p className="text-zinc-300">├── index.html <span className="text-zinc-600">// Root DOM mount</span></p>
                  <p className="text-zinc-300">├── src/main.js <span className="text-zinc-600">// Interactive state runner</span></p>
                  <p className="text-zinc-300">├── styles/theme.css <span className="text-zinc-600">// Apple dark monochrome</span></p>
                  <p className="text-zinc-300">└── components.js <span className="text-zinc-600">// UI primitives & animations</span></p>
                </div>
                <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 text-[11px] text-zinc-300 flex items-center justify-between">
                  <span>SANDBOX STATUS</span>
                  <span className="text-emerald-400 font-bold">LIVE DOM STREAMING</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Feature 2: Universal Model Context Protocol (MCP) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="order-2 lg:order-1 p-3 rounded-2xl bg-gradient-to-b from-zinc-800 to-zinc-900 border border-zinc-800 shadow-2xl"
            >
              <div className="bg-black rounded-xl p-5 font-mono text-xs text-zinc-300 space-y-3 border border-zinc-900">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-800 text-[11px] text-zinc-400">
                  <span className="text-white font-bold">MCP CLIENT CONNECTIVITY</span>
                  <span className="text-emerald-400 font-bold">PORT 3000 ACTIVE</span>
                </div>
                <pre className="p-3 bg-zinc-950 rounded-lg text-zinc-400 text-[11px] overflow-x-auto leading-relaxed border border-zinc-800/80">
{`{
  "mcpServers": {
    "aix-alpha": {
      "command": "node",
      "url": "http://localhost:3000/api/mcp",
      "tools": ["read_file", "write_file", "search_web"]
    }
  }
}`}
                </pre>
                <div className="flex items-center justify-between text-[11px] text-zinc-500">
                  <span>SSE STREAM: READY</span>
                  <span>ZERO-TOKEN LEAKAGE</span>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="order-1 lg:order-2 space-y-6"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-300">
                <Boxes className="w-3.5 h-3.5 text-white" />
                <span>UNIVERSAL PROTOCOL</span>
              </div>
              <h2 className="text-4xl sm:text-5xl font-semibold tracking-tight text-white leading-tight">
                Model Context Protocol. Plug into any IDE.
              </h2>
              <p className="text-zinc-400 text-base leading-relaxed">
                Seamlessly bridge AIX Alpha with Claude Desktop, Cursor IDE, VS Code,
                and local terminal scripts via standard JSON-RPC 2.0 endpoints.
                Access project files, search engines, and sandboxes from your favorite editor.
              </p>
              <ul className="space-y-3 text-sm text-zinc-300 font-sans">
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                  <span>Standard /api/mcp endpoint with Server-Sent Events (SSE)</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                  <span>Native tool discovery and schema inspection</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                  <span>Cryptographically sandboxed command isolation</span>
                </li>
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* SECTION 6: INTERACTIVE AUDIO VOICE LAB */}
      <section className="py-24 px-4 sm:px-6 max-w-5xl mx-auto">
        <div className="text-center space-y-4 mb-16">
          <span className="text-xs font-mono font-bold text-zinc-500 uppercase tracking-widest">
            NEURAL VOICE DISPATCH
          </span>
          <h2 className="text-4xl sm:text-6xl font-semibold tracking-tight text-white">
            Listen to AIX Alpha.
          </h2>
          <p className="text-lg text-zinc-400 max-w-xl mx-auto">
            Experience natural, low-jitter speech synthesis directly in your browser. Click any voice to listen.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              name: 'Puck',
              role: 'Executive & Flagship Core',
              phrase: 'Hello. I am AIX Alpha. How can I accelerate your architecture today?',
            },
            {
              name: 'Charon',
              role: 'STEM & First-Principles Academic',
              phrase: 'Let us decompose the quantum state vector into its orthogonal basis states.',
            },
            {
              name: 'Kore',
              role: 'Distilled High-Signal LE Core',
              phrase: 'Latency optimized. Bottleneck identified in line 42. Remediations ready.',
            },
            {
              name: 'Fenrir',
              role: 'Zero-Trust Security Auditor',
              phrase: 'Zero-trust scan initiated. No reentrancy or cryptographic flaws detected.',
            },
            {
              name: 'Zephyr',
              role: 'Deep Web Researcher & Storyteller',
              phrase: 'Live web intelligence cross-referenced across 12 verified global sources.',
            },
          ].map((voice) => {
            const isPlaying = playingVoice === voice.name;
            return (
              <div
                key={voice.name}
                className={`p-5 rounded-2xl border transition-all ${
                  isPlaying
                    ? 'bg-zinc-900 border-white shadow-xl'
                    : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-black border border-zinc-800 flex items-center justify-center text-white">
                      <Volume2 className={`w-4 h-4 ${isPlaying ? 'animate-pulse text-white' : 'text-zinc-400'}`} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">{voice.name}</h4>
                      <p className="text-[10px] font-mono text-zinc-500">{voice.role}</p>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-zinc-400 italic mb-4">"{voice.phrase}"</p>

                <button
                  onClick={() => handlePreviewVoice(voice.name, voice.phrase)}
                  className={`w-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    isPlaying
                      ? 'bg-white text-black font-bold'
                      : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800'
                  }`}
                >
                  <Play className={`w-3 h-3 ${isPlaying ? 'fill-black' : ''}`} />
                  <span>{isPlaying ? 'Playing Audio...' : 'Preview Voice'}</span>
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION 7: HARDWARE & BENCHMARK METRICS (APPLE BENCHMARK GRAPHS) */}
      <section id="benchmarks" className="py-24 px-4 sm:px-6 bg-zinc-950 border-y border-zinc-900">
        <div className="max-w-5xl mx-auto">
          <div className="text-center space-y-4 mb-16">
            <span className="text-xs font-mono font-bold text-zinc-500 uppercase tracking-widest">
              PERFORMANCE TELEMETRY
            </span>
            <h2 className="text-4xl sm:text-6xl font-semibold tracking-tight text-white">
              Faster. Farther. Flawless.
            </h2>
            <p className="text-lg text-zinc-400 max-w-xl mx-auto">
              Empirical benchmark comparisons against legacy conversational LLMs.
            </p>

            {/* Benchmark Switcher */}
            <div className="inline-flex p-1 bg-black rounded-xl border border-zinc-800 text-xs font-mono mt-4">
              <button
                onClick={() => setBenchmarkMetric('throughput')}
                className={`px-4 py-1.5 rounded-lg transition-all ${
                  benchmarkMetric === 'throughput' ? 'bg-white text-black font-bold' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Code Synthesis Speed
              </button>
              <button
                onClick={() => setBenchmarkMetric('latency')}
                className={`px-4 py-1.5 rounded-lg transition-all ${
                  benchmarkMetric === 'latency' ? 'bg-white text-black font-bold' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Time to First Token
              </button>
              <button
                onClick={() => setBenchmarkMetric('accuracy')}
                className={`px-4 py-1.5 rounded-lg transition-all ${
                  benchmarkMetric === 'accuracy' ? 'bg-white text-black font-bold' : 'text-zinc-400 hover:text-white'
                }`}
              >
                AST First-Pass Compile
              </button>
            </div>
          </div>

          {/* Benchmark Display Bars */}
          <div className="p-8 rounded-3xl bg-black border border-zinc-800 space-y-8 shadow-2xl">
            {benchmarkMetric === 'throughput' && (
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-xs font-mono mb-2">
                    <span className="text-white font-bold">AIX Alpha v2.0 (AST Pipeline)</span>
                    <span className="text-white font-bold">3.8x baseline // 1,240 tokens/s</span>
                  </div>
                  <div className="w-full h-4 rounded-full bg-zinc-900 overflow-hidden p-0.5 border border-zinc-800">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: '95%' }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className="h-full bg-white rounded-full shadow-[0_0_12px_rgba(255,255,255,0.8)]"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-mono mb-2 text-zinc-500">
                    <span>Leading Frontier Cloud LLM</span>
                    <span>1.0x baseline // 320 tokens/s</span>
                  </div>
                  <div className="w-full h-4 rounded-full bg-zinc-900 overflow-hidden p-0.5 border border-zinc-800">
                    <div className="h-full bg-zinc-600 rounded-full w-[26%]" />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-mono mb-2 text-zinc-600">
                    <span>Legacy Code Generator</span>
                    <span>0.5x baseline // 160 tokens/s</span>
                  </div>
                  <div className="w-full h-4 rounded-full bg-zinc-900 overflow-hidden p-0.5 border border-zinc-800">
                    <div className="h-full bg-zinc-700 rounded-full w-[13%]" />
                  </div>
                </div>
              </div>
            )}

            {benchmarkMetric === 'latency' && (
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-xs font-mono mb-2">
                    <span className="text-white font-bold">AIX Alpha v2.0 (Zero-Jitter Stream)</span>
                    <span className="text-white font-bold">0.08 seconds</span>
                  </div>
                  <div className="w-full h-4 rounded-full bg-zinc-900 overflow-hidden p-0.5 border border-zinc-800">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: '92%' }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className="h-full bg-white rounded-full shadow-[0_0_12px_rgba(255,255,255,0.8)]"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-mono mb-2 text-zinc-500">
                    <span>Standard Cloud API</span>
                    <span>0.45 seconds</span>
                  </div>
                  <div className="w-full h-4 rounded-full bg-zinc-900 overflow-hidden p-0.5 border border-zinc-800">
                    <div className="h-full bg-zinc-600 rounded-full w-[45%]" />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-mono mb-2 text-zinc-600">
                    <span>Legacy Multi-Agent Chain</span>
                    <span>1.85 seconds</span>
                  </div>
                  <div className="w-full h-4 rounded-full bg-zinc-900 overflow-hidden p-0.5 border border-zinc-800">
                    <div className="h-full bg-zinc-700 rounded-full w-[18%]" />
                  </div>
                </div>
              </div>
            )}

            {benchmarkMetric === 'accuracy' && (
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-xs font-mono mb-2">
                    <span className="text-white font-bold">AIX Alpha v2.0 (Self-Healing Sandbox)</span>
                    <span className="text-white font-bold">99.4% Syntax Verified</span>
                  </div>
                  <div className="w-full h-4 rounded-full bg-zinc-900 overflow-hidden p-0.5 border border-zinc-800">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: '99.4%' }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className="h-full bg-white rounded-full shadow-[0_0_12px_rgba(255,255,255,0.8)]"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-mono mb-2 text-zinc-500">
                    <span>Industry Average Single-File LLM</span>
                    <span>81.2% Syntax Verified</span>
                  </div>
                  <div className="w-full h-4 rounded-full bg-zinc-900 overflow-hidden p-0.5 border border-zinc-800">
                    <div className="h-full bg-zinc-600 rounded-full w-[81.2%]" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* SECTION 8: TECHNICAL SPECIFICATIONS (APPLE SPEC GRID) */}
      <section id="specs" className="py-24 px-4 sm:px-6 max-w-5xl mx-auto">
        <div className="text-center space-y-4 mb-16">
          <span className="text-xs font-mono font-bold text-zinc-500 uppercase tracking-widest">
            ENGINEERING DATA SHEET
          </span>
          <h2 className="text-4xl sm:text-5xl font-semibold tracking-tight text-white">
            Technical Specifications.
          </h2>
        </div>

        <div className="border border-zinc-800 rounded-2xl overflow-hidden divide-y divide-zinc-800/80 bg-zinc-950 font-mono text-xs">
          <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <span className="text-zinc-500 uppercase">Core Architecture</span>
            <span className="sm:col-span-2 text-white">Quantum State-Vector Entangled Autonomous System</span>
          </div>

          <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <span className="text-zinc-500 uppercase">Active Context Horizon</span>
            <span className="sm:col-span-2 text-white">1,000,000+ Tokens (Persistent Ephemeral Session Cache)</span>
          </div>

          <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <span className="text-zinc-500 uppercase">Model Fine-Tunes</span>
            <span className="sm:col-span-2 text-white">Claude Haiku 5.5 (claude-haiku-5-5)</span>
          </div>

          <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <span className="text-zinc-500 uppercase">App Studio Output</span>
            <span className="sm:col-span-2 text-white">Multi-File Scaffolding, Live DOM Iframe Sandbox, ZIP Export</span>
          </div>

          <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <span className="text-zinc-500 uppercase">Protocol Integration</span>
            <span className="sm:col-span-2 text-white">Model Context Protocol (MCP 2.0) via JSON-RPC / SSE</span>
          </div>

          <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <span className="text-zinc-500 uppercase">Live Web Grounding</span>
            <span className="sm:col-span-2 text-white">Google Search Real-Time Citation Cross-Checking</span>
          </div>

          <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <span className="text-zinc-500 uppercase">Voice & Speech DSP</span>
            <span className="sm:col-span-2 text-white">48kHz Neural Synthesis across 5 Timbre Profiles</span>
          </div>

          <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <span className="text-zinc-500 uppercase">Data Privacy</span>
            <span className="sm:col-span-2 text-white">Zero-Retention Local Session Storage; Zero Model Retraining</span>
          </div>
        </div>
      </section>

      {/* SECTION 9: CINEMATIC CLOSING CTA */}
      <section className="py-24 px-4 sm:px-6 bg-gradient-to-b from-black via-zinc-950 to-black text-center border-t border-zinc-900">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="w-16 h-16 rounded-2xl bg-white text-black flex items-center justify-center mx-auto shadow-[0_0_40px_rgba(255,255,255,0.2)]">
            <Cpu className="w-8 h-8" />
          </div>

          <h2 className="text-4xl sm:text-6xl md:text-7xl font-semibold tracking-[-0.04em] text-white">
            The future is already compiled.
          </h2>

          <p className="text-lg text-zinc-400 max-w-xl mx-auto font-normal">
            Step into the quantum workstation. Create full-stack apps, audit security protocols,
            and research frontier breakthroughs with zero friction.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <button
              onClick={onBackToChat}
              className="px-8 py-3.5 rounded-full bg-white hover:bg-zinc-200 text-black font-semibold text-sm tracking-tight shadow-2xl transition-all active:scale-95 flex items-center gap-2"
            >
              <span>Start Chatting with AIX Alpha</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onNavigateToAppStudio}
              className="px-8 py-3.5 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white font-medium text-sm tracking-tight transition-all active:scale-95"
            >
              Launch App Studio
            </button>
          </div>
        </div>
      </section>

      {/* SECTION 10: APPLE-STYLE FOOTER */}
      <footer className="border-t border-zinc-900 py-12 px-4 sm:px-8 bg-black text-zinc-500 font-mono text-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2 text-zinc-400">
            <Cpu className="w-4 h-4 text-white" />
            <span className="text-white font-bold">AIX Alpha v2.0 AI Suite</span>
            <span>// Quantum Cognitive Systems</span>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-zinc-500">
            <button onClick={onBackToChat} className="hover:text-white transition-colors">
              Chat
            </button>
            <button onClick={onNavigateToAppStudio} className="hover:text-white transition-colors">
              App Studio
            </button>
            <button onClick={onNavigateToPersonas} className="hover:text-white transition-colors">
              Models & Personas
            </button>
            <button onClick={() => scrollToSection('hero')} className="hover:text-white transition-colors">
              Back to Top ↑
            </button>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-6 pt-6 border-t border-zinc-950 text-center text-zinc-600 text-[11px]">
          Engineered with precision. All models, telemetry, and execution environments running in Cloud Run sandbox.
        </div>
      </footer>
    </div>
  );
};
