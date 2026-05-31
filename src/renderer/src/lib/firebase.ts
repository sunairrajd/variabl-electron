import { initializeApp, getApps } from 'firebase/app'
import { getFirestore, doc, updateDoc, getDoc } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyDNlZbJZU5PywQ9S91CZR7O8_WonjAfecc",
  authDomain: "tab-rev.firebaseapp.com",
  projectId: "tab-rev",
  storageBucket: "tab-rev.firebasestorage.app",
  messagingSenderId: "559252864726",
  appId: "1:559252864726:web:c323db31237fcd51215377"
}

// Ensure we use the named database matching the web app
const FIRESTORE_DATABASE_ID = 'tabrevdatabase'

const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0]
const db = getFirestore(app, FIRESTORE_DATABASE_ID)

export { db, doc, updateDoc, getDoc }
