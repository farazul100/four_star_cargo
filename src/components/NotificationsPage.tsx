import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Filter, Bell, AlertTriangle, ShieldAlert, CheckCircle2, Info, Copy } from 'lucide-react';
import { Language, Theme } from '../types';
import { useAuth } from '../hooks/useAuth';
import { getHostingerDbData, saveHostingerDbData, subscribeToDbUpdates } from '../lib/db';
import { getNotificationTargetUrl } from '../utils/notificationNavigator';

interface NotificationsPageProps {
  language: Language;
  theme: Theme;
}

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time?: string;
  created_at?: string;
  isRead: boolean;
  type: 'info' | 'warning' | 'success' | 'alert';
  cid?: string;
  target_role?: string;
  target_warehouse_id?: string;
  target_user_id?: string;
}

export const NotificationsPage: React.FC<NotificationsPageProps> = ({ language, theme }) => {
  const isBn = language === 'bn';
  const isDark = theme === 'dark';
  const { user } = useAuth();
  const navigate = useNavigate();

  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [readFilter, setReadFilter] = useState<string>('all');
  const [allNotifications, setAllNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    const loadNotifs = () => {
      const data = getHostingerDbData();
      setAllNotifications(data.notifications || []);
    };
    loadNotifs();
    return subscribeToDbUpdates(loadNotifs);
  }, []);

  const markAllRead = () => {
    const updated = allNotifications.map((n) => ({ ...n, isRead: true }));
    setAllNotifications(updated);
    saveHostingerDbData('fsc_vps_notifications', updated);
  };

  const markOneRead = (id: string) => {
    const updated = allNotifications.map((n) => (n.id === id ? { ...n, isRead: true } : n));
    setAllNotifications(updated);
    saveHostingerDbData('fsc_vps_notifications', updated);
  };

  const handleNotifItemClick = (n: NotificationItem) => {
    markOneRead(n.id);
    const targetUrl = getNotificationTargetUrl(n, user?.role);
    navigate(targetUrl);
  };

  // Filter for active user role and assigned warehouse
  const roleNotifications = allNotifications.filter((n) => {
    if (!n || !n.id || (!n.title && !n.message)) return false;
    if (!user) return false;
    
    if (n.target_user_id) {
      return n.target_user_id === user.id || user.role === 'super_admin';
    }

    if (n.target_role && (n.target_role === 'all' || n.target_role === user.role || user.role === 'super_admin')) {
      if (n.target_warehouse_id) {
        return !user.warehouse_id || user.warehouse_id === n.target_warehouse_id || user.role === 'super_admin';
      }
      return true;
    }

    return false;
  });

  const filteredNotifications = roleNotifications.filter((n) => {
    if (typeFilter !== 'all' && n.type !== typeFilter) return false;
    if (readFilter === 'unread' && n.isRead) return false;
    if (readFilter === 'read' && !n.isRead) return false;
    return true;
  });

  const renderNotifIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
      case 'alert': return <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />;
      case 'success': return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
      case 'info': return <Info className="w-4 h-4 text-blue-500 shrink-0" />;
    }
  };

  const getTimeAgo = (createdAt?: string, timeStr?: string) => {
    if (timeStr) return timeStr;
    if (!createdAt) return isBn ? 'সম্প্রতি' : 'Just now';
    const diff = Date.now() - new Date(createdAt).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return isBn ? 'এইমাত্র' : 'Just now';
    if (mins < 60) return isBn ? `${mins} মিনিট আগে` : `${mins} mins ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return isBn ? `${hours} ঘণ্টা আগে` : `${hours} hours ago`;
    const days = Math.floor(hours / 24);
    return isBn ? `${days} দিন আগে` : `${days} days ago`;
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Top Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'} tracking-tight`}>
            {isBn ? 'নোটিফিকেশন ও অ্যালার্ট হাব' : 'Notifications & Alerts Hub'}
          </h1>
          <p className={`text-xs ${isDark ? 'text-[#9E9E9E]' : 'text-gray-500'} mt-1`}>
            {isBn ? 'আপনার রোল ও ওয়্যারহাউজের জন্য সকল রিয়েল-টাইম সিস্টেম অ্যালার্ট' : 'All real-time system alerts for your role & warehouse'}
          </p>
        </div>

        <button
          onClick={markAllRead}
          className={`flex items-center space-x-1.5 px-4 py-2 rounded-none text-xs font-semibold border transition-all cursor-pointer ${
            isDark
              ? 'bg-[#1C1C1E] text-white border-[#2C2C2E] hover:bg-[#2C2C2E]'
              : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-100 shadow-xs'
          }`}
        >
          <Check className="w-4 h-4 text-[#00897B]" />
          <span>{isBn ? 'সব পড়া হিসেবে চিহ্নিত করুন' : 'Mark all as read'}</span>
        </button>
      </div>

      {/* Filter Selectors Bar */}
      <div className="flex items-center space-x-3">
        {/* Type Filter */}
        <div className="relative">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className={`px-3 py-2 text-xs rounded-none border outline-none font-medium appearance-none pr-8 cursor-pointer ${
              isDark
                ? 'bg-[#1C1C1E] text-white border-[#2C2C2E] hover:border-gray-600'
                : 'bg-white text-gray-800 border-gray-300 hover:border-gray-400 shadow-xs'
            }`}
          >
            <option value="all">{isBn ? 'All Types (সকল টাইপ)' : 'All Types'}</option>
            <option value="warning">{isBn ? 'Warning (সতর্কতা)' : 'Warning'}</option>
            <option value="alert">{isBn ? 'Alert (জরুরি)' : 'Alert'}</option>
            <option value="success">{isBn ? 'Success (সফল)' : 'Success'}</option>
            <option value="info">{isBn ? 'Info (তথ্য)' : 'Info'}</option>
          </select>
          <Filter className="w-3.5 h-3.5 absolute right-2.5 top-2.5 pointer-events-none text-gray-400" />
        </div>

        {/* Read Status Filter */}
        <select
          value={readFilter}
          onChange={(e) => setReadFilter(e.target.value)}
          className={`px-3 py-2 text-xs rounded-none border outline-none font-medium cursor-pointer ${
            isDark
              ? 'bg-[#1C1C1E] text-white border-[#2C2C2E] hover:border-gray-600'
              : 'bg-white text-gray-800 border-gray-300 hover:border-gray-400 shadow-xs'
          }`}
        >
          <option value="all">{isBn ? 'All (সকল)' : 'All'}</option>
          <option value="unread">{isBn ? 'Unread (পড়া হয়নি)' : 'Unread'}</option>
          <option value="read">{isBn ? 'Read (পড়া হয়েছে)' : 'Read'}</option>
        </select>
      </div>

      {/* Notifications Card List Container */}
      <div className={`rounded-none border ${isDark ? 'bg-[#1C1C1E] border-[#2C2C2E]' : 'bg-white border-gray-200 shadow-xs'} overflow-hidden`}>
        {filteredNotifications.length === 0 ? (
          <div className="p-12 text-center">
            <Bell className={`w-10 h-10 mx-auto mb-3 ${isDark ? 'text-[#3A3A3C]' : 'text-gray-300'}`} />
            <p className={`text-sm ${isDark ? 'text-[#9E9E9E]' : 'text-gray-500'} font-medium`}>
              {isBn ? 'কোনো নোটিফিকেশন পাওয়া যায়নি' : 'No notifications found'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#2C2C2E]/60">
            {filteredNotifications.map((n) => (
              <div
                key={n.id}
                onClick={() => handleNotifItemClick(n)}
                className={`p-4 flex space-x-3.5 transition-colors cursor-pointer ${
                  !n.isRead
                    ? isDark
                      ? 'bg-[#242426]'
                      : 'bg-emerald-50/60'
                    : isDark
                    ? 'hover:bg-[#242426]/50'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="mt-0.5">{renderNotifIcon(n.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {n.title}
                    </p>
                    <div className="flex items-center space-x-2">
                      <span className={`text-[11px] ${isDark ? 'text-[#7C7C7C]' : 'text-gray-400'}`}>
                        {getTimeAgo(n.created_at, n.time)}
                      </span>
                      {!n.isRead && (
                        <span className="w-2.5 h-2.5 rounded-full bg-[#EA580C] shrink-0" />
                      )}
                    </div>
                  </div>

                  <p className={`text-xs ${isDark ? 'text-[#9E9E9E]' : 'text-gray-600'} mt-1 leading-relaxed`}>
                    {n.message}
                  </p>

                  {n.cid && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(n.cid!);
                      }}
                      className="inline-flex items-center space-x-1 mt-2 px-2 py-0.5 text-[10px] font-mono text-[#00897B] bg-[#00897B]/10 hover:bg-[#00897B]/20 rounded-none transition-colors border-0 outline-none cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{n.cid}</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
