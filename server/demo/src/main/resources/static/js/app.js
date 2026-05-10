/* ================================================================
   TypeMaster v2 — app.js
   Typing engine: character tracking, caret, live stats, results
   ================================================================ */
'use strict';

// ── Config ───────────────────────────────────────────────────────
const cfg = {
    mode:      'time',
    duration:  30,
    wordLimit: 25,
    difficulty:'easy',
    topic:     'random'
};

// ── Runtime state ────────────────────────────────────────────────
const st = {
    words:        [],
    typedWords:   [],
    wordIdx:      0,
    currentInput: '',

    started:  false,
    finished: false,
    focused:  false,

    startTime:   null,
    timerHandle: null,
    wpmHandle:   null,

    timeLeft: 30,
    elapsed:  0,

    // Accumulated from completed words
    correctChars: 0,
    totalTyped:   0,
    errorCount:   0,    // errors in completed words

    _tab: false
};

// ── DOM shortcuts ────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const el = {
    textDisplay:   $('textDisplay'),
    textZone:      $('textZone'),
    typingCard:    $('typingCard'),
    typingInput:   $('typingInput'),
    caret:         $('caret'),
    startOverlay:  $('startOverlay'),
    loadingOverlay:$('loadingOverlay'),
    loadingMsg:    $('loadingMsg'),

    progressFill:  $('progressFill'),

    sWpm:          $('sWpm'),
    sAcc:          $('sAcc'),
    sTimer:        $('sTimer'),
    sTimerLbl:     $('sTimerLbl'),
    sErrors:       $('sErrors'),

    controls:      $('controls'),
    restartBtn:    $('restartBtn'),
    newTextBtn:    $('newTextBtn'),

    results:       $('results'),
    gradeBox:      $('gradeBox'),
    rcFeedback:    $('rcFeedback'),
    pbBadge:       $('pbBadge'),
    rWpm:          $('rWpm'),
    rAcc:          $('rAcc'),
    rRaw:          $('rRaw'),
    rErrors:       $('rErrors'),
    rCorrect:      $('rCorrect'),
    rTime:         $('rTime'),
    rMode:         $('rMode'),
    rTopic:        $('rTopic'),
    speedFill:     $('speedFill'),
    speedDot:      $('speedDot'),
    speedLevel:    $('speedLevel'),
    tryAgainBtn:   $('tryAgainBtn'),
    newTestBtn:    $('newTestBtn'),

    pbVal:         $('pbVal'),
    pbPill:        $('pbPill'),
    topicRow:      $('topicRow'),
};

// ================================================================
// BOOT
// ================================================================
document.addEventListener('DOMContentLoaded', () => {
    refreshPB();
    setupListeners();
    loadText();
});

// ================================================================
// TEXT LOADING
// ================================================================
async function loadText() {
    showLoading('Loading text\u2026');

    try {
        const params = new URLSearchParams({
            difficulty: cfg.difficulty,
            mode:       cfg.mode,
            duration:   cfg.duration,
            topic:      cfg.topic
        });

        const res = await fetch('/api/text?' + params);
        if (!res.ok) throw new Error('Server ' + res.status);

        const data = await res.json();
        let words = data.text.trim().split(/\s+/).filter(Boolean);

        if (cfg.mode === 'words') words = words.slice(0, cfg.wordLimit);

        st.words = words;
        hideLoading();
        resetState();
        renderAll();
        refreshTimerDisplay();

    } catch (err) {
        console.error('[TypeMaster] Load failed:', err);
        el.loadingMsg.textContent = '⚠ Server not reachable. Start Spring Boot first.';
    }
}

function showLoading(msg) {
    el.loadingMsg.textContent = msg;
    el.loadingOverlay.classList.remove('hidden');
    el.startOverlay.classList.add('hidden');
    el.caret.style.opacity = '0';
}

function hideLoading() {
    el.loadingOverlay.classList.add('hidden');
}

// ================================================================
// STATE RESET
// ================================================================
function resetState() {
    clearInterval(st.timerHandle);
    clearInterval(st.wpmHandle);

    Object.assign(st, {
        typedWords:   [],
        wordIdx:      0,
        currentInput: '',
        started:      false,
        finished:     false,
        startTime:    null,
        timerHandle:  null,
        wpmHandle:    null,
        timeLeft:     cfg.duration,
        elapsed:      0,
        correctChars: 0,
        totalTyped:   0,
        errorCount:   0,
        _tab:         false
    });

    el.typingInput.value = '';

    // Reset live stats display
    el.sWpm.textContent    = '0';
    el.sAcc.textContent    = '100';
    el.sErrors.textContent = '0';
    el.caret.style.opacity = '0';

    // Reset progress bar
    setProgress(cfg.mode === 'time' ? 100 : 0);

    // UI states
    el.typingCard.classList.remove('typing-active', 'focused');
    el.startOverlay.classList.remove('hidden');
    el.results.classList.remove('visible');
    el.controls.classList.remove('hidden');
    el.textDisplay.scrollTop = 0;
}

// ================================================================
// RENDER
// ================================================================
function renderAll() {
    el.textDisplay.innerHTML = '';

    st.words.forEach((word, wIdx) => {
        const wEl = document.createElement('div');
        wEl.className = 'word';
        wEl.dataset.w = wIdx;

        [...word].forEach(ch => {
            const cEl = document.createElement('span');
            cEl.className = 'char';
            cEl.textContent = ch;
            wEl.appendChild(cEl);
        });

        el.textDisplay.appendChild(wEl);
    });

    setTimeout(moveCaret, 60);
}

function updateCurrentWord() {
    const wEl = wordEl(st.wordIdx);
    if (!wEl) return;

    const expected = st.words[st.wordIdx];
    const typed    = st.currentInput;

    wEl.querySelectorAll('.extra').forEach(n => n.remove());

    const chars = wEl.querySelectorAll('.char:not(.extra)');
    chars.forEach((cEl, i) => {
        cEl.className = 'char';
        if (i < typed.length) {
            cEl.classList.add(typed[i] === expected[i] ? 'correct' : 'wrong');
        }
    });

    // Extra chars beyond word length
    for (let i = expected.length; i < typed.length; i++) {
        const cEl = document.createElement('span');
        cEl.className = 'char wrong extra';
        cEl.textContent = typed[i];
        wEl.appendChild(cEl);
    }

    moveCaret();
}

function markCompletedWord(wIdx) {
    const wEl = wordEl(wIdx);
    if (!wEl) return;
    const typed    = st.typedWords[wIdx] || '';
    const expected = st.words[wIdx]       || '';
    wEl.classList.toggle('w-error', typed !== expected);
}

function wordEl(idx) {
    return el.textDisplay.querySelector(`.word[data-w="${idx}"]`);
}

// ================================================================
// CARET
// ================================================================
function moveCaret() {
    const wEl = wordEl(st.wordIdx);
    if (!wEl) return;

    const allChars = wEl.querySelectorAll('.char');
    const typedLen = st.currentInput.length;
    let target = null;
    let after  = false;

    if (typedLen < allChars.length) {
        target = allChars[typedLen];
    } else if (allChars.length > 0) {
        target = allChars[allChars.length - 1];
        after  = true;
    }

    if (!target) { el.caret.style.opacity = '0'; return; }

    const dispRect   = el.textDisplay.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();

    const left = targetRect.left - dispRect.left + (after ? targetRect.width : 0);
    const top  = (targetRect.top  - dispRect.top)  + el.textDisplay.scrollTop;

    el.caret.style.left    = left + 'px';
    el.caret.style.top     = top  + 'px';
    el.caret.style.opacity = '1';
}

// ================================================================
// INPUT HANDLING
// ================================================================
function onInput() {
    if (st.finished) { el.typingInput.value = ''; return; }

    const val = el.typingInput.value;

    if (val.endsWith(' ')) {
        el.typingInput.value = val.trimEnd();
        st.currentInput = el.typingInput.value;
        advanceWord();
        return;
    }

    if (!st.started && val.length > 0) startTest();
    st.currentInput = val;
    updateCurrentWord();
    updateLiveStats();
}

function onKeyDown(e) {
    const key = e.key;

    if (key === 'Escape') { e.preventDefault(); restart(); return; }
    if (key === 'Tab')    { e.preventDefault(); st._tab = true; setTimeout(() => { st._tab = false; }, 1200); return; }
    if (key === 'Enter' && st._tab) { e.preventDefault(); restart(); return; }

    if (st.finished) return;

    if (key === ' ') { e.preventDefault(); advanceWord(); return; }

    if (key === 'Backspace' && el.typingInput.value === '' && st.wordIdx > 0) {
        e.preventDefault();
        goBackWord();
        return;
    }

    if (!st.started && key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        startTest();
    }
}

// ── Advance to next word ──────────────────────────────────────────
function advanceWord() {
    if (st.currentInput.trim() === '') return;

    const expected = st.words[st.wordIdx];
    const typed    = st.currentInput;
    const minLen   = Math.min(typed.length, expected.length);

    let wCorrect = 0, wErrors = 0;
    for (let i = 0; i < minLen; i++) {
        if (typed[i] === expected[i]) wCorrect++;
        else wErrors++;
    }
    if (typed.length > expected.length) wErrors += typed.length - expected.length;
    if (typed.length < expected.length) wErrors += expected.length - typed.length;

    st.correctChars += wCorrect;
    st.totalTyped   += typed.length;
    st.errorCount   += wErrors;

    st.typedWords[st.wordIdx] = typed;
    markCompletedWord(st.wordIdx);
    st.wordIdx++;
    st.currentInput = '';
    el.typingInput.value = '';

    // End condition for words mode
    if (cfg.mode === 'words' && st.wordIdx >= st.words.length) { endTest(); return; }

    // Update progress bar for words mode
    if (cfg.mode === 'words') {
        setProgress((st.wordIdx / Math.min(cfg.wordLimit, st.words.length)) * 100);
    }

    updateCurrentWord();
    scrollToLine();
    updateLiveStats();
}

// ── Go back to previous word ──────────────────────────────────────
function goBackWord() {
    st.wordIdx--;

    const prevTyped    = st.typedWords[st.wordIdx] || '';
    const prevExpected = st.words[st.wordIdx] || '';
    const minLen = Math.min(prevTyped.length, prevExpected.length);

    let prevCorrect = 0, prevErrors = 0;
    for (let i = 0; i < minLen; i++) {
        if (prevTyped[i] === prevExpected[i]) prevCorrect++;
        else prevErrors++;
    }
    if (prevTyped.length > prevExpected.length) prevErrors += prevTyped.length - prevExpected.length;

    st.correctChars = Math.max(0, st.correctChars - prevCorrect);
    st.totalTyped   = Math.max(0, st.totalTyped   - prevTyped.length);
    st.errorCount   = Math.max(0, st.errorCount   - prevErrors);

    st.currentInput = prevTyped;
    el.typingInput.value = prevTyped;
    delete st.typedWords[st.wordIdx];

    const wEl = wordEl(st.wordIdx);
    if (wEl) wEl.className = 'word';

    updateCurrentWord();
    updateLiveStats();
}

// ── Scroll current word to line 2 ────────────────────────────────
function scrollToLine() {
    const wEl = wordEl(st.wordIdx);
    if (!wEl) return;
    const lineH   = 50;
    const wordTop = wEl.offsetTop;
    if (wordTop >= el.textDisplay.scrollTop + lineH) {
        el.textDisplay.scrollTop = wordTop - lineH;
    }
}

// ================================================================
// TIMER & PROGRESS
// ================================================================
function startTest() {
    if (st.started) return;
    st.started   = true;
    st.startTime = Date.now();

    el.startOverlay.classList.add('hidden');
    el.typingCard.classList.add('typing-active');

    if (cfg.mode === 'time') {
        st.timeLeft    = cfg.duration;
        st.timerHandle = setInterval(() => {
            st.timeLeft--;
            el.sTimer.textContent = st.timeLeft;
            // Progress bar empties as time runs out
            setProgress((st.timeLeft / cfg.duration) * 100);
            if (st.timeLeft <= 0) endTest();
        }, 1000);
    } else {
        st.timerHandle = setInterval(() => {
            st.elapsed++;
            el.sTimer.textContent = st.elapsed;
        }, 1000);
    }

    st.wpmHandle = setInterval(updateLiveStats, 500);
}

function refreshTimerDisplay() {
    if (cfg.mode === 'time') {
        el.sTimer.textContent    = cfg.duration;
        el.sTimerLbl.textContent = 'sec';
    } else {
        el.sTimer.textContent    = '0';
        el.sTimerLbl.textContent = 'sec';
    }
}

function setProgress(pct) {
    el.progressFill.style.width = Math.max(0, Math.min(100, pct)) + '%';
}

// ================================================================
// LIVE STATS
// ================================================================
function updateLiveStats() {
    el.sWpm.textContent    = getLiveWpm();
    el.sAcc.textContent    = getLiveAcc();
    el.sErrors.textContent = getLiveErrors();
}

function getLiveWpm() {
    if (!st.startTime) return 0;
    const min = (Date.now() - st.startTime) / 60000;
    if (min < 0.01) return 0;

    let correct = st.correctChars;
    const exp   = st.words[st.wordIdx] || '';
    for (let i = 0; i < Math.min(st.currentInput.length, exp.length); i++) {
        if (st.currentInput[i] === exp[i]) correct++;
    }
    return Math.max(0, Math.round((correct / 5) / min));
}

function getLiveAcc() {
    const totalTyped = st.totalTyped + st.currentInput.length;
    if (totalTyped === 0) return 100;

    let correct = st.correctChars;
    const exp   = st.words[st.wordIdx] || '';
    for (let i = 0; i < Math.min(st.currentInput.length, exp.length); i++) {
        if (st.currentInput[i] === exp[i]) correct++;
    }
    return Math.min(100, Math.round((correct / totalTyped) * 100));
}

function getLiveErrors() {
    let currErrors = 0;
    const exp    = st.words[st.wordIdx] || '';
    const typed  = st.currentInput;
    const minLen = Math.min(typed.length, exp.length);
    for (let i = 0; i < minLen; i++) {
        if (typed[i] !== exp[i]) currErrors++;
    }
    if (typed.length > exp.length) currErrors += typed.length - exp.length;
    return st.errorCount + currErrors;
}

// ================================================================
// END TEST
// ================================================================
function endTest() {
    if (st.finished) return;
    st.finished = true;
    st.endTime  = Date.now();

    clearInterval(st.timerHandle);
    clearInterval(st.wpmHandle);

    // Drain progress bar
    setProgress(cfg.mode === 'time' ? 0 : 100);

    const stats = calcFinalStats();
    showResults(stats);
    submitToBackend(stats);
}

function calcFinalStats() {
    const elapsedSec = (st.endTime - st.startTime) / 1000;
    const elapsedMin = elapsedSec / 60;

    let correct = 0, totalTyped = 0, errors = 0;

    st.typedWords.forEach((typed, idx) => {
        if (idx >= st.words.length) return;
        const expected = st.words[idx];
        totalTyped += typed.length;

        const minLen = Math.min(typed.length, expected.length);
        for (let i = 0; i < minLen; i++) {
            if (typed[i] === expected[i]) correct++;
            else errors++;
        }
        if (typed.length < expected.length) errors += expected.length - typed.length;
        if (typed.length > expected.length) errors += typed.length  - expected.length;
    });

    const wpm      = Math.max(0, Math.round((correct    / 5) / Math.max(elapsedMin, 0.001)));
    const rawWpm   = Math.max(0, Math.round((totalTyped / 5) / Math.max(elapsedMin, 0.001)));
    const accuracy = totalTyped === 0 ? 100 : Math.min(100, Math.round((correct / totalTyped) * 100));

    return {
        wpm, rawWpm, accuracy, errors,
        correctChars: correct,
        totalChars:   totalTyped,
        timeTaken:    Math.round(elapsedSec),
        mode:         cfg.mode,
        difficulty:   cfg.difficulty,
        topic:        cfg.topic
    };
}

// ================================================================
// RESULTS DISPLAY
// ================================================================
function showResults(s) {
    el.typingCard.classList.add('hidden');  // hide after a brief moment
    el.controls.classList.add('hidden');

    setTimeout(() => {
        el.typingCard.classList.add('hidden');
    }, 300);

    el.rWpm.textContent     = s.wpm;
    el.rAcc.textContent     = s.accuracy + '%';
    el.rRaw.textContent     = s.rawWpm;
    el.rErrors.textContent  = s.errors;
    el.rCorrect.textContent = s.correctChars;
    el.rTime.textContent    = s.timeTaken + 's';
    el.rMode.textContent    = cfg.mode === 'time' ? cfg.duration + 's' : cfg.wordLimit + ' words';
    el.rTopic.textContent   = capitalize(cfg.topic);

    // Grade
    const grade = calcGrade(s.wpm, s.accuracy);
    el.gradeBox.textContent = grade;
    el.gradeBox.className   = 'grade-box grade-' + grade;
    el.rcFeedback.textContent = calcFeedback(s.wpm, s.accuracy, grade);

    // Speed meter
    const pct = Math.min(100, (s.wpm / 120) * 100);
    setTimeout(() => {
        el.speedFill.style.width = pct + '%';
        el.speedDot.style.left   = pct + '%';
    }, 400);
    el.speedLevel.textContent = calcSpeedLevel(s.wpm);

    // Animate WPM counter
    animateCount(el.rWpm, 0, s.wpm, 900);

    // Personal best
    const pb = getPB();
    if (s.wpm > pb) {
        savePB(s.wpm);
        el.pbVal.textContent = s.wpm;
        el.pbBadge.classList.remove('hidden');
    } else {
        el.pbBadge.classList.add('hidden');
    }

    el.typingCard.classList.add('hidden');
    el.results.classList.add('visible');
}

function calcGrade(wpm, acc) {
    const score = wpm * (acc / 100);
    if (score >= 100) return 'S';
    if (score >= 75)  return 'A';
    if (score >= 50)  return 'B';
    if (score >= 30)  return 'C';
    if (score >= 12)  return 'D';
    return 'F';
}

function calcFeedback(wpm, acc, grade) {
    if (grade === 'S') return 'Legendary! You are in the top 1% of typists worldwide!';
    if (grade === 'A') return 'Excellent speed and precision — well above average!';
    if (grade === 'B') return 'Great work! You\'re making real progress.';
    if (grade === 'C') return 'Good effort! Steady practice will take you further.';
    if (acc < 80)      return 'Slow down a little and focus on accuracy first.';
    return 'Every expert started here — keep practising daily!';
}

function calcSpeedLevel(wpm) {
    if (wpm >= 100) return '🎯 Master Typist';
    if (wpm >= 70)  return '🚀 Expert';
    if (wpm >= 50)  return '⚡ Fast Typist';
    if (wpm >= 35)  return '🚴 Average';
    if (wpm >= 20)  return '🚶 Getting Started';
    return '🐢 Beginner';
}

function animateCount(domEl, from, to, ms) {
    const start = performance.now();
    (function tick(now) {
        const p = Math.min((now - start) / ms, 1);
        const e = 1 - Math.pow(1 - p, 3);
        domEl.textContent = Math.round(from + (to - from) * e);
        if (p < 1) requestAnimationFrame(tick);
    })(start);
}

function capitalize(s) {
    return s ? s[0].toUpperCase() + s.slice(1) : s;
}

// ================================================================
// BACKEND SUBMISSION
// ================================================================
async function submitToBackend(stats) {
    try {
        const res = await fetch('/api/result', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(stats)
        });
        if (!res.ok) return;
        const data = await res.json();

        // Let backend override grade/feedback
        if (data.grade) {
            el.gradeBox.textContent = data.grade;
            el.gradeBox.className   = 'grade-box grade-' + data.grade;
        }
        if (data.feedback) el.rcFeedback.textContent = data.feedback;

    } catch (e) {
        console.warn('[TypeMaster] Backend submission failed:', e.message);
    }
}

// ================================================================
// PERSONAL BEST
// ================================================================
const pbKey = () => `tm_${cfg.mode}_${cfg.duration}_${cfg.wordLimit}_${cfg.difficulty}`;
const getPB  = () => parseInt(localStorage.getItem(pbKey()) || '0', 10);
const savePB = (w) => localStorage.setItem(pbKey(), String(w));
function refreshPB() {
    const pb = getPB();
    el.pbVal.textContent = pb > 0 ? pb : '--';
}

// ================================================================
// FOCUS
// ================================================================
function focusInput() {
    if (st.finished) return;
    el.typingInput.focus();
    st.focused = true;
    el.typingCard.classList.add('focused');
    if (!st.started) el.startOverlay.classList.remove('hidden');
    moveCaret();
}

function blurInput() {
    st.focused = false;
    el.typingCard.classList.remove('focused');
}

// ================================================================
// RESTART
// ================================================================
function restart() {
    el.typingCard.classList.remove('hidden');
    el.controls.classList.remove('hidden');
    el.results.classList.remove('visible');
    resetState();
    renderAll();
    refreshTimerDisplay();
    focusInput();
}

async function loadNewText() {
    el.typingCard.classList.remove('hidden');
    el.controls.classList.remove('hidden');
    el.results.classList.remove('visible');
    resetState();
    await loadText();
    focusInput();
}

// ================================================================
// EVENT LISTENERS
// ================================================================
function setupListeners() {
    // Typing input
    el.typingInput.addEventListener('input',   onInput);
    el.typingInput.addEventListener('keydown', onKeyDown);
    el.typingInput.addEventListener('focus',   () => { st.focused = true; el.typingCard.classList.add('focused'); });
    el.typingInput.addEventListener('blur',    blurInput);

    // Click on card
    el.textZone.addEventListener('click', focusInput);
    el.typingCard.addEventListener('click', () => { if (!st.finished) focusInput(); });

    // Buttons
    el.restartBtn.addEventListener('click',  restart);
    el.newTextBtn.addEventListener('click',  loadNewText);
    el.tryAgainBtn.addEventListener('click', restart);
    el.newTestBtn.addEventListener('click',  loadNewText);

    // Mode tabs (header)
    document.querySelectorAll('.mode-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.mode-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            cfg.mode     = btn.dataset.mode;
            cfg.duration = parseInt(btn.dataset.dur  || cfg.duration,  10);
            cfg.wordLimit= parseInt(btn.dataset.wc   || cfg.wordLimit, 10);
            refreshPB();
            loadNewText();
        });
    });

    // Topic chips
    document.querySelectorAll('.topic-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.topic-chip').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            cfg.topic = btn.dataset.topic;
            loadNewText();
        });
    });

    // Difficulty
    document.querySelectorAll('.diff-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            cfg.difficulty = btn.dataset.diff;
            refreshPB();
            loadNewText();
        });
    });

    // Global shortcuts
    let tabDown = false;
    document.addEventListener('keydown', e => {
        if (e.key === 'Tab')   { e.preventDefault(); tabDown = true; return; }
        if (e.key === 'Enter' && tabDown) { e.preventDefault(); restart(); return; }
        if (e.key === 'Escape') { restart(); return; }
        // Auto-focus any key
        if (!st.focused && !st.finished && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
            focusInput();
        }
    });
    document.addEventListener('keyup', e => { if (e.key === 'Tab') tabDown = false; });

    // Resize → recalculate caret
    let rz;
    window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(moveCaret, 120); });
}