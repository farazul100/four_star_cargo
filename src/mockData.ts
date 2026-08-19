import { User, Warehouse, Carton, FlyingProposal, Customer, LedgerEntry, AuditLog, CrmCustomer } from './types';

export const INITIAL_USERS: User[] = [
  {
    id: 'usr-admin-master',
    name: 'সুপার এডমিন (Super Admin)',
    email: 'superadmin@cargo.com',
    password: 'Cargo@2026',
    role: 'super_admin',
    status: 'active',
    created_at: '2026-01-01T00:00:00Z',
  },
];

export const INITIAL_WAREHOUSES: Warehouse[] = [
  {
    id: 'wh-china',
    name: 'গুয়াংজু ওয়্যারহাউজ (Guangzhou Air Cargo Hub)',
    country: 'China 🇨🇳',
    code: 'CAN-01',
    hub_type: 'origin',
    is_final_destination: false,
    address: 'No. 88 Logistics Park, Baiyun District, Guangzhou, Guangdong',
    city: 'Guangzhou',
    phone: '+86 20 8899-7711',
    status: 'active',
    total_cartons: 0,
    incharge_staff: [],
  },
  {
    id: 'wh-hk',
    name: 'হংকং ওয়্যারহাউজ (Hong Kong Cargo Terminal)',
    country: 'Hong Kong 🇭🇰',
    code: 'HKG-01',
    hub_type: 'origin',
    is_final_destination: false,
    address: 'Unit 4B, Asia Airfreight Terminal, Hong Kong International Airport',
    city: 'Hong Kong',
    phone: '+852 2388-9900',
    status: 'active',
    total_cartons: 0,
    incharge_staff: [],
  },
  {
    id: 'wh-dubai',
    name: 'দুবাই ওয়্যারহাউজ (Dubai Cargo Village Hub)',
    country: 'UAE 🇦🇪',
    code: 'DXB-01',
    hub_type: 'origin',
    is_final_destination: false,
    address: 'Gate 5, DAFZA Cargo Terminal, Dubai International Airport',
    city: 'Dubai',
    phone: '+971 4 299-8800',
    status: 'active',
    total_cartons: 0,
    incharge_staff: [],
  },
  {
    id: 'wh-bd',
    name: 'ঢাকা সেন্ট্রাল ওয়্যারহাউজ (Dhaka Central Freight Hub)',
    country: 'Bangladesh 🇧🇩',
    code: 'DAC-01',
    hub_type: 'destination',
    is_final_destination: true,
    address: 'প্লট ৪৫, তেজগাঁও শিল্প এলাকা, ঢাকা-১২০৮',
    city: 'Dhaka',
    phone: '+880 1711-009988',
    status: 'active',
    total_cartons: 0,
    incharge_staff: [],
  },
];

export const INITIAL_CARTONS: Carton[] = [];
export const INITIAL_PROPOSALS: FlyingProposal[] = [];
export const INITIAL_CUSTOMERS: Customer[] = [];
export const INITIAL_LEDGER: LedgerEntry[] = [];
export const INITIAL_AUDIT_LOGS: AuditLog[] = [];
export const INITIAL_EXPENSES = [];

export const INITIAL_CRM_CUSTOMERS: CrmCustomer[] = [];
