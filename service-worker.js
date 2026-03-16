importScripts("./firebase-config.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

if (self.FIREBASE_WEB_CONFIG && self.FIREBASE_WEB_CONFIG.messagingSenderId) {
    firebase.initializeApp(self.FIREBASE_WEB_CONFIG);

    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
        const title = payload.notification?.title || payload.data?.title || "Sự kiện mới";
        const bodyParts = [];

        if (payload.data?.date) bodyParts.push(`Ngày ${payload.data.date}`);
        if (payload.notification?.body) bodyParts.push(payload.notification.body);
        else if (payload.data?.text) bodyParts.push(payload.data.text);
        if (Number(payload.data?.overtimeHours || 0) > 0) bodyParts.push(`OT: ${payload.data.overtimeHours}h`);

        self.registration.showNotification(title, {
            body: bodyParts.join(" | ") || "Bạn có một sự kiện mới",
            icon: "./public/favicon.png",
            badge: "./public/favicon.png",
            tag: `event-${payload.data?.eventId || Date.now()}`,
            data: {
                url: payload.fcmOptions?.link || "./"
            }
        });
    });
}

const CACHE_NAME = "calendar-pwa-v4";
const FILES_TO_CACHE = [
    "./",
    "./index.html",
    "./firebase-config.js",
    "./style.css",
    "./script.js",
    "./manifest.json",
    "./public/favicon.png",
    "./public/quote.png",
    "./public/google-maps.png",
    "./public/mostly-sunny.png",
    "./public/sun.png"
];

self.addEventListener("install", e => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE))
    );
});

self.addEventListener("fetch", e => {
    e.respondWith(
        caches.match(e.request).then(res => res || fetch(e.request))
    );
});
self.addEventListener("activate", e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.map(k => k !== CACHE_NAME && caches.delete(k)))
        )
    );
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    event.waitUntil(clients.openWindow(event.notification.data?.url || "./"));
});
