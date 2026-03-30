/**
 * App - Main application logic
 * Loads words.json and renders the UI
 */

// Global state
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
        
        // Check if words.json was updated
        const storedVersion = Storage.getWordsVersion();
        if (storedVersion !== WORDS_VERSION) {
            console.log(`Words updated: ${storedVersion} -> ${WORDS_VERSION}`);
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
        // New day, generate new words
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

// Get filtered words by category
function getFilteredWords() {
    if (currentCategory === 'all') return todayWords;
    return todayWords.filter(w => w.category === currentCategory);
}

// Render category tabs
function renderTabs() {
    const categories = [
        { id: 'all', name: '全部' },
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

// Render word cards
function renderWords() {
    const words = getFilteredWords();
    const learned = Storage.getLearned();
    const list = document.getElementById('wordList');
    
    if (words.length === 0) {
        list.innerHTML = '<div class="empty-state">该分类暂无词汇</div>';
        return;
    }
    
    list.innerHTML = words.map((w, i) => `
        <div class="word-card ${learned.includes(w.en) ? 'learned' : ''}" onclick="toggleLearn('${w.en.replace(/'/g, "\\'")}')">
            <div class="word-en">
                <span>${w.en}</span>
                <button class="speaker-btn" onclick="event.stopPropagation(); speak('${w.en.replace(/'/g, "\\'")}')">发音</button>
            </div>
            ${w.phon ? `<div class="word-phon">[${w.phon}]</div>` : ''}
            <div class="word-zh">${w.zh}</div>
            <div class="word-example">${w.example}</div>
            <div class="word-tags">
                ${w.tags.map(t => `<span class="tag ${t}">${t}</span>`).join('')}
            </div>
        </div>
    `).join('');
}

// Toggle learned status
function toggleLearn(wordEn) {
    const learned = Storage.getLearned();
    if (learned.includes(wordEn)) {
        Storage.unmarkWordLearned(wordEn);
    } else {
        Storage.markWordLearned(wordEn);
        Storage.addReview(wordEn);
        Storage.updateStreak();
    }
    renderWords();
    updateStats();
}

// Update statistics display
function updateStats() {
    const stats = Storage.getStats();
    document.getElementById('totalCount').textContent = WORDS.length;
    document.getElementById('learnedCount').textContent = stats.totalLearned;
    document.getElementById('streakCount').textContent = stats.currentStreak;
    
    const pct = WORDS.length > 0 ? Math.round((stats.totalLearned / WORDS.length) * 100) : 0;
    document.getElementById('progressText').textContent = pct + '%';
    
    const circle = document.getElementById('progressCircle');
    const offset = 163.36 * (1 - pct / 100);
    circle.style.strokeDashoffset = offset;
    
    updateTodayCount();
}

function updateTodayCount() {
    const learned = Storage.getLearned();
    const todayLearned = todayWords.filter(w => learned.includes(w.en)).length;
    document.getElementById('todayCount').textContent = `${todayLearned}/${todayWords.length} 今日`;
}

// Theme management
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

// Text-to-speech
function speak(text) {
    // Primary: Youdao TTS (free, works on mobile)
    const audioUrl = `https://dict.youdao.com/dictvoice?type=1&word=${encodeURIComponent(text)}`;
    const audio = new Audio(audioUrl);
    audio.play().catch(() => {
        // Fallback: try Web Speech API
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
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 9999;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

// Preload voices
if (window.speechSynthesis) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}

// Next word navigation
function nextWord() {
    const words = getFilteredWords();
    if (words.length === 0) return;
    currentIndex = (currentIndex + 1) % words.length;
    const cards = document.querySelectorAll('.word-card');
    if (cards[currentIndex]) {
        cards[currentIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// Quiz functionality
function showQuiz() {
    const modal = document.getElementById('quizModal');
    const body = document.getElementById('quizBody');
    const learned = Storage.getLearned();
    
    // Quiz from learned words only
    const quizWords = learned.length >= 4 
        ? shuffleArray([...learned]).slice(0, 5).map(en => WORDS.find(w => w.en === en))
        : shuffleArray([...WORDS]).slice(0, 5);
    
    if (quizWords.length < 4) {
        body.innerHTML = `
            <div class="quiz-result">
                <p>请先学习至少4个词汇</p>
                <button class="btn btn-primary" style="margin-top:20px" onclick="closeQuiz()">好的</button>
            </div>
        `;
    } else {
        startQuiz(quizWords, body);
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
            <div class="quiz-options">
                ${options.map((opt, i) => `<div class="quiz-option" data-correct="${i === correctIdx}" onclick="checkAnswer(this, ${i === correctIdx})">${opt}</div>`).join('')}
            </div>
            <div style="text-align:center;margin-top:20px">
                <span>${current + 1} / ${quizWords.length}</span>
            </div>
        `;
    }
    
    window.checkAnswer = function(el, isCorrect) {
        if (isCorrect) {
            el.classList.add('correct');
            correct++;
            Storage.addReview(el.textContent);
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
                body.innerHTML = `
                    <div class="quiz-result">
                        <div class="quiz-score">${correct}/${quizWords.length}</div>
                        <p>正确率 ${Math.round(correct/quizWords.length*100)}%</p>
                        <button class="btn btn-primary" style="margin-top:20px" onclick="closeQuiz()">完成</button>
                    </div>
                `;
            }
        }, 800);
    };
    
    renderQuestion();
}

function closeQuiz() {
    document.getElementById('quizModal').classList.remove('show');
    updateStats();
}

// Show history
function showHistory() {
    const history = Storage.getHistory();
    const modal = document.getElementById('historyModal');
    const body = document.getElementById('historyBody');
    
    const learned = history.learned.slice(-20).reverse();
    
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
    
    modal.classList.add('show');
}

function closeHistory() {
    document.getElementById('historyModal').classList.remove('show');
}

// Initialize app
async function init() {
    // Load words.json
    const loaded = await loadWords();
    if (!loaded) {
        document.getElementById('wordList').innerHTML = '<div class="empty-state">加载词库失败，请刷新重试</div>';
        return;
    }
    
    // Initialize data
    initTodayWords();
    
    // Render UI
    renderTabs();
    renderWords();
    updateStats();
    loadTheme();
    
    console.log(`Loaded ${WORDS.length} words, version ${WORDS_VERSION}`);
}

// Start app when DOM is ready
document.addEventListener('DOMContentLoaded', init);
