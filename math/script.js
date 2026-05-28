// ===== Math Exercises =====

// State
let currentLevel = 'easy';
let operandA = 0;
let operandB = 0;
let correctAnswer = 0;
let correctCount = 0;
let wrongCount = 0;
let streak = 0;

// DOM refs
const operandAEl = document.getElementById('operand-a');
const operandBEl = document.getElementById('operand-b');
const answerInput = document.getElementById('answer-input');
const answerForm = document.getElementById('answer-form');
const mathMessage = document.getElementById('math-message');
const correctCountEl = document.getElementById('correct-count');
const wrongCountEl = document.getElementById('wrong-count');
const streakCountEl = document.getElementById('streak-count');
const problemCard = document.getElementById('problem-card');
const diffButtons = document.querySelectorAll('#math-difficulty .mathdiff-btn');

// Encouraging messages for correct answers
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

// Streak-specific messages
const STREAK_MESSAGES = [
    { min: 5, messages: ["5 d'affilée, c'est impressionnant ! 🔥🔥", "Quelle série, tu es inarrêtable ! 💫"] },
    { min: 10, messages: ["10 bonnes réponses de suite ! Tu es incroyable ! 🏅", "Série de 10, chapeau ! 🎩✨"] },
    { min: 20, messages: ["20 de suite ?! Tu es un génie ! 🧠⚡", "Record incroyable de 20 ! 🌟🌟🌟"] },
];

// Encouraging messages for wrong answers
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

// ===== Random number helpers =====
function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// ===== Generate operands based on level =====
function generateOperands(level) {
    let a, b;
    switch (level) {
        case 'easy':
            a = randInt(2, 9);
            b = randInt(2, 9);
            break;
        case 'medium':
            a = randInt(2, 9);
            b = randInt(10, 99);
            break;
        case 'hard':
            a = randInt(10, 99);
            b = randInt(10, 99);
            break;
    }
    return { a, b, answer: a * b };
}

// ===== Generate a problem (practice mode) =====
function generateProblem() {
    const p = generateOperands(currentLevel);
    operandA = p.a;
    operandB = p.b;
    correctAnswer = p.answer;
    renderProblem();
}

function renderProblem() {
    operandAEl.textContent = operandA;
    operandBEl.textContent = operandB;
    answerInput.value = '';
    answerInput.focus();

    // Reset card style
    problemCard.classList.remove('correct-flash', 'wrong-flash');
}

// ===== Check answer =====
function checkAnswer(userAnswer) {
    const parsed = parseInt(userAnswer, 10);
    if (isNaN(parsed)) return;

    if (parsed === correctAnswer) {
        correctCount++;
        streak++;
        correctCountEl.textContent = correctCount;
        streakCountEl.textContent = streak;

        // Pick message (streak-specific or random)
        let msg = null;
        for (let i = STREAK_MESSAGES.length - 1; i >= 0; i--) {
            if (streak === STREAK_MESSAGES[i].min) {
                msg = pickRandom(STREAK_MESSAGES[i].messages);
                break;
            }
        }
        if (!msg) msg = pickRandom(CORRECT_MESSAGES);

        showMessage(msg, 'correct');

        problemCard.classList.add('correct-flash');
        setTimeout(() => problemCard.classList.remove('correct-flash'), 600);

        // Next problem after a brief pause
        setTimeout(generateProblem, 800);
    } else {
        wrongCount++;
        streak = 0;
        wrongCountEl.textContent = wrongCount;
        streakCountEl.textContent = streak;

        let msg = pickRandom(WRONG_MESSAGES).replace('{answer}', correctAnswer);
        showMessage(msg, 'wrong');

        problemCard.classList.add('wrong-flash');
        setTimeout(() => problemCard.classList.remove('wrong-flash'), 600);

        // Next problem after showing the answer
        setTimeout(generateProblem, 1500);
    }
}

function showMessage(text, type) {
    mathMessage.textContent = text;
    mathMessage.className = type; // 'correct' or 'wrong'
}

// ===== Difficulty switching (practice) =====
diffButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const level = btn.dataset.level;
        if (level === currentLevel) return;
        diffButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentLevel = level;
        resetScore();
        generateProblem();
    });
});

function resetScore() {
    correctCount = 0;
    wrongCount = 0;
    streak = 0;
    correctCountEl.textContent = '0';
    wrongCountEl.textContent = '0';
    streakCountEl.textContent = '0';
    mathMessage.className = 'hidden';
}

// ===== Form submit (practice) =====
answerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = answerInput.value.trim();
    if (!val) return;
    checkAnswer(val);
});

// ===== Tab switching =====
document.querySelectorAll('#game-switcher .game-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('#game-switcher .game-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const game = tab.dataset.game;
        document.querySelectorAll('.game-panel').forEach(p => p.classList.add('hidden'));
        document.getElementById('game-' + game).classList.remove('hidden');

        if (game === 'multiply') {
            answerInput.focus();
        }
        if (game === 'leaderboard') {
            loadLeaderboard();
        }
    });
});

// ===== Collapsible menu (mobile) =====
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
    mode: '100',         // '100' or 'timer'
    level: 'easy',
    running: false,
    operandA: 0,
    operandB: 0,
    correctAnswer: 0,
    totalAnswered: 0,
    totalCorrect: 0,
    totalWrong: 0,
    startTime: 0,
    timerInterval: null,
    timeLimit: 60,       // seconds for timer mode
    targetCount: 100,    // for 100-calc mode
};

// Challenge DOM refs
const challengeDiffBtns = document.querySelectorAll('#challenge-difficulty .mathdiff-btn');
const challengeModeBtns = document.querySelectorAll('.challenge-mode-btn');
const challengeStartScreen = document.getElementById('challenge-start-screen');
const challengePlayScreen = document.getElementById('challenge-play-screen');
const challengeResultScreen = document.getElementById('challenge-result-screen');
const challengeDescText = document.getElementById('challenge-desc-text');
const challengeStartBtn = document.getElementById('challenge-start-btn');
const challengeRetryBtn = document.getElementById('challenge-retry-btn');
const challengeProgressEl = document.getElementById('challenge-progress');
const challengeTimerEl = document.getElementById('challenge-timer');
const challengeErrorsEl = document.getElementById('challenge-errors');
const challengeOperandA = document.getElementById('challenge-operand-a');
const challengeOperandB = document.getElementById('challenge-operand-b');
const challengeProblemCard = document.getElementById('challenge-problem-card');
const challengeAnswerForm = document.getElementById('challenge-answer-form');
const challengeAnswerInput = document.getElementById('challenge-answer-input');
const challengeFeedback = document.getElementById('challenge-feedback');
const challengeResultTitle = document.getElementById('challenge-result-title');
const challengeResultStats = document.getElementById('challenge-result-stats');
const challengeResultMessage = document.getElementById('challenge-result-message');

// Challenge difficulty switching
challengeDiffBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        challengeDiffBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        challengeState.level = btn.dataset.level;
    });
});

// Challenge mode switching
challengeModeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        challengeModeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        challengeState.mode = btn.dataset.mode;
        updateChallengeDescription();
    });
});

function updateChallengeDescription() {
    if (challengeState.mode === '100') {
        challengeDescText.textContent = 'Fais 100 multiplications le plus vite possible !';
    } else {
        challengeDescText.textContent = 'Fais le maximum de multiplications en 1 minute !';
    }
}

// Start challenge
challengeStartBtn.addEventListener('click', startChallenge);
challengeRetryBtn.addEventListener('click', () => {
    showChallengeScreen('start');
});

function showChallengeScreen(screen) {
    challengeStartScreen.classList.toggle('hidden', screen !== 'start');
    challengePlayScreen.classList.toggle('hidden', screen !== 'play');
    challengeResultScreen.classList.toggle('hidden', screen !== 'result');
}

function startChallenge() {
    challengeState.running = true;
    challengeState.totalAnswered = 0;
    challengeState.totalCorrect = 0;
    challengeState.totalWrong = 0;
    challengeState.startTime = Date.now();
    challengeFeedback.className = 'hidden';

    showChallengeScreen('play');
    updateChallengeStatus();
    generateChallengeProblem();

    // Start timer
    if (challengeState.timerInterval) clearInterval(challengeState.timerInterval);
    challengeState.timerInterval = setInterval(updateChallengeTimer, 100);
}

function generateChallengeProblem() {
    const p = generateOperands(challengeState.level);
    challengeState.operandA = p.a;
    challengeState.operandB = p.b;
    challengeState.correctAnswer = p.answer;

    challengeOperandA.textContent = p.a;
    challengeOperandB.textContent = p.b;
    challengeAnswerInput.value = '';
    challengeAnswerInput.focus();
    challengeProblemCard.classList.remove('correct-flash', 'wrong-flash');
}

function updateChallengeStatus() {
    if (challengeState.mode === '100') {
        challengeProgressEl.textContent = `📝 ${challengeState.totalAnswered} / 100`;
    } else {
        challengeProgressEl.textContent = `📝 ${challengeState.totalAnswered}`;
    }
    challengeErrorsEl.textContent = `❌ ${challengeState.totalWrong}`;
}

function updateChallengeTimer() {
    const elapsed = (Date.now() - challengeState.startTime) / 1000;

    if (challengeState.mode === 'timer') {
        const remaining = Math.max(0, challengeState.timeLimit - elapsed);
        const mins = Math.floor(remaining / 60);
        const secs = Math.floor(remaining % 60);
        challengeTimerEl.textContent = `⏱️ ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

        if (remaining <= 0) {
            endChallenge();
        }
    } else {
        const mins = Math.floor(elapsed / 60);
        const secs = Math.floor(elapsed % 60);
        challengeTimerEl.textContent = `⏱️ ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
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

// Challenge answer submit
challengeAnswerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!challengeState.running) return;
    const val = challengeAnswerInput.value.trim();
    if (!val) return;

    const parsed = parseInt(val, 10);
    if (isNaN(parsed)) return;

    challengeState.totalAnswered++;

    if (parsed === challengeState.correctAnswer) {
        challengeState.totalCorrect++;
        challengeProblemCard.classList.add('correct-flash');
        setTimeout(() => challengeProblemCard.classList.remove('correct-flash'), 400);
    } else {
        challengeState.totalWrong++;
        challengeProblemCard.classList.add('wrong-flash');
        challengeFeedback.textContent = `${challengeState.operandA} × ${challengeState.operandB} = ${challengeState.correctAnswer}`;
        challengeFeedback.className = 'wrong';
        setTimeout(() => {
            challengeProblemCard.classList.remove('wrong-flash');
            challengeFeedback.className = 'hidden';
        }, 800);
    }

    updateChallengeStatus();

    // Check end condition for 100-calc mode
    if (challengeState.mode === '100' && challengeState.totalAnswered >= challengeState.targetCount) {
        endChallenge();
        return;
    }

    generateChallengeProblem();
});

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

    if (challengeState.mode === '100') {
        challengeResultTitle.textContent = '🏁 100 calculs terminés !';
        const accuracy = challengeState.totalAnswered > 0
            ? Math.round((challengeState.totalCorrect / challengeState.totalAnswered) * 100) : 0;
        challengeResultStats.innerHTML = `
            <div class="result-stat"><span class="result-label">⏱️ Temps</span><span class="result-value">${formatTime(elapsed)}</span></div>
            <div class="result-stat"><span class="result-label">✅ Bonnes réponses</span><span class="result-value">${challengeState.totalCorrect}</span></div>
            <div class="result-stat"><span class="result-label">❌ Erreurs</span><span class="result-value">${challengeState.totalWrong}</span></div>
            <div class="result-stat"><span class="result-label">🎯 Précision</span><span class="result-value">${accuracy}%</span></div>
        `;
        if (accuracy === 100) {
            challengeResultMessage.textContent = 'Parfait ! Aucune erreur, tu es un génie des maths ! 🧠✨';
        } else if (accuracy >= 90) {
            challengeResultMessage.textContent = 'Super résultat ! Tu es vraiment doué(e) ! 🌟';
        } else if (accuracy >= 70) {
            challengeResultMessage.textContent = 'Bon travail ! Continue de t\'entraîner ! 💪';
        } else {
            challengeResultMessage.textContent = 'Ne lâche rien, tu vas t\'améliorer ! 🚀';
        }
    } else {
        challengeResultTitle.textContent = '⏰ Temps écoulé !';
        const accuracy = challengeState.totalAnswered > 0
            ? Math.round((challengeState.totalCorrect / challengeState.totalAnswered) * 100) : 0;
        challengeResultStats.innerHTML = `
            <div class="result-stat"><span class="result-label">📝 Calculs faits</span><span class="result-value">${challengeState.totalAnswered}</span></div>
            <div class="result-stat"><span class="result-label">✅ Bonnes réponses</span><span class="result-value">${challengeState.totalCorrect}</span></div>
            <div class="result-stat"><span class="result-label">❌ Erreurs</span><span class="result-value">${challengeState.totalWrong}</span></div>
            <div class="result-stat"><span class="result-label">🎯 Précision</span><span class="result-value">${accuracy}%</span></div>
        `;
        if (challengeState.totalCorrect >= 50) {
            challengeResultMessage.textContent = 'Incroyable ! Tu calcules à la vitesse de la lumière ! ⚡🏆';
        } else if (challengeState.totalCorrect >= 30) {
            challengeResultMessage.textContent = 'Impressionnant, quel rythme ! 🔥';
        } else if (challengeState.totalCorrect >= 15) {
            challengeResultMessage.textContent = 'Bien joué ! Tu peux encore aller plus vite ! 💪';
        } else {
            challengeResultMessage.textContent = 'C\'est un bon début, entraîne-toi encore ! 🌱';
        }
    }
}

// ====================================================================
// ===== SAVE SCORE =====
// ====================================================================

const saveScoreForm = document.getElementById('save-score-form');
const saveScoreName = document.getElementById('save-score-name');
const saveScoreBtn = document.getElementById('save-score-btn');
const saveScoreStatus = document.getElementById('save-score-status');
const saveScoreSection = document.getElementById('save-score-section');

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
    if (!name) {
        saveScoreName.focus();
        return;
    }

    saveScoreBtn.disabled = true;

    // score_value: time for mode 100, correct count for timer
    const score_value = challengeState.mode === '100'
        ? Math.round(challengeState.elapsed * 10) / 10
        : challengeState.totalCorrect;

    try {
        const resp = await fetch('/api/scores', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                mode: challengeState.mode,
                level: challengeState.level,
                score_value,
                correct: challengeState.totalCorrect,
                wrong: challengeState.totalWrong,
            }),
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
        saveScoreStatus.textContent = 'Impossible de contacter le serveur.';
        saveScoreStatus.className = 'save-error';
        saveScoreBtn.disabled = false;
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

    // Build header
    if (lbMode === '100') {
        lbHeader.innerHTML = '<th>#</th><th>Prénom</th><th>Temps</th><th>✅</th><th>❌</th>';
    } else {
        lbHeader.innerHTML = '<th>#</th><th>Prénom</th><th>Score</th><th>✅</th><th>❌</th>';
    }

    try {
        const resp = await fetch(`/api/scores?mode=${lbMode}&level=${lbLevel}`);
        const data = await resp.json();
        lbLoading.classList.add('hidden');

        if (!data.length) {
            lbEmpty.classList.remove('hidden');
            return;
        }

        data.forEach((row, i) => {
            const tr = document.createElement('tr');
            const rank = i + 1;
            let medal = rank;
            if (rank === 1) medal = '🥇';
            else if (rank === 2) medal = '🥈';
            else if (rank === 3) medal = '🥉';

            const valueCell = lbMode === '100'
                ? formatTime(row.score_value)
                : row.score_value;

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
    } catch {
        lbLoading.classList.add('hidden');
        lbEmpty.textContent = 'Impossible de charger le classement.';
        lbEmpty.classList.remove('hidden');
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== Init =====
generateProblem();
