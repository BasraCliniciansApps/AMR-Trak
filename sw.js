const CACHE_NAME = 'amr-tracker-cache-v1';

const PRECACHE_URLS = [
    './',
    './index.html',
    './dashboard.html',
    './css/style.css',
    './css/jquery.dataTables.min.css',
    './css/buttons.dataTables.min.css',
    './css/select2.min.css',
    './js/tailwindcss.js',
    './js/jquery.min.js',
    './js/jquery.dataTables.min.js',
    './js/dataTables.buttons.min.js',
    './js/jszip.min.js',
    './js/buttons.html5.min.js',
    './js/buttons.print.min.js',
    './js/select2.min.js',
    './js/sweetalert2.min.js',
    './js/chart.min.js',
    './js/xlsx-populate.min.js',
    './js/FileSaver.min.js',
    './js/xlsx.full.min.js',
    './js/firebase-app-compat.js',
    './js/firebase-auth-compat.js',
    './js/firebase-firestore-compat.js',
    './js/data.js',
    './js/app.js',
    './js/dashboard.js',
    './manifest.json',
    './icon.png',
    './organisms_dictionary.json',
    './specimens_dictionary.json',
    './Antibiogram_5.xlsx'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) return caches.delete(cache);
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    if (event.request.url.includes('firestore.googleapis.com')) return;

    event.respondWith(
        fetch(event.request)
            .then(response => {
                if (response && response.status === 200 && response.type === 'basic') {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
                }
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});
