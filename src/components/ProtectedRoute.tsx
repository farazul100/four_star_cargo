import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { UserRole } from '../types';

interface ProtectedRouteProps {
  allowedRole: UserRole;
  loginPath: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRole, loginPath }) => {
  const { user, role } = useAuth();

  if (!user) {
    return <Navigate to={loginPath} replace />;
  }

  if (role !== allowedRole) {
    // Redirect to proper role dashboard or login
    switch (role) {
      case 'super_admin':
        return <Navigate to="/admin/dashboard" replace />;
      case 'operation_director':
        return <Navigate to="/operations/dashboard" replace />;
      case 'warehouse_incharge':
        return <Navigate to="/warehouse/dashboard" replace />;
      case 'accountant':
        return <Navigate to="/accounts/dashboard" replace />;
      case 'crm_executive':
        return <Navigate to="/crm/dashboard" replace />;
      default:
        return <Navigate to="/" replace />;
    }
  }

  return <Outlet />;
};
