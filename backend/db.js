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
  console.log(`🔌 Intentando conectar a MySQL en ${connection.config.host}:${connection.config.port}`);
  if (err) {
    console.error('❌ Error al conectar a la base de datos:', err);
    return;
  }
  console.log('✅ Conexión a la base de datos establecida');
   

const queries = [
    {
      name: 'users',
      sql: `
        CREATE TABLE IF NOT EXISTS users (
          id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
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
  ];

  for (const q of queries) {
    try {
      await connection.promise().query(q.sql);
      console.log(`✅ Tabla ${q.name} lista`);
    } catch (e) {
      console.error(`❌ Error al asegurar tabla ${q.name}:`, e);
    }
  }
});

module.exports = connection;
