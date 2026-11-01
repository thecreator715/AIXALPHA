import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  History,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Download,
  Search,
  RefreshCw,
  Wallet,
  Zap,
  ArrowUpRight,
  FileText,
  AlertCircle,
  Copy,
  Check,
  Calendar,
  Layers,
  Sparkles,
  Sliders,
  DollarSign,
  ChevronRight,
  TrendingUp,
  X,
  Clock,
  Globe,
  Terminal,
  MessageSquare,
  ShieldAlert,
  Power,
  ToggleLeft,
  ToggleRight,
  Play,
  ArrowDownLeft,
} from 'lucide-react';
import { XRPLPaymentRecord, XRPLWalletState, XRPLFeeWalletConfig, HostedSite } from '../types';
import {
  getStoredPaymentRecords,
  saveStoredPaymentRecords,
  addStoredPaymentRecord,
  getStoredXRPLWallet,
  saveStoredXRPLWallet,
  getStoredFeeWalletConfig,
  getStoredHostedSites,
  saveStoredHostedSites,
  renewHostedSiteSubscription,
  toggleSiteAutoRenew,
  exportPaymentsAsCSV,
  exportPaymentsAsJSON,
} from '../utils/storage';
import {
  fetchRealXrpPriceUsd,
  queryAccountBalances,
  fetchAccountTransactions,
  connectWalletBySeed,
  connectWalletByAddress,
  settleHostingPayment,
  XRPL_BASE_RESERVE_XRP,
} from '../utils/xrplService';

interface BillingHistoryPageProps {
  onBackToChat: () => void;
  onOpenCreditStore: () => void;
  currentCredits: number;
  onAddCredits: (amount: number) => void;
}

export const BillingHistoryPage: React.FC<BillingHistoryPageProps> = ({
  onBackToChat,
  onOpenCreditStore,
  currentCredits,
  onAddCredits,
}) => {
  const [payments, setPayments] = useState<XRPLPaymentRecord[]>(() => getStoredPaymentRecords());
  const [wallet, setWallet] = useState<XRPLWalletState | null>(() => getStoredXRPLWallet());
  const [feeConfig, setFeeConfig] = useState<XRPLFeeWalletConfig>(() => getStoredFeeWalletConfig());
  const [hostedSites, setHostedSites] = useState<HostedSite[]>(() => getStoredHostedSites());
  const [xrpPrice, setXrpPrice] = useState<{ priceUsd: number; source: string }>({
    priceUsd: 2.48,
    source: 'Live XRPL Index',
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [isScanningLedger, setIsScanningLedger] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [isRefreshingBalance, setIsRefreshingBalance] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<XRPLPaymentRecord | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Live 1-second countdown ticker for billing cycles
  const [now, setNow] = useState<number>(Date.now());

  // Subscription execution states
  const [processingSiteId, setProcessingSiteId] = useState<string | null>(null);
  const [subscriptionToast, setSubscriptionToast] = useState<string | null>(null);

  // Wallet Import Modal State
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [importInput, setImportInput] = useState('');
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);

  // Interval for live real-time countdown updates
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Load real XRP price on mount & refresh wallet
  useEffect(() => {
    loadPrice();
    if (wallet?.address) {
      refreshWallet();
    }
    // Refresh hosted sites from storage
    setHostedSites(getStoredHostedSites());
  }, []);

  const loadPrice = async () => {
    try {
      const quote = await fetchRealXrpPriceUsd();
      setXrpPrice({ priceUsd: quote.priceUsd, source: quote.source });
    } catch (e) {
      console.warn("Failed to fetch price quote:", e);
    }
  };

  const refreshWallet = async () => {
    if (!wallet?.address) return;
    setIsRefreshingBalance(true);
    try {
      const balances = await queryAccountBalances(wallet.address);
      const updated: XRPLWalletState = {
        ...wallet,
        totalXrp: balances.totalXrp,
        activeXrp: balances.activeXrp,
        sequence: balances.sequence,
        lastSynced: Date.now(),
      };
      setWallet(updated);
      saveStoredXRPLWallet(updated);
    } catch (e) {
      console.warn("Balance refresh failed:", e);
    } finally {
      setIsRefreshingBalance(false);
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const showToast = (msg: string) => {
    setSubscriptionToast(msg);
    setTimeout(() => setSubscriptionToast(null), 6000);
  };

  // Toggle individual site recurring subscription auto-renew
  const handleToggleAutoRenew = (siteId: string, enabled: boolean) => {
    const updated = toggleSiteAutoRenew(siteId, enabled);
    setHostedSites(updated);
    const target = updated.find((s) => s.id === siteId);
    showToast(
      enabled
        ? `✅ Auto-Deduct ACTIVATED for "${target?.name}". $3/mo will auto-renew from connected XRPL wallet.`
        : `⏸️ Auto-Deduct PAUSED for "${target?.name}". Manual payment required before cycle expires.`
    );
  };

  // Toggle all sites recurring subscriptions
  const handleToggleAllAutoRenew = (enabled: boolean) => {
    const current = getStoredHostedSites();
    const updated = current.map((s) => ({ ...s, autoRenewEnabled: enabled }));
    saveStoredHostedSites(updated);
    setHostedSites(updated);
    showToast(
      enabled
        ? `✅ Auto-Deduct ACTIVATED for all ${updated.length} hosted sites from connected XRPL wallet.`
        : `⏸️ Auto-Deduct PAUSED for all hosted sites.`
    );
  };

  // Execute on-chain $3/mo auto-deduction payment from connected wallet
  const handleTriggerAutoDeduct = async (site: HostedSite) => {
    if (!wallet) {
      setIsWalletModalOpen(true);
      return;
    }

    if (!wallet.seed) {
      setWalletError('A wallet seed (s...) is required to sign on-chain subscription transactions automatically.');
      setIsWalletModalOpen(true);
      return;
    }

    const usdTotal = site.hostingMonthlyPriceUsd || 3.00;
    const requiredXrp = parseFloat((usdTotal / xrpPrice.priceUsd).toFixed(6));

    if (wallet.activeXrp < requiredXrp) {
      alert(
        `Insufficient spendable XRP in connected wallet.\n\nRequired: ${requiredXrp.toFixed(4)} XRP ($${usdTotal.toFixed(2)} USD)\nActive Balance: ${wallet.activeXrp.toFixed(4)} XRP\n(Note: XRPL protocol requires 1.0 XRP base reserve)`
      );
      return;
    }

    setProcessingSiteId(site.id);
    try {
      const siteMemoId = site.hostingMemoId || `HOST-${site.slug.toUpperCase().slice(0, 10)}-${site.id.slice(-5)}`;

      // Submit on-chain payment to XRPL Mainnet treasury with unique site Memo ID
      const res = await settleHostingPayment({
        seed: wallet.seed,
        destinationAddress: feeConfig.destinationAddress,
        amountXrp: requiredXrp,
        siteMemoId,
        siteName: site.name,
      });

      // Renew site for 30 days and save
      const updatedSites = renewHostedSiteSubscription(site.id, 30, {
        txHash: res.txHash,
        xrpAmount: requiredXrp,
        usdValue: usdTotal,
        memoId: siteMemoId,
      });
      setHostedSites(updatedSites);

      // Record invoice receipt in payment ledger
      const newRecord: XRPLPaymentRecord = {
        id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        txHash: res.txHash,
        memoId: siteMemoId,
        sourceAddress: wallet.address,
        destinationAddress: feeConfig.destinationAddress,
        xrpAmount: requiredXrp,
        xrpDrops: Math.round(requiredXrp * 1000000).toString(),
        xrpPriceUsd: xrpPrice.priceUsd,
        usdValue: usdTotal,
        creditsAdded: 0,
        packageId: 'tier-hosting-auto-renew',
        packageName: `$3/mo Hosting Renewal (30 Days) - ${site.name}`,
        timestamp: Date.now(),
        status: 'validated',
        ledgerIndex: res.ledgerIndex,
        feeXrp: res.feeXrp,
        explorerUrl: `https://xrpscan.com/tx/${res.txHash}`,
      };

      addStoredPaymentRecord(newRecord);
      setPayments(getStoredPaymentRecords());

      // Refresh wallet balances
      await refreshWallet();

      showToast(`🎉 Successfully auto-deducted $3.00 (${requiredXrp.toFixed(4)} XRP) for "${site.name}"! Lease extended by 30 days.`);
    } catch (err: any) {
      console.error('Subscription auto-deduct error:', err);
      alert(`Auto-deduction failed: ${err.message || 'Transaction could not be submitted to XRPL Mainnet'}`);
    } finally {
      setProcessingSiteId(null);
    }
  };

  const handleConnectWallet = async () => {
    if (!importInput.trim()) return;
    setIsConnectingWallet(true);
    setWalletError(null);
    try {
      const input = importInput.trim();
      let connected: XRPLWalletState;
      if (input.startsWith('s')) {
        connected = await connectWalletBySeed(input);
      } else if (input.startsWith('r')) {
        connected = await connectWalletByAddress(input);
      } else {
        throw new Error('Please enter a valid XRPL Secret Seed (starts with "s") or Public Address (starts with "r").');
      }

      setWallet(connected);
      saveStoredXRPLWallet(connected);
      setIsWalletModalOpen(false);
      setImportInput('');
      showToast(`🔗 Connected XRPL Wallet: ${connected.address.slice(0, 8)}... (${connected.activeXrp.toFixed(3)} XRP Active)`);
    } catch (err: any) {
      setWalletError(err.message || 'Failed to connect wallet to XRPL Mainnet.');
    } finally {
      setIsConnectingWallet(false);
    }
  };

  const handleDisconnectWallet = () => {
    if (window.confirm('Disconnect XRPL wallet from this machine? Local payment history and hosted site configs will be preserved.')) {
      setWallet(null);
      saveStoredXRPLWallet(null);
      showToast('Wallet disconnected.');
    }
  };

  // Scan XRPL Mainnet for previous incoming payments with memo
  const handleScanLedgerHistory = async () => {
    if (!wallet?.address) {
      setIsWalletModalOpen(true);
      return;
    }

    setIsScanningLedger(true);
    setScanMessage(null);

    try {
      const txs = await fetchAccountTransactions(wallet.address, 30);
      let newFoundCount = 0;
      let existing = getStoredPaymentRecords();

      for (const tx of txs) {
        if (tx.destination === feeConfig.destinationAddress || (tx.memoId && (tx.memoId.startsWith('AIX-') || tx.memoId.startsWith('HOST-')))) {
          // Check if already in storage
          const alreadyLogged = existing.some((p) => p.txHash === tx.txHash);
          if (!alreadyLogged) {
            const isHosting = tx.memoId?.startsWith('HOST-');
            const calculatedCredits = isHosting ? 0 : Math.round(tx.amountXrp * xrpPrice.priceUsd * 3.5);
            const newRecord: XRPLPaymentRecord = {
              id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
              txHash: tx.txHash,
              memoId: tx.memoId || `AIX-LEDGER-SYNC-${tx.ledgerIndex}`,
              sourceAddress: tx.source,
              destinationAddress: tx.destination,
              xrpAmount: tx.amountXrp,
              xrpDrops: (tx.amountXrp * 1000000).toString(),
              xrpPriceUsd: xrpPrice.priceUsd,
              usdValue: parseFloat((tx.amountXrp * xrpPrice.priceUsd).toFixed(2)),
              creditsAdded: calculatedCredits,
              packageId: isHosting ? 'tier-hosting-sync' : 'tier-ledger-synced',
              packageName: isHosting ? `XRPL Hosting Payment (${tx.memoId})` : 'XRPL Ledger Synced Credit Refuel',
              timestamp: tx.timestamp,
              status: 'validated',
              ledgerIndex: tx.ledgerIndex,
              explorerUrl: `https://xrpscan.com/tx/${tx.txHash}`,
            };

            existing = [newRecord, ...existing];
            newFoundCount++;
          }
        }
      }

      if (newFoundCount > 0) {
        saveStoredPaymentRecords(existing);
        setPayments(existing);
        setScanMessage(`Successfully found and synced ${newFoundCount} validated XRPL payment(s) from ledger!`);
      } else {
        setScanMessage('Ledger scan complete. All recent payments for this wallet are up to date.');
      }
    } catch (e: any) {
      setScanMessage(`Ledger scan error: ${e.message || 'Check network connection'}`);
    } finally {
      setIsScanningLedger(false);
      setTimeout(() => setScanMessage(null), 5000);
    }
  };

  // Helper for computing countdown and metrics
  const getSiteCountdown = (site: HostedSite) => {
    const expiresAt = site.hostingExpiresAt || (site.createdAt + 30 * 24 * 60 * 60 * 1000);
    const diff = expiresAt - now;
    const isExpired = diff <= 0;
    const safeDiff = isExpired ? 0 : diff;

    const days = Math.floor(safeDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((safeDiff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((safeDiff / 1000 / 60) % 60);
    const seconds = Math.floor((safeDiff / 1000) % 60);

    // Percentage of 30-day window remaining
    const totalCycleMs = 30 * 24 * 60 * 60 * 1000;
    const percentRemaining = Math.max(0, Math.min(100, (safeDiff / totalCycleMs) * 100));

    let status: 'active' | 'warning' | 'expired' = 'active';
    if (isExpired) status = 'expired';
    else if (days <= 3) status = 'warning';

    return {
      days,
      hours,
      minutes,
      seconds,
      percentRemaining,
      isExpired,
      status,
      expiresAt,
    };
  };

  // Compute Aggregates
  const totalXrpSpent = payments.reduce((acc, p) => acc + (p.status === 'validated' ? p.xrpAmount : 0), 0);
  const totalUsdSpent = payments.reduce((acc, p) => acc + (p.status === 'validated' ? p.usdValue : 0), 0);
  const totalCreditsBought = payments.reduce((acc, p) => acc + (p.status === 'validated' ? p.creditsAdded : 0), 0);

  const activeSubscribedSites = hostedSites.filter((s) => s.autoRenewEnabled);
  const allAutoRenewActive = hostedSites.length > 0 && hostedSites.every((s) => s.autoRenewEnabled);
  const totalMonthlyCommitmentUsd = hostedSites.length * 3.00;
  const totalMonthlyCommitmentXrp = totalMonthlyCommitmentUsd / xrpPrice.priceUsd;

  const filteredPayments = payments.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      p.memoId.toLowerCase().includes(q) ||
      p.txHash.toLowerCase().includes(q) ||
      p.packageName.toLowerCase().includes(q) ||
      p.sourceAddress.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-[100dvh] bg-black text-zinc-100 flex flex-col font-sans pb-16 overflow-y-auto">
      {/* Toast Notification */}
      {subscriptionToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-950 border border-emerald-700 text-emerald-200 px-4 py-3 rounded-xl text-xs font-mono shadow-2xl flex items-center gap-2.5 animate-in slide-in-from-bottom-3 duration-200 max-w-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{subscriptionToast}</span>
        </div>
      )}

      {/* Top Breadcrumb & Hero Header */}
      <div className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md px-4 sm:px-8 py-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 mb-1">
              <span className="cursor-pointer hover:text-white" onClick={onBackToChat}>
                AIX WORKSTATION
              </span>
              <span>/</span>
              <span className="text-emerald-400 font-medium">XRPL MAINNET BILLING & SUBSCRIPTIONS</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <History className="w-6 h-6 text-emerald-400" />
              XRPL Billing & Recurring Subscriptions
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-2xl font-mono">
              On-chain $3/month site hosting subscriptions, live billing cycle countdowns, and automated XRPL wallet auto-deductions.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={onOpenCreditStore}
              className="px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-xs transition-all shadow-md active:scale-95 flex items-center gap-1.5 glow-subtle font-mono"
            >
              <Zap className="w-3.5 h-3.5 fill-black" />
              <span>BUY CREDITS WITH XRP</span>
            </button>

            <button
              onClick={handleScanLedgerHistory}
              disabled={isScanningLedger}
              className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 text-xs transition-all flex items-center gap-1.5 font-mono disabled:opacity-50"
              title="Query XRPL Mainnet for past payments matching this wallet"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isScanningLedger ? 'animate-spin' : ''}`} />
              <span>{isScanningLedger ? 'SCANNING LEDGER...' : 'FETCH LEDGER TXS'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 w-full space-y-8">
        {scanMessage && (
          <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs font-mono flex items-center gap-2 animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{scanMessage}</span>
          </div>
        )}

        {/* Real-time Telemetry Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Available Credits */}
          <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-mono">
              <span>ACTIVE PROMPT CREDITS</span>
              <Zap className="w-4 h-4 text-amber-400" />
            </div>
            <div className="my-3">
              <div className="text-3xl font-bold text-white tracking-tight font-mono">
                {currentCredits} <span className="text-xs text-zinc-500 font-normal">AVAILABLE</span>
              </div>
              <p className="text-[11px] text-zinc-500 font-mono mt-1">
                Total Lifetime Added: <span className="text-zinc-300">+{totalCreditsBought}</span>
              </p>
            </div>
            <button
              onClick={onOpenCreditStore}
              className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-mono font-medium"
            >
              <span>Refuel Prompt Engine</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Card 2: Connected XRPL Wallet */}
          <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-mono">
              <span>XRPL MAINNET WALLET</span>
              <Wallet className="w-4 h-4 text-blue-400" />
            </div>

            <div className="my-3">
              {wallet ? (
                <div>
                  <div className="flex items-center gap-1.5 text-xs text-zinc-300 font-mono">
                    <span className="truncate max-w-[170px] bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                      {wallet.address}
                    </span>
                    <button
                      onClick={() => handleCopy(wallet.address, 'addr')}
                      className="p-1 hover:text-white text-zinc-500"
                      title="Copy Address"
                    >
                      {copiedText === 'addr' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>

                  <div className="mt-2 text-xs font-mono flex items-center justify-between text-zinc-400">
                    <span>Active Spendable:</span>
                    <span className="text-white font-bold">{wallet.activeXrp.toFixed(4)} XRP</span>
                  </div>
                  <div className="text-[10px] text-zinc-500 font-mono flex items-center justify-between">
                    <span>Reserve (1.0 XRP Locked):</span>
                    <span>{wallet.seed ? '⚡ Seed Connected (Auto-Renew Ready)' : '👁️ Read-Only Mode'}</span>
                  </div>
                </div>
              ) : (
                <div className="py-1">
                  <p className="text-xs text-zinc-400 font-mono">No XRPL Wallet Connected</p>
                  <p className="text-[11px] text-zinc-600 font-mono">Import seed to enable automatic $3/mo deductions</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-xs font-mono">
              {wallet ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={refreshWallet}
                    disabled={isRefreshingBalance}
                    className="text-zinc-400 hover:text-white flex items-center gap-1 text-[11px]"
                  >
                    <RefreshCw className={`w-3 h-3 ${isRefreshingBalance ? 'animate-spin' : ''}`} />
                    <span>Sync</span>
                  </button>
                  <span className="text-zinc-700">|</span>
                  <button onClick={handleDisconnectWallet} className="text-rose-400 hover:text-rose-300 text-[11px]">
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsWalletModalOpen(true)}
                  className="text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1"
                >
                  <span>Connect Wallet</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Card 3: Real-Time XRP Market Price */}
          <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-mono">
              <span>REAL-TIME XRP PRICE</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>

            <div className="my-3">
              <div className="text-3xl font-bold text-white tracking-tight font-mono flex items-baseline gap-1">
                ${xrpPrice.priceUsd.toFixed(4)} <span className="text-xs text-zinc-500 font-normal">USD</span>
              </div>
              <p className="text-[11px] text-zinc-500 font-mono mt-1 truncate">
                Source: <span className="text-emerald-400 font-medium">{xrpPrice.source}</span>
              </p>
            </div>

            <div className="text-[11px] text-zinc-500 font-mono flex items-center justify-between">
              <span>$3/mo Hosting = ~{(3.00 / xrpPrice.priceUsd).toFixed(3)} XRP</span>
              <button onClick={loadPrice} className="hover:text-zinc-300 text-zinc-500" title="Refresh Price Quote">
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Card 4: Subscriptions Commitment */}
          <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-mono">
              <span>HOSTING SUBSCRIPTIONS</span>
              <Calendar className="w-4 h-4 text-purple-400" />
            </div>

            <div className="my-3">
              <div className="text-3xl font-bold text-white tracking-tight font-mono">
                {activeSubscribedSites.length} / {hostedSites.length} <span className="text-xs text-zinc-500 font-normal">AUTO-ACTIVE</span>
              </div>
              <p className="text-[11px] text-zinc-500 font-mono mt-1">
                Total Monthly: <span className="text-emerald-400 font-semibold">${totalMonthlyCommitmentUsd.toFixed(2)} USD</span> (~{totalMonthlyCommitmentXrp.toFixed(2)} XRP)
              </p>
            </div>

            <div className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{wallet?.seed ? 'XRPL Wallet Auto-Renew Ready' : 'Connect Seed for Auto-Deduct'}</span>
            </div>
          </div>
        </div>

        {/* SECTION: RECURRING SUBSCRIPTIONS & $3/MO AUTO-DEDUCT COUNTDOWN */}
        <div className="rounded-2xl bg-zinc-950 border border-zinc-800 overflow-hidden shadow-2xl space-y-0">
          {/* Header & Master Toggle */}
          <div className="p-5 sm:p-6 border-b border-zinc-800 bg-zinc-900/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 mb-1">
                <Clock className="w-4 h-4" />
                <span>ON-CHAIN RECURRING SUBSCRIPTION ENGINE</span>
              </div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                $3.00/Month Site Hosting Subscriptions & Live Countdowns
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5 max-w-2xl font-mono">
                Each hosted app and AI chat portal runs on a 30-day lease directory. When auto-deduct is enabled, your connected XRPL wallet automatically settles $3 worth of XRP before expiration to keep your site live.
              </p>
            </div>

            {/* Master Toggle Controls */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="bg-zinc-900 border border-zinc-700/80 rounded-xl px-3.5 py-2 flex items-center gap-3 font-mono text-xs">
                <span className="text-zinc-300 font-medium">All Sites Auto-Deduct:</span>
                <button
                  onClick={() => handleToggleAllAutoRenew(!allAutoRenewActive)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                    allAutoRenewActive ? 'bg-emerald-600' : 'bg-zinc-700'
                  }`}
                  title="Toggle recurring subscription auto-deduct for all hosted sites"
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      allAutoRenewActive ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Hosted Sites Subscription Grid */}
          <div className="p-5 sm:p-6 space-y-4">
            {hostedSites.length === 0 ? (
              <div className="p-12 text-center font-mono space-y-3 border border-dashed border-zinc-800 rounded-xl">
                <Globe className="w-8 h-8 text-zinc-600 mx-auto" />
                <h3 className="text-sm font-semibold text-zinc-300">No Hosted Sites Found</h3>
                <p className="text-xs text-zinc-500 max-w-md mx-auto">
                  Deploy a web app from the App Studio or create an AI Chat Portal to establish an active $3/month XRPL subscription lease.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {hostedSites.map((site) => {
                  const countdown = getSiteCountdown(site);
                  const isProcessing = processingSiteId === site.id;
                  const monthlyXrp = (site.hostingMonthlyPriceUsd / xrpPrice.priceUsd).toFixed(4);

                  return (
                    <div
                      key={site.id}
                      className={`p-5 rounded-xl border font-mono text-xs flex flex-col justify-between transition-all relative overflow-hidden ${
                        countdown.status === 'expired'
                          ? 'bg-rose-950/20 border-rose-900/80'
                          : countdown.status === 'warning'
                          ? 'bg-amber-950/20 border-amber-800/80'
                          : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      {/* Top Row: Title, Type & Memo Tag */}
                      <div className="flex items-start justify-between gap-3 pb-3 border-b border-zinc-800/80">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={`p-1.5 rounded-lg text-white ${
                                site.type === 'app' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-blue-950 text-blue-400 border border-blue-800'
                              }`}
                            >
                              {site.type === 'app' ? <Terminal className="w-3.5 h-3.5" /> : <MessageSquare className="w-3.5 h-3.5" />}
                            </span>
                            <span className="font-bold text-white text-sm truncate">{site.name}</span>
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                            <span>Slug: <code className="text-zinc-300">{site.slug}</code></span>
                            <span>•</span>
                            <a
                              href={site.publicUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-400 hover:underline flex items-center gap-0.5"
                            >
                              <span>Live Link</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="shrink-0 flex flex-col items-end gap-1">
                          {countdown.status === 'active' ? (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-950 border border-emerald-700 text-emerald-400 text-[10px] font-bold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              ACTIVE LEASE
                            </span>
                          ) : countdown.status === 'warning' ? (
                            <span className="px-2.5 py-1 rounded-full bg-amber-950 border border-amber-700 text-amber-300 text-[10px] font-bold flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              RENEWAL DUE SOON
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full bg-rose-950 border border-rose-700 text-rose-300 text-[10px] font-bold flex items-center gap-1">
                              <ShieldAlert className="w-3 h-3" />
                              EXPIRED / BLOCKED
                            </span>
                          )}

                          <span className="text-[10px] text-zinc-500">
                            Memo ID: <code className="text-emerald-400">{site.hostingMemoId}</code>
                          </span>
                        </div>
                      </div>

                      {/* Middle: Live Billing Cycle Countdown Timer Display */}
                      <div className="py-4 space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-zinc-400 flex items-center gap-1.5 font-medium">
                            <Clock className="w-3.5 h-3.5 text-emerald-400" />
                            Next Billing Cycle Countdown:
                          </span>
                          <span className="text-zinc-400 text-[11px]">
                            Cycle Ends: <span className="text-zinc-200">{new Date(countdown.expiresAt).toLocaleDateString()}</span>
                          </span>
                        </div>

                        {/* Visual Digital Clock Countdown Blocks */}
                        <div className="grid grid-cols-4 gap-2 text-center">
                          <div className="p-2.5 rounded-xl bg-black border border-zinc-800">
                            <div className="text-lg sm:text-xl font-bold text-white tracking-tight">
                              {String(countdown.days).padStart(2, '0')}
                            </div>
                            <div className="text-[9px] uppercase tracking-wider text-zinc-500 mt-0.5">Days</div>
                          </div>

                          <div className="p-2.5 rounded-xl bg-black border border-zinc-800">
                            <div className="text-lg sm:text-xl font-bold text-white tracking-tight">
                              {String(countdown.hours).padStart(2, '0')}
                            </div>
                            <div className="text-[9px] uppercase tracking-wider text-zinc-500 mt-0.5">Hours</div>
                          </div>

                          <div className="p-2.5 rounded-xl bg-black border border-zinc-800">
                            <div className="text-lg sm:text-xl font-bold text-emerald-400 tracking-tight">
                              {String(countdown.minutes).padStart(2, '0')}
                            </div>
                            <div className="text-[9px] uppercase tracking-wider text-zinc-500 mt-0.5">Minutes</div>
                          </div>

                          <div className="p-2.5 rounded-xl bg-black border border-zinc-800">
                            <div className="text-lg sm:text-xl font-bold text-emerald-400 tracking-tight font-mono">
                              {String(countdown.seconds).padStart(2, '0')}
                            </div>
                            <div className="text-[9px] uppercase tracking-wider text-zinc-500 mt-0.5">Seconds</div>
                          </div>
                        </div>

                        {/* 30-Day Billing Cycle Progress Bar */}
                        <div className="space-y-1">
                          <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden border border-zinc-800/80 p-[1px]">
                            <div
                              className={`h-full rounded-full transition-all duration-1000 ${
                                countdown.status === 'expired'
                                  ? 'bg-rose-500'
                                  : countdown.status === 'warning'
                                  ? 'bg-amber-400'
                                  : 'bg-emerald-400'
                              }`}
                              style={{ width: `${countdown.percentRemaining}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-zinc-500">
                            <span>{countdown.percentRemaining.toFixed(1)}% of 30-day lease cycle remaining</span>
                            <span>$3.00 USD (~{monthlyXrp} XRP) / mo</span>
                          </div>
                        </div>
                      </div>

                      {/* Bottom Controls: Auto-Deduct Switch & Manual Trigger Button */}
                      <div className="pt-3 border-t border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
                        {/* Interactive Auto-Renew Toggle Switch */}
                        <div className="flex items-center gap-2.5 w-full sm:w-auto">
                          <button
                            onClick={() => handleToggleAutoRenew(site.id, !site.autoRenewEnabled)}
                            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                              site.autoRenewEnabled ? 'bg-emerald-600' : 'bg-zinc-700'
                            }`}
                            title={`Toggle Auto-Deduct for ${site.name}`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                site.autoRenewEnabled ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                          <div className="text-[11px]">
                            <span className={site.autoRenewEnabled ? 'text-emerald-300 font-semibold' : 'text-zinc-400'}>
                              {site.autoRenewEnabled ? 'Auto-Deduct ON' : 'Auto-Deduct OFF'}
                            </span>
                            <span className="text-zinc-500 block text-[10px]">
                              {site.autoRenewEnabled ? 'XRPL Wallet auto-pays at 0s' : 'Manual renewal required'}
                            </span>
                          </div>
                        </div>

                        {/* Trigger / Settle Button */}
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                          <button
                            onClick={() => handleTriggerAutoDeduct(site)}
                            disabled={isProcessing}
                            className="px-3.5 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-xs transition-all shadow-md active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
                            title="Execute instant $3 XRP payment on XRPL Mainnet to extend lease by 30 days"
                          >
                            {isProcessing ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-black" />
                            ) : (
                              <Zap className="w-3.5 h-3.5 fill-black text-black" />
                            )}
                            <span>{isProcessing ? 'SETTLING ON XRPL...' : `RENEW NOW ($3.00 XRP)`}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Platform Treasury & Settlement Rules Banner */}
        <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 font-mono text-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-zinc-300 font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Official AIX Fee Settlement Treasury (XRPL Mainnet)</span>
            </div>
            <div className="flex items-center gap-2 text-zinc-400">
              <span className="text-zinc-500">Destination:</span>
              <span className="text-zinc-200 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800 select-all font-bold">
                {feeConfig.destinationAddress}
              </span>
              <button
                onClick={() => handleCopy(feeConfig.destinationAddress, 'feeAddr')}
                className="p-1 hover:text-white text-zinc-500"
              >
                {copiedText === 'feeAddr' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
            <p className="text-[11px] text-zinc-500">
              Network Reserve: <span className="text-zinc-300">1.00 XRP</span> (Locked per XRPL protocol) • Automatic Invoice Memo matching with instant local credit disbursement & 30-day lease extensions.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => exportPaymentsAsCSV(payments)}
              disabled={payments.length === 0}
              className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 flex items-center gap-1.5 transition-colors disabled:opacity-40"
              title="Download accounting CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV LEDGER</span>
            </button>

            <button
              onClick={() => exportPaymentsAsJSON(payments)}
              disabled={payments.length === 0}
              className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 flex items-center gap-1.5 transition-colors disabled:opacity-40"
              title="Download JSON data"
            >
              <Download className="w-3.5 h-3.5" />
              <span>JSON BACKUP</span>
            </button>
          </div>
        </div>

        {/* Payment History Table & Search */}
        <div className="rounded-2xl bg-zinc-950 border border-zinc-800 overflow-hidden shadow-xl">
          <div className="p-4 sm:p-5 border-b border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-semibold text-white tracking-wide">
                Settled Payment Records ({filteredPayments.length})
              </h2>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-500" />
              <input
                type="text"
                placeholder="Search Memo ID or Hash..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black border border-zinc-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 font-mono"
              />
            </div>
          </div>

          {filteredPayments.length === 0 ? (
            <div className="p-12 text-center font-mono space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-zinc-300">No XRPL Payment Records Found</h3>
              <p className="text-xs text-zinc-500 max-w-md mx-auto">
                Payments made via XRPL Mainnet are recorded directly here with full Memo IDs and transaction hashes.
              </p>
              <button
                onClick={onOpenCreditStore}
                className="mt-2 px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold"
              >
                Purchase Prompt Credits
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead className="bg-zinc-900/60 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
                  <tr>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Memo Invoice ID</th>
                    <th className="py-3 px-4">Package / Lease</th>
                    <th className="py-3 px-4">Credits Added</th>
                    <th className="py-3 px-4">XRP Amount</th>
                    <th className="py-3 px-4">USD Value</th>
                    <th className="py-3 px-4">XRPL Tx Hash</th>
                    <th className="py-3 px-4 text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {filteredPayments.map((record) => (
                    <tr key={record.id} className="hover:bg-zinc-900/30 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap text-zinc-300">
                        {new Date(record.timestamp).toLocaleDateString()}{' '}
                        <span className="text-zinc-500 text-[10px]">
                          {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-emerald-400 font-bold text-[11px]">
                            {record.memoId}
                          </span>
                          <button
                            onClick={() => handleCopy(record.memoId, record.id)}
                            className="p-1 text-zinc-500 hover:text-white"
                            title="Copy Memo ID"
                          >
                            {copiedText === record.id ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-zinc-300 whitespace-nowrap font-medium">{record.packageName}</td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {record.creditsAdded > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800 text-amber-300 font-bold">
                            <Zap className="w-3 h-3" />
                            +{record.creditsAdded}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800 text-emerald-300 font-bold">
                            <Globe className="w-3 h-3" />
                            Hosting Renewal
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="text-white font-bold">{record.xrpAmount.toFixed(4)} XRP</span>
                        <div className="text-[10px] text-zinc-500">@{record.xrpPriceUsd.toFixed(2)}/XRP</div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-zinc-300">${record.usdValue.toFixed(2)}</td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <a
                          href={`https://xrpscan.com/tx/${record.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-400 hover:text-blue-300 underline flex items-center gap-1 text-[11px]"
                          title="View on XRPL Mainnet Explorer"
                        >
                          <span className="max-w-[100px] truncate">{record.txHash}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => setSelectedInvoice(record)}
                          className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white transition-colors text-[11px]"
                        >
                          View Receipt
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Wallet Import Modal */}
      {isWalletModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-4 font-mono">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-semibold text-white">Connect XRPL Mainnet Wallet</h3>
              </div>
              <button
                onClick={() => {
                  setIsWalletModalOpen(false);
                  setWalletError(null);
                }}
                className="p-1 text-zinc-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              Enter your XRPL Secret Seed (<code className="text-emerald-400">s...</code>) for 1-click payments & automated $3/mo subscription renewals, or your Public Address (<code className="text-blue-400">r...</code>) for read-only tracking.
            </p>

            <div className="space-y-1.5">
              <label className="text-[11px] text-zinc-500 uppercase">XRPL Seed or Classic Address</label>
              <input
                type="password"
                placeholder="sEd... or rEb8TK..."
                value={importInput}
                onChange={(e) => setImportInput(e.target.value)}
                className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
              />
              <p className="text-[10px] text-zinc-600">
                🔒 Seed data stays strictly on your local machine and is never transmitted to external servers.
              </p>
            </div>

            {walletError && (
              <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{walletError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsWalletModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-zinc-900 text-zinc-400 hover:text-white text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleConnectWallet}
                disabled={isConnectingWallet || !importInput.trim()}
                className="px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-xs transition-all disabled:opacity-40"
              >
                {isConnectingWallet ? 'Connecting...' : 'Connect & Query Ledger'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-6 font-mono relative">
            <button
              onClick={() => setSelectedInvoice(null)}
              className="absolute right-4 top-4 p-1 text-zinc-500 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Receipt Header */}
            <div className="text-center border-b border-zinc-800 pb-4 space-y-1">
              <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-700 flex items-center justify-center mx-auto text-emerald-400 mb-2">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-white tracking-wide">AIX ALPHA XRPL INVOICE RECEIPT</h2>
              <p className="text-xs text-zinc-400">Validated On-Chain Settlement</p>
            </div>

            {/* Receipt Details */}
            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-zinc-900">
                <span className="text-zinc-500">Invoice / Memo ID:</span>
                <span className="text-emerald-400 font-bold">{selectedInvoice.memoId}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-zinc-900">
                <span className="text-zinc-500">Date & Time:</span>
                <span className="text-zinc-300">{new Date(selectedInvoice.timestamp).toUTCString()}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-zinc-900">
                <span className="text-zinc-500">Package / Item Acquired:</span>
                <span className="text-white font-medium">{selectedInvoice.packageName}</span>
              </div>

              {selectedInvoice.creditsAdded > 0 && (
                <div className="flex justify-between py-1 border-b border-zinc-900">
                  <span className="text-zinc-500">Credits Granted:</span>
                  <span className="text-amber-400 font-bold">+{selectedInvoice.creditsAdded} Credits</span>
                </div>
              )}

              <div className="flex justify-between py-1 border-b border-zinc-900">
                <span className="text-zinc-500">Settled XRP Amount:</span>
                <span className="text-white font-bold">{selectedInvoice.xrpAmount} XRP</span>
              </div>

              <div className="flex justify-between py-1 border-b border-zinc-900">
                <span className="text-zinc-500">XRP Price at Payment:</span>
                <span className="text-zinc-300">${selectedInvoice.xrpPriceUsd.toFixed(4)} USD</span>
              </div>

              <div className="flex justify-between py-1 border-b border-zinc-900">
                <span className="text-zinc-500">USD Equivalent:</span>
                <span className="text-zinc-300">${selectedInvoice.usdValue.toFixed(2)} USD</span>
              </div>

              <div className="flex justify-between py-1 border-b border-zinc-900">
                <span className="text-zinc-500">Source Account:</span>
                <span className="text-zinc-400 truncate max-w-[200px]">{selectedInvoice.sourceAddress}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-zinc-900">
                <span className="text-zinc-500">Destination Account:</span>
                <span className="text-zinc-400 truncate max-w-[200px]">{selectedInvoice.destinationAddress}</span>
              </div>

              <div className="space-y-1 pt-1">
                <span className="text-zinc-500">Transaction Hash:</span>
                <div className="p-2 rounded bg-black border border-zinc-800 text-[11px] text-zinc-300 break-all select-all">
                  {selectedInvoice.txHash}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <a
                href={`https://xrpscan.com/tx/${selectedInvoice.txHash}`}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-blue-400 border border-zinc-700 text-xs flex items-center gap-1.5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>View on XRPScan</span>
              </a>

              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-xs"
              >
                Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
