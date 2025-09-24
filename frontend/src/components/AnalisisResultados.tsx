import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export interface AnalisisResumen {
  ritmo_general: string | null;
  ritmo_masculino: string | null;
  ritmo_femenino: string | null;
  conteo_masculino: number;
  conteo_femenino: number;
}

export interface CategoriaAnalisis {
  categoria: string;
  ritmo_femenino?: string | null;
  corredoras?: number;
  ritmo_masculino?: string | null;
  corredores?: number;
}

export interface DistribucionRitmo {
  rango: string;
  femenino: number;
  femenino_pct: number;
  masculino: number;
  masculino_pct: number;
}

export interface TopEntry {
  nombre: string;
  genero: string;
  categoria: string;
  tiempo_chip: string | null;
  ritmo_medio: string | null;
}

export interface TopCategoriaEntry {
  categoria: string;
  nombre: string;
  genero: string;
  tiempo_chip: string | null;
  ritmo_medio: string | null;
  pos: number;
}

export interface TotalesGenero {
  femenino: number;
  masculino: number;
}

export interface TopGenero {
  femenino: TopEntry[];
  masculino: TopEntry[];
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

interface AnalisisResultadosProps {
  resultados: AnalisisResumen | null;
  categorias: CategoriaAnalisis[];
  distribucionRitmos: DistribucionRitmo[];
  totalesGenero: TotalesGenero;
  topGenero: TopGenero;
  topCategorias: TopCategoriaEntry[];
}

function AnalisisResultados({
  resultados,
  categorias,
  distribucionRitmos,
  totalesGenero,
  topGenero,
  topCategorias,
}: AnalisisResultadosProps) {
  const topPorCategoria = useMemo(() => {
    const map = new Map<string, TopCategoriaEntry[]>();
    for (const r of topCategorias) {
      const key = r.categoria || 'Sin categoria';
      const arr = map.get(key) || [];
      arr.push(r);
      map.set(key, arr);
    }
    return Array.from(map.entries()).map(([categoria, items]) => ({ categoria, items }));
  }, [topCategorias]);

  const tieneTopGenero = topGenero.femenino.length > 0 || topGenero.masculino.length > 0;

  return (
    <>
      {resultados && (
        <div className="contenedor-secundario mt-1">
          <h3>Ritmo promedio:</h3>
          <p><strong>General:</strong> {formatRitmo(resultados.ritmo_general)} min/km</p>
          <p>
            <strong>Masculino:</strong> {formatRitmo(resultados.ritmo_masculino)} min/km ({resultados.conteo_masculino} corredores)
          </p>
          <p>
            <strong>Femenino:</strong> {formatRitmo(resultados.ritmo_femenino)} min/km ({resultados.conteo_femenino} corredoras)
          </p>
        </div>
      )}

      {categorias.length > 0 && (
        <div>
          <h3>Promedio por categoria</h3>
          <table className="table">
            <thead>
              <tr>
                <th className="cell">Categoria</th>
                <th className="cell">Ritmo Femenino</th>
                <th className="cell">Corredoras</th>
                <th className="cell">Ritmo Masculino</th>
                <th className="cell">Corredores</th>
              </tr>
            </thead>
            <tbody>
              {categorias.map((cat, idx) => (
                <tr key={`${cat.categoria}-${idx}`}>
                  <td className="cell">{cat.categoria || 'Sin categoria'}</td>
                  <td className="cell">{formatRitmo(cat.ritmo_femenino ?? null)}</td>
                  <td className="cell">{cat.corredoras ?? 0}</td>
                  <td className="cell">{formatRitmo(cat.ritmo_masculino ?? null)}</td>
                  <td className="cell">{cat.corredores ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {distribucionRitmos.length > 0 && (
        <div>
          <h3>Distribucion de ritmos por genero</h3>
          <table className="table">
            <thead>
              <tr>
                <th className="cell">Rango</th>
                <th className="cell">Femenino</th>
                <th className="cell">% Femenino</th>
                <th className="cell">Masculino</th>
                <th className="cell">% Masculino</th>
              </tr>
            </thead>
            <tbody>
              {distribucionRitmos.map((fila, idx) => (
                <tr key={`${fila.rango}-${idx}`}>
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
          <h3>Grafica: ritmos por genero</h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={distribucionRitmos} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
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

      {tieneTopGenero && (
        <div>
          <h3>Top 5 por genero</h3>
          <div className="grid-tops">
            <div>
              <h4>Femenino</h4>
              <table className="table">
                <thead>
                  <tr>
                    <th className="cell">Puesto</th>
                    <th className="cell">Nombre</th>
                    <th className="cell">Categoria</th>
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
                    <th className="cell">Categoria</th>
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
          <h3>Top 5 por categoria</h3>
          <div className="grid-tops">
            {topPorCategoria.map(({ categoria, items }) => (
              <div key={categoria} className="top-categoria">
                <h4>{categoria}</h4>
                <table className="table">
                  <thead>
                    <tr>
                      <th className="cell">Puesto</th>
                      <th className="cell">Nombre</th>
                      <th className="cell">Genero</th>
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

export default AnalisisResultados;

