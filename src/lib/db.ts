/**
 * M/S FOUR STAR CARGO — HOSTINGER VPS DATA CLIENT & SQL SERVICE
 * Provides direct database persistence & Role-Based Access Control (RBAC)
 */

import { User, Warehouse, Carton, FlyingProposal, Customer, LedgerEntry, AuditLog, ExpenseItem, CrmCustomer, WarehouseInchargeStaff } from '../types';
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

export const formatWarehouseNameEn = (name?: string): string => {
  if (!name) return 'Guangzhou Air Cargo Hub';
  const str = String(name);
  if (str.includes('Guangzhou') || str.includes('গুয়াংজু') || str.includes('গুয়াংজু') || str.includes('চায়না') || str.includes('চায়না') || str.includes('CAN')) return 'Guangzhou Air Cargo Hub';
  if (str.includes('Dhaka') || str.includes('বাংলাদেশ') || str.includes('Tejgaon') || str.includes('DAC') || str.includes('ঢাকা')) return 'Dhaka Central Freight Hub';
  if (str.includes('Hong Kong') || str.includes('হংকং') || str.includes('HKG')) return 'Hong Kong Cargo Terminal';
  if (str.includes('Dubai') || str.includes('দুবাই') || str.includes('DXB')) return 'Dubai Cargo Village Hub';
  const cleaned = str.replace(/[\u0980-\u09FF]+/g, '').replace(/\(\s*\)/g, '').trim();
  return cleaned || 'Air Cargo Hub';
};

export const resolveCanonicalWarehouseId = (whIdOrName?: string, nameOrCode?: string): string => {
  const cleanId = (whIdOrName || '').toLowerCase().trim();
  const cleanName = (nameOrCode || '').toLowerCase().trim();

  // 1. Direct exact ID matches (highest priority)
  if (cleanId === 'wh-bd' || cleanName === 'wh-bd') return 'wh-bd';
  if (cleanId === 'wh-china' || cleanName === 'wh-china') return 'wh-china';
  if (cleanId === 'wh-hk' || cleanName === 'wh-hk') return 'wh-hk';
  if (cleanId === 'wh-jp' || cleanName === 'wh-jp') return 'wh-jp';
  if (cleanId === 'wh-kr' || cleanName === 'wh-kr') return 'wh-kr';

  const str = `${cleanId} ${cleanName}`;

  // 2. Check Bangladesh / Destination Hub keywords (BEFORE China)
  if (
    str.includes('wh-bd') ||
    str.includes('bangladesh') ||
    str.includes('dhaka') ||
    str.includes('ঢাকা') ||
    str.includes('destination') ||
    str.includes('bd hub') ||
    str.includes('bd freight') ||
    str.includes('bd')
  ) {
    return 'wh-bd';
  }

  // 3. Check China / Origin Hub keywords
  if (
    str.includes('wh-china') ||
    str.includes('china') ||
    str.includes('guangzhou') ||
    str.includes('中国') ||
    str.includes('can hub') ||
    str.includes('guangzhou hub')
  ) {
    return 'wh-china';
  }

  // 4. Check Hong Kong
  if (str.includes('wh-hk') || str.includes('hong kong') || str.includes('hkg') || str.includes('hk')) {
    return 'wh-hk';
  }

  // 5. Check Japan
  if (str.includes('wh-jp') || str.includes('japan') || str.includes('jp')) {
    return 'wh-jp';
  }

  // 6. Check Korea
  if (str.includes('wh-kr') || str.includes('korea') || str.includes('kr')) {
    return 'wh-kr';
  }

  return cleanId || 'wh-china';
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

let isDbInitialized = false;

// Initialize Hostinger local persistence safely without wiping real data on refresh
export const initHostingerDb = () => {
  if (typeof window === 'undefined' || isDbInitialized) return;
  isDbInitialized = true;
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

  const existingWhRaw = localStorage.getItem(DB_KEYS.WAREHOUSES);
  if (!existingWhRaw) {
    localStorage.setItem(DB_KEYS.WAREHOUSES, JSON.stringify(INITIAL_WAREHOUSES));
  } else {
    try {
      const parsedWhs: Warehouse[] = JSON.parse(existingWhRaw);
      let whChanged = false;
      const sanitizedWhs = parsedWhs.map((w) => {
        const cleanName = formatWarehouseNameEn(w.name);
        if (cleanName !== w.name) {
          whChanged = true;
          return { ...w, name: cleanName };
        }
        return w;
      });
      if (whChanged) {
        localStorage.setItem(DB_KEYS.WAREHOUSES, JSON.stringify(sanitizedWhs));
      }
    } catch (e) {}
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

  // Sync from server disk file (/api/db) for multi-browser support on initial load
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

  // Deduplicate cartons strictly by unique ID (never collapse sub-items sharing tracking_number or ctn_no)
  if (Array.isArray(cartons) && cartons.length > 0) {
    const cartonMap = new Map<string, Carton>();
    cartons.forEach((c) => {
      if (c) {
        const uniqueKey = c.id
          ? String(c.id).trim()
          : c.tracking_number && c.shipping_mark
          ? `${c.tracking_number.trim()}_${c.shipping_mark.trim()}`
          : `${c.tracking_number || 'TRK'}_${c.ctn_no || 'CTN'}_${c.product_name_en || ''}`;

        if (uniqueKey) {
          const existing = cartonMap.get(uniqueKey);
          const cTime = c.updated_at ? new Date(c.updated_at).getTime() : 0;
          const eTime = existing?.updated_at ? new Date(existing.updated_at).getTime() : 0;
          
          if (
            !existing ||
            (c.customer_id && !existing.customer_id) ||
            (cTime > 0 && cTime >= eTime) ||
            c.status === 'received' ||
            c.status === 'delivered' ||
            c.current_warehouse_id === 'wh-bd'
          ) {
            cartonMap.set(uniqueKey, c);
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
  userMap.set('usr-admin-master', {
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
        const uKey = u.id || u.email.toLowerCase().trim();
        userMap.set(uKey, {
          ...u,
          password: u.password || 'Cargo@2026',
        });
      }
    });
  }

  // 3. Merge incharge_staff from all warehouses into userMap
  if (Array.isArray(warehouses)) {
    warehouses.forEach((wh) => {
      if (wh && Array.isArray(wh.incharge_staff)) {
        wh.incharge_staff.forEach((stf) => {
          if (stf && (stf.id || stf.email)) {
            const stfKey = stf.id || (stf.email || '').toLowerCase().trim();
            const existingUserByEmail = Array.from(userMap.values()).find(
              (u) => (u.email || '').toLowerCase().trim() === (stf.email || '').toLowerCase().trim()
            );

            if (existingUserByEmail) {
              existingUserByEmail.role = 'warehouse_incharge';
              existingUserByEmail.warehouse_id = wh.id;
              existingUserByEmail.warehouse_name = wh.name;
            } else if (!userMap.has(stfKey) && stf.email) {
              userMap.set(stfKey, {
                id: stf.id || `usr-stf-${Date.now()}`,
                name: stf.name,
                email: stf.email,
                password: 'Cargo@2026',
                role: 'warehouse_incharge',
                warehouse_id: wh.id,
                warehouse_name: wh.name,
                phone: stf.phone || '+880 1700-000000',
                status: stf.status || 'active',
                created_at: stf.created_at || new Date().toISOString(),
              });
            }
          }
        });
      }
    });
  }

  const mergedUsers = Array.from(userMap.values());

  // 4. Ensure all warehouse_incharge role users are synced into their warehouse incharge_staff roster
  if (Array.isArray(warehouses)) {
    let whUpdated = false;
    warehouses = warehouses.map((wh) => {
      const whUsers = mergedUsers.filter(
        (u) => u.role === 'warehouse_incharge' && u.warehouse_id === wh.id
      );
      if (whUsers.length > 0) {
        const staffMap = new Map<string, WarehouseInchargeStaff>();
        (wh.incharge_staff || []).forEach((stf) => {
          if (stf && stf.id) staffMap.set(stf.id, stf);
        });
        whUsers.forEach((u) => {
          if (u.id && !staffMap.has(u.id)) {
            staffMap.set(u.id, {
              id: u.id,
              name: u.name,
              email: u.email,
              phone: u.phone || '+880 1700-000000',
              role: 'warehouse_incharge',
              status: u.status || 'active',
              created_at: u.created_at || new Date().toISOString(),
            });
            whUpdated = true;
          }
        });
        return {
          ...wh,
          incharge_staff: Array.from(staffMap.values()),
        };
      }
      return wh;
    });

    if (whUpdated) {
      try {
        localStorage.setItem(DB_KEYS.WAREHOUSES, JSON.stringify(warehouses));
      } catch {}
    }
  }

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

  // Auto-sync customer databases bidirectionally across main system and CRM tables
  syncCustomerDatabasesBidirectionally();

  const customers = JSON.parse(localStorage.getItem(DB_KEYS.CUSTOMERS) || localStorage.getItem('fsc_vps_customers') || localStorage.getItem('customers') || '[]') as Customer[];
  const crmCustomers = JSON.parse(localStorage.getItem(DB_KEYS.CRM_CUSTOMERS) || localStorage.getItem('fsc_vps_crm_customers') || localStorage.getItem('crmCustomers') || localStorage.getItem('crm_customers') || '[]') as CrmCustomer[];

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
    settings: JSON.parse(localStorage.getItem('fsc_vps_settings') || localStorage.getItem('settings') || '{}'),
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

// Standalone 2-way bidirectional sync between Main Customers (fsc_vps_customers) and CRM Customers (fsc_vps_crm_customers)
export const syncCustomerDatabasesBidirectionally = () => {
  try {
    const rawCrm = localStorage.getItem(DB_KEYS.CRM_CUSTOMERS) || localStorage.getItem('crmCustomers') || '[]';
    let crmList: CrmCustomer[] = [];
    try { crmList = JSON.parse(rawCrm); } catch { crmList = []; }
    if (!Array.isArray(crmList)) crmList = [];

    const rawMain = localStorage.getItem(DB_KEYS.CUSTOMERS) || localStorage.getItem('fsc_vps_customers') || localStorage.getItem('customers') || '[]';
    let mainList: Customer[] = [];
    try { mainList = JSON.parse(rawMain); } catch { mainList = []; }
    if (!Array.isArray(mainList)) mainList = [];

    let crmUpdated = false;
    let mainUpdated = false;

    const getCleanPhone = (p?: string) => (p || '').replace(/\D/g, '');
    const getCleanName = (n?: string) => (n || '').trim().toLowerCase();
    const getCleanMark = (m?: string) => (m || '').trim().toUpperCase();

    // 1. Sync CRM -> Main Customers
    crmList.forEach((crmCust) => {
      if (!crmCust || (!crmCust.name && !crmCust.phone && !crmCust.shipping_mark)) return;
      if (/^crm-cust-10[1-9]$/.test(crmCust.id) || /^crm-cust-11[0-1]$/.test(crmCust.id)) return;

      const cPhone = getCleanPhone(crmCust.phone);
      const cName = getCleanName(crmCust.name);
      const cMark = getCleanMark(crmCust.shipping_mark);

      const existingIndex = mainList.findIndex((m) => {
        const mPhone = getCleanPhone(m.phone);
        const mName = getCleanName(m.name);
        const mMark = getCleanMark(m.shipping_mark);
        return (cPhone && mPhone && cPhone === mPhone) || 
               (cMark && mMark && cMark === mMark) || 
               (cName && mName && cName === mName);
      });

      if (existingIndex >= 0) {
        const existingMain = mainList[existingIndex];
        let mainMutated = false;
        const updatedMain = { ...existingMain };

        if (!updatedMain.shipping_mark && crmCust.shipping_mark) {
          updatedMain.shipping_mark = crmCust.shipping_mark;
          mainMutated = true;
        }
        if (!updatedMain.phone && crmCust.phone) {
          updatedMain.phone = crmCust.phone;
          mainMutated = true;
        }
        if (!updatedMain.company_name && crmCust.company_name) {
          updatedMain.company_name = crmCust.company_name;
          mainMutated = true;
        }
        if (mainMutated) {
          mainList[existingIndex] = updatedMain;
          mainUpdated = true;
        }
      } else {
        const rawDigits = cPhone.length >= 4 ? cPhone.slice(-4) : Math.floor(1000 + Math.random() * 9000).toString();
        const newMainCust: Customer = {
          id: `cust-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          customer_code: crmCust.customer_custom_id || `CUST-${rawDigits}`,
          shipping_mark: crmCust.shipping_mark || `MAR-${rawDigits}`,
          name: crmCust.name || 'Unknown Customer',
          phone: crmCust.phone || '',
          company_name: crmCust.company_name || '',
          address: crmCust.address || 'Dhaka, Bangladesh',
          total_due: 0,
          total_paid: 0,
          total_billed: 0,
          status: crmCust.followup_status === 'important_regular' ? 'vip' : 'active',
          created_at: crmCust.created_at || new Date().toISOString(),
        };
        mainList = [newMainCust, ...mainList];
        mainUpdated = true;
      }
    });

    // 2. Sync Main Customers -> CRM
    mainList.forEach((mainCust) => {
      if (!mainCust || (!mainCust.name && !mainCust.phone && !mainCust.shipping_mark)) return;

      const mPhone = getCleanPhone(mainCust.phone);
      const mName = getCleanName(mainCust.name);
      const mMark = getCleanMark(mainCust.shipping_mark);

      const existingIndex = crmList.findIndex((c) => {
        const cPhone = getCleanPhone(c.phone);
        const cName = getCleanName(c.name);
        const cMark = getCleanMark(c.shipping_mark);
        return (mPhone && cPhone && mPhone === cPhone) || 
               (mMark && cMark && mMark === cMark) || 
               (mName && cName && mName === cName);
      });

      if (existingIndex >= 0) {
        const existingCrm = crmList[existingIndex];
        let crmMutated = false;
        const updatedCrm = { ...existingCrm };

        if (!updatedCrm.shipping_mark && mainCust.shipping_mark) {
          updatedCrm.shipping_mark = mainCust.shipping_mark;
          crmMutated = true;
        }
        if (!updatedCrm.phone && mainCust.phone) {
          updatedCrm.phone = mainCust.phone;
          crmMutated = true;
        }
        if (!updatedCrm.company_name && mainCust.company_name) {
          updatedCrm.company_name = mainCust.company_name;
          crmMutated = true;
        }
        if (crmMutated) {
          crmList[existingIndex] = updatedCrm;
          crmUpdated = true;
        }
      } else {
        const rawDigits = mPhone.length >= 4 ? mPhone.slice(-4) : Math.floor(1000 + Math.random() * 9000).toString();
        const newCrmCust: CrmCustomer = {
          id: `crm-cust-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          name: mainCust.name || 'Unknown Customer',
          phone: mainCust.phone || '',
          company_name: mainCust.company_name || '',
          address: mainCust.address || 'Dhaka, Bangladesh',
          shipping_mark: mainCust.shipping_mark || `MAR-${rawDigits}`,
          country_category: 'CN_New',
          followup_status: 'followup',
          created_by: 'System / Customer Accounts',
          created_at: mainCust.created_at || new Date().toISOString(),
          date: (mainCust.created_at || new Date().toISOString()).split('T')[0],
          is_handed_over: false,
        };
        crmList = [newCrmCust, ...crmList];
        crmUpdated = true;
      }
    });

    if (mainUpdated) {
      localStorage.setItem(DB_KEYS.CUSTOMERS, JSON.stringify(mainList));
      localStorage.setItem('fsc_vps_customers', JSON.stringify(mainList));
      localStorage.setItem('customers', JSON.stringify(mainList));
    }

    if (crmUpdated) {
      localStorage.setItem(DB_KEYS.CRM_CUSTOMERS, JSON.stringify(crmList));
    }
  } catch (err) {
    console.error('Error in syncCustomerDatabasesBidirectionally:', err);
  }
};

export const syncCrmCustomersToMainCustomers = () => {
  syncCustomerDatabasesBidirectionally();
};

const getPrimaryServerEndpoint = () => {
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return 'https://four.kee2mart.com/api/db.php';
  }
  return '/api/db.php';
};

let isPushing = false;
let pendingPushRequested = false;
let lastLocalMutationTime = 0;

const pushFullDbToServer = (immediate: boolean = false) => {
  if (typeof window === 'undefined') return;
  if (pushTimeout) clearTimeout(pushTimeout);

  const doPush = async () => {
    if (isPushing) {
      pendingPushRequested = true;
      return;
    }
    isPushing = true;
    pendingPushRequested = false;

    try {
      const localApiKey = 
        localStorage.getItem('fsc_gemini_api_key') || 
        localStorage.getItem('gemini_api_key') || 
        (typeof window !== 'undefined' ? (window as any).__FSC_GEMINI_KEY__ : '') || 
        '';

      const settingsObj = JSON.parse(localStorage.getItem('fsc_vps_settings') || localStorage.getItem('settings') || '{}');
      if (localApiKey && !settingsObj.gemini_api_key) {
        settingsObj.gemini_api_key = localApiKey;
      }

      const nowTs = Date.now();
      lastLocalMutationTime = nowTs;
      try { localStorage.setItem('fsc_db_updated_at', String(nowTs)); } catch {}

      const userPayload = JSON.parse(localStorage.getItem(DB_KEYS.USERS) || localStorage.getItem('users') || '[]');
      const whPayload = JSON.parse(localStorage.getItem(DB_KEYS.WAREHOUSES) || localStorage.getItem('warehouses') || '[]');
      const cartonsPayload = JSON.parse(localStorage.getItem(DB_KEYS.CARTONS) || localStorage.getItem('fsc_vps_cartons') || localStorage.getItem('cartons') || '[]');
      const proposalsPayload = JSON.parse(localStorage.getItem(DB_KEYS.PROPOSALS) || localStorage.getItem('fsc_vps_proposals') || localStorage.getItem('proposals') || '[]');
      const customersPayload = JSON.parse(localStorage.getItem(DB_KEYS.CUSTOMERS) || localStorage.getItem('fsc_vps_customers') || localStorage.getItem('customers') || '[]');
      const ledgerPayload = JSON.parse(localStorage.getItem(DB_KEYS.LEDGER) || localStorage.getItem('fsc_vps_ledger') || localStorage.getItem('fsc_vps_ledger_entries') || localStorage.getItem('ledger') || '[]');

        const crmPayload = JSON.parse(
          localStorage.getItem(DB_KEYS.CRM_CUSTOMERS) ||
          localStorage.getItem('fsc_vps_crm_customers') ||
          localStorage.getItem('crmCustomers') ||
          localStorage.getItem('crm_customers') ||
          '[]'
        );

        const fullDb: any = {
          _updated_at: nowTs,
          users: userPayload,
          fsc_vps_users: userPayload,
          warehouses: whPayload,
          fsc_vps_warehouses: whPayload,
          [DB_KEYS.CARTONS]: cartonsPayload,
          cartons: cartonsPayload,
          fsc_vps_cartons: cartonsPayload,
          [DB_KEYS.PROPOSALS]: proposalsPayload,
          proposals: proposalsPayload,
          fsc_vps_proposals: proposalsPayload,
          [DB_KEYS.CUSTOMERS]: customersPayload,
          customers: customersPayload,
          fsc_vps_customers: customersPayload,
          [DB_KEYS.LEDGER]: ledgerPayload,
          ledger: ledgerPayload,
          fsc_vps_ledger: ledgerPayload,
          fsc_vps_ledger_entries: ledgerPayload,
          [DB_KEYS.AUDIT]: JSON.parse(localStorage.getItem(DB_KEYS.AUDIT) || '[]'),
          [DB_KEYS.EXPENSES]: JSON.parse(localStorage.getItem(DB_KEYS.EXPENSES) || '[]'),
          [DB_KEYS.CRM_CUSTOMERS]: crmPayload,
          fsc_vps_crm_customers: crmPayload,
          crm_customers: crmPayload,
          crmCustomers: crmPayload,
          [DB_KEYS.CONVERSATIONS]: JSON.parse(localStorage.getItem(DB_KEYS.CONVERSATIONS) || '[]'),
          [DB_KEYS.MESSAGES]: JSON.parse(localStorage.getItem(DB_KEYS.MESSAGES) || '[]'),
          [DB_KEYS.CALLS]: JSON.parse(localStorage.getItem(DB_KEYS.CALLS) || '[]'),
          notifications: JSON.parse(localStorage.getItem('fsc_vps_notifications') || '[]'),
          fsc_vps_notifications: JSON.parse(localStorage.getItem('fsc_vps_notifications') || '[]'),
        };

      if (localApiKey) {
        fullDb.gemini_api_key = localApiKey;
        fullDb.settings = settingsObj;
        fullDb.fsc_vps_settings = settingsObj;
      }

      const payloadStr = JSON.stringify(fullDb);
      const primaryEndpoint = getPrimaryServerEndpoint();

      await fetch(primaryEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payloadStr,
      });
    } catch (err) {
      console.warn('Error pushing DB snapshot to server:', err);
    } finally {
      isPushing = false;
      if (pendingPushRequested) {
        pendingPushRequested = false;
        pushFullDbToServer(true);
      }
    }
  };

  if (immediate) {
    doPush();
  } else {
    pushTimeout = setTimeout(doPush, 50);
  }
};

export const saveHostingerDbData = (key: string, data: any) => {
  lastLocalMutationTime = Date.now();
  try { localStorage.setItem('fsc_db_updated_at', String(lastLocalMutationTime)); } catch {}

  if (key === DB_KEYS.CARTONS && Array.isArray(data)) {
    const cartonMap = new Map<string, Carton>();
    data.forEach((c) => {
      if (c && c.id) {
        cartonMap.set(String(c.id).trim(), c);
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
    if (key === DB_KEYS.USERS || key === 'users') {
      localStorage.setItem(DB_KEYS.USERS, JSON.stringify(data));
      localStorage.setItem('users', JSON.stringify(data));
    }
    if (key === DB_KEYS.WAREHOUSES || key === 'warehouses') {
      localStorage.setItem(DB_KEYS.WAREHOUSES, JSON.stringify(data));
      localStorage.setItem('warehouses', JSON.stringify(data));
    }
    if (key === DB_KEYS.CARTONS || key === 'cartons' || key === 'fsc_vps_cartons') {
      localStorage.setItem(DB_KEYS.CARTONS, JSON.stringify(data));
      localStorage.setItem('fsc_vps_cartons', JSON.stringify(data));
      localStorage.setItem('cartons', JSON.stringify(data));
    }
    if (key === DB_KEYS.CUSTOMERS || key === 'customers' || key === 'fsc_vps_customers') {
      localStorage.setItem(DB_KEYS.CUSTOMERS, JSON.stringify(data));
      localStorage.setItem('fsc_vps_customers', JSON.stringify(data));
      localStorage.setItem('customers', JSON.stringify(data));
    }
    if (key === DB_KEYS.CRM_CUSTOMERS || key === 'fsc_vps_crm_customers' || key === 'crmCustomers' || key === 'crm_customers') {
      localStorage.setItem(DB_KEYS.CRM_CUSTOMERS, JSON.stringify(data));
      localStorage.setItem('fsc_vps_crm_customers', JSON.stringify(data));
      localStorage.setItem('crmCustomers', JSON.stringify(data));
      localStorage.setItem('crm_customers', JSON.stringify(data));
    }
    // If saving ledger, update both key variants for 100% backward and forward compatibility
    if (key === DB_KEYS.LEDGER || key === 'fsc_vps_ledger_entries' || key === 'fsc_vps_ledger' || key === 'ledger') {
      localStorage.setItem('fsc_vps_ledger', JSON.stringify(data));
      localStorage.setItem('fsc_vps_ledger_entries', JSON.stringify(data));
      localStorage.setItem('ledger', JSON.stringify(data));
    }
    // If saving CRM customers or main system customers, trigger immediate 2-way bidirectional sync
    if (key === DB_KEYS.CRM_CUSTOMERS || key === DB_KEYS.CUSTOMERS || key === 'fsc_vps_customers' || key === 'customers' || key === 'fsc_vps_crm_customers' || key === 'crmCustomers' || key === 'crm_customers') {
      syncCustomerDatabasesBidirectionally();
    }
  } catch (e) {
    console.warn(`LocalStorage setItem warning for key "${key}":`, e);
  }

  // Instant local UI notification
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('fsc_db_updated', { detail: { key, data } }));
    dbBroadcastChannel?.postMessage({ key, timestamp: Date.now() });
  }

  // Push full DB snapshot to server file DB immediately
  pushFullDbToServer(true);
};

// Atomic Multi-Key Saver helper to update proposals and cartons together without race conditions
export const saveHostingerDbMultiData = (entries: Record<string, any>) => {
  lastLocalMutationTime = Date.now();
  try { localStorage.setItem('fsc_db_updated_at', String(lastLocalMutationTime)); } catch {}

  let customerKeyPresent = false;

  Object.entries(entries).forEach(([key, data]) => {
    if ((key === DB_KEYS.CARTONS || key === 'cartons' || key === 'fsc_vps_cartons') && Array.isArray(data)) {
      window.__FSC_GLOBAL_CARTONS__ = data;
    }
    if (key === DB_KEYS.PROPOSALS && Array.isArray(data)) {
      window.__FSC_GLOBAL_PROPOSALS__ = data;
    }
    if (key === DB_KEYS.CUSTOMERS || key === DB_KEYS.CRM_CUSTOMERS || key === 'fsc_vps_customers' || key === 'customers') {
      customerKeyPresent = true;
    }
    try {
      localStorage.setItem(key, JSON.stringify(data));
      if (key === DB_KEYS.USERS || key === 'users') {
        localStorage.setItem(DB_KEYS.USERS, JSON.stringify(data));
        localStorage.setItem('users', JSON.stringify(data));
      }
      if (key === DB_KEYS.WAREHOUSES || key === 'warehouses') {
        localStorage.setItem(DB_KEYS.WAREHOUSES, JSON.stringify(data));
        localStorage.setItem('warehouses', JSON.stringify(data));
      }
      if (key === DB_KEYS.CARTONS || key === 'cartons' || key === 'fsc_vps_cartons') {
        localStorage.setItem(DB_KEYS.CARTONS, JSON.stringify(data));
        localStorage.setItem('fsc_vps_cartons', JSON.stringify(data));
        localStorage.setItem('cartons', JSON.stringify(data));
      }
      if (key === DB_KEYS.CUSTOMERS || key === 'customers' || key === 'fsc_vps_customers') {
        localStorage.setItem(DB_KEYS.CUSTOMERS, JSON.stringify(data));
        localStorage.setItem('fsc_vps_customers', JSON.stringify(data));
        localStorage.setItem('customers', JSON.stringify(data));
      }
      if (key === DB_KEYS.LEDGER || key === 'fsc_vps_ledger_entries' || key === 'fsc_vps_ledger' || key === 'ledger') {
        localStorage.setItem('fsc_vps_ledger', JSON.stringify(data));
        localStorage.setItem('fsc_vps_ledger_entries', JSON.stringify(data));
        localStorage.setItem('ledger', JSON.stringify(data));
      }
    } catch (e) {}
  });

  if (customerKeyPresent) {
    syncCustomerDatabasesBidirectionally();
  }

  if (typeof window !== 'undefined') {
    Object.entries(entries).forEach(([key, data]) => {
      window.dispatchEvent(new CustomEvent('fsc_db_updated', { detail: { key, data } }));
    });
    dbBroadcastChannel?.postMessage({ key: 'multi_sync', timestamp: Date.now() });
  }

  pushFullDbToServer(true);
};

let isFetchingSync = false;
let lastKnownServerTs = 0;

export const processServerDbUpdate = (serverDb: any) => {
  if (!serverDb || typeof serverDb !== 'object') return;
  const serverTs = Number(serverDb._updated_at || 0);

  const localUpdatedTs = Number(localStorage.getItem('fsc_db_updated_at') || lastLocalMutationTime || 0);

  // Protection 1: If local user mutated DB in last 30 seconds, do not overwrite with server DB!
  if (lastLocalMutationTime > 0 && Date.now() - lastLocalMutationTime < 30000) {
    return;
  }

  // Protection 2: If local storage has a NEWER updated timestamp than the server DB,
  // DO NOT let the stale server DB overwrite local storage! Push local DB to server instead!
  if (localUpdatedTs > 0 && serverTs > 0 && localUpdatedTs > serverTs) {
    pushFullDbToServer(true);
    return;
  }

  if (serverTs > 0 && serverTs <= lastKnownServerTs) {
    return;
  }
  if (serverTs > 0) {
    lastKnownServerTs = serverTs;
  }

  let hasChanges = false;

  Object.keys(serverDb).forEach((key) => {
    const serverData = serverDb[key];
    if (!serverData) return;

    const serverStr = typeof serverData === 'string' ? serverData : JSON.stringify(serverData);
    const localRaw = localStorage.getItem(key);

    if (localRaw !== serverStr) {
      localStorage.setItem(key, serverStr);

      if (key === DB_KEYS.USERS || key === 'users' || key === 'fsc_vps_users') {
        localStorage.setItem(DB_KEYS.USERS, serverStr);
        localStorage.setItem('users', serverStr);
        localStorage.setItem('fsc_vps_users', serverStr);
      }
      if (key === DB_KEYS.WAREHOUSES || key === 'warehouses' || key === 'fsc_vps_warehouses') {
        localStorage.setItem(DB_KEYS.WAREHOUSES, serverStr);
        localStorage.setItem('warehouses', serverStr);
        localStorage.setItem('fsc_vps_warehouses', serverStr);
      }
      if (key === DB_KEYS.CARTONS || key === 'fsc_vps_cartons' || key === 'cartons') {
        let mergedCartons = Array.isArray(serverData) ? serverData : [];
        try {
          const localRawCartons = localStorage.getItem(DB_KEYS.CARTONS) || localStorage.getItem('fsc_vps_cartons');
          if (localRawCartons) {
            const localCartons: Carton[] = JSON.parse(localRawCartons);
            const localMap = new Map<string, Carton>();
            localCartons.forEach((lc) => lc && lc.id && localMap.set(String(lc.id), lc));

            mergedCartons = mergedCartons.map((sc: Carton) => {
              const lc = localMap.get(String(sc.id));
              if (lc && lc.customer_id && (!sc.customer_id || sc.customer_name?.includes('Unassigned'))) {
                return {
                  ...sc,
                  customer_id: lc.customer_id,
                  customer_code: lc.customer_code,
                  customer_name: lc.customer_name,
                  rate_per_kg: lc.rate_per_kg || sc.rate_per_kg,
                };
              }
              return sc;
            });

            localCartons.forEach((lc) => {
              if (lc && lc.id && !mergedCartons.some((sc: Carton) => String(sc.id) === String(lc.id))) {
                mergedCartons.push(lc);
              }
            });
          }
        } catch (e) {}

        const finalServerStr = JSON.stringify(mergedCartons);
        localStorage.setItem(DB_KEYS.CARTONS, finalServerStr);
        localStorage.setItem('fsc_vps_cartons', finalServerStr);
        localStorage.setItem('cartons', finalServerStr);
        if (typeof window !== 'undefined') {
          window.__FSC_GLOBAL_CARTONS__ = mergedCartons;
        }
      }
      if (key === DB_KEYS.PROPOSALS || key === 'fsc_vps_proposals' || key === 'proposals') {
        localStorage.setItem(DB_KEYS.PROPOSALS, serverStr);
        localStorage.setItem('fsc_vps_proposals', serverStr);
        localStorage.setItem('proposals', serverStr);
        if (typeof window !== 'undefined') {
          window.__FSC_GLOBAL_PROPOSALS__ = Array.isArray(serverData) ? serverData : JSON.parse(serverStr);
        }
      }
      if (key === DB_KEYS.CUSTOMERS || key === 'fsc_vps_customers' || key === 'customers') {
        let mergedCustomers = Array.isArray(serverData) ? serverData : [];
        try {
          const localRawCusts = localStorage.getItem(DB_KEYS.CUSTOMERS) || localStorage.getItem('fsc_vps_customers');
          if (localRawCusts) {
            const localCusts: Customer[] = JSON.parse(localRawCusts);
            const custMap = new Map<string, Customer>();
            mergedCustomers.forEach((sc: Customer) => sc && sc.id && custMap.set(String(sc.id), sc));
            localCusts.forEach((lc: Customer) => {
              if (lc && lc.id && !custMap.has(String(lc.id))) {
                custMap.set(String(lc.id), lc);
              }
            });
            mergedCustomers = Array.from(custMap.values());
          }
        } catch (e) {}

        const finalCustStr = JSON.stringify(mergedCustomers);
        localStorage.setItem(DB_KEYS.CUSTOMERS, finalCustStr);
        localStorage.setItem('fsc_vps_customers', finalCustStr);
        localStorage.setItem('customers', finalCustStr);
      }
      if (key === DB_KEYS.CRM_CUSTOMERS || key === 'fsc_vps_crm_customers' || key === 'crmCustomers' || key === 'crm_customers') {
        localStorage.setItem(DB_KEYS.CRM_CUSTOMERS, serverStr);
        localStorage.setItem('fsc_vps_crm_customers', serverStr);
        localStorage.setItem('crmCustomers', serverStr);
        localStorage.setItem('crm_customers', serverStr);
      }
      if (key === DB_KEYS.LEDGER || key === 'fsc_vps_ledger' || key === 'fsc_vps_ledger_entries') {
        localStorage.setItem('fsc_vps_ledger', serverStr);
        localStorage.setItem('fsc_vps_ledger_entries', serverStr);
      }
      if (key === DB_KEYS.EXPENSES || key === 'fsc_vps_expenses' || key === 'expenses') {
        localStorage.setItem(DB_KEYS.EXPENSES, serverStr);
        localStorage.setItem('fsc_vps_expenses', serverStr);
        localStorage.setItem('expenses', serverStr);
      }

      hasChanges = true;
    }
  });

  syncCrmCustomersToMainCustomers();

  try {
    const serverApiKey = 
      (serverDb as any)?.gemini_api_key || 
      (serverDb as any)?.settings?.gemini_api_key || 
      (serverDb as any)?.fsc_vps_settings?.gemini_api_key || 
      '';
    if (serverApiKey) {
      const cleanApiKey = serverApiKey.replace(/^["']|["']$/g, '').trim();
      if (cleanApiKey) {
        localStorage.setItem('fsc_gemini_api_key', cleanApiKey);
        localStorage.setItem('fsc_vps_settings', JSON.stringify({ gemini_api_key: cleanApiKey }));
        localStorage.setItem('settings', JSON.stringify({ gemini_api_key: cleanApiKey }));
        if (typeof window !== 'undefined') {
          (window as any).__FSC_GEMINI_KEY__ = cleanApiKey;
        }
      }
    }
  } catch {}

  if (hasChanges) {
    window.dispatchEvent(new CustomEvent('fsc_db_updated', { detail: { key: 'server_sync' } }));
    dbBroadcastChannel?.postMessage({ key: 'server_sync', timestamp: Date.now() });
  }
};

// Helper to fetch latest server disk DB (/api/db.php) and sync to LocalStorage across different browsers
export const fetchServerDbAndSync = async () => {
  if (typeof window === 'undefined' || isFetchingSync) return;

  isFetchingSync = true;
  try {
    const endpoint = `${getPrimaryServerEndpoint()}?t=${Date.now()}`;
    const res = await fetch(endpoint, {
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
      cache: 'no-store',
    });

    if (res && res.ok) {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const serverDb = await res.json();
        processServerDbUpdate(serverDb);
      }
    }
  } catch (e) {
    console.warn('Error fetching server DB:', e);
  } finally {
    isFetchingSync = false;
  }
};

const activeSubscribers = new Set<() => void>();
let globalPollInterval: ReturnType<typeof setInterval> | null = null;

const notifyAllSubscribers = () => {
  activeSubscribers.forEach((cb) => {
    try {
      cb();
    } catch {}
  });
};

// Lightweight timestamp check (only fetches ~20 bytes JSON payload with cache busting)
const checkFastTimestamp = async () => {
  if (typeof window === 'undefined' || isFetchingSync || isPushing) return;
  try {
    const endpoint = `${getPrimaryServerEndpoint()}?mode=ts&_=${Date.now()}`;
    const res = await fetch(endpoint, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
      cache: 'no-store',
    });
    if (res && res.ok) {
      const data = await res.json();
      const serverTs = Number(data.timestamp || data._updated_at || 0);
      if (serverTs > 0 && serverTs > lastKnownServerTs) {
        await fetchServerDbAndSync();
        notifyAllSubscribers();
      }
    }
  } catch (e) {}
};

export const subscribeHostingerDbChanges = (callback: () => void) => {
  if (typeof window === 'undefined') return () => {};

  activeSubscribers.add(callback);

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

  // Start the SINGLE global polling loop when the first subscriber connects
  if (activeSubscribers.size === 1 && !globalPollInterval) {
    globalPollInterval = setInterval(async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        await checkFastTimestamp();
      }
    }, 4000);
  }

  // Perform lightweight timestamp check on subscribe to see if full DB fetch is needed
  checkFastTimestamp().then(() => callback());

  return () => {
    activeSubscribers.delete(callback);

    // Stop the SINGLE global polling loop when all subscribers unmount
    if (activeSubscribers.size === 0 && globalPollInterval) {
      clearInterval(globalPollInterval);
      globalPollInterval = null;
    }

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

export const subscribeToDbUpdates = subscribeHostingerDbChanges;

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

// FACTORY SYSTEM DATA RESET (Super Admin Only)
// Wipes all transactional data (cartons, proposals, ledgers, vouchers, customer records, logs)
// Preserves Super Admin account credentials, role permissions, warehouse configs, and DB table/column schemas.
export const performFactorySystemReset = async (currentUser?: any) => {
  const resetTime = new Date().toISOString();
  const resetUser = currentUser && currentUser.name ? currentUser : getActiveSystemUser();

  const resetAuditLog: AuditLog = {
    id: `audit-factory-reset-${Date.now()}`,
    user_id: resetUser.id || 'usr-admin-master',
    user_name: resetUser.name || 'Super Admin',
    user_role: resetUser.role || 'super_admin',
    action: 'FACTORY_SYSTEM_RESET',
    entity_type: 'system',
    entity_id: 'ALL_TRANSACTIONS',
    details: 'Super Admin executed Factory System Reset. All customer, flight, inventory, ledger & operational data deleted. Super Admin ID & credentials preserved.',
    created_at: resetTime,
  };

  // Keep ONLY Super Admin Master Account (superadmin@cargo.com / Cargo@2026)
  const masterUserOnly = [INITIAL_USERS[0]];
  try {
    localStorage.setItem(DB_KEYS.USERS, JSON.stringify(masterUserOnly));
    localStorage.setItem('fsc_vps_users', JSON.stringify(masterUserOnly));
    localStorage.setItem('users', JSON.stringify(masterUserOnly));
  } catch (e) {}

  // Clear LocalStorage transactional keys
  const keysToClear = [
    DB_KEYS.CARTONS,
    DB_KEYS.PROPOSALS,
    DB_KEYS.CUSTOMERS,
    DB_KEYS.CRM_CUSTOMERS,
    DB_KEYS.LEDGER,
    DB_KEYS.EXPENSES,
    DB_KEYS.CONVERSATIONS,
    DB_KEYS.MESSAGES,
    DB_KEYS.CALLS,
    'fsc_vps_notifications',
    'fsc_deliveries',
    'cartons',
    'proposals',
    'customers',
    'ledger',
    'expenses',
    'deliveries',
    'notifications',
    'conversations',
    'messages',
    'calls',
  ];

  keysToClear.forEach((key) => {
    try {
      localStorage.setItem(key, JSON.stringify([]));
    } catch (e) {}
  });

  // Save audit log recording the reset
  try {
    localStorage.setItem(DB_KEYS.AUDIT, JSON.stringify([resetAuditLog]));
  } catch (e) {}

  // Clear window in-memory references
  if (typeof window !== 'undefined') {
    window.__FSC_GLOBAL_CARTONS__ = [];
    window.__FSC_GLOBAL_PROPOSALS__ = [];
  }

  // Push clean reset payload directly to Hostinger server DB api with is_factory_reset flag
  const cleanPayload = {
    is_factory_reset: true,
    users: masterUserOnly,
    cartons: [],
    proposals: [],
    customers: [],
    crm_customers: [],
    ledger: [],
    expenses: [],
    auditLogs: [resetAuditLog],
    notifications: [],
    deliveries: [],
    conversations: [],
    messages: [],
    calls: [],
    fsc_vps_users: masterUserOnly,
    fsc_vps_cartons: [],
    fsc_vps_proposals: [],
    fsc_vps_customers: [],
    fsc_vps_ledger: [],
    fsc_vps_expenses: [],
    fsc_vps_audit: [resetAuditLog],
  };

  try {
    const endpoints = ['/api/db.php', '/api/db', 'https://four.kee2mart.com/api/db.php'];
    await Promise.allSettled(
      endpoints.map((url) =>
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cleanPayload),
        })
      )
    );
  } catch (e) {}

  // Trigger real-time sync event
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('fsc_db_updated', { detail: { key: 'factory_reset' } }));
  }

  return true;
};

export const getProposalDisplayCode = (prop?: { id: string; flight_number?: string; date?: string; proposal_code?: string } | null) => {
  if (!prop) return '';
  if (prop.proposal_code) return prop.proposal_code;

  const flightNum = (prop.flight_number || 'BS-206').replace(/\s+/g, '');
  const rawId = prop.id || '';

  const parts = rawId.split('-');
  const seqSuffix = parts.length > 1 && parts[parts.length - 1].length <= 5
    ? parts[parts.length - 1]
    : rawId.slice(-3);

  if (rawId.startsWith('prop-') || rawId.length > 15) {
    return `#LOT-${flightNum}-${seqSuffix || '01'}`;
  }

  return rawId.startsWith('#') ? rawId : `#${rawId.toUpperCase()}`;
};
