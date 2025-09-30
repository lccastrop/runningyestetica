// backend/db.js
const mysql = require('mysql2');
require('dotenv').config();

let connection;

if (process.env.MYSQL_URL || process.env.DATABASE_URL) {
  // Permite conexión mediante cadena de conexión completa
  const url = process.env.MYSQL_URL || process.env.DATABASE_URL;
  connection = mysql.createConnection(url);
} else {
  // Configuración basada en variables individuales
  connection = mysql.createConnection({
    host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
    user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
    password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '',
    database:
      process.env.MYSQLDATABASE || process.env.DB_NAME || 'runningyestetica',
    port: process.env.MYSQLPORT || process.env.DB_PORT || 3306,
  });
}

connection.connect(async (err) => {
  console.log(`Intentando conectar a MySQL en ${connection.config.host}:${connection.config.port}`);
  if (err) {
    console.error('Error al conectar a la base de datos:', err);
    return;
  }
  console.log('Conexión a la base de datos establecida');

  const queries = [
    {
      name: 'users',
      sql: `
        CREATE TABLE IF NOT EXISTS users (
          id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          nombres VARCHAR(100),
          apellidos VARCHAR(100),
          password_hash VARCHAR(255) NOT NULL,
          role ENUM('free','plus','admin') DEFAULT 'free',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `,
    },
    {
      name: 'sessions',
      sql: `
        CREATE TABLE IF NOT EXISTS sessions (
          session_id VARCHAR(128) PRIMARY KEY,
          expires INT UNSIGNED NOT NULL,
          data MEDIUMTEXT
        )
      `,
    },
    {
      name: 'carreras',
      sql: `
        CREATE TABLE IF NOT EXISTS carreras (
          id INT AUTO_INCREMENT PRIMARY KEY,
          nombre VARCHAR(100) NOT NULL,
          fecha DATE,
          distancia DECIMAL(5,2),
          ascenso_total INT
        )
      `,
    },
    {
      name: 'entrenamientos',
      sql: `
        CREATE TABLE IF NOT EXISTS entrenamientos (
          id INT AUTO_INCREMENT PRIMARY KEY,
          fecha DATE DEFAULT (CURRENT_DATE),
          nombre VARCHAR(100),
          comentario TEXT
        )
      `,
    },
    {
      name: 'resultados',
      sql: `
        CREATE TABLE IF NOT EXISTS resultados (
          id INT AUTO_INCREMENT PRIMARY KEY,
          carrera_id INT,
          nombre VARCHAR(100),
          genero VARCHAR(10),
          categoria VARCHAR(50),
          tiempo_chip TIME,
          ritmo_medio TIME,
          distancia DECIMAL(5,2),
          ascenso_total INT,
          FOREIGN KEY (carrera_id) REFERENCES carreras(id) ON DELETE CASCADE
        )
      `,
    },
    {
      name: 'informes_carreras',
      sql: `
        CREATE TABLE IF NOT EXISTS informes_carreras (
          id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          public_id VARCHAR(64) NOT NULL UNIQUE,
          nombre VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          metadata_json LONGTEXT NULL,
          analysis_json LONGTEXT NOT NULL,
          comments_json LONGTEXT NULL
        )
      `,
    },
    {
      name: 'series',
      sql: `
        CREATE TABLE IF NOT EXISTS series (
          id INT AUTO_INCREMENT PRIMARY KEY,
          entrenamiento_id INT,
          split INT,
          tiempo TIME,
          tiempo_mov TIME,
          distancia FLOAT,
          elevacion_subida FLOAT,
          elevacion_bajada FLOAT,
          ritmo_promedio TIME,
          ritmo_mov_promedio TIME,
          mejor_ritmo TIME,
          cadencia_promedio INT,
          cadencia_maxima INT,
          zancada_promedio FLOAT,
          fc_promedio INT,
          fc_maxima INT,
          temperatura_prom FLOAT,
          calorias FLOAT,
          FOREIGN KEY (entrenamiento_id) REFERENCES entrenamientos(id) ON DELETE CASCADE
        )
      `,
    },
    {
      name: 'blogs',
      sql: `
        CREATE TABLE IF NOT EXISTS blogs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT UNSIGNED NOT NULL,
          title VARCHAR(255) NOT NULL,
          content TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `,
    },
    {
      name: 'imagenes',
      sql: `
        CREATE TABLE IF NOT EXISTS imagenes (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT UNSIGNED NULL,
          url VARCHAR(255) NOT NULL,
          original_name VARCHAR(255),
          mime VARCHAR(100),
          size_bytes INT UNSIGNED,
          width INT NULL,
          height INT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
      `,
    },
  ];

  for (const q of queries) {
    try {
      await connection.promise().query(q.sql);
      console.log(`Tabla ${q.name} lista`);
    } catch (e) {
      console.error(`Error al asegurar tabla ${q.name}:`, e);
    }
  }

  // Asegurar columnas adicionales en users
  try {
    // Verificar y agregar columna nombres si no existe
    const [nombresCol] = await connection
      .promise()
      .query("SHOW COLUMNS FROM users LIKE 'nombres'");
    if (nombresCol.length === 0) {
      await connection
        .promise()
        .query(
          "ALTER TABLE users ADD COLUMN nombres VARCHAR(100) AFTER email"
        );
      console.log('Columna nombres añadida en users');
    }

    // Verificar y agregar columna apellidos si no existe
    const [apellidosCol] = await connection
      .promise()
      .query("SHOW COLUMNS FROM users LIKE 'apellidos'");
    if (apellidosCol.length === 0) {
      await connection
        .promise()
        .query(
          "ALTER TABLE users ADD COLUMN apellidos VARCHAR(100) AFTER nombres"
        );
      console.log('Columna apellidos añadida en users');
    }
    console.log('Columnas nombres y apellidos listas en users');
  } catch (e) {
    console.error('Error al asegurar columnas en users:', e);
  }

  // Asegurar columnas adicionales en resultados
  try {
    const colsToEnsure = [
      { name: 'bib', type: 'VARCHAR(20)', after: 'categoria' },
      { name: 'RM_5km', type: 'TIME', after: 'ritmo_medio' },
      { name: 'split_5km', type: 'TIME', after: 'RM_5km' },
      { name: 'RM_10km', type: 'TIME', after: 'split_5km' },
      { name: 'split_10km', type: 'TIME', after: 'RM_10km' },
      { name: 'RM_15km', type: 'TIME', after: 'split_10km' },
      { name: 'split_15km', type: 'TIME', after: 'RM_15km' },
      { name: 'RM_21km', type: 'TIME', after: 'split_15km' },
      { name: 'split_21km', type: 'TIME', after: 'RM_21km' },
      { name: 'RM_25km', type: 'TIME', after: 'split_21km' },
      { name: 'split_25km', type: 'TIME', after: 'RM_25km' },
      { name: 'RM_30km', type: 'TIME', after: 'split_25km' },
      { name: 'split_30km', type: 'TIME', after: 'RM_30km' },
      { name: 'RM_35km', type: 'TIME', after: 'split_30km' },
      { name: 'split_35km', type: 'TIME', after: 'RM_35km' },
      { name: 'RM_40km', type: 'TIME', after: 'split_35km' },
      { name: 'split_40km', type: 'TIME', after: 'RM_40km' },
      { name: 'RM_42km', type: 'TIME', after: 'split_40km' },
      { name: 'split_42km', type: 'TIME', after: 'RM_42km' },
    ];

    for (const col of colsToEnsure) {
      const [exists] = await connection
        .promise()
        .query(`SHOW COLUMNS FROM resultados LIKE ?`, [col.name]);
      if (exists.length === 0) {
        const afterClause = col.after ? ` AFTER \`${col.after}\`` : '';
        const sql = `ALTER TABLE resultados ADD COLUMN \`${col.name}\` ${col.type} NULL${afterClause}`;
        await connection.promise().query(sql);
        console.log(`Columna ${col.name} añadida en resultados`);
      }
    }
    console.log('Columnas adicionales listas en resultados');
  } catch (e) {
    console.error('Error al asegurar columnas en resultados:', e);
  }

  // Asegurar columna adicional en informes_carreras: comments_json
  try {
    const [exists] = await connection
      .promise()
      .query("SHOW COLUMNS FROM informes_carreras LIKE 'comments_json'");
    if (exists.length === 0) {
      await connection
        .promise()
        .query("ALTER TABLE informes_carreras ADD COLUMN comments_json LONGTEXT NULL AFTER analysis_json");
      console.log('Columna comments_json añadida en informes_carreras');
    }
    console.log('Columna comments_json lista en informes_carreras');
  } catch (e) {
    console.error('Error al asegurar columna comments_json en informes_carreras:', e);
  }
});

module.exports = connection;

