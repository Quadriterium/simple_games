const CACHE_NAME = 'simple-games-v12';
const ASSETS = [
    '/',
    '/index.html',
    '/landing.css',
    '/style.css',
    '/script.js',
    '/auth-header.js',
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png',
    // Account pages
    '/account/',
    '/account/login/',
    '/account/register/',
    '/account/profile/',
    '/account/account.css',
    // Classic games landing
    '/jeux/',
    '/jeux/index.html',
    '/jeux/landing.css',
    // Classic games pages
    '/jeux/couronnes/',
    '/jeux/couronnes.js',
    '/jeux/sudoku/',
    '/jeux/sudoku.js',
    '/jeux/picross/',
    '/jeux/picross.js',
    // Math landing
    '/math/',
    '/math/index.html',
    '/math/landing.css',
    '/math/shared.css',
    '/math/shared.js',
    // Math exercises
    '/math/multiplications/',
    '/math/additions/',
    '/math/soustractions/',
    '/math/divisions/',
    '/math/divisions-posees/',
    '/math/complements/',
    '/math/mixte/',
    '/math/comparaisons/',
    // French landing
    '/francais/',
    '/francais/index.html',
    '/francais/landing.css',
    '/francais/shared.css',
    '/francais/shared.js',
    // French exercises
    '/francais/conjugaison/',
    '/francais/homophones/',
    '/francais/pluriels/',
    '/francais/feminin-masculin/',
    '/francais/vocabulaire/',
    '/francais/orthographe/',
    // Geography landing
    '/geographie/',
    '/geographie/index.html',
    '/geographie/landing.css',
    '/geographie/shared.css',
    // Geography games
    '/geographie/departements/',
    '/geographie/departements/departements.js',
    '/geographie/continents/',
    '/geographie/continents/continents.js',
    '/geographie/assets/optimized/france-departements.svg',
    '/geographie/assets/optimized/world-continents.svg',
    // French content (for offline fallback)
    '/api/content/conjugaison',
    '/api/content/homophone',
    '/api/content/pluriel',
    '/api/content/feminin-masculin',
    '/api/content/vocabulaire',
    '/api/content/orthographe',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) =>
            Promise.allSettled(
                ASSETS.map(url =>
                    fetch(url, { credentials: 'same-origin' })
                        .then(r => { if (r.ok) return cache.put(url, r); })
                        .catch(() => { /* ignore individual asset failures */ })
                )
            )
        )
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// ---- helpers ----

function networkOnly(request) {
    return fetch(request).catch(() =>
        new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
    );
}

function cacheFirst(request) {
    return caches.match(request).then(cached => cached || fetch(request).then(r => {
        if (r.ok) caches.open(CACHE_NAME).then(c => c.put(request, r.clone()));
        return r;
    }));
}

function staleWhileRevalidate(request) {
    return caches.match(request).then(cached => {
        const network = fetch(request).then(r => {
            if (r.ok) caches.open(CACHE_NAME).then(c => c.put(request, r.clone()));
            return r;
        }).catch(() => cached || new Response(JSON.stringify({ error: 'offline' }), {
            status: 503, headers: { 'Content-Type': 'application/json' },
        }));
        return cached || network;
    });
}

// ---- fetch handler ----

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Only handle same-origin requests
    if (url.origin !== self.location.origin) return;

    try {
        // Admin and user auth routes: never cache, always network (with credentials)
        if (url.pathname.startsWith('/admin') || url.pathname.startsWith('/api/admin') || url.pathname.startsWith('/api/user')) {
            event.respondWith(
                fetch(event.request).catch(() =>
                    new Response('Offline', { status: 503 })
                )
            );
            return;
        }

        // Navigation requests (HTML pages): network-first, fallback to cache
        // Chrome REQUIRES this to never reject — a rejected respondWith = ERR_CONNECTION_RESET
        if (event.request.mode === 'navigate') {
            event.respondWith(
                fetch(event.request).then(r => {
                    if (r.ok) caches.open(CACHE_NAME).then(c => c.put(event.request, r.clone()));
                    return r;
                }).catch(() =>
                    // Try exact URL, then root, then offline page
                    caches.match(event.request)
                        .then(c => c || caches.match('/'))
                        .then(c => c || new Response('Offline — rechargez quand la connexion est rétablie.', {
                            status: 503,
                            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
                        }))
                )
            );
            return;
        }

        // French content API: stale-while-revalidate for offline support
        if (url.pathname.startsWith('/api/content/')) {
            event.respondWith(staleWhileRevalidate(event.request));
            return;
        }

        // Other API calls: network only
        if (url.pathname.startsWith('/api/')) {
            event.respondWith(networkOnly(event.request));
            return;
        }

        // Static assets: cache-first
        event.respondWith(
            cacheFirst(event.request).catch(() =>
                new Response('Offline', { status: 503 })
            )
        );
    } catch (err) {
        // Synchronous errors must not crash the SW — Chrome shows ERR_CONNECTION_RESET
        event.respondWith(fetch(event.request).catch(() =>
            new Response('Offline', { status: 503 })
        ));
    }
});
