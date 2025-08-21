import { useEffect, useState, type ReactNode } from 'react';
import axios from 'axios';
import { Navigate } from 'react-router-dom';

interface Props {
  children: ReactNode;
}

function RequireAdmin({ children }: Props) {
  const [status, setStatus] = useState<'loading' | 'allowed' | 'denied'>('loading');

  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await axios.get('http://localhost:3001/session', { withCredentials: true });
        if (res.data.user?.role === 'admin') {
          setStatus('allowed');
        } else {
          setStatus('denied');
        }
      } catch {
        setStatus('denied');
      }
    };
    checkSession();
  }, []);

  if (status === 'loading') {
    return <p>Verificando acceso...</p>;
  }

  if (status === 'denied') {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default RequireAdmin;