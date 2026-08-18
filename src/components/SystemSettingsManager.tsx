import React, { useState } from 'react';
import {
  Settings,
  Upload,
  CheckCircle2,
  Save,
  Globe,
  Building,
} from 'lucide-react';
import { Language, User } from '../types';
import { getHostingerDbData, saveHostingerDbData, logSystemAuditAction } from '../lib/db';

interface SystemSettingsManagerProps {
  currentUser: User;
  language: Language;
  isDark?: boolean;
}

export interface GeneralSettingsData {
  companyLogoUrl: string;
  faviconUrl: string;
  logoBgColor: string;
  companyNameEn: string;
  companyNameBn: string;
  taglineEn: string;
  taglineBn: string;
  footerTextEn: string;
  footerTextBn: string;
  primaryColor: string;
  fontFamily: string;
}

const DEFAULT_GENERAL_SETTINGS: GeneralSettingsData = {
  companyLogoUrl: '',
  faviconUrl: '',
  logoBgColor: '#ffffff',
  companyNameEn: 'VENCON',
  companyNameBn: 'ভেনকন',
  taglineEn: 'Operation Management',
  taglineBn: 'অপারেশন ম্যানেজমেন্ট',
  footerTextEn: '© 2026 Vencon',
  footerTextBn: '© २०२६ ভেনকন',
  primaryColor: '#1D4ED8',
  fontFamily: 'Atkinson Hyperlegible',
};

export const SystemSettingsManager: React.FC<SystemSettingsManagerProps> = ({
  currentUser,
  language,
  isDark = false,
}) => {
  const isBn = language === 'bn';

  // General Form Settings State
  const [settings, setSettings] = useState<GeneralSettingsData>(() => {
    const saved = localStorage.getItem('fsc_vps_general_settings');
    if (saved) {
      try {
        return { ...DEFAULT_GENERAL_SETTINGS, ...JSON.parse(saved) };
      } catch (e) {}
    }
    return DEFAULT_GENERAL_SETTINGS;
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Handle Save Settings
  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    localStorage.setItem('fsc_vps_general_settings', JSON.stringify(settings));

    // Save to Hostinger DB state as well
    const dbData = getHostingerDbData();
    saveHostingerDbData('fsc_vps_settings', settings);

    // Apply primary color to CSS root variable
    document.documentElement.style.setProperty('--primary-color', settings.primaryColor);

    logSystemAuditAction(
      currentUser,
      'UPDATE_GENERAL_SETTINGS',
      'system',
      'GENERAL',
      `জেনারেল কাস্টমাইজেশন সেটিংস আপডেট করা হয়েছে (${settings.companyNameEn} / ${settings.primaryColor})`
    );

    showToast(isBn ? 'সাধারণ সেটিংস সফলভাবে সংরক্ষণ করা হয়েছে!' : 'General settings saved successfully!');
  };

  // Logo Upload Handler
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        if (uploadEvent.target?.result) {
          setSettings((prev) => ({ ...prev, companyLogoUrl: uploadEvent.target!.result as string }));
          showToast(isBn ? 'কোম্পানি লোগো সফলভাবে আপলোড হয়েছে!' : 'Company logo uploaded successfully!');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Favicon Upload Handler
  const handleFaviconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        if (uploadEvent.target?.result) {
          setSettings((prev) => ({ ...prev, faviconUrl: uploadEvent.target!.result as string }));
          showToast(isBn ? 'Favicon সফলভাবে আপলোড হয়েছে!' : 'Favicon uploaded successfully!');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#00897B] text-white px-5 py-3 rounded-xl shadow-2xl flex items-center space-x-3 text-sm font-medium animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-white" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Header Title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center space-x-2.5">
          <Settings className="w-6 h-6 text-[#1D4ED8]" />
          <span>{isBn ? 'সেটিংস' : 'Settings'}</span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {isBn
            ? 'কোম্পানির ব্র্যান্ড নাম, ট্যাগলাইন, লোগো, লোগো ব্যাকগ্রাউন্ড, ফুটার এবং থিম কালার কাস্টমাইজ করুন'
            : 'Configure company branding, logo, logo background color, tagline, footer text and system primary color'}
        </p>
      </div>

      {/* Sub-Nav Bar (General Only Active - Clean Light Styling) */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <div className="flex space-x-2 pb-1">
          <button className="px-5 py-2 rounded-xl text-xs font-semibold flex items-center space-x-2 bg-[#1D4ED8] text-white shadow-xs">
            <Settings className="w-4 h-4" />
            <span>{isBn ? 'সাধারণ' : 'General'}</span>
          </button>
        </div>
      </div>

      {/* UI Customization Card (Strictly Light Theme Clean Backgrounds) */}
      <div
        className={`border rounded-2xl p-6 shadow-2xs space-y-6 ${
          isDark ? 'bg-[#1C1C1E] border-slate-800 text-white' : 'bg-white border-slate-200/90 text-slate-900'
        }`}
      >
        <h2 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider border-b pb-3 dark:border-slate-800">
          {isBn ? 'UI কাস্টমাইজেশন' : 'UI Customization'}
        </h2>

        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Company Logo Upload (PNG/JPG) */}
            <div className="space-y-2">
              <label className="text-xs text-slate-600 dark:text-slate-400 font-medium block">
                {isBn ? 'কোম্পানি লোগো (PNG/JPG)' : 'Company Logo (PNG/JPG)'}
              </label>
              <div className="flex items-center space-x-4">
                <div
                  className={`w-16 h-16 rounded-xl border border-dashed flex items-center justify-center overflow-hidden shadow-2xs transition-colors ${
                    isDark ? 'border-slate-700' : 'border-slate-300'
                  }`}
                  style={{ backgroundColor: settings.logoBgColor || (isDark ? '#0f172a' : '#ffffff') }}
                >
                  {settings.companyLogoUrl ? (
                    <img src={settings.companyLogoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                  ) : (
                    <Building className="w-7 h-7 text-slate-400" />
                  )}
                </div>
                <label
                  className={`py-2 px-4 rounded-xl border text-xs font-semibold cursor-pointer transition-all flex items-center space-x-2 ${
                    isDark
                      ? 'bg-slate-800/90 border-slate-700 text-white hover:bg-slate-700'
                      : 'bg-[#1D4ED8] border-[#1D4ED8] text-white hover:bg-[#1e40af] shadow-xs'
                  }`}
                >
                  <Upload className="w-4 h-4 text-white" />
                  <span>{isBn ? 'আপলোড করুন' : 'Upload Logo'}</span>
                  <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                </label>
              </div>
            </div>

            {/* Favicon Upload */}
            <div className="space-y-2">
              <label className="text-xs text-slate-600 dark:text-slate-400 font-medium block">
                {isBn ? 'Favicon' : 'Favicon'}
              </label>
              <div className="flex items-center space-x-4">
                <div
                  className={`w-16 h-16 rounded-xl border border-dashed flex items-center justify-center overflow-hidden shadow-2xs ${
                    isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-300'
                  }`}
                >
                  {settings.faviconUrl ? (
                    <img src={settings.faviconUrl} alt="Favicon" className="w-full h-full object-contain p-1" />
                  ) : (
                    <Globe className="w-7 h-7 text-slate-400" />
                  )}
                </div>
                <label
                  className={`py-2 px-4 rounded-xl border text-xs font-semibold cursor-pointer transition-all flex items-center space-x-2 ${
                    isDark
                      ? 'bg-slate-800/90 border-slate-700 text-white hover:bg-slate-700'
                      : 'bg-[#1D4ED8] border-[#1D4ED8] text-white hover:bg-[#1e40af] shadow-xs'
                  }`}
                >
                  <Upload className="w-4 h-4 text-white" />
                  <span>{isBn ? 'আপলোড করুন' : 'Upload Favicon'}</span>
                  <input type="file" accept="image/*" onChange={handleFaviconUpload} className="hidden" />
                </label>
              </div>
            </div>

            {/* Logo Background Color Field */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-600 dark:text-slate-400 font-medium block">
                {isBn ? 'লোগো এর ব্যাকগ্রাউন্ড কালার' : 'Logo Background Color'}
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="color"
                  value={settings.logoBgColor || '#ffffff'}
                  onChange={(e) => setSettings({ ...settings, logoBgColor: e.target.value })}
                  className="w-10 h-10 rounded-xl cursor-pointer border border-slate-200 dark:border-slate-700 p-0.5"
                />
                <input
                  type="text"
                  value={settings.logoBgColor || '#ffffff'}
                  onChange={(e) => setSettings({ ...settings, logoBgColor: e.target.value })}
                  className={`w-full border rounded-xl py-2.5 px-3.5 text-xs font-mono font-medium outline-none transition-all ${
                    isDark ? 'bg-[#121214] border-slate-700 text-white focus:border-[#1D4ED8]' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-[#1D4ED8]'
                  }`}
                />
              </div>
            </div>

            {/* Primary Color Picker */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-600 dark:text-slate-400 font-medium block">
                {isBn ? 'প্রাইমারি কালার' : 'Primary Color'}
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="color"
                  value={settings.primaryColor}
                  onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                  className="w-10 h-10 rounded-xl cursor-pointer border border-slate-200 dark:border-slate-700 p-0.5"
                />
                <input
                  type="text"
                  value={settings.primaryColor}
                  onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                  className={`w-full border rounded-xl py-2.5 px-3.5 text-xs font-mono font-medium outline-none transition-all ${
                    isDark ? 'bg-[#121214] border-slate-700 text-white focus:border-[#1D4ED8]' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-[#1D4ED8]'
                  }`}
                />
              </div>
            </div>

            {/* Company Name (English) */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-600 dark:text-slate-400 font-medium block">
                {isBn ? 'কোম্পানির নাম (English)' : 'Company Name (English)'}
              </label>
              <input
                type="text"
                value={settings.companyNameEn}
                onChange={(e) => setSettings({ ...settings, companyNameEn: e.target.value })}
                className={`w-full border rounded-xl py-2.5 px-3.5 text-xs font-medium outline-none transition-all ${
                  isDark ? 'bg-[#121214] border-slate-700 text-white focus:border-[#1D4ED8]' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-[#1D4ED8]'
                }`}
              />
            </div>

            {/* Company Name (Bangla) */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-600 dark:text-slate-400 font-medium block">
                {isBn ? 'কোম্পানির নাম (বাংলা)' : 'Company Name (Bangla)'}
              </label>
              <input
                type="text"
                value={settings.companyNameBn}
                onChange={(e) => setSettings({ ...settings, companyNameBn: e.target.value })}
                className={`w-full border rounded-xl py-2.5 px-3.5 text-xs font-medium outline-none transition-all ${
                  isDark ? 'bg-[#121214] border-slate-700 text-white focus:border-[#1D4ED8]' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-[#1D4ED8]'
                }`}
              />
            </div>

            {/* Subtitle / Tagline (English) */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-600 dark:text-slate-400 font-medium block">
                {isBn ? 'সাবনাম / ট্যাগলাইন (English)' : 'Subtitle / Tagline (English)'}
              </label>
              <input
                type="text"
                value={settings.taglineEn}
                onChange={(e) => setSettings({ ...settings, taglineEn: e.target.value })}
                className={`w-full border rounded-xl py-2.5 px-3.5 text-xs font-medium outline-none transition-all ${
                  isDark ? 'bg-[#121214] border-slate-700 text-white focus:border-[#1D4ED8]' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-[#1D4ED8]'
                }`}
              />
            </div>

            {/* Subtitle / Tagline (Bangla) */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-600 dark:text-slate-400 font-medium block">
                {isBn ? 'সাবনাম / ট্যাগলাইন (বাংলা)' : 'Subtitle / Tagline (Bangla)'}
              </label>
              <input
                type="text"
                value={settings.taglineBn}
                onChange={(e) => setSettings({ ...settings, taglineBn: e.target.value })}
                className={`w-full border rounded-xl py-2.5 px-3.5 text-xs font-medium outline-none transition-all ${
                  isDark ? 'bg-[#121214] border-slate-700 text-white focus:border-[#1D4ED8]' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-[#1D4ED8]'
                }`}
              />
            </div>

            {/* Footer Text (English) */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-600 dark:text-slate-400 font-medium block">
                {isBn ? 'ফুটার টেক্সট (English)' : 'Footer Text (English)'}
              </label>
              <input
                type="text"
                value={settings.footerTextEn}
                onChange={(e) => setSettings({ ...settings, footerTextEn: e.target.value })}
                className={`w-full border rounded-xl py-2.5 px-3.5 text-xs font-medium outline-none transition-all ${
                  isDark ? 'bg-[#121214] border-slate-700 text-white focus:border-[#1D4ED8]' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-[#1D4ED8]'
                }`}
              />
            </div>

            {/* Footer Text (Bangla) */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-600 dark:text-slate-400 font-medium block">
                {isBn ? 'ফুটার টেক্সট (বাংলা)' : 'Footer Text (Bangla)'}
              </label>
              <input
                type="text"
                value={settings.footerTextBn}
                onChange={(e) => setSettings({ ...settings, footerTextBn: e.target.value })}
                className={`w-full border rounded-xl py-2.5 px-3.5 text-xs font-medium outline-none transition-all ${
                  isDark ? 'bg-[#121214] border-slate-700 text-white focus:border-[#1D4ED8]' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-[#1D4ED8]'
                }`}
              />
            </div>

            {/* Font Family Selector */}
            <div className="space-y-1.5 col-span-1 md:col-span-2">
              <label className="text-xs text-slate-600 dark:text-slate-400 font-medium block">
                {isBn ? 'ফন্ট' : 'Font Family'}
              </label>
              <select
                value={settings.fontFamily}
                onChange={(e) => setSettings({ ...settings, fontFamily: e.target.value })}
                className={`w-full border rounded-xl py-2.5 px-3.5 text-xs font-medium outline-none transition-all cursor-pointer ${
                  isDark ? 'bg-[#121214] border-slate-700 text-white focus:border-[#1D4ED8]' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-[#1D4ED8]'
                }`}
              >
                <option value="Atkinson Hyperlegible">Atkinson Hyperlegible</option>
                <option value="Inter">Inter</option>
                <option value="Outfit">Outfit</option>
                <option value="Roboto">Roboto</option>
                <option value="Hind Siliguri">Hind Siliguri</option>
              </select>
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-2">
            <button
              type="submit"
              className="py-2.5 px-6 rounded-xl bg-[#1D4ED8] hover:bg-[#1e40af] text-white font-bold text-xs shadow-md shadow-[#1D4ED8]/20 flex items-center space-x-2 transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isBn ? 'সংরক্ষণ' : 'Save Settings'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
