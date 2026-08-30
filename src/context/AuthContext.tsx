import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { INITIAL_USERS } from '../mockData';

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
    localStorage.removeItem('fsc_active_user');
    sessionStorage.removeItem('fsc_active_user');
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
