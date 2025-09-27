# 🏃‍♂️ RunningYestetica

Proyecto personal para el análisis de resultados de carreras y entrenamientos de running.  
Incluye carga de archivos CSV, análisis por género y ritmo, tablas comparativas y gráficas con React.

## 📦 Tecnologías

- React + Vite (frontend)
- Node.js + Express (backend)
- MySQL
- Recharts
- csv-parser, multer

## 🚀 Cómo usar

### Backend
npm install
cd backend
node index.js

Frontend
npm install
cd frontend
npm run dev

Subir cambios a GitHub
git status
git init
git add .
git commit -m "Correcciones Vercel"
git push -u origin main

Forzar un commit anterior

git fetch origin
git switch main
git reset --hard 005fe0b
git push -f origin main  


📊 Funciones

Subida de resultados de carreras (CSV)

Análisis por ritmo promedio (general, género, categoría)

Distribución por rangos de ritmo

Comparativas visuales con gráficas

👤 Autor

Camilo Castro @Camilo92c Instagram — LinkedIn
## Frontend � Gu�a de Estilo

- Tipograf�a: Century Gothic (stack definida en rontend/src/style.css).
- Paleta: base en blanco/negro/grises; acento en hover azul brillante #007bff. Evitar colores chillones.
- Fondo global: imagen /img/fondo.png aplicada al ody (repeat, tama�o 200px, top-left).
- Layout principal: contenedor-principal usa Flexbox con lex-wrap, justify-content: center y una variable --gap para espaciado.
- Columnas utilitarias: usar contenedor-secundario (50%), contenedor-terciario (33.33%), contenedor-cuarto (25%). Contenido centrado (flex column + align/justify center).
- Header: sticky, glassmorphism sutil; logo clicable al inicio (logo-link); navbar minimalista con hamburguesa en mobile.
- Enlaces: sin subrayado por defecto; usar .link para subrayado animado y hover sutil (coherente con navbar y logo).
- Formularios (login/registro): usar orm-wrap, orm-card, orm, orm-field, orm-label, orm-input, orm-actions. Bordes suaves y transici�n en :focus.
- Blog: estructura con log-layout, log-main, log-aside (sidebar estrecho/scrollable), log-list y log-item con acento lateral y hover suave.
- Utilidades disponibles: .mt-05, .mt-1, .mb-05, .ml-05, .ml-1, .text-center, .muted, .fs-095, .w-100, .hidden, .clickable, .table.
- Normas de c�digo: no usar estilos inline (style={{ � }}); centralizar estilos en rontend/src/style.css; mantener dise�o minimalista, claro y responsivo.
