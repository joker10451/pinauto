/**
 * Firebase Admin singleton.
 *
 * Vercel reuses the Node process between invocations when warm, so we cache
 * the initialized app on `globalThis` to avoid re-parsing the credential
 * blob on every cold-warm cycle and to avoid the "default app already exists"
 * error grammY's webhook would otherwise trigger.
 */

import * as admin from "firebase-admin";
import { config } from "./config";

type GlobalWithAdmin = typeof globalThis & {
  __firebaseApp?: admin.app.App;
};

const g = globalThis as GlobalWithAdmin;

function buildCredentials(): admin.ServiceAccount {
  const raw = Buffer.from(config.firebase.serviceAccountB64(), "base64").toString(
    "utf8"
  );
  const parsed = JSON.parse(raw) as {
    project_id: string;
    client_email: string;
    private_key: string;
  };
  return {
    projectId: parsed.project_id,
    clientEmail: parsed.client_email,
    // Newlines survive base64 round-trip already, but keep the safety replace
    // in case someone passes the raw JSON env var instead.
    privateKey: parsed.private_key.replace(/\\n/g, "\n"),
  };
}

export function getFirebaseApp(): admin.app.App {
  if (g.__firebaseApp) return g.__firebaseApp;
  if (admin.apps.length > 0 && admin.apps[0]) {
    g.__firebaseApp = admin.apps[0]!;
    return g.__firebaseApp;
  }
  const app = admin.initializeApp({
    credential: admin.credential.cert(buildCredentials()),
  });
  g.__firebaseApp = app;
  return app;
}

export function db(): admin.firestore.Firestore {
  return getFirebaseApp().firestore();
}

export const FieldValue = admin.firestore.FieldValue;
export const Timestamp = admin.firestore.Timestamp;
