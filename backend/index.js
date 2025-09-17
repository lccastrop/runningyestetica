// backend/index.js
const express = require('express');
const cors = require('cors');
const db = require('./db');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const bcrypt = require('bcryptjs');
const admin = require('./firebaseAdmin');
const https = require('https');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';
const allowedOrigin = isProd ? process.env.FRONTEND_URL : true;
// Optional: allow multiple origins in production via FRONTEND_URLS (comma-separated)
const allowedOriginsList = isProd
  ? (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || '')
      .split(',')
      .map((s) => (s || '').trim())
      .filter(Boolean)
  : [];
// Debug flags removed for production hardening

// Middleware
// CORS: accept a single origin or a list of allowed origins
app.use(
  cors({
    origin: (origin, callback) => {
      if (!isProd) return callback(null, true);
      if (!origin) return callback(null, true); // allow non-browser tools
      if (
        origin === allowedOrigin ||
        (allowedOriginsList.length > 0 && allowedOriginsList.includes(origin))
      ) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);
app.use(express.json());
app.set('trust proxy', 1);

const sessionStore = new MySQLStore(
  {
    clearExpired: true,
    checkExpirationInterval: 15 * 60 * 1000,
    expiration: 24 * 60 * 60 * 1000,
    createDatabaseTable: false,
    schema: {
      tableName: 'sessions',
      columnNames: {
        session_id: 'session_id',
        expires: 'expires',
        data: 'data',
      },
    },
  },
  db
);

app.use(
  session({
    name: 'session_id',
    secret: process.env.SESSION_SECRET || 'devsecret',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: isProd ? 'none' : 'lax',
      secure: isProd,
    },
  })
);

// Removed debug request logger

// Ensure uploads directory and static serving
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  try { fs.mkdirSync(uploadsDir, { recursive: true }); } catch (_) {}
}
app.use('/uploads', express.static(uploadsDir, {
  maxAge: '1y',
  immutable: true,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
}));

// Verify Google reCAPTCHA v2 token
function verifyRecaptcha(token, remoteip) {
  return new Promise((resolve) => {
    try {
      const secret = process.env.RECAPTCHA_SECRET;
      if (!secret || !token) return resolve(false);
      const postData = `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(token)}${remoteip ? `&remoteip=${encodeURIComponent(remoteip)}` : ''}`;
      const options = {
        hostname: 'www.google.com',
        path: '/recaptcha/api/siteverify',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
        },
      };
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(Boolean(json && json.success));
          } catch (_) {
            resolve(false);
          }
        });
      });
      req.on('error', () => resolve(false));
      req.write(postData);
      req.end();
    } catch (_) {
      resolve(false);
    }
  });
}

// Multer for CSV (existing usage)
const upload = multer({ dest: uploadsDir });

// Multer config for image uploads
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const hash = crypto
      .createHash('sha256')
      .update((file.originalname || '') + Date.now().toString() + Math.random().toString())
      .digest('hex')
      .slice(0, 32);
    cb(null, `${hash}${ext}`);
  },
});

const imageFileFilter = (req, file, cb) => {
  const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml']);
  if (!allowed.has(file.mimetype)) return cb(new Error('Tipo de archivo no permitido'));
  cb(null, true);
};

const uploadImages = multer({
  storage: imageStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Middlewares de autorización
function requirePlus(req, res, next) {
  const user = req.session.user;
  if (!user || (user.role !== 'plus' && user.role !== 'admin')) {
    return res.status(403).json({ error: 'Acceso denegado' });
  }
  next();
}

function requireAdmin(req, res, next) {
  const user = req.session.user;
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado' });
  }
  next();
}

// Root
app.get('/', (req, res) => {
  res.send('API de running funcionando');
});

// Auth
app.post('/register', async (req, res) => {
  const { email, password, nombres, apellidos, recaptcha } = req.body || {};
  if (!email || !password || !nombres || !apellidos) {
    return res.status(400).json({ error: 'Faltan datos' });
  }
  // Verify reCAPTCHA
  try {
    const ok = await verifyRecaptcha(recaptcha || req.body?.['g-recaptcha-response'], req.ip);
    if (!ok) return res.status(400).json({ error: 'Verificación reCAPTCHA falló' });
  } catch (_) {
    return res.status(400).json({ error: 'Verificación reCAPTCHA falló' });
  }

  const checkQuery = 'SELECT id FROM users WHERE email = ?';
  db.query(checkQuery, [email], (err, results) => {
    if (err) {
      console.error('Error al verificar usuario existente:', err);
      return res.status(500).json({ error: 'Error en la base de datos' });
    }
    if (results.length > 0) {
      return res.status(409).json({ error: 'Usuario ya existe' });
    }

    bcrypt.hash(password, 10, (err, hash) => {
      if (err) return res.status(500).json({ error: 'Error al encriptar contraseña' });

      const insertQuery = 'INSERT INTO users (email, nombres, apellidos, password_hash, role) VALUES (?, ?, ?, ?, ?)';
      db.query(insertQuery, [email, nombres, apellidos, hash, 'free'], (err2) => {
        if (err2) {
          console.error('Error al registrar usuario:', err2);
          return res.status(500).json({ error: 'Error al registrar usuario' });
        }
        res.status(201).json({ message: 'Usuario registrado' });
      });
    });
  });
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Faltan credenciales' });
  }

  const query = 'SELECT id, email, password_hash, role, nombres, apellidos FROM users WHERE email = ?';
  db.query(query, [email], (err, results) => {
    if (err) {
      console.error('Error al buscar usuario:', err);
      return res.status(500).json({ error: 'Error en la base de datos' });
    }
    if (results.length === 0) return res.status(401).json({ error: 'Credenciales inválidas' });

    const user = results[0];
    bcrypt.compare(password, user.password_hash, (err2, match) => {
      if (err2) return res.status(500).json({ error: 'Error al verificar contraseña' });
      if (!match) return res.status(401).json({ error: 'Credenciales inválidas' });

      req.session.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        nombres: user.nombres,
        apellidos: user.apellidos,
      };
      res.json({ message: 'Inicio de sesión exitoso', user: req.session.user });
    });
  });
});

// Login con Google (Firebase ID token)
app.post('/login-google', async (req, res) => {
  const { idToken } = req.body || {};
  if (!idToken) return res.status(400).json({ error: 'idToken requerido' });

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    const email = decoded.email;
    const fullName = decoded.name || '';
    if (!email) return res.status(400).json({ error: 'Email no disponible en token' });

    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    const nombres = parts.length > 1 ? parts.slice(0, -1).join(' ') : (parts[0] || email.split('@')[0]);
    const apellidos = parts.length > 1 ? parts.slice(-1).join(' ') : '';

    const selectQ = 'SELECT id, email, role, nombres, apellidos FROM users WHERE email = ?';
  db.query(selectQ, [email], (err, rows) => {
      if (err) {
        console.error('Error buscando usuario Google:', err);
        return res.status(500).json({
          error: 'Error en la base de datos',
          code: err.code,
          message: isProd ? undefined : err.sqlMessage,
        });
      }
      if (rows.length > 0) {
        const u = rows[0];
        req.session.user = { id: u.id, email: u.email, role: u.role, nombres: u.nombres, apellidos: u.apellidos };
        return res.json({ message: 'Inicio de sesión con Google', user: req.session.user });
      }

      const insertQ = 'INSERT INTO users (email, nombres, apellidos, password_hash, role) VALUES (?, ?, ?, ?, ?)';
      db.query(insertQ, [email, nombres, apellidos, '', 'free'], (err2, result) => {
        if (err2) {
          console.error('Error creando usuario Google:', err2);
          return res.status(500).json({
            error: 'Error al registrar usuario',
            code: err2.code,
            message: isProd ? undefined : err2.sqlMessage,
          });
        }
        const user = { id: result.insertId, email, role: 'free', nombres, apellidos };
        req.session.user = user;
        res.json({ message: 'Usuario creado con Google', user });
      });
    });
  } catch (e) {
    console.error('Error verificando idToken de Google:', e);
    res.status(401).json({ error: 'Token inválido' });
  }
});

app.get('/session', (req, res) => {
  if (req.session.user) {
    res.json({ authenticated: true, user: req.session.user });
  } else {
    res.status(401).json({ authenticated: false });
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Error al cerrar sesión' });
    res.clearCookie('session_id', {
      sameSite: isProd ? 'none' : 'lax',
      secure: isProd,
    });
    res.json({ message: 'Sesión cerrada' });
  });
});

// Blogs
app.get('/blogs', (req, res) => {
  const query = `
    SELECT b.id, b.title, b.content, b.user_id, b.created_at, u.nombres, u.apellidos
    FROM blogs b
    JOIN users u ON b.user_id = u.id
    ORDER BY b.created_at DESC
  `;
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error al obtener blogs:', err);
      return res.status(500).json({ error: 'Error al obtener blogs' });
    }
    res.json(results);
  });
});

app.post('/blogs', requirePlus, (req, res) => {
  const { title, content } = req.body;
  const userId = req.session.user.id;
  const query = 'INSERT INTO blogs (user_id, title, content) VALUES (?, ?, ?)';
  db.query(query, [userId, title, content], (err, result) => {
    if (err) {
      console.error('Error al crear blog:', err);
      return res.status(500).json({ error: 'Error al crear blog' });
    }
    res.json({
      id: result.insertId,
      user_id: userId,
      title,
      content,
      nombres: req.session.user.nombres,
      apellidos: req.session.user.apellidos,
      created_at: new Date().toISOString(),
    });
  });
});

// Blogs del usuario autenticado
app.get('/my-blogs', (req, res, next) => {
  const user = req.session.user;
  if (!user) return res.status(401).json({ error: 'No autenticado' });
  const query = `
    SELECT b.id, b.title, b.content, b.user_id, b.created_at, u.nombres, u.apellidos
    FROM blogs b
    JOIN users u ON b.user_id = u.id
    WHERE b.user_id = ?
    ORDER BY b.created_at DESC
  `;
  db.query(query, [user.id], (err, results) => {
    if (err) {
      console.error('Error al obtener mis blogs:', err);
      return res.status(500).json({ error: 'Error al obtener mis blogs' });
    }
    res.json(results);
  });
});

app.put('/blogs/:id', requirePlus, (req, res) => {
  const blogId = req.params.id;
  const { title, content } = req.body;
  const user = req.session.user;
  let query = 'UPDATE blogs SET title = ?, content = ? WHERE id = ?';
  const params = [title, content, blogId];
  if (user.role !== 'admin') {
    query += ' AND user_id = ?';
    params.push(user.id);
  }
  db.query(query, params, (err, result) => {
    if (err) {
      console.error('Error al actualizar blog:', err);
      return res.status(500).json({ error: 'Error al actualizar blog' });
    }
    if (result.affectedRows === 0) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    res.json({ message: 'Blog actualizado' });
  });
});

app.delete('/blogs/:id', requireAdmin, (req, res) => {
  const blogId = req.params.id;
  db.query('DELETE FROM blogs WHERE id = ?', [blogId], (err) => {
    if (err) {
      console.error('Error al eliminar blog:', err);
      return res.status(500).json({ error: 'Error al eliminar blog' });
    }
    res.json({ message: 'Blog eliminado' });
  });
});

// Subida de imágenes
app.post('/upload-image', requirePlus, uploadImages.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Archivo requerido (campo: image)' });
  const user = req.session.user || null;
  const url = `/uploads/${req.file.filename}`;
  const insert = `
    INSERT INTO imagenes (user_id, url, original_name, mime, size_bytes, width, height)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(
    insert,
    [user?.id || null, url, req.file.originalname || null, req.file.mimetype, req.file.size || 0, null, null],
    (err, result) => {
      if (err) {
        console.error('Error registrando metadatos imagen:', err);
        return res.status(500).json({ error: 'Error al guardar metadatos' });
      }
      res.json({
        id: result.insertId,
        url,
        original_name: req.file.originalname,
        mime: req.file.mimetype,
        size_bytes: req.file.size,
      });
    }
  );
});

// CSV entrenamiento
app.post('/upload-entrenamiento', requireAdmin, upload.single('file'), (req, res) => {
  const filePath = req.file.path;
  const results = [];

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', () => {
      // 1. Normalizar claves del CSV
      const normalizarClave = (clave) => clave.replace(/\s+/g, '').replace(/[^\w]/g, '');
      const resultsNormalizados = results.map(obj => {
        const nuevo = {};
        for (let key in obj) {
          nuevo[normalizarClave(key)] = obj[key];
        }
        return nuevo;
      });

      // 2. Insertar entrenamiento primero
      const insertEntrenamiento = `INSERT INTO entrenamientos (nombre, comentario) VALUES (?, ?)`;
      db.query(insertEntrenamiento, ['Entreno COROS', 'Cargado desde CSV'], (err, result) => {
        if (err) {
          fs.unlinkSync(filePath);
          console.error('Error al insertar entrenamiento:', err.message);
          return res.status(500).json({ error: 'Error al crear entrenamiento' });
        }

        const entrenamientoId = result.insertId;

        // 3. Insertar series asociadas
        const values = resultsNormalizados.map(row => [
          entrenamientoId,
          parseInt(row.Split) || null,
          row.Time || null,
          row.MovingTime || null,
          parseFloat(row.GetDistance) || null,
          parseFloat(row.ElevationGain) || null,
          parseFloat(row.ElevLoss) || null,
          row.AvgPace || null,
          row.AvgMovingPace || null,
          row.BestPace || null,
          parseInt(row.AvgRunCadence) || null,
          parseInt(row.MaxRunCadence) || null,
          parseFloat(row.AvgStrideLength) || null,
          parseInt(row.AvgHR) || null,
          parseInt(row.MaxHR) || null,
          parseFloat(row.AvgTemperature) || null,
          parseFloat(row.Calories) || null
        ]);

        const insertSeries = `
          INSERT INTO series (
            entrenamiento_id, split, tiempo, tiempo_mov, distancia,
            elevacion_subida, elevacion_bajada, ritmo_promedio, ritmo_mov_promedio,
            mejor_ritmo, cadencia_promedio, cadencia_maxima, zancada_promedio,
            fc_promedio, fc_maxima, temperatura_prom, calorias
          ) VALUES ?
        `;

        db.query(insertSeries, [values], (err2, result2) => {
          fs.unlinkSync(filePath);

          if (err2) {
            console.error('Error al insertar series:', err2.message);
            return res.status(500).json({ error: 'Error al insertar series' });
          }

          res.json({
            message: 'Entrenamiento y series cargados correctamente',
            entrenamiento_id: entrenamientoId,
            series_insertadas: result2.affectedRows
          });
        });
      });
    });
});

// CSV resultados de carreras
app.post('/upload-resultados', requireAdmin, upload.single('file'), (req, res) => {
  const { nombreCarrera, fecha, distancia, ascenso_total } = req.body;
  const filePath = req.file.path;
  const resultados = [];
  const debugUploads = (process.env.DEBUG_UPLOADS === '1') || (String(req.query?.debug || '').toLowerCase() === '1') || (String(req.query?.debug || '').toLowerCase() === 'true');
  const dbg = (...args) => { if (debugUploads) console.log('[upload-resultados]', ...args); };

  // Buscar o crear la carrera
  const obtenerIdCarrera = () => {
    return new Promise((resolve, reject) => {
      db.query('SELECT id FROM carreras WHERE nombre = ?', [nombreCarrera], (err, rows) => {
        if (err) return reject(err);
        if (rows.length > 0) return resolve(rows[0].id);

        db.query(
          'INSERT INTO carreras (nombre, fecha, distancia, ascenso_total) VALUES (?, ?, ?, ?)',
          [nombreCarrera, fecha || null, distancia || null, ascenso_total || null],
          (err2, result) => {
            if (err2) return reject(err2);
            resolve(result.insertId);
          }
        );
      });
    });
  };

  // Convierte segundos a HH:MM:SS
  const segundosAHHMMSS = (segundosDecimales) => {
    const totalSegundos = Math.round(segundosDecimales);
    const hh = Math.floor(totalSegundos / 3600).toString().padStart(2, '0');
    const mm = Math.floor((totalSegundos % 3600) / 60).toString().padStart(2, '0');
    const ss = (totalSegundos % 60).toString().padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  };

  // Normaliza un valor a formato TIME MySQL HH:MM:SS
  const normalizeTime = (val) => {
    if (val === undefined || val === null) return null;
    let s = String(val).trim();
    if (!s) return null;
    // Extraer primer patrón de tiempo h:mm[:ss]
    const m = s.match(/(\d{1,2}:\d{2}(?::\d{2})?)/);
    if (m) s = m[1];
    // hh:mm:ss
    if (/^\d{1,2}:\d{2}:\d{2}$/.test(s)) {
      const [h, mm, ss] = s.split(':');
      return `${String(parseInt(h,10)).padStart(2,'0')}:${mm}:${ss}`;
    }
    // mm:ss -> 00:mm:ss
    if (/^\d{1,2}:\d{2}$/.test(s)) return `00:${s.padStart(5, '0')}`;
    // Sólo segundos numéricos
    if (/^\d+$/.test(s)) {
      const total = parseInt(s, 10);
      const hh = String(Math.floor(total / 3600)).padStart(2, '0');
      const mm = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
      const ss = String(total % 60).padStart(2, '0');
      return `${hh}:${mm}:${ss}`;
    }
    return null;
  };

  // Normaliza valores de género a 'Masculino'/'Femenino' cuando sea reconocible
  const normalizeGender = (val) => {
    if (val === undefined || val === null) return null;
    const raw = String(val).trim();
    if (!raw) return null;
    // minúsculas y sin acentos para comparar con sinónimos
    const s = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const fem = new Set(['f','f.','fem','fem.','feme','femen','femenil','femenina','femeninas','femenino','female','females','woman','women','mujer','mujeres','dama','damas','lady','ladies','girl','girls']);
    const masc = new Set(['m','m.','masc','masc.','mascu','mascul','masculino','masculina','masculinas','varon','varones','varonil','male','males','man','men','hombre','hombres','caballero','caballeros','gentleman','gentlemen','boy','boys']);
    if (fem.has(s)) return 'Femenino';
    if (masc.has(s)) return 'Masculino';
    // heurística por subcadenas seguras
    if (/\bfem(en|enin[oa]?|enil)?\b/.test(s) || /\bmujer(es)?\b/.test(s) || /\bdamas?\b/.test(s) || /\blad(y|ies)\b/.test(s) || /\bgirls?\b/.test(s)) { return 'Femenino'; }
    if (/\bmasc(ulino|ulina)?\b/.test(s) || /\bvaron(es)?\b/.test(s) || /\bhombre(s)?\b/.test(s) || /\bcaballer(os|o)\b/.test(s) || /\bgentlemen?\b/.test(s) || /\bboys?\b/.test(s)) { return 'Masculino'; }
    return val;
  };

  dbg('Recibiendo carga CSV de resultados', {
    nombreCarrera,
    fecha,
    distancia,
    ascenso_total,
    filePath
  });

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (data) => resultados.push(data))
    .on('end', async () => {
      try {
        dbg('Filas CSV leídas:', resultados.length);
        const carreraId = await obtenerIdCarrera();
        dbg('Carrera ID', carreraId);
        const distanciaKm = parseFloat(distancia);

        const normalizarClave = (clave) => clave.replace(/\s+/g, '').replace(/[^\w]/g, '');
        const resultadosNormalizados = resultados.map(obj => {
          const nuevo = {};
          for (let key in obj) {
            nuevo[normalizarClave(key)] = obj[key];
          }
          return nuevo;
        });
        dbg('Ejemplo fila normalizada', resultadosNormalizados[0]);

        // Determinar columnas opcionales disponibles en el CSV (case-insensitive, unión de todas las filas)
        const lowerKeys = new Set();
        for (const obj of resultadosNormalizados) {
          for (const k of Object.keys(obj)) lowerKeys.add(k.toLowerCase());
        }
        // Descriptores de columnas opcionales: nombre en BD y formas reconocidas en CSV (normalizadas y minúsculas)
        const makeTimeDesc = (dbName, extra = []) => {
          const base = dbName.toLowerCase();
          const noUnderscore = base.replace(/_/g, '');
          // admitir variantes con "k"/"km" y con/ sin subrayado
          const variants = new Set([base, noUnderscore, ...extra.map(s => s.toLowerCase())]);
          return { dbName, kind: 'time', keys: Array.from(variants) };
        };
        const optionalDescs = [
          { dbName: 'bib', kind: 'text', keys: [
            // comunes
            'bib','dorsal','numero','num','nro','numeroatleta','numero_corredor','numcorredor'
          ] },
          // 5 km
          makeTimeDesc('RM_5km', ['rm5km','rm_5k','rm5k','ritmo5km','ritmo5k','pace5km','pace5k','ritmo_5km','pace_5km','pace_5k','ritmo_5k','ritmop1','ritmo_p1','pacerp1','pacep1','pace_p1','ritmo01','ritmop01','ritmo_p01']),
          makeTimeDesc('split_5km', ['split5km','split_5k','split5k','parcial5km','parcial_5km','lap5km','lap_5k','lap5k','partial5km','partial5k','parcial1','parcial_1','p1','p_1','p01','parcial01','primerparcial','parcialp1']),
          // 10 km
          makeTimeDesc('RM_10km', ['rm10km','rm_10k','rm10k','ritmo10km','ritmo10k','pace10km','pace10k','ritmo_10km','pace_10km','ritmop2','ritmo_p2','pacep2','pace_p2','ritmo02','ritmop02','ritmo_p02']),
          makeTimeDesc('split_10km', ['split10km','split_10k','split10k','parcial10km','lap10km','partial10km','parcial2','parcial_2','p2','p_2','p02','parcial02','segundoparcial','parcialp2']),
          // 15 km
          makeTimeDesc('RM_15km', ['rm15km','rm_15k','rm15k','ritmo15km','pace15km','ritmop3','ritmo_p3','pacep3','pace_p3','ritmo03','ritmop03','ritmo_p03']),
          makeTimeDesc('split_15km', ['split15km','split_15k','split15k','parcial15km','lap15km','partial15km','parcial3','parcial_3','p3','p_3','p03','parcial03','tercerparcial','parcialp3']),
          // 21 km (mediamaratón)
          makeTimeDesc('RM_21km', ['rm21km','rm_21k','rm21k','ritmo21km','ritmo21k','pace21km','pace21k','ritmop4','ritmo_p4','pacep4','pace_p4','ritmo04','ritmop04','ritmo_p04']),
          makeTimeDesc('split_21km', ['split21km','split_21k','split21k','parcial21km','lap21km','partial21km','parcial4','parcial_4','p4','p_4','p04','parcial04','cuartoparcial','parcialp4']),
          // 25 km
          makeTimeDesc('RM_25km', ['rm25km','rm_25k','rm25k','ritmo25km','pace25km','ritmop5','ritmo_p5','pacep5','pace_p5','ritmo05','ritmop05','ritmo_p05']),
          makeTimeDesc('split_25km', ['split25km','split_25k','split25k','parcial25km','lap25km','partial25km','parcial5','parcial_5','p5','p_5','p05','parcial05','quintoparcial','parcialp5']),
          // 30 km
          makeTimeDesc('RM_30km', ['rm30km','rm_30k','rm30k','ritmo30km','pace30km']),
          makeTimeDesc('split_30km', ['split30km','split_30k','split30k','parcial30km','lap30km','partial30km']),
          // 35 km
          makeTimeDesc('RM_35km', ['rm35km','rm_35k','rm35k','ritmo35km','pace35km']),
          makeTimeDesc('split_35km', ['split35km','split_35k','split35k','parcial35km','lap35km','partial35km']),
          // 40 km
          makeTimeDesc('RM_40km', ['rm40km','rm_40k','rm40k','ritmo40km','pace40km']),
          makeTimeDesc('split_40km', ['split40km','split_40k','split40k','parcial40km','lap40km','partial40km']),
          // 42 km (maratón)
          makeTimeDesc('RM_42km', ['rm42km','rm_42k','rm42k','ritmo42km','pace42km','maratonrm','marathonpace']),
          makeTimeDesc('split_42km', ['split42km','split_42k','split42k','parcial42km','lap42km','partial42km']),
        ];
        const presentOptional = [];
        for (const d of optionalDescs) {
          if (d.keys.some(k => lowerKeys.has(k))) presentOptional.push(d);
        }
        dbg('Opcionales detectados', presentOptional.map(d => d.dbName));

        const baseCols = [
          'carrera_id','nombre','genero','categoria','tiempo_chip','ritmo_medio','distancia','ascenso_total'
        ];
        const insertCols = baseCols.concat(presentOptional.map(c => c.dbName));
        dbg('Columnas a insertar', insertCols);

        let omitidos = 0;
        const valores = resultadosNormalizados.map(row => {
          // mapa en minúsculas para acceso flexible
          const rowLC = {};
          for (const k of Object.keys(row)) rowLC[k.toLowerCase()] = row[k];

          // aliases para columnas base
          const getByAliases = (aliases) => {
            for (const a of aliases) {
              if (a in rowLC) return rowLC[a];
            }
            return null;
          };

          const nombreV = getByAliases([
            'nombre','atleta','corredor','competidor','participante','participant','nombrecompleto','fullname','name','nombre_completo','athlete','athlete_name','athletename'
          ]);
          const generoV = getByAliases([
            'genero','gnero','rama','sexo','gender','sex','rama_m','rama_f','division_sexo','genderdivision'
          ]);
          const categoriaV = getByAliases([
            'categoria','categoría','cat','catg','agegroup','age_group','division','category','grupo_edad','grupoedad','agecategory','age_cat'
          ]);
          // incluir variantes con y sin guión bajo y también tiempo_oficial como fallback
          const tiempoChipVRaw = getByAliases([
            'tiempochip','tiempo_chip','chiptime','chip_time','nettime','net_time','tiempofinal','tiempo_final','tiempooficial','tiempo_oficial','tiempo','time','finaltime','final_time','officialtime','official_time',
            // nuevos sinónimos para tiempo total
            'tiempototal','tiempo_total','totaltime','total_time','tiempofinaltotal','tiempo_final_total'
          ]) || row.TiempoChip || row['Tiempo_Chip'] || row.TiempoTotal || row['Tiempo_Total'] || null;

          const tiempoChipV = normalizeTime(tiempoChipVRaw);

          // Calcular ritmo_medio usando tiempoChip y distanciaKm
          let ritmoMedio = null;
          if (tiempoChipV && distanciaKm) {
            const partes = tiempoChipV.split(':').map(Number);
            if (partes.length === 3) {
              const tiempoSeg = (partes[0] * 3600) + (partes[1] * 60) + partes[2];
              const ritmoSeg = tiempoSeg / distanciaKm;
              ritmoMedio = segundosAHHMMSS(ritmoSeg);
            }
          }

          // Si no hay tiempo válido o es cero (00:00:00 o 0:00:00, etc.), omitir la fila
          let tiempoEsCero = false;
          if (tiempoChipV) {
            const p = tiempoChipV.split(':').map(Number);
            const secs = p.length === 3 ? (p[0]*3600 + p[1]*60 + p[2]) : (p.length === 2 ? (p[0]*60 + p[1]) : (parseInt(tiempoChipV,10) || 0));
            tiempoEsCero = secs === 0;
          }
          if (!tiempoChipV || tiempoEsCero) {
            omitidos++;
            return null;
          }

          const baseValues = [
            carreraId,
            nombreV || row.Nombre || null,
            normalizeGender(generoV || row.Genero || null),
            categoriaV || row.Categoria || null,
            tiempoChipV,
            ritmoMedio,
            distanciaKm || null,
            ascenso_total || null
          ];

          const extraValues = presentOptional.map(c => {
            // Busca por cualquiera de las claves reconocidas
            let v = null;
            for (const key of c.keys) {
              if (key in rowLC) { v = rowLC[key]; break; }
            }
            if (c.kind === 'time') return normalizeTime(v);
            return v != null && String(v).trim() !== '' ? String(v) : null;
          });

          return baseValues.concat(extraValues);
        }).filter(v => v !== null);

        dbg('Filas a insertar', valores.length, 'omitidos', omitidos);
        if (valores.length === 0) {
          fs.unlinkSync(filePath);
          return res.status(400).json({ error: 'No hay resultados con tiempo válido para insertar', omitidos });
        }

        const query = `INSERT INTO resultados (${insertCols.join(', ')}) VALUES ?`;

        db.query(query, [valores], (err, result) => {
          try { fs.unlinkSync(filePath); } catch (_) {}
          if (err) {
            console.error('Error al insertar resultados:', err);
            return res.status(500).json({
              error: 'Error al insertar resultados',
              code: err.code,
              message: isProd && !debugUploads ? undefined : (err.sqlMessage || String(err))
            });
          }
          res.json({ message: 'Resultados cargados exitosamente', insertados: result.affectedRows, omitidos, columnas: insertCols });
        });
      } catch (err) {
        try { fs.unlinkSync(filePath); } catch (_) {}
        console.error('Error al procesar carrera:', err);
        res.status(500).json({
          error: 'Error al procesar la carrera',
          code: err.code,
          message: isProd && !debugUploads ? undefined : (err.message || String(err))
        });
      }
    });
});

// Carreras y análisis
app.get('/carreras', (req, res) => {
  db.query('SELECT id, nombre FROM carreras', (err, results) => {
    if (err) {
      console.error('Error obteniendo carreras:', err);
      return res.status(500).json({ error: 'Error al obtener carreras', details: err.message });
    }
    res.json(results);
  });
});

app.get('/analisis-carrera/:id', (req, res) => {
  const carreraId = req.params.id;
  const query = `
    SELECT 
      SEC_TO_TIME(AVG(TIME_TO_SEC(ritmo_medio))) AS ritmo_general,
      SEC_TO_TIME(AVG(CASE WHEN genero = 'Masculino' THEN TIME_TO_SEC(ritmo_medio) END)) AS ritmo_masculino,
      SEC_TO_TIME(AVG(CASE WHEN genero = 'Femenino' THEN TIME_TO_SEC(ritmo_medio) END)) AS ritmo_femenino,
      SUM(CASE WHEN genero = 'Masculino' THEN 1 ELSE 0 END) AS conteo_masculino,
      SUM(CASE WHEN genero = 'Femenino' THEN 1 ELSE 0 END) AS conteo_femenino
    FROM resultados
    WHERE carrera_id = ?
  `;
  db.query(query, [carreraId], (err, results) => {
    if (err) {
      console.error('Error en análisis:', err.message);
      return res.status(500).json({ error: 'Error en el análisis de la carrera' });
    }
    res.json({
      ritmo_general: results[0].ritmo_general,
      ritmo_masculino: results[0].ritmo_masculino,
      ritmo_femenino: results[0].ritmo_femenino,
      conteo_masculino: results[0].conteo_masculino,
      conteo_femenino: results[0].conteo_femenino
    });
  });
});

app.get('/analisis-carrera-ritmos/:id', (req, res) => {
  const carreraId = req.params.id;
  const rangos = [
    { etiqueta: '< 03:20', min: 0, max: 199 },
    { etiqueta: '03:20–03:45', min: 200, max: 225 },
    { etiqueta: '03:45–04:00', min: 226, max: 240 },
    { etiqueta: '04:00–04:15', min: 241, max: 255 },
    { etiqueta: '04:16–04:46', min: 256, max: 286 },
    { etiqueta: '04:47–05:14', min: 287, max: 314 },
    { etiqueta: '05:15–05:30', min: 315, max: 330 },
    { etiqueta: '05:31–06:30', min: 331, max: 390 },
    { etiqueta: '06:31–07:37', min: 391, max: 457 },
    { etiqueta: '07:38–08:28', min: 458, max: 508 },
    { etiqueta: '≥ 08:29', min: 509, max: 10000 }
  ];

  const totalQuery = `
    SELECT
      SUM(CASE WHEN genero = 'Femenino' THEN 1 ELSE 0 END) AS total_femenino,
      SUM(CASE WHEN genero = 'Masculino' THEN 1 ELSE 0 END) AS total_masculino
    FROM resultados
    WHERE carrera_id = ?
  `;

  db.query(totalQuery, [carreraId], (err, totales) => {
    if (err) return res.status(500).json({ error: 'Error al obtener totales' });

    const totalF = totales[0].total_femenino || 1;
    const totalM = totales[0].total_masculino || 1;

    const queries = rangos.map(rango => `
      SELECT
        '${rango.etiqueta}' AS rango,
        SUM(CASE WHEN genero = 'Femenino' AND TIME_TO_SEC(ritmo_medio) BETWEEN ${rango.min} AND ${rango.max} THEN 1 ELSE 0 END) AS femenino,
        SUM(CASE WHEN genero = 'Masculino' AND TIME_TO_SEC(ritmo_medio) BETWEEN ${rango.min} AND ${rango.max} THEN 1 ELSE 0 END) AS masculino
      FROM resultados
      WHERE carrera_id = ${carreraId}
    `);

    db.query(queries.join(' UNION ALL '), (err2, filas) => {
      if (err2) return res.status(500).json({ error: 'Error al obtener rangos' });

      const procesado = filas.map(fila => ({
        rango: fila.rango,
        femenino: fila.femenino,
        femenino_pct: ((fila.femenino / totalF) * 100).toFixed(2),
        masculino: fila.masculino,
        masculino_pct: ((fila.masculino / totalM) * 100).toFixed(2)
      }));

      res.json({
        total_femenino: totalF,
        total_masculino: totalM,
        distribucion: procesado
      });
    });
  });
});

app.get('/analisis-carrera-categorias/:id', (req, res) => {
  const carreraId = req.params.id;
  const query = `
    SELECT 
      categoria,
      SEC_TO_TIME(AVG(CASE WHEN genero = 'Femenino' THEN TIME_TO_SEC(ritmo_medio) END)) AS ritmo_femenino,
      SUM(CASE WHEN genero = 'Femenino' THEN 1 ELSE 0 END) AS corredoras,
      SEC_TO_TIME(AVG(CASE WHEN genero = 'Masculino' THEN TIME_TO_SEC(ritmo_medio) END)) AS ritmo_masculino,
      SUM(CASE WHEN genero = 'Masculino' THEN 1 ELSE 0 END) AS corredores
    FROM resultados
    WHERE carrera_id = ?
    GROUP BY categoria
    ORDER BY categoria;
  `;

  db.query(query, [carreraId], (err, rows) => {
    if (err) {
      console.error('Error al obtener análisis por categoría:', err.message);
      return res.status(500).json({ error: 'Error al obtener análisis por categoría' });
    }
    res.json(rows);
  });
});

// Perfil del usuario autenticado
function requireAuth(req, res, next) {
  const user = req.session.user;
  if (!user) return res.status(401).json({ error: 'No autenticado' });
  next();
}

app.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.session.user });
});

app.put('/me', requireAuth, (req, res) => {
  const user = req.session.user;
  const { email, nombres, apellidos } = req.body || {};
  const emailTrim = (email || '').trim();
  const nomTrim = (nombres || '').trim();
  const apeTrim = (apellidos || '').trim();

  if (!emailTrim) return res.status(400).json({ error: 'Email requerido' });
  // Validaciones básicas
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(emailTrim)) {
    return res.status(400).json({ error: 'Email inválido' });
  }
  if (nomTrim.length > 100) {
    return res.status(400).json({ error: 'Nombres demasiado largos (máx 100)' });
  }
  if (apeTrim.length > 100) {
    return res.status(400).json({ error: 'Apellidos demasiado largos (máx 100)' });
  }

  const check = 'SELECT id FROM users WHERE email = ? AND id <> ?';
  db.query(check, [emailTrim, user.id], (err, rows) => {
    if (err) {
      console.error('Error comprobando email único:', err);
      return res.status(500).json({ error: 'Error en la base de datos' });
    }
    if (rows.length > 0) {
      return res.status(409).json({ error: 'El email ya está en uso' });
    }

    const upd = 'UPDATE users SET email = ?, nombres = ?, apellidos = ? WHERE id = ?';
    db.query(upd, [emailTrim, nomTrim, apeTrim, user.id], (err2) => {
      if (err2) {
        console.error('Error actualizando perfil:', err2);
        return res.status(500).json({
          error: 'No se pudo actualizar el perfil',
          code: err2.code,
          message: isProd ? undefined : err2.sqlMessage || String(err2),
        });
      }
      req.session.user = { ...user, email: emailTrim, nombres: nomTrim, apellidos: apeTrim };
      res.json({ message: 'Perfil actualizado', user: req.session.user });
    });
  });
});

// Top 5 posiciones por género (femenino y masculino) para una carrera
app.get('/analisis-carrera-top-genero/:id', (req, res) => {
  const carreraId = req.params.id;
  // Excluir categorías de discapacidad con varios sinónimos
  const base = `
    SELECT nombre, genero, categoria, tiempo_chip, ritmo_medio
    FROM resultados
    WHERE carrera_id = ?
      AND genero = ?
      AND tiempo_chip IS NOT NULL
      AND (
        categoria IS NULL OR (
          LOWER(categoria) NOT LIKE ? AND
          LOWER(categoria) NOT LIKE ? AND
          LOWER(categoria) NOT LIKE ? AND
          LOWER(categoria) NOT LIKE ? AND
          LOWER(categoria) NOT LIKE ? AND
          LOWER(categoria) NOT LIKE ? AND
          LOWER(categoria) NOT LIKE ? AND
          LOWER(categoria) NOT LIKE ? AND
          LOWER(categoria) NOT LIKE ?
        )
      )
    ORDER BY tiempo_chip ASC
    LIMIT 5
  `;

  const excludePatterns = [
    '%invident%',     // Invidente/Invidentes
    '%ciego%',        // Ciego/Ciegos
    '%silla de ruedas%', // Silla de Ruedas
    '%ruedas%',       // Ruedas
    '%wheelchair%',   // Wheelchair
    '%paralimp%',     // Paralimpico/Paralímpico
    '%paralymp%',     // Paralympic
    '%discapacidad%', // Discapacidad
    '%pcd%'           // Personas con Discapacidad (PCD)
  ];

  db.query(base, [carreraId, 'Femenino', ...excludePatterns], (errF, femRows) => {
    if (errF) {
      console.error('Error al obtener top femenino:', errF);
      return res.status(500).json({ error: 'Error al obtener top femenino' });
    }
    db.query(base, [carreraId, 'Masculino', ...excludePatterns], (errM, masRows) => {
      if (errM) {
        console.error('Error al obtener top masculino:', errM);
        return res.status(500).json({ error: 'Error al obtener top masculino' });
      }
      res.json({ femenino: femRows, masculino: masRows });
    });
  });
});

// Top 5 posiciones por categoría para una carrera (usa window functions de MySQL 8)
app.get('/analisis-carrera-top-categorias/:id', (req, res) => {
  const carreraId = req.params.id;
  const q = `
    SELECT categoria, nombre, genero, tiempo_chip, ritmo_medio, rn AS pos
    FROM (
      SELECT categoria, nombre, genero, tiempo_chip, ritmo_medio,
             ROW_NUMBER() OVER (PARTITION BY categoria ORDER BY tiempo_chip ASC) AS rn
      FROM resultados
      WHERE carrera_id = ? AND tiempo_chip IS NOT NULL
    ) t
    WHERE rn <= 5
    ORDER BY categoria, rn
  `;
  db.query(q, [carreraId], (err, rows) => {
    if (err) {
      console.error('Error al obtener top por categoría:', err);
      return res.status(500).json({ error: 'Error al obtener top por categoría' });
    }
    res.json(rows);
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
