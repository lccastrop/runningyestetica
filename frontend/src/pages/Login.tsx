import { useState, useEffect, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { api } from '../api';
import { AuthContext } from '../AuthContext';
import { auth, googleProvider } from '../firebaseConfig';
import { signInWithPopup, signInWithRedirect, getRedirectResult } from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';

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

  const completeGoogleLogin = async (firebaseUser: FirebaseUser) => {
    const idToken = await firebaseUser.getIdToken();
    const res = await api.post('/login-google', { idToken });
    setUser(res.data.user);
    setMensaje('Sesión iniciada con Google');
    navigate('/');
  };

  const handleGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await completeGoogleLogin(result.user);
    } catch (error: any) {
      const code = error?.code || '';
      if (code.includes('popup') || code.includes('operation-not-supported')) {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectError) {
          console.error('Redirect Google error:', redirectError);
        }
      }
      console.error('Error con Google:', error);
      const msg = axios.isAxiosError(error) && error.response?.data?.error
        ? error.response.data.error
        : 'No se pudo iniciar sesión con Google';
      setMensaje(msg);
    }
  };

  useEffect(() => {
    const handleRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result && result.user) {
          await completeGoogleLogin(result.user);
          return;
        }
      } catch (e) {
        console.error('getRedirectResult error:', e);
      }
      // No redirect result -> check any existing session
      verSesion();
    };
    handleRedirect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div className="contenedor-secundario form-wrap">
        <div className="form-card">
          <h2 className="form-title">Login</h2>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              iniciarSesion();
            }}
          >
            <div className="form-field">
              <label className="form-label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
              />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="password">Contraseña</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
              />
            </div>
            <div className="form-actions">
              <button type="submit">Iniciar sesión</button>
              <button type="button" onClick={verSesion}>Ver sesión</button>
              <button type="button" onClick={cerrarSesion}>Cerrar sesión</button>
            </div>
          </form>

          {mensaje && <p className="mt-05">{mensaje}</p>}

          <div className="mt-1">
            <button type="button" onClick={handleGoogle}>Iniciar sesión con Google</button>
          </div>

          {user && (
            <p className="mt-05">
              Sesión de <strong>{user.nombres} {user.apellidos}</strong> (rol: {user.role})
            </p>
          )}
          {!user && (
            <p className="mt-05">
              ¿No tienes cuenta? <Link to="/registro" className="link">Regístrate</Link>
            </p>
          )}
        </div>
      </div>
    </>
  );
}

export default Login;

