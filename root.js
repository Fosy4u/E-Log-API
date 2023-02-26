const path = require("path");

module.exports = (function () {
  return path.dirname(require.main.filename || process.mainModule.filename);
})();

// const { initializeApp } = require("firebase/app");
// const { getAnalytics } = require("firebase/analytics");
// const dbUrl = require("../appSecrets.json");

// const firebaseConfig = {
//   apiKey: process.env.FIREBASE_API_KEY || dbUrl.firebaseApiKey,
//   authDomain: process.env.FIREBASE_AUTH_DOMAIN || dbUrl.firebaseAuthDomain,
//   projectId: process.env.FIREBASE_PROJECT_ID || dbUrl.firebaseProjectId,
//   storageBucket:
//     process.env.FIREBASE_STORAGE_BUCKET || dbUrl.firebaseStorageBucket,
//   messagingSenderId:
//     process.env.FIREBASE_MESSAGING_SENDER_ID || dbUrl.messagingSenderId,
//   appId: process.env.FIREBASE_APP_ID || dbUrl.appId,
//   measurementId:
//     process.env.FIREBASE_MEASUREMENT_ID || dbUrl.firebaseMeasurementId,
// };

// // Initialize Firebase
// const firebaseDB = initializeApp(firebaseConfig);
// const analytics = getAnalytics(firebaseDB);
// //module.exports = firebaseDB;
