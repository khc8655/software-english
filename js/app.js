/**
 * App - Main application logic
 * Learn first → Practice → SM-2 Spaced Repetition
 */

let WORDS = [];
let WORDS_VERSION = '';
let studyQueue = [];
let learnIndex = 0;    // increments by 2 for 2-card layout
let sessionStats = { correct: 0, wrong: 0 };
let currentView = 'idle'; // 'idle' | 'learn' | 'learn-complete' | 'practice' | 'practice-complete'

// ========================
// INIT
// ========================
async function init() {
    Storage._checkDateChange();

    const loaded = await loadWords();
    if (!loaded) {
        document.getElementById('wordList').innerHTML = '<div class="empty-state">加载词库失败，请刷新重试</div>';
        return;
    }

    buildStudyQueue();
    showHome();
    updateStats();
    loadTheme();
    updateBottomBar('idle');
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

    const newToday = Storage.getNewWordCountToday();
    const newWordsAllowed = Math.max(0, 10 - newToday);
    if (newWordsAllowed > 0) {
        const newPool = WORDS.filter(w => {
            if (!data[w.en] && !studyQueue.find(q => q.en === w.en)) return true;
            return false;
        });
        studyQueue.push(...shuffleArray([...newPool]).slice(0, newWordsAllowed));
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

// ========================
// BOTTOM BAR
// ========================
function updateBottomBar(view, extra) {
    const bar = document.getElementById('bottomBar');
    const mainBtn = document.getElementById('bottomMainBtn');
    if (!bar || !mainBtn) return;

    if (view === 'idle') {
        mainBtn.textContent = '开始学习';
        mainBtn.className = 'btn btn-primary';
        mainBtn.style.display = '';
        mainBtn.onclick = startLearnMode;
    } else if (view === 'learn') {
        mainBtn.textContent = '开始练习 →';
        mainBtn.className = 'btn btn-primary';
        mainBtn.style.display = '';
        mainBtn.onclick = startPracticeMode;
    } else if (view === 'learn-complete') {
        mainBtn.textContent = '开始练习';
        mainBtn.className = 'btn btn-primary';
        mainBtn.style.display = '';
        mainBtn.onclick = startPracticeMode;
    } else if (view === 'practice') {
        // In practice, hide main button, just show 错词本
        mainBtn.style.display = 'none';
    } else if (view === 'practice-complete') {
        mainBtn.textContent = '再练一轮';
        mainBtn.className = 'btn btn-primary';
        mainBtn.style.display = '';
        mainBtn.onclick = () => { buildStudyQueue(); startPracticeMode(); };
    }
}

// ========================
// HOME (stats overview)
// ========================
function showHome() {
    currentView = 'idle';
    const stats = Storage.getStats(WORDS);

    document.getElementById('totalCount').textContent = stats.totalWords;
    document.getElementById('learnedCount').textContent = stats.mastered;
    document.getElementById('bankCount').textContent = stats.bankCount;
    const pct = stats.totalWords > 0 ? Math.round(stats.mastered / stats.totalWords * 100) : 0;
    document.getElementById('progressText').textContent = pct + '%';
    document.getElementById('progressCircle').style.strokeDashoffset = 100 * (1 - pct / 100);
    document.getElementById('streakCount').textContent = stats.newWordToday + '/' + 10;

    const list = document.getElementById('wordList');
    const hasReview = stats.dueCount + stats.errorCount > 0;

    list.innerHTML = `
        <div class="home-stats">
            <div class="home-stat-item">
                <div class="home-stat-num" style="color:var(--success)">${stats.mastered}</div>
                <div class="home-stat-lbl">已掌握</div>
            </div>
            <div class="home-stat-divider"></div>
            <div class="home-stat-item">
                <div class="home-stat-num" style="color:var(--danger)">${stats.errorCount}</div>
                <div class="home-stat-lbl">错词</div>
            </div>
            <div class="home-stat-divider"></div>
            <div class="home-stat-item">
                <div class="home-stat-num">${stats.bankCount}</div>
                <div class="home-stat-lbl">生词本</div>
            </div>
            <div class="home-stat-divider"></div>
            <div class="home-stat-item">
                <div class="home-stat-num" style="color:var(--primary)">${hasReview ? stats.dueCount + stats.errorCount : '0'}</div>
                <div class="home-stat-lbl">${hasReview ? '待复习' : '无待复习'}</div>
            </div>
        </div>

        ${hasReview || stats.newWordToday < 10 ? `
        <div class="action-section">
            <div class="action-title">${hasReview ? `今日复习 ${studyQueue.length} 词` : '今日新词'}</div>
            ${stats.errorCount > 0 ? `<div class="action-hint error-hint">含 ${stats.errorCount} 个错词</div>` : ''}
            <div class="action-hint" style="color:var(--text-secondary)">先浏览学习，再练习测试</div>
        </div>
        ` : `
        <div class="action-section">
            <div class="action-title">今日任务已完成</div>
            <div class="action-hint">明天再来，或自由浏览词库</div>
        </div>
        `}

        <div class="section-title" style="margin-top:16px"><span>词库分类</span></div>
        <div class="category-tabs" id="categoryTabs"></div>
        <div class="card-grid" id="browseWordList"></div>
    `;

    renderTabs();
    renderBrowseWords();
    updateBottomBar('idle');
}

// ========================
// LEARN MODE - 2 cards at a time
// ========================
function startLearnMode() {
    learnIndex = 0;
    currentView = 'learn';
    sessionStats = { correct: 0, wrong: 0 };
    showLearnCards();
}

function showLearnCards() {
    const list = document.getElementById('wordList');

    // Get remaining cards (2 at a time)
    const left = studyQueue.length - learnIndex;
    if (left <= 0) {
        showLearnComplete();
        return;
    }

    const word1 = studyQueue[learnIndex];
    const word2 = left >= 2 ? studyQueue[learnIndex + 1] : null;

    const renderCard = (w, idx) => {
        if (!w) return '<div></div>';
        const isError = Storage.getErrorBook().includes(w.en);
        return `
        <div class="learn-card">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
                <div class="learn-word">${w.en}</div>
                ${isError ? '<span style="font-size:10px;color:var(--danger)">错</span>' : ''}
            </div>
            ${w.phon ? `<div class="learn-phon">${w.phon}</div>` : ''}
            <div class="learn-zh">${w.zh}</div>
            ${w.example ? `<div class="learn-example">${w.example}</div>` : ''}
            <div class="learn-actions">
                <button class="btn btn-primary learn-speak-btn" onclick="speak('${w.en.replace(/'/g, "\\'")}')">🔊 听</button>
                <button class="icon-btn bank-btn ${Storage.isInBank(w.en) ? 'active' : ''}" onclick="toggleBankFromLearn('${w.en.replace(/'/g, "\\'")}')">${Storage.isInBank(w.en) ? '★' : '☆'}</button>
            </div>
        </div>`;
    };

    list.innerHTML = `
        <div class="learn-header">
            <span>学习 ${learnIndex + 1} - ${Math.min(learnIndex + 2, studyQueue.length)} / ${studyQueue.length}</span>
            <div class="progress-bar" style="flex:1;margin:0 12px">
                <div class="progress-fill" style="width:${(learnIndex / studyQueue.length) * 100}%"></div>
            </div>
        </div>
        <div class="learn-grid">
            ${renderCard(word1, learnIndex)}
            ${renderCard(word2, learnIndex + 1)}
        </div>
        <div style="display:flex;gap:8px;margin-top:12px">
            <button class="btn btn-secondary" style="flex:1" onclick="showLearnComplete()">跳过 → 练习</button>
            <button class="btn btn-primary" style="flex:1" onclick="nextLearnCards()">记住了 ${left >= 2 ? '→ 2张' : '→'}</button>
        </div>
    `;

    updateBottomBar('learn');
    // Auto play first word
    setTimeout(() => speak(word1.en), 300);
}

window.toggleBankFromLearn = function(wordEn) {
    if (Storage.isInBank(wordEn)) {
        Storage.removeFromBank(wordEn);
    } else {
        Storage.addToBank(wordEn);
    }
    // Re-render current cards to update star icons
    showLearnCards();
};

window.nextLearnCards = function() {
    learnIndex += 2;
    showLearnCards();
};

function showLearnComplete() {
    currentView = 'learn-complete';
    const list = document.getElementById('wordList');
    list.innerHTML = `
        <div class="learn-complete">
            <div style="font-size:48px;margin-bottom:8px">📖</div>
            <div class="complete-title">学习完毕</div>
            <div class="complete-sub">已浏览 ${Math.min(learnIndex + 2, studyQueue.length)} 个词汇</div>
            <div class="complete-hint">现在进入拼写练习</div>
        </div>
    `;
    updateBottomBar('learn-complete');
}

// ========================
// PRACTICE MODE
// ========================
function startPracticeMode() {
    learnIndex = 0;
    sessionStats = { correct: 0, wrong: 0 };
    currentView = 'practice';
    showPracticeCard();
}

function showPracticeCard() {
    if (learnIndex >= studyQueue.length) {
        showPracticeComplete();
        return;
    }

    const word = studyQueue[learnIndex];
    const list = document.getElementById('wordList');

    list.innerHTML = `
        <div class="study-header">
            <div class="study-progress">
                <span>练习 ${learnIndex + 1} / ${studyQueue.length}</span>
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
            ${word.example ? `<div class="study-example">${word.example}</div>` : ''}
            <input class="study-input" type="text" id="studyInput"
                placeholder="输入英文单词"
                autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" />
            <div class="study-hint">按回车确认</div>
            <button class="icon-btn speak-btn" onclick="speak('${word.en.replace(/'/g, "\\'")}')" style="margin-top:8px">🔊 发音</button>
        </div>
    `;

    updateBottomBar('practice');
    setTimeout(() => {
        const input = document.getElementById('studyInput');
        if (input) { input.value = ''; input.focus(); }
    }, 50);
    setTimeout(() => speak(word.en), 300);
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
    const list = document.getElementById('wordList');
    list.innerHTML = `
        <div class="study-result ${isCorrect ? 'correct' : 'wrong'}">
            <div class="result-icon">${isCorrect ? '✓' : '✗'}</div>
            <div class="result-word">${word.en}</div>
            <div class="result-phon">${word.phon || ''} ${word.zh}</div>
            ${!isCorrect ? `<div class="result-wrong-msg">你的: ${userAnswer}</div>
                            <div class="result-correct-msg">正确: ${correctAnswer}</div>` : ''}
            ${word.example ? `<div class="result-example">${word.example}</div>` : ''}
            <button class="icon-btn speak-btn" onclick="speak('${word.en.replace(/'/g, "\\'")}')" style="margin-top:14px">🔊 再听</button>
            <button class="btn btn-primary" style="margin-top:12px;width:100%" onclick="nextPracticeCard()">下一个</button>
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
    const list = document.getElementById('wordList');

    if (total === 0) {
        showHome();
        updateStats();
        updateBottomBar('idle');
        return;
    }

    list.innerHTML = `
        <div class="study-complete">
            <div class="complete-score">${sessionStats.correct}/${total}</div>
            <div class="complete-pct">正确率 ${pct}%</div>
            ${pct >= 90 ? '<div class="complete-msg" style="color:var(--success)">太棒了！</div>' :
              pct >= 70 ? '<div class="complete-msg" style="color:var(--primary)">很不错！</div>' :
              '<div class="complete-msg" style="color:var(--warning)">继续加油！</div>'}
        </div>
    `;

    updateStats();
    buildStudyQueue();
    updateBottomBar('practice-complete');
}

// ========================
// BROWSE (from tabs)
// ========================
function renderTabs() {
    const categories = [
        { id: 'all', name: '全部' },
        { id: 'wordbank', name: '生词本' },
        { id: 'errors', name: '错词' },
        { id: 'config', name: '配置' },
        { id: 'log', name: '日志' },
        { id: 'error', name: '错误' },
        { id: 'cli', name: '命令' },
        { id: 'devops', name: '运维' },
        { id: 'dev', name: '开发' },
        { id: 'db', name: '数据库' },
        { id: 'git', name: 'Git' }
    ];
    const tabs = document.getElementById('categoryTabs');
    if (!tabs) return;
    tabs.innerHTML = categories.map(c =>
        `<div class="category-tab ${c.id === currentBrowseCategory ? 'active' : ''}" onclick="selectBrowseCategory('${c.id}')">${c.name}</div>`
    ).join('');
}

let currentBrowseCategory = 'all';

function selectBrowseCategory(cat) {
    currentBrowseCategory = cat;
    renderTabs();
    renderBrowseWords();
}

function toggleBank(wordEn, event) {
    if (event) event.stopPropagation();
    if (Storage.isInBank(wordEn)) {
        Storage.removeFromBank(wordEn);
    } else {
        Storage.addToBank(wordEn);
    }
    renderBrowseWords();
    updateStats();
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
        list.innerHTML = '<div class="empty-state">暂无词汇</div>';
        return;
    }

    list.innerHTML = words.map(w => {
        const inBank = Storage.isInBank(w.en);
        const mastered = Storage.isMastered(w.en);
        const isError = Storage.getErrorBook().includes(w.en);
        const review = Storage.getReview(w.en);

        return `
        <div class="word-card ${inBank ? 'in-bank' : ''} ${isError ? 'in-error' : ''}">
            <div class="word-main">
                <div class="word-en">
                    <span>${w.en}</span>
                    ${w.phon ? `<span class="word-phon">${w.phon}</span>` : ''}
                    ${mastered ? '<span class="mastered-badge">✓</span>' : ''}
                </div>
                <div class="word-zh">${w.zh}</div>
                ${w.example ? `<div class="word-example">${w.example}</div>` : ''}
                ${review && review.reps > 0 ? `<div class="word-review-info">复习${review.reps}次 · 间隔${review.interval}天</div>` : ''}
            </div>
            <div class="card-actions">
                <button class="icon-btn speak-btn" onclick="speak('${w.en.replace(/'/g, "\\'")}')">🔊</button>
                <button class="icon-btn bank-btn ${inBank ? 'active' : ''}" onclick="toggleBank('${w.en.replace(/'/g, "\\'")}', event)">${inBank ? '★' : '☆'}</button>
            </div>
        </div>
    `}).join('');
}

// ========================
// TTS
// ========================
function speak(text) {
    const audioUrl = `https://dict.youdao.com/dictvoice?type=1&word=${encodeURIComponent(text)}`;
    const audio = new Audio(audioUrl);
    audio.play().catch(() => {
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-US';
            utterance.rate = 0.9;
            window.speechSynthesis.speak(utterance);
        }
    });
}

function showToast(msg) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    toast.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.8);color:white;padding:12px 24px;border-radius:8px;font-size:14px;z-index:9999';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

if (window.speechSynthesis) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}

// ========================
// STATS
// ========================
function updateStats() {
    const stats = Storage.getStats(WORDS);
    const pct = stats.totalWords > 0 ? Math.round(stats.mastered / stats.totalWords * 100) : 0;

    const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    el('totalCount', stats.totalWords);
    el('learnedCount', stats.mastered);
    el('bankCount', stats.bankCount);
    el('streakCount', stats.newWordToday + '/' + 10);
    el('progressText', pct + '%');
    const c = document.getElementById('progressCircle');
    if (c) c.style.strokeDashoffset = 100 * (1 - pct / 100);
}

// ========================
// THEME
// ========================
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

// ========================
// ERROR BOOK
// ========================
function showErrorBook() {
    const modal = document.getElementById('errorModal');
    const body = document.getElementById('errorBody');
    const errors = Storage.getErrorBookWords(WORDS);

    if (errors.length === 0) {
        body.innerHTML = '<div class="empty-state">错词本为空</div>';
    } else {
        body.innerHTML = `
            <div style="margin-bottom:12px;color:var(--text-secondary);font-size:13px">共 ${errors.length} 个错词</div>
            <div class="card-grid">
                ${errors.map(w => `
                    <div class="word-card in-error">
                        <div class="word-main">
                            <div class="word-en"><span>${w.en}</span>${w.phon ? `<span class="word-phon">${w.phon}</span>` : ''}</div>
                            <div class="word-zh">${w.zh}</div>
                        </div>
                        <div class="card-actions">
                            <button class="icon-btn speak-btn" onclick="speak('${w.en.replace(/'/g, "\\'")}')">🔊</button>
                            <button class="icon-btn bank-btn ${Storage.isInBank(w.en) ? 'active' : ''}" onclick="toggleBank('${w.en.replace(/'/g, "\\'")}', event)">${Storage.isInBank(w.en) ? '★' : '☆'}</button>
                        </div>
                    </div>
                `).join('')}
            </div>
            <button class="btn btn-primary" style="margin-top:16px;width:100%" onclick="closeErrorBook();buildStudyQueue();startPracticeMode()">用练习复习</button>
        `;
    }

    modal.classList.add('show');
}

function closeErrorBook() {
    document.getElementById('errorModal').classList.remove('show');
    renderBrowseWords();
}

// ========================
// KEYBOARD
// ========================
document.addEventListener('keydown', (e) => {
    const input = document.getElementById('studyInput');
    if (input && document.activeElement === input && e.key === 'Enter') {
        checkPracticeAnswer();
    }
});

// ========================
// LOAD WORDS
// ========================
async function loadWords() {
    try {
        const response = await fetch('words.json');
        const data = await response.json();
        WORDS_VERSION = data.version;
        WORDS = data.words;
        return true;
    } catch (error) {
        console.error('Failed to load words:', error);
        return false;
    }
}

// ========================
// START
// ========================
document.addEventListener('DOMContentLoaded', init);
