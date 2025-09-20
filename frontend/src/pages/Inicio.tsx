import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { raceReports } from '../data/raceReports';
import { api } from '../api';

function Inicio() {
  const [ultimosBlogs, setUltimosBlogs] = useState<Array<{ id: number; title: string }>>([]);
  const ultimoBlog = ultimosBlogs[0] || null;
  const ultimoInforme = raceReports[0] || null;

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
          cualificar la relacion de la comunidad corredora con la practica deportiva"
        </p>
      </div>
      <div className="contenedor-secundario text-center">
        <h3>Informes de Carreras</h3>
        <p className="muted">Consulta reportes listos para compartir con tu equipo.</p>
        <div className="mt-05">
          <Link to="/informes" className="link">Ver informes</Link>
        </div>
        {ultimoInforme && (
          <div className="mt-05">
            <Link to={`/informes?id=${ultimoInforme.id}`} className="btn-pill">
              Ultimo informe: {ultimoInforme.title}
            </Link>
          </div>
        )}
      </div>
      <div className="contenedor-terciario">
        <h3>Ultimo blog:</h3>
        <h4>{ultimoBlog ? <Link className="link" to={`/blog?id=${ultimoBlog.id}`}>{ultimoBlog.title}</Link> : 'Aun no hay publicaciones'}</h4>
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
