import React, { useState } from 'react';
import { Check, Filter, Bell, AlertTriangle, ShieldAlert, CheckCircle2, Info, Copy } from 'lucide-react';
import { Language, Theme } from '../types';

interface NotificationsPageProps {
  language: Language;
  theme: Theme;
}

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  created_at: string;
  isRead: boolean;
  type: 'info' | 'warning' | 'success' | 'alert';
  cid?: string;
}

export const NotificationsPage: React.FC<NotificationsPageProps> = ({ language, theme }) => {
  const isBn = language === 'bn';
  const isDark = theme === 'dark';

  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [readFilter, setReadFilter] = useState<string>('all');

  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: 'n-1',
      title: isBn ? 'নতুন ফ্লাইং প্রস্তাবনা' : 'New Flying Proposal Submitted',
      message: isBn ? 'ঢাকা সেন্ট্রাল ওয়্যারহাউজের ইনচার্জ ১টি নতুন ফ্লাইং ফাইল পেন্ডিং অনুমোদনের জন্য জমা দিয়েছেন।' : 'Dhaka Central Warehouse Incharge submitted a new flying proposal for approval.',
      time: isBn ? '৫ মিনিট আগে' : '5 mins ago',
      created_at: '2026-08-15 00:50',
      isRead: false,
      type: 'warning',
      cid: 'CID-884920',
    },
    {
      id: 'n-2',
      title: isBn ? 'লো স্টক সর্তকতা' : 'Low Stock Warning',
      message: isBn ? 'চট্টগ্রাম হাব ইনভেন্টরিতে ৩টি কার্টুন আইটেম আউট অব স্টক হতে চলেছে।' : '3 carton inventory items in Chittagong Hub are close to out of stock.',
      time: isBn ? '২০ মিনিট আগে' : '20 mins ago',
      created_at: '2026-08-15 00:35',
      isRead: false,
      type: 'alert',
    },
    {
      id: 'n-3',
      title: isBn ? 'ক্যাশ আদায় সিঙ্ক সম্পন্ন' : 'Cash Collection Synced',
      message: isBn ? 'চট্টগ্রাম শাখা ৳৪৫,০০০ কালেকশন জমা দিয়ে সুপার এডমিন দ্বারা ভেরিফাইড হয়েছে।' : 'Chittagong branch synced ৳45,000 cash collection verified by Super Admin.',
      time: isBn ? '১ ঘণ্টা আগে' : '1 hour ago',
      created_at: '2026-08-14 23:55',
      isRead: true,
      type: 'success',
    },
    {
      id: 'n-4',
      title: isBn ? 'ফ্লাইট শিপমেন্ট আগমন' : 'Flight Shipment Arrived',
      message: isBn ? 'কার্টুন #ST-9942 সিডিজি ফ্লাইট CZ-304 সফলভাবে রিসিভ করা হয়েছে।' : 'Carton #ST-9942 on Flight CZ-304 successfully received.',
      time: isBn ? '৩ ঘণ্টা আগে' : '3 hours ago',
      created_at: '2026-08-14 21:40',
      isRead: true,
      type: 'info',
      cid: 'CID-112039',
    },
  ]);

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const markOneRead = (id: string) => {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, isRead: true } : n)));
  };

  const filteredNotifications = notifications.filter(n => {
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

  return (
    <div className="space-y-6 font-sans">
      {/* Top Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'} tracking-tight`}>
            Notifications
          </h1>
          <p className={`text-xs ${isDark ? 'text-[#9E9E9E]' : 'text-gray-500'} mt-1`}>
            {isBn ? 'গত ৩০ দিনের notifications' : 'Notifications for past 30 days'}
          </p>
        </div>

        <button
          onClick={markAllRead}
          className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
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
            className={`px-3 py-2 text-xs rounded-xl border outline-none font-medium appearance-none pr-8 cursor-pointer ${
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
          className={`px-3 py-2 text-xs rounded-xl border outline-none font-medium cursor-pointer ${
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
      <div className={`rounded-2xl border ${isDark ? 'bg-[#1C1C1E] border-[#2C2C2E]' : 'bg-white border-gray-200 shadow-xs'} overflow-hidden`}>
        {filteredNotifications.length === 0 ? (
          <div className="p-12 text-center">
            <Bell className={`w-10 h-10 mx-auto mb-3 ${isDark ? 'text-[#3A3A3C]' : 'text-gray-300'}`} />
            <p className={`text-sm ${isDark ? 'text-[#9E9E9E]' : 'text-gray-500'} font-medium`}>
              {isBn ? 'কোনো notification নেই' : 'No notifications'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#2C2C2E]/60">
            {filteredNotifications.map((n) => (
              <div
                key={n.id}
                onClick={() => markOneRead(n.id)}
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
                        {n.time}
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
                      className="inline-flex items-center space-x-1 mt-2 px-2 py-0.5 text-[10px] font-mono text-[#00897B] bg-[#00897B]/10 hover:bg-[#00897B]/20 rounded-md transition-colors border-0 outline-none cursor-pointer"
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
