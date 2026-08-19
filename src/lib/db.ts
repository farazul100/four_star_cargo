/**
 * M/S FOUR STAR CARGO — HOSTINGER VPS DATA CLIENT & SQL SERVICE
 * Provides direct database persistence & Role-Based Access Control (RBAC)
 */

import { User, Warehouse, Carton, FlyingProposal, Customer, LedgerEntry, AuditLog, ExpenseItem, CrmCustomer } from '../types';
import {
  INITIAL_USERS,
  INITIAL_WAREHOUSES,
  INITIAL_CARTONS,
  INITIAL_PROPOSALS,
  INITIAL_CUSTOMERS,
  INITIAL_LEDGER,
  INITIAL_AUDIT_LOGS,
  INITIAL_EXPENSES,
  INITIAL_CRM_CUSTOMERS,
} from '../mockData';

export const DB_KEYS = {
  USERS: 'fsc_vps_users',
  WAREHOUSES: 'fsc_vps_warehouses',
  CARTONS: 'fsc_vps_cartons',
  PROPOSALS: 'fsc_vps_proposals',
  CUSTOMERS: 'fsc_vps_customers',
  LEDGER: 'fsc_vps_ledger',
  AUDIT: 'fsc_vps_audit',
  EXPENSES: 'fsc_vps_expenses',
  CRM_CUSTOMERS: 'fsc_vps_crm_customers',
  CONVERSATIONS: 'fsc_vps_conversations',
  MESSAGES: 'fsc_vps_messages',
  CALLS: 'fsc_vps_calls',
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

  if (!localStorage.getItem(DB_KEYS.CRM_CUSTOMERS)) {
    localStorage.setItem(DB_KEYS.CRM_CUSTOMERS, JSON.stringify([]));
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
  } else {
    // Sanitize any legacy hardcoded demo names in audit logs
    try {
      const rawAudit = localStorage.getItem(DB_KEYS.AUDIT);
      if (rawAudit) {
        const logs: AuditLog[] = JSON.parse(rawAudit);
        let changed = false;
        const active = getActiveSystemUser();
        const cleaned = logs.map((log) => {
          if (log.user_name && (log.user_name.includes('তানভীর') || log.user_name.includes('Tanvir'))) {
            changed = true;
            return {
              ...log,
              user_name: active.name || 'সুপার এডমিন (Super Admin)',
            };
          }
          return log;
        });
        if (changed) {
          localStorage.setItem(DB_KEYS.AUDIT, JSON.stringify(cleaned));
        }
      }
    } catch (e) {}
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

  if (Array.isArray(notifications)) {
    notifications = notifications.filter(
      (n) => n && n.id && !n.id.startsWith('notif-base-')
    );
    try {
      localStorage.setItem('fsc_vps_notifications', JSON.stringify(notifications));
    } catch {}
  }

  let customers = JSON.parse(localStorage.getItem(DB_KEYS.CUSTOMERS) || '[]') as Customer[];
  const crmCustomers = JSON.parse(localStorage.getItem(DB_KEYS.CRM_CUSTOMERS) || '[]') as CrmCustomer[];

  // Auto-sync real CRM customers into main system customers database (fsc_vps_customers)
  let customersUpdated = false;
  if (Array.isArray(crmCustomers) && crmCustomers.length > 0) {
    crmCustomers.forEach((crmCust) => {
      if (!crmCust || !crmCust.id || /^crm-cust-10[1-9]$/.test(crmCust.id) || /^crm-cust-11[0-1]$/.test(crmCust.id)) {
        return;
      }
      const cleanPhone = (crmCust.phone || '').replace(/\D/g, '');
      const cleanName = (crmCust.name || '').trim().toLowerCase();

      const exists = customers.some((c) => {
        const existingPhone = (c.phone || '').replace(/\D/g, '');
        const existingName = (c.name || '').trim().toLowerCase();
        return (cleanPhone && existingPhone && cleanPhone === existingPhone) || (cleanName && existingName === cleanName);
      });

      if (!exists) {
        const rawDigits = (crmCust.phone || '').replace(/\D/g, '');
        const shortId = rawDigits.length >= 4 ? rawDigits.slice(-4) : Math.floor(1000 + Math.random() * 9000).toString();

        const newMainCust: Customer = {
          id: `cust-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          customer_code: `CUST-${shortId}`,
          shipping_mark: `MAR-${shortId}`,
          name: crmCust.name,
          phone: crmCust.phone,
          company_name: crmCust.company_name || '',
          address: crmCust.address || 'Dhaka, Bangladesh',
          total_due: 0,
          total_paid: 0,
          total_billed: 0,
          status: crmCust.followup_status === 'important_regular' ? 'vip' : 'active',
          created_at: crmCust.created_at || new Date().toISOString(),
        };

        customers = [newMainCust, ...customers];
        customersUpdated = true;
      }
    });

    if (customersUpdated) {
      try {
        localStorage.setItem(DB_KEYS.CUSTOMERS, JSON.stringify(customers));
      } catch (e) {}
    }
  }

  return {
    users: mergedUsers,
    warehouses: warehouses,
    cartons: cartons as Carton[],
    proposals: proposals as FlyingProposal[],
    customers: customers,
    ledgerEntries: JSON.parse(localStorage.getItem(DB_KEYS.LEDGER) || '[]') as LedgerEntry[],
    auditLogs: JSON.parse(localStorage.getItem(DB_KEYS.AUDIT) || '[]') as AuditLog[],
    expenses: JSON.parse(localStorage.getItem(DB_KEYS.EXPENSES) || '[]') as ExpenseItem[],
    crmCustomers: crmCustomers,
    notifications: notifications,
    conversations: JSON.parse(localStorage.getItem(DB_KEYS.CONVERSATIONS) || '[]'),
    messages: JSON.parse(localStorage.getItem(DB_KEYS.MESSAGES) || '[]'),
    calls: JSON.parse(localStorage.getItem(DB_KEYS.CALLS) || '[]'),
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

// Standalone auto-sync of CRM customers into main system customers list (fsc_vps_customers)
export const syncCrmCustomersToMainCustomers = () => {
  try {
    const rawCrm = localStorage.getItem(DB_KEYS.CRM_CUSTOMERS);
    const crmList: CrmCustomer[] = rawCrm ? JSON.parse(rawCrm) : [];
    if (!Array.isArray(crmList) || crmList.length === 0) return;

    const rawMain = localStorage.getItem(DB_KEYS.CUSTOMERS);
    let mainList: Customer[] = rawMain ? JSON.parse(rawMain) : [];
    let updated = false;

    crmList.forEach((crmCust) => {
      if (!crmCust || !crmCust.name || !crmCust.phone) return;
      // Exclude legacy hardcoded demo IDs
      if (/^crm-cust-10[1-9]$/.test(crmCust.id) || /^crm-cust-11[0-1]$/.test(crmCust.id)) return;

      const cleanPhone = (crmCust.phone || '').replace(/\D/g, '');
      const cleanName = (crmCust.name || '').trim().toLowerCase();

      const exists = mainList.some((c) => {
        const existingPhone = (c.phone || '').replace(/\D/g, '');
        const existingName = (c.name || '').trim().toLowerCase();
        return (cleanPhone && existingPhone && cleanPhone === existingPhone) || (cleanName && existingName === cleanName);
      });

      if (!exists) {
        const rawDigits = (crmCust.phone || '').replace(/\D/g, '');
        const shortId = rawDigits.length >= 4 ? rawDigits.slice(-4) : Math.floor(1000 + Math.random() * 9000).toString();

        const newMainCust: Customer = {
          id: `cust-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          customer_code: `CUST-${shortId}`,
          shipping_mark: `MAR-${shortId}`,
          name: crmCust.name,
          phone: crmCust.phone,
          company_name: crmCust.company_name || '',
          address: crmCust.address || 'Dhaka, Bangladesh',
          total_due: 0,
          total_paid: 0,
          total_billed: 0,
          status: crmCust.followup_status === 'important_regular' ? 'vip' : 'active',
          created_at: crmCust.created_at || new Date().toISOString(),
        };

        mainList = [newMainCust, ...mainList];
        updated = true;
      }
    });

    if (updated) {
      localStorage.setItem(DB_KEYS.CUSTOMERS, JSON.stringify(mainList));
    }
  } catch (err) {
    console.error('Error in syncCrmCustomersToMainCustomers:', err);
  }
};

const SERVER_API_ENDPOINTS = [
  '/api/db.php',
  'https://four.kee2mart.com/api/db.php',
  '/api/db',
  'https://four.kee2mart.com/api/db',
];

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
        [DB_KEYS.CRM_CUSTOMERS]: JSON.parse(localStorage.getItem(DB_KEYS.CRM_CUSTOMERS) || '[]'),
        [DB_KEYS.CONVERSATIONS]: JSON.parse(localStorage.getItem(DB_KEYS.CONVERSATIONS) || '[]'),
        [DB_KEYS.MESSAGES]: JSON.parse(localStorage.getItem(DB_KEYS.MESSAGES) || '[]'),
        [DB_KEYS.CALLS]: JSON.parse(localStorage.getItem(DB_KEYS.CALLS) || '[]'),
      };
      const payloadStr = JSON.stringify(fullDb);

      for (const url of SERVER_API_ENDPOINTS) {
        try {
          await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payloadStr,
          });
        } catch {}
      }
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
    // If saving ledger, update both key variants for 100% backward and forward compatibility
    if (key === DB_KEYS.LEDGER || key === 'fsc_vps_ledger_entries') {
      localStorage.setItem('fsc_vps_ledger', JSON.stringify(data));
      localStorage.setItem('fsc_vps_ledger_entries', JSON.stringify(data));
    }
    // If saving CRM customers, trigger immediate sync to main customers database
    if (key === DB_KEYS.CRM_CUSTOMERS) {
      syncCrmCustomersToMainCustomers();
    }
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
    let res: Response | null = null;
    for (const url of SERVER_API_ENDPOINTS) {
      try {
        const r = await fetch(url, {
          headers: { Accept: 'application/json' },
        });
        if (r.ok) {
          const contentType = r.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            res = r;
            break;
          }
        }
      } catch {}
    }

    if (res && res.ok) {
      const serverDb = await res.json();
      if (serverDb && typeof serverDb === 'object') {
        let hasChanges = false;

        Object.keys(serverDb).forEach((key) => {
          const serverData = serverDb[key];
          if (Array.isArray(serverData)) {
            const localRaw = localStorage.getItem(key);

            if (key === DB_KEYS.CALLS) {
              const localCalls: any[] = localRaw ? JSON.parse(localRaw) : [];
              const serverCalls: any[] = serverData;
              const callMap = new Map<string, any>();

              // Priority: ended/rejected (3) > active (2) > ringing (1)
              const getPriority = (st: string) => {
                if (st === 'ended' || st === 'rejected') return 3;
                if (st === 'active') return 2;
                return 1;
              };

              const allCalls = [...serverCalls, ...localCalls];
              allCalls.forEach((call) => {
                if (call && call.id) {
                  const existing = callMap.get(call.id);
                  if (!existing) {
                    callMap.set(call.id, call);
                  } else {
                    const existingPrio = getPriority(existing.status);
                    const callPrio = getPriority(call.status);

                    if (callPrio > existingPrio) {
                      callMap.set(call.id, { ...existing, ...call });
                    } else if (callPrio === existingPrio) {
                      const mergedCallerCand = Array.from(new Set([...(existing.caller_candidates || []), ...(call.caller_candidates || [])]));
                      const mergedCalleeCand = Array.from(new Set([...(existing.callee_candidates || []), ...(call.callee_candidates || [])]));
                      callMap.set(call.id, {
                        ...existing,
                        ...call,
                        sdp_offer: call.sdp_offer || existing.sdp_offer,
                        sdp_answer: call.sdp_answer || existing.sdp_answer,
                        caller_candidates: mergedCallerCand,
                        callee_candidates: mergedCalleeCand,
                      });
                    }
                  }
                }
              });

              const mergedStr = JSON.stringify(Array.from(callMap.values()));
              if (localRaw !== mergedStr) {
                localStorage.setItem(key, mergedStr);
                hasChanges = true;
              }
            } else if (key === DB_KEYS.MESSAGES || key === DB_KEYS.CONVERSATIONS) {
              const localItems: any[] = localRaw ? JSON.parse(localRaw) : [];
              const serverItems: any[] = serverData;
              const itemMap = new Map<string, any>();

              serverItems.forEach((item) => { if (item && item.id) itemMap.set(item.id, item); });
              localItems.forEach((item) => { if (item && item.id && !itemMap.has(item.id)) itemMap.set(item.id, item); });

              const mergedStr = JSON.stringify(Array.from(itemMap.values()));
              if (localRaw !== mergedStr) {
                localStorage.setItem(key, mergedStr);
                hasChanges = true;
              }
            } else {
              const serverStr = JSON.stringify(serverData);
              if (localRaw !== serverStr) {
                localStorage.setItem(key, serverStr);
                hasChanges = true;
              }
            }
          }
        });

        // Ensure all CRM customers are always present in main system customers array after server sync
        syncCrmCustomersToMainCustomers();

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

export const getActiveSystemUser = (): { id: string; name: string; role: any } => {
  try {
    const saved = localStorage.getItem('fsc_active_user') || sessionStorage.getItem('fsc_active_user');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.name) {
        return {
          id: parsed.id || 'usr-admin-master',
          name: parsed.name,
          role: parsed.role || 'super_admin',
        };
      }
    }
  } catch (e) {}
  return {
    id: 'usr-admin-master',
    name: 'সুপার এডমিন (Super Admin)',
    role: 'super_admin',
  };
};

export const logSystemAuditAction = (
  user: { id?: string; name?: string; role?: any } | null | undefined,
  action: string,
  entity_type: string,
  entity_id: string,
  details: string
) => {
  initHostingerDb();
  const data = getHostingerDbData();
  const activeUser = (user && user.name) ? user : getActiveSystemUser();

  const newAuditLog: AuditLog = {
    id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    user_id: activeUser.id || 'usr-admin-master',
    user_name: activeUser.name || 'সুপার এডমিন (Super Admin)',
    user_role: (activeUser.role as any) || 'super_admin',
    action,
    entity_type,
    entity_id,
    details,
    created_at: new Date().toISOString(),
  };

  const updatedAuditLogs = [newAuditLog, ...(data.auditLogs || [])];
  saveHostingerDbData(DB_KEYS.AUDIT, updatedAuditLogs);
  return newAuditLog;
};
