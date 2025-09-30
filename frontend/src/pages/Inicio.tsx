import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from '../api';

function Inicio() {
  const [ultimosBlogs, setUltimosBlogs] = useState<Array<{ id: number; title: string }>>([]);
  const ultimoBlog = ultimosBlogs[0] || null;

  const [ultimosInformes, setUltimosInformes] = useState<
    Array<{ id: string; nombre: string; fecha: string }>
  >([]);
  const ultimoInforme = ultimosInformes[0] || null;

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

  useEffect(() => {
    api
      .get('/informes')
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        const normalized = list
          .map((item: any) => ({
            id: String(item?.id ?? ''),
            nombre:
              typeof item?.nombre === 'string' ? item.nombre : 'Informe sin nombre',
            fecha: item?.fecha
              ? new Date(item.fecha).toISOString()
              : new Date().toISOString(),
          }))
          .filter((i: any) => i.id.trim().length > 0)
          .sort(
            (a: any, b: any) =>
              new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
          )
          .slice(0, 3);
        setUltimosInformes(normalized);
      })
      .catch(() => {
        setUltimosInformes([]);
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
      <div className="contenedor-terciario">
        <h3>Ultimo informe:</h3>
        <h4>{ultimoInforme ? <Link className="link" to="/informes">{ultimoInforme.nombre}</Link> : 'Aun no hay informes'}</h4>
        {ultimosInformes.length > 1 && (
          <ul className="mt-05">
            {ultimosInformes.slice(1).map((inf) => (
              <li key={inf.id} className="fs-095 muted">
                <Link className="link" to="/informes">{inf.nombre}</Link>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-05">
          <Link to="/informes" className="link">Ver informes</Link>
        </div>
      </div>
    </>
  );
}

export default Inicio;
