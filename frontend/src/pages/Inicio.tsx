import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from '../api';

const SUBSTACK_URL = 'https://pacesocial.substack.com';

interface BlogPreview {
  id: string;
  title: string;
  link: string;
  pubDate: string;
  excerpt: string;
}

function excerpt(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).replace(/\s\S*$/, '') + '…';
}

function formatDate(str: string): string {
  if (!str) return '';
  const d = new Date(str);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
}

async function fetchSubstackBlogs(): Promise<BlogPreview[]> {
  const tryFeed = async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error('feed-' + response.status);
    return response.text();
  };

  try {
    const xml = await tryFeed('/api/feed');
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'application/xml');
    const items = Array.from(doc.getElementsByTagName('item'));

    return items.slice(0, 3).map((item, idx) => {
      const titleEls = item.getElementsByTagName('title');
      const title = titleEls.length ? (titleEls[0].textContent || '').trim() : 'Sin título';

      const linkEls = item.getElementsByTagName('link');
      let link = linkEls.length ? (linkEls[0].textContent || '').trim() : '';
      if (!link) {
        const guidEls = item.getElementsByTagName('guid');
        link = guidEls.length ? (guidEls[0].textContent || '').trim() : '#';
      }

      const dateEls = item.getElementsByTagName('pubDate');
      const pubDate = dateEls.length ? (dateEls[0].textContent || '').trim() : '';

      const contentEls = item.getElementsByTagNameNS(
        'http://purl.org/rss/1.0/modules/content/',
        'encoded',
      );
      const descEls = item.getElementsByTagName('description');
      const rawHtml =
        contentEls.length && contentEls[0].textContent?.trim()
          ? contentEls[0].textContent.trim()
          : descEls.length
          ? (descEls[0].textContent || '').trim()
          : '';

      return {
        id: String(idx),
        title,
        link,
        pubDate,
        excerpt: rawHtml ? excerpt(rawHtml.replace(/<[^>]+>/g, ' '), 180) : '',
      };
    });
  } catch {
    try {
      const xml = await tryFeed(`${SUBSTACK_URL}/feed`);
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'application/xml');
      const items = Array.from(doc.getElementsByTagName('item'));

      return items.slice(0, 3).map((item, idx) => {
        const titleEls = item.getElementsByTagName('title');
        const title = titleEls.length ? (titleEls[0].textContent || '').trim() : 'Sin título';

        const linkEls = item.getElementsByTagName('link');
        let link = linkEls.length ? (linkEls[0].textContent || '').trim() : '';
        if (!link) {
          const guidEls = item.getElementsByTagName('guid');
          link = guidEls.length ? (guidEls[0].textContent || '').trim() : '#';
        }

        const dateEls = item.getElementsByTagName('pubDate');
        const pubDate = dateEls.length ? (dateEls[0].textContent || '').trim() : '';

        const contentEls = item.getElementsByTagNameNS(
          'http://purl.org/rss/1.0/modules/content/',
          'encoded',
        );
        const descEls = item.getElementsByTagName('description');
        const rawHtml =
          contentEls.length && contentEls[0].textContent?.trim()
            ? contentEls[0].textContent.trim()
            : descEls.length
            ? (descEls[0].textContent || '').trim()
            : '';

        return {
          id: String(idx),
          title,
          link,
          pubDate,
          excerpt: rawHtml ? excerpt(rawHtml.replace(/<[^>]+>/g, ' '), 180) : '',
        };
      });
    } catch {
      return [];
    }
  }
}

function Inicio() {
  const [ultimosBlogs, setUltimosBlogs] = useState<BlogPreview[]>([]);
  const ultimoBlog = ultimosBlogs[0] || null;

  const [ultimosInformes, setUltimosInformes] = useState<
    Array<{ id: string; nombre: string; fecha: string }>
  >([]);
  const ultimoInforme = ultimosInformes[0] || null;

  useEffect(() => {
    fetchSubstackBlogs()
      .then((posts) => {
        setUltimosBlogs(posts);
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
        <h3>Últimos blogs:</h3>
        {ultimoBlog ? (
          <>
            <h4>
              <a className="link" href={ultimoBlog.link} target="_blank" rel="noreferrer">
                {ultimoBlog.title}
              </a>
            </h4>
            {ultimoBlog.pubDate && <p className="muted fs-095">{formatDate(ultimoBlog.pubDate)}</p>}
            {ultimoBlog.excerpt && <p className="mt-025">{ultimoBlog.excerpt}</p>}
            {ultimosBlogs.length > 1 && (
              <ul className="mt-05">
                {ultimosBlogs.slice(1).map((b) => (
                  <li key={b.id} className="fs-095 muted">
                    <a className="link" href={b.link} target="_blank" rel="noreferrer">
                      {b.title}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="muted">Aún no hay publicaciones</p>
        )}
        <div className="mt-05">
          <Link to="/blog" className="link">Ver blog completo</Link>
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
