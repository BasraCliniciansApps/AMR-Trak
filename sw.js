const CACHE_NAME = 'amr-dashboard-cache-v1';

// قائمة بالملفات والروابط الخارجية التي يعتمد عليها تطبيق الهاتف
const PRECACHE_URLS = [
    './',
    './dashboard.html',
    './js/data.js',
    './js/dashboard.js?v=2.0',
    './manifest.json',
    './icon.png',
    'https://cdn.tailwindcss.com',
    'https://code.jquery.com/jquery-3.7.0.min.js',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/css/select2.min.css',
    'https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/js/select2.min.js',
    'https://cdn.jsdelivr.net/npm/sweetalert2@11',
    'https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore-compat.js'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(PRECACHE_URLS);
        })
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
    // تخطي طلبات فايربيس (لكي لا تتعارض المزامنة الحية مع الكاش)
    if (event.request.url.includes('firestore.googleapis.com')) return;

    event.respondWith(
        fetch(event.request)
            .then(response => {
                // تحديث الكاش بالملفات الجديدة بصمت عند توفر الانترنت
                if (response && response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
                }
                return response;
            })
            .catch(() => {
                // في حال غياب الإنترنت، اجلب الملفات من الكاش
                return caches.match(event.request);
            })
    );
});
