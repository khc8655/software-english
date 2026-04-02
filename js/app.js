/**
 * App - Main application logic
 * Learn first → Practice → SM-2 Spaced Repetition
 */

let WORDS = [];
let WORDS_VERSION = '';
let studyQueue = [];
let learnIndex = 0;
let sessionStats = { correct: 0, wrong: 0 };
let currentView = 'idle';
let currentBrowseCategory = 'all';
let learnedSessionQueue = []; // words browsed in current learn session

// ========================
// INIT
// ========================
async function init() {
    Storage._checkDateChange();

    const loaded = await loadWords();
    if (!loaded) {
        document.getElementById('app').innerHTML = '<div class="empty-state">加载词库失败，请刷新重试</div>';
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

    // Only add new words when error book is empty — focus on errors first
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

// ========================
// BOTTOM BAR
// ========================
function updateBottomBar(view) {
    const mainBtn = document.getElementById('bottomMainBtn');
    if (!mainBtn) return;

    if (view === 'idle') {
        mainBtn.textContent = '开始学习';
        mainBtn.className = 'btn btn-primary';
        mainBtn.style.display = '';
        mainBtn.onclick = startLearnMode;
    } else if (view === 'learn') {
        mainBtn.textContent = '退出';
        mainBtn.className = 'btn btn-secondary';
        mainBtn.style.display = '';
        mainBtn.onclick = exitToHome;
    } else if (view === 'learn-complete') {
        mainBtn.textContent = '开始练习';
        mainBtn.className = 'btn btn-primary';
        mainBtn.style.display = '';
        mainBtn.onclick = startPracticeMode;
    } else if (view === 'practice') {
        mainBtn.textContent = '退出';
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

// ========================
// HOME
// ========================
function getGreeting() {
    const h = new Date().getHours();
    if (h < 6) return '夜深了';
    if (h < 9) return '早上好';
    if (h < 12) return '上午好';
    if (h < 14) return '中午好';
    if (h < 18) return '下午好';
    if (h < 22) return '晚上好';
    return '夜深了';
}

function getDateStr() {
    const now = new Date();
    return `${now.getMonth()+1}月${now.getDate()}日 ${['周日','周一','周二','周三','周四','周五','周六'][now.getDay()]}`;
}

function showHome() {
    currentView = 'idle';
    const stats = Storage.getStats(WORDS);
    const pct = stats.totalWords > 0 ? Math.round(stats.mastered / stats.totalWords * 100) : 0;
    const todayReview = stats.dueCount + stats.errorCount;
    const hasTask = todayReview > 0 || stats.newWordToday < 10;

    const app = document.getElementById('app');
    app.innerHTML = `
        <!-- Hero -->
        <div class="hero">
            <div class="hero-greeting">${getGreeting()}</div>
            <div class="hero-date">${getDateStr()} · 学习第${stats.learnDays}天</div>
            <div class="hero-stats">
                <div class="hero-stat">
                    <div class="hero-stat-num">${stats.learnDays}</div>
                    <div class="hero-stat-lbl">学习天数</div>
                </div>
                <div class="hero-stat">
                    <div class="hero-stat-num">${stats.mastered}</div>
                    <div class="hero-stat-lbl">已掌握</div>
                </div>
                <div class="hero-stat">
                    <div class="hero-stat-num">${todayReview}</div>
                    <div class="hero-stat-lbl">${todayReview > 0 ? '待复习' : '无待复习'}</div>
                </div>
                <div class="hero-stat">
                    <div class="hero-stat-num">${stats.totalReviews}</div>
                    <div class="hero-stat-lbl">复习次数</div>
                </div>
            </div>
            <div class="hero-progress">
                <div class="hero-progress-bar">
                    <div class="hero-progress-fill" style="width:${pct}%"></div>
                </div>
                <div class="hero-progress-text">掌握进度 ${pct}% · ${stats.totalWords}词总词库</div>
            </div>
        </div>

        <!-- Quick Actions -->
        <div class="quick-actions">
            <button class="quick-btn" onclick="showWordBank()">
                <div class="quick-btn-icon warning">★</div>
                <div class="quick-btn-text">
                    <div class="quick-btn-title">生词本</div>
                    <div class="quick-btn-desc">${stats.bankCount > 0 ? '已收藏'+stats.bankCount+'词' : '点击收藏生词'}</div>
                </div>
                ${stats.bankCount > 0 ? '<span class="quick-btn-badge warning">'+stats.bankCount+'</span>' : ''}
            </button>
            <button class="quick-btn" onclick="showErrorBook()">
                <div class="quick-btn-icon danger">✗</div>
                <div class="quick-btn-text">
                    <div class="quick-btn-title">错词本</div>
                    <div class="quick-btn-desc">${stats.errorCount > 0 ? '还需加强'+stats.errorCount+'词' : '继续保持'}</div>
                </div>
                ${stats.errorCount > 0 ? '<span class="quick-btn-badge danger">'+stats.errorCount+'</span>' : ''}
            </button>
        </div>

        ${hasTask ? `
        <div style="background:var(--card);border-radius:14px;padding:16px;margin-bottom:14px;box-shadow:0 1px 4px rgba(0,0,0,0.08)">
            <div style="font-size:14px;font-weight:600;margin-bottom:4px">
                ${todayReview > 0 ? '今日复习任务' : '今日新词任务'}
            </div>
            <div style="font-size:12px;color:var(--text-secondary);margin-bottom:10px">
                ${todayReview > 0 ? '复习'+todayReview+'词' : '还可学'+(10-stats.newWordToday)+'个新词'}
            </div>
            <button class="btn btn-primary" style="width:100%;padding:12px" onclick="startLearnMode()">
                ${todayReview > 0 ? '开始复习 →' : '开始学习 →'}
            </button>
        </div>
        ` : `
        <div style="background:linear-gradient(135deg,rgba(52,199,89,0.08),rgba(52,199,89,0.03));border-radius:14px;padding:16px;margin-bottom:14px;text-align:center">
            <div style="font-size:15px;font-weight:600;color:var(--success);margin-bottom:2px">今日任务已完成</div>
            <div style="font-size:12px;color:var(--text-secondary)">明天再来，继续保持</div>
        </div>
        `}

        <!-- Browse -->
        <div class="section-title">词库分类</div>
        <div class="category-tabs" id="categoryTabs"></div>
        <div class="card-grid" id="browseWordList"></div>
    `;

    renderTabs();
    renderBrowseWords();
    updateBottomBar('idle');
}

// ========================
// WORD BANK MODAL
// ========================
function showWordBank() {
    document.getElementById('errorModal').classList.remove('show');
    const modal = document.getElementById('bankModal');
    const body = document.getElementById('bankBody');
    const bankWords = WORDS.filter(w => Storage.isInBank(w.en));
    const stats = Storage.getStats(WORDS);

    if (bankWords.length === 0) {
        body.innerHTML = `
            <div style="text-align:center;padding:32px 16px">
                <div style="font-size:52px;margin-bottom:10px">☆</div>
                <div style="font-size:17px;font-weight:600;margin-bottom:4px">生词本为空</div>
                <div style="font-size:13px;color:var(--text-secondary)">在学习或浏览时点击星标收藏单词</div>
                <button class="btn btn-primary" style="margin-top:16px;width:100%;padding:12px" onclick="closeBankBook()">知道了</button>
            </div>`;
    } else {
        const masteredCount = bankWords.filter(w => Storage.isMastered(w.en)).length;
        const cards = bankWords.map(w => {
            const mastered = Storage.isMastered(w.en);
            const review = Storage.getReview(w.en);
            return `
            <div class="modal-card">
                <div class="modal-card-top">
                    <div>
                        <div class="modal-card-en">${w.en} ${mastered ? '<span style="font-size:12px;color:var(--success);font-weight:normal">✓</span>' : ''}</div>
                        ${w.phon ? `<div class="modal-card-phon">${w.phon}</div>` : ''}
                    </div>
                    <button class="icon-btn speak-btn" onclick="speak('${w.en.replace(/'/g, "\\'")}')">🔊</button>
                </div>
                <div class="modal-card-zh">${w.zh}</div>
                ${w.example ? `<div class="modal-card-example">${w.example}</div>` : ''}
                <div class="modal-card-actions">
                    <button class="btn btn-secondary" style="flex:1;padding:8px;font-size:13px" onclick="toggleBankFromWordBank('${w.en.replace(/'/g, "\\'")}')">移出生词本</button>
                    ${review && review.reps > 0 ? `<div style="font-size:11px;color:var(--text-secondary);padding:0 4px">复习${review.reps}次</div>` : ''}
                </div>
            </div>`;
        }).join('');

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
            ${cards}
            <button class="btn btn-primary" style="margin-top:12px;width:100%;padding:12px" onclick="closeBankBook()">完成</button>
        `;
    }

    modal.classList.add('show');
}

window.toggleBankFromWordBank = function(en) {
    Storage.removeFromBank(en);
    showWordBank();
};

function closeBankBook() {
    document.getElementById('bankModal').classList.remove('show');
    if (currentView === 'idle') showHome();
}

// ========================
// ERROR BOOK
// ========================
function showErrorBook() {
    document.getElementById('bankModal').classList.remove('show');
    const modal = document.getElementById('errorModal');
    const body = document.getElementById('errorBody');
    const errors = Storage.getErrorBookWords(WORDS);

    if (errors.length === 0) {
        body.innerHTML = `
            <div style="text-align:center;padding:40px 20px">
                <div style="font-size:52px;margin-bottom:10px">🎉</div>
                <div style="font-size:17px;font-weight:600;margin-bottom:4px">错词本很干净</div>
                <div style="font-size:13px;color:var(--text-secondary)">继续保持，全部掌握指日可待</div>
                <button class="btn btn-primary" style="margin-top:16px;width:100%;padding:12px" onclick="closeErrorBook()">太棒了</button>
            </div>`;
    } else {
        const cards = errors.map(w => {
            const review = Storage.getReview(w.en);
            const reps = review ? review.reps : 0;
            const interval = review ? review.interval : 0;
            const inBank = Storage.isInBank(w.en);
            return `
            <div class="modal-card" style="border-left:3px solid var(--danger)">
                <div class="modal-card-top">
                    <div>
                        <div class="modal-card-en">${w.en}</div>
                        ${w.phon ? `<div class="modal-card-phon">${w.phon}</div>` : ''}
                    </div>
                    <div style="display:flex;gap:6px">
                        ${inBank ? '<span style="font-size:12px;color:var(--warning)">★</span>' : ''}
                        <button class="icon-btn speak-btn" onclick="speak('${w.en.replace(/'/g, "\\'")}')">🔊</button>
                    </div>
                </div>
                <div class="modal-card-zh">${w.zh}</div>
                ${w.example ? `<div class="modal-card-example">${w.example}</div>` : ''}
                <div class="modal-card-actions">
                    <button class="btn btn-secondary bank-toggle" style="flex:1;padding:8px;font-size:13px">${inBank ? '★ 移出' : '☆ 收藏'}</button>
                    <div style="font-size:11px;color:var(--text-secondary);padding:0 4px">复习${reps}次</div>
                </div>
            </div>`;
        }).join('');

        body.innerHTML = `
            <div style="background:linear-gradient(135deg,rgba(255,59,48,0.08),rgba(255,59,48,0.03));border-radius:14px;padding:14px 16px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center">
                <div>
                    <div style="font-size:15px;font-weight:600;color:var(--danger)">错词本</div>
                    <div style="font-size:12px;color:var(--text-secondary);margin-top:1px">这些词还需继续练习</div>
                </div>
                <div style="text-align:center">
                    <div style="font-size:28px;font-weight:700;color:var(--danger)">${errors.length}</div>
                    <div style="font-size:11px;color:var(--text-secondary)">个错词</div>
                </div>
            </div>
            ${cards}
            <button class="btn btn-primary" style="margin-top:12px;width:100%;padding:12px" onclick="closeErrorBook();buildStudyQueue();startPracticeMode()">用练习复习</button>
        `;
    }

    modal.classList.add('show');
}

window.toggleBankErrorWord = function(en) {
    if (Storage.isInBank(en)) {
        Storage.removeFromBank(en);
    } else {
        Storage.addToBank(en);
    }
    showErrorBook();
};

function closeErrorBook() {
    document.getElementById('errorModal').classList.remove('show');
    if (currentView === 'idle') showHome();
}

// ========================
// LEARN MODE
// ========================
function startLearnMode() {
    if (studyQueue.length === 0) {
        buildStudyQueue();
    }
    learnIndex = 0;
    learnedSessionQueue = [];
    sessionStats = { correct: 0, wrong: 0 };

    // 如果队列中没有新词（只有复习词），直接进入练习
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

    const card1 = word1 ? `
        <div class="learn-card">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
                <div class="learn-word">${word1.en}
                    ${Storage.getErrorBook().includes(word1.en) ? '<span style="font-size:11px;color:var(--danger);background:rgba(255,59,48,0.1);padding:2px 8px;border-radius:8px;margin-left:6px;font-weight:normal">错</span>' : ''}
                </div>
                <button class="icon-btn bank-btn" id="bank1" style="width:36px;height:36px">${Storage.isInBank(word1.en) ? '★' : '☆'}</button>
            </div>
            ${word1.phon ? `<div class="learn-phon">${word1.phon}</div>` : ''}
            <div class="learn-zh">${word1.zh}</div>
            ${word1.example ? `<div class="learn-example">${word1.example}</div>` : ''}
            <div class="learn-actions">
                <button class="btn btn-primary" onclick="speak('${word1.en.replace(/'/g, "\\'")}')" style="padding:9px 16px;font-size:14px">🔊 发音</button>
            </div>
        </div>` : '';

    const card2 = word2 ? `
        <div class="learn-card">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
                <div class="learn-word">${word2.en}
                    ${Storage.getErrorBook().includes(word2.en) ? '<span style="font-size:11px;color:var(--danger);background:rgba(255,59,48,0.1);padding:2px 8px;border-radius:8px;margin-left:6px;font-weight:normal">错</span>' : ''}
                </div>
                <button class="icon-btn bank-btn" id="bank2" style="width:36px;height:36px">${Storage.isInBank(word2.en) ? '★' : '☆'}</button>
            </div>
            ${word2.phon ? `<div class="learn-phon">${word2.phon}</div>` : ''}
            <div class="learn-zh">${word2.zh}</div>
            ${word2.example ? `<div class="learn-example">${word2.example}</div>` : ''}
            <div class="learn-actions">
                <button class="btn btn-primary" onclick="speak('${word2.en.replace(/'/g, "\\'")}')" style="padding:9px 16px;font-size:14px">🔊 发音</button>
            </div>
        </div>` : '';

    app.innerHTML = `
        <div class="learn-header">
            <span>学习 ${learnIndex + 1}–${Math.min(learnIndex + 2, studyQueue.length)} / ${studyQueue.length}</span>
            <div class="progress-bar" style="flex:1;margin:0 12px">
                <div class="progress-fill" style="width:${(learnIndex / studyQueue.length) * 100}%"></div>
            </div>
        </div>
        <div class="learn-grid">
            ${card1}
            ${card2}
        </div>
        <div style="display:flex;gap:8px;margin-top:12px">
            <button class="btn btn-secondary" style="flex:1" onclick="showLearnComplete()">跳过 → 练习</button>
            <button class="btn btn-primary" style="flex:1" onclick="nextLearnCards()">记住了 →</button>
        </div>
    `;

    updateBottomBar('learn');
}

window.nextLearnCards = function() {
    // Track words just browsed in this learn step
    const w1 = studyQueue[learnIndex];
    const w2 = studyQueue[learnIndex + 1];
    if (w1 && !learnedSessionQueue.find(q => q.en === w1.en)) {
        learnedSessionQueue.push(w1);
    }
    if (w2 && !learnedSessionQueue.find(q => q.en === w2.en)) {
        learnedSessionQueue.push(w2);
    }
    learnIndex += 2;
    showLearnCards();
};

function showLearnComplete() {
    // Add any words that were shown but not yet marked "记住了"
    for (let i = learnIndex; i < studyQueue.length; i++) {
        const w = studyQueue[i];
        if (!learnedSessionQueue.find(q => q.en === w.en)) {
            learnedSessionQueue.push(w);
        }
    }
    currentView = 'learn-complete';
    const count = learnedSessionQueue.length;
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="learn-complete" style="margin-top:20px">
            <div style="font-size:48px;margin-bottom:8px">📖</div>
            <div class="complete-title">学习完毕</div>
            <div class="complete-sub">本轮已标记 ${count} 个词汇</div>
            <div style="font-size:12px;color:var(--text-secondary);margin-top:6px">拼写测试只测这 ${count} 个词</div>
            <button class="btn btn-primary" style="margin-top:20px;width:100%;padding:14px;font-size:16px" onclick="startPracticeMode()">开始拼写练习 →</button>
            <button class="btn btn-secondary" style="margin-top:8px;width:100%;padding:12px" onclick="exitToHome()">返回首页</button>
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
    // Always practice only words marked as "记住了" in this learn session
    // Fallback to learn queue only if nothing was explicitly marked
    if (learnedSessionQueue.length > 0) {
        studyQueue = learnedSessionQueue.slice();
    } else {
        // No words marked "记住了" — practice what was browsed in this session only
        const remaining = studyQueue.slice(learnIndex);
        if (remaining.length > 0) {
            studyQueue = remaining;
        }
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
            <input class="study-input" type="text" id="studyInput"
                placeholder="输入英文单词"
                autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" />
            <button class="btn btn-primary" onclick="checkPracticeAnswer()" style="width:100%;margin-top:10px;padding:12px;font-size:16px">确认</button>
            <div class="study-speak">
                <button class="icon-btn speak-btn" onclick="speak('${word.en.replace(/'/g, "\\'")}')" style="width:40px;height:40px">🔊 发音</button>
            </div>
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
            <div class="result-phon">${word.phon || ''} ${word.zh}</div>
            ${!isCorrect ? `<div class="result-wrong-msg">你的: ${userAnswer}</div>
                            <div class="result-correct-msg">正确: ${correctAnswer}</div>` : ''}
            <button class="icon-btn speak-btn" onclick="speak('${word.en.replace(/'/g, "\\'")}')" style="width:40px;height:40px;margin:10px auto 0">🔊</button>
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

    const msg = pct >= 90 ? '<div class="complete-msg" style="color:var(--success)">太棒了！</div>' :
                pct >= 70 ? '<div class="complete-msg" style="color:var(--primary)">很不错！</div>' :
                '<div class="complete-msg" style="color:var(--warning)">继续加油！</div>';

    app.innerHTML = `
        <div class="study-complete" style="margin-top:20px">
            <div class="complete-score">${sessionStats.correct}/${total}</div>
            <div class="complete-pct">正确率 ${pct}%</div>
            ${msg}
            <button class="btn btn-primary" style="margin-top:20px;width:100%;padding:12px" onclick="buildStudyQueue();showHome()">返回首页</button>
        </div>
    `;

    learnedSessionQueue = [];
    buildStudyQueue();
    updateBottomBar('practice-complete');
}

// ========================
// BROWSE
// ========================
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
        { id: 'git', name: 'Git' }
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
        const emptyMsg = currentBrowseCategory === 'wordbank' ? '生词本为空，学习时收藏单词吧' :
                        currentBrowseCategory === 'errors' ? '错词本为空，继续保持' :
                        '该分类暂无词汇';
        list.innerHTML = `<div class="empty-state">${emptyMsg}</div>`;
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
                <button class="icon-btn bank-btn ${inBank ? 'active' : ''}">${inBank ? '★' : '☆'}</button>
            </div>
        </div>`;
    }).join('');
}

// ========================
// TTS
// ========================
function speak(text) {
    // Multi-word phrases (contains space): use Web Speech API directly
    // Single words: try Youdao first, fall back to Web Speech API
    const isMultiWord = text.includes(' ');
    if (isMultiWord) {
        // Use Web Speech API for multi-word phrases
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-US';
            utterance.rate = 0.9;
            window.speechSynthesis.speak(utterance);
        }
        return;
    }
    // Single word: try Youdao first, then Web Speech API
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
// DELEGATED BANK BUTTON
// ========================
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.bank-btn, .bank-toggle');
    if (!btn) return;

    // Find the word
    const card = btn.closest('.word-card, .learn-card, .modal-card');
    if (!card) return;

    let wordEl = card.querySelector('.learn-word, .word-en > span, .modal-card-en');
    if (!wordEl) return;

    let en = wordEl.textContent.trim();
    en = en.replace(/错$/, '').trim();
    if (!en) return;

    if (Storage.isInBank(en)) {
        Storage.removeFromBank(en);
    } else {
        Storage.addToBank(en);
    }

    if (document.getElementById('bankModal').classList.contains('show')) {
        showWordBank();
    } else if (document.getElementById('errorModal').classList.contains('show')) {
        showErrorBook();
    } else if (currentView === 'learn') {
        showLearnCards();
    } else if (currentView === 'idle') {
        renderBrowseWords();
    }
});

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
