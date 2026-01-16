// --- 1. 固定 6 個表情資料 ---
const EMOJI_DATA = [
    { icon: "🐰", label: "兔子" },
    { icon: "😆", label: "笑死" },
    { icon: "🥰", label: "喜歡" },
    { icon: "😍", label: "愛死" },
    { icon: "🤣", label: "爆笑" },
    { icon: "😎", label: "酷" },
    { icon: "😮", label: "驚訝" },
    { icon: "👍", label: "讚" },
    { icon: "👏", label: "拍手" },
    { icon: "🙏", label: "祈禱" },
    { icon: "🔥", label: "火" },
    { icon: "❤️", label: "愛心" }
];

// 彈幕映射表 (自動根據 EMOJI_DATA 生成)
const emojiMap = {};
EMOJI_DATA.forEach(item => emojiMap[item.type] = item.icon);

// --- 2. 自動生成按鈕 ---
function initReactionButtons() {
    const wall = document.querySelector('.reaction-wall');
    const drawer = document.getElementById('emoji-drawer');
  
    // 生成統一的按鈕 HTML
    const buttonsHTML = EMOJI_DATA.map(item => `
        <button class="emoji-btn" onclick="addReaction('${item.type}')">
            ${item.icon} <span id="count-${item.type}">0</span>
        </button>
    `).join('');

    if (wall) wall.innerHTML = buttonsHTML;
    if (drawer) drawer.innerHTML = buttonsHTML;

    // 啟動後立即同步 Firebase 數據 (需確保 index.html 已定義 window.db)
    setTimeout(syncFirebaseData, 500);
}

// --- 3. 同步 Firebase 數據 (讀取) ---
function syncFirebaseData() {
    if (!window.db || !window.fb_ref) return;
    
    EMOJI_DATA.forEach(item => {
        const type = item.type;
        const countRef = window.fb_ref(window.db, `video_reactions/${MY_VIDEO_ID}/${type}`);
        
        window.fb_onValue(countRef, (snapshot) => {
            const data = snapshot.val() || 0;
            // 同時更新表情牆和抽屜中「對應類型」的數字
            const countEls = document.querySelectorAll(`.count-${type}`);
            countEls.forEach(el => el.innerText = data);
        });

        // 初始化本地 active 狀態
        if (localStorage.getItem(`reacted-${MY_VIDEO_ID}-${type}`) === 'true') {
            const btns = document.querySelectorAll(`button[data-type="${type}"]`);
            btns.forEach(btn => btn.classList.add('active'));
        }
    });
}

// --- 4. 點擊反應 (寫入) ---
window.addReaction = function(type, event) {
    if (event) {
        event.stopPropagation(); // 防止事件冒泡
    }
    
    const storageKey = `reacted-${MY_VIDEO_ID}-${type}`;
    const isReacted = localStorage.getItem(storageKey) === 'true';
    const countRef = window.fb_ref(window.db, `video_reactions/${MY_VIDEO_ID}/${type}`);

    window.fb_runTransaction(countRef, (currentCount) => {
        let val = (currentCount === null) ? 0 : currentCount;
        return isReacted ? Math.max(0, val - 1) : val + 1;
    }).then(() => {
        const btns = document.querySelectorAll(`button[data-type="${type}"]`);
        if (isReacted) {
            localStorage.removeItem(storageKey);
            btns.forEach(btn => btn.classList.remove('active'));
        } else {
            localStorage.setItem(storageKey, 'true');
            btns.forEach(btn => btn.classList.add('active'));
            // 觸發彈幕
            window.sendBarrageWithFeedback(type);
        }
    });
};

// --- 修正按鈕生成 (加上 data-type 和專屬 class) ---
function initReactionButtons() {
    const wall = document.querySelector('.reaction-wall');
    const drawer = document.getElementById('emoji-drawer');
    
    const buttonsHTML = EMOJI_DATA.map(item => `
        <button class="emoji-btn" data-type="${item.type}" onclick="addReaction('${item.type}', event)">
            ${item.icon} <span class="count-${item.type}">0</span>
        </button>
    `).join('');

    if (wall) wall.innerHTML = buttonsHTML;
    if (drawer) drawer.innerHTML = buttonsHTML;

    setTimeout(syncFirebaseData, 500);
}
    
// --- 5. 彈幕顯示控制與變數 ---
let isBarrageEnabled = localStorage.getItem("barrage-enabled") !== "false";
let barrageSize = localStorage.getItem("barrage-size") || 24;
let barrageHeight = localStorage.getItem("barrage-height") || 40;
let barrageSpeed = localStorage.getItem("barrage-speed") || 5;
let lastSentSignal = { time: -1, type: '' }; 
let lastCheckedSecond = -1;
let lastClickTime = 0;
const MAX_BARRAGE_COUNT = 10;

// UI 切換與更新函數 (掛載到 window)
window.toggleEmojiDrawer = function(e) {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    const drawer = document.getElementById('emoji-drawer');
    if (drawer) {
        const isVisible = drawer.style.display === 'grid';
        drawer.style.display = isVisible ? 'none' : 'grid';
    }
};

window.toggleBarrageDisplay = function() {
    isBarrageEnabled = !isBarrageEnabled;
    localStorage.setItem("barrage-enabled", isBarrageEnabled);
    updateBarrageDisplayUI();
};

function updateBarrageDisplayUI() {
    const container = document.getElementById('barrage-container');
    const btn = document.getElementById('barrage-toggle-btn');
    const controls = document.querySelectorAll('.barrage-control');
    if (!container || !btn) return;
    
    if (isBarrageEnabled) {
        container.classList.remove('hide-barrage');
        btn.innerText = "即時表情：開";
        btn.style.background = "#5A98ED";
        controls.forEach(el => { el.style.display = 'flex'; setTimeout(() => el.style.opacity = '1', 10); });
    } else {
        container.classList.add('hide-barrage');
        btn.innerText = "即時表情：關";
        btn.style.background = "#333";
        controls.forEach(el => { el.style.display = 'none'; el.style.opacity = '0'; });
    }
}

window.updateBarrageSize = function(val) {
    barrageSize = val;
    localStorage.setItem("barrage-size", val);
    const container = document.getElementById('barrage-container');
    if (container) container.style.setProperty('--barrage-size', val + 'px');
};

window.updateBarrageHeight = function(val) {
    barrageHeight = val;
    localStorage.setItem("barrage-height", val);
    const container = document.getElementById('barrage-container');
    if (container) container.style.setProperty('--barrage-height', val + '%');
    const display = document.getElementById('height-val');
    if (display) display.innerText = val + '%';
};

window.updateBarrageSpeed = function(val) {
    barrageSpeed = val;
    localStorage.setItem("barrage-speed", val);
    const container = document.getElementById('barrage-container');
    if (container) container.style.setProperty('--barrage-speed', (13 - val) + "s");
};

// --- 6. 核心彈幕邏輯 ---
window.sendBarrageWithFeedback = function(type) {
    const now = Date.now();
    if (now - lastClickTime < 200) return; 
    lastClickTime = now;

    // 自己按的立刻噴
    window.createBarrageDom(emojiMap[type]); 

    if (window.player && typeof window.player.getCurrentTime === 'function') {
        const currentTime = Math.floor(window.player.getCurrentTime());
        lastSentSignal = { time: currentTime, type: type };

        const barrageRef = window.fb_ref(window.db, `barrages/${MY_VIDEO_ID}/${currentTime}/${type}`);
        window.fb_runTransaction(barrageRef, (count) => (count || 0) + 1);
    }

    const drawer = document.getElementById('emoji-drawer');
    if (drawer) drawer.style.display = 'none';
};

window.createBarrageDom = function(text) {
    if (!isBarrageEnabled || !text) return;
    const container = document.getElementById('barrage-container');
    if (!container) return;

    const currentItems = container.getElementsByClassName('barrage-item');
    if (currentItems.length >= MAX_BARRAGE_COUNT) currentItems[0].remove();

    const el = document.createElement('div');
    el.className = 'barrage-item';
    el.innerText = text;
    container.appendChild(el);

    const containerHeight = container.offsetHeight || 100; 
    const emojiHeight = el.offsetHeight || 24;
    const availableSpace = Math.max(0, containerHeight - emojiHeight);
    el.style.top = Math.floor(Math.random() * availableSpace) + "px";
    
    el.onanimationend = () => el.remove();
};

// --- 7. 全局初始化與定時同步 ---
document.addEventListener("DOMContentLoaded", () => {
    initReactionButtons();
    updateBarrageDisplayUI();
    updateBarrageSize(barrageSize);
    updateBarrageHeight(barrageHeight);
    updateBarrageSpeed(barrageSpeed);

    // 同步雲端彈幕
    setInterval(() => {
        if (!window.player || window.player.getPlayerState() !== 1) return;
        const now = Math.floor(window.player.getCurrentTime());
        
        if (now !== lastCheckedSecond) {
            lastCheckedSecond = now;
            const secondRef = window.fb_ref(window.db, `barrages/${MY_VIDEO_ID}/${now}`);
            
            window.fb_onValue(secondRef, (snapshot) => {
                const data = snapshot.val();
                if (data) {
                    Object.keys(data).forEach(type => {
                        let count = Math.min(data[type], 3); 
                        if (now === lastSentSignal.time && type === lastSentSignal.type) count = Math.max(0, count - 1);

                        for(let i = 0; i < count; i++) {
                            setTimeout(() => window.createBarrageDom(emojiMap[type]), Math.random() * 1500);
                        }
                    });
                }
            }, { onlyOnce: true });
        }
    }, 500);
});
