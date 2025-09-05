import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from '../api';
function Inicio() {
  const [ultimosBlogs, setUltimosBlogs] = useState<Array<{ id: number; title: string }>>([]);
  const ultimoBlog = ultimosBlogs[0] || null;

  useEffect(() => {
    api
      .get('/blogs')
      .then((res) => {
        if (Array.isArray(res.data)) {
          const previews = res.data.slice(0, 3).map((b: any) => ({ id: b.id, title: b.title }));
          setUltimosBlogs(previews);
        }
      })
      .catch(() => {
        setUltimosBlogs([]);
      });
  }, []);
  return (
    <main className="main">
      <div className="contenedor-principal inicio-layout">
        <div className="contenedor-principal">
          <p className="texto-grande">
            "Difundir y socializar el rendimiento deportivo para fortalecer y 
            cualificar la relación de la comunidad corredora con la práctica deportiva" 
          </p>
        </div>
        <div className="contenedor-cuarto">
          Último análisis:
          <img src="/img/logoMaratonCDMX2025.png" alt="Running y Estética" className="img-hero" width="320"loading="lazy" />
          <Link to="/analisis" className="btn btn--primary btn--sm">Ir a análisis</Link>
        </div>
        <div className="contenedor-cuarto">
          Último blog:
          <h4 style={{ marginTop: '0.5rem' }}>{ultimoBlog ? ultimoBlog.title : 'Aún no hay publicaciones'}</h4>
          {ultimosBlogs.length > 1 && (
            <ul style={{ listStyle: 'none', padding: 0, marginTop: '0.25rem' }}>
              {ultimosBlogs.slice(1).map((b) => (
                <li key={b.id} style={{ fontSize: '0.95rem', opacity: 0.9 }}>{b.title}</li>
              ))}
            </ul>
          )}
          <Link to="/blog" className="btn btn--light btn--sm" style={{ marginTop: '0.5rem' }}>Leer</Link>
        </div>
      </div>
    </main>
  );
}

export default Inicio;
