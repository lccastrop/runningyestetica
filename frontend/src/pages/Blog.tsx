import { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../api';

interface BlogPost {
  id: number;
  title: string;
  content: string;
  user_id: number;
  email: string;
}

interface User {
  id: number;
  email: string;
  role: string;
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
    const res = await axios.get(`${API_URL}/blogs`);
    setBlogs(res.data);
  };

  const verSesion = async () => {
    try {
      const res = await axios.get(`${API_URL}/session`, { withCredentials: true });
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
      const res = await axios.post(
        'http://localhost:3001/blogs',
        { title, content },
        { withCredentials: true }
      );
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
    await axios.put(
      `${API_URL}/blogs/${id}`,
      { title: editTitle, content: editContent },
      { withCredentials: true }
    );
    setBlogs((prev) =>
      prev.map((b) =>
        b.id === id ? { ...b, title: editTitle, content: editContent } : b
      )
    );
    setEditingId(null);
  };

  const eliminarBlog = async (id: number) => {
    await axios.delete(`${API_URL}/blogs/${id}`, {
      withCredentials: true,
    });
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
          />
          <button onClick={crearBlog} className="margen-top">
            Crear
          </button>
        </div>
      )}
      <ul className="margen-top">
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
                <h3>{blog.title}</h3>
                <p>{blog.content}</p>
                <small>Autor: {blog.email}</small>
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
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}

export default Blog;