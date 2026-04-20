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
    "🎉 Bravo Jeanne ! Tu es absolument brillante !",
    "👑 La reine des couronnes, c'est toi Jeanne ! Olivier est trop fier de toi !",
    "🌟 Jeanne, tu illumines tout ce que tu touches — même les puzzles !",
    "💛 Arthur, Victoire, Martin et Antoine ont la meilleure maman du monde !",
    "🎊 Gérer la pastorale d'un collège ET battre ce puzzle ? Jeanne est surhumaine !",
    "✨ Clisson a bien de la chance de t'avoir, Jeanne !",
    "🥰 Olivier t'aime, et il sait depuis longtemps que tu es la plus forte !",
    "🌸 Jeanne, tu jondles entre 4 enfants, un collège et les couronnes — quelle femme !",
    "🏆 Championne toutes catégories : maman, épouse, pastorale ET jeux de logique !",
    "💫 Pas étonnant que tu guides les élèves : tu vois toujours la bonne voie !",
    "🕊️ Jeanne, ton âme douce et ta tête bien faite forment une combinaison imbattable !",
    "🎈 Victoire ! (Et pas seulement celle de ta fille 😉) Bravo Jeanne !",
    "💝 Olivier te le dit souvent, mais là c'est le jeu qui te le confirme : tu es exceptionnelle !",
    "🌺 Aussi belle dans sa tête que dans son cœur — c'est notre Jeanne !",
    "🦋 Tu as trouvé toutes les couronnes… comme tu trouves toujours les bons mots pour les autres !",
    "🎯 En plein dans le mille, Jeanne ! Arthur, Victoire, Martin et Antoine applaudissent !",
    "⭐ La pastorale, les enfants, le mari, le puzzle… Tu gères tout avec grâce !",
    "🌈 Jeanne, si la bienveillance avait un visage, ce serait le tien !",
    "💐 Pour toi Jeanne, un bouquet virtuel de félicitations — tu le mérites cent fois !",
    "🙌 Incroyable mais vrai : Jeanne a encore réussi ! (On n'est plus vraiment surpris, hein !)",
    "👑 Couronnes trouvées, cœur en or, famille adorée — Jeanne a tout !",
    "🎶 Si la vie était une chanson, Jeanne en serait le refrain qu'on n'a jamais envie d'arrêter !",
    "🤍 Jeanne, chaque jour tu prouves qu'on peut être douce ET redoutable !",
    "🌻 Comme un tournesol, tu tournes toujours vers la lumière — et tu l'apportes aux autres !",
    "🎁 Olivier a tiré le gros lot le jour où il t'a rencontrée, Jeanne !",
    "💪 4 enfants, 1 mari, des dizaines d'élèves à accompagner ET elle gagne au puzzle. Chapeau !",
    "🕯️ Tu allumes des lumières dans les cœurs à Clisson tous les jours — et maintenant dans ce jeu !",
    "🌙 Jeanne, tu es la personne la plus lumineuse qu'Olivier connaisse !",
    "😄 Arthur avait parié que tu allais trouver. Martin aussi. Victoire et Antoine t'ont soutenue du début !",
    "🥳 Fêtons ça ! Jeanne a gagné, et toute la famille est fière d'elle !",
    "💞 Derrière chaque grande maman, il y a… une grande maman. Point. Bravo Jeanne !",
    "🦅 Tu t'envoles au-dessus de ce puzzle comme tu t'envoles au-dessus de tous les défis !",
    "🎠 La vie avec toi Jeanne, c'est un manège qu'on ne veut jamais quitter !",
    "🌊 Aussi apaisante qu'une marée douce, aussi puissante qu'une vague — c'est Jeanne !",
    "📿 Avec tout l'amour d'Olivier et des enfants : Bravo, notre Jeanne adorée !",
    "🏅 Médaille d'or pour Jeanne : maman formidable, femme éblouissante, joueuse redoutable !",
    "🤗 Les élèves du collège de Clisson ne savent pas à quel point ils ont de la chance de t'avoir !",
    "💡 Jeanne voit des solutions là où les autres ne voient que des problèmes. Preuve en court !",
    "🌿 Ton calme, ta foi, ta générosité — et maintenant ta victoire au puzzle. Rien ne t'arrête !",
    "🎀 Enveloppée de douceur, armée de logique : c'est le secret de Jeanne !",
    "🌅 Chaque matin à Clisson est plus beau parce que tu y es, Jeanne !",
    "💬 Olivier te le murmure ce soir : tu es la meilleure chose qui me soit arrivée !",
    "🍀 Arthur, Victoire, Martin et Antoine ont une chance inouïe — leur maman est la meilleure !",
    "🎗️ Pastorale, famille, puzzle — tout ce que tu touches devient précieux, Jeanne !",
    "🦁 Lion pour défendre sa famille, agneau pour accueillir les autres. Voilà Jeanne !",
    "🌸 Ce n'est pas que les couronnes qui te vont bien — toutes les couronnes sont pour toi !",
    "✝️ Avec tout ce que tu donnes aux autres, tu mérites bien cette petite victoire pour toi !",
    "🥂 Trinquons (en jus d'orange si tu veux) à Jeanne, la femme la plus merveilleuse de Clisson !",
    "🎪 Le plus beau spectacle qu'Olivier connaisse ? Jeanne, simplement en train de vivre !",
    "💖 Puzzle terminé, sourire garanti : voilà l'effet Jeanne sur tout ce qu'elle entreprend !",
    "🌟 Jeanne — maman, épouse, pastorale, amie, joueuse. Décidément, tu excelles partout !",
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

// ===== Game Switcher =====
const gameTabs = document.querySelectorAll('.game-tab');
const gamePanels = {
    crowns: document.getElementById('game-crowns'),
    sudoku: document.getElementById('game-sudoku'),
    picross: document.getElementById('game-picross'),
};

gameTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const game = tab.dataset.game;
        gameTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        Object.values(gamePanels).forEach(p => p.classList.add('hidden'));
        gamePanels[game].classList.remove('hidden');
        if (game === 'sudoku' && !sudokuInitialized) {
            sudokuInit();
        }
        if (game === 'picross' && !picrossInitialized) {
            picrossInit();
        }
    });
});

// ===== Sudoku Module =====
let sudokuInitialized = false;
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
    sudokuInitialized = true;

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
        if (gamePanels.sudoku.classList.contains('hidden')) return;
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
    "🏆 Médaille d'or du sudoku décernée à Jeanne de Clisson !",
    "💫 81 cases, 0 erreur, 1 Jeanne. L'équation parfaite !",
    "🕊️ Jeanne résout les grilles comme elle résout les problèmes : avec grâce et patience !",
    "🥰 Olivier t'aime encore plus à chaque grille terminée — si c'était possible !",
    "🎯 Ligne par ligne, colonne par colonne, bloc par bloc : Jeanne ne laisse rien au hasard !",
    "🌺 Aussi méthodique au sudoku qu'à la pastorale — c'est le talent de Jeanne !",
    "💝 Les chiffres t'obéissent, les enfants t'adorent, le mari t'admire. Que demander de plus ?",
    "🎈 Sudoku terminé ! Jeanne fait exploser les compteurs de fierté d'Olivier !",
    "🌈 Tu mets de l'ordre dans les chiffres comme tu mets de la lumière dans les vies !",
    "🦋 Légère comme un papillon, précise comme un laser — Jeanne face au sudoku !",
    "💐 Pour chaque chiffre bien placé, Jeanne mérite une fleur. Voilà un bouquet de 81 !",
    "🎶 Jeanne joue du sudoku comme Mozart jouait du piano : avec une aisance naturelle !",
    "🤗 Les élèves de Clisson seraient fiers de voir leur responsable pastorale en action !",
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
    "💪 4 enfants, 1 pastorale, 81 cases : Jeanne gère tout sans sourciller !",
    "🕯️ Chaque chiffre posé par Jeanne est une petite lumière dans la grille !",
    "🦅 Vue d'ensemble et sens du détail — Jeanne maîtrise les deux comme personne !",
    "🎠 La vie à Clisson est un joli manège, et Jeanne en est le centre radieux !",
    "🌅 Ce sudoku terminé annonce un beau coucher de soleil — celui de la victoire !",
    "💬 Olivier murmure : bravo ma Jeanne, tu es décidément imbattable !",
    "🤍 Chaque ligne complète est une déclaration d'amour aux mathématiques signée Jeanne !",
    "🎀 Élégante jusque dans sa façon de remplir un sudoku — c'est tout Jeanne !",
    "🌸 Victoire serait fière de porter si bien son prénom grâce à sa maman aujourd'hui !",
    "🙌 Incroyable : Jeanne a encore vaincu ! Le sudoku n'avait aucune chance !",
    "💖 Grille parfaite, famille parfaite, femme parfaite — tout est dit !",
    "🎵 Si chaque chiffre était une note, Jeanne viendrait de composer une symphonie !",
    "🌟 Clisson peut dormir tranquille : Jeanne veille sur les élèves ET sur les sudokus !",
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

// ===== Picross Module =====
let picrossInitialized = false;
let picrossSize = 5;
let picrossSolution = [];    // picrossSolution[r][c] = true/false
let picrossBoard = [];       // 'empty' | 'filled' | 'crossed' | 'draft-filled' | 'draft-crossed'
let picrossRowClues = [];
let picrossColClues = [];
let picrossGameOver = false;
let picrossDraftMode = false;
let picrossCrossMode = false;
let picrossLevel = 'easy';
let picrossLocked = [];      // locked[r][c] = true if hinted
let picrossUndoStack = [];

// Drag state for picross
let picrossDragging = false;
let picrossDragAction = null;   // 'fill' | 'unfill' | 'cross' | 'uncross'
let picrossDragVisited = new Set();
let picrossPointerDown = null;  // { r, c }
let picrossPointerIsRight = false;


const PICROSS_SIZES = { easy: 5, medium: 10, hard: 15 };

function picrossInit() {
    picrossInitialized = true;

    document.querySelectorAll('.pdiff-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.pdiff-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            picrossLevel = btn.dataset.level;
            picrossNewGame();
        });
    });

    document.getElementById('picross-new-game').addEventListener('click', picrossNewGame);

    const draftBtn = document.getElementById('picross-draft-btn');
    draftBtn.addEventListener('click', () => {
        if (picrossGameOver) return;
        picrossDraftMode = !picrossDraftMode;
        draftBtn.classList.toggle('draft-active', picrossDraftMode);
        const msgEl = document.getElementById('picross-message');
        if (picrossDraftMode) {
            msgEl.className = 'hint';
            msgEl.textContent = '✏️ Mode brouillon — tes coups sont provisoires';
        } else {
            msgEl.className = 'hidden';
            msgEl.textContent = '';
        }
    });

    document.getElementById('picross-hint-btn').addEventListener('click', picrossUseHint);

    // Undo button
    document.getElementById('picross-undo-btn').addEventListener('click', picrossUndo);

    document.querySelectorAll('.picross-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (picrossGameOver) return;
            const mode = btn.dataset.mode;
            picrossCrossMode = (mode === 'cross');
            document.querySelectorAll('.picross-toggle-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    picrossNewGame();
}

function picrossNewGame() {
    picrossSize = PICROSS_SIZES[picrossLevel];
    picrossGameOver = false;
    picrossDraftMode = false;
    picrossCrossMode = false;
    picrossUndoStack = [];
    updatePicrossUndoBtn();
    document.querySelectorAll('.picross-toggle-btn').forEach(b => b.classList.remove('active'));
    const fillBtn = document.getElementById('picross-fill-btn');
    if (fillBtn) fillBtn.classList.add('active');
    const draftBtn = document.getElementById('picross-draft-btn');
    if (draftBtn) draftBtn.classList.remove('draft-active');
    const msgEl = document.getElementById('picross-message');
    msgEl.className = 'hidden';
    msgEl.textContent = '';

    // Apply size class for responsive CSS
    const container = document.getElementById('picross-grid-container');
    container.classList.remove('picross-medium', 'picross-hard');
    if (picrossLevel === 'medium') container.classList.add('picross-medium');
    else if (picrossLevel === 'hard') container.classList.add('picross-hard');

    picrossGenerate();
    picrossBoard = Array.from({ length: picrossSize }, () => Array(picrossSize).fill('empty'));
    picrossLocked = Array.from({ length: picrossSize }, () => Array(picrossSize).fill(false));
    picrossRenderGrid();
}

function picrossGenerate() {
    const size = picrossSize;
    // Density: how full is the grid (40-60% for nice puzzles)
    const density = 0.45 + Math.random() * 0.15;

    for (let attempt = 0; attempt < 50; attempt++) {
        const sol = Array.from({ length: size }, () =>
            Array.from({ length: size }, () => Math.random() < density)
        );

        // Ensure no completely empty row or column
        for (let r = 0; r < size; r++) {
            if (sol[r].every(v => !v)) sol[r][Math.floor(Math.random() * size)] = true;
        }
        for (let c = 0; c < size; c++) {
            if (sol.every(row => !row[c])) sol[Math.floor(Math.random() * size)][c] = true;
        }

        const rowClues = sol.map(row => picrossComputeClue(row));
        const colClues = [];
        for (let c = 0; c < size; c++) {
            const col = sol.map(row => row[c]);
            colClues.push(picrossComputeClue(col));
        }

        // For small grids, verify uniqueness
        if (size <= 10) {
            if (picrossSolve(rowClues, colClues, size)) {
                picrossSolution = sol;
                picrossRowClues = rowClues;
                picrossColClues = colClues;
                return;
            }
        } else {
            // For 15×15, skip uniqueness check (too expensive), just use the puzzle
            picrossSolution = sol;
            picrossRowClues = rowClues;
            picrossColClues = colClues;
            return;
        }
    }

    // Fallback: use last generated
    picrossRowClues = picrossSolution.map(row => picrossComputeClue(row));
    const colClues = [];
    for (let c = 0; c < picrossSize; c++) {
        colClues.push(picrossComputeClue(picrossSolution.map(row => row[c])));
    }
    picrossColClues = colClues;
}

function picrossComputeClue(line) {
    const groups = [];
    let count = 0;
    for (const v of line) {
        if (v) {
            count++;
        } else if (count > 0) {
            groups.push(count);
            count = 0;
        }
    }
    if (count > 0) groups.push(count);
    return groups.length > 0 ? groups : [0];
}

// Solver using line-by-line constraint propagation (for uniqueness check)
function picrossSolve(rowClues, colClues, size) {
    // State: 0 = unknown, 1 = filled, -1 = empty
    const state = Array.from({ length: size }, () => Array(size).fill(0));

    function getLinePossibilities(clue, length) {
        const results = [];
        const groups = clue[0] === 0 ? [] : clue;
        const numGroups = groups.length;

        if (numGroups === 0) {
            results.push(Array(length).fill(false));
            return results;
        }

        const minLength = groups.reduce((a, b) => a + b, 0) + numGroups - 1;
        if (minLength > length) return results;

        function backtrack(gi, pos, line) {
            if (gi === numGroups) {
                results.push([...line]);
                return;
            }
            const remaining = groups.slice(gi).reduce((a, b) => a + b, 0) + (numGroups - gi - 1);
            const maxStart = length - remaining;
            for (let start = pos; start <= maxStart; start++) {
                const newLine = [...line];
                for (let i = start; i < start + groups[gi]; i++) newLine[i] = true;
                if (start + groups[gi] < length) newLine[start + groups[gi]] = false;
                backtrack(gi + 1, start + groups[gi] + 1, newLine);
            }
        }

        const emptyLine = Array(length).fill(false);
        backtrack(0, 0, emptyLine);
        return results;
    }

    function filterPossibilities(possibilities, known) {
        return possibilities.filter(p => {
            for (let i = 0; i < known.length; i++) {
                if (known[i] === 1 && !p[i]) return false;
                if (known[i] === -1 && p[i]) return false;
            }
            return true;
        });
    }

    function intersect(possibilities, length) {
        const result = Array(length).fill(0);
        if (possibilities.length === 0) return null;
        for (let i = 0; i < length; i++) {
            const allFilled = possibilities.every(p => p[i]);
            const allEmpty = possibilities.every(p => !p[i]);
            if (allFilled) result[i] = 1;
            else if (allEmpty) result[i] = -1;
        }
        return result;
    }

    // Pre-compute all possibilities
    let rowPoss = rowClues.map(clue => getLinePossibilities(clue, size));
    let colPoss = colClues.map(clue => getLinePossibilities(clue, size));

    let changed = true;
    let iterations = 0;
    while (changed && iterations < 100) {
        changed = false;
        iterations++;

        // Process rows
        for (let r = 0; r < size; r++) {
            const known = state[r];
            rowPoss[r] = filterPossibilities(rowPoss[r], known);
            if (rowPoss[r].length === 0) return false;
            const result = intersect(rowPoss[r], size);
            if (!result) return false;
            for (let c = 0; c < size; c++) {
                if (state[r][c] === 0 && result[c] !== 0) {
                    state[r][c] = result[c];
                    changed = true;
                }
            }
        }

        // Process columns
        for (let c = 0; c < size; c++) {
            const known = state.map(row => row[c]);
            colPoss[c] = filterPossibilities(colPoss[c], known);
            if (colPoss[c].length === 0) return false;
            const result = intersect(colPoss[c], size);
            if (!result) return false;
            for (let r = 0; r < size; r++) {
                if (state[r][c] === 0 && result[r] !== 0) {
                    state[r][c] = result[r];
                    changed = true;
                }
            }
        }
    }

    // Check if fully solved
    for (let r = 0; r < size; r++)
        for (let c = 0; c < size; c++)
            if (state[r][c] === 0) return false; // Not uniquely determined

    return true;
}

function picrossRenderGrid() {
    const size = picrossSize;
    const maxRowClueLen = Math.max(...picrossRowClues.map(c => c.length));
    const maxColClueLen = Math.max(...picrossColClues.map(c => c.length));

    const colCluesHead = document.getElementById('picross-col-clues');
    colCluesHead.innerHTML = '';

    // Column clue rows (one row per clue depth)
    for (let d = 0; d < maxColClueLen; d++) {
        const tr = document.createElement('tr');
        // Empty cell for row clue column
        const spacer = document.createElement('th');
        spacer.className = 'picross-clue-col';
        tr.appendChild(spacer);

        for (let c = 0; c < size; c++) {
            const th = document.createElement('th');
            th.className = 'picross-clue-col';
            const clue = picrossColClues[c];
            const offset = maxColClueLen - clue.length;
            if (d >= offset) {
                th.textContent = clue[d - offset];
            }
            if ((c + 1) % 5 === 0 && c < size - 1) th.classList.add('block-border-right');
            if (picrossIsColComplete(c)) th.classList.add('completed');
            tr.appendChild(th);
        }
        colCluesHead.appendChild(tr);
    }

    const body = document.getElementById('picross-body');
    body.innerHTML = '';

    for (let r = 0; r < size; r++) {
        const tr = document.createElement('tr');

        // Row clue cell
        const clueCell = document.createElement('td');
        clueCell.className = 'picross-clue-row';
        clueCell.textContent = picrossRowClues[r].join(' ');
        if ((r + 1) % 5 === 0 && r < size - 1) clueCell.classList.add('block-border-bottom');
        if (picrossIsRowComplete(r)) clueCell.classList.add('completed');
        tr.appendChild(clueCell);

        for (let c = 0; c < size; c++) {
            const td = document.createElement('td');
            td.className = 'picross-cell';
            td.dataset.row = r;
            td.dataset.col = c;

            const st = picrossBoard[r][c];
            if (st === 'filled') {
                td.classList.add('filled');
                if (picrossLocked[r][c]) td.classList.add('hinted');
            } else if (st === 'crossed') {
                td.classList.add('crossed');
                td.textContent = '✕';
            } else if (st === 'draft-filled') {
                td.classList.add('draft-filled');
            } else if (st === 'draft-crossed') {
                td.classList.add('draft-crossed');
                td.textContent = '✕';
            }

            if (picrossLocked[r][c]) td.classList.add('locked');
            if ((c + 1) % 5 === 0 && c < size - 1) td.classList.add('block-border-right');
            if ((r + 1) % 5 === 0 && r < size - 1) td.classList.add('block-border-bottom');

            tr.appendChild(td);
        }
        body.appendChild(tr);
    }

    picrossSetupPointerHandlers();
}

// ===== Picross Undo System =====

function picrossSaveState() {
    picrossUndoStack.push({
        board: picrossBoard.map(r => [...r]),
        gameOver: picrossGameOver,
    });
    updatePicrossUndoBtn();
}

function picrossUndo() {
    if (picrossUndoStack.length === 0) return;
    const snapshot = picrossUndoStack.pop();
    picrossBoard = snapshot.board;
    picrossGameOver = snapshot.gameOver;
    if (!picrossGameOver) {
        const msgEl = document.getElementById('picross-message');
        msgEl.className = 'hidden';
        msgEl.textContent = '';
    }
    picrossRenderGrid();
    updatePicrossUndoBtn();
}

function updatePicrossUndoBtn() {
    const btn = document.getElementById('picross-undo-btn');
    if (btn) btn.disabled = picrossUndoStack.length === 0;
}

function picrossSetupPointerHandlers() {
    const table = document.getElementById('picross-table');

    // Prevent context menu on the grid
    table.addEventListener('contextmenu', (e) => e.preventDefault());

    table.addEventListener('pointerdown', (e) => {
        const cell = e.target.closest('.picross-cell');
        if (!cell) return;
        e.preventDefault();
        const r = parseInt(cell.dataset.row);
        const c = parseInt(cell.dataset.col);
        picrossPointerIsRight = (e.button === 2);
        picrossDragging = false;
        picrossDragAction = null;
        picrossDragVisited = new Set();
        picrossPointerDown = { r, c };
        table.setPointerCapture(e.pointerId);
    });

    table.addEventListener('pointermove', (e) => {
        if (!picrossPointerDown || picrossGameOver) return;
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const cell = el && el.closest('.picross-cell');
        if (!cell) return;
        const r = parseInt(cell.dataset.row);
        const c = parseInt(cell.dataset.col);

        if (r === picrossPointerDown.r && c === picrossPointerDown.c && !picrossDragging) return;

        if (!picrossDragging) {
            // Start dragging: determine the action from the first cell
            picrossDragging = true;
            picrossSaveState();
            picrossDragAction = picrossResolveDragAction(picrossPointerDown.r, picrossPointerDown.c, picrossPointerIsRight);
            picrossApplyDragCell(picrossPointerDown.r, picrossPointerDown.c);
        }
        picrossApplyDragCell(r, c);
    });

    table.addEventListener('pointerup', (e) => {
        const wasDragging = picrossDragging;
        const downCell = picrossPointerDown;
        picrossDragging = false;
        picrossDragAction = null;
        picrossDragVisited = new Set();
        picrossPointerDown = null;

        if (wasDragging) {
            // Drag ended — update clues & check win
            picrossRefreshClues();
            picrossCheckWin();
            return;
        }

        // Simple click (no drag)
        if (downCell) {
            const effectiveRight = picrossPointerIsRight || picrossCrossMode;
            picrossHandleClick(downCell.r, downCell.c, effectiveRight);
        }
    });

    table.addEventListener('pointercancel', () => {
        picrossDragging = false;
        picrossDragAction = null;
        picrossDragVisited = new Set();
        picrossPointerDown = null;
    });
}

function picrossResolveDragAction(r, c, isRightClick) {
    const effectiveRight = isRightClick || picrossCrossMode;
    const st = picrossBoard[r][c];
    if (picrossDraftMode) {
        if (effectiveRight) {
            return (st === 'draft-crossed') ? 'uncross' : 'cross';
        }
        return (st === 'draft-filled') ? 'unfill' : 'fill';
    }
    if (effectiveRight) {
        return (st === 'crossed') ? 'uncross' : 'cross';
    }
    return (st === 'filled') ? 'unfill' : 'fill';
}

function picrossApplyDragCell(r, c) {
    const key = `${r},${c}`;
    if (picrossDragVisited.has(key)) return;
    picrossDragVisited.add(key);
    if (picrossGameOver || picrossLocked[r][c]) return;

    const st = picrossBoard[r][c];

    if (picrossDraftMode) {
        if (picrossDragAction === 'fill' && st !== 'draft-filled') {
            picrossBoard[r][c] = 'draft-filled';
        } else if (picrossDragAction === 'unfill' && (st === 'draft-filled')) {
            picrossBoard[r][c] = 'empty';
        } else if (picrossDragAction === 'cross' && st !== 'draft-crossed') {
            picrossBoard[r][c] = 'draft-crossed';
        } else if (picrossDragAction === 'uncross' && (st === 'draft-crossed')) {
            picrossBoard[r][c] = 'empty';
        } else {
            return;
        }
    } else {
        if (picrossDragAction === 'fill' && st !== 'filled') {
            picrossBoard[r][c] = 'filled';
        } else if (picrossDragAction === 'unfill' && st === 'filled') {
            picrossBoard[r][c] = 'empty';
        } else if (picrossDragAction === 'cross' && st !== 'crossed') {
            picrossBoard[r][c] = 'crossed';
        } else if (picrossDragAction === 'uncross' && st === 'crossed') {
            picrossBoard[r][c] = 'empty';
        } else {
            return;
        }
    }

    picrossUpdateCellAppearance(r, c);
}

function picrossUpdateCellAppearance(r, c) {
    const td = document.querySelector(`#picross-body .picross-cell[data-row="${r}"][data-col="${c}"]`);
    if (!td) return;
    const st = picrossBoard[r][c];

    td.classList.remove('filled', 'crossed', 'draft-filled', 'draft-crossed', 'hinted');
    td.textContent = '';

    if (st === 'filled') {
        td.classList.add('filled');
        if (picrossLocked[r][c]) td.classList.add('hinted');
    } else if (st === 'crossed') {
        td.classList.add('crossed');
        td.textContent = '✕';
    } else if (st === 'draft-filled') {
        td.classList.add('draft-filled');
    } else if (st === 'draft-crossed') {
        td.classList.add('draft-crossed');
        td.textContent = '✕';
    }
}

function picrossRefreshClues() {
    // Update row clue completion
    document.querySelectorAll('#picross-body .picross-clue-row').forEach((el, r) => {
        el.classList.toggle('completed', picrossIsRowComplete(r));
    });
    // Update col clue completion across all header rows
    const headerRows = document.querySelectorAll('#picross-col-clues tr');
    headerRows.forEach(tr => {
        const cells = tr.querySelectorAll('th');
        // First th is the spacer, rest are columns 0..size-1
        for (let i = 1; i < cells.length; i++) {
            cells[i].classList.toggle('completed', picrossIsColComplete(i - 1));
        }
    });
}

function picrossHandleClick(r, c, isRightClick) {
    if (picrossGameOver) return;
    if (picrossLocked[r][c]) return;

    picrossSaveState();

    const st = picrossBoard[r][c];

    if (picrossDraftMode) {
        if (isRightClick) {
            if (st === 'draft-crossed') picrossBoard[r][c] = 'empty';
            else picrossBoard[r][c] = 'draft-crossed';
        } else {
            if (st === 'draft-filled') picrossBoard[r][c] = 'empty';
            else picrossBoard[r][c] = 'draft-filled';
        }
    } else {
        if (isRightClick) {
            if (st === 'crossed') picrossBoard[r][c] = 'empty';
            else if (st === 'empty' || st === 'draft-filled' || st === 'draft-crossed') picrossBoard[r][c] = 'crossed';
        } else {
            if (st === 'filled') picrossBoard[r][c] = 'empty';
            else if (st === 'empty' || st === 'draft-filled' || st === 'draft-crossed' || st === 'crossed') picrossBoard[r][c] = 'filled';
        }
    }

    picrossUpdateCellAppearance(r, c);
    picrossRefreshClues();
    picrossCheckWin();
}

function picrossIsRowComplete(r) {
    const line = [];
    for (let c = 0; c < picrossSize; c++) {
        const st = picrossBoard[r][c];
        line.push(st === 'filled');
    }
    const clue = picrossComputeClue(line);
    return JSON.stringify(clue) === JSON.stringify(picrossRowClues[r]);
}

function picrossIsColComplete(c) {
    const line = [];
    for (let r = 0; r < picrossSize; r++) {
        const st = picrossBoard[r][c];
        line.push(st === 'filled');
    }
    const clue = picrossComputeClue(line);
    return JSON.stringify(clue) === JSON.stringify(picrossColClues[c]);
}

function picrossCheckWin() {
    // Check if all cells match the solution
    for (let r = 0; r < picrossSize; r++) {
        for (let c = 0; c < picrossSize; c++) {
            const isFilled = picrossBoard[r][c] === 'filled';
            if (isFilled !== picrossSolution[r][c]) return;
        }
    }

    picrossGameOver = true;
    const msg = PICROSS_VICTORY_MESSAGES[Math.floor(Math.random() * PICROSS_VICTORY_MESSAGES.length)];
    const msgEl = document.getElementById('picross-message');
    msgEl.className = 'win';
    msgEl.textContent = msg;

    // Spawn confetti in picross container
    const container = document.getElementById('picross-grid-container');
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

function picrossUseHint() {
    if (picrossGameOver) return;
    const candidates = [];
    for (let r = 0; r < picrossSize; r++)
        for (let c = 0; c < picrossSize; c++)
            if (!picrossLocked[r][c] && (picrossBoard[r][c] !== 'filled' || !picrossSolution[r][c]))
                if (picrossSolution[r][c] && picrossBoard[r][c] !== 'filled')
                    candidates.push({ r, c });

    if (candidates.length === 0) return;
    picrossSaveState();
    shuffle(candidates);
    const { r, c } = candidates[0];
    picrossBoard[r][c] = 'filled';
    picrossLocked[r][c] = true;
    picrossRenderGrid();
    picrossCheckWin();
}

const PICROSS_VICTORY_MESSAGES = [
    "🎉 Bravo Jeanne ! Ce picross est un chef-d'œuvre grâce à toi !",
    "🖼️ Jeanne révèle des images cachées — comme elle révèle le meilleur chez les autres !",
    "🌟 Pixel par pixel, Jeanne construit la perfection !",
    "💛 Olivier est ébloui : Jeanne domine même les nonogrammes !",
    "🧩 Chaque case noircie est une pièce du puzzle de ton génie, Jeanne !",
    "🎊 Arthur, Victoire, Martin et Antoine : maman est une artiste du picross !",
    "✨ Là où les autres voient des chiffres, Jeanne voit des images. Quelle vision !",
    "🌸 Patience et précision — les qualités de Jeanne brillent encore dans ce picross !",
    "🏆 Médaille d'or de la logique visuelle décernée à Jeanne de Clisson !",
    "💫 Des indices à l'image finale : Jeanne a tout déchiffré avec brio !",
    "🕊️ Jeanne résout les picross comme elle guide les élèves : avec clarté et douceur !",
    "🥰 Olivier t'aime, et ce picross résolu rend ça encore plus grand — si c'était possible !",
    "🎯 Case par case, ligne par ligne : Jeanne ne laisse rien au hasard !",
    "🌺 Aussi méticuleuse au picross qu'à la pastorale — c'est la magie de Jeanne !",
    "💝 Les pixels t'obéissent, les enfants t'adorent, le mari t'admire. Perfection !",
    "🎈 Picross terminé ! Jeanne fait exploser les records de fierté d'Olivier !",
    "🌈 Tu fais apparaître des images cachées comme tu fais apparaître la joie autour de toi !",
    "🦋 Œil de lynx et cœur tendre — Jeanne face au picross !",
    "💐 Pour chaque case bien remplie, un pétale de plus dans le bouquet de Jeanne !",
    "🎶 Jeanne peint au picross comme Mozart composait : avec une aisance naturelle !",
    "🤗 Les élèves de Clisson seraient fiers de voir leur responsable pastorale en action !",
    "🌻 Image révélée, sourire garanti : c'est l'effet Jeanne sur le picross !",
    "🥂 Trinquons à l'artiste logicienne la plus brillante de Clisson !",
    "💡 Là où certains voient des grilles vides, Jeanne voit des œuvres d'art !",
    "🌙 Jeanne, tu es aussi créative que méthodique — une combinaison rare !",
    "🎁 Ce picross résolu est un tableau que tu t'offres à toi-même, Jeanne !",
    "🦁 Féroce sur la grille, douce dans la vie — c'est notre Jeanne !",
    "🎗️ Des indices aux pixels, chaque étape porte la signature de Jeanne !",
    "🏅 Si le picross était un art, Jeanne serait exposée au Louvre !",
    "✝️ Patience, observation et persévérance — les vertus de Jeanne au quotidien !",
    "😄 Martin parie déjà que tu vas enchaîner avec une grille plus dure. Il a raison ?",
    "🌿 La sérénité de Jeanne face à une grille complexe est un spectacle apaisant !",
    "💞 Derrière ces pixels, il y a une femme extraordinaire. Bravo Jeanne !",
    "🎪 Le plus beau tour ? Jeanne qui transforme des chiffres en image !",
    "🌊 Aussi fluide qu'une vague, aussi précise qu'un pinceau — Jeanne au picross !",
    "📿 Jeanne, ta patience est infinie — ces grilles en sont la preuve !",
    "🍀 Ce n'est pas de la chance, c'est du talent pur. Bravo Jeanne !",
    "💪 4 enfants, 1 pastorale, 1 picross : Jeanne gère tout sans sourciller !",
    "🕯️ Chaque case posée par Jeanne est une petite lumière dans l'image !",
    "🦅 Vue d'ensemble et sens du détail — Jeanne maîtrise les deux comme personne !",
    "🎠 La vie à Clisson est un joli tableau, et Jeanne en est l'artiste !",
    "🌅 Ce picross terminé révèle le plus beau paysage — celui de la victoire !",
    "💬 Olivier murmure : bravo ma Jeanne, tu es décidément imbattable !",
    "🤍 Chaque pixel est une déclaration d'amour à la logique signée Jeanne !",
    "🎀 Élégante jusque dans sa façon de résoudre un picross — c'est tout Jeanne !",
    "🌸 Victoire serait fière de porter si bien son prénom grâce à sa maman !",
    "🙌 Incroyable : Jeanne a encore vaincu ! Le picross n'avait aucune chance !",
    "💖 Grille parfaite, famille parfaite, femme parfaite — tout est dit !",
    "🎵 Si chaque case était une note, Jeanne viendrait de peindre une symphonie !",
    "🌟 Clisson peut dormir tranquille : Jeanne veille sur les élèves ET sur les picross !",
];

init();
