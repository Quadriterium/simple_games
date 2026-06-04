const CONTINENTS = {
    'north-america': 'Amerique du Nord',
    'south-america': 'Amerique du Sud',
    europe: 'Europe',
    africa: 'Afrique',
    asia: 'Asie',
    oceania: 'Oceanie',
    antarctica: 'Antarctique',
};

const tabs = document.querySelectorAll('.game-tab');
const zones = Array.from(document.querySelectorAll('.continent-zone'));
const infoCard = document.getElementById('info-card');
const quizHeader = document.getElementById('quiz-header');
const quizStartBtn = document.getElementById('quiz-start');
const quizProgress = document.getElementById('quiz-progress');
const quizScore = document.getElementById('quiz-score');
const quizTarget = document.getElementById('quiz-target');

let mode = 'discover';
let quizPool = [];
let current = null;
let score = 0;
let asked = 0;

function shuffle(arr) {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

function clearFeedback() {
    zones.forEach(z => z.classList.remove('correct', 'wrong'));
}

function setMode(nextMode) {
    mode = nextMode;
    tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.mode === mode));
    quizHeader.classList.toggle('hidden', mode !== 'quiz');
    clearFeedback();
    if (mode === 'discover') {
        infoCard.textContent = 'Clique sur un continent pour afficher son nom.';
    }
}

function updateQuizUi() {
    quizProgress.textContent = `Question ${asked}/7`;
    quizScore.textContent = `Score: ${score}`;
}

function nextQuestion() {
    if (!quizPool.length) {
        quizTarget.textContent = `Termine ! Score final: ${score}/7.`;
        infoCard.textContent = 'Clique sur Commencer pour rejouer une nouvelle serie.';
        current = null;
        return;
    }
    current = quizPool.pop();
    asked += 1;
    updateQuizUi();
    quizTarget.textContent = `Clique sur: ${CONTINENTS[current]}`;
}

function startQuiz() {
    score = 0;
    asked = 0;
    quizPool = shuffle(Object.keys(CONTINENTS));
    clearFeedback();
    updateQuizUi();
    nextQuestion();
    infoCard.textContent = 'Objectif: localiser correctement les 7 continents.';
}

tabs.forEach(tab => tab.addEventListener('click', () => setMode(tab.dataset.mode)));
quizStartBtn.addEventListener('click', startQuiz);

zones.forEach(zone => {
    zone.addEventListener('click', () => {
        const key = zone.dataset.continent;
        clearFeedback();

        if (mode === 'discover') {
            infoCard.textContent = `Continent: ${CONTINENTS[key]}.`;
            zone.classList.add('correct');
            return;
        }

        if (!current) return;

        if (key === current) {
            score += 1;
            zone.classList.add('correct');
            infoCard.textContent = `Bravo ! C'etait bien ${CONTINENTS[key]}.`;
            setTimeout(() => {
                clearFeedback();
                nextQuestion();
            }, 650);
        } else {
            zone.classList.add('wrong');
            infoCard.textContent = `Ce n'est pas ${CONTINENTS[current]}. Essaie encore.`;
        }

        quizScore.textContent = `Score: ${score}`;
    });
});

setMode('discover');
