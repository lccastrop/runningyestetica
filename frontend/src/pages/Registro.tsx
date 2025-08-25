import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function Registro() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mensaje, setMensaje] = useState('');
  const navigate = useNavigate();

  const registrar = async () => {
    if (!email || !password) {
      setMensaje('⚠️ Rellena email y contraseña');
      return;
    }
    try {
      await axios.post('http://localhost:3001/register', { email, password });
      setMensaje('✅ Usuario registrado, inicia sesión');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err: unknown) {
      const mensajeError =
        axios.isAxiosError(err) && err.response?.data?.error
          ? err.response.data.error
          : '❌ Error al registrar';
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
    </main>
  );
}

export default Registro;