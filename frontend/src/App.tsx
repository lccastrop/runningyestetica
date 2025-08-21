import './style.css';
import { Routes, Route, Link } from 'react-router-dom';
import Inicio from './pages/Inicio';
import Datos from './pages/Datos';
import Analisis from './pages/Analisis';
import Login from './pages/Login';

function App() {
  return (
    <div className="contenedor-principal">

      <div className="contenedor-secundario">
        <header className="header">
          <h1 className="logo">Running y Estética</h1>
          <nav>
            <ul className="nav-list">
              <li><Link to="/">Inicio</Link></li>
              <li><Link to="/datos">Datos</Link></li>
              <li><Link to="/analisis">Análisis</Link></li>
              <li><Link to="/login">Login</Link></li>
            </ul>
          </nav>
        </header>
      </div>

      <div className="contenedor-secundario">
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/datos" element={<Datos />} />
          <Route path="/analisis" element={<Analisis />} />
          <Route path="/login" element={<Login />} />

        </Routes>
      </div>

      <div className="contenedor-secundario">
        <footer className="footer">
          <p>© 2025 Running y Estética. Todos los derechos reservados.</p>
        </footer>
      </div>

    </div>
  );
}

export default App;
