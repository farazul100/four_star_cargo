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
    const saved = localStorage.getItem('fsc_active_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      localStorage.setItem('fsc_active_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('fsc_active_user');
    }
  }, [user]);

  const signIn = (authUser: User) => {
    setUser(authUser);
  };

  const signOut = async () => {
    setUser(null);
    localStorage.removeItem('fsc_active_user');
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
