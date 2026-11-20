import { firebaseConfig } from "./firebase-config.js";

const requiredConfigKeys = ["apiKey", "authDomain", "projectId", "appId"];
export const isFirebaseConfigured = requiredConfigKeys.every((key) => Boolean(firebaseConfig[key]));

let services;

export async function getFirebaseServices() {
  if (!isFirebaseConfigured) {
    throw new Error("Firebase no está configurado. Completa js/firebase-config.js.");
  }

  if (!services) {
    const [{ initializeApp }, { getAuth }, { getFirestore }] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js"),
    ]);
    const { appCheckSiteKey, ...firebaseOptions } = firebaseConfig;
    const app = initializeApp(firebaseOptions);
    if (appCheckSiteKey) {
      const { initializeAppCheck, ReCaptchaV3Provider } = await import("https://www.gstatic.com/firebasejs/11.2.0/firebase-app-check.js");
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(appCheckSiteKey),
        isTokenAutoRefreshEnabled: true,
      });
    }
    services = { auth: getAuth(app), db: getFirestore(app) };
  }

  return services;
}
