import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const hasViteConfig = Object.values(firebaseConfig).every(Boolean);

if (hasViteConfig) {
  (window as any).__FIREBASE_CONFIG__ = firebaseConfig;
} else if (!(window as any).__FIREBASE_CONFIG__) {
  // If no build-time config and no injected config, set to null
  (window as any).__FIREBASE_CONFIG__ = null;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
