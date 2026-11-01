export type Role = 'user' | 'assistant' | 'system';

export type ConfidenceLabel = '[C]' | '[~]' | '[?]' | '[X]';
export type TierClass = 'NANO' | 'MICRO' | 'STANDARD' | 'DEEP';

export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  data: string; // base64
  size: number;
}

export interface GroundingSource {
  title: string;
  url: string;
  snippet?: string;
}

export interface GroundingInfo {
  used: boolean;
  webSearchQueries?: string[];
  sources?: GroundingSource[];
}

export interface ReasoningMeta {
  confidence?: ConfidenceLabel;
  tier?: TierClass;
  superpositionState?: string;
  latencyMs?: number;
}

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  width?: number;
  height?: number;
  aspectRatio?: string;
}

export interface Model3DData {
  id: string;
  title: string;
  shape: 'cube' | 'sphere' | 'torus' | 'cylinder' | 'knot' | 'cybernode' | 'pyramid';
  textureType: 'neon' | 'gold' | 'cyberpunk' | 'marble' | 'metallic' | 'hologram' | 'crystal';
  color: string;
  wireframe: boolean;
  autoRotate: boolean;
  prompt: string;
  roughness?: number;
  metalness?: number;
}

export interface GeneratedVideo {
  id: string;
  title: string;
  videoUrl: string;
  prompt: string;
  duration?: number;
  aspectRatio?: string;
}

export interface ExecutionStep {
  id: string;
  text: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  timestamp: number;
}

export type LoopMode = 'eco' | 'balanced' | 'thorough';
export type VerifyMode = 'local' | 'llm';

/** Real accounting returned by the v3 Loop Engine for every reply. */
export interface LoopTelemetry {
  tier: TierClass;
  mode: LoopMode;
  protocol: string[];
  loops: number;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  webSearches: number;
  costUsd: number;
  naiveCostUsd: number;
  savedPct: number;
  responseCacheHit: boolean;
  verified: boolean;
  stopReason: string | null;
  maxTokens: number;
  effort: string;
  promptTokensTrimmed: number;
  session: { costUsd: number; capUsd: number; requests: number };
  daily: { costUsd: number; capUsd: number };
  blocked?: string;
  notes: string[];
}

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  modelUsed?: string;
  reasoningMeta?: ReasoningMeta;
  grounding?: GroundingInfo;
  attachments?: Attachment[];
  generatedImages?: GeneratedImage[];
  model3D?: Model3DData;
  generatedVideo?: GeneratedVideo;
  executionSteps?: ExecutionStep[];
  telemetry?: LoopTelemetry;
  isAudioPlaying?: boolean;
  error?: boolean;
}

export interface PersonaCapabilities {
  searchWeb: boolean;
  generateImages: boolean;
  generate3D: boolean;
  generateVideo: boolean;
  codeExecution: boolean;
}

export interface PersonaTemplate {
  id: string;
  title: string;
  prompt: string;
}

export interface Persona {
  id: string;
  name: string;
  tagline: string;
  description: string;
  avatarIcon: string;
  systemInstruction: string;
  defaultSearchGrounding: boolean;
  modelAlias: string;
  temperature: number;
  thinkingLevel?: 'HIGH' | 'LOW' | 'MINIMAL';
  voiceName: string;
  badgeColor?: string;
  isCustom?: boolean;
  capabilities?: PersonaCapabilities;
  fineTuneParams?: {
    baseModel: string;
    datasetSize?: string;
    specialization?: string;
  };
  templates?: PersonaTemplate[];
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  personaId: string;
  messages: ChatMessage[];
  isPinned?: boolean;
  searchGroundingEnabled: boolean;
  modelOverride?: string;
}

export interface VoiceSettings {
  autoReadResponses: boolean;
  preferredVoice: string;
  nativeSpeechEnabled: boolean;
  speechRate: number;
  speechPitch: number;
}

export type HostedSiteType = 'app' | 'chat';

export interface HostedSiteFile {
  name: string;
  content: string;
  language?: string;
}

export interface HostedSite {
  id: string;
  name: string;
  slug: string;
  type: HostedSiteType; // 'app' = Hosted Web App, 'chat' = Public AI Chat Agent
  status: 'live' | 'paused';
  createdAt: number;
  updatedAt: number;
  publicUrl: string;
  description: string;
  // App-specific data
  files?: HostedSiteFile[];
  appLanguage?: string;
  // Chat-specific data
  personaId?: string;
  personaName?: string;
  systemPrompt?: string;
  welcomeMessage?: string;
  allowWebSearch?: boolean;
  allowImageGen?: boolean;
  allowCodeExecution?: boolean;
  // Security & Customization
  requirePassword?: boolean;
  accessPassword?: string;
  themeColor?: 'monochrome' | 'dark-luxury' | 'emerald' | 'cyan-glow';
  customDomain?: string;
  // Live Telemetry
  viewsCount: number;
  interactionsCount: number;
  lastActiveTimestamp?: number;
  // $3/mo XRPL Hosting Subscription & Countdown
  hostingMonthlyPriceUsd: number; // $3.00 USD / month worth of XRP
  hostingExpiresAt: number; // Unix timestamp for 30-day cycle expiration
  lastHostingPaymentDate?: number;
  hostingMemoId: string; // Unique Memo ID directory used for ledger tracking & data fetching
  autoRenewEnabled: boolean; // Auto-renew from connected XRPL wallet
  isHostingSuspended?: boolean; // Blocked if expired and not paid off
  lastHostingTxHash?: string;
  hostingPaymentsHistory?: Array<{
    txHash: string;
    xrpAmount: number;
    usdValue: number;
    timestamp: number;
    memoId: string;
  }>;
}

export type AppViewMode = 'chat' | 'appStudio' | 'hosted' | 'billing' | 'personas' | 'mcp' | 'analytics' | 'about';

export interface XRPLWalletState {
  address: string;
  seed?: string;
  totalXrp: number;
  reserveXrp: number; // 1 XRP default reserve on XRPL Mainnet
  activeXrp: number; // Spendable = max(0, totalXrp - reserveXrp)
  sequence?: number;
  isConnected: boolean;
  network: 'mainnet' | 'testnet';
  lastSynced: number;
}

export interface XRPLPaymentRecord {
  id: string;
  txHash: string;
  memoId: string; // Unique Invoice / Memo ID
  sourceAddress: string;
  destinationAddress: string;
  xrpAmount: number;
  xrpDrops: string;
  xrpPriceUsd: number;
  usdValue: number;
  creditsAdded: number;
  packageId: string;
  packageName: string;
  timestamp: number;
  status: 'validated' | 'pending' | 'failed';
  ledgerIndex?: number;
  feeXrp?: number;
  explorerUrl?: string;
}

export interface XRPLFeeWalletConfig {
  destinationAddress: string;
  network: 'mainnet' | 'testnet';
  defaultServer: string;
}



