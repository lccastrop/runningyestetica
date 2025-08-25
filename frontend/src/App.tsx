import './style.css';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import { useContext } from 'react';
import Inicio from './pages/Inicio';
import Datos from './pages/Datos';
import Analisis from './pages/Analisis';
import Login from './pages/Login';
import Blog from './pages/Blog';
import Registro from './pages/Registro';
import { AuthContext } from './AuthContext';
import RequireAdmin from './components/RequireAdmin';
const logo = '/img/logo16-9.png';

function App() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    await logout();
    navigate('/');
  };

  return (
    <div className="contenedor-principal">
      <header className="header">
        <img src={logo} alt="Running y Estética" className="logo" />
        <nav>
          <ul className="nav-list">
            <li><Link to="/">Inicio</Link></li>
            {user?.role === 'admin' && <li><Link to="/datos">Datos</Link></li>}
            <li><Link to="/analisis">Análisis</Link></li>
            <li><Link to="/blog">Blog</Link></li>
            {user ? (
              <li><a href="#" onClick={handleLogout}>Logout</a></li>
            ) : (
              <>
                <li><Link to="/login">Login</Link></li>
                <li><Link to="/registro">Registro</Link></li>
              </>
            )}
          </ul>
        </nav>
      </header>

      <main className="main">
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/datos" element={<RequireAdmin><Datos /></RequireAdmin>} />
          <Route path="/analisis" element={<Analisis />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<Registro />} />
        </Routes>
      </main>

      <footer className="footer">
        <p>© 2025 Running y Estética. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}

export default App;
