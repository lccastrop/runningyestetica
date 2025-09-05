import { useEffect, useState } from 'react';
import { api } from '../api';

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

  return (
    <main className="main">
      <h2>Blog</h2>
      {user && (user.role === 'plus' || user.role === 'admin') && (
        <div className="margen-top">
          <input
            type="text"
            placeholder="Título"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="campo"
          />
          <textarea
            placeholder="Contenido"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="campo margen-top"
            rows={6}
            style={{ width: '100%' }}
          />
          <button onClick={crearBlog} className="margen-top">
            Crear
          </button>
        </div>
      )}
      <ul className="margen-top lista-blog">
        {blogs.map((blog) => (
          <li key={blog.id} className="margen-top">
            {editingId === blog.id ? (
              <div>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="campo"
                />
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="campo margen-top"
                                    rows={6}
                  style={{ width: '100%' }}
                />
                <button
                  onClick={() => guardarEdicion(blog.id)}
                  className="margen-top"
                >
                  Guardar
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="margen-izq margen-top"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <div>
                <div className="margen-top titulo">
                <h3 >{blog.title}</h3>                <small>
                  Autor: {blog.nombres} {blog.apellidos} -{' '}
                  {new Date(blog.created_at).toLocaleDateString()}
                </small> </div>
                <p className="margen-top texto-justificado">{blog.content}</p>

                {user && (user.role === 'admin' || user.id === blog.user_id) && (
                  <button
                    onClick={() => iniciarEdicion(blog)}
                    className="margen-top"
                  >
                    Editar
                  </button>
                )}
                {user && user.role === 'admin' && (
                  <button
                    onClick={() => eliminarBlog(blog.id)}
                    className="margen-izq margen-top"
                  >
                    Eliminar
                  </button>
                )}
                <br /><br />
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}

export default Blog;