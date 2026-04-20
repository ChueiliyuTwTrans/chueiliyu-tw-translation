import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = { /* 同上 */ };

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

window.submitMessage = function () {
  const name = document.getElementById('name').value;
  const msg = document.getElementById('msg').value;

  if (!msg) return alert("請輸入留言");

  push(ref(db, 'test'), {
    nickname: name,
    message: msg,
    time: Date.now()
  });

  alert("送出成功");
};
