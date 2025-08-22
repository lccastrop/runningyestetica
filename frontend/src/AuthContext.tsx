import { createContext, useState, useEffect, type ReactNode, Dispatch, SetStateAction } from 'react';
import axios from 'axios';

export interface User {
  id: number;
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  setUser: Dispatch<SetStateAction<User | null>>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  setUser: () => {},
  logout: async () => {}
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await axios.get('http://localhost:3001/session', { withCredentials: true });
        setUser(res.data.user || null);
      } catch {
        setUser(null);
      }
    };
    fetchSession();
  }, []);

  const logout = async () => {
    await axios.post('http://localhost:3001/logout', {}, { withCredentials: true });
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}