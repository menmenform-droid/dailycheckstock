// Fill this object with your Firebase web app config before deploying.
// Firebase Console > Project settings > General > Your apps > Web app.
export const firebaseConfig = {
  apiKey: "AIzaSyCHtVxUCuLaDkoSOVTf1dxKfyuQBsQVBxw",
  authDomain: "dailycheckstock.firebaseapp.com",
  projectId: "dailycheckstock",
  storageBucket: "dailycheckstock.firebasestorage.app",
  messagingSenderId: "513383141627",
  appId: "1:513383141627:web:82becbc9210b905473e05e"
};

export function isFirebaseConfigured() {
  const missingValues = [
    "PASTE_FIREBASE_API_KEY",
    "YOUR_PROJECT_ID",
    "PASTE_MESSAGING_SENDER_ID",
    "PASTE_FIREBASE_APP_ID"
  ];

  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.projectId &&
      firebaseConfig.appId &&
      !missingValues.some((value) =>
        Object.values(firebaseConfig).some((configValue) =>
          String(configValue || "").includes(value)
        )
      )
  );
}
