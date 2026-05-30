// ===== Sudoku Game =====

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// ===== Sudoku Module =====

let sudokuBoard = [];       // 9×9, current player board
let sudokuSolution = [];    // 9×9, full solution
let sudokuGiven = [];       // 9×9, true = pre-filled
let sudokuSelected = null;  // { r, c }
let sudokuLevel = 'easy';
let sudokuGameOver = false;
let sudokuFilterMode = false; // true after double-click on a cell
let sudokuDraftMode = false;
let sudokuNotes = [];  // 9×9 array of Set<number>
let sudokuErrors = []; // 9×9, true if wrong number placed
let sudokuHinted = []; // 9×9, true if revealed by hint
let sudokuUndoStack = [];

const SUDOKU_CLUES = { easy: 38, medium: 30, hard: 24 };

function sudokuInit() {
    

    // Difficulty buttons
    document.querySelectorAll('.sdiff-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.sdiff-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            sudokuLevel = btn.dataset.level;
            sudokuNewGame();
        });
    });

    document.getElementById('sudoku-new-game').addEventListener('click', sudokuNewGame);

    // Draft mode button
    const sudokuDraftBtn = document.getElementById('sudoku-draft-btn');
    sudokuDraftBtn.addEventListener('click', () => {
        if (sudokuGameOver) return;
        sudokuDraftMode = !sudokuDraftMode;
        sudokuDraftBtn.classList.toggle('draft-active', sudokuDraftMode);
    });

    // Hint button
    document.getElementById('sudoku-hint-btn').addEventListener('click', sudokuUseHint);

    // Undo button
    document.getElementById('sudoku-undo-btn').addEventListener('click', sudokuUndo);

    // Build numpad
    const numpad = document.getElementById('sudoku-numpad');
    for (let n = 1; n <= 9; n++) {
        const btn = document.createElement('button');
        btn.className = 'numpad-btn';
        btn.textContent = n;
        btn.addEventListener('click', () => sudokuPlaceNumber(n));
        numpad.appendChild(btn);
    }
    const eraseBtn = document.createElement('button');
    eraseBtn.className = 'numpad-btn erase';
    eraseBtn.textContent = '⌫';
    eraseBtn.addEventListener('click', () => sudokuPlaceNumber(0));
    numpad.appendChild(eraseBtn);

    // Keyboard input
    document.addEventListener('keydown', (e) => {
        
        if (!sudokuSelected || sudokuGameOver) return;
        const { r, c } = sudokuSelected;
        if (sudokuGiven[r][c]) return;
        const n = parseInt(e.key);
        if (n >= 1 && n <= 9) {
            if (sudokuFilterMode) {
                const valid = sudokuGetValidNumbers(r, c);
                if (valid.has(n)) sudokuPlaceNumber(n);
            } else {
                sudokuPlaceNumber(n);
            }
        }
        if (e.key === 'Backspace' || e.key === 'Delete') sudokuPlaceNumber(0);
    });

    // Grid click (single = select, double = select + filter numpad)
    let sudokuClickTimer = null;
    const SUDOKU_DBLCLICK_DELAY = 300;

    document.getElementById('sudoku-grid').addEventListener('click', (e) => {
        const cell = e.target.closest('.sudoku-cell');
        if (!cell) return;
        const r = parseInt(cell.dataset.row);
        const c = parseInt(cell.dataset.col);

        if (sudokuClickTimer && sudokuSelected && sudokuSelected.r === r && sudokuSelected.c === c) {
            // Double click on same cell
            clearTimeout(sudokuClickTimer);
            sudokuClickTimer = null;
            sudokuFilterMode = true;
            sudokuRenderGrid();
        } else {
            // Single click — wait to confirm it's not a double
            if (sudokuClickTimer) clearTimeout(sudokuClickTimer);
            sudokuSelected = { r, c };
            sudokuFilterMode = false;
            sudokuRenderGrid();
            sudokuClickTimer = setTimeout(() => { sudokuClickTimer = null; }, SUDOKU_DBLCLICK_DELAY);
        }
    });

    sudokuNewGame();
}

function sudokuNewGame() {
    sudokuGameOver = false;
    sudokuSelected = null;
    sudokuDraftMode = false;
    sudokuUndoStack = [];
    updateSudokuUndoBtn();
    const draftBtn = document.getElementById('sudoku-draft-btn');
    if (draftBtn) draftBtn.classList.remove('draft-active');
    const msgEl = document.getElementById('sudoku-message');
    msgEl.className = 'hidden';
    msgEl.textContent = '';

    const clueCount = SUDOKU_CLUES[sudokuLevel];
    const { solution, board, given } = sudokuGenerate(clueCount);
    sudokuSolution = solution;
    sudokuBoard = board;
    sudokuGiven = given;
    sudokuNotes = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set()));
    sudokuErrors = Array.from({ length: 9 }, () => Array(9).fill(false));
    sudokuHinted = Array.from({ length: 9 }, () => Array(9).fill(false));
    sudokuRenderGrid();
}

// ===== Sudoku Generation =====

function sudokuGenerate(clueCount) {
    const solution = sudokuGenerateFullGrid();
    const board = solution.map(r => [...r]);
    const given = Array.from({ length: 9 }, () => Array(9).fill(true));

    // Collect all cell positions and shuffle
    const cells = [];
    for (let r = 0; r < 9; r++)
        for (let c = 0; c < 9; c++)
            cells.push({ r, c });
    shuffle(cells);

    let filled = 81;
    for (const { r, c } of cells) {
        if (filled <= clueCount) break;
        const backup = board[r][c];
        board[r][c] = 0;
        given[r][c] = false;

        if (sudokuCountSolutions(board, 2) !== 1) {
            // Removing this cell creates ambiguity — put it back
            board[r][c] = backup;
            given[r][c] = true;
        } else {
            filled--;
        }
    }

    return { solution, board, given };
}

function sudokuGenerateFullGrid() {
    const grid = Array.from({ length: 9 }, () => Array(9).fill(0));

    function isValid(grid, r, c, num) {
        for (let i = 0; i < 9; i++) {
            if (grid[r][i] === num) return false;
            if (grid[i][c] === num) return false;
        }
        const br = Math.floor(r / 3) * 3;
        const bc = Math.floor(c / 3) * 3;
        for (let dr = 0; dr < 3; dr++)
            for (let dc = 0; dc < 3; dc++)
                if (grid[br + dr][bc + dc] === num) return false;
        return true;
    }

    function fill(pos) {
        if (pos === 81) return true;
        const r = Math.floor(pos / 9);
        const c = pos % 9;
        const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        for (const n of nums) {
            if (isValid(grid, r, c, n)) {
                grid[r][c] = n;
                if (fill(pos + 1)) return true;
                grid[r][c] = 0;
            }
        }
        return false;
    }

    fill(0);
    return grid;
}

function sudokuCountSolutions(board, maxCount) {
    let count = 0;

    function isValid(r, c, num) {
        for (let i = 0; i < 9; i++) {
            if (board[r][i] === num) return false;
            if (board[i][c] === num) return false;
        }
        const br = Math.floor(r / 3) * 3;
        const bc = Math.floor(c / 3) * 3;
        for (let dr = 0; dr < 3; dr++)
            for (let dc = 0; dc < 3; dc++)
                if (board[br + dr][bc + dc] === num) return false;
        return true;
    }

    function solve(pos) {
        if (count >= maxCount) return;
        while (pos < 81 && board[Math.floor(pos / 9)][pos % 9] !== 0) pos++;
        if (pos === 81) { count++; return; }
        const r = Math.floor(pos / 9);
        const c = pos % 9;
        for (let n = 1; n <= 9; n++) {
            if (isValid(r, c, n)) {
                board[r][c] = n;
                solve(pos + 1);
                board[r][c] = 0;
            }
        }
    }

    solve(0);
    return count;
}

// ===== Sudoku Helpers =====

function sudokuGetValidNumbers(r, c) {
    const valid = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (let i = 0; i < 9; i++) {
        valid.delete(sudokuBoard[r][i]);
        valid.delete(sudokuBoard[i][c]);
    }
    const br = Math.floor(r / 3) * 3;
    const bc = Math.floor(c / 3) * 3;
    for (let dr = 0; dr < 3; dr++)
        for (let dc = 0; dc < 3; dc++)
            valid.delete(sudokuBoard[br + dr][bc + dc]);
    return valid;
}

function sudokuGetCompletedNumbers() {
    const counts = Array(10).fill(0);
    for (let r = 0; r < 9; r++)
        for (let c = 0; c < 9; c++)
            if (sudokuBoard[r][c] !== 0) counts[sudokuBoard[r][c]]++;
    const completed = new Set();
    for (let n = 1; n <= 9; n++)
        if (counts[n] >= 9) completed.add(n);
    return completed;
}

function sudokuUpdateNumpad() {
    const numpad = document.getElementById('sudoku-numpad');
    const buttons = numpad.querySelectorAll('.numpad-btn:not(.erase)');
    const eraseBtn = numpad.querySelector('.numpad-btn.erase');
    const completed = sudokuGetCompletedNumbers();

    if (!sudokuSelected || sudokuGameOver || sudokuGiven[sudokuSelected.r][sudokuSelected.c]) {
        buttons.forEach(btn => {
            const n = parseInt(btn.textContent);
            btn.disabled = true;
            btn.className = 'numpad-btn' + (completed.has(n) ? ' completed' : ' disabled');
        });
        if (eraseBtn) { eraseBtn.disabled = true; eraseBtn.classList.add('disabled'); }
        return;
    }

    const { r, c } = sudokuSelected;

    buttons.forEach(btn => {
        const n = parseInt(btn.textContent);
        if (completed.has(n)) {
            btn.disabled = true;
            btn.className = 'numpad-btn completed';
            return;
        }
        if (sudokuFilterMode) {
            const valid = sudokuGetValidNumbers(r, c);
            const isValid = valid.has(n);
            btn.disabled = !isValid;
            btn.className = 'numpad-btn' + (!isValid ? ' disabled' : '');
        } else {
            btn.disabled = false;
            btn.className = 'numpad-btn';
        }
    });

    if (eraseBtn) {
        const hasValue = sudokuBoard[r][c] !== 0 || sudokuNotes[r][c].size > 0;
        eraseBtn.disabled = !hasValue;
        eraseBtn.classList.toggle('disabled', !hasValue);
    }
}

// ===== Sudoku Rendering =====

function sudokuRenderGrid() {
    const gridEl = document.getElementById('sudoku-grid');
    gridEl.innerHTML = '';

    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const cell = document.createElement('div');
            cell.className = 'sudoku-cell';
            cell.dataset.row = r;
            cell.dataset.col = c;

            // Block borders
            if (r % 3 === 0) cell.classList.add('block-border-top');
            if (r % 3 === 2) cell.classList.add('block-border-bottom');
            if (c % 3 === 0) cell.classList.add('block-border-left');
            if (c % 3 === 2) cell.classList.add('block-border-right');

            if (sudokuGiven[r][c]) {
                if (sudokuHinted[r][c]) {
                    cell.classList.add('hinted');
                } else {
                    cell.classList.add('given');
                }
            } else if (sudokuBoard[r][c] !== 0) {
                cell.classList.add('user-input');
            }

            if (sudokuErrors[r] && sudokuErrors[r][c]) {
                cell.classList.add('sudoku-error');
            }

            if (sudokuSelected && sudokuSelected.r === r && sudokuSelected.c === c) {
                cell.classList.add('selected');
            }

            if (sudokuBoard[r][c] !== 0) {
                cell.textContent = sudokuBoard[r][c];
            } else if (sudokuNotes[r] && sudokuNotes[r][c] && sudokuNotes[r][c].size > 0) {
                cell.textContent = '';
                const notesDiv = document.createElement('div');
                notesDiv.className = 'sudoku-notes';
                for (let n = 1; n <= 9; n++) {
                    if (sudokuNotes[r][c].has(n)) {
                        const span = document.createElement('span');
                        span.className = 'sudoku-note';
                        span.textContent = n;
                        notesDiv.appendChild(span);
                    }
                }
                cell.appendChild(notesDiv);
            } else {
                cell.textContent = '';
            }
            gridEl.appendChild(cell);
        }
    }
    sudokuUpdateNumpad();
}

const SUDOKU_VICTORY_MESSAGES = [
    "🎉 Bravo Jeanne ! Ce sudoku ne faisait pas le poids face à toi !",
    "🔢 Jeanne a dompté les chiffres — comme elle dompte tout le reste !",
    "🌟 Chaque case remplie est une étoile de plus dans le ciel de Jeanne !",
    "💛 Olivier savait que tu allais y arriver, Jeanne. Tu ne déçois jamais !",
    "🧠 Un cerveau aussi brillant que ton sourire — bravo Jeanne !",
    "🎊 Arthur, Victoire, Martin et Antoine : votre maman est une reine du sudoku !",
    "✨ Même les chiffres se mettent en ordre quand Jeanne le décide !",
    "🌸 Douce et méthodique — le combo parfait pour le sudoku, et c'est Jeanne !",
    "🏆 Médaille d'or du sudoku décernée à Jeanne, maman extraordinaire !",
    "💫 81 cases, 0 erreur, 1 Jeanne. L'équation parfaite !",
    "🕊️ Jeanne résout les grilles comme elle résout les problèmes : avec grâce et patience !",
    "🥰 Olivier t'aime encore plus à chaque grille terminée — si c'était possible !",
    "🎯 Ligne par ligne, colonne par colonne, bloc par bloc : Jeanne ne laisse rien au hasard !",
    "🌺 Aussi méthodique au sudoku qu'en cuisine — c'est le talent de Jeanne !",
    "💝 Les chiffres t'obéissent, les enfants t'adorent, le mari t'admire. Que demander de plus ?",
    "🎈 Sudoku terminé ! Jeanne fait exploser les compteurs de fierté d'Olivier !",
    "🌈 Tu mets de l'ordre dans les chiffres comme tu mets de la lumière dans les vies !",
    "🦋 Légère comme un papillon, précise comme un laser — Jeanne face au sudoku !",
    "💐 Pour chaque chiffre bien placé, Jeanne mérite une fleur. Voilà un bouquet de 81 !",
    "🎶 Jeanne joue du sudoku comme Mozart jouait du piano : avec une aisance naturelle !",
    "🤗 Toute la famille serait fière de voir maman en pleine action !",
    "🌻 Tournesol parmi les chiffres, Jeanne illumine chaque grille qu'elle touche !",
    "🥂 Trinquons à la victoire de Jeanne — une grille de plus dans sa collection !",
    "💡 Là où certains voient des cases vides, Jeanne voit des certitudes !",
    "🌙 Jeanne, tu es aussi logique que bienveillante — un mélange rare et précieux !",
    "🎁 Ce sudoku résolu est un cadeau que tu t'offres à toi-même, Jeanne !",
    "🦁 Féroce sur la grille, tendre dans la vie — c'est notre Jeanne !",
    "🎗️ De 1 à 9, chaque chiffre a trouvé sa place. Comme Jeanne a trouvé la sienne : au sommet !",
    "🏅 Si le sudoku était un sport olympique, Jeanne représenterait la France !",
    "✝️ Patience, persévérance et logique — des vertus que Jeanne cultive au quotidien !",
    "😄 Martin parie déjà que tu vas enchaîner avec une grille plus dure. Il a raison ?",
    "🌿 La sérénité de Jeanne face à une grille difficile est un spectacle apaisant !",
    "💞 Derrière ces 81 chiffres, il y a une femme extraordinaire. Bravo Jeanne !",
    "🎪 Le plus beau tour de magie ? Jeanne qui transforme une grille vide en chef-d'œuvre !",
    "🌊 Aussi fluide qu'une vague, aussi précise qu'une horloge — Jeanne au sudoku !",
    "📿 Jeanne, ta patience est infinie — ces chiffres en sont la preuve !",
    "🍀 Ce n'est pas de la chance, c'est du talent pur. Bravo Jeanne !",
    "💪 4 enfants, 1 mari comblé, 81 cases : Jeanne gère tout sans sourciller !",
    "🕯️ Chaque chiffre posé par Jeanne est une petite lumière dans la grille !",
    "🦅 Vue d'ensemble et sens du détail — Jeanne maîtrise les deux comme personne !",
    "🎠 La vie de famille est un joli manège, et Jeanne en est le centre radieux !",
    "🌅 Ce sudoku terminé annonce un beau coucher de soleil — celui de la victoire !",
    "💬 Olivier murmure : bravo ma Jeanne, tu es décidément imbattable !",
    "🤍 Chaque ligne complète est une déclaration d'amour aux mathématiques signée Jeanne !",
    "🎀 Élégante jusque dans sa façon de remplir un sudoku — c'est tout Jeanne !",
    "🌸 Victoire serait fière de porter si bien son prénom grâce à sa maman aujourd'hui !",
    "🙌 Incroyable : Jeanne a encore vaincu ! Le sudoku n'avait aucune chance !",
    "💖 Grille parfaite, famille parfaite, femme parfaite — tout est dit !",
    "🎵 Si chaque chiffre était une note, Jeanne viendrait de composer une symphonie !",
    "🌟 Toute la famille peut dormir tranquille : Jeanne veille sur tout le monde ET sur les sudokus !",
];

// ===== Sudoku Undo System =====

function sudokuSaveState() {
    sudokuUndoStack.push({
        board: sudokuBoard.map(r => [...r]),
        notes: sudokuNotes.map(r => r.map(s => new Set(s))),
        errors: sudokuErrors.map(r => [...r]),
        gameOver: sudokuGameOver,
    });
    updateSudokuUndoBtn();
}

function sudokuUndo() {
    if (sudokuUndoStack.length === 0) return;
    const snapshot = sudokuUndoStack.pop();
    sudokuBoard = snapshot.board;
    sudokuNotes = snapshot.notes;
    sudokuErrors = snapshot.errors;
    sudokuGameOver = snapshot.gameOver;
    if (!sudokuGameOver) {
        const msgEl = document.getElementById('sudoku-message');
        msgEl.className = 'hidden';
        msgEl.textContent = '';
    }
    sudokuRenderGrid();
    updateSudokuUndoBtn();
}

function updateSudokuUndoBtn() {
    const btn = document.getElementById('sudoku-undo-btn');
    if (btn) btn.disabled = sudokuUndoStack.length === 0;
}

function sudokuPlaceNumber(n) {
    if (!sudokuSelected || sudokuGameOver) return;
    const { r, c } = sudokuSelected;
    if (sudokuGiven[r][c]) return;

    sudokuSaveState();

    if (sudokuDraftMode) {
        if (n === 0) {
            sudokuNotes[r][c].clear();
        } else {
            if (sudokuNotes[r][c].has(n)) {
                sudokuNotes[r][c].delete(n);
            } else {
                sudokuNotes[r][c].add(n);
            }
        }
        sudokuRenderGrid();
        return;
    }

    sudokuBoard[r][c] = n;
    if (n !== 0) sudokuNotes[r][c].clear();

    // Clear error when erasing
    if (n === 0) {
        sudokuErrors[r][c] = false;
    }

    sudokuRenderGrid();

    // Wrong number: explosion + persistent red blink
    if (n !== 0 && n !== sudokuSolution[r][c]) {
        sudokuErrors[r][c] = true;
        const cellEl = document.getElementById('sudoku-grid')
            .querySelector(`[data-row="${r}"][data-col="${c}"]`);
        if (cellEl) {
            sudokuSpawnExplosion(cellEl);
            cellEl.classList.add('sudoku-error');
        }
    }

    // Check win
    if (n !== 0) {
        let filled = true;
        for (let i = 0; i < 9 && filled; i++)
            for (let j = 0; j < 9 && filled; j++)
                if (sudokuBoard[i][j] === 0) filled = false;
        if (filled) {
            let correct = true;
            for (let i = 0; i < 9 && correct; i++)
                for (let j = 0; j < 9 && correct; j++)
                    if (sudokuBoard[i][j] !== sudokuSolution[i][j]) correct = false;
            if (correct) {
                sudokuGameOver = true;
                const msg = SUDOKU_VICTORY_MESSAGES[Math.floor(Math.random() * SUDOKU_VICTORY_MESSAGES.length)];
                const msgEl = document.getElementById('sudoku-message');
                msgEl.className = 'win';
                msgEl.textContent = msg;
            }
        }
    }
}

function sudokuUseHint() {
    if (sudokuGameOver) return;
    const candidates = [];
    for (let r = 0; r < 9; r++)
        for (let c = 0; c < 9; c++)
            if (!sudokuGiven[r][c] && sudokuBoard[r][c] !== sudokuSolution[r][c])
                candidates.push({ r, c });
    if (candidates.length === 0) return;
    sudokuSaveState();
    shuffle(candidates);
    const { r, c } = candidates[0];
    sudokuBoard[r][c] = sudokuSolution[r][c];
    sudokuErrors[r][c] = false;
    sudokuNotes[r][c].clear();
    sudokuGiven[r][c] = true;
    sudokuHinted[r][c] = true;
    sudokuRenderGrid();

    // Check win
    let filled = true;
    for (let i = 0; i < 9 && filled; i++)
        for (let j = 0; j < 9 && filled; j++)
            if (sudokuBoard[i][j] === 0 || sudokuBoard[i][j] !== sudokuSolution[i][j]) filled = false;
    if (filled) {
        sudokuGameOver = true;
        const msg = SUDOKU_VICTORY_MESSAGES[Math.floor(Math.random() * SUDOKU_VICTORY_MESSAGES.length)];
        const msgEl = document.getElementById('sudoku-message');
        msgEl.className = 'win';
        msgEl.textContent = msg;
    }
}

function sudokuSpawnExplosion(cellEl) {
    const rect = cellEl.getBoundingClientRect();
    const gridContainer = document.getElementById('sudoku-grid-container');
    const containerRect = gridContainer.getBoundingClientRect();
    const cx = rect.left + rect.width / 2 - containerRect.left;
    const cy = rect.top + rect.height / 2 - containerRect.top;
    gridContainer.style.position = 'relative';

    const particles = '💥🔥✦⚡💢';
    const count = 18;
    for (let i = 0; i < count; i++) {
        const el = document.createElement('div');
        el.className = 'sudoku-explosion-particle';
        el.textContent = particles[Math.floor(Math.random() * particles.length)];
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
        const dist = 30 + Math.random() * 50;
        el.style.left = cx + 'px';
        el.style.top = cy + 'px';
        el.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
        el.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
        el.style.animationDuration = (0.5 + Math.random() * 0.4) + 's';
        gridContainer.appendChild(el);
        setTimeout(() => el.remove(), 1000);
    }

    // Central flash
    const flash = document.createElement('div');
    flash.className = 'sudoku-explosion-flash';
    flash.style.left = (cx - 30) + 'px';
    flash.style.top = (cy - 30) + 'px';
    gridContainer.appendChild(flash);
    setTimeout(() => flash.remove(), 500);
}

// ===== Collapsible Menu (mobile) =====
function setupMenuToggles() {
    document.querySelectorAll('.menu-toggle').forEach(btn => {
        const collapsible = btn.nextElementSibling;

        // Collapse by default on mobile
        if (window.innerWidth <= 480) {
            collapsible.classList.add('collapsed');
            btn.setAttribute('aria-expanded', 'false');
        }

        btn.addEventListener('click', () => {
            const isCollapsed = collapsible.classList.toggle('collapsed');
            btn.setAttribute('aria-expanded', !isCollapsed);
        });
    });
}
setupMenuToggles();

sudokuInit();
