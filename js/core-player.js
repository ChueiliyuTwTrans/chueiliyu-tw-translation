// core-player.js

// --- 全域變數 (所有影片共用) ---
let player;
let subtitles = [];
let subtitleTimer = null;
let saveTimer = null;

// 安全讀取 subtitle-scale
let subtitleScale = 1;
try {
    const savedScale = localStorage.getItem("subtitle-scale");
    if (savedScale) subtitleScale = parseFloat(savedScale);
} catch (e) {
    console.warn("無法存取 localStorage，將使用預設字體大小");
}

// 抓取 DOM
const subtitleEl = document.getElementById("subtitle");
const wrapper = document.getElementById("video-wrapper");
const fsBtn = document.getElementById("fs-btn");
const exitFsBtn = document.getElementById("exit-fs-btn");

// 初始化字幕縮放
if (subtitleEl) {
    subtitleEl.style.setProperty("--subtitle-scale", subtitleScale);
}

// --- 核心功能：字幕處理 ---
function toSeconds(time) {
    const parts = time.replace(",", ".").split(":");
    if (parts.length !== 3) return 0;
    return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
}

function parseSRT(data) {
    data = data.replace(/\r/g, "").trim();
    const blocks = data.split(/\n{2,}/);
    return blocks.map(block => {
        const lines = block.split("\n").map(l => l.trim()).filter(l => l && !/^\d+$/.test(l));
        const timeLine = lines.find(l => l.includes("-->"));
        if (!timeLine) return null;
        const times = timeLine.split("-->").map(t => t.trim());
        const textLines = lines.slice(lines.indexOf(timeLine) + 1);
        return {
            start: toSeconds(times[0]),
            end: toSeconds(times[1]),
            text: textLines.join("<br>")
        };
    }).filter(Boolean);
}

// --- 全域變數擴充 ---
let subtitleBottom = 8; // 預設距離底部 8%

// 安全讀取歷史設定
try {
    const savedScale = localStorage.getItem("subtitle-scale");
    if (savedScale) subtitleScale = parseFloat(savedScale);
    
    const savedBottom = localStorage.getItem("subtitle-bottom");
    if (savedBottom) subtitleBottom = parseInt(savedBottom);
} catch (e) {}

// 初始化位置與大小
if (subtitleEl) {
    subtitleEl.style.setProperty("--subtitle-scale", subtitleScale);
    subtitleEl.style.setProperty("--subtitle-bottom", subtitleBottom + "%");
}

/**
 * 調整字體大小
 */
function coreChangeSubtitleSize(delta) {
    // 最小值改為 0.4，最大值 3.5
    subtitleScale = Math.min(3.5, Math.max(0.4, subtitleScale + delta));
    try {
        localStorage.setItem("subtitle-scale", subtitleScale);
    } catch (e) {}
    if (subtitleEl) subtitleEl.style.setProperty("--subtitle-scale", subtitleScale);
}

/**
 * 調整字幕上下位置
 * @param {number} delta - 增加或減少百分比
 */
function changeSubtitlePosition(delta) {
    // 限制範圍在 2% 到 80% 之間，避免跑出畫面
    subtitleBottom = Math.min(80, Math.max(2, subtitleBottom + delta));
    
    // 儲存設定
    try {
        localStorage.setItem("subtitle-bottom", subtitleBottom);
    } catch (e) {}

    // 即時套用 CSS 變數
    const subtitleEl = document.getElementById('subtitle');
    if (subtitleEl) {
        subtitleEl.style.setProperty("--subtitle-bottom", subtitleBottom + "%");
    }
}

// 修改渲染邏輯：為了讓黑底只包裹文字，我們在外層加一個 <span>
function startSubtitleSync() {
    subtitleTimer = setInterval(() => {
        if (!player || !player.getVideoData) return;
        const videoData = player.getVideoData();
        const isAd = (videoData.video_id !== MY_VIDEO_ID) || 
                     (player.getAdState && player.getAdState() !== -1);

        if (isAd) { subtitleEl.innerHTML = ""; return; }

        const t = player.getCurrentTime();
        const activeSubs = subtitles.filter(x => t >= x.start && t <= x.end);
        
        if (activeSubs.length) {
            // 用 span 包裹文字，CSS 的黑底才會精確跟隨文字長度
            const textContent = activeSubs.map(s => s.text).join("<br>");
            subtitleEl.innerHTML = `<span>${textContent}</span>`;
        } else {
            subtitleEl.innerHTML = "";
        }
    }, 200);
}

// 字幕選單
function toggleSubtitleMenu() {
    const menu = document.getElementById('subtitle-controls');
    const btn = document.getElementById('subtitle-menu-btn');

    // 檢查目前是否隱藏
    if (menu.style.display === 'none' || menu.style.display === '') {
        // 顯示選單
        menu.style.display = 'flex';
        // 加入變色類別
        btn.classList.add('active');
    } else {
        // 隱藏選單
        menu.style.display = 'none';
        // 移除變色類別
        btn.classList.remove('active');
    }
}

// --- 核心功能：YouTube API 邏輯 ---
function onYouTubeIframeAPIReady() {
    if (typeof MY_VIDEO_ID === 'undefined' || !MY_VIDEO_ID) {
        setTimeout(onYouTubeIframeAPIReady, 100);
        return;
    }

    // 在建立播放器之前，先計算出最後要從哪一秒開始播放
    let initStartTime = 1; 
    
    // 優先順序 1：如果網頁有指定立于出場時間 (MY_VIDEO_START)
    if (typeof MY_VIDEO_START !== 'undefined') {
        initStartTime = MY_VIDEO_START;
    } 
    // 優先順序 2：如果沒有指定，就去撈 localStorage 的歷史觀看紀錄
    else {
        // 安全讀取歷史觀看紀錄
        try {
            const savedTime = localStorage.getItem("yt-played-time");
            if (savedTime !== null) {
                initStartTime = parseFloat(savedTime);
            }
        } catch (e) {
            console.warn("無痕模式：無法讀取播放進度");
        }
    }

    player = new YT.Player("player", {
        videoId: MY_VIDEO_ID,
        playerVars: {
            start: Math.floor(initStartTime), // 直接把時間塞進 start 參數 (必須用整數)
            rel: 0, 
            playsinline: 1, 
            modestbranding: 1, 
            fs: 0, 
            controls: 1
        },
        events: { onReady, onStateChange }
    });

    window.player = player;
}

function onReady(e) {
    const iframe = e.target.getIframe();
    iframe.setAttribute("allowfullscreen", "");

    // 安全讀取音量設定
    try {
        const savedVolume = localStorage.getItem("yt-volume");
        if (savedVolume !== null) {
            setTimeout(() => { if (player && player.setVolume) player.setVolume(parseInt(savedVolume)); }, 500);
        }
    } catch (e) {}
}

function onStateChange(e) {
    if (e.data === YT.PlayerState.PLAYING) {
        if (!subtitleTimer) startSubtitleSync();
        startAutoSave();
    } else {
        stopAutoSave();
    }
}

function startAutoSave() {
    if (saveTimer) clearInterval(saveTimer);
    saveTimer = setInterval(() => {
        if (player && player.getVideoData && player.getVideoData().video_id === MY_VIDEO_ID) {
            // 安全寫入播放進度與音量
            try {
                localStorage.setItem("yt-played-time", player.getCurrentTime());
                localStorage.setItem("yt-volume", player.getVolume());
            } catch (e) {}
        }
    }, 5000);
}

function stopAutoSave() { clearInterval(saveTimer); saveTimer = null; }

function resetProgress() { localStorage.removeItem("yt-played-time"); location.reload(); }

// --- 核心功能：全螢幕管理 ---
function showExitBtn() {
    if (!exitFsBtn || !wrapper) return;
    const isFS = document.fullscreenElement || document.webkitFullscreenElement;
    const isPseudo = wrapper.classList.contains("pseudo-fullscreen");
    if (isFS || isPseudo) {
        exitFsBtn.style.setProperty('display', 'flex', 'important');
        requestAnimationFrame(() => {
            exitFsBtn.style.opacity = "1";
        });
    } else {
        exitFsBtn.style.opacity = "0";
        exitFsBtn.style.display = "none";
    }
}

function toggleFullscreen() {
    const isFS = document.fullscreenElement || document.webkitFullscreenElement;
    // 檢查是否有偽全螢幕 class
    const isPseudo = wrapper.classList.contains("pseudo-fullscreen");

    if (isFS || isPseudo) {
        // === 退出全螢幕 ===
        if (isFS) {
            const exit = document.exitFullscreen || document.webkitExitFullscreen;
            if (exit) exit.call(document);
        }

        // 移除偽全螢幕樣式
        wrapper.classList.remove("pseudo-fullscreen");
        document.body.classList.remove("is-in-fullscreen", "has-fullscreen");

        // 恢復背景捲動
        document.body.style.overflow = "";
        document.body.style.position = "";

        if (fsBtn) fsBtn.innerText = "進入全螢幕";
        if (exitFsBtn) {
            exitFsBtn.style.opacity = "0";
            exitFsBtn.style.display = "none";
        }

        // 針對 iOS 轉向處理
        if (/iPhone|iPod|iPad/.test(navigator.userAgent)) {
             setTimeout(() => window.scrollTo(0, 0), 100);
        }

    } else {
        // === 進入全螢幕 ===
        const isIPhone = /iPhone|iPod/.test(navigator.userAgent);
        const req = wrapper.requestFullscreen || wrapper.webkitRequestFullscreen;

        if (req && !isIPhone) {
            req.call(wrapper).then(() => {
                // 原生全螢幕成功後，手動呼叫顯示按鈕
                setTimeout(showExitBtn, 100);
            }).catch(() => {
                enterPseudoFullscreen();
            });
        } else {
            enterPseudoFullscreen();
        }
    }
}

// 抽離出來的偽全螢幕邏輯
function enterPseudoFullscreen() {
    wrapper.classList.add("pseudo-fullscreen");
    document.body.classList.add("is-in-fullscreen");

    if (fsBtn) fsBtn.innerText = "退出全螢幕";

    // 嘗試隱藏網址列 (Hack)：先捲動到最上方
    window.scrollTo(0, 0);

    // 鎖死 Body 防止背景滑動，這對 iOS Safari 隱藏 UI 很重要
    document.body.style.overflow = "hidden"; 

    // 進入時「立刻」呼叫顯示，並多呼叫幾次確保出現
    showExitBtn();
    setTimeout(showExitBtn, 300); // 300ms 後再確認一次，防止轉向延遲
}

// 綁定事件
if (fsBtn) fsBtn.onclick = toggleFullscreen;
if (exitFsBtn) exitFsBtn.onclick = (e) => { e.stopPropagation(); toggleFullscreen(); };

window.addEventListener("orientationchange", () => setTimeout(showExitBtn, 500));
document.addEventListener('touchstart', (e) => { if (wrapper.contains(e.target)) showExitBtn(); }, { passive: true, capture: true });
document.addEventListener('mousemove', (e) => { if (wrapper && wrapper.contains(e.target)) showExitBtn(); }, { capture: true });
document.addEventListener('fullscreenchange', handleFullscreenState);
document.addEventListener('webkitfullscreenchange', handleFullscreenState);

function handleFullscreenState() {
    const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
    if (!isFullscreen) {
        document.body.classList.remove("is-in-fullscreen", "has-fullscreen");
        if (fsBtn) fsBtn.innerText = "進入全螢幕";
        const drawer = document.getElementById('emoji-drawer');
        if (drawer) drawer.style.display = 'none';
    }
}

//----------------------------------------------------------------
// 自動執行：載入字幕
if (typeof MY_SRT_FILE !== 'undefined' && MY_SRT_FILE) {
    fetch(MY_SRT_FILE)
        .then(res => {
            if (!res.ok) throw new Error("字幕檔案不存在");
            return res.text();
        })
        .then(text => {
            subtitles = parseSRT(text);
            if (subtitleEl) subtitleEl.innerText = "";
        })
        .catch(err => {
            console.error(err);
            if (subtitleEl) subtitleEl.innerText = "字幕載入失敗";
        });
}
