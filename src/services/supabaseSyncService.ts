import { getSupabase, isSupabaseConfigured } from './supabaseClient';
import { safeStorage } from '../utils/indexedDbStorage';
import { broadcastRealtimeDataChange, getOrCreateDeviceId } from './supabasePresenceService';

export const SUPABASE_SYNC_TABLE = 'matrichhaya_erp_sync';

/**
 * Complete SQL Schema for Supabase PostgreSQL Database
 * Can be run in Supabase SQL Editor in 1 click
 */
export const SUPABASE_SQL_SCHEMA = `-- =================================================================
-- "মাতৃছায়া টেলিকম ইআরপি" (Matrichhaya Telecom ERP) Database Schema
-- Supabase PostgreSQL Free Tier Setup Script
-- =================================================================

-- 1. Universal State & Record Sync Table (Zero-migration guarantee)
CREATE TABLE IF NOT EXISTS public.matrichhaya_erp_sync (
  id TEXT PRIMARY KEY,
  admin_phone TEXT NOT NULL DEFAULT '01937200635',
  collection_name TEXT NOT NULL,
  data JSONB NOT NULL,
  record_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  device_id TEXT,
  updated_by TEXT
);

-- Index for fast lookup by collection and admin
CREATE INDEX IF NOT EXISTS idx_matrichhaya_sync_admin ON public.matrichhaya_erp_sync (admin_phone, collection_name);

-- 2. Realtime Device Presence Table
CREATE TABLE IF NOT EXISTS public.erp_device_presence (
  device_id TEXT PRIMARY KEY,
  user_id TEXT,
  name TEXT,
  role TEXT,
  phone TEXT,
  email TEXT,
  platform TEXT DEFAULT 'browser',
  is_online BOOLEAN DEFAULT true,
  last_active TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for live presence status
CREATE INDEX IF NOT EXISTS idx_device_presence_online ON public.erp_device_presence (is_online, last_active);

-- 3. Document & Invoice Pending Files Table
CREATE TABLE IF NOT EXISTS public.erp_pending_documents (
  id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  storage_path TEXT NOT NULL,
  public_url TEXT,
  category TEXT DEFAULT 'invoice', -- invoice, memo, receipt, photo
  reference_no TEXT,
  uploaded_by_phone TEXT,
  uploaded_by_name TEXT,
  device_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable Row Level Security (RLS) with Public Access for App Users
ALTER TABLE public.matrichhaya_erp_sync ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_device_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_pending_documents ENABLE ROW LEVEL SECURITY;

-- Create Open Policies (for anonymous & authenticated ERP clients)
DROP POLICY IF EXISTS "Public Access matrichhaya_erp_sync" ON public.matrichhaya_erp_sync;
CREATE POLICY "Public Access matrichhaya_erp_sync" ON public.matrichhaya_erp_sync
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Access erp_device_presence" ON public.erp_device_presence;
CREATE POLICY "Public Access erp_device_presence" ON public.erp_device_presence
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Access erp_pending_documents" ON public.erp_pending_documents;
CREATE POLICY "Public Access erp_pending_documents" ON public.erp_pending_documents
  FOR ALL USING (true) WITH CHECK (true);

-- Enable Realtime for Presence and Sync
ALTER PUBLICATION supabase_realtime ADD TABLE public.matrichhaya_erp_sync;
ALTER PUBLICATION supabase_realtime ADD TABLE public.erp_device_presence;
`;

export interface ErpSyncBundle {
  users?: any[];
  products?: any[];
  orders?: any[];
  retailers?: any[];
  suppliers?: any[];
  supplierLedger?: any[];
  cashTransfers?: any[];
  capitalTransactions?: any[];
  bankAccounts?: any[];
  replacements?: any[];
  expenses?: any[];
  companyReturns?: any[];
  activityLogs?: any[];
  appSettings?: any;
}

/**
 * Upload all ERP application state into Supabase PostgreSQL
 */
export async function syncAllToSupabase(
  bundle: ErpSyncBundle,
  adminPhone: string = '01937200635',
  updatedBy: string = 'Admin'
): Promise<{ success: boolean; message: string; count: number }> {
  const supabase = getSupabase();
  if (!supabase || !isSupabaseConfigured()) {
    return {
      success: false,
      message: 'সুপাবেজ সংযোগ কনফিগার করা নেই। অনুগ্রহ করে Supabase URL ও Key সেট করুন।',
      count: 0,
    };
  }

  try {
    const collections: Array<{ name: string; data: any[] | any }> = [
      { name: 'users', data: bundle.users || [] },
      { name: 'products', data: bundle.products || [] },
      { name: 'orders', data: bundle.orders || [] },
      { name: 'retailers', data: bundle.retailers || [] },
      { name: 'suppliers', data: bundle.suppliers || [] },
      { name: 'supplierLedger', data: bundle.supplierLedger || [] },
      { name: 'cashTransfers', data: bundle.cashTransfers || [] },
      { name: 'capitalTransactions', data: bundle.capitalTransactions || [] },
      { name: 'bankAccounts', data: bundle.bankAccounts || [] },
      { name: 'replacements', data: bundle.replacements || [] },
      { name: 'expenses', data: bundle.expenses || [] },
      { name: 'companyReturns', data: bundle.companyReturns || [] },
      { name: 'activityLogs', data: (bundle.activityLogs || []).slice(0, 50) },
      { name: 'appSettings', data: bundle.appSettings || {} },
    ];

    let totalRecords = 0;
    const cleanAdminPhone = adminPhone.replace(/[^0-9]/g, '') || '01937200635';

    for (const item of collections) {
      const isArr = Array.isArray(item.data);
      const count = isArr ? item.data.length : 1;
      totalRecords += count;

      const recordId = `${cleanAdminPhone}_${item.name}`;

      const { error } = await supabase
        .from(SUPABASE_SYNC_TABLE)
        .upsert(
          {
            id: recordId,
            admin_phone: cleanAdminPhone,
            collection_name: item.name,
            data: item.data,
            record_count: count,
            updated_at: new Date().toISOString(),
            updated_by: updatedBy,
          },
          { onConflict: 'id' }
        );

      if (error) {
        console.warn(`[SupabaseSync] Upsert failed for ${item.name}:`, error.message);
        // If the table does not exist, return a descriptive error informing the user to run SQL
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          return {
            success: false,
            message: `সুপাবেজ ডাটাবেজে টেবিল পাওয়া যায়নি (${error.message})। দয়া করে সুপাবেজ SQL এডিটরে দেওয়া SQL স্ক্রিপ্টটি একবার রান করুন।`,
            count: 0,
          };
        }
      }
    }

    // Save timestamp of successful sync
    const nowIso = new Date().toISOString();
    safeStorage.setItem('ws_last_supabase_sync', nowIso);

    return {
      success: true,
      message: `সুপাবেজে মোট ${totalRecords}টি হিসাব ও রেকর্ড সফলভাবে সংরক্ষিত হয়েছে।`,
      count: totalRecords,
    };
  } catch (err: any) {
    console.error('[SupabaseSync] Error in syncAllToSupabase:', err);
    return {
      success: false,
      message: `সিঙ্ক ব্যর্থ হয়েছে: ${err.message || 'অজানা ত্রুটি'}`,
      count: 0,
    };
  }
}

/**
 * Fetch and restore all ERP application state from Supabase PostgreSQL
 */
export async function fetchFromSupabase(
  adminPhone: string = '01937200635'
): Promise<{ success: boolean; data?: ErpSyncBundle; message: string }> {
  const supabase = getSupabase();
  if (!supabase || !isSupabaseConfigured()) {
    return {
      success: false,
      message: 'সুপাবেজ সংযোগ সক্রিয় নেই।',
    };
  }

  try {
    const cleanAdminPhone = adminPhone.replace(/[^0-9]/g, '') || '01937200635';

    const { data, error } = await supabase
      .from(SUPABASE_SYNC_TABLE)
      .select('*')
      .eq('admin_phone', cleanAdminPhone);

    if (error) {
      return {
        success: false,
        message: `ডাটা লোড ত্রুটি: ${error.message}`,
      };
    }

    if (!data || data.length === 0) {
      return {
        success: false,
        message: 'সুপাবেজে এই এডমিনের কোনো পূর্ববর্তী ডেটা পাওয়া যায়নি।',
      };
    }

    const bundle: ErpSyncBundle = {};

    data.forEach((row: any) => {
      const col = row.collection_name;
      if (col && row.data) {
        (bundle as any)[col] = row.data;
      }
    });

    return {
      success: true,
      data: bundle,
      message: `সুপাবেজ থেকে ${data.length}টি কালেকশনের হিসাব সফলভাবে পুনরুদ্ধার করা হয়েছে।`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `পুনরুদ্ধার করতে ব্যর্থ: ${err.message}`,
    };
  }
}

const STORAGE_OFFLINE_QUEUE_KEY = 'ws_offline_data_queue';

export interface OfflineDataQueueItem {
  id: string;
  collectionName: string;
  data: any;
  adminPhone: string;
  updatedBy: string;
  queuedAt: string;
  isAutoSigned?: boolean;
}

/**
 * Queue a data update locally when device is offline
 */
export function queueOfflineDataChange(
  collectionName: string,
  data: any,
  adminPhone: string = '01937200635',
  updatedBy: string = 'Staff'
): void {
  try {
    const queue = getOfflineQueue();
    // Replace if same collection already exists in queue to keep latest state
    const filtered = queue.filter((q) => q.collectionName !== collectionName);
    filtered.push({
      id: `off_${Date.now()}_${collectionName}`,
      collectionName,
      data,
      adminPhone,
      updatedBy,
      queuedAt: new Date().toISOString(),
      isAutoSigned: true,
    });
    safeStorage.setItem(STORAGE_OFFLINE_QUEUE_KEY, JSON.stringify(filtered));
    console.log(`[OfflineQueue] Queued ${collectionName} for auto-signing & sync when online.`);
  } catch (e) {
    console.debug('Failed to queue offline update:', e);
  }
}

/**
 * Get the current offline sync queue
 */
export function getOfflineQueue(): OfflineDataQueueItem[] {
  try {
    const raw = safeStorage.getItem(STORAGE_OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Push an individual entity update directly to Supabase with instant Multi-Device Realtime Broadcast
 */
export async function pushEntityToSupabase(
  collectionName: string,
  data: any,
  adminPhone: string = '01937200635',
  updatedBy: string = 'Staff'
): Promise<boolean> {
  const supabase = getSupabase();
  const cleanAdminPhone = adminPhone.replace(/[^0-9]/g, '') || '01937200635';
  const deviceId = getOrCreateDeviceId();

  // If offline or not configured, queue locally
  if (!supabase || !isSupabaseConfigured() || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    queueOfflineDataChange(collectionName, data, cleanAdminPhone, updatedBy);
    return false;
  }

  try {
    const recordId = `${cleanAdminPhone}_${collectionName}`;
    const count = Array.isArray(data) ? data.length : 1;

    const { error } = await supabase.from(SUPABASE_SYNC_TABLE).upsert(
      {
        id: recordId,
        admin_phone: cleanAdminPhone,
        collection_name: collectionName,
        data: data,
        record_count: count,
        updated_at: new Date().toISOString(),
        device_id: deviceId,
        updated_by: updatedBy,
      },
      { onConflict: 'id' }
    );

    if (error) {
      console.warn(`[SupabaseSync] Push failed for ${collectionName}:`, error.message);
      queueOfflineDataChange(collectionName, data, cleanAdminPhone, updatedBy);
      return false;
    }

    // ⚡ Instant Multi-Device Broadcast: All connected devices receive this change immediately!
    broadcastRealtimeDataChange(collectionName, data, 'UPDATE', updatedBy);
    return true;
  } catch (err) {
    queueOfflineDataChange(collectionName, data, cleanAdminPhone, updatedBy);
    return false;
  }
}

/**
 * Flush all queued offline data to Supabase with official digital auto-signature upon network reconnection
 */
export async function flushOfflineQueueToSupabase(
  adminPhone: string = '01937200635'
): Promise<{ success: boolean; syncedCount: number; message: string }> {
  const queue = getOfflineQueue();
  if (queue.length === 0) {
    return { success: true, syncedCount: 0, message: 'কোনো অফলাইন ডাটা পেন্ডিং নেই।' };
  }

  const supabase = getSupabase();
  if (!supabase || !isSupabaseConfigured()) {
    return { success: false, syncedCount: 0, message: 'সুপাবেজ সংযোগ প্রস্তুত নয়।' };
  }

  let syncedCount = 0;
  const remaining: OfflineDataQueueItem[] = [];

  for (const item of queue) {
    try {
      // 🔏 Apply official digital auto-signing seal
      let finalData = item.data;
      const signedAt = new Date().toISOString();
      const signatureSeal = `OFFLINE_RECONNECT_SIGNED_${Date.now()}`;

      if (Array.isArray(finalData)) {
        finalData = finalData.map((record: any) => {
          if (record && typeof record === 'object') {
            return {
              ...record,
              isAutoSigned: true,
              signedBy: 'মাতৃছায়া টেলিকম (01937200635)',
              signedAt,
              signatureSeal,
            };
          }
          return record;
        });
      }

      const res = await pushEntityToSupabase(
        item.collectionName,
        finalData,
        item.adminPhone || adminPhone,
        `${item.updatedBy || 'Staff'} (Auto-Signed)`
      );

      if (res) {
        syncedCount++;
      } else {
        remaining.push(item);
      }
    } catch {
      remaining.push(item);
    }
  }

  safeStorage.setItem(STORAGE_OFFLINE_QUEUE_KEY, JSON.stringify(remaining));

  return {
    success: syncedCount > 0,
    syncedCount,
    message: syncedCount > 0
      ? `অফলাইনের ${syncedCount}টি হিসাব স্বয়ংক্রিয়ভাবে ডিজিটালি সাইন হয়ে সুপাবেজ ডাটাবেজে যুক্ত হয়েছে।`
      : 'অফলাইন ডাটা সিঙ্ক প্রক্রিয়ায় রয়েছে।',
  };
}

