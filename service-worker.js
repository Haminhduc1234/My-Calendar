importScripts("./firebase-config.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

if (self.FIREBASE_WEB_CONFIG && self.FIREBASE_WEB_CONFIG.messagingSenderId) {
    try {
        firebase.initializeApp(self.FIREBASE_WEB_CONFIG);
        const messaging = firebase.messaging();

        messaging.onBackgroundMessage((payload) => {
            console.log("[SW] onBackgroundMessage received:", payload);

            // Nếu payload đã chứa block notification, Firebase SDK sẽ tự động hiển thị thông báo.
            // Tránh gọi showNotification thủ công tại đây để không bị bắn 2 thông báo trùng nhau.
            if (payload.notification) {
                console.log("[SW] Notification handled automatically by SDK.");
                return;
            }

            const title = payload.data?.title || "🔔 Sự kiện mới trên Lịch Việt";
            const bodyParts = [];

            const dateStr = payload.data?.dateKey || payload.data?.date;
            if (dateStr) bodyParts.push(`Ngày ${dateStr}`);
            if (payload.data?.eventDateTime) {
                try {
                    const dt = new Date(payload.data.eventDateTime);
                    if (!Number.isNaN(dt.getTime())) {
                        bodyParts.push(`Lúc ${dt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`);
                    }
                } catch { }
            }
            if (payload.notification?.body) bodyParts.push(payload.notification.body);
            else if (payload.data?.text) bodyParts.push(payload.data.text);
            if (Number(payload.data?.overtimeHours || 0) > 0) bodyParts.push(`OT: ${payload.data.overtimeHours}h`);

            const targetUrl = payload.data?.url || payload.fcmOptions?.link || (dateStr ? `./?date=${dateStr}` : "./");

            return self.registration.showNotification(title, {
                body: bodyParts.join(" | ") || "Bạn có một sự kiện mới vừa được thêm",
                icon: "/public/favicon.png",
                badge: "/public/favicon.png",
                tag: `event-${dateStr || payload.data?.eventId || Date.now()}`,
                vibrate: [200, 100, 200],
                data: {
                    url: targetUrl,
                    dateKey: dateStr
                }
            });
        });
    } catch (e) {
        console.error("[SW] Firebase messaging init failed:", e);
    }
}

const CACHE_NAME = "calendar-pwa-v7";
const FILES_TO_CACHE = [
    "./",
    "./index.html",
    "./firebase-config.js",
    "./firebase-messaging-sw.js",
    "./style.css",
    "./learn-en-data.js",
    "./learn-zh-data.js",
    "./script.js",
    "./manifest.json",
    "./public/favicon.png",
    "./public/quote.png",
    "./public/google-maps.png",
    "./public/mostly-sunny.png",
    "./public/sun.png"
];

self.addEventListener("install", e => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE))
    );
});

self.addEventListener("fetch", e => {
    // Không cache các request API hoặc Firebase
    if (
        e.request.url.includes("/api/") || 
        e.request.url.includes("firestore") || 
        e.request.url.includes("firebase") ||
        e.request.method !== "GET"
    ) {
        return;
    }

    e.respondWith(
        fetch(e.request)
            .then(response => {
                if (response && response.status === 200 && response.type === 'basic') {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(e.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                return caches.match(e.request);
            })
    );
});

self.addEventListener("activate", e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.map(k => k !== CACHE_NAME && caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const targetUrl = event.notification.data?.url || "./";

    event.waitUntil(
        clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if ("focus" in client) {
                    if ("navigate" in client && targetUrl !== "./") {
                        client.navigate(targetUrl);
                    }
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});
