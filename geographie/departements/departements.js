const DEPARTMENTS = {
    '01': { nom: 'Ain', chefLieu: 'Bourg-en-Bresse' },
    '02': { nom: 'Aisne', chefLieu: 'Laon' },
    '03': { nom: 'Allier', chefLieu: 'Moulins' },
    '04': { nom: 'Alpes-de-Haute-Provence', chefLieu: 'Digne-les-Bains' },
    '05': { nom: 'Hautes-Alpes', chefLieu: 'Gap' },
    '06': { nom: 'Alpes-Maritimes', chefLieu: 'Nice' },
    '07': { nom: 'Ardeche', chefLieu: 'Privas' },
    '08': { nom: 'Ardennes', chefLieu: 'Charleville-Mezieres' },
    '09': { nom: 'Ariege', chefLieu: 'Foix' },
    '10': { nom: 'Aube', chefLieu: 'Troyes' },
    '11': { nom: 'Aude', chefLieu: 'Carcassonne' },
    '12': { nom: 'Aveyron', chefLieu: 'Rodez' },
    '13': { nom: 'Bouches-du-Rhone', chefLieu: 'Marseille' },
    '14': { nom: 'Calvados', chefLieu: 'Caen' },
    '15': { nom: 'Cantal', chefLieu: 'Aurillac' },
    '16': { nom: 'Charente', chefLieu: 'Angouleme' },
    '17': { nom: 'Charente-Maritime', chefLieu: 'La Rochelle' },
    '18': { nom: 'Cher', chefLieu: 'Bourges' },
    '19': { nom: 'Correze', chefLieu: 'Tulle' },
    '21': { nom: 'Cote-dOr', chefLieu: 'Dijon' },
    '22': { nom: 'Cotes-dArmor', chefLieu: 'Saint-Brieuc' },
    '23': { nom: 'Creuse', chefLieu: 'Gueret' },
    '24': { nom: 'Dordogne', chefLieu: 'Perigueux' },
    '25': { nom: 'Doubs', chefLieu: 'Besancon' },
    '26': { nom: 'Drome', chefLieu: 'Valence' },
    '27': { nom: 'Eure', chefLieu: 'Evreux' },
    '28': { nom: 'Eure-et-Loir', chefLieu: 'Chartres' },
    '29': { nom: 'Finistere', chefLieu: 'Quimper' },
    '2a': { nom: 'Corse-du-Sud', chefLieu: 'Ajaccio' },
    '2b': { nom: 'Haute-Corse', chefLieu: 'Bastia' },
    '30': { nom: 'Gard', chefLieu: 'Nimes' },
    '31': { nom: 'Haute-Garonne', chefLieu: 'Toulouse' },
    '32': { nom: 'Gers', chefLieu: 'Auch' },
    '33': { nom: 'Gironde', chefLieu: 'Bordeaux' },
    '34': { nom: 'Herault', chefLieu: 'Montpellier' },
    '35': { nom: 'Ille-et-Vilaine', chefLieu: 'Rennes' },
    '36': { nom: 'Indre', chefLieu: 'Chateauroux' },
    '37': { nom: 'Indre-et-Loire', chefLieu: 'Tours' },
    '38': { nom: 'Isere', chefLieu: 'Grenoble' },
    '39': { nom: 'Jura', chefLieu: 'Lons-le-Saunier' },
    '40': { nom: 'Landes', chefLieu: 'Mont-de-Marsan' },
    '41': { nom: 'Loir-et-Cher', chefLieu: 'Blois' },
    '42': { nom: 'Loire', chefLieu: 'Saint-Etienne' },
    '43': { nom: 'Haute-Loire', chefLieu: 'Le Puy-en-Velay' },
    '44': { nom: 'Loire-Atlantique', chefLieu: 'Nantes' },
    '45': { nom: 'Loiret', chefLieu: 'Orleans' },
    '46': { nom: 'Lot', chefLieu: 'Cahors' },
    '47': { nom: 'Lot-et-Garonne', chefLieu: 'Agen' },
    '48': { nom: 'Lozere', chefLieu: 'Mende' },
    '49': { nom: 'Maine-et-Loire', chefLieu: 'Angers' },
    '50': { nom: 'Manche', chefLieu: 'Saint-Lo' },
    '51': { nom: 'Marne', chefLieu: 'Chalons-en-Champagne' },
    '52': { nom: 'Haute-Marne', chefLieu: 'Chaumont' },
    '53': { nom: 'Mayenne', chefLieu: 'Laval' },
    '54': { nom: 'Meurthe-et-Moselle', chefLieu: 'Nancy' },
    '55': { nom: 'Meuse', chefLieu: 'Bar-le-Duc' },
    '56': { nom: 'Morbihan', chefLieu: 'Vannes' },
    '57': { nom: 'Moselle', chefLieu: 'Metz' },
    '58': { nom: 'Nievre', chefLieu: 'Nevers' },
    '59': { nom: 'Nord', chefLieu: 'Lille' },
    '60': { nom: 'Oise', chefLieu: 'Beauvais' },
    '61': { nom: 'Orne', chefLieu: 'Alencon' },
    '62': { nom: 'Pas-de-Calais', chefLieu: 'Arras' },
    '63': { nom: 'Puy-de-Dome', chefLieu: 'Clermont-Ferrand' },
    '64': { nom: 'Pyrenees-Atlantiques', chefLieu: 'Pau' },
    '65': { nom: 'Hautes-Pyrenees', chefLieu: 'Tarbes' },
    '66': { nom: 'Pyrenees-Orientales', chefLieu: 'Perpignan' },
    '67': { nom: 'Bas-Rhin', chefLieu: 'Strasbourg' },
    '68': { nom: 'Haut-Rhin', chefLieu: 'Colmar' },
    '69': { nom: 'Rhone', chefLieu: 'Lyon' },
    '70': { nom: 'Haute-Saone', chefLieu: 'Vesoul' },
    '71': { nom: 'Saone-et-Loire', chefLieu: 'Macon' },
    '72': { nom: 'Sarthe', chefLieu: 'Le Mans' },
    '73': { nom: 'Savoie', chefLieu: 'Chambery' },
    '74': { nom: 'Haute-Savoie', chefLieu: 'Annecy' },
    '75': { nom: 'Paris', chefLieu: 'Paris' },
    '76': { nom: 'Seine-Maritime', chefLieu: 'Rouen' },
    '77': { nom: 'Seine-et-Marne', chefLieu: 'Melun' },
    '78': { nom: 'Yvelines', chefLieu: 'Versailles' },
    '79': { nom: 'Deux-Sevres', chefLieu: 'Niort' },
    '80': { nom: 'Somme', chefLieu: 'Amiens' },
    '81': { nom: 'Tarn', chefLieu: 'Albi' },
    '82': { nom: 'Tarn-et-Garonne', chefLieu: 'Montauban' },
    '83': { nom: 'Var', chefLieu: 'Toulon' },
    '84': { nom: 'Vaucluse', chefLieu: 'Avignon' },
    '85': { nom: 'Vendee', chefLieu: 'La Roche-sur-Yon' },
    '86': { nom: 'Vienne', chefLieu: 'Poitiers' },
    '87': { nom: 'Haute-Vienne', chefLieu: 'Limoges' },
    '88': { nom: 'Vosges', chefLieu: 'Epinal' },
    '89': { nom: 'Yonne', chefLieu: 'Auxerre' },
    '90': { nom: 'Territoire de Belfort', chefLieu: 'Belfort' },
    '91': { nom: 'Essonne', chefLieu: 'Evry-Courcouronnes' },
    '92': { nom: 'Hauts-de-Seine', chefLieu: 'Nanterre' },
    '93': { nom: 'Seine-Saint-Denis', chefLieu: 'Bobigny' },
    '94': { nom: 'Val-de-Marne', chefLieu: 'Creteil' },
    '95': { nom: 'Val-dOise', chefLieu: 'Cergy' },
};

const tabs = document.querySelectorAll('.game-tab');
const mapHost = document.getElementById('map-host');
const mapTooltip = document.getElementById('map-tooltip');
const zoomInBtn = document.getElementById('zoom-in');
const zoomOutBtn = document.getElementById('zoom-out');
const zoomResetBtn = document.getElementById('zoom-reset');
const infoCard = document.getElementById('info-card');
const quizHeader = document.getElementById('quiz-header');
const quizStartBtn = document.getElementById('quiz-start');
const quizProgress = document.getElementById('quiz-progress');
const quizScore = document.getElementById('quiz-score');
const quizTarget = document.getElementById('quiz-target');
const diffEasyBtn = document.getElementById('diff-easy');
const diffHardBtn = document.getElementById('diff-hard');

let mode = 'discover';
let difficulty = 'easy';
let deptPaths = [];
let quizPool = [];
let currentCode = null;
let score = 0;
let asked = 0;
let foundCodes = new Set();
let labelByCode = new Map();
let selectedCode = null;
let activePointers = new Map();
let isPanning = false;
let panStart = { x: 0, y: 0 };
let viewState = { scale: 1, x: 0, y: 0 };
let pinchStartDistance = 0;
let pinchStartScale = 1;

function shuffle(arr) {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

function clearTransientClasses() {
    deptPaths.forEach(p => p.classList.remove('selected', 'correct', 'wrong'));
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(value, max));
}

function applyTransform() {
    mapHost.style.transform = `translate(${viewState.x}px, ${viewState.y}px) scale(${viewState.scale})`;
}

function setScale(nextScale, focusX, focusY) {
    const shell = mapHost.parentElement;
    const rect = shell.getBoundingClientRect();
    const prevScale = viewState.scale;
    const clamped = clamp(nextScale, 1, 4);
    const worldX = (focusX - rect.left - viewState.x) / prevScale;
    const worldY = (focusY - rect.top - viewState.y) / prevScale;

    viewState.scale = clamped;
    viewState.x = (focusX - rect.left) - worldX * clamped;
    viewState.y = (focusY - rect.top) - worldY * clamped;
    applyTransform();
}

function panBy(dx, dy) {
    viewState.x += dx;
    viewState.y += dy;
    applyTransform();
}

function resetView() {
    viewState = { scale: 1, x: 0, y: 0 };
    applyTransform();
}

function getCodeFromPath(pathEl) {
    return pathEl.id.replace('dept-', '').toLowerCase();
}

function renderDepartmentInfo(code) {
    const dep = DEPARTMENTS[code];
    if (!dep) return;
    infoCard.innerHTML = `
        <strong>${code.toUpperCase()} - ${dep.nom}</strong><br>
        Chef-lieu: ${dep.chefLieu}
    `;
}

function positionTooltip(event) {
    if (!mapTooltip || mapTooltip.classList.contains('hidden')) return;
    const shellRect = mapHost.parentElement.getBoundingClientRect();
    const x = Math.max(8, Math.min(event.clientX - shellRect.left, shellRect.width - 8));
    const y = Math.max(8, Math.min(event.clientY - shellRect.top, shellRect.height - 8));
    mapTooltip.style.left = `${x}px`;
    mapTooltip.style.top = `${y}px`;
}

function showTooltip(code, event) {
    const dep = DEPARTMENTS[code];
    if (!dep || !mapTooltip) return;
    mapTooltip.innerHTML = `<strong>${code.toUpperCase()}</strong> - ${dep.nom}`;
    mapTooltip.classList.remove('hidden');
    positionTooltip(event);
}

function hideTooltip() {
    if (!mapTooltip) return;
    mapTooltip.classList.add('hidden');
}

function setFoundVisual(code, isFound) {
    const pathEl = deptPaths.find(p => getCodeFromPath(p) === code);
    const labelEl = labelByCode.get(code);
    if (pathEl) pathEl.classList.toggle('found', isFound);
    if (labelEl) labelEl.classList.toggle('visible', isFound);
}

function buildLabels(svg) {
    const ns = 'http://www.w3.org/2000/svg';
    const labelGroup = document.createElementNS(ns, 'g');
    labelGroup.setAttribute('aria-hidden', 'true');
    labelGroup.setAttribute('id', 'dept-labels');

    labelByCode = new Map();
    deptPaths.forEach(pathEl => {
        const code = getCodeFromPath(pathEl);
        if (!DEPARTMENTS[code]) return;

        const box = pathEl.getBBox();
        const text = document.createElementNS(ns, 'text');
        text.setAttribute('class', 'dept-label');
        text.setAttribute('x', String(box.x + box.width / 2));
        text.setAttribute('y', String(box.y + box.height / 2));
        text.textContent = code.toUpperCase();
        labelGroup.appendChild(text);
        labelByCode.set(code, text);
    });

    svg.appendChild(labelGroup);
}

function updateQuizUi() {
    quizProgress.textContent = `Question ${asked}/10`;
    quizScore.textContent = `Score: ${score}`;
}

function setMode(nextMode) {
    mode = nextMode;
    tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.mode === mode));
    quizHeader.classList.toggle('hidden', mode !== 'quiz');
    clearTransientClasses();

    if (mode !== 'quiz') {
        foundCodes.clear();
        deptPaths.forEach(p => p.classList.remove('found'));
        labelByCode.forEach(label => label.classList.remove('visible'));
    }

    if (mode === 'discover') {
        selectedCode = null;
        infoCard.textContent = 'Clique sur un departement pour afficher ses informations.';
    } else {
        selectedCode = null;
        infoCard.textContent = 'Lance une serie de 10 questions puis clique sur les bons departements.';
    }
}

function updateTargetText(code) {
    const dep = DEPARTMENTS[code];
    if (!dep) return;
    if (difficulty === 'easy') {
        quizTarget.textContent = `Trouve le departement ${code.toUpperCase()} - ${dep.nom}`;
    } else {
        quizTarget.textContent = `Trouve le departement dont le chef-lieu est: ${dep.chefLieu}`;
    }
}

function nextQuestion() {
    if (!quizPool.length) {
        currentCode = null;
        quizTarget.textContent = `Termine ! Score final: ${score}/10.`;
        infoCard.textContent = 'Clique sur Commencer pour rejouer.';
        return;
    }

    currentCode = quizPool.pop();
    asked += 1;
    updateQuizUi();
    updateTargetText(currentCode);
}

function startQuiz() {
    const availableCodes = deptPaths.map(getCodeFromPath).filter(code => DEPARTMENTS[code]);
    quizPool = shuffle(availableCodes).slice(0, 10);
    score = 0;
    asked = 0;
    currentCode = null;
    selectedCode = null;
    foundCodes = new Set();
    deptPaths.forEach(p => p.classList.remove('found'));
    labelByCode.forEach(label => label.classList.remove('visible'));
    clearTransientClasses();
    updateQuizUi();
    nextQuestion();
}

function handleDepartmentGuess(code, pathEl) {
    if (!currentCode) return;
    if (!DEPARTMENTS[code]) return;

    clearTransientClasses();
    pathEl.classList.add('selected');

    if (code === currentCode) {
        score += 1;
        foundCodes.add(code);
        setFoundVisual(code, true);
        pathEl.classList.add('correct');
        renderDepartmentInfo(code);
        infoCard.innerHTML += '<br>✅ Bonne reponse !';
        quizScore.textContent = `Score: ${score}`;
        setTimeout(() => {
            clearTransientClasses();
            selectedCode = null;
            nextQuestion();
        }, 650);
    } else {
        pathEl.classList.add('wrong');
        renderDepartmentInfo(code);
        infoCard.innerHTML += `<br>❌ Mauvaise reponse. Cible: ${currentCode.toUpperCase()} - ${DEPARTMENTS[currentCode].nom}.`;
    }
}

function handleDepartmentClick(pathEl) {
    const code = getCodeFromPath(pathEl);
    if (!DEPARTMENTS[code]) return;

    clearTransientClasses();
    selectedCode = code;
    pathEl.classList.add('selected');
    renderDepartmentInfo(code);

    if (mode === 'discover') {
        return;
    }

    if (!currentCode) {
        infoCard.innerHTML += '<br>Double-clique pour valider ta reponse en mode quiz.';
        return;
    }

    infoCard.innerHTML += '<br>Double-clique pour valider ce departement.';
}

function handleDepartmentDoubleClick(pathEl) {
    const code = getCodeFromPath(pathEl);
    if (!DEPARTMENTS[code]) return;
    if (mode !== 'quiz') return;
    handleDepartmentGuess(code, pathEl);
}

async function loadMap() {
    const response = await fetch('/geographie/assets/optimized/france-departements.svg');
    const svgText = await response.text();
    mapHost.innerHTML = svgText;

    const svg = mapHost.querySelector('svg');
    if (svg) {
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', 'Carte des departements francais');
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    }

    deptPaths = Array.from(mapHost.querySelectorAll('[id^="dept-"]'));
    if (svg) buildLabels(svg);

    deptPaths.forEach(pathEl => {
        pathEl.addEventListener('click', () => handleDepartmentClick(pathEl));
        pathEl.addEventListener('dblclick', () => handleDepartmentDoubleClick(pathEl));
        pathEl.addEventListener('mouseenter', (event) => {
            const code = getCodeFromPath(pathEl);
            showTooltip(code, event);
        });
        pathEl.addEventListener('mousemove', (event) => {
            const code = getCodeFromPath(pathEl);
            if (mapTooltip.classList.contains('hidden')) showTooltip(code, event);
            positionTooltip(event);
        });
        pathEl.addEventListener('mouseleave', hideTooltip);
    });

    const shell = mapHost.parentElement;

    shell.addEventListener('wheel', (event) => {
        event.preventDefault();
        hideTooltip();
        const factor = event.deltaY < 0 ? 1.16 : 0.86;
        setScale(viewState.scale * factor, event.clientX, event.clientY);
    }, { passive: false });

    shell.addEventListener('pointerdown', (event) => {
        if (event.pointerType === 'mouse') return;
        hideTooltip();
        activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        shell.setPointerCapture(event.pointerId);

        if (activePointers.size === 1 && viewState.scale > 1) {
            isPanning = true;
            panStart = { x: event.clientX, y: event.clientY };
        }

        if (activePointers.size === 2) {
            const pts = Array.from(activePointers.values());
            pinchStartDistance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
            pinchStartScale = viewState.scale;
            isPanning = false;
        }
    });

    shell.addEventListener('pointermove', (event) => {
        if (event.pointerType === 'mouse') return;
        if (!activePointers.has(event.pointerId)) return;
        hideTooltip();
        activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

        if (activePointers.size === 2) {
            const pts = Array.from(activePointers.values());
            const distance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
            if (pinchStartDistance > 0) {
                const centerX = (pts[0].x + pts[1].x) / 2;
                const centerY = (pts[0].y + pts[1].y) / 2;
                setScale(pinchStartScale * (distance / pinchStartDistance), centerX, centerY);
            }
            return;
        }

        if (isPanning && activePointers.size === 1) {
            const dx = event.clientX - panStart.x;
            const dy = event.clientY - panStart.y;
            panBy(dx, dy);
            panStart = { x: event.clientX, y: event.clientY };
        }
    });

    function releasePointer(event) {
        if (event.pointerType === 'mouse') return;
        activePointers.delete(event.pointerId);
        if (activePointers.size < 2) {
            pinchStartDistance = 0;
        }
        if (activePointers.size === 0) {
            isPanning = false;
        }
    }

    shell.addEventListener('pointerup', releasePointer);
    shell.addEventListener('pointercancel', releasePointer);

    zoomInBtn?.addEventListener('click', () => {
        const rect = shell.getBoundingClientRect();
        setScale(viewState.scale * 1.2, rect.left + rect.width / 2, rect.top + rect.height / 2);
    });

    zoomOutBtn?.addEventListener('click', () => {
        const rect = shell.getBoundingClientRect();
        setScale(viewState.scale / 1.2, rect.left + rect.width / 2, rect.top + rect.height / 2);
    });

    zoomResetBtn?.addEventListener('click', resetView);

    infoCard.textContent = `Carte chargee: ${deptPaths.length} departements detectes.`;
}

tabs.forEach(tab => tab.addEventListener('click', () => setMode(tab.dataset.mode)));
quizStartBtn.addEventListener('click', startQuiz);

diffEasyBtn.addEventListener('click', () => {
    difficulty = 'easy';
    diffEasyBtn.classList.add('active');
    diffHardBtn.classList.remove('active');
    if (mode === 'quiz' && currentCode) updateTargetText(currentCode);
});

diffHardBtn.addEventListener('click', () => {
    difficulty = 'hard';
    diffHardBtn.classList.add('active');
    diffEasyBtn.classList.remove('active');
    if (mode === 'quiz' && currentCode) updateTargetText(currentCode);
});

loadMap().catch(() => {
    infoCard.textContent = 'Erreur lors du chargement de la carte des departements.';
});
