// FIREBASE CONFIG
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const firebaseConfig = {
  apiKey: "AIzaSyBHlt0hibxuHzUeYiYcUFbMscLrIr4dGRo",
  authDomain: "presupuestapp-v18.firebaseapp.com",
  projectId: "presupuestapp-v18",
  storageBucket: "presupuestapp-v18.firebasestorage.app",
  messagingSenderId: "1097536854285",
  appId: "1:1097536854285:web:e6001ed5919aa069593844"
};
firebase.initializeApp(firebaseConfig);
window.auth = firebase.auth();
window.db = firebase.firestore();

