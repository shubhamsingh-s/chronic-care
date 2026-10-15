import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '../types';
import { api, getToken, setToken, removeToken } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (token: string, user: User) => void;
  quickLogin: (email: string, pwd?: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(getToken());
  const [loading, setLoading] = useState<boolean>(true);

  const fetchSession = async () => {
    const existingToken = getToken();
    if (!existingToken) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const data = await api.getMe();
      setUser(data);
    } catch {
      removeToken();
      setTokenState(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, []);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setTokenState(newToken);
    setUser(newUser);
  };

  const quickLogin = async (email: string, pwd?: string) => {
    setLoading(true);
    try {
      // Default passwords from seed_data.py
      let password = pwd;
      if (!password) {
        if (email.startsWith('admin')) password = 'Admin@12345';
        else if (email.startsWith('dr.')) password = 'Doctor@12345';
        else password = 'Patient@12345';
      }
      const res = await api.login({ email, password });
      login(res.access_token, res.user);
      // Fetch full profile info
      const fullMe = await api.getMe();
      setUser(fullMe);
    } catch (err: any) {
      alert(`Login failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    try {
      api.logout();
    } catch {
      // ignore
    }
    removeToken();
    setTokenState(null);
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const data = await api.getMe();
      setUser(data);
    } catch {
      // ignore
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, quickLogin, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
