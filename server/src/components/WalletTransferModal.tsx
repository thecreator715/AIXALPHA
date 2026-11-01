import React, { useState, useEffect } from 'react';
import {
  X,
  ArrowUpRight,
  ArrowDownLeft,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  QrCode,
  Wallet,
  Lock,
  Zap,
} from 'lucide-react';
import { XRPLWalletState } from '../types';
import {
  getStoredXRPLWallet,
  saveStoredXRPLWallet,
} from '../utils/storage';
import {
  queryAccountBalances,
  sendXrpPayment,
  generateQRCodeDataUrl,
  connectWalletBySeed,
  connectWalletByAddress,
  XRPL_BASE_RESERVE_XRP,
} from '../utils/xrplService';

interface WalletTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallet: XRPLWalletState | null;
  onWalletUpdated: (wallet: XRPLWalletState | null) => void;
  initialTab?: 'receive' | 'send';
}

export const WalletTransferModal: React.FC<WalletTransferModalProps> = ({
  isOpen,
  onClose,
  wallet,
  onWalletUpdated,
  initialTab = 'receive',
}) => {
  const [activeTab, setActiveTab] = useState<'receive' | 'send'>(initialTab);
  const [copied, setCopied] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Send State
  const [recipientAddress, setRecipientAddress] = useState('');
  const [destinationTag, setDestinationTag] = useState('');
  const [sendAmountXrp, setSendAmountXrp] = useState('');
  const [sendMemo, setSendMemo] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccessTx, setSendSuccessTx] = useState<{ txHash: string; ledgerIndex: number; amount: number } | null>(null);

  // Wallet Import in modal if not connected
  const [importInput, setImportInput] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setSendError(null);
      setSendSuccessTx(null);
      if (wallet?.address) {
        generateQr(wallet.address);
        handleRefreshBalance();
      }
    }
  }, [isOpen, wallet?.address, initialTab]);

  const generateQr = async (address: string) => {
    try {
      const url = await generateQRCodeDataUrl(address, {
        width: 320,
        darkColor: '#000000',
        lightColor: '#ffffff',
      });
      setQrDataUrl(url);
    } catch (e) {
      console.error('Failed generating QR code:', e);
    }
  };

  const handleRefreshBalance = async () => {
    if (!wallet?.address) return;
    setIsRefreshing(true);
    try {
      const balances = await queryAccountBalances(wallet.address);
      const updated: XRPLWalletState = {
        ...wallet,
        totalXrp: balances.totalXrp,
        activeXrp: balances.activeXrp,
        sequence: balances.sequence,
        lastSynced: Date.now(),
      };
      saveStoredXRPLWallet(updated);
      onWalletUpdated(updated);
    } catch (e) {
      console.warn('Balance refresh failed:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleSetMaxSpend = () => {
    if (!wallet) return;
    const maxSpend = Math.max(0, parseFloat((wallet.activeXrp - 0.000012).toFixed(6)));
    setSendAmountXrp(maxSpend.toString());
  };

  const handleSetPercentSpend = (pct: number) => {
    if (!wallet) return;
    const spend = Math.max(0, parseFloat(((wallet.activeXrp * pct) - 0.000012).toFixed(6)));
    setSendAmountXrp(spend.toString());
  };

  const handleSendXrp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet) return;
    setSendError(null);
    setSendSuccessTx(null);

    const dest = recipientAddress.trim();
    if (!dest.startsWith('r') || dest.length < 25) {
      setSendError('Please enter a valid XRPL classic address starting with "r".');
      return;
    }

    const amount = parseFloat(sendAmountXrp);
    if (isNaN(amount) || amount <= 0) {
      setSendError('Please enter a valid XRP amount greater than 0.');
      return;
    }

    if (amount > wallet.activeXrp) {
      setSendError(`Insufficient spendable balance. Max active spend is ${wallet.activeXrp.toFixed(4)} XRP (1.0 XRP network reserve required).`);
      return;
    }

    if (!wallet.seed) {
      setSendError('To sign and broadcast directly, you must connect with your XRPL Secret Seed. Address-only mode cannot sign transactions.');
      return;
    }

    setIsSending(true);
    try {
      const tagNum = destinationTag.trim() ? parseInt(destinationTag.trim(), 10) : undefined;
      const res = await sendXrpPayment({
        seed: wallet.seed,
        destinationAddress: dest,
        amountXrp: amount,
        destinationTag: isNaN(tagNum as number) ? undefined : tagNum,
        memoText: sendMemo.trim() || undefined,
      });

      setSendSuccessTx({
        txHash: res.txHash,
        ledgerIndex: res.ledgerIndex,
        amount,
      });

      // Refresh balance
      await handleRefreshBalance();
      setSendAmountXrp('');
      setRecipientAddress('');
      setDestinationTag('');
      setSendMemo('');
    } catch (err: any) {
      console.error('Send payment failed:', err);
      setSendError(err.message || 'Failed to submit payment to XRPL Mainnet.');
    } finally {
      setIsSending(false);
    }
  };

  const handleImportWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = importInput.trim();
    if (!val) return;
    setImportError(null);
    setIsImporting(true);

    try {
      let state: XRPLWalletState;
      if (val.startsWith('s')) {
        state = await connectWalletBySeed(val);
      } else if (val.startsWith('r')) {
        state = await connectWalletByAddress(val);
      } else {
        throw new Error('Invalid XRPL credentials. Seed starts with "s", Address starts with "r".');
      }

      saveStoredXRPLWallet(state);
      onWalletUpdated(state);
      generateQr(state.address);
      setImportInput('');
    } catch (err: any) {
      setImportError(err.message || 'Failed to connect wallet.');
    } finally {
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col font-mono text-xs">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white text-black flex items-center justify-center font-bold shadow-md">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  XRPL Mainnet Wallet Manager
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 font-semibold">
                  LIVE MAINNET
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                SEND & RECEIVE XRP • QR CODE • PERSISTENT BALANCE
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

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 max-h-[80vh]">
          {/* Wallet Balance Card */}
          {wallet ? (
            <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400 text-[11px] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Connected Wallet</span>
                  {wallet.seed ? (
                    <span className="px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[9px]">
                      1-Click Signer Ready
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 text-[9px]">
                      Read-Only
                    </span>
                  )}
                </span>

                <button
                  onClick={handleRefreshBalance}
                  disabled={isRefreshing}
                  className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-2 py-1 rounded transition-colors"
                >
                  <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
                  <span>{isRefreshing ? 'Syncing...' : 'Refresh'}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="bg-black p-3 rounded-lg border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 uppercase block">Active Spendable</span>
                  <span className="text-xl font-black text-emerald-400 tracking-tight">
                    {wallet.activeXrp.toFixed(4)} <span className="text-xs text-zinc-400 font-normal">XRP</span>
                  </span>
                </div>
                <div className="bg-black p-3 rounded-lg border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 uppercase block">Total On-Ledger</span>
                  <span className="text-lg font-bold text-white tracking-tight">
                    {wallet.totalXrp.toFixed(4)} <span className="text-xs text-zinc-500 font-normal">XRP</span>
                  </span>
                  <p className="text-[9px] text-zinc-500 mt-0.5">1.0 XRP Base Reserve</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 text-[11px] border-t border-zinc-800/80">
                <span className="text-zinc-500 truncate max-w-[260px]">
                  {wallet.address}
                </span>
                <button
                  onClick={() => handleCopy(wallet.address, 'hdr_addr')}
                  className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                >
                  {copied === 'hdr_addr' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copied === 'hdr_addr' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3 text-center">
              <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
              <h3 className="text-sm font-bold text-white">No XRPL Wallet Connected</h3>
              <p className="text-zinc-400 text-xs max-w-md mx-auto">
                Connect your XRPL Classic Address (r...) or Secret Seed (s...) to send and receive XRP on XRPL Mainnet.
              </p>

              <form onSubmit={handleImportWallet} className="space-y-3 pt-2 max-w-md mx-auto">
                <input
                  type="password"
                  value={importInput}
                  onChange={(e) => setImportInput(e.target.value)}
                  placeholder="Paste XRPL Secret Seed (s...) or Address (r...)"
                  className="w-full bg-black border border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white font-mono"
                />

                {importError && (
                  <p className="text-red-400 text-xs">{importError}</p>
                )}

                <button
                  type="submit"
                  disabled={isImporting || !importInput.trim()}
                  className="w-full py-2.5 bg-white text-black hover:bg-zinc-200 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50"
                >
                  {isImporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                  <span>{isImporting ? 'CONNECTING TO MAINNET...' : 'CONNECT WALLET'}</span>
                </button>
              </form>
            </div>
          )}

          {wallet && (
            <>
              {/* Tab Selector */}
              <div className="flex border-b border-zinc-800 bg-black rounded-xl p-1">
                <button
                  onClick={() => setActiveTab('receive')}
                  className={`flex-1 py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${
                    activeTab === 'receive'
                      ? 'bg-zinc-800 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
                  <span>RECEIVE XRP (QR CODE)</span>
                </button>

                <button
                  onClick={() => setActiveTab('send')}
                  className={`flex-1 py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${
                    activeTab === 'send'
                      ? 'bg-zinc-800 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <ArrowUpRight className="w-4 h-4 text-blue-400" />
                  <span>SEND XRP</span>
                </button>
              </div>

              {/* RECEIVE XRP TAB */}
              {activeTab === 'receive' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex flex-col items-center text-center space-y-4">
                    {/* QR Code Container */}
                    <div className="p-3 bg-white rounded-2xl shadow-xl border-2 border-zinc-700">
                      {qrDataUrl ? (
                        <img
                          src={qrDataUrl}
                          alt="XRPL Receive Address QR Code"
                          className="w-56 h-56 rounded-lg"
                        />
                      ) : (
                        <div className="w-56 h-56 bg-zinc-200 animate-pulse flex items-center justify-center rounded-lg">
                          <QrCode className="w-12 h-12 text-zinc-500" />
                        </div>
                      )}
                    </div>

                    <div className="space-y-1 max-w-md">
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">
                        Your XRPL Classic Address
                      </span>
                      <div className="flex items-center justify-center gap-2 bg-black border border-zinc-800 rounded-xl p-2.5">
                        <span className="text-xs text-white font-mono select-all break-all">
                          {wallet.address}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2 w-full max-w-sm">
                      <button
                        onClick={() => handleCopy(wallet.address, 'rcv_addr')}
                        className="flex-1 py-2.5 bg-white text-black hover:bg-zinc-200 font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
                      >
                        {copied === 'rcv_addr' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        <span>{copied === 'rcv_addr' ? 'COPIED ADDRESS' : 'COPY ADDRESS'}</span>
                      </button>

                      <a
                        href={`https://livenet.xrpl.org/accounts/${wallet.address}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3.5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 rounded-xl flex items-center justify-center gap-1.5 transition-all"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span className="hidden sm:inline">Explorer</span>
                      </a>
                    </div>

                    <div className="text-[11px] text-zinc-500 space-y-1 pt-2 border-t border-zinc-800 w-full text-left">
                      <p className="text-zinc-400 font-semibold">• Mainnet Network Target: XRPL Mainnet</p>
                      <p>• No Destination Tag required when receiving directly to your personal non-custodial address.</p>
                      <p>• Incoming funds appear automatically on the next validated ledger (3-5 seconds).</p>
                    </div>
                  </div>
                </div>
              )}

              {/* SEND XRP TAB */}
              {activeTab === 'send' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <form onSubmit={handleSendXrp} className="space-y-4">
                    {/* Destination Address */}
                    <div>
                      <label className="text-[11px] text-zinc-300 font-bold block mb-1">
                        Recipient XRPL Classic Address (r...) //
                      </label>
                      <input
                        type="text"
                        value={recipientAddress}
                        onChange={(e) => setRecipientAddress(e.target.value)}
                        placeholder="e.g. rEb8TK3gBgk5auZkwc6sHnwrGVJH8DuaLh"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-white font-mono"
                      />
                    </div>

                    {/* Amount & Fast Selectors */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] text-zinc-300 font-bold">
                          Amount in XRP //
                        </label>
                        <span className="text-[10px] text-zinc-500">
                          Active Spendable: <strong className="text-emerald-400">{wallet.activeXrp.toFixed(4)} XRP</strong>
                        </span>
                      </div>

                      <div className="relative">
                        <input
                          type="number"
                          step="0.000001"
                          min="0"
                          value={sendAmountXrp}
                          onChange={(e) => setSendAmountXrp(e.target.value)}
                          placeholder="0.000000"
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white font-bold placeholder-zinc-600 focus:outline-none focus:border-white font-mono"
                        />
                        <span className="absolute right-3 top-2.5 text-xs font-bold text-zinc-400">XRP</span>
                      </div>

                      {/* Percent Quick Buttons */}
                      <div className="flex gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => handleSetPercentSpend(0.25)}
                          className="flex-1 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg text-[10px] border border-zinc-800 transition-colors"
                        >
                          25%
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetPercentSpend(0.5)}
                          className="flex-1 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg text-[10px] border border-zinc-800 transition-colors"
                        >
                          50%
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetPercentSpend(0.75)}
                          className="flex-1 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg text-[10px] border border-zinc-800 transition-colors"
                        >
                          75%
                        </button>
                        <button
                          type="button"
                          onClick={handleSetMaxSpend}
                          className="flex-1 py-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 rounded-lg text-[10px] font-bold transition-colors"
                        >
                          MAX SPEND
                        </button>
                      </div>
                    </div>

                    {/* Destination Tag & Memo (Optional) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-zinc-400 block mb-1">
                          Destination Tag (Optional)
                        </label>
                        <input
                          type="number"
                          value={destinationTag}
                          onChange={(e) => setDestinationTag(e.target.value)}
                          placeholder="e.g. 100234"
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 font-mono"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-zinc-400 block mb-1">
                          Invoice / Memo Note (Optional)
                        </label>
                        <input
                          type="text"
                          value={sendMemo}
                          onChange={(e) => setSendMemo(e.target.value)}
                          placeholder="e.g. Payment memo"
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 font-mono"
                        />
                      </div>
                    </div>

                    {sendError && (
                      <div className="p-3 rounded-xl bg-red-950/70 border border-red-800 text-red-200 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                        <span>{sendError}</span>
                      </div>
                    )}

                    {sendSuccessTx && (
                      <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-200 space-y-2">
                        <div className="flex items-center gap-2 font-bold text-sm">
                          <Check className="w-5 h-5 text-emerald-400" />
                          <span>Transaction Validated on Mainnet!</span>
                        </div>
                        <p className="text-xs">
                          Successfully transferred <strong>{sendSuccessTx.amount} XRP</strong> on Ledger Index #{sendSuccessTx.ledgerIndex}.
                        </p>
                        <a
                          href={`https://livenet.xrpl.org/transactions/${sendSuccessTx.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:underline pt-1"
                        >
                          <span>View on XRPL Explorer</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    )}

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={isSending || !sendAmountXrp || !recipientAddress}
                      className="w-full py-3 bg-white text-black hover:bg-zinc-200 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50"
                    >
                      {isSending ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-black" />
                          <span>SIGNING & BROADCASTING TO XRPL MAINNET...</span>
                        </>
                      ) : (
                        <>
                          <ArrowUpRight className="w-4 h-4" />
                          <span>SEND XRP NOW</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
