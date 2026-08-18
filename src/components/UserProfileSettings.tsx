import React, { useState } from 'react';
import { User, Language, Theme } from '../types';
import { User as UserIcon, Globe, Volume2, Key, CheckCircle2, Camera, Shield } from 'lucide-react';
import { getHostingerDbData, saveHostingerDbData, logSystemAuditAction } from '../lib/db';

interface UserProfileSettingsProps {
  currentUser: User;
  language: Language;
  setLanguage: (lang: Language) => void;
  theme: Theme;
}

export const UserProfileSettings: React.FC<UserProfileSettingsProps> = ({
  currentUser,
  language,
  setLanguage,
  theme,
}) => {
  const isBn = language === 'bn';
  const isDark = theme === 'dark';

  // Profile Form State
  const [name, setName] = useState(currentUser.name || 'Super Admin');
  const [email, setEmail] = useState(currentUser.email || 'superadmin@vencon.com');
  const [phone, setPhone] = useState(currentUser.phone || '-');
  const [department, setDepartment] = useState(currentUser.department || '-');
  const [shift, setShift] = useState(currentUser.shift || (isBn ? 'নির্ধারিত নয়' : 'Not Assigned'));

  // Preferences State
  const [selectedLang, setSelectedLang] = useState<string>(language);
  const [notifVolume, setNotifVolume] = useState<number>(currentUser.notification_volume || 70);

  // Password State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UI Toast Message
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Avatar Badge Initials
  const getInitials = (userName: string) => {
    if (!userName) return 'SA';
    const parts = userName.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return userName.slice(0, 2).toUpperCase();
  };

  // Real-Time Instant Language Change Handler
  const handleLanguageChange = (newLangCode: string) => {
    setSelectedLang(newLangCode);

    const targetLang = newLangCode as Language;
    setLanguage(targetLang);

    // Save immediately to localStorage per user
    localStorage.setItem('fsc_lang', targetLang);
    localStorage.setItem(`fsc_user_language_${currentUser.id}`, targetLang);

    // Save to DB immediately
    const data = getHostingerDbData();
    const updatedUsers = (data.users || []).map((u) =>
      u.id === currentUser.id
        ? {
            ...u,
            default_language: targetLang,
          }
        : u
    );
    saveHostingerDbData('fsc_vps_users', updatedUsers);

    // Update active user in localStorage
    const activeUserRaw = localStorage.getItem('fsc_active_user');
    if (activeUserRaw) {
      try {
        const activeUserObj = JSON.parse(activeUserRaw);
        const updatedActiveUser = {
          ...activeUserObj,
          default_language: targetLang,
        };
        localStorage.setItem('fsc_active_user', JSON.stringify(updatedActiveUser));
      } catch (err) {}
    }

    // Trigger Google Translate engine for full page DOM translation
    const targetGtCode = newLangCode === 'cn' ? 'zh-CN' : newLangCode;
    if (newLangCode === 'en') {
      document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname}`;
      const selectElem = document.querySelector('.goog-te-combo') as HTMLSelectElement;
      if (selectElem) {
        selectElem.value = 'en';
        selectElem.dispatchEvent(new Event('change'));
      }
    } else {
      document.cookie = `googtrans=/en/${targetGtCode}; path=/;`;
      const selectElem = document.querySelector('.goog-te-combo') as HTMLSelectElement;
      if (selectElem) {
        selectElem.value = targetGtCode;
        selectElem.dispatchEvent(new Event('change'));
      }
    }

    logSystemAuditAction(
      currentUser,
      'SWITCH_DEFAULT_LANGUAGE',
      'user',
      currentUser.id,
      `ডিফল্ট ভাষা রিয়েল-টাইমে পরিবর্তন করা হয়েছে: ${targetLang.toUpperCase()}`
    );
  };

  // Save Preferences Handler
  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();

    // Set Global Language Context
    const langCode = selectedLang as Language;
    setLanguage(langCode);

    // Save Account Default Language to localStorage per user
    localStorage.setItem('fsc_lang', langCode);
    localStorage.setItem(`fsc_user_language_${currentUser.id}`, langCode);

    // Save User Data to Database
    const data = getHostingerDbData();
    const updatedUsers = (data.users || []).map((u) =>
      u.id === currentUser.id
        ? {
            ...u,
            default_language: langCode,
            notification_volume: notifVolume,
          }
        : u
    );

    saveHostingerDbData('fsc_vps_users', updatedUsers);

    // Update active user in localStorage
    const activeUserRaw = localStorage.getItem('fsc_active_user');
    if (activeUserRaw) {
      try {
        const activeUserObj = JSON.parse(activeUserRaw);
        const updatedActiveUser = {
          ...activeUserObj,
          default_language: langCode,
          notification_volume: notifVolume,
        };
        localStorage.setItem('fsc_active_user', JSON.stringify(updatedActiveUser));
      } catch (err) {}
    }

    logSystemAuditAction(
      currentUser,
      'UPDATE_PROFILE_PREFERENCES',
      'user',
      currentUser.id,
      `ডিফল্ট ভাষা ও নোটিফিকেশন ভলিউম আপডেট করা হয়েছে (${langCode.toUpperCase()}, Volume: ${notifVolume}%)`
    );

    showToast(
      isBn
        ? 'পছন্দসমূহ ও অ্যাকাউন্ট ডিফল্ট ভাষা সফলভাবে সংরক্ষিত হয়েছে!'
        : 'Preferences & Account Default Language saved successfully!'
    );
  };

  // Change Password Handler
  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword || newPassword.length < 4) {
      showToast(
        isBn ? 'পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে!' : 'Password must be at least 4 characters long!',
        'error'
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast(isBn ? 'পাসওয়ার্ড দুটি মিলছে না!' : 'Passwords do not match!', 'error');
      return;
    }

    logSystemAuditAction(
      currentUser,
      'CHANGE_PASSWORD',
      'user',
      currentUser.id,
      `ইউজার পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে`
    );

    setNewPassword('');
    setConfirmPassword('');
    showToast(isBn ? 'পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে!' : 'Password updated successfully!');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 font-sans">
      {/* Page Title */}
      <div className="flex items-center space-x-2 border-b pb-3 border-slate-200/80 dark:border-slate-800/80">
        <UserIcon className="w-5 h-5 text-[#EA580C]" />
        <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
          {isBn ? 'প্রোফাইল ও সেটিংস' : 'Profile & Settings'}
        </h2>
      </div>

      {toastMsg && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center space-x-2 shadow-xs ${
            toastMsg.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
              : 'bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* CARD 1: PROFILE INFORMATION */}
      <div
        className={`border rounded-2xl p-6 shadow-2xs transition-all ${
          isDark ? 'bg-[#1C1C1E] border-slate-800 text-white' : 'bg-white border-slate-200/90 text-slate-900'
        }`}
      >
        <h3 className="text-xs font-bold text-slate-800 dark:text-white mb-5 uppercase tracking-wide">
          {isBn ? 'প্রোফাইল তথ্য' : 'Profile Information'}
        </h3>

        <div className="flex flex-col md:flex-row items-center md:items-start space-y-6 md:space-y-0 md:space-x-10">
          {/* Left Avatar Section */}
          <div className="flex flex-col items-center space-y-2 shrink-0">
            <div className="relative group cursor-pointer">
              <div className="w-24 h-24 rounded-full bg-[#FFEEDD] dark:bg-slate-800 border border-orange-200 dark:border-slate-700 text-[#EA580C] dark:text-orange-400 flex items-center justify-center font-bold text-2xl shadow-sm">
                {getInitials(currentUser.name)}
              </div>
              <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                <Camera className="w-6 h-6" />
              </div>
            </div>
            <button className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-transparent border-0 outline-none cursor-pointer">
              {isBn ? 'ছবি পরিবর্তন করতে ক্লিক করুন' : 'Click to change photo'}
            </button>
          </div>

          {/* Right Details Grid */}
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-5 text-xs">
            <div>
              <span className="text-[#8FA3AD] block mb-1 font-normal">
                {isBn ? 'নাম' : 'Name'}
              </span>
              <p className="font-semibold text-slate-900 dark:text-white text-sm">
                {currentUser.name || 'Super Admin'}
              </p>
            </div>

            <div>
              <span className="text-[#8FA3AD] block mb-1 font-normal">
                {isBn ? 'ইমেইল' : 'Email'}
              </span>
              <p className="font-medium text-slate-800 dark:text-slate-200 font-mono">
                {currentUser.email || 'superadmin@vencon.com'}
              </p>
            </div>

            <div>
              <span className="text-[#8FA3AD] block mb-1 font-normal">
                {isBn ? 'ফোন' : 'Phone'}
              </span>
              <p className="font-medium text-slate-800 dark:text-slate-200 font-mono">
                {phone}
              </p>
            </div>

            <div>
              <span className="text-[#8FA3AD] block mb-1 font-normal">
                {isBn ? 'পদবি' : 'Role / Designation'}
              </span>
              <p className="font-semibold text-slate-900 dark:text-white capitalize">
                {currentUser.role?.replace('_', ' ') || 'owner'}
              </p>
            </div>

            <div>
              <span className="text-[#8FA3AD] block mb-1 font-normal">
                {isBn ? 'বিভাগ' : 'Department'}
              </span>
              <p className="font-medium text-slate-800 dark:text-slate-200">
                {department}
              </p>
            </div>

            <div>
              <span className="text-[#8FA3AD] block mb-1 font-normal">
                {isBn ? 'শিফট' : 'Shift'}
              </span>
              <p className="font-semibold text-slate-900 dark:text-white">
                {shift}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CARD 2: PREFERENCES & MULTI-LANGUAGE SETTINGS */}
      <div
        className={`border rounded-2xl p-6 shadow-2xs transition-all ${
          isDark ? 'bg-[#1C1C1E] border-slate-800 text-white' : 'bg-white border-slate-200/90 text-slate-900'
        }`}
      >
        <h3 className="text-xs font-bold text-slate-800 dark:text-white mb-5 uppercase tracking-wide">
          {isBn ? 'পছন্দসমূহ' : 'Preferences'}
        </h3>

        <form onSubmit={handleSavePreferences} className="space-y-6 max-w-lg">
          {/* Language Selection */}
          <div className="space-y-1.5">
            <label className="text-xs text-[#8FA3AD] block font-normal">
              {isBn ? 'ভাষা (ডিফল্ট সিস্টেম ভাষা)' : 'Language (Default System Language)'}
            </label>
            <div className="relative flex items-center">
              <Globe className="w-4 h-4 absolute left-3 text-slate-400" />
              <select
                value={selectedLang}
                onChange={(e) => handleLanguageChange(e.target.value)}
                className={`w-full border rounded-xl py-2 pl-9 pr-8 text-xs font-normal outline-none appearance-none cursor-pointer ${
                  isDark
                    ? 'bg-[#121214] border-slate-700 text-white'
                    : 'bg-slate-50/80 border-slate-200 text-slate-900'
                }`}
              >
                <option value="en">English (US)</option>
                <option value="bn">বাংলা (Bangla)</option>
                <option value="cn">中文 (Chinese)</option>
                <option value="ar">العربية (Arabic)</option>
                <option value="hi">हिन्दी (Hindi)</option>
                <option value="ur">اردو (Urdu)</option>
              </select>
            </div>
            <p className="text-[10px] text-slate-400 font-normal">
              {isBn
                ? '* এখানে যে ভাষা সিলেক্ট করবেন, সিস্টেম পরবর্তীতে সেই ভাষাতেই অটোমেটিক চলবে।'
                : '* System will run automatically in the default language selected here.'}
            </p>
          </div>

          {/* Notification Volume Slider */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs font-normal text-slate-700 dark:text-slate-300">
              <span className="flex items-center space-x-2">
                <Volume2 className="w-4 h-4 text-[#EA580C]" />
                <span>{isBn ? 'নোটিফিকেশন ভলিউম' : 'Notification Volume'}</span>
              </span>
              <span className="font-mono font-bold text-xs px-2.5 py-0.5 rounded-md bg-orange-500/10 text-[#EA580C] border border-orange-500/20">
                {notifVolume}%
              </span>
            </div>
            <div className="relative flex items-center">
              <input
                type="range"
                min="0"
                max="100"
                value={notifVolume}
                onChange={(e) => setNotifVolume(Number(e.target.value))}
                style={{
                  background: `linear-gradient(to right, #EA580C 0%, #EA580C ${notifVolume}%, ${
                    isDark ? '#334155' : '#CBD5E1'
                  } ${notifVolume}%, ${isDark ? '#334155' : '#CBD5E1'} 100%)`,
                }}
                className="w-full h-3 rounded-full appearance-none cursor-pointer border border-slate-300 dark:border-slate-700 outline-none accent-[#EA580C] shadow-inner"
              />
            </div>
          </div>

          {/* Save Preferences Button */}
          <div className="pt-2">
            <button
              type="submit"
              className="py-2.5 px-6 rounded-xl bg-[#EA580C] hover:bg-[#D94E07] text-white font-bold text-xs shadow-md shadow-[#EA580C]/20 transition-all cursor-pointer"
            >
              {isBn ? 'সংরক্ষণ করুন' : 'Save Preferences'}
            </button>
          </div>
        </form>
      </div>

      {/* CARD 3: CHANGE PASSWORD */}
      <div
        className={`border rounded-2xl p-6 shadow-2xs transition-all ${
          isDark ? 'bg-[#1C1C1E] border-slate-800 text-white' : 'bg-white border-slate-200/90 text-slate-900'
        }`}
      >
        <h3 className="text-xs font-bold text-slate-800 dark:text-white mb-5 uppercase tracking-wide">
          {isBn ? 'পাসওয়ার্ড পরিবর্তন' : 'Change Password'}
        </h3>

        <form onSubmit={handlePasswordChange} className="space-y-4 max-w-sm">
          <div>
            <label className="text-xs text-[#8FA3AD] block mb-1 font-normal">
              {isBn ? 'নতুন পাসওয়ার্ড' : 'New Password'}
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className={`w-full border rounded-xl py-2 px-3 text-xs outline-none ${
                isDark ? 'bg-[#121214] border-slate-700 text-white' : 'bg-slate-50/80 border-slate-200 text-slate-900'
              }`}
            />
          </div>

          <div>
            <label className="text-xs text-[#8FA3AD] block mb-1 font-normal">
              {isBn ? 'পাসওয়ার্ড নিশ্চিত করুন' : 'Confirm Password'}
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className={`w-full border rounded-xl py-2 px-3 text-xs outline-none ${
                isDark ? 'bg-[#121214] border-slate-700 text-white' : 'bg-slate-50/80 border-slate-200 text-slate-900'
              }`}
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className={`py-2 px-5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800'
              }`}
            >
              {isBn ? 'পাসওয়ার্ড পরিবর্তন করুন' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
