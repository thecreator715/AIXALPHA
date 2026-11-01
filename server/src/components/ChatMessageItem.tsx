import React, { useState } from 'react';
import {
  User,
  Volume2,
  VolumeX,
  Copy,
  Check,
  Globe,
  ExternalLink,
  Code,
  Play,
  ChevronDown,
  ChevronUp,
  Paperclip,
  CheckCircle2,
  Cpu,
  Terminal,
  Layers,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatMessage, Persona } from '../types';
import { speakTextNative, stopSpeech } from '../utils/audio';
import { Model3DViewer } from './Model3DViewer';
import { ImageViewer } from './ImageViewer';
import { VideoViewer } from './VideoViewer';
import { TelemetryStrip } from './LoopBar';

interface ChatMessageItemProps {
  message: ChatMessage;
  persona: Persona;
  onOpenCodePreview: (code: string, language: string) => void;
  onOpenAppStudio?: (code?: string, language?: string) => void;
  voiceRate?: number;
  voicePitch?: number;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
  message,
  persona,
  onOpenCodePreview,
  onOpenAppStudio,
  voiceRate = 1.0,
  voicePitch = 1.0,
}) => {
  const [copied, setCopied] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);

  const isUser = message.role === 'user';

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleSpeak = async () => {
    if (isPlayingAudio) {
      stopSpeech();
      setIsPlayingAudio(false);
      return;
    }

    setIsPlayingAudio(true);
    await speakTextNative(
      message.content,
      () => setIsPlayingAudio(true),
      () => setIsPlayingAudio(false),
      voiceRate,
      voicePitch
    );
  };

  // Minimalist monochrome confidence badges [C], [~], [?]
  const renderConfidenceBadge = (confidenceStr?: string) => {
    if (!confidenceStr) return null;
    let label = '[C] VERIFIED';
    if (confidenceStr.includes('[~]')) label = '[~] PROBABLE';
    if (confidenceStr.includes('[?]')) label = '[?] HYPOTHESIS';

    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-zinc-900 text-zinc-300 border border-zinc-700">
        {label}
      </span>
    );
  };

  return (
    <div className={`py-6 px-4 sm:px-6 transition-colors ${isUser ? 'bg-transparent' : 'bg-zinc-950/60 border-y border-zinc-900 animate-in fade-in-0 slide-in-from-top-4 duration-500 fill-mode-both'}`}>
      <div className="max-w-3xl lg:max-w-4xl mx-auto space-y-3.5">
        {/* Header: Role Avatar & Telemetry Tag */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {isUser ? (
              <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center text-zinc-300">
                <User className="w-4 h-4" />
              </div>
            ) : (
              <div className="w-7 h-7 rounded-lg bg-white text-black flex items-center justify-center font-mono font-bold shadow-sm">
                <Cpu className="w-4 h-4" />
              </div>
            )}

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold tracking-wider text-zinc-200 uppercase">
                {isUser ? 'OPERATOR' : persona.name}
              </span>

              {!isUser && (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-zinc-900 text-zinc-200 border border-zinc-700 flex items-center gap-1">
                  <Cpu className="w-3 h-3 text-emerald-400" />
                  <span>
                    {message.modelUsed
                      ? message.modelUsed === 'local'
                        ? 'LOCAL · 0 TOKENS'
                        : message.modelUsed.toUpperCase()
                      : persona.modelAlias
                      ? persona.modelAlias.toUpperCase()
                      : 'AIX ALPHA v3.0'}
                  </span>
                </span>
              )}

              {/* Confidence Badge */}
              {!isUser && message.reasoningMeta?.confidence && (
                renderConfidenceBadge(message.reasoningMeta.confidence)
              )}

              {/* Reasoning Tier */}
              {!isUser && message.reasoningMeta?.tier && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-900 text-zinc-500 border border-zinc-800">
                  {message.reasoningMeta.tier}
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            {!isUser && (
              <button
                onClick={handleToggleSpeak}
                className={`p-1.5 rounded-lg text-xs transition-colors border ${
                  isPlayingAudio
                    ? 'bg-white text-black border-white animate-pulse'
                    : 'text-zinc-500 hover:text-zinc-200 border-transparent hover:border-zinc-800'
                }`}
                title={isPlayingAudio ? 'Stop Speech' : 'Listen with Synthesizer'}
              >
                {isPlayingAudio ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>
            )}

            <button
              onClick={handleCopyMessage}
              className="p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 rounded-lg transition-colors border border-transparent hover:border-zinc-800"
              title="Copy Message"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* User Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {message.attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 max-w-xs"
              >
                {att.mimeType.startsWith('image/') ? (
                  <img src={att.data} alt={att.name} className="w-12 h-12 object-cover rounded border border-zinc-700" />
                ) : (
                  <Paperclip className="w-4 h-4 text-zinc-400" />
                )}
                <div className="truncate">
                  <p className="font-mono text-[11px] truncate text-zinc-200">{att.name}</p>
                  <p className="text-[10px] text-zinc-500 font-mono">{(att.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Real-time Web Search Grounding Banner in High-Contrast Monochrome */}
        {!isUser && message.grounding?.used && (
          <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2 font-mono text-xs">
            <div className="flex items-center gap-2 text-zinc-300 font-semibold">
              <Globe className="w-3.5 h-3.5 text-white animate-pulse" />
              <span>LIVE WEB INTELLIGENCE GROUNDING</span>
            </div>

            {message.grounding.webSearchQueries && message.grounding.webSearchQueries.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-zinc-500">QUERIES:</span>
                {message.grounding.webSearchQueries.map((q, idx) => (
                  <span key={idx} className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
                    "{q}"
                  </span>
                ))}
              </div>
            )}

            {/* Citations Grid */}
            {message.grounding.sources && message.grounding.sources.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {message.grounding.sources.map((src, i) => (
                  <a
                    key={i}
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-zinc-900/90 border border-zinc-800 hover:border-zinc-500 flex items-start gap-2 group transition-all"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-white shrink-0 mt-0.5" />
                    <div className="truncate">
                      <p className="text-xs font-medium text-zinc-200 group-hover:text-white truncate">
                        {src.title}
                      </p>
                      <p className="text-[10px] text-zinc-500 truncate">{src.url}</p>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Quantum Reasoning Trace Accordion */}
        {!isUser && message.reasoningMeta?.superpositionState && (
          <div>
            <button
              onClick={() => setShowReasoning(!showReasoning)}
              className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400 hover:text-white transition-colors"
            >
              <Cpu className="w-3 h-3 text-zinc-500" />
              <span>NEURAL REASONING MATRIX</span>
              {showReasoning ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {showReasoning && (
              <div className="mt-2 p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-400 space-y-1">
                <p>{message.reasoningMeta.superpositionState}</p>
              </div>
            )}
          </div>
        )}

        {/* Step Execution Trace */}
        {!isUser && message.executionSteps && message.executionSteps.length > 0 && (
          <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1 text-xs font-mono text-zinc-400">
            <div className="flex items-center justify-between text-[11px] text-zinc-300 font-semibold mb-1">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-white" /> PIPELINE EXECUTION
              </span>
              <span className="text-zinc-500">100% OK</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
              {message.executionSteps.map((step) => (
                <div
                  key={step.id}
                  className="flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-[10px]"
                >
                  <CheckCircle2 className="w-3 h-3 text-white shrink-0" />
                  <span className="truncate text-zinc-300">{step.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* v3 loop accounting */}
        {!isUser && message.telemetry && <TelemetryStrip t={message.telemetry} />}

        {/* Multi-modal Renderers: 3D Model Viewer */}
        {!isUser && message.model3D && (
          <div className="border border-zinc-800 rounded-xl overflow-hidden bg-black">
            <Model3DViewer data={message.model3D} />
          </div>
        )}

        {/* Multi-modal Renderers: Generated Images */}
        {!isUser && message.generatedImages && message.generatedImages.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {message.generatedImages.map((img) => (
              <div key={img.id} className="border border-zinc-800 rounded-xl overflow-hidden bg-black">
                <ImageViewer image={img} />
              </div>
            ))}
          </div>
        )}

        {/* Multi-modal Renderers: Generated Video */}
        {!isUser && message.generatedVideo && (
          <div className="border border-zinc-800 rounded-xl overflow-hidden bg-black">
            <VideoViewer video={message.generatedVideo} />
          </div>
        )}

        {/* Markdown Content with Smooth Reveal-Down Animation */}
        <div className={`text-sm text-zinc-200 leading-relaxed space-y-3 break-words prose prose-invert max-w-none ${!isUser ? 'animate-in fade-in-50 slide-in-from-top-4 duration-700 ease-out fill-mode-both' : ''}`}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1({ children }: any) {
                return (
                  <h1 className="text-xl font-bold tracking-tight text-white pb-2 mb-3 border-b border-zinc-800">
                    {children}
                  </h1>
                );
              },
              h2({ children }: any) {
                return (
                  <h2 className="text-lg font-semibold tracking-tight text-zinc-100 pb-1.5 mb-2.5 border-b border-zinc-800/80">
                    {children}
                  </h2>
                );
              },
              h3({ children }: any) {
                return (
                  <h3 className="text-base font-medium tracking-tight text-zinc-200 mb-2">
                    {children}
                  </h3>
                );
              },
              blockquote({ children }: any) {
                return (
                  <blockquote className="border-l-2 border-zinc-500 pl-4 py-1 italic text-zinc-400 bg-zinc-950/40 rounded-r-lg my-3">
                    {children}
                  </blockquote>
                );
              },
              table({ children }: any) {
                return (
                  <div className="overflow-x-auto my-4 rounded-xl border border-zinc-800 shadow-inner">
                    <table className="min-w-full divide-y divide-zinc-800 text-xs text-left font-mono">
                      {children}
                    </table>
                  </div>
                );
              },
              th({ children }: any) {
                return (
                  <th className="px-4 py-2.5 bg-zinc-900 font-semibold text-zinc-200 uppercase tracking-wider">
                    {children}
                  </th>
                );
              },
              td({ children }: any) {
                return (
                  <td className="px-4 py-2 border-t border-zinc-800/70 text-zinc-300">
                    {children}
                  </td>
                );
              },
              code({ node, inline, className, children, ...props }: any) {
                const match = /language-(\w+)/.exec(className || '');
                const lang = match ? match[1] : '';
                const codeString = String(children).replace(/\n$/, '');

                if (!inline && (lang || codeString.includes('<html') || codeString.includes('function') || codeString.includes('class'))) {
                  const isPlayable = ['html', 'javascript', 'js', 'jsx', 'tsx', 'svg'].includes(lang.toLowerCase());

                  return (
                    <div className="my-4 rounded-xl border border-zinc-800 hover:border-zinc-700 bg-black overflow-hidden shadow-2xl transition-all glow-subtle">
                      <div className="flex items-center justify-between px-4 py-2 bg-zinc-950 border-b border-zinc-800">
                        <span className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider">
                          {lang || 'code'}
                        </span>

                        <div className="flex items-center gap-2">
                          {isPlayable && (
                            <>
                              {onOpenAppStudio && (
                                <button
                                  onClick={() => onOpenAppStudio(codeString, lang || 'html')}
                                  className="flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-zinc-200 text-black rounded-md text-xs font-bold font-mono transition-colors shadow-sm active:scale-95 glow-subtle"
                                >
                                  <Terminal className="w-3 h-3 stroke-[2.5]" /> Open in App Studio GUI
                                </button>
                              )}

                              <button
                                onClick={() => onOpenCodePreview(codeString, lang || 'html')}
                                className="flex items-center gap-1 px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 rounded-md text-xs font-medium font-mono transition-colors border border-zinc-700 glow-subtle"
                              >
                                <Play className="w-3 h-3 text-zinc-400" /> Preview
                              </button>
                            </>
                          )}

                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(codeString);
                            }}
                            className="p-1 text-zinc-400 hover:text-white rounded transition-colors glow-subtle"
                            title="Copy code"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="p-4 overflow-x-auto font-mono text-xs text-zinc-200 bg-black">
                        <pre>{codeString}</pre>
                      </div>
                    </div>
                  );
                }

                return (
                  <code className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-200 font-mono text-xs" {...props}>
                    {children}
                  </code>
                );
              },
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
};

