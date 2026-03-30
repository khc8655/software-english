/**
 * App - Main application logic
 * Software English Learning
 */

let WORDS = [];
let WORDS_VERSION = '';
let currentCategory = 'all';
let currentIndex = 0;
let todayWords = [];

// Load words from JSON file
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

// Initialize today's words
function initTodayWords() {
    if (!Storage.isTodayWordsValid()) {
        todayWords = shuffleArray([...WORDS]).slice(0, Math.min(10, WORDS.length));
        Storage.setTodayWords(todayWords);
    } else {
        todayWords = Storage.getTodayWords();
    }
    return todayWords;
}

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// Get filtered words
function getFilteredWords() {
    if (currentCategory === 'all') return todayWords;
    if (currentCategory === 'wordbank') return todayWords.filter(w => Storage.isInBank(w.en));
    return todayWords.filter(w => w.category === currentCategory);
}

// Render category tabs
function renderTabs() {
    const categories = [
        { id: 'all', name: '全部' },
        { id: 'wordbank', name: '生词本' },
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
    tabs.innerHTML = categories.map(c =>
        `<div class="category-tab ${c.id === currentCategory ? 'active' : ''}" onclick="selectCategory('${c.id}')">${c.name}</div>`
    ).join('');
}

function selectCategory(cat) {
    currentCategory = cat;
    currentIndex = 0;
    renderTabs();
    renderWords();
    updateTodayCount();
}

// Toggle word bank status
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

// Render word cards
function renderWords() {
    const words = getFilteredWords();
    const learned = Storage.getLearned();
    const bank = Storage.getWordBank();
    const list = document.getElementById('wordList');

    if (words.length === 0) {
        if (currentCategory === 'wordbank') {
            list.innerHTML = '<div class="empty-state">生词本为空<br>点击词卡上的星号添加</div>';
        } else {
            list.innerHTML = '<div class="empty-state">该分类暂无词汇</div>';
        }
        return;
    }

    list.innerHTML = words.map((w, i) => {
        const inBank = bank.includes(w.en);
        const isLearned = learned.includes(w.en);
        return `
        <div class="word-card ${inBank ? 'in-bank' : ''}">
            <div class="word-main">
                <div class="word-en">
                    <span>${w.en}</span>
                    ${w.phon ? `<span class="word-phon">${w.phon}</span>` : ''}
                    ${isLearned ? '<span style="font-size:11px;color:var(--success);font-weight:normal;margin-left:4px">✓已掌握</span>' : ''}
                </div>
                <div class="word-zh">${w.zh}</div>
                ${w.example ? `<div class="word-example">${w.example}</div>` : ''}
            </div>
            <div class="card-actions">
                <button class="icon-btn speak-btn" onclick="speak('${w.en.replace(/'/g, "\\'")}')">🔊</button>
                <button class="icon-btn bank-btn ${inBank ? 'active' : ''}" onclick="toggleBank('${w.en.replace(/'/g, "\\'")}', event)">${inBank ? '★' : '☆'}</button>
            </div>
        </div>
    `}).join('');
}

// Text-to-speech - Youdao TTS (mobile compatible)
function speak(text) {
    const audioUrl = `https://dict.youdao.com/dictvoice?type=1&word=${encodeURIComponent(text)}`;
    const audio = new Audio(audioUrl);
    audio.play().catch(() => {
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-US';
            utterance.rate = 0.9;
            const voices = window.speechSynthesis.getVoices();
            const enVoice = voices.find(v => v.lang.includes('en') && v.lang.includes('US'))
                         || voices.find(v => v.lang.includes('en'));
            if (enVoice) utterance.voice = enVoice;
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
    toast.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: rgba(0,0,0,0.8); color: white; padding: 12px 24px;
        border-radius: 8px; font-size: 14px; z-index: 9999;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

// Preload voices
if (window.speechSynthesis) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}

// Update statistics display
function updateStats() {
    const stats = Storage.getStats();
    document.getElementById('totalCount').textContent = WORDS.length;
    document.getElementById('learnedCount').textContent = stats.totalLearned;
    document.getElementById('bankCount').textContent = stats.bankCount;
    document.getElementById('streakCount').textContent = stats.currentStreak;

    const pct = WORDS.length > 0 ? Math.round((stats.totalLearned / WORDS.length) * 100) : 0;
    document.getElementById('progressText').textContent = pct + '%';

    const circle = document.getElementById('progressCircle');
    const offset = 100 * (1 - pct / 100);
    circle.style.strokeDashoffset = offset;

    updateTodayCount();
}

function updateTodayCount() {
    const learned = Storage.getLearned();
    const todayLearned = todayWords.filter(w => learned.includes(w.en)).length;
    document.getElementById('todayCount').textContent = `${todayLearned}/${todayWords.length} 今日`;
}

// ============================================================
// QUIZ
// ============================================================
function showQuiz() {
    const modal = document.getElementById('quizModal');
    const body = document.getElementById('quizBody');

    // Quiz from learned words if >= 4, otherwise from all
    const learned = Storage.getLearned();
    const source = learned.length >= 4
        ? learned.map(en => WORDS.find(w => w.en === en)).filter(Boolean)
        : shuffleArray([...WORDS]).slice(0, 8);

    if (source.length < 4) {
        body.innerHTML = `
            <div style="text-align:center;padding:30px">
                <p style="color:var(--text-secondary);margin-bottom:16px">请先学习至少4个词汇</p>
                <button class="btn btn-primary" onclick="closeQuiz()">好的</button>
            </div>
        `;
    } else {
        startQuiz(shuffleArray([...source]).slice(0, Math.min(8, source.length)), body);
    }

    modal.classList.add('show');
}

function startQuiz(quizWords, body) {
    let current = 0;
    let correct = 0;

    function renderQuestion() {
        const word = quizWords[current];
        const others = WORDS.filter(w => w.en !== word.en).slice(0, 3);
        const options = shuffleArray([word.en, ...others.map(w => w.en)]);
        const correctIdx = options.indexOf(word.en);

        body.innerHTML = `
            <div class="quiz-question">"${word.zh}" 的英文是？</div>
            ${word.example ? `<div style="text-align:center;font-size:13px;color:var(--text-secondary);margin-bottom:12px">${word.example}</div>` : ''}
            <div class="quiz-options">
                ${options.map((opt, i) => `<div class="quiz-option" data-correct="${i === correctIdx}" onclick="checkAnswer(this, ${i === correctIdx})">${opt}</div>`).join('')}
            </div>
            <div style="text-align:center;margin-top:16px">
                <span style="color:var(--text-secondary);font-size:13px">${current + 1} / ${quizWords.length}</span>
                <div class="progress-bar" style="margin-top:8px">
                    <div class="progress-fill" style="width:${(current / quizWords.length) * 100}%"></div>
                </div>
            </div>
        `;
    }

    window.checkAnswer = function(el, isCorrect) {
        if (isCorrect) {
            el.classList.add('correct');
            correct++;
            Storage.markWordLearned(quizWords[current].en);
            Storage.updateStreak();
        } else {
            el.classList.add('wrong');
            document.querySelectorAll('.quiz-option').forEach(opt => {
                if (opt.dataset.correct === 'true') opt.classList.add('correct');
            });
        }

        setTimeout(() => {
            current++;
            if (current < quizWords.length) {
                renderQuestion();
            } else {
                const pct = Math.round(correct / quizWords.length * 100);
                body.innerHTML = `
                    <div style="text-align:center;padding:20px">
                        <div class="quiz-score">${correct}/${quizWords.length}</div>
                        <p style="color:var(--text-secondary);margin-top:8px">正确率 ${pct}%</p>
                        ${pct >= 80 ? '<p style="color:var(--success);margin-top:8px">掌握良好！</p>' : '<p style="color:var(--warning);margin-top:8px">继续加油！</p>'}
                        <button class="btn btn-primary" style="margin-top:20px" onclick="closeQuiz()">完成</button>
                    </div>
                `;
                updateStats();
            }
        }, 600);
    };

    renderQuestion();
}

function closeQuiz() {
    document.getElementById('quizModal').classList.remove('show');
    updateStats();
    renderWords();
}

// ============================================================
// SPELLING TEST (听写)
// ============================================================
function showSpell() {
    const modal = document.getElementById('spellModal');
    const body = document.getElementById('spellBody');

    // Source: word bank if has >= 4, else today's words, else all
    const bank = Storage.getWordBank();
    const learned = Storage.getLearned();

    let source;
    if (bank.length >= 4) {
        source = bank.map(en => WORDS.find(w => w.en === en)).filter(Boolean);
    } else if (todayWords.length >= 4) {
        source = [...todayWords];
    } else {
        source = shuffleArray([...WORDS]).slice(0, 8);
    }

    if (source.length < 4) {
        body.innerHTML = `
            <div style="text-align:center;padding:30px">
                <p style="color:var(--text-secondary);margin-bottom:16px">词汇不足4个，无法听写</p>
                <button class="btn btn-primary" onclick="closeSpell()">好的</button>
            </div>
        `;
    } else {
        startSpell(shuffleArray([...source]).slice(0, Math.min(10, source.length)), body);
    }

    modal.classList.add('show');
}

function startSpell(spellWords, body) {
    let current = 0;
    let correct = 0;

    function renderSpell() {
        const word = spellWords[current];

        body.innerHTML = `
            <div style="text-align:center;margin-bottom:12px">
                <span style="color:var(--text-secondary);font-size:13px">${current + 1} / ${spellWords.length}</span>
                <div class="progress-bar" style="margin-top:8px">
                    <div class="progress-fill" style="width:${(current / spellWords.length) * 100}%"></div>
                </div>
            </div>
            <div class="spell-prompt">${word.zh}</div>
            ${word.example ? `<div style="text-align:center;font-size:13px;color:var(--text-secondary);margin-bottom:16px">${word.example}</div>` : '<div style="margin-bottom:16px"></div>'}
            <input class="spell-input" type="text" id="spellInput" placeholder="输入英文单词" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" />
            <div class="spell-hint">输入后按回车或点击确认</div>
            <button class="btn btn-primary" onclick="checkSpell()">确认</button>
        `;

        setTimeout(() => {
            const input = document.getElementById('spellInput');
            if (input) {
                input.focus();
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') checkSpell();
                });
            }
        }, 50);
    }

    window.checkSpell = function() {
        const input = document.getElementById('spellInput');
        if (!input) return;
        const answer = input.value.trim().toLowerCase();
        const word = spellWords[current];
        const correctAnswer = word.en.toLowerCase();

        if (answer === correctAnswer) {
            correct++;
            Storage.markWordLearned(word.en);
            Storage.updateStreak();
            showSpellResult(true, word.en);
        } else {
            showSpellResult(false, word.en, correctAnswer);
        }
    };

    function showSpellResult(isCorrect, wordEn, correctAnswer) {
        body.innerHTML = `
            <div class="spell-result ${isCorrect ? 'correct' : 'wrong'}">
                ${isCorrect
                    ? `<div style="font-size:48px">✓</div><div style="font-size:18px;font-weight:600;margin-top:8px">正确！</div>`
                    : `<div style="font-size:48px">✗</div><div style="font-size:18px;font-weight:600;margin-top:8px">错误</div>
                       <div class="spell-answer">正确答案：${correctAnswer}</div>`
                }
                <div style="margin-top:12px;font-size:15px">${wordEn} — ${spellWords[current].zh}</div>
                <button class="btn btn-primary" style="margin-top:20px" onclick="nextSpell()">${current + 1 < spellWords.length ? '下一个' : '查看结果'}</button>
            </div>
        `;
    }

    window.nextSpell = function() {
        current++;
        if (current < spellWords.length) {
            renderSpell();
        } else {
            const pct = Math.round(correct / spellWords.length * 100);
            body.innerHTML = `
                <div style="text-align:center;padding:20px">
                    <div class="spell-score">${correct}/${spellWords.length}</div>
                    <p style="color:var(--text-secondary);margin-top:8px">正确率 ${pct}%</p>
                    ${pct >= 80 ? '<p style="color:var(--success);margin-top:8px">掌握良好！</p>' : '<p style="color:var(--warning);margin-top:8px">继续加油！</p>'}
                    <button class="btn btn-primary" style="margin-top:20px" onclick="closeSpell()">完成</button>
                </div>
            `;
            updateStats();
        }
    };

    renderSpell();
}

function closeSpell() {
    document.getElementById('spellModal').classList.remove('show');
    updateStats();
    renderWords();
}

// ============================================================
// WORD BANK
// ============================================================
function showBank() {
    const modal = document.getElementById('bankModal');
    const body = document.getElementById('bankBody');
    const bank = Storage.getWordBank();

    if (bank.length === 0) {
        body.innerHTML = `
            <div style="text-align:center;padding:30px;color:var(--text-secondary)">
                <p>生词本为空</p>
                <p style="font-size:13px;margin-top:8px">浏览词汇时点击星号添加</p>
            </div>
        `;
    } else {
        const bankWords = bank.map(en => WORDS.find(w => w.en === en)).filter(Boolean);
        body.innerHTML = `
            <div style="margin-bottom:12px;color:var(--text-secondary);font-size:13px">共 ${bank.length} 个生词</div>
            <div class="card-grid">
                ${bankWords.map(w => `
                    <div class="word-card in-bank">
                        <div class="word-main">
                            <div class="word-en">
                                <span>${w.en}</span>
                                ${w.phon ? `<span class="word-phon">${w.phon}</span>` : ''}
                            </div>
                            <div class="word-zh">${w.zh}</div>
                        </div>
                        <div class="card-actions">
                            <button class="icon-btn speak-btn" onclick="speak('${w.en.replace(/'/g, "\\'")}')">🔊</button>
                            <button class="icon-btn bank-btn active" onclick="closeBank();toggleBank('${w.en.replace(/'/g, "\\'")}', event)">★</button>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div style="margin-top:16px;text-align:center">
                <button class="btn btn-warning" onclick="closeBank();showSpell()">用听写复习</button>
            </div>
        `;
    }

    modal.classList.add('show');
}

function closeBank() {
    document.getElementById('bankModal').classList.remove('show');
    renderWords();
    updateStats();
}

// ============================================================
// HISTORY
// ============================================================
function showHistory() {
    const history = Storage.getHistory();
    const modal = document.getElementById('historyModal');
    const body = document.getElementById('historyBody');

    const learned = history.learned.slice(-30).reverse();

    if (learned.length === 0) {
        body.innerHTML = '<div class="empty-state">暂无学习记录</div>';
    } else {
        body.innerHTML = `
            <div class="history-list">
                ${learned.map(entry => `
                    <div class="history-item">
                        <span class="history-word">${entry.word}</span>
                        <span class="history-date">${entry.date}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    modal.classList.remove('show');
    setTimeout(() => modal.classList.add('show'), 10);
}

function closeHistory() {
    document.getElementById('historyModal').classList.remove('show');
}

// ============================================================
// THEME
// ============================================================
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

// ============================================================
// INIT
// ============================================================
async function init() {
    const loaded = await loadWords();
    if (!loaded) {
        document.getElementById('wordList').innerHTML = '<div class="empty-state">加载词库失败，请刷新重试</div>';
        return;
    }

    initTodayWords();

    renderTabs();
    renderWords();
    updateStats();
    loadTheme();

    console.log(`Loaded ${WORDS.length} words, version ${WORDS_VERSION}`);
}

document.addEventListener('DOMContentLoaded', init);
