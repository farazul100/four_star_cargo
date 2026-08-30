import { User, Warehouse, Carton, FlyingProposal, Customer, LedgerEntry, AuditLog, CrmCustomer } from './types';

export const INITIAL_USERS: User[] = [
  {
    id: 'usr-admin-master',
    name: 'Super Admin',
    email: 'superadmin@cargo.com',
    password: 'Cargo@2026',
    role: 'super_admin',
    status: 'active',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'usr-opd-master',
    name: 'OPD',
    email: 'op@cargo.com',
    password: 'Cargo@2026',
    role: 'operation_director',
    warehouse_name: 'Central Access',
    status: 'active',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'usr-acc-master',
    name: 'Chief Accountant',
    email: 'accountant@cargo.com',
    password: 'Cargo@2026',
    role: 'accountant',
    warehouse_name: 'Central Access',
    status: 'active',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'usr-crm-master',
    name: 'CRM',
    email: 'crm@cargo.com',
    password: 'Cargo@2026',
    role: 'crm_executive',
    warehouse_name: 'Central Access',
    status: 'active',
    created_at: '2026-01-01T00:00:00Z',
  },
];

export const INITIAL_WAREHOUSES: Warehouse[] = [
  {
    id: 'wh-china',
    name: 'Guangzhou Air Cargo Hub',
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
    name: 'Hong Kong Cargo Terminal',
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
    name: 'Dubai Cargo Village Hub',
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
    name: 'Dhaka Central Freight Hub',
    country: 'Bangladesh 🇧🇩',
    code: 'DAC-01',
    hub_type: 'destination',
    is_final_destination: true,
    address: 'Plot 45, Tejgaon Industrial Area, Dhaka-1208',
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
