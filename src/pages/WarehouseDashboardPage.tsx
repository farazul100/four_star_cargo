import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/DashboardLayout';
import { WarehouseInchargeDashboard } from '../components/WarehouseInchargeDashboard';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';
import { getHostingerDbData, subscribeToDbUpdates, formatWarehouseNameEn } from '../lib/db';

export const WarehouseDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { lang } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const getTabIdFromPath = (path: string): string => {
    if (path.includes('/profile')) return 'profile';
    if (path.includes('/chat') || path.includes('/system-chat')) return 'system_chat';
    if (path.includes('/notifications')) return 'notifications';
    if (path.includes('/booking')) return 'booking_entry';
    if (path.includes('/inventory')) return 'inventory';
    if (path.includes('/receive-incoming')) return 'receive_incoming';
    if (path.includes('/proposal-create')) return 'proposal_create';
    if (path.includes('/final-flying-list')) return 'final_flying_list';
    if (path.includes('/history')) return 'history';
    if (path.includes('/delivered')) return 'delivered_products';
    if (path.includes('/delivery-cash')) return 'delivery_cash';
    if (path.includes('/cargo-search')) return 'cargo_search';
    if (path.includes('/public-track') || path.includes('/tracking')) return 'public_track';
    return 'dashboard';
  };

  const activeTab = getTabIdFromPath(location.pathname);

  const handleTabChange = (tabId: string) => {
    switch (tabId) {
      case 'profile':
        navigate('/warehouse/profile');
        break;
      case 'system_chat':
        navigate('/warehouse/chat');
        break;
      case 'dashboard':
        navigate('/warehouse/dashboard');
        break;
      case 'notifications':
        navigate('/warehouse/notifications');
        break;
      case 'booking_entry':
        navigate('/warehouse/booking');
        break;
      case 'inventory':
        navigate('/warehouse/inventory');
        break;
      case 'receive_incoming':
        navigate('/warehouse/receive-incoming');
        break;
      case 'proposal_create':
        navigate('/warehouse/proposal-create');
        break;
      case 'final_flying_list':
      case 'final-flying-list':
        navigate('/warehouse/final-flying-list');
        break;
      case 'history':
        navigate('/warehouse/history');
        break;
      case 'delivered_products':
      case 'delivered':
        navigate('/warehouse/delivered');
        break;
      case 'delivery_cash':
        navigate('/warehouse/delivery-cash');
        break;
      case 'cargo_search':
      case 'public_track':
      case 'tracking':
        navigate('/warehouse/cargo-search');
        break;
      default:
        navigate('/warehouse/inventory');
        break;
    }
  };

  const [proposals, setProposals] = useState(() => getHostingerDbData().proposals);
  const [cartons, setCartons] = useState(() => getHostingerDbData().cartons);
  const [warehouses, setWarehouses] = useState(() => getHostingerDbData().warehouses);
  const [ledgerEntries, setLedgerEntries] = useState(() => getHostingerDbData().ledgerEntries);

  React.useEffect(() => {
    return subscribeToDbUpdates(() => {
      const db = getHostingerDbData();
      setProposals(db.proposals);
      setCartons(db.cartons);
      setWarehouses(db.warehouses);
      setLedgerEntries(db.ledgerEntries);
    });
  }, []);

  if (!user) return null;

  const myWh = warehouses.find((w) => w.id === user.warehouse_id);

  const titles: Record<string, { title: string; subtitle: string }> = {
    dashboard: {
      title: '',
      subtitle: '',
    },
    inventory: {
      title: lang === 'bn' ? `${formatWarehouseNameEn(myWh?.name)} ইনভেন্টরি পণ্য` : 'Warehouse Inventory Stock',
      subtitle: lang === 'bn' ? 'শুধুমাত্র আপনার ওয়্যারহাউজের স্টক ও কার্টুন ডাটা' : 'Live inventory stock scoped strictly to your assigned warehouse',
    },
    booking_entry: {
      title: '',
      subtitle: '',
    },
    receive_incoming: {
      title: lang === 'bn' ? 'ইনকামিং ট্রানজিট কার্গো গ্রহণ (Incoming Transit)' : 'Incoming Transit Receiving',
      subtitle: lang === 'bn' ? 'অন্যান্য ওয়্যারহাউজ থেকে আপনার এখানে আসা পরিবহন চিহ্নিত করুন' : 'Verify & mark incoming cargo arrived at your warehouse',
    },
    proposal_create: {
      title: '',
      subtitle: '',
    },
    delivery_cash: {
      title: lang === 'bn' ? 'বাংলাদেশ ওয়্যারহাউজ ডেলিভারি ও ক্যাশ কালেকশন' : 'Destination Delivery & Cash Collection',
      subtitle: lang === 'bn' ? 'গ্রাহককে ডেলিভারি দেওয়া ও সংগৃহীত নগদ অর্থ লেজারে অটো-সিঙ্ক করা' : 'Deliver packages to customers & auto-sync cash collection to financial ledger',
    },
    cargo_search: {
      title: lang === 'bn' ? 'গ্লোবাল কার্গো ট্র্যাকিং সার্চ পোর্টাল' : 'Global Cargo Tracking Search Portal',
      subtitle: lang === 'bn' ? 'আপনার ট্র্যাকিং নম্বর (Tracking ID) দিন — এই আইডির অধীন চায়না ওয়্যারহাউজ, ফ্লাইটিং ও বাংলাদেশ এয়ারপোর্টে কোন কোন কার্টুন রয়েছে তা একসাথে স্পষ্ট ফুটে উঠবে।' : 'Enter Tracking ID to trace all cartons across China warehouse, mid-air flights, and BD hub.',
    },
  };

  const currentHeader = titles[activeTab] || { title: '', subtitle: '' };

  return (
    <DashboardLayout
      activeTab={activeTab}
      setActiveTab={handleTabChange}
      pageTitle={currentHeader.title}
      pageSubtitle={currentHeader.subtitle}
    >
      <WarehouseInchargeDashboard
        activeTab={activeTab}
        cartons={cartons}
        setCartons={setCartons}
        warehouses={warehouses}
        currentUser={user}
        setLedgerEntries={setLedgerEntries}
        language={lang}
      />
    </DashboardLayout>
  );
};
