// frontend/src/pages/Datos.tsx
import { useState } from 'react';
import axios from 'axios';

function Datos() {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [mensaje, setMensaje] = useState('');

  const [archivoPoblacion, setArchivoPoblacion] = useState<File | null>(null);
  const [nombreCarrera, setNombreCarrera] = useState('');
  const [fechaCarrera, setFechaCarrera] = useState('');
  const [distanciaCarrera, setDistanciaCarrera] = useState('');
  const [ascensoTotal, setAscensoTotal] = useState('');
  const [mensajePoblacion, setMensajePoblacion] = useState('');

  const handleArchivoPoblacion = (e: React.ChangeEvent<HTMLInputElement>) => {
    setArchivoPoblacion(e.target.files?.[0] || null);
  };

  const handleSubirPoblacion = async () => {
    if (!archivoPoblacion || !nombreCarrera) {
      setMensajePoblacion('⚠️ Debes seleccionar un archivo CSV y escribir el nombre de la carrera');
      return;
    }

    const formData = new FormData();
    formData.append('file', archivoPoblacion);
    formData.append('nombreCarrera', nombreCarrera);
    formData.append('fecha', fechaCarrera);
    formData.append('distancia', parseFloat(distanciaCarrera).toString());
    formData.append('ascenso_total', parseInt(ascensoTotal).toString());

    try {
      const res = await axios.post('http://localhost:3001/upload-resultados', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setMensajePoblacion(`✅ ${res.data.message} (${res.data.insertados} resultados insertados)`);
    } catch (error) {
      console.error('❌ Error al subir resultados:', error);
      setMensajePoblacion('❌ Error al subir el archivo de población');
    }
  };

  const handleArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    setArchivo(e.target.files?.[0] || null);
  };

  const handleSubir = async () => {
    if (!archivo) {
      setMensaje('⚠️ Selecciona un archivo CSV primero');
      return;
    }

    const formData = new FormData();
    formData.append('file', archivo);

    try {
      const res = await axios.post('http://localhost:3001/upload-entrenamiento', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setMensaje(`✅ ${res.data.message} (${res.data.series_insertadas} series insertadas)`);
    } catch (error) {
      console.error('❌ Error al subir CSV:', error);
      setMensaje('❌ Error al subir el archivo');
    }
  };

  return (
    <main className="main">
      <h2>Subir archivo CSV de entrenamiento</h2>
      <input type="file" accept=".csv" onChange={handleArchivo} />
      <button onClick={handleSubir} style={{ marginLeft: '1rem' }}>Subir</button>
      {mensaje && <p style={{ marginTop: '1rem' }}>{mensaje}</p>}

      <hr style={{ margin: '2rem 0' }} />

      <h2>Subir archivo CSV de población (resultados de carreras)</h2>
      <p>
        (SIN TILDES) Recuerda que los nombres y órdenes de las columnas deben ser: <br />

        Nombre | Genero | BIB | Tiempo Chip | Paso Medio | Categoria | Tiempo Oficial
      </p>
      <br />
      <input
        type="text"
        placeholder="Nombre de la carrera"
        value={nombreCarrera}
        onChange={(e) => setNombreCarrera(e.target.value)}
        style={{ display: 'block', marginBottom: '0.5rem' }}
      />

      <input
        type="date"
        value={fechaCarrera}
        onChange={(e) => setFechaCarrera(e.target.value)}
        style={{ display: 'block', marginBottom: '0.5rem' }}
      />

      <input
        type="number"
        placeholder="Distancia en km"
        value={distanciaCarrera}
        onChange={(e) => setDistanciaCarrera(e.target.value)}
        style={{ display: 'block', marginBottom: '0.5rem' }}
      />

      <input
        type="number"
        placeholder="Ascenso total en metros"
        value={ascensoTotal}
        onChange={(e) => setAscensoTotal(e.target.value)}
        style={{ display: 'block', marginBottom: '0.5rem' }}
      />

      <input type="file" accept=".csv" onChange={handleArchivoPoblacion} />
      <button onClick={handleSubirPoblacion} style={{ marginLeft: '1rem' }}>Subir</button>

      {mensajePoblacion && <p style={{ marginTop: '1rem' }}>{mensajePoblacion}</p>}
    </main>
  );
}

export default Datos;