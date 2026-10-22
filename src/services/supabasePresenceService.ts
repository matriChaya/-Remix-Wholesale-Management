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

type PresenceListener = (devices: LiveDevicePresence[]) => void;

let activeChannel: any = null;
let currentDeviceId: string = '';
const listeners = new Set<PresenceListener>();

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
