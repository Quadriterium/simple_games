const CACHE_NAME = 'simple-games-v5';
const ASSETS = [
    '/',
    '/index.html',
    '/landing.css',
    '/style.css',
    '/script.js',
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png',
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
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
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

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Don't cache API calls — let them fail naturally when offline
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(fetch(event.request).catch(() =>
            new Response(JSON.stringify({ error: 'offline' }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' },
            })
        ));
        return;
    }

    // Network-first for HTML pages, cache-first for assets
    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) {
                // Exact match found — serve from cache, update in background
                const fetching = fetch(event.request).then((response) => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                    }
                    return response;
                }).catch(() => cached);
                return cached || fetching;
            }

            // No exact match — if URL has no trailing slash, redirect to slashed version
            // so relative CSS/JS paths resolve correctly
            if (!url.pathname.endsWith('/') && !url.pathname.includes('.')) {
                return caches.match(url.pathname + '/').then((slashed) => {
                    if (slashed) {
                        return Response.redirect(url.pathname + '/', 302);
                    }
                    return fetch(event.request).then((response) => {
                        if (response.ok) {
                            const clone = response.clone();
                            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                        }
                        return response;
                    }).catch(() => new Response('Offline', { status: 503 }));
                });
            }

            // No cache match — try network
            return fetch(event.request).then((response) => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                }
                return response;
            }).catch(() => new Response('Offline', { status: 503 }));
        })
    );
});
