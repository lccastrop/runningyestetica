import { useState, useEffect, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { api } from '../api';
import { AuthContext } from '../AuthContext';
import { auth, googleProvider } from '../firebaseConfig';
import { signInWithPopup } from 'firebase/auth';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mensaje, setMensaje] = useState('');
  const { user, setUser, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const iniciarSesion = async () => {
    if (!email || !password) {
      setMensaje('Rellena email y contraseña');
      return;
    }

    try {
      const res = await api.post('/login', { email, password });
      setUser(res.data.user);
      setMensaje('Sesión iniciada');
      navigate('/');
    } catch (err: unknown) {
      const mensajeError =
        axios.isAxiosError(err) && err.response?.data?.error
          ? err.response.data.error
          : 'Error al iniciar sesión: ' + (err as Error).message;
      setMensaje(mensajeError);
      setUser(null);
    }
  };

  const verSesion = async () => {
    try {
      const res = await api.get('/session');
      setUser(res.data.user);
      setMensaje('Sesión activa');
    } catch {
      setUser(null);
      setMensaje('Sin sesión');
    }
  };

  const cerrarSesion = async () => {
    try {
      await logout();
      setMensaje('Sesión cerrada');
    } catch {
      setMensaje('Error al cerrar sesión');
    }
  };

  const handleGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();
      const res = await api.post('/login-google', { idToken });
      setUser(res.data.user);
      setMensaje('Sesión iniciada con Google');
      navigate('/');
    } catch (error) {
      console.error('Error con Google:', error);
      const msg = axios.isAxiosError(error) && error.response?.data?.error
        ? error.response.data.error
        : 'No se pudo iniciar sesión con Google';
      setMensaje(msg);
    }
  };

  useEffect(() => {
    verSesion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="main">
      <h2>Login</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          iniciarSesion();
        }}
      >
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
          <button type="submit">Iniciar sesión</button>
          <button type="button" onClick={verSesion} className="margen-izq">Ver sesión</button>
          <button type="button" onClick={cerrarSesion} className="margen-izq">Cerrar sesión</button>
        </div>
      </form>

      {mensaje && <p className="margen-top">{mensaje}</p>}

      <div className="margen-top">
        <button type="button" className="btn btn--light" onClick={handleGoogle}>Iniciar sesión con Google</button>
      </div>

      {user && (
        <p className="margen-top">
          Sesión de <strong>{user.nombres} {user.apellidos}</strong> (rol: {user.role})
        </p>
      )}
      {!user && (
        <p className="margen-top">
          ¿No tienes cuenta? <Link to="/registro">Regístrate</Link>
        </p>
      )}
    </main>
  );
}

export default Login;

