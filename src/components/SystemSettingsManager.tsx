import React, { useState } from 'react';
import {
  Settings,
  Upload,
  CheckCircle2,
  Save,
  Globe,
  Building,
  AlertTriangle,
  RotateCcw,
  ShieldAlert,
  Trash2,
  X,
  Lock,
} from 'lucide-react';
import { Language, User } from '../types';
import { getHostingerDbData, saveHostingerDbData, logSystemAuditAction, performFactorySystemReset } from '../lib/db';
import {
  PathaoApiCredentials,
  getPathaoApiSettings,
  savePathaoApiSettings,
  testPathaoConnection,
} from '../lib/pathaoApi';
import { compressImageFile } from '../utils/imageCompressor';
import { testGeminiApiKey } from '../services/aiAssistantService';

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

export interface BudgetSettingsData {
  airFreightRatePerKg: number;
  customsDutyRatePerKg: number;
  warehouseRentTarget: number;
  staffSalaryTarget: number;
  packingTransportTarget: number;
  utilitiesTarget: number;
  otherAdminTarget: number;
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

const DEFAULT_BUDGET_SETTINGS: BudgetSettingsData = {
  airFreightRatePerKg: 850,
  customsDutyRatePerKg: 140,
  warehouseRentTarget: 250000,
  staffSalaryTarget: 320000,
  packingTransportTarget: 85000,
  utilitiesTarget: 45000,
  otherAdminTarget: 35000,
};

export const SystemSettingsManager: React.FC<SystemSettingsManagerProps> = ({
  currentUser,
  language,
  isDark = false,
}) => {
  const isBn = language === 'bn';
  const [activeTab, setActiveTab] = useState<'general' | 'api' | 'budget_rates' | 'danger_zone'>('general');
  const [isTestingPathao, setIsTestingPathao] = useState(false);

  // Danger Zone Factory Reset State
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [resetConfirmInput, setResetConfirmInput] = useState<string>('');
  const [isResetting, setIsResetting] = useState<boolean>(false);

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

  // Budget & Rates Settings State
  const [budgetSettings, setBudgetSettings] = useState<BudgetSettingsData>(() => {
    const saved = localStorage.getItem('fsc_vps_budget_settings');
    if (saved) {
      try {
        return { ...DEFAULT_BUDGET_SETTINGS, ...JSON.parse(saved) };
      } catch (e) {}
    }
    return DEFAULT_BUDGET_SETTINGS;
  });

  // Pathao API Settings State (Defaults to Disconnected / Empty)
  const [pathaoSettings, setPathaoSettings] = useState<PathaoApiCredentials>(() => {
    return getPathaoApiSettings();
  });

  // Google Gemini AI Studio API Key State
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => {
    const db = getHostingerDbData() as any;
    return db.settings?.gemini_api_key || localStorage.getItem('fsc_gemini_api_key') || '';
  });
  const [testingGeminiKey, setTestingGeminiKey] = useState<boolean>(false);
  const [geminiTestResult, setGeminiTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Handle Save General Settings
  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    localStorage.setItem('fsc_vps_general_settings', JSON.stringify(settings));

    // Save to Hostinger DB state as well
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

  // Handle Save Budget & Rates Settings
  const handleSaveBudgetSettings = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('fsc_vps_budget_settings', JSON.stringify(budgetSettings));
    saveHostingerDbData('fsc_vps_budget_settings', budgetSettings);

    logSystemAuditAction(
      currentUser,
      'UPDATE_BUDGET_RATE_SETTINGS',
      'system',
      'BUDGET_SETTINGS',
      `বাজেট ও ফ্রেইট রেট সেটিংস আপডেট করা হয়েছে (Freight: ৳${budgetSettings.airFreightRatePerKg}/kg, Customs: ৳${budgetSettings.customsDutyRatePerKg}/kg)`
    );

    showToast(isBn ? '💰 বাজেট ও ফ্রেইট রেট সেটিংস সফলভাবে আপডেট করা হয়েছে!' : '💰 Budget & Freight Rate settings saved successfully!');
  };

  // Logo Upload Handler
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const compressedBase64 = await compressImageFile(e.target.files[0], { maxWidth: 400, maxHeight: 400, quality: 0.8 });
        setSettings((prev) => ({ ...prev, companyLogoUrl: compressedBase64 }));
        showToast(isBn ? 'কোম্পানি লোগো সফলভাবে অটো-কমপ্রেস হয়ে আপলোড হয়েছে!' : 'Company logo compressed & uploaded successfully!');
      } catch (err) {
        showToast(isBn ? 'লোগো ফাইল প্রক্রিয়াকরণে সমস্যা হয়েছে' : 'Failed to process logo image');
      }
    }
  };

  // Favicon Upload Handler
  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const compressedBase64 = await compressImageFile(e.target.files[0], { maxWidth: 128, maxHeight: 128, quality: 0.8 });
        setSettings((prev) => ({ ...prev, faviconUrl: compressedBase64 }));
        showToast(isBn ? 'Favicon সফলভাবে অটো-কমপ্রেস হয়ে আপলোড হয়েছে!' : 'Favicon compressed & uploaded successfully!');
      } catch (err) {
        showToast(isBn ? 'Favicon ফাইল প্রক্রিয়াকরণে সমস্যা হয়েছে' : 'Failed to process favicon image');
      }
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
    <div className="space-y-6 max-w-5xl mx-auto font-sans font-light">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#00897B] text-white px-5 py-3 rounded-none shadow-2xl flex items-center space-x-3 text-xs font-light">
          <CheckCircle2 className="w-4 h-4 text-white" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Header Title */}
      <div>
        <h1 className="text-xl md:text-2xl font-normal text-slate-900 dark:text-white flex items-center space-x-2.5">
          <Settings className="w-5 h-5 text-[#1D4ED8]" />
          <span>{isBn ? 'সেটিংস (Settings)' : 'System Settings'}</span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-light">
          {isBn
            ? 'কোম্পানির ব্র্যান্ড সেটিংস, ফ্রেইট চার্জ রেট ও পাঠাও কুরিয়ার API ইন্টিগ্রেশন কাস্টমাইজ করুন'
            : 'Configure company branding, freight rates, and Pathao Courier API integration settings'}
        </p>
      </div>

      {/* Sub-Nav Bar (General, API & Budget Settings Tabs - rounded-none & font-light) */}
      <div className="border-b border-slate-200 dark:border-slate-700">
        <div className="flex flex-wrap gap-2 pb-1">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`px-4 py-2 rounded-none text-xs font-light flex items-center space-x-2 transition-all cursor-pointer ${
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
            className={`px-4 py-2 rounded-none text-xs font-light flex items-center space-x-2 transition-all cursor-pointer ${
              activeTab === 'api'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <Globe className="w-4 h-4 text-emerald-400" />
            <span>{isBn ? '🔌 API সেটিংস (পাঠাও কুরিয়ার)' : 'API Settings (Pathao Courier)'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('budget_rates')}
            className={`px-4 py-2 rounded-none text-xs font-light flex items-center space-x-2 transition-all cursor-pointer ${
              activeTab === 'budget_rates'
                ? 'bg-[#00897B] text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <Building className="w-4 h-4 text-teal-300" />
            <span>{isBn ? '💰 বাজেট ও ফ্রেইট রেট সেটিংস' : 'Budget & Rate Settings'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('danger_zone')}
            className={`px-4 py-2 rounded-none text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer ${
              activeTab === 'danger_zone'
                ? 'bg-rose-700 text-white shadow-xs'
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 border border-rose-500/20'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-rose-500" />
            <span>{isBn ? '🚨 ডেঞ্জার জোন (ফ্যাক্টরি রিসেট)' : '🚨 Danger Zone (Factory Reset)'}</span>
          </button>
        </div>
      </div>

      {/* TAB 1: GENERAL BRANDING */}
      {activeTab === 'general' && (
        <div
          className={`border rounded-none p-6 space-y-6 shadow-sm ${
            isDark ? 'bg-[#1E293B] border-[#1E3247] text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}
        >
          <h2 className="text-xs font-normal text-slate-800 dark:text-white uppercase tracking-wider border-b pb-3 dark:border-[#1E3247]">
            {isBn ? 'UI কাস্টমাইজেশন' : 'UI Customization'}
          </h2>

          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Company Logo Upload (PNG/JPG) */}
              <div className="space-y-2">
                <label className="text-xs text-slate-600 dark:text-slate-400 font-light block">
                  {isBn ? 'কোম্পানি লোগো (PNG/JPG)' : 'Company Logo (PNG/JPG)'}
                </label>
                <div className="flex items-center space-x-4">
                  <div
                    className={`w-16 h-16 rounded-none border border-dashed flex items-center justify-center overflow-hidden transition-colors ${
                      isDark ? 'border-[#1E3247]' : 'border-slate-300'
                    }`}
                    style={{ backgroundColor: settings.logoBgColor || (isDark ? '#0b1622' : '#ffffff') }}
                  >
                    {settings.companyLogoUrl ? (
                      <img src={settings.companyLogoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                    ) : (
                      <Building className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <label
                    className={`py-2 px-4 rounded-none border text-xs font-light cursor-pointer transition-all flex items-center space-x-2 ${
                      isDark
                        ? 'bg-[#0B1622] border-[#1E3247] text-white hover:bg-[#1E3247]'
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
                <label className="text-xs text-slate-600 dark:text-slate-400 font-light block">
                  {isBn ? 'Favicon' : 'Favicon'}
                </label>
                <div className="flex items-center space-x-4">
                  <div
                    className={`w-16 h-16 rounded-none border border-dashed flex items-center justify-center overflow-hidden ${
                      isDark ? 'bg-[#0B1622] border-[#1E3247]' : 'bg-slate-50 border-slate-300'
                    }`}
                  >
                    {settings.faviconUrl ? (
                      <img src={settings.faviconUrl} alt="Favicon" className="w-full h-full object-contain p-1" />
                    ) : (
                      <Globe className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <label
                    className={`py-2 px-4 rounded-none border text-xs font-light cursor-pointer transition-all flex items-center space-x-2 ${
                      isDark
                        ? 'bg-[#0B1622] border-[#1E3247] text-white hover:bg-[#1E3247]'
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
                <label className="text-xs text-slate-600 dark:text-slate-400 font-light block">
                  {isBn ? 'লোগো এর ব্যাকগ্রাউন্ড কালার' : 'Logo Background Color'}
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="color"
                    value={settings.logoBgColor || '#ffffff'}
                    onChange={(e) => setSettings({ ...settings, logoBgColor: e.target.value })}
                    className="w-10 h-10 rounded-none cursor-pointer border border-slate-300 dark:border-[#1E3247] p-0.5"
                  />
                  <input
                    type="text"
                    value={settings.logoBgColor || '#ffffff'}
                    onChange={(e) => setSettings({ ...settings, logoBgColor: e.target.value })}
                    className={`w-full border rounded-none py-2.5 px-3.5 text-xs font-mono font-light outline-none transition-all ${
                      isDark ? 'bg-[#0B1622] border-[#1E3247] text-white focus:border-[#1D4ED8]' : 'bg-white border-slate-300 text-slate-900 focus:border-[#1D4ED8]'
                    }`}
                  />
                </div>
              </div>

              {/* Primary Color Picker */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-600 dark:text-slate-400 font-light block">
                  {isBn ? 'প্রাইমারি কালার' : 'Primary Color'}
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="color"
                    value={settings.primaryColor}
                    onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                    className="w-10 h-10 rounded-none cursor-pointer border border-slate-300 dark:border-[#1E3247] p-0.5"
                  />
                  <input
                    type="text"
                    value={settings.primaryColor}
                    onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                    className={`w-full border rounded-none py-2.5 px-3.5 text-xs font-mono font-light outline-none transition-all ${
                      isDark ? 'bg-[#0B1622] border-[#1E3247] text-white focus:border-[#1D4ED8]' : 'bg-white border-slate-300 text-slate-900 focus:border-[#1D4ED8]'
                    }`}
                  />
                </div>
              </div>

              {/* Company Name (English) */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-600 dark:text-slate-400 font-light block">
                  {isBn ? 'কোম্পানির নাম (English)' : 'Company Name (English)'}
                </label>
                <input
                  type="text"
                  value={settings.companyNameEn}
                  onChange={(e) => setSettings({ ...settings, companyNameEn: e.target.value })}
                  className={`w-full border rounded-none py-2.5 px-3.5 text-xs font-light outline-none transition-all ${
                    isDark ? 'bg-[#0B1622] border-[#1E3247] text-white focus:border-[#1D4ED8]' : 'bg-white border-slate-300 text-slate-900 focus:border-[#1D4ED8]'
                  }`}
                />
              </div>

              {/* Company Name (Bangla) */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-600 dark:text-slate-400 font-light block">
                  {isBn ? 'কোম্পানির নাম (বাংলা)' : 'Company Name (Bangla)'}
                </label>
                <input
                  type="text"
                  value={settings.companyNameBn}
                  onChange={(e) => setSettings({ ...settings, companyNameBn: e.target.value })}
                  className={`w-full border rounded-none py-2.5 px-3.5 text-xs font-light outline-none transition-all ${
                    isDark ? 'bg-[#0B1622] border-[#1E3247] text-white focus:border-[#1D4ED8]' : 'bg-white border-slate-300 text-slate-900 focus:border-[#1D4ED8]'
                  }`}
                />
              </div>

              {/* Subtitle / Tagline (English) */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-600 dark:text-slate-400 font-light block">
                  {isBn ? 'সাবনাম / ট্যাগলাইন (English)' : 'Subtitle / Tagline (English)'}
                </label>
                <input
                  type="text"
                  value={settings.taglineEn}
                  onChange={(e) => setSettings({ ...settings, taglineEn: e.target.value })}
                  className={`w-full border rounded-none py-2.5 px-3.5 text-xs font-light outline-none transition-all ${
                    isDark ? 'bg-[#0B1622] border-[#1E3247] text-white focus:border-[#1D4ED8]' : 'bg-white border-slate-300 text-slate-900 focus:border-[#1D4ED8]'
                  }`}
                />
              </div>

              {/* Subtitle / Tagline (Bangla) */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-600 dark:text-slate-400 font-light block">
                  {isBn ? 'সাবনাম / ট্যাগলাইন (বাংলা)' : 'Subtitle / Tagline (Bangla)'}
                </label>
                <input
                  type="text"
                  value={settings.taglineBn}
                  onChange={(e) => setSettings({ ...settings, taglineBn: e.target.value })}
                  className={`w-full border rounded-none py-2.5 px-3.5 text-xs font-light outline-none transition-all ${
                    isDark ? 'bg-[#0B1622] border-[#1E3247] text-white focus:border-[#1D4ED8]' : 'bg-white border-slate-300 text-slate-900 focus:border-[#1D4ED8]'
                  }`}
                />
              </div>

              {/* Footer Text (English) */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-600 dark:text-slate-400 font-light block">
                  {isBn ? 'ফুটার টেক্সট (English)' : 'Footer Text (English)'}
                </label>
                <input
                  type="text"
                  value={settings.footerTextEn}
                  onChange={(e) => setSettings({ ...settings, footerTextEn: e.target.value })}
                  className={`w-full border rounded-none py-2.5 px-3.5 text-xs font-light outline-none transition-all ${
                    isDark ? 'bg-[#0B1622] border-[#1E3247] text-white focus:border-[#1D4ED8]' : 'bg-white border-slate-300 text-slate-900 focus:border-[#1D4ED8]'
                  }`}
                />
              </div>

              {/* Footer Text (Bangla) */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-600 dark:text-slate-400 font-light block">
                  {isBn ? 'ফুটার টেক্সট (বাংলা)' : 'Footer Text (Bangla)'}
                </label>
                <input
                  type="text"
                  value={settings.footerTextBn}
                  onChange={(e) => setSettings({ ...settings, footerTextBn: e.target.value })}
                  className={`w-full border rounded-none py-2.5 px-3.5 text-xs font-light outline-none transition-all ${
                    isDark ? 'bg-[#0B1622] border-[#1E3247] text-white focus:border-[#1D4ED8]' : 'bg-white border-slate-300 text-slate-900 focus:border-[#1D4ED8]'
                  }`}
                />
              </div>

              {/* Font Family Selector */}
              <div className="space-y-1.5 col-span-1 md:col-span-2">
                <label className="text-xs text-slate-600 dark:text-slate-400 font-light block">
                  {isBn ? 'ফন্ট স্টাইল' : 'Font Family'}
                </label>
                <select
                  value={settings.fontFamily}
                  onChange={(e) => setSettings({ ...settings, fontFamily: e.target.value })}
                  className={`w-full border rounded-none py-2.5 px-3.5 text-xs font-light outline-none transition-all cursor-pointer ${
                    isDark ? 'bg-[#0B1622] border-[#1E3247] text-white focus:border-[#1D4ED8]' : 'bg-white border-slate-300 text-slate-900 focus:border-[#1D4ED8]'
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
                className="py-2.5 px-6 rounded-none bg-[#1D4ED8] hover:bg-[#1e40af] text-white font-light text-xs shadow-xs flex items-center space-x-2 transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isBn ? 'সেটিংস সংরক্ষণ করুন' : 'Save Settings'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: PATHAO API & COURIER INTEGRATION */}
      {activeTab === 'api' && (
        <div
          className={`border rounded-none p-6 space-y-6 shadow-sm ${
            isDark ? 'bg-[#1E293B] border-[#1E3247] text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}
        >
          <div className="flex items-center justify-between border-b pb-3 dark:border-[#1E3247]">
            <div>
              <h2 className="text-xs font-normal text-slate-800 dark:text-white uppercase tracking-wider flex items-center space-x-2">
                <Globe className="w-4 h-4 text-emerald-500" />
                <span>{isBn ? 'পাঠাও কুরিয়ার API কানেকশন সেটিংস' : 'Pathao Courier API Settings'}</span>
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-light">
                {isBn
                  ? 'সঠিক Pathao Merchant Client ID & Password দিয়ে কানেক্ট করুন। সংযোগ না থাকলে ডেমো বুকিং তৈরি হবে না।'
                  : 'Connect with verified Pathao Merchant Credentials.'}
              </p>
            </div>
            {pathaoSettings.isConnected ? (
              <span className="px-3 py-1 text-xs font-light rounded-none bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">
                🟢 কানেক্টেড (Pathao API Connected)
              </span>
            ) : (
              <span className="px-3 py-1 text-xs font-light rounded-none bg-red-500/10 text-red-600 border border-red-500/30">
                🔴 ডিসকানেক্টেড (Pathao API Disconnected)
              </span>
            )}
          </div>

          <form onSubmit={handleSavePathao} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Environment Mode */}
              <div className="space-y-1.5 col-span-1 md:col-span-2">
                <label className="text-xs text-slate-600 dark:text-slate-400 font-light block">
                  {isBn ? 'API এনভায়রনমেন্ট মোড' : 'Environment Mode'}
                </label>
                <div className="flex items-center space-x-6 pt-1">
                  <label className="flex items-center space-x-2 cursor-pointer text-xs font-light">
                    <input
                      type="radio"
                      name="envMode"
                      checked={pathaoSettings.envMode === 'production'}
                      onChange={() => setPathaoSettings({ ...pathaoSettings, envMode: 'production' })}
                      className="w-4 h-4 accent-emerald-600 cursor-pointer"
                    />
                    <span className="text-emerald-600 dark:text-emerald-400">🟢 Production (লাইভ পাঠাও মার্চেন্ট অ্যাকাউন্ট)</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer text-xs font-light">
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
                <label className="text-xs text-slate-600 dark:text-slate-400 font-light block">
                  {isBn ? 'পাঠাও Client ID' : 'Pathao Client ID'}
                </label>
                <input
                  type="text"
                  value={pathaoSettings.clientId}
                  onChange={(e) => setPathaoSettings({ ...pathaoSettings, clientId: e.target.value })}
                  placeholder="e.g. client_abc123..."
                  className={`w-full border rounded-none py-2.5 px-3.5 text-xs font-mono font-light outline-none transition-all ${
                    isDark ? 'bg-[#0B1622] border-[#1E3247] text-white focus:border-emerald-500' : 'bg-white border-slate-300 text-slate-900 focus:border-emerald-500'
                  }`}
                />
              </div>

              {/* Pathao Client Secret */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-600 dark:text-slate-400 font-light block">
                  {isBn ? 'পাঠাও Client Secret' : 'Pathao Client Secret'}
                </label>
                <input
                  type="password"
                  value={pathaoSettings.clientSecret}
                  onChange={(e) => setPathaoSettings({ ...pathaoSettings, clientSecret: e.target.value })}
                  placeholder="••••••••••••"
                  className={`w-full border rounded-none py-2.5 px-3.5 text-xs font-mono font-light outline-none transition-all ${
                    isDark ? 'bg-[#0B1622] border-[#1E3247] text-white focus:border-emerald-500' : 'bg-white border-slate-300 text-slate-900 focus:border-emerald-500'
                  }`}
                />
              </div>

              {/* Pathao Username / Email */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-600 dark:text-slate-400 font-light block">
                  {isBn ? 'মার্চেন্ট ইমেইল / ইউজারনেম' : 'Merchant Username / Email'}
                </label>
                <input
                  type="email"
                  value={pathaoSettings.username}
                  onChange={(e) => setPathaoSettings({ ...pathaoSettings, username: e.target.value })}
                  placeholder="user@pathao.com"
                  className={`w-full border rounded-none py-2.5 px-3.5 text-xs font-light outline-none transition-all ${
                    isDark ? 'bg-[#0B1622] border-[#1E3247] text-white focus:border-emerald-500' : 'bg-white border-slate-300 text-slate-900 focus:border-emerald-500'
                  }`}
                />
              </div>

              {/* Pathao Password */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-600 dark:text-slate-400 font-light block">
                  {isBn ? 'মার্চেন্ট পাসওয়ার্ড' : 'Merchant Password'}
                </label>
                <input
                  type="password"
                  value={pathaoSettings.password}
                  onChange={(e) => setPathaoSettings({ ...pathaoSettings, password: e.target.value })}
                  placeholder="••••••••••••"
                  className={`w-full border rounded-none py-2.5 px-3.5 text-xs font-mono font-light outline-none transition-all ${
                    isDark ? 'bg-[#0B1622] border-[#1E3247] text-white focus:border-emerald-500' : 'bg-white border-slate-300 text-slate-900 focus:border-emerald-500'
                  }`}
                />
              </div>

              {/* Store ID */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-600 dark:text-slate-400 font-light block">
                  {isBn ? 'পাঠাও স্টোর আইডি (Store ID)' : 'Pathao Store ID'}
                </label>
                <input
                  type="text"
                  value={pathaoSettings.storeId}
                  onChange={(e) => setPathaoSettings({ ...pathaoSettings, storeId: e.target.value })}
                  placeholder="STORE-DAC-01"
                  className={`w-full border rounded-none py-2.5 px-3.5 text-xs font-mono font-light outline-none transition-all ${
                    isDark ? 'bg-[#0B1622] border-[#1E3247] text-white focus:border-emerald-500' : 'bg-white border-slate-300 text-slate-900 focus:border-emerald-500'
                  }`}
                />
              </div>

              {/* Auto COD Toggle */}
              <div className="space-y-1.5 flex items-center justify-between pt-4">
                <div>
                  <label className="text-xs font-light text-slate-800 dark:text-white block">
                    {isBn ? 'অটোমেটিক COD অ্যামাউন্ট সিঙ্ক' : 'Auto Collectible COD Amount'}
                  </label>
                  <p className="text-[10px] text-slate-400 font-light">
                    {isBn ? 'আনপেইড কার্টুনের টাকার অংক সরাসরি পাঠাও ক্যাশ অন ডেলিভারিতে যুক্ত করবে' : 'Automatically sync unpaid billable amount to Pathao COD'}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={pathaoSettings.autoSendCod}
                  onChange={(e) => setPathaoSettings({ ...pathaoSettings, autoSendCod: e.target.checked })}
                  className="w-4 h-4 accent-emerald-600 rounded-none cursor-pointer"
                />
              </div>
            </div>

            {/* Save & Test Pathao API Button */}
            <div className="pt-3 border-t dark:border-[#1E3247] flex justify-end">
              <button
                type="submit"
                disabled={isTestingPathao}
                className="py-2.5 px-6 rounded-none bg-emerald-600 hover:bg-emerald-700 text-white font-light text-xs shadow-xs flex items-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
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

      {/* TAB 3: BUDGET & FREIGHT RATES SETTINGS */}
      {activeTab === 'budget_rates' && (
        <div
          className={`border rounded-none p-6 space-y-6 shadow-sm ${
            isDark ? 'bg-[#1E293B] border-[#1E3247] text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}
        >
          <div className="flex items-center justify-between border-b pb-3 dark:border-[#1E3247]">
            <div>
              <h2 className="text-xs font-normal text-slate-800 dark:text-white uppercase tracking-wider">
                {isBn ? 'সুপার এডমিন অফিশিয়াল বাজেট ও ফ্রেইট রেট সেটিংস' : 'Super Admin Official Budget & Freight Rate Settings'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-light">
                {isBn
                  ? 'এয়ার ফ্রেইট চার্জ রেট, কাস্টমস শুল্ক রেট ও খাতের স্ট্যান্ডার্ড লক্ষ্যমাত্রা সেট করুন যা বাজেটিং ড্যাশবোর্ডে প্রযোজ্য হবে'
                  : 'Configure official per-KG shipping/customs rates & target monthly operational category budgets'}
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveBudgetSettings} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Air Freight Rate per KG */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-600 dark:text-slate-400 font-light block">
                  {isBn ? '✈️ এয়ার ফ্রেইট চার্জ রেট (৳ / কেজি)' : 'Air Freight Cargo Rate (৳ / KG)'}
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={budgetSettings.airFreightRatePerKg}
                  onChange={(e) => setBudgetSettings({ ...budgetSettings, airFreightRatePerKg: Number(e.target.value) })}
                  className={`w-full border rounded-none py-2.5 px-3.5 text-xs font-mono font-bold outline-none transition-all ${
                    isDark ? 'bg-[#0B1622] border-[#1E3247] text-emerald-400 focus:border-[#00897B]' : 'bg-white border-slate-300 text-emerald-700 focus:border-[#00897B]'
                  }`}
                />
                <p className="text-[11px] text-slate-400 font-light">
                  {isBn ? 'ফ্লাইটে পাঠানো মোট কেজির উপর এই অফিশিয়াল রেট হিসাব করা হবে' : 'Official charter flight shipping rate per kg'}
                </p>
              </div>

              {/* Customs Duty & Tax Rate per KG */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-600 dark:text-slate-400 font-light block">
                  {isBn ? '🛃 কাস্টমস শুল্ক ও ট্যাক্স রেট (৳ / কেজি)' : 'Customs Duty & Clearance Rate (৳ / KG)'}
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={budgetSettings.customsDutyRatePerKg}
                  onChange={(e) => setBudgetSettings({ ...budgetSettings, customsDutyRatePerKg: Number(e.target.value) })}
                  className={`w-full border rounded-none py-2.5 px-3.5 text-xs font-mono font-bold outline-none transition-all ${
                    isDark ? 'bg-[#0B1622] border-[#1E3247] text-emerald-400 focus:border-[#00897B]' : 'bg-white border-slate-300 text-emerald-700 focus:border-[#00897B]'
                  }`}
                />
                <p className="text-[11px] text-slate-400 font-light">
                  {isBn ? 'এয়ারপোর্ট কাস্টমস খালাসের প্রতি কেজি শুল্ক চার্জ' : 'Official airport customs clearance duty per kg'}
                </p>
              </div>

              {/* Monthly Warehouse Rent Target */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-600 dark:text-slate-400 font-light block">
                  {isBn ? '🏬 মাসিক ওয়্যারহাউজ ভাড়া ও লিজ বাজেট (৳)' : 'Monthly Warehouse Rent Target (৳)'}
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={budgetSettings.warehouseRentTarget}
                  onChange={(e) => setBudgetSettings({ ...budgetSettings, warehouseRentTarget: Number(e.target.value) })}
                  className={`w-full border rounded-none py-2.5 px-3.5 text-xs font-mono font-bold outline-none transition-all ${
                    isDark ? 'bg-[#0B1622] border-[#1E3247] text-white focus:border-[#00897B]' : 'bg-white border-slate-300 text-slate-900 focus:border-[#00897B]'
                  }`}
                />
              </div>

              {/* Monthly Staff Salary Target */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-600 dark:text-slate-400 font-light block">
                  {isBn ? '👷‍♂️ মাসিক স্টাফ বেতন ও ওভারটাইম বাজেট (৳)' : 'Monthly Staff Salary Target (৳)'}
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={budgetSettings.staffSalaryTarget}
                  onChange={(e) => setBudgetSettings({ ...budgetSettings, staffSalaryTarget: Number(e.target.value) })}
                  className={`w-full border rounded-none py-2.5 px-3.5 text-xs font-mono font-bold outline-none transition-all ${
                    isDark ? 'bg-[#0B1622] border-[#1E3247] text-white focus:border-[#00897B]' : 'bg-white border-slate-300 text-slate-900 focus:border-[#00897B]'
                  }`}
                />
              </div>

              {/* Monthly Packing & Transport Target */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-600 dark:text-slate-400 font-light block">
                  {isBn ? '📦 মাসিক প্যাকিং ও পরিবহন বরাদ্দ (৳)' : 'Monthly Packing & Transport Budget (৳)'}
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={budgetSettings.packingTransportTarget}
                  onChange={(e) => setBudgetSettings({ ...budgetSettings, packingTransportTarget: Number(e.target.value) })}
                  className={`w-full border rounded-none py-2.5 px-3.5 text-xs font-mono font-bold outline-none transition-all ${
                    isDark ? 'bg-[#0B1622] border-[#1E3247] text-white focus:border-[#00897B]' : 'bg-white border-slate-300 text-slate-900 focus:border-[#00897B]'
                  }`}
                />
              </div>

              {/* Monthly Utilities Target */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-600 dark:text-slate-400 font-light block">
                  {isBn ? '⚡ মাসিক ইউটিলিটি (বিদ্যুৎ/ইন্টারনেট) বরাদ্দ (৳)' : 'Monthly Utilities Budget (৳)'}
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={budgetSettings.utilitiesTarget}
                  onChange={(e) => setBudgetSettings({ ...budgetSettings, utilitiesTarget: Number(e.target.value) })}
                  className={`w-full border rounded-none py-2.5 px-3.5 text-xs font-mono font-bold outline-none transition-all ${
                    isDark ? 'bg-[#0B1622] border-[#1E3247] text-white focus:border-[#00897B]' : 'bg-white border-slate-300 text-slate-900 focus:border-[#00897B]'
                  }`}
                />
              </div>

              {/* Monthly Other Admin Target */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-600 dark:text-slate-400 font-light block">
                  {isBn ? '📄 মাসিক প্রশাসনিক ও অডিট বরাদ্দ (৳)' : 'Monthly Administrative Budget (৳)'}
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={budgetSettings.otherAdminTarget}
                  onChange={(e) => setBudgetSettings({ ...budgetSettings, otherAdminTarget: Number(e.target.value) })}
                  className={`w-full border rounded-none py-2.5 px-3.5 text-xs font-mono font-bold outline-none transition-all ${
                    isDark ? 'bg-[#0B1622] border-[#1E3247] text-white focus:border-[#00897B]' : 'bg-white border-slate-300 text-slate-900 focus:border-[#00897B]'
                  }`}
                />
              </div>
            </div>

            {/* Save Budget Settings Button */}
            <div className="pt-3 border-t dark:border-[#1E3247] flex justify-end">
              <button
                type="submit"
                className="py-2.5 px-6 rounded-none bg-[#00897B] hover:bg-[#00796B] text-white font-light text-xs shadow-xs flex items-center space-x-2 transition-all cursor-pointer"
              >
                <Save className="w-4 h-4 text-white" />
                <span>{isBn ? 'বাজেট ও ফ্রেইট রেট সেটিংস সংরক্ষণ করুন' : 'Save Budget & Rate Settings'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 4: DANGER ZONE — FACTORY SYSTEM RESET */}
      {activeTab === 'danger_zone' && (
        <div className="space-y-6">
          <div className={`p-6 md:p-8 rounded-2xl border ${
            isDark ? 'bg-[#181014] border-rose-900/60 text-white' : 'bg-rose-50/80 border-rose-200 text-slate-900'
          } shadow-xl space-y-6`}>
            <div className="flex items-start space-x-4">
              <div className="p-3.5 bg-rose-500/20 text-rose-500 rounded-2xl border border-rose-500/30 shrink-0">
                <AlertTriangle className="w-8 h-8 text-rose-500 animate-pulse" />
              </div>
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                    {isBn ? '🚨 ডেঞ্জার জোন — ফ্যাক্টরি সিস্টেম রিস্টোর (Reset All Data)' : '🚨 Danger Zone — Factory System Restore'}
                  </h3>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-rose-600 text-white font-mono font-bold">SUPER ADMIN ONLY</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                  {isBn
                    ? 'এই অপশনটি শুধুমাত্র সুপার এডমিনদের জন্য। রিস্টোর বাটনে ক্লিক করলে পুরো সাইটের সমস্ত ট্রানজ্যাকশন ডাটা (যেমন: সকল কার্টুন, ফ্লাইট প্রস্তাবনা, ফিন্যান্সিয়াল লেজার, খরচ, কাস্টমার ও ট্র্যাকিং ডাটা) সম্পূর্ণরূপে মুছে একদম ফ্রেশ ০-অবস্থায় চলে আসবে।'
                    : 'This action is exclusively for Super Admin. Clicking restore will wipe all site transaction data (cartons, flight proposals, financial ledger, expenses, customer records & tracking data) turning the site 100% fresh.'}
                </p>
              </div>
            </div>

            <div className={`p-4 rounded-xl border text-xs space-y-2.5 ${
              isDark ? 'bg-[#110B0E] border-rose-900/40 text-slate-300' : 'bg-white border-rose-200 text-slate-700 shadow-2xs'
            }`}>
              <div className="font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2 text-xs uppercase tracking-wider">
                <ShieldAlert className="w-4 h-4" />
                <span>{isBn ? 'সুরক্ষিত এবং অক্ষত থাকবে (Protected System Data):' : 'Protected Credentials & Database Schemas:'}</span>
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-mono">
                <li className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold flex items-center gap-1.5">
                  <span>✅</span>
                  <span>{isBn ? 'সুপার এডমিন অ্যাকাউন্ট ও আইডি' : 'Super Admin Account ID'}</span>
                </li>
                <li className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold flex items-center gap-1.5">
                  <span>✅</span>
                  <span>{isBn ? 'ডাটাবেস টেবিল ও কলাম স্কিমা' : 'DB Tables & Column Schema'}</span>
                </li>
                <li className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold flex items-center gap-1.5">
                  <span>✅</span>
                  <span>{isBn ? 'ওয়্যারহাউজ কনফিগারেশন' : 'Warehouse System Configs'}</span>
                </li>
              </ul>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setResetConfirmInput('');
                  setShowResetModal(true);
                }}
                className="px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-black text-xs shadow-xl flex items-center space-x-2 transition-all cursor-pointer border border-rose-500"
              >
                <RotateCcw className="w-4 h-4 text-white" />
                <span>{isBn ? '🔥 পুরো সাইটের ডাটা মুছে রিস্টোর করুন (Reset Site Data)' : '🔥 Perform Factory Reset & Restore Data'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DOUBLE-CONFIRMATION FACTORY RESET MODAL */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className={`max-w-md w-full border rounded-2xl p-6 space-y-5 shadow-2xl ${
            isDark ? 'bg-[#1E293B] border-rose-800 text-white' : 'bg-white border-rose-200 text-slate-900'
          }`}>
            <div className="flex items-center justify-between border-b border-rose-500/20 pb-3">
              <div className="flex items-center space-x-2 text-rose-500">
                <AlertTriangle className="w-5 h-5 animate-bounce" />
                <h3 className="font-black text-sm uppercase tracking-wider">
                  {isBn ? '🚨 সাইট ডাটা রিসেট নিশ্চিতকরণ' : '🚨 Factory System Reset Confirmation'}
                </h3>
              </div>
              <button
                onClick={() => setShowResetModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl">
                ⚠️ {isBn
                  ? 'আপনি কি নিশ্চিত যে পুরো সাইটের সমস্ত ট্রানজ্যাকশন ডাটা মুছে ফেলতে চান? সুপার এডমিন আইডি এবং টেবিল কলামসমূহ অক্ষত থাকবে।'
                  : 'Are you sure you want to delete all site transaction data? Super Admin ID and database table columns will stay intact.'}
              </p>

              <div className="space-y-1.5 pt-1">
                <label className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">
                  {isBn ? 'নিশ্চিত করতে নিচে "RESET" শব্দটি লিখুন:' : 'Type "RESET" below to confirm:'}
                </label>
                <input
                  type="text"
                  value={resetConfirmInput}
                  onChange={(e) => setResetConfirmInput(e.target.value)}
                  placeholder="RESET"
                  className={`w-full border rounded-xl py-2 px-3 text-xs font-mono font-bold tracking-widest uppercase outline-none ${
                    isDark ? 'bg-[#1E293B] border-rose-900 text-rose-400 focus:border-rose-500' : 'bg-rose-50 border-rose-300 text-rose-700 focus:border-rose-500'
                  }`}
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
              >
                {isBn ? 'বাতিল করুন' : 'Cancel'}
              </button>

              <button
                type="button"
                disabled={resetConfirmInput.trim().toUpperCase() !== 'RESET' || isResetting}
                onClick={async () => {
                  setIsResetting(true);
                  try {
                    await performFactorySystemReset(currentUser);
                    showToast(isBn ? '✅ সম্পূর্ণ সাইট ডাটা রিসেট সফল হয়েছে! পেজ রিফ্রেস হচ্ছে...' : '✅ Factory System Reset complete! Reloading...');
                    setTimeout(() => {
                      window.location.reload();
                    }, 1500);
                  } catch (e) {
                    showToast(isBn ? '🔴 রিসেট ব্যর্থ হয়েছে' : '🔴 Reset failed');
                    setIsResetting(false);
                  }
                }}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-lg flex items-center space-x-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4 text-white" />
                <span>{isResetting ? (isBn ? 'রিসেট হচ্ছে...' : 'Resetting...') : (isBn ? 'হ্যাঁ, সমস্ত ডাটা রিসেট করুন' : 'Confirm Factory Reset')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
