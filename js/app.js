/**
 * App - Software English
 * v2.0 - Calendar-first, learn + review separate entry points
 */

let VERSION = 'v2.0';

let WORDS = [];
let WORDS_VERSION = '';
let studyQueue = [];
let learnIndex = 0;
let sessionStats = { correct: 0, wrong: 0 };
let currentView = 'idle';
let currentBrowseCategory = 'all';
let learnedSessionQueue = [];

// ===== INIT =====
async function init() {
    Storage._checkDateChange();

    const loaded = await loadWords();
    if (!loaded) {
        document.getElementById('app').innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠</div>加载词库失败，请刷新重试</div>';
        return;
    }

    buildStudyQueue();
    showHome();
    loadTheme();
    updateBottomBar('idle');
    Storage.recordActivity();
}

function buildStudyQueue() {
    const data = Storage._getReviewData();
    const now = Date.now();

    const reviewPool = WORDS.filter(w => {
        const r = data[w.en];
        if (r && r.nextReview && r.nextReview <= now) return true;
        if (Storage.getErrorBook().includes(w.en)) return true;
        return false;
    });

    const errors = reviewPool.filter(w => Storage.getErrorBook().includes(w.en));
    const dues = reviewPool.filter(w => !Storage.getErrorBook().includes(w.en));
    studyQueue = shuffleArray([...errors, ...shuffleArray([...dues])]);

    if (Storage.getErrorBook().length === 0) {
        const newToday = Storage.getNewWordCountToday();
        const newWordsAllowed = Math.max(0, 10 - newToday);
        if (newWordsAllowed > 0) {
            const newPool = WORDS.filter(w => {
                if (!data[w.en] && !studyQueue.find(q => q.en === w.en)) return true;
                return false;
            });
            studyQueue.push(...shuffleArray([...newPool]).slice(0, newWordsAllowed));
        }
    }

    learnIndex = 0;
    sessionStats = { correct: 0, wrong: 0 };
}

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// ===== BOTTOM BAR =====
function updateBottomBar(view) {
    const mainBtn = document.getElementById('bottomMainBtn');
    if (!mainBtn) return;

    if (view === 'idle') {
        mainBtn.textContent = '返回首页';
        mainBtn.className = 'btn btn-secondary';
        mainBtn.style.display = '';
        mainBtn.onclick = showHome;
    } else if (view === 'learn') {
        mainBtn.textContent = '退出学习';
        mainBtn.className = 'btn btn-secondary';
        mainBtn.style.display = '';
        mainBtn.onclick = exitToHome;
    } else if (view === 'learn-complete') {
        mainBtn.textContent = '开始练习';
        mainBtn.className = 'btn btn-primary';
        mainBtn.style.display = '';
        mainBtn.onclick = startPracticeMode;
    } else if (view === 'practice') {
        mainBtn.textContent = '退出练习';
        mainBtn.className = 'btn btn-secondary';
        mainBtn.style.display = '';
        mainBtn.onclick = exitToHome;
    } else if (view === 'practice-complete') {
        mainBtn.textContent = '再练一轮';
        mainBtn.className = 'btn btn-primary';
        mainBtn.style.display = '';
        mainBtn.onclick = () => { learnedSessionQueue = []; buildStudyQueue(); startPracticeMode(); };
    }
}

function exitToHome() {
    learnedSessionQueue = [];
    learnIndex = 0;
    sessionStats = { correct: 0, wrong: 0 };
    showHome();
    updateBottomBar('idle');
}

// ===== HOME: Calendar + entry points =====
function showHome() {
    currentView = 'idle';
    const stats = Storage.getStats(WORDS);
    const dueCount = stats.dueCount + stats.errorCount;
    const newAllowed = Math.max(0, 10 - stats.newWordToday);
    const todayDone = stats.newWordToday >= 10 && dueCount === 0;

    const app = document.getElementById('app');
    app.innerHTML = `
        <!-- Calendar -->
        <div class="cal-card" id="homeCal"></div>

        <!-- Today's status -->
        ${todayDone ? `
        <div class="task-done">
            <div class="task-done-title">今日任务已全部完成</div>
            <div class="task-done-desc">明天继续加油</div>
        </div>` : `
        <div class="task-card">
            <div class="task-today-row">
                <div class="task-today-stat">
                    <div class="task-today-num" style="color:var(--success)">${newAllowed}</div>
                    <div class="task-today-lbl">新词空位</div>
                </div>
                <div class="task-today-divider"></div>
                <div class="task-today-stat">
                    <div class="task-today-num" style="color:var(--danger)">${dueCount}</div>
                    <div class="task-today-lbl">待复习</div>
                </div>
            </div>
        </div>`}

        <!-- Two entry points -->
        <div class="entry-grid">
            <button class="entry-btn entry-review ${dueCount === 0 ? 'entry-disabled' : ''}" onclick="startLearnMode()">
                <div class="entry-btn-icon">📝</div>
                <div class="entry-btn-title">复习</div>
                <div class="entry-btn-desc">${dueCount > 0 ? dueCount + '词待复习' : '暂无待复习'}</div>
            </button>
            <button class="entry-btn entry-learn ${newAllowed === 0 ? 'entry-disabled' : ''}" onclick="startNewLearn()">
                <div class="entry-btn-icon">📖</div>
                <div class="entry-btn-title">学习新词</div>
                <div class="entry-btn-desc">${newAllowed > 0 ? '还可学' + newAllowed + '词' : '已达上限'}</div>
            </button>
        </div>

        <!-- Quick access -->
        <div class="quick-row">
            <button class="quick-chip" onclick="showWordBank()">
                <span>★</span> 生词本
                ${stats.bankCount > 0 ? `<span class="chip-badge">${stats.bankCount}</span>` : ''}
            </button>
            <button class="quick-chip" onclick="showErrorBook()">
                <span>✗</span> 错题本
                ${stats.errorCount > 0 ? `<span class="chip-badge danger">${stats.errorCount}</span>` : ''}
            </button>
        </div>

        <!-- Browse section -->
        <div class="section-title">词库浏览</div>
        <div class="category-tabs" id="categoryTabs"></div>
        <div class="card-grid" id="browseWordList"></div>
    `;

    renderCalendarHome();
    renderTabs();
    renderBrowseWords();
    updateBottomBar('idle');
}

// ===== CALENDAR =====
function renderCalendarHome() {
    const now = new Date();
    const calY = now.getFullYear();
    const calM = now.getMonth();
    const months = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
    const weekdays = ['日','一','二','三','四','五','六'];
    const todayStr = now.toISOString().slice(0, 10);
    const daily = Storage.getDaily();

    const firstWday = new Date(calY, calM, 1).getDay();
    const daysInMonth = new Date(calY, calM + 1, 0).getDate();

    let daysHtml = '';
    for (let i = 0; i < firstWday; i++) {
        daysHtml += '<div class="cal-day-empty"></div>';
    }
    for (let d = 1; d <= daysInMonth; d++) {
        const ds = calY + '-' + String(calM + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
        const isToday = ds === todayStr;
        const isFuture = ds > todayStr;
        const rec = daily[ds];
        const learned = rec && rec.done;
        let cls = 'cal-day-cell';
        if (isToday) cls += ' cal-today';
        if (isFuture) cls += ' cal-future';
        else if (learned) cls += ' cal-learned';
        daysHtml += `<div class="${cls}">${d}</div>`;
    }

    const calEl = document.getElementById('homeCal');
    if (calEl) {
        calEl.innerHTML = `
            <div class="cal-header-row">
                <div class="cal-month-label">${calY}年 ${months[calM]}</div>
                <div class="cal-weekday-row">${weekdays.map(w => `<div class="cal-wday-cell">${w}</div>`).join('')}</div>
            </div>
            <div class="cal-grid">${daysHtml}</div>
        `;
    }
}

// ===== NEW LEARN (only new words, no review queue) =====
function startNewLearn() {
    const newAllowed = Math.max(0, 10 - Storage.getNewWordCountToday());
    if (newAllowed === 0) return;

    const data = Storage._getReviewData();
    const newPool = WORDS.filter(w => !data[w.en] && !studyQueue.find(q => q.en === w.en));
    const selected = shuffleArray(newPool).slice(0, newAllowed);

    if (selected.length === 0) {
        // All words learned, switch to review
        startLearnMode();
        return;
    }

    studyQueue = selected;
    learnIndex = 0;
    learnedSessionQueue = [];
    sessionStats = { correct: 0, wrong: 0 };
    currentView = 'learn';
    showLearnCards();
}

// ===== LEARN MODE =====
function startLearnMode() {
    if (studyQueue.length === 0) {
        buildStudyQueue();
    }
    learnIndex = 0;
    learnedSessionQueue = [];
    sessionStats = { correct: 0, wrong: 0 };

    const hasNewWords = studyQueue.some(w => !Storage.getReview(w.en) && !Storage.getErrorBook().includes(w.en));
    if (!hasNewWords) {
        startPracticeMode();
        return;
    }

    currentView = 'learn';
    showLearnCards();
}

function showLearnCards() {
    const app = document.getElementById('app');
    const left = studyQueue.length - learnIndex;

    if (left <= 0) {
        showLearnComplete();
        return;
    }

    const word1 = studyQueue[learnIndex];
    const word2 = left >= 2 ? studyQueue[learnIndex + 1] : null;

    function wordCard(w) {
        if (!w) return '';
        const isError = Storage.getErrorBook().includes(w.en);
        const starred = Storage.isInBank(w.en);
        return `
        <div class="learn-card">
            <div class="learn-card-top">
                <div class="learn-word">
                    ${w.en}
                    <button class="speak-icon" onclick="speak('${w.en.replace(/'/g, "\\'")}')">🔊</button>
                    ${isError ? '<span class="error-tag">错</span>' : ''}
                </div>
                <button class="star-btn ${starred ? 'active' : ''}" onclick="toggleBankDirect('${w.en.replace(/'/g, "\\'")}', 'learn')">${starred ? '★' : '☆'}</button>
            </div>
            ${w.phon ? `<div class="learn-phon">${w.phon}</div>` : ''}
            <div class="learn-zh">${w.zh}</div>
            ${w.example ? `<div class="learn-example">${w.example}</div>` : ''}
        </div>`;
    }

    app.innerHTML = `
        <div class="learn-header">
            <span class="learn-progress-text">${learnIndex + 1}–${Math.min(learnIndex + 2, studyQueue.length)} / ${studyQueue.length}</span>
            <div class="progress-bar" style="flex:1;margin:0 12px">
                <div class="progress-fill" style="width:${(learnIndex / studyQueue.length) * 100}%"></div>
            </div>
        </div>
        <div class="learn-grid">
            ${wordCard(word1)}
            ${wordCard(word2)}
        </div>
        <div class="learn-nav-btns">
            <button class="btn btn-secondary" style="flex:1" onclick="skipToPractice()">跳过 → 练习</button>
            <button class="btn btn-primary" style="flex:1" onclick="nextLearnCards()">记住了 →</button>
        </div>
    `;

    updateBottomBar('learn');
}

window.nextLearnCards = function() {
    const w1 = studyQueue[learnIndex];
    const w2 = studyQueue[learnIndex + 1];
    if (w1 && !learnedSessionQueue.find(q => q.en === w1.en)) learnedSessionQueue.push(w1);
    if (w2 && !learnedSessionQueue.find(q => q.en === w2.en)) learnedSessionQueue.push(w2);
    learnIndex += 2;
    showLearnCards();
};

window.skipToPractice = function() {
    for (let i = learnIndex; i < studyQueue.length; i++) {
        const w = studyQueue[i];
        if (!learnedSessionQueue.find(q => q.en === w.en)) learnedSessionQueue.push(w);
    }
    showLearnComplete();
};

function toggleBankDirect(en, view) {
    if (Storage.isInBank(en)) {
        Storage.removeFromBank(en);
    } else {
        Storage.addToBank(en);
    }
    if (view === 'learn') showLearnCards();
    else if (view === 'idle') renderBrowseWords();
}

function showLearnComplete() {
    for (let i = learnIndex; i < studyQueue.length; i++) {
        const w = studyQueue[i];
        if (!learnedSessionQueue.find(q => q.en === w.en)) learnedSessionQueue.push(w);
    }
    currentView = 'learn-complete';
    const count = learnedSessionQueue.length;
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="complete-card" style="margin-top:20px">
            <div class="complete-emoji">📖</div>
            <div class="complete-title">学习完毕</div>
            <div class="complete-sub">已标记 ${count} 词</div>
            <button class="btn btn-primary" style="margin-top:20px;width:100%;padding:14px;font-size:16px" onclick="startPracticeMode()">开始拼写练习</button>
            <button class="btn btn-secondary" style="margin-top:8px;width:100%;padding:12px" onclick="exitToHome()">返回首页</button>
        </div>
    `;
    updateBottomBar('learn-complete');
}

// ===== PRACTICE MODE =====
function startPracticeMode() {
    learnIndex = 0;
    sessionStats = { correct: 0, wrong: 0 };
    currentView = 'practice';

    if (learnedSessionQueue.length > 0) {
        studyQueue = learnedSessionQueue.slice();
    } else {
        const remaining = studyQueue.slice(learnIndex);
        if (remaining.length > 0) studyQueue = remaining;
    }
    learnedSessionQueue = [];
    showPracticeCard();
}

function showPracticeCard() {
    if (learnIndex >= studyQueue.length) {
        showPracticeComplete();
        return;
    }

    const word = studyQueue[learnIndex];
    const app = document.getElementById('app');

    app.innerHTML = `
        <div class="study-header">
            <div class="study-progress">
                <span>${learnIndex + 1} / ${studyQueue.length}</span>
                <div class="progress-bar" style="flex:1;margin:0 12px">
                    <div class="progress-fill" style="width:${(learnIndex / studyQueue.length) * 100}%"></div>
                </div>
                <span class="study-score">
                    <span style="color:var(--success)">${sessionStats.correct}</span>
                    /
                    <span style="color:var(--danger)">${sessionStats.wrong}</span>
                </span>
            </div>
        </div>
        <div class="study-card">
            <div class="study-prompt">${word.zh}</div>
            <div class="study-word-row">
                <span class="study-word-en">${word.en}</span>
                <button class="speak-icon-lg" onclick="speak('${word.en.replace(/'/g, "\\'")}')">🔊</button>
            </div>
            <input class="study-input" type="text" id="studyInput"
                placeholder="输入英文单词"
                autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" />
            <button class="btn btn-primary" onclick="checkPracticeAnswer()" style="width:100%;margin-top:10px;padding:12px;font-size:16px">确认</button>
        </div>
    `;

    updateBottomBar('practice');
    setTimeout(() => {
        const input = document.getElementById('studyInput');
        if (input) { input.value = ''; input.focus(); }
    }, 50);
}

window.checkPracticeAnswer = function() {
    const input = document.getElementById('studyInput');
    if (!input) return;
    const answer = input.value.trim().toLowerCase();
    const word = studyQueue[learnIndex];
    const correct = word.en.toLowerCase();

    if (answer === correct) {
        sessionStats.correct++;
        Storage.markCorrect(word.en);
        const r = Storage.getReview(word.en);
        if (r && r.reps === 1) Storage.incrementNewWordCount();
        showPracticeResult(true, word);
    } else {
        sessionStats.wrong++;
        Storage.markWrong(word.en);
        showPracticeResult(false, word, correct, answer);
    }
};

function showPracticeResult(isCorrect, word, correctAnswer, userAnswer) {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="study-result ${isCorrect ? 'correct' : 'wrong'}">
            <div class="result-icon">${isCorrect ? '✓' : '✗'}</div>
            <div class="result-word">${word.en}</div>
            <div class="result-phon">${word.phon || ''} · ${word.zh}</div>
            ${!isCorrect ? `
                <div class="result-wrong">你的答案: ${userAnswer}</div>
                <div class="result-correct">正确答案: ${correctAnswer}</div>
            ` : ''}
            <div class="result-actions">
                <button class="speak-icon-lg" onclick="speak('${word.en.replace(/'/g, "\\'")}')">🔊</button>
            </div>
            <button class="btn btn-primary" style="margin-top:12px;width:100%;padding:12px" onclick="nextPracticeCard()">下一个</button>
        </div>
    `;
}

window.nextPracticeCard = function() {
    learnIndex++;
    showPracticeCard();
};

function showPracticeComplete() {
    currentView = 'practice-complete';
    const total = sessionStats.correct + sessionStats.wrong;
    const pct = total > 0 ? Math.round(sessionStats.correct / total * 100) : 0;
    const app = document.getElementById('app');

    if (total === 0) {
        showHome();
        updateBottomBar('idle');
        return;
    }

    const emoji = pct >= 90 ? '🎉' : pct >= 70 ? '👍' : '💪';
    const msg = pct >= 90 ? '太棒了！' : pct >= 70 ? '很不错！' : '继续加油！';

    app.innerHTML = `
        <div class="complete-card" style="margin-top:20px">
            <div class="complete-emoji">${emoji}</div>
            <div class="complete-score-big">${sessionStats.correct}/${total}</div>
            <div class="complete-pct">正确率 ${pct}% · ${msg}</div>
            <button class="btn btn-primary" style="margin-top:20px;width:100%;padding:12px" onclick="buildStudyQueue();showHome()">返回首页</button>
        </div>
    `;

    learnedSessionQueue = [];
    buildStudyQueue();
    updateBottomBar('practice-complete');
}

// ===== WORD BANK MODAL =====
function showWordBank() {
    document.getElementById('errorModal').classList.remove('show');
    const modal = document.getElementById('bankModal');
    const body = document.getElementById('bankBody');
    const bankWords = WORDS.filter(w => Storage.isInBank(w.en));
    const masteredCount = bankWords.filter(w => Storage.isMastered(w.en)).length;

    if (bankWords.length === 0) {
        body.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">☆</div>
                <div style="font-size:15px;font-weight:600;margin-bottom:4px">生词本为空</div>
                <div style="font-size:13px;color:var(--text-secondary)">学习或浏览时点击 ☆ 收藏单词</div>
            </div>`;
    } else {
        body.innerHTML = `
            <div class="bank-modal-stats">
                <div class="bank-stat">
                    <div class="bank-stat-num">${bankWords.length}</div>
                    <div class="bank-stat-lbl">收藏词数</div>
                </div>
                <div class="bank-stat">
                    <div class="bank-stat-num" style="color:var(--success)">${masteredCount}</div>
                    <div class="bank-stat-lbl">已掌握</div>
                </div>
                <div class="bank-stat">
                    <div class="bank-stat-num" style="color:var(--warning)">${bankWords.length - masteredCount}</div>
                    <div class="bank-stat-lbl">学习中</div>
                </div>
            </div>
            ${bankWords.map(w => `
            <div class="modal-card">
                <div class="modal-card-top">
                    <div>
                        <div class="modal-card-en">${w.en} ${Storage.isMastered(w.en) ? '<span class="mastered-badge">✓</span>' : ''}</div>
                        ${w.phon ? `<div class="modal-card-phon">${w.phon}</div>` : ''}
                    </div>
                    <div style="display:flex;gap:4px">
                        <button class="speak-icon-sm" onclick="speak('${w.en.replace(/'/g, "\\'")}')">🔊</button>
                        <button class="star-btn active" onclick="removeFromBank('${w.en.replace(/'/g, "\\'")}')">★</button>
                    </div>
                </div>
                <div class="modal-card-zh">${w.zh}</div>
                ${w.example ? `<div class="modal-card-example">${w.example}</div>` : ''}
            </div>`).join('')}`;
    }

    modal.classList.add('show');
}

window.removeFromBank = function(en) {
    Storage.removeFromBank(en);
    showWordBank();
};

function closeBankBook() {
    document.getElementById('bankModal').classList.remove('show');
    if (currentView === 'idle') showHome();
}

// ===== ERROR BOOK MODAL =====
function showErrorBook() {
    document.getElementById('bankModal').classList.remove('show');
    const modal = document.getElementById('errorModal');
    const body = document.getElementById('errorBody');
    const errors = Storage.getErrorBookWords(WORDS);

    if (errors.length === 0) {
        body.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🎉</div>
                <div style="font-size:15px;font-weight:600;margin-bottom:4px">错词本很干净</div>
                <div style="font-size:13px;color:var(--text-secondary)">继续保持，全部掌握指日可待</div>
            </div>`;
    } else {
        body.innerHTML = `
            <div class="error-summary-card">
                <div class="error-summary-title">错词本</div>
                <div class="error-summary-count">${errors.length}</div>
            </div>
            ${errors.map(w => `
            <div class="modal-card" style="border-left:3px solid var(--danger)">
                <div class="modal-card-top">
                    <div>
                        <div class="modal-card-en">${w.en}</div>
                        ${w.phon ? `<div class="modal-card-phon">${w.phon}</div>` : ''}
                    </div>
                    <button class="speak-icon-sm" onclick="speak('${w.en.replace(/'/g, "\\'")}')">🔊</button>
                </div>
                <div class="modal-card-zh">${w.zh}</div>
                ${w.example ? `<div class="modal-card-example">${w.example}</div>` : ''}
            </div>`).join('')}
            <button class="btn btn-primary" style="margin-top:12px;width:100%;padding:12px" onclick="closeErrorBook();buildStudyQueue();startPracticeMode()">用练习复习</button>`;
    }

    modal.classList.add('show');
}

function closeErrorBook() {
    document.getElementById('errorModal').classList.remove('show');
    if (currentView === 'idle') showHome();
}

// ===== BROWSE =====
function renderTabs() {
    const categories = [
        { id: 'all', name: '全部' },
        { id: 'wordbank', name: '★ 生词本' },
        { id: 'errors', name: '✗ 错词' },
        { id: 'config', name: '配置' },
        { id: 'log', name: '日志' },
        { id: 'error', name: '错误' },
        { id: 'cli', name: '命令' },
        { id: 'devops', name: '运维' },
        { id: 'dev', name: '开发' },
        { id: 'db', name: '数据库' },
        { id: 'git', name: 'Git' },
        { id: 'ai', name: 'AI' }
    ];
    const tabs = document.getElementById('categoryTabs');
    if (!tabs) return;
    tabs.innerHTML = categories.map(c =>
        `<div class="category-tab ${c.id === currentBrowseCategory ? 'active' : ''}" onclick="selectBrowseCategory('${c.id}')">${c.name}</div>`
    ).join('');
}

function selectBrowseCategory(cat) {
    currentBrowseCategory = cat;
    renderTabs();
    renderBrowseWords();
}

function renderBrowseWords() {
    const list = document.getElementById('browseWordList');
    if (!list) return;

    let words = [];
    if (currentBrowseCategory === 'all') {
        words = WORDS;
    } else if (currentBrowseCategory === 'wordbank') {
        words = WORDS.filter(w => Storage.isInBank(w.en));
    } else if (currentBrowseCategory === 'errors') {
        words = Storage.getErrorBookWords(WORDS);
    } else {
        words = WORDS.filter(w => w.category === currentBrowseCategory);
    }

    if (words.length === 0) {
        const emptyMsg = currentBrowseCategory === 'wordbank' ? '生词本为空' :
                        currentBrowseCategory === 'errors' ? '错词本为空' :
                        '该分类暂无词汇';
        list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📭</div>${emptyMsg}</div>`;
        return;
    }

    list.innerHTML = words.slice(0, 80).map(w => {
        const inBank = Storage.isInBank(w.en);
        const mastered = Storage.isMastered(w.en);
        const isError = Storage.getErrorBook().includes(w.en);
        const review = Storage.getReview(w.en);

        return `
        <div class="word-card ${inBank ? 'in-bank' : ''} ${isError ? 'in-error' : ''}">
            <div class="word-main">
                <div class="word-en">
                    ${w.en}
                    <button class="speak-icon" onclick="speak('${w.en.replace(/'/g, "\\'")}')">🔊</button>
                    ${w.phon ? `<span class="word-phon">${w.phon}</span>` : ''}
                    ${mastered ? '<span class="mastered-badge">✓</span>' : ''}
                </div>
                <div class="word-zh">${w.zh}</div>
                ${w.example ? `<div class="word-example">${w.example}</div>` : ''}
                ${review && review.reps > 0 ? `<div class="word-review-info">复习${review.reps}次</div>` : ''}
            </div>
            <button class="star-btn ${inBank ? 'active' : ''}" onclick="toggleBankBrowse('${w.en.replace(/'/g, "\\'")}')">${inBank ? '★' : '☆'}</button>
        </div>`;
    }).join('');

    if (words.length > 80) {
        list.innerHTML += `<div class="empty-state" style="padding:20px">显示前80词，共${words.length}词</div>`;
    }
}

window.toggleBankBrowse = function(en) {
    if (Storage.isInBank(en)) {
        Storage.removeFromBank(en);
    } else {
        Storage.addToBank(en);
    }
    renderBrowseWords();
};

// ===== TTS — always use Youdao (handles multi-word phrases correctly) =====
function speak(text) {
    const audioUrl = `https://dict.youdao.com/dictvoice?type=1&word=${encodeURIComponent(text)}`;
    const audio = new Audio(audioUrl);
    audio.play().catch(() => {
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-US';
            utterance.rate = 0.88;
            window.speechSynthesis.speak(utterance);
        }
    });
}

// ===== THEME =====
function setTheme(theme) {
    document.body.setAttribute('data-theme', theme === 'blue' ? '' : theme);
    Storage.setTheme(theme);
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === theme);
    });
}

function loadTheme() {
    setTheme(Storage.getTheme());
}

// ===== KEYBOARD =====
document.addEventListener('keydown', (e) => {
    const input = document.getElementById('studyInput');
    if (input && document.activeElement === input && e.key === 'Enter') {
        checkPracticeAnswer();
    }
});

// ===== LOAD WORDS =====
async function loadWords() {
    try {
        const response = await fetch('words.json');
        const data = await response.json();
        WORDS_VERSION = data.version;
        WORDS = data.words || [];
        return true;
    } catch (error) {
        console.error('Failed to load words:', error);
        return false;
    }
}

// ===== START =====
document.addEventListener('DOMContentLoaded', init);
