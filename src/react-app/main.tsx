import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

const firebaseConfig = {
  apiKey: "AIzaSyCjy8Kb9MWb4KnKdN4iaH3_fXO40PXLjgQ",
  authDomain: "tps-loan-calculator.firebaseapp.com",
  projectId: "tps-loan-calculator",
  storageBucket: "tps-loan-calculator.firebasestorage.app",
  messagingSenderId: "621307918285",
  appId: "1:621307918285:web:ff9c4dabd49db6c794b684",
  measurementId: "G-DXSK0TFBFN",
};

(window as any).__FIREBASE_CONFIG__ = firebaseConfig;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
