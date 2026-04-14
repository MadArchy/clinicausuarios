// ============================================================
//  CONFIGURACIÓN FIREBASE — Proyecto: datosdelpaciente-8e3ba
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyBpwCXszj969xjV_WNz6ualo_g8NQ-uOy4",
  authDomain: "datosdelpaciente-8e3ba.firebaseapp.com",
  projectId: "datosdelpaciente-8e3ba",
  storageBucket: "datosdelpaciente-8e3ba.firebasestorage.app",
  messagingSenderId: "530903277303",
  appId: "1:530903277303:web:05c006bb85b5b4e3bcbdf2",
  measurementId: "G-9Q08SGT72C"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Exportar servicios
const db      = firebase.firestore();
const storage = firebase.storage();
