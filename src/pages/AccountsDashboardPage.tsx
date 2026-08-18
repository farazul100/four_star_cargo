import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/DashboardLayout';
import { AccountantDashboard } from '../components/AccountantDashboard';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';
import { getHostingerDbData } from '../lib/db';

export const AccountsDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { lang } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const getTabIdFromPath = (path: string): string => {
    if (path.includes('/profile')) return 'profile';
    if (path.includes('/notifications')) return 'notifications';
    if (path.includes('/ledger')) return 'ledger';
    if (path.includes('/reports')) return 'reports';
    return 'ledger';
  };

  const activeTab = getTabIdFromPath(location.pathname);

  const handleTabChange = (tabId: string) => {
    switch (tabId) {
      case 'profile':
        navigate('/accounts/profile');
        break;
      case 'ledger':
        navigate('/accounts/ledger');
        break;
      case 'notifications':
        navigate('/accounts/notifications');
        break;
      case 'reports':
        navigate('/accounts/reports');
        break;
      default:
        navigate('/accounts/dashboard');
        break;
    }
  };

  const dbData = getHostingerDbData();
  const [ledgerEntries, setLedgerEntries] = useState(dbData.ledgerEntries);
  const [customers, setCustomers] = useState(dbData.customers);
  const [expenses, setExpenses] = useState(dbData.expenses);

  if (!user) return null;

  const titles: Record<string, { title: string; subtitle: string }> = {
    ledger: {
      title: lang === 'bn' ? 'কাস্টমার লেজার ও ফাইনান্সিয়াল স্টেটমেন্ট' : 'Customer Ledger & Financial Directory',
      subtitle: lang === 'bn' ? 'কাস্টমার বকেয়া, রিসিভড পেমেন্ট ও রানিং ব্যালেন্স হিসাব' : 'Track customer outstanding dues, recorded payments & live running balance',
    },
    reports: {
      title: lang === 'bn' ? 'ফাইনান্সিয়াল অডিট রিপোর্টস ও স্টেটমেন্ট' : 'Financial Activity & Audit Reports',
      subtitle: lang === 'bn' ? 'তারিখ ভিত্তিক ফিল্টার এবং CSV রিপোর্ট এক্সপোর্ট' : 'Date-range filtered ledger activity statements with CSV export',
    },
    expenses: {
      title: lang === 'bn' ? 'কোম্পানি বাজেট ও খরচ ভাউচার ম্যানেজমেন্ট' : 'Company Budget & Expense Vouchers',
      subtitle: lang === 'bn' ? 'অ্যাকাউন্টস প্যানেল থেকে সমস্ত খরচের ভাউচার এন্ট্রি ও অনুমোদন' : 'Record and manage operational vouchers synced with Super Admin',
    },
  };

  const currentHeader = titles[activeTab] || titles.ledger;

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
      />
    </DashboardLayout>
  );
};
