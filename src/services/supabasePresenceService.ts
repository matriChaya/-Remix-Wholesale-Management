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

  // Clean up existing channel if already connected
  if (activeChannel) {
    try {
      supabase.removeChannel(activeChannel);
    } catch (e) {}
    activeChannel = null;
  }

  const userPayload: LiveDevicePresence = {
    deviceId,
    userId: currentUser.id || 'usr_anonymous',
    name: currentUser.name || 'কর্মী',
    role: currentUser.role || 'counter',
    phone: currentUser.phone || '01937200635',
    email: currentUser.email || '',
    platform: detectPlatform(),
    isOnline: true,
    joinedAt: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
  };

  const channelName = `matrichhaya_presence_${(currentUser.adminRef || currentUser.adminPhone || '01937200635').replace(/[^0-9]/g, '')}`;

  activeChannel = supabase.channel(channelName, {
    config: {
      presence: {
        key: deviceId,
      },
    },
  });

  const notifyListeners = () => {
    if (!activeChannel) return;
    const presenceState = activeChannel.presenceState();
    const liveList: LiveDevicePresence[] = [];

    Object.keys(presenceState).forEach((key) => {
      const presences = presenceState[key];
      if (Array.isArray(presences) && presences.length > 0) {
        const item = presences[presences.length - 1] as LiveDevicePresence;
        liveList.push({
          ...item,
          deviceId: key,
          isOnline: true,
        });
      }
    });

    listeners.forEach((fn) => fn(liveList));
  };

  activeChannel
    .on('presence', { event: 'sync' }, () => {
      notifyListeners();
    })
    .on('presence', { event: 'join' }, ({ newPresences }: any) => {
      notifyListeners();
    })
    .on('presence', { event: 'leave' }, ({ leftPresences }: any) => {
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

        // Also asynchronously persist to erp_device_presence table
        try {
          await supabase.from('erp_device_presence').upsert({
            device_id: deviceId,
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

    return data.map((d: any) => ({
      deviceId: d.device_id,
      userId: d.user_id,
      name: d.name,
      role: d.role,
      phone: d.phone,
      email: d.email,
      platform: d.platform || 'mobile',
      isOnline: Boolean(d.is_online),
      joinedAt: d.created_at || d.last_active,
      lastSeen: d.last_active,
    }));
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
