import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, runTransaction } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";
    
const firebaseConfig = {
  apiKey: "AIzaSyB8JlcBK_edVc2HkK9edJtYwNSYspreVyw",
  authDomain: "chueiliyu-tw-translation.firebaseapp.com",
  databaseURL: "https://chueiliyu-tw-translation-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "chueiliyu-tw-translation",
  storageBucket: "chueiliyu-tw-translation.appspot.com",
  messagingSenderId: "625769420546",
  appId: "1:625769420546:web:6d25889d1c66a091fe941b", 
  measurementId: "G-3PM3GTXPHF"
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);
  
getAnalytics(app);

// 提供給全站使用
window.db = getDatabase(app);
window.fb_ref = ref;            
window.fb_onValue = onValue;    
window.fb_runTransaction = runTransaction; 

// Anonymous Auth
const auth = getAuth(app);
window.fb_auth = auth;

// 避免重複登入
if (!auth.currentUser) {
  signInAnonymously(auth).catch(console.error);
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    window.userUID = user.uid;
    console.log("匿名登入成功：", user.uid);
  }
});
