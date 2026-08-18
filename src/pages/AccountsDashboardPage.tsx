import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/DashboardLayout';
import { AccountantDashboard } from '../components/AccountantDashboard';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';
import { getHostingerDbData, subscribeToDbUpdates } from '../lib/db';

export const AccountsDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { lang } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const getTabIdFromPath = (path: string): string => {
    if (path.includes('/profile')) return 'profile';
    if (path.includes('/notifications')) return 'notifications';
    if (path.includes('/ledger') || path.includes('/customer_ledger')) return 'ledger';
    if (path.includes('/budget') || path.includes('/expenses')) return 'expenses';
    if (path.includes('/reports')) return 'reports';
    if (path.includes('/cash-collections')) return 'cash_collections';
    return 'dashboard';
  };

  const activeTab = getTabIdFromPath(location.pathname);

  const handleTabChange = (tabId: string) => {
    switch (tabId) {
      case 'profile':
        navigate('/accounts/profile');
        break;
      case 'ledger':
      case 'customer_ledger':
        navigate('/accounts/ledger');
        break;
      case 'budget':
      case 'expenses':
        navigate('/accounts/budget');
        break;
      case 'notifications':
        navigate('/accounts/notifications');
        break;
      case 'reports':
        navigate('/accounts/reports');
        break;
      case 'cash_collections':
        navigate('/accounts/cash-collections');
        break;
      default:
        navigate('/accounts/dashboard');
        break;
    }
  };

  const [ledgerEntries, setLedgerEntries] = useState(() => getHostingerDbData().ledgerEntries);
  const [customers, setCustomers] = useState(() => getHostingerDbData().customers);
  const [expenses, setExpenses] = useState(() => getHostingerDbData().expenses);

  React.useEffect(() => {
    return subscribeToDbUpdates(() => {
      const freshDb = getHostingerDbData();
      setLedgerEntries(freshDb.ledgerEntries);
      setCustomers(freshDb.customers);
      setExpenses(freshDb.expenses);
    });
  }, []);

  if (!user) return null;

  const titles: Record<string, { title: string; subtitle: string }> = {
    dashboard: {
      title: lang === 'bn' ? 'অ্যাকাউন্টস অ্যানালিটিক্স ও ফিনান্সিয়াল ওভারভিউ ড্যাশবোর্ড' : 'Accounts Analytics & Overview Dashboard',
      subtitle: lang === 'bn' ? 'আয়, বকেয়া, খরচ সিঙ্ক এবং ম্যানুয়াল হিসাব এন্ট্রি হাব' : 'Real-time financial analytics, dues monitoring & live expense sync with Super Admin',
    },
    ledger: {
      title: lang === 'bn' ? 'কাস্টমার লেজার ও ফাইনান্সিয়াল স্টেটমেন্ট' : 'Customer Ledger & Financial Directory',
      subtitle: lang === 'bn' ? 'কাস্টমার বকেয়া, রিসিভড পেমেন্ট ও রানিং ব্যালেন্স হিসাব' : 'Track customer outstanding dues, recorded payments & live running balance',
    },
    reports: {
      title: lang === 'bn' ? 'ফাইনান্সিয়াল অডিট রিপোর্টস ও স্টেটমেন্ট' : 'Financial Activity & Audit Reports',
      subtitle: lang === 'bn' ? 'তারিখ ভিত্তিক ফিল্টার এবং CSV রিপোর্ট এক্সপোর্ট' : 'Date-range filtered ledger activity statements with CSV export',
    },
    expenses: {
      title: lang === 'bn' ? 'কোম্পানি বাজেট ও খরচ ভাউচার (Super Admin Live Sync)' : 'Company Budget & Expense Vouchers',
      subtitle: lang === 'bn' ? 'অ্যাকাউন্টস প্যানেল থেকে খরচের ভাউচার এন্ট্রি যা সরাসরি সুপার এডমিনে সিঙ্ক হয়' : 'Record and manage operational vouchers live synced with Super Admin',
    },
    cash_collections: {
      title: lang === 'bn' ? 'ওয়্যারহাউজ ক্যাশ কালেকশন সিঙ্ক ও অডিট' : 'Warehouse Cash Collection Sync & Audit',
      subtitle: lang === 'bn' ? 'ডেলিভারিকৃত পার্সেলের ক্যাশ কালেকশন যাচাই ও লেজার ভেরিফিকেশন' : 'Audit and verify cash collected by warehouse staff from dispatches',
    },
  };

  const currentHeader = titles[activeTab] || titles.dashboard;

  return (
    <DashboardLayout
      activeTab={activeTab}
      setActiveTab={handleTabChange}
      pageTitle={currentHeader.title}
      pageSubtitle={currentHeader.subtitle}
    >
      <AccountantDashboard
        ledgerEntries={ledgerEntries}
        setLedgerEntries={setLedgerEntries}
        customers={customers}
        setCustomers={setCustomers}
        expenses={expenses}
        setExpenses={setExpenses}
        currentUser={user}
        language={lang}
        activeTab={activeTab}
      />
    </DashboardLayout>
  );
};
