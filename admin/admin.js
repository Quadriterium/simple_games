// ====================================================================
// Admin Panel
// ====================================================================

const GAME_LABELS = {
    multiplication: 'Multiplications',
    addition: 'Additions',
    soustraction: 'Soustractions',
    division: 'Divisions',
    complement: 'Compléments',
    mixte: 'Mixte',
    comparaison: 'Comparaisons',
    conjugaison: 'Conjugaison',
    homophone: 'Homophones',
    pluriel: 'Pluriels',
    'feminin-masculin': 'Féminin / Masculin',
    vocabulaire: 'Vocabulaire',
    orthographe: 'Orthographe',
};

const CONTENT_FIELDS = {
    conjugaison: ['verb', 'pronoun', 'answer'],
    homophone: ['sentence', 'answer', 'choices'],
    pluriel: ['singular', 'plural'],
    'feminin-masculin': ['masculine', 'feminine'],
    vocabulaire: ['question', 'answer', 'choices'],
    orthographe: ['correct', 'wrong'],
};

let currentUser = null;
let scoresPage = 1;

// ====================================================================
// API helpers
// ====================================================================
async function api(url, opts = {}) {
    const resp = await fetch(url, {
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...opts.headers },
        ...opts,
    });
    if (resp.status === 401 && !url.includes('/login')) {
        window.location.href = '/admin/';
        throw new Error('Session expirée');
    }
    return resp;
}

function esc(text) {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
}

// ====================================================================
// INIT
// ====================================================================
(async () => {
    try {
        const resp = await fetch('/api/admin/check');
        if (!resp.ok) { window.location.href = '/admin/'; return; }
        const user = await resp.json();
        currentUser = user;
        document.getElementById('admin-username').textContent = `${user.username} (${user.role})`;
        document.getElementById('nav-users').classList.toggle('hidden', user.role !== 'superadmin');
        document.getElementById('nav-players').classList.toggle('hidden', user.role !== 'superadmin');
        loadDashboard();
    } catch {
        window.location.href = '/admin/';
    }
})();

document.getElementById('btn-logout').addEventListener('click', async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    window.location.href = '/admin/';
});

// ====================================================================
// NAVIGATION
// ====================================================================
document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.panel').forEach(s => s.classList.add('hidden'));
        const sec = document.getElementById('sec-' + btn.dataset.section);
        if (sec) sec.classList.remove('hidden');

        // Load data for section
        const section = btn.dataset.section;
        if (section === 'dashboard') loadDashboard();
        else if (section === 'scores') loadScores();
        else if (section === 'settings') loadSettings();
        else if (section === 'banned') loadBanned();
        else if (section === 'users') loadUsers();
        else if (section === 'players') loadPlayers();
        else if (section === 'log') loadLog();
    });
});

// ====================================================================
// DASHBOARD
// ====================================================================
async function loadDashboard() {
    try {
        const resp = await api('/api/admin/stats');
        const data = await resp.json();

        document.getElementById('stat-cards').innerHTML = `
            <div class="stat-card"><div class="stat-value">${data.total}</div><div class="stat-label">Scores totaux</div></div>
            <div class="stat-card"><div class="stat-value">${data.today}</div><div class="stat-label">Aujourd'hui</div></div>
            <div class="stat-card"><div class="stat-value">${data.week}</div><div class="stat-label">Cette semaine</div></div>
            <div class="stat-card"><div class="stat-value">${data.uniquePlayers}</div><div class="stat-label">Joueurs uniques</div></div>
        `;

        // Bar chart
        const maxCount = Math.max(...data.byType.map(t => t.count), 1);
        document.getElementById('chart-by-type').innerHTML = data.byType.map(t => `
            <div class="bar-item">
                <span class="bar-label">${esc(GAME_LABELS[t.type] || t.type)}</span>
                <div class="bar" style="width: ${Math.round(t.count / maxCount * 200)}px"></div>
                <span class="bar-count">${t.count}</span>
            </div>
        `).join('');

        // Recent scores
        document.getElementById('recent-scores').innerHTML = data.recent.map(r => `
            <tr>
                <td>${esc(r.name)}</td>
                <td>${esc(GAME_LABELS[r.type] || r.type)}</td>
                <td>${r.mode === '100' ? '💯' : '⏱️'}</td>
                <td>${r.level}</td>
                <td>${r.score_value}</td>
                <td>${r.correct}</td>
                <td>${r.wrong}</td>
                <td>${new Date(r.created_at).toLocaleString('fr')}</td>
            </tr>
        `).join('');
    } catch {}
}

// ====================================================================
// SCORES
// ====================================================================
// Populate type filter
(function populateTypeFilter() {
    const sel = document.getElementById('f-type');
    for (const [key, label] of Object.entries(GAME_LABELS)) {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = label;
        sel.appendChild(opt);
    }
})();

document.getElementById('btn-filter').addEventListener('click', () => { scoresPage = 1; loadScores(); });
document.getElementById('btn-export').addEventListener('click', exportCSV);

document.getElementById('chk-all').addEventListener('change', (e) => {
    document.querySelectorAll('#scores-body input[type="checkbox"]').forEach(c => c.checked = e.target.checked);
});

document.getElementById('btn-delete-selected').addEventListener('click', async () => {
    const ids = [...document.querySelectorAll('#scores-body input[type="checkbox"]:checked')].map(c => parseInt(c.dataset.id, 10));
    if (!ids.length) return;
    if (!confirm(`Supprimer ${ids.length} score(s) ?`)) return;
    try {
        await api('/api/admin/scores/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) });
        loadScores();
    } catch {}
});

async function loadScores() {
    const type = document.getElementById('f-type').value;
    const mode = document.getElementById('f-mode').value;
    const level = document.getElementById('f-level').value;
    const name = document.getElementById('f-name').value;

    const params = new URLSearchParams({ page: scoresPage, limit: 50 });
    if (type) params.set('type', type);
    if (mode) params.set('mode', mode);
    if (level) params.set('level', level);
    if (name) params.set('name', name);

    try {
        const resp = await api('/api/admin/scores?' + params);
        const data = await resp.json();

        document.getElementById('scores-body').innerHTML = data.rows.map(r => `
            <tr>
                <td><input type="checkbox" data-id="${r.id}"></td>
                <td>${r.id}</td>
                <td>${esc(r.name)}</td>
                <td>${esc(GAME_LABELS[r.type] || r.type)}</td>
                <td>${r.mode === '100' ? '💯' : '⏱️'}</td>
                <td>${r.level}</td>
                <td>${r.score_value}</td>
                <td>${r.correct}</td>
                <td>${r.wrong}</td>
                <td>${new Date(r.created_at).toLocaleString('fr')}</td>
                <td><button class="btn-sm btn-danger" onclick="deleteScore(${r.id})">🗑️</button></td>
            </tr>
        `).join('');

        document.getElementById('chk-all').checked = false;

        // Pagination
        const totalPages = Math.ceil(data.total / data.limit);
        const pagEl = document.getElementById('scores-pagination');
        pagEl.innerHTML = '';
        for (let p = 1; p <= totalPages && p <= 20; p++) {
            const btn = document.createElement('button');
            btn.textContent = p;
            if (p === data.page) btn.classList.add('active');
            btn.addEventListener('click', () => { scoresPage = p; loadScores(); });
            pagEl.appendChild(btn);
        }
    } catch {}
}

async function deleteScore(id) {
    if (!confirm('Supprimer ce score ?')) return;
    try {
        await api('/api/admin/scores/' + id, { method: 'DELETE' });
        loadScores();
    } catch {}
}

function exportCSV() {
    const type = document.getElementById('f-type').value;
    const mode = document.getElementById('f-mode').value;
    const level = document.getElementById('f-level').value;
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (mode) params.set('mode', mode);
    if (level) params.set('level', level);
    window.open('/api/admin/export?' + params, '_blank');
}

// ====================================================================
// SETTINGS
// ====================================================================
async function loadSettings() {
    try {
        const resp = await api('/api/admin/settings');
        const settings = await resp.json();

        // Challenge toggles
        const disabled = JSON.parse(settings.challenges_disabled || '[]');
        const grid = document.getElementById('challenge-toggles');
        grid.innerHTML = Object.entries(GAME_LABELS).map(([key, label]) => `
            <label class="toggle-label">
                <input type="checkbox" data-type="${key}" ${disabled.includes(key) ? '' : 'checked'}>
                <span>${label}</span>
            </label>
        `).join('');

        grid.querySelectorAll('input[type="checkbox"]').forEach(chk => {
            chk.addEventListener('change', saveChallengeToggles);
        });

        // Submissions blocked
        document.getElementById('toggle-submissions').checked = settings.submissions_blocked === 'true';
        document.getElementById('toggle-submissions').addEventListener('change', async (e) => {
            await api('/api/admin/settings/submissions_blocked', {
                method: 'PUT',
                body: JSON.stringify({ value: String(e.target.checked) }),
            });
        });

        // Announcement
        document.getElementById('announcement-text').value = settings.announcement || '';
    } catch {}
}

async function saveChallengeToggles() {
    const checkboxes = document.querySelectorAll('#challenge-toggles input[type="checkbox"]');
    const disabled = [];
    checkboxes.forEach(chk => {
        if (!chk.checked) disabled.push(chk.dataset.type);
    });
    await api('/api/admin/settings/challenges_disabled', {
        method: 'PUT',
        body: JSON.stringify({ value: JSON.stringify(disabled) }),
    });
}

document.getElementById('btn-save-announcement').addEventListener('click', async () => {
    const text = document.getElementById('announcement-text').value;
    await api('/api/admin/settings/announcement', {
        method: 'PUT',
        body: JSON.stringify({ value: text }),
    });
    alert('Bannière enregistrée !');
});

// ====================================================================
// CONTENT MANAGEMENT
// ====================================================================
let contentData = null;

document.getElementById('btn-load-content').addEventListener('click', loadContent);

document.getElementById('c-type').addEventListener('change', () => {
    contentData = null;
    document.getElementById('content-body').innerHTML = '';
    document.getElementById('content-stats').textContent = '';
    document.getElementById('content-add-form').classList.add('hidden');
    document.getElementById('content-search').classList.add('hidden');
});

async function loadContent() {
    const type = document.getElementById('c-type').value;
    const level = document.getElementById('c-level').value;

    try {
        const resp = await api('/api/admin/content/' + type);
        contentData = await resp.json();
        renderContent(type, level);
    } catch {}
}

function renderContent(type, level) {
    const fields = CONTENT_FIELDS[type];
    if (!fields || !contentData || !contentData[level]) return;

    const items = contentData[level];
    document.getElementById('content-stats').textContent = `${items.length} entrée(s) — niveau ${level}`;

    // Header
    document.getElementById('content-header').innerHTML =
        '<th>#</th>' + fields.map(f => `<th>${f}</th>`).join('') + '<th>Actions</th>';

    // Body
    renderContentRows(type, level, items, fields);

    // Add form
    const addDiv = document.getElementById('content-add-form');
    addDiv.classList.remove('hidden');
    const fieldsDiv = document.getElementById('content-add-fields');
    fieldsDiv.innerHTML = fields.map(f => `<input type="text" placeholder="${f}" data-field="${f}">`).join('');

    // Search
    const searchEl = document.getElementById('content-search');
    searchEl.classList.remove('hidden');
    searchEl.value = '';
    searchEl.oninput = () => {
        const q = searchEl.value.toLowerCase();
        const filtered = items.filter((item, i) => {
            item._origIndex = i;
            return fields.some(f => String(item[f] || '').toLowerCase().includes(q));
        });
        renderContentRows(type, level, filtered, fields);
    };
}

function renderContentRows(type, level, items, fields) {
    document.getElementById('content-body').innerHTML = items.map((item, i) => {
        const idx = item._origIndex !== undefined ? item._origIndex : i;
        return `<tr>
            <td>${idx}</td>
            ${fields.map(f => `<td>${esc(Array.isArray(item[f]) ? item[f].join(', ') : String(item[f] || ''))}</td>`).join('')}
            <td><button class="btn-sm btn-danger" onclick="deleteContentEntry('${type}','${level}',${idx})">🗑️</button></td>
        </tr>`;
    }).join('');
}

document.getElementById('btn-add-entry').addEventListener('click', async () => {
    const type = document.getElementById('c-type').value;
    const level = document.getElementById('c-level').value;
    const fields = CONTENT_FIELDS[type];
    const entry = {};
    let valid = true;

    document.querySelectorAll('#content-add-fields input').forEach(inp => {
        const f = inp.dataset.field;
        let val = inp.value.trim();
        if (!val) { valid = false; return; }
        // Handle arrays (choices field)
        if (f === 'choices') {
            val = val.split(',').map(s => s.trim()).filter(Boolean);
        }
        entry[f] = val;
    });

    if (!valid) { alert('Tous les champs sont requis.'); return; }

    try {
        const resp = await api('/api/admin/content/' + type, {
            method: 'POST',
            body: JSON.stringify({ level, entry }),
        });
        if (resp.ok) {
            document.querySelectorAll('#content-add-fields input').forEach(i => i.value = '');
            loadContent();
        } else {
            const err = await resp.json();
            alert(err.error);
        }
    } catch {}
});

async function deleteContentEntry(type, level, index) {
    if (!confirm('Supprimer cette entrée ?')) return;
    try {
        const resp = await api('/api/admin/content/' + type, {
            method: 'DELETE',
            body: JSON.stringify({ level, index }),
        });
        if (resp.ok) {
            loadContent();
        } else {
            const err = await resp.json();
            alert(err.error);
        }
    } catch {}
}

// ====================================================================
// BANNED NAMES
// ====================================================================
document.getElementById('btn-ban').addEventListener('click', async () => {
    const name = document.getElementById('ban-name-input').value.trim();
    if (!name) return;
    try {
        const resp = await api('/api/admin/banned', { method: 'POST', body: JSON.stringify({ name }) });
        if (resp.ok) {
            document.getElementById('ban-name-input').value = '';
            loadBanned();
        } else {
            const err = await resp.json();
            alert(err.error);
        }
    } catch {}
});

async function loadBanned() {
    try {
        const resp = await api('/api/admin/banned');
        const data = await resp.json();
        document.getElementById('banned-body').innerHTML = data.map(b => `
            <tr>
                <td>${esc(b.name)}</td>
                <td>${new Date(b.created_at).toLocaleString('fr')}</td>
                <td><button class="btn-sm btn-danger" onclick="unbanName(${b.id})">Débannir</button></td>
            </tr>
        `).join('');
    } catch {}
}

async function unbanName(id) {
    if (!confirm('Débannir ce nom ?')) return;
    try {
        await api('/api/admin/banned/' + id, { method: 'DELETE' });
        loadBanned();
    } catch {}
}

// ====================================================================
// USER MANAGEMENT
// ====================================================================
async function loadUsers() {
    try {
        const resp = await api('/api/admin/users');
        const users = await resp.json();
        document.getElementById('users-body').innerHTML = users.map(u => `
            <tr>
                <td>${u.id}</td>
                <td>${esc(u.username)} ${u.is_root ? '👑' : ''}</td>
                <td>
                    ${u.is_root ? u.role : `
                    <select onchange="changeRole(${u.id}, this.value)" ${u.is_root ? 'disabled' : ''}>
                        <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                        <option value="superadmin" ${u.role === 'superadmin' ? 'selected' : ''}>Super-admin</option>
                    </select>`}
                </td>
                <td>${new Date(u.created_at).toLocaleString('fr')}</td>
                <td>${u.is_root ? '' : `<button class="btn-sm btn-danger" onclick="deleteUser(${u.id})">🗑️</button>`}</td>
            </tr>
        `).join('');
    } catch {}
}

document.getElementById('btn-create-user').addEventListener('click', async () => {
    const username = document.getElementById('new-user-name').value.trim();
    const password = document.getElementById('new-user-pass').value;
    const role = document.getElementById('new-user-role').value;

    if (!username || !password) { alert('Nom et mot de passe requis.'); return; }
    if (password.length < 6) { alert('Mot de passe : 6 caractères minimum.'); return; }

    try {
        const resp = await api('/api/admin/users', {
            method: 'POST',
            body: JSON.stringify({ username, password, role }),
        });
        if (resp.ok) {
            document.getElementById('new-user-name').value = '';
            document.getElementById('new-user-pass').value = '';
            loadUsers();
        } else {
            const err = await resp.json();
            alert(err.error);
        }
    } catch {}
});

async function deleteUser(id) {
    if (!confirm('Supprimer cet utilisateur ?')) return;
    try {
        const resp = await api('/api/admin/users/' + id, { method: 'DELETE' });
        if (!resp.ok) {
            const err = await resp.json();
            alert(err.error);
        }
        loadUsers();
    } catch {}
}

async function changeRole(id, role) {
    try {
        const resp = await api('/api/admin/users/' + id + '/role', {
            method: 'PUT',
            body: JSON.stringify({ role }),
        });
        if (!resp.ok) {
            const err = await resp.json();
            alert(err.error);
            loadUsers();
        }
    } catch {}
}

// ====================================================================
// LOG
// ====================================================================
async function loadLog() {
    try {
        const resp = await api('/api/admin/log?limit=100');
        const rows = await resp.json();
        document.getElementById('log-body').innerHTML = rows.map(r => `
            <tr>
                <td>${new Date(r.created_at).toLocaleString('fr')}</td>
                <td>${esc(r.username)}</td>
                <td>${esc(r.action)}</td>
                <td>${esc(r.details || '')}</td>
            </tr>
        `).join('');
    } catch {}
}

// ====================================================================
// PASSWORD
// ====================================================================
document.getElementById('password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const statusEl = document.getElementById('pw-status');
    const current = document.getElementById('pw-current').value;
    const newPw = document.getElementById('pw-new').value;
    const confirm = document.getElementById('pw-confirm').value;

    if (newPw !== confirm) {
        statusEl.textContent = 'Les mots de passe ne correspondent pas.';
        statusEl.className = 'error';
        return;
    }

    try {
        const resp = await api('/api/admin/users/me/password', {
            method: 'PUT',
            body: JSON.stringify({ currentPassword: current, newPassword: newPw }),
        });
        const data = await resp.json();
        if (resp.ok) {
            statusEl.textContent = 'Mot de passe modifié avec succès !';
            statusEl.className = 'success';
            document.getElementById('pw-current').value = '';
            document.getElementById('pw-new').value = '';
            document.getElementById('pw-confirm').value = '';
        } else {
            statusEl.textContent = data.error;
            statusEl.className = 'error';
        }
    } catch {
        statusEl.textContent = 'Erreur de connexion.';
        statusEl.className = 'error';
    }
});

// ====================================================================
// PLAYERS
// ====================================================================
let playersPage = 1;

async function loadPlayers() {
    const search = document.getElementById('player-search').value.trim();
    const body = document.getElementById('players-body');
    body.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#64748b">Chargement…</td></tr>';

    try {
        let url = `/api/admin/players?page=${playersPage}&limit=50`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        const resp = await api(url);
        const data = await resp.json();

        if (!data.rows.length) {
            body.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#64748b">Aucun joueur trouvé.</td></tr>';
            document.getElementById('players-pagination').innerHTML = '';
            return;
        }

        body.innerHTML = data.rows.map(u => `
            <tr>
                <td>${u.id}</td>
                <td>${esc(u.username)}</td>
                <td>${esc(u.email)}</td>
                <td>${u.scoreCount}</td>
                <td>${u.created_at ? new Date(u.created_at).toLocaleDateString('fr-FR') : '—'}</td>
                <td><button class="btn btn-danger btn-sm" onclick="deletePlayer(${u.id}, '${esc(u.username)}')">Supprimer</button></td>
            </tr>
        `).join('');

        // Pagination
        const totalPages = Math.ceil(data.total / data.limit);
        let pgHtml = '';
        if (totalPages > 1) {
            if (playersPage > 1) pgHtml += `<button class="btn btn-ghost btn-sm" onclick="playersPage--;loadPlayers()">← Préc.</button>`;
            pgHtml += ` Page ${playersPage} / ${totalPages} `;
            if (playersPage < totalPages) pgHtml += `<button class="btn btn-ghost btn-sm" onclick="playersPage++;loadPlayers()">Suiv. →</button>`;
        }
        document.getElementById('players-pagination').innerHTML = pgHtml;
    } catch {
        body.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#ef4444">Erreur de chargement.</td></tr>';
    }
}

async function deletePlayer(id, name) {
    if (!confirm(`Supprimer le joueur "${name}" ? Ses scores seront anonymisés.`)) return;
    try {
        const resp = await api(`/api/admin/players/${id}`, { method: 'DELETE' });
        if (resp.ok) {
            loadPlayers();
        } else {
            const data = await resp.json();
            alert(data.error || 'Erreur');
        }
    } catch {
        alert('Erreur réseau.');
    }
}

document.getElementById('btn-search-players').addEventListener('click', () => {
    playersPage = 1;
    loadPlayers();
});

document.getElementById('player-search').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { playersPage = 1; loadPlayers(); }
});
