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

            const type = payload.data?.notificationType || "event";
            const dateStr = payload.data?.dateKey || payload.data?.date || "";
            let title = payload.data?.title || "🔔 Sự kiện mới trên Lịch Việt";
            let targetUrl = payload.data?.url || payload.fcmOptions?.link || "./";
            const bodyParts = [];

            if (type === "cashflow") {
                const isExpense = payload.data?.cashflowType === "expense";
                title = payload.data?.title || (isExpense ? "💸 Chi tiêu mới" : "💰 Thu nhập mới");
                if (payload.data?.category) bodyParts.push(payload.data.category);
                if (payload.data?.amount) bodyParts.push(`${Number(payload.data.amount).toLocaleString("vi-VN")} đ`);
                if (payload.data?.text) bodyParts.push(payload.data.text);
                targetUrl = targetUrl !== "./" ? targetUrl : (
                    `./?action=cashflow&id=${encodeURIComponent(payload.data?.id || "")}&date=${encodeURIComponent(dateStr || "")}&amount=${encodeURIComponent(payload.data?.amount || "")}&category=${encodeURIComponent(payload.data?.category || "")}&cashflowType=${encodeURIComponent(payload.data?.cashflowType || "")}&note=${encodeURIComponent(payload.data?.text || payload.data?.note || "")}`
                );
            } else if (type === "fund_allocation") {
                title = payload.data?.title || "📊 Phân bổ quỹ mới";
                if (payload.data?.fundName) bodyParts.push(`Quỹ: ${payload.data.fundName}`);
                if (payload.data?.amount) bodyParts.push(`${Number(payload.data.amount).toLocaleString("vi-VN")} đ`);
                if (payload.data?.text) bodyParts.push(payload.data.text);
                targetUrl = targetUrl !== "./" ? targetUrl : "./?action=funds";
            } else {
                if (dateStr) bodyParts.push(`Ngày ${dateStr}`);
                if (payload.data?.eventDateTime) {
                    try {
                        const dt = new Date(payload.data.eventDateTime);
                        if (!Number.isNaN(dt.getTime())) {
                            bodyParts.push(`Lúc ${dt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`);
                        }
                    } catch { }
                }
                if (payload.data?.text) bodyParts.push(payload.data.text);
                if (Number(payload.data?.overtimeHours || 0) > 0) bodyParts.push(`OT: ${payload.data.overtimeHours}h`);
                targetUrl = targetUrl !== "./" ? targetUrl : (dateStr ? `./?date=${dateStr}` : "./");
            }

            if (payload.notification?.body) bodyParts.push(payload.notification.body);

            return self.registration.showNotification(title, {
                body: bodyParts.join(" | ") || "Bạn có một thông báo mới",
                icon: "/public/favicon.png",
                badge: "/public/favicon.png",
                tag: `notify-${type}-${dateStr || payload.data?.eventId || Date.now()}`,
                vibrate: [200, 100, 200],
                data: {
                    url: targetUrl,
                    dateKey: dateStr,
                    notificationType: type,
                    eventData: payload.data
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
    const notificationData = event.notification.data || {};

    event.waitUntil(
        clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if ("focus" in client) {
                    client.postMessage({
                        type: "NOTIFICATION_CLICKED",
                        url: targetUrl,
                        data: notificationData,
                        notificationType: notificationData.notificationType,
                        dateKey: notificationData.dateKey,
                        eventData: notificationData.eventData
                    });
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(new URL(targetUrl, self.location.origin).href);
            }
        })
    );
});
