import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Diagnóstico: loga quais variáveis estão presentes
console.log("[FIREBASE] projectId:", firebaseConfig.projectId || "❌ NÃO DEFINIDO");
console.log("[FIREBASE] authDomain:", firebaseConfig.authDomain || "❌ NÃO DEFINIDO");

let app;
let db = null;
let auth = null;
let storage = null;

if (firebaseConfig.projectId) {
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    storage = getStorage(app);
    console.log("[FIREBASE] ✅ db, auth e storage inicializados com sucesso.");
  } catch (error) {
    console.error("[FIREBASE] ❌ Erro ao inicializar:", error.message);
  }
} else {
  console.warn("[FIREBASE] ❌ projectId ausente — Firebase não inicializado.");
}

export { db, auth, storage };
