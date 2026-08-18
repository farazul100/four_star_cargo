import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/DashboardLayout';
import { SuperAdminDashboard } from '../components/SuperAdminDashboard';
import { useTranslation } from '../hooks/useTranslation';
import { getHostingerDbData, subscribeToDbUpdates } from '../lib/db';

export const AdminDashboardPage: React.FC = () => {
  const { lang } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  // Derive activeTab dynamically from current URL pathname slug
  const getTabIdFromPath = (path: string): string => {
    if (path.includes('/profile')) return 'profile';
    if (path.includes('/settings')) return 'settings';
    if (path.includes('/live-lifecycle')) return 'live_lifecycle';
    if (path.includes('/data-tracker')) return 'data_tracker';
    if (path.includes('/notifications')) return 'notifications';
    if (path.includes('/cartons')) return 'cartons';
    if (path.includes('/budget')) return 'budget';
    if (path.includes('/proposals')) return 'proposals';
    if (path.includes('/final-flying-list')) return 'final_flying_list';
    if (path.includes('/warehouses')) return 'warehouses';
    if (path.includes('/users')) return 'users';
    if (path.includes('/ledger')) return 'ledger';
    if (path.includes('/audit-logs')) return 'audit_logs';
    if (path.includes('/cargo-search')) return 'cargo_search';
    if (path.includes('/public-track') || path.includes('/tracking')) return 'public_track';
    return 'dashboard';
  };

  const activeTab = getTabIdFromPath(location.pathname);

  const handleTabChange = (tabId: string) => {
    switch (tabId) {
      case 'profile':
        navigate('/admin/profile');
        break;
      case 'settings':
        navigate('/admin/settings');
        break;
      case 'live_lifecycle':
        navigate('/admin/live-lifecycle');
        break;
      case 'dashboard':
        navigate('/admin/dashboard');
        break;
      case 'data_tracker':
        navigate('/admin/data-tracker');
        break;
      case 'notifications':
        navigate('/admin/notifications');
        break;
      case 'cartons':
        navigate('/admin/cartons');
        break;
      case 'budget':
        navigate('/admin/budget');
        break;
      case 'proposals':
        navigate('/admin/proposals');
        break;
      case 'final_flying_list':
        navigate('/admin/final-flying-list');
        break;
      case 'warehouses':
        navigate('/admin/warehouses');
        break;
      case 'users':
        navigate('/admin/users');
        break;
      case 'ledger':
        navigate('/admin/ledger');
        break;
      case 'audit_logs':
        navigate('/admin/audit-logs');
        break;
      case 'cargo_search':
        navigate('/admin/cargo-search');
        break;
      case 'public_track':
      case 'tracking':
        navigate('/admin/public-track');
        break;
      default:
        navigate('/admin/dashboard');
        break;
    }
  };

  const [proposals, setProposals] = useState(() => getHostingerDbData().proposals);
  const [cartons, setCartons] = useState(() => getHostingerDbData().cartons);
  const [warehouses, setWarehouses] = useState(() => getHostingerDbData().warehouses);
  const [users, setUsers] = useState(() => getHostingerDbData().users);
  const [auditLogs, setAuditLogs] = useState(() => getHostingerDbData().auditLogs);
  const [ledgerEntries, setLedgerEntries] = useState(() => getHostingerDbData().ledgerEntries);

  React.useEffect(() => {
    return subscribeToDbUpdates(() => {
      const db = getHostingerDbData();
      setProposals(db.proposals);
      setCartons(db.cartons);
      setWarehouses(db.warehouses);
      setUsers(db.users);
      setAuditLogs(db.auditLogs);
      setLedgerEntries(db.ledgerEntries);
    });
  }, []);

  const titles: Record<string, { title: string; subtitle: string }> = {
    dashboard: {
      title: '',
      subtitle: '',
    },
    data_tracker: {
      title: '',
      subtitle: '',
    },
    warehouses: {
      title: '',
      subtitle: '',
    },
    users: {
      title: '',
      subtitle: '',
    },
    cartons: {
      title: '',
      subtitle: '',
    },
    audit_logs: {
      title: lang === 'bn' ? 'সিস্টেম অডিট লগস (System Audit Logs)' : 'System Audit Trail & Security Logs',
      subtitle: lang === 'bn' ? 'কে, কখন, কি পরিবর্তন করেছে তার সম্পূর্ণ ডিজিটাল রেকর্ড' : 'Complete immutable record of all staff operations',
    },
    proposals: {
      title: '',
      subtitle: '',
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
      <SuperAdminDashboard
        activeTab={activeTab}
        proposals={proposals}
        warehouses={warehouses}
        setWarehouses={setWarehouses}
        users={users}
        setUsers={setUsers}
        cartons={cartons}
        auditLogs={auditLogs}
        ledgerEntries={ledgerEntries}
        language={lang}
      />
    </DashboardLayout>
  );
};
