import React, { useState, useEffect } from 'react';
import {
  Building2,
  PlusCircle,
  Users,
  MapPin,
  Phone,
  ShieldCheck,
  Package,
  Globe2,
  CheckCircle2,
  XCircle,
  UserPlus,
  Lock,
  Search,
  Edit,
  Trash2,
  ShieldAlert,
  Sliders,
  Check,
} from 'lucide-react';
import { Warehouse, User, Language, Theme, WarehouseInchargeStaff, AuditLog } from '../types';
import { getHostingerDbData, saveHostingerDbData, subscribeToDbUpdates, publishSystemNotification, logSystemAuditAction } from '../lib/db';
import { useTheme } from '../context/ThemeContext';
import { ToastContainer, ToastMessage } from './Toast';

interface WarehouseSetupManagerProps {
  language: Language;
  theme?: Theme;
}

const DB_KEYS = {
  WAREHOUSES: 'fsc_vps_warehouses',
  USERS: 'fsc_vps_users',
  AUDIT: 'fsc_vps_audit',
  CARTONS: 'fsc_vps_cartons',
};

export const WarehouseSetupManager: React.FC<WarehouseSetupManagerProps> = ({
  language,
  theme: themeProp,
}) => {
  const { theme: contextTheme } = useTheme();
  const activeTheme = contextTheme || themeProp || 'light';
  const isDark = activeTheme === 'dark';
  const isBn = language === 'bn';

  // Live database state
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [cartons, setCartons] = useState<any[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'maintenance'>('all');

  // Modal States
  const [showAddWhModal, setShowAddWhModal] = useState(false);
  const [targetWhForIncharge, setTargetWhForIncharge] = useState<Warehouse | null>(null);

  // New Warehouse Form State
  const [newWhName, setNewWhName] = useState('');
  const [newWhCode, setNewWhCode] = useState('');
  const [newWhCountry, setNewWhCountry] = useState('China 🇨🇳');
  const [newWhCity, setNewWhCity] = useState('');
  const [newWhHubType, setNewWhHubType] = useState<'origin' | 'destination'>('origin');
  const [newWhAddress, setNewWhAddress] = useState('');
  const [newWhPhone, setNewWhPhone] = useState('');

  // New Incharge User Form State
  const [inchargeName, setInchargeName] = useState('');
  const [inchargeEmail, setInchargeEmail] = useState('');
  const [inchargePhone, setInchargePhone] = useState('');
  const [inchargePassword, setInchargePassword] = useState('');

  // Toast Helper
  const addToast = (type: 'success' | 'error' | 'info', title: string, message?: string) => {
    setToasts((prev) => [...prev, { id: `toast-${Date.now()}`, type, title, message }]);
  };
  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Load live persistent data on mount & subscribe to real-time updates
  useEffect(() => {
    const loadData = () => {
      const data = getHostingerDbData();
      setWarehouses(data.warehouses || []);
      setUsers(data.users || []);
      setCartons(data.cartons || []);
    };
    loadData();
    return subscribeToDbUpdates(loadData);
  }, []);

  // Save helper
  const syncWarehouses = (updatedWhs: Warehouse[], auditMsg?: string) => {
    setWarehouses(updatedWhs);
    saveHostingerDbData(DB_KEYS.WAREHOUSES, updatedWhs);

    if (auditMsg) {
      logSystemAuditAction(null, 'warehouse_update', 'warehouse', 'wh-sync', auditMsg);
    }
  };

  // ACTION: ADD NEW WAREHOUSE
  const handleCreateWarehouse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWhName.trim() || !newWhCode.trim()) {
      addToast('error', isBn ? 'তথ্য অসম্পূর্ণ' : 'Incomplete Form', isBn ? 'ওয়্যারহাউজের নাম ও কোড দেয়া বাধ্যতামূলক' : 'Name & Code are required');
      return;
    }

    const whId = `wh-${newWhCode.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now().toString().slice(-4)}`;
    const newWh: Warehouse = {
      id: whId,
      name: newWhName,
      code: newWhCode.toUpperCase(),
      country: newWhCountry,
      city: newWhCity || newWhCountry.split(' ')[0],
      hub_type: newWhHubType,
      is_final_destination: newWhHubType === 'destination',
      address: newWhAddress || 'International Cargo Terminal',
      phone: newWhPhone || '+880 1700-000000',
      status: 'active',
      total_cartons: 0,
      incharge_staff: [],
    };

    const updatedWhs = [newWh, ...warehouses];
    syncWarehouses(updatedWhs, `Super Admin created new Warehouse Hub: ${newWh.name} (${newWh.code})`);

    // Reset Form
    setNewWhName('');
    setNewWhCode('');
    setNewWhAddress('');
    setNewWhPhone('');
    setNewWhCity('');
    setShowAddWhModal(false);

    addToast(
      'success',
      isBn ? 'ওয়্যারহাউজ হাব তৈরি সম্পন্ন!' : 'Warehouse Created Successfully!',
      isBn ? `${newWh.name} (${newWh.code}) ডাটাবেজে যুক্ত করা হয়েছে।` : `${newWh.name} has been added.`
    );
  };

  // ACTION: DELETE WAREHOUSE
  const handleDeleteWarehouse = (wh: Warehouse) => {
    const confirmMsg = isBn
      ? `আপনি কি নিশ্চিত যে "${wh.name} (${wh.code})" ওয়্যারহাউজ হাবটি মুছে ফেলতে চান?`
      : `Are you sure you want to delete warehouse "${wh.name} (${wh.code})"?`;

    if (window.confirm(confirmMsg)) {
      const updatedWhs = warehouses.filter((w) => w.id !== wh.id);
      syncWarehouses(updatedWhs, `Super Admin deleted Warehouse Hub: ${wh.name} (${wh.code})`);
      addToast(
        'success',
        isBn ? 'ওয়্যারহাউজ ডিলিট সম্পন্ন!' : 'Warehouse Deleted!',
        isBn ? `"${wh.name}" সফলভাবে ডাটাবেজ থেকে মুছে ফেলা হয়েছে।` : `"${wh.name}" has been removed.`
      );
    }
  };

  // ACTION: ASSIGN INCHARGE TO WAREHOUSE
  const handleAddInchargeToWarehouse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetWhForIncharge) return;
    if (!inchargeName.trim() || !inchargeEmail.trim() || !inchargePassword.trim()) {
      addToast('error', isBn ? 'তথ্য অসম্পূর্ণ' : 'Incomplete Form', isBn ? 'নাম, ইমেইল ও পাসওয়ার্ড দিন' : 'Name, Email & Password required');
      return;
    }

    const staffId = `usr-stf-${Date.now().toString().slice(-4)}`;
    const newStaff: WarehouseInchargeStaff = {
      id: staffId,
      name: inchargeName,
      email: inchargeEmail,
      phone: inchargePhone || '+880 1700-000000',
      role: 'warehouse_incharge',
      status: 'active',
      created_at: new Date().toISOString(),
    };

    // Update Warehouse incharge array
    const updatedWhs = warehouses.map((w) => {
      if (w.id === targetWhForIncharge.id) {
        const currentStaff = w.incharge_staff || [];
        return {
          ...w,
          incharge_staff: [...currentStaff, newStaff],
        };
      }
      return w;
    });

    // Create system user account for login
    const newUser: User = {
      id: staffId,
      name: inchargeName,
      email: inchargeEmail,
      password: inchargePassword,
      role: 'warehouse_incharge',
      warehouse_id: targetWhForIncharge.id,
      warehouse_name: targetWhForIncharge.name,
      phone: inchargePhone || '+880 1700-000000',
      status: 'active',
      created_at: new Date().toISOString(),
    };

    const currentDbUsers = getHostingerDbData().users || [];
    const updatedUsers = [
      ...currentDbUsers.filter((u) => u.id !== staffId && u.email !== inchargeEmail),
      newUser,
    ];
    setUsers(updatedUsers);
    saveHostingerDbData(DB_KEYS.USERS, updatedUsers);

    syncWarehouses(updatedWhs, `Super Admin assigned Incharge ${inchargeName} (${inchargeEmail}) to Warehouse ${targetWhForIncharge.name}`);

    publishSystemNotification({
      title: isBn ? 'নতুন ইনচার্জ দায়িত্ব গ্রহণ' : 'New Incharge Assigned',
      message: isBn ? `${inchargeName}-কে "${targetWhForIncharge.name}" ওয়্যারহাউজের ইনচার্জ হিসেবে নিযুক্ত করা হয়েছে।` : `${inchargeName} assigned as incharge of ${targetWhForIncharge.name}.`,
      type: 'success',
      target_role: 'warehouse_incharge',
      target_warehouse_id: targetWhForIncharge.id,
      target_user_id: staffId,
    });

    // Reset Incharge Form
    setInchargeName('');
    setInchargeEmail('');
    setInchargePhone('');
    setInchargePassword('');
    setTargetWhForIncharge(null);

    addToast(
      'success',
      isBn ? 'ইনচার্জ অ্যাকাউন্ট তৈরি সম্পন্ন!' : 'Incharge Account Created!',
      isBn ? `${inchargeName} কে ${targetWhForIncharge.name} ওয়্যারহাউজের ইনচার্জ হিসেবে যুক্ত করা হয়েছে।` : `Account assigned to ${targetWhForIncharge.name}.`
    );
  };

  // ACTION: TOGGLE WAREHOUSE STATUS
  const handleToggleWarehouseStatus = (whId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'maintenance' : currentStatus === 'maintenance' ? 'inactive' : 'active';
    const updatedWhs = warehouses.map((w) => {
      if (w.id === whId) {
        return { ...w, status: nextStatus as any };
      }
      return w;
    });

    const statusText = nextStatus === 'active' ? (isBn ? 'সক্রিয় (Active)' : 'ACTIVE') : nextStatus === 'maintenance' ? (isBn ? 'রক্ষণাবেক্ষণ (Maintenance)' : 'MAINTENANCE') : (isBn ? 'নিষ্ক্রিয় (Inactive)' : 'INACTIVE');
    syncWarehouses(updatedWhs, `Super Admin changed Warehouse #${whId} status to ${nextStatus}`);
    addToast('info', isBn ? 'ওয়্যারহাউজ স্টেটাস পরিবর্তিত' : 'Warehouse Status Updated', isBn ? `নতুন স্ট্যাটাস: ${statusText}` : `New Status: ${statusText}`);
  };

  // ACTION: REMOVE INCHARGE STAFF FROM WAREHOUSE
  const handleRemoveInchargeStaff = (whId: string, staffId: string) => {
    const updatedWhs = warehouses.map((w) => {
      if (w.id === whId) {
        return {
          ...w,
          incharge_staff: (w.incharge_staff || []).filter((s) => s.id !== staffId),
        };
      }
      return w;
    });

    const updatedUsers = users.filter((u) => u.id !== staffId);
    setUsers(updatedUsers);
    saveHostingerDbData(DB_KEYS.USERS, updatedUsers);

    syncWarehouses(updatedWhs, `Super Admin removed Incharge #${staffId} from Warehouse #${whId}`);
    addToast('info', isBn ? 'ইনচার্জ অ্যাকাউন্ট অপসারিত' : 'Incharge Staff Removed');
  };

  // Filtered Warehouses
  const filteredWarehouses = warehouses.filter((w) => {
    if (statusFilter !== 'all' && w.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = w.name.toLowerCase().includes(q);
      const matchCode = w.code.toLowerCase().includes(q);
      const matchCountry = w.country.toLowerCase().includes(q);
      if (!matchName && !matchCode && !matchCountry) return false;
    }
    return true;
  });

  return (
    <div className="space-y-5 font-sans">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* 1. Header & Actions Bar */}
      <div className={`p-4 rounded-none border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
        isDark ? 'bg-[#1C1C1E] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-xs'
      }`}>
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-none bg-teal-50 border border-teal-200 text-[#00897B] dark:bg-teal-950/60 dark:border-teal-800 dark:text-teal-400 flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className={`text-base md:text-lg font-light flex items-center space-x-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              <span>{isBn ? 'ওয়্যারহাউজ হাব ও ইনচার্জ ম্যানেজমেন্ট' : 'Warehouse Hubs & Incharge Directory'}</span>
            </h1>
            <p className={`text-xs mt-0.5 font-light ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
              {isBn
                ? 'অরিজিন ও ডেসটিনেশন ওয়্যারহাউজ তৈরি, একাধিক ইনচার্জ এক্সেস অ্যাকাউন্ট তৈরি ও বাউন্ডারি কন্ট্রোল'
                : 'Create multi-country hubs, assign multiple incharge staff accounts & enforce strict warehouse access boundary'}
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddWhModal(true)}
          className="px-4 py-2 rounded-none text-xs font-light bg-[#00897B] hover:bg-[#00796B] text-white transition-all cursor-pointer flex items-center space-x-2 shadow-xs"
        >
          <PlusCircle className="w-4 h-4" />
          <span>{isBn ? '+ নতুন ওয়্যারহাউজ যোগ করুন' : '+ Create New Warehouse'}</span>
        </button>
      </div>

      {/* 2. Security Scope Boundary Information Banner */}
      <div className={`p-3.5 rounded-none border flex items-center space-x-3 text-xs ${
        isDark ? 'bg-teal-950/40 border-teal-800/80 text-teal-300' : 'bg-teal-50/80 border-teal-200 text-teal-900'
      }`}>
        <ShieldCheck className="w-5 h-5 text-[#00897B] shrink-0" />
        <div className="font-light">
          <span className="font-semibold block">{isBn ? '🔒 পারমিশন সিকিউরিটি বাউন্ডারি প্রটোকল:' : '🔒 Role-Based Access Boundary Enforcement:'}</span>
          <span>
            {isBn
              ? 'একটি ওয়্যারহাউজের অধীনে একাধিক ইনচার্জ কর্মকর্তা অ্যাকাউন্ট খোলা যাবে। প্রতি ইনচার্জ শুধুমাত্র তার বরাদ্দকৃত নির্দিষ্ট ওয়্যারহাউজের স্টক এন্ট্রি ও রিকোয়েস্ট দেখার অধিকার পাবেন; অন্য ওয়্যারহাউজের ডাটা সম্পূর্ণ ব্লক থাকবে।'
              : 'Each warehouse supports multiple incharge staff accounts. Staff can strictly access ONLY their assigned warehouse stock & proposals; access to other hubs is fully restricted.'}
          </span>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className={`p-3.5 rounded-none border flex flex-wrap items-center justify-between gap-3 text-xs ${
        isDark ? 'bg-[#1C1C1E] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-xs'
      }`}>
        <div className="flex items-center space-x-2">
          <div className={`flex rounded-none p-0.5 border ${isDark ? 'bg-[#121214] border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-none text-xs font-light transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-[#00897B] text-white shadow-xs'
                  : isDark
                  ? 'text-gray-400 hover:text-white'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              {isBn ? 'সব ওয়্যারহাউজ' : 'All Warehouses'}
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1 rounded-none text-xs font-light transition-all cursor-pointer ${
                statusFilter === 'active'
                  ? 'bg-[#00897B] text-white shadow-xs'
                  : isDark
                  ? 'text-gray-400 hover:text-white'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              {isBn ? '🟢 অ্যাক্টিভ হাব' : 'Active Hubs'}
            </button>
            <button
              onClick={() => setStatusFilter('maintenance')}
              className={`px-3 py-1 rounded-none text-xs font-light transition-all cursor-pointer ${
                statusFilter === 'maintenance'
                  ? 'bg-[#00897B] text-white shadow-xs'
                  : isDark
                  ? 'text-gray-400 hover:text-white'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              {isBn ? '🟡 মেইনটেন্যান্স' : 'Maintenance'}
            </button>
          </div>
        </div>

        <div className="relative min-w-[240px]">
          <Search className={`w-3.5 h-3.5 absolute left-3 top-2.5 ${isDark ? 'text-gray-400' : 'text-slate-400'}`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isBn ? 'ওয়্যারহাউজের নাম, কোড বা দেশ সার্চ করুন...' : 'Search warehouse name, code, country...'}
            className={`w-full border rounded-none py-1.5 pl-8 pr-3 text-xs outline-none font-light ${
              isDark ? 'bg-[#121214] border-slate-700 text-white placeholder-gray-400' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
            }`}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-900 dark:hover:text-white">
              <XCircle className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 4. Warehouse Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredWarehouses.length === 0 ? (
          <div className={`col-span-full p-10 rounded-none border text-center text-xs ${
            isDark ? 'bg-[#1C1C1E] border-slate-700 text-gray-400' : 'bg-white border-slate-200 text-slate-700'
          }`}>
            <Building2 className="w-8 h-8 mx-auto mb-2 text-slate-400 opacity-60" />
            <p className={`font-light ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>{isBn ? 'কোনো ওয়্যারহাউজ পাওয়া যায়নি' : 'No warehouses found'}</p>
            <p className="mt-1 font-light">{isBn ? 'নতুন ওয়্যারহাউজ যুক্ত করতে উপরে "+ নতুন ওয়্যারহাউজ যোগ করুন" বাটনে চাপ দিন।' : 'Click Create New Warehouse button to add.'}</p>
          </div>
        ) : (
          filteredWarehouses.map((wh) => {
            const whCartons = cartons.filter((c) => c.current_warehouse_id === wh.id);
            const totalStockCount = whCartons.length;
            const staffList = wh.incharge_staff || [];

            return (
              <div
                key={wh.id}
                className={`p-5 rounded-none border flex flex-col justify-between space-y-4 transition-all ${
                  isDark ? 'bg-[#1C1C1E] border-slate-700 text-white hover:border-slate-600' : 'bg-white border-slate-200 text-slate-900 shadow-xs hover:shadow-sm'
                }`}
              >
                <div>
                  {/* Warehouse Card Header */}
                  <div className={`flex items-start justify-between gap-2 border-b pb-3.5 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-none border flex items-center justify-center font-light text-sm ${
                        isDark ? 'bg-teal-950/40 border-teal-800 text-teal-400' : 'bg-emerald-50 border-emerald-200 text-[#00897B]'
                      }`}>
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className={`font-light text-sm leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{wh.name}</h3>
                        </div>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className={`font-mono text-[11px] font-light px-2 py-0.5 rounded-none border ${
                            isDark ? 'bg-teal-950/60 text-teal-300 border-teal-800' : 'bg-emerald-50 text-[#00897B] border-emerald-200'
                          }`}>
                            {wh.code}
                          </span>
                          <span className={`text-[11px] font-light ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{wh.country}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      {/* Status Badge Toggle */}
                      <button
                        onClick={() => handleToggleWarehouseStatus(wh.id, wh.status)}
                        className={`px-2.5 py-0.5 rounded-none text-[10px] font-light border transition-all cursor-pointer ${
                          wh.status === 'active'
                            ? isDark
                              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : wh.status === 'maintenance'
                            ? isDark
                              ? 'bg-amber-950/60 text-amber-300 border-amber-800'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                            : isDark
                            ? 'bg-rose-950/60 text-rose-300 border-rose-800'
                            : 'bg-rose-50 text-rose-800 border-rose-200'
                        }`}
                        title={isBn ? 'স্ট্যাটাস পরিবর্তন করতে ক্লিক করুন' : 'Click to change status'}
                      >
                        {wh.status === 'active' ? '🟢 Active' : wh.status === 'maintenance' ? '🟡 Maintenance' : '🔴 Inactive'}
                      </button>

                      {/* Delete Warehouse Button (For Super Admin) */}
                      <button
                        onClick={() => handleDeleteWarehouse(wh)}
                        className="p-1 rounded-none text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 transition-all cursor-pointer shrink-0"
                        title={isBn ? 'ওয়্যারহাউজটি মুছে ফেলুন (Delete)' : 'Delete Warehouse Hub'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Warehouse Meta Details */}
                  <div className="space-y-2 mt-3 text-xs">
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                      <span className={`flex items-center space-x-1.5 font-light ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        <Globe2 className="w-3.5 h-3.5 text-[#00897B]" />
                        <span>{isBn ? 'হাব ধরণ:' : 'Hub Type:'}</span>
                      </span>
                      <span className={`font-light px-2 py-0.5 rounded-none text-[11px] border ${
                        wh.is_final_destination || wh.hub_type === 'destination'
                          ? isDark
                            ? 'bg-purple-950/60 text-purple-300 border-purple-800'
                            : 'bg-purple-50 text-purple-800 border-purple-200'
                          : isDark
                          ? 'bg-blue-950/60 text-blue-300 border-blue-800'
                          : 'bg-blue-50 text-blue-800 border-blue-200'
                      }`}>
                        {wh.is_final_destination || wh.hub_type === 'destination' ? (isBn ? 'ডেলিভারি ডেসটিনেশন' : 'Destination Hub') : (isBn ? 'অরিজিন কার্গো সংগ্রহ হাব' : 'Origin Collection Hub')}
                      </span>
                    </div>

                    {wh.address && (
                      <div className={`flex items-start space-x-1.5 text-xs font-light ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{wh.address}</span>
                      </div>
                    )}

                    {wh.phone && (
                      <div className={`flex items-center space-x-1.5 text-xs font-light ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-mono">{wh.phone}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      <span className={`text-xs font-light ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{isBn ? 'বর্তমানে মোট স্টকড কার্টুন:' : 'Current Stocked Cartons:'}</span>
                      <span className={`font-mono font-light ${isDark ? 'text-white' : 'text-slate-900'}`}>{totalStockCount} {isBn ? 'টি কার্টুন' : 'cartons'}</span>
                    </div>
                  </div>

                  {/* 5. Assigned Warehouse Incharge Staff Roster Section */}
                  <div className={`mt-4 pt-3 border-t space-y-2.5 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-light flex items-center space-x-1.5 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                        <Users className="w-3.5 h-3.5 text-[#00897B]" />
                        <span>{isBn ? 'ইনচার্জ কর্মকর্তাবৃন্দ (Incharge Roster)' : 'Incharge Officers Roster'}</span>
                      </span>
                      <span className={`text-[10px] font-mono font-light ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{staffList.length} {isBn ? 'জন কর্মকর্তা' : 'staff'}</span>
                    </div>

                    {/* Staff Accounts List */}
                    <div className="space-y-1.5">
                      {staffList.length === 0 ? (
                        <div className={`p-2.5 rounded-none border text-center text-xs font-light ${
                          isDark ? 'bg-[#121214] border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
                        }`}>
                          {isBn ? 'কোনো ইনচার্জ কর্মকর্তা বরাদ্দ নেই। নিচে যোগ করুন।' : 'No incharge assigned. Add below.'}
                        </div>
                      ) : (
                        staffList.map((stf) => (
                          <div
                            key={stf.id}
                            className={`p-2 rounded-none border flex items-center justify-between text-xs transition-colors ${
                              isDark ? 'bg-[#121214] border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <p className={`font-light text-xs truncate leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{stf.name}</p>
                              <p className={`text-[10px] font-mono truncate font-light ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{stf.email}</p>
                            </div>

                            <button
                              onClick={() => handleRemoveInchargeStaff(wh.id, stf.id)}
                              className="p-1 rounded-none text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer shrink-0"
                              title={isBn ? 'ইনচার্জ কর্মকর্তা রিমুভ করুন' : 'Remove incharge staff'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Action: Add New Incharge Staff Under This Specific Warehouse */}
                <button
                  onClick={() => setTargetWhForIncharge(wh)}
                  className={`w-full py-2 rounded-none text-xs font-light border border-dashed transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                    isDark
                      ? 'border-slate-700 text-teal-300 hover:bg-teal-950/40'
                      : 'border-emerald-300 bg-emerald-50/40 text-[#00897B] hover:bg-emerald-50'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{isBn ? '+ এই ওয়্যারহাউজে ইনচার্জ যোগ করুন' : '+ Assign Incharge Account'}</span>
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* ========================================================================= */}
      {/* 6. MODAL 1: CREATE NEW WAREHOUSE */}
      {/* ========================================================================= */}
      {showAddWhModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className={`w-full max-w-lg rounded-none border p-6 space-y-5 shadow-2xl ${
            isDark ? 'bg-[#1C1C1E] border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            {/* Modal Header */}
            <div className={`flex items-center justify-between border-b pb-4 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-none border flex items-center justify-center ${
                  isDark ? 'bg-teal-950/50 border-teal-800 text-teal-400' : 'bg-emerald-50 border-emerald-200 text-[#00897B]'
                }`}>
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className={`text-base font-light ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {isBn ? 'নতুন ওয়্যারহাউজ হাব তৈরি করুন' : 'Add New Warehouse Hub'}
                  </h2>
                  <p className={`text-xs font-light ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {isBn ? 'নতুন আন্তর্জাতিক অরিজিন বা ডেসটিনেশন হাব কনফিগারেশন' : 'Configure new international hub entry'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowAddWhModal(false)}
                className={`p-1.5 rounded-none transition-all cursor-pointer ${
                  isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'
                }`}
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateWarehouse} className="space-y-4 text-xs font-light">
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className={`block text-[11px] font-light mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {isBn ? 'ওয়্যারহাউজের নাম *' : 'Warehouse Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={newWhName}
                    onChange={(e) => setNewWhName(e.target.value)}
                    placeholder={isBn ? 'যেমন: গুয়াংজু হাব-২' : 'e.g. Guangzhou Hub 2'}
                    className={`w-full border rounded-none py-2.5 px-3.5 outline-none font-light transition-all ${
                      isDark
                        ? 'bg-[#121214] border-slate-700 text-white focus:border-teal-500'
                        : 'bg-slate-50/70 border-slate-200 text-slate-900 focus:bg-white focus:border-[#00897B]'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-[11px] font-light mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {isBn ? 'ওয়্যারহাউজ কোড *' : 'Warehouse Code *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={newWhCode}
                    onChange={(e) => setNewWhCode(e.target.value)}
                    placeholder={isBn ? 'যেমন: CAN-02' : 'e.g. CAN-02'}
                    className={`w-full border rounded-none py-2.5 px-3.5 outline-none font-mono uppercase font-light transition-all ${
                      isDark
                        ? 'bg-[#121214] border-slate-700 text-white focus:border-teal-500'
                        : 'bg-slate-50/70 border-slate-200 text-slate-900 focus:bg-white focus:border-[#00897B]'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className={`block text-[11px] font-light mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {isBn ? 'দেশ (Country) *' : 'Country *'}
                  </label>
                  <select
                    value={newWhCountry}
                    onChange={(e) => setNewWhCountry(e.target.value)}
                    className={`w-full border rounded-none py-2.5 px-3.5 outline-none font-light cursor-pointer transition-all ${
                      isDark
                        ? 'bg-[#121214] border-slate-700 text-white'
                        : 'bg-slate-50/70 border-slate-200 text-slate-900 focus:bg-white focus:border-[#00897B]'
                    }`}
                  >
                    <option value="China 🇨🇳">China 🇨🇳</option>
                    <option value="Hong Kong 🇭🇰">Hong Kong 🇭🇰</option>
                    <option value="Bangladesh 🇧🇩">Bangladesh 🇧🇩</option>
                    <option value="UAE 🇦🇪">UAE (Dubai) 🇦🇪</option>
                    <option value="UK 🇬🇧">United Kingdom 🇬🇧</option>
                    <option value="USA 🇺🇸">United States 🇺🇸</option>
                  </select>
                </div>

                <div>
                  <label className={`block text-[11px] font-light mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {isBn ? 'হাব ধরণ (Hub Role) *' : 'Hub Type *'}
                  </label>
                  <select
                    value={newWhHubType}
                    onChange={(e) => setNewWhHubType(e.target.value as any)}
                    className={`w-full border rounded-none py-2.5 px-3.5 outline-none font-light cursor-pointer transition-all ${
                      isDark
                        ? 'bg-[#121214] border-slate-700 text-white'
                        : 'bg-slate-50/70 border-slate-200 text-slate-900 focus:bg-white focus:border-[#00897B]'
                    }`}
                  >
                    <option value="origin">{isBn ? 'অরিজিন হাব (কার্গো কালেকশন)' : 'Origin Collection Hub'}</option>
                    <option value="destination">{isBn ? 'ডেলিভারি ডেসটিনেশন (ঢাকা হাব)' : 'Final Destination Hub'}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={`block text-[11px] font-light mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {isBn ? 'সম্পূর্ণ ঠিকানা (Full Address)' : 'Full Address'}
                </label>
                <input
                  type="text"
                  value={newWhAddress}
                  onChange={(e) => setNewWhAddress(e.target.value)}
                  placeholder={isBn ? 'লজিস্টিক পার্কের ঠিকানা...' : 'Full logistics hub location address...'}
                  className={`w-full border rounded-none py-2.5 px-3.5 outline-none font-light transition-all ${
                    isDark
                      ? 'bg-[#121214] border-slate-700 text-white focus:border-teal-500'
                      : 'bg-slate-50/70 border-slate-200 text-slate-900 focus:bg-white focus:border-[#00897B]'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-[11px] font-light mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {isBn ? 'জরুরি ফোন / হেল্পলাইন' : 'Emergency Contact Phone'}
                </label>
                <input
                  type="text"
                  value={newWhPhone}
                  onChange={(e) => setNewWhPhone(e.target.value)}
                  placeholder="+86 20 8800-0000"
                  className={`w-full border rounded-none py-2.5 px-3.5 outline-none font-mono font-light transition-all ${
                    isDark
                      ? 'bg-[#121214] border-slate-700 text-white focus:border-teal-500'
                      : 'bg-slate-50/70 border-slate-200 text-slate-900 focus:bg-white focus:border-[#00897B]'
                  }`}
                />
              </div>

              <div className={`flex justify-end space-x-3 pt-4 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                <button
                  type="button"
                  onClick={() => setShowAddWhModal(false)}
                  className={`px-4 py-2 rounded-none text-xs font-light border transition-all cursor-pointer ${
                    isDark
                      ? 'bg-[#121214] border-slate-700 text-slate-300 hover:bg-slate-800'
                      : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                  }`}
                >
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 rounded-none text-xs font-light bg-[#00897B] hover:bg-[#00796B] text-white shadow-xs transition-all cursor-pointer"
                >
                  {isBn ? 'ওয়্যারহাউজ যোগ করুন' : 'Save Warehouse'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. MODAL 2: ASSIGN WAREHOUSE INCHARGE STAFF ACCOUNT */}
      {/* ========================================================================= */}
      {targetWhForIncharge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className={`w-full max-w-lg rounded-none border p-6 space-y-4 shadow-2xl ${
            isDark ? 'bg-[#1C1C1E] border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            {/* Modal Header */}
            <div className={`flex items-center justify-between border-b pb-4 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-none border flex items-center justify-center ${
                  isDark ? 'bg-teal-950/50 border-teal-800 text-teal-400' : 'bg-emerald-50 border-emerald-200 text-[#00897B]'
                }`}>
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className={`text-base font-light ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {isBn ? 'নতুন ইনচার্জ কর্মকর্তা একাউন্ট তৈরি' : 'Assign Warehouse Incharge Staff Account'}
                  </h2>
                  <p className="text-xs text-[#00897B] font-light mt-0.5">
                    {targetWhForIncharge.name} ({targetWhForIncharge.code})
                  </p>
                </div>
              </div>

              <button
                onClick={() => setTargetWhForIncharge(null)}
                className={`p-1.5 rounded-none transition-all cursor-pointer ${
                  isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'
                }`}
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAddInchargeToWarehouse} className="space-y-3.5 text-xs font-light">
              <div>
                <label className={`block text-[11px] font-light mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {isBn ? 'ইনচার্জ কর্মকর্তার পুরো নাম *' : 'Incharge Officer Full Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={inchargeName}
                  onChange={(e) => setInchargeName(e.target.value)}
                  placeholder={isBn ? 'যেমন: আরিফুর রহমান' : 'e.g. Arifur Rahman'}
                  className={`w-full border rounded-none py-2.5 px-3.5 outline-none font-light transition-all ${
                    isDark
                      ? 'bg-[#121214] border-slate-700 text-white focus:border-teal-500'
                      : 'bg-slate-50/70 border-slate-200 text-slate-900 focus:bg-white focus:border-[#00897B]'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className={`block text-[11px] font-light mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {isBn ? 'লগইন ইমেইল অ্যাড্রেস *' : 'Login Email *'}
                  </label>
                  <input
                    type="email"
                    required
                    value={inchargeEmail}
                    onChange={(e) => setInchargeEmail(e.target.value)}
                    placeholder="incharge@fourstarcargo.com"
                    className={`w-full border rounded-none py-2.5 px-3.5 outline-none font-mono font-light transition-all ${
                      isDark
                        ? 'bg-[#121214] border-slate-700 text-white focus:border-teal-500'
                        : 'bg-slate-50/70 border-slate-200 text-slate-900 focus:bg-white focus:border-[#00897B]'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-[11px] font-light mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {isBn ? 'মোবাইল ফোন নম্বর' : 'Phone Number'}
                  </label>
                  <input
                    type="text"
                    value={inchargePhone}
                    onChange={(e) => setInchargePhone(e.target.value)}
                    placeholder="+880 1700-000000"
                    className={`w-full border rounded-none py-2.5 px-3.5 outline-none font-mono font-light transition-all ${
                      isDark
                        ? 'bg-[#121214] border-slate-700 text-white focus:border-teal-500'
                        : 'bg-slate-50/70 border-slate-200 text-slate-900 focus:bg-white focus:border-[#00897B]'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-[11px] font-light mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {isBn ? 'এক্সেস পাসওয়ার্ড (Initial Password) *' : 'Access Password *'}
                </label>
                <input
                  type="password"
                  required
                  value={inchargePassword}
                  onChange={(e) => setInchargePassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full border rounded-none py-2.5 px-3.5 outline-none font-mono font-light transition-all ${
                    isDark
                      ? 'bg-[#121214] border-slate-700 text-white focus:border-teal-500'
                      : 'bg-slate-50/70 border-slate-200 text-slate-900 focus:bg-white focus:border-[#00897B]'
                  }`}
                />
              </div>

              {/* Security Boundary Info Box - Clean Light Teal Box */}
              <div className={`p-3.5 rounded-none border text-xs font-light ${
                isDark ? 'bg-teal-950/40 border-teal-800/80 text-teal-300' : 'bg-teal-50/80 border-teal-200 text-teal-900'
              }`}>
                <p className="flex items-center space-x-1.5 font-semibold text-[#00897B]">
                  <Lock className="w-3.5 h-3.5" />
                  <span>{isBn ? 'স্বয়ংক্রিয় বাউন্ডারি এক্সেস রুল:' : 'Automatic Boundary Control:'}</span>
                </p>
                <p className={`mt-1 text-[11px] leading-relaxed font-light ${isDark ? 'text-teal-300/90' : 'text-teal-800'}`}>
                  {isBn
                    ? `এই ইউজার অ্যাকাউন্টটি সম্পূর্ণভাবে ${targetWhForIncharge.name} ওয়্যারহাউজের জন্য সীমাবদ্ধ থাকবে। তিনি অন্য ওয়্যারহাউজের তথ্য দেখতে বা এডিট করতে পারবেন না।`
                    : `This account will be strictly locked to ${targetWhForIncharge.name}. Staff cannot view or mutate other hubs.`}
                </p>
              </div>

              <div className={`flex justify-end space-x-3 pt-4 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                <button
                  type="button"
                  onClick={() => setTargetWhForIncharge(null)}
                  className={`px-4 py-2 rounded-none text-xs font-light border transition-all cursor-pointer ${
                    isDark
                      ? 'bg-[#121214] border-slate-700 text-slate-300 hover:bg-slate-800'
                      : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                  }`}
                >
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 rounded-none text-xs font-light bg-[#00897B] hover:bg-[#00796B] text-white shadow-xs transition-all cursor-pointer"
                >
                  {isBn ? 'ইনচার্জ অ্যাকাউন্ট খুলুন' : 'Create Incharge Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
