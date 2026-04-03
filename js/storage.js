/**
 * Storage Manager - localStorage abstraction
 * SM-2 Spaced Repetition + Error tracking
 */
const Storage = {
    PREFIX: 'se_',

    KEYS: {
        // SM-2 data per word: { repetitions, ease, interval, nextReview }
        REVIEW: 'review',
        // Words answered wrong in today's session (temp, cleared at midnight)
        TODAYS_ERRORS: 'todaysErrors',
        // All-time error words (for error notebook)
        ERROR_BOOK: 'errorBook',
        // Word bank (manual)
        WORDBANK: 'wordbank',
        // Daily new word limit (date:count)
        NEW_WORD_DATES: 'newWordDates',
        TODAY_WORDS: 'todayWords',
        TODAY_DATE: 'todayDate',
        THEME: 'theme',
        WORDS_VERSION: 'wordsVersion',
        // Learning streak
        STREAK_DATES: 'streakDates',
        LAST_ACTIVE: 'lastActive'
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

    // ===== Review Data (SM-2 per word) =====
    // review data: { wordEn: { reps, ease, interval, nextReview } }

    _getReviewData() {
        return JSON.parse(this.get(this.KEYS.REVIEW) || '{}');
    },

    _setReviewData(data) {
        this.set(this.KEYS.REVIEW, data);
    },

    // Get review info for a word
    getReview(wordEn) {
        const data = this._getReviewData();
        return data[wordEn] || null;
    },

    // Called when user answers CORRECT in review
    markCorrect(wordEn) {
        const data = this._getReviewData();
        const now = Date.now();
        const today = new Date().toDateString();

        if (!data[wordEn]) {
            // New word, first correct answer
            data[wordEn] = { reps: 1, ease: 2.5, interval: 1, nextReview: this._daysFromNow(1) };
        } else {
            const r = data[wordEn];
            r.reps++;
            // Increase interval: 1 -> 3 -> 7 -> 14 -> 30 -> 60...
            if (r.reps === 1) {
                r.interval = 1;
            } else if (r.reps === 2) {
                r.interval = 3;
            } else {
                r.interval = Math.round(r.interval * r.ease);
            }
            // Make sure interval is at least 1 day
            r.interval = Math.max(1, r.interval);
            r.nextReview = this._daysFromNow(r.interval);
        }

        // Remove from today's errors if it was there
        this._removeTodaysError(wordEn);
        // Remove from error book if it was there (mastered now)
        this._removeFromErrorBook(wordEn);

        this._setReviewData(data);
        return data[wordEn];
    },

    // Called when user answers WRONG in review
    markWrong(wordEn) {
        const data = this._getReviewData();
        // Reset to beginning of SM-2
        data[wordEn] = { reps: 0, ease: 2.5, interval: 0, nextReview: this._daysFromNow(0) };
        this._setReviewData(data);

        // Add to today's errors
        this._addTodaysError(wordEn);
        // Add to error book
        this._addToErrorBook(wordEn);
    },

    // Get all words due for review today
    getDueWords(allWords) {
        const data = this._getReviewData();
        const now = Date.now();
        return allWords.filter(w => {
            const r = data[w.en];
            return r && r.nextReview && r.nextReview <= now;
        });
    },

    // Get word bank words due for review
    getBankDueWords(allWords) {
        const data = this._getReviewData();
        const bank = this.getWordBank();
        const now = Date.now();
        return allWords.filter(w => {
            if (!bank.includes(w.en)) return false;
            const r = data[w.en];
            return r && r.nextReview && r.nextReview <= now;
        });
    },

    // Check if a word is mastered (reps >= 3)
    isMastered(wordEn) {
        const r = this.getReview(wordEn);
        return r && r.reps >= 3;
    },

    // ===== Today's Errors (session-scoped) =====
    _getTodaysErrors() {
        return JSON.parse(this.get(this.KEYS.TODAYS_ERRORS) || '[]');
    },

    _setTodaysErrors(errors) {
        this.set(this.KEYS.TODAYS_ERRORS, errors);
    },

    _addTodaysError(wordEn) {
        const errors = this._getTodaysErrors();
        if (!errors.includes(wordEn)) {
            errors.push(wordEn);
            this._setTodaysErrors(errors);
        }
    },

    _removeTodaysError(wordEn) {
        const errors = this._getTodaysErrors();
        const idx = errors.indexOf(wordEn);
        if (idx > -1) {
            errors.splice(idx, 1);
            this._setTodaysErrors(errors);
        }
    },

    getTodaysErrors() {
        return this._getTodaysErrors();
    },

    // Reset today's errors at midnight (called on init)
    _checkDateChange() {
        const savedDate = this.getRaw('dateCheck');
        const today = new Date().toDateString();
        if (savedDate !== today) {
            this.setRaw('dateCheck', today);
            this._setTodaysErrors([]); // clear session errors
            this._resetNewWordCount();  // reset new word daily limit
        }
    },

    // ===== Error Book (all-time mistakes) =====
    _getErrorBook() {
        return JSON.parse(this.get(this.KEYS.ERROR_BOOK) || '[]');
    },

    _setErrorBook(book) {
        this.set(this.KEYS.ERROR_BOOK, book);
    },

    _addToErrorBook(wordEn) {
        const book = this._getErrorBook();
        if (!book.includes(wordEn)) {
            book.push(wordEn);
            this._setErrorBook(book);
        }
    },

    _removeFromErrorBook(wordEn) {
        const book = this._getErrorBook();
        const idx = book.indexOf(wordEn);
        if (idx > -1) {
            book.splice(idx, 1);
            this._setErrorBook(book);
        }
    },

    getErrorBook() {
        return this._getErrorBook();
    },

    getErrorBookWords(allWords) {
        const book = this._getErrorBook();
        return book.map(en => allWords.find(w => w.en === en)).filter(Boolean);
    },

    // ===== Word Bank =====
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

    // ===== New Word Daily Limit =====
    _getNewWordDates() {
        return JSON.parse(this.get(this.KEYS.NEW_WORD_DATES) || '{}');
    },

    _setNewWordDates(dates) {
        this.set(this.KEYS.NEW_WORD_DATES, dates);
    },

    _resetNewWordCount() {
        const dates = this._getNewWordDates();
        dates[new Date().toDateString()] = 0;
        this._setNewWordDates(dates);
    },

    canLearnNewWord() {
        const dates = this._getNewWordDates();
        const today = new Date().toDateString();
        return (dates[today] || 0) < 10; // max 10 new words/day
    },

    incrementNewWordCount() {
        const dates = this._getNewWordDates();
        const today = new Date().toDateString();
        dates[today] = (dates[today] || 0) + 1;
        this._setNewWordDates(dates);
    },

    getNewWordCountToday() {
        const dates = this._getNewWordDates();
        const today = new Date().toDateString();
        return dates[today] || 0;
    },

    // ===== Today's Words (daily set) =====
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

    // ===== Theme =====
    getTheme() {
        return this.getRaw(this.KEYS.THEME) || 'blue';
    },

    setTheme(theme) {
        this.setRaw(this.KEYS.THEME, theme);
    },

    // ===== Learning Streak =====
    _getStreakDates() {
        return JSON.parse(this.get(this.KEYS.STREAK_DATES) || '[]');
    },

    // ===== Daily Summary (for calendar) =====
    _getDailySummary() {
        return JSON.parse(this.get('dailySummary') || '{}');
    },

    getDaily() {
        // Returns { "2026-04-03": { done: true, learned: 10 }, ... }
        const summary = this._getDailySummary();
        // Also back-fill from NEW_WORD_DATES for compatibility
        const dates = this._getNewWordDates();
        const today = new Date().toDateString();
        const result = {};
        for (const ds in dates) {
            const d = new Date(ds);
            const key = d.toISOString().slice(0, 10);
            result[key] = { done: dates[ds] >= 10, learned: dates[ds] || 0 };
        }
        return result;
    },

    _setStreakDates(dates) {
        this.set(this.KEYS.STREAK_DATES, dates);
    },

    recordActivity() {
        const today = new Date().toDateString();
        const dates = this._getStreakDates();
        if (!dates.includes(today)) {
            dates.push(today);
            this._setStreakDates(dates);
        }
        this.setRaw(this.KEYS.LAST_ACTIVE, today);
    },

    getLearnDays() {
        return this._getStreakDates().length;
    },

    getTotalErrorCount() {
        return this._getErrorBook().length;
    },

    // ===== Stats =====
    getStats(allWords) {
        const data = this._getReviewData();
        const bank = this.getWordBank();
        const errorBook = this._getErrorBook();
        const mastered = Object.values(data).filter(r => r.reps >= 3).length;
        const dueWords = allWords.filter(w => {
            const r = data[w.en];
            return r && r.nextReview && r.nextReview <= Date.now();
        }).length;

        return {
            totalWords: allWords.length,
            mastered,
            bankCount: bank.length,
            errorCount: errorBook.length,
            dueCount: dueWords,
            newWordToday: this.getNewWordCountToday(),
            learnDays: this.getLearnDays(),
            totalReviews: Object.values(data).reduce((sum, r) => sum + (r.reps || 0), 0)
        };
    },

    // ===== Helpers =====
    _daysFromNow(days) {
        return Date.now() + days * 86400000;
    },

    // ===== Words version =====
    getWordsVersion() {
        return this.getRaw(this.KEYS.WORDS_VERSION) || null;
    },

    setWordsVersion(version) {
        this.setRaw(this.KEYS.WORDS_VERSION, version);
    },

    // ===== Clear all =====
    clearAll() {
        Object.values(this.KEYS).forEach(key => {
            localStorage.removeItem(this.PREFIX + key);
        });
    }
};
