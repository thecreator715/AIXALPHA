import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Mic,
  MicOff,
  Globe,
  Paperclip,
  X,
  Code2,
  Image as ImageIcon,
  Box,
  Video,
  Sliders,
  Terminal,
  Layers,
  Camera,
  Zap,
  FileText,
  FileArchive,
  Music,
} from 'lucide-react';
import { Attachment, Persona } from '../types';
import { createSpeechRecognizer, isSpeechRecognitionSupported } from '../utils/audio';

interface PromptBarProps {
  onSendMessage: (text: string, attachments: Attachment[]) => void;
  isLoading: boolean;
  searchGroundingEnabled: boolean;
  onToggleSearchGrounding: () => void;
  activePersona: Persona;
  onOpenPersonaModal: () => void;
  onOpenCamera?: () => void;
  onOpenCreditStore?: () => void;
  currentCredits?: number;
  isFreeTierTestMode?: boolean;
}

const PROMPT_SUGGESTIONS = [
  {
    icon: Box,
    tag: '3D MESH',
    title: '3D Textured Model',
    prompt: 'Render a 3D metallic knot mesh model with glowing cyberpunk neon texture',
  },
  {
    icon: ImageIcon,
    tag: 'DIFFUSION',
    title: 'AI Image Engine',
    prompt: 'Create image of a futuristic floating island in glowing gold sunset, photorealistic 8k',
  },
  {
    icon: Globe,
    tag: 'FACTS',
    title: 'Live Web Grounding',
    prompt: 'What are the top breaking AI model announcements and tech news today?',
  },
  {
    icon: Terminal,
    tag: 'STUDIO',
    title: 'Multi-File Web App',
    prompt: 'Create a full interactive HTML/JS dashboard with real-time charts and dark mode',
  },
];

export const PromptBar: React.FC<PromptBarProps> = ({
  onSendMessage,
  isLoading,
  searchGroundingEnabled,
  onToggleSearchGrounding,
  activePersona,
  onOpenPersonaModal,
  onOpenCamera,
  onOpenCreditStore,
  currentCredits = 999,
  isFreeTierTestMode = true,
}) => {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingText, setRecordingText] = useState('');
  const [speechRecognizer, setSpeechRecognizer] = useState<any>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [input]);

  // Handle Speech Recognition toggle
  const toggleRecording = () => {
    if (isRecording) {
      speechRecognizer?.stop();
      setIsRecording(false);
      return;
    }

    if (!isSpeechRecognitionSupported()) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    const recognizer = createSpeechRecognizer(
      (text, isFinal) => {
        if (isFinal) {
          setInput((prev) => (prev ? `${prev} ${text}` : text));
          setRecordingText('');
        } else {
          setRecordingText(text);
        }
      },
      (err) => {
        console.error('Speech recognition error:', err);
        setIsRecording(false);
      },
      () => {
        setIsRecording(false);
      }
    );

    if (recognizer) {
      setSpeechRecognizer(recognizer);
      recognizer.start();
      setIsRecording(true);
    }
  };

  const processFiles = (fileList: FileList | File[]) => {
    Array.from(fileList).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        const newAtt: Attachment = {
          id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          data: base64,
          size: file.size,
        };
        setAttachments((prev) => [...prev, newAtt]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    processFiles(files);
    e.target.value = '';
  };

  // Drag and drop handlers for PDF, Word, ZIP, Audio, Images
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
      if (!input) {
        setInput('Analyze the attached file(s) in depth and summarize key insights, data, or structure.');
      }
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() && attachments.length === 0) return;

    if (isRecording) {
      speechRecognizer?.stop();
      setIsRecording(false);
    }

    onSendMessage(input.trim(), attachments);
    setInput('');
    setAttachments([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const getFileIcon = (mimeType: string, name: string) => {
    if (mimeType.startsWith('image/')) return <ImageIcon className="w-3.5 h-3.5 text-blue-400" />;
    if (mimeType.startsWith('audio/')) return <Music className="w-3.5 h-3.5 text-purple-400" />;
    if (name.endsWith('.zip') || name.endsWith('.tar') || name.endsWith('.gz'))
      return <FileArchive className="w-3.5 h-3.5 text-amber-400" />;
    return <FileText className="w-3.5 h-3.5 text-emerald-400" />;
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`border-t border-zinc-800/80 bg-black/95 backdrop-blur-2xl p-3 sm:p-5 sticky bottom-0 z-20 transition-all ${
        isDraggingOver ? 'bg-zinc-900/90 ring-2 ring-white/50 border-white' : ''
      }`}
    >
      <div className="max-w-3xl lg:max-w-4xl mx-auto w-full space-y-2.5">
        {/* Drag & Drop Overlay Indicator */}
        {isDraggingOver && (
          <div className="p-3 rounded-xl bg-zinc-900 border border-white text-center text-xs font-mono text-white animate-pulse">
            DROP FILES HERE (IMAGES, AUDIO, PDFS, WORD DOCS, ZIPS) FOR ADVANCED DATA ANALYTICS
          </div>
        )}

        {/* Attachments Preview */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 pb-1">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-200"
              >
                {getFileIcon(att.mimeType, att.name)}
                <span className="truncate max-w-[160px] font-mono text-[11px]">{att.name}</span>
                <span className="text-[9px] text-zinc-500 font-mono">
                  ({Math.round((att.size || 0) / 1024)}KB)
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveAttachment(att.id)}
                  className="p-0.5 text-zinc-500 hover:text-white rounded transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Live Voice Recording Status */}
        {isRecording && (
          <div className="flex items-center gap-3 p-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-zinc-200 animate-pulse font-mono">
            <div className="w-2 h-2 rounded-full bg-white animate-ping" />
            <span className="font-semibold text-white tracking-wider">VOICE MATRIX RECORDING //</span>
            <span className="text-zinc-400 italic truncate">{recordingText || 'Listening for speech input...'}</span>
          </div>
        )}

        {/* Main Prompt Bar Form Container */}
        <form
          onSubmit={handleSubmit}
          className="relative bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl focus-within:border-zinc-500 focus-within:ring-1 focus-within:ring-zinc-600/40 transition-all overflow-hidden"
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${activePersona.name}... (Press Enter to execute)`}
            className="w-full bg-transparent px-3.5 sm:px-4 pt-3.5 pb-12 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none resize-none min-h-[52px]"
          />

          {/* Bottom Bar Controls inside input */}
          <div className="absolute left-2.5 sm:left-3 bottom-2.5 sm:bottom-3 right-2.5 sm:right-3 flex items-center justify-between pointer-events-none">
            {/* Left Tools */}
            <div className="flex items-center gap-1 sm:gap-1.5 pointer-events-auto">
              {/* Attachment Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors border border-transparent hover:border-zinc-700"
                title="Attach Document, PDF, Word, ZIP, or Audio file"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />

              {/* Camera Capture Button */}
              {onOpenCamera && (
                <button
                  type="button"
                  onClick={onOpenCamera}
                  className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors border border-transparent hover:border-zinc-700"
                  title="Open Device Camera to Take Picture & Prompt"
                >
                  <Camera className="w-4 h-4 text-zinc-300" />
                </button>
              )}

              {/* Web Search Toggle in Monochrome */}
              <button
                type="button"
                onClick={onToggleSearchGrounding}
                className={`px-2 py-1 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors border ${
                  searchGroundingEnabled
                    ? 'text-white bg-zinc-900 border-zinc-600'
                    : 'text-zinc-500 hover:text-zinc-300 bg-transparent border-transparent hover:border-zinc-800'
                }`}
                title="Toggle Real-Time Google Web Search Grounding"
              >
                <Globe className={`w-3.5 h-3.5 ${searchGroundingEnabled ? 'text-white' : 'text-zinc-600'}`} />
                <span className="text-[11px] hidden md:inline">Web Search</span>
                <span className={`w-1 h-1 rounded-full ${searchGroundingEnabled ? 'bg-white' : 'bg-zinc-700'}`} />
              </button>

              {/* Voice Recording Mic */}
              <button
                type="button"
                onClick={toggleRecording}
                className={`p-1.5 rounded-lg transition-colors border border-transparent ${
                  isRecording
                    ? 'bg-white text-black animate-pulse'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800 hover:border-zinc-700'
                }`}
                title={isRecording ? 'Stop Voice Recording' : 'Start Voice Input'}
              >
                {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              {/* Persona Quick Indicator - FULL MODEL NAME WITHOUT TRUNCATION */}
              <button
                type="button"
                onClick={onOpenPersonaModal}
                className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors flex items-center gap-1.5 text-[11px] font-mono border border-transparent hover:border-zinc-700"
                title="Switch Persona & Full Model Settings"
              >
                <Sliders className="w-3.5 h-3.5 text-zinc-400" />
                <span className="hidden lg:inline text-zinc-300 font-semibold">{activePersona.name}</span>
              </button>
            </div>

            {/* Right: Credit Badge + Submit Button */}
            <div className="pointer-events-auto flex items-center gap-2">
              {onOpenCreditStore && (
                <button
                  type="button"
                  onClick={onOpenCreditStore}
                  className={`px-2 py-1 rounded-lg border text-xs font-mono flex items-center gap-1 transition-all active:scale-95 ${
                    isFreeTierTestMode
                      ? 'bg-emerald-950/60 border-emerald-700/80 text-emerald-300 hover:bg-emerald-900/60'
                      : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700 text-zinc-200'
                  }`}
                  title={isFreeTierTestMode ? "Free Tier Testing Mode: Unlimited Prompts" : "Prompt Credits & Refill Store"}
                >
                  <Zap className={`w-3 h-3 ${isFreeTierTestMode ? 'text-emerald-400 fill-emerald-400' : 'text-white fill-white'}`} />
                  <span className={`font-bold ${isFreeTierTestMode ? 'text-emerald-300' : 'text-white'}`}>
                    {isFreeTierTestMode ? 'FREE TIER' : currentCredits}
                  </span>
                  <span className="text-[10px] text-zinc-400 hidden sm:inline">
                    {isFreeTierTestMode ? 'TEST' : 'CREDITS'}
                  </span>
                </button>
              )}

              <button
                type="submit"
                disabled={!input.trim() && attachments.length === 0}
                className="p-2 bg-white hover:bg-zinc-200 disabled:opacity-20 disabled:hover:bg-white text-black rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
                title="Send Command"
              >
                <Send className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          </div>
        </form>

        {/* Dynamic Prompt Suggestions (Monochrome High-Tech Chips) */}
        {!input && (
          <div className="hidden sm:grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {PROMPT_SUGGESTIONS.map((sug, i) => {
              const IconComp = sug.icon;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setInput(sug.prompt)}
                  className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800/80 hover:border-zinc-600 hover:bg-zinc-900 text-left transition-all group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <IconComp className="w-3.5 h-3.5 text-zinc-400 group-hover:text-white transition-colors" />
                      <span className="text-[11px] font-semibold text-zinc-200 truncate">{sug.title}</span>
                    </div>
                    <span className="text-[9px] font-mono uppercase px-1 py-0.2 rounded bg-zinc-900 text-zinc-500 border border-zinc-800">
                      {sug.tag}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-500 group-hover:text-zinc-400 line-clamp-1 font-mono">
                    {sug.prompt}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};


