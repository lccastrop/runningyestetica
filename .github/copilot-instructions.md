# Copilot instructions for RunningYestetica

This document gives concise, actionable guidance for AI coding agents working on RunningYestetica.

- Project layout
  - `backend/` — Node.js + Express API, uses MySQL via `backend/db.js`. Entry point: `backend/index.js`.
  - `frontend/` — React + Vite + TypeScript app. Entry point: `frontend/src/main.tsx`. Routes live under `frontend/src/pages/`.
  - `uploads/` — files uploaded by the backend (CSV imports, stored by `multer`).

- How the app runs locally
  - Backend: open a terminal in `backend/` and run:

    ```powershell
    npm install
    node index.js
    ```

    Backend listens on `PORT` or `3001` by default. It expects MySQL credentials in `.env` (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME). Session store uses `express-mysql-session` and the session cookie key is `session_id`.

  - Frontend: open a terminal in `frontend/` and run:

    ```powershell
    npm install
    npm run dev
    ```

    Frontend runs on Vite (hot reload) and expects the backend at `http://localhost:3001` in several axios calls (see `RequireAdmin.tsx` which calls `/session`). Use `axios` with `withCredentials: true` to send session cookies.

- Authentication & Sessions
  - Backend uses `express-session` + `express-mysql-session`. Session cookie key: `session_id`; secret comes from `SESSION_SECRET`.
  - Login route: `POST /login` — stores `req.session.user = { id, email, role }` on success.
  - Session check: `GET /session` — returns `{ authenticated: true, user }` or 401.
  - Logout: `POST /logout` — destroys the session and clears the `session_id` cookie.
  - Protected routes in the backend use middleware names `requirePlus` and `requireAdmin` (ensure these exist if modifying access control). Frontend protected route helper `RequireAdmin.tsx` expects `/session` to return `user.role === 'admin'`.

- CSV uploads and data flow
  - `POST /upload-resultados` and `POST /upload-entrenamiento` accept `multipart/form-data` via `multer` and parse CSV using `csv-parser`.
  - Upload handlers normalize CSV column names by removing spaces and non-word characters, then bulk-insert into MySQL tables (`resultados`, `entrenamientos`, `series`). These handlers delete the uploaded file (`fs.unlinkSync`) after processing.

- Important files to inspect when changing behaviour
  - `backend/index.js` — main routes, session setup, file upload handlers, data processing and analysis SQL queries.
  - `backend/db.js` — MySQL connection (uses `mysql2.createConnection`). Tests and migrations are not present; schema must exist beforehand.
  - `frontend/src/components/RequireAdmin.tsx` — example of client session check using axios withCredentials.
  - `frontend/src/pages/` — pages using API endpoints (create/edit blog, upload forms, analysis views).

- Common pitfalls already observed
  - TypeScript import rules — use `import type { ReactNode }` or `import { type ReactNode }` in TSX files when `verbatimModuleSyntax` is enabled (observed in `RequireAdmin.tsx`).
  - Frontend route typo: stray backtick in `frontend/src/App.tsx` at the `/analisis` route (remove `/>´`).
  - Missing pages can cause module resolution errors; ensure files under `frontend/src/pages` match imports (case-sensitive).
  - Session cookie configuration: backend sets cookie but CORS must allow credentials; `app.use(cors({ origin: true, credentials: true }))` is in `index.js` — front-end must call with `withCredentials: true`.

- Developer workflows
  - Start backend first, then frontend. Backend requires a running MySQL accessible via `.env` variables.
  - Local debugging: backend logs to console; to debug in an IDE, run `node --inspect index.js` or use `nodemon` for live reload.
  - Database schema: not included — assume tables `users`, `blogs`, `carreras`, `resultados`, `entrenamientos`, `series`, and `sessions` exist. When adding migrations, prefer a small SQL file or use a migration tool (not currently present).

- Code patterns and conventions
  - SQL is written inline with `db.query` (callback style) using `mysql2` connection object. Be careful to sanitize inputs if modifying queries; use `?` parameter placeholders like existing code.
  - CSV normalization removes spaces and non-word characters: `clave.replace(/\s+/g, '').replace(/[^\w]/g, '')`.
  - Time calculations: `segundosAHHMMSS` converts decimal seconds to `HH:MM:SS` and is used when computing `ritmo_medio`.

- If you change sessions/auth
  - Keep cookie key `session_id` consistent or update frontend axios calls accordingly.
  - Ensure `cors` credentials and `axios` `withCredentials` remain enabled to allow cookies across localhost ports.
  - For production, set `cookie.secure = true` and ensure HTTPS and a proper `SESSION_SECRET`.

- PR & commit guidance for AI agents
  - Keep changes minimal and focused. When adding middleware, update both `backend/index.js` and any frontend callers (`RequireAdmin.tsx`, login/logout flows).
  - Add a short `README` snippet if you introduce a new developer step (for example, migrations or new `.env` keys).

If anything here is unclear or you want more specific examples (e.g. integrate `requirePlus`/`requireAdmin` implementations, or change session store to Redis), tell me which area to expand and I will iterate.
