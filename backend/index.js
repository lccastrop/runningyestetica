// backend/index.js
const express = require('express');
const cors = require('cors');
const db = require('./db');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const bcrypt = require('bcryptjs');
const admin = require('./firebaseAdmin');
const https = require('https');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
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

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: false, // keep simple for now; can be tightened later
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: isProd ? undefined : false,
  })
);

// Rate limiters
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
const uploadLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

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
      sameSite: 'lax',
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
  // SVG deshabilitado por seguridad
  const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
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

const generateInformePublicId = () => {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `informe_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
};

function safeParseJson(value, fallback = null) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (_) {
    return fallback;
  }
}

// Root
app.get('/', (req, res) => {
  res.send('API de running funcionando');
});

// Auth
app.post('/register', registerLimiter, async (req, res) => {
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

app.post('/login', loginLimiter, (req, res) => {
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

      req.session.regenerate((err) => {
        if (err) return res.status(500).json({ error: 'Error de sesión' });
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
});

// Login con Google (Firebase ID token)
app.post('/login-google', loginLimiter, async (req, res) => {
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
        return req.session.regenerate((err) => {
          if (err) return res.status(500).json({ error: 'Error de sesión' });
          req.session.user = { id: u.id, email: u.email, role: u.role, nombres: u.nombres, apellidos: u.apellidos };
          return res.json({ message: 'Inicio de sesión con Google', user: req.session.user });
        });
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
        req.session.regenerate((err3) => {
          if (err3) return res.status(500).json({ error: 'Error de sesión' });
          req.session.user = user;
          res.json({ message: 'Usuario creado con Google', user });
        });
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
      sameSite: 'lax',
      secure: isProd,
    });
    res.json({ message: 'Sesión cerrada' });
  });
});

// Informes
app.get('/informes', (req, res) => {
  const query = `
    SELECT public_id AS id, nombre, created_at AS fecha
    FROM informes_carreras
    ORDER BY created_at DESC
  `;
  db.query(query, (err, rows) => {
    if (err) {
      console.error('Error al obtener informes:', err);
      return res.status(500).json({ error: 'Error al obtener informes' });
    }
    const data = rows.map((row) => ({
      id: row.id,
      nombre: row.nombre,
      fecha: row.fecha ? new Date(row.fecha).toISOString() : new Date().toISOString(),
    }));
    res.json(data);
  });
});

app.post('/informes', requireAdmin, (req, res) => {
  const { nombre, analysis, metadata } = req.body || {};
  const trimmedName = typeof nombre === 'string' ? nombre.trim() : '';
  if (!trimmedName) {
    return res.status(400).json({ error: 'Nombre de informe requerido' });
  }
  if (analysis === undefined) {
    return res.status(400).json({ error: 'Datos de análisis requeridos' });
  }

  let analysisJson;
  try {
    analysisJson = JSON.stringify(analysis);
  } catch (e) {
    console.error('Error serializando análisis de informe:', e);
    return res.status(400).json({ error: 'Análisis inválido' });
  }

  let metadataJson = null;
  if (metadata !== undefined) {
    try {
      metadataJson = JSON.stringify(metadata);
    } catch (e) {
      console.error('Error serializando metadata de informe:', e);
      return res.status(400).json({ error: 'Metadatos inválidos' });
    }
  }

  const publicId = generateInformePublicId();
  const createdAt = new Date();
  const query = `
    INSERT INTO informes_carreras (public_id, nombre, created_at, metadata_json, analysis_json)
    VALUES (?, ?, ?, ?, ?)
  `;
  db.query(query, [publicId, trimmedName, createdAt, metadataJson, analysisJson], (err) => {
    if (err) {
      console.error('Error al guardar informe de carrera:', err);
      return res.status(500).json({ error: 'Error al guardar informe' });
    }
    res.status(201).json({
      id: publicId,
      nombre: trimmedName,
      fecha: createdAt.toISOString(),
      metadata: metadata ?? null,
    });
  });
});

app.get('/informes/:id', (req, res) => {
  const { id } = req.params;
  const query = `
    SELECT public_id AS id, nombre, created_at AS fecha, metadata_json, analysis_json
    FROM informes_carreras
    WHERE public_id = ?
    LIMIT 1
  `;
  db.query(query, [id], (err, rows) => {
    if (err) {
      console.error('Error al obtener informe de carrera:', err);
      return res.status(500).json({ error: 'Error al obtener informe' });
    }
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Informe no encontrado' });
    }
    const row = rows[0];
    res.json({
      id: row.id,
      nombre: row.nombre,
      fecha: row.fecha ? new Date(row.fecha).toISOString() : new Date().toISOString(),
      metadata: safeParseJson(row.metadata_json, null),
      analysis: safeParseJson(row.analysis_json, null),
    });
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
app.post('/upload-image', requirePlus, uploadLimiter, uploadImages.single('image'), (req, res) => {
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

// Start server
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

