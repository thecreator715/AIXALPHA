import React, { useState, useEffect } from 'react';
import { Cpu, Globe, Terminal, Sparkles, Zap, Shield, CheckCircle2, Orbit } from 'lucide-react';
import { Persona } from '../types';

interface LiveExecutionTrackerProps {
  isLoading: boolean;
  prompt?: string;
  persona: Persona;
  searchGroundingEnabled: boolean;
}

interface CognitiveMove {
  id: string;
  code: string;
  label: string;
  subtext: string;
  category: 'superposition' | 'entanglement' | 'grounding' | 'tunneling' | 'verification' | 'collapse';
}

export const LiveExecutionTracker: React.FC<LiveExecutionTrackerProps> = ({
  isLoading,
  prompt = '',
  persona,
  searchGroundingEnabled,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);

  // Generate contextual sequence of moves based on prompt and persona
  const moves: CognitiveMove[] = React.useMemo(() => {
    const isCode = prompt.toLowerCase().includes('code') || prompt.toLowerCase().includes('function') || prompt.toLowerCase().includes('html') || prompt.toLowerCase().includes('build');
    const is3D = prompt.toLowerCase().includes('3d') || prompt.toLowerCase().includes('mesh') || prompt.toLowerCase().includes('render');

    const sequence: CognitiveMove[] = [
      {
        id: '1',
        code: 'Q-INIT // 01',
        label: 'HILBERT SPACE INITIALIZATION',
        subtext: 'Projecting semantic query vector across N-dimensional knowledge basis',
        category: 'superposition',
      },
      {
        id: '2',
        code: 'Ψ-SUPERPOSE // 02',
        label: 'PARALLEL HYPOTHESIS EVALUATION',
        subtext: 'Holding competing solution trajectories simultaneously in probability cloud',
        category: 'superposition',
      },
      {
        id: '3',
        code: 'Ω-ENTANGLE // 03',
        label: 'CROSS-DOMAIN TENSOR CORRELATION',
        subtext: 'Coupling domain heuristics (logic, mathematics, computation, language)',
        category: 'entanglement',
      },
    ];

    if (searchGroundingEnabled) {
      sequence.push({
        id: '4-search',
        code: 'LIVE-GROUND // 04',
        label: 'REAL-TIME WEB INTELLIGENCE SEARCH',
        subtext: 'Scanning live internet indexes, retrieving verified sources and cross-referencing citations',
        category: 'grounding',
      });
    }

    if (isCode) {
      sequence.push({
        id: '4-code',
        code: 'SYNTAX-ARCH // 05',
        label: 'AUTONOMOUS CODE PIPELINE & TYPE AUDIT',
        subtext: 'Validating TypeScript interfaces, sandbox execution safety, and rendering boundaries',
        category: 'verification',
      });
    } else if (is3D) {
      sequence.push({
        id: '4-3d',
        code: 'MESH-PARAM // 05',
        label: 'PARAMETRIC 3D GEOMETRY SYNTHESIS',
        subtext: 'Generating vertex attributes, normal maps, and procedural shader textures',
        category: 'tunneling',
      });
    } else {
      sequence.push({
        id: '4-tunnel',
        code: 'Θ-TUNNEL // 05',
        label: 'NON-CLASSICAL CONSTRAINT TUNNELING',
        subtext: 'Traversing lateral domain leaps and bypass operators for non-obvious synthesis',
        category: 'tunneling',
      });
    }

    sequence.push(
      {
        id: '6',
        code: 'Φ-INTERFERE // 06',
        label: 'WAVE INTERFERENCE & AMPLITUDE HARVEST',
        subtext: 'Amplifying coherent truth vectors while destructively canceling noise and hallucinations',
        category: 'verification',
      },
      {
        id: '7',
        code: 'Λ-VERIFY // 07',
        label: '8-DIMENSION VERIFICATION TENSOR',
        subtext: 'Executing rigorous checks across ethics, factual integrity, structural logic, and clarity',
        category: 'verification',
      },
      {
        id: '8',
        code: 'COLLAPSE // 08',
        label: 'COLLAPSING SUPERPOSITION TO STREAM',
        subtext: 'Collapsing high-fidelity eigenstates into natural language output payload',
        category: 'collapse',
      }
    );

    return sequence;
  }, [prompt, searchGroundingEnabled]);

  // Advance step index automatically with progressive duration
  useEffect(() => {
    if (!isLoading) {
      setCurrentStepIndex(0);
      setElapsedMs(0);
      return;
    }

    const timer = setInterval(() => {
      setElapsedMs((prev) => prev + 100);
    }, 100);

    const stepInterval = setInterval(() => {
      setCurrentStepIndex((prev) => {
        if (prev < moves.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 750);

    return () => {
      clearInterval(timer);
      clearInterval(stepInterval);
    };
  }, [isLoading, moves.length]);

  if (!isLoading) return null;

  const currentMove = moves[currentStepIndex] || moves[0];
  const progressPercent = Math.round(((currentStepIndex + 1) / moves.length) * 100);

  return (
    <div className="py-5 px-4 sm:px-6 bg-zinc-950 border-y border-zinc-800 animate-in fade-in duration-300">
      <div className="max-w-3xl lg:max-w-4xl mx-auto space-y-3 font-mono">
        {/* Top Status Header */}
        <div className="flex items-center justify-between border-b border-zinc-900 pb-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-white text-black flex items-center justify-center font-bold text-xs animate-pulse shadow-sm">
              <Cpu className="w-3.5 h-3.5" />
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-white tracking-wider">
                {persona.name.toUpperCase()} // COGNITIVE ENGINE
              </span>
              <span className="text-zinc-600">|</span>
              <span className="text-zinc-400 text-[11px]">
                STEP {currentStepIndex + 1} OF {moves.length}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-zinc-400">
            <span className="animate-pulse w-2 h-2 rounded-full bg-white inline-block" />
            <span>{(elapsedMs / 1000).toFixed(1)}s ELAPSED</span>
            <span className="text-zinc-700">/</span>
            <span className="text-zinc-300 font-semibold">{progressPercent}%</span>
          </div>
        </div>

        {/* Live Active Flashing Move Banner */}
        <div className="p-3.5 rounded-xl bg-black border border-zinc-700/80 shadow-inner space-y-1.5 relative overflow-hidden group">
          {/* Subtle animated light sweep */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />

          <div className="flex items-center justify-between text-[11px]">
            <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-white font-bold tracking-wider animate-pulse">
              ACTIVE MOVE // {currentMove.code}
            </span>
            <span className="text-zinc-500 text-[10px]">REASONING IN SUPERPOSITION</span>
          </div>

          <div className="flex items-start gap-2.5 pt-1">
            <Orbit className="w-4 h-4 text-white animate-spin shrink-0 mt-0.5" />
            <div className="space-y-0.5 flex-1">
              <h4 className="text-xs sm:text-sm font-bold text-white tracking-wide animate-pulse">
                {currentMove.label}
              </h4>
              <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                {currentMove.subtext}
              </p>
            </div>
          </div>
        </div>

        {/* Cognitive Pipeline Steps Rail */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
          {moves.slice(0, 8).map((move, idx) => {
            const isCompleted = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;

            return (
              <div
                key={move.id}
                className={`p-2 rounded-lg border text-[10px] transition-all flex items-center gap-1.5 truncate ${
                  isCurrent
                    ? 'bg-zinc-900 border-white text-white font-bold animate-pulse shadow-sm'
                    : isCompleted
                    ? 'bg-zinc-950/80 border-zinc-800 text-zinc-400'
                    : 'bg-black border-zinc-900 text-zinc-600'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-3 h-3 text-white shrink-0" />
                ) : isCurrent ? (
                  <span className="w-2 h-2 rounded-full bg-white animate-ping shrink-0" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-zinc-800 shrink-0" />
                )}
                <span className="truncate">{move.code.split('//')[0].trim()}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
