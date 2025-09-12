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
    <>
      <div className="contenedor-principal">
        <p>
          "Difundir y socializar el rendimiento deportivo para fortalecer y
          cualificar la relación de la comunidad corredora con la práctica deportiva"
        </p>
      </div>
      <div className="contenedor-secundario text-center">
        <h3>Último análisis:</h3>
        <img src="/img/logoMaratonCDMX2025.png" alt="Running y Estética" width="320" loading="lazy" />
        <div className="mt-05">
          <Link to="/analisis" className="link">Ir a análisis</Link>
        </div>
      </div>
      <div className="contenedor-terciario">
        <h3>Último blog:</h3>
        <h4>{ultimoBlog ? <Link className="link" to={`/blog?id=${ultimoBlog.id}`}>{ultimoBlog.title}</Link> : 'Aún no hay publicaciones'}</h4>
        {ultimosBlogs.length > 1 && (
          <ul className="mt-05">
            {ultimosBlogs.slice(1).map((b) => (
              <li key={b.id} className="fs-095 muted">
                <Link className="link" to={`/blog?id=${b.id}`}>{b.title}</Link>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-05">
          <Link to="/blog" className="link">Leer</Link>
        </div>
      </div>
    </>
  );
}

export default Inicio;


