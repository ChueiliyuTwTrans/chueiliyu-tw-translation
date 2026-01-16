// reaction-core.js

// ==========================================
// 1. 設定區域：定義兩組不同的表情
// ==========================================

// A. 表情牆 (Reaction Wall)：只顯示 6 個，會計算累積次數
const REACTION_WALL_LIST = [
    { type: 'bunny', icon: '🐰', label: '可愛' },
    { type: 'haha',  icon: '😆', label: '笑死' },
    { type: 'warm',  icon: '🥰', label: '喜歡' },
    { type: 'cool',  icon: '😎', label: '酷' },
    { type: 'thumb_up',  icon: '👍', label: '讚' },
    { type: 'fire',  icon: '🔥', label: '燃' }
];

// B. 即時表情 (Barrage)：顯示 12 個，不計算次數，只負責飄過去
const BARRAGE_LIST = [
    { type: 'bunny', icon: '🐰' },
    { type: 'haha',  icon: '😆' },
    { type: 'laugh', icon: '🤣' },
    { type: 'warm',  icon: '🥰' },
    { type: 'love_eyes', icon: '😍' },
    { type: 'ooh', icon: '😮' },
    { type: 'cool',  icon: '😎' },
    { type: 'thumb_up', icon: '👍' },
    { type: 'clap',  icon: '👏' },
    { type: 'thanks', icon: '🙏' },
    { type: 'fire',  icon: '🔥' },
    { type: 'heart', icon: '❤️' }
];

// 建立快速查詢表 (用於彈幕顯示 icon)
const EMOJI_MAP = {};
BARRAGE_LIST.forEach(item => EMOJI_MAP[item.type] = item.icon);
// 確保表情牆的 icon 也在查詢表中 (防呆)
REACTION_WALL_LIST.forEach(item => EMOJI_MAP[item.type] = item.icon);


// ==========================================
// 2. 初始化：生成 HTML 與 同步數據
// ==========================================

function initReactionUI() {
    // --- A. 生成表情牆按鈕 (6個) ---
    const wallContainer = document.querySelector('.reaction-wall');
    if (wallContainer) {
        wallContainer.innerHTML = REACTION_WALL_LIST.map(item => `
            <button class="emoji-btn" data-type="${item.type}" onclick="toggleReaction('${item.type}', event)">
                ${item.icon} <span class="count-display" id="count-${item.type}">0</span>
            </button>
        `).join('');
    }

    // --- B. 生成彈幕抽屜按鈕 (12個) ---
    const drawerContainer = document.getElementById('emoji-drawer');
    if (drawerContainer) {
        drawerContainer.innerHTML = BARRAGE_LIST.map(item => `
            <button class="emoji-btn" onclick="sendInstantBarrage('${item.type}', event)">
                ${item.icon}
            </button>
        `).join('');
    }

    // --- C. 啟動 Firebase 監聽 (只針對表情牆的數字) ---
    setTimeout(syncWallCounts, 500);
}

function syncWallCounts() {
    if (!window.db || !window.fb_ref) return;

    REACTION_WALL_LIST.forEach(item => {
        const type = item.type;
        
        // 1. 監聽雲端數字變化
        const countRef = window.fb_ref(window.db, `video_reactions/${MY_VIDEO_ID}/${type}`);
        window.fb_onValue(countRef, (snapshot) => {
            const data = snapshot.val() || 0;
            const el = document.getElementById(`count-${type}`);
            if (el) el.innerText = data;
        });

        // 2. 檢查本地是否點過 (決定按鈕是否亮起)
        const storageKey = `reacted-${MY_VIDEO_ID}-${type}`;
        if (localStorage.getItem(storageKey) === 'true') {
            const btn = document.querySelector(`.reaction-wall button[data-type="${type}"]`);
            if (btn) btn.classList.add('active');
        }
    });
}


// ==========================================
// 3. 功能 A：表情牆邏輯 (Toggle 計數)
// ==========================================

window.toggleReaction = function(type, event) {
    if (event) event.stopPropagation();
    
    // 檢查 Firebase 是否就緒
    if (!window.db || !window.fb_runTransaction) {
        console.warn("Firebase not ready");
        return;
    }

    const storageKey = `reacted-${MY_VIDEO_ID}-${type}`;
    const isReacted = localStorage.getItem(storageKey) === 'true';
    const btn = document.querySelector(`.reaction-wall button[data-type="${type}"]`);
    
    // 執行資料庫交易
    const countRef = window.fb_ref(window.db, `video_reactions/${MY_VIDEO_ID}/${type}`);
    window.fb_runTransaction(countRef, (currentCount) => {
        let val = (currentCount === null) ? 0 : currentCount;
        if (isReacted) {
            return Math.max(0, val - 1); // 取消讚
        } else {
            return val + 1; // 按讚
        }
    }).then(() => {
        // UI 更新
        if (isReacted) {
            localStorage.removeItem(storageKey);
            if (btn) {
                btn.classList.remove('active');
                btn.style.transform = "scale(1)";
            }
        } else {
            localStorage.setItem(storageKey, 'true');
            if (btn) {
                btn.classList.add('active');
                // 點擊回饋動畫
                btn.style.transform = "scale(1.2)";
                setTimeout(() => {
                    // 如果還是 active，保持微大；否則歸零
                    const stillActive = localStorage.getItem(storageKey) === 'true';
                    btn.style.transform = stillActive ? "scale(1.05)" : "scale(1)";
                }, 150);
            }
        }
    });
    // 注意：這裡完全不呼叫 createBarrageDom，所以牆上點擊不會飄彈幕
};


// ==========================================
// 4. 功能 B：即時彈幕邏輯 (發射不計數)
// ==========================================

let lastSentSignal = { time: -1, type: '' }; 
let lastClickTime = 0;

window.sendInstantBarrage = function(type, event) {
    if (event) {
        event.stopPropagation();
        // 讓按鈕有個點擊縮放效果
        const btn = event.currentTarget;
        btn.style.transform = "scale(0.8)";
        setTimeout(() => btn.style.transform = "scale(1)", 100);
    }

    const now = Date.now();
    if (now - lastClickTime < 200) return; // 防連點
    lastClickTime = now;

    // 1. 本地立即顯示 (視覺回饋)
    window.createBarrageDom(EMOJI_MAP[type]);

    // 2. 寫入 Firebase (只為了同步給別的觀眾看，不計入 Wall)
   if (window.player && typeof window.player.getCurrentTime === 'function') {
        const currentTime = Math.floor(window.player.getCurrentTime());
        lastSentSignal = { time: currentTime, type: type }; // 標記是自己發的

        // 檢查 Firebase 是否連接成功
        if (window.db && window.fb_ref && window.fb_runTransaction) {
            const barrageRef = window.fb_ref(window.db, `barrages/${MY_VIDEO_ID}/${currentTime}/${type}`);
            window.fb_runTransaction(barrageRef, (count) => (count || 0) + 1)
                .catch(err => console.error("Firebase 寫入失敗:", err));
        } else {
            console.error("Firebase 未初始化：請檢查 index.html 是否有掛載 window.db / window.fb_ref");
        }
    } else {
        console.warn("找不到播放器 (window.player)：無法記錄時間，僅顯示本地動畫");
    }

    // 3. 發送後關閉抽屜
    closeEmojiDrawer();
};


// ==========================================
// 5. 彈幕顯示與同步系統 (共用邏輯)
// ==========================================

// --- 變數設定 ---
let isBarrageEnabled = localStorage.getItem("barrage-enabled") !== "false";
let barrageSize = localStorage.getItem("barrage-size") || 24;
let barrageHeight = localStorage.getItem("barrage-height") || 40;
let barrageSpeed = localStorage.getItem("barrage-speed") || 5;
let lastCheckedSecond = -1;
const MAX_BARRAGE_COUNT = 15; // 彈幕上限

// --- DOM 生成 ---
window.createBarrageDom = function(text) {
    if (!isBarrageEnabled || !text) return;
    const container = document.getElementById('barrage-container');
    if (!container) return;

    // A. 清理舊表情
    const currentItems = container.getElementsByClassName('barrage-item');
    if (currentItems.length >= MAX_BARRAGE_COUNT) currentItems[0].remove();

    // B. 建立新元素
    const el = document.createElement('div');
    el.className = 'barrage-item';
    el.innerText = text;
    container.appendChild(el);

    // C. 智慧位置計算
    const containerHeight = container.offsetHeight || 100; 
    const emojiHeight = el.offsetHeight || 30; // 取得表情實際高度
    
    let targetTop = 0;

    // 邏輯：計算垂直置中或隨機位置
    if (emojiHeight > containerHeight) {
        // 如果表情比容器大，嘗試垂直置中 (這會產生負值)
        targetTop = (containerHeight - emojiHeight) / 2;
    } else {
        // 如果表情比容器小，在範圍內隨機
        const availableSpace = containerHeight - emojiHeight;
        targetTop = Math.floor(Math.random() * availableSpace);
    }

    // 防止全螢幕時飄出頂部邊界
    // 如果計算出的 top 是負的 (例如 -20px)，且容器貼齊螢幕頂部 (全螢幕模式)
    // 我們要強制把它校正回 0，頂多貼著邊緣，不要消失
    // (在非全螢幕模式下，因為容器上方還有標題，所以負值其實是允許的，可以蓋住標題，這裡我們做個折衷：不允許小於 -10px)
    if (targetTop < -10) {
        targetTop = -5; // 稍微突出一點點沒關係，但不要太多
    }

    el.style.top = targetTop + "px";
    
    // D. 動畫結束後自毀
    el.onanimationend = () => el.remove();
};

// --- 同步監聽 (每 0.5 秒檢查一次雲端是否有新彈幕) ---
document.addEventListener("DOMContentLoaded", () => {
    // 1. 初始化畫面按鈕
    initReactionUI();

    // 2. 初始化彈幕設定 UI
    updateBarrageUI();

    // 3. 啟動同步循環
    setInterval(() => {
        if (!window.player || typeof window.player.getCurrentTime !== 'function') return;
        if (window.player.getPlayerState() !== 1) return; // 沒在播放就不抓

        const now = Math.floor(window.player.getCurrentTime());
        
        if (now !== lastCheckedSecond) {
            lastCheckedSecond = now;
            
            // 讀取這一秒的彈幕資料
            if (window.db && window.fb_ref) {
                const secondRef = window.fb_ref(window.db, `barrages/${MY_VIDEO_ID}/${now}`);
                window.fb_onValue(secondRef, (snapshot) => {
                    const data = snapshot.val();
                    if (data) {
                        Object.keys(data).forEach(type => {
                            let count = Math.min(data[type], 5); // 限制瞬間數量
                            
                            // 如果這秒我有發送過這個類型，本地已經噴過了，扣掉 1 次避免重複
                            if (now === lastSentSignal.time && type === lastSentSignal.type) {
                                count = Math.max(0, count - 1);
                            }

                            // 隨機延遲噴出
                            for(let i = 0; i < count; i++) {
                                setTimeout(() => {
                                    window.createBarrageDom(EMOJI_MAP[type]);
                                }, Math.random() * 1200);
                            }
                        });
                    }
                }, { onlyOnce: true });
            }
        }
    }, 500);
});

// === 即時表情抽屜控制邏輯 ===

// 1. 切換抽屜顯示/隱藏 (綁定在觸發按鈕 onclick)
window.toggleEmojiDrawer = function(event) {
    if (event) {
        event.stopPropagation(); // 防止點擊穿透
        event.preventDefault();
    }

    const drawer = document.getElementById('emoji-drawer');
    const triggerBtn = document.getElementById('emoji-trigger-btn');

    if (!drawer || !triggerBtn) return;

    // 清除可能殘留的行內樣式，確保 CSS class 能生效
    drawer.style.removeProperty('display');

    // 切換 class
    drawer.classList.toggle('show');
    triggerBtn.classList.toggle('active');
};

// 2. 關閉抽屜的共用函式
function closeEmojiDrawer() {
    const drawer = document.getElementById('emoji-drawer');
    const triggerBtn = document.getElementById('emoji-trigger-btn');
    
    if (drawer) drawer.classList.remove('show');
    if (triggerBtn) triggerBtn.classList.remove('active');
}

// 3. 監聽 ESC 鍵 (keydown)
document.addEventListener('keydown', (e) => {
    // 如果按下 ESC 且抽屜是打開的，就關閉它
    if (e.key === 'Escape') {
        closeEmojiDrawer();
    }
});

// 4. 監聽全螢幕狀態改變 (退出全螢幕時關閉)
document.addEventListener('fullscreenchange', handleFullscreenChange);
document.addEventListener('webkitfullscreenchange', handleFullscreenChange); // Safari

function handleFullscreenChange() {
    const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
    
    // 如果「目前沒有」全螢幕元素 (代表退出了)，則強制關閉抽屜
    if (!isFullscreen) {
        closeEmojiDrawer();
    }
}

// 5. 點擊畫面其他地方時關閉 (選用，增加體驗)
// 如果你希望點擊影片空白處也能關閉抽屜，可以加上這段
document.addEventListener('click', (e) => {
    const drawer = document.getElementById('emoji-drawer');
    const triggerBtn = document.getElementById('emoji-trigger-btn');
    
    // 如果點擊的目標不是抽屜內部，也不是觸發按鈕，就關閉
    if (drawer && triggerBtn && 
        !drawer.contains(e.target) && 
        !triggerBtn.contains(e.target)) {
        closeEmojiDrawer();
    }
});

window.toggleBarrageDisplay = function() {
    isBarrageEnabled = !isBarrageEnabled;
    localStorage.setItem("barrage-enabled", isBarrageEnabled);
    updateBarrageUI();
};

function updateBarrageUI() {
    const container = document.getElementById('barrage-container');
    const btn = document.getElementById('barrage-toggle-btn');
    const controls = document.querySelectorAll('.barrage-control');
    const triggerBtn = document.getElementById('emoji-trigger-btn'); // 取得表情按鈕
    
    // 套用變數
    if (container) {
        if (isBarrageEnabled) {
            container.classList.remove('hide-barrage');
            // 移除強制隱藏 class
            if (triggerBtn) triggerBtn.classList.remove('force-hide');
            // 移除強制隱藏，讓按鈕顯示 (CSS 會決定它是在左上還是左中)
            if (triggerBtn) triggerBtn.classList.remove('force-hide');
        } else {
            container.classList.add('hide-barrage');
            // 加上強制隱藏 class
            if (triggerBtn) {
                triggerBtn.classList.add('force-hide');
                // 順便關閉抽屜，避免按鈕消失但抽屜還開著
                const drawer = document.getElementById('emoji-drawer');
                if (drawer) {
                    drawer.classList.remove('show');
                    triggerBtn.classList.remove('active');
                }
            }
        }
        
        container.style.setProperty('--barrage-size', barrageSize + 'px');
        container.style.setProperty('--barrage-height', barrageHeight + '%');
        container.style.setProperty('--barrage-speed', (13 - barrageSpeed) + "s");
    }

    // 更新按鈕樣式
    if (btn) {
        if (isBarrageEnabled) {
            btn.innerText = "即時表情：開";
            btn.style.background = "#5A98ED";
            btn.style.color = "#fff";
            controls.forEach(el => { el.style.display = 'flex'; setTimeout(()=>el.style.opacity=1,10); });
        } else {
            btn.innerText = "即時表情：關";
            btn.style.background = "#333";
            controls.forEach(el => { el.style.display = 'none'; el.style.opacity=0; });
        }
    }
}

// Slider 事件綁定
window.updateBarrageSize = function(val) {
    barrageSize = val;
    localStorage.setItem("barrage-size", val);
    updateBarrageUI();
};
window.updateBarrageHeight = function(val) {
    barrageHeight = val;
    localStorage.setItem("barrage-height", val);
    const display = document.getElementById('height-val');
    if(display) display.innerText = val + '%';
    updateBarrageUI();
};
window.updateBarrageSpeed = function(val) {
    barrageSpeed = val;
    localStorage.setItem("barrage-speed", val);
    updateBarrageUI();
};
