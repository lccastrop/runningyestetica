// frontend/src/pages/Datos.tsx
import { useState } from 'react';
import { api } from '../api';

function Datos() {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [mensaje, setMensaje] = useState('');

  const [archivoPoblacion, setArchivoPoblacion] = useState<File | null>(null);
  const [nombreCarrera, setNombreCarrera] = useState('');
  const [fechaCarrera, setFechaCarrera] = useState('');
  const [distanciaCarrera, setDistanciaCarrera] = useState('');
  const [ascensoTotal, setAscensoTotal] = useState('');
  const [mensajePoblacion, setMensajePoblacion] = useState('');
  const [debugPoblacion, setDebugPoblacion] = useState(false);

  const handleArchivoPoblacion = (e: React.ChangeEvent<HTMLInputElement>) => {
    setArchivoPoblacion(e.target.files?.[0] || null);
  };

  const handleSubirPoblacion = async () => {
    if (!archivoPoblacion || !nombreCarrera) {
      setMensajePoblacion('Debes seleccionar un archivo CSV y escribir el nombre de la carrera');
      return;
    }

    const formData = new FormData();
    formData.append('file', archivoPoblacion);
    formData.append('nombreCarrera', nombreCarrera);
    formData.append('fecha', fechaCarrera);
    formData.append('distancia', parseFloat(distanciaCarrera || '0').toString());
    formData.append('ascenso_total', parseInt(ascensoTotal || '0').toString());

    try {
      const res = await api.post('/upload-resultados', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        params: debugPoblacion ? { debug: '1' } : undefined,
      });
      setMensajePoblacion(`${res.data.message} (${res.data.insertados} resultados insertados${res.data.omitidos !== undefined ? ", omitidos: " + res.data.omitidos : ''})`);
    } catch (error) {
      const err: any = error as any;
      const errMsg = err?.response?.data?.error || err?.message || 'Error desconocido';
      const extra = err?.response?.data?.message ? ` - ${err.response.data.message}` : '';
      const code = err?.response?.data?.code ? ` [${err.response.data.code}]` : '';
      setMensajePoblacion(`Error al subir el archivo de población: ${errMsg}${extra}${code}`);
      return;
      console.error('Error al subir resultados:', error);
      setMensajePoblacion('Error al subir el archivo de población');
    }
  };

  const handleArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    setArchivo(e.target.files?.[0] || null);
  };

  const handleSubir = async () => {
    if (!archivo) {
      setMensaje('Selecciona un archivo CSV primero');
      return;
    }

    const formData = new FormData();
    formData.append('file', archivo);

    try {
      const res = await api.post('/upload-entrenamiento', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMensaje(`${res.data.message} (${res.data.series_insertadas} series insertadas)`);
    } catch (error) {
      console.error('Error al subir CSV:', error);
      setMensaje('Error al subir el archivo');
    }
  };

  return (
    <>
      <div className="contenedor-secundario">
        <h2>CSV de entrenamiento</h2>
        <input type="file" accept=".csv" onChange={handleArchivo} />
        <button onClick={handleSubir} className="ml-05">Subir</button>
        {mensaje && <p className="mt-05">{mensaje}</p>}
      </div>

      <div className="contenedor-secundario">
        <h2>CSV de población (resultados)</h2>
        <p>
          (SIN TILDES) Recuerda que los nombres y órdenes de las columnas deben ser: <br />
          Nombre | Genero | BIB | Tiempo Chip | Paso Medio | Categoria | Tiempo Oficial
        </p>
        <input
          type="text"
          placeholder="Nombre de la carrera"
          value={nombreCarrera}
          onChange={(e) => setNombreCarrera(e.target.value)}
        />
        <input
          type="date"
          value={fechaCarrera}
          onChange={(e) => setFechaCarrera(e.target.value)}
        />
        <input
          type="number"
          placeholder="Distancia en km"
          value={distanciaCarrera}
          onChange={(e) => setDistanciaCarrera(e.target.value)}
        />
        <input
          type="number"
          placeholder="Ascenso total en metros"
          value={ascensoTotal}
          onChange={(e) => setAscensoTotal(e.target.value)}
        />
        <div className="mt-05">
          <input type="file" accept=".csv" onChange={handleArchivoPoblacion} />
          <label className="ml-05">
            <input type="checkbox" checked={debugPoblacion} onChange={(e) => setDebugPoblacion(e.target.checked)} /> Debug
          </label>
          <button onClick={handleSubirPoblacion} className="ml-05">Subir</button>
        </div>
        {mensajePoblacion && <p className="mt-05">{mensajePoblacion}</p>}
      </div>
    </>
  );
}

export default Datos;
