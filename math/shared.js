// ====================================================================
// shared.js — Shared math exercise engine
// ====================================================================
// Each page must define EXERCISE_CONFIG before loading this file:
//   EXERCISE_CONFIG = {
//     type: 'multiplication',           // API type
//     title: '🧮 Multiplications',
//     operator: '×',                    // display operator (for standard exercises)
//     generateProblem(level): { display, answer, feedbackText }
//       - display: string shown in the problem card (e.g. "7 × 8")
//       - answer: number (correct answer)
//       - feedbackText: string for challenge wrong feedback (e.g. "7 × 8 = 56")
//     isComparison: false,              // optional: true for comparison mode (3 buttons instead of input)
//   }
// ====================================================================

// ===== Messages =====
const CORRECT_MESSAGES = [
    "Bravo, c'est parfait ! 🌟",
    "Super, tu es un champion ! 💪",
    "Excellent travail ! 🎉",
    "Waouh, tu gères trop bien ! 🚀",
    "Magnifique, continue comme ça ! ⭐",
    "Tu es trop fort(e) ! 🏆",
    "Génial, quelle rapidité ! ⚡",
    "C'est exactement ça, bravo ! 👏",
    "Tu es un(e) vrai(e) mathématicien(ne) ! 🧠",
    "Incroyable, tu assures ! 🎯",
    "Fantastique, encore un de plus ! 🌈",
    "Tu es sur une super lancée ! 🔥",
];

const STREAK_MESSAGES = [
    { min: 5, messages: ["5 d'affilée, c'est impressionnant ! 🔥🔥", "Quelle série, tu es inarrêtable ! 💫"] },
    { min: 10, messages: ["10 bonnes réponses de suite ! Tu es incroyable ! 🏅", "Série de 10, chapeau ! 🎩✨"] },
    { min: 20, messages: ["20 de suite ?! Tu es un génie ! 🧠⚡", "Record incroyable de 20 ! 🌟🌟🌟"] },
];

const WRONG_MESSAGES = [
    "Pas tout à fait, mais tu y es presque ! 💪",
    "Ce n'est pas ça, mais ne lâche rien ! 🌟",
    "Oups, essaie encore, tu vas y arriver ! 😊",
    "Presque ! La bonne réponse était {answer}. On continue ! 🚀",
    "Pas grave, c'est en se trompant qu'on apprend ! 📚",
    "La réponse était {answer}. Tu feras mieux au prochain ! 💪",
    "Raté cette fois, mais tu progresses ! 🌱",
    "C'était {answer}. Allez, le prochain est pour toi ! ⭐",
    "Ce n'est pas facile, mais tu t'améliores ! 📈",
    "La bonne réponse était {answer}. Continue, tu es courageux(se) ! 🦁",
];

const COMPARISON_WRONG_MESSAGES = [
    "Pas tout à fait, regarde bien ! 💪",
    "Ce n'est pas ça, mais ne lâche rien ! 🌟",
    "Oups, essaie encore, tu vas y arriver ! 😊",
    "Presque ! C'était {answer}. On continue ! 🚀",
    "Pas grave, c'est en se trompant qu'on apprend ! 📚",
    "C'était {answer}. Tu feras mieux au prochain ! 💪",
    "Raté cette fois, mais tu progresses ! 🌱",
];

// ===== Public settings (challenges, announcements) =====
(async function loadPublicSettings() {
    try {
        const resp = await fetch('/api/settings/public');
        if (!resp.ok) return;
        const settings = await resp.json();

        if (settings.challenges_disabled && settings.challenges_disabled.includes(EXERCISE_CONFIG.type)) {
            const challengeTab = document.querySelector('[data-game="challenge"]');
            if (challengeTab) challengeTab.style.display = 'none';
            const lbTab = document.querySelector('[data-game="leaderboard"]');
            if (lbTab) lbTab.style.display = 'none';
        }

        if (settings.announcement) {
            const banner = document.createElement('div');
            banner.style.cssText = 'background:#e67e22;color:#fff;text-align:center;padding:8px 16px;font-size:0.9rem;position:sticky;top:0;z-index:999;';
            banner.textContent = settings.announcement;
            document.body.prepend(banner);
        }
    } catch {}
})();

// ===== Helpers =====
function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const tenths = Math.floor((seconds % 1) * 10);
    if (mins > 0) {
        return `${mins} min ${String(secs).padStart(2, '0')}s`;
    }
    return `${secs}.${tenths}s`;
}

// ====================================================================
// ===== PRACTICE MODE =====
// ====================================================================

const practiceState = {
    level: 'easy',
    correctCount: 0,
    wrongCount: 0,
    streak: 0,
    currentProblem: null,
};

const practiceEls = {
    problemDisplay: document.getElementById('problem-display'),
    problemCard: document.getElementById('problem-card'),
    answerInput: document.getElementById('answer-input'),
    answerForm: document.getElementById('answer-form'),
    message: document.getElementById('math-message'),
    correctCount: document.getElementById('correct-count'),
    wrongCount: document.getElementById('wrong-count'),
    streakCount: document.getElementById('streak-count'),
    diffButtons: document.querySelectorAll('#math-difficulty .mathdiff-btn'),
    // Comparison mode elements
    comparisonBtns: document.getElementById('comparison-buttons'),
};

function generatePracticeProblem() {
    practiceState.currentProblem = EXERCISE_CONFIG.generateProblem(practiceState.level);
    renderPracticeProblem();
}

function renderPracticeProblem() {
    const p = practiceState.currentProblem;
    practiceEls.problemDisplay.innerHTML = p.display;
    practiceEls.problemCard.classList.remove('correct-flash', 'wrong-flash');

    if (EXERCISE_CONFIG.isComparison) {
        // Enable buttons
        practiceEls.comparisonBtns.querySelectorAll('button').forEach(b => b.disabled = false);
    } else {
        practiceEls.answerInput.value = '';
        practiceEls.answerInput.focus();
    }
}

// Replace placeholder "?" with the answer, colored green or red
function revealAnswer(displayEl, answer, isCorrect) {
    const ph = displayEl.querySelector('.placeholder');
    if (ph) {
        const displayAnswer = EXERCISE_CONFIG.isComparison
            ? (answer === '<' ? '&lt;' : answer === '>' ? '&gt;' : '=')
            : answer;
        ph.innerHTML = displayAnswer;
        ph.classList.add(isCorrect ? 'answer-correct' : 'answer-wrong');
    }
}

function checkPracticeAnswer(userAnswer) {
    const correct = practiceState.currentProblem.answer;
    let isCorrect;

    if (EXERCISE_CONFIG.isComparison) {
        isCorrect = userAnswer === correct;
    } else {
        const parsed = parseInt(userAnswer, 10);
        if (isNaN(parsed)) return;
        isCorrect = parsed === correct;
    }

    revealAnswer(practiceEls.problemDisplay, correct, isCorrect);

    if (isCorrect) {
        practiceState.correctCount++;
        practiceState.streak++;
        practiceEls.correctCount.textContent = practiceState.correctCount;
        practiceEls.streakCount.textContent = practiceState.streak;

        let msg = null;
        for (let i = STREAK_MESSAGES.length - 1; i >= 0; i--) {
            if (practiceState.streak === STREAK_MESSAGES[i].min) {
                msg = pickRandom(STREAK_MESSAGES[i].messages);
                break;
            }
        }
        if (!msg) msg = pickRandom(CORRECT_MESSAGES);

        showPracticeMessage(msg, 'correct');
        practiceEls.problemCard.classList.add('correct-flash');
        setTimeout(() => practiceEls.problemCard.classList.remove('correct-flash'), 600);
        setTimeout(generatePracticeProblem, 800);
    } else {
        practiceState.wrongCount++;
        practiceState.streak = 0;
        practiceEls.wrongCount.textContent = practiceState.wrongCount;
        practiceEls.streakCount.textContent = practiceState.streak;

        const wrongMsgs = EXERCISE_CONFIG.isComparison ? COMPARISON_WRONG_MESSAGES : WRONG_MESSAGES;
        let msg = pickRandom(wrongMsgs).replace('{answer}', correct);
        showPracticeMessage(msg, 'wrong');

        practiceEls.problemCard.classList.add('wrong-flash');
        setTimeout(() => practiceEls.problemCard.classList.remove('wrong-flash'), 600);
        setTimeout(generatePracticeProblem, 1500);
    }
}

function showPracticeMessage(text, type) {
    practiceEls.message.textContent = text;
    practiceEls.message.className = type;
}

function resetPracticeScore() {
    practiceState.correctCount = 0;
    practiceState.wrongCount = 0;
    practiceState.streak = 0;
    practiceEls.correctCount.textContent = '0';
    practiceEls.wrongCount.textContent = '0';
    practiceEls.streakCount.textContent = '0';
    practiceEls.message.className = 'hidden';
}

// Difficulty switching
practiceEls.diffButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const level = btn.dataset.level;
        if (level === practiceState.level) return;
        practiceEls.diffButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        practiceState.level = level;
        resetPracticeScore();
        generatePracticeProblem();
    });
});

// Form submit
if (!EXERCISE_CONFIG.isComparison) {
    practiceEls.answerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const val = practiceEls.answerInput.value.trim();
        if (!val) return;
        checkPracticeAnswer(val);
    });
} else {
    // Comparison: 3 buttons
    practiceEls.comparisonBtns.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
            practiceEls.comparisonBtns.querySelectorAll('button').forEach(b => b.disabled = true);
            checkPracticeAnswer(btn.dataset.value);
        });
    });
}

// ====================================================================
// ===== TAB SWITCHING =====
// ====================================================================

document.querySelectorAll('#game-switcher .game-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('#game-switcher .game-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const game = tab.dataset.game;
        document.querySelectorAll('.game-panel').forEach(p => p.classList.add('hidden'));
        document.getElementById('game-' + game).classList.remove('hidden');

        if (game === 'practice' && !EXERCISE_CONFIG.isComparison) {
            practiceEls.answerInput.focus();
        }
        if (game === 'leaderboard') {
            loadLeaderboard();
        }
    });
});

// Collapsible menu (mobile)
document.querySelectorAll('.menu-toggle').forEach(toggle => {
    toggle.addEventListener('click', () => {
        const menu = toggle.nextElementSibling;
        const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', !isExpanded);
        menu.classList.toggle('collapsed', isExpanded);
    });
});

// ====================================================================
// ===== CHALLENGE MODE =====
// ====================================================================

const challengeState = {
    mode: '100',
    level: 'easy',
    running: false,
    currentProblem: null,
    totalAnswered: 0,
    totalCorrect: 0,
    totalWrong: 0,
    startTime: 0,
    elapsed: 0,
    timerInterval: null,
    timeLimit: 60,
    targetCount: 100,
};

const challengeEls = {
    diffBtns: document.querySelectorAll('#challenge-difficulty .mathdiff-btn'),
    modeBtns: document.querySelectorAll('.challenge-mode-btn'),
    startScreen: document.getElementById('challenge-start-screen'),
    playScreen: document.getElementById('challenge-play-screen'),
    resultScreen: document.getElementById('challenge-result-screen'),
    descText: document.getElementById('challenge-desc-text'),
    startBtn: document.getElementById('challenge-start-btn'),
    retryBtn: document.getElementById('challenge-retry-btn'),
    progressEl: document.getElementById('challenge-progress'),
    timerEl: document.getElementById('challenge-timer'),
    errorsEl: document.getElementById('challenge-errors'),
    problemDisplay: document.getElementById('challenge-problem-display'),
    problemCard: document.getElementById('challenge-problem-card'),
    answerForm: document.getElementById('challenge-answer-form'),
    answerInput: document.getElementById('challenge-answer-input'),
    feedback: document.getElementById('challenge-feedback'),
    resultTitle: document.getElementById('challenge-result-title'),
    resultStats: document.getElementById('challenge-result-stats'),
    resultMessage: document.getElementById('challenge-result-message'),
    comparisonBtns: document.getElementById('challenge-comparison-buttons'),
};

// Challenge difficulty
challengeEls.diffBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        challengeEls.diffBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        challengeState.level = btn.dataset.level;
    });
});

// Challenge mode
challengeEls.modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        challengeEls.modeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        challengeState.mode = btn.dataset.mode;
        updateChallengeDescription();
    });
});

function updateChallengeDescription() {
    const label = EXERCISE_CONFIG.title.toLowerCase();
    if (challengeState.mode === '100') {
        challengeEls.descText.textContent = `Fais 100 ${label} le plus vite possible !`;
    } else {
        challengeEls.descText.textContent = `Fais le maximum de ${label} en 1 minute !`;
    }
}

challengeEls.startBtn.addEventListener('click', startChallenge);
challengeEls.retryBtn.addEventListener('click', () => showChallengeScreen('start'));

function showChallengeScreen(screen) {
    challengeEls.startScreen.classList.toggle('hidden', screen !== 'start');
    challengeEls.playScreen.classList.toggle('hidden', screen !== 'play');
    challengeEls.resultScreen.classList.toggle('hidden', screen !== 'result');
}

function startChallenge() {
    challengeState.running = true;
    challengeState.totalAnswered = 0;
    challengeState.totalCorrect = 0;
    challengeState.totalWrong = 0;
    challengeState.startTime = Date.now();
    challengeEls.feedback.className = 'hidden';

    showChallengeScreen('play');
    updateChallengeStatus();
    generateChallengeProblem();

    if (challengeState.timerInterval) clearInterval(challengeState.timerInterval);
    challengeState.timerInterval = setInterval(updateChallengeTimer, 100);
}

function generateChallengeProblem() {
    challengeState.currentProblem = EXERCISE_CONFIG.generateProblem(challengeState.level);
    const p = challengeState.currentProblem;

    challengeEls.problemDisplay.innerHTML = p.display;
    challengeEls.problemCard.classList.remove('correct-flash', 'wrong-flash');

    if (EXERCISE_CONFIG.isComparison) {
        challengeEls.comparisonBtns.querySelectorAll('button').forEach(b => b.disabled = false);
    } else {
        challengeEls.answerInput.value = '';
        challengeEls.answerInput.focus();
    }
}

function updateChallengeStatus() {
    if (challengeState.mode === '100') {
        challengeEls.progressEl.textContent = `📝 ${challengeState.totalAnswered} / 100`;
    } else {
        challengeEls.progressEl.textContent = `📝 ${challengeState.totalAnswered}`;
    }
    challengeEls.errorsEl.textContent = `❌ ${challengeState.totalWrong}`;
}

function updateChallengeTimer() {
    const elapsed = (Date.now() - challengeState.startTime) / 1000;

    if (challengeState.mode === 'timer') {
        const remaining = Math.max(0, challengeState.timeLimit - elapsed);
        const mins = Math.floor(remaining / 60);
        const secs = Math.floor(remaining % 60);
        challengeEls.timerEl.textContent = `⏱️ ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        if (remaining <= 0) endChallenge();
    } else {
        const mins = Math.floor(elapsed / 60);
        const secs = Math.floor(elapsed % 60);
        challengeEls.timerEl.textContent = `⏱️ ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
}

function processChallengeAnswer(userAnswer) {
    if (!challengeState.running) return;
    const correct = challengeState.currentProblem.answer;
    let isCorrect;

    if (EXERCISE_CONFIG.isComparison) {
        isCorrect = userAnswer === correct;
    } else {
        const parsed = parseInt(userAnswer, 10);
        if (isNaN(parsed)) return;
        isCorrect = parsed === correct;
    }

    challengeState.totalAnswered++;

    revealAnswer(challengeEls.problemDisplay, correct, isCorrect);

    if (isCorrect) {
        challengeState.totalCorrect++;
        challengeEls.problemCard.classList.add('correct-flash');
        setTimeout(() => challengeEls.problemCard.classList.remove('correct-flash'), 400);
    } else {
        challengeState.totalWrong++;
        challengeEls.problemCard.classList.add('wrong-flash');
        challengeEls.feedback.textContent = challengeState.currentProblem.feedbackText;
        challengeEls.feedback.className = 'wrong';
        setTimeout(() => {
            challengeEls.problemCard.classList.remove('wrong-flash');
            challengeEls.feedback.className = 'hidden';
        }, 800);
    }

    updateChallengeStatus();

    if (challengeState.mode === '100' && challengeState.totalAnswered >= challengeState.targetCount) {
        endChallenge();
        return;
    }

    generateChallengeProblem();
}

// Challenge answer submit
if (!EXERCISE_CONFIG.isComparison) {
    challengeEls.answerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const val = challengeEls.answerInput.value.trim();
        if (!val) return;
        processChallengeAnswer(val);
    });
} else {
    challengeEls.comparisonBtns.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
            challengeEls.comparisonBtns.querySelectorAll('button').forEach(b => b.disabled = true);
            processChallengeAnswer(btn.dataset.value);
        });
    });
}

function endChallenge() {
    challengeState.running = false;
    if (challengeState.timerInterval) {
        clearInterval(challengeState.timerInterval);
        challengeState.timerInterval = null;
    }

    const elapsed = (Date.now() - challengeState.startTime) / 1000;
    challengeState.elapsed = elapsed;

    showChallengeScreen('result');
    resetSaveScoreForm();

    const accuracy = challengeState.totalAnswered > 0
        ? Math.round((challengeState.totalCorrect / challengeState.totalAnswered) * 100) : 0;

    if (challengeState.mode === '100') {
        challengeEls.resultTitle.textContent = '🏁 100 calculs terminés !';
        challengeEls.resultStats.innerHTML = `
            <div class="result-stat"><span class="result-label">⏱️ Temps</span><span class="result-value">${formatTime(elapsed)}</span></div>
            <div class="result-stat"><span class="result-label">✅ Bonnes réponses</span><span class="result-value">${challengeState.totalCorrect}</span></div>
            <div class="result-stat"><span class="result-label">❌ Erreurs</span><span class="result-value">${challengeState.totalWrong}</span></div>
            <div class="result-stat"><span class="result-label">🎯 Précision</span><span class="result-value">${accuracy}%</span></div>
        `;
    } else {
        challengeEls.resultTitle.textContent = '⏰ Temps écoulé !';
        challengeEls.resultStats.innerHTML = `
            <div class="result-stat"><span class="result-label">📝 Calculs faits</span><span class="result-value">${challengeState.totalAnswered}</span></div>
            <div class="result-stat"><span class="result-label">✅ Bonnes réponses</span><span class="result-value">${challengeState.totalCorrect}</span></div>
            <div class="result-stat"><span class="result-label">❌ Erreurs</span><span class="result-value">${challengeState.totalWrong}</span></div>
            <div class="result-stat"><span class="result-label">🎯 Précision</span><span class="result-value">${accuracy}%</span></div>
        `;
    }

    // Encouragement message
    if (accuracy === 100) {
        challengeEls.resultMessage.textContent = 'Parfait ! Aucune erreur, tu es un génie des maths ! 🧠✨';
    } else if (accuracy >= 90) {
        challengeEls.resultMessage.textContent = 'Super résultat ! Tu es vraiment doué(e) ! 🌟';
    } else if (accuracy >= 70) {
        challengeEls.resultMessage.textContent = 'Bon travail ! Continue de t\'entraîner ! 💪';
    } else {
        challengeEls.resultMessage.textContent = 'Ne lâche rien, tu vas t\'améliorer ! 🚀';
    }
}

// ====================================================================
// ===== OFFLINE SCORE STORAGE =====
// ====================================================================

const LOCAL_SCORES_KEY = 'math_local_scores';
const PENDING_SYNC_KEY = 'math_pending_sync';

function getLocalScores() {
    try { return JSON.parse(localStorage.getItem(LOCAL_SCORES_KEY) || '[]'); }
    catch { return []; }
}

function saveLocalScore(scoreObj) {
    const scores = getLocalScores();
    scores.push({ ...scoreObj, created_at: new Date().toISOString() });
    localStorage.setItem(LOCAL_SCORES_KEY, JSON.stringify(scores));
}

function getPendingSync() {
    try { return JSON.parse(localStorage.getItem(PENDING_SYNC_KEY) || '[]'); }
    catch { return []; }
}

function addPendingSync(scoreObj) {
    const pending = getPendingSync();
    pending.push(scoreObj);
    localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(pending));
}

function clearPendingSync() {
    localStorage.removeItem(PENDING_SYNC_KEY);
}

function getLocalScoresForQuery(type, mode, level) {
    return getLocalScores().filter(s => s.type === type && s.mode === mode && s.level === level);
}

async function syncPendingScores() {
    const pending = getPendingSync();
    if (!pending.length) return { synced: 0, failed: 0 };

    let synced = 0;
    const remaining = [];

    for (const scoreObj of pending) {
        try {
            const resp = await fetch('/api/scores', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(scoreObj),
            });
            if (resp.ok) {
                synced++;
            } else {
                remaining.push(scoreObj);
            }
        } catch {
            remaining.push(scoreObj);
        }
    }

    localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(remaining));
    return { synced, failed: remaining.length };
}

// ====================================================================
// ===== SAVE SCORE =====
// ====================================================================

const saveScoreForm = document.getElementById('save-score-form');
const saveScoreName = document.getElementById('save-score-name');
const saveScoreBtn = document.getElementById('save-score-btn');
const saveScoreStatus = document.getElementById('save-score-status');

function resetSaveScoreForm() {
    saveScoreForm.classList.remove('hidden');
    saveScoreName.value = '';
    saveScoreBtn.disabled = false;
    saveScoreStatus.className = 'hidden';
    saveScoreStatus.textContent = '';
}

saveScoreForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = saveScoreName.value.trim();
    if (!name) { saveScoreName.focus(); return; }

    saveScoreBtn.disabled = true;

    const score_value = challengeState.mode === '100'
        ? Math.round(challengeState.elapsed * 10) / 10
        : challengeState.totalCorrect;

    const scoreObj = {
        name,
        type: EXERCISE_CONFIG.type,
        mode: challengeState.mode,
        level: challengeState.level,
        score_value,
        correct: challengeState.totalCorrect,
        wrong: challengeState.totalWrong,
    };

    // Always save locally for offline leaderboard
    saveLocalScore(scoreObj);

    try {
        const resp = await fetch('/api/scores', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(scoreObj),
        });

        if (resp.ok) {
            saveScoreStatus.textContent = '✅ Score enregistré !';
            saveScoreStatus.className = 'save-success';
            saveScoreForm.classList.add('hidden');
        } else {
            const data = await resp.json();
            saveScoreStatus.textContent = data.error || 'Erreur lors de l\'enregistrement.';
            saveScoreStatus.className = 'save-error';
            saveScoreBtn.disabled = false;
        }
    } catch {
        // Offline — queue for sync later
        addPendingSync(scoreObj);
        saveScoreStatus.textContent = '📱 Score sauvegardé localement (synchronisation possible plus tard)';
        saveScoreStatus.className = 'save-offline';
        saveScoreForm.classList.add('hidden');
    }
});

// ====================================================================
// ===== LEADERBOARD =====
// ====================================================================

let lbMode = '100';
let lbLevel = 'easy';

const lbModeBtns = document.querySelectorAll('.lb-mode-btn');
const lbLevelBtns = document.querySelectorAll('.lb-level-btn');
const lbHeader = document.getElementById('lb-header');
const lbBody = document.getElementById('lb-body');
const lbEmpty = document.getElementById('lb-empty');
const lbLoading = document.getElementById('lb-loading');

lbModeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        lbModeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        lbMode = btn.dataset.mode;
        loadLeaderboard();
    });
});

lbLevelBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        lbLevelBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        lbLevel = btn.dataset.level;
        loadLeaderboard();
    });
});

async function loadLeaderboard() {
    lbBody.innerHTML = '';
    lbEmpty.classList.add('hidden');
    lbLoading.classList.remove('hidden');
    updateSyncBadge();

    if (lbMode === '100') {
        lbHeader.innerHTML = '<th>#</th><th>Prénom</th><th>Temps</th><th>✅</th><th>❌</th>';
    } else {
        lbHeader.innerHTML = '<th>#</th><th>Prénom</th><th>Score</th><th>✅</th><th>❌</th>';
    }

    let serverData = null;
    try {
        const resp = await fetch(`/api/scores?type=${EXERCISE_CONFIG.type}&mode=${lbMode}&level=${lbLevel}`);
        if (resp.ok) {
            serverData = await resp.json();
        }
    } catch { /* offline */ }

    // Get local scores for this query
    const localScores = getLocalScoresForQuery(EXERCISE_CONFIG.type, lbMode, lbLevel);

    let data;
    if (serverData !== null) {
        // Online: merge server data with local scores not yet synced
        const merged = [...serverData];
        // Add local scores (may include duplicates, but keeps local visible fast)
        for (const ls of localScores) {
            // Avoid exact duplicates by checking name + score_value + correct + wrong
            const isDup = merged.some(s =>
                s.name === ls.name &&
                s.score_value === ls.score_value &&
                s.correct === ls.correct &&
                s.wrong === ls.wrong
            );
            if (!isDup) {
                merged.push(ls);
            }
        }
        data = merged;
    } else {
        // Offline: use local scores only
        data = localScores;
    }

    // Sort
    if (lbMode === '100') {
        data.sort((a, b) => a.score_value - b.score_value); // fastest first
    } else {
        data.sort((a, b) => b.score_value - a.score_value); // highest first
    }

    // Keep top 20
    data = data.slice(0, 20);

    lbLoading.classList.add('hidden');

    if (!data.length) {
        lbEmpty.textContent = serverData === null
            ? '📱 Hors ligne — aucun score local pour le moment.'
            : 'Aucun score pour le moment. Sois le premier ! 🚀';
        lbEmpty.classList.remove('hidden');
        return;
    }

    // Show offline indicator
    if (serverData === null) {
        const offlineRow = document.createElement('tr');
        offlineRow.innerHTML = '<td colspan="5" style="text-align:center;color:#e67e22;font-size:.85rem;padding:6px">📱 Mode hors ligne — scores locaux uniquement</td>';
        lbBody.appendChild(offlineRow);
    }

    data.forEach((row, i) => {
        const tr = document.createElement('tr');
        const rank = i + 1;
        let medal = rank;
        if (rank === 1) medal = '🥇';
        else if (rank === 2) medal = '🥈';
        else if (rank === 3) medal = '🥉';

        const valueCell = lbMode === '100' ? formatTime(row.score_value) : row.score_value;

        tr.innerHTML = `
            <td class="lb-rank">${medal}</td>
            <td class="lb-name">${escapeHtml(row.name)}</td>
            <td class="lb-score">${valueCell}</td>
            <td class="lb-correct">${row.correct}</td>
            <td class="lb-wrong">${row.wrong}</td>
        `;
        if (rank <= 3) tr.classList.add('lb-top3');
        lbBody.appendChild(tr);
    });
}

// ====================================================================
// ===== SYNC BUTTON =====
// ====================================================================

function createSyncButton() {
    const lbPanel = document.getElementById('game-leaderboard');
    if (!lbPanel) return;

    const syncDiv = document.createElement('div');
    syncDiv.className = 'sync-bar';
    syncDiv.innerHTML = `
        <button id="sync-btn" class="sync-btn" title="Synchroniser les scores avec le serveur">
            🔄 Synchroniser <span id="sync-badge" class="sync-badge hidden">0</span>
        </button>
        <span id="sync-status" class="sync-status"></span>
    `;

    // Insert before the table
    const tableContainer = lbPanel.querySelector('.lb-table-container');
    if (tableContainer) {
        lbPanel.insertBefore(syncDiv, tableContainer);
    } else {
        lbPanel.appendChild(syncDiv);
    }

    document.getElementById('sync-btn').addEventListener('click', handleSync);
    updateSyncBadge();
}

function updateSyncBadge() {
    const badge = document.getElementById('sync-badge');
    if (!badge) return;
    const count = getPendingSync().length;
    badge.textContent = count;
    if (count > 0) {
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

async function handleSync() {
    const btn = document.getElementById('sync-btn');
    const status = document.getElementById('sync-status');
    btn.disabled = true;
    status.textContent = '⏳ Synchronisation...';
    status.className = 'sync-status';

    const result = await syncPendingScores();
    updateSyncBadge();

    if (result.synced > 0 && result.failed === 0) {
        status.textContent = `✅ ${result.synced} score(s) synchronisé(s) !`;
        status.className = 'sync-status sync-ok';
    } else if (result.synced > 0 && result.failed > 0) {
        status.textContent = `⚠️ ${result.synced} envoyé(s), ${result.failed} en attente`;
        status.className = 'sync-status sync-warn';
    } else if (result.failed > 0) {
        status.textContent = '❌ Hors ligne — réessaie plus tard';
        status.className = 'sync-status sync-fail';
    } else {
        status.textContent = '✅ Rien à synchroniser';
        status.className = 'sync-status sync-ok';
    }

    btn.disabled = false;

    // Reload leaderboard to reflect synced data
    setTimeout(() => loadLeaderboard(), 500);
    // Clear status after a few seconds
    setTimeout(() => { status.textContent = ''; }, 4000);
}

// ===== Init =====
createSyncButton();
updateChallengeDescription();
generatePracticeProblem();

// ===== Service Worker =====
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
}
