/* =============================================
   app.js - 极简移动端英语学习应用
   ============================================= */

const TODAY = new Date().toISOString().slice(0, 10);
const MAX_NEW = 10;

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
}

// ── Storage helpers ──
function S(key) { return localStorage.getItem('se_' + key); }
function SG(key) { try { return JSON.parse(S(key)); } catch(e) { return null; } }
function SS(key, val) { localStorage.setItem('se_' + key, JSON.stringify(val)); }

function getDaily() { return SG('daily') || {}; }
function getTodayRec() {
    const d = getDaily();
    return d[TODAY] || { done: false, learned: 0 };
}
function setTodayLearned(n) {
    const d = getDaily();
    d[TODAY] = { done: n >= MAX_NEW, learned: n };
    SS('daily', d);
}
function getTotalLearned() {
    const d = getDaily();
    let t = 0;
    for (const k in d) t += (d[k].learned || 0);
    return t;
}

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
}
function markWrong(en) {
    const d = getReviewData();
    d[en] = { reps: 0, ease: 2.5, interval: 0, nextReview: Date.now() };
    SS('review', d);
}

function getBank() { return SG('wordbank') || []; }
function toggleBank(en) {
    const b = getBank();
    const i = b.indexOf(en);
    if (i > -1) b.splice(i, 1); else b.push(en);
    SS('wordbank', b);
}
function inBank(en) { return getBank().indexOf(en) > -1; }

function getErrorBook() { return SG('errorBook') || []; }
function addError(en) {
    const b = getErrorBook();
    if (!b.includes(en)) { b.push(en); SS('errorBook', b); }
}

// ── Word Data ──
let WORDS = [];
async function loadWords() {
    const cached = localStorage.getItem('se_words_cache');
    if (cached) { try { WORDS = JSON.parse(cached); } catch(e) {} }
    if (!WORDS.length) {
        try {
            const r = await fetch('words.json');
            const data = await r.json();
            WORDS = Array.isArray(data) ? data : (data.words || []);
            localStorage.setItem('se_words_cache', JSON.stringify(WORDS));
        } catch(e) {}
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
    const pool = {};
    for (const en in rd) if (rd[en].reps === 0) pool[en] = true;
    bank.forEach(en => pool[en] = true);
    return Object.keys(pool).map(findWord).filter(Boolean);
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
    const isCurMonth = (calY === now.getFullYear() && calM === now.getMonth());

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
    const now = new Date();
    const firstDay = new Date(calY, calM, 1).getDay();
    const daysIn = new Date(calY, calM + 1, 0).getDate();
    const todayStr = TODAY;
    const daily = getDaily();
    let html = '';
    // offset for Monday-first (firstDay: 0=Sun, 1=Mon...)
    const offset = firstDay === 0 ? 6 : firstDay - 1;
    for (let i = 0; i < offset; i++) html += '<div class="cal-cell cal-empty"></div>';
    for (let d = 1; d <= daysIn; d++) {
        const ds = calY + '-' + String(calM + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
        const isToday = ds === todayStr;
        const isFuture = ds > todayStr;
        const rec = daily[ds];
        let cls = 'cal-cell';
        if (isToday) cls += ' cal-today';
        else if (isFuture) cls += ' cal-future';
        else if (rec && rec.done) cls += ' cal-done-full';
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

    document.getElementById('view-home').innerHTML = `
        <div class="cal-card" id="cal-inner"></div>
        <div class="entry-grid">
            <div class="entry-btn learn" onclick="startLearn()">
                <span class="entry-btn-label">学习</span>
                <span class="entry-btn-sub">${rec.done ? '已完成' : '剩余' + (MAX_NEW - rec.learned) + '词'}</span>
            </div>
            <div class="entry-btn review" onclick="startReview()" ${pool.length === 0 ? 'style="opacity:0.4;pointer-events:none"' : ''}>
                <span class="entry-btn-label">复习</span>
                <span class="entry-btn-sub">${pool.length === 0 ? '无待复习' : pool.length + '词待复'}</span>
            </div>
        </div>
        <div class="quick-chips">
            <div class="chip" onclick="openBank()">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                生词本
                <span class="chip-count${bank.length === 0 ? ' warn' : ''}">${bank.length}</span>
            </div>
            <div class="chip" onclick="openErrors()">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                错题本
                <span class="chip-count">${errCount}</span>
            </div>
        </div>
    `;
    renderCalendar(document.getElementById('cal-inner'));
    updateBottomProgress(rec.learned, MAX_NEW, '学习');
}

function updateBottomProgress(current, total, label) {
    const fill = document.getElementById('bp-fill');
    const text = document.getElementById('bp-text');
    const labelEl = document.getElementById('bp-label');
    fill.style.width = Math.min(100, (current / total * 100)) + '%';
    text.textContent = current + '/' + total;
    labelEl.textContent = label;
}

// ── Learn ──
let learnQueue = [], learnIdx = 0, learnTodayCount = 0;

function startLearn() {
    const unlearned = getUnlearnedWords();
    const rec = getTodayRec();
    const left = MAX_NEW - rec.learned;
    if (left <= 0 || !unlearned.length) {
        switchView('home');
        return;
    }
    learnQueue = unlearned.slice().sort(() => Math.random() - 0.5).slice(0, Math.min(left, unlearned.length));
    learnIdx = 0;
    learnTodayCount = rec.learned;
    switchView('learn');
    renderLearnCard();
}

function renderLearnCard() {
    const area = document.getElementById('view-learn');
    if (learnIdx >= learnQueue.length) {
        setTodayLearned(learnTodayCount);
        area.innerHTML = `
            <div class="complete-card">
                <div class="complete-title">今日学习完成</div>
                <div class="complete-sub">学了 ${learnTodayCount} 个新词</div>
            </div>`;
        setTimeout(() => switchView('home'), 1500);
        return;
    }
    const w = learnQueue[learnIdx];
    const safe = w.en.replace(/'/g, "\\'");
    const starred = inBank(w.en);
    const total = learnQueue.length;
    updateBottomProgress(learnIdx, total, '学习');

    area.innerHTML = `
        <div style="font-size:13px;color:var(--text-muted);text-align:center;margin-bottom:10px;font-weight:600">
            ${learnIdx + 1} / ${total}
        </div>
        <div class="flashcard">
            <div class="fc-top">
                <span class="fc-cat">${w.category || ''}</span>
                <button class="fc-btn${starred ? ' starred' : ''}" onclick="toggleBank('${safe}');this.classList.toggle('starred')">
                    ${starred ? '★' : '☆'}
                </button>
            </div>
            <div class="fc-word">${w.en}
                <button class="fc-btn" onclick="speak('${safe}')" title="发音">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                </button>
            </div>
            <div class="fc-phon">${w.phon || ''}</div>
            <div class="fc-zh">${w.zh}</div>
            ${w.example ? `<div class="fc-example">${w.example}</div>` : ''}
        </div>
        <div class="rating-row">
            <button class="rate-btn wrong" onclick="rateLearn(false)">不认识</button>
            <button class="rate-btn right" onclick="rateLearn(true)">记住了</button>
        </div>
    `;
}

function rateLearn(correct) {
    const w = learnQueue[learnIdx];
    if (correct) {
        markCorrect(w.en);
    } else {
        markWrong(w.en);
        addError(w.en);
    }
    learnTodayCount = Math.min(learnTodayCount + 1, MAX_NEW);
    learnIdx++;
    renderLearnCard();
}

// ── Review ──
let reviewQueue = [], reviewIdx = 0;

function startReview() {
    const pool = getReviewPool();
    if (!pool.length) { switchView('home'); return; }
    reviewQueue = pool.sort(() => Math.random() - 0.5);
    reviewIdx = 0;
    switchView('review');
    renderReviewCard();
}

function renderReviewCard() {
    const area = document.getElementById('view-review');
    if (reviewIdx >= reviewQueue.length) {
        area.innerHTML = `
            <div class="complete-card">
                <div class="complete-title">本轮复习完毕</div>
                <div class="complete-sub">共复习 ${reviewQueue.length} 词</div>
            </div>`;
        setTimeout(() => switchView('home'), 1500);
        return;
    }
    const w = reviewQueue[reviewIdx];
    const safe = w.en.replace(/'/g, "\\'");
    const starred = inBank(w.en);
    const total = reviewQueue.length;
    updateBottomProgress(reviewIdx + 1, total, '复习');

    area.innerHTML = `
        <div style="font-size:13px;color:var(--text-muted);text-align:center;margin-bottom:10px;font-weight:600">
            ${reviewIdx + 1} / ${total}
        </div>
        <div class="flashcard">
            <div class="fc-top">
                <span class="fc-cat">${w.category || ''}</span>
                <button class="fc-btn${starred ? ' starred' : ''}" onclick="toggleBank('${safe}');this.classList.toggle('starred')">
                    ${starred ? '★' : '☆'}
                </button>
            </div>
            <div class="fc-word">${w.en}
                <button class="fc-btn" onclick="speak('${safe}')" title="发音">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                </button>
            </div>
            <div class="fc-phon">${w.phon || ''}</div>
            <div class="fc-zh">${w.zh}</div>
            ${w.example ? `<div class="fc-example">${w.example}</div>` : ''}
        </div>
        <div class="rating-row">
            <button class="rate-btn wrong" onclick="rateReview(false)">不认识</button>
            <button class="rate-btn right" onclick="rateReview(true)">记住了</button>
        </div>
    `;
}

function rateReview(correct) {
    const w = reviewQueue[reviewIdx];
    if (correct) {
        markCorrect(w.en);
    } else {
        markWrong(w.en);
        addError(w.en);
    }
    reviewIdx++;
    renderReviewCard();
}

// ── Modals ──
function openModal(id) { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }

function openBank() {
    const bank = getBank();
    const errBook = getErrorBook();
    const total = getTotalLearned();
    const bankWords = bank.map(en => findWord(en)).filter(Boolean);
    document.getElementById('bank-body').innerHTML = `
        <div class="bank-stat-row">
            <div class="bank-stat"><div class="bank-stat-n">${bank.length}</div><div class="bank-stat-l">生词</div></div>
            <div class="bank-stat"><div class="bank-stat-n">${errBook.length}</div><div class="bank-stat-l">错题</div></div>
            <div class="bank-stat"><div class="bank-stat-n">${total}</div><div class="bank-stat-l">已学</div></div>
        </div>
        ${bankWords.length === 0 ? '<div class="empty-state">生词本为空</div>' :
            bankWords.map(w => `
                <div class="modal-item">
                    <div>
                        <div class="modal-item-en">${w.en}</div>
                        <div class="modal-item-zh">${w.zh}</div>
                    </div>
                    <div class="modal-item-right">
                        <button class="fc-btn" onclick="speak('${w.en.replace(/'/g,"\\'")}')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                        </button>
                        <button class="modal-item-rm" onclick="removeFromBank('${w.en.replace(/'/g,"\\'")}')">×</button>
                    </div>
                </div>
            `).join('')
        }
    `;
    openModal('modal-bank');
}

function removeFromBank(en) {
    toggleBank(en);
    openBank();
}

function openErrors() {
    const errBook = getErrorBook();
    const errWords = errBook.map(en => findWord(en)).filter(Boolean);
    document.getElementById('errors-body').innerHTML = `
        <div class="bank-stat-row">
            <div class="bank-stat"><div class="bank-stat-n">${errWords.length}</div><div class="bank-stat-l">错题数</div></div>
        </div>
        ${errWords.length === 0 ? '<div class="empty-state">错题本为空，继续保持</div>' :
            errWords.map(w => `
                <div class="modal-item">
                    <div>
                        <div class="modal-item-en">${w.en}</div>
                        <div class="modal-item-zh">${w.zh}</div>
                    </div>
                    <div class="modal-item-right">
                        <button class="fc-btn" onclick="speak('${w.en.replace(/'/g,"\\'")}')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                        </button>
                        <button class="modal-item-rm" onclick="removeError('${w.en.replace(/'/g,"\\'")}')">×</button>
                    </div>
                </div>
            `).join('')
        }
    `;
    openModal('modal-errors');
}

function removeError(en) {
    const b = getErrorBook();
    const i = b.indexOf(en);
    if (i > -1) { b.splice(i, 1); SS('errorBook', b); }
    openErrors();
}

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
    loadWords().then(() => {
        renderHome();
        // close modals on overlay click
        document.querySelectorAll('.modal-overlay').forEach(m => {
            m.addEventListener('click', e => {
                if (e.target === m) m.classList.remove('show');
            });
        });
    });
});
