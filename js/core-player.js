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
    if (typeof MY_VIDEO_ID === 'undefined') return;
    player = new YT.Player("player", {
        videoId: MY_VIDEO_ID,
        playerVars: {
            start: 1, rel: 0, playsinline: 1, modestbranding: 1, fs: 0, controls: 1
        },
        events: { onReady, onStateChange }
    });
}

function onReady(e) {
    const iframe = e.target.getIframe();
    iframe.setAttribute("allowfullscreen", "");
    
    const savedTime = localStorage.getItem("yt-played-time");
    if (savedTime !== null) player.seekTo(parseFloat(savedTime), true);

    const savedVolume = localStorage.getItem("yt-volume");
    if (savedVolume !== null) {
        setTimeout(() => { if (player && player.setVolume) player.setVolume(parseInt(savedVolume)); }, 500);
    }
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
        exitFsBtn.style.opacity = "1";
    } else {
        exitFsBtn.style.opacity = "0";
        setTimeout(() => { if (exitFsBtn.style.opacity === "0") exitFsBtn.style.display = "none"; }, 300);
    }
}

function toggleFullscreen() {
    const isFS = document.fullscreenElement || document.webkitFullscreenElement;
    const isPseudo = wrapper.classList.contains("pseudo-fullscreen");
    if (isFS || isPseudo) {
        if (isFS) {
            const exit = document.exitFullscreen || document.webkitExitFullscreen;
            if (exit) exit.call(document);
        }
        wrapper.classList.remove("pseudo-fullscreen");
        document.body.classList.remove("is-in-fullscreen", "has-fullscreen");
        fsBtn.innerText = "進入全螢幕";
        showExitBtn();
    } else {
        const isIPhone = /iPhone|iPod/.test(navigator.userAgent);
        const req = wrapper.requestFullscreen || wrapper.webkitRequestFullscreen;
        if (req && !isIPhone) {
            req.call(wrapper).catch(() => wrapper.classList.add("pseudo-fullscreen"));
        } else {
            wrapper.classList.add("pseudo-fullscreen");
        }
        document.body.classList.add("is-in-fullscreen");
        fsBtn.innerText = "退出全螢幕";
        window.scrollTo(0, 0);
        setTimeout(showExitBtn, 300);
    }
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

//-------------------------------------------------------------------------------
// --- 自動生成 6 個表情按鈕 ---
const EMOJI_DATA = [
    { icon: "❤️", label: "喜歡" },
    { icon: "🤣", label: "笑死" },
    { icon: "😮", label: "驚訝" },
    { icon: "🔥", label: "太帥" },
    { icon: "😭", label: "感人" },
    { icon: "👍", label: "強大" }
];

function initReactionButtons() {
    const wall = document.querySelector('.reaction-wall');
    const drawer = document.getElementById('emoji-drawer');
    
    if (!wall) return; // 如果頁面沒這個盒子就不執行

    // 生成按鈕的 HTML
    const buttonsHTML = EMOJI_DATA.map(item => `
        <button class="emoji-btn" onclick="sendEmoji('${item.icon}')">
            ${item.icon} <span class="count">0</span>
        </button>
    `).join('');

    // 塞進一般模式的牆
    wall.innerHTML = buttonsHTML;

    // 如果全螢幕抽屜存在，也塞進去
    if (drawer) {
        drawer.innerHTML = buttonsHTML;
    }
}

// 確保網頁載入完後執行一次
window.addEventListener('DOMContentLoaded', initReactionButtons);
