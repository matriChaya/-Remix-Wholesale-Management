import { getSupabase, isSupabaseConfigured } from './supabaseClient';
import { UserProfile } from '../types';

export interface LiveDevicePresence {
  deviceId: string;
  userId: string;
  name: string;
  role: string;
  phone: string;
  email?: string;
  platform: 'mobile' | 'laptop' | 'desktop' | 'tablet';
  isOnline: boolean;
  joinedAt: string;
  lastSeen: string;
  lastActiveTimeFormatted?: string;
}

export type UserRoleKey = 'admin' | 'counter' | 'dsr' | 'retailer';

export function normalizeRoleKey(role?: string): UserRoleKey {
  const r = (role || '').toLowerCase();
  if (r === 'admin' || r.includes('admin') || r.includes('এডমিন')) return 'admin';
  if (r === 'dsr' || r.includes('dsr') || r.includes('ডিএসআর')) return 'dsr';
  if (r === 'retailer' || r.includes('retailer') || r.includes('খুচরা')) return 'retailer';
  return 'counter';
}

export function formatActiveTime(isoDate?: string): string {
  if (!isoDate) return 'Active: --:--';
  try {
    const d = new Date(isoDate);
    let hours = d.getHours();
    const minutes = d.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
    const hrStr = hours < 10 ? `0${hours}` : `${hours}`;
    return `Active: ${hrStr}:${minStr} ${ampm}`;
  } catch {
    return 'Active: --:--';
  }
}

export function formatActiveTimeBn(isoDate?: string): string {
  if (!isoDate) return 'সক্রিয়: --:--';
  try {
    const d = new Date(isoDate);
    let hours = d.getHours();
    const minutes = d.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
    const hrStr = hours < 10 ? `0${hours}` : `${hours}`;
    return `সক্রিয়: ${hrStr}:${minStr} ${ampm}`;
  } catch {
    return 'সক্রিয়: --:--';
  }
}

export interface RealtimeDataChangeEvent {
  collection: string;
  data: any;
  sourceDeviceId: string;
  action?: string;
  updatedBy?: string;
  timestamp: string;
}

export type RealtimeDataChangeListener = (event: RealtimeDataChangeEvent) => void;

type PresenceListener = (devices: LiveDevicePresence[]) => void;

let activeChannel: any = null;
let currentDeviceId: string = '';
const listeners = new Set<PresenceListener>();
const dataChangeListeners = new Set<RealtimeDataChangeListener>();

/**
 * Generate or get a persistent device identifier
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'device_unknown';
  try {
    let id = localStorage.getItem('ws_device_fingerprint');
    if (!id) {
      const platformPrefix = window.innerWidth < 768 ? 'mob' : 'pc';
      id = `${platformPrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      localStorage.setItem('ws_device_fingerprint', id);
    }
    return id;
  } catch {
    return 'device_fallback';
  }
}

/**
 * Detect client platform
 */
function detectPlatform(): 'mobile' | 'laptop' | 'desktop' | 'tablet' {
  if (typeof window === 'undefined') return 'desktop';
  const width = window.innerWidth;
  if (width < 640) return 'mobile';
  if (width < 1024) return 'tablet';
  if (width < 1440) return 'laptop';
  return 'desktop';
}

/**
 * Start Supabase Realtime Presence tracking for the current device and user
 */
export function initSupabasePresence(currentUser: UserProfile): void {
  const supabase = getSupabase();
  if (!supabase || !isSupabaseConfigured()) {
    console.debug('[SupabasePresence] Supabase not configured, skipping realtime presence.');
    return;
  }

  const deviceId = getOrCreateDeviceId();
  currentDeviceId = deviceId;
  const roleKey = normalizeRoleKey(currentUser.role);
  const rolePresenceKey = `role_${roleKey}`;

  // Clean up existing channel if already connected
  if (activeChannel) {
    try {
      supabase.removeChannel(activeChannel);
    } catch (e) {}
    activeChannel = null;
  }

  const roleLabels: Record<UserRoleKey, string> = {
    admin: 'এডমিন (মাতৃছায়া)',
    counter: 'ক্যাশ কাউন্টার (ল্যাপটপ POS)',
    dsr: 'রাজু আলম (ফিল্ড ডিএসআর)',
    retailer: 'খুচরা বিক্রেতা (কাস্টমার)',
  };

  const nowIso = new Date().toISOString();
  const userPayload: LiveDevicePresence = {
    deviceId: rolePresenceKey,
    userId: currentUser.id || `usr_${roleKey}`,
    name: currentUser.name || roleLabels[roleKey],
    role: roleKey,
    phone: currentUser.phone || '01937200635',
    email: currentUser.email || '',
    platform: detectPlatform(),
    isOnline: true,
    joinedAt: nowIso,
    lastSeen: nowIso,
    lastActiveTimeFormatted: formatActiveTime(nowIso),
  };

  const channelName = `matrichhaya_presence_${(currentUser.adminRef || currentUser.adminPhone || '01937200635').replace(/[^0-9]/g, '')}`;

  // Key presence by Role Identity so each Role has exactly 1 unified slot
  activeChannel = supabase.channel(channelName, {
    config: {
      presence: {
        key: rolePresenceKey,
      },
    },
  });

  const notifyListeners = () => {
    if (!activeChannel) return;
    const presenceState = activeChannel.presenceState();
    
    // Group strictly by User Role Identity (Admin, DSR, Cash Counter, Retailer)
    const roleMap = new Map<UserRoleKey, LiveDevicePresence>();

    Object.keys(presenceState).forEach((key) => {
      const presences = presenceState[key];
      if (Array.isArray(presences) && presences.length > 0) {
        const item = presences[presences.length - 1] as LiveDevicePresence;
        const normalizedRole = normalizeRoleKey(item.role || key.replace('role_', ''));
        const timeFormatted = formatActiveTime(item.lastSeen || new Date().toISOString());
        roleMap.set(normalizedRole, {
          ...item,
          role: normalizedRole,
          deviceId: `role_${normalizedRole}`,
          isOnline: true,
          lastActiveTimeFormatted: timeFormatted,
        });
      }
    });

    const liveList = Array.from(roleMap.values());
    listeners.forEach((fn) => fn(liveList));
  };

  activeChannel
    .on('presence', { event: 'sync' }, () => {
      notifyListeners();
    })
    .on('presence', { event: 'join' }, () => {
      notifyListeners();
    })
    .on('presence', { event: 'leave' }, () => {
      notifyListeners();
    })
    // 1. Cross-device Realtime Broadcast for Instant Multi-Device State Synchronization
    .on('broadcast', { event: 'erp_realtime_change' }, ({ payload }: any) => {
      if (payload && payload.sourceDeviceId !== deviceId) {
        console.log('[SupabaseRealtime] Multi-device live broadcast received for:', payload.collection);
        dataChangeListeners.forEach((fn) => {
          try {
            fn(payload);
          } catch (e) {
            console.error('[SupabaseRealtime] Listener error:', e);
          }
        });
      }
    })
    // 2. PostgreSQL CDC table change listener for persistent sync
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'matrichhaya_erp_sync' },
      (payload: any) => {
        const row = payload.new;
        if (row && row.collection_name && row.device_id !== deviceId) {
          console.log('[SupabaseRealtime] PostgreSQL table change detected for:', row.collection_name);
          dataChangeListeners.forEach((fn) => {
            try {
              fn({
                collection: row.collection_name,
                data: row.data,
                sourceDeviceId: row.device_id || 'remote',
                action: payload.eventType,
                updatedBy: row.updated_by || 'Staff',
                timestamp: row.updated_at || new Date().toISOString(),
              });
            } catch (e) {
              console.error('[SupabaseRealtime] Listener error:', e);
            }
          });
        }
      }
    )
    .subscribe(async (status: string) => {
      if (status === 'SUBSCRIBED') {
        await activeChannel.track(userPayload);
        notifyListeners();

        // Overwrite single role record in erp_device_presence table (zero history bloat)
        try {
          await supabase.from('erp_device_presence').upsert({
            device_id: rolePresenceKey,
            user_id: userPayload.userId,
            name: userPayload.name,
            role: userPayload.role,
            phone: userPayload.phone,
            email: userPayload.email,
            platform: userPayload.platform,
            is_online: true,
            last_active: new Date().toISOString(),
          }, { onConflict: 'device_id' });
        } catch (e) {}
      }
    });

  // Handle browser close / unload to immediately broadcast offline
  const handleUnload = () => {
    if (activeChannel) {
      try {
        activeChannel.untrack();
        supabase.removeChannel(activeChannel);
      } catch (e) {}
    }
  };

  window.addEventListener('beforeunload', handleUnload);
  window.addEventListener('pagehide', handleUnload);
}

/**
 * Subscribe to realtime device presence updates
 */
export function subscribeToDevicePresence(listener: PresenceListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Fetch all registered devices with their live or historical status
 */
export async function fetchAllDeviceStatus(adminPhone: string = '01937200635'): Promise<LiveDevicePresence[]> {
  const supabase = getSupabase();
  if (!supabase || !isSupabaseConfigured()) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('erp_device_presence')
      .select('*')
      .order('last_active', { ascending: false });

    if (error || !data) return [];

    // Deduplicate solely by role identity
    const roleMap = new Map<UserRoleKey, LiveDevicePresence>();
    data.forEach((d: any) => {
      const r = normalizeRoleKey(d.role || d.device_id?.replace('role_', ''));
      if (!roleMap.has(r)) {
        roleMap.set(r, {
          deviceId: `role_${r}`,
          userId: d.user_id,
          name: d.name,
          role: r,
          phone: d.phone,
          email: d.email,
          platform: d.platform || 'mobile',
          isOnline: Boolean(d.is_online),
          joinedAt: d.created_at || d.last_active,
          lastSeen: d.last_active,
          lastActiveTimeFormatted: formatActiveTime(d.last_active),
        });
      }
    });

    return Array.from(roleMap.values());
  } catch {
    return [];
  }
}

/**
 * Subscribe to realtime data changes broadcasted across devices
 */
export function subscribeToRealtimeDataChanges(listener: RealtimeDataChangeListener): () => void {
  dataChangeListeners.add(listener);
  return () => {
    dataChangeListeners.delete(listener);
  };
}

/**
 * Broadcast an instant state change to all other connected devices via Supabase Realtime
 */
export function broadcastRealtimeDataChange(
  collection: string,
  data: any,
  action: string = 'UPDATE',
  updatedBy: string = 'Staff'
): void {
  const deviceId = getOrCreateDeviceId();
  const payload: RealtimeDataChangeEvent = {
    collection,
    data,
    sourceDeviceId: deviceId,
    action,
    updatedBy,
    timestamp: new Date().toISOString(),
  };

  if (activeChannel) {
    try {
      activeChannel.send({
        type: 'broadcast',
        event: 'erp_realtime_change',
        payload,
      });
      console.log(`[SupabaseRealtime] Broadcasted ${collection} (${action}) to all connected devices.`);
    } catch (e) {
      console.debug('[SupabaseRealtime] Broadcast send note:', e);
    }
  }
}
