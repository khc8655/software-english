/**
 * Storage Manager - localStorage abstraction
 * Handles learning progress, history, and preferences
 */
const Storage = {
    PREFIX: 'se_',

    KEYS: {
        LEARNED: 'learned',
        WORDBANK: 'wordbank',
        TODAY_WORDS: 'todayWords',
        TODAY_DATE: 'todayDate',
        THEME: 'theme',
        HISTORY: 'history',
        STREAK: 'streak',
        WORDS_VERSION: 'wordsVersion'
    },

    get(key) {
        return localStorage.getItem(this.PREFIX + key);
    },

    set(key, value) {
        localStorage.setItem(this.PREFIX + key, JSON.stringify(value));
    },

    getRaw(key) {
        return localStorage.getItem(this.PREFIX + key);
    },

    setRaw(key, value) {
        localStorage.setItem(this.PREFIX + key, value);
    },

    // === Learned words ===
    getLearned() {
        return JSON.parse(this.get(this.KEYS.LEARNED) || '[]');
    },

    setLearned(learned) {
        this.set(this.KEYS.LEARNED, learned);
    },

    // Called only when quiz/spell answered correctly
    markWordLearned(wordEn) {
        const learned = this.getLearned();
        if (!learned.includes(wordEn)) {
            learned.push(wordEn);
            this.setLearned(learned);
            this.addToHistory(wordEn, 'learned');
        }
        return learned;
    },

    unmarkWordLearned(wordEn) {
        const learned = this.getLearned();
        const idx = learned.indexOf(wordEn);
        if (idx > -1) {
            learned.splice(idx, 1);
            this.setLearned(learned);
        }
        return learned;
    },

    // === Word bank (生词本) ===
    getWordBank() {
        return JSON.parse(this.get(this.KEYS.WORDBANK) || '[]');
    },

    setWordBank(bank) {
        this.set(this.KEYS.WORDBANK, bank);
    },

    addToBank(wordEn) {
        const bank = this.getWordBank();
        if (!bank.includes(wordEn)) {
            bank.push(wordEn);
            this.setWordBank(bank);
        }
        return bank;
    },

    removeFromBank(wordEn) {
        const bank = this.getWordBank();
        const idx = bank.indexOf(wordEn);
        if (idx > -1) {
            bank.splice(idx, 1);
            this.setWordBank(bank);
        }
        return bank;
    },

    isInBank(wordEn) {
        return this.getWordBank().includes(wordEn);
    },

    // === Today's words ===
    getTodayWords() {
        return JSON.parse(this.get(this.KEYS.TODAY_WORDS) || '[]');
    },

    setTodayWords(words) {
        this.set(this.KEYS.TODAY_WORDS, words);
        this.setRaw(this.KEYS.TODAY_DATE, new Date().toDateString());
    },

    isTodayWordsValid() {
        return this.getRaw(this.KEYS.TODAY_DATE) === new Date().toDateString();
    },

    // === Theme ===
    getTheme() {
        return this.getRaw(this.KEYS.THEME) || 'blue';
    },

    setTheme(theme) {
        this.setRaw(this.KEYS.THEME, theme);
    },

    // === History ===
    getHistory() {
        return JSON.parse(this.get(this.KEYS.HISTORY) || '{"learned":[],"reviewed":[]}');
    },

    addToHistory(wordEn, action) {
        const history = this.getHistory();
        const entry = {
            word: wordEn,
            action: action,
            timestamp: Date.now(),
            date: new Date().toISOString().split('T')[0]
        };
        history.learned.push(entry);
        if (history.learned.length > 1000) {
            history.learned = history.learned.slice(-1000);
        }
        this.set(this.KEYS.HISTORY, history);
    },

    addReview(wordEn) {
        const history = this.getHistory();
        const entry = {
            word: wordEn,
            timestamp: Date.now(),
            date: new Date().toISOString().split('T')[0]
        };
        history.reviewed.push(entry);
        if (history.reviewed.length > 1000) {
            history.reviewed = history.reviewed.slice(-1000);
        }
        this.set(this.KEYS.HISTORY, history);
    },

    // === Streak ===
    getStreak() {
        return JSON.parse(this.get(this.KEYS.STREAK) || '{"count":0,"lastDate":null}');
    },

    updateStreak() {
        const streak = this.getStreak();
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();

        if (streak.lastDate === today) {
            return streak;
        } else if (streak.lastDate === yesterday) {
            streak.count++;
            streak.lastDate = today;
        } else {
            streak.count = 1;
            streak.lastDate = today;
        }
        this.set(this.KEYS.STREAK, streak);
        return streak;
    },

    // === Stats ===
    getStats() {
        const learned = this.getLearned();
        const streak = this.getStreak();
        const history = this.getHistory();
        const bank = this.getWordBank();

        return {
            totalLearned: learned.length,
            currentStreak: streak.count,
            totalReviews: history.reviewed.length,
            lastStudy: streak.lastDate,
            bankCount: bank.length
        };
    },

    // === Words version ===
    getWordsVersion() {
        return this.getRaw(this.KEYS.WORDS_VERSION) || null;
    },

    setWordsVersion(version) {
        this.setRaw(this.KEYS.WORDS_VERSION, version);
    },

    // === Clear all ===
    clearAll() {
        Object.values(this.KEYS).forEach(key => {
            localStorage.removeItem(this.PREFIX + key);
        });
    }
};
