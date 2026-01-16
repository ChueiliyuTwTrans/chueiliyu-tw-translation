<script>
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

/* ===== YouTube API ===== */
function onYouTubeIframeAPIReady() {
    player = new YT.Player("player", {
        videoId: MY_VIDEO_ID,
        playerVars: {
            start: 1,
            rel: 0,
            playsinline: 1,
            modestbranding: 1,
            fs: 0, 
            controls: 1
        },
        events: {
            onReady,
            onStateChange
        }
    });
}

function onReady(e) {
    // 1. 設定全螢幕權限
    const iframe = e.target.getIframe();
    iframe.setAttribute("allowfullscreen", "");

    // 2. 恢復播放進度
    const savedTime = localStorage.getItem("yt-played-time");
    if (savedTime !== null) {
        player.seekTo(parseFloat(savedTime), true);
    }

    // 3. 延遲 500 毫秒再恢復音量
    // 這樣可以避開 YouTube 剛載入時的 UI 混亂期，減少音量條跳到右上角的機率
    const savedVolume = localStorage.getItem("yt-volume");
    if (savedVolume !== null) {
        setTimeout(() => {
            if (player && player.setVolume) {
                player.setVolume(parseInt(savedVolume));
            }
        }, 500); 
    }
}

function onStateChange(e) {
    if (e.data === YT.PlayerState.PLAYING) {
        // 同步字幕
        if (!subtitleTimer) startSubtitleSync();
        // 開始自動儲存
        startAutoSave(); 
    } else {
        // 停止儲存（節省資源）
        stopAutoSave();
    }
}

/* ===== 進行廣告判定 (解決電腦版問題) ===== */
function startSubtitleSync() {
    subtitleTimer = setInterval(() => {
        if (!player || !player.getVideoData) return;

        const videoData = player.getVideoData();
        const currentVideoId = videoData.video_id;
        
        // 電腦版關鍵：增加 author 判定，廣告通常作者會變
        const isAd = (currentVideoId !== MY_VIDEO_ID) || 
                     (player.getAdState && player.getAdState() !== -1) ||
                     (videoData.author === "YouTube" || videoData.author === "");

        if (isAd) {
            subtitleEl.innerHTML = ""; 
            return;
        }

        const t = player.getCurrentTime();
        const activeSubs = subtitles.filter(x => t >= x.start && t <= x.end);
        subtitleEl.innerHTML = activeSubs.length ? activeSubs.map(s => s.text).join("<br>") : "";
    }, 200);
}

/* 自動儲存進度：確保不存到廣告的時間 */
function startAutoSave() {
    if (saveTimer) clearInterval(saveTimer);
    saveTimer = setInterval(() => {
        if (player && player.getVideoData) {
            const currentVideoId = player.getVideoData().video_id;
            // 只有當前播放的是「正片」時，才儲存時間
            if (currentVideoId === MY_VIDEO_ID) {
                localStorage.setItem("yt-played-time", player.getCurrentTime());
                localStorage.setItem("yt-volume", player.getVolume());
            }
        }
    }, 5000);
}

function stopAutoSave() {
    clearInterval(saveTimer);
    saveTimer = null;
}

/* 清除進度 / 重新播放 */
function resetProgress() {
    localStorage.removeItem("yt-played-time");
    location.reload(); // 重新整理頁面
}

/* ===== 全螢幕統一管理邏輯 ===== */

// 顯示與隱藏返回按鈕的邏輯
function showExitBtn() {
    const isFS = document.fullscreenElement || document.webkitFullscreenElement;
    const isPseudo = wrapper.classList.contains("pseudo-fullscreen");

    if (isFS || isPseudo) {
        // 直接顯示，且透明度固定為 1 (因為 CSS 已經把 color 設為淡灰色了)
        exitFsBtn.style.setProperty('display', 'flex', 'important');
        exitFsBtn.style.opacity = "1";
    } else {
        exitFsBtn.style.opacity = "0";
        setTimeout(() => {
            if (exitFsBtn.style.opacity === "0") exitFsBtn.style.display = "none";
        }, 300);
    }
}

function toggleFullscreen() {
    const isFS = document.fullscreenElement || document.webkitFullscreenElement;
    const isPseudo = wrapper.classList.contains("pseudo-fullscreen");

    if (isFS || isPseudo) {
        // 退出
        if (isFS) {
            const exit = document.exitFullscreen || document.webkitExitFullscreen;
            if (exit) exit.call(document);
        }
        wrapper.classList.remove("pseudo-fullscreen");
        // 必須移除這兩個 Class，否則退出後按鈕依然會被 display:none 隱藏
        document.body.classList.remove("is-in-fullscreen"); 
        document.body.classList.remove("has-fullscreen"); // 移除鎖定
        
        fsBtn.innerText = "進入全螢幕";
        showExitBtn();
    } else {
        // --- 進入全螢幕 ---
        const isIPhone = /iPhone|iPod/.test(navigator.userAgent);
        const req = wrapper.requestFullscreen || wrapper.webkitRequestFullscreen;

        if (req && !isIPhone) {
            req.call(wrapper).catch(() => wrapper.classList.add("pseudo-fullscreen"));
        } else {
            wrapper.classList.add("pseudo-fullscreen");
        }
        
        // 加上 Class，CSS 會自動隱藏標題、按鈕和表情牆
        document.body.classList.add("is-in-fullscreen"); 
        fsBtn.innerText = "退出全螢幕";
        window.scrollTo(0, 0); 

        setTimeout(showExitBtn, 300);
        
        let retryCount = 0;
        const retryShow = setInterval(() => {
            showExitBtn();
            retryCount++;
            if (retryCount > 10) clearInterval(retryShow);
        }, 200);
    }
}

/* --- 事件監聽註冊 (最終整合版) --- */

// 1. 旋轉偵測：確保轉向後按鈕還在
window.addEventListener("orientationchange", () => {
    setTimeout(showExitBtn, 500);
});

// 2. 點擊偵測：防止 YouTube 攔截導致的邏輯失效 (Capture 模式)
document.addEventListener('touchstart', (e) => {
    if (wrapper.contains(e.target)) showExitBtn();
}, { passive: true, capture: true });

document.addEventListener('mousemove', (e) => {
    if (wrapper.contains(e.target)) showExitBtn();
}, { capture: true });

// 3. 按鈕事件綁定
fsBtn.onclick = toggleFullscreen;
exitFsBtn.onclick = (e) => {
    e.stopPropagation();
    toggleFullscreen();
};

// 監聽系統全螢幕變化（修正按下 Esc 鍵後的問題 + 強制關閉即時表情抽屜）
document.addEventListener('fullscreenchange', handleFullscreenState);
document.addEventListener('webkitfullscreenchange', handleFullscreenState);

function handleFullscreenState() {
    const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
    
    // 如果「退出」了全螢幕
    if (!isFullscreen) {
        // 1. 處理 UI 狀態回歸（原本 handleExit 的內容）
        if (typeof wrapper !== 'undefined' && !wrapper.classList.contains("pseudo-fullscreen")) {
            document.body.classList.remove("is-in-fullscreen", "has-fullscreen");
            if (typeof fsBtn !== 'undefined') fsBtn.innerText = "進入全螢幕";
            // 如果你有 showExitBtn() 也可以在這裡呼叫
        }

        // 2. 強制關閉即時表情抽屜（原本 handleFullscreenChange 的內容）
        const drawer = document.getElementById('emoji-drawer');
        if (drawer) {
            drawer.style.display = 'none';
        }
    }
}
</script>
