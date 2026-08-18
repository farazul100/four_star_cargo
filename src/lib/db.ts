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

// Initialize Hostinger local persistence
export const initHostingerDb = () => {
  // Clear any old legacy mock cartons, proposals or customers
  const rawCartons = localStorage.getItem(DB_KEYS.CARTONS);
  if (!rawCartons || rawCartons.includes('ctn-bs02') || rawCartons.includes('fsc-carton-')) {
    localStorage.setItem(DB_KEYS.CARTONS, JSON.stringify([]));
  }

  const rawProposals = localStorage.getItem(DB_KEYS.PROPOSALS);
  if (!rawProposals || rawProposals.includes('prop-bs02')) {
    localStorage.setItem(DB_KEYS.PROPOSALS, JSON.stringify([]));
  }

  const rawCustomers = localStorage.getItem(DB_KEYS.CUSTOMERS);
  if (!rawCustomers || rawCustomers.includes('cust-101') || rawCustomers.includes('cust-102')) {
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
        const itemKey = c.id || c.ctn_no;
        if (itemKey) {
          const existing = cartonMap.get(itemKey);
          if (!existing || c.status === 'received' || c.status === 'delivered' || c.current_warehouse_id === 'wh-bd') {
            cartonMap.set(itemKey, c);
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

  if ((!proposals || proposals.length === 0) && typeof window !== 'undefined' && window.__FSC_GLOBAL_PROPOSALS__ && window.__FSC_GLOBAL_PROPOSALS__.length > 0) {
    proposals = window.__FSC_GLOBAL_PROPOSALS__;
  }

  return {
    users: JSON.parse(localStorage.getItem(DB_KEYS.USERS) || '[]') as User[],
    warehouses: JSON.parse(localStorage.getItem(DB_KEYS.WAREHOUSES) || '[]') as Warehouse[],
    cartons: cartons as Carton[],
    proposals: proposals as FlyingProposal[],
    customers: JSON.parse(localStorage.getItem(DB_KEYS.CUSTOMERS) || '[]') as Customer[],
    ledgerEntries: JSON.parse(localStorage.getItem(DB_KEYS.LEDGER) || '[]') as LedgerEntry[],
    auditLogs: JSON.parse(localStorage.getItem(DB_KEYS.AUDIT) || '[]') as AuditLog[],
    expenses: JSON.parse(localStorage.getItem(DB_KEYS.EXPENSES) || '[]') as ExpenseItem[],
  };
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
      await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullDb),
      });
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

  // Push full DB snapshot to server file DB for cross-browser (Chrome <-> Edge) sync
  pushFullDbToServer();

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('fsc_db_updated', { detail: { key, data } }));
    dbBroadcastChannel?.postMessage({ key, timestamp: Date.now() });
  }
};

// Helper to fetch latest server disk DB (/api/db) and sync to LocalStorage across different browsers
export const fetchServerDbAndSync = async () => {
  if (typeof window === 'undefined') return;
  try {
    const res = await fetch('/api/db');
    if (res.ok) {
      const serverDb = await res.json();
      if (serverDb && typeof serverDb === 'object') {
        let hasChanges = false;

        Object.keys(serverDb).forEach((key) => {
          const serverData = serverDb[key];
          if (Array.isArray(serverData) && serverData.length > 0) {
            const localRaw = localStorage.getItem(key);
            const localStr = localRaw || '';
            const serverStr = JSON.stringify(serverData);

            if (localStr !== serverStr) {
              localStorage.setItem(key, serverStr);
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
