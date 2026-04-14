// ============================================================
//  CONFIGURACIÓN FIREBASE — Proyecto: datosdelpaciente-8e3ba
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyBpwCXszj969xjV_WNz6ualo_g8NQ-uOy4",
  authDomain: "datosdelpaciente-8e3ba.firebaseapp.com",
  projectId: "datosdelpaciente-8e3ba",
  // Debe coincidir con Project settings → storageBucket. Si las subidas fallan con "CORS",
  // en la consola revisa el nombre exacto del bucket (puede ser .appspot.com o .firebasestorage.app).
  storageBucket: "datosdelpaciente-8e3ba.firebasestorage.app",
  messagingSenderId: "530903277303",
  appId: "1:530903277303:web:05c006bb85b5b4e3bcbdf2",
  measurementId: "G-9Q08SGT72C"
};

const STORAGE_BUCKET_LEGACY = "datosdelpaciente-8e3ba.appspot.com";
const STORAGE_BUCKET_NEW = "datosdelpaciente-8e3ba.firebasestorage.app";

// Inicializar Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Segunda app solo para Storage: el bucket por defecto del proyecto es uno solo; si el config
// apunta al nombre equivocado, el SDK usa el bucket incorrecto y el navegador muestra error CORS.
try {
  const altBucket =
    firebaseConfig.storageBucket === STORAGE_BUCKET_LEGACY ? STORAGE_BUCKET_NEW : STORAGE_BUCKET_LEGACY;
  firebase.initializeApp({ ...firebaseConfig, storageBucket: altBucket }, "storage-bucket-alt");
} catch (e) {
  if (!/already exists|duplicate app/i.test(String(e && e.message))) console.warn(e);
}

/** Instancias de Storage a probar en orden (misma ruta de objeto en cada intento). */
function getStorageAlternates() {
  const list = [firebase.storage()];
  try {
    if (firebase.apps.some((a) => a.name === "storage-bucket-alt")) {
      list.push(firebase.storage(firebase.app("storage-bucket-alt")));
    }
  } catch (e) {
    console.warn(e);
  }
  return list;
}

// Exportar servicios
const db      = firebase.firestore();
const storage = firebase.storage();
const auth = firebase.auth();
const functions = firebase.app().functions("us-central1");

let authReadyPromise = null;
async function ensureCallableAuth() {
  if (!authReadyPromise) {
    authReadyPromise = (async () => {
      if (auth.currentUser) return auth.currentUser;
      const cred = await auth.signInAnonymously();
      return cred.user;
    })().catch((err) => {
      authReadyPromise = null;
      throw err;
    });
  }
  return authReadyPromise;
}
