import { initializeApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCjy8Kb9MWb4KnKdN4iaH3_fXO40PXLjgQ",
  authDomain: "tps-loan-calculator.firebaseapp.com",
  projectId: "tps-loan-calculator",
  storageBucket: "tps-loan-calculator.firebasestorage.app",
  messagingSenderId: "621307918285",
  appId: "1:621307918285:web:ff9c4dabd49db6c794b684",
  measurementId: "G-DXSK0TFBFN",
};

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
interface FirebaseErrorShape {
  code?: string;
  name?: string;
  message?: string;
  stack?: string;
}

export const logFirebaseError = (
  error: unknown,
  context: string,
  extra?: Record<string, unknown>,
) => {
  const fbErr = error as FirebaseErrorShape | undefined;
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorCode = fbErr?.code || "unknown-error";
  const errorName = fbErr?.name || (error instanceof Error ? error.name : "Error");
  const stack = error instanceof Error ? error.stack : fbErr?.stack;

  console.error(`[Firebase Error] in ${context}:`, {
    code: errorCode,
    name: errorName,
    message: errorMessage,
    stack,
    ...(extra || {}),
    originalError: error,
  });
  console.error(error);
};

export { app, auth, db };
export default app;
