import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

/* Firebase */
const firebaseConfig = {
  apiKey: "AIzaSyB8JlcBK_edVc2HkK9edJtYwNSYspreVyw",
  authDomain: "chueiliyu-tw-translation.firebaseapp.com",
  databaseURL: "https://chueiliyu-tw-translation-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "chueiliyu-tw-translation",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let messages = [];

/* 初始化 */
export function initGuestbookWidget() {
  createUI();
  loadMessages();
  enableDrag();
}

/* 讀資料（只有你匯入的會出現） */
function loadMessages() {
  onValue(ref(db, 'test'), (snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    messages = Object.values(data)
      .filter(m => m && m.message);

    render();
  });
}

/* 渲染（隨機抽 + 撕貼動畫） */
function render() {
  const container = document.getElementById('gb-container');
  container.innerHTML = '';

  const shuffled = [...messages]
    .sort(() => 0.5 - Math.random())
    .slice(0, 9);

  shuffled.forEach((m, i) => {
    const div = document.createElement('div');
    div.className = 'gb-card tear';

    div.style.setProperty('--r', `${Math.random()*6 - 3}deg`);
    div.style.setProperty('--delay', `${i * 0.05}s`);

    div.innerHTML = `
      <div class="gb-name">${m.nickname || '匿名'}</div>
      <div class="gb-msg">${m.message}</div>
    `;

    container.appendChild(div);
  });
}

/* UI */
function createUI() {
  const el = document.createElement('div');
  el.id = 'gb-widget';

  el.innerHTML = `
    <div id="gb-header">
      留言牆
      <button id="gb-close">×</button>
    </div>

    <div id="gb-container"></div>

    <div id="gb-actions">
      <button id="gb-refresh">再抽一次</button>
      <button id="gb-open">全部留言</button>
    </div>

    <iframe id="gb-iframe" src="/tests/guestbook.html"></iframe>
  `;

  document.body.appendChild(el);

  document.getElementById('gb-refresh').onclick = render;

  document.getElementById('gb-close').onclick = () => {
    el.style.display = 'none';
  };

  document.getElementById('gb-open').onclick = () => {
    document.getElementById('gb-iframe').style.display = 'block';
  };
}

/* 拖曳（含手機） */
function enableDrag() {
  const box = document.getElementById('gb-widget');
  const head = document.getElementById('gb-header');

  let dragging = false, x, y;

  const start = (clientX, clientY) => {
    dragging = true;
    x = clientX - box.offsetLeft;
    y = clientY - box.offsetTop;
  };

  const move = (clientX, clientY) => {
    if (!dragging) return;
    box.style.left = clientX - x + 'px';
    box.style.top = clientY - y + 'px';
  };

  head.addEventListener('mousedown', e => start(e.clientX, e.clientY));
  document.addEventListener('mousemove', e => move(e.clientX, e.clientY));
  document.addEventListener('mouseup', () => dragging = false);

  head.addEventListener('touchstart', e => start(e.touches[0].clientX, e.touches[0].clientY));
  document.addEventListener('touchmove', e => move(e.touches[0].clientX, e.touches[0].clientY));
  document.addEventListener('touchend', () => dragging = false);
}
