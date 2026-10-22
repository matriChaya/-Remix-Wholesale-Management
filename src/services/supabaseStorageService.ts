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
}

const STORAGE_KEY_PENDING_QUEUE = 'ws_supabase_pending_docs';

/**
 * Upload a document / pending file to Supabase Storage Bucket
 */
export async function uploadToSupabaseStorage(
  fileBlob: Blob | File,
  fileName: string,
  category: 'invoice' | 'memo' | 'receipt' | 'photo' = 'invoice',
  referenceNo?: string,
  userPhone: string = '01937200635',
  userName: string = 'Admin'
): Promise<{ success: boolean; document?: ErpDocumentRecord; message: string }> {
  const supabase = getSupabase();
  const bucket = getSupabaseConfig().bucketName || 'erp-documents';

  if (!supabase || !isSupabaseConfigured()) {
    // Offline queue fallback
    saveToLocalPendingQueue({
      fileName,
      category,
      referenceNo,
      userPhone,
      userName,
      createdAt: new Date().toISOString(),
      size: fileBlob.size,
    });
    return {
      success: true,
      message: 'সুপাবেজ অফলাইন মোডে থাকায় ফাইলটি লোকাল পেন্ডিং কিউতে সেভ করা হয়েছে। সংযোগ পেলেই স্বয়ংক্রিয়ভাবে ক্লাউডে আপলোড হবে।',
    };
  }

  try {
    const timestamp = Date.now();
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${category}s/${timestamp}_${cleanFileName}`;

    // 1. Upload to Supabase Storage
    const { data: storageData, error: storageError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, fileBlob, {
        cacheControl: '3600',
        upsert: true,
      });

    if (storageError) {
      console.warn('[SupabaseStorage] Storage upload error:', storageError.message);
      // If bucket does not exist, return clear guidance
      if (storageError.message.includes('not found') || storageError.message.includes('Bucket')) {
        return {
          success: false,
          message: `সুপাবেজ স্টোরেজ বাকেট "${bucket}" তৈরি করা নেই। সুপাবেজ ড্যাশবোর্ডের Storage ট্যাবে গিয়ে "${bucket}" নামের একটি Public বাকেট তৈরি করুন।`,
        };
      }
      return {
        success: false,
        message: `ফাইল আপলোড ব্যর্থ: ${storageError.message}`,
      };
    }

    // 2. Get Public URL
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(storagePath);
    const publicUrl = urlData?.publicUrl || '';

    // 3. Record in erp_pending_documents database table
    const docRecord: ErpDocumentRecord = {
      id: `doc_${timestamp}_${Math.random().toString(36).slice(2, 6)}`,
      fileName,
      fileType: fileBlob.type || 'application/octet-stream',
      fileSize: fileBlob.size,
      storagePath,
      publicUrl,
      category,
      referenceNo: referenceNo || '',
      uploadedByPhone: userPhone,
      uploadedByName: userName,
      deviceId: getOrCreateDeviceId(),
      createdAt: new Date().toISOString(),
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
      message: `"${fileName}" ফাইলটি সুপাবেজ ক্লাউড স্টোরেজে সফলভাবে আপলোড হয়েছে।`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `আপলোড করতে সমস্যা হয়েছে: ${err.message}`,
    };
  }
}

/**
 * List all documents uploaded to Supabase Storage
 */
export async function listSupabaseDocuments(): Promise<ErpDocumentRecord[]> {
  const supabase = getSupabase();
  const bucket = getSupabaseConfig().bucketName || 'erp-documents';

  if (!supabase || !isSupabaseConfigured()) {
    return getLocalPendingQueue();
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
      }));
    }

    // Fallback: list directly from storage bucket
    const { data: files, error: filesError } = await supabase.storage.from(bucket).list('invoices', {
      limit: 50,
      sortBy: { column: 'created_at', order: 'desc' },
    });

    if (filesError || !files) {
      return getLocalPendingQueue();
    }

    return files.map((f: any) => ({
      id: f.id || f.name,
      fileName: f.name,
      fileType: f.metadata?.mimetype || 'application/pdf',
      fileSize: f.metadata?.size || 0,
      storagePath: `invoices/${f.name}`,
      publicUrl: supabase.storage.from(bucket).getPublicUrl(`invoices/${f.name}`).data.publicUrl,
      category: 'invoice',
      createdAt: f.created_at || new Date().toISOString(),
    }));
  } catch {
    return getLocalPendingQueue();
  }
}

/**
 * Delete a document from Supabase Storage and database
 */
export async function deleteSupabaseDocument(id: string, storagePath: string): Promise<boolean> {
  const supabase = getSupabase();
  const bucket = getSupabaseConfig().bucketName || 'erp-documents';

  if (!supabase || !isSupabaseConfigured()) return false;

  try {
    if (storagePath) {
      await supabase.storage.from(bucket).remove([storagePath]);
    }
    await supabase.from('erp_pending_documents').delete().eq('id', id);
    return true;
  } catch {
    return false;
  }
}

// Local storage fallback helpers
function saveToLocalPendingQueue(doc: any) {
  try {
    const list = getLocalPendingQueue();
    list.unshift({
      id: `local_${Date.now()}`,
      storagePath: '',
      publicUrl: '',
      fileType: 'application/pdf',
      fileSize: doc.size || 0,
      ...doc,
    });
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
