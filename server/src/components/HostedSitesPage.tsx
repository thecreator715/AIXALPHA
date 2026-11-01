import React, { useState, useEffect } from 'react';
import {
  Globe,
  Plus,
  Terminal,
  MessageSquare,
  Copy,
  Check,
  ExternalLink,
  Share2,
  RefreshCw,
  Trash2,
  Settings,
  Shield,
  Eye,
  Activity,
  Code2,
  Sparkles,
  Sliders,
  ChevronRight,
  Search,
  Filter,
  ArrowUpRight,
  QrCode,
  X,
  Play,
  Clock,
  Layers,
  CheckCircle2,
  Download,
  AlertCircle,
  Zap,
  Lock,
  Wallet,
  ShieldAlert,
  ArrowDownLeft,
  Calendar,
  CreditCard,
  FileText,
} from 'lucide-react';
import { HostedSite, HostedSiteType, Persona, HostedSiteFile, XRPLWalletState } from '../types';
import {
  getStoredHostedSites,
  saveSingleHostedSite,
  deleteStoredHostedSite,
  saveStoredHostedSites,
  renewHostedSiteSubscription,
  toggleSiteAutoRenew,
  getStoredXRPLWallet,
  saveStoredXRPLWallet,
  addStoredPaymentRecord,
  getStoredFeeWalletConfig,
} from '../utils/storage';
import {
  fetchRealXrpPriceUsd,
  queryAccountBalances,
  settleHostingPayment,
  generateQRCodeDataUrl,
  fetchSiteHostingTransactions,
  generateSiteHostingMemoId,
} from '../utils/xrplService';
import { WalletTransferModal } from './WalletTransferModal';

interface HostedSitesPageProps {
  onBackToChat: () => void;
  onNavigateToAppStudio: (code?: string, language?: string) => void;
  personas: Persona[];
  activePersona: Persona;
  currentAppStudioFiles?: { name: string; content: string; language?: string }[];
}

export const HostedSitesPage: React.FC<HostedSitesPageProps> = ({
  onBackToChat,
  onNavigateToAppStudio,
  personas,
  activePersona,
  currentAppStudioFiles = [],
}) => {
  const [sites, setSites] = useState<HostedSite[]>(() => getStoredHostedSites());
  const [filterType, setFilterType] = useState<'all' | 'app' | 'chat'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [now, setNow] = useState<number>(Date.now());

  // Wallet & Pricing State
  const [wallet, setWallet] = useState<XRPLWalletState | null>(() => getStoredXRPLWallet());
  const [xrpPrice, setXrpPrice] = useState<{ priceUsd: number; source: string }>({
    priceUsd: 2.48,
    source: 'Live XRPL Index',
  });
  const feeConfig = getStoredFeeWalletConfig();

  // Modals
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
  const [previewSite, setPreviewSite] = useState<HostedSite | null>(null);
  const [shareModalSite, setShareModalSite] = useState<HostedSite | null>(null);
  const [settleModalSite, setSettleModalSite] = useState<HostedSite | null>(null);
  const [ledgerDirectorySite, setLedgerDirectorySite] = useState<HostedSite | null>(null);
  const [ledgerTxs, setLedgerTxs] = useState<any[]>([]);
  const [isLoadingLedgerTxs, setIsLoadingLedgerTxs] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Settlement modal state
  const [settleDurationMonths, setSettleDurationMonths] = useState<number>(1);
  const [isSettling, setIsSettling] = useState(false);
  const [settleError, setSettleError] = useState<string | null>(null);
  const [settleQrDataUrl, setSettleQrDataUrl] = useState<string>('');

  // Wallet transfer modal state
  const [isWalletTransferOpen, setIsWalletTransferOpen] = useState(false);
  const [walletTransferTab, setWalletTransferTab] = useState<'send' | 'receive'>('receive');

  // Deploy wizard state
  const [deployType, setDeployType] = useState<HostedSiteType>('app');
  const [deployName, setDeployName] = useState('');
  const [deploySlug, setDeploySlug] = useState('');
  const [deployDesc, setDeployDesc] = useState('');
  const [deployTheme, setDeployTheme] = useState<'monochrome' | 'dark-luxury' | 'emerald' | 'cyan-glow'>('monochrome');

  // Chat deploy state
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>(activePersona.id);
  const [chatSystemPrompt, setChatSystemPrompt] = useState<string>(activePersona.systemInstruction || '');
  const [chatWelcomeMsg, setChatWelcomeMsg] = useState<string>('Welcome! How can I assist you today?');
  const [chatAllowSearch, setChatAllowSearch] = useState<boolean>(true);
  const [chatAllowImageGen, setChatAllowImageGen] = useState<boolean>(true);
  const [chatAllowCode, setChatAllowCode] = useState<boolean>(true);
  const [chatRequirePass, setChatRequirePass] = useState<boolean>(false);
  const [chatPass, setChatPass] = useState<string>('');

  // App deploy state
  const [appSourceMode, setAppSourceMode] = useState<'current_studio' | 'custom_html'>('current_studio');
  const [customHtmlCode, setCustomHtmlCode] = useState<string>(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Hosted App</title>
  <style>
    body { margin:0; background:#050505; color:#fff; font-family:sans-serif; display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; }
    h1 { color:#10b981; font-family:monospace; }
    .card { background:#111; border:1px solid #333; padding:24px; border-radius:12px; text-align:center; max-width:400px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>APP HOSTED LIVE 🚀</h1>
    <p>Powered by AIX Alpha Deployment Engine</p>
  </div>
</body>
</html>`);

  // Interval timer for real-time countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch live XRP price and refresh wallet
  useEffect(() => {
    loadPrice();
    if (wallet?.address) {
      refreshWalletBalance(wallet.address);
    }
  }, []);

  const loadPrice = async () => {
    try {
      const p = await fetchRealXrpPriceUsd();
      setXrpPrice({ priceUsd: p.priceUsd, source: p.source });
    } catch (e) {
      console.warn('Price load failed:', e);
    }
  };

  const refreshWalletBalance = async (address: string) => {
    try {
      const b = await queryAccountBalances(address);
      if (wallet) {
        const updated: XRPLWalletState = {
          ...wallet,
          totalXrp: b.totalXrp,
          activeXrp: b.activeXrp,
          sequence: b.sequence,
          lastSynced: Date.now(),
        };
        setWallet(updated);
        saveStoredXRPLWallet(updated);
      }
    } catch (e) {
      console.warn('Balance refresh failed:', e);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleCopyLink = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    showToast('Copied link to clipboard!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Convert USD to XRP
  const calculateXrpAmount = (usd: number): number => {
    const p = xrpPrice.priceUsd > 0 ? xrpPrice.priceUsd : 2.48;
    return parseFloat((usd / p).toFixed(4));
  };

  const getMonthlyXrpCost = (): number => {
    return calculateXrpAmount(3.00);
  };

  // Format Countdown Timer
  const formatCountdown = (expiresAt?: number) => {
    if (!expiresAt) return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true, text: 'EXPIRED' };
    const diff = expiresAt - now;
    if (diff <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true, text: 'EXPIRED (PAST DUE)' };
    }
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return {
      days,
      hours,
      minutes,
      seconds,
      isExpired: false,
      text: `${days}d ${hours}h ${minutes}m ${seconds}s`,
    };
  };

  // Handle 1-Click Renew or Settle $3/mo Hosting
  const handleExecuteHostingSettlement = async (site: HostedSite, months: number = 1) => {
    setSettleError(null);
    const usdTotal = 3.00 * months;
    const xrpTotal = calculateXrpAmount(usdTotal);

    if (!wallet) {
      setSettleError('Please connect an XRPL wallet to execute on-chain hosting settlement.');
      return;
    }

    if (!wallet.seed) {
      setSettleError('Wallet is connected in read-only mode. Connect with XRPL Secret Seed to sign and broadcast automatically.');
      return;
    }

    if (wallet.activeXrp < xrpTotal) {
      setSettleError(
        `Insufficient active spendable XRP balance. Required: ${xrpTotal} XRP, Available: ${wallet.activeXrp.toFixed(4)} XRP (1.0 XRP base reserve preserved).`
      );
      return;
    }

    setIsSettling(true);
    try {
      const siteMemoId = site.hostingMemoId || generateSiteHostingMemoId(site.slug, site.id);
      const res = await settleHostingPayment({
        seed: wallet.seed,
        destinationAddress: feeConfig.destinationAddress,
        amountXrp: xrpTotal,
        siteMemoId,
        siteName: site.name,
      });

      const updatedSites = renewHostedSiteSubscription(site.id, months * 30, {
        txHash: res.txHash,
        xrpAmount: xrpTotal,
        usdValue: usdTotal,
        memoId: siteMemoId,
      });

      // Record in local billing history
      addStoredPaymentRecord({
        id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: Date.now(),
        packageId: `HOSTING_${months}M`,
        packageName: `$3/mo Hosting Renewal (${months} Month${months > 1 ? 's' : ''}) - ${site.name}`,
        creditsAdded: 0,
        usdValue: usdTotal,
        xrpPriceUsd: xrpPrice.priceUsd,
        xrpAmount: xrpTotal,
        xrpDrops: Math.round(xrpTotal * 1000000).toString(),
        txHash: res.txHash,
        ledgerIndex: res.ledgerIndex,
        memoId: siteMemoId,
        sourceAddress: wallet.address,
        destinationAddress: feeConfig.destinationAddress,
        feeXrp: res.feeXrp,
        status: 'validated',
      });

      setSites(updatedSites);
      await refreshWalletBalance(wallet.address);
      setSettleModalSite(null);
      showToast(`🎉 Hosting renewed for "${site.name}"! +${months * 30} days on XRPL Mainnet.`);
    } catch (err: any) {
      console.error('Hosting settlement failed:', err);
      setSettleError(err.message || 'Failed to submit hosting settlement on XRPL.');
    } finally {
      setIsSettling(false);
    }
  };

  const handleOpenSettleModal = async (site: HostedSite) => {
    setSettleModalSite(site);
    setSettleError(null);
    setSettleDurationMonths(1);
    const memoId = site.hostingMemoId || generateSiteHostingMemoId(site.slug, site.id);
    const qr = await generateQRCodeDataUrl(feeConfig.destinationAddress, {
      width: 240,
      darkColor: '#000000',
      lightColor: '#ffffff',
    });
    setSettleQrDataUrl(qr);
  };

  const handleOpenLedgerDirectory = async (site: HostedSite) => {
    setLedgerDirectorySite(site);
    setIsLoadingLedgerTxs(true);
    const memoId = site.hostingMemoId || generateSiteHostingMemoId(site.slug, site.id);
    try {
      const txs = await fetchSiteHostingTransactions(feeConfig.destinationAddress, memoId);
      setLedgerTxs(txs);
    } catch (e) {
      console.warn('Failed fetching ledger transactions:', e);
      setLedgerTxs([]);
    } finally {
      setIsLoadingLedgerTxs(false);
    }
  };

  const handleToggleAutoRenew = (site: HostedSite) => {
    const nextState = !site.autoRenewEnabled;
    const updated = toggleSiteAutoRenew(site.id, nextState);
    setSites(updated);
    showToast(`Auto-pay from connected wallet ${nextState ? 'ENABLED' : 'DISABLED'} for "${site.name}".`);
  };

  const handleOpenDeployModal = (type: HostedSiteType = 'app') => {
    setDeployType(type);
    setDeployName(type === 'app' ? 'New Web Application' : `${activePersona.name} Customer Portal`);
    const initialSlug = (type === 'app' ? 'app-' : 'chat-') + Math.random().toString(36).substring(2, 7);
    setDeploySlug(initialSlug);
    setDeployDesc(
      type === 'app'
        ? 'High-performance standalone application published on global edge.'
        : 'Autonomous AI assistant with real-time web grounding and intelligent reasoning.'
    );
    setIsDeployModalOpen(true);
  };

  const handleQuickLiveUpdate = (site: HostedSite) => {
    const nowTs = Date.now();
    let updatedFiles = site.files;
    if (site.type === 'app' && currentAppStudioFiles && currentAppStudioFiles.length > 0) {
      updatedFiles = currentAppStudioFiles.map((f) => ({
        name: f.name,
        content: f.content,
        language: f.language || 'html',
      }));
    }

    const updatedSite: HostedSite = {
      ...site,
      files: updatedFiles,
      updatedAt: nowTs,
      status: 'live',
      viewsCount: (site.viewsCount || 0) + 1,
    };

    const updated = saveSingleHostedSite(updatedSite);
    setSites(updated);
    showToast(`🔄 Re-posted & updated "${site.name}" live version!`);
  };

  const handleToggleStatus = (site: HostedSite) => {
    const nextStatus = site.status === 'live' ? 'paused' : 'live';
    const updatedSite: HostedSite = {
      ...site,
      status: nextStatus,
      updatedAt: Date.now(),
    };
    const updated = saveSingleHostedSite(updatedSite);
    setSites(updated);
    showToast(`Site status changed to ${nextStatus.toUpperCase()}`);
  };

  const handleDelete = (siteId: string, name: string) => {
    if (window.confirm(`Are you sure you want to remove hosted site "${name}"?`)) {
      const updated = deleteStoredHostedSite(siteId);
      setSites(updated);
      showToast(`Deleted ${name}`);
    }
  };

  const handleCreateDeployment = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSlug = deploySlug.toLowerCase().trim().replace(/[^a-z0-9-_]/g, '') || 'app-' + Date.now();
    const newId = 'site_' + deployType + '_' + Math.random().toString(36).substring(2, 9);
    const publicUrl = `https://ais-pre-ip4xgywxvjo2iie24gvh5r-29808136185.us-east1.run.app/?${deployType === 'app' ? 'app' : 'portal'}=${cleanSlug}`;
    const initialMemoId = generateSiteHostingMemoId(cleanSlug, newId);

    let siteFiles: HostedSiteFile[] = [];
    if (deployType === 'app') {
      if (appSourceMode === 'current_studio' && currentAppStudioFiles && currentAppStudioFiles.length > 0) {
        siteFiles = currentAppStudioFiles.map((f) => ({
          name: f.name,
          content: f.content,
          language: f.language || 'html',
        }));
      } else {
        siteFiles = [{ name: 'index.html', language: 'html', content: customHtmlCode }];
      }
    }

    const newSite: HostedSite = {
      id: newId,
      name: deployName.trim() || 'Live Deployment',
      slug: cleanSlug,
      type: deployType,
      status: 'live',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      publicUrl,
      description: deployDesc.trim() || 'Standalone hosted endpoint on AIX Suite.',
      themeColor: deployTheme,
      viewsCount: 1,
      interactionsCount: 0,
      lastActiveTimestamp: Date.now(),
      hostingMonthlyPriceUsd: 3.00,
      hostingExpiresAt: Date.now() + 1000 * 60 * 60 * 24 * 30, // 30 days initial cycle
      lastHostingPaymentDate: Date.now(),
      hostingMemoId: initialMemoId,
      autoRenewEnabled: true,
      isHostingSuspended: false,
      files: siteFiles,
      personaId: deployType === 'chat' ? selectedPersonaId : undefined,
      personaName: deployType === 'chat' ? personas.find((p) => p.id === selectedPersonaId)?.name : undefined,
      systemPrompt: deployType === 'chat' ? chatSystemPrompt : undefined,
      welcomeMessage: deployType === 'chat' ? chatWelcomeMsg : undefined,
      allowWebSearch: deployType === 'chat' ? chatAllowSearch : undefined,
      allowImageGen: deployType === 'chat' ? chatAllowImageGen : undefined,
      allowCodeExecution: deployType === 'chat' ? chatAllowCode : undefined,
      requirePassword: deployType === 'chat' ? chatRequirePass : undefined,
      accessPassword: deployType === 'chat' && chatRequirePass ? chatPass : undefined,
    };

    const updated = saveSingleHostedSite(newSite);
    setSites(updated);
    setIsDeployModalOpen(false);
    showToast(`🚀 "${newSite.name}" deployed live with $3/mo hosting lease & Memo ID: ${initialMemoId}`);
  };

  // Filter sites
  const filteredSites = sites.filter((s) => {
    const matchesType = filterType === 'all' || s.type === filterType;
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.hostingMemoId && s.hostingMemoId.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesType && matchesSearch;
  });

  const totalViews = sites.reduce((acc, s) => acc + (s.viewsCount || 0), 0);
  const liveCount = sites.filter((s) => s.status === 'live' && !(s.hostingExpiresAt && now > s.hostingExpiresAt)).length;
  const suspendedCount = sites.filter((s) => s.isHostingSuspended || (s.hostingExpiresAt && now > s.hostingExpiresAt)).length;
  const monthlyCostXrp = getMonthlyXrpCost();

  return (
    <div className="flex-1 bg-black text-white font-sans flex flex-col min-h-[100dvh] overflow-y-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-950 border border-emerald-700 text-emerald-200 px-4 py-3 rounded-xl text-xs font-mono shadow-2xl flex items-center gap-2.5 animate-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Container */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Top Header & Intro */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-zinc-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 mb-1">
              <Globe className="w-4 h-4 text-emerald-400" />
              <span>EDGE DEPLOYMENT & $3/MO XRPL HOSTING</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2">
              Hosted Sites & Live Portals
            </h1>
            <p className="text-sm text-zinc-400 mt-1 max-w-2xl">
              Publish Web Apps and AI Chat Portals on global CDN. Powered by <strong className="text-emerald-400">$3/month worth of XRP</strong> on-chain subscriptions with automatic countdowns, memo directories, and auto-renew from your connected wallet.
            </p>
          </div>

          {/* Wallet Header & Quick Actions */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {wallet ? (
              <div className="p-2 px-3 rounded-xl bg-zinc-950 border border-zinc-800 font-mono text-xs flex items-center gap-3">
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase block">Connected Wallet</span>
                  <span className="text-emerald-400 font-bold">{wallet.activeXrp.toFixed(3)} XRP Active</span>
                </div>
                <button
                  onClick={() => {
                    setWalletTransferTab('receive');
                    setIsWalletTransferOpen(true);
                  }}
                  className="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg border border-zinc-700"
                  title="Receive XRP / QR Code"
                >
                  <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setWalletTransferTab('receive');
                  setIsWalletTransferOpen(true);
                }}
                className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-mono text-zinc-300 flex items-center gap-1.5"
              >
                <Wallet className="w-3.5 h-3.5 text-blue-400" />
                <span>Connect Wallet</span>
              </button>
            )}

            <button
              onClick={() => handleOpenDeployModal('app')}
              className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-white flex items-center gap-2 transition-all shadow-md active:scale-95"
            >
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span>+ Host Web App</span>
            </button>

            <button
              onClick={() => handleOpenDeployModal('chat')}
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-bold flex items-center gap-2 transition-all shadow-lg active:scale-95"
            >
              <MessageSquare className="w-4 h-4" />
              <span>+ Host AI Chat Portal</span>
            </button>
          </div>
        </div>

        {/* Global Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-mono">
              <span>LIVE SITES</span>
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">
              {liveCount} <span className="text-xs text-zinc-500 font-normal">/ {sites.length} total</span>
            </div>
            <p className="text-[11px] text-zinc-500 font-mono">99.99% Edge CDN</p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-mono">
              <span>HOSTING LEASE</span>
              <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-400 tracking-tight">
              $3.00 <span className="text-xs text-zinc-400 font-normal">/ mo ({monthlyCostXrp} XRP)</span>
            </div>
            <p className="text-[11px] text-zinc-500 font-mono">Settled on XRPL Mainnet</p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-mono">
              <span>SUSPENDED / DUE</span>
              <ShieldAlert className={`w-3.5 h-3.5 ${suspendedCount > 0 ? 'text-amber-400' : 'text-zinc-500'}`} />
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">
              {suspendedCount} <span className="text-xs text-zinc-500 font-normal">Sites</span>
            </div>
            <p className="text-[11px] text-zinc-500 font-mono">
              {suspendedCount > 0 ? 'Blocked until renewal' : 'All accounts funded'}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-mono">
              <span>TOTAL VISITS</span>
              <Eye className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">{totalViews.toLocaleString()}</div>
            <p className="text-[11px] text-zinc-500 font-mono">Global edge analytics</p>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          {/* Filter Pills */}
          <div className="flex items-center p-1 bg-zinc-950 rounded-xl border border-zinc-800 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                filterType === 'all'
                  ? 'bg-zinc-800 text-white font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              All Sites ({sites.length})
            </button>
            <button
              onClick={() => setFilterType('app')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                filterType === 'app'
                  ? 'bg-zinc-800 text-white font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span>Web Apps</span>
            </button>
            <button
              onClick={() => setFilterType('chat')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                filterType === 'chat'
                  ? 'bg-zinc-800 text-white font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
              <span>AI Chat Portals</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by site name, slug, or Memo ID..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 font-mono"
            />
          </div>
        </div>

        {/* Sites Grid */}
        {filteredSites.length === 0 ? (
          <div className="py-16 text-center border border-dashed border-zinc-800 rounded-2xl bg-zinc-950/50 space-y-4">
            <Globe className="w-10 h-10 text-zinc-600 mx-auto" />
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-white">No hosted sites found</h3>
              <p className="text-xs text-zinc-500">Deploy a web app or custom AI chat portal to get started.</p>
            </div>
            <button
              onClick={() => handleOpenDeployModal('app')}
              className="px-4 py-2 bg-white text-black text-xs font-bold rounded-xl shadow-md hover:bg-zinc-200"
            >
              Deploy Your First Site
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredSites.map((site) => {
              const countdown = formatCountdown(site.hostingExpiresAt);
              const isOverdue = site.isHostingSuspended || countdown.isExpired;
              const memoId = site.hostingMemoId || generateSiteHostingMemoId(site.slug, site.id);

              return (
                <div
                  key={site.id}
                  className={`bg-zinc-950 border rounded-2xl p-5 shadow-xl transition-all flex flex-col justify-between gap-4 group ${
                    isOverdue
                      ? 'border-amber-700/80 bg-gradient-to-b from-zinc-950 via-zinc-950 to-amber-950/20'
                      : 'border-zinc-800/90 hover:border-zinc-700'
                  }`}
                >
                  {/* Card Top: Badges & Status */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold flex items-center gap-1.5 ${
                            site.type === 'app'
                              ? 'bg-emerald-950 border border-emerald-800 text-emerald-300'
                              : 'bg-purple-950 border border-purple-800 text-purple-300'
                          }`}
                        >
                          {site.type === 'app' ? <Terminal className="w-3 h-3" /> : <MessageSquare className="w-3 h-3" />}
                          <span>{site.type === 'app' ? 'WEB APP' : 'AI CHAT PORTAL'}</span>
                        </span>

                        {isOverdue ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-950 border border-amber-700 text-amber-300 flex items-center gap-1">
                            <ShieldAlert className="w-3 h-3 text-amber-400" />
                            <span>BLOCKED (PAYMENT DUE)</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => handleToggleStatus(site)}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-mono flex items-center gap-1 transition-colors ${
                              site.status === 'live'
                                ? 'bg-zinc-900 border border-zinc-700 text-emerald-400 hover:border-emerald-500'
                                : 'bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-zinc-300'
                            }`}
                            title="Click to toggle Live/Paused state"
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${site.status === 'live' ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
                            <span>{site.status === 'live' ? 'LIVE' : 'PAUSED'}</span>
                          </button>
                        )}
                      </div>

                      {/* Quick Action Icons */}
                      <div className="flex items-center gap-1 text-zinc-400">
                        <button
                          onClick={() => setPreviewSite(site)}
                          className="p-1.5 hover:text-white bg-zinc-900/60 hover:bg-zinc-800 rounded-lg border border-zinc-800 transition-colors"
                          title="Interactive Live Simulator"
                        >
                          <Play className="w-3.5 h-3.5 text-emerald-400" />
                        </button>
                        <button
                          onClick={() => setShareModalSite(site)}
                          className="p-1.5 hover:text-white bg-zinc-900/60 hover:bg-zinc-800 rounded-lg border border-zinc-800 transition-colors"
                          title="Share Options & Embed Code"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(site.id, site.name)}
                          className="p-1.5 hover:text-rose-400 bg-zinc-900/60 hover:bg-zinc-800 rounded-lg border border-zinc-800 transition-colors"
                          title="Delete Deployment"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Title & Description */}
                    <div>
                      <h3 className="text-base font-bold text-white tracking-tight group-hover:text-emerald-400 transition-colors">
                        {site.name}
                      </h3>
                      <p className="text-xs text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                        {site.description}
                      </p>
                    </div>

                    {/* Live URL Pill Box */}
                    <div className="bg-black/90 border border-zinc-800/80 rounded-xl p-2 flex items-center justify-between gap-2 font-mono text-xs">
                      <span className="text-zinc-300 truncate text-[11px] select-all">
                        {site.publicUrl}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleCopyLink(site.publicUrl, site.id)}
                          className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-[10px] rounded-lg border border-zinc-700 flex items-center gap-1 transition-all"
                          title="Copy Live Share Link"
                        >
                          {copiedId === site.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedId === site.id ? 'COPIED' : 'COPY'}</span>
                        </button>

                        <a
                          href={site.publicUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 bg-white text-black hover:bg-zinc-200 rounded-lg transition-all"
                          title="Open in new window"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>

                    {/* $3/MO HOSTING SUBSCRIPTION & COUNTDOWN CARD */}
                    <div className={`p-3.5 rounded-xl font-mono text-xs space-y-2.5 border ${
                      isOverdue
                        ? 'bg-amber-950/40 border-amber-800/80'
                        : 'bg-zinc-900/80 border-zinc-800'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Clock className={`w-3.5 h-3.5 ${isOverdue ? 'text-amber-400' : 'text-emerald-400'}`} />
                          <span className="text-[10px] uppercase text-zinc-400 font-bold">
                            $3/MO HOSTING LEASE:
                          </span>
                        </div>

                        <span className={`text-xs font-black tracking-tight ${
                          isOverdue ? 'text-amber-400 animate-pulse' : 'text-emerald-400'
                        }`}>
                          {countdown.text}
                        </span>
                      </div>

                      {/* On-Ledger Memo Directory Tag */}
                      <div className="flex items-center justify-between pt-1 border-t border-zinc-800/80 text-[10px]">
                        <span className="text-zinc-500">PAYMENT MEMO ID:</span>
                        <div className="flex items-center gap-1">
                          <code className="text-zinc-300 font-bold bg-black px-1.5 py-0.5 rounded border border-zinc-800">
                            {memoId}
                          </code>
                          <button
                            onClick={() => handleCopyLink(memoId, `memo_${site.id}`)}
                            className="text-zinc-400 hover:text-white p-0.5"
                            title="Copy Memo ID"
                          >
                            {copiedId === `memo_${site.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>

                      {/* Subscription Action & Auto-Pay Toggle */}
                      <div className="flex items-center justify-between pt-1">
                        <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-zinc-400 hover:text-white">
                          <input
                            type="checkbox"
                            checked={site.autoRenewEnabled !== false}
                            onChange={() => handleToggleAutoRenew(site)}
                            className="rounded border-zinc-700 bg-black text-emerald-400 focus:ring-0 w-3.5 h-3.5"
                          />
                          <span>Auto-Pay ({monthlyCostXrp} XRP/mo)</span>
                        </label>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleOpenLedgerDirectory(site)}
                            className="px-2 py-1 bg-zinc-950 hover:bg-zinc-800 text-zinc-300 text-[10px] rounded-lg border border-zinc-800 flex items-center gap-1"
                            title="View all verified on-chain payments matching this site's Memo ID"
                          >
                            <FileText className="w-3 h-3 text-blue-400" />
                            <span>Ledger Logs</span>
                          </button>

                          <button
                            onClick={() => handleOpenSettleModal(site)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all ${
                              isOverdue
                                ? 'bg-amber-400 hover:bg-amber-300 text-black shadow-lg shadow-amber-950'
                                : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
                            }`}
                          >
                            <Zap className="w-3 h-3 fill-current" />
                            <span>{isOverdue ? 'UNBLOCK & PAY $3' : 'RENEW ($3 XRP)'}</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Meta Specs & Telemetry */}
                    <div className="grid grid-cols-3 gap-2 pt-1 text-[11px] font-mono text-zinc-400 border-t border-zinc-900">
                      <div className="flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5 text-zinc-500" />
                        <span>{site.viewsCount.toLocaleString()} views</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-emerald-500" />
                        <span>42ms CDN</span>
                      </div>
                      <div className="flex items-center gap-1.5 justify-end text-zinc-500">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{new Date(site.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom: Update & Re-post Live Action Bar */}
                  <div className="pt-3 border-t border-zinc-900 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400">
                      <span className="text-zinc-500">TARGET:</span>
                      <span className="text-zinc-300 font-semibold truncate max-w-[120px]">
                        {site.type === 'app' ? 'HTML5 BUNDLE' : site.personaName || 'AI AGENT'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {site.type === 'app' && (
                        <button
                          onClick={() => onNavigateToAppStudio(site.files?.[0]?.content, site.files?.[0]?.language || 'html')}
                          className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-mono flex items-center gap-1 transition-colors"
                          title="Edit Code in App Studio"
                        >
                          <Code2 className="w-3.5 h-3.5 text-zinc-400" />
                          <span>EDIT CODE</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleQuickLiveUpdate(site)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-400 text-black hover:bg-emerald-300 text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                        title="Sync and re-deploy latest changes to live site immediately"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>UPDATE & RE-POST LIVE</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL 1: Settle / Renew $3/mo Hosting Lease */}
      {settleModalSite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 font-mono text-xs">
          <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-400 text-black flex items-center justify-center font-bold">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Hosting Subscription Settle // {settleModalSite.name}
                  </h3>
                  <p className="text-[11px] text-zinc-400">$3.00 USD / Month worth of XRP</p>
                </div>
              </div>
              <button
                onClick={() => setSettleModalSite(null)}
                className="p-1 text-zinc-400 hover:text-white bg-zinc-900 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Duration Selectors */}
              <div>
                <label className="text-[11px] text-zinc-400 font-bold block mb-1.5">
                  1. SELECT HOSTING DURATION //
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { months: 1, label: '1 Month', usd: 3.00 },
                    { months: 3, label: '3 Months', usd: 9.00 },
                    { months: 12, label: '1 Year', usd: 36.00 },
                  ].map((tier) => {
                    const isSelected = settleDurationMonths === tier.months;
                    const xrpVal = calculateXrpAmount(tier.usd);
                    return (
                      <button
                        key={tier.months}
                        type="button"
                        onClick={() => setSettleDurationMonths(tier.months)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'bg-zinc-900 border-emerald-400 text-white shadow-md'
                            : 'bg-black border-zinc-800 text-zinc-400 hover:border-zinc-700'
                        }`}
                      >
                        <span className="font-bold text-xs block text-white">{tier.label}</span>
                        <span className="text-emerald-400 font-bold text-sm block mt-1">{xrpVal} XRP</span>
                        <span className="text-[10px] text-zinc-500">${tier.usd.toFixed(2)} USD</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Settlement Calculation Details */}
              <div className="p-4 rounded-xl bg-black border border-zinc-800 space-y-2">
                <div className="flex justify-between border-b border-zinc-900 pb-1">
                  <span className="text-zinc-500">Site Name:</span>
                  <span className="text-white font-bold">{settleModalSite.name}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-900 pb-1">
                  <span className="text-zinc-500">Site Payment Memo ID:</span>
                  <span className="text-emerald-400 font-bold">
                    {settleModalSite.hostingMemoId || generateSiteHostingMemoId(settleModalSite.slug, settleModalSite.id)}
                  </span>
                </div>
                <div className="flex justify-between border-b border-zinc-900 pb-1">
                  <span className="text-zinc-500">Total Settlement:</span>
                  <span className="text-xl font-black text-emerald-400">
                    {calculateXrpAmount(3.00 * settleDurationMonths)} XRP (${(3.00 * settleDurationMonths).toFixed(2)} USD)
                  </span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-zinc-500">Wallet Available Spend:</span>
                  <span className="text-zinc-300 font-bold">
                    {wallet ? `${wallet.activeXrp.toFixed(4)} XRP` : 'Not Connected'}
                  </span>
                </div>
              </div>

              {settleError && (
                <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{settleError}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                <button
                  onClick={() => handleExecuteHostingSettlement(settleModalSite, settleDurationMonths)}
                  disabled={isSettling}
                  className="w-full py-3 bg-emerald-400 hover:bg-emerald-300 text-black font-black text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                >
                  {isSettling ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-black" />
                      <span>SIGNING & BROADCASTING TO XRPL MAINNET...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 fill-black" />
                      <span>
                        PAY {calculateXrpAmount(3.00 * settleDurationMonths)} XRP & RENEW HOSTING (+{settleDurationMonths * 30} DAYS)
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: On-Chain Ledger History Directory */}
      {ledgerDirectorySite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 font-mono text-xs">
          <div className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500 text-white flex items-center justify-center font-bold">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Ledger Payment Directory // {ledgerDirectorySite.name}
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Memo Index: <span className="text-emerald-400 font-bold">{ledgerDirectorySite.hostingMemoId}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setLedgerDirectorySite(null)}
                className="p-1 text-zinc-400 hover:text-white bg-zinc-900 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3">
              <p className="text-zinc-400 text-xs">
                Historical on-chain settlements recorded on XRPL Mainnet matching this site's unique Memo ID.
              </p>

              {isLoadingLedgerTxs ? (
                <div className="py-12 text-center text-zinc-500 flex flex-col items-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                  <span>Scanning XRPL Mainnet Ledger for Memo Index...</span>
                </div>
              ) : ledgerTxs.length === 0 ? (
                <div className="py-10 text-center border border-dashed border-zinc-800 rounded-xl space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                  <p className="text-white font-bold">Initial Genesis Cycle Active</p>
                  <p className="text-zinc-500 text-[11px]">
                    Site registered on edge CDN with active 30-day lease. Subsequent renewal transactions will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {ledgerTxs.map((tx, idx) => (
                    <div key={idx} className="p-3 bg-black rounded-xl border border-zinc-800 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-emerald-400 font-bold">{tx.amountXrp} XRP</span>
                        <span className="text-zinc-500 text-[10px]">
                          {new Date(tx.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-zinc-400">
                        <span className="truncate max-w-[280px]">Tx: {tx.txHash}</span>
                        <a
                          href={`https://livenet.xrpl.org/transactions/${tx.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-400 hover:underline flex items-center gap-1"
                        >
                          <span>Explorer</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Deploy New Hosted Site Modal */}
      {isDeployModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white text-black flex items-center justify-center shadow-md">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white tracking-wide">
                    Deploy New Live Hosted Instance
                  </h2>
                  <p className="text-xs text-zinc-400 font-mono">
                    CHOOSE BETWEEN STANDALONE WEB APP OR PUBLIC AI CHAT AGENT • $3/MO XRP LEASE
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDeployModalOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg border border-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateDeployment} className="p-6 overflow-y-auto space-y-5 font-mono text-xs">
              {/* Type Switcher */}
              <div className="space-y-2">
                <label className="text-zinc-400 block">1. SELECT HOSTING TYPE //</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setDeployType('app');
                      setDeployName('Custom Web App');
                      setDeploySlug('web-app-' + Math.random().toString(36).substring(2, 6));
                    }}
                    className={`p-4 rounded-xl border text-left flex flex-col gap-1.5 transition-all ${
                      deployType === 'app'
                        ? 'bg-zinc-900 border-emerald-500 text-white shadow-lg'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-white flex items-center gap-1.5">
                        <Terminal className="w-4 h-4 text-emerald-400" />
                        <span>Hosted Web App</span>
                      </span>
                      {deployType === 'app' && <Check className="w-4 h-4 text-emerald-400" />}
                    </div>
                    <p className="text-xs text-zinc-400">
                      Deploy HTML5 Canvas, React tools, games, or multi-file projects directly from App Studio.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDeployType('chat');
                      setDeployName(`${activePersona.name} Customer Portal`);
                      setDeploySlug('agent-portal-' + Math.random().toString(36).substring(2, 6));
                    }}
                    className={`p-4 rounded-xl border text-left flex flex-col gap-1.5 transition-all ${
                      deployType === 'chat'
                        ? 'bg-zinc-900 border-purple-500 text-white shadow-lg'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-white flex items-center gap-1.5">
                        <MessageSquare className="w-4 h-4 text-purple-400" />
                        <span>AI Chat Portal</span>
                      </span>
                      {deployType === 'chat' && <Check className="w-4 h-4 text-purple-400" />}
                    </div>
                    <p className="text-xs text-zinc-400">
                      Host a dedicated public AI assistant for clients, gamers, or team members with custom instructions.
                    </p>
                  </button>
                </div>
              </div>

              {/* General Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-zinc-400 block mb-1">Instance Name</label>
                  <input
                    type="text"
                    required
                    value={deployName}
                    onChange={(e) => setDeployName(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Custom URL Slug</label>
                  <input
                    type="text"
                    required
                    value={deploySlug}
                    onChange={(e) => setDeploySlug(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-zinc-400 block mb-1">Description</label>
                <textarea
                  rows={2}
                  value={deployDesc}
                  onChange={(e) => setDeployDesc(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white resize-none"
                />
              </div>

              {/* Type-Specific Fields */}
              {deployType === 'app' ? (
                <div className="space-y-3 pt-2 border-t border-zinc-800">
                  <label className="text-zinc-400 block">App Source Bundle:</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setAppSourceMode('current_studio')}
                      className={`flex-1 py-2 rounded-xl border text-xs font-bold ${
                        appSourceMode === 'current_studio'
                          ? 'bg-zinc-800 border-emerald-400 text-white'
                          : 'bg-black border-zinc-800 text-zinc-400'
                      }`}
                    >
                      Use Active App Studio Files ({currentAppStudioFiles.length} files)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAppSourceMode('custom_html')}
                      className={`flex-1 py-2 rounded-xl border text-xs font-bold ${
                        appSourceMode === 'custom_html'
                          ? 'bg-zinc-800 border-emerald-400 text-white'
                          : 'bg-black border-zinc-800 text-zinc-400'
                      }`}
                    >
                      Paste Custom HTML
                    </button>
                  </div>

                  {appSourceMode === 'custom_html' && (
                    <textarea
                      rows={6}
                      value={customHtmlCode}
                      onChange={(e) => setCustomHtmlCode(e.target.value)}
                      className="w-full bg-black border border-zinc-800 rounded-xl p-3 font-mono text-xs text-emerald-400"
                    />
                  )}
                </div>
              ) : (
                <div className="space-y-3 pt-2 border-t border-zinc-800">
                  <label className="text-zinc-400 block">AI Persona Configuration:</label>
                  <select
                    value={selectedPersonaId}
                    onChange={(e) => {
                      setSelectedPersonaId(e.target.value);
                      const found = personas.find((p) => p.id === e.target.value);
                      if (found) setChatSystemPrompt(found.systemInstruction || '');
                    }}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    {personas.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.tagline})
                      </option>
                    ))}
                  </select>

                  <textarea
                    rows={3}
                    value={chatSystemPrompt}
                    onChange={(e) => setChatSystemPrompt(e.target.value)}
                    placeholder="System prompt instructions..."
                    className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-xs text-zinc-300"
                  />
                </div>
              )}

              {/* Submit CTA */}
              <div className="pt-3 border-t border-zinc-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsDeployModalOpen(false)}
                  className="px-4 py-2.5 bg-zinc-900 text-zinc-400 hover:text-white rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-white hover:bg-zinc-200 text-black font-bold rounded-xl shadow-lg"
                >
                  Deploy & Activate $3/mo Lease
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Interactive Simulator (With Blocking Screen when Suspended) */}
      {previewSite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-4xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[85vh]">
            <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60">
              <div className="flex items-center gap-2.5">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    previewSite.isHostingSuspended || (previewSite.hostingExpiresAt && now > previewSite.hostingExpiresAt)
                      ? 'bg-amber-400'
                      : 'bg-emerald-400 animate-pulse'
                  }`}
                />
                <h3 className="text-sm font-bold text-white font-mono">
                  LIVE SIMULATOR // {previewSite.name}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPreviewSite(null)}
                  className="p-1 text-zinc-400 hover:text-white bg-zinc-900 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-black p-2">
              {previewSite.isHostingSuspended || (previewSite.hostingExpiresAt && now > previewSite.hostingExpiresAt) ? (
                /* BLOCKING SUSPENSION SCREEN */
                <div className="w-full h-full rounded-xl border border-amber-800/80 bg-zinc-950 p-8 flex flex-col items-center justify-center text-center space-y-5 font-mono">
                  <div className="w-16 h-16 rounded-2xl bg-amber-950 border border-amber-600 flex items-center justify-center text-amber-400 shadow-xl shadow-amber-950">
                    <ShieldAlert className="w-8 h-8" />
                  </div>

                  <div className="space-y-2 max-w-md">
                    <h2 className="text-lg font-black text-amber-300">
                      HOSTING LEASE EXPIRED — SITE BLOCKED
                    </h2>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      This live deployment is currently suspended on the CDN edge because the monthly <strong className="text-white">$3.00 USD worth of XRP</strong> hosting fee has not been settled.
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      Payment Memo ID: <code className="text-emerald-400 font-bold">{previewSite.hostingMemoId}</code>
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <button
                      onClick={() => {
                        const s = previewSite;
                        setPreviewSite(null);
                        handleOpenSettleModal(s);
                      }}
                      className="px-6 py-3 bg-emerald-400 hover:bg-emerald-300 text-black font-black text-xs rounded-xl shadow-lg flex items-center gap-2"
                    >
                      <Zap className="w-4 h-4 fill-black" />
                      <span>UNBLOCK & SETTLE $3.00 XRP NOW</span>
                    </button>
                  </div>
                </div>
              ) : previewSite.type === 'app' ? (
                <iframe
                  srcDoc={previewSite.files?.[0]?.content || '<h2 style="color:white">App loading...</h2>'}
                  title={previewSite.name}
                  sandbox="allow-scripts allow-forms allow-same-origin allow-modals"
                  className="w-full h-full rounded-xl border border-zinc-800 bg-black"
                />
              ) : (
                <div className="w-full h-full flex flex-col bg-zinc-950 rounded-xl border border-zinc-800 p-6 space-y-4">
                  <div className="flex items-center gap-3 border-b border-zinc-800 pb-3">
                    <div className="w-8 h-8 rounded-xl bg-purple-600 flex items-center justify-center text-white">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">{previewSite.name}</h4>
                      <p className="text-xs text-zinc-400 font-mono">
                        System: {previewSite.systemPrompt?.substring(0, 70)}...
                      </p>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-3 font-sans text-xs">
                    <div className="bg-zinc-900 p-3 rounded-xl max-w-md text-zinc-200 border border-zinc-800">
                      {previewSite.welcomeMessage || 'Hello! I am ready to assist you.'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-zinc-800">
                    <input
                      type="text"
                      disabled
                      placeholder="Type a message as a visitor..."
                      className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-400 font-sans"
                    />
                    <button className="px-4 py-2 bg-white text-black font-bold text-xs rounded-xl opacity-60">
                      Send
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Share & Embed Modal */}
      {shareModalSite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 font-mono text-xs">
          <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2 font-bold text-white text-sm">
                <Share2 className="w-4 h-4 text-emerald-400" />
                <span>Share & Embed // {shareModalSite.name}</span>
              </div>
              <button
                onClick={() => setShareModalSite(null)}
                className="p-1 text-zinc-400 hover:text-white bg-zinc-900 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-zinc-400">DIRECT PUBLIC URL</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareModalSite.publicUrl}
                  className="flex-1 bg-black border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 select-all"
                />
                <button
                  onClick={() => handleCopyLink(shareModalSite.publicUrl, 'share_url')}
                  className="px-3 py-2 bg-white text-black hover:bg-zinc-200 font-bold rounded-xl"
                >
                  {copiedId === 'share_url' ? 'COPIED' : 'COPY'}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-zinc-400">EMBED IFRAME SNIPPET</label>
              <div className="flex items-center gap-2">
                <textarea
                  readOnly
                  rows={2}
                  value={`<iframe src="${shareModalSite.publicUrl}" width="100%" height="600" style="border:none;border-radius:12px;" allow="camera; microphone; clipboard-read; clipboard-write;"></iframe>`}
                  className="flex-1 bg-black border border-zinc-800 rounded-xl p-2.5 text-zinc-300 resize-none select-all"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `<iframe src="${shareModalSite.publicUrl}" width="100%" height="600" style="border:none;border-radius:12px;" allow="camera; microphone; clipboard-read; clipboard-write;"></iframe>`
                    );
                    showToast('Copied iframe embed code!');
                  }}
                  className="px-3 py-3 bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-zinc-200 rounded-xl shrink-0"
                >
                  COPY
                </button>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShareModalSite(null)}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Embedded Send / Receive XRP Wallet Modal */}
      <WalletTransferModal
        isOpen={isWalletTransferOpen}
        onClose={() => setIsWalletTransferOpen(false)}
        wallet={wallet}
        initialTab={walletTransferTab}
        onWalletUpdated={(updated) => {
          setWallet(updated);
        }}
      />
    </div>
  );
};
