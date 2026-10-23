import React, { useState, useEffect } from 'react';
import { useWholesale } from '../context/WholesaleContext';
import {
  Database,
  Cloud,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Copy,
  Check,
  Server,
  Radio,
  FileText,
  UploadCloud,
  Download,
  Trash2,
  ExternalLink,
  Laptop,
  Smartphone,
  Shield,
  Layers,
  Sparkles,
  X,
  Eye,
  Lock,
} from 'lucide-react';
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  isSupabaseConfigured,
  testSupabaseConnection,
  DEFAULT_SUPABASE_URL,
  DEFAULT_SUPABASE_ANON_KEY,
} from '../services/supabaseClient';
import {
  syncAllToSupabase,
  fetchFromSupabase,
  SUPABASE_SQL_SCHEMA,
} from '../services/supabaseSyncService';
import {
  subscribeToDevicePresence,
  fetchAllDeviceStatus,
  LiveDevicePresence,
  getOrCreateDeviceId,
} from '../services/supabasePresenceService';
import {
  uploadToSupabaseStorage,
  listSupabaseDocuments,
  deleteSupabaseDocument,
  ErpDocumentRecord,
} from '../services/supabaseStorageService';
import { formatCurrency } from '../utils/translations';

interface SupabaseSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'connect' | 'sync' | 'presence' | 'storage';
}

export const SupabaseSyncModal: React.FC<SupabaseSyncModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'connect',
}) => {
  const {
    language,
    currentUser,
    orders,
    products,
    retailers,
    suppliers,
    supplierLedger,
    cashTransfers,
    capitalTransactions,
    bankAccounts,
    replacements,
    expenses,
    companyReturns,
    activityLogs,
    users,
    restoreFromSupabaseNow,
  } = useWholesale();

  const isBn = language === 'bn';

  // Tabs
  const [activeTab, setActiveTab] = useState<'connect' | 'sync' | 'presence' | 'storage'>(initialTab);

  // Connection settings
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latencyMs?: number } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Presence state
  const [liveDevices, setLiveDevices] = useState<LiveDevicePresence[]>([]);
  const [myDeviceId, setMyDeviceId] = useState<string>('');

  // Storage state
  const [documents, setDocuments] = useState<ErpDocumentRecord[]>([]);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [selectedDocCategory, setSelectedDocCategory] = useState<'invoice' | 'memo' | 'receipt' | 'photo'>('invoice');
  const [docRefNo, setDocRefNo] = useState('');

  // Load config on open
  useEffect(() => {
    if (isOpen) {
      const cfg = getSupabaseConfig();
      setUrl(cfg.url || '');
      setAnonKey(cfg.anonKey || '');
      setIsConfigured(isSupabaseConfigured());
      setMyDeviceId(getOrCreateDeviceId());

      const last = localStorage.getItem('ws_last_supabase_sync');
      if (last) setLastSyncTime(last);

      // Refresh documents
      listSupabaseDocuments().then(setDocuments).catch(() => {});

      // Subscribe to presence
      const unsubscribe = subscribeToDevicePresence((devices) => {
        setLiveDevices(devices);
      });

      // Also fetch historical devices
      fetchAllDeviceStatus(currentUser?.phone || '01937200635').then((devs) => {
        if (devs.length > 0) {
          setLiveDevices((prev) => {
            const map = new Map<string, LiveDevicePresence>();
            devs.forEach((d) => map.set(d.deviceId, d));
            prev.forEach((d) => map.set(d.deviceId, d));
            return Array.from(map.values());
          });
        }
      });

      return () => {
        unsubscribe();
      };
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testSupabaseConnection(url, anonKey);
      setTestResult(res);
      if (res.success) {
        setIsConfigured(true);
      }
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveConfig = () => {
    const ok = saveSupabaseConfig(url, anonKey);
    if (ok) {
      setIsConfigured(isSupabaseConfigured());
      setTestResult({
        success: true,
        message: isBn
          ? 'সুপাবেজ সংযোগ সফলভাবে সংরক্ষণ করা হয়েছে!'
          : 'Supabase configuration saved successfully!',
      });
    } else {
      setTestResult({
        success: false,
        message: isBn ? 'সেভ করতে ব্যর্থ হয়েছে।' : 'Failed to save configuration.',
      });
    }
  };

  const handleLoadDefaultConfig = () => {
    setUrl(DEFAULT_SUPABASE_URL);
    setAnonKey(DEFAULT_SUPABASE_ANON_KEY);
    saveSupabaseConfig(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY);
    setIsConfigured(true);
    setTestResult({
      success: true,
      message: isBn
        ? 'মাতৃছায়া টেলিকম ডিফল্ট সুপাবেজ ক্লাউড সফলভাবে কানেক্ট হয়েছে!'
        : 'Matrichhaya Telecom default cloud connected successfully!',
    });
  };

  const handleCopySql = () => {
    try {
      navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2500);
    } catch (e) {}
  };

  const handleSyncAllToSupabase = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const bundle = {
        users,
        products,
        orders,
        retailers,
        suppliers,
        supplierLedger,
        cashTransfers,
        capitalTransactions,
        bankAccounts,
        replacements,
        expenses,
        companyReturns,
        activityLogs,
      };

      const res = await syncAllToSupabase(
        bundle,
        currentUser?.adminPhone || currentUser?.phone || '01937200635',
        currentUser?.name || 'Admin'
      );

      setSyncFeedback({
        success: res.success,
        message: res.message,
      });

      if (res.success) {
        setLastSyncTime(new Date().toISOString());
      }
    } catch (err: any) {
      setSyncFeedback({
        success: false,
        message: err.message || (isBn ? 'সিঙ্ক ব্যর্থ হয়েছে।' : 'Sync failed.'),
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRestoreFromSupabase = async () => {
    if (!window.confirm(isBn ? 'সুপাবেজ ক্লাউড থেকে পূর্বের হিসাব রিস্টোর করতে চান?' : 'Restore ERP state from Supabase?')) {
      return;
    }

    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const res = await restoreFromSupabaseNow();
      setSyncFeedback({
        success: res.success,
        message: res.message,
      });
    } catch (err: any) {
      setSyncFeedback({
        success: false,
        message: err.message || 'রিস্টোর করতে সমস্যা হয়েছে।',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingDoc(true);
    try {
      const res = await uploadToSupabaseStorage(
        file,
        file.name,
        selectedDocCategory,
        docRefNo || undefined,
        currentUser?.phone || '01937200635',
        currentUser?.name || 'Admin'
      );

      if (res.success) {
        const updated = await listSupabaseDocuments();
        setDocuments(updated);
        setDocRefNo('');
      }
      alert(res.message);
    } catch (err: any) {
      alert(`আপলোড ব্যর্থ: ${err.message}`);
    } finally {
      setIsUploadingDoc(false);
      e.target.value = '';
    }
  };

  const handleDeleteDoc = async (doc: ErpDocumentRecord) => {
    if (!window.confirm(isBn ? `"${doc.fileName}" ডিলিট করতে চান?` : 'Delete this file?')) return;
    const ok = await deleteSupabaseDocument(doc.id, doc.storagePath);
    if (ok) {
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200 font-sans">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-950/50">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white">
                  {isBn ? 'সুপাবেজ (Supabase) ক্লাউড ও রিয়েল-টাইম হাব' : 'Supabase Cloud & Realtime Hub'}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>{isConfigured ? (isBn ? 'সক্রিয়' : 'Active') : (isBn ? 'সেটআপ প্রয়োজন' : 'Setup Required')}</span>
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {isBn
                  ? 'গুগল ড্রাইভ ও ফায়ারবেস লিমিট ছাড়া আনলিমিটেড ফ্রি PostgreSQL ডাটাবেজ, স্টোরেজ ও লাইভ ডিভাইস ট্র্যাকিং'
                  : 'Free PostgreSQL database, storage & live device presence without Google limits'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center px-4 bg-slate-950/70 border-b border-slate-800/80 overflow-x-auto gap-2 py-2 shrink-0">
          <button
            onClick={() => setActiveTab('connect')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition shrink-0 ${
              activeTab === 'connect'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>{isBn ? '১. সুপাবেজ কানেকশন' : '1. Connection'}</span>
          </button>

          <button
            onClick={() => setActiveTab('sync')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition shrink-0 ${
              activeTab === 'sync'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{isBn ? '২. ডেটা মাইগ্রেশন ও ব্যাকআপ' : '2. Data Migration'}</span>
          </button>

          <button
            onClick={() => setActiveTab('presence')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition shrink-0 ${
              activeTab === 'presence'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>{isBn ? '৩. রিয়েল-টাইম ডিভাইস (Presence)' : '3. Live Presence'}</span>
            <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-slate-800 font-mono text-emerald-400">
              {liveDevices.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('storage')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition shrink-0 ${
              activeTab === 'storage'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>{isBn ? '৪. পেন্ডিং ফাইল ও স্টোরেজ' : '4. Storage & Files'}</span>
            <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-slate-800 font-mono text-sky-400">
              {documents.length}
            </span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* TAB 1: CONNECTION */}
          {activeTab === 'connect' && (
            <div className="space-y-4">
              {/* Highlight Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/60 to-slate-900 border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      {isBn ? 'সম্পূর্ণ ফ্রি Supabase ক্লাউড ডেটাবেজ' : 'Free Supabase Cloud Database'}
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      {isBn
                        ? 'ডুয়েল কারেন্সি বা ক্রেডিট কার্ড ছাড়াই supabase.com এ ফ্রি একাউন্ট খুলে আনলিমিটেড ব্যবহার করতে পারবেন।'
                        : 'No credit card needed. Runs 100% free with unlimited PostgreSQL queries on Supabase.'}
                    </p>
                  </div>
                </div>
                <a
                  href="https://supabase.com/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition shrink-0 shadow-lg"
                >
                  <span>{isBn ? 'সুপাবেজ ওপেন করুন' : 'Open Supabase'}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* Form */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3.5">
                <h4 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                  <Server className="w-4 h-4 text-emerald-400" />
                  <span>{isBn ? 'সুপাবেজ প্রজেক্ট ক্রেডেনশিয়াল:' : 'Project Credentials:'}</span>
                </h4>

                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-300">
                    <span>{isBn ? 'প্রজেক্ট URL (Project URL)' : 'Project URL'}</span>
                    <span className="text-[10px] text-slate-500 ml-1">
                      (e.g. https://your-project.supabase.co)
                    </span>
                  </label>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://xyzcompany.supabase.co"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 hover:border-slate-600 focus:border-emerald-500 rounded-xl text-xs font-mono text-white placeholder-slate-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-300">
                    <span>{isBn ? 'Anon Public API Key' : 'Anon Public API Key'}</span>
                    <span className="text-[10px] text-slate-500 ml-1">
                      (Project Settings -&gt; API -&gt; anon public)
                    </span>
                  </label>
                  <input
                    type="password"
                    value={anonKey}
                    onChange={(e) => setAnonKey(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 hover:border-slate-600 focus:border-emerald-500 rounded-xl text-xs font-mono text-white placeholder-slate-500 focus:outline-none"
                  />
                </div>

                {/* Feedback */}
                {testResult && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                      testResult.success
                        ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-bold">{testResult.message}</p>
                      {testResult.latencyMs && (
                        <p className="text-[10px] opacity-75 mt-0.5 font-mono">
                          Latency: {testResult.latencyMs}ms
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTesting || !url || !anonKey}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isTesting ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    <span>{isBn ? 'কানেকশন টেস্ট করুন' : 'Test Connection'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveConfig}
                    disabled={!url || !anonKey}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-md shadow-emerald-950/60"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{isBn ? 'সেভ ও সংযোগ চালু করুন' : 'Save & Connect'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleLoadDefaultConfig}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-teal-700 to-emerald-700 hover:from-teal-600 hover:to-emerald-600 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md"
                    title="ডিফল্ট প্রজেক্ট URL ও Key লোড করুন"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-teal-300" />
                    <span>{isBn ? '⚡ অটো-কানেক্ট ডিফল্ট ক্লাউড' : 'Auto-Connect Default Cloud'}</span>
                  </button>
                </div>
              </div>

              {/* 3-Tier Zero-Hassle Architecture Banner */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-emerald-500/40 space-y-2 text-xs">
                <div className="flex items-center gap-2 font-bold text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{isBn ? 'সুপাবেজ ক্লাউড ও রিয়েল-টাইম ৩-স্তর ডেটা আর্কিটেকচার:' : 'Supabase Cloud & 3-Tier Data Architecture:'}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="font-bold text-sky-400 block flex items-center gap-1">
                      <span>⚡ ১ম স্তর: লোকাল স্টোর</span>
                    </span>
                    <span className="text-slate-400 text-[10px] block mt-0.5">
                      তাত্ক্ষণিক রেসপন্স ও অফলাইনেও নির্বিঘ্নে সেল করার নিশ্চয়তা।
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40">
                    <span className="font-bold text-emerald-300 block flex items-center gap-1">
                      <span>🌐 ২য় স্তর: সুপাবেজ ক্লাউড (প্রধান)</span>
                    </span>
                    <span className="text-slate-300 text-[10px] block mt-0.5">
                      সব ডিভাইসে লাইভ রিয়েল-টাইম সিঙ্ক, অটো-সাইন ও স্থায়ী PostgreSQL ডাটাবেজ।
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="font-bold text-amber-400 block flex items-center gap-1">
                      <span>☁️ ৩য় স্তর: গুগল ড্রাইভ (ঐচ্ছিক)</span>
                    </span>
                    <span className="text-slate-400 text-[10px] block mt-0.5">
                      কোনো বাধা বা কোটা সমস্যা ছাড়াই প্রয়োজনে ম্যানুয়াল এক্সটার্নাল ব্যাকআপ।
                    </span>
                  </div>
                </div>
              </div>

              {/* One-Click SQL Schema Script */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-sky-400" />
                    <h4 className="text-xs font-bold text-white">
                      {isBn ? 'সুপাবেজ SQL সেটআপ স্ক্রিপ্ট (১-ক্লিক কপি):' : 'Supabase SQL Setup Script:'}
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopySql}
                    className="px-3 py-1 rounded-lg bg-sky-950 hover:bg-sky-900 border border-sky-500/40 text-sky-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedSql ? (isBn ? 'কপি হয়েছে!' : 'Copied!') : (isBn ? 'SQL কপি করুন' : 'Copy SQL')}</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {isBn
                    ? 'সুপাবেজ ড্যাশবোর্ডে গিয়ে বাম পাশের "SQL Editor" এ ক্লিক করে এই কোডটি পেস্ট করে "Run" দিন। এটি টেবিল, ইনডেক্স ও রিয়েল-টাইম কনফিগার করে দিবে।'
                    : 'Paste this script into the Supabase SQL Editor and hit "Run" to initialize tables and realtime policies.'}
                </p>
                <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 text-[10px] font-mono text-slate-300 max-h-32 overflow-y-auto">
                  <pre>{SUPABASE_SQL_SCHEMA}</pre>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DATA MIGRATION & SYNC */}
          {activeTab === 'sync' && (
            <div className="space-y-4">
              {/* Data Summary Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">{isBn ? 'বিক্রয় চালান (Orders)' : 'Orders'}</span>
                  <span className="text-lg font-bold font-mono text-emerald-400">{orders.length}</span>
                  <span className="text-[10px] text-slate-500 block truncate">
                    {formatCurrency(orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0), language)}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">{isBn ? 'রিটেইলার / বাকি খাতা' : 'Retailers'}</span>
                  <span className="text-lg font-bold font-mono text-sky-400">{retailers.length}</span>
                  <span className="text-[10px] text-slate-500 block truncate">
                    {formatCurrency(retailers.reduce((sum, r) => sum + (r.outstandingDue || 0), 0), language)}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">{isBn ? 'পণ্যের স্টক' : 'Products'}</span>
                  <span className="text-lg font-bold font-mono text-amber-400">{products.length}</span>
                  <span className="text-[10px] text-slate-500 block">
                    {products.reduce((sum, p) => sum + (p.stockQuantity || 0), 0)} {isBn ? 'পিস' : 'pcs'}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">{isBn ? 'ডিস্ট্রিবিউটর লেজার' : 'Suppliers'}</span>
                  <span className="text-lg font-bold font-mono text-purple-400">{suppliers.length}</span>
                  <span className="text-[10px] text-slate-500 block">{supplierLedger.length} {isBn ? 'চালান' : 'entries'}</span>
                </div>
              </div>

              {/* Status & Last Sync */}
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-emerald-400" />
                  <span className="text-slate-300 font-medium">
                    {isBn ? 'সর্বশেষ সুপাবেজ সিঙ্ক:' : 'Last Supabase Sync:'}
                  </span>
                  <span className="font-mono text-emerald-400 font-bold">
                    {lastSyncTime ? new Date(lastSyncTime).toLocaleString() : (isBn ? 'এখনও সিঙ্ক হয়নি' : 'Not yet synced')}
                  </span>
                </div>
              </div>

              {/* Sync Feedback */}
              {syncFeedback && (
                <div
                  className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                    syncFeedback.success
                      ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
                  }`}
                >
                  {syncFeedback.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <p className="font-bold">{syncFeedback.message}</p>
                </div>
              )}

              {/* Big Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleSyncAllToSupabase}
                  disabled={isSyncing}
                  className="p-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-xl shadow-emerald-950/60 flex items-center justify-center gap-2.5 transition active:scale-98 cursor-pointer disabled:opacity-50"
                >
                  {isSyncing ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <UploadCloud className="w-5 h-5" />
                  )}
                  <div className="text-left">
                    <span className="block font-black text-sm">
                      {isBn ? 'পূর্বের সমস্ত হিসাব সুপাবেজে আপলোড করুন' : 'Upload All Records to Supabase'}
                    </span>
                    <span className="block text-[10px] font-normal opacity-90">
                      {isBn ? 'বিক্রয়, বাকি, ক্যাশ, প্রোডাক্ট ও ইউজার ডেটা' : 'Preserves 100% of sales, dues & cash history'}
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleRestoreFromSupabase}
                  disabled={isSyncing}
                  className="p-4 rounded-2xl bg-gradient-to-r from-sky-700 to-indigo-700 hover:from-sky-600 hover:to-indigo-600 text-white font-bold text-xs shadow-xl shadow-sky-950/60 flex items-center justify-center gap-2.5 transition active:scale-98 cursor-pointer disabled:opacity-50"
                >
                  {isSyncing ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <Download className="w-5 h-5" />
                  )}
                  <div className="text-left">
                    <span className="block font-black text-sm">
                      {isBn ? 'সুপাবেজ থেকে ডেটা রিস্টোর করুন' : 'Restore Data from Supabase'}
                    </span>
                    <span className="block text-[10px] font-normal opacity-90">
                      {isBn ? 'নতুন ব্রাউজার বা ডিভাইসে পূর্বের হিসাব ফেরত নিন' : 'Pull cloud state to this device'}
                    </span>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: REALTIME PRESENCE */}
          {activeTab === 'presence' && (
            <div className="space-y-3.5">
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <span className="font-bold text-white">
                    {isBn ? 'সুপাবেজ রিয়েল-টাইম প্রেজেন্স চ্যানেল সক্রিয়' : 'Supabase Realtime Channel Active'}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  {liveDevices.length} {isBn ? 'ডিভাইস ট্র্যাক হচ্ছে' : 'devices tracked'}
                </span>
              </div>

              {liveDevices.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-slate-950/60 border border-slate-800">
                  <Radio className="w-8 h-8 text-slate-600 mx-auto mb-2 animate-pulse" />
                  <p className="text-xs text-slate-400">
                    {isBn ? 'কোনো ডিভাইস সক্রিয় নেই।' : 'No active devices currently online.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {liveDevices.map((dev) => (
                    <div
                      key={dev.deviceId}
                      className={`p-3.5 rounded-2xl border transition ${
                        dev.deviceId === myDeviceId
                          ? 'bg-emerald-950/40 border-emerald-500/40'
                          : 'bg-slate-950 border-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300">
                            {dev.platform === 'mobile' ? (
                              <Smartphone className="w-4 h-4 text-sky-400" />
                            ) : (
                              <Laptop className="w-4 h-4 text-emerald-400" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-white">{dev.name}</span>
                              {dev.deviceId === myDeviceId && (
                                <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-emerald-500/20 text-emerald-400 font-bold">
                                  {isBn ? 'এই ডিভাইস' : 'This Device'}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">{dev.phone}</span>
                            {dev.email && (
                              <span className="text-[9px] text-slate-500 block truncate font-mono">
                                📧 {dev.email}
                              </span>
                            )}
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                            dev.isOnline
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              dev.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                            }`}
                          ></span>
                          <span>{dev.isOnline ? (isBn ? 'অনলাইন' : 'Online') : (isBn ? 'অফলাইন' : 'Offline')}</span>
                        </span>
                      </div>

                      <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
                        <span className="capitalize">{dev.role} • {dev.platform}</span>
                        <span className="font-mono">
                          {isBn ? 'সর্বশেষ:' : 'Active:'} {new Date(dev.lastSeen).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: STORAGE & PENDING FILES */}
          {activeTab === 'storage' && (
            <div className="space-y-4">
              {/* Upload Card */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <UploadCloud className="w-4 h-4 text-emerald-400" />
                    <span>{isBn ? 'পেন্ডিং ইনভয়েস ও মেমো আপলোড করুন:' : 'Upload Pending Documents:'}</span>
                  </h4>
                  <span className="text-[10px] font-mono text-slate-400">
                    Bucket: erp-documents
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      {isBn ? 'ডকুমেন্টের ধরণ' : 'Category'}
                    </label>
                    <select
                      value={selectedDocCategory}
                      onChange={(e: any) => setSelectedDocCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                    >
                      <option value="invoice">📄 {isBn ? 'ইনভয়েস চালান PDF' : 'Sales Invoice PDF'}</option>
                      <option value="memo">📝 {isBn ? 'মেমো স্ক্যান / রসিদ' : 'Memo Scan'}</option>
                      <option value="receipt">🧾 {isBn ? 'পেমেন্ট ভাউচার' : 'Payment Voucher'}</option>
                      <option value="photo">📸 {isBn ? 'পণ্য / স্টক ছবি' : 'Stock Photo'}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      {isBn ? 'রেফারেন্স / ইনভয়েস নম্বর (ঐচ্ছিক)' : 'Reference / Invoice No'}
                    </label>
                    <input
                      type="text"
                      value={docRefNo}
                      onChange={(e) => setDocRefNo(e.target.value)}
                      placeholder="INV-20261022-001"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-white placeholder-slate-500"
                    />
                  </div>
                </div>

                <div className="pt-1">
                  <label className="flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-emerald-500/50 bg-emerald-950/20 hover:bg-emerald-950/30 text-emerald-300 text-xs font-bold cursor-pointer transition">
                    <UploadCloud className="w-4 h-4" />
                    <span>
                      {isUploadingDoc
                        ? (isBn ? 'আপলোড হচ্ছে...' : 'Uploading...')
                        : (isBn ? 'ফাইল নির্বাচন করে আপলোড করুন' : 'Select File to Upload')}
                    </span>
                    <input
                      type="file"
                      onChange={handleFileUpload}
                      disabled={isUploadingDoc}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Document List */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-300">
                  {isBn ? 'সংরক্ষিত পেন্ডিং ফাইলসমূহ:' : 'Saved Pending Documents:'}
                </h4>

                {documents.length === 0 ? (
                  <div className="p-6 text-center rounded-2xl bg-slate-950/50 border border-slate-800 text-xs text-slate-500">
                    {isBn ? 'কোনো পেন্ডিং ফাইল আপলোড করা হয়নি।' : 'No pending documents found.'}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                          <div className="truncate">
                            <span className="font-bold text-white block truncate">{doc.fileName}</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {doc.category.toUpperCase()} • {(doc.fileSize / 1024).toFixed(1)} KB • {new Date(doc.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {doc.publicUrl && (
                            <a
                              href={doc.publicUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                              title="View Document"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteDoc(doc)}
                            className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-500/30 text-rose-300 transition"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              {isBn
                ? 'মাতৃছায়া টেলিকম ইআরপি • আজীবন ফ্রি ও নিরাপদ ক্লাউড সিঙ্ক'
                : 'Matrichhaya Telecom ERP • Free & Secure Cloud Sync'}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition cursor-pointer"
          >
            {isBn ? 'বন্ধ করুন' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
