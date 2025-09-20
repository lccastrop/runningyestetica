import { type FormEvent, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { AuthContext } from '../AuthContext';
import { api } from '../api';

type PromedioGrupo = {
  tiempo: string | null;
  ritmo: string | null;
};

type ParticipanteAnalisis = {
  participante: {
    nombre: string | null;
    genero: string | null;
    categoria: string | null;
    bib: string | null;
    tiempo_chip: string | null;
    ritmo_medio: string | null;
  };
  posiciones: {
    general: number | null;
    genero: number | null;
    categoria: number | null;
  };
  totales: {
    general: number | null;
    genero: number | null;
    categoria: number | null;
  };
  promedios: {
    general: PromedioGrupo;
    genero: PromedioGrupo | null;
    categoria: PromedioGrupo | null;
  };
};

const timeToSeconds = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const parts = value.split(':').map((part) => Number(part));
  if (parts.some((part) => Number.isNaN(part))) return null;
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return null;
};

const formatSecondsInterval = (value: number): string => {
  const abs = Math.abs(Math.round(value));
  const hours = Math.floor(abs / 3600);
  const minutes = Math.floor((abs % 3600) / 60);
  const seconds = abs % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const describeDifference = (
  personal: string | null | undefined,
  promedio: string | null | undefined,
): string | null => {
  const personalSeconds = timeToSeconds(personal);
  const promedioSeconds = timeToSeconds(promedio);
  if (personalSeconds == null || promedioSeconds == null) return null;
  const diff = personalSeconds - promedioSeconds;
  if (diff === 0) return 'Igual al promedio';
  const formatted = formatSecondsInterval(diff);
  return diff < 0 ? `${formatted} mas rapido` : `${formatted} mas lento`;
};

const formatPosicion = (pos: number | null | undefined, total: number | null | undefined): string => {
  if (pos == null || total == null) return 'No disponible';
  return `${pos} de ${total}`;
};

function Perfil() {
  const { user, setUser } = useContext(AuthContext);
  const [misBlogs, setMisBlogs] = useState<Array<{ id: number; title: string; created_at: string }>>([]);
  const [email, setEmail] = useState('');
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [saving, setSaving] = useState(false);

  const [carreras, setCarreras] = useState<Array<{ id: number; nombre: string }>>([]);
  const [carreraSeleccionada, setCarreraSeleccionada] = useState('');
  const [bib, setBib] = useState('');
  const [analisis, setAnalisis] = useState<ParticipanteAnalisis | null>(null);
  const [analisisMensaje, setAnalisisMensaje] = useState('');
  const [analisisLoading, setAnalisisLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setEmail(user.email || '');
      setNombres(user.nombres || '');
      setApellidos(user.apellidos || '');
      api.get('/my-blogs')
        .then((res) => setMisBlogs(res.data || []))
        .catch(() => setMisBlogs([]));
    }
  }, [user]);

  useEffect(() => {
    api.get('/carreras')
      .then((res) => setCarreras(res.data || []))
      .catch((err) => {
        console.error('Error al cargar carreras:', err);
      });
  }, []);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
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

  const onAnalisisSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAnalisisMensaje('');
    setAnalisis(null);

    if (!carreraSeleccionada) {
      setAnalisisMensaje('Selecciona una carrera');
      return;
    }

    const bibTrim = bib.trim();
    if (!bibTrim) {
      setAnalisisMensaje('Ingresa tu numero bib');
      return;
    }

    setAnalisisLoading(true);
    try {
      const res = await api.get(`/analisis-participante/${carreraSeleccionada}`, {
        params: { bib: bibTrim },
      });
      setAnalisis(res.data as ParticipanteAnalisis);
      setBib(bibTrim);
    } catch (err) {
      let msg = 'No se pudo obtener el analisis';
      if (axios.isAxiosError(err) && err.response?.data) {
        msg = err.response.data.error || err.response.data.message || msg;
      }
      setAnalisisMensaje(msg);
    } finally {
      setAnalisisLoading(false);
    }
  };

  const diffTiempoGeneral = analisis ? describeDifference(analisis.participante.tiempo_chip, analisis.promedios.general.tiempo) : null;
  const diffTiempoGenero = analisis?.promedios.genero ? describeDifference(analisis.participante.tiempo_chip, analisis.promedios.genero.tiempo) : null;
  const diffTiempoCategoria = analisis?.promedios.categoria ? describeDifference(analisis.participante.tiempo_chip, analisis.promedios.categoria.tiempo) : null;
  const diffRitmoGeneral = analisis ? describeDifference(analisis.participante.ritmo_medio, analisis.promedios.general.ritmo) : null;
  const diffRitmoGenero = analisis?.promedios.genero ? describeDifference(analisis.participante.ritmo_medio, analisis.promedios.genero.ritmo) : null;
  const diffRitmoCategoria = analisis?.promedios.categoria ? describeDifference(analisis.participante.ritmo_medio, analisis.promedios.categoria.ritmo) : null;

  return (
    <>
      <div className="contenedor-secundario form-wrap">
        <div className="form-card">
          <h2 className="form-title">Mi Perfil</h2>
          <form className="form" onSubmit={onSubmit}>
            <div className="form-field">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-label">Nombres</label>
              <input className="form-input" type="text" value={nombres} onChange={(e) => setNombres(e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-label">Apellidos</label>
              <input className="form-input" type="text" value={apellidos} onChange={(e) => setApellidos(e.target.value)} />
            </div>
            <p className="mt-05">Rol: <strong>{user?.role}</strong> (no editable)</p>
            <div className="form-actions">
              <button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</button>
            </div>
          </form>
          {mensaje && <p className="mt-05">{mensaje}</p>}
        </div>
      </div>

      <div className="contenedor-secundario form-wrap">
        <div className="form-card">
          <h3 className="form-title">Mis Blogs</h3>
          {misBlogs.length === 0 ? (
            <p>Aún no has escrito blogs.</p>
          ) : (
            <ul className="mt-05">
              {misBlogs.map((b) => (
                <li key={b.id} className="mt-05">
                  <Link className="link" to={`/blog?id=${b.id}`}>{b.title}</Link>
                  <br />
                  <small>{new Date(b.created_at).toLocaleDateString()}</small>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-05">
            <Link to="/blog" className="link">Ir al Blog</Link>
          </div>
        </div>
      </div>

      {user?.role === 'admin' && (
        <div className="contenedor-secundario form-wrap">
          <div className="form-card">
            <h3 className="form-title">Mis participaciones</h3>
            <form className="form" onSubmit={onAnalisisSubmit}>
              <div className="form-field">
                <label className="form-label">Carrera</label>
                <select
                  className="form-input"
                  value={carreraSeleccionada}
                  onChange={(event) => setCarreraSeleccionada(event.target.value)}
                >
                  <option value="">Selecciona una carrera</option>
                  {carreras.map((carrera) => (
                    <option key={carrera.id} value={String(carrera.id)}>
                      {carrera.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label className="form-label">Numero bib</label>
                <input
                  className="form-input"
                  type="text"
                  value={bib}
                  onChange={(event) => setBib(event.target.value)}
                  placeholder="Ej. 1234"
                />
              </div>
              <div className="form-actions">
                <button type="submit" disabled={analisisLoading}>
                  {analisisLoading ? 'Buscando...' : 'Analizar'}
                </button>
              </div>
            </form>
            {analisisMensaje && <p className="mt-05">{analisisMensaje}</p>}
            {analisis && (
              <div className="mt-1">
                <p>
                  <strong>{analisis.participante.nombre || 'Participacion sin nombre'}</strong>
                  {analisis.participante.bib ? ` | Bib ${analisis.participante.bib}` : ''}
                </p>
                <p>
                  Tiempo chip: <strong>{analisis.participante.tiempo_chip || '--:--:--'}</strong> | Ritmo medio: <strong>{analisis.participante.ritmo_medio || '--:--'}</strong>
                </p>
                <div className="mt-05">
                  <p className="muted">Posiciones</p>
                  <ul className="mt-05">
                    <li>General: {formatPosicion(analisis.posiciones.general, analisis.totales.general)}</li>
                    {analisis.posiciones.genero != null && (
                      <li>
                        Rama {analisis.participante.genero || 'sin dato'}: {formatPosicion(analisis.posiciones.genero, analisis.totales.genero)}
                      </li>
                    )}
                    {analisis.posiciones.categoria != null && (
                      <li>
                        Categoria {analisis.participante.categoria || 'sin dato'}: {formatPosicion(analisis.posiciones.categoria, analisis.totales.categoria)}
                      </li>
                    )}
                  </ul>
                </div>
                <div className="mt-05">
                  <p className="muted">Comparativa de tiempos</p>
                  <ul className="mt-05">
                    <li>
                      Promedio general: {analisis.promedios.general.tiempo ?? '--:--:--'}
                      {diffTiempoGeneral ? ` (${diffTiempoGeneral})` : ''}
                    </li>
                    {analisis.promedios.genero && (
                      <li>
                        Promedio rama {analisis.participante.genero || 'sin dato'}: {analisis.promedios.genero.tiempo ?? '--:--:--'}
                        {diffTiempoGenero ? ` (${diffTiempoGenero})` : ''}
                      </li>
                    )}
                    {analisis.promedios.categoria && (
                      <li>
                        Promedio categoria {analisis.participante.categoria || 'sin dato'}: {analisis.promedios.categoria.tiempo ?? '--:--:--'}
                        {diffTiempoCategoria ? ` (${diffTiempoCategoria})` : ''}
                      </li>
                    )}
                  </ul>
                </div>
                <div className="mt-05">
                  <p className="muted">Comparativa de ritmos</p>
                  <ul className="mt-05">
                    <li>
                      Promedio general: {analisis.promedios.general.ritmo ?? '--:--'}
                      {diffRitmoGeneral ? ` (${diffRitmoGeneral})` : ''}
                    </li>
                    {analisis.promedios.genero && (
                      <li>
                        Promedio rama {analisis.participante.genero || 'sin dato'}: {analisis.promedios.genero.ritmo ?? '--:--'}
                        {diffRitmoGenero ? ` (${diffRitmoGenero})` : ''}
                      </li>
                    )}
                    {analisis.promedios.categoria && (
                      <li>
                        Promedio categoria {analisis.participante.categoria || 'sin dato'}: {analisis.promedios.categoria.ritmo ?? '--:--'}
                        {diffRitmoCategoria ? ` (${diffRitmoCategoria})` : ''}
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </>
  );
}

export default Perfil;


