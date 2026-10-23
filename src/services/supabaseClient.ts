import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Default Project URL & API Key for "মাতৃছায়া টেলিকম ইআরপি" (Matrichhaya Telecom ERP)
export const DEFAULT_SUPABASE_URL = 'https://yawbwppzvbnllxicvgxs.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_4wo-cfHwFEzC-52xLmNgZg_t_uQLO1w';

const ENV_SUPABASE_URL = ((import.meta as any).env?.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL).trim();
const ENV_SUPABASE_ANON_KEY = ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY).trim();

const STORAGE_KEY_CONFIG = 'ws_supabase_config';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  bucketName?: string;
  isCustom?: boolean;
}

// In-memory singleton client
let clientInstance: SupabaseClient | null = null;
let currentConfig: SupabaseConfig | null = null;

/**
 * Retrieve the active Supabase configuration (from localStorage or environment variables or defaults)
 */
export function getSupabaseConfig(): SupabaseConfig {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.url && parsed?.anonKey) {
          return {
            url: parsed.url.trim(),
            anonKey: parsed.anonKey.trim(),
            bucketName: parsed.bucketName || 'erp-documents',
            isCustom: true,
          };
        }
      }
    } catch (e) {
      console.warn('Error reading stored Supabase config:', e);
    }
  }

  return {
    url: ENV_SUPABASE_URL || DEFAULT_SUPABASE_URL,
    anonKey: ENV_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY,
    bucketName: 'erp-documents',
    isCustom: false,
  };
}

/**
 * Save user custom Supabase credentials from UI
 */
export function saveSupabaseConfig(url: string, anonKey: string, bucketName: string = 'erp-documents'): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const config: SupabaseConfig = {
      url: url.trim(),
      anonKey: anonKey.trim(),
      bucketName: bucketName.trim() || 'erp-documents',
      isCustom: true,
    };
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
    // Reset instance so it re-initializes on next call
    clientInstance = null;
    currentConfig = config;
    return true;
  } catch (e) {
    console.error('Failed to save Supabase config:', e);
    return false;
  }
}

/**
 * Clear stored Supabase configuration
 */
export function clearSupabaseConfig(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY_CONFIG);
  }
  clientInstance = null;
  currentConfig = null;
}

/**
 * Check if a valid Supabase URL and Key are configured
 */
export function isSupabaseConfigured(): boolean {
  const config = getSupabaseConfig();
  return Boolean(
    config.url &&
    config.anonKey &&
    config.url.startsWith('https://') &&
    config.url.includes('.supabase.co') &&
    config.anonKey.length > 20
  );
}

/**
 * Get or create the Supabase client instance
 */
export function getSupabase(): SupabaseClient | null {
  const config = getSupabaseConfig();
  
  if (!config.url || !config.anonKey) {
    return null;
  }

  if (
    clientInstance &&
    currentConfig &&
    currentConfig.url === config.url &&
    currentConfig.anonKey === config.anonKey
  ) {
    return clientInstance;
  }

  try {
    clientInstance = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'ws_sb_auth_token',
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
    currentConfig = config;
    return clientInstance;
  } catch (err) {
    console.warn('[SupabaseClient] Initialization warning:', err);
    return null;
  }
}

/**
 * Test connectivity with Supabase project
 */
export async function testSupabaseConnection(overrideUrl?: string, overrideKey?: string): Promise<{
  success: boolean;
  message: string;
  latencyMs?: number;
}> {
  const url = (overrideUrl || getSupabaseConfig().url || '').trim();
  const key = (overrideKey || getSupabaseConfig().anonKey || '').trim();

  if (!url || !key) {
    return {
      success: false,
      message: 'সুপাবেজ প্রজেক্ট URL এবং Anon API Key প্রদান করুন।',
    };
  }

  if (!url.startsWith('https://') || !url.includes('.supabase.co')) {
    return {
      success: false,
      message: 'ভুল URL ফরম্যাট! উদাহরণ: https://your-project-id.supabase.co',
    };
  }

  const startTime = Date.now();
  try {
    const testClient = createClient(url, key);
    // Ping by checking auth settings or querying root
    const { error } = await testClient.auth.getSession();
    const latencyMs = Date.now() - startTime;

    if (error && !error.message.includes('session')) {
      return {
        success: false,
        message: `কানেকশন ব্যর্থ হয়েছে: ${error.message}`,
        latencyMs,
      };
    }

    return {
      success: true,
      message: `সুপাবেজ ক্লাউড সফলভাবে কানেক্ট হয়েছে (${latencyMs}ms)`,
      latencyMs,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `সংযোগ ত্রুটি: ${err.message || 'নেটওয়ার্ক বা সার্ভারে সমস্যা'}`,
    };
  }
}
