import { useState, useContext } from 'react';
import axios from 'axios';
import { api } from '../api';
import { useNavigate } from 'react-router-dom';
import { auth, googleProvider } from '../firebaseConfig';
import { signInWithPopup } from 'firebase/auth';
import { AuthContext } from '../AuthContext';

function Registro() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [mensaje, setMensaje] = useState('');
  const navigate = useNavigate();
  const { setUser } = useContext(AuthContext);

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

  const registrar = async () => {
    if (!email || !password || !nombres || !apellidos) {
      setMensaje('Rellena todos los campos');
      return;
    }
    try {
      await api.post('/register', { email, password, nombres, apellidos });
      setMensaje('Usuario registrado, inicia sesión');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err: unknown) {
      const mensajeError =
        axios.isAxiosError(err) && err.response?.data?.error
          ? err.response.data.error
          : 'Error al registrar';
      setMensaje(mensajeError);
    }
  };

  return (
    <>
      <div className="contenedor-secundario form-wrap">
        <div className="form-card">
          <h2 className="form-title">Registro</h2>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              registrar();
            }}
          >
            <div className="form-field">
              <label className="form-label" htmlFor="nombres">Nombres</label>
              <input
                id="nombres"
                type="text"
                value={nombres}
                onChange={(e) => setNombres(e.target.value)}
                className="form-input"
              />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="apellidos">Apellidos</label>
              <input
                id="apellidos"
                type="text"
                value={apellidos}
                onChange={(e) => setApellidos(e.target.value)}
                className="form-input"
              />
            </div>
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
              <button type="submit">Registrarse</button>
            </div>
          </form>

          {mensaje && <p className="mt-05">{mensaje}</p>}

          <div className="mt-1">
            <button type="button" onClick={handleGoogle}>Regístrate con Google</button>
          </div>
        </div>
      </div>
    </>
  );
}

export default Registro;

