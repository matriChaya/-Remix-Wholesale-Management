import React, { useState, useEffect } from 'react';
import { useWholesale } from '../context/WholesaleContext';
import {
  Smartphone,
  Laptop,
  Monitor,
  RefreshCw,
  X,
  Shield,
  Truck,
  Store,
  UploadCloud,
  FileDown,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Layers,
  ChevronDown,
  ChevronUp,
  Download,
  Info,
  Database,
  FileText,
  Eye,
  Check,
  CheckCircle,
  FileCheck,
} from 'lucide-react';
import { formatCurrency } from '../utils/translations';
import { listSupabaseDocuments, ErpDocumentRecord } from '../services/supabaseStorageService';

interface ConnectedDevicesFleetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConnectedDevicesFleetModal: React.FC<ConnectedDevicesFleetModalProps> = ({ isOpen, onClose }) => {
  const {
    language,
    currentRole,
    registeredDevices,
    remotePendingDevices,
    refreshRegisteredDevices,
    adminUploadDevicePending,
    adminClearDevicePending,
    sendPresenceHeartbeat,
    uploadPendingQueueToGoogleDriveNow,
    pushDriveToCloudAccount,
    isGoogleDriveConnected,
    hasCloudQuotaNotice,
    openSupabaseModal,
    isAutoSigning,
    toggleAutoSigning,
    drainPendingFilesNow,
  } = useWholesale();

  const [storedDocs, setStoredDocs] = useState<ErpDocumentRecord[]>([]);
  const [showStoredDocs, setShowStoredDocs] = useState<boolean>(false);
  const [expandedDeviceId, setExpandedDeviceId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string; downloadUrl?: string } | null>(null);

  const loadStoredDocuments = async () => {
    try {
      const docs = await listSupabaseDocuments();
      setStoredDocs(docs);
    } catch {}
  };

  useEffect(() => {
    if (isOpen) {
      loadStoredDocuments();
    }
  }, [isOpen]);

  const handleDrainAllNow = async () => {
    setIsProcessing(true);
    setFeedback(null);
    try {
      const count = await drainPendingFilesNow();
      await loadStoredDocuments();
      await refreshRegisteredDevices();
      setFeedback({
        type: 'success',
        message: language === 'bn'
          ? `সফল হয়েছে! পেন্ডিং ফাইলগুলো স্বয়ংক্রিয়ভাবে ডিজিটালি সাইন হয়ে পেরেন্টস ক্লাউড স্টোরেজে সফলভাবে সংরক্ষিত হয়েছে।`
          : `Success! Pending files were digitally signed and saved directly to Parent Cloud Storage.`,
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'পেরেন্টস স্টোরেজে সিঙ্ক করতে সমস্যা হয়েছে।',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBufferAllToDrive = async () => {
    setIsProcessing(true);
    setFeedback(null);
    try {
      const res = await uploadPendingQueueToGoogleDriveNow();
      setFeedback({
        type: res.success ? 'success' : 'error',
        message: res.message,
      });
      await refreshRegisteredDevices();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'গুগল ড্রাইভে পেন্ডিং ফাইল আপলোড করতে সমস্যা হয়েছে।',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePushAllToCloud = async () => {
    setIsProcessing(true);
    setFeedback(null);
    try {
      const res = await pushDriveToCloudAccount();
      setFeedback({
        type: res.success ? 'success' : 'error',
        message: res.message,
      });
      await refreshRegisteredDevices();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'ক্লাউডে সিঙ্ক করতে সমস্যা হয়েছে।',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  const isBn = language === 'bn';
  const adminPhone = '01937200635';

  const handleRefresh = async () => {
    setIsProcessing(true);
    try {
      await sendPresenceHeartbeat();
      await refreshRegisteredDevices();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUploadPending = async (deviceId: string, devName: string) => {
    setIsProcessing(true);
    setFeedback(null);
    try {
      const res = await adminUploadDevicePending(deviceId);
      if (res.success) {
        setFeedback({
          type: 'success',
          message: res.message || `${devName}-এর পেন্ডিং ফাইল সফলভাবে আপলোড সম্পন্ন হয়েছে!`,
        });
        await refreshRegisteredDevices();
      } else {
        setFeedback({
          type: 'error',
          message: res.message || 'আপলোড ব্যর্থ হয়েছে।',
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'আপলোড প্রক্রিয়ায় সমস্যা হয়েছে।',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearToBackup = async (deviceId: string, devName: string) => {
    if (!window.confirm(isBn ? `${devName}-এর সকল পেন্ডিং ফাইল ক্লিয়ার করে ইমার্জেন্সি ব্যাকআপে নিতে চান?` : `Clear pending files of ${devName} to emergency backup?`)) {
      return;
    }
    setIsProcessing(true);
    setFeedback(null);
    try {
      const res = await adminClearDevicePending(deviceId);
      if (res.success) {
        setFeedback({
          type: 'success',
          message: res.message || `${devName}-এর পেন্ডিং ফাইল সফলভাবে ক্লিয়ার করে ব্যাকআপে রাখা হয়েছে।`,
        });
        await refreshRegisteredDevices();
      } else {
        setFeedback({
          type: 'error',
          message: res.message || 'ক্লিয়ার করতে ব্যর্থ হয়েছে।',
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'ক্লিয়ার করতে সমস্যা হয়েছে।',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Merge registered devices with pending devices for full fleet visibility
  const allDevices = (registeredDevices || []).map((dev) => {
    const pendingDev = (remotePendingDevices || []).find((p) => p.deviceId === dev.deviceId);
    const count = pendingDev?.pendingFilesCount || dev.pendingFilesCount || 0;
    const items = pendingDev?.pendingItems || dev.pendingItems || [];
    return {
      ...dev,
      pendingFilesCount: count,
      pendingItems: items,
    };
  });

  const totalPendingCount = allDevices.reduce((sum, d) => sum + (d.pendingFilesCount || 0), 0);
  const onlineCount = allDevices.filter((d) => d.isOnline).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="px-5 py-4 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-950/60 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>{isBn ? 'কানেক্টেড ডিভাইস ও পেন্ডিং ফাইলস কন্ট্রোল' : 'Connected Devices & Pending Files'}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-purple-900/60 text-purple-300 border border-purple-700/50">
                  {allDevices.length} {isBn ? 'ডিভাইস' : 'Devices'}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {isBn
                  ? `এডমিন নাম্বার (${adminPhone})-এর অধীনে মোবাইল, কম্পিউটার ও ক্যাশ কাউন্টারের লাইভ উপস্থিতি ও অফলাইন ফাইল ম্যানেজমেন্ট`
                  : `Real-time staff device tracking and pending offline files registry for Admin ${adminPhone}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isProcessing}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition disabled:opacity-50 cursor-pointer"
              title={isBn ? 'রিফ্রেশ করুন' : 'Refresh'}
            >
              <RefreshCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`mx-5 mt-4 p-3 rounded-xl border flex items-center justify-between gap-2 text-xs font-semibold ${
              feedback.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                : 'bg-rose-950/60 border-rose-500/40 text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />}
              <span>{feedback.message}</span>
            </div>
            {feedback.downloadUrl && (
              <a
                href={feedback.downloadUrl}
                download
                className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-[11px] flex items-center gap-1 shrink-0"
              >
                <Download className="w-3 h-3" />
                <span>{isBn ? 'ব্যাকআপ ডাউনলোড' : 'Download Backup'}</span>
              </a>
            )}
          </div>
        )}

        {/* Supabase Realtime Presence & Storage Integration Card */}
        <div className="mx-5 mt-4 p-3.5 rounded-xl bg-gradient-to-r from-emerald-950/70 via-slate-900 to-teal-950/70 border border-emerald-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
          <div className="flex items-start gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>{isBn ? 'সুপাবেজ রিয়েল-টাইম ডিভাইস প্রেজেন্স ও ফাইল স্টোরেজ' : 'Supabase Realtime Presence & Storage'}</span>
                <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-emerald-500/20 text-emerald-300 font-bold">
                  {isBn ? 'WebSocket Presence' : 'Live WS'}
                </span>
              </h4>
              <p className="text-[11px] text-slate-300 mt-0.5">
                {isBn
                  ? 'কোনো কর্মী ব্রাউজার বা অ্যাপ বন্ধ করলেই স্বয়ংক্রিয়ভাবে অফলাইন দেখাবে। পেন্ডিং ফাইলগুলো সুপাবেজে আপলোড করতে পারেন।'
                  : 'Instant Online / Offline tracking via Supabase Realtime channels.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onClose();
              openSupabaseModal('presence');
            }}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shrink-0 flex items-center gap-1.5 shadow-md cursor-pointer"
          >
            <Database className="w-3.5 h-3.5" />
            <span>{isBn ? 'লাইভ চ্যানেল দেখুন' : 'View Live Presence'}</span>
          </button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-3 px-5 pt-4">
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-950/80 text-emerald-400 flex items-center justify-center font-bold">
              🟢
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">{isBn ? 'অনলাইনে সক্রিয়' : 'Online Devices'}</span>
              <span className="text-sm sm:text-base font-bold text-emerald-300 font-mono">{onlineCount} টি ডিভাইস</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-950/80 text-amber-400 flex items-center justify-center font-bold">
              📂
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">{isBn ? 'মোট পেন্ডিং ফাইল' : 'Pending Files'}</span>
              <span className="text-sm sm:text-base font-bold text-amber-300 font-mono">{totalPendingCount} টি</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-950/80 text-purple-400 flex items-center justify-center font-bold">
              👑
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">{isBn ? 'এডমিন ফোন' : 'Admin Account'}</span>
              <span className="text-xs sm:text-sm font-bold text-purple-300 font-mono">{adminPhone}</span>
            </div>
          </div>
        </div>

        {/* Parent Cloud Storage & Zero-Pending Auto-Signing Strip */}
        <div className="mx-5 mt-4 p-4 rounded-xl bg-gradient-to-r from-emerald-950/80 via-slate-900 to-indigo-950/80 border border-emerald-500/50 flex flex-col gap-3 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-white text-xs flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-emerald-400" />
                  <span>{isBn ? 'পেরেন্টস ক্লাউড স্টোরেজ ও অটো-সাইনিং' : 'Parent Cloud Storage & Auto-Signing'}</span>
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                  isAutoSigning
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}>
                  <FileCheck className="w-3 h-3" />
                  <span>{isAutoSigning ? (isBn ? 'অটো-সাইনিং সক্রিয়' : 'Auto-Signing Active') : (isBn ? 'অটো-সাইনিং নিষ্ক্রিয়' : 'Manual Signing')}</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-mono">
                  {storedDocs.length} {isBn ? 'টি ফাইল সংরক্ষিত' : 'Stored Files'}
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                {isBn
                  ? 'কোন ফাইল পেন্ডিং থাকবে না। ইনভয়েস ও রসিদ তৈরি হওয়ার সাথে সাথেই স্বয়ংক্রিয়ভাবে ডিজিটালি সাইন হয়ে চুপচাপ রিয়েল-টাইম পেরেন্টস স্টোরেজে জমা হয়।'
                  : 'Zero pending files. Invoices and receipts are instantly auto-signed and silently synced to parent cloud storage in real time.'}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {/* Auto-signing toggle button */}
              <button
                type="button"
                onClick={() => toggleAutoSigning()}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                  isAutoSigning
                    ? 'bg-emerald-950/80 hover:bg-emerald-900 border-emerald-500/50 text-emerald-300'
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-300'
                }`}
                title={isBn ? 'অটো-সাইনিং চালু বা বন্ধ করুন' : 'Toggle Auto-Signing'}
              >
                <FileCheck className="w-3.5 h-3.5" />
                <span>{isAutoSigning ? (isBn ? 'স্বাক্ষর সক্রিয়' : 'Signed') : (isBn ? 'স্বাক্ষর চালু করুন' : 'Enable Signing')}</span>
              </button>

              {/* Instant Drain / Sync Button */}
              <button
                type="button"
                onClick={handleDrainAllNow}
                disabled={isProcessing}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-md shadow-emerald-950/50"
                title={isBn ? 'পেন্ডিং ফাইল স্বয়ংক্রিয়ভাবে সাইন করে ক্লাউড স্টোরেজে জমা করুন' : 'Sign & Drain all pending files to cloud'}
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>{isBn ? '⚡ সব ফাইল সাইন ও জমা করুন' : 'Sign & Drain Now'}</span>
              </button>

              {/* View Stored Files Button */}
              <button
                type="button"
                onClick={() => setShowStoredDocs(!showStoredDocs)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1 cursor-pointer transition"
              >
                <Eye className="w-3.5 h-3.5 text-sky-400" />
                <span>{showStoredDocs ? (isBn ? 'লুকান' : 'Hide') : (isBn ? 'জমা হওয়া ফাইল' : 'Stored Files')}</span>
                {showStoredDocs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Stored Documents Drawer */}
          {showStoredDocs && (
            <div className="pt-3 border-t border-slate-800/80 animate-in fade-in duration-150">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{isBn ? 'পেরেন্টস ক্লাউড স্টোরেজে জমা হওয়া ফাইলসমূহ:' : 'Documents Saved in Parent Storage:'}</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    openSupabaseModal('storage');
                  }}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold underline cursor-pointer"
                >
                  {isBn ? 'সম্পূর্ণ স্টোরেজ ম্যানেজার খুলুন ↗' : 'Open Storage Manager ↗'}
                </button>
              </div>

              {storedDocs.length === 0 ? (
                <div className="p-3 text-center bg-slate-950/60 rounded-lg text-slate-400 text-xs">
                  {isBn ? 'স্টোরেজে কোনো ফাইল জমা নেই। নতুন ইনভয়েস তৈরি করলে তা স্বয়ংক্রিয়ভাবে এখানে জমা হবে।' : 'No files stored yet. New invoices will auto-save here.'}
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {storedDocs.slice(0, 15).map((doc) => (
                    <div
                      key={doc.id}
                      className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-emerald-400">📄</span>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-200 truncate">{doc.fileName}</p>
                          <p className="text-[10px] text-slate-400">
                            {doc.category === 'invoice' ? 'বিক্রয় ইনভয়েস' : doc.category === 'receipt' ? 'পেমেন্ট রসিদ' : 'নথি'} • {new Date(doc.createdAt).toLocaleDateString('bn-BD')}
                            {doc.isAutoSigned && ' • ✅ অটো-স্বাক্ষরিত'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-800/40">
                          {(doc.fileSize / 1024).toFixed(1)} KB
                        </span>
                        {doc.publicUrl && (
                          <a
                            href={doc.publicUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-sky-300"
                            title={isBn ? 'ফাইল দেখুন' : 'View file'}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Devices List */}
        <div className="p-5 flex-1 overflow-y-auto space-y-3">
          {allDevices.length === 0 ? (
            <div className="p-8 text-center bg-slate-950/50 rounded-2xl border border-slate-800 space-y-2">
              <Info className="w-8 h-8 text-slate-500 mx-auto" />
              <p className="text-sm font-semibold text-slate-300">
                {isBn ? 'কোনো ডিভাইস রেজিস্ট্রি এখনো পাওয়া যায়নি।' : 'No devices registered yet.'}
              </p>
              <p className="text-xs text-slate-500">
                {isBn
                  ? 'মোবাইল বা ল্যাপটপে ক্যাশ কাউন্টার বা ডিএসআর লগইন করলে তা স্বয়ংক্রিয়ভাবে এখানে যুক্ত হবে।'
                  : 'Devices will auto-register as soon as staff logs in on mobile or laptop.'}
              </p>
              <button
                type="button"
                onClick={handleRefresh}
                className="mt-3 px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-600 text-white font-bold text-xs"
              >
                {isBn ? 'সার্ভার থেকে চেক করুন' : 'Check from Server'}
              </button>
            </div>
          ) : (
            allDevices.map((dev) => {
              const isOnline = Boolean(dev.isOnline);
              const isDsr = dev.role === 'dsr';
              const isCounter = dev.role === 'counter';
              const isAdmin = dev.role === 'admin';
              const hasPending = (dev.pendingFilesCount || 0) > 0;
              const isExpanded = expandedDeviceId === dev.deviceId;

              return (
                <div
                  key={dev.deviceId}
                  className={`rounded-2xl border transition-all ${
                    hasPending
                      ? 'bg-amber-950/10 border-amber-500/40'
                      : isOnline
                      ? 'bg-slate-950/80 border-emerald-500/30'
                      : 'bg-slate-950/40 border-slate-800'
                  }`}
                >
                  {/* Device Header Row */}
                  <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                          isAdmin
                            ? 'bg-purple-950/80 text-purple-400 border-purple-500/40'
                            : isCounter
                            ? 'bg-sky-950/80 text-sky-400 border-sky-500/40'
                            : 'bg-indigo-950/80 text-indigo-400 border-indigo-500/40'
                        }`}
                      >
                        {isAdmin && <Shield className="w-5 h-5" />}
                        {isCounter && <Laptop className="w-5 h-5" />}
                        {isDsr && <Smartphone className="w-5 h-5" />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-white truncate">
                            {dev.name || (isAdmin ? 'এডমিন মাতৃছায়া' : isCounter ? 'ক্যাশ কাউন্টার' : 'রাজু আলম (ডিএসআর)')}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                              isAdmin
                                ? 'bg-purple-900/60 text-purple-300'
                                : isCounter
                                ? 'bg-sky-900/60 text-sky-300'
                                : 'bg-indigo-900/60 text-indigo-300'
                            }`}
                          >
                            {dev.role}
                          </span>
                          {hasPending && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                              <span>⚠️</span>
                              <span>{dev.pendingFilesCount} {isBn ? 'টি পেন্ডিং ফাইল' : 'Pending Files'}</span>
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5 font-mono">
                          <span>📞 {dev.phone || 'N/A'}</span>
                          <span className="text-slate-600">•</span>
                          <span>{dev.deviceType || 'ডিভাইস'}</span>
                          {dev.deviceId && (
                            <>
                              <span className="text-slate-600">•</span>
                              <span className="text-[10px] text-slate-500 truncate max-w-[130px]" title={dev.deviceId}>
                                ID: {dev.deviceId.slice(0, 12)}...
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Status & Action Buttons */}
                    <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                      <div className="text-right">
                        <div className="flex items-center gap-1.5 justify-end">
                          <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                              isOnline
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                          >
                            {isOnline ? (isBn ? 'অনলাইন' : 'Online') : (isBn ? 'অফলাইন' : 'Offline')}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {isOnline ? (isBn ? 'এখন সক্রিয়' : 'Active Now') : (isBn ? 'শেষ দেখা: ' + (dev.lastSeenAt ? new Date(dev.lastSeenAt).toLocaleTimeString('bn-BD') : 'পূর্বে') : 'Last seen: ' + (dev.lastSeenAt || 'N/A'))}
                        </span>
                      </div>

                      {hasPending && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleUploadPending(dev.deviceId, dev.name)}
                            disabled={isProcessing}
                            className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1 transition active:scale-95 cursor-pointer shadow-sm"
                            title={isBn ? 'পেন্ডিং ফাইলগুলো সরাসরি এডমিন গুগল ড্রাইভে আপলোড ও সাইন করুন' : 'Sign and Upload to Google Drive'}
                          >
                            <UploadCloud className="w-3.5 h-3.5" />
                            <span>{isBn ? 'ড্রাইভে সাইন' : 'Sign to Drive'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleClearToBackup(dev.deviceId, dev.name)}
                            disabled={isProcessing}
                            className="px-2.5 py-1.5 rounded-xl bg-amber-700 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1 transition active:scale-95 cursor-pointer shadow-sm"
                            title={isBn ? 'ক্লিয়ার করে ব্যাকআপে সংরক্ষণ করুন' : 'Clear to Backup'}
                          >
                            <FileDown className="w-3.5 h-3.5" />
                            <span>{isBn ? 'ক্লিয়ার ব্যাকআপ' : 'Clear Backup'}</span>
                          </button>
                        </div>
                      )}

                      {dev.pendingItems && dev.pendingItems.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setExpandedDeviceId(isExpanded ? null : dev.deviceId)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                          title={isBn ? 'পেন্ডিং ফাইলের বিস্তারিত দেখুন' : 'Toggle details'}
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded Pending Items List */}
                  {isExpanded && dev.pendingItems && dev.pendingItems.length > 0 && (
                    <div className="px-4 pb-4 pt-1 border-t border-slate-800/80 bg-slate-900/60 rounded-b-2xl">
                      <h4 className="text-xs font-bold text-amber-300 mb-2 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        <span>{isBn ? 'এই ডিভাইসের পেন্ডিং অফলাইন ফাইল তালিকা:' : 'Pending offline queue on this device:'}</span>
                      </h4>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {dev.pendingItems.map((item: any, idx: number) => (
                          <div
                            key={item.id || idx}
                            className="p-2 rounded-xl bg-slate-950/90 border border-slate-800 flex items-center justify-between text-xs"
                          >
                            <div className="min-w-0">
                              <span className="font-bold text-slate-200 block truncate">
                                {item.title || item.entityType || 'অফলাইন রেকর্ড'}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {item.party ? `${item.party} • ` : ''}
                                {item.timestamp ? new Date(item.timestamp).toLocaleString('bn-BD') : ''}
                              </span>
                            </div>
                            {item.amount > 0 && (
                              <span className="font-bold font-mono text-emerald-400 shrink-0">
                                {formatCurrency(item.amount, language)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              {isBn
                ? 'এডমিন কন্ট্রোল: যে কোনো ইনস্টলকৃত ডিভাইস রিয়েল-টাইম সনাক্ত হয়'
                : 'Fleet sync: all devices identified in real-time'}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition cursor-pointer"
          >
            {isBn ? 'বন্ধ করুন' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
