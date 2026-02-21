const CACHE_NAME = 'alpkasa-v1-offline';

// Sen listeyi tam verdiğin için tüm dosyaları eksiksiz buraya ekliyoruz
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './logo-192.png',
    './logo-512.png',
    './js/app.js',
    './js/calendar.js',
    './js/crypto.js',
    './js/db.js',
    './sounds/alarm_1.mp3',
    './sounds/alarm_2.mp3',
    './sounds/alarm_3.mp3',
    './sounds/alarm_4.mp3'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            // Çevrimdışıysa cache'den (telefondan) getir, değilse internetten çekmeye çalış
            return response || fetch(event.request);
        })
    );
});