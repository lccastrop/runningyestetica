import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter, ZAxis
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

const timeToSeconds = (time: string | null): number => {
  if (!time) return 0;
  const parts = time.split(':').map(Number);
  if (parts.some(isNaN)) return 0;
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
};

const secondsToTime = (seconds: number | null): string | null => {
  if (seconds === null || isNaN(seconds) || seconds === Infinity) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

function formatRitmo(ritmo: string | null): string {
  if (!ritmo) return '--:--:--';
  const parts = ritmo.split(':').map(p => parseInt(p, 10) || 0);
  let h = 0, m = 0, s = 0;
  if (parts.length === 3) {
    [h, m, s] = parts;
  } else if (parts.length === 2) {
    [m, s] = parts;
  } else {
    return ritmo; // or some default format
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
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
  const [rawData, setRawData] = useState<any[]>([]);
  const [distribucionSplits, setDistribucionSplits] = useState<any[]>([]);
  const [distribucionSplitsGenero, setDistribucionSplitsGenero] = useState<any[]>([]);

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
      const [resGeneral, resCategorias, resRangos, resRaw, resTopGenero, resTopCat] = await Promise.all([
        api.get(`/analisis-carrera/${seleccionada}`),
        api.get(`/analisis-carrera-categorias/${seleccionada}`),
        api.get(`/analisis-carrera-ritmos/${seleccionada}`),
        api.get(`/carrera-resultados/${seleccionada}`),
        api.get(`/analisis-carrera-top-genero/${seleccionada}`),
        api.get(`/analisis-carrera-top-categorias/${seleccionada}`)
      ]);

      const rawData = resRaw.data;

      setResultados(resGeneral.data);
      setCategorias(resCategorias.data);
      setDistribucionRitmos(resRangos.data.distribucion);
      setTotalesGenero({
        femenino: resRangos.data.total_femenino,
        masculino: resRangos.data.total_masculino
      });
      setRawData(rawData);
      setTopGenero(resTopGenero.data);
      setTopCategorias(resTopCat.data);
      setMensaje('');

      // Table 2.1.3 and 2.1.4 calculations
      const splits = ['5km', '10km', '15km', '20km', '21km', '25km', '30km', '35km', '40km', '42km'];
      const rmSplits = splits.map(s => `RM_${s}`);

      const conTiempoChip = rawData.filter(d => timeToSeconds(d.tiempo_chip) > 0);
      const conTodosLosSplits = conTiempoChip.filter(d => rmSplits.every(s => timeToSeconds(d[s]) > 0));

      const calculos = [];
      const calculosGenero = [];

      // Con Tiempo Chip dif 0
      const totalConTiempoChip = conTiempoChip.length;
      const ritmoMedioConTiempoChip = secondsToTime(conTiempoChip.reduce((acc, d) => acc + timeToSeconds(d.ritmo_medio), 0) / totalConTiempoChip);
      calculos.push({
        split: 'Con Tiempo Chip dif 0',
        total: totalConTiempoChip,
        ritmoMedio: ritmoMedioConTiempoChip
      });

      const conTiempoChipM = conTiempoChip.filter(d => d.genero === 'Masculino');
      const conTiempoChipF = conTiempoChip.filter(d => d.genero === 'Femenino');
      const ritmoMedioConTiempoChipM = secondsToTime(conTiempoChipM.reduce((acc, d) => acc + timeToSeconds(d.ritmo_medio), 0) / conTiempoChipM.length);
      const ritmoMedioConTiempoChipF = secondsToTime(conTiempoChipF.reduce((acc, d) => acc + timeToSeconds(d.ritmo_medio), 0) / conTiempoChipF.length);
      calculosGenero.push({
        split: 'Con Tiempo Chip dif 0',
        totalM: conTiempoChipM.length,
        totalF: conTiempoChipF.length,
        ritmoMedioM: ritmoMedioConTiempoChipM,
        ritmoMedioF: ritmoMedioConTiempoChipF
      });

      // Con todos los Split y TC
      const totalConTodosLosSplits = conTodosLosSplits.length;
      const ritmoMedioConTodosLosSplits = secondsToTime(conTodosLosSplits.reduce((acc, d) => acc + timeToSeconds(d.ritmo_medio), 0) / totalConTodosLosSplits);
      calculos.push({
        split: 'Con todos los Split y TC',
        total: totalConTodosLosSplits,
        ritmoMedio: ritmoMedioConTodosLosSplits
      });

      const conTodosLosSplitsM = conTodosLosSplits.filter(d => d.genero === 'Masculino');
      const conTodosLosSplitsF = conTodosLosSplits.filter(d => d.genero === 'Femenino');
      const ritmoMedioConTodosLosSplitsM = secondsToTime(conTodosLosSplitsM.reduce((acc, d) => acc + timeToSeconds(d.ritmo_medio), 0) / conTodosLosSplitsM.length);
      const ritmoMedioConTodosLosSplitsF = secondsToTime(conTodosLosSplitsF.reduce((acc, d) => acc + timeToSeconds(d.ritmo_medio), 0) / conTodosLosSplitsF.length);
      calculosGenero.push({
        split: 'Con todos los Split y TC',
        totalM: conTodosLosSplitsM.length,
        totalF: conTodosLosSplitsF.length,
        ritmoMedioM: ritmoMedioConTodosLosSplitsM,
        ritmoMedioF: ritmoMedioConTodosLosSplitsF
      });

      // Por split
      let corredoresAcumulados = rawData;
      for (const split of splits) {
        const rmKey = `RM_${split}`;
        corredoresAcumulados = corredoresAcumulados.filter(d => timeToSeconds(d[rmKey]) > 0);

        const total = corredoresAcumulados.length;
        const ritmoMedio = secondsToTime(corredoresAcumulados.reduce((acc, d) => acc + timeToSeconds(d[rmKey]), 0) / total);
        calculos.push({
          split: `split ${split}`,
          total: total,
          ritmoMedio: ritmoMedio
        });

        const corredoresM = corredoresAcumulados.filter(d => d.genero === 'Masculino');
        const corredoresF = corredoresAcumulados.filter(d => d.genero === 'Femenino');
        const ritmoMedioM = secondsToTime(corredoresM.reduce((acc, d) => acc + timeToSeconds(d[rmKey]), 0) / corredoresM.length);
        const ritmoMedioF = secondsToTime(corredoresF.reduce((acc, d) => acc + timeToSeconds(d[rmKey]), 0) / corredoresF.length);
        calculosGenero.push({
          split: `split ${split}`,
          totalM: corredoresM.length,
          totalF: corredoresF.length,
          ritmoMedioM: ritmoMedioM,
          ritmoMedioF: ritmoMedioF
        });
      }
      
      setDistribucionSplits(calculos);
      setDistribucionSplitsGenero(calculosGenero);

    } catch (error) {
      console.error('Error en análisis:', error);
      setMensaje('Error al hacer análisis');
    }
  };

  const scatterData = useMemo(() => {
    const data = distribucionSplits.filter(d => d.split.startsWith('split')).map(d => {
      const km = parseInt(d.split.replace('split ', '').replace('km', ''));
      return { x: km, y: timeToSeconds(d.ritmoMedio) };
    });
    if (data.length > 0) {
      data.unshift({ x: 0, y: data[0].y });
    }
    return data;
  }, [distribucionSplits]);

  const scatterDataGenero = useMemo(() => {
    const dataM = distribucionSplitsGenero.filter(d => d.split.startsWith('split')).map(d => {
      const km = parseInt(d.split.replace('split ', '').replace('km', ''));
      return { x: km, y: timeToSeconds(d.ritmoMedioM) };
    });
    const dataF = distribucionSplitsGenero.filter(d => d.split.startsWith('split')).map(d => {
      const km = parseInt(d.split.replace('split ', '').replace('km', ''));
      return { x: km, y: timeToSeconds(d.ritmoMedioF) };
    });

    if (dataM.length > 0) {
      dataM.unshift({ x: 0, y: dataM[0].y });
    }
    if (dataF.length > 0) {
      dataF.unshift({ x: 0, y: dataF[0].y });
    }
    return { dataM, dataF };
  }, [distribucionSplitsGenero]);

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
          <h3>Comparativa por Categoría (2.1.2)</h3>
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

      {categorias.length > 0 && (
        <div>
          <h3>Gráfica: Ritmos por categoría (2.1.2)</h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={categorias} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="categoria" angle={-45} textAnchor="end" interval={0} />
              <YAxis />
              <Tooltip formatter={(value) => formatRitmo(secondsToTime(value as number))} />
              <Legend />
              <Bar dataKey={(d) => timeToSeconds(d.ritmo_femenino)} name="Femenino" fill="magenta" />
              <Bar dataKey={(d) => timeToSeconds(d.ritmo_masculino)} name="Masculino" fill="lightblue" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {distribucionSplits.length > 0 && (
        <div>
          <h3>Distribución por Splits General (2.1.3)</h3>
          <table className="table">
            <thead>
              <tr>
                <th></th>
                <th>Total Corredores/as</th>
                <th>Ritmo Medio</th>
              </tr>
            </thead>
            <tbody>
              {distribucionSplits.map((fila, idx) => (
                <tr key={idx}>
                  <td>{fila.split}</td>
                  <td>{fila.total}</td>
                  <td>{formatRitmo(fila.ritmoMedio)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {scatterData.length > 0 && (
        <div>
          <h3>Ritmo Medio por Split (2.1.3)</h3>
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid />
              <XAxis type="number" dataKey="x" name="km" unit="km" />
              <YAxis type="number" dataKey="y" name="ritmo" unit="s" reversed={true} tickFormatter={(tick) => secondsToTime(tick)} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(value) => secondsToTime(value as number)} />
              <Scatter name="Ritmo Medio" data={scatterData} fill="#8884d8" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}

      {distribucionSplitsGenero.length > 0 && (
        <div>
          <h3>Distribución por Splits General por género (2.1.4)</h3>
          <table className="table">
            <thead>
              <tr>
                <th></th>
                <th colSpan={2}>Total corredores/as</th>
                <th colSpan={2}>Ritmo Medio</th>
              </tr>
              <tr>
                <th></th>
                <th>Masculino</th>
                <th>Femenino</th>
                <th>Masculino</th>
                <th>Femenino</th>
              </tr>
            </thead>
            <tbody>
              {distribucionSplitsGenero.map((fila, idx) => (
                <tr key={idx}>
                  <td>{fila.split}</td>
                  <td>{fila.totalM}</td>
                  <td>{fila.totalF}</td>
                  <td>{formatRitmo(fila.ritmoMedioM)}</td>
                  <td>{formatRitmo(fila.ritmoMedioF)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {scatterDataGenero.dataM.length > 0 && (
        <div>
          <h3>Ritmo Medio por Split por Género (2.1.4)</h3>
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid />
              <XAxis type="number" dataKey="x" name="km" unit="km" />
              <YAxis type="number" dataKey="y" name="ritmo" unit="s" reversed={true} tickFormatter={(tick) => secondsToTime(tick)} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(value) => secondsToTime(value as number)} />
              <Legend />
              <Scatter name="Masculino" data={scatterDataGenero.dataM} fill="lightblue" />
              <Scatter name="Femenino" data={scatterDataGenero.dataF} fill="magenta" />
            </ScatterChart>
          </ResponsiveContainer>
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