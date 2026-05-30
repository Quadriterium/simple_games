// ===== State =====
let gridSize = 5;
let crownsPerGroup = 1; // 1 or 2
let grid = [];       // grid[row][col] = { color, state, hasCrown }
let crownMap = [];   // crownMap[row][col] = true/false
let hintRemaining = 1;
let hintMode = false;
let draftMode = false;
let crownsPlaced = 0;
let totalCrowns = 0; // gridSize * crownsPerGroup
let gameOver = false;
let crownUndoStack = [];

// Difficulty configs per crown mode
const DIFFICULTY_CONFIG = {
    1: [
        { size: 5, label: 'Débutant (5×5)' },
        { size: 7, label: 'Intermédiaire (7×7)' },
        { size: 9, label: 'Difficile (9×9)' },
    ],
    2: [
        { size: 8, label: 'Débutant (8×8)' },
        { size: 9, label: 'Intermédiaire (9×9)' },
        { size: 10, label: 'Difficile (10×10)' },
    ],
};

// ===== DOM refs =====
const gridEl = document.getElementById('grid');
const messageEl = document.getElementById('message');
const hintBtn = document.getElementById('hint-btn');
const hintBadge = document.getElementById('hint-badge');
const newGameBtn = document.getElementById('new-game');
const overlay = document.getElementById('overlay');
const overlayText = document.getElementById('overlay-text');
const overlayClose = document.getElementById('overlay-close');
const draftBtn = document.getElementById('draft-btn');
const diffButtons = document.querySelectorAll('.diff-btn');
const modeButtons = document.querySelectorAll('.mode-btn');
const diffContainer = document.getElementById('difficulty');

// ===== Fallback puzzles (in case generation fails) =====
const FALLBACK_PUZZLES = {
    5: {
        solution: [2, 4, 1, 3, 0],
        colors: [
            [0,0,0,0,1],
            [2,0,0,1,1],
            [2,2,2,3,1],
            [4,2,3,3,1],
            [4,4,4,3,3],
        ]
    },
    7: {
        solution: [3, 5, 0, 6, 2, 4, 1],
        colors: [
            [0,0,0,0,0,1,1],
            [2,2,0,0,0,1,1],
            [2,2,2,1,1,1,3],
            [2,2,4,4,3,3,3],
            [4,4,4,4,4,3,3],
            [6,6,6,5,5,5,5],
            [6,6,6,5,5,5,5],
        ]
    },
    9: {
        solution: [1, 3, 5, 7, 0, 2, 8, 4, 6],
        colors: [
            [0,0,0,1,1,2,2,2,2],
            [4,0,1,1,1,2,2,3,3],
            [4,0,0,1,1,2,3,3,3],
            [4,4,4,4,1,2,3,3,3],
            [4,5,5,4,1,2,6,3,6],
            [5,5,5,5,1,7,6,6,6],
            [5,5,5,7,7,7,6,6,6],
            [5,5,7,7,7,8,8,8,6],
            [7,7,7,7,8,8,8,8,6],
        ]
    }
};

// ===== Initialization =====
function init() {
    modeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = parseInt(btn.dataset.crowns);
            if (mode === crownsPerGroup) return;
            modeButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            crownsPerGroup = mode;
            rebuildDifficultyButtons();
            startNewGame();
        });
    });

    newGameBtn.addEventListener('click', startNewGame);
    hintBtn.addEventListener('click', toggleHintMode);
    draftBtn.addEventListener('click', toggleDraftMode);
    overlayClose.addEventListener('click', closeOverlay);
    document.getElementById('crown-undo-btn').addEventListener('click', crownUndo);

    setupClickHandlers();
    rebuildDifficultyButtons();
    startNewGame();
}

function rebuildDifficultyButtons() {
    const configs = DIFFICULTY_CONFIG[crownsPerGroup];
    diffContainer.innerHTML = '';
    configs.forEach((cfg, i) => {
        const btn = document.createElement('button');
        btn.className = 'diff-btn' + (i === 0 ? ' active' : '');
        btn.dataset.size = cfg.size;
        btn.textContent = cfg.label;
        btn.addEventListener('click', () => {
            const size = cfg.size;
            if (size === gridSize && !gameOver) return;
            diffContainer.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            gridSize = size;
            startNewGame();
        });
        diffContainer.appendChild(btn);
    });
    gridSize = configs[0].size;
}

function startNewGame() {
    totalCrowns = gridSize * crownsPerGroup;
    hintRemaining = 1;
    hintMode = false;
    crownsPlaced = 0;
    gameOver = false;
    crownUndoStack = [];
    updateCrownUndoBtn();

    hintBtn.classList.remove('used', 'hint-active');
    hintBadge.textContent = '1';
    draftMode = false;
    draftBtn.classList.remove('draft-active');
    messageEl.className = 'hidden';
    messageEl.textContent = '';
    closeOverlay();

    const puzzle = generatePuzzle();
    crownMap = puzzle.crownMap;
    grid = [];
    for (let r = 0; r < gridSize; r++) {
        grid[r] = [];
        for (let c = 0; c < gridSize; c++) {
            grid[r][c] = {
                color: puzzle.colors[r][c],
                state: 'empty',
                hasCrown: crownMap[r][c],
                locked: false,
            };
        }
    }

    renderGrid();

    // If no first crown is logically deducible, reveal one to give a starting point
    const hasObvious = crownsPerGroup === 1 ? !!findObviousCrown1() : !!findObviousCrown2();
    if (!hasObvious) {
        const toReveal = pickCrownToReveal();
        if (toReveal) revealCrown(toReveal.r, toReveal.c);
    }
}

// ===== Obvious-crown analysis =====

// Returns {r, c} of a crown that is logically forced at game start,
// or null if no cell can be deduced by basic constraint propagation.

// Mode 2 : 2 couronnes par couleur, 2 par ligne, 2 par colonne
function findObviousCrown2() {
    const numColors = gridSize;

    // possible[color] = toutes les cases candidates pour ce color
    const possible = Array.from({ length: numColors }, () => []);
    for (let r = 0; r < gridSize; r++)
        for (let c = 0; c < gridSize; c++)
            possible[grid[r][c].color].push({ r, c });

    let changed = true;
    while (changed) {
        changed = false;

        // Si une couleur n'a plus que 2 candidats → évident
        for (let color = 0; color < numColors; color++)
            if (possible[color].length === 2) return possible[color][0];

        // Règle ligne : si tous les candidats d'une couleur sont dans la même ligne
        // → cette couleur monopolise les 2 slots de cette ligne
        // → supprimer cette ligne des autres couleurs
        for (let color = 0; color < numColors; color++) {
            const rows = new Set(possible[color].map(p => p.r));
            if (rows.size === 1) {
                const row = [...rows][0];
                for (let other = 0; other < numColors; other++) {
                    if (other === color) continue;
                    const before = possible[other].length;
                    possible[other] = possible[other].filter(p => p.r !== row);
                    if (possible[other].length < before) changed = true;
                }
            }
        }

        // Règle colonne : même logique
        for (let color = 0; color < numColors; color++) {
            const cols = new Set(possible[color].map(p => p.c));
            if (cols.size === 1) {
                const col = [...cols][0];
                for (let other = 0; other < numColors; other++) {
                    if (other === color) continue;
                    const before = possible[other].length;
                    possible[other] = possible[other].filter(p => p.c !== col);
                    if (possible[other].length < before) changed = true;
                }
            }
        }

        // Règle ligne inverse : si seule une couleur a des candidats dans une ligne
        // → tous ses candidats hors de cette ligne sont impossibles
        for (let r = 0; r < gridSize; r++) {
            const colorsInRow = [];
            for (let color = 0; color < numColors; color++)
                if (possible[color].some(p => p.r === r)) colorsInRow.push(color);
            if (colorsInRow.length === 1) {
                const color = colorsInRow[0];
                const before = possible[color].length;
                possible[color] = possible[color].filter(p => p.r === r);
                if (possible[color].length < before) changed = true;
            }
        }

        // Règle colonne inverse
        for (let c = 0; c < gridSize; c++) {
            const colorsInCol = [];
            for (let color = 0; color < numColors; color++)
                if (possible[color].some(p => p.c === c)) colorsInCol.push(color);
            if (colorsInCol.length === 1) {
                const color = colorsInCol[0];
                const before = possible[color].length;
                possible[color] = possible[color].filter(p => p.c === c);
                if (possible[color].length < before) changed = true;
            }
        }
    }

    // Vérification finale
    for (let color = 0; color < numColors; color++)
        if (possible[color].length === 2) return possible[color][0];

    return null;
}

function findObviousCrown1() {
    const numColors = gridSize;

    // possible[color] = all cells of that color (candidates)
    const possible = Array.from({ length: numColors }, () => []);
    for (let r = 0; r < gridSize; r++)
        for (let c = 0; c < gridSize; c++)
            possible[grid[r][c].color].push({ r, c });

    let changed = true;
    while (changed) {
        changed = false;

        // If a color's candidates all share the same row → that row is "taken"
        // → remove that row from every other color's candidates
        for (let color = 0; color < numColors; color++) {
            const rows = new Set(possible[color].map(p => p.r));
            if (rows.size !== 1) continue;
            const claimedRow = [...rows][0];
            for (let other = 0; other < numColors; other++) {
                if (other === color) continue;
                const before = possible[other].length;
                possible[other] = possible[other].filter(p => p.r !== claimedRow);
                if (possible[other].length < before) changed = true;
            }
        }

        // Same logic for columns
        for (let color = 0; color < numColors; color++) {
            const cols = new Set(possible[color].map(p => p.c));
            if (cols.size !== 1) continue;
            const claimedCol = [...cols][0];
            for (let other = 0; other < numColors; other++) {
                if (other === color) continue;
                const before = possible[other].length;
                possible[other] = possible[other].filter(p => p.c !== claimedCol);
                if (possible[other].length < before) changed = true;
            }
        }

        // If only one color has candidates in a given row → restrict that color to that row
        for (let r = 0; r < gridSize; r++) {
            const colorsInRow = [];
            for (let color = 0; color < numColors; color++)
                if (possible[color].some(p => p.r === r)) colorsInRow.push(color);
            if (colorsInRow.length !== 1) continue;
            const color = colorsInRow[0];
            const before = possible[color].length;
            possible[color] = possible[color].filter(p => p.r === r);
            if (possible[color].length < before) changed = true;
        }

        // Same for columns
        for (let c = 0; c < gridSize; c++) {
            const colorsInCol = [];
            for (let color = 0; color < numColors; color++)
                if (possible[color].some(p => p.c === c)) colorsInCol.push(color);
            if (colorsInCol.length !== 1) continue;
            const color = colorsInCol[0];
            const before = possible[color].length;
            possible[color] = possible[color].filter(p => p.c === c);
            if (possible[color].length < before) changed = true;
        }
    }

    // After propagation, any region reduced to 1 cell is "obvious"
    for (let color = 0; color < numColors; color++)
        if (possible[color].length === 1) return possible[color][0];

    return null;
}

// Returns the actual solution crown in the smallest region (best candidate to reveal)
function pickCrownToReveal() {
    const regionSize = Array(gridSize).fill(0);
    for (let r = 0; r < gridSize; r++)
        for (let c = 0; c < gridSize; c++)
            regionSize[grid[r][c].color]++;

    let minSize = Infinity, minColor = -1;
    for (let color = 0; color < gridSize; color++) {
        if (regionSize[color] < minSize) { minSize = regionSize[color]; minColor = color; }
    }

    for (let r = 0; r < gridSize; r++)
        for (let c = 0; c < gridSize; c++)
            if (grid[r][c].hasCrown && grid[r][c].color === minColor) return { r, c };

    // Fallback: first crown
    for (let r = 0; r < gridSize; r++)
        for (let c = 0; c < gridSize; c++)
            if (grid[r][c].hasCrown) return { r, c };

    return null;
}

function revealCrown(r, c) {
    grid[r][c].state = 'crown';
    grid[r][c].locked = true;
    crownsPlaced++;
    updateCell(r, c);
}

// ===== Puzzle Generation =====

function generatePuzzle() {
    if (crownsPerGroup === 1) return generatePuzzle1();
    return generatePuzzle2();
}

// --- Mode 1 crown ---

function generatePuzzle1() {
    for (let attempt = 0; attempt < 200; attempt++) {
        const sol = generateSolution1();
        if (!sol) continue;

        const colors = generateRegions1(sol);
        if (!colors) continue;

        const refined = refineRegions1(colors, sol);
        if (!refined) continue;

        // Verify uniqueness one more time
        if (findAllSolutions1(refined, 2).length !== 1) continue;

        const crownMap = Array.from({ length: gridSize }, () => Array(gridSize).fill(false));
        for (let r = 0; r < gridSize; r++) crownMap[r][sol[r]] = true;
        return { crownMap, colors: refined };
    }
    const fb = FALLBACK_PUZZLES[gridSize];
    const crownMap = Array.from({ length: gridSize }, () => Array(gridSize).fill(false));
    for (let r = 0; r < gridSize; r++) crownMap[r][fb.solution[r]] = true;
    return { crownMap, colors: fb.colors.map(r => [...r]) };
}

function generateSolution1() {
    const perm = [];
    const usedCols = new Set();

    function backtrack(row) {
        const cols = shuffle([...Array(gridSize).keys()].filter(c => !usedCols.has(c)));
        for (const c of cols) {
            if (row > 0 && Math.abs(perm[row - 1] - c) <= 1) continue;
            perm[row] = c;
            usedCols.add(c);
            if (row === gridSize - 1) return true;
            if (backtrack(row + 1)) return true;
            usedCols.delete(c);
        }
        return false;
    }

    if (backtrack(0)) return perm;
    return null;
}

function generateRegions1(sol) {
    const colors = Array.from({ length: gridSize }, () => Array(gridSize).fill(-1));
    const queues = [];

    for (let r = 0; r < gridSize; r++) {
        const c = sol[r];
        colors[r][c] = r;
        queues.push([{ r, c }]);
    }

    let unassigned = gridSize * gridSize - gridSize;
    let maxIter = gridSize * gridSize * 4;

    while (unassigned > 0 && maxIter-- > 0) {
        const order = shuffle([...Array(gridSize).keys()]);
        for (const colorIdx of order) {
            if (queues[colorIdx].length === 0) continue;
            shuffle(queues[colorIdx]);
            let expanded = false;
            for (const cell of queues[colorIdx]) {
                const neighbors = getNeighbors4(cell.r, cell.c);
                shuffle(neighbors);
                for (const { r: nr, c: nc } of neighbors) {
                    if (colors[nr][nc] === -1) {
                        colors[nr][nc] = colorIdx;
                        queues[colorIdx].push({ r: nr, c: nc });
                        unassigned--;
                        expanded = true;
                        break;
                    }
                }
                if (expanded) break;
            }
        }
    }

    let changed = true;
    while (changed) {
        changed = false;
        for (let r = 0; r < gridSize; r++)
            for (let c = 0; c < gridSize; c++)
                if (colors[r][c] === -1)
                    for (const { r: nr, c: nc } of getNeighbors4(r, c))
                        if (colors[nr][nc] !== -1) { colors[r][c] = colors[nr][nc]; changed = true; break; }
    }

    for (let r = 0; r < gridSize; r++)
        for (let c = 0; c < gridSize; c++)
            if (colors[r][c] === -1) return null;

    for (let colorIdx = 0; colorIdx < gridSize; colorIdx++)
        if (!isRegionConnected(colors, colorIdx)) return null;

    return colors;
}

function refineRegions1(colors, sol) {
    const workColors = colors.map(r => [...r]);

    for (let iter = 0; iter < 200; iter++) {
        const solutions = findAllSolutions1(workColors, 5);
        if (solutions.length === 1) return workColors;

        const alt = solutions.find(s => s.join(',') !== sol.join(','));
        if (!alt) break;

        let fixed = false;
        const rows = shuffle([...Array(gridSize).keys()]);
        for (const row of rows) {
            if (alt[row] === sol[row]) continue;
            const c = alt[row];
            const currentColor = workColors[row][c];

            const nb = shuffle(getNeighbors4(row, c));
            for (const { r: nr, c: nc } of nb) {
                const newColor = workColors[nr][nc];
                if (newColor === currentColor) continue;
                workColors[row][c] = newColor;
                if (isRegionConnected(workColors, currentColor) &&
                    isRegionConnected(workColors, newColor)) {
                    fixed = true;
                    break;
                }
                workColors[row][c] = currentColor;
            }
            if (fixed) break;
        }
        if (!fixed) break;
    }

    const finalSolutions = findAllSolutions1(workColors, 2);
    return finalSolutions.length === 1 ? workColors : null;
}

function findAllSolutions1(colors, maxCount) {
    const solutions = [];
    const usedCols = new Set();
    const usedColors = new Set();
    const placed = [];

    function backtrack(row) {
        if (solutions.length >= maxCount) return;
        if (row === gridSize) {
            solutions.push([...placed]);
            return;
        }
        for (let c = 0; c < gridSize; c++) {
            if (usedCols.has(c)) continue;
            const color = colors[row][c];
            if (usedColors.has(color)) continue;

            let ok = true;
            for (let pr = 0; pr < row; pr++) {
                if (Math.abs(pr - row) <= 1 && Math.abs(placed[pr] - c) <= 1) {
                    ok = false;
                    break;
                }
            }
            if (!ok) continue;

            usedCols.add(c);
            usedColors.add(color);
            placed[row] = c;
            backtrack(row + 1);
            usedCols.delete(c);
            usedColors.delete(color);
        }
    }

    backtrack(0);
    return solutions;
}

// --- Mode 2 crowns ---

function generatePuzzle2() {
    for (let attempt = 0; attempt < 200; attempt++) {
        const sol = generateSolution2();
        if (!sol) continue;

        const colors = generateRegions2(sol);
        if (!colors) continue;

        const refined = refineRegions2(colors, sol);
        if (!refined) continue;

        // Verify uniqueness one more time
        if (findAllSolutions2(refined, 2).length !== 1) continue;

        const crownMap = Array.from({ length: gridSize }, () => Array(gridSize).fill(false));
        for (let r = 0; r < gridSize; r++) for (const c of sol[r]) crownMap[r][c] = true;
        return { crownMap, colors: refined };
    }
    // Fallback for 2-crown mode
    const fb = FALLBACK_PUZZLES_2[gridSize];
    if (fb) {
        const crownMap = Array.from({ length: gridSize }, () => Array(gridSize).fill(false));
        for (let r = 0; r < gridSize; r++) for (const c of fb.solution[r]) crownMap[r][c] = true;
        return { crownMap, colors: fb.colors.map(r => [...r]) };
    }
    // Fallback: keep trying until we get a unique puzzle
    while (true) {
        const sol = generateSolution2();
        if (!sol) continue;
        const colors = generateRegions2(sol);
        if (!colors) continue;
        const refined = refineRegions2(colors, sol);
        if (!refined) continue;
        if (findAllSolutions2(refined, 2).length !== 1) continue;
        const crownMap = Array.from({ length: gridSize }, () => Array(gridSize).fill(false));
        for (let r = 0; r < gridSize; r++) for (const c of sol[r]) crownMap[r][c] = true;
        return { crownMap, colors: refined };
    }
}

function generateSolution2() {
    const colCounts = Array(gridSize).fill(0);
    const rowCrowns = [];

    function backtrack(row) {
        if (row === gridSize) return colCounts.every(c => c === 2);
        const pairs = [];
        for (let c1 = 0; c1 < gridSize; c1++) {
            if (colCounts[c1] >= 2) continue;
            for (let c2 = c1 + 2; c2 < gridSize; c2++) {
                if (colCounts[c2] >= 2) continue;
                pairs.push([c1, c2]);
            }
        }
        shuffle(pairs);
        for (const [c1, c2] of pairs) {
            if (row > 0) {
                let ok = true;
                for (const pc of rowCrowns[row - 1]) {
                    if (Math.abs(pc - c1) <= 1 || Math.abs(pc - c2) <= 1) { ok = false; break; }
                }
                if (!ok) continue;
            }
            rowCrowns[row] = [c1, c2];
            colCounts[c1]++;
            colCounts[c2]++;
            if (backtrack(row + 1)) return true;
            colCounts[c1]--;
            colCounts[c2]--;
        }
        return false;
    }

    if (backtrack(0)) return rowCrowns;
    return null;
}

function bfsPath(start, end, colors) {
    const key = (r, c) => r * gridSize + c;
    const visited = new Map();
    const queue = [start];
    visited.set(key(start.r, start.c), null);

    while (queue.length) {
        const { r, c } = queue.shift();
        if (r === end.r && c === end.c) {
            const path = [];
            let cur = { r, c };
            while (cur) { path.push(cur); cur = visited.get(key(cur.r, cur.c)); }
            return path;
        }
        for (const { r: nr, c: nc } of getNeighbors4(r, c)) {
            const k = key(nr, nc);
            if (!visited.has(k) && (colors[nr][nc] === -1 || (nr === end.r && nc === end.c))) {
                visited.set(k, { r, c });
                queue.push({ r: nr, c: nc });
            }
        }
    }
    return null;
}

function generateRegions2(sol) {
    const crowns = [];
    for (let r = 0; r < gridSize; r++) for (const c of sol[r]) crowns.push({ r, c });

    for (let pa = 0; pa < 200; pa++) {
        // Proximity-based pairing with randomization
        const shuffled = shuffle([...crowns]);
        const used = new Set();
        const pairs = [];
        const remaining = [...shuffled];

        while (remaining.length >= 2) {
            const a = remaining.shift();
            const aKey = a.r * gridSize + a.c;
            if (used.has(aKey)) continue;
            const candidates = [];
            for (let i = 0; i < remaining.length; i++) {
                const b = remaining[i];
                const bKey = b.r * gridSize + b.c;
                if (used.has(bKey)) continue;
                candidates.push({ dist: Math.abs(a.r - b.r) + Math.abs(a.c - b.c), b });
            }
            candidates.sort((x, y) => x.dist - y.dist);
            const pick = candidates[Math.floor(Math.random() * Math.min(3, candidates.length))];
            used.add(aKey);
            used.add(pick.b.r * gridSize + pick.b.c);
            pairs.push([a, pick.b]);
        }

        const colors = Array.from({ length: gridSize }, () => Array(gridSize).fill(-1));
        // Reserve all crown positions, unblock each pair when processing it
        for (const { r, c } of crowns) colors[r][c] = -2;
        const queues = [];
        let ok = true;

        for (let ci = 0; ci < pairs.length; ci++) {
            const [a, b] = pairs[ci];
            colors[a.r][a.c] = -1;
            colors[b.r][b.c] = -1;
            const path = bfsPath(a, b, colors);
            if (!path) { ok = false; break; }
            for (const { r, c } of path) colors[r][c] = ci;
            queues.push([...path]);
        }
        if (!ok) continue;

        let unassigned = 0;
        for (let r = 0; r < gridSize; r++) for (let c = 0; c < gridSize; c++) if (colors[r][c] === -1) unassigned++;

        let maxIter = gridSize * gridSize * 6;
        while (unassigned > 0 && maxIter-- > 0) {
            const order = shuffle([...Array(gridSize).keys()]);
            for (const ci of order) {
                if (!queues[ci].length) continue;
                shuffle(queues[ci]);
                let expanded = false;
                for (const cell of queues[ci]) {
                    const nb = shuffle(getNeighbors4(cell.r, cell.c));
                    for (const { r: nr, c: nc } of nb) {
                        if (colors[nr][nc] === -1) {
                            colors[nr][nc] = ci;
                            queues[ci].push({ r: nr, c: nc });
                            unassigned--;
                            expanded = true;
                            break;
                        }
                    }
                    if (expanded) break;
                }
            }
        }

        let changed = true;
        while (changed) {
            changed = false;
            for (let r = 0; r < gridSize; r++)
                for (let c = 0; c < gridSize; c++)
                    if (colors[r][c] === -1)
                        for (const { r: nr, c: nc } of getNeighbors4(r, c))
                            if (colors[nr][nc] >= 0) { colors[r][c] = colors[nr][nc]; changed = true; break; }
        }

        let valid = true;
        for (let r = 0; r < gridSize && valid; r++)
            for (let c = 0; c < gridSize && valid; c++)
                if (colors[r][c] < 0) valid = false;

        if (valid) {
            let allConnected = true;
            for (let ci = 0; ci < gridSize && allConnected; ci++)
                if (!isRegionConnected(colors, ci)) allConnected = false;
            if (allConnected) return colors;
        }
    }
    return null;
}

function solKey2(sol) { return sol.map(p => p.join(':')).join(','); }

function findAllSolutions2(colors, maxCount) {
    const solutions = [];
    const cc = Array(gridSize).fill(0); // color counts
    const colC = Array(gridSize).fill(0); // column counts
    const placed = [];

    function backtrack(row) {
        if (solutions.length >= maxCount) return;
        if (row === gridSize) {
            if (colC.every(c => c === 2)) solutions.push(placed.map(p => [...p]));
            return;
        }
        for (let c1 = 0; c1 < gridSize; c1++) {
            if (colC[c1] >= 2) continue;
            const co1 = colors[row][c1];
            if (cc[co1] >= 2) continue;

            for (let c2 = c1 + 2; c2 < gridSize; c2++) {
                if (colC[c2] >= 2) continue;
                const co2 = colors[row][c2];
                if (co1 === co2) { if (cc[co1] >= 1) continue; }
                else { if (cc[co2] >= 2) continue; }

                if (row > 0) {
                    let ok = true;
                    for (const pc of placed[row - 1]) {
                        if (Math.abs(pc - c1) <= 1 || Math.abs(pc - c2) <= 1) { ok = false; break; }
                    }
                    if (!ok) continue;
                }

                placed[row] = [c1, c2];
                colC[c1]++;
                colC[c2]++;
                const d = (co1 === co2) ? 2 : 1;
                cc[co1] += d;
                if (co1 !== co2) cc[co2]++;

                backtrack(row + 1);

                colC[c1]--;
                colC[c2]--;
                cc[co1] -= d;
                if (co1 !== co2) cc[co2]--;
            }
        }
    }

    backtrack(0);
    return solutions;
}

function refineRegions2(colors, sol) {
    const workColors = colors.map(r => [...r]);
    const sk = solKey2(sol);

    for (let iter = 0; iter < 300; iter++) {
        const solutions = findAllSolutions2(workColors, 5);
        if (solutions.length === 1) return workColors;

        const alt = solutions.find(s => solKey2(s) !== sk);
        if (!alt) break;

        let fixed = false;
        const rows = shuffle([...Array(gridSize).keys()]);
        for (const row of rows) {
            if (sol[row].join(':') === alt[row].join(':')) continue;
            const altOnly = alt[row].filter(c => !sol[row].includes(c));
            for (const c of shuffle(altOnly)) {
                const currentColor = workColors[row][c];
                const nb = shuffle(getNeighbors4(row, c));
                for (const { r: nr, c: nc } of nb) {
                    const newColor = workColors[nr][nc];
                    if (newColor === currentColor) continue;
                    workColors[row][c] = newColor;
                    if (isRegionConnected(workColors, currentColor) &&
                        isRegionConnected(workColors, newColor)) {
                        fixed = true;
                        break;
                    }
                    workColors[row][c] = currentColor;
                }
                if (fixed) break;
            }
            if (fixed) break;
        }
        if (!fixed) break;
    }

    const finalSolutions = findAllSolutions2(workColors, 2);
    return finalSolutions.length === 1 ? workColors : null;
}

// Fallback puzzles for 2-crown mode
const FALLBACK_PUZZLES_2 = {
    8: {
        solution: [[4,6],[0,2],[4,6],[0,2],[5,7],[1,3],[5,7],[1,3]],
        colors: [
            [0,7,7,7,7,5,5,5],
            [0,7,5,5,5,5,5,5],
            [0,7,7,7,6,6,2,2],
            [0,7,7,4,4,6,6,2],
            [0,7,4,4,4,4,6,2],
            [1,1,4,4,6,6,6,2],
            [1,1,3,3,6,6,3,3],
            [1,1,1,3,3,3,3,3],
        ]
    },
    9: {
        solution: [[1,4],[6,8],[2,4],[0,7],[2,5],[0,7],[3,5],[1,8],[3,6]],
        colors: [
            [1,1,8,8,8,8,8,5,7],
            [1,1,1,8,5,5,5,5,7],
            [0,1,1,8,5,7,7,7,7],
            [0,8,8,8,5,4,7,6,6],
            [0,4,8,4,4,4,7,6,6],
            [0,4,4,4,7,7,7,6,6],
            [0,4,2,2,7,3,3,3,3],
            [0,4,2,2,7,7,7,3,3],
            [0,4,2,2,7,7,7,3,3],
        ]
    },
    10: {
        solution: [[1,4],[7,9],[0,5],[3,7],[5,9],[1,3],[6,8],[0,2],[6,8],[2,4]],
        colors: [
            [8,8,8,9,9,9,9,9,9,2],
            [8,8,8,8,8,8,8,1,9,2],
            [7,7,7,7,7,7,8,1,9,2],
            [7,7,7,4,4,4,8,1,9,2],
            [7,9,7,4,4,4,8,1,9,2],
            [9,9,9,8,8,8,8,9,9,9],
            [0,0,9,9,9,9,5,9,3,3],
            [0,0,0,0,9,9,5,9,3,3],
            [0,6,6,0,6,9,5,9,3,3],
            [6,6,6,6,6,9,9,9,3,3],
        ]
    },
};

// ===== Region Connectivity =====

function isRegionConnected(colors, colorIdx) {
    const cells = [];
    for (let r = 0; r < gridSize; r++)
        for (let c = 0; c < gridSize; c++)
            if (colors[r][c] === colorIdx) cells.push({ r, c });
    if (cells.length === 0) return false;

    const visited = new Set();
    const key = (r, c) => r * gridSize + c;
    const queue = [cells[0]];
    visited.add(key(cells[0].r, cells[0].c));

    while (queue.length > 0) {
        const { r, c } = queue.shift();
        for (const { r: nr, c: nc } of getNeighbors4(r, c)) {
            const k = key(nr, nc);
            if (colors[nr][nc] === colorIdx && !visited.has(k)) {
                visited.add(k);
                queue.push({ r: nr, c: nc });
            }
        }
    }
    return visited.size === cells.length;
}

// ===== Helpers =====

function getNeighbors4(r, c) {
    const result = [];
    if (r > 0) result.push({ r: r - 1, c });
    if (r < gridSize - 1) result.push({ r: r + 1, c });
    if (c > 0) result.push({ r, c: c - 1 });
    if (c < gridSize - 1) result.push({ r, c: c + 1 });
    return result;
}

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// ===== Rendering =====

function renderGrid() {
    gridEl.innerHTML = '';
    gridEl.style.gridTemplateColumns = `repeat(${gridSize}, 1fr)`;
    gridEl.style.gridTemplateRows = `repeat(${gridSize}, 1fr)`;

    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            const cell = document.createElement('div');
            cell.dataset.row = r;
            cell.dataset.col = c;

            const icon = document.createElement('span');
            cell.appendChild(icon);
            gridEl.appendChild(cell);

            applyCellAppearance(cell, r, c);
        }
    }
}

// Update a single cell in-place without rebuilding the grid
function updateCell(r, c) {
    const cell = gridEl.querySelector(`[data-row="${r}"][data-col="${c}"]`);
    if (cell) applyCellAppearance(cell, r, c);
}

function applyCellAppearance(cell, r, c) {
    const data = grid[r][c];

    // Base class + color
    cell.className = `cell color-${data.color}`;

    // Region borders
    if (r === 0 || grid[r - 1][c].color !== data.color) cell.classList.add('border-top');
    if (r === gridSize - 1 || grid[r + 1][c].color !== data.color) cell.classList.add('border-bottom');
    if (c === 0 || grid[r][c - 1].color !== data.color) cell.classList.add('border-left');
    if (c === gridSize - 1 || grid[r][c + 1].color !== data.color) cell.classList.add('border-right');

    if (data.locked) cell.classList.add('locked');

    // Icon content
    const icon = cell.firstChild;
    icon.className = 'icon';

    // Remove any previous draft badge
    const oldBadge = cell.querySelector('.draft-badge');
    if (oldBadge) oldBadge.remove();

    const isDraft = data.state === 'draft-cross' || data.state === 'draft-crown';

    if (data.state === 'cross' || data.state === 'draft-cross') {
        icon.classList.add('cross');
        if (isDraft) icon.classList.add('draft');
        icon.textContent = '✕';
    } else if (data.state === 'crown' || data.state === 'draft-crown') {
        icon.classList.add('crown');
        if (isDraft) icon.classList.add('draft');
        icon.textContent = '👑';
    } else {
        icon.textContent = '';
    }

    if (isDraft) {
        cell.classList.add('draft-cell');
        const badge = document.createElement('span');
        badge.className = 'draft-badge';
        badge.textContent = '?';
        cell.appendChild(badge);
    }
}

// ===== Crown Undo System =====

function crownSaveState() {
    const snapshot = {
        grid: grid.map(row => row.map(cell => ({ ...cell }))),
        crownsPlaced,
        gameOver,
    };
    crownUndoStack.push(snapshot);
    updateCrownUndoBtn();
}

function crownUndo() {
    if (crownUndoStack.length === 0) return;
    const snapshot = crownUndoStack.pop();
    grid = snapshot.grid;
    crownsPlaced = snapshot.crownsPlaced;
    gameOver = snapshot.gameOver;
    renderGrid();
    if (!gameOver) {
        messageEl.className = 'hidden';
        messageEl.textContent = '';
        closeOverlay();
    }
    updateCrownUndoBtn();
}

function updateCrownUndoBtn() {
    const btn = document.getElementById('crown-undo-btn');
    if (btn) btn.disabled = crownUndoStack.length === 0;
}

// ===== Click Handling (unified for desktop & mobile) =====

let lastClickTime = 0;
let lastClickRow = -1;
let lastClickCol = -1;
let lastClickPrevState = null; // state before the first click (to undo on dblclick)
const DBLCLICK_DELAY = 350;

// ===== Drag (swipe-to-fill) state =====
let isDragging = false;
let dragAction = null;   // 'add' | 'remove'
let dragVisited = new Set();
let pointerDownCell = null; // { r, c }

function onGridClick(r, c) {
    if (gameOver) return;
    const now = Date.now();

    if (lastClickRow === r && lastClickCol === c && (now - lastClickTime) < DBLCLICK_DELAY) {
        // Double click on same cell — undo the instant cross and attempt crown
        lastClickTime = 0;
        lastClickRow = -1;
        lastClickCol = -1;
        // Pop the single-click undo entry, we'll push a fresh one for the dblclick
        crownUndoStack.pop();
        // Revert cell to state before first click
        if (lastClickPrevState !== null && !grid[r][c].locked) {
            grid[r][c].state = lastClickPrevState;
        }
        lastClickPrevState = null;
        crownSaveState();
        handleDblClick(r, c);
    } else {
        // First click — apply immediately
        lastClickTime = now;
        lastClickRow = r;
        lastClickCol = c;
        lastClickPrevState = grid[r][c].state;
        crownSaveState();
        handleSingleClick(r, c);
    }
}

function applyDragAction(r, c) {
    const key = `${r},${c}`;
    if (dragVisited.has(key)) return;
    dragVisited.add(key);
    const data = grid[r][c];
    if (data.locked) return;

    if (draftMode) {
        if (dragAction === 'add' && (data.state === 'empty' || data.state === 'draft-crown')) {
            data.state = 'draft-cross';
            updateCell(r, c);
        } else if (dragAction === 'remove' && (data.state === 'draft-cross' || data.state === 'draft-crown')) {
            data.state = 'empty';
            updateCell(r, c);
        }
        return;
    }

    if (dragAction === 'add' && (data.state === 'empty' || data.state === 'draft-cross' || data.state === 'draft-crown')) {
        data.state = 'cross';
        updateCell(r, c);
    } else if (dragAction === 'remove' && (data.state === 'cross' || data.state === 'draft-cross' || data.state === 'draft-crown')) {
        data.state = 'empty';
        updateCell(r, c);
    }
}

function setupClickHandlers() {
    gridEl.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        const cell = e.target.closest('.cell');
        if (!cell) return;
        isDragging = false;
        dragAction = null;
        dragVisited = new Set();
        pointerDownCell = { r: parseInt(cell.dataset.row), c: parseInt(cell.dataset.col) };
        gridEl.setPointerCapture(e.pointerId);
    });

    gridEl.addEventListener('pointermove', (e) => {
        if (!pointerDownCell || gameOver || hintMode) return;
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const cell = el && el.closest('.cell');
        if (!cell) return;
        const r = parseInt(cell.dataset.row);
        const c = parseInt(cell.dataset.col);
        // Only start dragging once the finger/cursor moves to a different cell
        if (r === pointerDownCell.r && c === pointerDownCell.c) return;
        if (!isDragging) {
            isDragging = true;
            crownSaveState();
            const startData = grid[pointerDownCell.r][pointerDownCell.c];
            dragAction = (startData.state === 'cross' || startData.state === 'draft-cross') ? 'remove' : 'add';
            applyDragAction(pointerDownCell.r, pointerDownCell.c);
        }
        applyDragAction(r, c);
    });

    gridEl.addEventListener('pointerup', (e) => {
        const wasDragging = isDragging;
        isDragging = false;
        dragAction = null;
        dragVisited = new Set();
        const downCell = pointerDownCell;
        pointerDownCell = null;
        if (wasDragging) return; // drag ended, no click
        if (downCell) onGridClick(downCell.r, downCell.c);
    });

    gridEl.addEventListener('pointercancel', () => {
        isDragging = false;
        dragAction = null;
        dragVisited = new Set();
        pointerDownCell = null;
    });
}

// ===== Cell Interactions =====

function handleSingleClick(r, c) {
    if (gameOver) return;

    if (hintMode) {
        useHint(r, c);
        return;
    }

    if (grid[r][c].locked) return;

    if (draftMode) {
        if (grid[r][c].state === 'empty') {
            grid[r][c].state = 'draft-cross';
        } else if (grid[r][c].state === 'draft-cross') {
            grid[r][c].state = 'empty';
        }
        updateCell(r, c);
        return;
    }

    if (grid[r][c].state === 'empty' || grid[r][c].state === 'draft-cross' || grid[r][c].state === 'draft-crown') {
        grid[r][c].state = 'cross';
    } else if (grid[r][c].state === 'cross') {
        grid[r][c].state = 'empty';
    }
    updateCell(r, c);
}

function handleDblClick(r, c) {
    if (gameOver) return;
    if (hintMode) {
        useHint(r, c);
        return;
    }

    // Double-click on a found crown → place crosses around it
    if (grid[r][c].locked && grid[r][c].state === 'crown') {
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const nr = r + dr, nc = c + dc;
                if (nr < 0 || nr >= gridSize || nc < 0 || nc >= gridSize) continue;
                if ((grid[nr][nc].state === 'empty' || grid[nr][nc].state === 'draft-cross' || grid[nr][nc].state === 'draft-crown') && !grid[nr][nc].locked) {
                    grid[nr][nc].state = 'cross';
                    updateCell(nr, nc);
                }
            }
        }
        return;
    }

    if (grid[r][c].locked) return;
    if (grid[r][c].state === 'crown') return;

    if (draftMode) {
        // In draft mode: toggle draft-crown without checking correctness
        if (grid[r][c].state === 'empty' || grid[r][c].state === 'draft-cross') {
            grid[r][c].state = 'draft-crown';
        } else if (grid[r][c].state === 'draft-crown') {
            grid[r][c].state = 'empty';
        }
        updateCell(r, c);
        return;
    }

    // Treat draft states as empty for crown placement
    const effectiveState = (grid[r][c].state === 'draft-cross' || grid[r][c].state === 'draft-crown') ? 'empty' : grid[r][c].state;

    // Attempt to place crown
    if (grid[r][c].hasCrown) {
        // Correct!
        grid[r][c].state = 'crown';
        grid[r][c].locked = true;
        crownsPlaced++;
        updateCell(r, c);

        if (crownsPlaced === totalCrowns) {
            onVictory();
        }
    } else {
        // Wrong!
        grid[r][c].state = 'empty';
        updateCell(r, c);

        // Flash red on the cell
        const cellEl = gridEl.querySelector(`[data-row="${r}"][data-col="${c}"]`);
        if (cellEl) {
            cellEl.classList.add('error');
            setTimeout(() => cellEl.classList.remove('error'), 600);
        }

        showOverlay('❌ Mauvaise case ! Pas de couronne ici.\nContinue à chercher !');
    }
}

// ===== Draft Mode =====

function toggleDraftMode() {
    if (gameOver) return;
    draftMode = !draftMode;
    if (draftMode) {
        draftBtn.classList.add('draft-active');
        // Deactivate hint mode if active
        if (hintMode) {
            hintMode = false;
            hintBtn.classList.remove('hint-active');
        }
        showMessage('✏️ Mode brouillon — tes coups sont provisoires', 'hint');
    } else {
        draftBtn.classList.remove('draft-active');
        hideMessage();
    }
}

// ===== Hint System =====

function toggleHintMode() {
    if (gameOver) return;
    if (hintRemaining <= 0) return;

    hintMode = !hintMode;
    if (hintMode) {
        // Deactivate draft mode if active
        if (draftMode) {
            draftMode = false;
            draftBtn.classList.remove('draft-active');
        }
        hintBtn.classList.add('hint-active');
        showMessage('Clique sur une case pour révéler son contenu', 'hint');
    } else {
        hintBtn.classList.remove('hint-active');
        hideMessage();
    }
}

function useHint(r, c) {
    if (!hintMode || hintRemaining <= 0) return;
    if (grid[r][c].locked) {
        // Already revealed, don't waste the hint
        return;
    }

    hintMode = false;
    hintRemaining = 0;
    hintBtn.classList.remove('hint-active');
    hintBtn.classList.add('used');
    hideMessage();

    if (grid[r][c].hasCrown) {
        grid[r][c].state = 'crown';
        grid[r][c].locked = true;
        crownsPlaced++;
        updateCell(r, c);

        if (crownsPlaced === totalCrowns) {
            onVictory();
        }
    } else {
        grid[r][c].state = 'cross';
        grid[r][c].locked = true;
        updateCell(r, c);
    }
}

// ===== Victory =====

const VICTORY_MESSAGES = [
    "TOUKOU TOUKOU, OUK OUK!",
    "🎉 Bravo Jeanne ! Tu es absolument brillante !",
    "👑 La reine des couronnes, c'est toi Jeanne ! Olivier est trop fier de toi !",
    "🌟 Jeanne, tu illumines tout ce que tu touches — même les puzzles !",
    "💛 Arthur, Victoire, Martin et Antoine ont la meilleure maman du monde !",
    "🎊 Gérer 4 enfants ET battre ce puzzle ? Jeanne est surhumaine !",
    "✨ Sa famille a bien de la chance de l'avoir — et elle le prouve encore !",
    "🥰 Olivier t'aime, et il sait depuis longtemps que tu es la plus forte !",
    "🌸 Jeanne, tu jongles entre 4 enfants, un mari et les couronnes — quelle femme !",
    "🏆 Championne toutes catégories : maman, épouse, cuisinière ET joueuse de logique !",
    "💫 Pas étonnant que tes enfants t'admirent : tu vois toujours la bonne voie !",
    "🕊️ Jeanne, ton âme douce et ta tête bien faite forment une combinaison imbattable !",
    "🎈 Victoire ! (Et pas seulement celle de ta fille 😉) Bravo Jeanne !",
    "💝 Olivier te le dit souvent, mais là c'est le jeu qui te le confirme : tu es exceptionnelle !",
    "🌺 Aussi belle dans sa tête que dans son cœur — c'est notre Jeanne !",
    "🦋 Tu as trouvé toutes les couronnes… comme tu trouves toujours les bons mots pour les autres !",
    "🎯 En plein dans le mille, Jeanne ! Arthur, Victoire, Martin et Antoine applaudissent !",
    "⭐ Les devoirs, les repas, le mari, le puzzle… Tu gères tout avec grâce !",
    "🌈 Jeanne, si la bienveillance avait un visage, ce serait le tien !",
    "💐 Pour toi Jeanne, un bouquet virtuel de félicitations — tu le mérites cent fois !",
    "🙌 Incroyable mais vrai : Jeanne a encore réussi ! (On n'est plus vraiment surpris, hein !)",
    "👑 Couronnes trouvées, cœur en or, famille adorée — Jeanne a tout !",
    "🎶 Si la vie était une chanson, Jeanne en serait le refrain qu'on n'a jamais envie d'arrêter !",
    "🤍 Jeanne, chaque jour tu prouves qu'on peut être douce ET redoutable !",
    "🌻 Comme un tournesol, tu tournes toujours vers la lumière — et tu l'apportes aux autres !",
    "🎁 Olivier a tiré le gros lot le jour où il t'a rencontrée, Jeanne !",
    "💪 4 enfants, 1 mari, mille câlins par jour ET elle gagne au puzzle. Chapeau !",
    "🕯️ Tu allumes des lumières dans les cœurs de ta famille tous les jours — et maintenant dans ce jeu !",
    "🌙 Jeanne, tu es la personne la plus lumineuse qu'Olivier connaisse !",
    "😄 Arthur avait parié que tu allais trouver. Martin aussi. Victoire et Antoine t'ont soutenue du début !",
    "🥳 Fêtons ça ! Jeanne a gagné, et toute la famille est fière d'elle !",
    "💞 Derrière chaque grande maman, il y a… une grande maman. Point. Bravo Jeanne !",
    "🦅 Tu t'envoles au-dessus de ce puzzle comme tu t'envoles au-dessus de tous les défis !",
    "🎠 La vie avec toi Jeanne, c'est un manège qu'on ne veut jamais quitter !",
    "🌊 Aussi apaisante qu'une marée douce, aussi puissante qu'une vague — c'est Jeanne !",
    "📿 Avec tout l'amour d'Olivier et des enfants : Bravo, notre Jeanne adorée !",
    "🏅 Médaille d'or pour Jeanne : maman formidable, femme éblouissante, joueuse redoutable !",
    "🤗 Arthur, Victoire, Martin et Antoine ne savent pas à quel point ils ont de la chance de t'avoir !",
    "💡 Jeanne voit des solutions là où les autres ne voient que des problèmes. Preuve en court !",
    "🌿 Ton calme, ta foi, ta générosité — et maintenant ta victoire au puzzle. Rien ne t'arrête !",
    "🎀 Enveloppée de douceur, armée de logique : c'est le secret de Jeanne !",
    "🌅 Chaque matin est plus beau parce que tu es là, Jeanne !",
    "💬 Olivier te le murmure ce soir : tu es la meilleure chose qui me soit arrivée !",
    "🍀 Arthur, Victoire, Martin et Antoine ont une chance inouïe — leur maman est la meilleure !",
    "🎗️ Famille, amour, puzzle — tout ce que tu touches devient précieux, Jeanne !",
    "🦁 Lion pour défendre sa famille, agneau pour accueillir les autres. Voilà Jeanne !",
    "🌸 Ce n'est pas que les couronnes qui te vont bien — toutes les couronnes sont pour toi !",
    "✝️ Avec tout ce que tu donnes aux autres, tu mérites bien cette petite victoire pour toi !",
    "🥂 Trinquons (en jus d'orange si tu veux) à Jeanne, la femme la plus merveilleuse du monde !",
    "🎪 Le plus beau spectacle qu'Olivier connaisse ? Jeanne, simplement en train de vivre !",
    "💖 Puzzle terminé, sourire garanti : voilà l'effet Jeanne sur tout ce qu'elle entreprend !",
    "🌟 Jeanne — maman, épouse, confidente, amie, joueuse. Décidément, tu excelles partout !",
    "🕊️ Paix, amour et victoire au puzzle — c'est le programme de Jeanne pour aujourd'hui !",
];

function onVictory() {
    gameOver = true;
    const msg = VICTORY_MESSAGES[Math.floor(Math.random() * VICTORY_MESSAGES.length)];
    showMessage(msg, 'win');
    spawnConfetti();
}

function spawnConfetti() {
    const container = document.getElementById('grid-container');
    const rect = container.getBoundingClientRect();
    const colors = ['#FFB3BA', '#BAE1FF', '#B5EAD7', '#FFDAC1', '#D5AAFF',
                    '#FF9AA2', '#FFFFD1', '#E2B6CF', '#B5F5EC'];

    for (let i = 0; i < 40; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * rect.width + 'px';
        confetti.style.top = Math.random() * 40 + 'px';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDelay = Math.random() * 0.5 + 's';
        confetti.style.animationDuration = (0.8 + Math.random() * 0.8) + 's';
        container.style.position = 'relative';
        container.appendChild(confetti);

        setTimeout(() => confetti.remove(), 2000);
    }
}

// ===== Messages & Overlay =====

function showMessage(text, type) {
    messageEl.className = type;
    messageEl.textContent = text;
}

function hideMessage() {
    messageEl.className = 'hidden';
    messageEl.textContent = '';
}

function showOverlay(text) {
    overlayText.textContent = text;
    overlay.classList.remove('hidden');
}

function closeOverlay() {
    overlay.classList.add('hidden');
}

// ===== Start =====

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

init();
