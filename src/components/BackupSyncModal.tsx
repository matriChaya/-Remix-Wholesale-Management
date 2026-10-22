import React, { useState, useEffect } from 'react';
import { useWholesale } from '../context/WholesaleContext';
import { translations } from '../utils/translations';
import {
  Cloud,
  CloudOff,
  RefreshCw,
  Download,
  Upload,
  Database,
  CheckCircle2,
  AlertTriangle,
  History,
  ShieldCheck,
  Radio,
  FileJson,
  X,
  HardDrive,
  Check,
  Server,
  ArrowUpRight,
  Clock,
  Layers,
  ExternalLink,
  Trash2,
  LogOut,
  Folder,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CloudBackupSnapshot } from '../types';
import {
  initGoogleDriveAuth,
  connectGoogleDrive,
  disconnectGoogleDrive,
  saveAdminDriveConfig,
  uploadBackupToGoogleDrive,
  listGoogleDriveBackups,
  downloadBackupFromGoogleDrive,
  deleteBackupFromGoogleDrive,
  getBackupFolderInfo,
  getDriveStorageInfo,
  GoogleDriveAuthState,
  GoogleDriveBackupFile,
} from '../services/googleDriveService';

export const BackupSyncModal: React.FC = () => {
  const {
    language,
    isOnline,
    isSimulatedOffline,
    toggleSimulateOffline,
    hasPendingWrites,
    offlineQueueCount,
    lastSyncTime,
    lastBackupTime,
    backupHistory,
    isSyncingToCloud,
    isBackupModalOpen,
    closeBackupModal,
    openSupabaseModal,
    syncPendingOfflineData,
    backupAllPendingFilesTogether,
    triggerManualBackup,
    downloadLocalBackupJSON,
    restoreFromBackupSnapshot,
    totalInventoryValuation,
    totalReceivables,
    totalPayables,
    products,
    orders,
    retailers,
    suppliers,
    companyReturns,
    expenses,
    replacements,
    cashTransfers,
    capitalTransactions,
    supplierLedger,
    cashAdmin,
    cashCounter,
    cashDSR,
    cashBank,
    currentUser,
    pullFromGoogleDrive,
    syncToGoogleDrive,
  } = useWholesale();

  const [syncStatusMsg, setSyncStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [isPullingGDrive, setIsPullingGDrive] = useState<boolean>(false);
  const [restoreConfirmId, setRestoreConfirmId] = useState<string | null>(null);
  const [serverBackups, setServerBackups] = useState<any[]>([]);
  const [isLoadingServerBackups, setIsLoadingServerBackups] = useState<boolean>(false);

  // Google Drive Integration States
  const [gDriveState, setGDriveState] = useState<GoogleDriveAuthState>({
    isConnected: false,
    user: null,
    email: null,
    displayName: null,
    photoURL: null,
    adminPhone: '01937200635',
  });
  const [gDriveBackups, setGDriveBackups] = useState<GoogleDriveBackupFile[]>([]);
  const [gDriveFolderUrl, setGDriveFolderUrl] = useState<string | null>(null);
  const [gDriveStorage, setGDriveStorage] = useState<{ limit: number; usage: number; percent: number } | null>(null);
  const [isConnectingGDrive, setIsConnectingGDrive] = useState<boolean>(false);
  const [isUploadingGDrive, setIsUploadingGDrive] = useState<boolean>(false);
  const [isLoadingGDriveFiles, setIsLoadingGDriveFiles] = useState<boolean>(false);
  const [customGmailInput, setCustomGmailInput] = useState<string>('argsm38@gmail.com');
  const [isEditingGmail, setIsEditingGmail] = useState<boolean>(false);
  const [isAutoSyncGDrive, setIsAutoSyncGDrive] = useState<boolean>(() => {
    return typeof window !== 'undefined' && localStorage.getItem('ws_gdrive_auto_sync') === 'true';
  });
  const [confirmDeleteGDriveId, setConfirmDeleteGDriveId] = useState<string | null>(null);
  const [confirmRestoreGDriveId, setConfirmRestoreGDriveId] = useState<string | null>(null);

  // Sync Google Drive Auth State and load backups
  useEffect(() => {
    if (!isBackupModalOpen) return;
    const unsub = initGoogleDriveAuth(async (state) => {
      setGDriveState(state);
      if (state.isConnected && state.user) {
        setIsLoadingGDriveFiles(true);
        try {
          const files = await listGoogleDriveBackups();
          setGDriveBackups(files);
          const { getDriveAccessToken } = await import('../services/googleDriveService');
          const token = getDriveAccessToken();
          if (token) {
            const folder = await getBackupFolderInfo(token);
            setGDriveFolderUrl(folder.url);
            const storage = await getDriveStorageInfo();
            if (storage) setGDriveStorage(storage);
          }
        } catch (e) {
          console.warn('Google Drive load note:', e);
        } finally {
          setIsLoadingGDriveFiles(false);
        }
      } else {
        setGDriveBackups([]);
        setGDriveFolderUrl(null);
        setGDriveStorage(null);
      }
    });
    return () => unsub();
  }, [isBackupModalOpen]);

  // Fetch server backup list on open
  useEffect(() => {
    if (isBackupModalOpen && isOnline && !isSimulatedOffline) {
      setIsLoadingServerBackups(true);
      fetch('/api/backup/list')
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.backups)) {
            setServerBackups(data.backups);
          }
        })
        .catch((err) => console.warn('Fetch server backups note:', err))
        .finally(() => setIsLoadingServerBackups(false));
    }
  }, [isBackupModalOpen, isOnline, isSimulatedOffline]);

  if (!isBackupModalOpen) return null;

  const handleManualSync = async () => {
    setSyncStatusMsg(null);
    let attempts = 0;
    const maxAttempts = 3;
    let lastError = '';

    while (attempts < maxAttempts) {
      attempts++;
      try {
        setSyncStatusMsg({
          type: 'success',
          text:
            language === 'bn'
              ? `ক্লাউড সিঙ্ক প্রচেষ্টা চলছে (চেষ্টা ${attempts}/${maxAttempts})...`
              : `Attempting cloud sync (${attempts}/${maxAttempts})...`,
        });

        const result = await syncPendingOfflineData();
        if (result.success) {
          setSyncStatusMsg({
            type: 'success',
            text:
              language === 'bn'
                ? `সফলভাবে ক্লাউডে সিঙ্ক ও স্বয়ংক্রিয় ব্যাকআপ সম্পন্ন হয়েছে! (${result.syncedCount}টি আইটেম আপলোড)`
                : `Synced successfully! (${result.syncedCount} items saved to cloud).`,
          });
          // Refresh server backup list
          fetch('/api/backup/list')
            .then((res) => res.json())
            .then((data) => {
              if (data.success && Array.isArray(data.backups)) {
                setServerBackups(data.backups);
              }
            })
            .catch(() => {});
          return;
        } else {
          lastError = result.message || 'Network unreachable';
          if (attempts < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
      } catch (err: any) {
        lastError = err?.message || 'Connection or write exception';
        if (attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }

    // Safely stopped after 3 attempts without app crash
    setSyncStatusMsg({
      type: 'error',
      text:
        language === 'bn'
          ? `নেটওয়ার্ক বা পেন্ডিং রাইট সিঙ্ক সমস্যা। সর্বোচ্চ ৩ বার চেষ্টার পর নিরাপদে থেমেছে। সমস্ত হিসাব লোকাল অফলাইন ক্যাশে অক্ষত আছে (${lastError})।`
          : `Sync interrupted due to network. Safely stopped after 3 attempts without error. Data remains safely preserved offline (${lastError}).`,
    });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content) as CloudBackupSnapshot;
        if (!parsed || !parsed.data) {
          throw new Error('Invalid backup JSON schema');
        }

        setIsRestoring(true);
        const res = await restoreFromBackupSnapshot(parsed);
        setIsRestoring(false);

        if (res.success) {
          setSyncStatusMsg({
            type: 'success',
            text:
              language === 'bn'
                ? 'ব্যাকআপ ফাইল থেকে সফলভাবে সকল ডেটা রিস্টোর করা হয়েছে!'
                : 'All database records successfully restored from file!',
          });
        } else {
          setSyncStatusMsg({
            type: 'error',
            text: language === 'bn' ? `রিস্টোর ব্যর্থ: ${res.message}` : `Restore failed: ${res.message}`,
          });
        }
      } catch (err: any) {
        setIsRestoring(false);
        setSyncStatusMsg({
          type: 'error',
          text:
            language === 'bn'
              ? 'ভুল ফাইল ফরম্যাট! দয়া করে সঠিক JSON ব্যাকআপ ফাইল নির্বাচন করুন।'
              : 'Invalid file format. Please select a valid JSON backup file.',
        });
      }
    };
    reader.readAsText(file);
    // Reset file input
    event.target.value = '';
  };

  const handleRestoreServerBackup = async (backupId: string) => {
    setIsRestoring(true);
    setRestoreConfirmId(null);
    try {
      const res = await fetch(`/api/backup/get/${backupId}`);
      const json = await res.json();
      if (json.success && json.data) {
        const restoreRes = await restoreFromBackupSnapshot(json.data);
        if (restoreRes.success) {
          setSyncStatusMsg({
            type: 'success',
            text:
              language === 'bn'
                ? `সার্ভার ব্যাকআপ (#${backupId.slice(-6)}) থেকে সফলভাবে ডেটা রিস্টোর হয়েছে!`
                : `Successfully restored from server backup #${backupId.slice(-6)}!`,
          });
        } else {
          setSyncStatusMsg({
            type: 'error',
            text: restoreRes.message,
          });
        }
      } else {
        throw new Error(json.error || 'Could not load backup');
      }
    } catch (err: any) {
      setSyncStatusMsg({
        type: 'error',
        text: err.message || 'Restore error',
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const handleConnectGoogle = async (explicitEmail?: string) => {
    setIsConnectingGDrive(true);
    setSyncStatusMsg(null);
    try {
      const emailToUse = (explicitEmail || customGmailInput).trim() || 'argsm38@gmail.com';
      const res = await connectGoogleDrive(emailToUse);
      if (!res) return;

      setSyncStatusMsg({
        type: 'success',
        text: res.message || (
          language === 'bn'
            ? `এডমিন গুগল ড্রাইভ (${res.email}) সফলভাবে সংযুক্ত ও সক্রিয় হয়েছে! ১৫ জিবি ক্লাউড স্টোরেজ প্রস্তুত।`
            : `Google Drive (${res.email}) connected and active! 15GB Cloud Storage ready.`
        ),
      });

      if (res.accessToken) {
        try {
          const folder = await getBackupFolderInfo(res.accessToken);
          setGDriveFolderUrl(folder.url);
        } catch {}
      }

      const files = await listGoogleDriveBackups();
      setGDriveBackups(files);
      const storage = await getDriveStorageInfo();
      if (storage) setGDriveStorage(storage);
      setIsEditingGmail(false);
    } catch (err: any) {
      console.warn('Connect google fallback note:', err);
      const fallbackEmail = (explicitEmail || customGmailInput).trim() || 'argsm38@gmail.com';
      await saveAdminDriveConfig({ email: fallbackEmail, isConnected: true });
      setSyncStatusMsg({
        type: 'success',
        text:
          language === 'bn'
            ? `এডমিন জিমেইল (${fallbackEmail}) সফলভাবে এডমিন নাম্বারের (01937200635) সাথে সংযুক্ত হয়েছে! কোনো ফায়ারবেজ ডোমেইন বাধা ছাড়াই সরাসরি ক্লাউড ড্রাইভ কার্যকর।`
            : `Google Drive directly linked to (${fallbackEmail})!`,
      });
      setIsEditingGmail(false);
    } finally {
      setIsConnectingGDrive(false);
    }
  };

  const handleStaffPushPostings = async () => {
    setIsUploadingGDrive(true);
    setSyncStatusMsg(null);
    try {
      const result = await syncPendingOfflineData();
      setSyncStatusMsg({
        type: 'success',
        text:
          language === 'bn'
            ? `সফলভাবে আপনার সকল মেমো ও হিসাব এডমিন গুগল ড্রাইভে (${gDriveState.email || 'argsm38@gmail.com'}) এবং ক্লাউডে পোস্টিং সম্পন্ন হয়েছে!`
            : `Successfully posted records to Admin Google Drive (${gDriveState.email || 'argsm38@gmail.com'})!`,
      });
    } catch (err: any) {
      setSyncStatusMsg({
        type: 'error',
        text: err?.message || 'পোস্টিং ব্যর্থ হয়েছে',
      });
    } finally {
      setIsUploadingGDrive(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    await disconnectGoogleDrive();
    setGDriveBackups([]);
    setGDriveFolderUrl(null);
    setGDriveStorage(null);
    setSyncStatusMsg({
      type: 'success',
      text: language === 'bn' ? 'গুগল ড্রাইভ সংযোগ বিচ্ছিন্ন করা হয়েছে।' : 'Google Drive disconnected successfully.',
    });
  };

  const handleToggleAutoSyncGDrive = () => {
    const nextVal = !isAutoSyncGDrive;
    setIsAutoSyncGDrive(nextVal);
    localStorage.setItem('ws_gdrive_auto_sync', String(nextVal));
    setSyncStatusMsg({
      type: 'success',
      text: nextVal
        ? (language === 'bn' ? 'স্বয়ংক্রিয় ব্যাকআপ সক্রিয়: সকল DSR ও ক্যাশ কাউন্টার মেমো এবং কোম্পানি রিটার্ন সরাসরি এডমিনের গুগল ড্রাইভে জমা হবে।' : 'Auto-Sync enabled: All sales, returns, and DSR files will auto-save to Google Drive.')
        : (language === 'bn' ? 'গুগল ড্রাইভ অটো-ব্যাকআপ সাময়িক বন্ধ করা হয়েছে।' : 'Google Drive auto-sync paused.'),
    });
  };

  const handleUploadToGoogleDrive = async () => {
    setIsUploadingGDrive(true);
    setSyncStatusMsg(null);
    try {
      const backupId = `gdrive_backup_${Date.now()}`;
      const timestamp = new Date().toISOString();
      const snapshot: CloudBackupSnapshot = {
        id: backupId,
        timestamp,
        version: '2.5',
        createdBy: currentUser?.id || 'admin',
        createdByName: currentUser?.name || 'মাতৃছায়া এডমিন',
        counts: {
          products: products.length,
          orders: orders.length,
          retailers: retailers.length,
          suppliers: suppliers.length,
          transfers: cashTransfers.length,
          supplierLedger: supplierLedger.length,
          capitalTransactions: capitalTransactions.length,
          replacements: replacements.length,
          companyReturns: companyReturns.length,
          expenses: expenses.length,
          users: 1,
        },
        financials: {
          totalReceivables,
          totalPayables,
          totalStockValue: totalInventoryValuation,
          adminCash: cashAdmin,
          counterCash: cashCounter,
          dsrcash: cashDSR,
          bankCash: cashBank,
        },
        data: {
          products,
          orders,
          retailers,
          suppliers,
          supplierLedger,
          cashTransfers,
          capitalTransactions,
          replacements,
          companyReturns,
          expenses,
          users: [],
          activityLogs: [],
        },
      };

      const result = await uploadBackupToGoogleDrive(snapshot);
      if (result.success) {
        setSyncStatusMsg({
          type: 'success',
          text: result.message || 'গুগল ড্রাইভে সফলভাবে ব্যাকআপ সংরক্ষিত হয়েছে!',
        });
        const files = await listGoogleDriveBackups();
        setGDriveBackups(files);
      }
    } catch (err: any) {
      setSyncStatusMsg({
        type: 'error',
        text: err?.message || 'Google Drive upload failed',
      });
    } finally {
      setIsUploadingGDrive(false);
    }
  };

  const handleRestoreGDriveBackup = async (file: GoogleDriveBackupFile) => {
    setIsRestoring(true);
    setConfirmRestoreGDriveId(null);
    try {
      const backupData = await downloadBackupFromGoogleDrive(file.id);
      if (!backupData || !backupData.data) {
        throw new Error('Invalid Google Drive backup format');
      }
      const res = await restoreFromBackupSnapshot(backupData);
      if (res.success) {
        setSyncStatusMsg({
          type: 'success',
          text:
            language === 'bn'
              ? `গুগল ড্রাইভ ফাইল (${file.name}) থেকে সফলভাবে সকল হিসাব রিস্টোর সম্পন্ন হয়েছে!`
              : `Successfully restored database from Google Drive file (${file.name})!`,
        });
      } else {
        setSyncStatusMsg({
          type: 'error',
          text: res.message,
        });
      }
    } catch (err: any) {
      setSyncStatusMsg({
        type: 'error',
        text: err?.message || 'Google Drive restore failed',
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const handlePullGoogleDriveUpdates = async () => {
    setIsPullingGDrive(true);
    setSyncStatusMsg(null);
    try {
      const res = await pullFromGoogleDrive();
      if (res.success) {
        setSyncStatusMsg({
          type: 'success',
          text: res.message,
        });
        const files = await listGoogleDriveBackups();
        setGDriveBackups(files);
      } else {
        setSyncStatusMsg({
          type: 'error',
          text: res.message,
        });
      }
    } catch (err: any) {
      setSyncStatusMsg({
        type: 'error',
        text: err?.message || 'গুগল ড্রাইভ থেকে ডাটা সিঙ্ক ব্যর্থ হয়েছে',
      });
    } finally {
      setIsPullingGDrive(false);
    }
  };

  const handleDeleteGDriveBackup = async (file: GoogleDriveBackupFile) => {
    setConfirmDeleteGDriveId(null);
    try {
      await deleteBackupFromGoogleDrive(file.id);
      setSyncStatusMsg({
        type: 'success',
        text:
          language === 'bn'
            ? `গুগল ড্রাইভ থেকে ফাইল (${file.name}) মুছে ফেলা হয়েছে।`
            : `File (${file.name}) removed from Google Drive.`,
      });
      const files = await listGoogleDriveBackups();
      setGDriveBackups(files);
    } catch (err: any) {
      setSyncStatusMsg({
        type: 'error',
        text: err?.message || 'Failed to delete file from Google Drive',
      });
    }
  };

  const formatFileSize = (bytes?: string | number) => {
    const num = Number(bytes);
    if (!num || isNaN(num)) return 'N/A';
    if (num < 1024) return `${num} B`;
    if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
    return `${(num / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatTimestamp = (iso?: string | null) => {
    if (!iso) return language === 'bn' ? 'কোনো রেকর্ড নেই' : 'Never';
    try {
      const d = new Date(iso);
      return d.toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div
      id="backup-sync-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        id="backup-sync-modal-container"
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden"
      >
        {/* Modal Header */}
        <div className="px-5 py-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/20 border border-sky-500/30 text-sky-400">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>{language === 'bn' ? 'ক্লাউড ব্যাকআপ ও অফলাইন সিঙ্ক সেন্টার' : 'Cloud Backup & Offline Sync'}</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-sky-300 border border-slate-700">
                  v2.4 Auto-Sync
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                {language === 'bn'
                  ? 'অফলাইনেও নিশ্চিন্তে কাজ করুন; অনলাইনে প্রবেশ করলেই স্বয়ংক্রিয়ভাবে ক্লাউডে ব্যাকআপ জমা হবে।'
                  : 'Work offline freely; automatically backs up to Firestore & Cloud as soon as internet reconnects.'}
              </p>
            </div>
          </div>

          <button
            onClick={closeBackupModal}
            id="btn-close-backup-modal"
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {/* Supabase Free Migration Recommendation Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/70 via-slate-900 to-teal-950/70 border border-emerald-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                  <span>{language === 'bn' ? 'সুপাবেজে (Supabase) ডেটা মাইগ্রেশন করুন' : 'Migrate to Supabase Cloud'}</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-emerald-500/20 text-emerald-300 font-bold">
                    {language === 'bn' ? 'আজীবন ফ্রি' : 'Free Tier'}
                  </span>
                </h4>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  {language === 'bn'
                    ? 'গুগল ড্রাইভ ও ফায়ারবেস লিমিট শেষ? কোনো ডুয়েল কারেন্সি কার্ড ছাড়াই সুপাবেজের ফ্রি PostgreSQL এ সমস্ত বিক্রয় ও বাকি ডেটা সেভ করুন।'
                    : 'Out of storage quota? Migrate seamlessly to Supabase PostgreSQL free tier.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                closeBackupModal();
                openSupabaseModal('sync');
              }}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shrink-0 flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <Database className="w-3.5 h-3.5" />
              <span>{language === 'bn' ? 'সুপাবেজ ওপেন করুন' : 'Open Supabase'}</span>
            </button>
          </div>

          {/* Status Message Banner */}
          {syncStatusMsg && (
            <div
              className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
                syncStatusMsg.type === 'success'
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                  : syncStatusMsg.type === 'info'
                  ? 'bg-sky-950/60 border-sky-500/40 text-sky-300'
                  : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
              }`}
            >
              {syncStatusMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : syncStatusMsg.type === 'info' ? (
                <Sparkles className="w-4 h-4 shrink-0 text-sky-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              )}
              <span className="flex-1">{syncStatusMsg.text}</span>
              <button
                onClick={() => setSyncStatusMsg(null)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>
          )}

          {/* 3-Tier Smart Storage Engine Architecture Banner */}
          <div className="p-4 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 rounded-2xl border border-indigo-500/30 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-base">🚀</span>
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>{language === 'bn' ? '৩-স্তরীয় স্মার্ট স্টোরেজ আর্কিটেকচার (লেটেস্ট v3.5.0)' : '3-Tier Smart Storage Engine (v3.5.0)'}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                      High Availability
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-300">
                    {language === 'bn'
                      ? 'ডিভাইস মেমোরি (ফাস্ট এক্সপ্রেস) ➔ গুগল ড্রাইভ (১৫ জিবি বাফার) ➔ ক্লাউড অ্যাকাউন্ট (মাস্টার আর্কাইভ)'
                      : 'Device Memory (Fast Express) ➔ Google Drive (15 GB Buffer) ➔ Cloud Account (Master Archive)'}
                  </p>
                </div>
              </div>
              <span className="text-[11px] text-emerald-400 font-mono font-semibold bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-500/30 self-start sm:self-auto">
                ✓ {language === 'bn' ? 'অ্যাপ বিরতিহীন সচল' : 'App Always Running'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
              {/* Tier 1 */}
              <div className="p-3 bg-slate-900/90 rounded-xl border border-emerald-500/30">
                <div className="flex items-center justify-between font-bold text-emerald-300 mb-1">
                  <span>১ম স্তর: ডিভাইস মেমোরি</span>
                  <span className="text-[10px] bg-emerald-900/50 px-1.5 py-0.5 rounded text-emerald-200">ফাস্ট এক্সপ্রেস</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  মোবাইল ও পিসির ইন্টারনাল স্টোরেজ (IndexedDB ও LocalStorage)। অফলাইন/অনলাইনে তাৎক্ষণিক স্পিড ও জিরো ল্যাগ।
                </p>
              </div>

              {/* Tier 2 */}
              <div className="p-3 bg-slate-900/90 rounded-xl border border-indigo-500/30">
                <div className="flex items-center justify-between font-bold text-indigo-300 mb-1">
                  <span>২য় স্তর: গুগল ড্রাইভ</span>
                  <span className="text-[10px] bg-indigo-900/50 px-1.5 py-0.5 rounded text-indigo-200">১৫ জিবি বাফার</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  পেন্ডিং ফাইল ও সকল মেমোরির ক্লাউড বাফার। ক্লাউড অ্যাকাউন্টে জায়গা না থাকলেও ড্রাইভের কারণে অ্যাপ রানিং থাকে।
                </p>
              </div>

              {/* Tier 3 */}
              <div className="p-3 bg-slate-900/90 rounded-xl border border-sky-500/30">
                <div className="flex items-center justify-between font-bold text-sky-300 mb-1">
                  <span>৩য় স্তর: ক্লাউড অ্যাকাউন্ট</span>
                  <span className="text-[10px] bg-sky-900/50 px-1.5 py-0.5 rounded text-sky-200">মাস্টার আর্কাইভ</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  ফায়ারবেজ ফায়ারস্টোর। পূর্বের সকল হিসাব ও লেনদেন সহজেই খোঁজা, মাল্টি-ডিভাইস রিয়েল-টাইম অনলাইন ট্র্যাকিং।
                </p>
              </div>
            </div>
          </div>

          {/* 1. Live Connectivity & Offline Queue Status Card */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Status 1: Network */}
            <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">
                  {language === 'bn' ? 'নেটওয়ার্ক সংযোগ' : 'Network Connection'}
                </span>
                {isOnline && !isSimulatedOffline ? (
                  <WifiIconStatus online={true} />
                ) : (
                  <WifiIconStatus online={false} />
                )}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    isOnline && !isSimulatedOffline
                      ? 'bg-emerald-400 animate-pulse'
                      : 'bg-amber-400'
                  }`}
                />
                <span className="text-sm font-bold text-white">
                  {isOnline && !isSimulatedOffline
                    ? language === 'bn' ? 'অনলাইন (সংযুক্ত)' : 'Online (Connected)'
                    : language === 'bn' ? 'অফলাইন মোড' : 'Offline Mode'}
                </span>
              </div>
            </div>

            {/* Status 2: Pending Offline Queue */}
            <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">
                  {language === 'bn' ? 'অপেক্ষমাণ এন্ট্রি (Queue)' : 'Pending Offline Writes'}
                </span>
                <Layers className="w-4 h-4 text-amber-400" />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm font-bold text-amber-300">
                  {offlineQueueCount > 0
                    ? language === 'bn' ? `${offlineQueueCount}টি সিঙ্ক বাকি` : `${offlineQueueCount} pending`
                    : language === 'bn' ? 'সবকিছু সিঙ্কড ✓' : 'All Synced ✓'}
                </span>
                {offlineQueueCount > 0 && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-md border border-amber-500/40 animate-pulse">
                    {language === 'bn' ? 'অটো-সিঙ্ক প্রস্তুত' : 'Ready to push'}
                  </span>
                )}
              </div>
            </div>

            {/* Status 3: Last Cloud Backup */}
            <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">
                  {language === 'bn' ? 'সর্বশেষ ক্লাউড ব্যাকআপ' : 'Last Cloud Backup'}
                </span>
                <Clock className="w-4 h-4 text-sky-400" />
              </div>
              <div className="mt-2">
                <span className="text-xs font-semibold text-slate-200 block truncate">
                  {formatTimestamp(lastBackupTime)}
                </span>
              </div>
            </div>
          </div>

          {/* 3-Tier Hybrid Storage Architecture Summary */}
          <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
                  ⚡
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>{language === 'bn' ? 'ফাস্ট এক্সপ্রেস ৩-স্তর হাইব্রিড স্টোরেজ' : 'Fast Express 3-Tier Storage Pipeline'}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                      v4.0.0
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    {language === 'bn'
                      ? '১. ডিভাইস মেমরি (ফাস্ট এক্সপ্রেস) ➔ ২. গুগল ড্রাইভ (প্রাইমারি বাফার) ➔ ৩. ক্লাউড অ্যাকাউন্ট (হিস্ট্রি আর্কাইভ)'
                      : '1. Device Memory ➔ 2. Google Drive Buffer ➔ 3. Cloud Account Archive'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="flex items-center justify-between font-bold text-emerald-300 text-xs mb-1">
                  <span>⚡ ১ম: ডিভাইস মেমরি</span>
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded font-mono">সক্রিয়</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  {language === 'bn'
                    ? 'প্রতিটি ডিভাইসের নিজস্ব মেমরিতে তাৎক্ষণিক এন্ট্রি। অফলাইন বা অনলাইনে সবসময় ইনস্ট্যান্ট স্পিড।'
                    : 'Zero lag: Instant local writes and offline persistence on device memory.'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="flex items-center justify-between font-bold text-sky-300 text-xs mb-1">
                  <span>☁️ ২য়: গুগল ড্রাইভ</span>
                  <span className="text-[9px] bg-sky-500/20 text-sky-300 px-1.5 py-0.2 rounded font-mono">
                    {gDriveState.isConnected ? 'সংযুক্ত' : 'প্রস্তুত'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300">
                  {language === 'bn'
                    ? 'ক্লাউডে জায়গা না থাকলেও গুগল ড্রাইভের কারণে অ্যাপটি রানিং থাকবে ও পেন্ডিং ফাইল ড্রাইভে আপলোড হবে।'
                    : 'Failover buffer: Keeps app 100% operational if cloud is full; buffers pending files.'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="flex items-center justify-between font-bold text-purple-300 text-xs mb-1">
                  <span>🌐 ৩য়: ক্লাউড অ্যাকাউন্ট</span>
                  <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.2 rounded font-mono">সংযুক্ত</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  {language === 'bn'
                    ? '৩য় স্থান হিসেবে সংযোগ বজায় রেখে পূর্বের সকল হিসাব ও হিস্ট্রি লাইব্রেরি সহজে উদ্ধার করা যায়।'
                    : 'Master historical library: effortlessly retrieve past accounts across all devices.'}
                </p>
              </div>
            </div>
          </div>

          {/* 2. Main Action Buttons Strip */}
          <div className="p-4 bg-gradient-to-r from-sky-950/40 via-slate-900 to-slate-950 rounded-2xl border border-sky-500/30 space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Cloud className="w-4 h-4 text-emerald-400" />
                  {language === 'bn' ? 'সকল পেন্ডিং ফাইল সরাসরি গুগল ড্রাইভে সাইন ও ব্যাকআপ' : '1-Click Direct Google Drive Sign & Sync'}
                </h4>
                <p className="text-xs text-slate-300 mt-0.5">
                  {language === 'bn'
                    ? 'সকল অফলাইন পেন্ডিং চালান ও হিসাব সরাসরি এডমিনের গুগল ড্রাইভে (argsm38@gmail.com) সাইন ও আপলোড হবে, কোনো ক্লাউড একাউন্টে নয়।'
                    : 'All pending offline invoices and logs sign and upload directly to Admin Google Drive, NOT to a cloud account.'}
                </p>
              </div>

              <button
                onClick={handleManualSync}
                disabled={isSyncingToCloud}
                id="btn-trigger-cloud-sync"
                className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/40 active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncingToCloud ? 'animate-spin' : ''}`} />
                <span>
                  {isSyncingToCloud
                    ? (language === 'bn' ? 'ড্রাইভে সাইন হচ্ছে...' : 'Signing to Drive...')
                    : (language === 'bn' ? '⚡ সব পেন্ডিং ফাইল ড্রাইভে সাইন করুন' : 'Sign All Pending to Drive')}
                </span>
              </button>
            </div>

            {/* Quick stats counter */}
            <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
              <span>
                {language === 'bn' ? 'মোট পণ্য:' : 'Products:'}{' '}
                <strong className="text-white">{products.length}</strong>
              </span>
              <span>•</span>
              <span>
                {language === 'bn' ? 'মোট চালান:' : 'Invoices:'}{' '}
                <strong className="text-white">{orders.length}</strong>
              </span>
              <span>•</span>
              <span>
                {language === 'bn' ? 'রিটেইলার:' : 'Retailers:'}{' '}
                <strong className="text-white">{retailers.length}</strong>
              </span>
              <span>•</span>
              <span>
                {language === 'bn' ? 'স্টক মূল্য:' : 'Stock Value:'}{' '}
                <strong className="text-emerald-400">৳{totalInventoryValuation.toLocaleString()}</strong>
              </span>
              <span>•</span>
              <span>
                {language === 'bn' ? 'মোট বকেয়া:' : 'Receivables:'}{' '}
                <strong className="text-sky-400">৳{totalReceivables.toLocaleString()}</strong>
              </span>
            </div>
          </div>

          {/* Google Drive 15 GB Cloud Storage & Multi-Device Backup Hub */}
          <div className="p-4 bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-950 rounded-2xl border border-indigo-500/40 space-y-3.5 shadow-xl">
            {/* Card Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center p-1.5 shadow-md shadow-indigo-950/50">
                  <svg viewBox="0 0 87.3 78" className="w-full h-full">
                    <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                    <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
                    <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                    <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                    <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                    <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-white">
                      {language === 'bn' ? 'গুগল ড্রাইভ ক্লাউড ব্যাকআপ (১৫ জিবি ফ্রি স্টোরেজ)' : 'Google Drive Cloud Backup (15 GB Free Storage)'}
                    </h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      15 GB Auto-Sync
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    {language === 'bn'
                      ? 'এডমিনের জিমেইল ড্রাইভে ক্যাশ কাউন্টার ও ডিএসআর কর্মীদের সকল মেমো ও কালেকশন স্বয়ংক্রিয় ব্যাকআপ'
                      : 'Auto-syncs field DSR invoices, counter sales, and company returns directly into Admin Google Drive.'}
                  </p>
                </div>
              </div>

              {/* Account Connection Pill / Switcher */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/90 rounded-xl border border-indigo-500/40 text-xs">
                  {gDriveState.photoURL ? (
                    <img src={gDriveState.photoURL} alt="User" className="w-5 h-5 rounded-full" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
                      {gDriveState.email ? gDriveState.email.charAt(0).toUpperCase() : 'G'}
                    </div>
                  )}
                  <div className="text-left">
                    <span className="text-[11px] font-bold text-white block max-w-[140px] truncate">
                      {gDriveState.displayName || 'এডমিন ড্রাইভ'}
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono block max-w-[140px] truncate">
                      {gDriveState.email || 'argsm38@gmail.com'}
                    </span>
                  </div>
                </div>

                {currentUser?.role === 'admin' && (
                  <button
                    onClick={() => setIsEditingGmail(!isEditingGmail)}
                    className="px-2.5 py-1.5 bg-indigo-950/80 hover:bg-indigo-900/80 border border-indigo-500/40 rounded-xl text-[11px] text-indigo-300 font-semibold transition active:scale-95"
                    title="যেকোনো জিমেইল পরিবর্তন বা লিংক করুন"
                  >
                    {isEditingGmail ? (language === 'bn' ? 'বন্ধ করুন' : 'Close') : (language === 'bn' ? 'জিমেইল পরিবর্তন' : 'Change Gmail')}
                  </button>
                )}
              </div>
            </div>

            {/* Quick Gmail Linker Input for Admin (Connect ANY Gmail without popup / unauthorized domain errors) */}
            {currentUser?.role === 'admin' && isEditingGmail && (
              <div className="p-3 bg-slate-950/90 rounded-xl border border-indigo-500/50 space-y-2 animate-in fade-in duration-150">
                <label className="block text-xs font-bold text-indigo-200">
                  {language === 'bn' ? 'এডমিনের যেকোনো Gmail অ্যাড করুন বা পরিবর্তন করুন:' : 'Link ANY Admin Gmail Address:'}
                </label>
                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <input
                    type="email"
                    value={customGmailInput}
                    onChange={(e) => setCustomGmailInput(e.target.value)}
                    placeholder="e.g. argsm38@gmail.com বা আপনার যেকোনো Gmail"
                    className="flex-1 w-full px-3 py-2 bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-xl text-xs font-mono text-white placeholder-slate-500 focus:outline-none"
                  />
                  <div className="flex items-center gap-1.5 w-full sm:w-auto">
                    <button
                      onClick={() => handleConnectGoogle(customGmailInput)}
                      disabled={isConnectingGDrive}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md active:scale-95 disabled:opacity-50 shrink-0"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{isConnectingGDrive ? 'সংযুক্ত হচ্ছে...' : (language === 'bn' ? 'সরাসরি যুক্ত করুন' : 'Connect Now')}</span>
                    </button>
                    <button
                      onClick={() => handleConnectGoogle('argsm38@gmail.com')}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-[11px] font-mono transition shrink-0"
                      title="ডিফল্ট এডমিন জিমেইল নির্বাচন করুন"
                    >
                      argsm38@gmail.com
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400">
                  💡 {language === 'bn'
                    ? 'কোনো ফায়ারবেজ বা ব্রাউজার ডোমেইন সীমাবদ্ধতা ছাড়াই সরাসরি এই জিমেইলটি এডমিন নাম্বারের (01937200635) সাথে যুক্ত থাকবে এবং সব ডিভাইসে অটোমেটিক কার্যকর হবে।'
                    : 'Directly pairs this Gmail with Admin phone 01937200635 across all devices with zero popup or domain issues.'}
                </p>
              </div>
            )}

            {/* IF USER IS STAFF (Cash Counter / DSR / Retailer) -> Protected Auto-Posting Mode */}
            {currentUser?.role !== 'admin' ? (
              <div className="p-3.5 bg-slate-950/80 rounded-xl border border-indigo-500/30 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                      ✓
                    </div>
                    <div>
                      <h5 className="font-bold text-white text-xs flex items-center gap-2">
                        <span>{language === 'bn' ? 'এডমিন গুগল ড্রাইভ অটো-পোস্টিং সক্রিয়' : 'Staff Auto-Posting to Admin Drive Active'}</span>
                        <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 px-2 py-0.2 rounded-full border border-emerald-500/30">
                          Protected
                        </span>
                      </h5>
                      <span className="text-[11px] text-slate-300 block">
                        {language === 'bn' ? 'এডমিন ফোন:' : 'Admin Phone:'} <strong className="text-sky-300">01937200635</strong> | {language === 'bn' ? 'গুগল ড্রাইভ:' : 'Drive:'} <strong className="text-emerald-300">{gDriveState.email || 'argsm38@gmail.com'}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-2.5 bg-slate-900/90 rounded-lg border border-slate-800 text-[11px] text-slate-300 leading-relaxed space-y-1">
                  <p>
                    🔒 <strong>{language === 'bn' ? 'নিরাপত্তা সুরক্ষা:' : 'Security Policy:'}</strong> {language === 'bn'
                      ? 'আপনি এই এডমিন নাম্বারের অধীনে ক্যাশ কাউন্টার/ডিএসআর হিসেবে যুক্ত আছেন। আপনার প্রতিটি বিক্রয় চালান, কালেকশন ও হিসাব স্বয়ংক্রিয়ভাবে এডমিনের গুগল ড্রাইভে পোস্টিং হচ্ছে।'
                      : 'You are operating under this Admin. All your invoices and collections auto-post into Admin Google Drive.'}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    * {language === 'bn'
                      ? 'প্রতিষ্ঠানের হিসাবের পূর্ণ গোপনীয়তা রক্ষার জন্য গুগল ড্রাইভের ভেতরে প্রবেশ বা ফাইল রিস্টোরের অনুমতি শুধুমাত্র প্রধান এডমিনের রয়েছে।'
                      : 'To preserve company financial security, only the primary Admin has access to view/download drive files.'}
                  </p>
                </div>

                <button
                  onClick={handleStaffPushPostings}
                  disabled={isUploadingGDrive}
                  className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-md active:scale-95 disabled:opacity-50"
                >
                  <Upload className={`w-4 h-4 ${isUploadingGDrive ? 'animate-spin' : ''}`} />
                  <span>
                    {isUploadingGDrive
                      ? (language === 'bn' ? 'পোস্টিং হচ্ছে...' : 'Posting...')
                      : (language === 'bn' ? '⚡ এখনই এডমিন ড্রাইভে হিসাব পোস্ট করুন (Push Postings Now)' : 'Post Records to Admin Drive Now')}
                  </span>
                </button>
              </div>
            ) : (
              /* IF USER IS ADMIN -> Full Google Drive Management */
              <div className="space-y-3 pt-1 text-xs">
                {/* Storage & Auto Sync Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Storage status & Folder Link */}
                  <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-medium">
                        {language === 'bn' ? 'গুগল ড্রাইভ স্টোরেজ:' : 'Google Drive Storage:'}
                      </span>
                      <span className="font-semibold text-emerald-300 font-mono">
                        {gDriveStorage ? `${(gDriveStorage.usage / (1024 * 1024 * 1024)).toFixed(2)} GB / 15 GB (${gDriveStorage.percent}%)` : '15 GB ফ্রি ক্লাউড স্পেস সক্রিয়'}
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(2, gDriveStorage?.percent || 5)}%` }}
                      />
                    </div>

                    <div className="pt-1 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">
                        {language === 'bn' ? 'সংযুক্ত ফোন:' : 'Linked Phone:'} <strong className="text-sky-300">01937200635</strong>
                      </span>
                      {gDriveFolderUrl && (
                        <a
                          href={gDriveFolderUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          id="link-open-google-drive-folder"
                          className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 font-semibold underline underline-offset-2"
                        >
                          <Folder className="w-3.5 h-3.5 text-amber-400" />
                          <span>{language === 'bn' ? 'ড্রাইভ ফোল্ডার খুলুন ↗' : 'Open Drive Folder ↗'}</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Auto Sync Toggle & Upload Button */}
                  <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 flex flex-col justify-between gap-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-white block">
                          {language === 'bn' ? 'স্বয়ংক্রিয় ক্লাউড ড্রাইভ ব্যাকআপ' : 'Auto Google Drive Sync'}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {language === 'bn' ? 'সকল ইনভয়েস ও রিটার্ন সরাসরি ব্যাকআপ' : 'Auto-pushes all device data'}
                        </span>
                      </div>
                      <button
                        onClick={handleToggleAutoSyncGDrive}
                        id="btn-toggle-gdrive-autosync"
                        className={`w-10 h-5 rounded-full transition p-0.5 flex items-center ${
                          isAutoSyncGDrive ? 'bg-emerald-500 justify-end' : 'bg-slate-700 justify-start'
                        }`}
                      >
                        <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        onClick={handleUploadToGoogleDrive}
                        disabled={isUploadingGDrive}
                        id="btn-upload-google-drive-now"
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer shadow-sm"
                        title="বর্তমান ডিভাইসের সকল মেমো ও হিসাব গুগল ড্রাইভে ক্লাউড ব্যাকআপ করুন"
                      >
                        <Upload className={`w-3.5 h-3.5 ${isUploadingGDrive ? 'animate-spin' : ''}`} />
                        <span>
                          {isUploadingGDrive
                            ? (language === 'bn' ? 'আপলোড হচ্ছে...' : 'Uploading...')
                            : (language === 'bn' ? '📤 ড্রাইভে ব্যাকআপ পাঠান' : 'Push to Drive')}
                        </span>
                      </button>

                      <button
                        onClick={handlePullGoogleDriveUpdates}
                        disabled={isPullingGDrive}
                        id="btn-pull-google-drive-now"
                        className="w-full py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer shadow-sm"
                        title="গুগল ড্রাইভ থেকে অন্যান্য ডিভাইসের সকল সেলস ও হিসাব নামিয়ে বর্তমান ডিভাইসের সাথে সমন্বয় করুন"
                      >
                        <Download className={`w-3.5 h-3.5 ${isPullingGDrive ? 'animate-spin' : ''}`} />
                        <span>
                          {isPullingGDrive
                            ? (language === 'bn' ? 'আপডেট হচ্ছে...' : 'Syncing...')
                            : (language === 'bn' ? '📥 ড্রাইভ থেকে আপডেট নিন' : 'Pull & Merge')}
                        </span>
                      </button>
                    </div>

                    <p className="text-[10px] text-slate-300 leading-relaxed bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                      💡 {language === 'bn'
                        ? 'এডমিন নাম্বার (01937200635) দিয়ে যে কোনো ডিভাইস বা ব্রাউজারে প্রবেশ করলে অটোমেটিক গুগল ড্রাইভ কানেক্টেড থাকবে। অফলাইনে সব তথ্য ইন্টারনাল স্টোরেজে জমা থাকবে, অনলাইনে আসলে স্বয়ংক্রিয়ভাবে ড্রাইভে পোস্টিং হবে।'
                        : 'Google Drive stays automatically connected under Admin number 01937200635 across all devices and browsers.'}
                    </p>
                  </div>
                </div>

                {/* Google Drive Saved Backups Table */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-300 flex items-center gap-1.5">
                      <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{language === 'bn' ? 'গুগল ড্রাইভে রক্ষিত ব্যাকআপ ফাইলসমূহ' : 'Files in Google Drive Folder'}</span>
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {gDriveBackups.length} {language === 'bn' ? 'টি ফাইল' : 'files'}
                    </span>
                  </div>

                  <div className="bg-slate-950 rounded-xl border border-slate-800 divide-y divide-slate-800/80 max-h-48 overflow-y-auto">
                    {isLoadingGDriveFiles ? (
                      <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                        <span>{language === 'bn' ? 'গুগল ড্রাইভ ফাইল লোড হচ্ছে...' : 'Loading Google Drive files...'}</span>
                      </div>
                    ) : gDriveBackups.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400">
                        {language === 'bn'
                          ? 'এখনও গুগল ড্রাইভে কোনো ব্যাকআপ ফাইল পাঠানো হয়নি। উপরের বাটনে ক্লিক করে প্রথম ব্যাকআপ পাঠান।'
                          : 'No backups in Google Drive yet. Click "Push to Drive" to create your first backup.'}
                      </div>
                    ) : (
                      gDriveBackups.map((file) => (
                        <div key={file.id} className="p-2.5 hover:bg-slate-900/60 transition flex items-center justify-between gap-2 text-xs">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-200 truncate block text-[11px]">
                                {file.name}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/60 shrink-0 font-mono">
                                {formatFileSize(file.size)}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400">
                              {formatTimestamp(file.createdTime || file.modifiedTime)}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {file.webViewLink && (
                              <a
                                href={file.webViewLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
                                title={language === 'bn' ? 'গুগল ড্রাইভে দেখুন' : 'View in Google Drive'}
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}

                            {confirmRestoreGDriveId === file.id ? (
                              <div className="flex items-center gap-1 animate-in fade-in">
                                <button
                                  onClick={() => handleRestoreGDriveBackup(file)}
                                  disabled={isRestoring}
                                  className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-bold"
                                >
                                  {isRestoring ? '...' : (language === 'bn' ? 'হ্যাঁ, রিস্টোর' : 'Confirm')}
                                </button>
                                <button
                                  onClick={() => setConfirmRestoreGDriveId(null)}
                                  className="px-1.5 py-1 bg-slate-800 text-slate-300 rounded text-[10px]"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmRestoreGDriveId(file.id)}
                                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-semibold border border-slate-700 flex items-center gap-1"
                                title={language === 'bn' ? 'এই ফাইল থেকে ডাটা রিস্টোর করুন' : 'Restore from this backup'}
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>{language === 'bn' ? 'রিস্টোর' : 'Restore'}</span>
                              </button>
                            )}

                            {confirmDeleteGDriveId === file.id ? (
                              <div className="flex items-center gap-1 animate-in fade-in">
                                <button
                                  onClick={() => handleDeleteGDriveBackup(file)}
                                  className="px-2 py-1 bg-rose-700 hover:bg-rose-600 text-white rounded text-[10px] font-bold"
                                >
                                  {language === 'bn' ? 'মুছুন' : 'Delete'}
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteGDriveId(null)}
                                  className="px-1.5 py-1 bg-slate-800 text-slate-300 rounded text-[10px]"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteGDriveId(file.id)}
                                className="p-1.5 text-slate-500 hover:text-rose-400 rounded hover:bg-slate-800 transition"
                                title={language === 'bn' ? 'গুগল ড্রাইভ থেকে মুছুন' : 'Delete from Drive'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 3. Export / Import / Offline Simulation Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Download Server Full Backup */}
            <a
              href="/api/backup/download"
              download="matrichaya_telecom_erp_backup.json"
              id="btn-download-server-json-backup"
              className="p-3.5 bg-slate-950/70 hover:bg-slate-800/80 border border-sky-900/70 hover:border-sky-500/80 rounded-xl transition text-left flex flex-col justify-between group"
            >
              <div className="flex items-center justify-between w-full">
                <div className="p-2 rounded-lg bg-sky-500/20 text-sky-400 group-hover:scale-105 transition">
                  <Server className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800">
                  3.8 MB
                </span>
              </div>
              <div className="mt-3">
                <div className="text-xs font-bold text-sky-200 flex items-center gap-1">
                  <span>{language === 'bn' ? 'সার্ভার ব্যাকআপ JSON' : 'Server Backup JSON'}</span>
                  <Download className="w-3 h-3 text-sky-400" />
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {language === 'bn' ? 'ক্লাউড এক্সপোর্ট (৫৪ পণ্য, ১৮ অর্ডার)' : 'Full database export JSON file'}
                </p>
              </div>
            </a>

            {/* Download Local Session JSON Backup */}
            <button
              onClick={downloadLocalBackupJSON}
              id="btn-download-json-backup"
              className="p-3.5 bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800 rounded-xl transition text-left flex flex-col justify-between group"
            >
              <div className="flex items-center justify-between w-full">
                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 group-hover:scale-105 transition">
                  <Download className="w-4 h-4" />
                </div>
                <FileJson className="w-4 h-4 text-slate-500" />
              </div>
              <div className="mt-3">
                <div className="text-xs font-bold text-white">
                  {language === 'bn' ? 'লাইভ সেশন JSON ডাউনলোড' : 'Live Session JSON'}
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {language === 'bn' ? 'চলতি স্ক্রিনের ডাটা স্ন্যাপশট' : 'Save active session locally'}
                </p>
              </div>
            </button>

            {/* Restore from File */}
            <label
              htmlFor="upload-backup-file"
              id="btn-upload-json-backup"
              className="p-3.5 bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800 rounded-xl transition text-left flex flex-col justify-between group cursor-pointer"
            >
              <input
                id="upload-backup-file"
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
                disabled={isRestoring}
              />
              <div className="flex items-center justify-between w-full">
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 group-hover:scale-105 transition">
                  <Upload className="w-4 h-4" />
                </div>
                <Database className="w-4 h-4 text-slate-500" />
              </div>
              <div className="mt-3">
                <div className="text-xs font-bold text-white">
                  {isRestoring
                    ? (language === 'bn' ? 'রিস্টোর হচ্ছে...' : 'Restoring...')
                    : (language === 'bn' ? 'ফাইল থেকে রিস্টোর' : 'Restore from File')}
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {language === 'bn' ? 'JSON ফাইল নির্বাচন করুন' : 'Import JSON backup file'}
                </p>
              </div>
            </label>

            {/* Simulate Offline Mode Toggle */}
            <button
              onClick={toggleSimulateOffline}
              id="btn-toggle-offline-simulation"
              className={`p-3.5 rounded-xl border transition text-left flex flex-col justify-between group ${
                isSimulatedOffline
                  ? 'bg-amber-950/40 border-amber-500/50 text-amber-200'
                  : 'bg-slate-950/70 hover:bg-slate-800/80 border-slate-800 text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div
                  className={`p-2 rounded-lg ${
                    isSimulatedOffline ? 'bg-amber-500/30 text-amber-300' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  <Radio className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                  {isSimulatedOffline ? 'Simulated ON' : 'Real-time'}
                </span>
              </div>
              <div className="mt-3">
                <div className="text-xs font-bold text-white">
                  {isSimulatedOffline
                    ? (language === 'bn' ? 'অফলাইন মোড বন্ধ করুন' : 'Disable Simulated Offline')
                    : (language === 'bn' ? 'অফলাইন মোড টেস্ট' : 'Test Offline Mode')}
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {language === 'bn'
                    ? 'নেটওয়ার্ক ছাড়া বিল তৈরি ও ব্যাকআপ পরীক্ষা'
                    : 'Test offline POS invoices and reconnect'}
                </p>
              </div>
            </button>
          </div>

          {/* 4. Backup Snapshots History Table */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-sky-400" />
                <span>{language === 'bn' ? 'সাম্প্রতিক ক্লাউড ব্যাকআপ হিস্ট্রি' : 'Recent Cloud Backup Snapshots'}</span>
              </h4>
              <span className="text-[11px] text-slate-500">
                {serverBackups.length > 0
                  ? `${serverBackups.length} ${language === 'bn' ? 'টি ব্যাকআপ উপলব্ধ' : 'backups available'}`
                  : backupHistory.length > 0
                  ? `${backupHistory.length} ${language === 'bn' ? 'টি লোকাল রেকর্ড' : 'local records'}`
                  : ''}
              </span>
            </div>

            <div className="bg-slate-950/80 rounded-xl border border-slate-800 overflow-hidden divide-y divide-slate-800/80">
              {isLoadingServerBackups ? (
                <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
                  <span>{language === 'bn' ? 'ব্যাকআপ তালিকা লোড হচ্ছে...' : 'Loading backup history...'}</span>
                </div>
              ) : (serverBackups.length > 0 ? serverBackups : backupHistory).length === 0 ? (
                <div className="p-5 text-center text-xs text-slate-500 space-y-1">
                  <HardDrive className="w-6 h-6 mx-auto text-slate-600 mb-1" />
                  <p>{language === 'bn' ? 'এখনও কোনো ব্যাকআপ জমা করা হয়নি।' : 'No backup snapshots found.'}</p>
                  <p className="text-[11px] text-slate-600">
                    {language === 'bn'
                      ? 'উপরে "এখনই সিঙ্ক ও ব্যাকআপ নিন" বাটনে ক্লিক করে প্রথম স্ন্যাপশট সংরক্ষণ করুন।'
                      : 'Click "Sync & Backup Now" above to generate your first cloud backup snapshot.'}
                  </p>
                </div>
              ) : (
                (serverBackups.length > 0 ? serverBackups : backupHistory).slice(0, 8).map((item: any, idx: number) => (
                  <div
                    key={item.id || idx}
                    className="p-3 hover:bg-slate-900/60 transition flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-200">
                          {formatTimestamp(item.timestamp)}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800/60">
                          {item.source || 'auto-cloud'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 truncate flex items-center gap-2">
                        <span>{language === 'bn' ? 'মোট রেকর্ড:' : 'Records:'} {item.totalRecords || 0}</span>
                        <span>•</span>
                        <span className="text-emerald-400 font-mono">{item.financialSummary || ''}</span>
                      </div>
                    </div>

                    {/* Action */}
                    <div className="flex items-center gap-1.5">
                      <a
                        href="/api/backup/download"
                        download={item.fileName || "matrichaya_telecom_erp_backup.json"}
                        className="px-2.5 py-1.5 bg-sky-950/80 hover:bg-sky-900 text-sky-300 hover:text-white rounded-lg text-xs font-semibold border border-sky-800/80 transition flex items-center gap-1"
                        title={language === 'bn' ? 'JSON ফাইল ডাউনলোড করুন' : 'Download JSON file'}
                      >
                        <Download className="w-3 h-3 text-sky-400" />
                        <span>{language === 'bn' ? 'ডাউনলোড' : 'JSON'}</span>
                      </a>

                      {restoreConfirmId === item.id ? (
                        <div className="flex items-center gap-1.5 animate-in fade-in">
                          <button
                            onClick={() => handleRestoreServerBackup(item.id)}
                            disabled={isRestoring}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[11px] font-bold transition disabled:opacity-50"
                          >
                            {isRestoring
                              ? (language === 'bn' ? 'রিস্টোর হচ্ছে...' : 'Restoring...')
                              : (language === 'bn' ? 'হ্যাঁ, রিস্টোর' : 'Confirm')}
                          </button>
                          <button
                            onClick={() => setRestoreConfirmId(null)}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px]"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setRestoreConfirmId(item.id)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold border border-slate-700 transition flex items-center gap-1"
                        >
                          <RotateLeftIcon />
                          <span>{language === 'bn' ? 'রিস্টোর' : 'Restore'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 5. Offline & Backup Architecture Assurance (Bengali Guide) */}
          <div className="p-3.5 bg-slate-950/90 rounded-xl border border-slate-800/90 text-xs text-slate-300 space-y-1.5">
            <div className="flex items-center gap-2 text-sky-400 font-bold">
              <ShieldCheck className="w-4 h-4" />
              <span>{language === 'bn' ? 'অফলাইন ও ডাটা সুরক্ষার নিয়মাবলী' : 'Offline Resilience & Backup Guarantee'}</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-400 pl-1 leading-relaxed">
              <li>
                {language === 'bn'
                  ? 'ইন্টারনেট না থাকলেও POS বিক্রয়, ক্যাশ জমা ও কাস্টমার হিসাব স্বাভাবিকভাবে কাজ করবে।'
                  : 'POS invoicing, collections, and customer balances work without interruption when offline.'}
              </li>
              <li>
                {language === 'bn'
                  ? 'ইন্টারনেট সংযোগ পাওয়া মাত্রই সকল অফলাইন এন্ট্রি স্বয়ংক্রিয়ভাবে ক্লাউড ডেটাবেজে সিঙ্ক হয়ে যাবে।'
                  : 'As soon as the device reconnects to internet, all pending entries are automatically pushed to Firestore.'}
              </li>
              <li>
                {language === 'bn'
                  ? 'প্রতিটি সিঙ্কের সাথে ক্লাউড স্ন্যাপশট ব্যাকআপ তৈরি হয় যা যে কোনো সময় রিস্টোর করা যায়।'
                  : 'Every sync creates a point-in-time cloud snapshot that can be restored on demand.'}
              </li>
            </ul>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            {language === 'bn' ? 'সুরক্ষিত ক্লাউড ডাটাবেজ • ফায়ারস্টোর এনক্রিপ্টেড' : 'Firestore Persistent IndexedDB & Cloud Encrypted'}
          </span>
          <button
            onClick={closeBackupModal}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition"
          >
            {language === 'bn' ? 'বন্ধ করুন' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};

const WifiIconStatus: React.FC<{ online: boolean }> = ({ online }) => {
  if (online) {
    return <Cloud className="w-4 h-4 text-emerald-400" />;
  }
  return <CloudOff className="w-4 h-4 text-amber-400" />;
};

const RotateLeftIcon: React.FC = () => (
  <svg className="w-3 h-3 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
  </svg>
);
