const express = require('express');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const app = express();
const PORT = 8765;

// --- Database setup ---
const dbPath = path.join(__dirname, 'scores.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

const VALID_TYPES = ['multiplication', 'addition', 'soustraction', 'division', 'complement', 'mixte', 'comparaison', 'conjugaison', 'homophone', 'pluriel', 'feminin-masculin', 'vocabulaire', 'orthographe'];

db.exec(`
    CREATE TABLE IF NOT EXISTS scores_v2 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        mode TEXT NOT NULL CHECK(mode IN ('100', 'timer')),
        level TEXT NOT NULL CHECK(level IN ('easy', 'medium', 'hard')),
        score_value REAL NOT NULL,
        correct INTEGER NOT NULL,
        wrong INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
`);

// Migrate old scores table if it exists
try {
    const oldExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='scores'").get();
    if (oldExists) {
        db.exec(`
            INSERT OR IGNORE INTO scores_v2 (name, type, mode, level, score_value, correct, wrong, created_at)
            SELECT name, 'multiplication', mode, level, score_value, correct, wrong, created_at FROM scores
        `);
        db.exec(`DROP TABLE IF EXISTS scores`);
    }
} catch (e) { /* ignore migration errors */ }

// Prepared statements
const insertScore = db.prepare(`
    INSERT INTO scores_v2 (name, type, mode, level, score_value, correct, wrong)
    VALUES (@name, @type, @mode, @level, @score_value, @correct, @wrong)
`);

const getScores100 = db.prepare(`
    SELECT name, score_value, correct, wrong, created_at
    FROM scores_v2
    WHERE type = @type AND mode = '100' AND level = @level
    ORDER BY score_value ASC
    LIMIT 20
`);

const getScoresTimer = db.prepare(`
    SELECT name, score_value, correct, wrong, created_at
    FROM scores_v2
    WHERE type = @type AND mode = 'timer' AND level = @level
    ORDER BY score_value DESC
    LIMIT 20
`);

// --- Middleware ---
app.use(express.json());

// --- API routes ---
app.post('/api/scores', (req, res) => {
    const { name, type, mode, level, score_value, correct, wrong } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 30) {
        return res.status(400).json({ error: 'Le prénom doit faire entre 1 et 30 caractères.' });
    }
    if (!VALID_TYPES.includes(type)) {
        return res.status(400).json({ error: 'Type invalide.' });
    }
    if (!['100', 'timer'].includes(mode)) {
        return res.status(400).json({ error: 'Mode invalide.' });
    }
    if (!['easy', 'medium', 'hard'].includes(level)) {
        return res.status(400).json({ error: 'Niveau invalide.' });
    }
    if (typeof score_value !== 'number' || score_value < 0) {
        return res.status(400).json({ error: 'Score invalide.' });
    }
    if (!Number.isInteger(correct) || correct < 0 || !Number.isInteger(wrong) || wrong < 0) {
        return res.status(400).json({ error: 'Valeurs correctes/incorrectes invalides.' });
    }

    const sanitizedName = name.trim().substring(0, 30);

    try {
        insertScore.run({ name: sanitizedName, type, mode, level, score_value, correct, wrong });
        res.json({ ok: true });
    } catch (err) {
        console.error('Error inserting score:', err);
        res.status(500).json({ error: 'Erreur serveur.' });
    }
});

app.get('/api/scores', (req, res) => {
    const { type, mode, level } = req.query;

    if (!VALID_TYPES.includes(type)) {
        return res.status(400).json({ error: 'Type invalide.' });
    }
    if (!['100', 'timer'].includes(mode)) {
        return res.status(400).json({ error: 'Mode invalide.' });
    }
    if (!['easy', 'medium', 'hard'].includes(level)) {
        return res.status(400).json({ error: 'Niveau invalide.' });
    }

    try {
        const rows = mode === '100'
            ? getScores100.all({ type, level })
            : getScoresTimer.all({ type, level });
        res.json(rows);
    } catch (err) {
        console.error('Error fetching scores:', err);
        res.status(500).json({ error: 'Erreur serveur.' });
    }
});

// --- Static files ---
app.use(express.static(__dirname, { extensions: ['html'] }));

// --- Fallback routes for /math/* ---
const mathSubPages = ['multiplications', 'additions', 'soustractions', 'divisions', 'divisions-posees', 'complements', 'mixte', 'comparaisons'];
mathSubPages.forEach(page => {
    app.get(`/math/${page}`, (req, res) => {
        res.sendFile(path.join(__dirname, 'math', page, 'index.html'));
    });
});

app.get('/math', (req, res) => {
    res.sendFile(path.join(__dirname, 'math', 'index.html'));
});

// --- Fallback routes for /francais/* ---
const francaisSubPages = ['conjugaison', 'homophones', 'pluriels', 'feminin-masculin', 'vocabulaire', 'orthographe'];
francaisSubPages.forEach(page => {
    app.get(`/francais/${page}`, (req, res) => {
        res.sendFile(path.join(__dirname, 'francais', page, 'index.html'));
    });
});

app.get('/francais', (req, res) => {
    res.sendFile(path.join(__dirname, 'francais', 'index.html'));
});

// --- SSL support ---
const certPath = path.join(__dirname, 'cert.pem');
const keyPath = path.join(__dirname, 'key.pem');

if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    const https = require('https');
    const options = {
        cert: fs.readFileSync(certPath),
        key: fs.readFileSync(keyPath),
    };
    https.createServer(options, app).listen(PORT, () => {
        console.log(`Server running at https://localhost:${PORT}`);
    });
} else {
    app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
    });
}
