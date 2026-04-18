/* =============================================
   app.js - Software English v4
   ============================================= */

const TODAY = new Date().toISOString().slice(0, 10);

// ── Settings ──
function getMaxNew() { return parseInt(localStorage.getItem('se_maxNew') || '10'); }
function setMaxNew(n) { localStorage.setItem('se_maxNew', String(n)); }

// ── View Routing ──
let currentView = 'home';

function switchView(name) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('view-' + name).classList.add('active');
    currentView = name;
    updateBottomBar();
    window.scrollTo(0, 0);
}

function updateBottomBar() {
    const bar = document.getElementById('bottombar');
    if (currentView === 'home') {
        bar.classList.add('hidden');
    } else {
        bar.classList.remove('hidden');
    }
}

function goHome() {
    if (currentView !== 'home') switchView('home');
    renderHome();
}

// ── Theme ──
function initTheme() {
    const saved = localStorage.getItem('se_theme') || 'dark';
    applyTheme(saved);
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('se_theme', theme);
    const icon = document.getElementById('theme-icon');
    if (icon) {
        icon.innerHTML = theme === 'dark'
            ? '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>'
            : '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
    }
    // Update theme-color meta
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'dark' ? '#0D0D14' : '#F0F1F5';
}

function toggleTheme() {
    const current = localStorage.getItem('se_theme') || 'dark';
    applyTheme(current === 'dark' ? 'light' : 'dark');
}

// ── XSS Escape ──
function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── Storage helpers ──
function S(key) { return localStorage.getItem('se_' + key); }
function SG(key) { try { const v = S(key); return v ? JSON.parse(v) : null; } catch(e) { return null; } }
function SS(key, val) { localStorage.setItem('se_' + key, JSON.stringify(val)); }

function getDaily() { return SG('daily') || {}; }
function getTodayRec() {
    const d = getDaily();
    return d[TODAY] || { done: false, learned: 0, correct: 0, wrong: 0 };
}
function setTodayRec(rec) {
    const d = getDaily();
    d[TODAY] = rec;
    SS('daily', d);
}
function getTotalLearned() {
    const d = getDaily();
    let t = 0;
    for (const k in d) t += (d[k].learned || 0);
    return t;
}

// ── SM-2 Review ──
function getReviewData() { return SG('review') || {}; }
function markCorrect(en) {
    const d = getReviewData();
    const now = Date.now();
    if (!d[en]) {
        d[en] = { reps: 1, ease: 2.5, interval: 1, nextReview: now + 86400000 };
    } else {
        const r = d[en];
        r.reps++;
        if (r.reps === 1) r.interval = 1;
        else if (r.reps === 2) r.interval = 3;
        else r.interval = Math.max(1, Math.round(r.interval * r.ease));
        r.nextReview = now + r.interval * 86400000;
    }
    SS('review', d);
    // Auto-remove from error book on correct
    const eb = getErrorBook();
    const idx = eb.indexOf(en);
    if (idx > -1) { eb.splice(idx, 1); SS('errorBook', eb); }
}
function markWrong(en) {
    const d = getReviewData();
    // Set next review to 10 minutes from now instead of immediately
    d[en] = { reps: 0, ease: 2.5, interval: 0, nextReview: Date.now() + 600000 };
    SS('review', d);
}

// ── Word Bank ──
function getBank() { return SG('wordbank') || []; }
function toggleBank(en) {
    const b = getBank();
    const i = b.indexOf(en);
    if (i > -1) b.splice(i, 1); else b.push(en);
    SS('wordbank', b);
    return b;
}
function inBank(en) { return getBank().indexOf(en) > -1; }

// ── Custom Words ──
function getCustomWords() {
    return (SG('customWords') || []).map(w => ({ ...w, category: 'custom', tags: w.tags || ['custom'] }));
}
function addCustomWord(word) {
    const words = getCustomWords();
    if (words.find(w => w.en.toLowerCase() === word.en.toLowerCase())) return { success: false, error: '单词已存在' };
    if (!word.en || !word.zh) return { success: false, error: '英文和中文不能为空' };
    words.push({ en: word.en.trim(), zh: word.zh.trim(), phon: word.phon || '', category: 'custom', example: word.example || '', tags: ['custom'] });
    SS('customWords', words);
    return { success: true };
}
function removeCustomWord(en) {
    const words = getCustomWords();
    const idx = words.findIndex(w => w.en.toLowerCase() === en.toLowerCase());
    if (idx > -1) { words.splice(idx, 1); SS('customWords', words); }
}

// ── Error Book ──
function getErrorBook() { return SG('errorBook') || []; }
function addError(en) {
    const b = getErrorBook();
    if (!b.includes(en)) { b.push(en); SS('errorBook', b); }
}

// ── Streak ──
function getStreak() {
    const d = getDaily();
    let streak = 0;
    const dt = new Date();
    // Check if today is done
    const todayRec = d[TODAY];
    if (todayRec && todayRec.done) streak++;
    // Go backwards
    for (let i = 1; i < 365; i++) {
        dt.setDate(dt.getDate() - 1);
        const ds = dt.toISOString().slice(0, 10);
        const rec = d[ds];
        if (rec && rec.done) streak++;
        else break;
    }
    return streak;
}

// ── Word Data ──
let WORDS = [];
let CATEGORIES = [];

async function loadWords() {
    try {
        const r = await fetch('words.json?t=' + Date.now());
        const data = await r.json();
        const freshWords = Array.isArray(data) ? data : (data.words || []);
        CATEGORIES = data.categories || [];
        const cached = localStorage.getItem('se_words_cache');
        const cachedVersion = localStorage.getItem('se_words_version');
        let baseWords;
        if (cached && cachedVersion === data.version) {
            try { baseWords = JSON.parse(cached); } catch(e) { baseWords = freshWords; }
        } else {
            baseWords = freshWords;
            localStorage.setItem('se_words_cache', JSON.stringify(baseWords));
            localStorage.setItem('se_words_version', data.version || '');
        }
        const customWords = getCustomWords();
        const customEnSet = new Set(customWords.map(w => w.en.toLowerCase()));
        WORDS = [...customWords, ...baseWords.filter(w => !customEnSet.has(w.en.toLowerCase()))];
    } catch(e) {
        const cached = localStorage.getItem('se_words_cache');
        let baseWords = [];
        if (cached) { try { baseWords = JSON.parse(cached); } catch(e) {} }
        const customWords = getCustomWords();
        const customEnSet = new Set(customWords.map(w => w.en.toLowerCase()));
        WORDS = [...customWords, ...baseWords.filter(w => !customEnSet.has(w.en.toLowerCase()))];
    }
    // Deduce categories from words if not in metadata
    if (!CATEGORIES.length) {
        const catSet = new Set();
        WORDS.forEach(w => { if (w.category) catSet.add(w.category); });
        CATEGORIES = [...catSet];
    }
}

function findWord(en) { return WORDS.find(w => w.en === en) || null; }
function getUnlearnedWords() {
    const rd = getReviewData();
    return WORDS.filter(w => !rd[w.en]);
}
function getReviewPool() {
    const rd = getReviewData();
    const bank = getBank();
    const now = Date.now();
    const pool = [];
    for (const en in rd) {
        const r = rd[en];
        if (r.reps > 0 && r.nextReview <= now) {
            pool.push(en);
        } else if (r.reps === 0 && r.nextReview <= now) {
            pool.push(en);
        }
    }
    bank.forEach(en => { if (!pool.includes(en)) pool.push(en); });
    return pool.map(findWord).filter(Boolean);
}

// ── TTS ──
function speak(text) {
    if (!text) return;
    const audio = new Audio('https://dict.youdao.com/dictvoice?type=1&word=' + encodeURIComponent(text));
    audio.play().catch(() => {
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
            const utt = new SpeechSynthesisUtterance(text);
            utt.lang = 'en-US'; utt.rate = 0.88;
            window.speechSynthesis.speak(utt);
        }
    });
}

// ── Calendar ──
let calY, calM;
function renderCalendar(container) {
    const now = new Date();
    if (!calY) { calY = now.getFullYear(); calM = now.getMonth(); }
    const months = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
    const weekdays = ['一','二','三','四','五','六','日'];
    container.innerHTML = `
        <div class="cal-nav">
            <button class="cal-nav-btn" onclick="calNav(-1)">◀</button>
            <span class="cal-month">${calY}年 ${months[calM]}</span>
            <button class="cal-nav-btn" onclick="calNav(1)">▶</button>
        </div>
        <div class="cal-grid">
            ${weekdays.map(d => `<div class="cal-wday">${d}</div>`).join('')}
            ${buildCalGrid()}
        </div>
    `;
}

function buildCalGrid() {
    const firstDay = new Date(calY, calM, 1).getDay();
    const daysIn = new Date(calY, calM + 1, 0).getDate();
    const daily = getDaily();
    let html = '';
    const offset = firstDay === 0 ? 6 : firstDay - 1;
    for (let i = 0; i < offset; i++) html += '<div class="cal-cell cal-empty"></div>';
    for (let d = 1; d <= daysIn; d++) {
        const ds = calY + '-' + String(calM + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
        const isToday = ds === TODAY;
        const isFuture = ds > TODAY;
        const rec = daily[ds];
        let cls = 'cal-cell';
        if (isToday) cls += ' cal-today';
        else if (isFuture) cls += ' cal-future';
        else if (rec && rec.done) cls += ' cal-done-full';
        else if (rec && rec.learned > 0) cls += ' cal-learned';
        html += `<div class="${cls}">${d}</div>`;
    }
    return html;
}

function calNav(dir) {
    calM += dir;
    if (calM > 11) { calM = 0; calY++; }
    if (calM < 0) { calM = 11; calY--; }
    renderCalendar(document.getElementById('cal-inner'));
}

// ── Home View ──
function renderHome() {
    const rec = getTodayRec();
    const pool = getReviewPool();
    const bank = getBank();
    const errCount = getErrorBook().length;
    const total = getTotalLearned();
    const maxNew = getMaxNew();
    const left = Math.max(0, maxNew - rec.learned);

    document.getElementById('view-home').innerHTML = `
        <div class="cal-card" id="cal-inner"></div>
        <div class="entry-grid">
            <div class="entry-btn learn" onclick="startLearn()">
                <span class="entry-btn-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                    </svg>
                </span>
                <span class="entry-btn-label">学习</span>
                <span class="entry-btn-sub">${rec.done ? '✅ 已完成' : '剩余 ' + left + ' 词'}</span>
            </div>
            <div class="entry-btn review" onclick="startReview()" ${pool.length === 0 ? 'style="opacity:0.4;pointer-events:none"' : ''}>
                <span class="entry-btn-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="23 4 23 10 17 10"/>
                        <polyline points="1 20 1 14 7 14"/>
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                    </svg>
                </span>
                <span class="entry-btn-label">复习</span>
                <span class="entry-btn-sub">${pool.length === 0 ? '无待复习' : pool.length + ' 词待复'}</span>
            </div>
        </div>
        <div class="entry-grid" style="grid-template-columns: 1fr 1fr 1fr;">
            <div class="entry-btn" onclick="startSpell()" style="padding:12px 8px">
                <span class="entry-btn-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                        <path d="m15 5 4 4"/>
                    </svg>
                </span>
                <span class="entry-btn-label" style="font-size:14px">拼写</span>
                <span class="entry-btn-sub">主动回忆</span>
            </div>
            <div class="entry-btn" onclick="openBank()" style="padding:12px 8px">
                <span class="entry-btn-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/>
                        <line x1="16" y1="17" x2="8" y2="17"/>
                        <polyline points="10 9 9 9 8 9"/>
                    </svg>
                </span>
                <span class="entry-btn-label" style="font-size:14px">生词本</span>
                <span class="entry-btn-sub">${bank.length} 词</span>
            </div>
            <div class="entry-btn" onclick="openErrors()" style="padding:12px 8px">
                <span class="entry-btn-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                </span>
                <span class="entry-btn-label" style="font-size:14px">错题本</span>
                <span class="entry-btn-sub">${errCount} 词</span>
            </div>
        </div>
    `;
    renderCalendar(document.getElementById('cal-inner'));
}

function updateBottomProgress(current, total, label) {
    const fill = document.getElementById('bp-fill');
    const text = document.getElementById('bp-text');
    const labelEl = document.getElementById('bp-label');
    const pct = total > 0 ? Math.round(current / total * 100) : 0;
    fill.style.width = Math.min(100, pct) + '%';
    text.textContent = current + '/' + total;
    labelEl.textContent = label + ' · ' + pct + '%';
}

// ── Learn (Single card with flip) ──
let learnQueue = [], learnIdx = 0, learnTodayCount = 0, learnCorrect = 0, learnWrong = 0;

function startLearn() {
    const unlearned = getUnlearnedWords();
    const rec = getTodayRec();
    const maxNew = getMaxNew();
    const left = maxNew - rec.learned;
    if (!unlearned.length && left <= 0) { switchView('home'); return; }

    let toLearn = left > 0 ? left : maxNew;

    // Prioritize custom words
    const customWords = unlearned.filter(w => w.category === 'custom');
    const regularWords = unlearned.filter(w => w.category !== 'custom');
    const customCount = Math.min(customWords.length, toLearn);
    const regularCount = toLearn - customCount;

    learnQueue = [
        ...customWords.slice().sort(() => Math.random() - 0.5).slice(0, customCount),
        ...regularWords.slice().sort(() => Math.random() - 0.5).slice(0, regularCount)
    ];
    if (learnQueue.length === 0) {
        learnQueue = [...unlearned.slice().sort(() => Math.random() - 0.5).slice(0, maxNew)];
    }

    learnIdx = 0;
    learnTodayCount = rec.learned;
    learnCorrect = 0;
    learnWrong = 0;
    switchView('learn');
    renderLearnCard();
}

function renderLearnCard() {
    const area = document.getElementById('view-learn');
    if (learnIdx >= learnQueue.length) {
        // Update daily record
        const rec = getTodayRec();
        rec.learned = learnTodayCount;
        rec.correct = (rec.correct || 0) + learnCorrect;
        rec.wrong = (rec.wrong || 0) + learnWrong;
        rec.done = learnTodayCount >= getMaxNew();
        setTodayRec(rec);

        const streak = getStreak();
        area.innerHTML = `
            <div class="complete-card">
                <div class="complete-icon">🎉</div>
                <div class="complete-title">今日学习完成</div>
                <div class="complete-sub">学了 ${learnTodayCount} 个新词</div>
                <div class="complete-stats">
                    <div><div class="complete-stat-n text-success">${learnCorrect}</div><div class="complete-stat-l">记住了</div></div>
                    <div><div class="complete-stat-n text-danger">${learnWrong}</div><div class="complete-stat-l">不认识</div></div>
                </div>
                ${streak > 1 ? `<div class="complete-streak">🔥 连续学习 ${streak} 天</div>` : ''}
                <button class="complete-home-btn" onclick="goHome()">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                    返回首页
                </button>
            </div>`;
        return;
    }

    const w = learnQueue[learnIdx];
    const total = learnQueue.length;
    updateBottomProgress(learnIdx + 1, total, '学习');

    area.innerHTML = `
        <div style="font-size:13px;color:var(--text-muted);text-align:center;margin-bottom:10px;font-weight:600">
            ${learnIdx + 1} / ${total}
        </div>
        <div class="pair-card" id="learn-card" onclick="flipLearnCard()">
            <div class="pair-top">
                <span class="pair-cat">${esc(w.category || '')}</span>
                <div class="pair-btn-row" style="margin:0">
                    <button class="pair-btn${inBank(w.en) ? ' starred' : ''}" onclick="event.stopPropagation();toggleBank('${esc(w.en)}');renderLearnCard()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg></button>
                    <button class="pair-btn play-btn" onclick="event.stopPropagation();speak('${esc(w.en)}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3v18l14-9z"></path></svg></button>
                </div>
            </div>
            <div class="pair-word">${esc(w.en)}</div>
            <div class="pair-phon">${esc(w.phon || '')}</div>
            <div class="pair-zh hidden-zh" id="learn-zh">${esc(w.zh)}</div>
            <div class="pair-zh-placeholder" id="learn-hint">👆 点击卡片查看释义</div>
            <div id="learn-example" style="display:none">${w.example ? `<div class="pair-example"><span style="color:var(--text-dim)">${esc(w.example)}</span><br><span style="color:var(--primary)">${esc(w.example_zh || '')}</span></div>` : ''}</div>
        </div>
        <div class="rating-row" id="learn-rating" style="opacity:0.3;pointer-events:none">
            <button class="rate-btn wrong" onclick="rateLearn(false)">😕 不认识</button>
            <button class="rate-btn right" onclick="rateLearn(true)">😊 记住了</button>
        </div>
    `;
}

function flipLearnCard() {
    const zh = document.getElementById('learn-zh');
    const hint = document.getElementById('learn-hint');
    const example = document.getElementById('learn-example');
    const card = document.getElementById('learn-card');
    const rating = document.getElementById('learn-rating');

    if (zh.classList.contains('hidden-zh')) {
        zh.classList.remove('hidden-zh');
        if (hint) hint.style.display = 'none';
        if (example) example.style.display = 'block';
        card.classList.add('revealed');
        rating.style.opacity = '1';
        rating.style.pointerEvents = 'auto';
    }
}

function rateLearn(correct) {
    const w = learnQueue[learnIdx];
    if (!w) return;
    const card = document.getElementById('learn-card');

    if (correct) {
        markCorrect(w.en);
        learnCorrect++;
        card.classList.add('flash-green');
    } else {
        markWrong(w.en);
        addError(w.en);
        learnWrong++;
        card.classList.add('flash-red');
    }

    learnTodayCount++;
    learnIdx++;

    setTimeout(() => renderLearnCard(), 350);
}

// ── Review (Single card with flip) ──
let reviewQueue = [], reviewIdx = 0, reviewCorrect = 0, reviewWrong = 0;

function startReview() {
    const pool = getReviewPool();
    if (!pool.length) { switchView('home'); return; }
    reviewQueue = pool.sort(() => Math.random() - 0.5);
    reviewIdx = 0;
    reviewCorrect = 0;
    reviewWrong = 0;
    switchView('review');
    renderReviewCard();
}

function renderReviewCard() {
    const area = document.getElementById('view-review');
    if (reviewIdx >= reviewQueue.length) {
        area.innerHTML = `
            <div class="complete-card">
                <div class="complete-icon">✅</div>
                <div class="complete-title">本轮复习完毕</div>
                <div class="complete-sub">共复习 ${reviewQueue.length} 词</div>
                <div class="complete-stats">
                    <div><div class="complete-stat-n text-success">${reviewCorrect}</div><div class="complete-stat-l">记住了</div></div>
                    <div><div class="complete-stat-n text-danger">${reviewWrong}</div><div class="complete-stat-l">不认识</div></div>
                </div>
                <button class="complete-home-btn" onclick="goHome()">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                    返回首页
                </button>
            </div>`;
        return;
    }

    const w = reviewQueue[reviewIdx];
    const total = reviewQueue.length;
    updateBottomProgress(reviewIdx + 1, total, '复习');

    area.innerHTML = `
        <div style="font-size:13px;color:var(--text-muted);text-align:center;margin-bottom:10px;font-weight:600">
            ${reviewIdx + 1} / ${total}
        </div>
        <div class="pair-card" id="review-card" onclick="flipReviewCard()">
            <div class="pair-top">
                <span class="pair-cat">${esc(w.category || '')}</span>
                <div class="pair-btn-row" style="margin:0">
                    <button class="pair-btn${inBank(w.en) ? ' starred' : ''}" onclick="event.stopPropagation();toggleBank('${esc(w.en)}');renderReviewCard()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg></button>
                    <button class="pair-btn play-btn" onclick="event.stopPropagation();speak('${esc(w.en)}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3v18l14-9z"></path></svg></button>
                </div>
            </div>
            <div class="pair-word">${esc(w.en)}</div>
            <div class="pair-phon">${esc(w.phon || '')}</div>
            <div class="pair-zh hidden-zh" id="review-zh">${esc(w.zh)}</div>
            <div class="pair-zh-placeholder" id="review-hint">👆 点击卡片查看释义</div>
            <div id="review-example" style="display:none">${w.example ? `<div class="pair-example"><span style="color:var(--text-dim)">${esc(w.example)}</span><br><span style="color:var(--primary)">${esc(w.example_zh || '')}</span></div>` : ''}</div>
        </div>
        <div class="rating-row" id="review-rating" style="opacity:0.3;pointer-events:none">
            <button class="rate-btn wrong" onclick="rateReview(false)">😕 不认识</button>
            <button class="rate-btn right" onclick="rateReview(true)">😊 记住了</button>
        </div>
    `;
}

function flipReviewCard() {
    const zh = document.getElementById('review-zh');
    const hint = document.getElementById('review-hint');
    const example = document.getElementById('review-example');
    const card = document.getElementById('review-card');
    const rating = document.getElementById('review-rating');

    if (zh.classList.contains('hidden-zh')) {
        zh.classList.remove('hidden-zh');
        if (hint) hint.style.display = 'none';
        if (example) example.style.display = 'block';
        card.classList.add('revealed');
        rating.style.opacity = '1';
        rating.style.pointerEvents = 'auto';
    }
}

function rateReview(correct) {
    const w = reviewQueue[reviewIdx];
    if (!w) return;
    const card = document.getElementById('review-card');

    if (correct) {
        markCorrect(w.en);
        reviewCorrect++;
        card.classList.add('flash-green');
    } else {
        markWrong(w.en);
        addError(w.en);
        reviewWrong++;
        card.classList.add('flash-red');
    }

    reviewIdx++;
    setTimeout(() => renderReviewCard(), 350);
}

// ── Spelling Mode ──
let spellQueue = [], spellIdx = 0, spellCorrect = 0, spellHintUsed = false;

function startSpell() {
    // Use review pool + some unlearned words
    const pool = getReviewPool();
    const unlearned = getUnlearnedWords().slice(0, 5);
    const allPool = [...pool, ...unlearned].sort(() => Math.random() - 0.5).slice(0, 10);
    if (!allPool.length) {
        alert('没有可练习的单词，先学习一些新词吧');
        return;
    }
    spellQueue = allPool;
    spellIdx = 0;
    spellCorrect = 0;
    switchView('spell');
    renderSpellCard();
}

function renderSpellCard() {
    const area = document.getElementById('view-spell');
    if (spellIdx >= spellQueue.length) {
        area.innerHTML = `
            <div class="complete-card">
                <div class="complete-icon">✏️</div>
                <div class="complete-title">拼写练习完成</div>
                <div class="complete-sub">共 ${spellQueue.length} 词，正确 ${spellCorrect} 词</div>
                <div class="complete-stats">
                    <div><div class="complete-stat-n text-success">${spellCorrect}</div><div class="complete-stat-l">正确</div></div>
                    <div><div class="complete-stat-n text-danger">${spellQueue.length - spellCorrect}</div><div class="complete-stat-l">错误</div></div>
                </div>
                <button class="complete-home-btn" onclick="goHome()">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                    返回首页
                </button>
            </div>`;
        return;
    }

    const w = spellQueue[spellIdx];
    spellHintUsed = false;
    updateBottomProgress(spellIdx + 1, spellQueue.length, '拼写');

    area.innerHTML = `
        <div style="font-size:13px;color:var(--text-muted);text-align:center;margin-bottom:10px;font-weight:600">
            ${spellIdx + 1} / ${spellQueue.length}
        </div>
        <div class="pair-card" style="cursor:default">
            <div class="pair-top">
                <span class="pair-cat">${esc(w.category || '')}</span>
                <button class="pair-btn play-btn" onclick="speak('${esc(w.en)}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg></button>
            </div>
            <div class="pair-zh" style="font-size:20px;margin:12px 0">${esc(w.zh)}</div>
            ${w.phon ? `<div class="pair-phon">${esc(w.phon)}</div>` : ''}
        </div>
        <input type="text" class="spell-input" id="spell-input" placeholder="输入英文单词" autocomplete="off" autocapitalize="off" spellcheck="false">
        <div class="spell-hint" id="spell-feedback"></div>
        <div class="spell-actions">
            <button class="spell-btn-check" onclick="checkSpell()">确认</button>
            <button class="spell-btn-hint" onclick="showSpellHint()">💡 提示</button>
            <button class="spell-btn-skip" onclick="skipSpell()">跳过</button>
        </div>
    `;

    const input = document.getElementById('spell-input');
    input.focus();
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') checkSpell();
    });
}

function checkSpell() {
    const input = document.getElementById('spell-input');
    const feedback = document.getElementById('spell-feedback');
    const w = spellQueue[spellIdx];
    if (!input || !w) return;

    const answer = input.value.trim().toLowerCase();
    const correct = w.en.toLowerCase();

    if (!answer) { feedback.textContent = '请输入单词'; feedback.style.color = 'var(--text-muted)'; return; }

    if (answer === correct) {
        input.classList.add('correct');
        feedback.textContent = '✅ 正确！';
        feedback.style.color = 'var(--success)';
        markCorrect(w.en);
        spellCorrect++;
        setTimeout(() => { spellIdx++; renderSpellCard(); }, 800);
    } else {
        input.classList.add('wrong');
        feedback.textContent = '❌ 正确答案: ' + w.en;
        feedback.style.color = 'var(--danger)';
        markWrong(w.en);
        addError(w.en);
        setTimeout(() => { spellIdx++; renderSpellCard(); }, 1500);
    }
}

function showSpellHint() {
    const w = spellQueue[spellIdx];
    if (!w) return;
    const input = document.getElementById('spell-input');
    const feedback = document.getElementById('spell-feedback');
    const en = w.en;
    // Show first letter and length
    const hint = en[0] + '_'.repeat(en.length - 2) + en[en.length - 1];
    feedback.textContent = '💡 ' + hint + ' (' + en.length + ' 个字母)';
    feedback.style.color = 'var(--warning)';
    spellHintUsed = true;
}

function skipSpell() {
    const w = spellQueue[spellIdx];
    if (w) {
        const feedback = document.getElementById('spell-feedback');
        if (feedback) { feedback.textContent = '答案: ' + w.en; feedback.style.color = 'var(--text-muted)'; }
        markWrong(w.en);
        addError(w.en);
    }
    setTimeout(() => { spellIdx++; renderSpellCard(); }, 1000);
}

// ── Modals ──
function openModal(id) { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }

// Swipe down to close modals
function initModalSwipe() {
    document.querySelectorAll('.modal-sheet[data-modal]').forEach(sheet => {
        let startY = 0, currentY = 0, isDragging = false;
        sheet.addEventListener('touchstart', (e) => {
            if (sheet.scrollTop > 0) return; // Only when scrolled to top
            startY = e.touches[0].clientY;
            isDragging = true;
        }, { passive: true });
        sheet.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            currentY = e.touches[0].clientY;
            const diff = currentY - startY;
            if (diff > 0) {
                sheet.style.transform = `translateY(${diff}px)`;
                sheet.style.transition = 'none';
            }
        }, { passive: true });
        sheet.addEventListener('touchend', () => {
            if (!isDragging) return;
            isDragging = false;
            const diff = currentY - startY;
            sheet.style.transition = '';
            if (diff > 80) {
                // Close modal
                const overlay = sheet.closest('.modal-overlay');
                if (overlay) overlay.classList.remove('show');
            }
            sheet.style.transform = '';
        });
    });
}

// ── Bank Modal ──
function openBank() {
    const bank = getBank();
    const total = getTotalLearned();
    const bankWords = bank.map(en => findWord(en)).filter(Boolean);

    document.getElementById('bankBody').innerHTML = `
        <div class="bank-stat-row">
            <div class="bank-stat"><div class="bank-stat-n">${bank.length}</div><div class="bank-stat-l">生词</div></div>
            <div class="bank-stat"><div class="bank-stat-n">${getErrorBook().length}</div><div class="bank-stat-l">错题</div></div>
            <div class="bank-stat"><div class="bank-stat-n">${total}</div><div class="bank-stat-l">已学</div></div>
        </div>
        ${bankWords.length === 0
            ? '<div class="empty-state"><div class="empty-state-icon">⭐</div>生词本为空</div>'
            : bankWords.map(w => `
                <div class="modal-item">
                    <div>
                        <div class="modal-item-en">${esc(w.en)}</div>
                        <div class="modal-item-zh">${esc(w.zh)}</div>
                    </div>
                    <div class="modal-item-right">
                        <button class="play-btn" onclick="speak('${esc(w.en)}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg></button>
                        <button class="modal-item-rm" onclick="toggleBank('${esc(w.en)}');openBank()">×</button>
                    </div>
                </div>`).join('')
        }
    `;
    openModal('bankModal');
}

// ── Error Modal ──
function openErrors() {
    const errBook = getErrorBook();
    const errWords = errBook.map(en => findWord(en)).filter(Boolean);

    document.getElementById('errorBody').innerHTML = `
        <div class="bank-stat-row">
            <div class="bank-stat"><div class="bank-stat-n">${errWords.length}</div><div class="bank-stat-l">错题数</div></div>
        </div>
        ${errWords.length === 0
            ? '<div class="empty-state"><div class="empty-state-icon">🎉</div>错题本为空，继续保持</div>'
            : errWords.map(w => `
                <div class="modal-item">
                    <div>
                        <div class="modal-item-en">${esc(w.en)}</div>
                        <div class="modal-item-zh">${esc(w.zh)}</div>
                    </div>
                    <div class="modal-item-right">
                        <button class="play-btn" onclick="speak('${esc(w.en)}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg></button>
                        <button class="modal-item-rm" onclick="removeError('${esc(w.en)}')">×</button>
                    </div>
                </div>`).join('')
        }
    `;
    openModal('errorModal');
}

function removeError(en) {
    const b = getErrorBook();
    const i = b.indexOf(en);
    if (i > -1) { b.splice(i, 1); SS('errorBook', b); }
    openErrors();
}

// ── Dict Modal (with search + category filter) ──
let dictFilter = 'all';
let dictSearch = '';

function openDict() {
    dictFilter = 'all';
    dictSearch = '';
    renderDict();
    openModal('dictModal');
}

function renderDict() {
    const customWords = getCustomWords();
    let filtered = WORDS;

    // Category filter
    if (dictFilter !== 'all') {
        filtered = filtered.filter(w => w.category === dictFilter);
    }

    // Search filter
    if (dictSearch) {
        const q = dictSearch.toLowerCase();
        filtered = filtered.filter(w =>
            w.en.toLowerCase().includes(q) || w.zh.includes(q)
        );
    }

    const catLabels = { config: '配置', log: '日志', error: '错误', cli: '命令行', devops: '运维', dev: '开发', db: '数据库', git: 'Git', ai: 'AI', custom: '自定义' };

    document.getElementById('dictBody').innerHTML = `
        <div class="bank-stat-row">
            <div class="bank-stat"><div class="bank-stat-n">${WORDS.length}</div><div class="bank-stat-l">总词数</div></div>
            <div class="bank-stat"><div class="bank-stat-n">${customWords.length}</div><div class="bank-stat-l">自定义</div></div>
            <div class="bank-stat" style="cursor:pointer" onclick="toggleAddForm()">
                <div class="bank-stat-n" style="font-size:16px">+</div>
                <div class="bank-stat-l">添加</div>
            </div>
        </div>

        <div id="addForm" style="padding:12px;background:var(--bg);border-radius:var(--radius);margin-bottom:12px;display:none">
            <div style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--text-secondary)">添加自定义单词</div>
            <div style="display:grid;gap:8px">
                <input type="text" id="dict-input-en" placeholder="输入英文单词，回车查询" style="padding:8px;border:1px solid var(--border);border-radius:var(--radius);background:var(--card);font-size:14px;color:var(--text);outline:none">
                <div id="dict-preview" style="display:none;padding:10px;background:var(--card);border-radius:var(--radius)">
                    <div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:4px" id="preview-en"></div>
                    <div style="font-size:12px;color:var(--text-dim);margin-bottom:4px" id="preview-phon"></div>
                    <div style="font-size:13px;color:var(--primary)" id="preview-zh"></div>
                </div>
                <div style="display:flex;gap:8px">
                    <button id="btn-add-word" onclick="addDictWord()" style="flex:1;padding:10px;background:var(--primary);color:white;border:none;border-radius:var(--radius);font-size:14px;font-weight:600;cursor:pointer">添加</button>
                    <button onclick="toggleAddForm()" style="padding:10px;background:var(--bg);color:var(--text-dim);border:1px solid var(--border);border-radius:var(--radius);font-size:14px;cursor:pointer">取消</button>
                </div>
            </div>
        </div>

        <div class="search-box">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" class="search-input" placeholder="搜索单词..." value="${esc(dictSearch)}" oninput="dictSearch=this.value;renderDict()">
        </div>

        <div class="cat-tags">
            <div class="cat-tag ${dictFilter === 'all' ? 'active' : ''}" onclick="dictFilter='all';renderDict()">全部</div>
            ${CATEGORIES.map(c => `<div class="cat-tag ${dictFilter === c ? 'active' : ''}" onclick="dictFilter='${c}';renderDict()">${catLabels[c] || c}</div>`).join('')}
        </div>

        <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">${filtered.length} 个单词</div>

        ${filtered.length === 0
            ? '<div class="empty-state">未找到匹配的单词</div>'
            : filtered.map(w => {
                const isCustom = w.category === 'custom';
                return `<div class="modal-item">
                    <div>
                        <div class="modal-item-en">${esc(w.en)} ${isCustom ? '<span style="font-size:10px;color:var(--primary);margin-left:4px">自定义</span>' : ''}</div>
                        <div class="modal-item-zh">${esc(w.zh)}</div>
                    </div>
                    <div class="modal-item-right">
                        <button class="play-btn" onclick="speak('${esc(w.en)}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg></button>
                        ${isCustom ? `<button class="modal-item-rm" onclick="removeDictWord('${esc(w.en)}')">×</button>` : ''}
                    </div>
                </div>`;
            }).join('')
        }
    `;
}

function toggleAddForm() {
    const form = document.getElementById('addForm');
    if (!form) return;
    const isVisible = form.style.display !== 'none';
    form.style.display = isVisible ? 'none' : 'block';
    if (!isVisible) {
        setTimeout(() => {
            const input = document.getElementById('dict-input-en');
            if (input) {
                input.value = '';
                input.focus();
                input.removeEventListener('keypress', handleDictInput);
                input.addEventListener('keypress', handleDictInput);
            }
        }, 100);
    }
}

function handleDictInput(e) {
    if (e.key === 'Enter') {
        const en = document.getElementById('dict-input-en').value.trim();
        if (en) lookupWord(en);
    }
}

async function lookupWord(word) {
    const preview = document.getElementById('dict-preview');
    const previewEn = document.getElementById('preview-en');
    const previewPhon = document.getElementById('preview-phon');
    const previewZh = document.getElementById('preview-zh');
    const btn = document.getElementById('btn-add-word');

    previewEn.textContent = word;
    previewPhon.textContent = '查询中...';
    previewZh.textContent = '';
    preview.style.display = 'block';
    if (btn) btn.disabled = true;

    try {
        const response = await fetch(`https://dict.youdao.com/jsonapi?q=${encodeURIComponent(word)}&jsonp=1`);
        const data = await response.json();
        let phon = '', zh = '';
        if (data.simple && data.simple.word && data.simple.word[0]) {
            const w = data.simple.word[0];
            phon = w.usphone || w.ukphone || '';
        }
        if (data.ec && data.ec.word && data.ec.word[0] && data.ec.word[0].trs) {
            zh = data.ec.word[0].trs.map(t => t.tr[0].l.i).join('；');
        }
        previewPhon.textContent = phon || '';
        previewZh.textContent = zh || '未找到释义';
        if (btn) btn.disabled = false;
        window._dictLookupCache = { en: word, zh, phon };
    } catch (e) {
        previewPhon.textContent = '查询失败';
        previewZh.textContent = '';
        if (btn) btn.disabled = false;
    }
}

function addDictWord() {
    const en = document.getElementById('dict-input-en').value.trim();
    if (!en) { alert('请输入英文单词'); return; }
    let zh = '', phon = '';
    if (window._dictLookupCache && window._dictLookupCache.en === en) {
        zh = window._dictLookupCache.zh;
        phon = window._dictLookupCache.phon;
    } else {
        alert('请按回车先查询单词');
        return;
    }
    const result = addCustomWord({ en, zh, phon, example: '' });
    if (result.success) {
        window._dictLookupCache = null;
        loadWords().then(() => renderDict());
    } else {
        alert(result.error);
    }
}

function removeDictWord(en) {
    removeCustomWord(en);
    loadWords().then(() => renderDict());
}

// ── Stats Modal ──
function openStats() {
    const daily = getDaily();
    const total = getTotalLearned();
    const streak = getStreak();
    const rd = getReviewData();
    const mastered = Object.values(rd).filter(r => r.reps >= 3).length;
    const learning = Object.keys(rd).length;
    const errCount = getErrorBook().length;

    // Build heatmap (last 12 weeks = 84 days)
    const heatmap = [];
    const dt = new Date();
    for (let i = 83; i >= 0; i--) {
        const d = new Date(dt);
        d.setDate(d.getDate() - i);
        const ds = d.toISOString().slice(0, 10);
        const rec = daily[ds];
        let level = '';
        if (rec && rec.learned >= 10) level = 'l4';
        else if (rec && rec.learned >= 5) level = 'l3';
        else if (rec && rec.learned > 0) level = 'l2';
        else if (rec && rec.done) level = 'l1';
        heatmap.push(`<div class="heatmap-cell ${level}" title="${ds}: ${rec ? rec.learned : 0} 词"></div>`);
    }

    document.getElementById('statsBody').innerHTML = `
        <div class="stats-grid">
            <div class="stats-card"><div class="stats-card-n">${total}</div><div class="stats-card-l">总学习量</div></div>
            <div class="stats-card"><div class="stats-card-n">${streak}</div><div class="stats-card-l">连续打卡 (天)</div></div>
            <div class="stats-card"><div class="stats-card-n">${mastered}</div><div class="stats-card-l">已掌握</div></div>
            <div class="stats-card"><div class="stats-card-n">${learning}</div><div class="stats-card-l">学习中</div></div>
        </div>

        <div class="heatmap-container">
            <div class="heatmap-title">近 12 周学习热力图</div>
            <div class="heatmap-grid">${heatmap.join('')}</div>
            <div class="heatmap-legend">
                <span>少</span>
                <div class="heatmap-legend-cell" style="background:var(--border)"></div>
                <div class="heatmap-legend-cell l1"></div>
                <div class="heatmap-legend-cell l2"></div>
                <div class="heatmap-legend-cell l3"></div>
                <div class="heatmap-legend-cell l4"></div>
                <span>多</span>
            </div>
        </div>

        <div class="bank-stat-row">
            <div class="bank-stat"><div class="bank-stat-n">${WORDS.length}</div><div class="bank-stat-l">词库总量</div></div>
            <div class="bank-stat"><div class="bank-stat-n">${getBank().length}</div><div class="bank-stat-l">生词本</div></div>
            <div class="bank-stat"><div class="bank-stat-n">${errCount}</div><div class="bank-stat-l">错题本</div></div>
        </div>

        <div style="text-align:center;margin-top:12px">
            <button onclick="openSettings()" style="padding:10px 20px;background:var(--bg);color:var(--text-dim);border:1px solid var(--border);border-radius:var(--radius);font-size:14px;font-weight:600;cursor:pointer">⚙️ 设置</button>
        </div>
    `;
    openModal('statsModal');
}

// ── Settings Modal ──
function openSettings() {
    const maxNew = getMaxNew();
    const theme = localStorage.getItem('se_theme') || 'dark';

    document.getElementById('settingsBody').innerHTML = `
        <div class="settings-item">
            <div>
                <div class="settings-label">每日新词数量</div>
                <div class="settings-desc">每天学习的新单词上限</div>
            </div>
            <select class="settings-select" onchange="setMaxNew(parseInt(this.value));openSettings()">
                <option value="5" ${maxNew === 5 ? 'selected' : ''}>5 个</option>
                <option value="10" ${maxNew === 10 ? 'selected' : ''}>10 个</option>
                <option value="15" ${maxNew === 15 ? 'selected' : ''}>15 个</option>
                <option value="20" ${maxNew === 20 ? 'selected' : ''}>20 个</option>
                <option value="30" ${maxNew === 30 ? 'selected' : ''}>30 个</option>
            </select>
        </div>
        <div class="settings-item">
            <div>
                <div class="settings-label">主题</div>
                <div class="settings-desc">切换深色/浅色模式</div>
            </div>
            <select class="settings-select" onchange="applyTheme(this.value)">
                <option value="dark" ${theme === 'dark' ? 'selected' : ''}>深色</option>
                <option value="light" ${theme === 'light' ? 'selected' : ''}>浅色</option>
            </select>
        </div>
        <div class="settings-item">
            <div>
                <div class="settings-label">清除学习数据</div>
                <div class="settings-desc">重置所有学习进度、生词本和错题本</div>
            </div>
            <button onclick="if(confirm('确定要清除所有学习数据吗？此操作不可撤销。')){localStorage.clear();location.reload()}" style="padding:8px 14px;background:var(--danger-dim);color:var(--danger);border:1px solid var(--danger);border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">清除</button>
        </div>
    `;
    openModal('settingsModal');
}

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    loadWords().then(() => {
        // Remove skeleton and render home
        const skeleton = document.getElementById('home-skeleton');
        if (skeleton) skeleton.remove();
        renderHome();

        // Modal backdrop click to close
        document.querySelectorAll('.modal-overlay').forEach(m => {
            m.addEventListener('click', e => { if (e.target === m) m.classList.remove('show'); });
        });

        // Modal swipe to close
        initModalSwipe();
    });

    // Register SW
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    }
});
