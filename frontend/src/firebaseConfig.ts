// src/firebaseConfig.ts
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDdnDGgctQk1J8xUVXEKkUvKeqGdEJU8E8",
  authDomain: "runningyestetica.firebaseapp.com",
  projectId: "runningyestetica",
  storageBucket: "runningyestetica.firebasestorage.app",
  messagingSenderId: "684658917526",
  appId: "1:684658917526:web:a36bc913820647b46b42b7",
  measurementId: "G-CKYQQ1M7GE"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
