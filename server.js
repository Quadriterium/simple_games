require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const session = require('express-session');
const ConnectSqlite3 = require('connect-sqlite3')(session);

const app = express();
const PORT = 8765;
const APP_ORIGIN = process.env.APP_ORIGIN;

// --- Database setup ---
const dbPath = path.join(__dirname, 'scores.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const PLAYER_NAME_REGEX = /^[a-zA-Z0-9À-ÿ _-]+$/;

const VALID_TYPES = ['multiplication', 'addition', 'soustraction', 'division', 'complement', 'mixte', 'comparaison', 'conjugaison', 'homophone', 'pluriel', 'feminin-masculin', 'vocabulaire', 'orthographe'];

const CONTENT_TYPES = {
    'conjugaison': 'conjugaison',
    'homophone': 'homophones',
    'pluriel': 'pluriels',
    'feminin-masculin': 'feminin-masculin',
    'vocabulaire': 'vocabulaire',
    'orthographe': 'orthographe',
};

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

// --- Admin tables ---
db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('superadmin', 'admin')) DEFAULT 'admin',
        is_root INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS admin_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS admin_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        action TEXT NOT NULL,
        details TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS banned_names (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE COLLATE NOCASE,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
`);

// --- Users table ---
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS user_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
`);

db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_user_name
    ON user_profiles(user_id, name COLLATE NOCASE)
`);

db.exec(`
    CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id
    ON user_profiles(user_id)
`);

// --- Add user_id column to scores_v2 if missing ---
try {
    db.exec(`ALTER TABLE scores_v2 ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL`);
} catch (e) { /* column already exists */ }

try {
    db.exec(`ALTER TABLE scores_v2 ADD COLUMN profile_id INTEGER REFERENCES user_profiles(id) ON DELETE SET NULL`);
} catch (e) { /* column already exists */ }

db.exec(`
    CREATE INDEX IF NOT EXISTS idx_scores_v2_user_id
    ON scores_v2(user_id)
`);

db.exec(`
    CREATE INDEX IF NOT EXISTS idx_scores_v2_profile_id
    ON scores_v2(profile_id)
`);

// --- Seed root admin account ---
const ROOT_ADMIN_USER = process.env.ROOT_ADMIN_USER;
const ROOT_ADMIN_PASS = process.env.ROOT_ADMIN_PASS;
if (!ROOT_ADMIN_USER || !ROOT_ADMIN_PASS) {
    console.error('ERREUR : ROOT_ADMIN_USER et ROOT_ADMIN_PASS doivent être définis dans le fichier .env');
    process.exit(1);
}
const rootAdmin = db.prepare('SELECT id FROM admins WHERE is_root = 1').get();
if (!rootAdmin) {
    const hash = bcrypt.hashSync(ROOT_ADMIN_PASS, 12);
    db.prepare("INSERT INTO admins (username, password_hash, role, is_root) VALUES (?, ?, 'superadmin', 1)").run(ROOT_ADMIN_USER, hash);
    console.log(`Compte root admin "${ROOT_ADMIN_USER}" créé.`);
}

// --- Default settings ---
const defaultSettings = {
    challenges_disabled: '[]',
    submissions_blocked: 'false',
    announcement: '',
};
const upsertSetting = db.prepare("INSERT OR IGNORE INTO admin_settings (key, value) VALUES (?, ?)");
for (const [key, value] of Object.entries(defaultSettings)) {
    upsertSetting.run(key, value);
}

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
const insertUser = db.prepare(`
    INSERT INTO users (username, email, password_hash)
    VALUES (?, ?, ?)
`);

const getUserById = db.prepare(`
    SELECT * FROM users WHERE id = ?
`);

const getUserByEmail = db.prepare(`
    SELECT * FROM users WHERE email = ? COLLATE NOCASE
`);

const insertUserProfile = db.prepare(`
    INSERT INTO user_profiles (user_id, name)
    VALUES (?, ?)
`);

const listUserProfiles = db.prepare(`
    SELECT id, name, created_at
    FROM user_profiles
    WHERE user_id = ?
    ORDER BY name COLLATE NOCASE ASC, id ASC
`);

const getFirstUserProfile = db.prepare(`
    SELECT id, user_id, name, created_at
    FROM user_profiles
    WHERE user_id = ?
    ORDER BY id ASC
    LIMIT 1
`);

const getOwnedUserProfile = db.prepare(`
    SELECT id, user_id, name, created_at
    FROM user_profiles
    WHERE user_id = ? AND id = ?
`);

const findUserProfileByName = db.prepare(`
    SELECT id FROM user_profiles
    WHERE user_id = ? AND name = ? COLLATE NOCASE
`);

const findUserProfileByNameExcludingId = db.prepare(`
    SELECT id FROM user_profiles
    WHERE user_id = ? AND name = ? COLLATE NOCASE AND id != ?
`);

const updateUserProfileName = db.prepare(`
    UPDATE user_profiles
    SET name = ?
    WHERE id = ?
`);

const updateScoresProfileName = db.prepare(`
    UPDATE scores_v2
    SET name = ?
    WHERE profile_id = ?
`);

const attachMissingScoresToProfile = db.prepare(`
    UPDATE scores_v2
    SET profile_id = ?
    WHERE user_id = ? AND profile_id IS NULL
`);

const getBannedName = db.prepare(`
    SELECT id FROM banned_names WHERE name = ? COLLATE NOCASE
`);

const insertScore = db.prepare(`
    INSERT INTO scores_v2 (name, type, mode, level, score_value, correct, wrong, user_id, profile_id)
    VALUES (@name, @type, @mode, @level, @score_value, @correct, @wrong, @user_id, @profile_id)
`);

const getScores100 = db.prepare(`
    SELECT name, score_value, correct, wrong, created_at,
           CASE WHEN @sessionUserId IS NOT NULL AND user_id = @sessionUserId THEN 1 ELSE 0 END AS isMine
    FROM scores_v2
    WHERE type = @type AND mode = '100' AND level = @level
    ORDER BY score_value ASC
    LIMIT 20
`);

const getScoresTimer = db.prepare(`
    SELECT name, score_value, correct, wrong, created_at,
           CASE WHEN @sessionUserId IS NOT NULL AND user_id = @sessionUserId THEN 1 ELSE 0 END AS isMine
    FROM scores_v2
    WHERE type = @type AND mode = 'timer' AND level = @level
    ORDER BY score_value DESC
    LIMIT 20
`);

function validatePlayerName(value) {
    const sanitized = typeof value === 'string' ? value.trim().substring(0, 20) : '';

    if (!sanitized || sanitized.length < 2 || sanitized.length > 20) {
        return { error: 'Le pseudo doit faire entre 2 et 20 caractères.' };
    }

    if (!PLAYER_NAME_REGEX.test(sanitized)) {
        return { error: 'Le pseudo ne peut contenir que des lettres, chiffres, espaces et tirets.' };
    }

    return { sanitized };
}

function isBannedPlayerName(name) {
    return Boolean(getBannedName.get(name));
}

const ensureUserMainProfile = db.transaction((userId, fallbackName) => {
    let profile = getFirstUserProfile.get(userId);

    if (!profile) {
        const result = insertUserProfile.run(userId, fallbackName);
        profile = getOwnedUserProfile.get(userId, result.lastInsertRowid);
    }

    if (profile) {
        attachMissingScoresToProfile.run(profile.id, userId);
    }

    return profile;
});

function resolveOwnedProfile(userId, rawProfileId, fallbackName) {
    if (rawProfileId === undefined || rawProfileId === null || rawProfileId === '') {
        const profile = ensureUserMainProfile(userId, fallbackName);
        if (!profile) {
            return { status: 400, error: 'Aucun sous-utilisateur disponible.' };
        }
        return { profile };
    }

    const profileId = Number.parseInt(rawProfileId, 10);
    if (!Number.isInteger(profileId) || profileId <= 0) {
        return { status: 400, error: 'Sous-utilisateur invalide.' };
    }

    const profile = getOwnedUserProfile.get(userId, profileId);
    if (!profile) {
        return { status: 404, error: 'Sous-utilisateur introuvable.' };
    }

    return { profile };
}

const createUserWithMainProfile = db.transaction((username, email, passwordHash) => {
    const result = insertUser.run(username, email, passwordHash);
    ensureUserMainProfile(result.lastInsertRowid, username);
    return result.lastInsertRowid;
});

const migrateExistingProfiles = db.transaction(() => {
    const users = db.prepare(`SELECT id, username FROM users ORDER BY id ASC`).all();

    for (const user of users) {
        ensureUserMainProfile(user.id, user.username);
    }
});

migrateExistingProfiles();

// --- Middleware ---
app.use(express.json());
app.disable('x-powered-by');

// Trust reverse proxy (Freebox, nginx, etc.) — needed for secure cookies behind proxy
app.set('trust proxy', 1);

// --- Session setup ---
const SSL_AVAILABLE = fs.existsSync(path.join(__dirname, 'cert.pem')) && fs.existsSync(path.join(__dirname, 'key.pem'));
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
app.use(session({
    store: new ConnectSqlite3({ db: 'sessions.db', dir: __dirname }),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: 'auto',
        maxAge: 24 * 60 * 60 * 1000, // 24h
    },
    name: 'admin.sid',
}));

// --- Auth helpers ---
function requireAdmin(req, res, next) {
    if (!req.session || !req.session.adminId) {
        return res.status(401).json({ error: 'Non authentifié.' });
    }
    next();
}

function requireSuperAdmin(req, res, next) {
    if (!req.session || !req.session.adminId) {
        return res.status(401).json({ error: 'Non authentifié.' });
    }
    if (req.session.role !== 'superadmin') {
        return res.status(403).json({ error: 'Accès réservé aux super-administrateurs.' });
    }
    next();
}

function logAdminAction(username, action, details) {
    db.prepare("INSERT INTO admin_log (username, action, details) VALUES (?, ?, ?)").run(username, action, details || null);
}

function getSetting(key) {
    const row = db.prepare("SELECT value FROM admin_settings WHERE key = ?").get(key);
    return row ? row.value : null;
}

function setSetting(key, value) {
    db.prepare("INSERT OR REPLACE INTO admin_settings (key, value) VALUES (?, ?)").run(key, value);
}

// --- User auth helper ---
function requireUser(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: 'Connexion requise.' });
    }
    next();
}

// --- Rate limiting for auth endpoints ---
const authAttempts = new Map(); // key = IP, value = { count, resetAt }
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 8; // max attempts per window
const ADMIN_RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const ADMIN_RATE_LIMIT_MAX = 5; // stricter for admin login
const adminAuthAttempts = new Map(); // key = IP, value = { count, resetAt }

function checkRateLimit(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const entry = authAttempts.get(ip);
    if (entry && now < entry.resetAt) {
        if (entry.count >= RATE_LIMIT_MAX) {
            return res.status(429).json({ error: 'Trop de tentatives. Réessaie dans une minute.' });
        }
        entry.count++;
    } else {
        authAttempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    }
    next();
}

function checkAdminRateLimit(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const entry = adminAuthAttempts.get(ip);
    if (entry && now < entry.resetAt) {
        if (entry.count >= ADMIN_RATE_LIMIT_MAX) {
            return res.status(429).json({ error: 'Trop de tentatives administrateur. Réessaie dans une minute.' });
        }
        entry.count++;
    } else {
        adminAuthAttempts.set(ip, { count: 1, resetAt: now + ADMIN_RATE_LIMIT_WINDOW });
    }
    next();
}

function regenerateSession(req) {
    return new Promise((resolve, reject) => {
        req.session.regenerate((err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}

// Cleanup old entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of authAttempts) {
        if (now >= entry.resetAt) authAttempts.delete(ip);
    }
    for (const [ip, entry] of adminAuthAttempts) {
        if (now >= entry.resetAt) adminAuthAttempts.delete(ip);
    }
}, 5 * 60 * 1000);

function getExpectedOrigin(req) {
    if (APP_ORIGIN) {
        return APP_ORIGIN;
    }
    const proto = req.get('x-forwarded-proto') || req.protocol;
    return `${proto}://${req.get('host')}`;
}

function extractOrigin(rawValue) {
    if (!rawValue) return null;
    try {
        return new URL(rawValue).origin;
    } catch {
        return null;
    }
}

function enforceApiCsrf(req, res, next) {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        return next();
    }

    if (!req.path.startsWith('/api/')) {
        return next();
    }

    // Public authentication endpoints must remain callable before a session exists.
    const csrfExcluded = new Set(['/api/user/register', '/api/user/login', '/api/admin/login']);
    if (csrfExcluded.has(req.path)) {
        return next();
    }

    const expectedOrigin = getExpectedOrigin(req);
    const origin = req.get('origin');
    const referer = req.get('referer');

    if (origin) {
        const originValue = extractOrigin(origin);
        if (originValue === expectedOrigin) {
            return next();
        }
        return res.status(403).json({ error: 'Requête refusée (origine invalide).' });
    }

    if (referer) {
        const refererOrigin = extractOrigin(referer);
        if (refererOrigin === expectedOrigin) {
            return next();
        }
        return res.status(403).json({ error: 'Requête refusée (referer invalide).' });
    }

    return res.status(403).json({ error: 'Requête refusée (protection CSRF).' });
}

// --- Security: whitelist allowed static files ---
const ALLOWED_EXTENSIONS = new Set(['.html', '.css', '.js', '.png', '.svg']);
const ALLOWED_ROOT_FILES = new Set(['/manifest.json', '/favicon.png', '/sw.js']);

app.use((req, res, next) => {
    // Let API routes through
    if (req.path.startsWith('/api/')) return next();

    // Admin area: require session for all admin files
    if (req.path.startsWith('/admin')) {
        if (req.path === '/admin' || req.path === '/admin/') return next(); // handled by explicit route
        if (!req.session || !req.session.adminId) return res.status(404).send('Not found');
        return next();
    }

    // Allow directory paths (with or without trailing slash — explicit routes handle both)
    if (req.path.endsWith('/') || !path.extname(req.path)) return next();

    const ext = path.extname(req.path).toLowerCase();

    // Allow specific root files
    if (ALLOWED_ROOT_FILES.has(req.path)) return next();

    // Allow files with whitelisted extensions, but block sensitive root files
    const blockedRootFiles = new Set(['/server.js', '/start.ps1']);
    if (ALLOWED_EXTENSIONS.has(ext) && !blockedRootFiles.has(req.path)) return next();

    return res.status(404).send('Not found');
});

// --- Security headers ---
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (req.secure || req.get('x-forwarded-proto') === 'https') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
});

// CSRF defense-in-depth for cookie-authenticated API calls
app.use(enforceApiCsrf);

// --- API routes ---

// Public settings (for client-side feature toggling)
app.get('/api/settings/public', (req, res) => {
    try {
        const challengesDisabled = JSON.parse(getSetting('challenges_disabled') || '[]');
        const submissionsBlocked = getSetting('submissions_blocked') === 'true';
        const announcement = getSetting('announcement') || '';
        res.json({ challenges_disabled: challengesDisabled, submissions_blocked: submissionsBlocked, announcement });
    } catch (err) {
        res.json({ challenges_disabled: [], submissions_blocked: false, announcement: '' });
    }
});

// Content API (public)
app.get('/api/content/:type', (req, res) => {
    const type = req.params.type;
    if (!CONTENT_TYPES[type]) return res.status(400).json({ error: 'Type invalide.' });
    const filename = CONTENT_TYPES[type] + '.json';
    const filePath = path.join(__dirname, 'data', 'francais', filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Contenu non trouvé.' });
    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Erreur de lecture.' });
    }
});

// ====================================================================
// --- USER API ROUTES ---
// ====================================================================

// User: Register
app.post('/api/user/register', checkRateLimit, async (req, res) => {
    const { username, email, password } = req.body;

    const usernameValidation = validatePlayerName(username);
    if (usernameValidation.error) {
        return res.status(400).json({ error: usernameValidation.error });
    }
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return res.status(400).json({ error: 'Adresse email invalide.' });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
        return res.status(400).json({ error: 'Le mot de passe doit faire au moins 6 caractères.' });
    }

    const sanitizedUsername = usernameValidation.sanitized;
    const sanitizedEmail = email.trim().toLowerCase().substring(0, 100);

    // Check banned names
    if (isBannedPlayerName(sanitizedUsername)) {
        return res.status(403).json({ error: 'Ce pseudo n\'est pas autorisé.' });
    }

    // Check uniqueness
    const existingUsername = db.prepare("SELECT id FROM users WHERE username = ? COLLATE NOCASE").get(sanitizedUsername);
    if (existingUsername) {
        return res.status(409).json({ error: 'Ce pseudo est déjà utilisé.' });
    }
    const existingEmail = db.prepare("SELECT id FROM users WHERE email = ? COLLATE NOCASE").get(sanitizedEmail);
    if (existingEmail) {
        return res.status(409).json({ error: 'Cette adresse email est déjà utilisée.' });
    }

    try {
        const hash = await bcrypt.hash(password, 12);
        const userId = createUserWithMainProfile(sanitizedUsername, sanitizedEmail, hash);

        // Rotate session id after authentication to reduce session fixation risk.
        const adminId = req.session.adminId;
        const adminUsername = req.session.username;
        const adminRole = req.session.role;
        await regenerateSession(req);
        if (adminId) {
            req.session.adminId = adminId;
            req.session.username = adminUsername;
            req.session.role = adminRole;
        }

        req.session.userId = userId;
        req.session.userUsername = sanitizedUsername;
        req.session.userEmail = sanitizedEmail;
        res.json({ ok: true, user: { id: userId, username: sanitizedUsername, email: sanitizedEmail } });
    } catch (err) {
        console.error('Error registering user:', err);
        res.status(500).json({ error: 'Erreur serveur.' });
    }
});

// User: Login
app.post('/api/user/login', checkRateLimit, async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis.' });

    const sanitizedEmail = email.trim().toLowerCase();
    const user = getUserByEmail.get(sanitizedEmail);
    if (!user) return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });

    ensureUserMainProfile(user.id, user.username);

    const adminId = req.session.adminId;
    const adminUsername = req.session.username;
    const adminRole = req.session.role;
    await regenerateSession(req);
    if (adminId) {
        req.session.adminId = adminId;
        req.session.username = adminUsername;
        req.session.role = adminRole;
    }

    req.session.userId = user.id;
    req.session.userUsername = user.username;
    req.session.userEmail = user.email;
    res.json({ ok: true, user: { id: user.id, username: user.username, email: user.email } });
});

// User: Logout
app.post('/api/user/logout', (req, res) => {
    // Preserve admin session if present
    const adminId = req.session.adminId;
    const adminUsername = req.session.username;
    const adminRole = req.session.role;

    delete req.session.userId;
    delete req.session.userUsername;
    delete req.session.userEmail;

    if (adminId) {
        req.session.adminId = adminId;
        req.session.username = adminUsername;
        req.session.role = adminRole;
    }

    res.json({ ok: true });
});

// User: Check session
app.get('/api/user/me', (req, res) => {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: 'Non connecté.' });
    }

    const user = getUserById.get(req.session.userId);
    if (!user) {
        delete req.session.userId;
        delete req.session.userUsername;
        delete req.session.userEmail;
        return res.status(401).json({ error: 'Non connecté.' });
    }

    res.json({ id: user.id, username: user.username, email: user.email, created_at: user.created_at });
});

// User: Profiles list
app.get('/api/user/profiles', requireUser, (req, res) => {
    try {
        ensureUserMainProfile(req.session.userId, req.session.userUsername);
        const countScoresByProfile = db.prepare("SELECT COUNT(*) as c FROM scores_v2 WHERE profile_id = ?");
        const profiles = listUserProfiles.all(req.session.userId).map(profile => ({
            ...profile,
            scoreCount: countScoresByProfile.get(profile.id).c,
        }));

        res.json({ profiles });
    } catch (err) {
        console.error('Error fetching user profiles:', err);
        res.status(500).json({ error: 'Erreur serveur.' });
    }
});

// User: Create profile
app.post('/api/user/profiles', requireUser, (req, res) => {
    const { name } = req.body;
    const nameValidation = validatePlayerName(name);
    if (nameValidation.error) {
        return res.status(400).json({ error: nameValidation.error });
    }

    const sanitizedName = nameValidation.sanitized;
    if (isBannedPlayerName(sanitizedName)) {
        return res.status(403).json({ error: 'Ce pseudo n\'est pas autorisé.' });
    }

    if (findUserProfileByName.get(req.session.userId, sanitizedName)) {
        return res.status(409).json({ error: 'Ce sous-utilisateur existe déjà.' });
    }

    try {
        const result = insertUserProfile.run(req.session.userId, sanitizedName);
        const profile = getOwnedUserProfile.get(req.session.userId, result.lastInsertRowid);
        res.status(201).json({ ok: true, profile });
    } catch (err) {
        console.error('Error creating user profile:', err);
        res.status(500).json({ error: 'Erreur serveur.' });
    }
});

// User: Rename profile
app.put('/api/user/profiles/:id', requireUser, (req, res) => {
    const profileId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(profileId) || profileId <= 0) {
        return res.status(400).json({ error: 'Sous-utilisateur invalide.' });
    }

    const profile = getOwnedUserProfile.get(req.session.userId, profileId);
    if (!profile) {
        return res.status(404).json({ error: 'Sous-utilisateur introuvable.' });
    }

    const nameValidation = validatePlayerName(req.body.name);
    if (nameValidation.error) {
        return res.status(400).json({ error: nameValidation.error });
    }

    const sanitizedName = nameValidation.sanitized;
    if (isBannedPlayerName(sanitizedName)) {
        return res.status(403).json({ error: 'Ce pseudo n\'est pas autorisé.' });
    }

    if (findUserProfileByNameExcludingId.get(req.session.userId, sanitizedName, profileId)) {
        return res.status(409).json({ error: 'Ce sous-utilisateur existe déjà.' });
    }

    try {
        updateUserProfileName.run(sanitizedName, profileId);
        updateScoresProfileName.run(sanitizedName, profileId);
        res.json({ ok: true, profile: { ...profile, name: sanitizedName } });
    } catch (err) {
        console.error('Error renaming user profile:', err);
        res.status(500).json({ error: 'Erreur serveur.' });
    }
});

// User: Change password
app.put('/api/user/password', requireUser, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Mot de passe actuel et nouveau requis.' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'Le nouveau mot de passe doit faire au moins 6 caractères.' });

    const user = getUserById.get(req.session.userId);
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé.' });

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Mot de passe actuel incorrect.' });

    const hash = await bcrypt.hash(newPassword, 12);
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, user.id);
    res.json({ ok: true });
});

// User: Change username
app.put('/api/user/profile', requireUser, (req, res) => {
    const { username } = req.body;
    const nameValidation = validatePlayerName(username);
    if (nameValidation.error) {
        return res.status(400).json({ error: nameValidation.error });
    }

    const sanitized = nameValidation.sanitized;
    const existing = db.prepare("SELECT id FROM users WHERE username = ? COLLATE NOCASE AND id != ?").get(sanitized, req.session.userId);
    if (existing) return res.status(409).json({ error: 'Ce pseudo est déjà utilisé.' });

    if (isBannedPlayerName(sanitized)) return res.status(403).json({ error: 'Ce pseudo n\'est pas autorisé.' });

    const previousUsername = req.session.userUsername;
    db.prepare("UPDATE users SET username = ? WHERE id = ?").run(sanitized, req.session.userId);

    const matchingProfile = findUserProfileByName.get(req.session.userId, previousUsername);
    if (matchingProfile && !findUserProfileByNameExcludingId.get(req.session.userId, sanitized, matchingProfile.id)) {
        updateUserProfileName.run(sanitized, matchingProfile.id);
        updateScoresProfileName.run(sanitized, matchingProfile.id);
    }

    req.session.userUsername = sanitized;
    res.json({ ok: true, username: sanitized });
});

// User: Delete account
app.delete('/api/user/account', requireUser, async (req, res) => {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Mot de passe requis pour confirmer la suppression.' });

    const user = getUserById.get(req.session.userId);
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé.' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Mot de passe incorrect.' });

    // Anonymize scores (keep them but remove user_id)
    db.prepare("UPDATE scores_v2 SET user_id = NULL, profile_id = NULL WHERE user_id = ?").run(user.id);
    db.prepare("DELETE FROM users WHERE id = ?").run(user.id);

    // Destroy user session
    delete req.session.userId;
    delete req.session.userUsername;
    delete req.session.userEmail;

    res.json({ ok: true });
});

// User: Personal stats
app.get('/api/user/stats', requireUser, (req, res) => {
    const userId = req.session.userId;
    try {
        ensureUserMainProfile(userId, req.session.userUsername);

        let selectedProfile = null;
        const profileParam = req.query.profileId;
        const statsParams = [userId];
        let statsWhere = 'user_id = ?';

        if (profileParam !== undefined && profileParam !== null && profileParam !== '') {
            const profileId = Number.parseInt(profileParam, 10);
            if (!Number.isInteger(profileId) || profileId <= 0) {
                return res.status(400).json({ error: 'Sous-utilisateur invalide.' });
            }

            selectedProfile = getOwnedUserProfile.get(userId, profileId);
            if (!selectedProfile) {
                return res.status(404).json({ error: 'Sous-utilisateur introuvable.' });
            }

            statsWhere += ' AND profile_id = ?';
            statsParams.push(profileId);
        }

        const profiles = listUserProfiles.all(userId);
        const totalChallenges = db.prepare(`SELECT COUNT(*) as c FROM scores_v2 WHERE ${statsWhere}`).get(...statsParams).c;
        const byType = db.prepare(`SELECT type, COUNT(*) as count, AVG(CASE WHEN correct + wrong > 0 THEN CAST(correct AS REAL) / (correct + wrong) * 100 ELSE 0 END) as avg_accuracy FROM scores_v2 WHERE ${statsWhere} GROUP BY type ORDER BY count DESC`).all(...statsParams);
        const byMode = db.prepare(`SELECT mode, COUNT(*) as count FROM scores_v2 WHERE ${statsWhere} GROUP BY mode`).all(...statsParams);
        const bestScores = db.prepare(`SELECT type, mode, level, MIN(CASE WHEN mode = '100' THEN score_value END) as best_time, MAX(CASE WHEN mode = 'timer' THEN score_value END) as best_count, MAX(CASE WHEN correct + wrong > 0 THEN CAST(correct AS REAL) / (correct + wrong) * 100 ELSE 0 END) as best_accuracy FROM scores_v2 WHERE ${statsWhere} GROUP BY type, mode, level`).all(...statsParams);
        const recentScores = db.prepare(`SELECT name, profile_id, type, mode, level, score_value, correct, wrong, created_at FROM scores_v2 WHERE ${statsWhere} ORDER BY created_at DESC LIMIT 20`).all(...statsParams);

        // Count top 3 positions
        const allUserScores = db.prepare(`SELECT id, type, mode, level, score_value FROM scores_v2 WHERE ${statsWhere}`).all(...statsParams);
        let top3Count = 0;
        let top10Count = 0;
        for (const s of allUserScores) {
            let rank;
            if (s.mode === '100') {
                rank = db.prepare("SELECT COUNT(*) as c FROM scores_v2 WHERE type = ? AND mode = '100' AND level = ? AND score_value < ?").get(s.type, s.level, s.score_value).c + 1;
            } else {
                rank = db.prepare("SELECT COUNT(*) as c FROM scores_v2 WHERE type = ? AND mode = 'timer' AND level = ? AND score_value > ?").get(s.type, s.level, s.score_value).c + 1;
            }
            if (rank <= 3) top3Count++;
            if (rank <= 10) top10Count++;
        }

        // Average accuracy
        const avgAccuracy = db.prepare(`SELECT AVG(CASE WHEN correct + wrong > 0 THEN CAST(correct AS REAL) / (correct + wrong) * 100 ELSE 0 END) as avg FROM scores_v2 WHERE ${statsWhere}`).get(...statsParams).avg || 0;

        res.json({
            totalChallenges,
            byType,
            byMode,
            bestScores,
            recentScores,
            top3Count,
            top10Count,
            avgAccuracy: Math.round(avgAccuracy * 10) / 10,
            profiles,
            selectedProfile,
        });
    } catch (err) {
        console.error('Error fetching user stats:', err);
        res.status(500).json({ error: 'Erreur serveur.' });
    }
});

app.post('/api/scores', (req, res) => {
    // Check if submissions are blocked
    if (getSetting('submissions_blocked') === 'true') {
        return res.status(403).json({ error: 'Les soumissions de scores sont temporairement désactivées.' });
    }

    // Require login for challenge score submission
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: 'Connecte-toi pour enregistrer un score dans le classement.' });
    }

    const { type, mode, level, score_value, correct, wrong, profileId, profile_id } = req.body;

    const userId = req.session.userId;

    // Check if challenges are disabled for this type
    try {
        const disabled = JSON.parse(getSetting('challenges_disabled') || '[]');
        if (disabled.includes(type)) {
            return res.status(403).json({ error: 'Les challenges pour ce jeu sont désactivés.' });
        }
    } catch (e) { /* ignore parse errors */ }

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

    try {
        const profileResult = resolveOwnedProfile(userId, profileId ?? profile_id, req.session.userUsername);
        if (profileResult.error) {
            return res.status(profileResult.status).json({ error: profileResult.error });
        }

        insertScore.run({
            name: profileResult.profile.name,
            type,
            mode,
            level,
            score_value,
            correct,
            wrong,
            user_id: userId,
            profile_id: profileResult.profile.id,
        });
        res.json({ ok: true, profile: profileResult.profile });
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
        const sessionUserId = req.session && req.session.userId ? req.session.userId : null;
        const rows = mode === '100'
            ? getScores100.all({ type, level, sessionUserId })
            : getScoresTimer.all({ type, level, sessionUserId });
        res.json(rows);
    } catch (err) {
        console.error('Error fetching scores:', err);
        res.status(500).json({ error: 'Erreur serveur.' });
    }
});

// ====================================================================
// --- ADMIN API ROUTES ---
// ====================================================================

// Auth: Login
app.post('/api/admin/login', checkAdminRateLimit, async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Identifiants requis.' });

    const user = db.prepare("SELECT * FROM admins WHERE username = ?").get(username);
    if (!user) return res.status(401).json({ error: 'Identifiants incorrects.' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Identifiants incorrects.' });

    const userId = req.session.userId;
    const userUsername = req.session.userUsername;
    const userEmail = req.session.userEmail;
    await regenerateSession(req);
    if (userId) {
        req.session.userId = userId;
        req.session.userUsername = userUsername;
        req.session.userEmail = userEmail;
    }

    req.session.adminId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;
    logAdminAction(user.username, 'login', null);
    res.json({ ok: true, username: user.username, role: user.role });
});

// Auth: Logout
app.post('/api/admin/logout', (req, res) => {
    const username = req.session.username;
    req.session.destroy(() => {
        if (username) logAdminAction(username, 'logout', null);
        res.clearCookie('admin.sid');
        res.json({ ok: true });
    });
});

// Auth: Check session
app.get('/api/admin/check', (req, res) => {
    if (!req.session || !req.session.adminId) return res.status(401).json({ error: 'Non authentifié.' });
    res.json({ username: req.session.username, role: req.session.role });
});

// --- User management (superadmin only) ---
app.get('/api/admin/users', requireSuperAdmin, (req, res) => {
    const users = db.prepare("SELECT id, username, role, is_root, created_at FROM admins ORDER BY created_at ASC").all();
    res.json(users);
});

app.post('/api/admin/users', requireSuperAdmin, async (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ error: 'Nom d\'utilisateur et mot de passe requis.' });
    }
    if (username.trim().length < 3 || username.trim().length > 30) {
        return res.status(400).json({ error: 'Nom d\'utilisateur : 3 à 30 caractères.' });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: 'Mot de passe : 6 caractères minimum.' });
    }
    if (!['admin', 'superadmin'].includes(role)) {
        return res.status(400).json({ error: 'Rôle invalide.' });
    }

    const existing = db.prepare("SELECT id FROM admins WHERE username = ?").get(username.trim());
    if (existing) return res.status(409).json({ error: 'Ce nom d\'utilisateur existe déjà.' });

    const hash = await bcrypt.hash(password, 12);
    db.prepare("INSERT INTO admins (username, password_hash, role) VALUES (?, ?, ?)").run(username.trim(), hash, role);
    logAdminAction(req.session.username, 'create_user', `Créé: ${username.trim()} (${role})`);
    res.json({ ok: true });
});

app.delete('/api/admin/users/:id', requireSuperAdmin, (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID invalide.' });

    const user = db.prepare("SELECT * FROM admins WHERE id = ?").get(id);
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé.' });
    if (user.is_root) return res.status(403).json({ error: 'Ce compte ne peut pas être supprimé.' });

    db.prepare("DELETE FROM admins WHERE id = ?").run(id);
    logAdminAction(req.session.username, 'delete_user', `Supprimé: ${user.username}`);
    res.json({ ok: true });
});

app.put('/api/admin/users/:id/role', requireSuperAdmin, (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { role } = req.body;
    if (isNaN(id)) return res.status(400).json({ error: 'ID invalide.' });
    if (!['admin', 'superadmin'].includes(role)) return res.status(400).json({ error: 'Rôle invalide.' });

    const user = db.prepare("SELECT * FROM admins WHERE id = ?").get(id);
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé.' });
    if (user.is_root) return res.status(403).json({ error: 'Le rôle de ce compte ne peut pas être modifié.' });

    db.prepare("UPDATE admins SET role = ? WHERE id = ?").run(role, id);
    logAdminAction(req.session.username, 'change_role', `${user.username}: ${user.role} → ${role}`);
    res.json({ ok: true });
});

app.put('/api/admin/users/me/password', requireAdmin, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Mot de passe actuel et nouveau requis.' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'Nouveau mot de passe : 6 caractères minimum.' });

    const user = db.prepare("SELECT * FROM admins WHERE id = ?").get(req.session.adminId);
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé.' });

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Mot de passe actuel incorrect.' });

    const hash = await bcrypt.hash(newPassword, 12);
    db.prepare("UPDATE admins SET password_hash = ? WHERE id = ?").run(hash, user.id);
    logAdminAction(req.session.username, 'change_password', 'Mot de passe modifié');
    res.json({ ok: true });
});

// --- Scores management ---
app.get('/api/admin/scores', requireAdmin, (req, res) => {
    const { type, mode, level, name, page: pageParam, limit: limitParam } = req.query;
    const limit = Math.min(parseInt(limitParam, 10) || 50, 200);
    const offset = ((parseInt(pageParam, 10) || 1) - 1) * limit;

    let where = [];
    let params = {};
    if (type && VALID_TYPES.includes(type)) { where.push('type = @type'); params.type = type; }
    if (mode && ['100', 'timer'].includes(mode)) { where.push('mode = @mode'); params.mode = mode; }
    if (level && ['easy', 'medium', 'hard'].includes(level)) { where.push('level = @level'); params.level = level; }
    if (name && typeof name === 'string') { where.push('name LIKE @name'); params.name = `%${name}%`; }

    const whereClause = where.length ? ' WHERE ' + where.join(' AND ') : '';
    const rows = db.prepare(`SELECT id, name, type, mode, level, score_value, correct, wrong, created_at FROM scores_v2${whereClause} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`).all(params);
    const countRow = db.prepare(`SELECT COUNT(*) as total FROM scores_v2${whereClause}`).get(params);
    res.json({ rows, total: countRow.total, page: Math.floor(offset / limit) + 1, limit });
});

app.delete('/api/admin/scores/:id', requireAdmin, (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID invalide.' });

    const score = db.prepare("SELECT * FROM scores_v2 WHERE id = ?").get(id);
    if (!score) return res.status(404).json({ error: 'Score non trouvé.' });

    db.prepare("DELETE FROM scores_v2 WHERE id = ?").run(id);
    logAdminAction(req.session.username, 'delete_score', `Score #${id}: ${score.name} (${score.type})`);
    res.json({ ok: true });
});

app.post('/api/admin/scores/bulk-delete', requireAdmin, (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'Liste d\'IDs requise.' });
    if (ids.length > 500) return res.status(400).json({ error: 'Maximum 500 suppressions à la fois.' });

    const validIds = ids.filter(id => Number.isInteger(id) && id > 0);
    if (validIds.length === 0) return res.status(400).json({ error: 'Aucun ID valide.' });

    const placeholders = validIds.map(() => '?').join(',');
    const result = db.prepare(`DELETE FROM scores_v2 WHERE id IN (${placeholders})`).run(...validIds);
    logAdminAction(req.session.username, 'bulk_delete_scores', `${result.changes} score(s) supprimé(s)`);
    res.json({ ok: true, deleted: result.changes });
});

// --- Settings management ---
app.get('/api/admin/settings', requireAdmin, (req, res) => {
    const rows = db.prepare("SELECT key, value FROM admin_settings").all();
    const settings = {};
    for (const row of rows) settings[row.key] = row.value;
    res.json(settings);
});

app.put('/api/admin/settings/:key', requireAdmin, (req, res) => {
    const { key } = req.params;
    const { value } = req.body;
    if (value === undefined || value === null) return res.status(400).json({ error: 'Valeur requise.' });

    setSetting(key, String(value));
    logAdminAction(req.session.username, 'update_setting', `${key} = ${String(value).substring(0, 100)}`);
    res.json({ ok: true });
});

// --- Banned names ---
app.get('/api/admin/banned', requireAdmin, (req, res) => {
    const names = db.prepare("SELECT id, name, created_at FROM banned_names ORDER BY name ASC").all();
    res.json(names);
});

app.post('/api/admin/banned', requireAdmin, (req, res) => {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Nom requis.' });
    }
    try {
        db.prepare("INSERT INTO banned_names (name) VALUES (?)").run(name.trim());
        logAdminAction(req.session.username, 'ban_name', name.trim());
        res.json({ ok: true });
    } catch (err) {
        if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Ce nom est déjà banni.' });
        res.status(500).json({ error: 'Erreur serveur.' });
    }
});

app.delete('/api/admin/banned/:id', requireAdmin, (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID invalide.' });
    const entry = db.prepare("SELECT name FROM banned_names WHERE id = ?").get(id);
    if (!entry) return res.status(404).json({ error: 'Entrée non trouvée.' });
    db.prepare("DELETE FROM banned_names WHERE id = ?").run(id);
    logAdminAction(req.session.username, 'unban_name', entry.name);
    res.json({ ok: true });
});

// --- Content management ---
app.get('/api/admin/content/:type', requireAdmin, (req, res) => {
    const type = req.params.type;
    if (!CONTENT_TYPES[type]) return res.status(400).json({ error: 'Type invalide.' });
    const filename = CONTENT_TYPES[type] + '.json';
    const filePath = path.join(__dirname, 'data', 'francais', filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Fichier non trouvé.' });
    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Erreur de lecture.' });
    }
});

app.post('/api/admin/content/:type', requireAdmin, (req, res) => {
    const type = req.params.type;
    if (!CONTENT_TYPES[type]) return res.status(400).json({ error: 'Type invalide.' });
    const { level, entry } = req.body;
    if (!['easy', 'medium', 'hard'].includes(level)) return res.status(400).json({ error: 'Niveau invalide.' });
    if (!entry || typeof entry !== 'object') return res.status(400).json({ error: 'Entrée invalide.' });

    const filename = CONTENT_TYPES[type] + '.json';
    const filePath = path.join(__dirname, 'data', 'francais', filename);
    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (!data[level]) data[level] = [];
        data[level].push(entry);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        logAdminAction(req.session.username, 'add_content', `${type}/${level}: ${JSON.stringify(entry).substring(0, 100)}`);
        res.json({ ok: true, count: data[level].length });
    } catch (err) {
        res.status(500).json({ error: 'Erreur d\'écriture.' });
    }
});

app.put('/api/admin/content/:type', requireAdmin, (req, res) => {
    const type = req.params.type;
    if (!CONTENT_TYPES[type]) return res.status(400).json({ error: 'Type invalide.' });
    const { level, index, entry } = req.body;
    if (!['easy', 'medium', 'hard'].includes(level)) return res.status(400).json({ error: 'Niveau invalide.' });
    if (typeof index !== 'number' || index < 0) return res.status(400).json({ error: 'Index invalide.' });
    if (!entry || typeof entry !== 'object') return res.status(400).json({ error: 'Entrée invalide.' });

    const filename = CONTENT_TYPES[type] + '.json';
    const filePath = path.join(__dirname, 'data', 'francais', filename);
    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (!data[level] || index >= data[level].length) return res.status(404).json({ error: 'Entrée non trouvée.' });
        data[level][index] = entry;
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        logAdminAction(req.session.username, 'edit_content', `${type}/${level}[${index}]`);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Erreur d\'écriture.' });
    }
});

app.delete('/api/admin/content/:type', requireAdmin, (req, res) => {
    const type = req.params.type;
    if (!CONTENT_TYPES[type]) return res.status(400).json({ error: 'Type invalide.' });
    const { level, index } = req.body;
    if (!['easy', 'medium', 'hard'].includes(level)) return res.status(400).json({ error: 'Niveau invalide.' });
    if (typeof index !== 'number' || index < 0) return res.status(400).json({ error: 'Index invalide.' });

    const filename = CONTENT_TYPES[type] + '.json';
    const filePath = path.join(__dirname, 'data', 'francais', filename);
    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (!data[level] || index >= data[level].length) return res.status(404).json({ error: 'Entrée non trouvée.' });
        if (data[level].length <= 200) return res.status(400).json({ error: `Minimum 200 entrées par niveau. Actuel : ${data[level].length}.` });
        data[level].splice(index, 1);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        logAdminAction(req.session.username, 'delete_content', `${type}/${level}[${index}]`);
        res.json({ ok: true, count: data[level].length });
    } catch (err) {
        res.status(500).json({ error: 'Erreur d\'écriture.' });
    }
});

// --- Dashboard stats ---
app.get('/api/admin/stats', requireAdmin, (req, res) => {
    try {
        const total = db.prepare("SELECT COUNT(*) as c FROM scores_v2").get().c;
        const today = db.prepare("SELECT COUNT(*) as c FROM scores_v2 WHERE created_at >= datetime('now', '-1 day')").get().c;
        const week = db.prepare("SELECT COUNT(*) as c FROM scores_v2 WHERE created_at >= datetime('now', '-7 days')").get().c;
        const uniquePlayers = db.prepare("SELECT COUNT(DISTINCT name) as c FROM scores_v2").get().c;
        const byType = db.prepare("SELECT type, COUNT(*) as count FROM scores_v2 GROUP BY type ORDER BY count DESC").all();
        const recent = db.prepare("SELECT name, type, mode, level, score_value, correct, wrong, created_at FROM scores_v2 ORDER BY created_at DESC LIMIT 10").all();
        res.json({ total, today, week, uniquePlayers, byType, recent });
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur.' });
    }
});

// --- Admin log ---
app.get('/api/admin/log', requireAdmin, (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const rows = db.prepare("SELECT * FROM admin_log ORDER BY created_at DESC LIMIT ?").all(limit);
    res.json(rows);
});

// --- Export CSV ---
app.get('/api/admin/export', requireAdmin, (req, res) => {
    const { type, mode, level } = req.query;
    let where = [];
    let params = {};
    if (type && VALID_TYPES.includes(type)) { where.push('type = @type'); params.type = type; }
    if (mode && ['100', 'timer'].includes(mode)) { where.push('mode = @mode'); params.mode = mode; }
    if (level && ['easy', 'medium', 'hard'].includes(level)) { where.push('level = @level'); params.level = level; }
    const whereClause = where.length ? ' WHERE ' + where.join(' AND ') : '';
    const rows = db.prepare(`SELECT id, name, type, mode, level, score_value, correct, wrong, created_at FROM scores_v2${whereClause} ORDER BY created_at DESC`).all(params);

    const header = 'id,name,type,mode,level,score_value,correct,wrong,created_at\n';
    const csv = header + rows.map(r =>
        `${r.id},"${r.name.replace(/"/g, '""')}",${r.type},${r.mode},${r.level},${r.score_value},${r.correct},${r.wrong},${r.created_at}`
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=scores_export.csv');
    res.send(csv);
});

// --- Player users management (superadmin) ---
app.get('/api/admin/players', requireSuperAdmin, (req, res) => {
    const { search, page: pageParam, limit: limitParam } = req.query;
    const limit = Math.min(parseInt(limitParam, 10) || 50, 200);
    const offset = ((parseInt(pageParam, 10) || 1) - 1) * limit;

    let where = '';
    let params = {};
    if (search && typeof search === 'string') {
        where = " WHERE username LIKE @search OR email LIKE @search";
        params.search = `%${search}%`;
    }

    const rows = db.prepare(`SELECT id, username, email, created_at FROM users${where} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`).all(params);
    const countRow = db.prepare(`SELECT COUNT(*) as total FROM users${where}`).get(params);

    // Add score count for each user
    const getScoreCount = db.prepare("SELECT COUNT(*) as c FROM scores_v2 WHERE user_id = ?");
    for (const row of rows) {
        row.scoreCount = getScoreCount.get(row.id).c;
    }

    res.json({ rows, total: countRow.total, page: Math.floor(offset / limit) + 1, limit });
});

app.delete('/api/admin/players/:id', requireSuperAdmin, (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID invalide.' });

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé.' });

    // Anonymize scores
    db.prepare("UPDATE scores_v2 SET user_id = NULL, profile_id = NULL WHERE user_id = ?").run(id);
    db.prepare("DELETE FROM users WHERE id = ?").run(id);
    logAdminAction(req.session.username, 'delete_player', `Supprimé: ${user.username} (${user.email})`);
    res.json({ ok: true });
});

// --- Admin page routes (MUST be before express.static to avoid directory redirect) ---
app.use('/admin', (req, res, next) => {
    // Redirect /admin to /admin/
    if (req.originalUrl === '/admin') {
        return res.redirect(301, '/admin/');
    }
    // Serve admin pages for the root admin path
    if (req.path === '/' || req.path === '') {
        // Authenticated → full admin panel; otherwise → login page
        if (req.session && req.session.adminId) {
            return res.sendFile(path.join(__dirname, 'admin', 'index.html'));
        }
        return res.sendFile(path.join(__dirname, 'admin', 'login.html'));
    }
    // Other admin files (CSS, JS) are served by static if session is valid
    // (whitelist middleware already blocks unauthenticated access)
    next();
});

// --- Account page routes ---
app.get('/account', trailingSlashRedirect);
app.get('/account/', (req, res) => {
    // If logged in, show profile; otherwise show login
    if (req.session && req.session.userId) {
        return res.sendFile(path.join(__dirname, 'account', 'profile.html'));
    }
    return res.sendFile(path.join(__dirname, 'account', 'login.html'));
});
app.get('/account/login', trailingSlashRedirect);
app.get('/account/login/', (req, res) => {
    res.sendFile(path.join(__dirname, 'account', 'login.html'));
});
app.get('/account/register', trailingSlashRedirect);
app.get('/account/register/', (req, res) => {
    res.sendFile(path.join(__dirname, 'account', 'register.html'));
});
app.get('/account/profile', trailingSlashRedirect);
app.get('/account/profile/', (req, res) => {
    res.sendFile(path.join(__dirname, 'account', 'profile.html'));
});

// --- Static files ---
app.use(express.static(__dirname, { extensions: ['html'] }));

// --- Trailing slash redirect for sub-pages ---
// Ensures relative CSS/JS paths resolve correctly in the browser
function trailingSlashRedirect(req, res, next) {
    if (!req.path.endsWith('/')) {
        return res.redirect(301, req.path + '/');
    }
    next();
}

// --- Fallback routes for /math/* ---
const mathSubPages = ['multiplications', 'additions', 'soustractions', 'divisions', 'divisions-posees', 'complements', 'mixte', 'comparaisons'];
mathSubPages.forEach(page => {
    app.get(`/math/${page}`, trailingSlashRedirect);
    app.get(`/math/${page}/`, (req, res) => {
        res.sendFile(path.join(__dirname, 'math', page, 'index.html'));
    });
});

app.get('/math', trailingSlashRedirect);
app.get('/math/', (req, res) => {
    res.sendFile(path.join(__dirname, 'math', 'index.html'));
});

// --- Fallback routes for /jeux/* ---
const jeuxSubPages = ['couronnes', 'sudoku', 'picross'];
jeuxSubPages.forEach(page => {
    app.get(`/jeux/${page}`, trailingSlashRedirect);
    app.get(`/jeux/${page}/`, (req, res) => {
        res.sendFile(path.join(__dirname, 'jeux', page, 'index.html'));
    });
});

app.get('/jeux', trailingSlashRedirect);
app.get('/jeux/', (req, res) => {
    res.sendFile(path.join(__dirname, 'jeux', 'index.html'));
});

// --- Fallback routes for /francais/* ---
const francaisSubPages = ['conjugaison', 'homophones', 'pluriels', 'feminin-masculin', 'vocabulaire', 'orthographe'];
francaisSubPages.forEach(page => {
    app.get(`/francais/${page}`, trailingSlashRedirect);
    app.get(`/francais/${page}/`, (req, res) => {
        res.sendFile(path.join(__dirname, 'francais', page, 'index.html'));
    });
});

app.get('/francais', trailingSlashRedirect);
app.get('/francais/', (req, res) => {
    res.sendFile(path.join(__dirname, 'francais', 'index.html'));
});

// --- SSL support ---
if (SSL_AVAILABLE) {
    const https = require('https');
    const options = {
        cert: fs.readFileSync(path.join(__dirname, 'cert.pem')),
        key: fs.readFileSync(path.join(__dirname, 'key.pem')),
    };
    https.createServer(options, app).listen(PORT, () => {
        console.log(`Server running at https://localhost:${PORT}`);
    });
} else {
    app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
    });
}
