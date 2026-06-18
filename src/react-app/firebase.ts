import { initializeApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Simple check for required environment variables
const missingKeys = Object.entries(firebaseConfig)
  .filter(([_, value]) => !value || value === "YOUR_API_KEY")
  .map(([key]) => key);

if (missingKeys.length > 0) {
  console.warn(
    `Firebase initialization warning: Missing or placeholder values for: ${missingKeys.join(", ")}. Check your .env file.`,
  );
}

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

try {
  // Initialize Firebase
  app = initializeApp(firebaseConfig);
  // Initialize Firebase services
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.error("Firebase initialization failed:", error);
  throw error;
}

/**
 * Utility to log Firebase errors consistently
 * @param error The error object from a Firebase operation
 * @param context A string describing where the error occurred
 */
export const logFirebaseError = (error: any, context: string) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorCode = (error as any)?.code || "unknown-error";

  console.error(`[Firebase Error] in ${context}:`, {
    code: errorCode,
    message: errorMessage,
    originalError: error,
  });
};

export { app, auth, db };
export default app;
