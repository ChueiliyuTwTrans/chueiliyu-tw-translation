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
function getElements() {
    return {
        randomContainer: document.getElementById('random-container'),
        container: document.getElementById('guestbook-container'),
        paginationBox: document.getElementById('pagination-controls'),
        searchInput: document.getElementById('search-input'),
        sortBtn: document.getElementById('sort-btn'),
        modal: document.getElementById('guestbook-modal'),
        refreshBtn: document.getElementById('refresh-random'),
        openBtn: document.getElementById('open-gb'),
        closeBtn: document.getElementById('close-gb')
    };
}

export function initGuestbook(mode = 'full') {
    const el = getElements();
    
    // 監聽 Firebase 數據
    onValue(ref(db, 'test'), (snapshot) => {
        const data = snapshot.val();
        if (!data) return;
        rawMessages = (data.message ? [data] : Object.values(data)).filter(m => m && m.message);
        
        if (mode === 'full' && el.container) {
            applyFilters();
        } else if (mode === 'random' && !initialLoaded) {
            // 如果數據回來時彈窗已經是開著的，就載入
            if (el.modal && el.modal.classList.contains('active')) {
                initialLoaded = true;
                displayRandom(true);
            }
        }
    });

    // 綁定按鈕事件
    if (el.openBtn) el.openBtn.onclick = () => toggleModal(true);
    if (el.closeBtn) el.closeBtn.onclick = () => toggleModal(false);
    if (el.refreshBtn) el.refreshBtn.onclick = () => refreshRandomMessages();
    if (el.searchInput) el.searchInput.oninput = () => applyFilters();
    if (el.sortBtn) el.sortBtn.onclick = () => toggleSort();
}

// 彈窗控制
export function toggleModal(show) {
    const el = getElements();
    if (!el.modal) return;
    
    if (show) {
        el.modal.classList.add('active');
        // 關閉 backToTop
        document.body.classList.add('modal-open');
        
        // 確保打開時如果有數據就顯示
        if (!initialLoaded && rawMessages.length > 0) {
            initialLoaded = true;
            displayRandom(true);
        }
    } else {
        el.modal.classList.remove('active');
        // 恢復 backToTop
        document.body.classList.remove('modal-open');
    }
}

function refreshRandomMessages() {
    const el = getElements();
    if (isAnimating || !el.randomContainer) return;
    
    const cards = el.randomContainer.querySelectorAll('.gb-message-card');
    if (cards.length === 0) {
        displayRandom(true);
        return;
    }

    isAnimating = true;
    cards.forEach((card, index) => {
        setTimeout(() => card.classList.add('peel-off-slow'), index * 50);
    });

    setTimeout(() => {
        displayRandom(true);
        isAnimating = false;
    }, (cards.length * 50) + 800);
}

function displayRandom(withAnimation = false) {
    const el = getElements();
    if (!el.randomContainer) return;
    
    el.randomContainer.innerHTML = '';
    el.randomContainer.className = 'gb-grid-layout';
    
    // 隨機抽選 6 筆
    const shuffled = [...rawMessages].sort(() => 0.5 - Math.random()).slice(0, 6);
    
    if (shuffled.length === 0) {
        el.randomContainer.innerHTML = '<p>目前沒有留言...</p>';
        return;
    }

    shuffled.forEach((item, idx) => {
        const card = createMessageCard(item, 'rand-' + idx, idx);
        if (withAnimation) {
            card.style.opacity = '0';
            card.classList.add('stick-on-unroll');
            card.style.animationDelay = `${idx * 0.1}s`;
        }
        el.randomContainer.appendChild(card);
    });
}

function createMessageCard(item, uniqueId, colorIndex) {
    const card = document.createElement('div');
    // 使用 gb- 前綴的樣式
    card.className = `gb-message-card gb-theme-${colorIndex % 6}`;
    
    const shortText = item.message.length > 100 ? item.message.substring(0, 100) + "..." : item.message;
    
    card.innerHTML = `
        <div class="gb-nickname">${item.nickname || '匿名'}</div>
        <div class="gb-content" id="text-${uniqueId}">${shortText}</div>
        ${item.message.length > 100 ? `<button class="gb-toggle-btn" id="btn-${uniqueId}">展開</button>` : ''}
    `;

    // 展開收起邏輯
    if (item.message.length > 100) {
        setTimeout(() => {
            const btn = card.querySelector(`#btn-${uniqueId}`);
            if (btn) {
                btn.onclick = () => {
                    const contentDiv = card.querySelector(`#text-${uniqueId}`);
                    const isExp = btn.innerText === '展開';
                    contentDiv.innerText = isExp ? item.message : shortText;
                    btn.innerText = isExp ? '收起' : '展開';
                };
            }
        }, 0);
    }
    return card;
}

// 這裡是處理全列表模式的邏輯 (tests/index.html 使用)
function applyFilters() {
    const el = getElements();
    if (!el.container) return;
    const keyword = el.searchInput ? el.searchInput.value.toLowerCase() : "";
    let result = rawMessages.filter(item => item.message.toLowerCase().includes(keyword));
    if (isDescending) result = [...result].reverse();
    filteredMessages = result;
    renderPage(1);
}

function toggleSort() {
    const el = getElements();
    isDescending = !isDescending;
    if (el.sortBtn) el.sortBtn.innerText = isDescending ? '排序：新 → 舊' : '排序：舊 → 新';
    applyFilters();
}

function renderPage(page) {
    const el = getElements();
    if (!el.container) return;
    el.container.innerHTML = '';
    const start = (page - 1) * 100;
    filteredMessages.slice(start, start + 100).forEach((item, idx) => {
        el.container.appendChild(createMessageCard(item, 'all-' + idx, idx));
    });
    renderPagination(page);
}

function renderPagination(current) {
    const el = getElements();
    if (!el.paginationBox) return;
    el.paginationBox.innerHTML = '';
    
    const total = Math.ceil(filteredMessages.length / 100);
    if (total <= 1) return;

    const pages = [];
    
    if (total <= 9) {
        for (let i = 1; i <= total; i++) pages.push(i);
    } else {
        // 核心邏輯：維持 第一頁 + [中間五頁] + 最後一頁
        if (current <= 5) {
            // 靠近開頭：1, 2, 3, 4, 5, 6, ..., total
            for (let i = 1; i <= 6; i++) pages.push(i);
            pages.push('...', total);
        } else if (current >= total - 4) {
            // 靠近結尾：1, ..., total-5, total-4, total-3, total-2, total-1, total
            pages.push(1, '...');
            for (let i = total - 5; i <= total; i++) pages.push(i);
        } else {
            // 在中間：1, ..., current-2, current-1, current, current+1, current+2, ..., total
            pages.push(1, '...');
            for (let i = current - 2; i <= current + 2; i++) pages.push(i);
            pages.push('...', total);
        }
    }

    pages.forEach(p => {
        if (p === '...') {
            const span = document.createElement('span');
            span.innerText = '...';
            span.className = 'pagination-ellipsis';
            el.paginationBox.appendChild(span);
        } else {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.innerText = p;
            btn.className = `page-btn ${p === current ? 'active' : ''}`;
            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                // 記住目前 scroll 位置（整頁）
                const scrollY = window.scrollY;
                renderPage(p);
                // 強制還原 scroll
                requestAnimationFrame(() => {
                    window.scrollTo(0, scrollY);
                });
            };
            el.paginationBox.appendChild(btn);
        }
    });
}

// --- 字體切換邏輯 (全域釋放) ---
const sizes = ['font-size-small', 'font-size-medium', 'font-size-large'];
let currentIdx = 0;

window.cycleFontSize = () => {
    // 取得當前頁面所有的 body 或特定的容器
    const body = document.body;
    body.classList.remove(...sizes);
    currentIdx = (currentIdx + 1) % sizes.length;
    body.classList.add(sizes[currentIdx]);
    
    // 儲存設定到本地，讓切換頁面後依然生效 (選用)
    localStorage.setItem('gb-font-size-pref', sizes[currentIdx]);
};

// 頁面載入時自動套用上次的設定
document.addEventListener('DOMContentLoaded', () => {
    const saved = localStorage.getItem('gb-font-size-pref') || 'font-size-small';

    requestAnimationFrame(() => {
        document.body.classList.remove(...sizes);
        document.body.classList.add(saved);
    });
    
    currentIdx = sizes.indexOf(saved);
    if (currentIdx === -1) currentIdx = 0;

    const btnUp = document.getElementById('scroll-up');
    const btnDown = document.getElementById('scroll-down');

    // 一鍵往上
    if (btnUp) {
        btnUp.onclick = () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth' // 平滑滾動
            });
        };
    }

    // 一鍵往下
    if (btnDown) {
        btnDown.onclick = () => {
            window.scrollTo({
                top: document.documentElement.scrollHeight,
                behavior: 'smooth'
            });
        };
    }
    
    // 滾動到最頂端時隱藏「往上」按鈕，最底端時隱藏「往下」按鈕
    window.addEventListener('scroll', () => {
        const scrolledToTop = window.scrollY === 0;
        const scrolledToBottom = (window.innerHeight + window.scrollY) >= document.documentElement.scrollHeight - 10;
        
        btnUp.style.opacity = scrolledToTop ? "0.3" : "1";
        btnUp.style.pointerEvents = scrolledToTop ? "none" : "auto";
        
        btnDown.style.opacity = scrolledToBottom ? "0.3" : "1";
        btnDown.style.pointerEvents = scrolledToBottom ? "none" : "auto";
    });
});
