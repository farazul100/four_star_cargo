import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { INITIAL_USERS } from '../mockData';
import { getHostingerDbData } from '../lib/db';

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  warehouseId?: string;
  loading: boolean;
  signIn: (user: User) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const savedLocal = localStorage.getItem('fsc_active_user');
      if (savedLocal) {
        const parsed = JSON.parse(savedLocal);
        if (parsed && parsed.email) return parsed;
      }
      const savedSession = sessionStorage.getItem('fsc_active_user');
      if (savedSession) {
        const parsed = JSON.parse(savedSession);
        if (parsed && parsed.email) return parsed;
      }
    } catch (e) {
      console.error('Error restoring active user session:', e);
    }
    return null;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      // Validate active session against live database users list
      try {
        const dbUsers: User[] = getHostingerDbData().users || [];
        if (dbUsers.length > 0) {
          const match = dbUsers.find(
            (u) => u.id === user.id || (u.email && u.email.toLowerCase().trim() === user.email.toLowerCase().trim())
          );

          if (!match || match.status === 'inactive' || match.status === 'suspended') {
            console.warn('Active session invalidated: User account deleted or suspended.');
            setUser(null);
            localStorage.removeItem('fsc_active_user');
            sessionStorage.removeItem('fsc_active_user');
            return;
          }

          if (match.password !== user.password || match.role !== user.role) {
            setUser(match);
            localStorage.setItem('fsc_active_user', JSON.stringify(match));
            sessionStorage.setItem('fsc_active_user', JSON.stringify(match));
            return;
          }
        }
      } catch (e) {
        console.error('User session validation error:', e);
      }

      localStorage.setItem('fsc_active_user', JSON.stringify(user));
      sessionStorage.setItem('fsc_active_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('fsc_active_user');
      sessionStorage.removeItem('fsc_active_user');
    }
  }, [user]);

  const signIn = (authUser: User) => {
    setUser(authUser);
    localStorage.setItem('fsc_active_user', JSON.stringify(authUser));
    sessionStorage.setItem('fsc_active_user', JSON.stringify(authUser));
  };

  const signOut = async () => {
    setUser(null);
    try {
      localStorage.removeItem('fsc_active_user');
      sessionStorage.removeItem('fsc_active_user');
      localStorage.removeItem('active_user');
      sessionStorage.removeItem('active_user');
      localStorage.removeItem('user');
      sessionStorage.removeItem('user');
    } catch (e) {}
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };


  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || null,
        warehouseId: user?.warehouse_id,
        loading,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};
