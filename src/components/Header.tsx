import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Bell, Sun, Moon, LogOut, Check, Info, AlertTriangle, CheckCircle2, ShieldAlert, MessageSquare } from 'lucide-react';
import { User, Language, Theme } from '../types';
import { LanguageSelector } from './LanguageSelector';
import { resetHostingerDbToDefault, getHostingerDbData, saveHostingerDbData, subscribeToDbUpdates, logSystemAuditAction } from '../lib/db';
import { getNotificationTargetUrl } from '../utils/notificationNavigator';

interface HeaderProps {
  currentUser: User | null;
  language: Language;
  setLanguage: (lang: Language) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  onLogout: () => void;
  toggleSidebarMobile?: () => void;
  onOpenNotifications?: () => void;
  onOpenProfile?: () => void;
  onOpenChat?: () => void;
}

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time?: string;
  created_at?: string;
  isRead: boolean;
  type: 'info' | 'warning' | 'success' | 'alert';
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  language,
  setLanguage,
  theme,
  setTheme,
  onLogout,
  toggleSidebarMobile,
  onOpenNotifications,
  onOpenProfile,
  onOpenChat,
}) => {
  const isBn = language === 'bn';
  const isDark = theme === 'dark';
  const navigate = useNavigate();

  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // System Notifications state
  const [allNotifs, setAllNotifs] = useState<any[]>([]);

  useEffect(() => {
    const loadNotifs = () => {
      const db = getHostingerDbData();
      setAllNotifs(db.notifications || []);
    };
    loadNotifs();
    return subscribeToDbUpdates(loadNotifs);
  }, []);

  // Filter notifications for active user's role and assigned warehouse
  const roleNotifs = allNotifs.filter((n) => {
    if (!n || !n.id || (!n.title && !n.message)) return false;
    if (!currentUser) return false;
    
    // If target_user_id is specified, ONLY deliver to that specific target user or super admin
    if (n.target_user_id) {
      return n.target_user_id === currentUser.id || currentUser.role === 'super_admin';
    }

    if (n.target_role && (n.target_role === 'all' || n.target_role === currentUser.role || currentUser.role === 'super_admin')) {
      if (n.target_warehouse_id) {
        return !currentUser.warehouse_id || currentUser.warehouse_id === n.target_warehouse_id || currentUser.role === 'super_admin';
      }
      return true;
    }

    return false;
  });

  const unreadCount = roleNotifs.filter((n) => !n.isRead).length;

  // Outside click listener for notification popup
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAllRead = () => {
    const updated = allNotifs.map((n) => ({ ...n, isRead: true }));
    setAllNotifs(updated);
    saveHostingerDbData('notifications', updated);
  };

  const markOneRead = (id: string) => {
    const updated = allNotifs.map((n) => (n.id === id ? { ...n, isRead: true } : n));
    setAllNotifs(updated);
    saveHostingerDbData('notifications', updated);
  };

  const handleNotifClick = (ntf: any) => {
    markOneRead(ntf.id);
    setShowNotifications(false);
    const targetUrl = getNotificationTargetUrl(ntf, currentUser?.role);
    navigate(targetUrl);
  };

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'super_admin': return { text: 'SA', bg: 'bg-[#00897B]', label: 'Super Admin' };
      case 'operation_director': return { text: 'OD', bg: 'bg-[#1E88E5]', label: 'Operation Director' };
      case 'warehouse_incharge': return { text: 'WI', bg: 'bg-[#8E24AA]', label: 'Warehouse Incharge' };
      case 'accountant': return { text: 'AC', bg: 'bg-[#F57C00]', label: 'Accountant' };
      default: return { text: 'U', bg: 'bg-gray-600', label: 'User' };
    }
  };

  const badgeConfig = getRoleBadge(currentUser?.role);

  const renderNotifIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
      case 'alert': return <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />;
      case 'success': return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
      case 'info': return <Info className="w-4 h-4 text-blue-500 shrink-0" />;
    }
  };

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Outside click listener for profile dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header
      className={`h-14 border-b flex items-center justify-between px-4 md:px-6 sticky top-0 z-50 font-sans transition-colors duration-200 ${
        isDark
          ? 'bg-[#141414] border-[#2C2C2E]/80 text-white'
          : 'bg-white border-gray-200 text-gray-900 shadow-xs'
      }`}
    >
      {/* Left Side: Hamburger Sidebar Toggle Button */}
      <div className="flex items-center space-x-3">
        <button
          onClick={toggleSidebarMobile}
          className={`p-1.5 transition-colors bg-transparent border-0 outline-none cursor-pointer ${
            isDark ? 'text-[#9E9E9E] hover:text-white' : 'text-gray-600 hover:text-gray-900'
          }`}
          title="Toggle Sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Right Side: Theme Toggle, Language Selector, User Profile Dropdown (No Standalone Logout Icon) */}
      <div className="flex items-center space-x-3.5 md:space-x-4">
        {/* Notification Bell with Popup Panel */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className={`p-1.5 transition-colors bg-transparent border-0 outline-none cursor-pointer relative ${
              isDark ? 'text-[#9E9E9E] hover:text-white' : 'text-gray-600 hover:text-gray-900'
            }`}
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span
                style={{ backgroundColor: '#DC2626', color: '#FFFFFF' }}
                className="absolute -top-1.5 -right-2 min-w-[20px] h-[20px] px-1 text-[11px] font-black leading-none flex items-center justify-center rounded-full border-2 border-white dark:border-[#141414] shadow-lg z-20 pointer-events-none select-none"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notification Popup Dropdown Panel */}
          {showNotifications && (
            <div
              className={`absolute right-0 top-10 w-80 sm:w-96 border rounded-xl shadow-2xl z-50 overflow-hidden text-left font-sans ${
                isDark ? 'bg-[#1C1C1E] border-[#2C2C2E] text-white' : 'bg-white border-gray-200 text-gray-900 shadow-xl'
              }`}
            >
              {/* Header */}
              <div
                className={`px-4 py-3 border-b flex items-center justify-between ${
                  isDark ? 'border-[#2C2C2E] bg-[#141414]' : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-sm">
                    {isBn ? 'নোটিফিকেশন' : 'Notifications'}
                  </span>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 text-[10px] font-semibold bg-[#EA580C]/20 text-[#EA580C] rounded-full">
                      {unreadCount} {isBn ? 'নতুন' : 'new'}
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="flex items-center space-x-1 text-xs text-[#00897B] hover:text-[#26A69A] font-medium bg-transparent border-0 outline-none cursor-pointer transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isBn ? 'সবগুলো পড়া হয়েছে' : 'Mark all as read'}</span>
                  </button>
                )}
              </div>

              {/* Notification List */}
              <div className={`max-h-80 overflow-y-auto divide-y ${isDark ? 'divide-[#2C2C2E]/60' : 'divide-gray-100'}`}>
                {roleNotifs.length === 0 ? (
                  <div className={`p-6 text-center text-xs ${isDark ? 'text-[#9E9E9E]' : 'text-gray-500'}`}>
                    {isBn ? 'কোনো নোটিফিকেশন নেই' : 'No notifications'}
                  </div>
                ) : (
                  roleNotifs.map((ntf) => (
                    <div
                      key={ntf.id}
                      onClick={() => handleNotifClick(ntf)}
                      className={`p-3.5 flex space-x-3 cursor-pointer transition-colors ${
                        !ntf.isRead
                          ? isDark
                            ? 'bg-[#242426]'
                            : 'bg-emerald-50/60'
                          : isDark
                          ? 'bg-transparent hover:bg-[#242426]/50'
                          : 'bg-transparent hover:bg-gray-50'
                      }`}
                    >
                      <div className="mt-0.5">{renderNotifIcon(ntf.type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={`text-xs font-bold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{ntf.title}</p>
                          <span className={`text-[10px] shrink-0 ml-2 ${isDark ? 'text-[#7C7C7C]' : 'text-gray-400'}`}>{ntf.time}</span>
                        </div>
                        <p className={`text-[11px] mt-1 leading-snug line-clamp-2 ${isDark ? 'text-[#9E9E9E]' : 'text-gray-600'}`}>
                          {ntf.message}
                        </p>
                      </div>
                      {!ntf.isRead && (
                        <div className="w-2 h-2 rounded-full bg-[#EA580C] shrink-0 mt-1" />
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className={`p-2.5 border-t text-center ${isDark ? 'border-[#2C2C2E] bg-[#141414]' : 'border-gray-200 bg-gray-50'}`}>
                <button
                  onClick={() => {
                    setShowNotifications(false);
                    if (onOpenNotifications) onOpenNotifications();
                  }}
                  className="text-xs text-[#00897B] hover:underline font-medium bg-transparent border-0 outline-none cursor-pointer"
                >
                  {isBn ? 'সব নোটিফিকেশন পেজে যান' : 'View All Notifications Page'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Theme Toggle Icon (Sun / Moon) */}
        <button
          onClick={() => {
            const nextTheme = theme === 'dark' ? 'light' : 'dark';
            setTheme(nextTheme);
          }}
          className={`p-1.5 transition-colors bg-transparent border-0 outline-none cursor-pointer ${
            isDark ? 'text-[#9E9E9E] hover:text-white' : 'text-gray-600 hover:text-gray-900'
          }`}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? (
            <Sun className="w-5 h-5 hover:text-amber-400" />
          ) : (
            <Moon className="w-5 h-5 hover:text-[#00897B]" />
          )}
        </button>

        {/* Multi-Country Language Selector */}
        <LanguageSelector onLanguageChange={(code) => setLanguage(code as Language)} />

        {/* User Profile Badge & Dropdown Menu */}
        {currentUser && (
          <div ref={profileRef} className="relative pl-1">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center space-x-2 bg-transparent border-0 outline-none cursor-pointer p-1 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              {/* Solid Colored Circle Badge */}
              <div
                translate="no"
                className={`notranslate w-8 h-8 rounded-full bg-[#00897B] text-white flex items-center justify-center font-bold text-xs shadow-xs select-none`}
              >
                {badgeConfig.text}
              </div>

              {/* User Role / Name Label */}
              <span
                translate="no"
                className={`notranslate hidden sm:block text-xs font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}
              >
                {badgeConfig.label}
              </span>
            </button>

            {/* Profile Dropdown Popup Menu (Profile & Logout) */}
            {showProfileMenu && (
              <div
                className={`absolute right-0 top-11 w-52 border rounded-2xl shadow-xl z-50 overflow-hidden text-left font-sans transition-all ${
                  isDark ? 'bg-[#1C1C1E] border-slate-700/80 text-white' : 'bg-white border-slate-200 text-gray-900 shadow-2xl'
                }`}
              >
                {/* Header Info */}
                <div className={`p-3.5 border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                  <p className="font-semibold text-xs text-slate-900 dark:text-white truncate">
                    {badgeConfig.label}
                  </p>
                  <p className="text-[11px] text-slate-400 capitalize mt-0.5 font-normal">
                    {currentUser.role?.replace('_', ' ') || 'owner'}
                  </p>
                </div>

                {/* Options List */}
                <div className="py-1">
                  {/* Option 1: Profile */}
                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      if (onOpenProfile) onOpenProfile();
                    }}
                    className={`w-full px-4 py-2.5 text-xs text-left font-medium flex items-center space-x-2.5 transition-colors cursor-pointer ${
                      isDark ? 'text-white hover:bg-slate-800/80' : 'text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <span>{isBn ? 'প্রোফাইল' : 'Profile'}</span>
                  </button>

                  {/* Option 2: Clear Demo Data */}
                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      resetHostingerDbToDefault();
                    }}
                    className={`w-full px-4 py-2.5 text-xs text-left font-medium flex items-center space-x-2.5 text-amber-600 dark:text-amber-400 transition-colors cursor-pointer ${
                      isDark ? 'hover:bg-amber-500/10' : 'hover:bg-amber-50'
                    }`}
                  >
                    <span>🧹 {isBn ? 'সব ডেমো ডাটা মুছুন' : 'Clear All Demo Data'}</span>
                  </button>

                  {/* Option 3: Logout (In Crisp Red Text) */}
                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      if (currentUser) {
                        logSystemAuditAction(
                          currentUser,
                          'USER_LOGOUT',
                          'auth',
                          currentUser.id,
                          `ইউজার ${currentUser.name} (${currentUser.email}) সিস্টেম থেকে লগআউট করেছেন।`
                        );
                      }
                      onLogout();
                    }}
                    className={`w-full px-4 py-2.5 text-xs text-left font-normal flex items-center space-x-2.5 text-red-500 hover:text-red-600 transition-colors cursor-pointer ${
                      isDark ? 'hover:bg-red-500/10' : 'hover:bg-red-50'
                    }`}
                  >
                    <span>{isBn ? 'লগআউট' : 'Logout'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
