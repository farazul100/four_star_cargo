import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Phone,
  CheckCircle2,
  Clock,
  Search,
  Send,
  Star,
  Plus,
  Mail,
  MapPin,
  Building,
  Package,
  Weight,
  Globe,
  FileText,
} from 'lucide-react';
import { CrmCustomer, Customer, User, Language, Theme } from '../types';
import { getHostingerDbData, saveHostingerDbData, subscribeToDbUpdates, logSystemAuditAction } from '../lib/db';
import { useTheme } from '../context/ThemeContext';
import { ToastContainer, ToastMessage } from './Toast';

export type CrmStageTab = 'create_customer' | 'followup' | 'order_complete' | 'important_regular';

interface CrmManagementSystemProps {
  currentUser: User;
  language: Language;
  theme?: Theme;
  initialStageTab?: CrmStageTab;
}

export const CrmManagementSystem: React.FC<CrmManagementSystemProps> = ({
  currentUser,
  language = 'en',
  theme: themeProp,
  initialStageTab = 'create_customer',
}) => {
  const isBn = language === 'bn';
  const { theme: contextTheme } = useTheme();
  const activeTheme = contextTheme || themeProp || 'light';
  const isDark = activeTheme === 'dark';

  // Active Stage Tab synced with prop from main sidebar selection
  const [activeStageTab, setActiveStageTab] = useState<CrmStageTab>(initialStageTab);

  useEffect(() => {
    if (initialStageTab) {
      setActiveStageTab(initialStageTab);
    }
  }, [initialStageTab]);

  // Toast Alerts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = (type: 'success' | 'error' | 'info', title: string, message?: string) => {
    setToasts((prev) => [...prev, { id: `toast-${Date.now()}`, type, title, message }]);
  };
  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // System-wide Customer Database Sync Helper (fsc_vps_customers)
  const syncCrmCustomerToMainDatabase = (crmCust: CrmCustomer) => {
    try {
      const dbData = getHostingerDbData();
      const mainCustomers: Customer[] = dbData.customers || [];

      const cleanPhone = (crmCust.phone || '').replace(/\D/g, '');
      const cleanName = (crmCust.name || '').trim().toLowerCase();

      const exists = mainCustomers.some((c) => {
        const existingPhone = (c.phone || '').replace(/\D/g, '');
        const existingName = (c.name || '').trim().toLowerCase();
        return (cleanPhone && existingPhone && cleanPhone === existingPhone) || (cleanName && existingName === cleanName);
      });

      if (!exists) {
        const rawDigits = crmCust.phone.replace(/\D/g, '');
        const shortId = rawDigits.length >= 4 ? rawDigits.slice(-4) : Math.floor(1000 + Math.random() * 9000).toString();

        const newMainCust: Customer = {
          id: `cust-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          customer_code: `CUST-${shortId}`,
          shipping_mark: `MAR-${shortId}`,
          name: crmCust.name,
          phone: crmCust.phone,
          company_name: crmCust.company_name || '',
          address: crmCust.address || 'Dhaka, Bangladesh',
          total_due: 0,
          total_paid: 0,
          total_billed: 0,
          status: crmCust.followup_status === 'important_regular' ? 'vip' : 'active',
          created_at: crmCust.created_at || new Date().toISOString(),
        };

        const updatedMain = [newMainCust, ...mainCustomers];
        saveHostingerDbData('fsc_vps_customers', updatedMain);
      }
    } catch (err) {
      console.error('Error syncing CRM customer to main database:', err);
    }
  };

  // Helper function to identify real user-created customers
  const isRealCustomer = (c: CrmCustomer) => {
    if (!c || !c.id) return false;
    // Exclude legacy hardcoded demo IDs (crm-cust-101 through crm-cust-111)
    if (/^crm-cust-10[1-9]$/.test(c.id) || /^crm-cust-11[0-1]$/.test(c.id)) return false;
    return true;
  };

  // Main CRM Customers State live synced with Hostinger DB
  const [customers, setCustomers] = useState<CrmCustomer[]>(() => {
    const dbData = getHostingerDbData();
    const rawList = dbData.crmCustomers || [];
    const realList = rawList.filter(isRealCustomer);
    if (rawList.length !== realList.length) {
      saveHostingerDbData('fsc_vps_crm_customers', realList);
    }
    return realList;
  });

  // Real-time DB Sync & System-wide Customer Sync
  useEffect(() => {
    // Initial sync of existing CRM customers into main system database
    const dbData = getHostingerDbData();
    if (dbData.crmCustomers && dbData.crmCustomers.length > 0) {
      dbData.crmCustomers.forEach((c) => {
        if (isRealCustomer(c)) {
          syncCrmCustomerToMainDatabase(c);
        }
      });
    }

    return subscribeToDbUpdates(() => {
      const updatedData = getHostingerDbData();
      if (updatedData.crmCustomers) {
        const cleanList = updatedData.crmCustomers.filter(isRealCustomer);
        setCustomers(cleanList);
        cleanList.forEach(syncCrmCustomerToMainDatabase);
      }
    });
  }, []);

  // Filter States
  const [selectedCountryTab, setSelectedCountryTab] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Customer Entry Form Expanded States
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [productType, setProductType] = useState('');
  const [estWeight, setEstWeight] = useState('');
  const [socialLink, setSocialLink] = useState('');
  const [countryCategory, setCountryCategory] = useState<CrmCustomer['country_category']>('CN_New');
  const [initialCategory, setInitialCategory] = useState<'followup' | 'order_complete' | 'important_regular'>('followup');
  const [notes, setNotes] = useState('');

  // Handle Save New Customer
  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;

    const newCust: CrmCustomer = {
      id: `crm-cust-${Date.now()}`,
      name: name.trim(),
      phone: phone.trim(),
      company_name: companyName.trim() || undefined,
      email: email.trim() || undefined,
      address: address.trim() || undefined,
      product_type: productType.trim() || undefined,
      est_weight: estWeight.trim() || undefined,
      social_link: socialLink.trim() || undefined,
      country_category: countryCategory,
      followup_status: initialCategory,
      notes: notes.trim() || undefined,
      created_by: currentUser.name,
      created_by_id: currentUser.id,
      created_at: new Date().toISOString(),
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }),
      is_handed_over: false,
    };

    const updatedList = [newCust, ...customers];
    setCustomers(updatedList);
    saveHostingerDbData('fsc_vps_crm_customers', updatedList);

    // Sync CRM Customer into Main System Database (fsc_vps_customers)
    syncCrmCustomerToMainDatabase(newCust);

    logSystemAuditAction(
      currentUser,
      'CREATE_CRM_CUSTOMER',
      'crm',
      newCust.id,
      `নতুন কাস্টমার ${newCust.name} (${newCust.phone}) অনবোর্ড করা হয়েছে`
    );

    const categoryLabel =
      initialCategory === 'followup'
        ? '🔴 ফলো আপ কাস্টমার'
        : initialCategory === 'order_complete'
        ? '🔵 নতুন কাস্টমার'
        : '⚫ রেগুলার কাস্টমার';

    addToast(
      'success',
      isBn ? 'কাস্টমার তৈরি সফল!' : 'Customer Created Successfully!',
      isBn ? `${newCust.name} সফলভাবে ${categoryLabel} টেবিলে ও সিস্টেমে যুক্ত হয়েছে` : `${newCust.name} added to ${categoryLabel} table & system`
    );

    // Switch view to match newly created category tab
    setActiveStageTab(initialCategory);

    // Reset Form
    setName('');
    setPhone('');
    setCompanyName('');
    setEmail('');
    setAddress('');
    setProductType('');
    setEstWeight('');
    setSocialLink('');
    setNotes('');
  };

  // Stage 1 -> Stage 2: Convert Followup -> New Customer
  const handleConvertToNewCustomer = (cust: CrmCustomer) => {
    const updatedList = customers.map((c) => {
      if (c.id === cust.id) {
        return { ...c, followup_status: 'order_complete' as const };
      }
      return c;
    });

    setCustomers(updatedList);
    saveHostingerDbData('fsc_vps_crm_customers', updatedList);

    // Sync CRM Customer into Main System Database
    syncCrmCustomerToMainDatabase(cust);

    logSystemAuditAction(
      currentUser,
      'CONVERT_TO_NEW_CUSTOMER',
      'crm',
      cust.id,
      `${cust.name} কাস্টমার থেকে 'নতুন কাস্টমার' তালিকায় স্থানান্তরিত করা হয়েছে`
    );

    addToast(
      'success',
      isBn ? 'নতুন কাস্টমারে রূপান্তর সম্পন্ন!' : 'Converted to New Customer!',
      isBn ? `${cust.name} এখন 'নতুন কাস্টমার' তালিকায় স্থানান্তরিত হয়েছে` : `${cust.name} moved to New Customer stage`
    );
  };

  // Stage 2 -> Stage 3: Convert New Customer -> Regular Customer
  const handleConvertToRegularCustomer = (cust: CrmCustomer) => {
    const updatedList = customers.map((c) => {
      if (c.id === cust.id) {
        return { ...c, followup_status: 'important_regular' as const };
      }
      return c;
    });

    setCustomers(updatedList);
    saveHostingerDbData('fsc_vps_crm_customers', updatedList);

    // Sync CRM Customer into Main System Database
    syncCrmCustomerToMainDatabase({ ...cust, followup_status: 'important_regular' });

    logSystemAuditAction(
      currentUser,
      'CONVERT_TO_REGULAR_CUSTOMER',
      'crm',
      cust.id,
      `${cust.name} কাস্টমার থেকে 'রেগুলার কাস্টমার' তালিকায় স্থানান্তরিত করা হয়েছে`
    );

    addToast(
      'success',
      isBn ? 'রেগুলার কাস্টমারে রূপান্তর সম্পন্ন!' : 'Converted to Regular Customer!',
      isBn ? `${cust.name} এখন 'রেগুলার কাস্টমার' তালিকায় যুক্ত হয়েছে` : `${cust.name} moved to Regular Customer stage`
    );
  };

  // Stage 3 Only: Hand Over Regular Customer
  const handleHandoverCustomer = (cust: CrmCustomer) => {
    if (cust.is_handed_over) return;

    const updatedList = customers.map((c) => {
      if (c.id === cust.id) {
        return {
          ...c,
          is_handed_over: true,
          handed_over_at: new Date().toISOString(),
          handed_over_by: currentUser.name,
        };
      }
      return c;
    });

    setCustomers(updatedList);
    saveHostingerDbData('fsc_vps_crm_customers', updatedList);

    // Sync CRM Customer into Main System Database for Warehouse & Super Admin
    syncCrmCustomerToMainDatabase(cust);

    logSystemAuditAction(
      currentUser,
      'HANDOVER_CRM_CUSTOMER',
      'crm',
      cust.id,
      `রেগুলার কাস্টমার ${cust.name} অপারেশনে সফলভাবে হ্যান্ড ওভার করা হয়েছে (${currentUser.name})`
    );

    addToast(
      'success',
      isBn ? '🤝 কাস্টমার হ্যান্ড ওভার সম্পন্ন!' : '🤝 Customer Handed Over!',
      isBn ? `${cust.name} কাস্টমার সফলভাবে অপারেশনে হ্যান্ড ওভার করা হয়েছে` : `${cust.name} handed over successfully to operations`
    );
  };

  // Stage Groups Calculation
  const followupCustomers = customers.filter((c) => c.followup_status === 'followup');
  const newCustomers = customers.filter((c) => c.followup_status === 'order_complete');
  const regularCustomers = customers.filter((c) => c.followup_status === 'important_regular');

  // Filtered List for Current Selected Stage Tab
  const targetStageList =
    activeStageTab === 'followup'
      ? followupCustomers
      : activeStageTab === 'order_complete'
      ? newCustomers
      : regularCustomers;

  const filteredCustomers = targetStageList.filter((c) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      (c.company_name && c.company_name.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.notes && c.notes.toLowerCase().includes(q));
    const matchesCountry = selectedCountryTab === 'ALL' || c.country_category === selectedCountryTab;
    return matchesSearch && matchesCountry;
  });

  return (
    <div className="space-y-5 max-w-7xl mx-auto font-sans font-light">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* VIEW 1: DEDICATED EXPANDED CUSTOMER CREATION FORM PAGE */}
      {activeStageTab === 'create_customer' && (
        <div className={`border rounded-xl p-6 shadow-2xs space-y-6 transition-all max-w-4xl mx-auto ${
          isDark ? 'bg-[#1E293B] border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-950'
        }`}>
          <div className="border-b pb-4 dark:border-slate-800 flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-[#00897B]/10 text-[#00897B] flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-[#00897B]" />
            </div>
            <div>
              <h3 className="text-sm font-normal text-slate-950 dark:text-white">
                {isBn ? 'নতুন কাস্টমার অনবোর্ডিং ফর্ম (Full Customer Profile Onboarding)' : 'Full Customer Profile Onboarding Form'}
              </h3>
              <p className="text-xs text-slate-800 dark:text-slate-400 font-light mt-0.5">
                {isBn ? 'কাস্টমারের বিবরণ পূরণ করে নির্দিষ্ট স্টেজ সিলেক্ট করে সেভ করুন' : 'Fill detailed customer information and select target stage'}
              </p>
            </div>
          </div>

          <form onSubmit={handleCreateCustomer} className="space-y-5">
            {/* Section 1: Basic Contact Information */}
            <div className="space-y-3">
              <h4 className="text-xs font-normal text-slate-950 dark:text-slate-200 uppercase tracking-wider border-b pb-1 dark:border-slate-800 flex items-center space-x-1.5">
                <Users className="w-3.5 h-3.5 text-[#00897B]" />
                <span>{isBn ? '১. প্রাথমিক যোগাযোগের তথ্য (Basic Information)' : '1. Basic Information'}</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                {/* Customer Name */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-900 dark:text-slate-200 font-light block">
                    {isBn ? 'কাস্টমারের নাম (Name) *' : 'Customer Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Masuka Begum"
                    className={`w-full border rounded-lg py-2 px-3 text-xs font-light outline-none transition-all ${
                      isDark ? 'bg-slate-900 border-slate-700 text-white focus:border-[#00897B]' : 'bg-white border-slate-300 text-slate-950 placeholder:text-slate-400 focus:border-[#00897B] focus:ring-1 focus:ring-[#00897B]'
                    }`}
                  />
                </div>

                {/* Phone Number */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-900 dark:text-slate-200 font-light block">
                    {isBn ? 'ফোন নম্বর (Phone Number) *' : 'Phone Number *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="01828661711"
                    className={`w-full border rounded-lg py-2 px-3 text-xs font-mono font-light outline-none transition-all ${
                      isDark ? 'bg-slate-900 border-slate-700 text-white focus:border-[#00897B]' : 'bg-white border-slate-300 text-slate-950 placeholder:text-slate-400 focus:border-[#00897B] focus:ring-1 focus:ring-[#00897B]'
                    }`}
                  />
                </div>

                {/* Company Name */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-900 dark:text-slate-200 font-light block">
                    {isBn ? 'কোম্পানি / ব্যবসার নাম (Company)' : 'Company / Business'}
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Four Star Fashion"
                    className={`w-full border rounded-lg py-2 px-3 text-xs font-light outline-none transition-all ${
                      isDark ? 'bg-slate-900 border-slate-700 text-white focus:border-[#00897B]' : 'bg-white border-slate-300 text-slate-950 placeholder:text-slate-400 focus:border-[#00897B] focus:ring-1 focus:ring-[#00897B]'
                    }`}
                  />
                </div>

                {/* Email Address */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-900 dark:text-slate-200 font-light block">
                    {isBn ? 'ইমেইল এড্রেস (Email Address)' : 'Email Address'}
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="client@gmail.com"
                    className={`w-full border rounded-lg py-2 px-3 text-xs font-light outline-none transition-all ${
                      isDark ? 'bg-slate-900 border-slate-700 text-white focus:border-[#00897B]' : 'bg-white border-slate-300 text-slate-950 placeholder:text-slate-400 focus:border-[#00897B] focus:ring-1 focus:ring-[#00897B]'
                    }`}
                  />
                </div>

                {/* Address / Location */}
                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs text-slate-900 dark:text-slate-200 font-light block">
                    {isBn ? 'ঠিকানা / লোকেশন (Address)' : 'Address / Location'}
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. Uttara Sector 7, Dhaka"
                    className={`w-full border rounded-lg py-2 px-3 text-xs font-light outline-none transition-all ${
                      isDark ? 'bg-slate-900 border-slate-700 text-white focus:border-[#00897B]' : 'bg-white border-slate-300 text-slate-950 placeholder:text-slate-400 focus:border-[#00897B] focus:ring-1 focus:ring-[#00897B]'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Cargo & Shipment Details */}
            <div className="space-y-3">
              <h4 className="text-xs font-normal text-slate-950 dark:text-slate-200 uppercase tracking-wider border-b pb-1 dark:border-slate-800 flex items-center space-x-1.5">
                <Package className="w-3.5 h-3.5 text-[#00897B]" />
                <span>{isBn ? '২. শিপমেন্ট ও কার্গো ইনকোয়ারি (Cargo Info)' : '2. Cargo Info'}</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                {/* Product / Cargo Type */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-900 dark:text-slate-200 font-light block">
                    {isBn ? 'পণ্য বা কার্গো টাইপ (Product Type)' : 'Product / Cargo Type'}
                  </label>
                  <input
                    type="text"
                    value={productType}
                    onChange={(e) => setProductType(e.target.value)}
                    placeholder="e.g. Garments Fabrics / Electronics"
                    className={`w-full border rounded-lg py-2 px-3 text-xs font-light outline-none transition-all ${
                      isDark ? 'bg-slate-900 border-slate-700 text-white focus:border-[#00897B]' : 'bg-white border-slate-300 text-slate-950 placeholder:text-slate-400 focus:border-[#00897B] focus:ring-1 focus:ring-[#00897B]'
                    }`}
                  />
                </div>

                {/* Estimated Weight */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-900 dark:text-slate-200 font-light block">
                    {isBn ? 'আনুমানিক ওজন/ভলিউম (Est. Weight)' : 'Estimated Weight/Volume'}
                  </label>
                  <input
                    type="text"
                    value={estWeight}
                    onChange={(e) => setEstWeight(e.target.value)}
                    placeholder="e.g. 150 kg / 2 CBM"
                    className={`w-full border rounded-lg py-2 px-3 text-xs font-light outline-none transition-all ${
                      isDark ? 'bg-slate-900 border-slate-700 text-white focus:border-[#00897B]' : 'bg-white border-slate-300 text-slate-950 placeholder:text-slate-400 focus:border-[#00897B] focus:ring-1 focus:ring-[#00897B]'
                    }`}
                  />
                </div>

                {/* Social Media Link / WeChat */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-900 dark:text-slate-200 font-light block">
                    {isBn ? 'ফেসবুক/উইচ্যাট পেজ (Social / WeChat)' : 'Social Link / WeChat'}
                  </label>
                  <input
                    type="text"
                    value={socialLink}
                    onChange={(e) => setSocialLink(e.target.value)}
                    placeholder="fb.com/page or wxid_..."
                    className={`w-full border rounded-lg py-2 px-3 text-xs font-light outline-none transition-all ${
                      isDark ? 'bg-slate-900 border-slate-700 text-white focus:border-[#00897B]' : 'bg-white border-slate-300 text-slate-950 placeholder:text-slate-400 focus:border-[#00897B] focus:ring-1 focus:ring-[#00897B]'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Country Category & Stage Selection */}
            <div className="space-y-3">
              <h4 className="text-xs font-normal text-slate-950 dark:text-slate-200 uppercase tracking-wider border-b pb-1 dark:border-slate-800 flex items-center space-x-1.5">
                <Globe className="w-3.5 h-3.5 text-[#00897B]" />
                <span>{isBn ? '৩. কান্ট্রি শট ও স্টেজ সিলেক্ট (Country & Target Stage)' : '3. Country & Target Stage'}</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Country Sheet Category */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-900 dark:text-slate-200 font-light block">
                    {isBn ? 'কান্ট্রি ক্যাটাগরি (Country Sheet)' : 'Country Category'}
                  </label>
                  <select
                    value={countryCategory}
                    onChange={(e) => setCountryCategory(e.target.value as any)}
                    className={`w-full border rounded-lg py-2 px-3 text-xs font-light outline-none cursor-pointer ${
                      isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-950 focus:border-[#00897B]'
                    }`}
                  >
                    <option value="CN_New">CN New</option>
                    <option value="CN_Old">CHINA Old</option>
                    <option value="KR_New">KR New</option>
                    <option value="KR_Old">Korea Old</option>
                    <option value="JP_New">JP New</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* Target Stage Selection */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-900 dark:text-slate-200 font-light block">
                    {isBn ? 'কাস্টমার কোন টেবিলে যুক্ত হবে? (Target Table Stage) *' : 'Target Table Stage *'}
                  </label>
                  <select
                    value={initialCategory}
                    onChange={(e) => setInitialCategory(e.target.value as any)}
                    className={`w-full border rounded-lg py-2 px-3 text-xs font-light outline-none cursor-pointer ${
                      isDark ? 'bg-slate-900 border-slate-700 text-white focus:border-[#00897B]' : 'bg-white border-slate-300 text-slate-950 focus:border-[#00897B]'
                    }`}
                  >
                    <option value="followup">🔴 ফলো আপ কাস্টমার (Follow Up Table)</option>
                    <option value="order_complete">🔵 নতুন কাস্টমার (New Customer Table)</option>
                    <option value="important_regular">⚫ রেগুলার কাস্টমার (Regular Customer Table)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 4: Inquiry Notes */}
            <div className="space-y-1">
              <label className="text-xs text-slate-900 dark:text-slate-200 font-light block">
                {isBn ? 'নোট বা ইনকোয়ারি তথ্য (Notes)' : 'Inquiry / Notes'}
              </label>
              <textarea
                rows={2.5}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Guangzhou air freight quote given $8.5/kg..."
                className={`w-full border rounded-lg py-2 px-3 text-xs font-light outline-none transition-all ${
                  isDark ? 'bg-slate-900 border-slate-700 text-white focus:border-[#00897B]' : 'bg-white border-slate-300 text-slate-950 placeholder:text-slate-400 focus:border-[#00897B] focus:ring-1 focus:ring-[#00897B]'
                }`}
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="py-2.5 px-6 rounded-lg bg-[#00897B] hover:bg-[#00796B] text-white font-normal text-xs shadow-2xs flex items-center space-x-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 text-white" />
                <span>{isBn ? 'কাস্টমার সেভ করুন' : 'Save & Add Customer'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* VIEW 2, 3, 4: FULL WIDTH CUSTOMER STAGE TABLES ONLY (SOFT LIGHT TYPOGRAPHY & FIXED INQUIRY NOTES BACKGROUND) */}
      {activeStageTab !== 'create_customer' && (
        <div className="space-y-3.5 w-full">
          {/* Header Info & Country Filters Bar */}
          <div className={`border rounded-xl p-4 shadow-2xs space-y-3 ${
            isDark ? 'bg-[#1E293B] border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-950'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3 dark:border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs ${
                  activeStageTab === 'followup' ? 'bg-rose-500' : activeStageTab === 'order_complete' ? 'bg-blue-600' : 'bg-slate-700'
                }`}>
                  {activeStageTab === 'followup' && '🔴'}
                  {activeStageTab === 'order_complete' && '🔵'}
                  {activeStageTab === 'important_regular' && '⚫'}
                </div>
                <div>
                  <h3 className="text-xs font-normal text-slate-950 dark:text-slate-100 flex items-center space-x-2">
                    <span>
                      {activeStageTab === 'followup' && (isBn ? '🔴 ফলো আপ কাস্টমার ডাটা টেবিল (Follow-Up)' : 'Follow-Up Customer Table')}
                      {activeStageTab === 'order_complete' && (isBn ? '🔵 নতুন কাস্টমার ডাটা টেবিল (New Customer)' : 'New Customer Table')}
                      {activeStageTab === 'important_regular' && (isBn ? '⚫ রেগুলার কাস্টমার ডাটা টেবিল (Regular Customer)' : 'Regular Customer Table')}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-800 dark:text-slate-400 font-light mt-0.5">
                    {activeStageTab === 'followup' && (isBn ? 'ফলো আপ থেকে পরবর্তীতে "নতুন কাস্টমারে" কনভার্ট করা যাবে' : 'Convert to New Customer upon booking')}
                    {activeStageTab === 'order_complete' && (isBn ? 'নতুন কাস্টমার থেকে পরবর্তীতে "রেগুলার কাস্টমারে" কনভার্ট করা যাবে' : 'Convert to Regular Customer upon repeat bookings')}
                    {activeStageTab === 'important_regular' && (isBn ? 'শুধুমাত্র এখান থেকেই অপারেশনে হ্যান্ড ওভার সম্পন্ন করা যাবে' : 'Handover to operations allowed here only')}
                  </p>
                </div>
              </div>

              <span className="text-xs font-mono px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-200 rounded-lg border border-slate-300 dark:border-slate-700 font-light self-start sm:self-auto">
                {filteredCustomers.length} জন কাস্টমার
              </span>
            </div>

            {/* Country Sheet Filter Tabs & Search Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-0.5">
              {/* Country Sheet Tabs */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'ALL', label: isBn ? 'সব কান্ট্রি (All)' : 'ALL' },
                  { id: 'CN_Old', label: 'CHINA Old' },
                  { id: 'KR_Old', label: 'Korea Old' },
                  { id: 'CN_New', label: 'CN New' },
                  { id: 'KR_New', label: 'KR New' },
                  { id: 'JP_New', label: 'JP New' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSelectedCountryTab(tab.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-light transition-all cursor-pointer ${
                      selectedCountryTab === tab.id
                        ? 'bg-slate-900 text-white dark:bg-teal-600 shadow-2xs'
                        : 'bg-white border border-slate-300 text-slate-900 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isBn ? 'নাম, ফোন বা কোম্পানি...' : 'Search name/phone/company...'}
                  className={`pl-8 pr-3 py-1.5 border rounded-lg text-xs font-light outline-none transition-all ${
                    isDark ? 'bg-slate-900 border-slate-700 text-white focus:border-[#00897B]' : 'bg-white border-slate-300 text-slate-950 placeholder:text-slate-500 focus:border-[#00897B] focus:ring-1 focus:ring-[#00897B]'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* STAGE TABLE */}
          <div className={`border rounded-xl shadow-2xs overflow-hidden ${
            isDark ? 'bg-[#1E293B] border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-950'
          }`}>
            {filteredCustomers.length === 0 ? (
              <div className="text-center py-14 px-4">
                <Users className="w-9 h-9 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
                <h4 className="text-xs font-normal text-slate-800 dark:text-slate-400">
                  {isBn ? 'এই ট্যাবে কোনো কাস্টমার ডাটা পাওয়া যায়নি' : 'No customer records in this section'}
                </h4>
                <p className="text-xs text-slate-600 font-light mt-1">
                  {isBn ? 'বাম সাইডবারের "➕ নতুন কাস্টমার তৈরি" মেনুতে গিয়ে কাস্টমার এন্ট্রি দিন' : 'Use "➕ Create Customer" tab to onboard clients'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse font-light">
                  <thead className={`border-b ${isDark ? 'bg-slate-900/90 border-slate-800 text-slate-300' : 'bg-slate-100 border-slate-300 text-slate-900'}`}>
                    <tr>
                      <th className="py-2.5 px-3.5 font-normal">#</th>
                      <th className="py-2.5 px-3.5 font-normal">{isBn ? 'কাস্টমার নাম ও যোগাযোগ' : 'Customer & Contact'}</th>
                      <th className="py-2.5 px-3.5 font-normal">{isBn ? 'অনবোর্ডিং ক্যাটাগরি' : 'Sheet Category'}</th>
                      <th className="py-2.5 px-3.5 font-normal">{isBn ? 'ইনকোয়ারি নোটস ও কার্গো ইনফো' : 'Inquiry Notes & Cargo Info'}</th>
                      <th className="py-2.5 px-3.5 font-normal">{isBn ? 'অনবোর্ডার এক্সিকিউটিভ' : 'CRM Executive'}</th>
                      <th className="py-2.5 px-3.5 font-normal text-right">{isBn ? 'স্টেজ রূপান্তর ও হ্যান্ড ওভার' : 'Action / Handover'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y border-slate-200 dark:divide-slate-800">
                    {filteredCustomers.map((cust, idx) => (
                      <tr key={cust.id} className={isDark ? 'hover:bg-slate-900/40 transition-colors' : 'hover:bg-slate-50 transition-colors'}>
                        <td className="py-3 px-3.5 font-mono text-slate-600 dark:text-slate-400 font-light">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-3.5">
                          <p className="font-normal text-slate-950 dark:text-white text-xs flex items-center space-x-1">
                            <span>{cust.name}</span>
                            {cust.company_name && (
                              <span className="text-[10px] text-slate-800 font-light bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded border border-slate-300 dark:border-slate-700">
                                🏢 {cust.company_name}
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] font-mono text-teal-700 dark:text-teal-400 font-light flex items-center space-x-1 mt-0.5">
                            <Phone className="w-3 h-3" />
                            <span>{cust.phone}</span>
                          </p>
                          {cust.address && (
                            <p className="text-[10px] text-slate-700 font-light flex items-center space-x-1 mt-0.5">
                              <MapPin className="w-2.5 h-2.5 text-slate-500" />
                              <span>{cust.address}</span>
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-3.5">
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-300 font-mono font-light rounded-md border border-slate-300 dark:border-slate-700 text-[11px]">
                            🏷️ {cust.country_category}
                          </span>
                        </td>

                        {/* INQUIRY NOTES COLUMN (100% EXPLICIT LIGHT/DARK STYLING) */}
                        <td className="py-3 px-3.5 max-w-xs">
                          <div className={`p-2.5 rounded-lg border space-y-1 ${
                            isDark
                              ? 'bg-slate-800/90 border-slate-700 text-slate-100'
                              : 'bg-slate-100/90 border-slate-300 text-slate-950'
                          }`}>
                            {cust.notes ? (
                              <p className={`text-[11px] font-light leading-relaxed ${
                                isDark ? 'text-slate-100' : 'text-slate-950'
                              }`}>
                                {cust.notes}
                              </p>
                            ) : (
                              <span className="text-slate-500 italic text-[11px]">নির্ধারিত নোট নেই</span>
                            )}

                            {(cust.product_type || cust.est_weight) && (
                              <div className={`flex flex-wrap gap-1 pt-1 border-t ${
                                isDark ? 'border-slate-700' : 'border-slate-200'
                              }`}>
                                {cust.product_type && (
                                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-light ${
                                    isDark
                                      ? 'bg-teal-950/80 text-teal-300 border border-teal-800'
                                      : 'bg-teal-50 text-teal-800 border border-teal-200'
                                  }`}>
                                    📦 {cust.product_type}
                                  </span>
                                )}
                                {cust.est_weight && (
                                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-light ${
                                    isDark
                                      ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
                                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                                  }`}>
                                    ⚖️ {cust.est_weight}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-3.5 text-slate-600 dark:text-slate-300 font-light">
                          <p className="flex items-center space-x-1">
                            <span>👤</span>
                            <span>{cust.created_by}</span>
                          </p>
                          <p className="text-[10px] font-mono text-slate-400 mt-0.5">{cust.date || '15.08.26'}</p>
                        </td>
                        <td className="py-3 px-3.5 text-right font-light">
                          {/* STAGE 1: FOLLOW UP -> CONVERT TO NEW CUSTOMER */}
                          {cust.followup_status === 'followup' && (
                            <button
                              type="button"
                              onClick={() => handleConvertToNewCustomer(cust)}
                              className="py-1 px-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-normal rounded-md shadow-2xs inline-flex items-center space-x-1 transition-all cursor-pointer"
                            >
                              <span>{isBn ? '➔ কনভার্ট টু কাস্টমার' : '➔ Convert to New Customer'}</span>
                            </button>
                          )}

                          {/* STAGE 2: NEW CUSTOMER -> CONVERT TO REGULAR CUSTOMER */}
                          {cust.followup_status === 'order_complete' && (
                            <button
                              type="button"
                              onClick={() => handleConvertToRegularCustomer(cust)}
                              className="py-1 px-2.5 bg-slate-700 hover:bg-slate-800 text-white text-[11px] font-normal rounded-md shadow-2xs inline-flex items-center space-x-1 transition-all cursor-pointer"
                            >
                              <span>{isBn ? '➔ কনভার্ট টু রেগুলার' : '➔ Convert to Regular'}</span>
                            </button>
                          )}

                          {/* STAGE 3: REGULAR CUSTOMER -> HANDOVER BUTTON AVAILABLE HERE ONLY */}
                          {cust.followup_status === 'important_regular' && (
                            <div>
                              {cust.is_handed_over ? (
                                <span className="py-0.5 px-2 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-md border border-emerald-200 dark:border-emerald-800 text-[11px] font-light inline-flex items-center space-x-1">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                  <span>{isBn ? 'হ্যান্ড ওভার সম্পন্ন' : 'Handed Over'}</span>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleHandoverCustomer(cust)}
                                  className="py-1 px-2.5 bg-[#00897B] hover:bg-[#00796B] text-white text-[11px] font-normal rounded-md shadow-2xs inline-flex items-center space-x-1 transition-all cursor-pointer"
                                >
                                  <Send className="w-3 h-3 text-white" />
                                  <span>{isBn ? '🤝 হ্যান্ড ওভার করুন' : '🤝 Hand Over'}</span>
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
