import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

interface CategoriaAnalisis {
  categoria: string;
  ritmo_femenino?: string | null;
  corredoras?: number;
  ritmo_masculino?: string | null;
  corredores?: number;
}

interface DistribucionRitmo {
  rango: string;
  femenino: number;
  femenino_pct: number;
  masculino: number;
  masculino_pct: number;
}

interface TopEntry {
  nombre: string;
  genero: string;
  categoria: string;
  tiempo_chip: string | null;
  ritmo_medio: string | null;
}

interface TopCategoriaEntry {
  categoria: string;
  nombre: string;
  genero: string;
  tiempo_chip: string | null;
  ritmo_medio: string | null;
  pos: number;
}

function formatRitmo(ritmo: string | null): string {
  if (!ritmo) return '--:--';
  const [h = '0', m = '0', s = '0'] = ritmo.split(':');
  const horas = parseInt(h, 10) || 0;
  const minutos = parseInt(m, 10) || 0;
  const segundos = parseInt(s, 10) || 0;
  const totalMinutos = horas * 60 + minutos;
  return `${totalMinutos.toString().padStart(2, '0')}:${segundos
    .toString()
    .padStart(2, '0')}`;
}

function Analisis() {
  const [carreras, setCarreras] = useState<{ id: number; nombre: string }[]>([]);
  const [seleccionada, setSeleccionada] = useState<number | null>(null);
  const [resultados, setResultados] = useState<{
    ritmo_general: string;
    ritmo_masculino: string;
    ritmo_femenino: string;
    conteo_masculino: number;
    conteo_femenino: number;
  } | null>(null);
  const [categorias, setCategorias] = useState<CategoriaAnalisis[]>([]);
  const [distribucionRitmos, setDistribucionRitmos] = useState<DistribucionRitmo[]>([]);
  const [totalesGenero, setTotalesGenero] = useState<{ femenino: number, masculino: number }>({ femenino: 0, masculino: 0 });
  const [mensaje, setMensaje] = useState('');
  const [topGenero, setTopGenero] = useState<{ femenino: TopEntry[]; masculino: TopEntry[] }>({ femenino: [], masculino: [] });
  const [topCategorias, setTopCategorias] = useState<TopCategoriaEntry[]>([]);

  const topPorCategoria = useMemo(() => {
    const map = new Map<string, TopCategoriaEntry[]>();
    for (const r of topCategorias) {
      const key = r.categoria || 'Sin categoría';
      const arr = map.get(key) || [];
      arr.push(r);
      map.set(key, arr);
    }
    return Array.from(map.entries()).map(([categoria, items]) => ({ categoria, items }));
  }, [topCategorias]);

  useEffect(() => {
    api
      .get('/carreras')
      .then(res => setCarreras(res.data))
      .catch((error) => {
        console.error('Error al cargar carreras:', error);
        const detalle = (error as any).response?.data?.details || (error as any).response?.data?.error || (error as any).message;
        setMensaje(`Error al cargar carreras: ${detalle}`);
      });
  }, []);

  const hacerAnalisis = async () => {
    if (!seleccionada) return;
    try {
      const [resGeneral, resCategorias, resRangos] = await Promise.all([
        api.get(`/analisis-carrera/${seleccionada}`),
        api.get(`/analisis-carrera-categorias/${seleccionada}`),
        api.get(`/analisis-carrera-ritmos/${seleccionada}`)
      ]);

      setResultados(resGeneral.data);
      setCategorias(resCategorias.data);
      setDistribucionRitmos(resRangos.data.distribucion);
      setTotalesGenero({
        femenino: resRangos.data.total_femenino,
        masculino: resRangos.data.total_masculino
      });
      const [resTopGenero, resTopCat] = await Promise.all([
        api.get(`/analisis-carrera-top-genero/${seleccionada}`),
        api.get(`/analisis-carrera-top-categorias/${seleccionada}`)
      ]);
      setTopGenero(resTopGenero.data);
      setTopCategorias(resTopCat.data);
      setMensaje('');
    } catch (error) {
      console.error('Error en análisis:', error);
      setMensaje('Error al hacer análisis');
    }
  };

  return (
    <>
      <div className='contenedor-secundario'> <h2>Análisis de Resultados</h2>

        <select onChange={(e) => setSeleccionada(parseInt(e.target.value))} defaultValue="">
          <option value="" disabled>Selecciona una carrera</option>
          {carreras.map(c => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>

        <button onClick={hacerAnalisis} className="ml-1">Hacer análisis</button>
      </div>
      {mensaje && <p>{mensaje}</p>}

      {resultados && (
        <div>
          <h3>Ritmo promedio:</h3>
          <p><strong>General:</strong> {formatRitmo(resultados.ritmo_general)} min/km</p>
          <p><strong>Masculino:</strong> {formatRitmo(resultados.ritmo_masculino)} min/km ({resultados.conteo_masculino} corredores)</p>
          <p><strong>Femenino:</strong> {formatRitmo(resultados.ritmo_femenino)} min/km ({resultados.conteo_femenino} corredoras)</p>
        </div>
      )}

      {categorias.length > 0 && (
        <div>
          <h3>Comparativa por Categoría</h3>
          <table className="table">
            <thead>
              <tr>
                <th className="cell">Categoría</th>
                <th className="cell">Corredores/as</th>
                <th className="cell">Ritmo Medio</th>
              </tr>
            </thead>
            <tbody>
              {categorias.map((fila) => {
                const corredoras = fila.corredoras ?? 0;
                const corredores = fila.corredores ?? 0;
                const generoLabel = corredoras > 0 ? 'corredoras' : 'corredores';
                const cantidad = corredoras > 0 ? corredoras : corredores;
                const ritmo = corredoras > 0
                  ? formatRitmo(fila.ritmo_femenino ?? null)
                  : formatRitmo(fila.ritmo_masculino ?? null);

                return (
                  <tr key={fila.categoria}>
                    <td className="cell">{fila.categoria}</td>
                    <td className="cell">
                      {cantidad} {generoLabel}
                    </td>
                    <td className="cell">
                      {ritmo}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {distribucionRitmos.length > 0 && (
        <div>
          <h3>Distribución por Rangos de Ritmo Medio</h3>
          <table className="table">
            <thead>
              <tr>
                <th className="cell">Rango Ritmo medio</th>
                <th colSpan={2} className="cell thead-group">Femenino</th>
                <th colSpan={2} className="cell thead-group">Masculino</th>
              </tr>
              <tr>
                <th></th>
                <th className="cell">Cantidad</th>
                <th className="cell">%</th>
                <th className="cell">Cantidad</th>
                <th className="cell">%</th>
              </tr>
            </thead>
            <tbody>
              {distribucionRitmos.map((fila, idx) => (
                <tr key={idx}>
                  <td className="cell">{fila.rango}</td>
                  <td className="cell">{fila.femenino}</td>
                  <td className="cell">{fila.femenino_pct}%</td>
                  <td className="cell">{fila.masculino}</td>
                  <td className="cell">{fila.masculino_pct}%</td>
                </tr>
              ))}
              <tr className="row-total">
                <td className="cell">Total</td>
                <td className="cell">{totalesGenero.femenino}</td>
                <td className="cell">100%</td>
                <td className="cell">{totalesGenero.masculino}</td>
                <td className="cell">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {distribucionRitmos.length > 0 && (
        <div>
          <h3>Gráfica: Ritmos por género</h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart
              data={distribucionRitmos}
              margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="rango" angle={-45} textAnchor="end" interval={0} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="femenino" name="Femenino" fill="magenta" />
              <Bar dataKey="masculino" name="Masculino" fill="lightblue" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {(topGenero.femenino.length > 0 || topGenero.masculino.length > 0) && (
        <div>
          <h3>Top 5 por género</h3>
          <div className="grid-tops">
            <div>
              <h4>Femenino</h4>
              <table className="table">
                <thead>
                  <tr>
                    <th className="cell">Puesto</th>
                    <th className="cell">Nombre</th>
                    <th className="cell">Categoría</th>
                    <th className="cell">Tiempo chip</th>
                    <th className="cell">Ritmo medio</th>
                  </tr>
                </thead>
                <tbody>
                  {topGenero.femenino.map((r, i) => (
                    <tr key={`f-${i}`}>
                      <td className="cell">{i + 1}</td>
                      <td className="cell">{r.nombre}</td>
                      <td className="cell">{r.categoria}</td>
                      <td className="cell">{r.tiempo_chip || '--:--:--'}</td>
                      <td className="cell">{formatRitmo(r.ritmo_medio ?? null)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h4>Masculino</h4>
              <table className="table">
                <thead>
                  <tr>
                    <th className="cell">Puesto</th>
                    <th className="cell">Nombre</th>
                    <th className="cell">Categoría</th>
                    <th className="cell">Tiempo chip</th>
                    <th className="cell">Ritmo medio</th>
                  </tr>
                </thead>
                <tbody>
                  {topGenero.masculino.map((r, i) => (
                    <tr key={`m-${i}`}>
                      <td className="cell">{i + 1}</td>
                      <td className="cell">{r.nombre}</td>
                      <td className="cell">{r.categoria}</td>
                      <td className="cell">{r.tiempo_chip || '--:--:--'}</td>
                      <td className="cell">{formatRitmo(r.ritmo_medio ?? null)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {topCategorias.length > 0 && (
        <div>
          <h3>Top 5 por categoría</h3>
          <div className="grid-tops">
            {topPorCategoria.map(({ categoria, items }) => (
              <div key={categoria} className="top-categoria">
                <h4>{categoria}</h4>
                <table className="table">
                  <thead>
                    <tr>
                      <th className="cell">Puesto</th>
                      <th className="cell">Nombre</th>
                      <th className="cell">Género</th>
                      <th className="cell">Tiempo chip</th>
                      <th className="cell">Ritmo medio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((r, idx) => (
                      <tr key={idx}>
                        <td className="cell">{r.pos}</td>
                        <td className="cell">{r.nombre}</td>
                        <td className="cell">{r.genero}</td>
                        <td className="cell">{r.tiempo_chip || '--:--:--'}</td>
                        <td className="cell">{formatRitmo(r.ritmo_medio ?? null)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default Analisis;
