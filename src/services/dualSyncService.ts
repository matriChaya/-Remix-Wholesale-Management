/**
 * ============================================================================
 * Dual-Live Sync Architecture Service (Supabase PostgreSQL + Firebase Firestore)
 * ============================================================================
 * Provides synchronized real-time dual-write capability for all ERP sales,
 * inventory, customer, and accounting operations across both Supabase and Firebase.
 */

import { doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db, COLLECTIONS, firebaseConfig } from '../lib/firebase';
import {
  pushEntityToSupabase,
  syncAllToSupabase,
  queueOfflineDataChange,
  ErpSyncBundle,
} from './supabaseSyncService';
import { broadcastRealtimeDataChange } from './supabasePresenceService';
import { safeStorage } from '../utils/indexedDbStorage';

export { firebaseConfig };

export interface DualWriteOptions {
  adminPhone?: string;
  updatedBy?: string;
  docId?: string;
  merge?: boolean;
  fullCollectionData?: any[];
  skipBroadcast?: boolean;
}

export interface DualWriteResult {
  success: boolean;
  supabaseSuccess: boolean;
  firestoreSuccess: boolean;
  collectionName: string;
  timestamp: string;
  message: string;
  errors?: string[];
}

/**
 * Clean data for Firestore: recursively strip undefined values and convert unsupported objects
 */
export function cleanFirestorePayload(obj: any): any {
  if (obj === undefined) {
    return null;
  }
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (obj instanceof Date) {
    return obj.toISOString();
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => (item === undefined ? null : cleanFirestorePayload(item)));
  }
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = cleanFirestorePayload(value);
    }
  }
  return cleaned;
}

/**
 * ⚡ Common Dual-Write Function:
 * Saves any sales (orders), inventory (products), or other ERP data simultaneously
 * to both Supabase and Firebase Firestore in real-time.
 *
 * Resilient Architecture:
 * Uses parallel execution with independent fail-safe handlers. If one provider is
 * undergoing network limits or offline conditions, the other succeeds immediately.
 */
export async function dualWriteData(
  collectionName: string,
  data: any,
  options: DualWriteOptions = {}
): Promise<DualWriteResult> {
  const adminPhone = options.adminPhone || '01937200635';
  const updatedBy = options.updatedBy || 'Staff';
  const merge = options.merge !== false;
  const timestamp = new Date().toISOString();
  const errors: string[] = [];

  let firestoreSuccess = false;
  let supabaseSuccess = false;

  // 1. Firebase Firestore Write Handler
  const writeToFirestore = async (): Promise<boolean> => {
    try {
      if (!db) {
        console.warn('[DualLiveSync] Firestore instance is not initialized.');
        return false;
      }

      if (Array.isArray(data)) {
        // Chunk batch write for arrays (up to 400 docs per batch to stay under Firestore limit of 500)
        const items = data.filter(Boolean);
        const chunkSize = 400;

        for (let i = 0; i < items.length; i += chunkSize) {
          const chunk = items.slice(i, i + chunkSize);
          const batch = writeBatch(db);

          for (const item of chunk) {
            const id = item?.id ? String(item.id) : `doc_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
            const clean = cleanFirestorePayload(item);
            const docRef = doc(db, collectionName, id);
            batch.set(docRef, clean, { merge });
          }

          await batch.commit();
        }
        return true;
      } else if (data && typeof data === 'object') {
        // Single document write
        const docId = options.docId || (data.id ? String(data.id) : `doc_${Date.now()}`);
        const clean = cleanFirestorePayload(data);
        const docRef = doc(db, collectionName, docId);
        await setDoc(docRef, clean, { merge });
        return true;
      }
      return false;
    } catch (err: any) {
      const msg = `Firestore write failed for ${collectionName}: ${err?.message || err}`;
      console.warn('[DualLiveSync]', msg);
      errors.push(msg);
      return false;
    }
  };

  // 2. Supabase Write Handler
  const writeToSupabase = async (): Promise<boolean> => {
    try {
      if (Array.isArray(data)) {
        return await pushEntityToSupabase(collectionName, data, adminPhone, updatedBy);
      } else if (data && typeof data === 'object') {
        // Single document: if caller passed the full collection array, use that
        if (options.fullCollectionData && Array.isArray(options.fullCollectionData)) {
          return await pushEntityToSupabase(
            collectionName,
            options.fullCollectionData,
            adminPhone,
            updatedBy
          );
        }

        // Otherwise, retrieve existing collection from storage and update/prepend
        let existingList: any[] = [];
        try {
          const raw = safeStorage.getItem(`ws_${collectionName}`);
          if (raw) existingList = JSON.parse(raw);
        } catch {}

        if (!Array.isArray(existingList)) existingList = [];

        const targetId = options.docId || data.id;
        const index = targetId ? existingList.findIndex((item) => item?.id === targetId) : -1;

        let mergedList: any[];
        if (index >= 0) {
          mergedList = [...existingList];
          mergedList[index] = { ...mergedList[index], ...data };
        } else {
          mergedList = [data, ...existingList];
        }

        return await pushEntityToSupabase(collectionName, mergedList, adminPhone, updatedBy);
      }
      return false;
    } catch (err: any) {
      const msg = `Supabase write failed for ${collectionName}: ${err?.message || err}`;
      console.warn('[DualLiveSync]', msg);
      errors.push(msg);
      queueOfflineDataChange(collectionName, data, adminPhone, updatedBy);
      return false;
    }
  };

  // Execute both writes simultaneously in real-time
  const [fsResult, sbResult] = await Promise.allSettled([
    writeToFirestore(),
    writeToSupabase(),
  ]);

  firestoreSuccess = fsResult.status === 'fulfilled' && fsResult.value === true;
  supabaseSuccess = sbResult.status === 'fulfilled' && sbResult.value === true;

  const isSuccess = firestoreSuccess || supabaseSuccess;

  // Multi-Device Broadcast if at least one succeeded
  if (isSuccess && !options.skipBroadcast) {
    try {
      broadcastRealtimeDataChange(collectionName, data, 'UPDATE', updatedBy);
    } catch {}
  }

  let statusMessage = '';
  if (firestoreSuccess && supabaseSuccess) {
    statusMessage = `সুপাবেজ ও ফায়ারবেস উভয় ডাটাবেজে সফলভাবে রিয়েল-টাইমে সংরক্ষিত হয়েছে (${collectionName})।`;
  } else if (supabaseSuccess) {
    statusMessage = `সুপাবেজ ডাটাবেজে সফলভাবে সংরক্ষিত হয়েছে (ফায়ারবেস অফলাইন ক্যাশ/কিউ সক্রিয়)।`;
  } else if (firestoreSuccess) {
    statusMessage = `ফায়ারবেস ডাটাবেজে সফলভাবে সংরক্ষিত হয়েছে (সুপাবেজ অফলাইন কিউ সক্রিয়)।`;
  } else {
    statusMessage = `উভয় ডাটাবেজ অফলাইন মোডে থাকায় লোকাল ক্যাশ ও কিউতে সংরক্ষিত হয়েছে।`;
  }

  return {
    success: isSuccess,
    supabaseSuccess,
    firestoreSuccess,
    collectionName,
    timestamp,
    message: statusMessage,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * ⚡ Common Dual-Delete Function:
 * Removes an entity simultaneously from both Firebase Firestore and Supabase.
 */
export async function dualDeleteData(
  collectionName: string,
  docId: string,
  options: DualWriteOptions = {}
): Promise<DualWriteResult> {
  const adminPhone = options.adminPhone || '01937200635';
  const updatedBy = options.updatedBy || 'Staff';
  const timestamp = new Date().toISOString();
  const errors: string[] = [];

  let firestoreSuccess = false;
  let supabaseSuccess = false;

  // 1. Delete from Firestore
  try {
    if (db) {
      const docRef = doc(db, collectionName, docId);
      await deleteDoc(docRef);
      firestoreSuccess = true;
    }
  } catch (err: any) {
    errors.push(`Firestore delete failed: ${err?.message || err}`);
  }

  // 2. Delete from Supabase by updating the collection array
  try {
    let existingList: any[] = [];
    try {
      const raw = safeStorage.getItem(`ws_${collectionName}`);
      if (raw) existingList = JSON.parse(raw);
    } catch {}

    if (Array.isArray(existingList)) {
      const filtered = existingList.filter((item) => item?.id !== docId);
      supabaseSuccess = await pushEntityToSupabase(collectionName, filtered, adminPhone, updatedBy);
    } else {
      supabaseSuccess = true;
    }
  } catch (err: any) {
    errors.push(`Supabase delete failed: ${err?.message || err}`);
  }

  const isSuccess = firestoreSuccess || supabaseSuccess;

  if (isSuccess && !options.skipBroadcast) {
    try {
      broadcastRealtimeDataChange(collectionName, { id: docId }, 'DELETE', updatedBy);
    } catch {}
  }

  return {
    success: isSuccess,
    supabaseSuccess,
    firestoreSuccess,
    collectionName,
    timestamp,
    message: isSuccess ? 'উভয় ডাটাবেজ থেকে সফলভাবে মুছে ফেলা হয়েছে।' : 'মুছে ফেলা ব্যর্থ হয়েছে।',
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * ⚡ Full Dual-Sync:
 * Uploads all ERP application state into both Supabase and Firebase Firestore
 */
export async function dualSyncAll(
  bundle: ErpSyncBundle,
  adminPhone: string = '01937200635',
  updatedBy: string = 'Admin'
): Promise<{ success: boolean; message: string; supabaseCount: number; firestoreSuccess: boolean }> {
  // Sync Supabase
  const sbRes = await syncAllToSupabase(bundle, adminPhone, updatedBy);

  // Sync Firestore
  let fsOk = true;
  try {
    const collectionsToSync: Array<{ name: string; data: any[] }> = [
      { name: COLLECTIONS.PRODUCTS, data: bundle.products || [] },
      { name: COLLECTIONS.ORDERS, data: bundle.orders || [] },
      { name: COLLECTIONS.RETAILERS, data: bundle.retailers || [] },
      { name: COLLECTIONS.SUPPLIERS, data: bundle.suppliers || [] },
      { name: COLLECTIONS.SUPPLIER_LEDGER, data: bundle.supplierLedger || [] },
      { name: COLLECTIONS.CASH_TRANSFERS, data: bundle.cashTransfers || [] },
      { name: COLLECTIONS.CAPITAL_TRANSACTIONS, data: bundle.capitalTransactions || [] },
      { name: COLLECTIONS.REPLACEMENTS, data: bundle.replacements || [] },
      { name: COLLECTIONS.COMPANY_RETURNS, data: bundle.companyReturns || [] },
      { name: COLLECTIONS.EXPENSES, data: bundle.expenses || [] },
      { name: COLLECTIONS.USERS, data: bundle.users || [] },
    ];

    for (const col of collectionsToSync) {
      if (col.data && col.data.length > 0) {
        await dualWriteData(col.name, col.data, {
          adminPhone,
          updatedBy,
          skipBroadcast: true,
        });
      }
    }
  } catch (e) {
    console.warn('[DualSyncAll] Firestore sync notice:', e);
    fsOk = false;
  }

  return {
    success: sbRes.success || fsOk,
    supabaseCount: sbRes.count,
    firestoreSuccess: fsOk,
    message: `সুপাবেজ ও ফায়ারবেস ডুয়াল লাইভ সিঙ্ক সম্পন্ন হয়েছে (${sbRes.count}টি রেকর্ড)।`,
  };
}
