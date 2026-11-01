import { ChatSession, Persona, VoiceSettings, HostedSite, XRPLWalletState, XRPLPaymentRecord, XRPLFeeWalletConfig } from '../types';
import { PRESET_PERSONAS } from '../data/personas';

const SESSIONS_KEY = 'aix_alpha_sessions_v1';
const PERSONAS_KEY = 'aix_alpha_personas_v1';
const VOICE_SETTINGS_KEY = 'aix_alpha_voice_settings_v1';
const THEME_KEY = 'aix_alpha_theme_v1';
const HOSTED_SITES_KEY = 'aix_alpha_hosted_sites_v1';
const XRPL_WALLET_KEY = 'aix_alpha_xrpl_wallet_v1';
const XRPL_PAYMENTS_KEY = 'aix_alpha_xrpl_payments_v1';
const XRPL_CONFIG_KEY = 'aix_alpha_xrpl_config_v1';

export const DEFAULT_FEE_WALLET: XRPLFeeWalletConfig = {
  destinationAddress: 'rEb8TK3gBgk5auZkwc6sHnwrGVJH8DuaLh', // AIX Alpha Official XRPL Mainnet Treasury
  network: 'mainnet',
  defaultServer: 'https://xrplcluster.com',
};

export const DEFAULT_HOSTED_SITES: HostedSite[] = [
  {
    id: 'site_app_quantum_calc',
    name: 'Quantum Matrix Visualizer & Audio Synth',
    slug: 'quantum-matrix-audio',
    type: 'app',
    status: 'live',
    createdAt: Date.now() - 3600000 * 24 * 2,
    updatedAt: Date.now() - 3600000 * 4,
    publicUrl: 'https://ais-pre-ip4xgywxvjo2iie24gvh5r-29808136185.us-east1.run.app/?app=quantum-matrix-audio',
    description: 'Interactive HTML5 Canvas + Web Audio API synthesizer with live particle physics matrix.',
    appLanguage: 'html',
    hostingMonthlyPriceUsd: 3.00,
    hostingExpiresAt: Date.now() + 1000 * 60 * 60 * 24 * 28, // 28 days remaining in current cycle
    lastHostingPaymentDate: Date.now() - 1000 * 60 * 60 * 24 * 2,
    hostingMemoId: 'HOST-QUANTUMMA-0928A',
    autoRenewEnabled: true,
    isHostingSuspended: false,
    files: [
      {
        name: 'index.html',
        language: 'html',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Quantum Matrix Visualizer</title>
  <style>
    body { margin: 0; background: #000; color: #fff; font-family: monospace; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; overflow: hidden; }
    h1 { margin: 0 0 10px 0; font-size: 1.5rem; letter-spacing: 2px; color: #10b981; }
    p { margin: 0 0 20px 0; color: #71717a; font-size: 0.85rem; }
    canvas { border: 1px solid #27272a; border-radius: 12px; background: #09090b; box-shadow: 0 0 30px rgba(16,185,129,0.15); }
    .controls { margin-top: 15px; display: flex; gap: 10px; }
    button { background: #18181b; color: #fff; border: 1px solid #3f3f46; padding: 8px 16px; border-radius: 8px; font-family: monospace; cursor: pointer; transition: all 0.2s; }
    button:hover { background: #27272a; border-color: #10b981; }
  </style>
</head>
<body>
  <h1>QUANTUM MATRIX v2.4</h1>
  <p>LIVE HOSTED INTERACTIVE WEB APP // AIX SUITE</p>
  <canvas id="c" width="480" height="280"></canvas>
  <div class="controls">
    <button onclick="burst()">⚡ PULSE WAVE</button>
    <button onclick="toggleColor()">🎨 SHIFT PALETTE</button>
  </div>
  <script>
    const c = document.getElementById('c');
    const ctx = c.getContext('2d');
    let particles = [];
    let hue = 160;
    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * c.width,
        y: Math.random() * c.height,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        radius: Math.random() * 3 + 1
      });
    }
    function draw() {
      ctx.fillStyle = 'rgba(9, 9, 11, 0.2)';
      ctx.fillRect(0, 0, c.width, c.height);
      particles.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > c.width) p.vx *= -1;
        if (p.y < 0 || p.y > c.height) p.vy *= -1;
        ctx.fillStyle = 'hsl(' + (hue + i * 2) + ', 80%, 60%)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      });
      requestAnimationFrame(draw);
    }
    draw();
    function burst() {
      particles.forEach(p => { p.vx = (Math.random() - 0.5) * 8; p.vy = (Math.random() - 0.5) * 8; });
    }
    function toggleColor() { hue = (hue + 60) % 360; }
  </script>
</body>
</html>`
      }
    ],
    themeColor: 'emerald',
    viewsCount: 1420,
    interactionsCount: 890,
    lastActiveTimestamp: Date.now() - 1000 * 60 * 12
  },
  {
    id: 'site_chat_executive_agent',
    name: 'Executive AI Consulting & Research Portal',
    slug: 'executive-ai-portal',
    type: 'chat',
    status: 'live',
    createdAt: Date.now() - 3600000 * 24 * 5,
    updatedAt: Date.now() - 3600000 * 1,
    publicUrl: 'https://ais-pre-ip4xgywxvjo2iie24gvh5r-29808136185.us-east1.run.app/?portal=executive-ai-portal',
    description: 'Autonomous cognitive executive agent with real-time web search grounding, financial analysis & strategic advising.',
    hostingMonthlyPriceUsd: 3.00,
    hostingExpiresAt: Date.now() + 1000 * 60 * 60 * 24 * 25, // 25 days remaining
    lastHostingPaymentDate: Date.now() - 1000 * 60 * 60 * 24 * 5,
    hostingMemoId: 'HOST-EXECUTIV-8199C',
    autoRenewEnabled: true,
    isHostingSuspended: false,
    personaId: 'aix-alpha-v3',
    personaName: 'AIX Alpha Quantum LE',
    systemPrompt: 'You are an autonomous senior executive research advisor equipped with quantum reasoning, market analysis, and web search verification.',
    welcomeMessage: 'Welcome to the Executive Research Portal. How can I assist your team today?',
    allowWebSearch: true,
    allowImageGen: true,
    allowCodeExecution: true,
    requirePassword: false,
    themeColor: 'monochrome',
    viewsCount: 3840,
    interactionsCount: 2150,
    lastActiveTimestamp: Date.now() - 1000 * 60 * 3
  }
];

export const getStoredHostedSites = (): HostedSite[] => {
  try {
    const raw = localStorage.getItem(HOSTED_SITES_KEY);
    if (!raw) {
      localStorage.setItem(HOSTED_SITES_KEY, JSON.stringify(DEFAULT_HOSTED_SITES));
      return DEFAULT_HOSTED_SITES;
    }
    const parsed: HostedSite[] = JSON.parse(raw);
    const now = Date.now();
    // Normalize and ensure all hosting subscription fields exist
    const normalized = parsed.map((site) => {
      const expiresAt = site.hostingExpiresAt || (now + 1000 * 60 * 60 * 24 * 30);
      const isSuspended = now > expiresAt;
      return {
        ...site,
        hostingMonthlyPriceUsd: site.hostingMonthlyPriceUsd || 3.00,
        hostingExpiresAt: expiresAt,
        lastHostingPaymentDate: site.lastHostingPaymentDate || (site.createdAt || now),
        hostingMemoId: site.hostingMemoId || `HOST-${site.slug.toUpperCase().slice(0, 10)}-${site.id.slice(-5)}`,
        autoRenewEnabled: site.autoRenewEnabled !== undefined ? site.autoRenewEnabled : true,
        isHostingSuspended: isSuspended,
      };
    });
    return normalized.length > 0 ? normalized : DEFAULT_HOSTED_SITES;
  } catch (e) {
    console.error("Failed to load hosted sites:", e);
    return DEFAULT_HOSTED_SITES;
  }
};

export const renewHostedSiteSubscription = (
  siteId: string,
  daysToAdd: number = 30,
  paymentInfo?: { txHash: string; xrpAmount: number; usdValue: number; memoId: string }
): HostedSite[] => {
  try {
    const sites = getStoredHostedSites();
    const now = Date.now();
    const updated = sites.map((site) => {
      if (site.id === siteId) {
        // If expired, base expiry on now, else add to existing future expiry
        const baseTime = site.hostingExpiresAt && site.hostingExpiresAt > now ? site.hostingExpiresAt : now;
        const newExpiry = baseTime + 1000 * 60 * 60 * 24 * daysToAdd;
        const paymentsHistory = site.hostingPaymentsHistory || [];
        if (paymentInfo) {
          paymentsHistory.unshift({
            txHash: paymentInfo.txHash,
            xrpAmount: paymentInfo.xrpAmount,
            usdValue: paymentInfo.usdValue,
            timestamp: now,
            memoId: paymentInfo.memoId,
          });
        }
        return {
          ...site,
          hostingExpiresAt: newExpiry,
          lastHostingPaymentDate: now,
          lastHostingTxHash: paymentInfo?.txHash || site.lastHostingTxHash,
          isHostingSuspended: false,
          hostingPaymentsHistory: paymentsHistory,
          updatedAt: now,
        };
      }
      return site;
    });
    saveStoredHostedSites(updated);
    return updated;
  } catch (e) {
    console.error("Failed to renew hosted site:", e);
    return getStoredHostedSites();
  }
};

export const toggleSiteAutoRenew = (siteId: string, enabled: boolean): HostedSite[] => {
  try {
    const sites = getStoredHostedSites();
    const updated = sites.map((s) => (s.id === siteId ? { ...s, autoRenewEnabled: enabled } : s));
    saveStoredHostedSites(updated);
    return updated;
  } catch (e) {
    console.error("Failed to toggle auto renew:", e);
    return getStoredHostedSites();
  }
};

export const saveStoredHostedSites = (sites: HostedSite[]): void => {
  try {
    localStorage.setItem(HOSTED_SITES_KEY, JSON.stringify(sites));
  } catch (e) {
    console.error("Failed to save hosted sites:", e);
  }
};

export const saveSingleHostedSite = (site: HostedSite): HostedSite[] => {
  try {
    const current = getStoredHostedSites();
    const index = current.findIndex((s) => s.id === site.id || s.slug === site.slug);
    let updated: HostedSite[];
    if (index >= 0) {
      updated = [...current];
      updated[index] = { ...site, updatedAt: Date.now() };
    } else {
      updated = [{ ...site, createdAt: Date.now(), updatedAt: Date.now() }, ...current];
    }
    saveStoredHostedSites(updated);
    return updated;
  } catch (e) {
    console.error("Failed to save single hosted site:", e);
    return getStoredHostedSites();
  }
};

export const deleteStoredHostedSite = (siteId: string): HostedSite[] => {
  try {
    const current = getStoredHostedSites();
    const updated = current.filter((s) => s.id !== siteId);
    saveStoredHostedSites(updated);
    return updated;
  } catch (e) {
    console.error("Failed to delete hosted site:", e);
    return getStoredHostedSites();
  }
};


export const getStoredSessions = (): ChatSession[] => {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to load sessions from storage:", e);
    return [];
  }
};

export const saveStoredSessions = (sessions: ChatSession[]): void => {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  } catch (e) {
    console.error("Failed to save sessions to storage:", e);
  }
};

export const getStoredPersonas = (): Persona[] => {
  try {
    const raw = localStorage.getItem(PERSONAS_KEY);
    const customPersonas: Persona[] = raw ? JSON.parse(raw) : [];
    return [...PRESET_PERSONAS, ...customPersonas];
  } catch (e) {
    return PRESET_PERSONAS;
  }
};

export const saveCustomPersona = (persona: Persona): Persona[] => {
  try {
    const raw = localStorage.getItem(PERSONAS_KEY);
    const existing: Persona[] = raw ? JSON.parse(raw) : [];
    const index = existing.findIndex((p) => p.id === persona.id);
    let updated: Persona[];
    if (index >= 0) {
      updated = [...existing];
      updated[index] = persona;
    } else {
      updated = [persona, ...existing];
    }
    localStorage.setItem(PERSONAS_KEY, JSON.stringify(updated));
    return [...PRESET_PERSONAS, ...updated];
  } catch (e) {
    console.error("Failed to save custom persona:", e);
    return PRESET_PERSONAS;
  }
};

export const deleteCustomPersona = (personaId: string): Persona[] => {
  try {
    const raw = localStorage.getItem(PERSONAS_KEY);
    const existing: Persona[] = raw ? JSON.parse(raw) : [];
    const updated = existing.filter((p) => p.id !== personaId);
    localStorage.setItem(PERSONAS_KEY, JSON.stringify(updated));
    return [...PRESET_PERSONAS, ...updated];
  } catch (e) {
    console.error("Failed to delete custom persona:", e);
    return PRESET_PERSONAS;
  }
};

export const exportPersonasAsJSON = (personas: Persona[]): void => {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(personas, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `aix_personas_models_${Date.now()}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
};

export const getStoredVoiceSettings = (): VoiceSettings => {
  try {
    const raw = localStorage.getItem(VOICE_SETTINGS_KEY);
    if (!raw) {
      return {
        autoReadResponses: false,
        preferredVoice: 'Kore',
        nativeSpeechEnabled: true,
        speechRate: 1.0,
        speechPitch: 1.0,
      };
    }
    return JSON.parse(raw);
  } catch (e) {
    return {
      autoReadResponses: false,
      preferredVoice: 'Kore',
      nativeSpeechEnabled: true,
      speechRate: 1.0,
      speechPitch: 1.0,
    };
  }
};

export const saveStoredVoiceSettings = (settings: VoiceSettings): void => {
  try {
    localStorage.setItem(VOICE_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error("Failed to save voice settings:", e);
  }
};

export const getStoredTheme = (): 'dark' | 'light' => {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (raw === 'light' || raw === 'dark') return raw;
    return 'dark'; // Default to dark mode for high-tech aesthetic
  } catch (e) {
    return 'dark';
  }
};

export const saveStoredTheme = (theme: 'dark' | 'light'): void => {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (e) {
    console.error("Failed to save theme:", e);
  }
};

export const exportSessionAsJSON = (session: ChatSession) => {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(session, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `aix_chat_${session.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
};

export const exportSessionAsMarkdown = (session: ChatSession) => {
  let md = `# ${session.title}\n*Exported from AIX Alpha Chat on ${new Date(session.createdAt).toLocaleDateString()}*\n\n---\n\n`;
  for (const m of session.messages) {
    const roleTitle = m.role === 'user' ? '👤 User' : '🤖 AIX Alpha';
    md += `### ${roleTitle} (${new Date(m.timestamp).toLocaleTimeString()})\n\n${m.content}\n\n`;
    if (m.grounding?.sources && m.grounding.sources.length > 0) {
      md += `**Sources:**\n`;
      for (const s of m.grounding.sources) {
        md += `- [${s.title}](${s.url})\n`;
      }
      md += `\n`;
    }
    md += `---\n\n`;
  }

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `aix_chat_${session.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`);
  document.body.appendChild(link);
  link.click();
  link.remove();
};

export const exportAllSessionsAsJSON = (sessions: ChatSession[]) => {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(sessions, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `aix_all_chats_backup_${Date.now()}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
};

/* XRPL Local Machine Wallet Persistence */
export const getStoredXRPLWallet = (): XRPLWalletState | null => {
  try {
    const raw = localStorage.getItem(XRPL_WALLET_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to load stored XRPL wallet:", e);
    return null;
  }
};

export const saveStoredXRPLWallet = (wallet: XRPLWalletState | null): void => {
  try {
    if (!wallet) {
      localStorage.removeItem(XRPL_WALLET_KEY);
    } else {
      localStorage.setItem(XRPL_WALLET_KEY, JSON.stringify(wallet));
    }
  } catch (e) {
    console.error("Failed to save XRPL wallet:", e);
  }
};

/* XRPL Payment & Invoice Records Persistence */
export const getStoredPaymentRecords = (): XRPLPaymentRecord[] => {
  try {
    const raw = localStorage.getItem(XRPL_PAYMENTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to load payment records:", e);
    return [];
  }
};

export const saveStoredPaymentRecords = (records: XRPLPaymentRecord[]): void => {
  try {
    localStorage.setItem(XRPL_PAYMENTS_KEY, JSON.stringify(records));
  } catch (e) {
    console.error("Failed to save payment records:", e);
  }
};

export const addStoredPaymentRecord = (record: XRPLPaymentRecord): XRPLPaymentRecord[] => {
  try {
    const existing = getStoredPaymentRecords();
    const updated = [record, ...existing.filter((r) => r.id !== record.id && r.txHash !== record.txHash)];
    saveStoredPaymentRecords(updated);
    return updated;
  } catch (e) {
    console.error("Failed to add payment record:", e);
    return getStoredPaymentRecords();
  }
};

/* Fee Wallet Config */
export const getStoredFeeWalletConfig = (): XRPLFeeWalletConfig => {
  try {
    const raw = localStorage.getItem(XRPL_CONFIG_KEY);
    if (!raw) return DEFAULT_FEE_WALLET;
    return { ...DEFAULT_FEE_WALLET, ...JSON.parse(raw) };
  } catch (e) {
    return DEFAULT_FEE_WALLET;
  }
};

export const saveStoredFeeWalletConfig = (config: XRPLFeeWalletConfig): void => {
  try {
    localStorage.setItem(XRPL_CONFIG_KEY, JSON.stringify(config));
  } catch (e) {
    console.error("Failed to save fee wallet config:", e);
  }
};

/* Export Payment History as CSV */
export const exportPaymentsAsCSV = (records: XRPLPaymentRecord[]) => {
  const headers = ['Date', 'Memo ID', 'Package', 'Credits', 'XRP Amount', 'XRP Price USD', 'USD Total', 'Status', 'TX Hash', 'Source Address', 'Destination Address'];
  const rows = records.map((r) => [
    `"${new Date(r.timestamp).toISOString()}"`,
    `"${r.memoId}"`,
    `"${r.packageName}"`,
    r.creditsAdded,
    r.xrpAmount,
    r.xrpPriceUsd,
    r.usdValue,
    `"${r.status}"`,
    `"${r.txHash}"`,
    `"${r.sourceAddress}"`,
    `"${r.destinationAddress}"`,
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `aix_xrpl_billing_ledger_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
};

/* Export Payment History as JSON */
export const exportPaymentsAsJSON = (records: XRPLPaymentRecord[]) => {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(records, null, 2));
  const link = document.createElement('a');
  link.setAttribute('href', dataStr);
  link.setAttribute('download', `aix_xrpl_billing_ledger_${Date.now()}.json`);
  document.body.appendChild(link);
  link.click();
  link.remove();
};

