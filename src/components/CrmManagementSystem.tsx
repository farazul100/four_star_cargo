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
  const [customerCustomId, setCustomerCustomId] = useState('');
  const [shippingMark, setShippingMark] = useState('');
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
      customer_custom_id: customerCustomId.trim() || undefined,
      shipping_mark: shippingMark.trim() || undefined,
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
    setCustomerCustomId('');
    setShippingMark('');
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
    <div className="space-y-5 w-full font-sans font-light">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* VIEW 1: DEDICATED EXPANDED CUSTOMER CREATION FORM PAGE */}
      {activeStageTab === 'create_customer' && (
        <div className={`border rounded-2xl p-6 sm:p-8 shadow-xl space-y-6 transition-all w-full ${
          isDark ? 'bg-[#1E293B] border-slate-700 text-white' : 'bg-white border-slate-300 text-black'
        }`}>
          {/* Header Card */}
          <div className={`border-b pb-5 flex items-center space-x-3.5 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
            <div className="w-11 h-11 rounded-xl bg-[#00897B] text-white flex items-center justify-center shadow-md">
              <UserPlus className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className={`text-base font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {isBn ? 'নতুন কাস্টমার অনবোর্ডিং পোর্টাল (Full Customer Profile Onboarding)' : 'Full Customer Profile Onboarding Form'}
              </h3>
              <p className={`text-xs font-normal mt-0.5 ${isDark ? 'text-slate-200' : 'text-slate-600'}`}>
                {isBn ? 'কাস্টমার আইডি ও বিবরণ পূরণ করে নির্দিষ্ট স্টেজ সিলেক্ট করে সেভ করুন' : 'Enter customer ID, contact details and target pipeline stage'}
              </p>
            </div>
          </div>

          <form onSubmit={handleCreateCustomer} className="space-y-6">
            {/* Section 1: Customer ID Identification */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2 border-b pb-2 border-slate-700/60">
                <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-md ${
                  isDark ? 'bg-[#00897B] text-white shadow-xs' : 'bg-teal-500/10 text-[#00897B] border border-teal-500/20'
                }`}>
                  SECTION 1
                </span>
                <h4 className={`text-xs font-bold uppercase tracking-wider ${
                  isDark ? 'text-teal-300' : 'text-slate-900'
                }`}>
                  {isBn ? 'কাস্টমার অনন্য আইডি (Customer Identification ID)' : 'Customer Identification ID'}
                </h4>
              </div>

              <div>
                {/* Customer Custom ID */}
                <div className="space-y-1 max-w-md">
                  <label className={`text-xs font-semibold block ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {isBn ? 'কাস্টমার আইডি (Customer ID)' : 'Customer ID (Client Code)'}
                  </label>
                  <input
                    type="text"
                    value={customerCustomId}
                    onChange={(e) => setCustomerCustomId(e.target.value)}
                    placeholder="e.g. FSC-1082 / CID-501"
                    className={`w-full border rounded-xl py-2.5 px-3.5 text-xs font-mono font-medium outline-none transition-all ${
                      isDark
                        ? 'bg-[#1E293B] border-slate-600 text-white placeholder:text-slate-300 focus:border-teal-400 focus:ring-2 focus:ring-teal-500/30'
                        : 'bg-slate-50 border-slate-300 text-black placeholder:text-slate-500 focus:border-[#00897B] focus:ring-2 focus:ring-[#00897B]/20 focus:bg-white'
                    }`}
                  />
                  <p className={`text-[10px] ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    {isBn ? 'ম্যানুয়াল কাস্টমার অনন্য আইডি (যেমন: FSC-1082)' : 'Unique custom customer code identifier'}
                  </p>
                </div>
              </div>
            </div>

            {/* Section 2: Basic Contact Information */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2 border-b pb-2 border-slate-700/60">
                <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-md ${
                  isDark ? 'bg-[#00897B] text-white shadow-xs' : 'bg-teal-500/10 text-[#00897B] border border-teal-500/20'
                }`}>
                  SECTION 2
                </span>
                <h4 className={`text-xs font-bold uppercase tracking-wider ${
                  isDark ? 'text-teal-300' : 'text-slate-900'
                }`}>
                  {isBn ? 'প্রাথমিক যোগাযোগের তথ্য (Basic Information)' : 'Basic Information'}
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {/* Customer Name */}
                <div className="space-y-1">
                  <label className={`text-xs font-semibold block ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {isBn ? 'কাস্টমারের নাম (Name) *' : 'Customer Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Masuka Begum"
                    className={`w-full border rounded-xl py-2.5 px-3.5 text-xs font-medium outline-none transition-all ${
                      isDark
                        ? 'bg-[#1E293B] border-slate-600 text-white placeholder:text-slate-300 focus:border-teal-400 focus:ring-2 focus:ring-teal-500/30'
                        : 'bg-slate-50 border-slate-300 text-black placeholder:text-slate-500 focus:border-[#00897B] focus:ring-2 focus:ring-[#00897B]/20 focus:bg-white'
                    }`}
                  />
                </div>

                {/* Phone Number */}
                <div className="space-y-1">
                  <label className={`text-xs font-semibold block ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {isBn ? 'ফোন নম্বর (Phone Number) *' : 'Phone Number *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="01828661711"
                    className={`w-full border rounded-xl py-2.5 px-3.5 text-xs font-mono font-medium outline-none transition-all ${
                      isDark
                        ? 'bg-[#1E293B] border-slate-600 text-white placeholder:text-slate-300 focus:border-teal-400 focus:ring-2 focus:ring-teal-500/30'
                        : 'bg-slate-50 border-slate-300 text-black placeholder:text-slate-500 focus:border-[#00897B] focus:ring-2 focus:ring-[#00897B]/20 focus:bg-white'
                    }`}
                  />
                </div>

                {/* Company Name */}
                <div className="space-y-1">
                  <label className={`text-xs font-semibold block ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {isBn ? 'কোম্পানি / ব্যবসার নাম (Company)' : 'Company / Business'}
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Four Star Fashion Ltd"
                    className={`w-full border rounded-xl py-2.5 px-3.5 text-xs font-medium outline-none transition-all ${
                      isDark
                        ? 'bg-[#1E293B] border-slate-600 text-white placeholder:text-slate-300 focus:border-teal-400 focus:ring-2 focus:ring-teal-500/30'
                        : 'bg-slate-50 border-slate-300 text-black placeholder:text-slate-500 focus:border-[#00897B] focus:ring-2 focus:ring-[#00897B]/20 focus:bg-white'
                    }`}
                  />
                </div>

                {/* Email Address */}
                <div className="space-y-1">
                  <label className={`text-xs font-semibold block ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {isBn ? 'ইমেইল এড্রেস (Email Address)' : 'Email Address'}
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="client@gmail.com"
                    className={`w-full border rounded-xl py-2.5 px-3.5 text-xs font-medium outline-none transition-all ${
                      isDark
                        ? 'bg-[#1E293B] border-slate-600 text-white placeholder:text-slate-300 focus:border-teal-400 focus:ring-2 focus:ring-teal-500/30'
                        : 'bg-slate-50 border-slate-300 text-black placeholder:text-slate-500 focus:border-[#00897B] focus:ring-2 focus:ring-[#00897B]/20 focus:bg-white'
                    }`}
                  />
                </div>

                {/* Address / Location */}
                <div className="space-y-1 md:col-span-2">
                  <label className={`text-xs font-semibold block ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {isBn ? 'ঠিকানা / লোকেশন (Address)' : 'Address / Location'}
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. House 14, Road 5, Uttara Sector 7, Dhaka"
                    className={`w-full border rounded-xl py-2.5 px-3.5 text-xs font-medium outline-none transition-all ${
                      isDark
                        ? 'bg-[#1E293B] border-slate-600 text-white placeholder:text-slate-300 focus:border-teal-400 focus:ring-2 focus:ring-teal-500/30'
                        : 'bg-slate-50 border-slate-300 text-black placeholder:text-slate-500 focus:border-[#00897B] focus:ring-2 focus:ring-[#00897B]/20 focus:bg-white'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Cargo & Shipment Details */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2 border-b pb-2 border-slate-700/60">
                <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-md ${
                  isDark ? 'bg-[#00897B] text-white shadow-xs' : 'bg-teal-500/10 text-[#00897B] border border-teal-500/20'
                }`}>
                  SECTION 3
                </span>
                <h4 className={`text-xs font-bold uppercase tracking-wider ${
                  isDark ? 'text-teal-300' : 'text-slate-900'
                }`}>
                  {isBn ? 'শিপমেন্ট ও কার্গো ইনকোয়ারি (Cargo Info)' : 'Cargo Info'}
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {/* Product / Cargo Type */}
                <div className="space-y-1">
                  <label className={`text-xs font-semibold block ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {isBn ? 'পণ্য বা কার্গো টাইপ (Product Type)' : 'Product / Cargo Type'}
                  </label>
                  <input
                    type="text"
                    value={productType}
                    onChange={(e) => setProductType(e.target.value)}
                    placeholder="e.g. Garments Fabrics / Electronics"
                    className={`w-full border rounded-xl py-2.5 px-3.5 text-xs font-medium outline-none transition-all ${
                      isDark
                        ? 'bg-[#1E293B] border-slate-600 text-white placeholder:text-slate-300 focus:border-teal-400 focus:ring-2 focus:ring-teal-500/30'
                        : 'bg-slate-50 border-slate-300 text-black placeholder:text-slate-500 focus:border-[#00897B] focus:ring-2 focus:ring-[#00897B]/20 focus:bg-white'
                    }`}
                  />
                </div>

                {/* Estimated Weight */}
                <div className="space-y-1">
                  <label className={`text-xs font-semibold block ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {isBn ? 'আনুমানিক ওজন/ভলিউম (Est. Weight)' : 'Estimated Weight/Volume'}
                  </label>
                  <input
                    type="text"
                    value={estWeight}
                    onChange={(e) => setEstWeight(e.target.value)}
                    placeholder="e.g. 150 kg / 2 CBM"
                    className={`w-full border rounded-xl py-2.5 px-3.5 text-xs font-medium outline-none transition-all ${
                      isDark
                        ? 'bg-[#1E293B] border-slate-600 text-white placeholder:text-slate-300 focus:border-teal-400 focus:ring-2 focus:ring-teal-500/30'
                        : 'bg-slate-50 border-slate-300 text-black placeholder:text-slate-500 focus:border-[#00897B] focus:ring-2 focus:ring-[#00897B]/20 focus:bg-white'
                    }`}
                  />
                </div>

                {/* Social Media Link / WeChat */}
                <div className="space-y-1">
                  <label className={`text-xs font-semibold block ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {isBn ? 'ফেসবুক/উইচ্যাট পেজ (Social / WeChat)' : 'Social Link / WeChat'}
                  </label>
                  <input
                    type="text"
                    value={socialLink}
                    onChange={(e) => setSocialLink(e.target.value)}
                    placeholder="fb.com/page or wxid_..."
                    className={`w-full border rounded-xl py-2.5 px-3.5 text-xs font-medium outline-none transition-all ${
                      isDark
                        ? 'bg-[#1E293B] border-slate-600 text-white placeholder:text-slate-300 focus:border-teal-400 focus:ring-2 focus:ring-teal-500/30'
                        : 'bg-slate-50 border-slate-300 text-black placeholder:text-slate-500 focus:border-[#00897B] focus:ring-2 focus:ring-[#00897B]/20 focus:bg-white'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Section 4: Country Category & Stage Selection */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2 border-b pb-2 border-slate-700/60">
                <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-md ${
                  isDark ? 'bg-[#00897B] text-white shadow-xs' : 'bg-teal-500/10 text-[#00897B] border border-teal-500/20'
                }`}>
                  SECTION 4
                </span>
                <h4 className={`text-xs font-bold uppercase tracking-wider ${
                  isDark ? 'text-teal-300' : 'text-slate-900'
                }`}>
                  {isBn ? 'কান্ট্রি শট ও স্টেজ সিলেক্ট (Country & Target Stage)' : 'Country & Target Stage'}
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Country Sheet Category */}
                <div className="space-y-1">
                  <label className={`text-xs font-semibold block ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {isBn ? 'কান্ট্রি ক্যাটাগরি (Country Sheet)' : 'Country Category'}
                  </label>
                  <select
                    value={countryCategory}
                    onChange={(e) => setCountryCategory(e.target.value as any)}
                    className={`w-full border rounded-xl py-2.5 px-3.5 text-xs font-medium outline-none cursor-pointer ${
                      isDark ? 'bg-[#1E293B] border-slate-600 text-white focus:border-teal-400 focus:ring-2 focus:ring-teal-500/30' : 'bg-slate-50 border-slate-300 text-black focus:border-[#00897B] focus:bg-white'
                    }`}
                  >
                    <option value="CN_New" className={isDark ? 'bg-[#1E293B] text-white' : 'bg-white text-black'}>CN New</option>
                    <option value="CN_Old" className={isDark ? 'bg-[#1E293B] text-white' : 'bg-white text-black'}>CHINA Old</option>
                    <option value="KR_New" className={isDark ? 'bg-[#1E293B] text-white' : 'bg-white text-black'}>KR New</option>
                    <option value="KR_Old" className={isDark ? 'bg-[#1E293B] text-white' : 'bg-white text-black'}>Korea Old</option>
                    <option value="JP_New" className={isDark ? 'bg-[#1E293B] text-white' : 'bg-white text-black'}>JP New</option>
                    <option value="Other" className={isDark ? 'bg-[#1E293B] text-white' : 'bg-white text-black'}>Other</option>
                  </select>
                </div>

                {/* Target Stage Selection */}
                <div className="space-y-1">
                  <label className={`text-xs font-semibold block ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {isBn ? 'কাস্টমার কোন টেবিলে যুক্ত হবে? (Target Table Stage) *' : 'Target Table Stage *'}
                  </label>
                  <select
                    value={initialCategory}
                    onChange={(e) => setInitialCategory(e.target.value as any)}
                    className={`w-full border rounded-xl py-2.5 px-3.5 text-xs font-medium outline-none cursor-pointer ${
                      isDark ? 'bg-[#1E293B] border-slate-600 text-white focus:border-teal-400 focus:ring-2 focus:ring-teal-500/30' : 'bg-slate-50 border-slate-300 text-black focus:border-[#00897B] focus:bg-white'
                    }`}
                  >
                    <option value="followup" className={isDark ? 'bg-[#1E293B] text-white' : 'bg-white text-black'}>🔴 ফলো আপ কাস্টমার (Follow Up Table)</option>
                    <option value="order_complete" className={isDark ? 'bg-[#1E293B] text-white' : 'bg-white text-black'}>🔵 নতুন কাস্টমার (New Customer Table)</option>
                    <option value="important_regular" className={isDark ? 'bg-[#1E293B] text-white' : 'bg-white text-black'}>⚫ রেগুলার কাস্টমার (Regular Customer Table)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 5: Inquiry Notes */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2 border-b pb-2 border-slate-700/60">
                <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-md ${
                  isDark ? 'bg-[#00897B] text-white shadow-xs' : 'bg-teal-500/10 text-[#00897B] border border-teal-500/20'
                }`}>
                  SECTION 5
                </span>
                <h4 className={`text-xs font-bold uppercase tracking-wider ${
                  isDark ? 'text-teal-300' : 'text-slate-900'
                }`}>
                  {isBn ? 'নোট বা ইনকোয়ারি তথ্য (Notes)' : 'Inquiry / Notes'}
                </h4>
              </div>

              <textarea
                rows={2.5}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Guangzhou air freight quote given $8.5/kg. Flight expected next Monday..."
                className={`w-full border rounded-xl py-2.5 px-3.5 text-xs font-medium outline-none transition-all ${
                  isDark
                    ? 'bg-[#1E293B] border-slate-600 text-white placeholder:text-slate-300 focus:border-teal-400 focus:ring-2 focus:ring-teal-500/30'
                    : 'bg-slate-50 border-slate-300 text-black placeholder:text-slate-500 focus:border-[#00897B] focus:ring-2 focus:ring-[#00897B]/20 focus:bg-white'
                }`}
              />
            </div>

            {/* Action Submit Button Bar */}
            <div className="pt-4 border-t border-slate-700/80 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setCustomerCustomId('');
                  setShippingMark('');
                  setName('');
                  setPhone('');
                  setCompanyName('');
                  setEmail('');
                  setAddress('');
                  setProductType('');
                  setEstWeight('');
                  setSocialLink('');
                  setNotes('');
                }}
                className={`py-2.5 px-5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  isDark
                    ? 'bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200'
                    : 'border border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {isBn ? 'রিসেট ফর্ম' : 'Reset Form'}
              </button>
              <button
                type="submit"
                className="py-2.5 px-7 rounded-xl bg-gradient-to-r from-[#00897B] to-[#00796B] hover:from-[#00796B] hover:to-[#00695C] active:scale-95 text-white font-semibold text-xs shadow-lg hover:shadow-teal-900/40 flex items-center space-x-2 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 text-white" />
                <span>{isBn ? 'কাস্টমার সেভ করুন' : 'Save & Onboard Customer'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* VIEW 2, 3, 4: FULL WIDTH CUSTOMER STAGE TABLES ONLY (SOFT LIGHT TYPOGRAPHY & FIXED INQUIRY NOTES BACKGROUND) */}
      {activeStageTab !== 'create_customer' && (
        <div className="space-y-3.5 w-full">
          {/* Header Info & Country Filters Bar */}
          <div className={`border rounded-xl p-4 shadow-sm space-y-3 ${
            isDark ? 'bg-[#1E293B] border-slate-700 text-white' : 'bg-white border-slate-400 text-black'
          }`}>
            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3 ${
              isDark ? 'border-slate-700' : 'border-slate-300'
            }`}>
              <div className="flex items-center space-x-2.5">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs ${
                  activeStageTab === 'followup' ? 'bg-rose-500' : activeStageTab === 'order_complete' ? 'bg-blue-600' : 'bg-slate-700'
                }`}>
                  {activeStageTab === 'followup' && '🔴'}
                  {activeStageTab === 'order_complete' && '🔵'}
                  {activeStageTab === 'important_regular' && '⚫'}
                </div>
                <div>
                  <h3 className={`text-xs font-semibold flex items-center space-x-2 ${
                    isDark ? 'text-white' : 'text-black'
                  }`}>
                    <span>
                      {activeStageTab === 'followup' && (isBn ? '🔴 ফলো আপ কাস্টমার ডাটা টেবিল (Follow-Up)' : 'Follow-Up Customer Table')}
                      {activeStageTab === 'order_complete' && (isBn ? '🔵 নতুন কাস্টমার ডাটা টেবিল (New Customer)' : 'New Customer Table')}
                      {activeStageTab === 'important_regular' && (isBn ? '⚫ রেগুলার কাস্টমার ডাটা টেবিল (Regular Customer)' : 'Regular Customer Table')}
                    </span>
                  </h3>
                  <p className={`text-[11px] font-normal mt-0.5 ${
                    isDark ? 'text-slate-300' : 'text-black/80'
                  }`}>
                    {activeStageTab === 'followup' && (isBn ? 'ফলো আপ থেকে পরবর্তীতে "নতুন কাস্টমারে" কনভার্ট করা যাবে' : 'Convert to New Customer upon booking')}
                    {activeStageTab === 'order_complete' && (isBn ? 'নতুন কাস্টমার থেকে পরবর্তীতে "রেগুলার কাস্টমারে" কনভার্ট করা যাবে' : 'Convert to Regular Customer upon repeat bookings')}
                    {activeStageTab === 'important_regular' && (isBn ? 'শুধুমাত্র এখান থেকেই অপারেশনে হ্যান্ড ওভার সম্পন্ন করা যাবে' : 'Handover to operations allowed here only')}
                  </p>
                </div>
              </div>

              <span className={`text-xs font-mono px-3 py-1 rounded-lg border font-medium self-start sm:self-auto ${
                isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-100 border-slate-400 text-black'
              }`}>
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
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      selectedCountryTab === tab.id
                        ? isDark ? 'bg-teal-600 text-white shadow-sm' : 'bg-black text-white shadow-sm'
                        : isDark ? 'bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700' : 'bg-white border border-slate-400 text-black hover:bg-slate-100'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative">
                <Search className={`w-3.5 h-3.5 absolute left-3 top-2.5 ${isDark ? 'text-slate-400' : 'text-black'}`} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isBn ? 'নাম, ফোন বা কোম্পানি...' : 'Search name/phone/company...'}
                  className={`pl-8 pr-3 py-1.5 border rounded-lg text-xs font-medium outline-none transition-all ${
                    isDark ? 'bg-[#1E293B] border-slate-700 text-white placeholder:text-slate-400 focus:border-[#00897B] focus:ring-1 focus:ring-[#00897B]' : 'bg-white border-slate-400 text-black placeholder:text-slate-600 focus:border-[#00897B] focus:ring-1 focus:ring-[#00897B]'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* STAGE TABLE */}
          <div className={`border rounded-xl shadow-sm overflow-hidden ${
            isDark ? 'bg-[#1E293B] border-slate-700 text-white' : 'bg-white border-slate-400 text-black'
          }`}>
            {filteredCustomers.length === 0 ? (
              <div className="text-center py-14 px-4">
                <Users className={`w-9 h-9 mx-auto mb-2 ${isDark ? 'text-slate-500' : 'text-slate-600'}`} />
                <h4 className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-black'}`}>
                  {isBn ? 'এই ট্যাবে কোনো কাস্টমার ডাটা পাওয়া যায়নি' : 'No customer records in this section'}
                </h4>
                <p className={`text-xs font-normal mt-1 ${isDark ? 'text-slate-400' : 'text-black/80'}`}>
                  {isBn ? 'বাম সাইডবারের "➕ নতুন কাস্টমার তৈরি" মেনুতে গিয়ে কাস্টমার এন্ট্রি দিন' : 'Use "➕ Create Customer" tab to onboard clients'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse font-normal">
                  <thead className={`border-b ${isDark ? 'bg-[#1E293B]/90 border-slate-700 text-slate-200 font-semibold' : 'bg-slate-100 border-slate-400 text-black font-semibold'}`}>
                    <tr>
                      <th className="py-2.5 px-3.5 font-semibold">#</th>
                      <th className="py-2.5 px-3.5 font-semibold">{isBn ? 'কাস্টমার নাম ও যোগাযোগ' : 'Customer & Contact'}</th>
                      <th className="py-2.5 px-3.5 font-semibold">{isBn ? 'অনবোর্ডিং ক্যাটাগরি' : 'Sheet Category'}</th>
                      <th className="py-2.5 px-3.5 font-semibold">{isBn ? 'ইনকোয়ারি নোটস ও কার্গো ইনফো' : 'Inquiry Notes & Cargo Info'}</th>
                      <th className="py-2.5 px-3.5 font-semibold">{isBn ? 'অনবোর্ডার এক্সিকিউটিভ' : 'CRM Executive'}</th>
                      <th className="py-2.5 px-3.5 font-semibold text-right">{isBn ? 'স্টেজ রূপান্তর ও হ্যান্ড ওভার' : 'Action / Handover'}</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-slate-800 border-slate-700' : 'divide-slate-200 border-slate-300'}`}>
                    {filteredCustomers.map((cust, idx) => (
                      <tr key={cust.id} className={isDark ? 'hover:bg-[#1E293B]/50 transition-colors' : 'hover:bg-slate-50 transition-colors'}>
                        <td className={`py-3 px-3.5 font-mono font-medium ${isDark ? 'text-slate-400' : 'text-black'}`}>
                          {idx + 1}
                        </td>
                        <td className="py-3 px-3.5">
                          <div className="space-y-0.5">
                            <p className={`font-semibold text-xs flex flex-wrap items-center gap-1.5 ${isDark ? 'text-white' : 'text-black'}`}>
                              <span>{cust.name}</span>
                              {cust.customer_custom_id && (
                                <span className={`text-[10px] font-mono font-medium px-1.5 py-0.2 rounded border ${isDark ? 'bg-teal-950/80 text-teal-300 border-teal-800' : 'bg-teal-50 text-teal-900 border-teal-300'}`}>
                                  🆔 {cust.customer_custom_id}
                                </span>
                              )}
                              {cust.shipping_mark && (
                                <span className={`text-[10px] font-mono font-medium px-1.5 py-0.2 rounded border ${isDark ? 'bg-amber-950/80 text-amber-300 border-amber-800' : 'bg-amber-50 text-amber-900 border-amber-300'}`}>
                                  🏷️ {cust.shipping_mark}
                                </span>
                              )}
                              {cust.company_name && (
                                <span className={`text-[10px] font-medium px-1.5 py-0.2 rounded border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-400 text-black'}`}>
                                  🏢 {cust.company_name}
                                </span>
                              )}
                            </p>
                            <p className={`text-[11px] font-mono font-medium flex items-center space-x-1 ${isDark ? 'text-teal-400' : 'text-teal-800'}`}>
                              <Phone className={`w-3 h-3 ${isDark ? 'text-teal-400' : 'text-teal-700'}`} />
                              <span>{cust.phone}</span>
                            </p>
                            {cust.address && (
                              <p className={`text-[10px] font-normal flex items-center space-x-1 ${isDark ? 'text-slate-300' : 'text-black/90'}`}>
                                <MapPin className={`w-2.5 h-2.5 ${isDark ? 'text-slate-400' : 'text-black'}`} />
                                <span>{cust.address}</span>
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3.5">
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-black dark:text-slate-300 font-mono font-medium rounded-md border border-slate-400 dark:border-slate-700 text-[11px]">
                            🏷️ {cust.country_category}
                          </span>
                        </td>

                        {/* INQUIRY NOTES COLUMN (100% EXPLICIT LIGHT/DARK STYLING) */}
                        <td className="py-3 px-3.5 max-w-xs">
                          <div className={`p-2.5 rounded-lg border space-y-1 ${
                            isDark
                              ? 'bg-slate-800/90 border-slate-700 text-slate-100'
                              : 'bg-slate-100 border-slate-400 text-black'
                          }`}>
                            {cust.notes ? (
                              <p className={`text-[11px] font-medium leading-relaxed ${
                                isDark ? 'text-slate-100' : 'text-black'
                              }`}>
                                {cust.notes}
                              </p>
                            ) : (
                              <span className="text-black/60 italic text-[11px]">নির্ধারিত নোট নেই</span>
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
