import { useState, useEffect } from 'react';
import axios from 'axios';

interface User {
  id: number;
  email: string;
  role: string;
}

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [user, setUser] = useState<User | null>(null);

  const iniciarSesion = async () => {
    try {
      const res = await axios.post('http://localhost:3001/login', { email, password }, { withCredentials: true });
      setUser(res.data.user);
      setMensaje('✅ Sesión iniciada');
        } catch (err: unknown) {
      const mensajeError =
        axios.isAxiosError(err) && err.response?.data?.error
          ? err.response.data.error
          : '❌ Error al iniciar sesión';
      setMensaje(mensajeError);
      setUser(null);
    }
  };

  const verSesion = async () => {
    try {
      const res = await axios.get('http://localhost:3001/session', { withCredentials: true });
      setUser(res.data.user);
      setMensaje('📢 Sesión activa');
    } catch {
      setUser(null);
      setMensaje('⚠️ Sin sesión');
    }
  };

  const cerrarSesion = async () => {
    try {
      await axios.post('http://localhost:3001/logout', {}, { withCredentials: true });
      setUser(null);
      setMensaje('👋 Sesión cerrada');
    } catch {
      setMensaje('❌ Error al cerrar sesión');
    }
  };

  useEffect(() => {
    verSesion();
  }, []);

  return (
    <main className="main">
      <h2>Login</h2>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="campo"
      />
      <input
        type="password"
        placeholder="Contraseña"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="campo"
      />
      <div className="margen-top">
        <button onClick={iniciarSesion}>Iniciar sesión</button>
        <button onClick={verSesion} className="margen-izq">Ver sesión</button>
        <button onClick={cerrarSesion} className="margen-izq">Cerrar sesión</button>
      </div>
      {mensaje && <p className="margen-top">{mensaje}</p>}
      {user && (
        <p className="margen-top">
          Sesión de <strong>{user.email}</strong> (rol: {user.role})
        </p>
      )}
    </main>
  );
}

export default Login;