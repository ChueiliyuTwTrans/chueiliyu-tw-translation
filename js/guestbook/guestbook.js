// guestbook.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, push } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyB8JlcBK_edVc2HkK9edJtYwNSYspreVyw",
    authDomain: "chueiliyu-tw-translation.firebaseapp.com",
    databaseURL: "https://chueiliyu-tw-translation-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "chueiliyu-tw-translation",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let messages = [];

export function initGuestbookWidget() {
  createWidgetUI();
  loadMessages();
  enableDrag();
}

function loadMessages() {
  onValue(ref(db, 'test'), (snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    messages = Object.values(data).filter(m => m.message);
    render();
  });
}

function render() {
  const container = document.getElementById('gb-container');
  container.innerHTML = '';

  const shuffled = [...messages]
    .sort(() => 0.5 - Math.random())
    .slice(0, 9);

  shuffled.forEach(m => {
    const div = document.createElement('div');
    div.className = 'gb-card';

    div.innerHTML = `
      <b>${m.nickname || '匿名'}</b>
      <p>${m.message}</p>
    `;

    container.appendChild(div);
  });
}

function createWidgetUI() {
  const widget = document.createElement('div');
  widget.id = 'gb-widget';

  widget.innerHTML = `
    <div id="gb-header">
      留言板
      <button id="gb-close">×</button>
    </div>
    <div id="gb-container"></div>
    <div id="gb-actions">
      <button id="gb-refresh">換一批</button>
      <button id="gb-open-page">全部</button>
    </div>
    <iframe id="gb-iframe" src="/tests/guestbook.html"></iframe>
  `;

  document.body.appendChild(widget);

  document.getElementById('gb-refresh').onclick = render;

  document.getElementById('gb-close').onclick = () => {
    widget.style.display = 'none';
  };

  document.getElementById('gb-open-page').onclick = () => {
    document.getElementById('gb-iframe').style.display = 'block';
  };
}

/* 拖曳 */
function enableDrag() {
  const widget = document.getElementById('gb-widget');
  const header = document.getElementById('gb-header');

  let isDragging = false;
  let offsetX, offsetY;

  header.addEventListener('mousedown', (e) => {
    isDragging = true;
    offsetX = e.clientX - widget.offsetLeft;
    offsetY = e.clientY - widget.offsetTop;
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    widget.style.left = e.clientX - offsetX + 'px';
    widget.style.top = e.clientY - offsetY + 'px';
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
  });

  /* 手機 */
  header.addEventListener('touchstart', (e) => {
    isDragging = true;
    offsetX = e.touches[0].clientX - widget.offsetLeft;
    offsetY = e.touches[0].clientY - widget.offsetTop;
  });

  document.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    widget.style.left = e.touches[0].clientX - offsetX + 'px';
    widget.style.top = e.touches[0].clientY - offsetY + 'px';
  });

  document.addEventListener('touchend', () => {
    isDragging = false;
  });
}
