/**
 * App - Main application logic
 * SM-2 Spaced Repetition + Error-first learning
 */

let WORDS = [];
let WORDS_VERSION = '';
let currentCategory = 'all';
let studyQueue = [];   // words to study today
let studyIndex = 0;
let sessionStats = { correct: 0, wrong: 0 };

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
    renderHome();
    updateStats();
    loadTheme();
}

// Build today's study queue: errors first, then due words, then new words (capped)
function buildStudyQueue() {
    const bankWords = Storage.getWordBank();
    const data = Storage._getReviewData();
    const now = Date.now();

    // All words that need review today (errors + due)
    const reviewPool = WORDS.filter(w => {
        const r = data[w.en];
        // Include: has review record and due, OR is in error book
        if (r && r.nextReview && r.nextReview <= now) return true;
        if (Storage.getErrorBook().includes(w.en)) return true;
        return false;
    });

    // Shuffle review pool (errors bubble to front)
    const errors = reviewPool.filter(w => Storage.getErrorBook().includes(w.en));
    const dues = reviewPool.filter(w => !Storage.getErrorBook().includes(w.en));
    studyQueue = shuffleArray([...errors, ...shuffleArray([...dues])]);

    // Add new words if under daily limit (10/day)
    const newToday = Storage.getNewWordCountToday();
    const newWordsAllowed = Math.max(0, 10 - newToday);
    if (newWordsAllowed > 0) {
        // Pick words not yet reviewed and not in today's queue
        const newPool = WORDS.filter(w => {
            if (!data[w.en] && !studyQueue.find(q => q.en === w.en)) return true;
            return false;
        });
        studyQueue.push(...shuffleArray([...newPool]).slice(0, newWordsAllowed));
    }

    studyIndex = 0;
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
// HOME VIEW
// ========================
function renderHome() {
    const stats = Storage.getStats(WORDS);
    const dueCount = stats.dueCount;
    const errorCount = stats.errorCount;
    const masteredCount = stats.mastered;
    const newToday = stats.newWordToday;
    const bankCount = stats.bankCount;

    // Update stat bar
    document.getElementById('totalCount').textContent = stats.totalWords;
    document.getElementById('learnedCount').textContent = masteredCount;
    document.getElementById('bankCount').textContent = bankCount;
    const pct = stats.totalWords > 0 ? Math.round(masteredCount / stats.totalWords * 100) : 0;
    document.getElementById('progressText').textContent = pct + '%';
    document.getElementById('progressCircle').style.strokeDashoffset = 100 * (1 - pct / 100);
    document.getElementById('streakCount').textContent = newToday + '/' + 10;

    // Main content
    const list = document.getElementById('wordList');

    let summaryHtml = `
        <div class="home-stats">
            <div class="home-stat-item">
                <div class="home-stat-num" style="color:var(--success)">${masteredCount}</div>
                <div class="home-stat-lbl">已掌握</div>
            </div>
            <div class="home-stat-divider"></div>
            <div class="home-stat-item">
                <div class="home-stat-num" style="color:var(--danger)">${errorCount}</div>
                <div class="home-stat-lbl">错词本</div>
            </div>
            <div class="home-stat-divider"></div>
            <div class="home-stat-item">
                <div class="home-stat-num">${bankCount}</div>
                <div class="home-stat-lbl">生词本</div>
            </div>
            <div class="home-stat-divider"></div>
            <div class="home-stat-item">
                <div class="home-stat-num" style="color:var(--primary)">${dueCount}</div>
                <div class="home-stat-lbl">待复习</div>
            </div>
        </div>
    `;

    let actionHtml = '';
    if (studyQueue.length > 0) {
        actionHtml = `
            <div class="action-section">
                <div class="action-title">今日任务</div>
                ${errorCount > 0 ? `<div class="action-hint error-hint">🔴 错词 ${errorCount} 个</div>` : ''}
                <button class="btn btn-primary action-btn" onclick="startStudy()">
                    ${dueCount + errorCount > 0 ? `开始复习 (${studyQueue.length})` : `学习新词 (${studyQueue.length})`}
                </button>
            </div>
        `;
    } else {
        actionHtml = `
            <div class="action-section">
                <div class="action-title">今日任务已完成</div>
                <div class="action-hint">明天再来，或自由浏览词库</div>
            </div>
        `;
    }

    // Category browser
    let categoryHtml = `
        <div class="section-title" style="margin-top:20px"><span>词库分类</span></div>
        <div class="category-tabs" id="categoryTabs"></div>
        <div class="card-grid" id="wordList"></div>
    `;

    list.innerHTML = summaryHtml + actionHtml + categoryHtml;

    renderTabs();
    renderWords();
}

// ========================
// STUDY MODE (打字练习)
// ========================
function startStudy() {
    studyIndex = 0;
    sessionStats = { correct: 0, wrong: 0 };
    showStudyCard();
}

function showStudyCard() {
    if (studyIndex >= studyQueue.length) {
        showStudyComplete();
        return;
    }

    const word = studyQueue[studyIndex];
    const isError = Storage.getErrorBook().includes(word.en);

    const list = document.getElementById('wordList');
    list.innerHTML = `
        <div class="study-header">
            <div class="study-progress">
                <span>${studyIndex + 1} / ${studyQueue.length}</span>
                <div class="progress-bar" style="flex:1;margin:0 12px">
                    <div class="progress-fill" style="width:${(studyIndex / studyQueue.length) * 100}%"></div>
                </div>
                <span class="study-score">
                    <span style="color:var(--success)">${sessionStats.correct}</span>
                    /
                    <span style="color:var(--danger)">${sessionStats.wrong}</span>
                </span>
            </div>
            ${isError ? '<div class="error-badge">🔴 错词复习</div>' : ''}
        </div>

        <div class="study-card">
            <div class="study-prompt">${word.zh}</div>
            ${word.example ? `<div class="study-example">${word.example}</div>` : ''}
            <input class="study-input" type="text" id="studyInput"
                placeholder="输入英文单词"
                autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" />
            <div class="study-hint">按回车确认</div>
            <div class="study-speak-row">
                <button class="icon-btn speak-btn study-speak" onclick="speak('${word.en.replace(/'/g, "\\'")}')">🔊 发音</button>
                <button class="icon-btn bank-btn ${Storage.isInBank(word.en) ? 'active' : ''}" onclick="toggleBankFromStudy('${word.en.replace(/'/g, "\\'")}')">${Storage.isInBank(word.en) ? '★' : '☆'}</button>
            </div>
        </div>

        <button class="btn btn-secondary" style="margin-top:12px" onclick="skipWord()">跳过</button>
        <button class="btn btn-secondary" style="margin-top:8px" onclick="endStudy()">结束学习</button>
    `;

    setTimeout(() => {
        const input = document.getElementById('studyInput');
        if (input) { input.focus(); input.value = ''; }
    }, 50);

    // Auto-play pronunciation
    setTimeout(() => speak(word.en), 300);
}

window.toggleBankFromStudy = function(wordEn) {
    if (Storage.isInBank(wordEn)) {
        Storage.removeFromBank(wordEn);
    } else {
        Storage.addToBank(wordEn);
    }
    // Update button
    const btn = document.querySelector('.bank-btn');
    if (btn) {
        btn.textContent = Storage.isInBank(wordEn) ? '★' : '☆';
        btn.classList.toggle('active', Storage.isInBank(wordEn));
    }
};

window.checkStudyAnswer = function() {
    const input = document.getElementById('studyInput');
    if (!input) return;
    const answer = input.value.trim().toLowerCase();
    const word = studyQueue[studyIndex];
    const correct = word.en.toLowerCase();

    if (answer === correct) {
        sessionStats.correct++;
        Storage.markCorrect(word.en);
        // Increment new word count if this was a new word
        const r = Storage.getReview(word.en);
        if (r && r.reps === 1) {
            Storage.incrementNewWordCount();
        }
        showStudyResult(true, word);
    } else {
        sessionStats.wrong++;
        Storage.markWrong(word.en);
        showStudyResult(false, word, correct, answer);
    }
};

function showStudyResult(isCorrect, word, correctAnswer, userAnswer) {
    const list = document.getElementById('wordList');
    list.innerHTML = `
        <div class="study-result ${isCorrect ? 'correct' : 'wrong'}">
            <div class="result-icon">${isCorrect ? '✓' : '✗'}</div>
            <div class="result-word">${word.en}</div>
            <div class="result-phon">${word.phon || ''} ${word.zh}</div>
            ${!isCorrect ? `<div class="result-wrong-msg">你的答案: ${userAnswer}</div>
                            <div class="result-correct-msg">正确答案: ${correctAnswer}</div>` : ''}
            ${word.example ? `<div class="result-example">${word.example}</div>` : ''}
            <div style="display:flex;gap:8px;margin-top:20px">
                <button class="icon-btn speak-btn" onclick="speak('${word.en.replace(/'/g, "\\'")}')" style="flex:1">🔊 再听一遍</button>
                <button class="icon-btn bank-btn ${Storage.isInBank(word.en) ? 'active' : ''}" onclick="toggleBankFromStudy('${word.en.replace(/'/g, "\\'")}')" style="flex:1">${Storage.isInBank(word.en) ? '★ 生词本' : '☆ 加入生词本'}</button>
            </div>
            <button class="btn btn-primary" style="margin-top:12px;width:100%" onclick="nextStudyCard()">下一个</button>
        </div>
    `;
}

window.nextStudyCard = function() {
    studyIndex++;
    showStudyCard();
};

window.skipWord = function() {
    studyIndex++;
    showStudyCard();
};

window.endStudy = function() {
    showStudyComplete();
};

function showStudyComplete() {
    const total = sessionStats.correct + sessionStats.wrong;
    const pct = total > 0 ? Math.round(sessionStats.correct / total * 100) : 0;
    const list = document.getElementById('wordList');

    // If no words were studied at all, go home
    if (total === 0) {
        renderHome();
        updateStats();
        return;
    }

    list.innerHTML = `
        <div class="study-complete">
            <div class="complete-score">${sessionStats.correct}/${total}</div>
            <div class="complete-pct">正确率 ${pct}%</div>
            ${pct >= 90 ? '<div class="complete-msg" style="color:var(--success)">太棒了！</div>' :
              pct >= 70 ? '<div class="complete-msg" style="color:var(--primary)">很不错！</div>' :
              '<div class="complete-msg" style="color:var(--warning)">继续加油！</div>'}
            <div style="display:flex;flex-direction:column;gap:10px;margin-top:24px">
                <button class="btn btn-primary" onclick="startStudy()">再练一轮</button>
                <button class="btn btn-secondary" onclick="renderHome();updateStats()">返回主页</button>
            </div>
        </div>
    `;

    updateStats();
    buildStudyQueue(); // refresh queue (errors removed if mastered)
}

// ========================
// WORD LIST (browse mode)
// ========================
function renderTabs() {
    const categories = [
        { id: 'all', name: '全部' },
        { id: 'wordbank', name: '生词本' },
        { id: 'errors', name: '错词本' },
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
        `<div class="category-tab ${c.id === currentCategory ? 'active' : ''}" onclick="selectCategory('${c.id}')">${c.name}</div>`
    ).join('');
}

function selectCategory(cat) {
    currentCategory = cat;
    renderTabs();
    renderWords();
}

function toggleBank(wordEn, event) {
    if (event) event.stopPropagation();
    if (Storage.isInBank(wordEn)) {
        Storage.removeFromBank(wordEn);
    } else {
        Storage.addToBank(wordEn);
    }
    renderWords();
    updateStats();
}

function renderWords() {
    // Don't render words if in study/home mode
    if (studyQueue.length === 0 || document.querySelector('.study-card')) return;

    const list = document.getElementById('wordList');
    if (!list) return;

    let words = [];
    if (currentCategory === 'all') {
        words = WORDS;
    } else if (currentCategory === 'wordbank') {
        words = WORDS.filter(w => Storage.isInBank(w.en));
    } else if (currentCategory === 'errors') {
        words = Storage.getErrorBookWords(WORDS);
    } else {
        words = WORDS.filter(w => w.category === currentCategory);
    }

    if (words.length === 0) {
        list.innerHTML = '<div class="empty-state">暂无词汇</div>';
        return;
    }

    list.innerHTML = words.map(w => {
        const inBank = Storage.isInBank(w.en);
        const mastered = Storage.isMastered(w.en);
        const review = Storage.getReview(w.en);
        const isError = Storage.getErrorBook().includes(w.en);

        return `
        <div class="word-card ${inBank ? 'in-bank' : ''} ${isError ? 'in-error' : ''}">
            <div class="word-main">
                <div class="word-en">
                    <span>${w.en}</span>
                    ${w.phon ? `<span class="word-phon">${w.phon}</span>` : ''}
                    ${mastered ? '<span class="mastered-badge">✓</span>' : ''}
                    ${isError ? '<span class="error-dot">●</span>' : ''}
                </div>
                <div class="word-zh">${w.zh}</div>
                ${w.example ? `<div class="word-example">${w.example}</div>` : ''}
                ${review && review.reps > 0 ? `<div class="word-review-info">已复习${review.reps}次 · 间隔${review.interval}天</div>` : ''}
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
        } else {
            showToast('发音不可用');
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
    const masteredCount = stats.mastered;
    const pct = stats.totalWords > 0 ? Math.round(masteredCount / stats.totalWords * 100) : 0;

    const totalEl = document.getElementById('totalCount');
    const learnedEl = document.getElementById('learnedCount');
    const bankEl = document.getElementById('bankCount');
    const streakEl = document.getElementById('streakCount');
    const progressText = document.getElementById('progressText');
    const circle = document.getElementById('progressCircle');

    if (totalEl) totalEl.textContent = stats.totalWords;
    if (learnedEl) learnedEl.textContent = masteredCount;
    if (bankEl) bankEl.textContent = stats.bankCount;
    if (streakEl) streakEl.textContent = stats.newWordToday + '/' + 10;
    if (progressText) progressText.textContent = pct + '%';
    if (circle) circle.style.strokeDashoffset = 100 * (1 - pct / 100);
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
    const saved = Storage.getTheme();
    setTheme(saved);
}

// ========================
// LOAD WORDS
// ========================
async function loadWords() {
    try {
        const response = await fetch('words.json');
        const data = await response.json();
        WORDS_VERSION = data.version;
        WORDS = data.words;
        const storedVersion = Storage.getWordsVersion();
        if (storedVersion !== WORDS_VERSION) {
            Storage.setWordsVersion(WORDS_VERSION);
        }
        return true;
    } catch (error) {
        console.error('Failed to load words:', error);
        return false;
    }
}

// ========================
// ERROR BOOK MODAL
// ========================
function showErrorBook() {
    const modal = document.getElementById('errorModal');
    const body = document.getElementById('errorBody');
    const errors = Storage.getErrorBookWords(WORDS);

    if (errors.length === 0) {
        body.innerHTML = '<div class="empty-state">错词本为空<br>做练习时答错的词会出现在这里</div>';
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
            <button class="btn btn-primary" style="margin-top:16px;width:100%" onclick="closeErrorBook();startStudy()">用练习复习错词</button>
        `;
    }

    modal.classList.add('show');
}

function closeErrorBook() {
    document.getElementById('errorModal').classList.remove('show');
    renderWords();
}

// ========================
// INPUT BINDING
// ========================
document.addEventListener('keydown', (e) => {
    const input = document.getElementById('studyInput');
    if (input && document.activeElement === input && e.key === 'Enter') {
        checkStudyAnswer();
    }
});

// ========================
// START
// ========================
document.addEventListener('DOMContentLoaded', init);
