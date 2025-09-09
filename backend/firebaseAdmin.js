// backend/firebaseAdmin.js
const fs = require('fs');

let admin;
try {
  admin = require('firebase-admin');
} catch (e) {
  console.error('Falta dependencia firebase-admin. Instala con: npm i firebase-admin');
  throw e;
}

if (!admin.apps || admin.apps.length === 0) {
  try {
    const saB64 = process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64;
    const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const credsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (saB64) {
      const decoded = Buffer.from(saB64, 'base64').toString('utf8');
      const credentials = JSON.parse(decoded);
      admin.initializeApp({ credential: admin.credential.cert(credentials) });
      console.log('firebase-admin: inicializado con FIREBASE_SERVICE_ACCOUNT_JSON_BASE64');
    } else if (saJson) {
      const credentials = JSON.parse(saJson);
      admin.initializeApp({ credential: admin.credential.cert(credentials) });
      console.log('firebase-admin: inicializado con FIREBASE_SERVICE_ACCOUNT_JSON');
    } else if (credsPath && fs.existsSync(credsPath)) {
      const raw = fs.readFileSync(credsPath, 'utf8');
      const credentials = JSON.parse(raw);
      admin.initializeApp({ credential: admin.credential.cert(credentials) });
      console.log(`firebase-admin: inicializado desde ruta ${credsPath}`);
    } else if (process.env.NODE_ENV !== 'production') {
      admin.initializeApp({ credential: admin.credential.applicationDefault() });
      console.log('firebase-admin: inicializado con Application Default (dev)');
    } else {
      throw new Error('Credenciales Firebase no configuradas. Define FIREBASE_SERVICE_ACCOUNT_JSON en producción.');
    }
  } catch (e) {
    console.error('Error inicializando firebase-admin:', e);
    throw e;
  }
}

module.exports = admin;
