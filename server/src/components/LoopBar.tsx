import React from 'react';
import { Gauge, Zap, ShieldCheck, RefreshCw } from 'lucide-react';
import { ChatMessage, LoopMode, LoopTelemetry, VerifyMode } from '../types';

const MODES: Array<{ id: LoopMode; label: string; hint: string }> = [
  { id: 'eco', label: 'ECO', hint: 'Cheapest: low effort, 1 repair pass, tight context' },
  { id: 'balanced', label: 'BALANCED', hint: 'Medium effort on hard prompts, 2 repair passes' },
  { id: 'thorough', label: 'THOROUGH', hint: 'Bigger windows and outputs, 3 repair passes' },
];

const fmtUsd = (n: number) => (n === 0 ? '$0' : n < 0.0001 ? '<$0.0001' : `$${n.toFixed(n < 0.01 ? 5 : 4)}`);
const k = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

interface LoopBarProps {
  mode: LoopMode;
  onMode: (m: LoopMode) => void;
  verify: VerifyMode;
  onVerify: (v: VerifyMode) => void;
  messages: ChatMessage[];
}

/** Controls above the prompt box + live session ledger (real numbers from the server). */
export const LoopBar: React.FC<LoopBarProps> = ({ mode, onMode, verify, onVerify, messages }) => {
  const withT = messages.filter((m) => m.telemetry);
  const last = withT[withT.length - 1]?.telemetry;
  const spent = last?.session.costUsd ?? 0;
  const cap = last?.session.capUsd ?? 0.25;
  const pct = Math.min(100, (spent / cap) * 100);
  const sumTokens = withT.reduce((s, m) => s + (m.telemetry!.inputTokens + m.telemetry!.outputTokens + m.telemetry!.cacheReadTokens), 0);
  const free = withT.filter((m) => m.telemetry!.calls === 0).length;

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-1 font-mono text-[10px] text-zinc-400">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 py-1.5">
        <span className="flex items-center gap-1 text-zinc-300 font-bold tracking-wider">
          <RefreshCw className="w-3 h-3 text-emerald-400" /> LOOP
        </span>

        <div className="flex items-center rounded-lg overflow-hidden border border-zinc-800">
          {MODES.map((m) => (
            <button
              key={m.id}
              title={m.hint}
              onClick={() => onMode(m.id)}
              className={`px-2 py-0.5 tracking-wider transition-colors ${mode === m.id ? 'bg-white text-black font-bold' : 'bg-zinc-900 text-zinc-400 hover:text-white'}`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <button
          title="Add one tiny evaluator call on DEEP answers (about +$0.0001). Local checks always run for free."
          onClick={() => onVerify(verify === 'llm' ? 'local' : 'llm')}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border transition-colors ${verify === 'llm' ? 'border-emerald-500/60 text-emerald-300 bg-emerald-500/10' : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'}`}
        >
          <ShieldCheck className="w-3 h-3" /> EVAL {verify === 'llm' ? 'ON' : 'OFF'}
        </button>

        <div className="flex items-center gap-2 ml-auto min-w-[180px]">
          <Gauge className="w-3 h-3 text-zinc-500" />
          <div className="flex-1 h-1.5 rounded-full bg-zinc-900 overflow-hidden border border-zinc-800">
            <div className={`h-full ${pct > 80 ? 'bg-red-400' : pct > 50 ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${Math.max(pct, spent > 0 ? 2 : 0)}%` }} />
          </div>
          <span className="text-zinc-300 whitespace-nowrap">
            {fmtUsd(spent)} / ${cap.toFixed(2)}
          </span>
        </div>
      </div>
      {withT.length > 0 && (
        <div className="px-1 pt-1 text-zinc-600 flex flex-wrap gap-x-3">
          <span>{k(sumTokens)} tokens this chat</span>
          <span>{free} {free === 1 ? 'reply' : 'replies'} at $0</span>
          <span>claude-haiku-5-5</span>
        </div>
      )}
    </div>
  );
};

/** Per-reply accounting chips. */
export const TelemetryStrip: React.FC<{ t: LoopTelemetry }> = ({ t }) => {
  const chip = 'px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300';
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono text-zinc-500">
      <span className={chip}>
        <Zap className="inline w-3 h-3 mr-1 text-amber-300" />
        {t.tier}
      </span>
      {t.responseCacheHit && <span className={`${chip} text-emerald-300`}>CACHE HIT</span>}
      {t.calls === 0 && !t.responseCacheHit && !t.blocked && <span className={`${chip} text-emerald-300`}>LOCAL</span>}
      {t.blocked && <span className={`${chip} text-red-300`}>BLOCKED · {t.blocked.toUpperCase()}</span>}
      <span className={chip}>
        {t.calls} call{t.calls === 1 ? '' : 's'}
        {t.loops > 0 ? ` · ${t.loops} repair` : ''}
      </span>
      {t.calls > 0 && (
        <span className={chip} title="uncached in · cache read · cache write · out">
          {t.inputTokens} in · {t.cacheReadTokens} cached · {t.outputTokens} out
        </span>
      )}
      <span className={chip}>{fmtUsd(t.costUsd)}</span>
      <span className={chip} title="Estimated saving vs an unoptimised single call (full raw prompt + whole history, no caching)">
        −{t.savedPct}% vs naive
      </span>
      {!t.verified && t.calls > 0 && <span className={`${chip} text-amber-300`}>UNVERIFIED</span>}
    </div>
  );
};
