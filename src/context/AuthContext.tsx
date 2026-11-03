import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api.js';

export interface User {
  user_id: number;
  username: string;
  full_name: string;
  email: string | null;
  phone_number?: string | null;
  role: 'admin' | 'editor' | 'viewer';
  department: string | null;
  position: string | null;
  profile_photo: string | null;
  status: string;
  last_login_at?: string | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  isEditor: boolean;
  canEdit: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('pms_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('pms_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function verifyUser() {
      if (token) {
        try {
          const res = await api.get('/auth/me');
          if (res.data?.success && res.data?.data) {
            setUser(res.data.data);
            localStorage.setItem('pms_user', JSON.stringify(res.data.data));
          }
        } catch {
          // Token is expired or invalid - clear local session gracefully
          setUser(null);
          setToken(null);
          localStorage.removeItem('pms_token');
          localStorage.removeItem('pms_user');
        }
      }
      setIsLoading(false);
    }

    verifyUser();
  }, [token]);

  const login = async (username: string, password: string) => {
    try {
      const res = await api.post('/auth/login', { username, password });
      if (res.data.success && res.data.data) {
        const { token: newToken, user: newUser } = res.data.data;
        setToken(newToken);
        setUser(newUser);
        localStorage.setItem('pms_token', newToken);
        localStorage.setItem('pms_user', JSON.stringify(newUser));
        return { success: true, message: res.data.message };
      }
      return { success: false, message: res.data.message || 'ការចូលប្រើប្រាស់មិនជោគជ័យ' };
    } catch (err: any) {
      const msg = err.response?.data?.message || 'ឈ្មោះគណនី ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវ';
      return { success: false, message: msg };
    }
  };

  const logout = async () => {
    try {
      if (token) {
        await api.post('/auth/logout');
      }
    } catch (err) {
      console.warn('Logout API failed:', err);
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem('pms_token');
      localStorage.removeItem('pms_user');
    }
  };

  const isAdmin = user?.role === 'admin';
  const isEditor = user?.role === 'editor';
  const canEdit = isAdmin || isEditor;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        login,
        logout,
        isAdmin,
        isEditor,
        canEdit,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
