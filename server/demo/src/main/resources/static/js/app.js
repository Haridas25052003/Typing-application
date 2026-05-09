/* ================================================================
   TypeMaster — app.js
   Full typing-test engine with live WPM, accuracy, caret, results
   ================================================================ */

'use strict';

// ── Config (user settings) ───────────────────────────────────────
const cfg = {
    mode:      'time',   // 'time' | 'words'
    duration:  60,       // seconds  (time mode)
    wordLimit: 25,       // words    (words mode)
    difficulty:'easy'
};

// ── State (runtime) ──────────────────────────────────────────────
const st = {
    words:       [],   // string[]  — the test words
    typedWords:  [],   // string[]  — what user typed per completed word
    wordIdx:     0,    // current word index
    currentInput:'',   // what user is typing right now

    started:     false,
    finished:    false,
    focused:     false,

    startTime:   null,
    timerHandle: null,   // setInterval for countdown
    wpmHandle:   null,   // setInterval for live WPM update

    timeLeft:    60,     // countdown remaining (time mode)
    elapsed:     0,      // elapsed seconds (words mode display)

    // Accumulated correct + total chars from COMPLETED words
    correctChars:0,
    totalTyped:  0,

    _tab: false          // track Tab key for Tab+Enter shortcut
};

// ── DOM refs ─────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const el = {
    textDisplay:  $('textDisplay'),
    textWrap:     $('textWrap'),
    typingInput:  $('typingInput'),
    caret:        $('caret'),
    startOverlay: $('startOverlay'),
    overlayText:  $('overlayText'),

    lWpm:         $('lWpm'),
    lTimer:       $('lTimer'),
    lTimerLabel:  $('lTimerLabel'),
    lAcc:         $('lAcc'),

    settingsBar:  $('settingsBar'),
    timeOpts:     $('timeOpts'),
    wordOpts:     $('wordOpts'),
    typingZone:   $('typingZone'),
    actions:      $('actions'),

    restartBtn:   $('restartBtn'),
    newTextBtn:   $('newTextBtn'),

    results:      $('results'),
    gradeEl:      $('gradeEl'),
    feedbackEl:   $('feedbackEl'),
    pbNew:        $('pbNew'),
    rWpm:         $('rWpm'),
    rAcc:         $('rAcc'),
    rRaw:         $('rRaw'),
    rErrors:      $('rErrors'),
    rCorrect:     $('rCorrect'),
    rTime:        $('rTime'),
    rMode:        $('rMode'),
    rDiff:        $('rDiff'),
    tryAgainBtn:  $('tryAgainBtn'),
    newTestBtn:   $('newTestBtn'),

    pbWpm:        $('pbWpm'),
};

// ================================================================
// BOOT
// ================================================================
document.addEventListener('DOMContentLoaded', () => {
    loadPB();
    setupListeners();
    loadText();
});

// ================================================================
// TEXT LOADING
// ================================================================
async function loadText() {
    showLoadingState();
    try {
        const url = `/api/text?difficulty=${cfg.difficulty}&mode=${cfg.mode}&duration=${cfg.duration}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Server returned ${res.status}`);

        const data = await res.json();
        let words = data.text.trim().split(/\s+/).filter(Boolean);

        // Trim to word limit for words-mode
        if (cfg.mode === 'words') {
            words = words.slice(0, cfg.wordLimit);
        }

        st.words = words;
        resetState();
        renderAll();
        refreshTimerDisplay();
        el.typingInput.disabled = false;

    } catch (e) {
        console.error('Text load failed:', e);
        el.textDisplay.innerHTML = `<span class="load-error">⚠ Could not load text — is the server running?</span>`;
    }
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
        _tab:         false
    });

    el.typingInput.value = '';
    el.lWpm.textContent  = '0';
    el.lAcc.textContent  = '100';
    el.caret.style.opacity = '0';

    el.typingZone.classList.remove('typing-active');
    el.startOverlay.classList.remove('gone');

    // Show typing zone, hide results
    el.typingZone.classList.remove('hidden');
    el.actions.classList.remove('hidden');
    el.settingsBar.classList.remove('locked');
    el.results.classList.remove('visible');

    el.textDisplay.scrollTop = 0;
}

// ================================================================
// RENDER — build word + char DOM
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

    // Caret: start invisible, position on first char after a tick
    el.caret.style.opacity = '0';
    setTimeout(moveCaret, 60);
}

// Update chars of only the current word while user types
function updateCurrentWord() {
    const wEl = getWordEl(st.wordIdx);
    if (!wEl) return;

    const expected = st.words[st.wordIdx];
    const typed    = st.currentInput;

    // Remove previously added extra chars
    wEl.querySelectorAll('.extra').forEach(n => n.remove());

    // Update each character span
    const chars = wEl.querySelectorAll('.char:not(.extra)');
    chars.forEach((cEl, i) => {
        cEl.className = 'char';
        if (i < typed.length) {
            cEl.classList.add(typed[i] === expected[i] ? 'correct' : 'wrong');
        }
    });

    // Append extra characters (typed beyond word length)
    for (let i = expected.length; i < typed.length; i++) {
        const cEl = document.createElement('span');
        cEl.className = 'char wrong extra';
        cEl.textContent = typed[i];
        wEl.appendChild(cEl);
    }

    moveCaret();
}

// Mark a completed word as correct/error
function markCompletedWord(wIdx) {
    const wEl = getWordEl(wIdx);
    if (!wEl) return;
    const typed    = st.typedWords[wIdx] || '';
    const expected = st.words[wIdx] || '';
    wEl.classList.toggle('w-error', typed !== expected);
    // Set current marker on next word
    const nextEl = getWordEl(wIdx + 1);
    if (nextEl) nextEl.classList.add('w-current');
}

function getWordEl(idx) {
    return el.textDisplay.querySelector(`.word[data-w="${idx}"]`);
}

// ================================================================
// CARET POSITIONING
// ================================================================
function moveCaret() {
    const wEl = getWordEl(st.wordIdx);
    if (!wEl) return;

    // All visible chars (original + any extra)
    const allChars = wEl.querySelectorAll('.char');
    const typedLen = st.currentInput.length;

    // Target: the char the caret should appear BEFORE
    // If typed == word length, caret goes after last char
    let target = null;
    let after   = false;

    if (typedLen < allChars.length) {
        target = allChars[typedLen];
    } else if (allChars.length > 0) {
        target = allChars[allChars.length - 1];
        after  = true;
    }

    if (!target) { el.caret.style.opacity = '0'; return; }

    const displayRect = el.textDisplay.getBoundingClientRect();
    const targetRect  = target.getBoundingClientRect();

    const left = targetRect.left - displayRect.left + (after ? targetRect.width : 0);
    // Convert viewport-relative y to scroll-content-relative y
    const top  = (targetRect.top - displayRect.top) + el.textDisplay.scrollTop;

    el.caret.style.left    = left + 'px';
    el.caret.style.top     = top  + 'px';
    el.caret.style.opacity = '1';
}

// ================================================================
// INPUT HANDLING
// ================================================================

// `input` event — captures printable characters (incl. mobile keyboards)
function onInput() {
    if (st.finished) { el.typingInput.value = ''; return; }

    const val = el.typingInput.value;

    // Detect space typed via input event (mobile / some keyboards)
    if (val.endsWith(' ')) {
        el.typingInput.value = val.slice(0, -1);
        st.currentInput = el.typingInput.value;
        advanceWord();
        return;
    }

    // Start test on first actual character
    if (!st.started && val.length > 0) startTest();

    st.currentInput = val;
    updateCurrentWord();
    updateLiveStats();
}

// `keydown` event — handles special keys
function onKeyDown(e) {
    const key = e.key;

    // ── Global shortcuts (always active) ──
    if (key === 'Escape') { e.preventDefault(); restart(); return; }

    if (key === 'Tab') {
        e.preventDefault();
        st._tab = true;
        setTimeout(() => { st._tab = false; }, 1200);
        return;
    }
    if (key === 'Enter' && st._tab) {
        e.preventDefault();
        restart();
        return;
    }

    if (st.finished) return;

    // ── Space — advance to next word ──
    if (key === ' ') {
        e.preventDefault();
        advanceWord();
        return;
    }

    // ── Backspace — go back to previous word if current input empty ──
    if (key === 'Backspace' && el.typingInput.value === '' && st.wordIdx > 0) {
        e.preventDefault();
        goBackWord();
        return;
    }

    // Start test on first printable key
    if (!st.started && key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        startTest();
    }
}

// ── Advance word ─────────────────────────────────────────────────
function advanceWord() {
    if (st.currentInput.trim() === '') return; // ignore bare space

    const expected = st.words[st.wordIdx];
    const typed    = st.currentInput;

    // Tally stats for this completed word
    const minLen = Math.min(typed.length, expected.length);
    let wCorrect = 0;
    for (let i = 0; i < minLen; i++) {
        if (typed[i] === expected[i]) wCorrect++;
    }
    st.correctChars += wCorrect;
    st.totalTyped   += typed.length;

    // Record and advance
    st.typedWords[st.wordIdx] = typed;
    markCompletedWord(st.wordIdx);
    st.wordIdx++;
    st.currentInput = '';
    el.typingInput.value = '';

    // End condition (words mode)
    if (cfg.mode === 'words' && st.wordIdx >= st.words.length) {
        endTest();
        return;
    }

    updateCurrentWord();
    scrollToLine();
    updateLiveStats();
}

// ── Go back to previous word ─────────────────────────────────────
function goBackWord() {
    // Restore previous word to its typed state
    st.wordIdx--;

    // Reverse the stats we accumulated for that word
    const prevTyped    = st.typedWords[st.wordIdx] || '';
    const prevExpected = st.words[st.wordIdx]       || '';
    const minLen = Math.min(prevTyped.length, prevExpected.length);
    let prevCorrect = 0;
    for (let i = 0; i < minLen; i++) {
        if (prevTyped[i] === prevExpected[i]) prevCorrect++;
    }
    st.correctChars = Math.max(0, st.correctChars - prevCorrect);
    st.totalTyped   = Math.max(0, st.totalTyped   - prevTyped.length);

    // Restore input and clear record
    st.currentInput = prevTyped;
    el.typingInput.value = prevTyped;
    delete st.typedWords[st.wordIdx];

    // Reset word el style
    const wEl = getWordEl(st.wordIdx);
    if (wEl) wEl.className = 'word';

    updateCurrentWord();
    updateLiveStats();
}

// ── Keep current word on the 2nd visible line ────────────────────
function scrollToLine() {
    const wEl = getWordEl(st.wordIdx);
    if (!wEl) return;

    const lineH   = 48; // matches CSS line-height
    const wordTop = wEl.offsetTop;

    // If the word has moved past the first line, scroll so it stays on line 2
    if (wordTop >= el.textDisplay.scrollTop + lineH) {
        el.textDisplay.scrollTop = wordTop - lineH;
    }
}

// ================================================================
// TIMER
// ================================================================
function startTest() {
    if (st.started) return;
    st.started   = true;
    st.startTime = Date.now();

    el.settingsBar.classList.add('locked');
    el.startOverlay.classList.add('gone');
    el.typingZone.classList.add('typing-active');

    if (cfg.mode === 'time') {
        st.timeLeft   = cfg.duration;
        st.timerHandle = setInterval(() => {
            st.timeLeft--;
            el.lTimer.textContent = st.timeLeft;
            if (st.timeLeft <= 0) endTest();
        }, 1000);
    } else {
        // Words mode — show elapsed time counting up
        st.timerHandle = setInterval(() => {
            st.elapsed++;
            el.lTimer.textContent = st.elapsed;
        }, 1000);
    }

    // Refresh live WPM every 500 ms
    st.wpmHandle = setInterval(updateLiveStats, 500);
}

function refreshTimerDisplay() {
    if (cfg.mode === 'time') {
        el.lTimer.textContent    = cfg.duration;
        el.lTimerLabel.textContent = 'sec';
    } else {
        el.lTimer.textContent    = cfg.wordLimit;
        el.lTimerLabel.textContent = 'words';
    }
}

// ================================================================
// LIVE STATS
// ================================================================
function updateLiveStats() {
    el.lWpm.textContent = getLiveWpm();
    el.lAcc.textContent = getLiveAcc();
}

function getLiveWpm() {
    if (!st.startTime) return 0;
    const min = (Date.now() - st.startTime) / 60000;
    if (min < 0.01) return 0;

    // Include current word partial progress
    let correct = st.correctChars;
    const exp   = st.words[st.wordIdx] || '';
    for (let i = 0; i < Math.min(st.currentInput.length, exp.length); i++) {
        if (st.currentInput[i] === exp[i]) correct++;
    }

    return Math.round((correct / 5) / min);
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

// ================================================================
// END TEST & FINAL STATS
// ================================================================
function endTest() {
    if (st.finished) return;
    st.finished = true;
    st.endTime  = Date.now();

    clearInterval(st.timerHandle);
    clearInterval(st.wpmHandle);

    const stats = calcFinalStats();
    displayResults(stats);
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
        // missed characters
        if (typed.length < expected.length) errors += expected.length - typed.length;
        // extra characters
        if (typed.length > expected.length) errors += typed.length - expected.length;
    });

    const wpm    = totalTyped === 0 ? 0 : Math.max(0, Math.round((correct   / 5) / Math.max(elapsedMin, 0.001)));
    const rawWpm = totalTyped === 0 ? 0 : Math.max(0, Math.round((totalTyped / 5) / Math.max(elapsedMin, 0.001)));
    const accuracy = totalTyped === 0 ? 100 : Math.min(100, Math.max(0, Math.round((correct / totalTyped) * 100)));

    return {
        wpm, rawWpm, accuracy, errors,
        correctChars: correct,
        totalChars:   totalTyped,
        timeTaken:    Math.round(elapsedSec),
        mode:         cfg.mode,
        difficulty:   cfg.difficulty
    };
}

// ================================================================
// RESULTS DISPLAY
// ================================================================
function displayResults(s) {
    // Switch views
    el.typingZone.classList.add('hidden');
    el.actions.classList.add('hidden');
    el.settingsBar.classList.remove('locked');

    // Grade & feedback (computed locally — overwritten by backend response if available)
    const grade    = localGrade(s.wpm, s.accuracy);
    const feedback = localFeedback(s.wpm, s.accuracy, grade);

    el.gradeEl.textContent    = grade;
    el.gradeEl.className      = `grade grade-${grade}`;
    el.feedbackEl.textContent = feedback;

    // Big stats — animate counting up
    animCount(el.rWpm, 0, s.wpm, 900);
    el.rAcc.textContent = s.accuracy + '%';

    // Detail cells
    el.rRaw.textContent     = s.rawWpm;
    el.rErrors.textContent  = s.errors;
    el.rCorrect.textContent = s.correctChars;
    el.rTime.textContent    = s.timeTaken + 's';
    el.rMode.textContent    = cfg.mode === 'time' ? `${cfg.duration}s` : `${cfg.wordLimit} words`;
    el.rDiff.textContent    = cfg.difficulty;

    // Personal best check
    const pb = getPB();
    if (s.wpm > pb) {
        savePB(s.wpm);
        el.pbWpm.textContent = s.wpm;
        el.pbNew.classList.remove('hidden');
    } else {
        el.pbNew.classList.add('hidden');
    }

    el.results.classList.add('visible');
}

function localGrade(wpm, acc) {
    const score = wpm * (acc / 100);
    if (score >= 110) return 'S';
    if (score >= 85)  return 'A';
    if (score >= 60)  return 'B';
    if (score >= 35)  return 'C';
    if (score >= 15)  return 'D';
    return 'F';
}

function localFeedback(wpm, acc, grade) {
    if (grade === 'S') return 'Legendary! You belong in the hall of fame!';
    if (grade === 'A') return 'Excellent! You are well above average!';
    if (grade === 'B') return 'Great work! Keep pushing your limits!';
    if (grade === 'C') return 'Good job! Consistency is key — keep it up!';
    if (acc < 80)      return 'Focus on accuracy first — speed will naturally follow!';
    return 'Every expert was once a beginner. Keep practising!';
}

// Smooth number count animation
function animCount(domEl, from, to, durationMs) {
    const start = performance.now();
    function tick(now) {
        const progress = Math.min((now - start) / durationMs, 1);
        const eased    = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        domEl.textContent = Math.round(from + (to - from) * eased);
        if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
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
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        console.log('[TypeMaster] Result saved:', data.message);

        // Overwrite grade/feedback with server response
        if (data.grade) {
            el.gradeEl.textContent = data.grade;
            el.gradeEl.className   = `grade grade-${data.grade}`;
        }
        if (data.feedback) {
            el.feedbackEl.textContent = data.feedback;
        }
    } catch (err) {
        // Non-critical — results are already displayed from local calculation
        console.warn('[TypeMaster] Could not submit result to backend:', err.message);
    }
}

// ================================================================
// PERSONAL BEST (localStorage)
// ================================================================
function pbKey() { return `tm_pb_${cfg.mode}_${cfg.duration}_${cfg.wordLimit}_${cfg.difficulty}`; }
function getPB()  { return parseInt(localStorage.getItem(pbKey()) || '0', 10); }
function savePB(wpm) { localStorage.setItem(pbKey(), String(wpm)); }
function loadPB() {
    const pb = getPB();
    el.pbWpm.textContent = pb > 0 ? pb : '--';
}

// ================================================================
// FOCUS / BLUR
// ================================================================
function focusInput() {
    if (st.finished) return;
    el.typingInput.focus();
    st.focused = true;
    el.typingZone.classList.add('focused');
    if (!st.started) el.startOverlay.classList.remove('gone'); // keep overlay until first key
    moveCaret();
}

function blurInput() {
    st.focused = false;
    el.typingZone.classList.remove('focused');
}

// ================================================================
// RESTART / NEW TEXT
// ================================================================
function restart() {
    resetState();
    renderAll();
    refreshTimerDisplay();
    focusInput();
}

async function loadNewText() {
    resetState();
    el.typingInput.disabled = true;
    await loadText();
    focusInput();
}

function showLoadingState() {
    el.textDisplay.innerHTML = '<span class="loading-words">loading...</span>';
    el.startOverlay.classList.add('gone');
    el.caret.style.opacity = '0';
}

// ================================================================
// SETTINGS HELPERS
// ================================================================
function setActiveBtn(group, attr, value) {
    document.querySelectorAll(`[${attr}]`).forEach(b => {
        const match = b.dataset[attr.replace('data-', '')] === value.toString() ||
                      b.getAttribute(attr) === value.toString();
        b.classList.toggle('active', match);
        b.setAttribute('aria-pressed', String(match));
    });
}

// ================================================================
// EVENT LISTENERS
// ================================================================
function setupListeners() {

    // ── Typing input ──
    el.typingInput.addEventListener('input',   onInput);
    el.typingInput.addEventListener('keydown', onKeyDown);
    el.typingInput.addEventListener('focus',   () => {
        st.focused = true;
        el.typingZone.classList.add('focused');
    });
    el.typingInput.addEventListener('blur', blurInput);

    // Click on text area focuses input
    el.textWrap.addEventListener('click', focusInput);

    // ── Control buttons ──
    el.restartBtn.addEventListener('click', restart);
    el.newTextBtn.addEventListener('click', loadNewText);
    el.tryAgainBtn.addEventListener('click', restart);
    el.newTestBtn.addEventListener('click',  loadNewText);

    // ── Mode buttons ──
    document.querySelectorAll('[data-mode]').forEach(btn => {
        btn.addEventListener('click', () => {
            cfg.mode = btn.dataset.mode;
            document.querySelectorAll('[data-mode]').forEach(b => {
                b.classList.toggle('active', b.dataset.mode === cfg.mode);
                b.setAttribute('aria-pressed', String(b.dataset.mode === cfg.mode));
            });
            el.timeOpts.classList.toggle('hidden', cfg.mode !== 'time');
            el.wordOpts.classList.toggle('hidden', cfg.mode !== 'words');
            loadPB();
            loadNewText();
        });
    });

    // ── Duration buttons ──
    document.querySelectorAll('[data-time]').forEach(btn => {
        btn.addEventListener('click', () => {
            cfg.duration = parseInt(btn.dataset.time, 10);
            document.querySelectorAll('[data-time]').forEach(b =>
                b.classList.toggle('active', b.dataset.time === String(cfg.duration)));
            loadPB();
            loadNewText();
        });
    });

    // ── Word count buttons ──
    document.querySelectorAll('[data-words]').forEach(btn => {
        btn.addEventListener('click', () => {
            cfg.wordLimit = parseInt(btn.dataset.words, 10);
            document.querySelectorAll('[data-words]').forEach(b =>
                b.classList.toggle('active', b.dataset.words === String(cfg.wordLimit)));
            loadPB();
            loadNewText();
        });
    });

    // ── Difficulty buttons ──
    document.querySelectorAll('[data-diff]').forEach(btn => {
        btn.addEventListener('click', () => {
            cfg.difficulty = btn.dataset.diff;
            document.querySelectorAll('[data-diff]').forEach(b => {
                b.classList.toggle('active', b.dataset.diff === cfg.difficulty);
                b.setAttribute('aria-pressed', String(b.dataset.diff === cfg.difficulty));
            });
            loadPB();
            loadNewText();
        });
    });

    // ── Global keyboard shortcuts ──
    document.addEventListener('keydown', e => {
        // Tab + Enter
        if (e.key === 'Tab') { e.preventDefault(); st._tab = true; }
        if (e.key === 'Enter' && st._tab) { e.preventDefault(); restart(); st._tab = false; return; }

        // Escape
        if (e.key === 'Escape') { restart(); return; }

        // Auto-focus: any printable key when input not focused
        if (!st.focused && !st.finished && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
            focusInput();
        }
    });
    document.addEventListener('keyup', e => {
        if (e.key === 'Tab') setTimeout(() => { st._tab = false; }, 100);
    });

    // Recalculate caret on window resize
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(moveCaret, 120);
    });
}