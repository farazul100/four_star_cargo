/**
 * M/S FOUR STAR CARGO — HOSTINGER VPS DATA CLIENT & SQL SERVICE
 * Provides direct database persistence & Role-Based Access Control (RBAC)
 */

import { User, Warehouse, Carton, FlyingProposal, Customer, LedgerEntry, AuditLog, ExpenseItem } from '../types';
import {
  INITIAL_USERS,
  INITIAL_WAREHOUSES,
  INITIAL_CARTONS,
  INITIAL_PROPOSALS,
  INITIAL_CUSTOMERS,
  INITIAL_LEDGER,
  INITIAL_AUDIT_LOGS,
  INITIAL_EXPENSES,
} from '../mockData';

const DB_KEYS = {
  USERS: 'fsc_vps_users',
  WAREHOUSES: 'fsc_vps_warehouses',
  CARTONS: 'fsc_vps_cartons',
  PROPOSALS: 'fsc_vps_proposals',
  CUSTOMERS: 'fsc_vps_customers',
  LEDGER: 'fsc_vps_ledger',
  AUDIT: 'fsc_vps_audit',
  EXPENSES: 'fsc_vps_expenses',
};

// Reset DB helper for live testing - Clears all demo cartons & proposals completely
export const resetHostingerDbToDefault = () => {
  localStorage.setItem(DB_KEYS.USERS, JSON.stringify(INITIAL_USERS));
  localStorage.setItem(DB_KEYS.WAREHOUSES, JSON.stringify(INITIAL_WAREHOUSES));
  localStorage.setItem(DB_KEYS.CARTONS, JSON.stringify([]));
  localStorage.setItem(DB_KEYS.PROPOSALS, JSON.stringify([]));
  localStorage.setItem(DB_KEYS.CUSTOMERS, JSON.stringify([]));
  localStorage.setItem(DB_KEYS.LEDGER, JSON.stringify([]));
  localStorage.setItem(DB_KEYS.AUDIT, JSON.stringify([]));
  localStorage.setItem(DB_KEYS.EXPENSES, JSON.stringify([]));

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('fsc_db_updated', { detail: { key: 'reset' } }));
  }
};

// Initialize Hostinger local persistence safely without wiping real data on refresh
export const initHostingerDb = () => {
  if (!localStorage.getItem(DB_KEYS.CARTONS)) {
    localStorage.setItem(DB_KEYS.CARTONS, JSON.stringify([]));
  }

  if (!localStorage.getItem(DB_KEYS.PROPOSALS)) {
    localStorage.setItem(DB_KEYS.PROPOSALS, JSON.stringify([]));
  }

  if (!localStorage.getItem(DB_KEYS.CUSTOMERS)) {
    localStorage.setItem(DB_KEYS.CUSTOMERS, JSON.stringify([]));
  }

  const currentUsersRaw = localStorage.getItem(DB_KEYS.USERS);
  let usersList: User[] = [];
  try {
    usersList = currentUsersRaw ? JSON.parse(currentUsersRaw) : [];
  } catch (e) {
    usersList = [];
  }

  // Clean old demo admin if present, but strictly PRESERVE all newly created staff users
  usersList = usersList.filter((u) => u && u.email && u.email.toLowerCase() !== 'admin@fourstarcargo.com');
  const hasMasterAdmin = usersList.some((u) => u && u.email && u.email.toLowerCase() === 'superadmin@cargo.com');
  if (!hasMasterAdmin) {
    usersList.unshift(INITIAL_USERS[0]);
  }
  localStorage.setItem(DB_KEYS.USERS, JSON.stringify(usersList));
  if (!localStorage.getItem(DB_KEYS.WAREHOUSES)) {
    localStorage.setItem(DB_KEYS.WAREHOUSES, JSON.stringify(INITIAL_WAREHOUSES));
  }
  if (!localStorage.getItem(DB_KEYS.LEDGER)) {
    localStorage.setItem(DB_KEYS.LEDGER, JSON.stringify([]));
  }
  if (!localStorage.getItem(DB_KEYS.AUDIT)) {
    localStorage.setItem(DB_KEYS.AUDIT, JSON.stringify([]));
  }
  if (!localStorage.getItem(DB_KEYS.EXPENSES)) {
    localStorage.setItem(DB_KEYS.EXPENSES, JSON.stringify([]));
  }

  // Sync from server disk file (/api/db) for multi-browser support
  fetchServerDbAndSync();

  // Start automatic 3-second background polling for 100% real-time multi-browser sync
  if (typeof window !== 'undefined' && !(window as any).__FSC_SYNC_INTERVAL__) {
    (window as any).__FSC_SYNC_INTERVAL__ = setInterval(() => {
      fetchServerDbAndSync();
    }, 3000);
  }
};

declare global {
  interface Window {
    __FSC_GLOBAL_CARTONS__?: Carton[];
    __FSC_GLOBAL_PROPOSALS__?: FlyingProposal[];
  }
}

export const getHostingerDbData = () => {
  initHostingerDb();

  let cartons: Carton[] = [];
  try {
    const rawCartons = localStorage.getItem(DB_KEYS.CARTONS);
    cartons = rawCartons ? JSON.parse(rawCartons) : [];
  } catch (e) {
    console.error('Error reading cartons from LocalStorage:', e);
  }

  // Use window memory cache backup if localstorage is empty but memory has live items
  if ((!cartons || cartons.length === 0) && typeof window !== 'undefined' && window.__FSC_GLOBAL_CARTONS__ && window.__FSC_GLOBAL_CARTONS__.length > 0) {
    cartons = window.__FSC_GLOBAL_CARTONS__;
  }

  // Deduplicate cartons by unique ID
  if (Array.isArray(cartons) && cartons.length > 0) {
    const cartonMap = new Map<string, Carton>();
    cartons.forEach((c) => {
      if (c) {
        const compositeKey = c.tracking_number && c.ctn_no ? `${c.tracking_number.trim()}_${c.ctn_no.trim()}` : (c.id || c.ctn_no);
        if (compositeKey) {
          const existing = cartonMap.get(compositeKey);
          if (!existing || c.status === 'received' || c.status === 'delivered' || c.current_warehouse_id === 'wh-bd') {
            cartonMap.set(compositeKey, c);
          }
        }
      }
    });
    cartons = Array.from(cartonMap.values());

    // Immediately persist cleaned deduplicated cartons to LocalStorage
    try {
      localStorage.setItem(DB_KEYS.CARTONS, JSON.stringify(cartons));
    } catch {}
  }

  let proposals: FlyingProposal[] = [];
  try {
    const rawProposals = localStorage.getItem(DB_KEYS.PROPOSALS);
    proposals = rawProposals ? JSON.parse(rawProposals) : [];
  } catch (e) {
    console.error('Error reading proposals from LocalStorage:', e);
  }

  // Strictly purge any old legacy demo proposals (e.g. BS-01, prop-bs01) so map starts 100% clean
  if (Array.isArray(proposals) && proposals.length > 0) {
    const cleanProposals = proposals.filter(
      (p) =>
        p &&
        p.id !== 'prop-bs01' &&
        p.id !== 'prop-bs02' &&
        (p.flying_name || '').toUpperCase() !== 'BS-01' &&
        (p.flight_number || '').toUpperCase() !== 'BS-01'
    );

    if (cleanProposals.length !== proposals.length) {
      proposals = cleanProposals;
      try {
        localStorage.setItem(DB_KEYS.PROPOSALS, JSON.stringify(cleanProposals));
      } catch {}
    }
  }

  let rawUsers: User[] = [];
  try {
    const raw = localStorage.getItem(DB_KEYS.USERS);
    rawUsers = raw ? JSON.parse(raw) : [];
  } catch (e) {
    rawUsers = [];
  }

  let warehouses: Warehouse[] = [];
  try {
    const rawWh = localStorage.getItem(DB_KEYS.WAREHOUSES);
    warehouses = rawWh ? JSON.parse(rawWh) : INITIAL_WAREHOUSES;
  } catch (e) {
    warehouses = INITIAL_WAREHOUSES;
  }

  // Deduplicate and merge users from localStorage AND all warehouse incharge_staff rosters
  const userMap = new Map<string, User>();

  // 1. Add Master Super Admin
  userMap.set('superadmin@cargo.com', {
    id: 'usr-admin-master',
    name: 'সুপার এডমিন (Super Admin)',
    email: 'superadmin@cargo.com',
    password: 'Cargo@2026',
    role: 'super_admin',
    status: 'active',
    created_at: '2026-01-01T00:00:00Z',
  });

  // 2. Add users from localStorage
  if (Array.isArray(rawUsers)) {
    rawUsers.forEach((u) => {
      if (u && u.email && u.email.toLowerCase() !== 'admin@fourstarcargo.com') {
        userMap.set(u.email.toLowerCase(), {
          ...u,
          password: u.password || 'Cargo@2026',
        });
      }
    });
  }

  // 3. Automatically extract and merge incharge staff from all warehouses so they are ALWAYS valid login accounts
  if (Array.isArray(warehouses)) {
    warehouses.forEach((wh) => {
      if (wh && Array.isArray(wh.incharge_staff)) {
        wh.incharge_staff.forEach((stf) => {
          if (stf && stf.email) {
            const emailKey = stf.email.toLowerCase();
            const existing = userMap.get(emailKey);
            userMap.set(emailKey, {
              id: stf.id || `usr-${Date.now()}`,
              name: stf.name,
              email: stf.email,
              password: existing?.password || 'Cargo@2026',
              role: 'warehouse_incharge',
              warehouse_id: wh.id,
              warehouse_name: wh.name,
              status: stf.status || 'active',
              created_at: stf.created_at || new Date().toISOString(),
            });
          }
        });
      }
    });
  }

  const mergedUsers = Array.from(userMap.values());
  try {
    localStorage.setItem(DB_KEYS.USERS, JSON.stringify(mergedUsers));
  } catch {}

  let notifications: any[] = [];
  try {
    const rawNotif = localStorage.getItem('fsc_vps_notifications');
    notifications = rawNotif ? JSON.parse(rawNotif) : [];
  } catch (e) {
    notifications = [];
  }

  if (!notifications || notifications.length === 0) {
    notifications = [
      {
        id: 'notif-base-1',
        title: 'সিস্টেম অ্যাক্টিভেশন সম্পন্ন',
        message: 'M/S Four Star Cargo রিয়েল-টাইম অপারেশনস সিঙ্ক চালু হয়েছে।',
        type: 'info',
        target_role: 'all',
        isRead: false,
        created_at: new Date(Date.now() - 5 * 60000).toISOString(),
      },
      {
        id: 'notif-base-2',
        title: 'ওয়্যারহাউজ বাউন্ডারি সিকিউরিটি',
        message: 'ওয়্যারহাউজ ইনচার্জদের জন্য সুনির্দিষ্ট স্টক ভিউ ও বাউন্ডারি কন্ট্রোল সক্রিয়।',
        type: 'success',
        target_role: 'warehouse_incharge',
        isRead: false,
        created_at: new Date(Date.now() - 15 * 60000).toISOString(),
      },
      {
        id: 'notif-base-3',
        title: 'ফ্লাইট প্রপোজাল সিস্টেম',
        message: 'অপারেশন ডিরেক্টর ও সুপার এডমিন প্যানেল সরাসরি প্রপোজাল রিভিউ করতে পারবেন।',
        type: 'warning',
        target_role: 'operation_director',
        isRead: false,
        created_at: new Date(Date.now() - 30 * 60000).toISOString(),
      },
    ];
    try {
      localStorage.setItem('fsc_vps_notifications', JSON.stringify(notifications));
    } catch {}
  }

  return {
    users: mergedUsers,
    warehouses: warehouses,
    cartons: cartons as Carton[],
    proposals: proposals as FlyingProposal[],
    customers: JSON.parse(localStorage.getItem(DB_KEYS.CUSTOMERS) || '[]') as Customer[],
    ledgerEntries: JSON.parse(localStorage.getItem(DB_KEYS.LEDGER) || '[]') as LedgerEntry[],
    auditLogs: JSON.parse(localStorage.getItem(DB_KEYS.AUDIT) || '[]') as AuditLog[],
    expenses: JSON.parse(localStorage.getItem(DB_KEYS.EXPENSES) || '[]') as ExpenseItem[],
    notifications: notifications,
  };
};

export const publishSystemNotification = (notif: {
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'alert' | 'error';
  target_role?: string;
  target_warehouse_id?: string;
  target_user_id?: string;
  link?: string;
}) => {
  const data = getHostingerDbData();
  const newNotif = {
    id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    title: notif.title,
    message: notif.message,
    type: notif.type || 'info',
    target_role: notif.target_role || 'all',
    target_warehouse_id: notif.target_warehouse_id,
    target_user_id: notif.target_user_id,
    isRead: false,
    created_at: new Date().toISOString(),
    link: notif.link,
  };
  const updatedNotifs = [newNotif, ...(data.notifications || [])];
  saveHostingerDbData('fsc_vps_notifications', updatedNotifs);
  return newNotif;
};

// Global BroadcastChannel for 100% reliable cross-tab live synchronization locally
const dbBroadcastChannel =
  typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel('fsc_global_db_sync')
    : null;

// Helper to sync state to server disk DB (/api/db) for 100% reliable cross-browser (Chrome <-> Edge) persistence
let pushTimeout: any = null;

const pushFullDbToServer = () => {
  if (typeof window === 'undefined') return;
  if (pushTimeout) clearTimeout(pushTimeout);
  pushTimeout = setTimeout(async () => {
    try {
      const fullDb = {
        [DB_KEYS.CARTONS]: JSON.parse(localStorage.getItem(DB_KEYS.CARTONS) || '[]'),
        [DB_KEYS.PROPOSALS]: JSON.parse(localStorage.getItem(DB_KEYS.PROPOSALS) || '[]'),
        [DB_KEYS.USERS]: JSON.parse(localStorage.getItem(DB_KEYS.USERS) || '[]'),
        [DB_KEYS.WAREHOUSES]: JSON.parse(localStorage.getItem(DB_KEYS.WAREHOUSES) || '[]'),
        [DB_KEYS.CUSTOMERS]: JSON.parse(localStorage.getItem(DB_KEYS.CUSTOMERS) || '[]'),
        [DB_KEYS.LEDGER]: JSON.parse(localStorage.getItem(DB_KEYS.LEDGER) || '[]'),
        [DB_KEYS.AUDIT]: JSON.parse(localStorage.getItem(DB_KEYS.AUDIT) || '[]'),
        [DB_KEYS.EXPENSES]: JSON.parse(localStorage.getItem(DB_KEYS.EXPENSES) || '[]'),
      };
      const payloadStr = JSON.stringify(fullDb);

      try {
        await fetch('/api/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payloadStr,
        });
      } catch {}

      try {
        await fetch('/api/db.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payloadStr,
        });
      } catch {}
    } catch {}
  }, 100);
};

export const saveHostingerDbData = (key: string, data: any) => {
  // Clean deduplication by ID before saving
  if (key === DB_KEYS.CARTONS && Array.isArray(data)) {
    const cartonMap = new Map<string, Carton>();
    data.forEach((item: Carton) => {
      if (item) {
        const itemKey = item.id || item.ctn_no;
        if (itemKey) {
          const existing = cartonMap.get(itemKey);
          if (!existing || item.status === 'received' || item.status === 'delivered' || item.current_warehouse_id === 'wh-bd') {
            cartonMap.set(itemKey, item);
          }
        }
      }
    });
    data = Array.from(cartonMap.values());
  }

  if (typeof window !== 'undefined') {
    if (key === DB_KEYS.CARTONS) {
      window.__FSC_GLOBAL_CARTONS__ = data;
    }
    if (key === DB_KEYS.PROPOSALS) {
      window.__FSC_GLOBAL_PROPOSALS__ = data;
    }
  }

  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn(`LocalStorage setItem warning for key "${key}":`, e);
  }

  // Push full DB snapshot to server file DB for cross-browser (Chrome <-> Edge <-> Incognito) sync
  pushFullDbToServer();

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('fsc_db_updated', { detail: { key, data } }));
    dbBroadcastChannel?.postMessage({ key, timestamp: Date.now() });
  }
};

// Helper to fetch latest server disk DB (/api/db & /api/db.php) and sync to LocalStorage across different browsers
export const fetchServerDbAndSync = async () => {
  if (typeof window === 'undefined') return;
  try {
    let res = await fetch('/api/db');
    if (!res.ok) {
      res = await fetch('/api/db.php');
    }
    if (res.ok) {
      const serverDb = await res.json();
      if (serverDb && typeof serverDb === 'object') {
        let hasChanges = false;

        Object.keys(serverDb).forEach((key) => {
          const serverData = serverDb[key];
          if (Array.isArray(serverData)) {
            const localRaw = localStorage.getItem(key);
            let localList: any[] = [];
            try {
              localList = localRaw ? JSON.parse(localRaw) : [];
            } catch {
              localList = [];
            }

            const itemMap = new Map<string, any>();
            localList.forEach((item: any) => {
              if (item && (item.id || item.ctn_no || item.email)) {
                itemMap.set(item.id || item.ctn_no || item.email, item);
              }
            });
            serverData.forEach((item: any) => {
              if (item && (item.id || item.ctn_no || item.email)) {
                itemMap.set(item.id || item.ctn_no || item.email, item);
              }
            });

            const mergedList = Array.from(itemMap.values());
            const mergedStr = JSON.stringify(mergedList);

            if (localRaw !== mergedStr) {
              localStorage.setItem(key, mergedStr);
              hasChanges = true;
            }
          }
        });

        if (hasChanges) {
          window.dispatchEvent(new CustomEvent('fsc_db_updated', { detail: { key: 'server_sync' } }));
        }
      }
    }
  } catch (e) {
    console.warn('Error fetching server DB:', e);
  }
};

export const subscribeToDbUpdates = (callback: () => void) => {
  if (typeof window === 'undefined') return () => {};

  const handleEvent = () => {
    try {
      callback();
    } catch {}
  };

  window.addEventListener('fsc_db_updated', handleEvent);
  window.addEventListener('storage', handleEvent);
  window.addEventListener('focus', handleEvent);
  document.addEventListener('visibilitychange', handleEvent);

  if (dbBroadcastChannel) {
    dbBroadcastChannel.onmessage = handleEvent;
    dbBroadcastChannel.addEventListener('message', handleEvent);
  }

  // Sync with server DB immediately on subscribe
  fetchServerDbAndSync().then(() => callback());

  // Poll server DB every 1.5s for instant multi-browser cross-sync (Chrome <-> Edge <-> Incognito)
  const pollInterval = setInterval(async () => {
    await fetchServerDbAndSync();
  }, 1500);

  return () => {
    clearInterval(pollInterval);
    window.removeEventListener('fsc_db_updated', handleEvent);
    window.removeEventListener('storage', handleEvent);
    window.removeEventListener('focus', handleEvent);
    document.removeEventListener('visibilitychange', handleEvent);
    if (dbBroadcastChannel) {
      dbBroadcastChannel.onmessage = null;
      dbBroadcastChannel.removeEventListener('message', handleEvent);
    }
  };
};

export const logSystemAuditAction = (
  user: { id?: string; name?: string; role?: any },
  action: string,
  entity_type: string,
  entity_id: string,
  details: string
) => {
  initHostingerDb();
  const data = getHostingerDbData();
  const newAuditLog: AuditLog = {
    id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    user_id: user?.id || 'usr-1',
    user_name: user?.name || 'তানভীর আহমেদ (Super Admin)',
    user_role: (user?.role as any) || 'super_admin',
    action,
    entity_type,
    entity_id,
    details,
    created_at: new Date().toISOString(),
  };

  const updatedAuditLogs = [newAuditLog, ...(data.auditLogs || [])];
  localStorage.setItem(DB_KEYS.AUDIT, JSON.stringify(updatedAuditLogs));
  return newAuditLog;
};
