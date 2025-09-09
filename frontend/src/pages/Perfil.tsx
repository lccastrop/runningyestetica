import { useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { AuthContext } from '../AuthContext';
import { api } from '../api';

function Perfil() {
  const { user, setUser } = useContext(AuthContext);
  const [misBlogs, setMisBlogs] = useState<Array<{ id: number; title: string; created_at: string }>>([]);
  const [email, setEmail] = useState('');
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setEmail(user.email || '');
      setNombres(user.nombres || '');
      setApellidos(user.apellidos || '');
      // Cargar blogs del usuario
      api.get('/my-blogs')
        .then((res) => setMisBlogs(res.data || []))
        .catch(() => setMisBlogs([]));
    }
  }, [user]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensaje('');
    if (!email.trim()) {
      setMensaje('El email es obligatorio');
      return;
    }
    setSaving(true);
    try {
      const res = await api.put('/me', {
        email: email.trim(),
        nombres: nombres.trim(),
        apellidos: apellidos.trim(),
      });
      setUser(res.data.user);
      setMensaje('Perfil actualizado');
    } catch (err) {
      let msg = 'No se pudo actualizar el perfil';
      if (axios.isAxiosError(err) && err.response?.data) {
        msg = err.response.data.error || err.response.data.message || msg;
      }
      setMensaje(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <h2>Mi Perfil</h2>
      <form onSubmit={onSubmit} className="form">
        <div className="fila">
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="campo" />
        </div>
        <div className="fila">
          <label>Nombres</label>
          <input type="text" value={nombres} onChange={(e) => setNombres(e.target.value)} className="campo" />
        </div>
        <div className="fila">
          <label>Apellidos</label>
          <input type="text" value={apellidos} onChange={(e) => setApellidos(e.target.value)} className="campo" />
        </div>
        <p>Rol: <strong>{user?.role}</strong> (no editable)</p>
        <div className="margen-top">
          <button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</button>
        </div>
      </form>
      {mensaje && <p className="margen-top">{mensaje}</p>}

      <div className="margen-top">
        <h3>Mis Blogs</h3>
        {misBlogs.length === 0 ? (
          <p className="margen-top">Aún no has escrito blogs.</p>
        ) : (
          <ul className="lista-blog">
            {misBlogs.map((b) => (
              <li key={b.id} className="margen-top">
                <Link to={`/blog?id=${b.id}`}>{b.title}</Link>
                <br />
                <small>{new Date(b.created_at).toLocaleDateString()}</small>
              </li>
            ))}
          </ul>
        )}
        <div className="margen-top">
          <Link to="/blog" className="btn btn--light">Ir al Blog</Link>
        </div>
      </div>
    </section>
  );
}

export default Perfil;
