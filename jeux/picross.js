// ===== Picross Game =====

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// ===== Picross Module =====

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

    // Verify button
    document.getElementById('picross-verify-btn').addEventListener('click', picrossVerify);

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
                th.dataset.col = c;
                th.dataset.clueIdx = d - offset;
            }
            if ((c + 1) % 5 === 0 && c < size - 1) th.classList.add('block-border-right');
            tr.appendChild(th);
        }
        colCluesHead.appendChild(tr);
    }

    const body = document.getElementById('picross-body');
    body.innerHTML = '';

    for (let r = 0; r < size; r++) {
        const tr = document.createElement('tr');

        // Row clue cell — use individual spans per number
        const clueCell = document.createElement('td');
        clueCell.className = 'picross-clue-row';
        clueCell.dataset.row = r;
        picrossRowClues[r].forEach((num, idx) => {
            const span = document.createElement('span');
            span.className = 'picross-clue-num';
            span.dataset.clueIdx = idx;
            span.textContent = num;
            clueCell.appendChild(span);
            if (idx < picrossRowClues[r].length - 1) {
                clueCell.appendChild(document.createTextNode(' '));
            }
        });
        if ((r + 1) % 5 === 0 && r < size - 1) clueCell.classList.add('block-border-bottom');
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
    picrossRefreshClues();
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

    // Double-click on clue to fill crosses on completed row/col
    table.addEventListener('dblclick', (e) => {
        const rowClue = e.target.closest('.picross-clue-row');
        if (rowClue && rowClue.dataset.row !== undefined) {
            picrossFillCrossesRow(parseInt(rowClue.dataset.row));
            return;
        }
        const colClue = e.target.closest('.picross-clue-col');
        if (colClue && colClue.dataset.col !== undefined) {
            picrossFillCrossesCol(parseInt(colClue.dataset.col));
            return;
        }
    });

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
    // Row clues: per-span coloring
    document.querySelectorAll('#picross-body .picross-clue-row').forEach((el, r) => {
        const complete = picrossIsRowComplete(r);
        el.classList.toggle('completed', complete);
        const matchedCount = complete ? picrossRowClues[r].length : picrossMatchedClueCount(picrossGetRowLine(r), picrossRowClues[r]);
        el.querySelectorAll('.picross-clue-num').forEach(span => {
            const idx = parseInt(span.dataset.clueIdx);
            span.classList.toggle('clue-complete', complete);
            span.classList.toggle('clue-matched', !complete && idx < matchedCount);
        });
    });
    // Col clues: per-th coloring
    const colMatched = [];
    const colComplete = [];
    for (let c = 0; c < picrossSize; c++) {
        const complete = picrossIsColComplete(c);
        colComplete[c] = complete;
        colMatched[c] = complete ? picrossColClues[c].length : picrossMatchedClueCount(picrossGetColLine(c), picrossColClues[c]);
    }
    const headerRows = document.querySelectorAll('#picross-col-clues tr');
    headerRows.forEach(tr => {
        const cells = tr.querySelectorAll('th');
        for (let i = 1; i < cells.length; i++) {
            const th = cells[i];
            if (th.dataset.col === undefined) continue;
            const c = parseInt(th.dataset.col);
            const idx = parseInt(th.dataset.clueIdx);
            if (isNaN(idx)) continue;
            th.classList.toggle('clue-complete', colComplete[c]);
            th.classList.toggle('clue-matched', !colComplete[c] && idx < colMatched[c]);
        }
    });
}

// Returns how many clue groups (from the start) are confirmed by filled cells from the left/top.
// A group is confirmed when there's a filled block of the exact size followed by an empty/crossed cell (or end of line for the last group).
function picrossMatchedClueCount(line, clues) {
    if (clues.length === 1 && clues[0] === 0) return line.every(v => !v) ? 1 : 0;
    let pos = 0;
    for (let g = 0; g < clues.length; g++) {
        const groupSize = clues[g];
        // Skip non-filled cells at the start
        while (pos < line.length && !line[pos]) pos++;
        // Check if there's a filled block of exactly groupSize
        if (pos >= line.length) return g; // ran out of cells, no more groups
        let count = 0;
        const blockStart = pos;
        while (pos < line.length && line[pos]) { count++; pos++; }
        // The filled block must be exactly groupSize
        if (count !== groupSize) return g;
        // After the block, there must be a gap (non-filled) or end of line
        // If not last group, need at least one non-filled cell
        if (g < clues.length - 1) {
            if (pos < line.length && line[pos]) return g; // no gap → not confirmed
        }
    }
    return clues.length;
}

function picrossGetRowLine(r) {
    const line = [];
    for (let c = 0; c < picrossSize; c++) {
        line.push(picrossBoard[r][c] === 'filled');
    }
    return line;
}

function picrossGetColLine(c) {
    const line = [];
    for (let r = 0; r < picrossSize; r++) {
        line.push(picrossBoard[r][c] === 'filled');
    }
    return line;
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

function picrossVerify() {
    if (picrossGameOver) return;
    let hasError = false;
    for (let r = 0; r < picrossSize; r++) {
        for (let c = 0; c < picrossSize; c++) {
            const st = picrossBoard[r][c];
            const shouldBeFilled = picrossSolution[r][c];
            // Error: filled but shouldn't be, or crossed but should be filled
            const isWrong = (st === 'filled' && !shouldBeFilled) || (st === 'crossed' && shouldBeFilled);
            if (isWrong) {
                hasError = true;
                const td = document.querySelector(`#picross-body .picross-cell[data-row="${r}"][data-col="${c}"]`);
                if (td) {
                    td.classList.add('picross-verify-error');
                    setTimeout(() => td.classList.remove('picross-verify-error'), 3000);
                }
            }
        }
    }
    if (!hasError) {
        const msgEl = document.getElementById('picross-message');
        msgEl.className = 'hint';
        msgEl.textContent = '✅ Tout est correct pour le moment !';
        setTimeout(() => {
            if (!picrossGameOver) {
                msgEl.className = 'hidden';
                msgEl.textContent = '';
            }
        }, 2500);
    }
}

function picrossFillCrossesRow(r) {
    if (picrossGameOver) return;
    if (!picrossIsRowComplete(r)) return;
    picrossSaveState();
    for (let c = 0; c < picrossSize; c++) {
        if (picrossBoard[r][c] === 'empty' || picrossBoard[r][c] === 'draft-filled' || picrossBoard[r][c] === 'draft-crossed') {
            picrossBoard[r][c] = 'crossed';
            picrossUpdateCellAppearance(r, c);
        }
    }
    picrossRefreshClues();
}

function picrossFillCrossesCol(c) {
    if (picrossGameOver) return;
    if (!picrossIsColComplete(c)) return;
    picrossSaveState();
    for (let r = 0; r < picrossSize; r++) {
        if (picrossBoard[r][c] === 'empty' || picrossBoard[r][c] === 'draft-filled' || picrossBoard[r][c] === 'draft-crossed') {
            picrossBoard[r][c] = 'crossed';
            picrossUpdateCellAppearance(r, c);
        }
    }
    picrossRefreshClues();
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
    "🏆 Médaille d'or de la logique visuelle décernée à Jeanne, super maman !",
    "💫 Des indices à l'image finale : Jeanne a tout déchiffré avec brio !",
    "🕊️ Jeanne résout les picross comme elle guide ses enfants : avec clarté et douceur !",
    "🥰 Olivier t'aime, et ce picross résolu rend ça encore plus grand — si c'était possible !",
    "🎯 Case par case, ligne par ligne : Jeanne ne laisse rien au hasard !",
    "🌺 Aussi méticuleuse au picross qu'avec ses enfants — c'est la magie de Jeanne !",
    "💝 Les pixels t'obéissent, les enfants t'adorent, le mari t'admire. Perfection !",
    "🎈 Picross terminé ! Jeanne fait exploser les records de fierté d'Olivier !",
    "🌈 Tu fais apparaître des images cachées comme tu fais apparaître la joie autour de toi !",
    "🦋 Œil de lynx et cœur tendre — Jeanne face au picross !",
    "💐 Pour chaque case bien remplie, un pétale de plus dans le bouquet de Jeanne !",
    "🎶 Jeanne peint au picross comme Mozart composait : avec une aisance naturelle !",
    "🤗 Toute la famille serait fière de voir maman en pleine action !",
    "🌻 Image révélée, sourire garanti : c'est l'effet Jeanne sur le picross !",
    "🥂 Trinquons à l'artiste logicienne la plus brillante de la famille !",
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
    "💪 4 enfants, 1 mari amoureux, 1 picross : Jeanne gère tout sans sourciller !",
    "🕯️ Chaque case posée par Jeanne est une petite lumière dans l'image !",
    "🦅 Vue d'ensemble et sens du détail — Jeanne maîtrise les deux comme personne !",
    "🎠 La vie de famille est un joli tableau, et Jeanne en est l'artiste !",
    "🌅 Ce picross terminé révèle le plus beau paysage — celui de la victoire !",
    "💬 Olivier murmure : bravo ma Jeanne, tu es décidément imbattable !",
    "🤍 Chaque pixel est une déclaration d'amour à la logique signée Jeanne !",
    "🎀 Élégante jusque dans sa façon de résoudre un picross — c'est tout Jeanne !",
    "🌸 Victoire serait fière de porter si bien son prénom grâce à sa maman !",
    "🙌 Incroyable : Jeanne a encore vaincu ! Le picross n'avait aucune chance !",
    "💖 Grille parfaite, famille parfaite, femme parfaite — tout est dit !",
    "🎵 Si chaque case était une note, Jeanne viendrait de peindre une symphonie !",
    "🌟 Toute la maison peut dormir tranquille : Jeanne veille sur tout le monde ET sur les picross !",
];

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

picrossInit();
