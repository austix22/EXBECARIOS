import { firebaseConfig } from "./firebase-config.js";

const requiredConfigKeys = ["apiKey", "authDomain", "projectId", "appId", "appCheckSiteKey"];
export const isFirebaseConfigured = requiredConfigKeys.every((key) => Boolean(firebaseConfig[key]));

let services;

export async function getFirebaseServices() {
  if (!isFirebaseConfigured) {
    throw new Error("Firebase no está configurado. Completa js/firebase-config.js.");
  }

  if (!services) {
    const [{ initializeApp }, { initializeAppCheck, ReCaptchaV3Provider }, { getAuth }, { getFirestore }] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/11.2.0/firebase-app-check.js"),
      import("https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js"),
    ]);
    const app = initializeApp(firebaseConfig);
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(firebaseConfig.appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
    services = { auth: getAuth(app), db: getFirestore(app) };
  }

  return services;
}
