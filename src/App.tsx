import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { OperationsDashboardPage } from './pages/OperationsDashboardPage';
import { WarehouseDashboardPage } from './pages/WarehouseDashboardPage';
import { AccountsDashboardPage } from './pages/AccountsDashboardPage';
import { CrmDashboardPage } from './pages/CrmDashboardPage';
import { PublicTrackingPage } from './pages/PublicTrackingPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuthContext } from './context/AuthContext';
import { useTranslation } from './hooks/useTranslation';
import { initHostingerDb, fetchServerDbAndSync } from './lib/db';

const getRoleDashboardRoute = (role?: string): string | null => {
  switch (role) {
    case 'super_admin':
      return '/admin/dashboard';
    case 'operation_director':
      return '/operations/dashboard';
    case 'warehouse_incharge':
      return '/warehouse/dashboard';
    case 'accountant':
      return '/accounts/dashboard';
    case 'crm_executive':
      return '/crm/dashboard';
    default:
      return null;
  }
};

export function App() {
  const { user } = useAuthContext();
  const { lang } = useTranslation();

  useEffect(() => {
    initHostingerDb();
    fetchServerDbAndSync();
  }, []);

  const userDashboardRoute = user ? getRoleDashboardRoute(user.role) : null;

  return (
    <>
      <Routes>
        {/* Public Landing & Role Selection — Auto-redirects if already logged in */}
        <Route
          path="/"
          element={
            userDashboardRoute ? <Navigate to={userDashboardRoute} replace /> : <LandingPage />
          }
        />

        {/* Public Customer Shipment Tracking (Unauthenticated Public Portal) */}
        <Route path="/track" element={<PublicTrackingPage />} />
        <Route path="/tracking" element={<PublicTrackingPage />} />
        <Route path="/cargo-track" element={<PublicTrackingPage />} />
        <Route path="/public-search" element={<PublicTrackingPage />} />

        {/* Dedicated Role Login Screens — Auto-redirects if already logged in */}
        <Route
          path="/admin/login"
          element={
            userDashboardRoute ? (
              <Navigate to={userDashboardRoute} replace />
            ) : (
              <LoginPage expectedRole="super_admin" targetDashboardRoute="/admin/dashboard" />
            )
          }
        />
        <Route
          path="/operations/login"
          element={
            userDashboardRoute ? (
              <Navigate to={userDashboardRoute} replace />
            ) : (
              <LoginPage
                expectedRole="operation_director"
                targetDashboardRoute="/operations/dashboard"
              />
            )
          }
        />
        <Route
          path="/warehouse/login"
          element={
            userDashboardRoute ? (
              <Navigate to={userDashboardRoute} replace />
            ) : (
              <LoginPage
                expectedRole="warehouse_incharge"
                targetDashboardRoute="/warehouse/dashboard"
              />
            )
          }
        />
        <Route
          path="/accounts/login"
          element={
            userDashboardRoute ? (
              <Navigate to={userDashboardRoute} replace />
            ) : (
              <LoginPage expectedRole="accountant" targetDashboardRoute="/accounts/dashboard" />
            )
          }
        />

        {/* Protected Super Admin Role Dashboards with Dedicated Slugs */}
        <Route element={<ProtectedRoute allowedRole="super_admin" loginPath="/admin/login" />}>
          <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
          <Route path="/admin/cartons" element={<AdminDashboardPage />} />
          <Route path="/admin/proposals" element={<AdminDashboardPage />} />
          <Route path="/admin/users" element={<AdminDashboardPage />} />
          <Route path="/admin/warehouses" element={<AdminDashboardPage />} />
          <Route path="/admin/ledger" element={<AdminDashboardPage />} />
          <Route path="/admin/expenses" element={<AdminDashboardPage />} />
          <Route path="/admin/crm" element={<AdminDashboardPage />} />
          <Route path="/admin/chat" element={<AdminDashboardPage />} />
          <Route path="/admin/settings" element={<AdminDashboardPage />} />
          <Route path="/admin/audit" element={<AdminDashboardPage />} />
          <Route path="/admin/analytics" element={<AdminDashboardPage />} />
          <Route path="/admin/reports font-mono" element={<AdminDashboardPage />} />
          <Route path="/admin/search" element={<AdminDashboardPage />} />
          <Route path="/admin/notifications" element={<AdminDashboardPage />} />
          <Route path="/admin/*" element={<AdminDashboardPage />} />
        </Route>

        {/* Protected Operation Director Role Dashboards with Dedicated Slugs */}
        <Route element={<ProtectedRoute allowedRole="operation_director" loginPath="/operations/login" />}>
          <Route path="/operations/dashboard" element={<OperationsDashboardPage />} />
          <Route path="/operations/proposals" element={<OperationsDashboardPage />} />
          <Route path="/operations/cartons" element={<OperationsDashboardPage />} />
          <Route path="/operations/chat" element={<OperationsDashboardPage />} />
          <Route path="/operations/analytics" element={<OperationsDashboardPage />} />
          <Route path="/operations/audit" element={<OperationsDashboardPage />} />
          <Route path="/operations/search" element={<OperationsDashboardPage />} />
          <Route path="/operations/notifications" element={<OperationsDashboardPage />} />
          <Route path="/operations/*" element={<OperationsDashboardPage />} />
        </Route>

        {/* Protected Warehouse Incharge Role Dashboards with Dedicated Slugs */}
        <Route element={<ProtectedRoute allowedRole="warehouse_incharge" loginPath="/warehouse/login" />}>
          <Route path="/warehouse/dashboard" element={<WarehouseDashboardPage />} />
          <Route path="/warehouse/cartons" element={<WarehouseDashboardPage />} />
          <Route path="/warehouse/chat" element={<WarehouseDashboardPage />} />
          <Route path="/warehouse/search" element={<WarehouseDashboardPage />} />
          <Route path="/warehouse/receive" element={<WarehouseDashboardPage />} />
          <Route path="/warehouse/deliveries" element={<WarehouseDashboardPage />} />
          <Route path="/warehouse/notifications" element={<WarehouseDashboardPage />} />
          <Route path="/warehouse/*" element={<WarehouseDashboardPage />} />
        </Route>

        {/* Protected Accountant Role Dashboards with Dedicated Slugs */}
        <Route element={<ProtectedRoute allowedRole="accountant" loginPath="/accounts/login" />}>
          <Route path="/accounts/dashboard" element={<AccountsDashboardPage />} />
          <Route path="/accounts/chat" element={<AccountsDashboardPage />} />
          <Route path="/accounts/ledger" element={<AccountsDashboardPage />} />
          <Route path="/accounts/budget" element={<AccountsDashboardPage />} />
          <Route path="/accounts/reports" element={<AccountsDashboardPage />} />
          <Route path="/accounts/cash-collections" element={<AccountsDashboardPage />} />
          <Route path="/accounts/notifications" element={<AccountsDashboardPage />} />
          <Route path="/accounts/search" element={<AccountsDashboardPage />} />
          <Route path="/accounts/cargo-search" element={<AccountsDashboardPage />} />
          <Route path="/accounts/*" element={<AccountsDashboardPage />} />
        </Route>

        {/* Protected CRM Executive Role Dashboards with Dedicated Slugs */}
        <Route element={<ProtectedRoute allowedRole="crm_executive" loginPath="/operations/login" />}>
          <Route path="/crm/dashboard" element={<CrmDashboardPage />} />
          <Route path="/crm/chat" element={<CrmDashboardPage />} />
          <Route path="/crm/profile" element={<CrmDashboardPage />} />
          <Route path="/crm/search" element={<CrmDashboardPage />} />
          <Route path="/crm/notifications" element={<CrmDashboardPage />} />
          <Route path="/crm/*" element={<CrmDashboardPage />} />
        </Route>

        {/* Fallback redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default App;
