// backend/index.js
const express = require('express');
const cors = require('cors');
const db = require('./db');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

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
    key: 'session_id',
    secret: process.env.SESSION_SECRET || 'devsecret',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 },
  })
);

const upload = multer({ dest: 'uploads/' });

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

// Ruta de prueba
app.get('/', (req, res) => {
  res.send('API de running funcionando 🎽');
});

// Rutas de autenticación
app.post('/register', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Faltan datos' });
  }

  const checkQuery = 'SELECT id FROM users WHERE email = ?';
  db.query(checkQuery, [email], (err, results) => {
    if (err) return res.status(500).json({ error: 'Error en la base de datos' });
    if (results.length > 0) {
      return res.status(409).json({ error: 'Usuario ya existe' });
    }

    bcrypt.hash(password, 10, (err, hash) => {
      if (err) return res.status(500).json({ error: 'Error al encriptar contraseña' });

      const insertQuery = 'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)';
      db.query(insertQuery, [email, hash, 'free'], (err) => {
        if (err) return res.status(500).json({ error: 'Error al registrar usuario' });
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

  const query = 'SELECT id, email, password_hash, role FROM users WHERE email = ?';
  db.query(query, [email], (err, results) => {
    if (err) return res.status(500).json({ error: 'Error en la base de datos' });
    if (results.length === 0) return res.status(401).json({ error: 'Credenciales inválidas' });

    const user = results[0];
    bcrypt.compare(password, user.password_hash, (err, match) => {
      if (err) return res.status(500).json({ error: 'Error al verificar contraseña' });
      if (!match) return res.status(401).json({ error: 'Credenciales inválidas' });

      req.session.user = { id: user.id, email: user.email, role: user.role };
      res.json({ message: 'Inicio de sesión exitoso', user: req.session.user });
    });
  });
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
    res.clearCookie('session_id');
    res.json({ message: 'Sesión cerrada' });
  });
});

// Rutas de blogs
app.get('/blogs', (req, res) => {
  const query = `SELECT b.id, b.title, b.content, b.user_id, u.email FROM blogs b JOIN users u ON b.user_id = u.id ORDER BY b.created_at DESC`;
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
    res.json({ id: result.insertId, user_id: userId, title, content, email: req.session.user.email });
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

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

//ANALISIS INICIA
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

  const queries = rangos.map(rango => `
    SELECT
      '${rango.etiqueta}' AS rango,
      SUM(CASE WHEN genero = 'Femenino' AND TIME_TO_SEC(ritmo_medio) BETWEEN ${rango.min} AND ${rango.max} THEN 1 ELSE 0 END) AS femenino,
      SUM(CASE WHEN genero = 'Masculino' AND TIME_TO_SEC(ritmo_medio) BETWEEN ${rango.min} AND ${rango.max} THEN 1 ELSE 0 END) AS masculino
    FROM resultados
    WHERE carrera_id = ${carreraId}
  `);

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
}); //ANALISIS TERMINA

app.post('/upload-entrenamiento', upload.single('file'), (req, res) => {
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
          console.error('❌ Error al insertar entrenamiento:', err.message);
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
            console.error('❌ Error al insertar series:', err2.message);
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

app.post('/upload-resultados', upload.single('file'), (req, res) => {
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
          (err, result) => {
            if (err) return reject(err);
            resolve(result.insertId);
          }
        );
      });
    });
  };

  // ✅ Corregida: convierte segundos decimales a HH:MM:SS
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
            console.error('❌ Error al insertar resultados:', err.message);
            return res.status(500).json({ error: 'Error al insertar resultados' });
          }

          res.json({ message: 'Resultados cargados exitosamente', insertados: result.affectedRows });
        });

      } catch (err) {
        console.error('❌ Error al procesar carrera:', err.message);
        res.status(500).json({ error: 'Error al procesar la carrera' });
      }
    });
});




app.get('/carreras', (req, res) => {
  db.query('SELECT id, nombre FROM carreras', (err, results) => {
    if (err) {
      console.error('Error obteniendo carreras:', err);
      return res.status(500).json({ error: 'Error al obtener carreras' });
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
      console.error('❌ Error en análisis:', err.message);
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
      console.error('❌ Error al obtener análisis por categoría:', err.message);
      return res.status(500).json({ error: 'Error al obtener análisis por categoría' });
    }

    res.json(rows); // devuelve un arreglo de filas
  });
});

