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

connection.connect((err) => {
  console.log(`🔌 Intentando conectar a MySQL en ${connection.config.host}:${connection.config.port}`);
  if (err) {
    console.error('❌ Error al conectar a la base de datos:', err);
    return;
  }
  console.log('✅ Conexión a la base de datos establecida');
   const createBlogsTable = `
    CREATE TABLE IF NOT EXISTS blogs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `;

  connection.query(createBlogsTable, (err) => {
    if (err) {
      console.error('❌ Error al asegurar tabla blogs:', err);
    } else {
      console.log('✅ Tabla blogs lista');
    }
  });
});

module.exports = connection;
