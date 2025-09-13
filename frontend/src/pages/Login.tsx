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
          : 'Error al iniciar Sesión: ' + (err as Error).message;
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
      setMensaje('Sin Sesión');
    }
  };

  const cerrarSesion = async () => {
    try {
      await logout();
      setMensaje('Sesión cerrada');
    } catch {
      setMensaje('Error al cerrar Sesión');
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
        : 'No se pudo iniciar Sesión con Google';
      setMensaje(msg);
    }
  };

  useEffect(() => {
    verSesion();
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
              <label className="form-label" htmlFor="password">contraseña</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
              />
            </div>
            <div className="form-actions">
              <button type="submit">Iniciar Sesión</button>
              <button type="button" onClick={verSesion}>Ver Sesión</button>
              <button type="button" onClick={cerrarSesion}>Cerrar Sesión</button>
            </div>
          </form>

          {mensaje && <p className="mt-05">{mensaje}</p>}

          <div className="mt-1">
            <button type="button" onClick={handleGoogle}>Iniciar Sesión con Google</button>
          </div>

          {user && (
            <p className="mt-05">
              Sesión de <strong>{user.nombres} {user.apellidos}</strong> (rol: {user.role})
            </p>
          )}
          {!user && (
            <p className="mt-05">
              Â¿No tienes cuenta? <Link to="/registro" className="link">Regístrate</Link>
            </p>
          )}
        </div>
      </div>
    </>
  );
}

export default Login;



