import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Building2,
  Activity,
  Calendar,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  BarChart3,
  TrendingUp,
  Clock,
  Mail,
  Phone,
  Lock,
  Edit,
  Trash2,
  Package,
  Plane,
  DollarSign,
  FileText,
  RotateCcw,
  Sliders,
  ChevronRight,
  Eye,
} from 'lucide-react';
import { User, UserRole, Warehouse, Language, Theme, AuditLog, Carton } from '../types';
import { getHostingerDbData, saveHostingerDbData, subscribeToDbUpdates, publishSystemNotification } from '../lib/db';
import { useTheme } from '../context/ThemeContext';
import { ToastContainer, ToastMessage } from './Toast';

interface UserAccountsManagerProps {
  language: Language;
  theme?: Theme;
}

const DB_KEYS = {
  USERS: 'fsc_vps_users',
  WAREHOUSES: 'fsc_vps_warehouses',
  AUDIT: 'fsc_vps_audit',
  CARTONS: 'fsc_vps_cartons',
};

export const UserAccountsManager: React.FC<UserAccountsManagerProps> = ({
  language,
  theme: themeProp,
}) => {
  const { theme: contextTheme } = useTheme();
  const activeTheme = contextTheme || themeProp || 'light';
  const isDark = activeTheme === 'dark';
  const isBn = language === 'bn';

  // Live database state
  const [users, setUsers] = useState<User[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [cartons, setCartons] = useState<Carton[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modals State
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [selectedUserForAnalytics, setSelectedUserForAnalytics] = useState<User | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  // Analytics Date Filter State
  const [analyticsDatePreset, setAnalyticsDatePreset] = useState<'all' | 'today' | 'month' | 'year'>('month');

  // Add User Form State
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('warehouse_incharge');
  const [newUserWhId, setNewUserWhId] = useState('wh-china');

  // Toast Helper
  const addToast = (type: 'success' | 'error' | 'info', title: string, message?: string) => {
    setToasts((prev) => [...prev, { id: `toast-${Date.now()}`, type, title, message }]);
  };
  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Load live DB data & subscribe to real-time updates
  useEffect(() => {
    const loadData = () => {
      const data = getHostingerDbData();
      setUsers(data.users || []);
      setWarehouses(data.warehouses || []);
      setAuditLogs(data.auditLogs || []);
      setCartons(data.cartons || []);
    };
    loadData();
    return subscribeToDbUpdates(loadData);
  }, []);

  // Sync users to DB
  const syncUsers = (updatedUsers: User[], auditMsg?: string) => {
    setUsers(updatedUsers);
    saveHostingerDbData(DB_KEYS.USERS, updatedUsers);

    if (auditMsg) {
      const data = getHostingerDbData();
      const newAudit: AuditLog = {
        id: `log-${Date.now()}`,
        user_id: 'usr-1',
        user_name: 'তানভীর আহমেদ (Super Admin)',
        user_role: 'super_admin',
        action: 'user_management',
        entity_type: 'user',
        entity_id: 'user-sync',
        details: auditMsg,
        created_at: new Date().toISOString(),
      };
      const newLogs = [newAudit, ...(data.auditLogs || [])];
      setAuditLogs(newLogs);
      saveHostingerDbData(DB_KEYS.AUDIT, newLogs);
    }
  };

  // ACTION: CREATE USER
  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) {
      addToast('error', isBn ? 'তথ্য অসম্পূর্ণ' : 'Incomplete Form', isBn ? 'নাম ও ইমেইল দেয়া বাধ্যতামূলক' : 'Name & Email are required');
      return;
    }

    const assignedWh = warehouses.find((w) => w.id === newUserWhId);
    const userId = `usr-${Date.now().toString().slice(-4)}`;

    const newUser: User = {
      id: userId,
      name: newUserName,
      email: newUserEmail,
      password: newUserPassword || 'Cargo@2026',
      role: newUserRole,
      phone: newUserPhone,
      warehouse_id: newUserRole === 'warehouse_incharge' ? newUserWhId : undefined,
      warehouse_name: newUserRole === 'warehouse_incharge' ? assignedWh?.name : 'Central Access',
      status: 'active',
      created_at: new Date().toISOString(),
    };

    // If warehouse incharge role, also sync into the assigned warehouse's incharge roster
    if (newUserRole === 'warehouse_incharge' && assignedWh) {
      const updatedWhs = warehouses.map((w) => {
        if (w.id === assignedWh.id) {
          const currentStaff = w.incharge_staff || [];
          const newStaff = {
            id: userId,
            name: newUserName,
            email: newUserEmail,
            phone: newUserPhone || '+880 1700-000000',
            role: 'warehouse_incharge' as const,
            status: 'active' as const,
            created_at: new Date().toISOString(),
          };
          return { ...w, incharge_staff: [...currentStaff, newStaff] };
        }
        return w;
      });
      setWarehouses(updatedWhs);
      saveHostingerDbData(DB_KEYS.WAREHOUSES, updatedWhs);
    }

    const updatedUsers = [newUser, ...users];
    syncUsers(updatedUsers, `Super Admin created user account for ${newUser.name} (${newUser.role})`);

    publishSystemNotification({
      title: isBn ? 'নতুন অ্যাকাউন্ট সক্রিয়' : 'New Account Activated',
      message: isBn ? `${newUser.name} (${newUser.email})-এর সিস্টেমে একাউন্ট খোলা হয়েছে।` : `Account created for ${newUser.name} (${newUser.email}).`,
      type: 'info',
      target_role: newUser.role,
      target_user_id: newUser.id,
    });

    // Reset Form
    setNewUserName('');
    setNewUserEmail('');
    setNewUserPhone('');
    setNewUserPassword('');
    setShowAddUserModal(false);

    addToast(
      'success',
      isBn ? 'নতুন ইউজার একাউন্ট তৈরি সফল!' : 'User Created Successfully!',
      isBn ? `${newUser.name} সফলভাবে সিস্টেমে যুক্ত হয়েছে।` : `${newUser.name} account is active.`
    );
  };

  // ACTION: TOGGLE USER STATUS (ACTIVE / SUSPENDED)
  const handleToggleUserStatus = (userId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'suspended' : 'active';
    const updatedUsers = users.map((u) => {
      if (u.id === userId) {
        return { ...u, status: nextStatus as 'active' | 'inactive' | 'suspended' };
      }
      return u;
    });

    const targetUser = users.find((u) => u.id === userId);
    syncUsers(
      updatedUsers,
      `Super Admin changed ${targetUser?.name || userId} status to ${nextStatus === 'suspended' ? 'সাময়িক অব্যাহতি (Suspended)' : 'সক্রিয় (Active)'}`
    );

    addToast(
      nextStatus === 'suspended' ? 'error' : 'success',
      nextStatus === 'suspended'
        ? (isBn ? 'ইউজার সাময়িক অব্যাহতিপ্রাপ্ত ⛔' : 'User Suspended ⛔')
        : (isBn ? 'ইউজার সক্রিয় করা হয়েছে 🟢' : 'User Re-activated 🟢'),
      isBn ? `${targetUser?.name || 'ইউজার'} একাউন্ট স্ট্যাটাস: ${nextStatus.toUpperCase()}` : `Status: ${nextStatus.toUpperCase()}`
    );
  };

  // ACTION: PERMANENTLY DELETE USER ACCOUNT
  const handleConfirmDeleteUser = () => {
    if (!userToDelete) return;

    if (userToDelete.id === 'usr-1' || userToDelete.email === 'superadmin@cargo.com') {
      addToast('error', isBn ? 'অ্যাকশন সম্ভব নয়' : 'Action Forbidden', isBn ? 'মূল সুপার এডমিন অ্যাকাউন্ট ডিলেট করা যাবে না।' : 'Primary Super Admin cannot be deleted.');
      setUserToDelete(null);
      return;
    }

    // Also remove from any warehouse incharge roster if applicable
    const updatedWhs = warehouses.map((w) => ({
      ...w,
      incharge_staff: (w.incharge_staff || []).filter((s) => s.id !== userToDelete.id && s.email !== userToDelete.email),
    }));
    setWarehouses(updatedWhs);
    saveHostingerDbData(DB_KEYS.WAREHOUSES, updatedWhs);

    const updatedUsers = users.filter((u) => u.id !== userToDelete.id && u.email !== userToDelete.email);
    syncUsers(updatedUsers, `Super Admin permanently deleted user account: ${userToDelete.name} (${userToDelete.email})`);

    addToast(
      'success',
      isBn ? 'অ্যাকাউন্ট ডিলিট সম্পন্ন!' : 'Account Deleted!',
      isBn ? `${userToDelete.name} অ্যাকাউন্ট স্থায়ীভাবে মুছে ফেলা হয়েছে।` : `Account deleted permanently.`
    );

    setUserToDelete(null);
  };

  // Filtered Users List
  const filteredUsers = users.filter((u) => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (statusFilter !== 'all' && u.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = u.name.toLowerCase().includes(q);
      const matchEmail = u.email.toLowerCase().includes(q);
      const matchWh = (u.warehouse_name || '').toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchWh) return false;
    }
    return true;
  });

  // Role Badge Helper
  const renderRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'super_admin':
        return (
          <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-medium border ${
            isDark ? 'bg-purple-950/60 text-purple-300 border-purple-800' : 'bg-purple-50 text-purple-800 border-purple-200'
          }`}>
            👑 Super Admin
          </span>
        );
      case 'operation_director':
        return (
          <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-medium border ${
            isDark ? 'bg-blue-950/60 text-blue-300 border-blue-800' : 'bg-blue-50 text-blue-800 border-blue-200'
          }`}>
            🎯 Operation Director
          </span>
        );
      case 'warehouse_incharge':
        return (
          <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-medium border ${
            isDark ? 'bg-teal-950/60 text-teal-300 border-teal-800' : 'bg-emerald-50 text-[#00897B] border-emerald-200'
          }`}>
            📦 Warehouse Incharge
          </span>
        );
      case 'accountant':
        return (
          <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-medium border ${
            isDark ? 'bg-amber-950/60 text-amber-300 border-amber-800' : 'bg-amber-50 text-amber-800 border-amber-200'
          }`}>
            💰 Accountant
          </span>
        );
      case 'crm_executive':
        return (
          <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-medium border ${
            isDark ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800' : 'bg-teal-50 text-[#00897B] border-teal-200'
          }`}>
            👥 CRM Executive
          </span>
        );
      default:
        return <span className="text-xs text-slate-500">{role}</span>;
    }
  };

  // Helper to get User Analytics Stats based on Date Filter
  const getUserAnalyticsStats = (targetUser: User) => {
    const userAuditLogs = auditLogs.filter((log) => {
      if (log.user_id !== targetUser.id && !log.user_name.includes(targetUser.name.split(' ')[0])) return false;
      if (analyticsDatePreset === 'today') {
        const todayStr = new Date().toISOString().split('T')[0];
        return log.created_at.startsWith(todayStr);
      }
      if (analyticsDatePreset === 'month') {
        const monthStr = new Date().toISOString().slice(0, 7);
        return log.created_at.startsWith(monthStr);
      }
      if (analyticsDatePreset === 'year') {
        const yearStr = new Date().toISOString().slice(0, 4);
        return log.created_at.startsWith(yearStr);
      }
      return true;
    });

    const userCartonsBooked = cartons.filter((c) => c.booked_by === targetUser.id);
    const totalBookedWeight = userCartonsBooked.reduce((acc, c) => acc + c.gross_weight, 0);
    const totalBookedCbm = userCartonsBooked.reduce((acc, c) => acc + c.cbm, 0);

    return {
      userAuditLogs,
      bookedCount: userCartonsBooked.length,
      bookedWeight: Math.round(totalBookedWeight * 10) / 10,
      bookedCbm: Math.round(totalBookedCbm * 100) / 100,
      totalActivityLogs: userAuditLogs.length,
    };
  };

  // =========================================================================
  // DEDICATED FULL-PAGE EMPLOYEE LIVE TRACKER VIEW (NO POPUP MODAL)
  // =========================================================================
  if (selectedUserForAnalytics) {
    const stats = getUserAnalyticsStats(selectedUserForAnalytics);

    const handlePrintStaffReport = () => {
      window.print();
    };

    return (
      <div className="space-y-6 font-sans">
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />

        {/* 1. Back Navigation & Action Bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedUserForAnalytics(null)}
            className={`px-4 py-2 rounded-xl text-xs font-normal border transition-all cursor-pointer flex items-center space-x-2 shadow-xs ${
              isDark
                ? 'bg-[#1C1C1E] border-slate-700 text-white hover:bg-slate-800'
                : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
            }`}
          >
            <ChevronRight className="w-4 h-4 rotate-180 text-[#00897B]" />
            <span>{isBn ? '← ইউজার তালিকায় ফিরে যান' : '← Back to User List'}</span>
          </button>

          <button
            onClick={handlePrintStaffReport}
            className="px-4 py-2 rounded-xl text-xs font-normal bg-[#00897B] hover:bg-[#00796B] text-white transition-all cursor-pointer flex items-center space-x-2 shadow-xs"
          >
            <FileText className="w-4 h-4" />
            <span>{isBn ? '🖨️ অফিসারের এক্টিভিটি রিপোর্ট প্রিন্ট' : 'Print Officer Audit Report'}</span>
          </button>
        </div>

        {/* 2. Executive Employee Profile Card */}
        <div className={`p-6 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xs ${
          isDark ? 'bg-[#1C1C1E] border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <div className={`w-16 h-16 rounded-2xl border flex items-center justify-center font-bold text-xl shadow-xs ${
                isDark ? 'bg-teal-950/60 border-teal-800 text-teal-300' : 'bg-emerald-50 border-emerald-200 text-[#00897B]'
              }`}>
                {selectedUserForAnalytics.name.charAt(0)}
              </div>
              <span className="w-4 h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-[#1C1C1E] absolute -bottom-0.5 -right-0.5" title="Active & Connected" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center space-x-2 flex-wrap gap-1">
                <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{selectedUserForAnalytics.name}</h2>
                {renderRoleBadge(selectedUserForAnalytics.role)}
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium border bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                  🟢 {isBn ? 'লাইভ সিস্টেম কানেক্টেড' : 'Live Connected'}
                </span>
              </div>

              <div className="flex items-center space-x-4 text-xs text-slate-500 flex-wrap gap-2 pt-0.5">
                <span className="flex items-center space-x-1 font-mono">
                  <Mail className="w-3.5 h-3.5 text-[#00897B]" />
                  <span>{selectedUserForAnalytics.email}</span>
                </span>
                <span>•</span>
                <span className="flex items-center space-x-1">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>{selectedUserForAnalytics.warehouse_name || 'Central Access'}</span>
                </span>
                <span>•</span>
                <span className="font-mono text-slate-400">ID: {selectedUserForAnalytics.id}</span>
              </div>
            </div>
          </div>

          <div className={`p-3.5 rounded-xl border flex items-center space-x-4 text-xs ${
            isDark ? 'bg-[#121214] border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}>
            <div>
              <span className="text-[11px] font-normal text-slate-500 block">{isBn ? 'কর্মদক্ষতা স্কোর:' : 'Efficiency Score:'}</span>
              <span className="text-base font-bold text-[#00897B] font-mono">98.5%</span>
            </div>
            <div className="w-px h-8 bg-slate-200 dark:bg-slate-800" />
            <div>
              <span className="text-[11px] font-normal text-slate-500 block">{isBn ? 'মোট সিস্টেম অ্যাকশন:' : 'Total Operations:'}</span>
              <span className="text-base font-bold text-slate-900 dark:text-white font-mono">{stats.totalActivityLogs}</span>
            </div>
          </div>
        </div>

        {/* 3. Time Filter Bar */}
        <div className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
          isDark ? 'bg-[#1C1C1E] border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-xs'
        }`}>
          <span className={`flex items-center space-x-2 font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            <Calendar className="w-4 h-4 text-[#00897B]" />
            <span>{isBn ? 'ট্র্যাকিং সময়কাল নির্বাচন করুন:' : 'Live Tracking Period:'}</span>
          </span>

          <div className="flex items-center space-x-1.5 flex-wrap gap-1">
            <button
              onClick={() => setAnalyticsDatePreset('today')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-normal transition-all cursor-pointer ${
                analyticsDatePreset === 'today'
                  ? 'bg-[#00897B] text-white shadow-xs'
                  : isDark
                  ? 'bg-[#121214] text-slate-400 hover:text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {isBn ? 'আজকে (Today)' : 'Today'}
            </button>
            <button
              onClick={() => setAnalyticsDatePreset('month')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-normal transition-all cursor-pointer ${
                analyticsDatePreset === 'month'
                  ? 'bg-[#00897B] text-white shadow-xs'
                  : isDark
                  ? 'bg-[#121214] text-slate-400 hover:text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {isBn ? 'চলতি মাস (This Month)' : 'This Month'}
            </button>
            <button
              onClick={() => setAnalyticsDatePreset('year')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-normal transition-all cursor-pointer ${
                analyticsDatePreset === 'year'
                  ? 'bg-[#00897B] text-white shadow-xs'
                  : isDark
                  ? 'bg-[#121214] text-slate-400 hover:text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {isBn ? 'চলতি বছর (This Year)' : 'This Year'}
            </button>
            <button
              onClick={() => setAnalyticsDatePreset('all')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-normal transition-all cursor-pointer ${
                analyticsDatePreset === 'all'
                  ? 'bg-[#00897B] text-white shadow-xs'
                  : isDark
                  ? 'bg-[#121214] text-slate-400 hover:text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {isBn ? 'সব সময় (All Time)' : 'All Time'}
            </button>
          </div>
        </div>

        {/* 4. Top 3 Performance Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className={`p-5 rounded-2xl border space-y-2 shadow-xs ${
            isDark ? 'bg-[#1C1C1E] border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <span className="text-xs font-medium text-slate-500 flex items-center justify-between">
              <span>{isBn ? 'মোট সিস্টেম কার্যসম্পাদন' : 'Total System Operations'}</span>
              <Activity className="w-4 h-4 text-[#00897B]" />
            </span>
            <p className="text-2xl font-bold text-[#00897B] font-mono">{stats.totalActivityLogs} <span className="text-xs font-normal text-slate-500">{isBn ? 'অ্যাকশন' : 'actions'}</span></p>
            <p className="text-[11px] text-slate-400 font-normal">{isBn ? 'ডিজিটাল অডিট ট্রেইল দ্বারা নিশ্চিতকৃত' : 'Verified by digital audit trail'}</p>
          </div>

          <div className={`p-5 rounded-2xl border space-y-2 shadow-xs ${
            isDark ? 'bg-[#1C1C1E] border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <span className="text-xs font-medium text-slate-500 flex items-center justify-between">
              <span>{isBn ? 'প্রসেসকৃত ফ্রেইট ওজন' : 'Processed Freight Weight'}</span>
              <Package className="w-4 h-4 text-emerald-600" />
            </span>
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 font-mono">{stats.bookedWeight} <span className="text-xs font-normal text-slate-500">kg</span></p>
            <p className="text-[11px] text-slate-500 font-normal">{stats.bookedCount} {isBn ? 'টি কার্টুন স্টক এন্ট্রি করা হয়েছে' : 'cartons entered'}</p>
          </div>

          <div className={`p-5 rounded-2xl border space-y-2 shadow-xs ${
            isDark ? 'bg-[#1C1C1E] border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <span className="text-xs font-medium text-slate-500 flex items-center justify-between">
              <span>{isBn ? 'হ্যান্ডলড কার্গো ভলিউম' : 'Handled Volume'}</span>
              <TrendingUp className="w-4 h-4 text-blue-600" />
            </span>
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-400 font-mono">{stats.bookedCbm} <span className="text-xs font-normal text-slate-500">CBM</span></p>
            <p className="text-[11px] text-slate-500 font-normal">{isBn ? 'হাব ভলিউম হিসাবকৃত' : 'Hub volume calculated'}</p>
          </div>
        </div>

        {/* 5. Live Activity Stream Feed */}
        <div className={`p-6 rounded-2xl border space-y-4 shadow-xs ${
          isDark ? 'bg-[#1C1C1E] border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}>
          <div className="flex items-center justify-between border-b pb-3.5 dark:border-slate-800">
            <h3 className={`text-sm font-bold flex items-center space-x-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              <Clock className="w-4 h-4 text-[#00897B]" />
              <span>{isBn ? 'অফিসারের সময়ক্রমিক কাজ ফিড (Live Employee Activity Feed)' : 'Live Employee Activity Stream Feed'}</span>
            </h3>
            <span className="text-xs font-mono text-slate-500">{stats.userAuditLogs.length} {isBn ? 'টি এন্ট্রি পাওয়া গেছে' : 'entries'}</span>
          </div>

          <div className="space-y-2.5">
            {stats.userAuditLogs.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-400 font-normal space-y-2">
                <Clock className="w-8 h-8 mx-auto text-slate-300 opacity-60" />
                <p className="font-medium text-slate-700 dark:text-slate-300">{isBn ? 'সিলেক্টকৃত সময়কালে কোনো কার্যক্রম পাওয়া যায়নি' : 'No activity logged for selected period'}</p>
                <p className="text-[11px] text-slate-500">{isBn ? 'উপর থেকে সময়কাল রিসেট করুন বা "সব সময়" সিলেক্ট করুন।' : 'Try selecting All Time preset.'}</p>
              </div>
            ) : (
              stats.userAuditLogs.map((log) => (
                <div
                  key={log.id}
                  className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs transition-colors ${
                    isDark ? 'bg-[#121214] border-slate-800 hover:border-slate-700' : 'bg-slate-50 border-slate-200/90 hover:bg-slate-100/60'
                  }`}
                >
                  <div className="space-y-1">
                    <p className={`font-normal text-xs leading-relaxed ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>{log.details}</p>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-[10px] font-semibold text-[#00897B] bg-emerald-50 dark:bg-teal-950/60 px-2 py-0.2 rounded border border-emerald-200 dark:border-teal-800">
                        {log.action}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">{log.entity_type.toUpperCase()}</span>
                    </div>
                  </div>

                  <span className="text-[11px] font-mono text-slate-500 shrink-0 self-end sm:self-center">
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 font-sans">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* 1. Header & Quick Actions Bar */}
      <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
        isDark ? 'bg-[#1C1C1E] border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-xs'
      }`}>
        <div className="flex items-center space-x-3">
          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center font-medium text-sm ${
            isDark ? 'bg-teal-950/50 border-teal-800 text-teal-400' : 'bg-emerald-50 border-emerald-200 text-[#00897B]'
          }`}>
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className={`text-base md:text-lg font-semibold flex items-center space-x-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              <span>{isBn ? 'ইউজার অ্যাকাউন্টস ও পারফরম্যান্স এনালাইটিক্স' : 'User Accounts & Activity Performance Analytics'}</span>
            </h1>
            <p className={`text-xs mt-0.5 font-normal ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              {isBn
                ? 'কোম্পানির সকল ইউজার একাউন্ট পরিচালনা এবং দৈনিক / মাসিক / বার্ষিক কাজের এ টু জেড এনালাইটিক্স'
                : 'Manage system accounts and monitor day/month/year A-to-Z staff activity performance'}
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddUserModal(true)}
          className="px-4 py-2 rounded-xl text-xs font-normal bg-[#00897B] hover:bg-[#00796B] text-white transition-all cursor-pointer flex items-center space-x-2 shadow-xs"
        >
          <UserPlus className="w-4 h-4" />
          <span>{isBn ? '+ নতুন ইউজার অ্যাকাউন্ট' : '+ Create User Account'}</span>
        </button>
      </div>

      {/* 2. Filters & Search Controls */}
      <div className={`p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-xs ${
        isDark ? 'bg-[#1C1C1E] border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-xs'
      }`}>
        {/* Role Filter Tabs */}
        <div className="flex items-center space-x-1.5 flex-wrap gap-1">
          <button
            onClick={() => setRoleFilter('all')}
            className={`px-3 py-1 rounded-md text-xs font-normal transition-all cursor-pointer ${
              roleFilter === 'all'
                ? 'bg-[#00897B] text-white shadow-xs'
                : isDark
                ? 'bg-[#121214] text-slate-400 hover:text-white'
                : 'bg-slate-100 text-slate-700 hover:text-slate-900'
            }`}
          >
            {isBn ? 'সব ইউজার' : 'All Users'} ({users.length})
          </button>
          <button
            onClick={() => setRoleFilter('warehouse_incharge')}
            className={`px-3 py-1 rounded-md text-xs font-normal transition-all cursor-pointer ${
              roleFilter === 'warehouse_incharge'
                ? 'bg-[#00897B] text-white shadow-xs'
                : isDark
                ? 'bg-[#121214] text-slate-400 hover:text-white'
                : 'bg-slate-100 text-slate-700 hover:text-slate-900'
            }`}
          >
            📦 {isBn ? 'ওয়্যারহাউজ ইনচার্জ' : 'Warehouse Incharge'}
          </button>
          <button
            onClick={() => setRoleFilter('operation_director')}
            className={`px-3 py-1 rounded-md text-xs font-normal transition-all cursor-pointer ${
              roleFilter === 'operation_director'
                ? 'bg-[#00897B] text-white shadow-xs'
                : isDark
                ? 'bg-[#121214] text-slate-400 hover:text-white'
                : 'bg-slate-100 text-slate-700 hover:text-slate-900'
            }`}
          >
            🎯 {isBn ? 'অপারেশন ডিরেক্টর' : 'Operation Director'}
          </button>
          <button
            onClick={() => setRoleFilter('accountant')}
            className={`px-3 py-1 rounded-md text-xs font-normal transition-all cursor-pointer ${
              roleFilter === 'accountant'
                ? 'bg-[#00897B] text-white shadow-xs'
                : isDark
                ? 'bg-[#121214] text-slate-400 hover:text-white'
                : 'bg-slate-100 text-slate-700 hover:text-slate-900'
            }`}
          >
            💰 {isBn ? 'চিফ একাউন্টেন্ট' : 'Accountant'}
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative min-w-[240px]">
          <Search className={`w-3.5 h-3.5 absolute left-3 top-2.5 ${isDark ? 'text-slate-400' : 'text-slate-400'}`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isBn ? 'ইউজারের নাম, ইমেইল বা ওয়্যারহাউজ খুঁজুন...' : 'Search user name, email, hub...'}
            className={`w-full border rounded-lg py-1.5 pl-8 pr-3 text-xs outline-none font-normal ${
              isDark ? 'bg-[#121214] border-slate-700 text-white placeholder-slate-400' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
            }`}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700">
              <XCircle className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 3. User Directory Table */}
      <div className={`border rounded-2xl overflow-hidden shadow-xs ${
        isDark ? 'bg-[#1C1C1E] border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        <div className="overflow-x-auto">
          <table className={`w-full text-left text-xs ${isDark ? 'text-white' : 'text-slate-900'}`}>
            <thead className={`uppercase text-[10px] tracking-wider border-b font-medium ${
              isDark ? 'bg-[#121214] text-slate-400 border-slate-800' : 'bg-slate-50 text-slate-600 border-slate-200'
            }`}>
              <tr>
                <th className="p-3.5">User Identity & Name</th>
                <th className="p-3.5">Email / Access ID</th>
                <th className="p-3.5">System Role</th>
                <th className="p-3.5">Assigned Hub</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-right">Actions & Performance Analytics</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-100'}`}>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className={`p-8 text-center text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {isBn ? 'কোনো ইউজার অ্যাকাউন্ট পাওয়া যায়নি' : 'No user accounts found matching criteria'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className={isDark ? 'hover:bg-[#222224] transition-colors' : 'hover:bg-slate-50 transition-colors'}>
                    {/* Name */}
                    <td className="p-3.5">
                      <div className="flex items-center space-x-2.5">
                        <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-semibold ${
                          isDark ? 'bg-teal-950/40 border-teal-800 text-teal-300' : 'bg-emerald-50 border-emerald-200 text-[#00897B]'
                        }`}>
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <p className={`font-semibold text-xs ${isDark ? 'text-white' : 'text-slate-900'}`}>{u.name}</p>
                          <p className="text-[10px] font-mono text-slate-400">ID: {u.id}</p>
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className={`p-3.5 font-mono text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{u.email}</td>

                    {/* Role */}
                    <td className="p-3.5">{renderRoleBadge(u.role)}</td>

                    {/* Assigned Hub */}
                    <td className={`p-3.5 font-normal text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      {u.warehouse_name || 'Central Access'}
                    </td>

                    {/* Status */}
                    <td className="p-3.5 text-center">
                      <button
                        onClick={() => handleToggleUserStatus(u.id, u.status)}
                        title={isBn ? 'স্ট্যাটাস পরিবর্তন করতে ক্লিক করুন' : 'Click to toggle status'}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-medium border transition-all cursor-pointer inline-flex items-center space-x-1 ${
                          u.status === 'active'
                            ? isDark
                              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800 hover:bg-emerald-900/80'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                            : isDark
                            ? 'bg-rose-950/60 text-rose-300 border-rose-800 hover:bg-rose-900/80'
                            : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                        }`}
                      >
                        <span>{u.status === 'active' ? (isBn ? '🟢 সক্রিয়' : '🟢 Active') : (isBn ? '⛔ সাময়িক অব্যাহতি' : '⛔ Suspended')}</span>
                      </button>
                    </td>

                    {/* Actions & Performance Analytics */}
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end space-x-1.5 flex-wrap gap-1">
                        <button
                          onClick={() => setSelectedUserForAnalytics(u)}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-normal border transition-all cursor-pointer inline-flex items-center space-x-1 shadow-xs ${
                            isDark
                              ? 'bg-teal-950/40 border-teal-800 text-teal-300 hover:bg-teal-900/60'
                              : 'bg-emerald-50 border-emerald-200 text-[#00897B] hover:bg-emerald-100/70'
                          }`}
                          title={isBn ? 'অফিসারের কার্যক্রম এনালাইটিক্স' : 'View Officer Activity Analytics'}
                        >
                          <BarChart3 className="w-3.5 h-3.5" />
                          <span>{isBn ? 'কার্যক্রম ট্র্যাকার' : 'Live Tracker'}</span>
                        </button>

                        <button
                          onClick={() => handleToggleUserStatus(u.id, u.status)}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-normal border transition-all cursor-pointer inline-flex items-center space-x-1 shadow-xs ${
                            u.status === 'active'
                              ? isDark
                                ? 'bg-amber-950/40 border-amber-800 text-amber-300 hover:bg-amber-900/60'
                                : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                              : isDark
                              ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300 hover:bg-emerald-900/60'
                              : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                          }`}
                          title={u.status === 'active' ? (isBn ? 'সাময়িক অব্যাহতি দিন' : 'Suspend Employee') : (isBn ? 'পুনরায় সক্রিয় করুন' : 'Re-activate Account')}
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          <span>{u.status === 'active' ? (isBn ? 'সাময়িক অব্যাহতি' : 'Relieve') : (isBn ? 'সক্রিয় করুন' : 'Activate')}</span>
                        </button>

                        {u.id !== 'usr-1' && (
                          <button
                            onClick={() => setUserToDelete(u)}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-normal border transition-all cursor-pointer inline-flex items-center space-x-1 shadow-xs ${
                              isDark
                                ? 'bg-rose-950/40 border-rose-800 text-rose-300 hover:bg-rose-900/60'
                                : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                            }`}
                            title={isBn ? 'অ্যাকাউন্ট স্থায়ীভাবে ডিলেট করুন' : 'Delete Account'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>{isBn ? 'ডিলেট' : 'Delete'}</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. MODAL: CREATE NEW USER ACCOUNT */}
      {/* ========================================================================= */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-backdrop-blur-fade">
          <div className={`w-full max-w-lg rounded-2xl border p-6 space-y-5 shadow-2xl animate-modal-pop-bounce ${
            isDark ? 'bg-[#1C1C1E] border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            {/* Modal Header */}
            <div className={`flex items-center justify-between border-b pb-4 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${
                  isDark ? 'bg-teal-950/50 border-teal-800 text-teal-400' : 'bg-emerald-50 border-emerald-200 text-[#00897B]'
                }`}>
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {isBn ? 'নতুন ইউজার অ্যাকাউন্ট তৈরি করুন' : 'Create New System User Account'}
                  </h2>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {isBn ? 'সুপার এডমিন প্যানেল থেকে প্রয়োজনীয় তথ্য দিয়ে একাউন্ট তৈরি করুন' : 'Enter user details to create account'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowAddUserModal(false)}
                className={`p-1.5 rounded-full transition-all cursor-pointer ${
                  isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'
                }`}
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              <div>
                <label className={`block text-[11px] font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {isBn ? 'কর্মকর্তার পূর্ণ নাম *' : 'Full Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder={isBn ? 'যেমন: রফিকুল ইসলাম' : 'e.g. Rafiqul Islam'}
                  className={`w-full border rounded-xl py-2.5 px-3.5 outline-none font-normal transition-all ${
                    isDark
                      ? 'bg-[#121214] border-slate-700 text-white focus:border-teal-500'
                      : 'bg-slate-50/70 border-slate-200 text-slate-900 focus:bg-white focus:border-[#00897B] focus:ring-2 focus:ring-[#00897B]/15'
                  }`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className={`block text-[11px] font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {isBn ? 'ইমেইল অ্যাড্রেস *' : 'Email Address *'}
                  </label>
                  <input
                    type="email"
                    required
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="user@fourstarcargo.com"
                    className={`w-full border rounded-xl py-2.5 px-3.5 outline-none font-mono transition-all ${
                      isDark
                        ? 'bg-[#121214] border-slate-700 text-white focus:border-teal-500'
                        : 'bg-slate-50/70 border-slate-200 text-slate-900 focus:bg-white focus:border-[#00897B] focus:ring-2 focus:ring-[#00897B]/15'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-[11px] font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {isBn ? 'মোবাইল ফোন নম্বর' : 'Phone Number'}
                  </label>
                  <input
                    type="text"
                    value={newUserPhone}
                    onChange={(e) => setNewUserPhone(e.target.value)}
                    placeholder="+880 1700-000000"
                    className={`w-full border rounded-xl py-2.5 px-3.5 outline-none font-mono transition-all ${
                      isDark
                        ? 'bg-[#121214] border-slate-700 text-white focus:border-teal-500'
                        : 'bg-slate-50/70 border-slate-200 text-slate-900 focus:bg-white focus:border-[#00897B] focus:ring-2 focus:ring-[#00897B]/15'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-[11px] font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {isBn ? 'সিস্টেম রোল (System Role) *' : 'System Role *'}
                </label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                  className={`w-full border rounded-xl py-2.5 px-3.5 outline-none cursor-pointer transition-all ${
                    isDark
                      ? 'bg-[#121214] border-slate-700 text-white'
                      : 'bg-slate-50/70 border-slate-200 text-slate-900 focus:bg-white focus:border-[#00897B]'
                  }`}
                >
                  <option value="crm_executive">👥 CRM Executive (কাস্টমার রিলেশনশিপ কর্মকর্তা)</option>
                  <option value="warehouse_incharge">📦 Warehouse Incharge (ওয়্যারহাউজ কর্মকর্তা)</option>
                  <option value="operation_director">🎯 Operation Director (অপারেশন ডিরেক্টর)</option>
                  <option value="accountant">💰 Chief Accountant (চিফ একাউন্টেন্ট)</option>
                  <option value="super_admin">👑 Super Admin (সুপার এডমিন)</option>
                </select>
              </div>

              {newUserRole === 'warehouse_incharge' && (
                <div>
                  <label className={`block text-[11px] font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {isBn ? 'নির্দিষ্ট ওয়্যারহাউজ অ্যাসাইন করুন *' : 'Assign Warehouse Hub *'}
                  </label>
                  <select
                    value={newUserWhId}
                    onChange={(e) => setNewUserWhId(e.target.value)}
                    className={`w-full border rounded-xl py-2.5 px-3.5 outline-none cursor-pointer transition-all ${
                      isDark
                        ? 'bg-[#121214] border-slate-700 text-white'
                        : 'bg-slate-50/70 border-slate-200 text-slate-900 focus:bg-white focus:border-[#00897B]'
                    }`}
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className={`block text-[11px] font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {isBn ? 'এক্সেস পাসওয়ার্ড (Initial Password) *' : 'Initial Password *'}
                </label>
                <input
                  type="password"
                  required
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full border rounded-xl py-2.5 px-3.5 outline-none font-mono transition-all ${
                    isDark
                      ? 'bg-[#121214] border-slate-700 text-white focus:border-teal-500'
                      : 'bg-slate-50/70 border-slate-200 text-slate-900 focus:bg-white focus:border-[#00897B] focus:ring-2 focus:ring-[#00897B]/15'
                  }`}
                />
              </div>

              <div className={`flex justify-end space-x-3 pt-4 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className={`px-4 py-2 rounded-xl text-xs font-normal border transition-all cursor-pointer ${
                    isDark
                      ? 'bg-[#121214] border-slate-700 text-slate-300 hover:bg-slate-800'
                      : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                  }`}
                >
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-medium bg-[#00897B] hover:bg-[#00796B] text-white shadow-xs hover:shadow transition-all cursor-pointer"
                >
                  {isBn ? 'ইউজার একাউন্ট খুলুন' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. MODAL: PERMANENT USER ACCOUNT DELETE CONFIRMATION */}
      {/* ========================================================================= */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-backdrop-blur-fade">
          <div className={`w-full max-w-md rounded-2xl border p-6 space-y-4 shadow-2xl animate-modal-pop-bounce ${
            isDark ? 'bg-[#1C1C1E] border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 dark:bg-rose-950/60 dark:border-rose-800 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold">
                {isBn ? 'ইউজার অ্যাকাউন্ট স্থায়ীভাবে ডিলেট করুন' : 'Confirm Permanent User Deletion'}
              </h3>
            </div>

            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {isBn
                ? `আপনি কি নিশ্চিত যে "${userToDelete.name}" (${userToDelete.email}) অ্যাকাউন্টটি স্থায়ীভাবে মুছে ফেলতে চান? এই অ্যাকশনটি রিভার্স করা সম্ভব হবে না।`
                : `Are you sure you want to permanently delete user account "${userToDelete.name}" (${userToDelete.email})? This action cannot be undone.`}
            </p>

            <div className={`p-3 rounded-xl border text-xs space-y-1 ${
              isDark ? 'bg-[#121214] border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}>
              <div className="flex items-center justify-between">
                <span>User Name:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{userToDelete.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Role:</span>
                <span className="font-mono text-slate-900 dark:text-white">{userToDelete.role}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Assigned Hub:</span>
                <span>{userToDelete.warehouse_name || 'Central Access'}</span>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-3">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className={`px-4 py-2 rounded-xl text-xs font-normal border transition-all cursor-pointer ${
                  isDark
                    ? 'bg-[#121214] border-slate-700 text-slate-300 hover:bg-slate-800'
                    : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                }`}
              >
                {isBn ? 'বাতিল' : 'Cancel'}
              </button>

              <button
                type="button"
                onClick={handleConfirmDeleteUser}
                className="px-5 py-2 rounded-xl text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-all cursor-pointer"
              >
                {isBn ? '🗑️ নিশ্চিত ডিলেট করুন' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
