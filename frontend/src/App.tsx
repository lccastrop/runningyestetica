import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Inicio from './pages/Inicio';
import Blog from './pages/Blog';
import Contacto from './pages/Contacto';
import InformesCarreras from './pages/InformesCarreras';

const logo = '/img/logo16-9.png';

function App() {
  const [navOpen, setNavOpen] = useState(false);

  const location = useLocation();
  useEffect(() => {
    const base = 'Pace Social';
    const titles: Record<string, string> = {
      '/': 'Inicio',
      '/blog': 'Blog',
      '/informes': 'Informes',
      '/contacto': 'Contacto',
    };
    const t = titles[location.pathname] || '';
    document.title = t ? `${t} | ${base}` : base;
  }, [location.pathname]);

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
              <li><Link to="/informes">Informes</Link></li>
              <li><Link to="/blog">Blog</Link></li>
              <li className="nav-donate"><a href="https://ko-fi.com/camilo92c" target="_blank" rel="noopener noreferrer" className="nav-donate__link">Apoyo &#9749;</a></li>
              <li><Link to="/contacto">Contacto</Link></li>
            </ul>
          </nav>
        </div>
      </header>

      <main className="contenedor-principal">
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/informes" element={<InformesCarreras />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/contacto" element={<Contacto />} />
        </Routes>
      </main>

      <footer>
        <p>&copy; 2025 Pace Social. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}

export default App;