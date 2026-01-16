// firebase-helper.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, runTransaction, set, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

let db;

// 初始化 Firebase (由 index.html 傳入 config)
export function initFirebase(config) {
    const app = initializeApp(config);
    db = getDatabase(app);
    return db;
}

// 表情牆累積點讚邏輯
export function setupReactionWall(videoId, reactionTypes) {
    reactionTypes.forEach(type => {
        const countRef = ref(db, `video_reactions/${videoId}/${type}`);
        onValue(countRef, (snapshot) => {
            const data = snapshot.val() || 0;
            const countEl = document.getElementById('count-' + type);
            if (countEl) countEl.innerText = data;
        });

        if (localStorage.getItem(`reacted-${videoId}-${type}`) === 'true') {
            const btn = document.querySelector(`button[onclick="addReaction('${type}')"]`);
            if (btn) btn.classList.add('active');
        }
    });

    window.addReaction = function(type) {
        const btn = event.currentTarget || event.target.closest('.emoji-btn'); 
        const storageKey = `reacted-${videoId}-${type}`;
        const isReacted = localStorage.getItem(storageKey) === 'true';
        const countRef = ref(db, `video_reactions/${videoId}/${type}`);

        runTransaction(countRef, (currentCount) => {
            let val = (currentCount === null) ? 0 : currentCount;
            return isReacted ? Math.max(0, val - 1) : val + 1;
        }).then(() => {
            if (isReacted) {
                localStorage.removeItem(storageKey);
                btn.classList.remove('active');
            } else {
                localStorage.setItem(storageKey, 'true');
                btn.classList.add('active');
            }
        });
    };
}
