import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || '';
    value = value.trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    }
    env[key] = value;
  }
});

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check() {
  console.log("Fetching selecoes...");
  const selecoesSnap = await getDocs(collection(db, "selecoes"));
  console.log(`Found ${selecoesSnap.size} selecoes:`);
  selecoesSnap.forEach(doc => {
    console.log(`- ID: ${doc.id}`, JSON.stringify(doc.data()));
  });

  console.log("\nFetching eventos...");
  const eventosSnap = await getDocs(collection(db, "eventos"));
  console.log(`Found ${eventosSnap.size} eventos:`);
  eventosSnap.forEach(doc => {
    console.log(`- ID: ${doc.id}`, JSON.stringify(doc.data()));
  });
}

check().catch(console.error);
