import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let rawMessages = [];
let filteredMessages = [];
let isDescending = true;
let initialLoaded = false;
let isAnimating = false;

// 取得 DOM 元素
const randomContainer = document.getElementById('random-container');
const container = document.getElementById('guestbook-container');
const paginationBox = document.getElementById('pagination-controls');
const searchInput = document.getElementById('search-input');
const sortBtn = document.getElementById('sort-btn');
const refreshBtn = document.getElementById('refresh-random');
const modal = document.getElementById('guestbook-modal');

export function initGuestbook(mode = 'full') {
    onValue(ref(db, 'test'), (snapshot) => {
        const data = snapshot.val();
        if (!data) return;
        rawMessages = (data.message ? [data] : Object.values(data)).filter(m => m && m.message);
        
        if (mode === 'full') {
            applyFilters();
        } else if (mode === 'random' && !initialLoaded) {
            initialLoaded = true;
            displayRandom(true);
        }
    });

    // 綁定事件
    if (refreshBtn) refreshBtn.onclick = () => refreshRandomMessages();
    if (searchInput) searchInput.oninput = () => applyFilters();
    if (sortBtn) sortBtn.onclick = () => toggleSort();
}

// 彈窗控制
export function toggleModal(show) {
    if (!modal) return;
    if (show) {
        modal.classList.add('active');
        if (!initialLoaded && rawMessages.length > 0) {
            initialLoaded = true;
            displayRandom(true);
        }
    } else {
        modal.classList.remove('active');
    }
}

function refreshRandomMessages() {
    if (isAnimating || !randomContainer) return;
    isAnimating = true;
    const cards = randomContainer.querySelectorAll('.message-card');
    cards.forEach((card, index) => {
        setTimeout(() => card.classList.add('peel-off-slow'), index * 50);
    });
    setTimeout(() => {
        displayRandom(true);
        isAnimating = false;
    }, (cards.length * 50) + 800);
}

function displayRandom(withAnimation = false) {
    if (!randomContainer) return;
    randomContainer.innerHTML = '';
    randomContainer.className = 'gb-grid-layout';
    const shuffled = [...rawMessages].sort(() => 0.5 - Math.random()).slice(0, 5); // 彈窗內顯示 5 筆較合適
    shuffled.forEach((item, idx) => {
        const card = createMessageCard(item, 'rand-' + idx, idx);
        if (withAnimation) {
            card.style.opacity = '0';
            card.classList.add('stick-on-unroll');
            card.style.animationDelay = `${idx * 0.1}s`;
        }
        randomContainer.appendChild(card);
    });
}

function applyFilters() {
    if (!container) return;
    const keyword = searchInput.value.toLowerCase();
    let result = rawMessages.filter(item => item.message.toLowerCase().includes(keyword));
    if (isDescending) result = [...result].reverse();
    filteredMessages = result;
    renderPage(1);
}

function toggleSort() {
    isDescending = !isDescending;
    sortBtn.innerText = isDescending ? '排序：新 → 舊' : '排序：舊 → 新';
    applyFilters();
}

function renderPage(page) {
    container.innerHTML = '';
    const start = (page - 1) * 100;
    filteredMessages.slice(start, start + 100).forEach((item, idx) => {
        container.appendChild(createMessageCard(item, 'all-' + idx, idx));
    });
    renderPagination(page);
}

function createMessageCard(item, uniqueId, colorIndex) {
    const card = document.createElement('div');
    card.className = `gb-message-card gb-theme-${colorIndex % 6}`;
    const shortText = item.message.length > 100 ? item.message.substring(0, 100) + "..." : item.message;
    card.innerHTML = `
        <div class="nickname">${item.nickname || '匿名'}</div>
        <div class="content" id="text-${uniqueId}">${shortText}</div>
        ${item.message.length > 100 ? `<button class="toggle-btn" id="btn-${uniqueId}">展開</button>` : ''}
    `;
    if (item.message.length > 100) {
        setTimeout(() => {
            const btn = document.getElementById(`btn-${uniqueId}`);
            if (btn) btn.onclick = (e) => {
                const contentDiv = document.getElementById(`text-${uniqueId}`);
                const isExp = btn.innerText === '展開';
                contentDiv.innerText = isExp ? item.message : shortText;
                btn.innerText = isExp ? '收起' : '展開';
            };
        }, 0);
    }
    return card;
}

function renderPagination(current) {
    if (!paginationBox) return;
    paginationBox.innerHTML = '';
    const total = Math.ceil(filteredMessages.length / 100);
    if (total <= 1) return;
    for (let i = 1; i <= total; i++) {
        const btn = document.createElement('button');
        btn.innerText = i;
        btn.className = `page-btn ${i === current ? 'active' : ''}`;
        btn.onclick = () => {
            renderPage(i);
            window.scrollTo({top: container.offsetTop - 150, behavior: 'smooth'});
        };
        paginationBox.appendChild(btn);
    }
}
