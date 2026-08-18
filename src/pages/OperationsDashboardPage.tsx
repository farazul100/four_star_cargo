import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/DashboardLayout';
import { OperationDirectorDashboard } from '../components/OperationDirectorDashboard';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';
import { getHostingerDbData, subscribeToDbUpdates } from '../lib/db';

export const OperationsDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { lang } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const getTabIdFromPath = (path: string): string => {
    if (path.includes('/profile')) return 'profile';
    if (path.includes('/live-lifecycle')) return 'live_lifecycle';
    if (path.includes('/data-tracker')) return 'data_tracker';
    if (path.includes('/notifications')) return 'notifications';
    if (path.includes('/proposals')) return 'proposals';
    if (path.includes('/final-flying-list')) return 'final_flying_list';
    if (path.includes('/cartons')) return 'cartons';
    if (path.includes('/history')) return 'history';
    if (path.includes('/analytics')) return 'analytics';
    if (path.includes('/cargo-search')) return 'cargo_search';
    if (path.includes('/tracking') || path.includes('/public-track')) return 'public_track';
    return 'dashboard';
  };

  const activeTab = getTabIdFromPath(location.pathname);

  const handleTabChange = (tabId: string) => {
    switch (tabId) {
      case 'profile':
        navigate('/operations/profile');
        break;
      case 'live_lifecycle':
        navigate('/operations/live-lifecycle');
        break;
      case 'dashboard':
        navigate('/operations/dashboard');
        break;
      case 'data_tracker':
        navigate('/operations/data-tracker');
        break;
      case 'notifications':
        navigate('/operations/notifications');
        break;
      case 'proposals':
        navigate('/operations/proposals');
        break;
      case 'final_flying_list':
        navigate('/operations/final-flying-list');
        break;
      case 'cartons':
        navigate('/operations/cartons');
        break;
      case 'history':
        navigate('/operations/history');
        break;
      case 'analytics':
        navigate('/operations/analytics');
        break;
      case 'cargo_search':
        navigate('/operations/cargo-search');
        break;
      case 'public_track':
      case 'tracking':
        navigate('/operations/tracking');
        break;
      default:
        navigate('/operations/dashboard');
        break;
    }
  };

  const [proposals, setProposals] = useState(() => getHostingerDbData().proposals);
  const [cartons, setCartons] = useState(() => getHostingerDbData().cartons);
  const [warehouses, setWarehouses] = useState(() => getHostingerDbData().warehouses);

  React.useEffect(() => {
    return subscribeToDbUpdates(() => {
      const db = getHostingerDbData();
      setProposals(db.proposals);
      setCartons(db.cartons);
      setWarehouses(db.warehouses);
    });
  }, []);

  if (!user) return null;

  const titles: Record<string, { title: string; subtitle: string }> = {
    dashboard: { title: '', subtitle: '' },
    proposals: { title: '', subtitle: '' },
    cartons: { title: '', subtitle: '' },
    history: { title: '', subtitle: '' },
    analytics: { title: '', subtitle: '' },
  };

  const currentHeader = titles[activeTab] || titles.proposals;

  return (
    <DashboardLayout
      activeTab={activeTab}
      setActiveTab={handleTabChange}
      pageTitle={currentHeader.title}
      pageSubtitle={currentHeader.subtitle}
    >
      <OperationDirectorDashboard
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        proposals={proposals}
        setProposals={setProposals}
        cartons={cartons}
        setCartons={setCartons}
        warehouses={warehouses}
        currentUser={user}
        language={lang}
      />
    </DashboardLayout>
  );
};
