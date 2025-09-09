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
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';
const allowedOrigin = isProd ? process.env.FRONTEND_URL : true;
// Debug flags removed for production hardening

// Middleware
app.use(cors({ origin: allowedOrigin, credentials: true }));
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
app.post('/register', (req, res) => {
  const { email, password, nombres, apellidos } = req.body;
  if (!email || !password || !nombres || !apellidos) {
    return res.status(400).json({ error: 'Faltan datos' });
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

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (data) => resultados.push(data))
    .on('end', async () => {
      try {
        const carreraId = await obtenerIdCarrera();
        const distanciaKm = parseFloat(distancia);

        const normalizarClave = (clave) => clave.replace(/\s+/g, '').replace(/[^\w]/g, '');
        const resultadosNormalizados = resultados.map(obj => {
          const nuevo = {};
          for (let key in obj) {
            nuevo[normalizarClave(key)] = obj[key];
          }
          return nuevo;
        });

        const valores = resultadosNormalizados.map(row => {
          const tiempoStr = row.TiempoChip;
          let ritmoMedio = null;

          if (tiempoStr && distanciaKm) {
            const partes = tiempoStr.split(':').map(Number);
            if (partes.length === 3) {
              const tiempoSeg = partes[0] * 3600 + partes[1] * 60 + partes[2];
              const ritmoSeg = tiempoSeg / distanciaKm;
              ritmoMedio = segundosAHHMMSS(ritmoSeg);
            }
          }

          return [
            carreraId,
            row.Nombre || null,
            row.Genero || null,
            row.Categoria || null,
            tiempoStr || null,
            ritmoMedio,
            distanciaKm || null,
            ascenso_total || null
          ];
        });

        const query = `
          INSERT INTO resultados (
            carrera_id, nombre, genero, categoria, tiempo_chip, ritmo_medio, distancia, ascenso_total
          ) VALUES ?
        `;

        db.query(query, [valores], (err, result) => {
          fs.unlinkSync(filePath);
          if (err) {
            console.error('Error al insertar resultados:', err.message);
            return res.status(500).json({ error: 'Error al insertar resultados' });
          }
          res.json({ message: 'Resultados cargados exitosamente', insertados: result.affectedRows });
        });
      } catch (err) {
        console.error('Error al procesar carrera:', err.message);
        res.status(500).json({ error: 'Error al procesar la carrera' });
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

// Start server
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
