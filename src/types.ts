export type UserRole = 'super_admin' | 'operation_director' | 'warehouse_incharge' | 'accountant' | 'crm_executive';

export type CartonStatus = 'booked' | 'proposed' | 'in_transit' | 'received' | 'delivered';

export type Language = 'en' | 'bn' | 'cn' | 'ar' | 'hi' | 'ur';

export type Theme = 'dark' | 'light';

export interface CrmCustomer {
  id: string;
  customer_custom_id?: string;
  shipping_mark?: string;
  name: string;
  phone: string;
  company_name?: string;
  email?: string;
  address?: string;
  product_type?: string;
  est_weight?: string;
  social_link?: string;
  country_category: 'CN_New' | 'CN_Old' | 'KR_New' | 'KR_Old' | 'JP_New' | 'Other';
  followup_status: 'followup' | 'order_complete' | 'important_regular';
  notes?: string;
  created_by: string;
  created_by_id?: string;
  created_at: string;
  date: string;
  is_handed_over: boolean;
  handed_over_at?: string;
  handed_over_by?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  phone?: string;
  avatar_url?: string;
  default_language?: string;
  notification_volume?: number;
  department?: string;
  shift?: string;
  warehouse_id?: string;
  warehouse_name?: string;
  status: 'active' | 'inactive' | 'suspended';
  last_active_at?: string;
  created_at: string;
}

export interface WarehouseInchargeStaff {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'warehouse_incharge';
  status: 'active' | 'inactive' | 'suspended';
  created_at?: string;
}

export interface Warehouse {
  id: string;
  name: string;
  country: string;
  code: string;
  is_final_destination: boolean;
  hub_type?: 'origin' | 'destination';
  address?: string;
  phone?: string;
  city?: string;
  status: 'active' | 'inactive' | 'maintenance';
  total_cartons?: number;
  incharge_staff?: WarehouseInchargeStaff[];
}

export interface Carton {
  id: string;
  ctn_no: string;
  packaging_number?: string; // Box packaging number e.g. "BOX-A101"
  shipping_mark: string;
  tracking_number: string;
  master_tracking_number?: string; // Same Master Tracking ID across batch
  product_name_en: string;
  product_name_cn?: string;
  quantity: number;
  net_weight: number; // kg
  gross_weight: number; // kg
  origin_weight?: number; // Original booked weight at China/Origin hub (kg)
  bd_calibrated_weight?: number; // Official calibrated weight at BD Warehouse (kg)
  chargeable_weight?: number; // Chargeable weight (kg)
  cbm: number;
  photo_url?: string; // Proof / Package Slip Photo
  photo_proofs?: string[]; // Multiple photos / proof attachments
  current_warehouse_id: string;
  destination_warehouse_id: string;
  status: CartonStatus;
  flying_date?: string;
  flight_number?: string;
  awb_number?: string;
  booked_by: string;
  created_at: string;
  delivery_method?: 'pathao' | 'manual' | 'hand_delivery';
  delivery_status?: 'pending' | 'sent_to_pathao' | 'delivered_manual';
  pathao_consignment_id?: string;
  pathao_tracking_code?: string;
  payment_status?: 'paid' | 'unpaid';
  cod_amount?: number;
  recipient_name?: string;
  recipient_phone?: string;
  recipient_address?: string;
  updated_at?: string;
  master_group_id?: string; // Grouping ID for merged cartons sharing the same master carton number/code
  is_merged?: boolean; // Flag indicating if carton is part of a merged sub-item group
  // UI joins & Customer mapping
  customer_id?: string;
  customer_code?: string;
  customer_name?: string;
  current_warehouse_name?: string;
  destination_warehouse_name?: string;
}

export interface FlyingProposal {
  id: string;
  flying_name?: string; // Flying Batch Name assigned by Warehouse Incharge
  warehouse_id: string;
  warehouse_name: string;
  destination_warehouse_id?: string;
  destination_warehouse_name?: string;
  proposed_by: string;
  proposed_by_name: string;
  date: string;
  status: 'pending' | 'approved' | 'dispatched' | 'finalized' | 'rejected' | 'in_transit' | 'received';
  flight_number?: string;
  awb_number?: string;
  airline?: string;
  carton_ids?: string[];
  finalized_by?: string;
  finalized_at?: string;
  dispatched_at?: string;
  items_count: number;
  total_weight: number;
  total_cbm: number;
  rejection_note?: string;
}

export interface Customer {
  id: string;
  customer_code: string; // e.g. "CUST-8801"
  shipping_mark?: string; // e.g. "MAR-8801" (The Smart Unique Freight ID)
  name: string;
  phone: string;
  company_name?: string;
  address: string;
  total_due: number;
  total_paid: number;
  total_billed?: number;
  status?: 'active' | 'vip' | 'blocked';
  created_at: string;
}

export interface LedgerEntry {
  id: string;
  customer_id: string;
  customer_code: string;
  customer_name: string;
  shipping_mark?: string;
  type: 'charge' | 'payment';
  amount: number;
  payment_method?: 'cash' | 'bkash' | 'nagad' | 'bank_wire' | 'check';
  reference_no?: string;
  note: string;
  source: 'manual' | 'auto_cash_collection';
  entered_by: string;
  entered_by_name: string;
  warehouse_id?: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  user_name: string;
  user_role: UserRole;
  action: string;
  entity_type: string;
  entity_id: string;
  details: string;
  created_at: string;
}

export interface ExpenseItem {
  id: string;
  title: string;
  category: 'shipping' | 'warehouse_rent' | 'salary' | 'customs' | 'packing_transport' | 'utilities' | 'other';
  amount: number;
  date: string;
  payment_method: 'cash' | 'bank_transfer' | 'mobile_banking';
  voucher_no: string;
  notes?: string;
  created_by: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: UserRole;
  sender_avatar?: string;
  content: string;
  image_url?: string;
  created_at: string;
  read_by?: string[];
  reactions?: Record<string, string[]>;
  attachments?: { name: string; url: string; type: string }[];
  reply_to_id?: string;
}

export interface ChatConversation {
  id: string;
  name?: string;
  type: 'direct' | 'group' | 'customer_support';
  participants: string[]; // user IDs
  created_by: string;
  created_at: string;
  last_message?: string;
  last_message_at?: string;
}

export interface CallSession {
  id: string;
  conversation_id: string;
  caller_id: string;
  caller_name: string;
  caller_role?: UserRole;
  target_user_id?: string;
  type: 'audio' | 'video';
  status: 'ringing' | 'active' | 'ended' | 'rejected';
  sdp_offer?: string;
  sdp_answer?: string;
  caller_candidates?: string[];
  callee_candidates?: string[];
  created_at: string;
}
