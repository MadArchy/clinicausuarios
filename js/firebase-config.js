// ============================================================
//  Firebase configuration — project: datosdelpaciente-8e3ba
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyBpwCXszj969xjV_WNz6ualo_g8NQ-uOy4",
  authDomain: "datosdelpaciente-8e3ba.firebaseapp.com",
  projectId: "datosdelpaciente-8e3ba",
  // Must match Project settings → storageBucket. If uploads fail with "CORS",
  // check the exact bucket name in the console (.appspot.com vs .firebasestorage.app).
  storageBucket: "datosdelpaciente-8e3ba.firebasestorage.app",
  messagingSenderId: "530903277303",
  appId: "1:530903277303:web:05c006bb85b5b4e3bcbdf2",
  measurementId: "G-9Q08SGT72C"
};

const STORAGE_BUCKET_LEGACY = "datosdelpaciente-8e3ba.appspot.com";
const STORAGE_BUCKET_NEW = "datosdelpaciente-8e3ba.firebasestorage.app";

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Second app for Storage only: the project has one default bucket; if config
// points at the wrong name, the SDK uses the wrong bucket and the browser may show a CORS error.
try {
  const altBucket =
    firebaseConfig.storageBucket === STORAGE_BUCKET_LEGACY ? STORAGE_BUCKET_NEW : STORAGE_BUCKET_LEGACY;
  firebase.initializeApp({ ...firebaseConfig, storageBucket: altBucket }, "storage-bucket-alt");
} catch (e) {
  if (!/already exists|duplicate app/i.test(String(e && e.message))) console.warn(e);
}

/** Storage instances to try in order (same object path for each attempt). */
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
