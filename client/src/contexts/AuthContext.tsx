import { createContext, useContext, useState, ReactNode } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  login: (email: string, password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// 하드코딩된 관리자 계정
const ADMIN_CREDENTIALS = {
  email: 'info@firstregister.us',
  password: '6066',
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    // 페이지 로드 시 세션 확인
    return sessionStorage.getItem('isAdminLoggedIn') === 'true';
  });

  const login = (email: string, password: string): boolean => {
    if (email === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password) {
      setIsAuthenticated(true);
      sessionStorage.setItem('isAdminLoggedIn', 'true');
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('isAdminLoggedIn');
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
