// src/utils/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// 👇 YAHAN APNA ASLI CONFIG PASTE KARNA HAI 👇
const firebaseConfig = {
  apiKey: "AIzaSyD0s6l0mTPGBpFLgQ_5GctI7kArstf7GVc",
  authDomain: "gym-saathi.firebaseapp.com",
  projectId: "gym-saathi",
  storageBucket: "gym-saathi.firebasestorage.app",
  messagingSenderId: "151692517856",
  appId: "1:151692517856:web:b38fa504a94d67605c0b85",
  measurementId: "G-SV43XWGYP3"
};
// 👆 YAHAN TAK 👆

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Authentication (Google Login ke liye)
export const auth = getAuth(app);

// Initialize Firestore Database (Data save karne ke liye)
export const db = getFirestore(app);

// Google Auth Provider Setup
export const googleProvider = new GoogleAuthProvider();