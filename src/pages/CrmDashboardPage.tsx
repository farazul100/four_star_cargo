import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/DashboardLayout';
import { CrmManagementSystem } from '../components/CrmManagementSystem';
import { CargoSearchTracker } from '../components/CargoSearchTracker';
import { UserProfileSettings } from '../components/UserProfileSettings';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';
import { useTheme } from '../context/ThemeContext';
import { getHostingerDbData } from '../lib/db';

export const CrmDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { lang, setLang } = useTranslation();
  const { theme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const getTabIdFromPath = (path: string): string => {
    if (path.includes('/profile')) return 'profile';
    if (path.includes('/notifications')) return 'notifications';
    if (path.includes('/search') || path.includes('/cargo-search') || path.includes('/tracking')) return 'cargo_search';
    return 'dashboard';
  };

  const activeTab = getTabIdFromPath(location.pathname);

  const handleTabChange = (tabId: string) => {
    switch (tabId) {
      case 'profile':
        navigate('/crm/profile');
        break;
      case 'notifications':
        navigate('/crm/notifications');
        break;
      case 'cargo_search':
      case 'public_track':
        navigate('/crm/search');
        break;
      default:
        navigate('/crm/dashboard');
        break;
    }
  };

  if (!user) return null;

  return (
    <DashboardLayout
      activeTab={activeTab}
      setActiveTab={handleTabChange}
      pageTitle={lang === 'bn' ? 'কাস্টমার রিলেশনশিপ ম্যানেজমেন্ট (CRM Panel)' : 'Customer Relationship Management'}
      pageSubtitle={lang === 'bn' ? 'কাস্টমার অনবোর্ডিং, ফলোআপ এবং হ্যান্ড ওভার হাব' : 'Customer onboarding, follow-up status pipeline & handover hub'}
    >
      {activeTab === 'profile' ? (
        <UserProfileSettings currentUser={user} language={lang} setLanguage={setLang} theme={theme} />
      ) : activeTab === 'cargo_search' ? (
        <CargoSearchTracker cartons={getHostingerDbData().cartons} proposals={getHostingerDbData().proposals} language={lang} />
      ) : (
        <CrmManagementSystem currentUser={user} language={lang} />
      )}
    </DashboardLayout>
  );
};
