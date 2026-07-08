import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';

const SUBSTACK_URL = 'https://pacesocial.substack.com';

interface Post {
  id: string;
  title: string;
  link: string;
  pubDate: string;
  excerpt: string;
  contentHtml: string;
}

function stripHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim();
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

// Intenta el proxy propio primero; si falla (sin función serverless en local, proxy caído, etc.)
// hace fetch directo — los feeds RSS de Substack permiten CORS.
function fetchXml(): Promise<string> {
  return fetch('/api/feed')
    .then((r) => {
      if (!r.ok) throw new Error('proxy-' + r.status);
      return r.text();
    })
    .catch(() =>
      fetch(`${SUBSTACK_URL}/feed`).then((r) => {
        if (!r.ok) throw new Error('direct-' + r.status);
        return r.text();
      })
    );
}

function parseItems(xml: string): Post[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) {
    throw new Error('XML inválido');
  }

  const items = Array.from(doc.getElementsByTagName('item'));
  return items.map((item, idx) => {
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

    // <content:encoded> requiere getElementsByTagNameNS con la URI del namespace.
    const contentEls = item.getElementsByTagNameNS(
      'http://purl.org/rss/1.0/modules/content/',
      'encoded'
    );
    const descEls = item.getElementsByTagName('description');
    const rawHtml =
      contentEls.length && contentEls[0].textContent?.trim()
        ? contentEls[0].textContent!.trim()
        : descEls.length
        ? (descEls[0].textContent || '').trim()
        : '';

    return {
      id: String(idx),
      title,
      link,
      pubDate,
      excerpt: rawHtml ? excerpt(stripHtml(rawHtml), 300) : '',
      contentHtml: rawHtml,
    };
  });
}

function Blog() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    let cancelled = false;
    fetchXml()
      .then((xml) => {
        if (cancelled) return;
        setPosts(parseItems(xml));
        setLoading(false);
      })
      .catch((err) => {
        console.error('[Blog] Error al cargar el feed:', err);
        if (cancelled) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedId = searchParams.get('id') || posts[0]?.id || '0';
  const selected = posts.find((p) => p.id === selectedId) || posts[0] || null;

  return (
    <div className="blog-layout">
      <section className="blog-main">
        <h2>Blog</h2>

        {loading && <p className="muted mt-1">Cargando publicaciones…</p>}

        {!loading && error && (
          <p className="mt-1">
            No se pudieron cargar las publicaciones en este momento. Puedes leerlas
            directamente en{' '}
            <a className="link" href={SUBSTACK_URL} target="_blank" rel="noopener noreferrer">
              pacesocial.substack.com
            </a>
            .
          </p>
        )}

        {!loading && !error && !selected && (
          <p className="muted mt-1">No hay publicaciones disponibles aún.</p>
        )}

        {!loading && !error && selected && (
          <div className="mt-1">
            <h3>{selected.title}</h3>
            <small className="muted">{formatDate(selected.pubDate)}</small>
            <div className="mt-05" dangerouslySetInnerHTML={{ __html: selected.contentHtml }} />
            <p className="mt-1">
              <a className="link" href={selected.link} target="_blank" rel="noopener noreferrer">
                Leer en Substack →
              </a>
            </p>
          </div>
        )}

        <div className="mt-1">
          <p className="muted fs-095">
            Recibe cada nueva publicación directamente en tu correo.{' '}
            <a className="link" href={SUBSTACK_URL} target="_blank" rel="noopener noreferrer">
              Suscribirse en Substack →
            </a>
          </p>
        </div>
      </section>

      <aside className="blog-aside">
        <h3>Otras publicaciones</h3>
        <ul className="blog-list">
          {posts.map((p) => (
            <li key={p.id} className="blog-item">
              <Link className="link" to={`?id=${p.id}`}>
                {p.title}
              </Link>
              <br />
              <small className="muted">{formatDate(p.pubDate)}</small>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

export default Blog;
