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
import {
  PathaoApiCredentials,
  getPathaoApiSettings,
  savePathaoApiSettings,
  testPathaoConnection,
} from '../lib/pathaoApi';

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
  const [activeTab, setActiveTab] = useState<'general' | 'api'>('general');
  const [isTestingPathao, setIsTestingPathao] = useState(false);

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

  // Pathao API Settings State (Defaults to Disconnected / Empty)
  const [pathaoSettings, setPathaoSettings] = useState<PathaoApiCredentials>(() => {
    return getPathaoApiSettings();
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

  // Handle Save & Test Pathao API Settings
  const handleSavePathao = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    setIsTestingPathao(true);

    const testRes = await testPathaoConnection(pathaoSettings);

    const updatedSettings: PathaoApiCredentials = {
      ...pathaoSettings,
      isConnected: testRes.success,
      lastConnectedAt: testRes.success ? new Date().toLocaleString() : pathaoSettings.lastConnectedAt,
      accessToken: testRes.accessToken || pathaoSettings.accessToken,
      enabled: testRes.success,
    };

    setPathaoSettings(updatedSettings);
    savePathaoApiSettings(updatedSettings);
    saveHostingerDbData('fsc_vps_pathao_api_settings', updatedSettings);

    logSystemAuditAction(
      currentUser,
      'TEST_PATHAO_API_SETTINGS',
      'system',
      'PATHAO_API',
      `Pathao API Connection Test: ${testRes.success ? 'SUCCESS' : 'FAILED'} (${testRes.message})`
    );

    setIsTestingPathao(false);

    if (testRes.success) {
      showToast(isBn ? '🟢 পাঠাও কুরিয়ার API সফলভাবে ভেরিফাইড ও কানেক্টেড হয়েছে!' : '🟢 Pathao API verified & connected successfully!');
    } else {
      showToast(isBn ? `🔴 কানেকশন ব্যর্থ: ${testRes.message}` : `🔴 Connection failed: ${testRes.message}`);
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
            ? 'কোম্পানির ব্র্যান্ড সেটিংস ও পাঠাও কুরিয়ার API ইন্টিগ্রেশন কাস্টমাইজ করুন'
            : 'Configure company branding, logo, and Pathao Courier API integration settings'}
        </p>
      </div>

      {/* Sub-Nav Bar (General & API Settings Tabs) */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <div className="flex space-x-2 pb-1">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`px-5 py-2 rounded-xl text-xs font-semibold flex items-center space-x-2 transition-all cursor-pointer ${
              activeTab === 'general'
                ? 'bg-[#1D4ED8] text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>{isBn ? 'সাধারণ Branding' : 'General Branding'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('api')}
            className={`px-5 py-2 rounded-xl text-xs font-semibold flex items-center space-x-2 transition-all cursor-pointer ${
              activeTab === 'api'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <Globe className="w-4 h-4 text-emerald-400" />
            <span>{isBn ? '🔌 API সেটিংস (পাঠাও কুরিয়ার)' : 'API Settings (Pathao Courier)'}</span>
          </button>
        </div>
      </div>

      {/* TAB 1: GENERAL BRANDING */}
      {activeTab === 'general' && (
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
      )}

      {/* TAB 2: PATHAO API & COURIER INTEGRATION */}
      {activeTab === 'api' && (
        <div
          className={`border rounded-2xl p-6 shadow-2xs space-y-6 ${
            isDark ? 'bg-[#1C1C1E] border-slate-800 text-white' : 'bg-white border-slate-200/90 text-slate-900'
          }`}
        >
          <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center space-x-2">
                <Globe className="w-4 h-4 text-emerald-500" />
                <span>{isBn ? 'পাঠাও কুরিয়ার API কানেকশন সেটিংস' : 'Pathao Courier API Settings'}</span>
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-normal">
                {isBn
                  ? 'সঠিক Pathao Merchant Client ID & Password দিয়ে কানেক্ট করুন। সংযোগ না থাকলে ডেমো বুকিং তৈরি হবে না।'
                  : 'Connect with verified Pathao Merchant Credentials. Demo submissions are strictly blocked when disconnected.'}
              </p>
            </div>
            {pathaoSettings.isConnected ? (
              <span className="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">
                🟢 কানেক্টেড (Pathao API Connected)
              </span>
            ) : (
              <span className="px-3 py-1 text-xs font-semibold rounded-full bg-red-500/10 text-red-600 border border-red-500/30">
                🔴 ডিসকানেক্টেড (Pathao API Disconnected)
              </span>
            )}
          </div>

          <form onSubmit={handleSavePathao} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Environment Mode */}
              <div className="space-y-1.5 col-span-1 md:col-span-2">
                <label className="text-xs text-slate-600 dark:text-slate-400 font-medium block">
                  {isBn ? 'API এনভায়রনমেন্ট মোড' : 'Environment Mode'}
                </label>
                <div className="flex items-center space-x-6 pt-1">
                  <label className="flex items-center space-x-2 cursor-pointer text-xs font-semibold">
                    <input
                      type="radio"
                      name="envMode"
                      checked={pathaoSettings.envMode === 'production'}
                      onChange={() => setPathaoSettings({ ...pathaoSettings, envMode: 'production' })}
                      className="w-4 h-4 accent-emerald-600 cursor-pointer"
                    />
                    <span className="text-emerald-600 dark:text-emerald-400">🟢 Production (লাইভ পাঠাও মার্চেন্ট অ্যাকাউন্ট)</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer text-xs font-semibold">
                    <input
                      type="radio"
                      name="envMode"
                      checked={pathaoSettings.envMode === 'sandbox'}
                      onChange={() => setPathaoSettings({ ...pathaoSettings, envMode: 'sandbox' })}
                      className="w-4 h-4 accent-amber-500 cursor-pointer"
                    />
                    <span className="text-amber-600 dark:text-amber-400">🟡 Sandbox (টেস্টিং মার্চেন্ট মোড)</span>
                  </label>
                </div>
              </div>

              {/* Pathao Client ID */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-600 dark:text-slate-400 font-medium block">
                  {isBn ? 'পাঠাও Client ID' : 'Pathao Client ID'}
                </label>
                <input
                  type="text"
                  value={pathaoSettings.clientId}
                  onChange={(e) => setPathaoSettings({ ...pathaoSettings, clientId: e.target.value })}
                  placeholder="e.g. client_abc123..."
                  className={`w-full border rounded-xl py-2.5 px-3.5 text-xs font-mono outline-none transition-all ${
                    isDark ? 'bg-[#121214] border-slate-700 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500'
                  }`}
                />
              </div>

              {/* Pathao Client Secret */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-600 dark:text-slate-400 font-medium block">
                  {isBn ? 'পাঠাও Client Secret' : 'Pathao Client Secret'}
                </label>
                <input
                  type="password"
                  value={pathaoSettings.clientSecret}
                  onChange={(e) => setPathaoSettings({ ...pathaoSettings, clientSecret: e.target.value })}
                  placeholder="••••••••••••"
                  className={`w-full border rounded-xl py-2.5 px-3.5 text-xs font-mono outline-none transition-all ${
                    isDark ? 'bg-[#121214] border-slate-700 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500'
                  }`}
                />
              </div>

              {/* Pathao Username / Email */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-600 dark:text-slate-400 font-medium block">
                  {isBn ? 'মার্চেন্ট ইমেইল / ইউজারনেম' : 'Merchant Username / Email'}
                </label>
                <input
                  type="email"
                  value={pathaoSettings.username}
                  onChange={(e) => setPathaoSettings({ ...pathaoSettings, username: e.target.value })}
                  placeholder="user@pathao.com"
                  className={`w-full border rounded-xl py-2.5 px-3.5 text-xs font-medium outline-none transition-all ${
                    isDark ? 'bg-[#121214] border-slate-700 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500'
                  }`}
                />
              </div>

              {/* Pathao Password */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-600 dark:text-slate-400 font-medium block">
                  {isBn ? 'মার্চেন্ট পাসওয়ার্ড' : 'Merchant Password'}
                </label>
                <input
                  type="password"
                  value={pathaoSettings.password}
                  onChange={(e) => setPathaoSettings({ ...pathaoSettings, password: e.target.value })}
                  placeholder="••••••••••••"
                  className={`w-full border rounded-xl py-2.5 px-3.5 text-xs font-mono outline-none transition-all ${
                    isDark ? 'bg-[#121214] border-slate-700 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500'
                  }`}
                />
              </div>

              {/* Store ID */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-600 dark:text-slate-400 font-medium block">
                  {isBn ? 'পাঠাও স্টোর আইডি (Store ID)' : 'Pathao Store ID'}
                </label>
                <input
                  type="text"
                  value={pathaoSettings.storeId}
                  onChange={(e) => setPathaoSettings({ ...pathaoSettings, storeId: e.target.value })}
                  placeholder="STORE-DAC-01"
                  className={`w-full border rounded-xl py-2.5 px-3.5 text-xs font-mono outline-none transition-all ${
                    isDark ? 'bg-[#121214] border-slate-700 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500'
                  }`}
                />
              </div>

              {/* Auto COD Toggle */}
              <div className="space-y-1.5 flex items-center justify-between pt-4">
                <div>
                  <label className="text-xs font-semibold text-slate-800 dark:text-white block">
                    {isBn ? 'অটোমেটিক COD অ্যামাউন্ট সিঙ্ক' : 'Auto Collectible COD Amount'}
                  </label>
                  <p className="text-[10px] text-slate-400 font-normal">
                    {isBn ? 'আনপেইড কার্টুনের টাকার অংক সরাসরি পাঠাও ক্যাশ অন ডেলিভারিতে যুক্ত করবে' : 'Automatically sync unpaid billable amount to Pathao COD'}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={pathaoSettings.autoSendCod}
                  onChange={(e) => setPathaoSettings({ ...pathaoSettings, autoSendCod: e.target.checked })}
                  className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                />
              </div>
            </div>

            {/* Save & Test Pathao API Button */}
            <div className="pt-3 border-t dark:border-slate-800 flex justify-end">
              <button
                type="submit"
                disabled={isTestingPathao}
                className="py-2.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <Globe className="w-4 h-4 text-white" />
                <span>
                  {isTestingPathao
                    ? (isBn ? '⏳ কানেকশন টেস্ট করা হচ্ছে...' : 'Testing Connection...')
                    : (isBn ? '⚡ টেস্ট কানেকশন & সেভ করুন' : 'Test Connection & Save')}
                </span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
