import { useEffect, useState } from 'react';
import axios from 'axios';
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

  useEffect(() => {
    axios.get('http://localhost:3001/carreras')
      .then(res => setCarreras(res.data))
      .catch(() => setMensaje('Error al cargar carreras'));
  }, []);

  const hacerAnalisis = async () => {
    if (!seleccionada) return;
    try {
      const [resGeneral, resCategorias, resRangos] = await Promise.all([
        axios.get(`http://localhost:3001/analisis-carrera/${seleccionada}`),
        axios.get(`http://localhost:3001/analisis-carrera-categorias/${seleccionada}`),
        axios.get(`http://localhost:3001/analisis-carrera-ritmos/${seleccionada}`)
      ]);

      setResultados(resGeneral.data);
      setCategorias(resCategorias.data);
      setDistribucionRitmos(resRangos.data.distribucion);
      setTotalesGenero({
        femenino: resRangos.data.total_femenino,
        masculino: resRangos.data.total_masculino
      });
      setMensaje('');
    } catch (error) {
      console.error('Error en análisis:', error);
      setMensaje('❌ Error al hacer análisis');
    }
  };

  return (
    <main className="main">
      <h2>Análisis de Resultados</h2>

      <select onChange={(e) => setSeleccionada(parseInt(e.target.value))} defaultValue="">
        <option value="" disabled>Selecciona una carrera</option>
        {carreras.map(c => (
          <option key={c.id} value={c.id}>{c.nombre}</option>
        ))}
      </select>

      <button onClick={hacerAnalisis} style={{ marginLeft: '1rem' }}>Hacer análisis</button>

      {mensaje && <p style={{ color: 'red' }}>{mensaje}</p>}

      {resultados && (
        <div style={{ marginTop: '2rem' }}>
          <h3>Ritmo promedio:</h3>
          <p><strong>General:</strong> {formatRitmo(resultados.ritmo_general)} min/km</p>
          <p><strong>Masculino:</strong> {formatRitmo(resultados.ritmo_masculino)} min/km ({resultados.conteo_masculino} corredores)</p>
          <p><strong>Femenino:</strong> {formatRitmo(resultados.ritmo_femenino)} min/km ({resultados.conteo_femenino} corredoras)</p>
        </div>
      )}

      {categorias.length > 0 && (
        <div style={{ marginTop: '3rem' }}>
          <h3>Comparativa por Categoría</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #ccc', padding: '6px' }}>Categoría</th>
                <th style={{ border: '1px solid #ccc', padding: '6px' }}>Corredores/as</th>
                <th style={{ border: '1px solid #ccc', padding: '6px' }}>Ritmo Medio</th>
              </tr>
            </thead>
            <tbody>
              {categorias.map((fila, idx) => {
                const genero = fila.corredoras > 0 ? '♀' : '♂';
                const cantidad = fila.corredoras > 0 ? fila.corredoras : fila.corredores;
                const ritmo = fila.corredoras > 0 ? formatRitmo(fila.ritmo_femenino) : formatRitmo(fila.ritmo_masculino);
                return (
                  <tr key={idx}>
                    <td style={{ border: '1px solid #ccc', padding: '6px' }}>{fila.categoria}</td>
                    <td style={{ border: '1px solid #ccc', padding: '6px' }}>
                      {cantidad} {genero}
                    </td>
                    <td style={{ border: '1px solid #ccc', padding: '6px' }}>
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
        <div style={{ marginTop: '3rem' }}>
          <h3>Distribución por Rangos de Ritmo Medio</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #ccc', padding: '6px' }}>Rango Ritmo medio</th>
                <th colSpan={2} style={{ backgroundColor: '#f9c5dd', border: '1px solid #ccc' }}>Femenino</th>
                <th colSpan={2} style={{ backgroundColor: '#cce5f6', border: '1px solid #ccc' }}>Masculino</th>
              </tr>
              <tr>
                <th></th>
                <th style={{ border: '1px solid #ccc', padding: '6px' }}>Cantidad</th>
                <th style={{ border: '1px solid #ccc', padding: '6px' }}>%</th>
                <th style={{ border: '1px solid #ccc', padding: '6px' }}>Cantidad</th>
                <th style={{ border: '1px solid #ccc', padding: '6px' }}>%</th>
              </tr>
            </thead>
            <tbody>
              {distribucionRitmos.map((fila, idx) => (
                <tr key={idx}>
                  <td style={{ border: '1px solid #ccc', padding: '6px' }}>{fila.rango}</td>
                  <td style={{ border: '1px solid #ccc', padding: '6px' }}>{fila.femenino}</td>
                  <td style={{ border: '1px solid #ccc', padding: '6px' }}>{fila.femenino_pct}%</td>
                  <td style={{ border: '1px solid #ccc', padding: '6px' }}>{fila.masculino}</td>
                  <td style={{ border: '1px solid #ccc', padding: '6px' }}>{fila.masculino_pct}%</td>
                </tr>
              ))}
              <tr>
                <td style={{ border: '1px solid #ccc', fontWeight: 'bold', backgroundColor: '#d4edda' }}>Total</td>
                <td style={{ border: '1px solid #ccc', fontWeight: 'bold' }}>{totalesGenero.femenino}</td>
                <td style={{ border: '1px solid #ccc', fontWeight: 'bold' }}>100%</td>
                <td style={{ border: '1px solid #ccc', fontWeight: 'bold' }}>{totalesGenero.masculino}</td>
                <td style={{ border: '1px solid #ccc', fontWeight: 'bold' }}>100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {distribucionRitmos.length > 0 && (
        <div style={{ marginTop: '3rem' }}>
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
    </main>
  );
}

export default Analisis;
