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
    <main className="main">
      <h2>Registro</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          registrar();
        }}
      >
        <input
          type="text"
          placeholder="Nombres"
          value={nombres}
          onChange={(e) => setNombres(e.target.value)}
          className="campo"
        />
        <input
          type="text"
          placeholder="Apellidos"
          value={apellidos}
          onChange={(e) => setApellidos(e.target.value)}
          className="campo"
        />
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
          <button type="submit">Registrarse</button>
        </div>
      </form>

      {mensaje && <p className="margen-top">{mensaje}</p>}

      <div className="margen-top">
        <button type="button" className="btn btn--light" onClick={handleGoogle}>
          Regístrate con Google
        </button>
      </div>
    </main>
  );
}

export default Registro;

