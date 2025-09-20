import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { useContext, useState, useEffect } from 'react';
import Inicio from './pages/Inicio';
import Datos from './pages/Datos';
import Analisis from './pages/Analisis';
import Informes from './pages/Informes';
import Login from './pages/Login';
import Blog from './pages/Blog';
import Registro from './pages/Registro';
import Perfil from './pages/Perfil';
import Contacto from './pages/Contacto';
import { AuthContext } from './AuthContext';
import RequireAdmin from './components/RequireAdmin';
import RequireAuth from './components/RequireAuth';

const logo = '/img/logo16-9.png';

function App() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false);

  // Dynamic document title per route
  const location = useLocation();
  useEffect(() => {
    const base = 'Pace Social';
    const titles: Record<string, string> = {
      '/': 'Inicio',
      '/datos': 'Subir Datos',
      '/analisis': 'Datos Carreras',
      '/informes': 'Informes Carreras',
      '/blog': 'Blog',
      '/contacto': 'Contacto',
      '/login': 'Login',
      '/perfil': 'Mi Perfil',
      '/registro': 'Registro',
    };
    const t = titles[location.pathname] || '';
    document.title = t ? `${t} | ${base}` : base;
  }, [location.pathname]);

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    await logout();
    navigate('/');
  };

  return (
    <div>
      <header>
        <div className="header-inner">
          <Link to="/" aria-label="Ir al inicio" className="logo-link">
            <img src={logo} alt="Pace Social" />
          </Link>
          <button
            className="nav-toggle"
            aria-label={navOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={navOpen}
            onClick={() => setNavOpen((v) => !v)}
          >
            <span className="nav-toggle__bar" />
            <span className="nav-toggle__bar" />
            <span className="nav-toggle__bar" />
          </button>
          <nav className={navOpen ? 'nav open' : 'nav'}>
            <ul className="nav-list" onClick={() => setNavOpen(false)}>
              <li><Link to="/">Inicio</Link></li>
              {user?.role === 'admin' && (
                <>
                  <li><Link to="/datos">Subir Datos</Link></li>
                  <li><Link to="/analisis">Datos Carreras</Link></li>
                </>
              )}
              <li><Link to="/informes">Informes Carreras</Link></li>
              <li><Link to="/blog">Blog</Link></li>
              <li><Link to="/contacto">Contacto</Link></li>
              {user ? (
                <>
                  <li><Link to="/perfil">Mi Perfil</Link></li>
                  <li><a href="#" onClick={handleLogout}>Logout</a></li>
                </>
              ) : (
                <>
                  <li><Link to="/login">Login</Link></li>
                  <li><Link to="/registro">Registro</Link></li>
                </>
              )}
            </ul>
          </nav>
        </div>
      </header>

      <main className="contenedor-principal">
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/datos" element={<RequireAdmin><Datos /></RequireAdmin>} />
          <Route path="/analisis" element={<RequireAdmin><Analisis /></RequireAdmin>} />
          <Route path="/informes" element={<Informes />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/contacto" element={<Contacto />} />
          <Route path="/login" element={<Login />} />
          <Route path="/perfil" element={<RequireAuth><Perfil /></RequireAuth>} />
          <Route path="/registro" element={<Registro />} />
        </Routes>
      </main>

      <footer>
        <p>&copy; 2025 Pace Social. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}

export default App;


