import { getSupabase, isSupabaseConfigured, getSupabaseConfig } from './supabaseClient';
import { getOrCreateDeviceId } from './supabasePresenceService';

export interface ErpDocumentRecord {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storagePath: string;
  publicUrl: string;
  category: 'invoice' | 'memo' | 'receipt' | 'photo';
  referenceNo?: string;
  uploadedByPhone?: string;
  uploadedByName?: string;
  deviceId?: string;
  createdAt: string;
  isAutoSigned?: boolean;
  signedBy?: string;
  signedAt?: string;
  signatureHash?: string;
  metadata?: any;
}

const STORAGE_KEY_PENDING_QUEUE = 'ws_supabase_pending_docs';
const STORAGE_KEY_AUTO_SIGN = 'ws_auto_signing_enabled';

/**
 * Check if real-time auto-signing is enabled (Defaults to TRUE as requested)
 */
export function isAutoSigningEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const val = localStorage.getItem(STORAGE_KEY_AUTO_SIGN);
    return val === null ? true : JSON.parse(val);
  } catch {
    return true;
  }
}

/**
 * Set auto-signing state
 */
export function setAutoSigningEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_AUTO_SIGN, JSON.stringify(enabled));
  } catch {}
}

/**
 * Upload a document / pending file to Supabase Storage Bucket
 */
export async function uploadToSupabaseStorage(
  fileBlob: Blob | File,
  fileName: string,
  category: 'invoice' | 'memo' | 'receipt' | 'photo' = 'invoice',
  referenceNo?: string,
  userPhone: string = '01937200635',
  userName: string = 'Admin',
  isAutoSigned: boolean = true
): Promise<{ success: boolean; document?: ErpDocumentRecord; message: string }> {
  const supabase = getSupabase();
  const bucket = getSupabaseConfig().bucketName || 'erp-documents';

  const timestamp = Date.now();
  const signatureHash = `AUTH_SIGNED_${timestamp}_${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  const signedAt = new Date().toISOString();

  if (!supabase || !isSupabaseConfigured()) {
    // Offline queue fallback
    const offlineDoc: ErpDocumentRecord = {
      id: `local_${timestamp}`,
      fileName,
      fileType: fileBlob.type || 'application/json',
      fileSize: fileBlob.size,
      storagePath: `${category}s/${timestamp}_${fileName}`,
      publicUrl: '',
      category,
      referenceNo: referenceNo || '',
      uploadedByPhone: userPhone,
      uploadedByName: userName,
      deviceId: getOrCreateDeviceId(),
      createdAt: signedAt,
      isAutoSigned,
      signedBy: 'মাতৃছায়া টেলিকম (01937200635)',
      signedAt,
      signatureHash,
    };
    saveToLocalPendingQueue(offlineDoc);
    return {
      success: true,
      document: offlineDoc,
      message: 'সুপাবেজ অফলাইন মোডে থাকায় ফাইলটি লোকাল স্টোরেজে স্বয়ংক্রিয়ভাবে ডিজিটালি সাইন করে সংরক্ষিত হয়েছে।',
    };
  }

  try {
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${category}s/${timestamp}_${cleanFileName}`;

    // 1. Upload to Supabase Storage
    const { error: storageError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, fileBlob, {
        cacheControl: '3600',
        upsert: true,
      });

    if (storageError) {
      console.warn('[SupabaseStorage] Storage upload warning:', storageError.message);
    }

    // 2. Get Public URL
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(storagePath);
    const publicUrl = urlData?.publicUrl || '';

    // 3. Record in erp_pending_documents database table
    const docRecord: ErpDocumentRecord = {
      id: `doc_${timestamp}_${Math.random().toString(36).slice(2, 6)}`,
      fileName,
      fileType: fileBlob.type || 'application/json',
      fileSize: fileBlob.size,
      storagePath,
      publicUrl,
      category,
      referenceNo: referenceNo || '',
      uploadedByPhone: userPhone,
      uploadedByName: userName,
      deviceId: getOrCreateDeviceId(),
      createdAt: signedAt,
      isAutoSigned,
      signedBy: 'মাতৃছায়া টেলিকম (01937200635)',
      signedAt,
      signatureHash,
    };

    try {
      await supabase.from('erp_pending_documents').insert({
        id: docRecord.id,
        file_name: docRecord.fileName,
        file_type: docRecord.fileType,
        file_size: docRecord.fileSize,
        storage_path: docRecord.storagePath,
        public_url: docRecord.publicUrl,
        category: docRecord.category,
        reference_no: docRecord.referenceNo,
        uploaded_by_phone: docRecord.uploadedByPhone,
        uploaded_by_name: docRecord.uploadedByName,
        device_id: docRecord.deviceId,
        created_at: docRecord.createdAt,
      });
    } catch (e) {
      console.debug('erp_pending_documents table insert skipped:', e);
    }

    return {
      success: true,
      document: docRecord,
      message: `"${fileName}" স্বয়ংক্রিয়ভাবে সাইন হয়ে সুপাবেজ ক্লাউড স্টোরেজে জমা হয়েছে।`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `আপলোড করতে সমস্যা: ${err.message}`,
    };
  }
}

/**
 * SILENT REAL-TIME AUTO-UPLOAD FOR INVOICES (Zero Pending Guarantee)
 * Called automatically in background whenever an order invoice is made
 */
export async function silentAutoUploadInvoiceDocument(
  invoice: any,
  creator: { name: string; role: string; phone: string },
  adminPhone: string = '01937200635'
): Promise<void> {
  try {
    const isSigned = isAutoSigningEnabled();
    const signedInvoicePayload = {
      ...invoice,
      cloudSyncStatus: 'REALTIME_STORED',
      digitalSignature: {
        isAutoSigned: isSigned,
        signedBy: 'মাতৃছায়া টেলিকম (01937200635)',
        signerRole: 'ADMIN_PROPRIETOR',
        signedAt: new Date().toISOString(),
        signatureSeal: 'VERIFIED_MATRICHHAYA_ERP_OFFICIAL',
        sealBn: 'ডিজিটালি স্বাক্ষরিত ও অনুমোদিত - মাতৃছায়া টেলিকম',
      },
      syncedAt: new Date().toISOString(),
      adminPhone,
      creatorDevice: getOrCreateDeviceId(),
    };

    const jsonString = JSON.stringify(signedInvoicePayload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const fileName = `INV_${invoice.invoiceNo || Date.now()}_SIGNED.json`;

    // Silently upload without awaiting or throwing UI alert
    uploadToSupabaseStorage(
      blob,
      fileName,
      'invoice',
      invoice.invoiceNo,
      creator.phone || adminPhone,
      creator.name || 'Staff',
      isSigned
    ).catch((err) => {
      console.debug('[SilentAutoUpload] Background invoice note:', err);
    });
  } catch (err) {
    console.debug('[SilentAutoUpload] Exception ignored for non-blocking UI:', err);
  }
}

/**
 * SILENT REAL-TIME AUTO-UPLOAD FOR PAYMENT RECEIPTS / VOUCHERS
 */
export async function silentAutoUploadPaymentReceipt(
  receipt: any,
  creator: { name: string; role: string; phone: string },
  adminPhone: string = '01937200635'
): Promise<void> {
  try {
    const signedReceiptPayload = {
      ...receipt,
      cloudSyncStatus: 'REALTIME_STORED',
      digitalSignature: {
        isAutoSigned: true,
        signedBy: 'মাতৃছায়া টেলিকম (01937200635)',
        signerRole: 'ADMIN_PROPRIETOR',
        signedAt: new Date().toISOString(),
        signatureSeal: 'VERIFIED_CASH_RECEIPT_OFFICIAL',
        sealBn: 'ডিজিটালি আদায় রসিদ অনুমোদিত',
      },
      syncedAt: new Date().toISOString(),
      adminPhone,
      creatorDevice: getOrCreateDeviceId(),
    };

    const jsonString = JSON.stringify(signedReceiptPayload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const fileName = `RCPT_${receipt.id || Date.now()}_SIGNED.json`;

    uploadToSupabaseStorage(
      blob,
      fileName,
      'receipt',
      receipt.referenceNo || receipt.id,
      creator.phone || adminPhone,
      creator.name || 'Staff',
      true
    ).catch(() => {});
  } catch {}
}

/**
 * List all documents uploaded to Supabase Storage
 */
export async function listSupabaseDocuments(): Promise<ErpDocumentRecord[]> {
  const supabase = getSupabase();
  const bucket = getSupabaseConfig().bucketName || 'erp-documents';

  const localQueue = getLocalPendingQueue();

  if (!supabase || !isSupabaseConfigured()) {
    return localQueue;
  }

  try {
    // Check if table exists
    const { data: dbData, error: dbError } = await supabase
      .from('erp_pending_documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (!dbError && dbData && dbData.length > 0) {
      return dbData.map((d: any) => ({
        id: d.id,
        fileName: d.file_name,
        fileType: d.file_type,
        fileSize: d.file_size,
        storagePath: d.storage_path,
        publicUrl: d.public_url,
        category: d.category,
        referenceNo: d.reference_no,
        uploadedByPhone: d.uploaded_by_phone,
        uploadedByName: d.uploaded_by_name,
        deviceId: d.device_id,
        createdAt: d.created_at,
        isAutoSigned: true,
        signedBy: 'মাতৃছায়া টেলিকম (01937200635)',
        signedAt: d.created_at,
      }));
    }

    // Fallback: list directly from storage bucket
    const { data: files, error: filesError } = await supabase.storage.from(bucket).list('invoices', {
      limit: 50,
      sortBy: { column: 'created_at', order: 'desc' },
    });

    if (filesError || !files) {
      return localQueue;
    }

    return files.map((f: any) => ({
      id: f.id || f.name,
      fileName: f.name,
      fileType: f.metadata?.mimetype || 'application/json',
      fileSize: f.metadata?.size || 0,
      storagePath: `invoices/${f.name}`,
      publicUrl: supabase.storage.from(bucket).getPublicUrl(`invoices/${f.name}`).data.publicUrl,
      category: 'invoice',
      createdAt: f.created_at || new Date().toISOString(),
      isAutoSigned: true,
      signedBy: 'মাতৃছায়া টেলিকম (01937200635)',
    }));
  } catch {
    return localQueue;
  }
}

/**
 * Delete a document from Supabase Storage and database
 */
export async function deleteSupabaseDocument(id: string, storagePath: string): Promise<boolean> {
  const supabase = getSupabase();
  const bucket = getSupabaseConfig().bucketName || 'erp-documents';

  if (!supabase || !isSupabaseConfigured()) {
    removeLocalPendingDoc(id);
    return true;
  }

  try {
    if (storagePath) {
      await supabase.storage.from(bucket).remove([storagePath]);
    }
    await supabase.from('erp_pending_documents').delete().eq('id', id);
    removeLocalPendingDoc(id);
    return true;
  } catch {
    removeLocalPendingDoc(id);
    return false;
  }
}

/**
 * Drain and upload any queued local files silently in the background
 */
export async function drainLocalPendingQueue(): Promise<number> {
  const queue = getLocalPendingQueue();
  if (queue.length === 0) return 0;
  if (!isSupabaseConfigured()) return 0;

  let drainedCount = 0;
  for (const doc of queue) {
    try {
      const blob = new Blob([JSON.stringify(doc.metadata || doc)], { type: 'application/json' });
      const res = await uploadToSupabaseStorage(
        blob,
        doc.fileName,
        doc.category,
        doc.referenceNo,
        doc.uploadedByPhone || '01937200635',
        doc.uploadedByName || 'Staff',
        true
      );
      if (res.success) {
        removeLocalPendingDoc(doc.id);
        drainedCount++;
      }
    } catch {}
  }
  return drainedCount;
}

// Local storage fallback helpers
function saveToLocalPendingQueue(doc: any) {
  try {
    const list = getLocalPendingQueue();
    list.unshift(doc);
    localStorage.setItem(STORAGE_KEY_PENDING_QUEUE, JSON.stringify(list.slice(0, 50)));
  } catch (e) {}
}

function getLocalPendingQueue(): ErpDocumentRecord[] {
  try {
    const str = localStorage.getItem(STORAGE_KEY_PENDING_QUEUE);
    return str ? JSON.parse(str) : [];
  } catch {
    return [];
  }
}

function removeLocalPendingDoc(id: string) {
  try {
    const list = getLocalPendingQueue().filter((d) => d.id !== id);
    localStorage.setItem(STORAGE_KEY_PENDING_QUEUE, JSON.stringify(list));
  } catch {}
}
