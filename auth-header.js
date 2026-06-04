// ====================================================================
// auth-header.js — Shared authentication header component
// ====================================================================
// Include this script in every page to show login/profile button.
// Exposes window.__authUser (null or {id, username, email}) after init.
// ====================================================================

(async function initAuthHeader() {
    // Build header HTML
    const bar = document.createElement('div');
    bar.id = 'auth-bar';
    bar.innerHTML = `
        <div class="auth-bar-inner">
            <a href="/" class="auth-home-link">🎮 Mini Jeux</a>
            <div id="auth-status"></div>
        </div>
    `;
    document.body.prepend(bar);

    const statusEl = document.getElementById('auth-status');
    window.__authUser = null;

    try {
        const resp = await fetch('/api/user/me', { credentials: 'same-origin' });
        if (resp.ok) {
            const user = await resp.json();
            window.__authUser = user;
            statusEl.innerHTML = `
                <div class="auth-user-menu">
                    <button class="auth-user-btn" id="auth-user-btn">👤 ${escapeHtmlAuth(user.username)}</button>
                    <div class="auth-dropdown hidden" id="auth-dropdown">
                        <a href="/account/profile/">📊 Mon profil</a>
                        <button id="auth-logout-btn">🚪 Déconnexion</button>
                    </div>
                </div>
            `;
            // Toggle dropdown
            document.getElementById('auth-user-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                document.getElementById('auth-dropdown').classList.toggle('hidden');
            });
            document.addEventListener('click', () => {
                const dd = document.getElementById('auth-dropdown');
                if (dd) dd.classList.add('hidden');
            });
            // Logout
            document.getElementById('auth-logout-btn').addEventListener('click', async () => {
                await fetch('/api/user/logout', { method: 'POST', credentials: 'same-origin' });
                window.__authUser = null;
                location.reload();
            });
        } else {
            statusEl.innerHTML = `<a href="/account/login/" class="auth-login-link">Se connecter</a>`;
        }
    } catch {
        statusEl.innerHTML = `<a href="/account/login/" class="auth-login-link">Se connecter</a>`;
    }

    // Dispatch event so other scripts can react
    window.dispatchEvent(new CustomEvent('auth-ready', { detail: window.__authUser }));
})();

function escapeHtmlAuth(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}
