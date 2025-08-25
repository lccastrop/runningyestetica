import { createContext, useState, useEffect } from 'react';
import type { ReactNode, Dispatch, SetStateAction } from 'react';
import axios from 'axios';
import { getApiUrl } from './api';


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
  // El valor por defecto aquí solo existe para la inicialización; casteamos para cumplir el tipo.
  setUser: (() => { }) as unknown as Dispatch<SetStateAction<User | null>>,
  logout: async () => { }
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const API_URL = getApiUrl();

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await axios.get(`${API_URL}/session`, { withCredentials: true });
        setUser(res.data.user || null);
      } catch {
        setUser(null);
      }
    };
    fetchSession();
  }, [API_URL]);

  const logout = async () => {
    await axios.get(`${API_URL}/session`, { withCredentials: true });
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
