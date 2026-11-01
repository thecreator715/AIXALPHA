import React, { useState, useEffect } from 'react';
import {
  X,
  Zap,
  CheckCircle2,
  ShieldCheck,
  Clock,
  Sparkles,
  Wallet,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  AlertCircle,
  QrCode,
  Layers,
  Lock,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';
import { XRPLWalletState, XRPLPaymentRecord } from '../types';
import {
  getStoredXRPLWallet,
  saveStoredXRPLWallet,
  addStoredPaymentRecord,
  getStoredFeeWalletConfig,
} from '../utils/storage';
import {
  fetchRealXrpPriceUsd,
  queryAccountBalances,
  connectWalletBySeed,
  connectWalletByAddress,
  submitXRPLCreditPayment,
  generateMemoId,
  fetchAccountTransactions,
  generateQRCodeDataUrl,
  XRPL_BASE_RESERVE_XRP,
} from '../utils/xrplService';
import { WalletTransferModal } from './WalletTransferModal';

export interface CreditTier {
  id: string;
  usdPrice: number;
  credits: number;
  popular?: boolean;
  label: string;
  description: string;
}

export const CREDIT_TIERS: CreditTier[] = [
  {
    id: 'tier-25',
    usdPrice: 9.99,
    credits: 25,
    label: 'Starter Pack',
    description: 'Entry-level cognitive compute allocation',
  },
  {
    id: 'tier-50',
    usdPrice: 19.99,
    credits: 50,
    label: 'Developer Pack',
    description: 'Code execution and grounding searches',
  },
  {
    id: 'tier-100',
    usdPrice: 39.99,
    credits: 100,
    popular: true,
    label: 'Power Matrix',
    description: 'Multi-turn autonomous apps and 3D meshes',
  },
  {
    id: 'tier-200',
    usdPrice: 79.99,
    credits: 200,
    label: 'Enterprise Core',
    description: 'Continuous long-context project synthesis',
  },
  {
    id: 'tier-300',
    usdPrice: 99.99,
    credits: 300,
    label: 'Quantum Superstation',
    description: 'High-throughput reasoning and real-time execution',
  },
  {
    id: 'tier-500',
    usdPrice: 149.99,
    credits: 500,
    label: 'Master Studio & Quantum Uncapped',
    description: 'Maximum unrestricted prompt quota & priority compute',
  },
];

interface CreditStoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCredits: number;
  timeRemainingStr: string;
  onAddCredits: (amount: number) => void;
  onOpenBillingPage?: () => void;
  isFreeTierTestMode?: boolean;
  onToggleFreeTierTestMode?: (enabled?: boolean) => void;
}

export const CreditStoreModal: React.FC<CreditStoreModalProps> = ({
  isOpen,
  onClose,
  currentCredits,
  timeRemainingStr,
  onAddCredits,
  onOpenBillingPage,
  isFreeTierTestMode = true,
  onToggleFreeTierTestMode,
}) => {
  const [selectedTier, setSelectedTier] = useState<CreditTier>(CREDIT_TIERS[2]);
  const [wallet, setWallet] = useState<XRPLWalletState | null>(() => getStoredXRPLWallet());
  const [xrpPrice, setXrpPrice] = useState<{ priceUsd: number; source: string }>({
    priceUsd: 2.48,
    source: 'Live XRPL Index',
  });
  const feeConfig = getStoredFeeWalletConfig();

  // Payment Step: 'select' | 'confirm' | 'paying' | 'success' | 'manual'
  const [paymentStep, setPaymentStep] = useState<'select' | 'confirm' | 'paying' | 'success' | 'manual'>('select');
  const [activeMemoId, setActiveMemoId] = useState<string>('');
  const [activeXrpAmount, setActiveXrpAmount] = useState<number>(0);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);

  // Wallet Import Input in Modal
  const [showWalletInput, setShowWalletInput] = useState<boolean>(false);
  const [walletInput, setWalletInput] = useState<string>('');
  const [isImportingWallet, setIsImportingWallet] = useState<boolean>(false);
  const [walletImportError, setWalletImportError] = useState<string | null>(null);
  const [isVerifyingManualPayment, setIsVerifyingManualPayment] = useState<boolean>(false);

  // Send & Receive XRP Modal
  const [isWalletTransferOpen, setIsWalletTransferOpen] = useState<boolean>(false);
  const [walletTransferTab, setWalletTransferTab] = useState<'send' | 'receive'>('receive');
  const [manualQrDataUrl, setManualQrDataUrl] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      loadPrice();
      setPaymentStep('select');
      setPaymentError(null);
      if (wallet?.address) {
        refreshBalance(wallet.address);
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (paymentStep === 'manual' && feeConfig.destinationAddress) {
      // Generate QR Code for Manual Payment
      generateQRCodeDataUrl(feeConfig.destinationAddress, {
        width: 240,
        darkColor: '#000000',
        lightColor: '#ffffff',
      }).then((url) => setManualQrDataUrl(url));
    }
  }, [paymentStep, feeConfig.destinationAddress]);

  const loadPrice = async () => {
    try {
      const quote = await fetchRealXrpPriceUsd();
      setXrpPrice({ priceUsd: quote.priceUsd, source: quote.source });
    } catch (e) {
      console.warn('Failed to fetch XRP price:', e);
    }
  };

  const refreshBalance = async (address: string) => {
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
      console.warn('Balance query failed:', e);
    }
  };

  if (!isOpen) return null;

  // Calculate live XRP required for a tier
  const calculateXrpAmount = (usd: number): number => {
    const p = xrpPrice.priceUsd > 0 ? xrpPrice.priceUsd : 2.48;
    return parseFloat((usd / p).toFixed(4));
  };

  const currentXrpCost = calculateXrpAmount(selectedTier.usdPrice);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLabel(label);
    setTimeout(() => setCopiedLabel(null), 2000);
  };

  const handleImportWallet = async () => {
    if (!walletInput.trim()) return;
    setIsImportingWallet(true);
    setWalletImportError(null);
    try {
      const trimmed = walletInput.trim();
      let connected: XRPLWalletState;
      if (trimmed.startsWith('s')) {
        connected = await connectWalletBySeed(trimmed);
      } else if (trimmed.startsWith('r')) {
        connected = await connectWalletByAddress(trimmed);
      } else {
        throw new Error('Enter an XRPL Secret Seed (s...) or Classic Address (r...).');
      }

      setWallet(connected);
      saveStoredXRPLWallet(connected);
      setShowWalletInput(false);
      setWalletInput('');
    } catch (err: any) {
      setWalletImportError(err.message || 'Failed to import wallet.');
    } finally {
      setIsImportingWallet(false);
    }
  };

  const handleProceedToPayment = () => {
    const memo = generateMemoId(selectedTier.id);
    const amount = calculateXrpAmount(selectedTier.usdPrice);
    setActiveMemoId(memo);
    setActiveXrpAmount(amount);
    setPaymentError(null);

    if (wallet?.seed) {
      setPaymentStep('confirm');
    } else {
      setPaymentStep('manual');
    }
  };

  // 1-Click Instant XRPL Payment via Seed
  const handleExecute1ClickPayment = async () => {
    if (!wallet?.seed) {
      setPaymentStep('manual');
      return;
    }

    // Check balance
    if (wallet.activeXrp < activeXrpAmount) {
      setPaymentError(
        `Insufficient active XRP. You have ${wallet.activeXrp.toFixed(4)} active XRP (1.0 XRP reserve held). Required: ${activeXrpAmount} XRP.`
      );
      return;
    }

    setPaymentStep('paying');
    setPaymentError(null);

    try {
      const result = await submitXRPLCreditPayment(
        wallet.seed,
        feeConfig.destinationAddress,
        activeXrpAmount,
        activeMemoId
      );

      // Create permanent ledger record
      const record: XRPLPaymentRecord = {
        id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        txHash: result.txHash,
        memoId: activeMemoId,
        sourceAddress: wallet.address,
        destinationAddress: feeConfig.destinationAddress,
        xrpAmount: activeXrpAmount,
        xrpDrops: (activeXrpAmount * 1000000).toString(),
        xrpPriceUsd: xrpPrice.priceUsd,
        usdValue: selectedTier.usdPrice,
        creditsAdded: selectedTier.credits,
        packageId: selectedTier.id,
        packageName: selectedTier.label,
        timestamp: Date.now(),
        status: 'validated',
        ledgerIndex: result.ledgerIndex,
        feeXrp: result.feeXrp,
        explorerUrl: `https://xrpscan.com/tx/${result.txHash}`,
      };

      addStoredPaymentRecord(record);

      // Grant credits
      onAddCredits(selectedTier.credits);
      setLastTxHash(result.txHash);
      setPaymentStep('success');

      // Refresh balance
      refreshBalance(wallet.address);
    } catch (err: any) {
      setPaymentError(err.message || 'Transaction submission failed on XRPL Mainnet.');
      setPaymentStep('confirm');
    }
  };

  // Manual Verification by polling ledger for memo
  const handleVerifyManualPayment = async () => {
    setIsVerifyingManualPayment(true);
    setPaymentError(null);

    try {
      const searchAddress = wallet?.address || feeConfig.destinationAddress;
      const txs = await fetchAccountTransactions(searchAddress, 25);

      const matched = txs.find(
        (t) =>
          (t.memoId === activeMemoId || t.destination === feeConfig.destinationAddress) &&
          t.amountXrp >= activeXrpAmount * 0.98
      );

      if (matched) {
        const record: XRPLPaymentRecord = {
          id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          txHash: matched.txHash,
          memoId: activeMemoId,
          sourceAddress: matched.source,
          destinationAddress: matched.destination,
          xrpAmount: matched.amountXrp,
          xrpDrops: (matched.amountXrp * 1000000).toString(),
          xrpPriceUsd: xrpPrice.priceUsd,
          usdValue: selectedTier.usdPrice,
          creditsAdded: selectedTier.credits,
          packageId: selectedTier.id,
          packageName: selectedTier.label,
          timestamp: matched.timestamp,
          status: 'validated',
          ledgerIndex: matched.ledgerIndex,
          explorerUrl: `https://xrpscan.com/tx/${matched.txHash}`,
        };

        addStoredPaymentRecord(record);
        onAddCredits(selectedTier.credits);
        setLastTxHash(matched.txHash);
        setPaymentStep('success');
      } else {
        setPaymentError(
          'Payment not yet found on XRPL Mainnet. Please ensure the transaction is sent with the exact Memo ID, and try again in 5 seconds.'
        );
      }
    } catch (err: any) {
      setPaymentError(`Verification check error: ${err.message || 'Network issue'}`);
    } finally {
      setIsVerifyingManualPayment(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="w-full max-w-3xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] font-sans">
        {/* Header */}
        <div className="px-6 py-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white text-black flex items-center justify-center shadow-lg">
              <Zap className="w-5 h-5 fill-black" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white tracking-wide">
                  XRPL Mainnet Prompt Credit Refuel
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800">
                  MAINNET ACTIVE
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-mono">
                REAL-TIME XRP SETTLEMENT • 1 XRP PROTOCOL RESERVE
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg border border-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {/* Free Tier Testing Pass Section */}
          <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-mono">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-900/60 border border-emerald-600/80 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Free Tier Testing Mode Active</span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-400 text-black font-bold">ACTIVE</span>
                </div>
                <p className="text-[11px] text-zinc-400 font-sans mt-0.5">
                  Full prompt execution and multi-file App Studio testing is completely unrestricted on Free Tier.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                onAddCredits(1000);
                if (onToggleFreeTierTestMode) onToggleFreeTierTestMode(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-black text-xs font-bold font-mono transition-all shadow-md active:scale-95 shrink-0 flex items-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5 fill-black" />
              <span>+1,000 TEST CREDITS</span>
            </button>
          </div>

          {/* Top Status & Wallet Bar */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* User Credits Box */}
            <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 flex items-center justify-between font-mono">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase">Available Prompt Balance</p>
                  <p className="text-2xl font-bold text-white tracking-tight">
                    {currentCredits} <span className="text-xs font-normal text-zinc-400">CREDITS</span>
                  </p>
                </div>
              </div>

              <div className="text-right">
                <div className="flex items-center gap-1 text-[10px] text-zinc-500 justify-end">
                  <Clock className="w-3 h-3 text-emerald-400" />
                  <span>FREE DAILY REFILL</span>
                </div>
                <p className="text-xs font-bold text-emerald-400">{timeRemainingStr}</p>
              </div>
            </div>

            {/* XRPL Wallet Info Box */}
            <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 flex flex-col justify-between font-mono text-xs gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-500 uppercase flex items-center gap-1">
                  <Wallet className="w-3 h-3 text-blue-400" />
                  <span>XRPL Active Balance</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-bold">
                  ${xrpPrice.priceUsd.toFixed(3)}/XRP
                </span>
              </div>

              {wallet ? (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xl font-black text-emerald-400">
                        {wallet.activeXrp.toFixed(4)}{' '}
                        <span className="text-xs text-zinc-300 font-normal">XRP</span>
                      </span>
                      <span className="text-[10px] text-zinc-500 font-normal">
                        (Active Spendable)
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-500">
                      Total: {wallet.totalXrp.toFixed(4)} XRP • Reserve: 1.0 XRP
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
                    <button
                      onClick={() => {
                        setWalletTransferTab('receive');
                        setIsWalletTransferOpen(true);
                      }}
                      className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-emerald-300 border border-emerald-800/60 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors"
                    >
                      <ArrowDownLeft className="w-3 h-3" />
                      <span>RECEIVE (QR)</span>
                    </button>

                    <button
                      onClick={() => {
                        setWalletTransferTab('send');
                        setIsWalletTransferOpen(true);
                      }}
                      className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-blue-300 border border-blue-800/60 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors"
                    >
                      <ArrowUpRight className="w-3 h-3" />
                      <span>SEND</span>
                    </button>

                    <button
                      onClick={() => setShowWalletInput(!showWalletInput)}
                      className="px-2 py-1.5 text-[10px] text-zinc-400 hover:text-white bg-zinc-950 rounded-lg border border-zinc-800"
                    >
                      Switch
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-zinc-400 text-xs">Wallet not connected</span>
                  <button
                    onClick={() => setShowWalletInput(true)}
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-zinc-200 text-black text-[11px] font-bold"
                  >
                    Import Seed / Address
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Wallet Import Drawer */}
          {showWalletInput && (
            <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-700 font-mono text-xs space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="text-white font-semibold flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  Import XRPL Secret Seed or Classic Address
                </span>
                <button onClick={() => setShowWalletInput(false)} className="text-zinc-500 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="sEd... (Seed) or rEb8TK... (Address)"
                  value={walletInput}
                  onChange={(e) => setWalletInput(e.target.value)}
                  className="flex-1 bg-black border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                />
                <button
                  onClick={handleImportWallet}
                  disabled={isImportingWallet || !walletInput.trim()}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-lg text-xs transition-all disabled:opacity-40"
                >
                  {isImportingWallet ? 'Connecting...' : 'Connect'}
                </button>
              </div>

              {walletImportError && (
                <p className="text-rose-400 text-[11px] flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {walletImportError}
                </p>
              )}
              <p className="text-[10px] text-zinc-500">
                • Secret Seed (<code className="text-emerald-400">s...</code>) allows 1-click on-ledger settlement. Stored strictly in local machine storage.
              </p>
            </div>
          )}

          {/* STEP 1: Select Tier */}
          {paymentStep === 'select' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
                  Select Credit Package
                </label>
                <span className="text-xs font-mono text-zinc-500">
                  Live Conversion: <span className="text-emerald-400">${xrpPrice.priceUsd.toFixed(2)} / XRP</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {CREDIT_TIERS.map((tier) => {
                  const isSelected = selectedTier.id === tier.id;
                  const xrpCost = calculateXrpAmount(tier.usdPrice);

                  return (
                    <div
                      key={tier.id}
                      onClick={() => setSelectedTier(tier)}
                      className={`relative p-4 rounded-xl border text-left cursor-pointer transition-all font-mono flex flex-col justify-between ${
                        isSelected
                          ? 'bg-zinc-900 border-white text-white shadow-lg ring-1 ring-white/50'
                          : 'bg-zinc-950/80 border-zinc-800 text-zinc-400 hover:bg-zinc-900/60 hover:border-zinc-700 hover:text-zinc-200'
                      }`}
                    >
                      {tier.popular && (
                        <span className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-500 text-black shadow-md">
                          POPULAR
                        </span>
                      )}

                      {tier.credits === 500 && (
                        <span className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-gradient-to-r from-amber-400 to-orange-500 text-black shadow-md">
                          BEST VALUE
                        </span>
                      )}

                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-zinc-200">{tier.label}</span>
                          <span className="text-base font-bold text-white">${tier.usdPrice}</span>
                        </div>

                        <div className="my-2 flex items-baseline gap-1">
                          <span className="text-2xl font-black text-amber-400">+{tier.credits}</span>
                          <span className="text-[11px] text-zinc-400">CREDITS</span>
                        </div>

                        <p className="text-[11px] text-zinc-500 leading-relaxed">{tier.description}</p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs">
                        <span className="text-zinc-400 font-bold">{xrpCost} XRP</span>
                        <span
                          className={`w-2 h-2 rounded-full ${isSelected ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-zinc-800'}`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* BIGGER TOTAL COST & ACTION BANNER */}
              <div className="pt-5 border-t border-zinc-800">
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-900 to-black border-2 border-emerald-500/50 shadow-2xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 font-mono">
                  {/* Left: Package + Massive Cost Display */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] font-bold tracking-wider uppercase">
                        Selected Package: {selectedTier.label}
                      </span>
                      <span className="text-zinc-500 text-[11px]">•</span>
                      <span className="text-zinc-400 text-xs font-semibold">
                        +{selectedTier.credits} Prompt Credits
                      </span>
                    </div>

                    <div className="flex items-baseline gap-3 pt-1">
                      <div className="text-3xl sm:text-4xl font-black text-emerald-400 tracking-tight font-mono">
                        {currentXrpCost} <span className="text-lg sm:text-xl font-bold text-zinc-300">XRP</span>
                      </div>
                      <div className="text-base sm:text-lg font-bold text-zinc-400">
                        (${selectedTier.usdPrice.toFixed(2)} <span className="text-xs text-zinc-500 font-normal">USD Total</span>)
                      </div>
                    </div>

                    <p className="text-[11px] text-zinc-500">
                      Calculated @ ${xrpPrice.priceUsd.toFixed(3)}/XRP • Real-time Mainnet conversion
                    </p>
                  </div>

                  {/* Right: Prominent Action Button */}
                  <div className="flex items-center justify-end">
                    <button
                      onClick={handleProceedToPayment}
                      className="w-full md:w-auto px-8 py-4 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-black font-black text-sm font-mono tracking-wider transition-all shadow-xl hover:shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-3 cursor-pointer"
                    >
                      <span>PROCEED TO XRPL SETTLEMENT</span>
                      <ArrowRight className="w-5 h-5 stroke-[2.5]" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Confirm 1-Click Payment */}
          {paymentStep === 'confirm' && (
            <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 font-mono space-y-5">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3>Review & Authorize XRPL Mainnet Payment</h3>
              </div>

              {/* Massive Confirmation Cost Header */}
              <div className="p-4 rounded-xl bg-black border border-emerald-500/40 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">Total Payment Due</span>
                  <span className="text-3xl font-black text-emerald-400 font-mono">{activeXrpAmount} XRP</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-white block">${selectedTier.usdPrice.toFixed(2)} USD</span>
                  <span className="text-xs font-bold text-amber-400">+{selectedTier.credits} Credits</span>
                </div>
              </div>

              <div className="space-y-2 text-xs bg-black p-4 rounded-xl border border-zinc-800">
                <div className="flex justify-between py-1 border-b border-zinc-900">
                  <span className="text-zinc-500">Package:</span>
                  <span className="text-white font-semibold">{selectedTier.label}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-900">
                  <span className="text-zinc-500">Credits to Grant:</span>
                  <span className="text-amber-400 font-bold">+{selectedTier.credits} Credits</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-900">
                  <span className="text-zinc-500">Payment Amount:</span>
                  <span className="text-white font-bold text-sm">{activeXrpAmount} XRP (${selectedTier.usdPrice} USD)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-900">
                  <span className="text-zinc-500">Invoice Memo ID:</span>
                  <span className="text-emerald-400 font-bold">{activeMemoId}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-900">
                  <span className="text-zinc-500">Paying From:</span>
                  <span className="text-zinc-300 truncate max-w-[200px]">{wallet?.address}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-zinc-500">Destination (Fee Wallet):</span>
                  <span className="text-zinc-300 truncate max-w-[200px]">{feeConfig.destinationAddress}</span>
                </div>
              </div>

              {paymentError && (
                <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{paymentError}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => setPaymentStep('select')}
                  className="px-4 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs"
                >
                  Back to Packages
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={() => setPaymentStep('manual')}
                    className="px-4 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 text-xs"
                  >
                    Pay via QR / Xaman
                  </button>

                  <button
                    onClick={handleExecute1ClickPayment}
                    className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition-all shadow-lg active:scale-95 flex items-center gap-2"
                  >
                    <Zap className="w-4 h-4 fill-black" />
                    <span>PAY {activeXrpAmount} XRP ON MAINNET</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: In-flight Paying Animation */}
          {paymentStep === 'paying' && (
            <div className="p-12 text-center font-mono space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-700 flex items-center justify-center mx-auto text-emerald-400 animate-spin">
                <RefreshCw className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-white">Submitting to XRPL Mainnet...</h3>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                Signing transaction, embedding Memo ID <code className="text-emerald-400">{activeMemoId}</code>, and awaiting validated ledger block inclusion (~3 seconds).
              </p>
            </div>
          )}

          {/* STEP 4: Manual QR / External Transfer Option */}
          {paymentStep === 'manual' && (
            <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 font-mono space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-white font-bold text-base">
                  <QrCode className="w-5 h-5 text-emerald-400" />
                  <h3>Manual XRPL Transfer / Xaman (Xumm)</h3>
                </div>
                <span className="text-base text-emerald-400 font-black">{activeXrpAmount} XRP</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* QR Code */}
                <div className="p-4 bg-black rounded-xl border border-zinc-800 flex flex-col items-center justify-center text-center space-y-2">
                  <div className="p-2 bg-white rounded-xl shadow-md">
                    {manualQrDataUrl ? (
                      <img src={manualQrDataUrl} alt="Fee Wallet QR" className="w-36 h-36 rounded" />
                    ) : (
                      <div className="w-36 h-36 bg-zinc-200 animate-pulse rounded" />
                    )}
                  </div>
                  <span className="text-[10px] text-zinc-400">Scan to Pay with Xaman</span>
                </div>

                {/* Details */}
                <div className="md:col-span-2 space-y-3 bg-black p-4 rounded-xl border border-zinc-800 text-xs">
                  {/* Destination Address */}
                  <div>
                    <label className="text-[10px] text-zinc-500 uppercase">Destination Wallet Address</label>
                    <div className="flex items-center justify-between mt-1 p-2 rounded bg-zinc-950 border border-zinc-800">
                      <span className="text-white font-mono break-all select-all font-bold">{feeConfig.destinationAddress}</span>
                      <button
                        onClick={() => handleCopy(feeConfig.destinationAddress, 'destAddr')}
                        className="p-1 text-zinc-400 hover:text-white shrink-0 ml-2"
                      >
                        {copiedLabel === 'destAddr' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Amount */}
                  <div>
                    <label className="text-[10px] text-zinc-500 uppercase">Exact XRP Amount</label>
                    <div className="flex items-center justify-between mt-1 p-2 rounded bg-zinc-950 border border-zinc-800">
                      <span className="text-amber-400 font-bold text-sm">{activeXrpAmount} XRP</span>
                      <button
                        onClick={() => handleCopy(activeXrpAmount.toString(), 'amount')}
                        className="p-1 text-zinc-400 hover:text-white shrink-0"
                      >
                        {copiedLabel === 'amount' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Memo ID */}
                  <div>
                    <label className="text-[10px] text-zinc-500 uppercase">Required Invoice Memo ID</label>
                    <div className="flex items-center justify-between mt-1 p-2 rounded bg-zinc-950 border border-emerald-800/80">
                      <span className="text-emerald-400 font-bold select-all">{activeMemoId}</span>
                      <button
                        onClick={() => handleCopy(activeMemoId, 'memo')}
                        className="p-1 text-zinc-400 hover:text-white shrink-0"
                      >
                        {copiedLabel === 'memo' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {paymentError && (
                <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{paymentError}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => setPaymentStep('select')}
                  className="px-4 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs"
                >
                  Back
                </button>

                <button
                  onClick={handleVerifyManualPayment}
                  disabled={isVerifyingManualPayment}
                  className="px-6 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-xs flex items-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isVerifyingManualPayment ? 'animate-spin' : ''}`} />
                  <span>{isVerifyingManualPayment ? 'Checking Ledger...' : 'VERIFY & CLAIM CREDITS'}</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: Success Screen */}
          {paymentStep === 'success' && (
            <div className="p-8 rounded-2xl bg-zinc-900 border border-emerald-800 text-center font-mono space-y-4 animate-in zoom-in-95 duration-200">
              <div className="w-14 h-14 rounded-2xl bg-emerald-950 border border-emerald-600 flex items-center justify-center mx-auto text-emerald-400 shadow-lg shadow-emerald-950">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <h3 className="text-lg font-bold text-white">Payment Confirmed on XRPL Mainnet!</h3>
              <p className="text-xs text-zinc-300 max-w-md mx-auto">
                Successfully credited <strong className="text-amber-400">+{selectedTier.credits} AI Prompt Credits</strong> to your local workstation.
              </p>

              {lastTxHash && (
                <div className="p-3 bg-black rounded-xl border border-zinc-800 max-w-lg mx-auto text-xs text-zinc-400 flex items-center justify-between">
                  <span className="truncate max-w-[300px]">Tx: {lastTxHash}</span>
                  <a
                    href={`https://xrpscan.com/tx/${lastTxHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-400 hover:text-blue-300 flex items-center gap-1 shrink-0 ml-2"
                  >
                    <span>XRPScan</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              <div className="flex items-center justify-center gap-3 pt-3">
                {onOpenBillingPage && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenBillingPage();
                    }}
                    className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs"
                  >
                    View Billing History
                  </button>
                )}

                <button
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-xs"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

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
