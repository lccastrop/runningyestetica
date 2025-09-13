import { useEffect, useState } from 'react';
import { api, getFilesBaseUrl } from '../api';
import { useSearchParams, Link } from 'react-router-dom';

interface BlogPost {
  id: number;
  title: string;
  content: string;
  user_id: number;
  nombres: string;
  apellidos: string;
  created_at: string;
}

interface User {
  id: number;
  email: string;
  role: string;
  nombres: string;
  apellidos: string;
}

function Blog() {
  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [searchParams] = useSearchParams();

  const cargarBlogs = async () => {
    const res = await api.get('/blogs');
    setBlogs(res.data);
  };

  const verSesion = async () => {
    try {
      const res = await api.get('/session');
      setUser(res.data.user);
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    cargarBlogs();
    verSesion();
  }, []);

  const crearBlog = async () => {
    try {
      const res = await api.post('/blogs', { title, content });
      setBlogs((prev) => [res.data, ...prev]);
      setTitle('');
      setContent('');
      await cargarBlogs();
    } catch (err) {
      console.error('Error al crear blog:', err);
    }
  };

  const iniciarEdicion = (blog: BlogPost) => {
    setEditingId(blog.id);
    setEditTitle(blog.title);
    setEditContent(blog.content);
  };

  const guardarEdicion = async (id: number) => {
    await api.put(`/blogs/${id}`, { title: editTitle, content: editContent });
    setBlogs((prev) =>
      prev.map((b) =>
        b.id === id ? { ...b, title: editTitle, content: editContent } : b
      )
    );
    setEditingId(null);
  };

  const eliminarBlog = async (id: number) => {
    await api.delete(`/blogs/${id}`);
    setBlogs((prev) => prev.filter((b) => b.id !== id));
  };

  // Upload image and inject markdown tag into content
  const onUploadNewImage: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('image', file);
    try {
      const res = await api.post('/upload-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      // Insert relative URL so it works with same origin + proxy and avoids mixed content
      setContent((prev) => `${prev}\n\n![imagen](${res.data.url})\n\n`);
    } catch (err) {
      console.error('Error al subir imagen:', err);
    } finally {
      if (input) input.value = '';
    }
  };

  const onUploadEditImage: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('image', file);
    try {
      const res = await api.post('/upload-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setEditContent((prev) => `${prev}\n\n![imagen](${res.data.url})\n\n`);
    } catch (err) {
      console.error('Error al subir imagen (edición):', err);
    } finally {
      if (input) input.value = '';
    }
  };

  // Render content supporting inline markdown image tags anywhere in the text
  const renderContent = (text: string) => {
    const filesBase = getFilesBaseUrl();
    const blocks = text.split(/\n{2,}/);
    const imgRe = /!\[(.*?)\]\((.*?)\)/g;
    return blocks.map((block, idx) => {
      const nodes: React.ReactNode[] = [];
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = imgRe.exec(block)) !== null) {
        const [full, altRaw, src] = match;
        const start = match.index;
        if (start > lastIndex) {
          nodes.push(block.slice(lastIndex, start));
        }
        const alt = altRaw || 'Imagen';
        // If image src is relative to backend uploads, prefix with backend base URL in production
        let finalSrc = src;
        if (src?.startsWith('/uploads/') && filesBase) {
          finalSrc = `${filesBase}${src}`;
        }
        nodes.push(<img key={`${idx}-img-${start}`} src={finalSrc} alt={alt} />);
        lastIndex = start + full.length;
      }
      if (lastIndex < block.length) {
        nodes.push(block.slice(lastIndex));
      }
      const onlyImages = nodes.length > 0 && nodes.every(n => typeof n !== 'string');
      return onlyImages ? (
        <div key={idx}>{nodes}</div>
      ) : (
        <p key={idx}>{nodes.length ? nodes : block}</p>
      );
    });
  };

  const selectedId = Number(searchParams.get('id')) || (blogs[0]?.id ?? 0);
  const selected = blogs.find((b) => b.id === selectedId) || null;

  return (
    <div className="blog-layout">
      <section className="blog-main">
        <h2>Blog</h2>
        {user && (user.role === 'plus' || user.role === 'admin') && (
          <div className="mt-1">
            <input
              type="text"
              placeholder="Título"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              placeholder="Contenido"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              className="w-100 mt-05"
            />
            <div className="mt-05">
              <label className="clickable">
                Insertar imagen
                <input type="file" accept="image/*" onChange={onUploadNewImage} className="hidden" />
              </label>
            </div>
            <button onClick={crearBlog} className="mt-05">
              Crear
            </button>
          </div>
        )}
        <div className="mt-1">
          {!selected ? (
            <p>Cargando...</p>
          ) : editingId === selected.id ? (
            <div>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={6}
                className="w-100 mt-05"
              />
              <div className="mt-05">
                <label className="clickable">
                  Insertar imagen
                  <input type="file" accept="image/*" onChange={onUploadEditImage} className="hidden" />
                </label>
              </div>
              <button onClick={() => guardarEdicion(selected.id)} className="mt-05">Guardar</button>
              <button onClick={() => setEditingId(null)} className="mt-05 ml-05">Cancelar</button>
            </div>
          ) : (
            <div>
              <div>
                <h3>{selected.title}</h3>
                <small>
                  Autor: {selected.nombres} {selected.apellidos} - {new Date(selected.created_at).toLocaleDateString()}
                </small>
              </div>
              <div className="mt-05">
                {renderContent(selected.content)}
              </div>
              {user && (user.role === 'admin' || user.id === selected.user_id) && (
                <button onClick={() => iniciarEdicion(selected)} className="mt-05">Editar</button>
              )}
              {user && user.role === 'admin' && (
                <button onClick={() => eliminarBlog(selected.id)} className="mt-05 ml-05">Eliminar</button>
              )}
            </div>
          )}
        </div>
      </section>
      <aside className="blog-aside">
        <h3>Otros blogs</h3>
        <ul className="blog-list">
          {blogs.map((b) => (
            <li key={b.id} className="blog-item">
              <Link className="link" to={`?id=${b.id}`}>{b.title}</Link><br />
              <small>
                Autor: {b.nombres} {b.apellidos} - {new Date(b.created_at).toLocaleDateString()}
              </small>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

export default Blog;


