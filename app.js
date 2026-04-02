var TODAY = new Date().toISOString().slice(0, 10);
var MAX_NEW = 10;

function sget(k) { try { return JSON.parse(localStorage.getItem(k)); } catch(e) { return null; } }
function sset(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

function getBank() { return sget('se_wordbank') || []; }
function inBank(en) { return getBank().indexOf(en) > -1; }
function toggleBank(en) {
    var b = getBank();
    var i = b.indexOf(en);
    if (i > -1) b.splice(i, 1); else b.push(en);
    sset('se_wordbank', b);
}

function getDaily() { return sget('se_daily') || {}; }
function getTodayRec() { return getDaily()[TODAY] || { done: false, learned: 0 }; }
function setTodayLearned(n) {
    var d = getDaily();
    d[TODAY] = { done: n >= MAX_NEW, learned: n };
    sset('se_daily', d);
}
function getTotalLearned() {
    var d = getDaily(), t = 0;
    for (var k in d) t += (d[k].learned || 0);
    return t;
}
function getStreak() {
    var d = getDaily(), streak = 0;
    var cur = new Date();
    cur.setHours(0, 0, 0, 0);
    for (var i = 0; i < 365; i++) {
        var key = cur.toISOString().slice(0, 10);
        if (d[key] && d[key].done) { streak++; }
        else if (i > 0) break;
        cur.setDate(cur.getDate() - 1);
    }
    return streak;
}

function getRevData() { return sget('se_review') || {}; }
function srm(en, data) { var d = getRevData(); d[en] = data; sset('se_review', d); }
function markWrong(en) { srm(en, { reps: 0, ease: 2.5, interval: 0, nextReview: Date.now() }); }
function markCorrect(en) {
    var d = getRevData(), now = Date.now();
    if (!d[en]) { d[en] = { reps: 1, ease: 2.5, interval: 1, nextReview: now + 86400000 }; }
    else {
        var r = d[en]; r.reps++;
        if (r.reps === 1) r.interval = 1;
        else if (r.reps === 2) r.interval = 3;
        else r.interval = Math.max(1, Math.round(r.interval * r.ease));
        r.nextReview = now + r.interval * 86400000;
    }
    sset('se_review', d);
}
function revOf(en) { return getRevData()[en] || null; }

var WORDS = [];
async function loadWords() {
    var cached = localStorage.getItem('se_words_cache');
    if (cached) { try { WORDS = JSON.parse(cached); } catch(e) { WORDS = []; } }
    if (!WORDS.length) {
        try {
            var r = await fetch('words.json');
            var data = await r.json();
            WORDS = Array.isArray(data) ? data : (data.words || []);
            localStorage.setItem('se_words_cache', JSON.stringify(WORDS));
        } catch(e) { WORDS = []; }
    }
}
function findWord(en) { return WORDS.find(function(w) { return w.en === en; }) || null; }
function getUnlearnedWords() {
    var rd = getRevData();
    return WORDS.filter(function(w) { return !rd[w.en]; });
}
function getReviewPool() {
    var rd = getRevData(), bank = getBank(), pool = {};
    for (var en in rd) if (rd[en].reps === 0) pool[en] = true;
    bank.forEach(function(en) { pool[en] = true; });
    return Object.keys(pool).map(findWord).filter(Boolean);
}

function speak(text) {
    if (!text) return;
    var audio = new Audio('https://dict.youdao.com/dictvoice?type=1&word=' + encodeURIComponent(text));
    audio.play().catch(function() {
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
            var utt = new SpeechSynthesisUtterance(text);
            utt.lang = 'en-US'; utt.rate = 0.88;
            var vs = window.speechSynthesis.getVoices();
            var enV = vs.find(function(v) { return v.lang.startsWith('en'); }) || vs[0];
            if (enV) utt.voice = enV;
            window.speechSynthesis.speak(utt);
        }
    });
}
if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = function() { window.speechSynthesis.getVoices(); };

var learnQueue = [], learnIdx = 0, learnTodayCount = 0;
var reviewQueue = [], reviewIdx = 0;
var calY, calM;
var currentCat = 'all';

function showView(v) {
    ['home', 'learn', 'review', 'browse'].forEach(function(x) {
        document.getElementById('view-' + x).classList.toggle('hidden', x !== v);
    });
    document.querySelectorAll('.mode-tab').forEach(function(t) {
        t.classList.toggle('active', t.dataset.mode === v);
    });
    if (v === 'home') renderHome();
    else if (v === 'browse') renderBrowse();
}

function onMainBtnClick() {
    var rec = getTodayRec();
    if (!rec.done) startLearn();
    else startReview();
}

function renderHome() {
    var rec = getTodayRec();
    var streak = getStreak();
    var total = getTotalLearned();
    var pool = getReviewPool();
    document.getElementById('s-streak').textContent = streak;
    document.getElementById('s-today').textContent = rec.learned + '/' + MAX_NEW;
    document.getElementById('s-total').textContent = total;
    document.getElementById('p-text').textContent = rec.learned + '/' + MAX_NEW;
    document.getElementById('p-fill').style.width = (rec.learned / MAX_NEW * 100) + '%';
    var btn = document.getElementById('btn-main');
    if (rec.done) {
        btn.textContent = '\u2713 今日学习已完成';
        btn.classList.add('done');
    } else {
        btn.textContent = '开始学习 (' + (MAX_NEW - rec.learned) + '\u8bcd)';
        btn.classList.remove('done');
    }
    var btnRev = document.getElementById('btn-review');
    if (pool.length > 0) {
        btnRev.style.display = 'block';
        btnRev.textContent = '复 review (' + pool.length + '\u8bcd)';
    } else {
        btnRev.style.display = 'none';
    }
    renderCalendar();
}

function renderCalendar() {
    var now = new Date();
    if (!calY) { calY = now.getFullYear(); calM = now.getMonth(); }
    var months = ['1\u6708', '2\u6708', '3\u6708', '4\u6708', '5\u6708', '6\u6708', '7\u6708', '8\u6708', '9\u6708', '10\u6708', '11\u6708', '12\u6708'];
    document.getElementById('cal-title').textContent = calY + '\u5e74 ' + months[calM];
    var isCurMonth = (calY === now.getFullYear() && calM === now.getMonth());
    document.getElementById('cal-next-btn').style.visibility = isCurMonth ? 'hidden' : 'visible';
    var firstWday = new Date(calY, calM, 1).getDay();
    var daysIn = new Date(calY, calM + 1, 0).getDate();
    var todayStr = TODAY;
    var daily = getDaily();
    var grid = document.getElementById('cal-grid');
    var html = '';
    for (var i = 0; i < firstWday; i++) html += '<div class="cal-day empty"></div>';
    for (var d = 1; d <= daysIn; d++) {
        var ds = calY + '-' + String(calM + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
        var isToday = ds === todayStr;
        var isFuture = ds > todayStr;
        var rec = daily[ds];
        var cls = 'cal-day';
        var dot = '';
        if (isToday) cls += ' today';
        if (isFuture) cls += ' future';
        else if (rec && rec.done) { cls += ' done-full'; dot = '<div class="cal-dot full"></div>'; }
        else if (rec && rec.learned > 0) { cls += ' done-partial'; dot = '<div class="cal-dot partial"></div>'; }
        html += '<div class="' + cls + '">' + d + dot + '</div>';
    }
    grid.innerHTML = html;
}

function calNav(dir) {
    calM += dir;
    if (calM > 11) { calM = 0; calY++; }
    if (calM < 0) { calM = 11; calY--; }
    renderCalendar();
}

function startLearn() {
    var unlearned = getUnlearnedWords();
    var rec = getTodayRec();
    var left = MAX_NEW - rec.learned;
    if (left <= 0 || !unlearned.length) { showView('home'); return; }
    var shuffled = unlearned.slice().sort(function() { return Math.random() - 0.5; });
    learnQueue = shuffled.slice(0, Math.min(left, shuffled.length));
    learnIdx = 0;
    learnTodayCount = rec.learned;
    showView('learn');
    showLearnCard();
}

function showLearnCard() {
    var area = document.getElementById('learn-area');
    if (learnIdx >= learnQueue.length) {
        setTodayLearned(learnTodayCount);
        area.innerHTML = '<div class="complete-card"><div class="complete-emoji">&#127882;</div><div class="complete-title">今日学习完成！</div><div class="complete-stats">学了 ' + learnTodayCount + ' 个新词</div><div class="complete-detail">明天继续加油</div></div>';
        return;
    }
    var w1 = learnQueue[learnIdx];
    var w2 = learnQueue[learnIdx + 1];
    var total = learnQueue.length;
    document.getElementById('lp-text').textContent = (learnIdx + 1) + ' / ' + total;
    document.getElementById('lp-fill').style.width = (learnIdx / total * 100) + '%';
    area.innerHTML = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">' +
        lCard(w1) + (w2 ? lCard(w2) : '<div></div>') + '</div>' +
        '<div class="rating-area show"><div class="rating-btns">' +
        '<button class="rate-btn wrong" onclick="rateLPair(false)">不认识</button>' +
        '<button class="rate-btn right" onclick="rateLPair(true)">记住了</button>' +
        '</div></div>';
}

function lCard(word) {
    var safe = word.en.replace(/'/g, "\\'");
    var starred = inBank(word.en);
    var star = starred ? '&#9733;' : '&#9734;';
    var starCls = starred ? ' active' : '';
    return '<div class="flashcard" onclick="this.classList.toggle(\'revealed\')">' +
        '<div class="card-top">' +
            '<span class="card-cat">' + word.category + '</span>' +
            '<button class="card-star' + starCls + '" onclick="event.stopPropagation();toggleBank(\'' + safe + '\');this.classList.toggle(\'active\');this.innerHTML=this.classList.contains(\'active\')?\'&#9733;\':\'&#9734;\'">' + star + '</button>' +
        '</div>' +
        '<div class="card-front">' +
            '<div class="card-word-row"><div class="card-word">' + word.en + '</div><button class="speak-btn" onclick="event.stopPropagation();speak(\'' + safe + '\')">&#128266;</button></div>' +
            '<div class="card-hint">点击查看</div>' +
        '</div>' +
        '<div class="card-back">' +
            '<div class="card-word-row"><div class="card-zh">' + word.zh + '</div><button class="speak-btn" onclick="event.stopPropagation();speak(\'' + safe + '\')">&#128266;</button></div>' +
            '<div class="card-phon">' + (word.phon || '') + '</div>' +
            (word.example ? '<div class="card-example">' + word.example + '</div>' : '') +
        '</div>' +
    '</div>';
}

function rateLPair(correct) {
    [learnQueue[learnIdx], learnQueue[learnIdx + 1]].forEach(function(word) {
        if (!word) return;
        if (correct) markCorrect(word.en);
        else markWrong(word.en);
    });
    learnTodayCount = Math.min(learnTodayCount + 2, MAX_NEW);
    learnIdx += 2;
    showLearnCard();
}

function confirmExitLearn() { document.getElementById('exit-modal').style.display = 'flex'; }
function closeExitLearn() { document.getElementById('exit-modal').style.display = 'none'; }
function doExitLearn() {
    setTodayLearned(learnTodayCount);
    closeExitLearn();
    showView('home');
}

function startReview() {
    var pool = getReviewPool();
    if (!pool.length) { showView('home'); return; }
    reviewQueue = pool.sort(function() { return Math.random() - 0.5; });
    reviewIdx = 0;
    showView('review');
    showReviewCard();
}

function showReviewCard() {
    var area = document.getElementById('review-area');
    if (reviewIdx >= reviewQueue.length) {
        area.innerHTML = '<div class="complete-card"><div class="complete-emoji">&#127881;</div><div class="complete-title">本轮复习完毕</div><div class="complete-stats">共复习 ' + reviewQueue.length + ' 词</div><div class="complete-detail">继续加油</div></div><button class="btn-primary" onclick="showView(\'home\')">返回首页</button>';
        return;
    }
    var word = reviewQueue[reviewIdx];
    var safe = word.en.replace(/'/g, "\\'");
    var starred = inBank(word.en);
    var star = starred ? '&#9733;' : '&#9734;';
    var starCls = starred ? ' active' : '';
    area.innerHTML = '<div class="flashcard" onclick="this.classList.toggle(\'revealed\')">' +
        '<div class="card-top">' +
            '<span class="card-cat">' + word.category + '</span>' +
            '<button class="card-star' + starCls + '" onclick="event.stopPropagation();toggleBank(\'' + safe + '\');this.classList.toggle(\'active\');this.innerHTML=this.classList.contains(\'active\')?\'&#9733;\':\'&#9734;\'">' + star + '</button>' +
        '</div>' +
        '<div class="card-front">' +
            '<div class="card-word-row"><div class="card-word">' + word.en + '</div><button class="speak-btn" onclick="event.stopPropagation();speak(\'' + safe + '\')">&#128266;</button></div>' +
            '<div class="card-hint">点击显示答案</div>' +
        '</div>' +
        '<div class="card-back">' +
            '<div class="card-word-row"><div class="card-zh">' + word.zh + '</div><button class="speak-btn" onclick="event.stopPropagation();speak(\'' + safe + '\')">&#128266;</button></div>' +
            '<div class="card-phon">' + (word.phon || '') + '</div>' +
            (word.example ? '<div class="card-example">' + word.example + '</div>' : '') +
        '</div>' +
    '</div>' +
    '<div class="rating-area show"><div class="rating-btns">' +
        '<button class="rate-btn wrong" onclick="rateReviewWord(false)">不认识</button>' +
        '<button class="rate-btn right" onclick="rateReviewWord(true)">记住了</button>' +
    '</div></div>';
}

function rateReviewWord(correct) {
    var word = reviewQueue[reviewIdx];
    if (correct) markCorrect(word.en);
    else markWrong(word.en);
    reviewIdx++;
    showReviewCard();
}

function renderBrowse() {
    var catSet = {};
    WORDS.forEach(function(w) { catSet[w.category] = true; });
    var cats = ['all'].concat(Object.keys(catSet));
    var filter = document.getElementById('cat-filter');
    filter.innerHTML = cats.map(function(c) {
        return '<button class="cat-btn' + (c === currentCat ? ' active' : '') + '" onclick="setCat(\'' + c + '\')">' + (c === 'all' ? '\u5168\u90e8' : c) + '</button>';
    }).join('');
    var filtered = currentCat === 'all' ? WORDS : WORDS.filter(function(w) { return w.category === currentCat; });
    var list = document.getElementById('word-list');
    list.innerHTML = '<div class="word-list-title">' + (currentCat === 'all' ? '\u5168\u90e8' : currentCat) + ' \u00b7 ' + filtered.length + ' \u8bcd</div>';
    list.innerHTML += filtered.slice(0, 50).map(function(w) {
        var safe = w.en.replace(/'/g, "\\'");
        var starred = inBank(w.en);
        var star = starred ? '&#9733;' : '&#9734;';
        var starCls = starred ? ' active' : '';
        var r = revOf(w.en);
        var nextText = '\u672a\u5b66\u4e60';
        var nextCls = '';
        if (r) {
            if (r.reps === 0) { nextText = '\u9519\u8bef'; nextCls = ' overdue'; }
            else if (r.reps >= 3) { nextText = '\u5df2\u638c\u63e1'; }
            else { nextText = '\u5b66\u4e60\u4e2d'; }
        }
        return '<div class="word-item">' +
            '<div><div class="word-item-en">' + w.en + '</div><div class="word-item-zh">' + w.zh + '</div></div>' +
            '<div class="word-item-actions">' +
                '<span class="word-next' + nextCls + '">' + nextText + '</span>' +
                '<button class="word-star' + starCls + '" onclick="toggleBank(\'' + safe + '\');renderBrowse()">' + star + '</button>' +
                '<button class="speak-btn-sm" onclick="speak(\'' + safe + '\')">&#128266;</button>' +
            '</div>' +
        '</div>';
    }).join('');
    if (filtered.length > 50) {
        list.innerHTML += '<div style="text-align:center;color:var(--text-secondary);font-size:13px;padding:10px">\u663e\u793a\u524d50\u8bcd\uff0c\u5171' + filtered.length + '\u8bcd</div>';
    }
}

function setCat(cat) { currentCat = cat; renderBrowse(); }

function setTheme(theme) {
    document.body.setAttribute('data-theme', theme === 'blue' ? '' : theme);
    sset('se_theme', theme);
    document.querySelectorAll('.theme-btn').forEach(function(b) { b.classList.toggle('active', b.dataset.theme === theme); });
}

function init() {
    var savedTheme = sget('se_theme') || 'blue';
    setTheme(savedTheme);
    loadWords().then(function() { renderHome(); });
}

(function migrate() {
    var oldSrs = localStorage.getItem('srs_v2');
    var oldDaily = localStorage.getItem('reviewed_t');
    if (oldSrs && !sget('se_review')) {
        try {
            var old = JSON.parse(oldSrs);
            var newd = {};
            for (var en in old) {
                if (old[en] && old[en].learned !== undefined) {
                    newd[en] = { reps: old[en].reviewCount || 0, ease: 2.5, interval: old[en].interval || 0, nextReview: old[en].nextReview ? new Date(old[en].nextReview).getTime() : 0 };
                }
            }
            if (Object.keys(newd).length > 0) sset('se_review', newd);
        } catch(e) {}
    }
    if (oldDaily && !sget('se_daily')) {
        try {
            var count = parseInt(oldDaily);
            var d = {}; d[TODAY] = { done: count >= MAX_NEW, learned: count };
            sset('se_daily', d);
        } catch(e) {}
    }
})();

init();
