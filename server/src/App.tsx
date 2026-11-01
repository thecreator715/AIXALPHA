/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { ChatMessageItem } from './components/ChatMessageItem';
import { PromptBar } from './components/PromptBar';
import { PersonaModal } from './components/PersonaModal';
import { VoiceSettingsModal } from './components/VoiceSettingsModal';
import { CodePreviewModal } from './components/CodePreviewModal';
import { AppStudioPage } from './components/AppStudioPage';
import { PersonaHubPage } from './components/PersonaHubPage';
import { McpSystemPage } from './components/McpSystemPage';
import { AboutMePage } from './components/AboutMePage';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { EasyConnectionsHub } from './components/EasyConnectionsHub';
import { LiveExecutionTracker } from './components/LiveExecutionTracker';
import { CameraModal } from './components/CameraModal';
import { CreditStoreModal } from './components/CreditStoreModal';
import { HostedPortalModal } from './components/HostedPortalModal';
import { HostedSitesPage } from './components/HostedSitesPage';
import { BillingHistoryPage } from './components/BillingHistoryPage';
import { LoopBar } from './components/LoopBar';

import { PRESET_PERSONAS } from './data/personas';
import {
  ChatSession,
  ChatMessage,
  Persona,
  VoiceSettings,
  Attachment,
  AppViewMode,
  LoopMode,
  VerifyMode,
} from './types';
import {
  getStoredSessions,
  saveStoredSessions,
  getStoredPersonas,
  saveCustomPersona,
  deleteCustomPersona,
  getStoredVoiceSettings,
  saveStoredVoiceSettings,
  getStoredTheme,
  saveStoredTheme,
  exportSessionAsJSON,
  exportSessionAsMarkdown,
  exportAllSessionsAsJSON,
} from './utils/storage';
import { speakTextNative } from './utils/audio';
import {
  Cpu,
  Terminal,
  Globe,
  Box,
  Code2,
  Sliders,
  Layers,
  Sparkles,
  ChevronRight,
  FileText,
  FileSpreadsheet,
  Download,
  X,
  Eye,
  EyeOff,
  Copy,
  Check,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RefreshCw,
  Play,
} from 'lucide-react';


export default function App() {
  // Persistence state
  const [sessions, setSessions] = useState<ChatSession[]>(() => getStoredSessions());
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [personas, setPersonas] = useState<Persona[]>(() => getStoredPersonas());
  const [activePersonaId, setActivePersonaId] = useState<string>('aix-alpha-v3');
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(getStoredVoiceSettings());
  const [theme, setTheme] = useState<'dark' | 'light'>(getStoredTheme());

  // UI state: AppViewMode ('chat' | 'appStudio' | 'hosted' | 'personas' | 'mcp' | 'analytics' | 'about')
  const [currentView, setCurrentView] = useState<AppViewMode>('chat');
  const [searchGroundingEnabled, setSearchGroundingEnabled] = useState<boolean>(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Modals state
  const [isPersonaModalOpen, setIsPersonaModalOpen] = useState<boolean>(false);
  const [isVoiceSettingsModalOpen, setIsVoiceSettingsModalOpen] = useState<boolean>(false);
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const [isCreditStoreOpen, setIsCreditStoreOpen] = useState<boolean>(false);
  const [isHostedPortalModalOpen, setIsHostedPortalModalOpen] = useState<boolean>(false);

  // v3 Loop Engine controls (persisted)
  const [loopMode, setLoopMode] = useState<LoopMode>(() => (localStorage.getItem('aix_loop_mode') as LoopMode) || 'eco');
  const [verifyMode, setVerifyMode] = useState<VerifyMode>(() => (localStorage.getItem('aix_verify_mode') as VerifyMode) || 'local');
  useEffect(() => localStorage.setItem('aix_loop_mode', loopMode), [loopMode]);
  useEffect(() => localStorage.setItem('aix_verify_mode', verifyMode), [verifyMode]);

  // Free Tier Testing Mode (Defaults to true for unrestricted testing)
  const [isFreeTierTestMode, setIsFreeTierTestMode] = useState<boolean>(() => {
    const stored = localStorage.getItem('aix_free_tier_testing_mode');
    return stored !== null ? stored === 'true' : true;
  });

  // Credit System State
  const [credits, setCredits] = useState<number>(() => {
    const stored = localStorage.getItem('aix_prompt_credits');
    const parsed = stored !== null ? parseInt(stored, 10) : 999;
    return Math.max(parsed, 999);
  });

  const [lastRefillTime, setLastRefillTime] = useState<number>(() => {
    const stored = localStorage.getItem('aix_credit_last_refill');
    return stored !== null ? parseInt(stored, 10) : Date.now();
  });

  const [timeRemainingStr, setTimeRemainingStr] = useState<string>('24h 00m 00s');

  useEffect(() => {
    const checkRefill = () => {
      const now = Date.now();
      const elapsed = now - lastRefillTime;
      const dayMs = 24 * 60 * 60 * 1000;

      if (elapsed >= dayMs) {
        setCredits((prev) => {
          const next = Math.max(prev, 3);
          localStorage.setItem('aix_prompt_credits', next.toString());
          return next;
        });
        setLastRefillTime(now);
        localStorage.setItem('aix_credit_last_refill', now.toString());
      } else {
        const remaining = dayMs - elapsed;
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const mins = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((remaining % (1000 * 60)) / 1000);
        setTimeRemainingStr(
          `${hours.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m ${secs
            .toString()
            .padStart(2, '0')}s`
        );
      }
    };

    checkRefill();
    const timer = setInterval(checkRefill, 1000);
    return () => clearInterval(timer);
  }, [lastRefillTime]);

  const [codePreview, setCodePreview] = useState<{ isOpen: boolean; code: string; language: string }>({
    isOpen: false,
    code: '',
    language: 'html',
  });
  const [appStudioState, setAppStudioState] = useState<{ initialCode?: string; initialLanguage?: string }>({});

  interface ChatPreviewState {
    isOpen: boolean;
    type: 'code' | 'pdf' | 'spreadsheet' | 'doc' | 'image' | 'video' | '3d';
    fileName: string;
    content: string;
    language?: string;
  }

  const [activeChatPreview, setActiveChatPreview] = useState<ChatPreviewState | null>(null);
  const [chatPreviewCopied, setChatPreviewCopied] = useState(false);
  const [chatPreviewZoom, setChatPreviewZoom] = useState(100);
  const [docFontSerif, setDocFontSerif] = useState(false);

  const handleCopyChatPreview = () => {
    if (!activeChatPreview) return;
    navigator.clipboard.writeText(activeChatPreview.content);
    setChatPreviewCopied(true);
    setTimeout(() => setChatPreviewCopied(false), 2000);
  };

  const handleExportChatPreviewFile = () => {
    if (!activeChatPreview) return;
    const blob = new Blob([activeChatPreview.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = activeChatPreview.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenAppStudio = (code?: string, language?: string) => {
    setAppStudioState({ initialCode: code, initialLanguage: language });
    setCurrentView('appStudio');
  };

  // Initialization
  useEffect(() => {
    const storedPersonas = getStoredPersonas();
    setPersonas(storedPersonas);

    const storedSessions = getStoredSessions();
    if (storedSessions.length > 0) {
      setSessions(storedSessions);
      setActiveSessionId(storedSessions[0].id);
      setSearchGroundingEnabled(storedSessions[0].searchGroundingEnabled ?? true);
      setActivePersonaId(storedSessions[0].personaId || 'aix-alpha-v3');
    } else {
      // Create initial session
      const newSession: ChatSession = {
        id: `session_${Date.now()}`,
        title: 'New Chat Session',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        personaId: 'aix-alpha-v3',
        messages: [],
        searchGroundingEnabled: true,
      };
      setSessions([newSession]);
      setActiveSessionId(newSession.id);
      saveStoredSessions([newSession]);
    }
  }, []);

  // Sync theme class on <html> element
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
    saveStoredTheme(theme);
  }, [theme]);

  // Current active session & persona with robust fallback guards
  const fallbackPersona: Persona = PRESET_PERSONAS[0];
  const activePersona = (personas && personas.length > 0 ? (personas.find((p) => p.id === activePersonaId) || personas[0]) : null) || fallbackPersona;

  const fallbackSession: ChatSession = {
    id: 'default_session',
    title: 'New Chat Session',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    personaId: activePersona.id,
    messages: [],
    searchGroundingEnabled: true,
  };
  const activeSession = (sessions && sessions.length > 0 ? (sessions.find((s) => s.id === activeSessionId) || sessions[0]) : null) || fallbackSession;

  // Helper to save sessions update
  const updateSessions = (updatedList: ChatSession[]) => {
    setSessions(updatedList);
    saveStoredSessions(updatedList);
  };

  // Create new session
  const handleNewSession = () => {
    const newSession: ChatSession = {
      id: `session_${Date.now()}`,
      title: 'New Chat Session',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      personaId: activePersonaId,
      messages: [],
      searchGroundingEnabled,
    };
    const updated = [newSession, ...sessions];
    updateSessions(updated);
    setActiveSessionId(newSession.id);
  };

  // Delete session
  const handleDeleteSession = (id: string) => {
    const filtered = sessions.filter((s) => s.id !== id);
    if (filtered.length === 0) {
      const freshSession: ChatSession = {
        id: `session_${Date.now()}`,
        title: 'New Chat Session',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        personaId: activePersonaId,
        messages: [],
        searchGroundingEnabled,
      };
      updateSessions([freshSession]);
      setActiveSessionId(freshSession.id);
    } else {
      updateSessions(filtered);
      if (activeSessionId === id) {
        setActiveSessionId(filtered[0].id);
      }
    }
  };

  // Pin/unpin session
  const handleTogglePinSession = (id: string) => {
    const updated = sessions.map((s) => (s.id === id ? { ...s, isPinned: !s.isPinned } : s));
    updateSessions(updated);
  };

  // Rename session
  const handleRenameSession = (id: string, newTitle: string) => {
    const updated = sessions.map((s) => (s.id === id ? { ...s, title: newTitle } : s));
    updateSessions(updated);
  };

  // Import session
  const handleImportSession = (imported: ChatSession) => {
    const existingIndex = sessions.findIndex((s) => s.id === imported.id);
    let updated: ChatSession[];
    if (existingIndex >= 0) {
      updated = [...sessions];
      updated[existingIndex] = imported;
    } else {
      updated = [imported, ...sessions];
    }
    updateSessions(updated);
    setActiveSessionId(imported.id);
  };

  const detectAndOpenChatPreview = (message: ChatMessage) => {
    // 1. Check for 3D model
    if (message.model3D) {
      setActiveChatPreview({
        isOpen: true,
        type: '3d',
        fileName: message.model3D.title || 'Quantum_Dynamic_Mesh.glb',
        content: message.model3D.prompt,
      });
      return;
    }
    // 2. Check for Video
    if (message.generatedVideo) {
      setActiveChatPreview({
        isOpen: true,
        type: 'video',
        fileName: 'Generated_Video_Stream.mp4',
        content: message.generatedVideo.videoUrl,
      });
      return;
    }
    // 3. Check for Images
    if (message.generatedImages && message.generatedImages.length > 0) {
      setActiveChatPreview({
        isOpen: true,
        type: 'image',
        fileName: 'Generated_Image.png',
        content: message.generatedImages[0].url,
      });
      return;
    }
    
    // 4. Check for code blocks in text
    const codeBlockMatch = message.content.match(/```(\w+)?\n([\s\S]*?)```/);
    if (codeBlockMatch) {
      const language = codeBlockMatch[1] || 'typescript';
      const codeContent = codeBlockMatch[2];
      setActiveChatPreview({
        isOpen: true,
        type: 'code',
        fileName: `source_code.${language === 'js' || language === 'javascript' ? 'js' : language === 'html' ? 'html' : language === 'css' ? 'css' : 'tsx'}`,
        content: codeContent,
        language,
      });
      return;
    }

    // 5. Check if mentions Spreadsheet, Excel, CSV or Sheets
    if (/spreadsheet|excel|csv|\bsheet\b|\bsheets\b/i.test(message.content)) {
      setActiveChatPreview({
        isOpen: true,
        type: 'spreadsheet',
        fileName: 'Cognitive_Spreadsheet_Matrix.csv',
        content: `Row ID,Task Name,Coherence,Tokens,Cost (XRP)\n1,Initialize Superposition,0.9998,4096,0.0025\n2,Web Grounding Lookup,0.9992,8192,0.0050\n3,Neural Synapse Merge,0.9995,16384,0.0100`,
      });
      return;
    }

    // 6. Check if mentions PDF
    if (/pdf|portable document/i.test(message.content)) {
      setActiveChatPreview({
        isOpen: true,
        type: 'pdf',
        fileName: 'AIX_Alpha_Whitepaper.pdf',
        content: 'AIX ALPHA V3.0 SPECIFICATION DOCUMENT\n\nSection 1: Superposition Context Layers\nSection 2: High-Frequency Ledger Billing\nSection 3: Model Context Protocol Transports\nSection 4: Advanced Code Sandbox Environment',
      });
      return;
    }

    // 7. Check if mentions Doc, Word, Text, Document
    if (/document|doc|\bword\b|\bdocs\b/i.test(message.content)) {
      setActiveChatPreview({
        isOpen: true,
        type: 'doc',
        fileName: 'AIX_Cognitive_Brief.docx',
        content: 'AIX Alpha cognitive documentation Brief. Prepared on the XRP ledger with full quantum alignment.',
      });
      return;
    }
  };

  // Send Message logic
  const handleSendMessage = async (text: string, attachments: Attachment[] = []) => {
    if (!activeSession) return;

    const deducted = handleDeductCredit();
    if (!deducted) return;

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
      attachments,
    };

    // Auto title chat session on first message
    let updatedTitle = activeSession.title;
    if (activeSession.messages.length === 0 && text) {
      updatedTitle = text.slice(0, 36) + (text.length > 36 ? '...' : '');
    }

    const updatedSession: ChatSession = {
      ...activeSession,
      title: updatedTitle,
      updatedAt: Date.now(),
      messages: [...activeSession.messages, userMessage],
    };

    const updatedSessions = sessions.map((s) => (s.id === activeSession.id ? updatedSession : s));
    updateSessions(updatedSessions);

    setIsLoading(true);
    const startedAt = Date.now();

    try {
      // Call backend API endpoint `/api/chat`
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeSession.id,
          personaId: activePersonaId,
          loopMode,
          verifyMode,
          messages: updatedSession.messages.map((m) => ({ role: m.role, content: m.content })),
          systemInstruction: activePersona.systemInstruction,
          useSearchGrounding: searchGroundingEnabled,
          model: activePersona.modelAlias,
          temperature: activePersona.temperature,
          thinkingLevel: activePersona.thinkingLevel,
          attachments: attachments.map((a) => ({ mimeType: a.mimeType, data: a.data })),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to receive AI response.');
      }

      // Generate confidence label based on persona & content
      let confidenceLabel: '[C]' | '[~]' | '[?]' = '[C]';
      if (data.text.includes('[?]')) confidenceLabel = '[?]';
      else if (data.text.includes('[~]')) confidenceLabel = '[~]';
      // v3: a reply that failed the loop's verification is never shown as verified
      if (data.telemetry && data.telemetry.calls > 0 && !data.telemetry.verified) confidenceLabel = '[~]';

      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now()}_ai`,
        role: 'assistant',
        content: data.text,
        timestamp: Date.now(),
        modelUsed: data.model || activePersona.modelAlias,
        reasoningMeta: {
          confidence: confidenceLabel,
          tier: data.telemetry?.tier || (data.text.length < 200 ? 'MICRO' : data.text.length < 800 ? 'STANDARD' : 'DEEP'),
          superpositionState: data.telemetry?.protocol ? data.telemetry.protocol.join(' → ') : undefined,
          latencyMs: Date.now() - startedAt,
        },
        telemetry: data.telemetry,
        grounding: data.grounding,
        generatedImages: data.generatedImages,
        model3D: data.model3D,
        generatedVideo: data.generatedVideo,
        executionSteps: data.executionSteps,
      };

      const finalSession: ChatSession = {
        ...updatedSession,
        updatedAt: Date.now(),
        messages: [...updatedSession.messages, assistantMessage],
      };

      const finalSessions = sessions.map((s) => (s.id === activeSession.id ? finalSession : s));
      updateSessions(finalSessions);
      detectAndOpenChatPreview(assistantMessage);

      // Auto read response if voice setting enabled
      if (voiceSettings.autoReadResponses) {
        speakTextNative(
          data.text,
          undefined,
          undefined,
          voiceSettings.speechRate,
          voiceSettings.speechPitch
        );
      }
    } catch (err: any) {
      console.error('Chat API Error:', err);

      const errorMessage: ChatMessage = {
        id: `msg_${Date.now()}_err`,
        role: 'assistant',
        content: `⚠️ **Error generating response:** ${err.message || 'Server error'}. Check that ANTHROPIC_API_KEY is set in .env.local and the server is running.`,
        timestamp: Date.now(),
        error: true,
      };

      const errSession: ChatSession = {
        ...updatedSession,
        messages: [...updatedSession.messages, errorMessage],
      };
      updateSessions(sessions.map((s) => (s.id === activeSession.id ? errSession : s)));
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleFreeTierTestMode = (enabled?: boolean) => {
    const next = enabled !== undefined ? enabled : !isFreeTierTestMode;
    setIsFreeTierTestMode(next);
    localStorage.setItem('aix_free_tier_testing_mode', next.toString());
    if (next) {
      setCredits(999);
      localStorage.setItem('aix_prompt_credits', '999');
    }
  };

  // Credit deduction handler for chat and app studio
  const handleDeductCredit = (): boolean => {
    if (isFreeTierTestMode) {
      // Free Tier Testing Mode: Unrestricted prompts during testing!
      return true;
    }
    if (credits <= 0) {
      setIsCreditStoreOpen(true);
      return false;
    }
    setCredits((prev) => {
      const next = Math.max(0, prev - 1);
      localStorage.setItem('aix_prompt_credits', next.toString());
      return next;
    });
    return true;
  };

  return (
    <div className={`min-h-[100dvh] h-[100dvh] font-sans bg-black text-zinc-100 flex flex-col overflow-hidden ${theme}`}>
      {currentView === 'appStudio' ? (
        /* Full Page App & Web Studio */
        <AppStudioPage
          onBackToChat={() => setCurrentView('chat')}
          initialCode={appStudioState.initialCode}
          initialLanguage={appStudioState.initialLanguage}
          activeSession={activeSession}
          activePersona={activePersona}
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          credits={credits}
          onDeductCredit={handleDeductCredit}
          onOpenCreditStore={() => setIsCreditStoreOpen(true)}
        />
      ) : currentView === 'personas' ? (
        /* Full Page Persona & Fine-Tuned Model Hub */
        <PersonaHubPage
          personas={personas}
          activePersonaId={activePersonaId}
          onSelectPersona={(persona) => {
            setActivePersonaId(persona.id);
            setSearchGroundingEnabled(persona.defaultSearchGrounding);
            if (activeSession) {
              const updated = sessions.map((s) =>
                s.id === activeSession.id ? { ...s, personaId: persona.id, modelOverride: persona.modelAlias } : s
              );
              updateSessions(updated);
            }
          }}
          onSaveCustomPersona={(newPersona) => {
            const updated = saveCustomPersona(newPersona);
            setPersonas(updated);
          }}
          onDeleteCustomPersona={(id) => {
            const updated = deleteCustomPersona(id);
            setPersonas(updated);
            if (activePersonaId === id) {
              setActivePersonaId(updated[0]?.id || 'aix-alpha-v3');
            }
          }}
          onNavigateToChat={() => setCurrentView('chat')}
          onUseTemplate={(persona, promptText) => {
            setActivePersonaId(persona.id);
            setSearchGroundingEnabled(persona.defaultSearchGrounding);
            if (activeSession) {
              const updated = sessions.map((s) =>
                s.id === activeSession.id ? { ...s, personaId: persona.id, modelOverride: persona.modelAlias } : s
              );
              updateSessions(updated);
            }
            setCurrentView('chat');
            setTimeout(() => {
              handleSendMessage(promptText, []);
            }, 100);
          }}
        />
      ) : currentView === 'hosted' ? (
        /* Full Page Deployment & Hosted Sites Control Panel */
        <div className="min-h-screen bg-black flex flex-col font-sans">
          <Header
            activePersona={activePersona}
            onOpenPersonaModal={() => setCurrentView('personas')}
            searchGroundingEnabled={searchGroundingEnabled}
            onToggleSearchGrounding={() => setSearchGroundingEnabled(!searchGroundingEnabled)}
            autoVoiceEnabled={voiceSettings.autoReadResponses}
            onToggleAutoVoice={() => {
              const updated = { ...voiceSettings, autoReadResponses: !voiceSettings.autoReadResponses };
              setVoiceSettings(updated);
              saveStoredVoiceSettings(updated);
            }}
            onOpenVoiceSettings={() => setIsVoiceSettingsModalOpen(true)}
            theme={theme}
            onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
            onNewSession={handleNewSession}
            currentView={currentView}
            onChangeView={setCurrentView}
            onExportChatJSON={() => exportSessionAsJSON(activeSession)}
            onExportChatMD={() => exportSessionAsMarkdown(activeSession)}
            onImportChatJSON={(file: File) => {
              const reader = new FileReader();
              reader.onload = (event) => {
                try {
                  const parsed = JSON.parse(event.target?.result as string);
                  if (parsed && parsed.id && parsed.messages) {
                    handleImportSession(parsed);
                  } else {
                    alert('Invalid chat session JSON format.');
                  }
                } catch (e) {
                  alert('Failed to parse JSON file.');
                }
              };
              reader.readAsText(file);
            }}
            onOpenHostPortalModal={() => setIsHostedPortalModalOpen(true)}
          />
          <HostedSitesPage
            onBackToChat={() => setCurrentView('chat')}
            onNavigateToAppStudio={(code, language) => handleOpenAppStudio(code, language)}
            personas={personas}
            activePersona={activePersona}
          />
        </div>
      ) : currentView === 'mcp' ? (
        /* Full Page MCP & API System Hub */
        <McpSystemPage
          onBackToChat={() => setCurrentView('chat')}
          onNavigateToAppStudio={() => handleOpenAppStudio()}
        />
      ) : currentView === 'analytics' ? (
        /* Full Page Analytics & Usage Telemetry Dashboard */
        <div className="min-h-screen bg-black flex flex-col font-sans">
          <Header
            activePersona={activePersona}
            onOpenPersonaModal={() => setCurrentView('personas')}
            searchGroundingEnabled={searchGroundingEnabled}
            onToggleSearchGrounding={() => setSearchGroundingEnabled(!searchGroundingEnabled)}
            autoVoiceEnabled={voiceSettings.autoReadResponses}
            onToggleAutoVoice={() => {
              const updated = { ...voiceSettings, autoReadResponses: !voiceSettings.autoReadResponses };
              setVoiceSettings(updated);
              saveStoredVoiceSettings(updated);
            }}
            onOpenVoiceSettings={() => setIsVoiceSettingsModalOpen(true)}
            theme={theme}
            onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
            onNewSession={handleNewSession}
            currentView={currentView}
            onChangeView={setCurrentView}
            onExportChatJSON={() => exportSessionAsJSON(activeSession)}
            onExportChatMD={() => exportSessionAsMarkdown(activeSession)}
            onImportChatJSON={(file: File) => {
              const reader = new FileReader();
              reader.onload = (event) => {
                try {
                  const parsed = JSON.parse(event.target?.result as string);
                  if (parsed && parsed.id && parsed.messages) {
                    handleImportSession(parsed);
                  } else {
                    alert('Invalid chat session JSON format.');
                  }
                } catch (e) {
                  alert('Failed to parse JSON file.');
                }
              };
              reader.readAsText(file);
            }}
            onOpenHostPortalModal={() => setIsHostedPortalModalOpen(true)}
          />
          <AnalyticsDashboard
            sessions={sessions}
            credits={credits}
            lastRefillTime={lastRefillTime}
            timeRemainingStr={timeRemainingStr}
            personas={personas}
            onOpenCreditStore={() => setIsCreditStoreOpen(true)}
          />
        </div>
      ) : currentView === 'billing' ? (
        /* Full Page XRPL Mainnet Billing & Ledger Page */
        <div className="min-h-screen bg-black flex flex-col font-sans">
          <Header
            activePersona={activePersona}
            onOpenPersonaModal={() => setCurrentView('personas')}
            searchGroundingEnabled={searchGroundingEnabled}
            onToggleSearchGrounding={() => setSearchGroundingEnabled(!searchGroundingEnabled)}
            autoVoiceEnabled={voiceSettings.autoReadResponses}
            onToggleAutoVoice={() => {
              const updated = { ...voiceSettings, autoReadResponses: !voiceSettings.autoReadResponses };
              setVoiceSettings(updated);
              saveStoredVoiceSettings(updated);
            }}
            onOpenVoiceSettings={() => setIsVoiceSettingsModalOpen(true)}
            theme={theme}
            onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
            onNewSession={handleNewSession}
            currentView={currentView}
            onChangeView={setCurrentView}
            onExportChatJSON={() => exportSessionAsJSON(activeSession)}
            onExportChatMD={() => exportSessionAsMarkdown(activeSession)}
            onImportChatJSON={(file: File) => {
              const reader = new FileReader();
              reader.onload = (event) => {
                try {
                  const parsed = JSON.parse(event.target?.result as string);
                  if (parsed && parsed.id && parsed.messages) {
                    handleImportSession(parsed);
                  } else {
                    alert('Invalid chat session JSON format.');
                  }
                } catch (e) {
                  alert('Failed to parse JSON file.');
                }
              };
              reader.readAsText(file);
            }}
            onOpenHostPortalModal={() => setIsHostedPortalModalOpen(true)}
          />
          <BillingHistoryPage
            onBackToChat={() => setCurrentView('chat')}
            onOpenCreditStore={() => setIsCreditStoreOpen(true)}
            currentCredits={credits}
            onAddCredits={(amount) => {
              setCredits((prev) => {
                const next = prev + amount;
                localStorage.setItem('aix_prompt_credits', next.toString());
                return next;
              });
            }}
          />
        </div>
      ) : currentView === 'about' ? (
        /* Full Page Apple-Style About Me & Keynote Page */
        <AboutMePage
          onBackToChat={() => setCurrentView('chat')}
          onNavigateToAppStudio={() => handleOpenAppStudio()}
          onNavigateToPersonas={() => setCurrentView('personas')}
          onSelectPersonaAndChat={(personaId) => {
            const chosen = personas.find((p) => p.id === personaId);
            if (chosen) {
              setActivePersonaId(chosen.id);
              setSearchGroundingEnabled(chosen.defaultSearchGrounding);
              if (activeSession) {
                const updated = sessions.map((s) =>
                  s.id === activeSession.id ? { ...s, personaId: chosen.id, modelOverride: chosen.modelAlias } : s
                );
                updateSessions(updated);
              }
            }
            setCurrentView('chat');
          }}
        />
      ) : (
        <>
          {/* Top Header */}
          <Header
            activePersona={activePersona}
            onOpenPersonaModal={() => setCurrentView('personas')}
            searchGroundingEnabled={searchGroundingEnabled}
            onToggleSearchGrounding={() => setSearchGroundingEnabled(!searchGroundingEnabled)}
            autoVoiceEnabled={voiceSettings.autoReadResponses}
            onToggleAutoVoice={() => {
              const updated = { ...voiceSettings, autoReadResponses: !voiceSettings.autoReadResponses };
              setVoiceSettings(updated);
              saveStoredVoiceSettings(updated);
            }}
            onOpenVoiceSettings={() => setIsVoiceSettingsModalOpen(true)}
            theme={theme}
            onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
            onNewSession={handleNewSession}
            currentView={currentView}
            onChangeView={setCurrentView}
            onExportChatJSON={() => exportSessionAsJSON(activeSession)}
            onExportChatMD={() => exportSessionAsMarkdown(activeSession)}
            onImportChatJSON={(file: File) => {
              const reader = new FileReader();
              reader.onload = (event) => {
                try {
                  const parsed = JSON.parse(event.target?.result as string);
                  if (parsed && parsed.id && parsed.messages) {
                    handleImportSession(parsed);
                  } else {
                    alert('Invalid chat session JSON format.');
                  }
                } catch (e) {
                  alert('Failed to parse JSON file.');
                }
              };
              reader.readAsText(file);
            }}
            onOpenHostPortalModal={() => setIsHostedPortalModalOpen(true)}
          />

          {/* Main App Layout */}
          <div className="flex-1 flex overflow-hidden relative">
            {/* Sidebar */}
            <Sidebar
              isOpen={isMobileSidebarOpen}
              onCloseMobile={() => setIsMobileSidebarOpen(false)}
              sessions={sessions}
              activeSessionId={activeSessionId}
              onSelectSession={(id) => {
                setActiveSessionId(id);
                const selected = sessions.find((s) => s.id === id);
                if (selected) {
                  setSearchGroundingEnabled(selected.searchGroundingEnabled ?? true);
                  if (selected.personaId) setActivePersonaId(selected.personaId);
                }
              }}
              onNewSession={handleNewSession}
              onDeleteSession={handleDeleteSession}
              onTogglePinSession={handleTogglePinSession}
              onRenameSession={handleRenameSession}
              personas={personas}
              activePersonaId={activePersonaId}
              onOpenPersonaModal={() => setCurrentView('personas')}
              onImportSession={handleImportSession}
              onOpenAppStudio={() => handleOpenAppStudio()}
              onOpenHostedSites={() => setCurrentView('hosted')}
              onOpenBilling={() => setCurrentView('billing')}
              onOpenAbout={() => setCurrentView('about')}
            />

            {/* Conversation Area (Centered Chat Experience) */}
            <main className="flex-1 flex flex-col justify-between overflow-hidden bg-black relative">
              {/* Messages List Container - Vertically & Horizontally Centered */}
              <div className="flex-1 overflow-y-auto pb-6 flex flex-col">
                {!activeSession || activeSession.messages.length === 0 ? (
                  /* Centered Apple-Style Super Advanced Welcome Workstation */
                  <div className="max-w-4xl mx-auto px-6 py-12 text-center space-y-8 animate-in fade-in duration-300 my-auto flex flex-col items-center justify-center min-h-[60vh]">
                    <div className="space-y-4 text-center">
                      {/* Centered Refined Typography */}
                      <h1 className="text-4xl sm:text-6xl md:text-7xl font-semibold tracking-[-0.04em] text-white font-sans text-center">
                        AIX Alpha v3.0 <span className="text-zinc-500 font-light">AI Suite</span>
                      </h1>
                      <p className="text-base sm:text-xl text-zinc-400 max-w-3xl sm:max-w-4xl mx-auto font-sans leading-relaxed tracking-[-0.015em] text-center">
                        High-throughput quantum cognitive engine equipped with multi-file App Studio,<br className="hidden sm:inline" /> fine-tuned neural models, live web grounding, and real-time execution telemetry.
                      </p>

                      {/* Centered Quick Action Badges */}
                      <div className="flex flex-wrap items-center justify-center gap-2.5 pt-3">
                        <button
                          onClick={() => setCurrentView('about')}
                          className="px-3.5 py-1.5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white border border-zinc-700/80 text-xs font-mono flex items-center gap-2 transition-all shadow-md active:scale-95"
                        >
                          <Cpu className="w-3.5 h-3.5 text-white" />
                          <span>ABOUT KEYNOTE & SPEC</span>
                          <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                        </button>

                        <button
                          onClick={() => handleOpenAppStudio()}
                          className="px-3.5 py-1.5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white border border-zinc-700/80 text-xs font-mono flex items-center gap-2 transition-all shadow-md active:scale-95"
                        >
                          <Terminal className="w-3.5 h-3.5 text-white" />
                          <span>APP STUDIO</span>
                        </button>

                        <button
                          onClick={() => setCurrentView('personas')}
                          className="px-3.5 py-1.5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white border border-zinc-700/80 text-xs font-mono flex items-center gap-2 transition-all shadow-md active:scale-95"
                        >
                          <Sliders className="w-3.5 h-3.5 text-zinc-400" />
                          <span>MODEL: {activePersona.name}</span>
                        </button>

                        <span className="px-3.5 py-1.5 rounded-full text-xs font-mono bg-zinc-900 text-zinc-400 border border-zinc-800 flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-emerald-400" />
                          <span>WEB SEARCH: {searchGroundingEnabled ? 'LIVE' : 'OFF'}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Centered Messages Thread */
                  <div className="w-full">
                    {activeSession.messages.map((m) => (
                      <ChatMessageItem
                        key={m.id}
                        message={m}
                        persona={activePersona}
                        onOpenCodePreview={(code, lang) =>
                          setCodePreview({ isOpen: true, code, language: lang })
                        }
                        onOpenAppStudio={(code, lang) => handleOpenAppStudio(code, lang)}
                        voiceRate={voiceSettings.speechRate}
                        voicePitch={voiceSettings.speechPitch}
                      />
                    ))}

                    {/* Live Move-by-Move Telemetry Tracker */}
                    <LiveExecutionTracker
                      isLoading={isLoading}
                      prompt={activeSession.messages[activeSession.messages.length - 1]?.content || ''}
                      persona={activePersona}
                      searchGroundingEnabled={searchGroundingEnabled}
                    />
                  </div>
                )}
              </div>

              {/* v3 Loop controls + live spend meter */}
              <LoopBar
                mode={loopMode}
                onMode={setLoopMode}
                verify={verifyMode}
                onVerify={setVerifyMode}
                messages={activeSession.messages}
              />

              {/* Centered Prompt Input Bar */}
              <PromptBar
                onSendMessage={handleSendMessage}
                isLoading={isLoading}
                searchGroundingEnabled={searchGroundingEnabled}
                onToggleSearchGrounding={() => setSearchGroundingEnabled(!searchGroundingEnabled)}
                activePersona={activePersona}
                onOpenPersonaModal={() => setIsPersonaModalOpen(true)}
                onOpenCamera={() => setIsCameraOpen(true)}
                onOpenCreditStore={() => setIsCreditStoreOpen(true)}
                currentCredits={credits}
                isFreeTierTestMode={isFreeTierTestMode}
              />
            </main>

            {/* ========================================================================= */}
            {/* RIGHT-SIDE COGNITIVE CHAT FILE/CODE PREVIEW SIDEBAR */}
            {/* ========================================================================= */}
            {activeChatPreview && activeChatPreview.isOpen && (
              <aside className="w-[450px] border-l border-zinc-800 bg-zinc-950 flex flex-col h-full overflow-hidden animate-in slide-in-from-right duration-300 z-10 shrink-0 font-sans">
                {/* Header */}
                <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/40">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300">
                      {activeChatPreview.type === 'code' ? <Code2 className="w-4 h-4" /> :
                       activeChatPreview.type === 'pdf' ? <FileText className="w-4 h-4 text-red-400" /> :
                       activeChatPreview.type === 'spreadsheet' ? <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> :
                       activeChatPreview.type === 'doc' ? <FileText className="w-4 h-4 text-blue-400" /> :
                       activeChatPreview.type === 'image' ? <Eye className="w-4 h-4 text-purple-400" /> :
                       activeChatPreview.type === 'video' ? <Eye className="w-4 h-4 text-amber-400" /> :
                       <Box className="w-4 h-4 text-indigo-400" />}
                    </div>
                    <div className="truncate">
                      <h3 className="text-xs font-bold text-white tracking-wide uppercase truncate">{activeChatPreview.fileName}</h3>
                      <p className="text-[10px] text-zinc-500 font-mono tracking-wider">PREVIEW MODE</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {activeChatPreview.type === 'code' && (
                      <button
                        onClick={() => handleOpenAppStudio(activeChatPreview.content, activeChatPreview.language)}
                        className="px-2.5 py-1.5 bg-white text-black hover:bg-zinc-200 text-[10px] font-bold font-mono rounded-lg transition-all flex items-center gap-1 active:scale-95"
                      >
                        <Terminal className="w-3.5 h-3.5" />
                        <span>OPEN IN APP STUDIO</span>
                      </button>
                    )}
                    <button
                      onClick={() => setActiveChatPreview(null)}
                      className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-lg border border-zinc-800 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Toolbar */}
                <div className="px-4 py-2 border-b border-zinc-900 bg-zinc-950/80 flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-zinc-500">TYPE: {activeChatPreview.type.toUpperCase()}</span>
                    {activeChatPreview.type !== 'image' && activeChatPreview.type !== 'video' && activeChatPreview.type !== '3d' && (
                      <>
                        <span className="text-zinc-800">|</span>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => setChatPreviewZoom(Math.max(50, chatPreviewZoom - 10))} className="p-0.5 hover:text-white text-zinc-400">
                            <ZoomOut className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-[9px] min-w-[3ch] text-center text-zinc-300">{chatPreviewZoom}%</span>
                          <button onClick={() => setChatPreviewZoom(Math.min(150, chatPreviewZoom + 10))} className="p-0.5 hover:text-white text-zinc-400">
                            <ZoomIn className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                    {activeChatPreview.type === 'doc' && (
                      <>
                        <span className="text-zinc-800">|</span>
                        <button 
                          onClick={() => setDocFontSerif(!docFontSerif)} 
                          className={`text-[9px] px-1.5 py-0.5 rounded border transition-all ${docFontSerif ? 'bg-zinc-800 text-white border-zinc-600' : 'text-zinc-400 border-zinc-800'}`}
                        >
                          SERIF
                        </button>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyChatPreview}
                      className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1.5 transition-all"
                    >
                      {chatPreviewCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{chatPreviewCopied ? 'COPIED' : 'COPY'}</span>
                    </button>
                  </div>
                </div>

                {/* Viewport Content */}
                <div className="flex-1 overflow-y-auto p-5 bg-black flex flex-col justify-start">
                  <div 
                    style={{ transform: `scale(${chatPreviewZoom / 100})`, transformOrigin: 'top center' }} 
                    className="w-full flex-1 flex flex-col transition-transform duration-200"
                  >
                    {activeChatPreview.type === 'code' && (
                      <pre className="p-4 bg-zinc-950 border border-zinc-900 rounded-xl font-mono text-[11px] text-zinc-300 overflow-x-auto text-left w-full whitespace-pre-wrap leading-relaxed shadow-inner">
                        {activeChatPreview.content}
                      </pre>
                    )}

                    {activeChatPreview.type === 'pdf' && (
                      <div className="p-6 bg-white text-black border border-zinc-300 rounded-xl shadow-lg w-full font-sans text-left min-h-[500px] flex flex-col justify-between">
                        <div>
                          {/* PDF Mock Header */}
                          <div className="border-b border-zinc-400 pb-3 mb-4 flex justify-between items-center text-[10px] text-zinc-500 font-mono">
                            <span>AIX ALPHA SPECIFICATION SHEET // PORT 3000</span>
                            <span className="px-2 py-0.5 border border-zinc-400 rounded text-red-600 font-bold">CONFIDENTIAL</span>
                          </div>

                          <h2 className="text-xl font-bold tracking-tight mb-2 uppercase text-zinc-900">AIX ALPHA COGNITIVE ARCHITECTURE</h2>
                          <p className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-5">VER 2.0 // DEEP MIND COGNITIVE SUITE</p>

                          <div className="space-y-4 text-xs leading-relaxed text-zinc-800">
                            <p className="font-semibold">Abstract:</p>
                            <p className="text-zinc-600 bg-zinc-100 p-2.5 rounded font-mono text-[10px]">
                              "The integration of multi-model context protocol endpoints and ledger-based billing engines yields high-throughput cognitive pipelines."
                            </p>
                            <p>
                              This document confirms that all generated structures conform to strict Antigravity model frameworks. Web searches are ground-verified against the Google Knowledge Graph in real-time.
                            </p>
                            <div className="border-t border-zinc-200 pt-4 space-y-1.5 font-mono text-[10px] text-zinc-500">
                              <div>SYSTEM_HASH: 0x992BBAFEE8C1109D</div>
                              <div>BILLING_MODE: XRPL_LEDGER_MAINNET</div>
                              <div>DIAGNOSTIC_COMPLIANCE: 100% PASS</div>
                            </div>
                          </div>
                        </div>

                        {/* PDF Footer */}
                        <div className="border-t border-zinc-300 pt-3 mt-6 flex justify-between items-center text-[10px] text-zinc-400 font-mono">
                          <span>PAGE 1 OF 12</span>
                          <span>SECURE CRYPTO SIGNATURE</span>
                        </div>
                      </div>
                    )}

                    {activeChatPreview.type === 'spreadsheet' && (
                      <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-inner w-full font-mono text-left">
                        {/* Formula Bar */}
                        <div className="px-3 py-1.5 bg-zinc-900 border-b border-zinc-800 flex items-center gap-2 text-[10px]">
                          <span className="text-purple-400 font-bold">fx</span>
                          <input 
                            type="text" 
                            readOnly 
                            value="=SUM(D2:D4) * COHERENCE_WEIGHT" 
                            className="bg-black border border-zinc-800 rounded px-2 py-0.5 text-zinc-300 w-full focus:outline-none text-[9px]" 
                          />
                        </div>

                        {/* Sheet Grid */}
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse text-[10px]">
                            <thead>
                              <tr className="bg-zinc-900 text-zinc-500 border-b border-zinc-800">
                                <th className="p-1.5 border-r border-zinc-800 text-center w-8 bg-zinc-950"></th>
                                <th className="p-1.5 border-r border-zinc-800 text-left">A (ID)</th>
                                <th className="p-1.5 border-r border-zinc-800 text-left">B (METRIC)</th>
                                <th className="p-1.5 border-r border-zinc-800 text-right">C (COH)</th>
                                <th className="p-1.5 border-r border-zinc-800 text-right">D (CREDITS)</th>
                              </tr>
                            </thead>
                            <tbody className="text-zinc-300">
                              <tr className="border-b border-zinc-900 hover:bg-zinc-900/40">
                                <td className="p-1.5 border-r border-zinc-800 text-center bg-zinc-900 text-zinc-500 text-[9px]">1</td>
                                <td className="p-1.5 border-r border-zinc-900 font-bold text-zinc-400">#01</td>
                                <td className="p-1.5 border-r border-zinc-900 truncate max-w-[100px]">Inference</td>
                                <td className="p-1.5 border-r border-zinc-900 text-right text-emerald-400">0.9998</td>
                                <td className="p-1.5 text-right font-bold">1.0</td>
                              </tr>
                              <tr className="border-b border-zinc-900 hover:bg-zinc-900/40">
                                <td className="p-1.5 border-r border-zinc-800 text-center bg-zinc-900 text-zinc-500 text-[9px]">2</td>
                                <td className="p-1.5 border-r border-zinc-900 font-bold text-zinc-400">#02</td>
                                <td className="p-1.5 border-r border-zinc-900 truncate max-w-[100px]">Grounding</td>
                                <td className="p-1.5 border-r border-zinc-900 text-right text-emerald-400">0.9992</td>
                                <td className="p-1.5 text-right font-bold">1.0</td>
                              </tr>
                              <tr className="border-b border-zinc-900 hover:bg-zinc-900/40">
                                <td className="p-1.5 border-r border-zinc-800 text-center bg-zinc-900 text-zinc-500 text-[9px]">3</td>
                                <td className="p-1.5 border-r border-zinc-900 font-bold text-zinc-400">#03</td>
                                <td className="p-1.5 border-r border-zinc-900 truncate max-w-[100px]">API Query</td>
                                <td className="p-1.5 border-r border-zinc-900 text-right text-emerald-400">0.9995</td>
                                <td className="p-1.5 text-right font-bold">1.0</td>
                              </tr>
                              <tr className="bg-purple-950/20">
                                <td className="p-1.5 border-r border-zinc-800 text-center bg-zinc-900 text-zinc-500 text-[9px]">4</td>
                                <td className="p-1.5 border-r border-zinc-800 text-purple-400 font-bold">TOTAL</td>
                                <td className="p-1.5 border-r border-zinc-800 italic text-zinc-500">AGGREGATE</td>
                                <td className="p-1.5 border-r border-zinc-800 text-right font-bold text-purple-400">0.9995</td>
                                <td className="p-1.5 text-right font-bold text-purple-400">3.0</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {activeChatPreview.type === 'doc' && (
                      <div className={`p-8 bg-zinc-900 text-zinc-200 border border-zinc-800 rounded-xl shadow-lg w-full text-left min-h-[400px] flex flex-col justify-between ${docFontSerif ? 'font-serif' : 'font-sans'}`}>
                        <div>
                          <h1 className="text-2xl font-bold tracking-tight mb-2 border-b border-zinc-800 pb-3 text-white">AIX Cognitive Research Brief</h1>
                          <div className="text-xs text-zinc-400 space-y-4 leading-relaxed mt-4">
                            <p>
                              The quantum coherence workspace represents a significant milestone in high-performance model orchestration. 
                              By distributing token routing across dedicated cognitive domains, latency drops by up to 42.8% on standard benchmark suites.
                            </p>
                            <p>
                              Each user interaction is logged on the high-frequency billing ledger, guaranteeing cryptographic authenticity and zero-friction resource allocation.
                            </p>
                          </div>
                        </div>
                        <div className="text-[10px] text-zinc-500 border-t border-zinc-800 pt-3 mt-6 flex justify-between font-mono">
                          <span>AIX ALPHA DOCX // SYSTEM TEMPLATE</span>
                          <span>AUG 2026</span>
                        </div>
                      </div>
                    )}

                    {activeChatPreview.type === 'image' && (
                      <div className="w-full flex flex-col items-center gap-3">
                        <img 
                          src={activeChatPreview.content} 
                          alt="AIX Generated Asset" 
                          referrerPolicy="no-referrer"
                          className="w-full rounded-xl border border-zinc-800 max-h-72 object-contain bg-zinc-950 shadow-md"
                        />
                        <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-900 w-full text-left font-mono text-[9px] text-zinc-500 space-y-1">
                          <div>DIMENSIONS: 1024 x 1024 px</div>
                          <div>FORMAT: PNG (LOSSLESS COGNITIVE)</div>
                          <div>PRODUCER: IMAGE_GENERATION_V2</div>
                        </div>
                      </div>
                    )}

                    {activeChatPreview.type === 'video' && (
                      <div className="w-full flex flex-col items-center gap-3">
                        <div className="w-full aspect-video rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col justify-between p-4 relative overflow-hidden group">
                          {/* Animated mesh placeholder */}
                          <div className="absolute inset-0 bg-gradient-to-tr from-purple-950/20 to-blue-950/20 animate-pulse" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center hover:scale-110 hover:bg-white/20 transition-all cursor-pointer">
                              <Play className="w-5 h-5 text-white ml-0.5 fill-white" />
                            </div>
                          </div>

                          <span className="text-[9px] px-2 py-0.5 rounded bg-black/60 border border-white/10 text-white font-mono self-start z-10">0:04 STREAM</span>
                          
                          {/* Progress Scrubber */}
                          <div className="w-full flex items-center gap-2 text-white font-mono text-[9px] z-10 bg-black/40 p-2 rounded-lg backdrop-blur-sm border border-white/5">
                            <span>00:00</span>
                            <div className="flex-1 h-1 bg-zinc-800 rounded overflow-hidden">
                              <div className="w-1/3 h-full bg-white rounded" />
                            </div>
                            <span>00:04</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {activeChatPreview.type === '3d' && (
                      <div className="w-full flex flex-col items-center gap-3">
                        <div className="w-full h-64 bg-zinc-950 border border-zinc-800 rounded-xl relative overflow-hidden flex flex-col justify-between p-4">
                          {/* 3D Wireframe grid overlay */}
                          <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:14px_24px] pointer-events-none" />
                          
                          {/* Central abstract wireframe mesh */}
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-spin" style={{ animationDuration: '20s' }}>
                            <div className="w-28 h-28 border border-dashed border-purple-500/40 rounded-full flex items-center justify-center">
                              <div className="w-20 h-20 border border-purple-500/60 rounded-full flex items-center justify-center">
                                <div className="w-12 h-12 border border-purple-500/80 rounded-full flex items-center justify-center">
                                  <Box className="w-5 h-5 text-white animate-bounce" />
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[9px] text-zinc-500 font-mono z-10">
                            <span>POLYGONS: 14,802</span>
                            <span>SHADING: PHONG_COGNITIVE</span>
                          </div>

                          {/* 3D controls */}
                          <div className="grid grid-cols-3 gap-1.5 z-10 font-mono text-[8px] text-center text-zinc-400">
                            <div className="bg-black/80 border border-zinc-800 p-1.5 rounded">YAW: 114°</div>
                            <div className="bg-black/80 border border-zinc-800 p-1.5 rounded">PITCH: 32°</div>
                            <div className="bg-black/80 border border-zinc-800 p-1.5 rounded">ROLL: -12°</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Export Action Bar Footer */}
                <div className="px-5 py-4 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between font-mono">
                  <span className="text-[10px] text-zinc-500">READY TO INTEGRATE</span>
                  <button
                    onClick={handleExportChatPreviewFile}
                    className="px-4 py-2 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-bold font-mono flex items-center gap-1.5 shadow active:scale-95 transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>EXPORT FILE</span>
                  </button>
                </div>
              </aside>
            )}
          </div>
        </>
      )}

      {/* Modals */}
      <PersonaModal
        isOpen={isPersonaModalOpen}
        onClose={() => setIsPersonaModalOpen(false)}
        personas={personas}
        activePersonaId={activePersonaId}
        onSelectPersona={(persona) => {
          setActivePersonaId(persona.id);
          setSearchGroundingEnabled(persona.defaultSearchGrounding);
        }}
        onSaveCustomPersona={(newPersona) => {
          const updated = saveCustomPersona(newPersona);
          setPersonas(updated);
        }}
      />

      <VoiceSettingsModal
        isOpen={isVoiceSettingsModalOpen}
        onClose={() => setIsVoiceSettingsModalOpen(false)}
        settings={voiceSettings}
        onSave={(updated) => {
          setVoiceSettings(updated);
          saveStoredVoiceSettings(updated);
        }}
      />

      <CodePreviewModal
        isOpen={codePreview.isOpen}
        onClose={() => setCodePreview({ ...codePreview, isOpen: false })}
        code={codePreview.code}
        language={codePreview.language}
      />

      <CameraModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={(attachment, initialPromptText) => {
          handleSendMessage(initialPromptText || 'Analyze this camera photo', [attachment]);
        }}
      />

      <CreditStoreModal
        isOpen={isCreditStoreOpen}
        onClose={() => setIsCreditStoreOpen(false)}
        currentCredits={credits}
        timeRemainingStr={timeRemainingStr}
        onAddCredits={(amount) => {
          setCredits((prev) => {
            const next = prev + amount;
            localStorage.setItem('aix_prompt_credits', next.toString());
            return next;
          });
        }}
        onOpenBillingPage={() => setCurrentView('billing')}
        isFreeTierTestMode={isFreeTierTestMode}
        onToggleFreeTierTestMode={handleToggleFreeTierTestMode}
      />

      <HostedPortalModal
        isOpen={isHostedPortalModalOpen}
        onClose={() => setIsHostedPortalModalOpen(false)}
        activePersona={activePersona}
        onLaunchPublicPortal={(config) => {
          alert(`Public Site Portal [${config.appTitle}] is now LIVE and hosted at ${window.location.origin}/?portal=${config.portalId}`);
        }}
      />
    </div>
  );
}

