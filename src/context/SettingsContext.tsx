import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { getSiteSettings, getDeliveryZones, saveSiteSettings, saveDeliveryZone } from '../firebase/db';
import { db, OFFICIAL_STORE_INFO } from '../firebase/config';
import type { SiteSettings, DeliveryZone } from '../types';

interface SettingsContextType {
  settings: SiteSettings;
  deliveryZones: DeliveryZone[];
  loading: boolean;
  refreshSettings: () => Promise<void>;
  updateSettings: (newSettings: Partial<SiteSettings>) => Promise<void>;
  initializeDefaults: () => Promise<void>;
}

const SETTINGS_CACHE_KEY = 'aesthetx_site_settings_v1';

const defaultSettings: SiteSettings = {
  storeName: OFFICIAL_STORE_INFO.name,
  tagline: OFFICIAL_STORE_INFO.tagline,
  phone: OFFICIAL_STORE_INFO.phone,
  email: OFFICIAL_STORE_INFO.email,
  whatsapp: OFFICIAL_STORE_INFO.whatsapp,
  address: "House 12, Road 4, Banani, Dhaka, Bangladesh",
  facebook: OFFICIAL_STORE_INFO.facebook,
  instagram: "",
  tiktok: "",
  youtube: "",
  currency: OFFICIAL_STORE_INFO.currency,
  deliveryArea: OFFICIAL_STORE_INFO.deliveryArea,
  timezone: OFFICIAL_STORE_INFO.timezone,
  announcementBar: {
    enabled: true,
    text: "✨ Welcome to AESTHETX LIFESTYLE | Buying clothes is cheaper than therapy | Nationwide Cash on Delivery"
  },
  freeDeliveryThreshold: 2500,
  defaultDeliveryInsideDhaka: 80,
  defaultDeliveryOutsideDhaka: 150,
  deliveryEstimatedDhaka: '1-2 Business Days',
  deliveryEstimatedOutside: '2-4 Business Days',
  bkashEnabled: true,
  bkashNumber: '01708943242',
  bkashType: 'personal',
  bkashInstructions: 'Open the bKash App or dial *247# to Send Money or Make Payment of the exact order total to the number above. Once sent, enter your bKash mobile number and Transaction ID (TrxID) below for automatic verification.',
  nagadEnabled: true,
  nagadNumber: '01708943242',
  nagadType: 'personal',
  nagadInstructions: 'Open the Nagad App or dial *167# to Send Money of the exact order total to the number above. Once sent, enter your Nagad mobile number and Transaction ID (TrxID) below for automatic verification.',
  orderPrefix: "AL",
  maintenanceMode: false,
  logoUrl: OFFICIAL_STORE_INFO.logoUrl
};

const defaultZones: DeliveryZone[] = [
  {
    id: "inside-dhaka",
    name: "Inside Dhaka City",
    charge: 80,
    estimatedDays: "1-2 Business Days",
    active: true,
    sortOrder: 1
  },
  {
    id: "outside-dhaka",
    name: "Outside Dhaka (Nationwide)",
    charge: 150,
    estimatedDays: "2-4 Business Days",
    active: true,
    sortOrder: 2
  }
];

function readCachedSettings(): SiteSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_CACHE_KEY);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return { ...defaultSettings, ...parsed };
    }
  } catch {
    // ignore cache parse errors
  }
  return defaultSettings;
}

function writeCachedSettings(data: SiteSettings): void {
  try {
    localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(data));
  } catch {
    // ignore storage quota errors
  }
}

interface ServerGatewayStatus {
  bkashEnabled: boolean;
  nagadEnabled: boolean;
  updatedAt: number;
}

async function fetchServerGatewayStatus(): Promise<ServerGatewayStatus | null> {
  try {
    const res = await fetch('/api/payments/gateway-status', { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.success) {
      return {
        bkashEnabled: data.bkashEnabled !== false,
        nagadEnabled: data.nagadEnabled !== false,
        updatedAt: Number(data.updatedAt || 0)
      };
    }
  } catch {
    // offline or backend starting up
  }
  return null;
}

async function syncServerGatewayStatus(
  bkashEnabled: boolean,
  nagadEnabled: boolean
): Promise<ServerGatewayStatus | null> {
  try {
    const res = await fetch('/api/payments/gateway-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bkashEnabled, nagadEnabled })
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.success) {
      return {
        bkashEnabled: data.bkashEnabled !== false,
        nagadEnabled: data.nagadEnabled !== false,
        updatedAt: Number(data.updatedAt || Date.now())
      };
    }
  } catch {
    // ignore network error
  }
  return null;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SiteSettings>(() => readCachedSettings());
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>(defaultZones);
  const [loading, setLoading] = useState(true);

  const settingsRef = useRef<SiteSettings>(settings);
  settingsRef.current = settings;
  const serverGwRef = useRef<ServerGatewayStatus | null>(null);

  const resolveAuthoritativeGateways = (
    firestoreData: Partial<SiteSettings> | null,
    serverGw: ServerGatewayStatus | null,
    localCached: SiteSettings
  ): { bkashEnabled: boolean; nagadEnabled: boolean } => {
    const fsTime = Number(firestoreData?.settingsUpdatedAt || 0);
    const srvTime = Number(serverGw?.updatedAt || 0);
    const locTime = Number(localCached?.settingsUpdatedAt || 0);

    // Highest explicit timestamp wins across server, Firestore, and local cache
    if (srvTime > 0 && srvTime >= fsTime && srvTime >= locTime && serverGw) {
      return {
        bkashEnabled: serverGw.bkashEnabled,
        nagadEnabled: serverGw.nagadEnabled
      };
    }

    if (fsTime > 0 && fsTime >= srvTime && fsTime >= locTime && firestoreData) {
      return {
        bkashEnabled: firestoreData.bkashEnabled !== false,
        nagadEnabled: firestoreData.nagadEnabled !== false
      };
    }

    if (locTime > 0 && locTime >= fsTime && locTime >= srvTime) {
      return {
        bkashEnabled: localCached.bkashEnabled !== false,
        nagadEnabled: localCached.nagadEnabled !== false
      };
    }

    // No explicit timestamps yet: prefer server if explicitly set, else Firestore, else defaults
    if (serverGw && srvTime > 0) {
      return {
        bkashEnabled: serverGw.bkashEnabled,
        nagadEnabled: serverGw.nagadEnabled
      };
    }
    if (firestoreData) {
      return {
        bkashEnabled: firestoreData.bkashEnabled !== false,
        nagadEnabled: firestoreData.nagadEnabled !== false
      };
    }
    return {
      bkashEnabled: localCached.bkashEnabled !== false,
      nagadEnabled: localCached.nagadEnabled !== false
    };
  };

  const loadData = async () => {
    try {
      const [fetchedSettings, fetchedZones, serverGw] = await Promise.all([
        getSiteSettings(),
        getDeliveryZones(),
        fetchServerGatewayStatus()
      ]);

      if (serverGw) {
        serverGwRef.current = serverGw;
      }

      const localCached = readCachedSettings();
      const gwFlags = resolveAuthoritativeGateways(fetchedSettings, serverGw, localCached);

      const merged: SiteSettings = {
        ...defaultSettings,
        ...localCached,
        ...(fetchedSettings || {}),
        bkashEnabled: gwFlags.bkashEnabled,
        nagadEnabled: gwFlags.nagadEnabled
      };

      setSettings(merged);
      writeCachedSettings(merged);

      // If Firestore/local had newer explicit gateway flags than uninitialized server, sync server
      const maxClientTime = Math.max(
        Number(fetchedSettings?.settingsUpdatedAt || 0),
        Number(localCached?.settingsUpdatedAt || 0)
      );
      if ((!serverGw || serverGw.updatedAt === 0) && maxClientTime > 0) {
        syncServerGatewayStatus(gwFlags.bkashEnabled, gwFlags.nagadEnabled).then((synced) => {
          if (synced) serverGwRef.current = synced;
        });
      }

      if (fetchedZones && fetchedZones.length > 0) {
        setDeliveryZones(fetchedZones);
      }
    } catch (err) {
      console.warn('Could not load site settings from Firestore, using cached/defaults:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Real-time Firestore listener so changes by admin propagate immediately
    const unsubscribe = onSnapshot(
      doc(db, 'settings', 'general'),
      (snap) => {
        if (!snap.exists()) return;
        const fsData = snap.data() as Partial<SiteSettings>;
        const localCached = readCachedSettings();
        const gwFlags = resolveAuthoritativeGateways(fsData, serverGwRef.current, localCached);

        const nextMerged: SiteSettings = {
          ...defaultSettings,
          ...settingsRef.current,
          ...fsData,
          bkashEnabled: gwFlags.bkashEnabled,
          nagadEnabled: gwFlags.nagadEnabled
        };
        setSettings(nextMerged);
        writeCachedSettings(nextMerged);
      },
      () => {
        // Ignore snapshot errors if offline or restricted
      }
    );

    // Cross-tab & same-tab settings synchronization
    const handleStorage = (e: StorageEvent) => {
      if (e.key === SETTINGS_CACHE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setSettings((prev) => ({ ...prev, ...parsed }));
        } catch {
          // ignore
        }
      }
    };

    const handleCustomUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<Partial<SiteSettings>>;
      if (customEvent.detail) {
        setSettings((prev) => ({ ...prev, ...customEvent.detail }));
      }
    };

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        fetchServerGatewayStatus().then((srv) => {
          if (!srv) return;
          serverGwRef.current = srv;
          const localCached = readCachedSettings();
          const fsTime = Number(settingsRef.current.settingsUpdatedAt || 0);
          const locTime = Number(localCached.settingsUpdatedAt || 0);
          if (srv.updatedAt > 0 && srv.updatedAt >= Math.max(fsTime, locTime)) {
            setSettings((prev) => {
              if (
                prev.bkashEnabled === srv.bkashEnabled &&
                prev.nagadEnabled === srv.nagadEnabled
              ) {
                return prev;
              }
              const updated = {
                ...prev,
                bkashEnabled: srv.bkashEnabled,
                nagadEnabled: srv.nagadEnabled,
                settingsUpdatedAt: srv.updatedAt
              };
              writeCachedSettings(updated);
              return updated;
            });
          }
        });
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('aesthetx-settings-updated', handleCustomUpdate);
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      unsubscribe();
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('aesthetx-settings-updated', handleCustomUpdate);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, []);

  const refreshSettings = async () => {
    await loadData();
  };

  const updateSettings = async (newSettings: Partial<SiteSettings>) => {
    const now = Date.now();
    const merged: SiteSettings = {
      ...settingsRef.current,
      ...newSettings,
      settingsUpdatedAt: now
    };

    // 1. Immediately update React state, localStorage cache, and same-window listeners
    setSettings(merged);
    writeCachedSettings(merged);
    window.dispatchEvent(new CustomEvent('aesthetx-settings-updated', { detail: merged }));

    // 2. Persist gateway availability to backend Express server immediately
    const bkashActive = merged.bkashEnabled !== false;
    const nagadActive = merged.nagadEnabled !== false;
    const srvResult = await syncServerGatewayStatus(bkashActive, nagadActive);
    if (srvResult) {
      serverGwRef.current = srvResult;
    } else {
      serverGwRef.current = {
        bkashEnabled: bkashActive,
        nagadEnabled: nagadActive,
        updatedAt: now
      };
    }

    // 3. Persist to Firestore (do not revert local/server state if admin uses fallback session)
    try {
      await saveSiteSettings({ ...newSettings, settingsUpdatedAt: now });
    } catch (fsErr) {
      console.warn('Firestore saveSiteSettings notice (local & server gateway state preserved):', fsErr);
    }

    // 4. Automatically synchronize delivery zones with default delivery charges if updated
    try {
      if (newSettings.defaultDeliveryInsideDhaka !== undefined) {
        await saveDeliveryZone(
          {
            name: 'Inside Dhaka City',
            charge: Number(newSettings.defaultDeliveryInsideDhaka),
            estimatedDays: newSettings.deliveryEstimatedDhaka || '1-2 Business Days',
            active: true,
            sortOrder: 1
          },
          'inside-dhaka'
        );
      }
      if (newSettings.defaultDeliveryOutsideDhaka !== undefined) {
        await saveDeliveryZone(
          {
            name: 'Outside Dhaka (Nationwide)',
            charge: Number(newSettings.defaultDeliveryOutsideDhaka),
            estimatedDays: newSettings.deliveryEstimatedOutside || '2-4 Business Days',
            active: true,
            sortOrder: 2
          },
          'outside-dhaka'
        );
      }
      const updatedZones = await getDeliveryZones();
      if (updatedZones && updatedZones.length > 0) {
        setDeliveryZones(updatedZones);
      }
    } catch (e) {
      console.warn('Sync delivery zones warning:', e);
    }
  };

  const initializeDefaults = async () => {
    const seeded = { ...defaultSettings, settingsUpdatedAt: Date.now() };
    setSettings(seeded);
    writeCachedSettings(seeded);
    await syncServerGatewayStatus(true, true);
    try {
      await saveSiteSettings(seeded);
      for (const zone of defaultZones) {
        await saveDeliveryZone(zone, zone.id);
      }
    } catch (err) {
      console.warn('Firestore initializeDefaults notice:', err);
    }
    await loadData();
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        deliveryZones,
        loading,
        refreshSettings,
        updateSettings,
        initializeDefaults
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
