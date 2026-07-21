/* =========================================================
   Firebase 專案設定
   把 console.firebase.google.com 專案設定頁複製出來的
   firebaseConfig 內容，貼到下面取代這幾個 PASTE_ 開頭的值。
   ========================================================= */

const firebaseConfig = {
  apiKey: "AIzaSyCyH6Efz-nolsRMWUevBgor8OuoIfMQD0o",
  authDomain: "shenlong-travel.firebaseapp.com",
  projectId: "shenlong-travel",
  storageBucket: "shenlong-travel.firebasestorage.app",
  messagingSenderId: "153795209778",
  appId: "1:153795209778:web:815e426f78cbe5acabea2b"
};

// 是否已完成設定（用來判斷公開頁面要不要嘗試連線，避免還沒設定時噴一堆錯誤訊息）
const FIREBASE_READY = firebaseConfig.apiKey.indexOf('PASTE_') === -1;

let db = null;
let auth = null;

if (FIREBASE_READY) {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
  auth = firebase.auth();
}
