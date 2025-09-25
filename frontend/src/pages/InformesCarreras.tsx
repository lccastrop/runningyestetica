import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

type Informe = {
  id: string;
  nombre: string;
  fecha: string;
};

const InformesCarreras = () => {
  const [informes, setInformes] = useState<Informe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showExample, setShowExample] = useState(true);

  const mockInforme: Informe = useMemo(() => ({
    id: 'demo-ejemplo',
    nombre: 'Carrera de Ejemplo',
    fecha: new Date().toISOString(),
  }), []);

  useEffect(() => {
    api.get('/informes')
      .then(res => {
        let list: Informe[] = Array.isArray(res.data) ? res.data : [];
        if (showExample && !list.some(i => i.id === mockInforme.id)) {
          list = [...list, mockInforme];
        }
        setInformes(list);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching informes:", err);
        setError('No se pudieron cargar los informes.');
        setLoading(false);
      });
  }, [showExample, mockInforme]);

  // Preseleccionar el primero cuando haya datos
  useEffect(() => {
    if (!loading && !error && informes.length > 0 && !selectedId) {
      setSelectedId(informes[0].id);
    }
  }, [loading, error, informes, selectedId]);

  const selectedInforme = useMemo(() =>
    informes.find(i => i.id === selectedId) || null,
  [informes, selectedId]);

  const removeExample = () => {
    const next = informes.filter(i => i.id !== mockInforme.id);
    setInformes(next);
    setShowExample(false);
    if (selectedId === mockInforme.id) {
      setSelectedId(next.length > 0 ? next[0].id : null);
    }
  };

  return (
    <div className="contenedor-principal">
      <h2>Informes de Carreras</h2>
      {loading && <p>Cargando informes...</p>}
      {error && <p>{error}</p>}

      {!loading && !error && (
        informes.length > 0 ? (
          <div className="blog-layout">
            <aside className="blog-aside">
              <h3 className="text-center">Carreras</h3>
              <ul className="blog-list">
                {informes.map((informe) => {
                  const isActive = informe.id === selectedId;
                  const isDemo = informe.id === mockInforme.id;
                  return (
                    <li
                      key={informe.id}
                      className="blog-item clickable"
                      onClick={() => setSelectedId(informe.id)}
                      aria-selected={isActive}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontWeight: isActive ? 700 : 500 }}>
                          {informe.nombre}{isDemo ? ' (ejemplo)' : ''}
                        </span>
                        <span className="muted fs-095">
                          {new Date(informe.fecha).toLocaleDateString()}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </aside>

            <section className="blog-main">
              {selectedInforme ? (
                <div>
                  <h3 className="text-center">{selectedInforme.nombre}</h3>
                  <p className="text-center muted mt-05">
                    Publicado el {new Date(selectedInforme.fecha).toLocaleDateString()}
                  </p>
                  {selectedInforme.id !== 'demo-ejemplo' ? (
                    <div className="text-center mt-1">
                      <Link to={`/informes/${selectedInforme.id}`} className="link">
                        Abrir informe
                      </Link>
                    </div>
                  ) : (
                    <div className="text-center mt-1">
                      <p className="muted">Este es un informe de ejemplo (no tiene contenido).</p>
                      <button onClick={removeExample} className="mt-05">Quitar ejemplo</button>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-center">Selecciona una carrera en la lista para ver su informe.</p>
              )}
            </section>
          </div>
        ) : (
          <p>No hay informes disponibles.</p>
        )
      )}
    </div>
  );
};

export default InformesCarreras;
