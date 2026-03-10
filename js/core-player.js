// core-player.js

// --- 全域變數 (所有影片共用) ---
let player;
let subtitles = [];
let subtitleTimer = null;
let saveTimer = null;
let subtitleScale = parseFloat(localStorage.getItem("subtitle-scale")) || 1;

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

function coreChangeSubtitleSize(delta) {
    subtitleScale = Math.min(2, Math.max(0.6, subtitleScale + delta));
    localStorage.setItem("subtitle-scale", subtitleScale);
    if (subtitleEl) subtitleEl.style.setProperty("--subtitle-scale", subtitleScale);
}

// --- 核心功能：YouTube API 邏輯 ---
function onYouTubeIframeAPIReady() {
    // 如果因為載入太快沒抓到 ID，就等 100 毫秒再試一次
    if (typeof MY_VIDEO_ID === 'undefined' || !MY_VIDEO_ID) {
        setTimeout(onYouTubeIframeAPIReady, 100);
        return;
    }
    // 檢查是否有設定 MY_VIDEO_START，如果沒有則預設從 1 秒開始
    const startTime = typeof MY_VIDEO_START !== 'undefined' ? MY_VIDEO_START : 1;
    player = new YT.Player("player", {
        videoId: MY_VIDEO_ID,
        playerVars: {
            start: startTime, rel: 0, playsinline: 1, modestbranding: 1, fs: 0, controls: 1
        },
        events: { onReady, onStateChange }
    });

    window.player = player; // 將 player 明確掛載到 window，讓 reaction-core.js 讀得到
}

function onReady(e) {
    const iframe = e.target.getIframe();
    iframe.setAttribute("allowfullscreen", "");
    
    // 解決 Focus 問題：YouTube 需要播放器成為焦點才能運作
    iframe.contentWindow.focus();

    // 增加一個「互動解鎖」的監聽器
    const unlockAndResume = () => {
        // 使用者點擊任何地方時，才去恢復上次的紀錄
        const savedTime = localStorage.getItem("yt-played-time");
        const savedVolume = localStorage.getItem("yt-volume");

        if (savedTime !== null) {
            player.seekTo(parseFloat(savedTime), true);
        }
        if (savedVolume !== null) {
            player.setVolume(parseInt(savedVolume));
        }
        
        // 強制對播放器進行一次「主動連線」
        player.playVideo();
        setTimeout(() => player.pauseVideo(), 50); // 瞬間播放再暫停，誘發瀏覽器建立有效連線
        
        // 恢復完後，移除監聽，避免一直觸發
        document.removeEventListener('click', unlockAndResume);
        document.removeEventListener('touchstart', unlockAndResume);
    };

    // 只要使用者有任何點擊動作，就自動恢復進度
    document.addEventListener('click', unlockAndResume);
    document.addEventListener('touchstart', unlockAndResume);
}

function onStateChange(e) {
    if (e.data === YT.PlayerState.PLAYING) {
        if (!subtitleTimer) startSubtitleSync();
        startAutoSave();
    } else {
        stopAutoSave();
    }
}

function startSubtitleSync() {
    subtitleTimer = setInterval(() => {
        if (!player || !player.getVideoData) return;
        const videoData = player.getVideoData();
        const isAd = (videoData.video_id !== MY_VIDEO_ID) || 
                     (player.getAdState && player.getAdState() !== -1) ||
                     (videoData.author === "YouTube" || videoData.author === "");

        if (isAd) { subtitleEl.innerHTML = ""; return; }

        const t = player.getCurrentTime();
        const activeSubs = subtitles.filter(x => t >= x.start && t <= x.end);
        subtitleEl.innerHTML = activeSubs.length ? activeSubs.map(s => s.text).join("<br>") : "";
    }, 200);
}

function startAutoSave() {
    if (saveTimer) clearInterval(saveTimer);
    saveTimer = setInterval(() => {
        if (player && player.getVideoData && player.getVideoData().video_id === MY_VIDEO_ID) {
            localStorage.setItem("yt-played-time", player.getCurrentTime());
            localStorage.setItem("yt-volume", player.getVolume());
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
