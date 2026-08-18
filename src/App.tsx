import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { OperationsDashboardPage } from './pages/OperationsDashboardPage';
import { WarehouseDashboardPage } from './pages/WarehouseDashboardPage';
import { AccountsDashboardPage } from './pages/AccountsDashboardPage';
import { PublicTrackingPage } from './pages/PublicTrackingPage';
import { ProtectedRoute } from './components/ProtectedRoute';

export function App() {
  return (
    <Routes>
      {/* Public Landing & Role Selection */}
      <Route path="/" element={<LandingPage />} />

      {/* Public Customer Shipment Tracking */}
      <Route path="/track" element={<PublicTrackingPage />} />

      {/* Dedicated Role Login Screens */}
      <Route
        path="/admin/login"
        element={<LoginPage expectedRole="super_admin" targetDashboardRoute="/admin/dashboard" />}
      />
      <Route
        path="/operations/login"
        element={
          <LoginPage
            expectedRole="operation_director"
            targetDashboardRoute="/operations/dashboard"
          />
        }
      />
      <Route
        path="/warehouse/login"
        element={
          <LoginPage
            expectedRole="warehouse_incharge"
            targetDashboardRoute="/warehouse/dashboard"
          />
        }
      />
      <Route
        path="/accounts/login"
        element={<LoginPage expectedRole="accountant" targetDashboardRoute="/accounts/dashboard" />}
      />

      {/* Protected Super Admin Role Dashboards with Dedicated Slugs */}
      <Route element={<ProtectedRoute allowedRole="super_admin" loginPath="/admin/login" />}>
        <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
        <Route path="/admin/live-lifecycle" element={<AdminDashboardPage />} />
        <Route path="/admin/data-tracker" element={<AdminDashboardPage />} />
        <Route path="/admin/notifications" element={<AdminDashboardPage />} />
        <Route path="/admin/cartons" element={<AdminDashboardPage />} />
        <Route path="/admin/budget" element={<AdminDashboardPage />} />
        <Route path="/admin/proposals" element={<AdminDashboardPage />} />
        <Route path="/admin/final-flying-list" element={<AdminDashboardPage />} />
        <Route path="/admin/warehouses" element={<AdminDashboardPage />} />
        <Route path="/admin/users" element={<AdminDashboardPage />} />
        <Route path="/admin/ledger" element={<AdminDashboardPage />} />
        <Route path="/admin/audit-logs" element={<AdminDashboardPage />} />
        <Route path="/admin/public-track" element={<AdminDashboardPage />} />
        <Route path="/admin/cargo-search" element={<AdminDashboardPage />} />
        <Route path="/admin/search" element={<AdminDashboardPage />} />
        <Route path="/admin/*" element={<AdminDashboardPage />} />
      </Route>

      {/* Protected Operations Director Role Dashboards with Dedicated Slugs */}
      <Route
        element={
          <ProtectedRoute allowedRole="operation_director" loginPath="/operations/login" />
        }
      >
        <Route path="/operations/dashboard" element={<OperationsDashboardPage />} />
        <Route path="/operations/live-lifecycle" element={<OperationsDashboardPage />} />
        <Route path="/operations/data-tracker" element={<OperationsDashboardPage />} />
        <Route path="/operations/notifications" element={<OperationsDashboardPage />} />
        <Route path="/operations/proposals" element={<OperationsDashboardPage />} />
        <Route path="/operations/final-flying-list" element={<OperationsDashboardPage />} />
        <Route path="/operations/cartons" element={<OperationsDashboardPage />} />
        <Route path="/operations/cargo-search" element={<OperationsDashboardPage />} />
        <Route path="/operations/search" element={<OperationsDashboardPage />} />
        <Route path="/operations/*" element={<OperationsDashboardPage />} />
      </Route>

      {/* Protected Warehouse Incharge Role Dashboards with Dedicated Slugs */}
      <Route
        element={
          <ProtectedRoute allowedRole="warehouse_incharge" loginPath="/warehouse/login" />
        }
      >
        <Route path="/warehouse/dashboard" element={<WarehouseDashboardPage />} />
        <Route path="/warehouse/booking" element={<WarehouseDashboardPage />} />
        <Route path="/warehouse/inventory" element={<WarehouseDashboardPage />} />
        <Route path="/warehouse/notifications" element={<WarehouseDashboardPage />} />
        <Route path="/warehouse/final-flying-list" element={<WarehouseDashboardPage />} />
        <Route path="/warehouse/cargo-search" element={<WarehouseDashboardPage />} />
        <Route path="/warehouse/search" element={<WarehouseDashboardPage />} />
        <Route path="/warehouse/*" element={<WarehouseDashboardPage />} />
      </Route>

      {/* Protected Accountant Role Dashboards with Dedicated Slugs */}
      <Route element={<ProtectedRoute allowedRole="accountant" loginPath="/accounts/login" />}>
        <Route path="/accounts/dashboard" element={<AccountsDashboardPage />} />
        <Route path="/accounts/ledger" element={<AccountsDashboardPage />} />
        <Route path="/accounts/budget" element={<AccountsDashboardPage />} />
        <Route path="/accounts/reports" element={<AccountsDashboardPage />} />
        <Route path="/accounts/cash-collections" element={<AccountsDashboardPage />} />
        <Route path="/accounts/notifications" element={<AccountsDashboardPage />} />
        <Route path="/accounts/search" element={<AccountsDashboardPage />} />
        <Route path="/accounts/cargo-search" element={<AccountsDashboardPage />} />
        <Route path="/accounts/*" element={<AccountsDashboardPage />} />
      </Route>

      {/* Fallback redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
