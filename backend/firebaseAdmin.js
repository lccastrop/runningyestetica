// backend/firebaseAdmin.js
let admin;
try {
  admin = require('firebase-admin');
} catch (e) {
  console.error('Falta dependencia firebase-admin. Instálala con npm i firebase-admin');
  throw e;
}

if (!admin.apps || admin.apps.length === 0) {
  try {
    const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (saJson) {
      const credentials = JSON.parse(saJson);
      admin.initializeApp({ credential: admin.credential.cert(credentials) });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // Application Default Credentials (ruta a JSON)
      admin.initializeApp({ credential: admin.credential.applicationDefault() });
    } else {
      // Inicialización sin credenciales explícitas; verifyIdToken puede funcionar con claves públicas
      admin.initializeApp();
    }
  } catch (e) {
    console.error('Error inicializando firebase-admin:', e);
    throw e;
  }
}

module.exports = admin;

