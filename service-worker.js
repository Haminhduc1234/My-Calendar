importScripts("./firebase-config.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

if (self.FIREBASE_WEB_CONFIG && self.FIREBASE_WEB_CONFIG.messagingSenderId) {
    try {
        firebase.initializeApp(self.FIREBASE_WEB_CONFIG);
        const messaging = firebase.messaging();

        function cleanStr(val) {
            if (!val) return "";
            const s = String(val).trim();
            if (s.toLowerCase() === "undefined" || s.toLowerCase() === "null" || s.includes("Promise") || s === "[object Promise]") {
                return "";
            }
            return s;
        }

        messaging.onBackgroundMessage((payload) => {
            console.log("[SW] onBackgroundMessage received:", payload);

            // Nếu payload đã chứa block notification, Firebase SDK sẽ tự động hiển thị thông báo.
            if (payload.notification) {
                console.log("[SW] Notification handled automatically by SDK.");
                return;
            }

            let parsedEventData = {};
            if (payload.data?.eventDataJson) {
                try { parsedEventData = JSON.parse(payload.data.eventDataJson); } catch (e) { }
            }

            const type = payload.data?.notificationType || "event";
            const dateStr = cleanStr(payload.data?.dateKey || payload.data?.date || parsedEventData.date);
            let rawTitle = cleanStr(payload.data?.title || parsedEventData.title);
            let title = rawTitle ? `🔔 ${rawTitle}` : "🔔 Sự kiện mới trên Lịch Việt";
            let targetUrl = payload.data?.url || payload.fcmOptions?.link || "./";
            const bodyParts = [];

            const eventNote = cleanStr(payload.data?.text || payload.data?.note || parsedEventData.text || parsedData?.note || parsedEventData.note);

            if (type === "cashflow") {
                const isExpense = (payload.data?.cashflowType || parsedEventData.cashflowType) === "expense";
                title = rawTitle || (isExpense ? "💸 Chi tiêu mới" : "💰 Thu nhập mới");
                const cat = cleanStr(payload.data?.category || parsedEventData.category);
                if (cat) bodyParts.push(cat);
                const amt = payload.data?.amount || parsedEventData.amount;
                if (amt) bodyParts.push(`${Number(amt).toLocaleString("vi-VN")} đ`);
                if (eventNote) bodyParts.push(eventNote);
            } else if (type === "fund_allocation" || type === "funds") {
                title = rawTitle || "📊 Phân bổ quỹ mới";
                const fn = cleanStr(payload.data?.fundName || parsedEventData.fundName);
                if (fn) bodyParts.push(`Quỹ: ${fn}`);
                const amt = payload.data?.amount || parsedEventData.amount;
                if (amt) bodyParts.push(`${Number(amt).toLocaleString("vi-VN")} đ`);
                if (eventNote) bodyParts.push(eventNote);
            } else {
                if (dateStr) bodyParts.push(`Ngày ${dateStr}`);
                const dtStr = payload.data?.eventDateTime || parsedEventData.eventDateTime;
                if (dtStr) {
                    try {
                        const dt = new Date(dtStr);
                        if (!Number.isNaN(dt.getTime())) {
                            bodyParts.push(`Lúc ${dt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`);
                        }
                    } catch { }
                }
                if (eventNote) bodyParts.push(eventNote);
            }

            const eventId = cleanStr(payload.data?.eventId || payload.data?.id);
            const notificationTag = payload.data?.tag || (eventId ? `event-${eventId}` : `notify-${type}-${dateStr || Date.now()}`);

            return self.registration.showNotification(title, {
                body: bodyParts.join(" | ") || "Bạn có một thông báo mới",
                icon: "/public/favicon.png",
                badge: "/public/favicon.png",
                tag: notificationTag,
                renotify: false,
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

const CACHE_NAME = "calendar-pwa-v11-" + Date.now();
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
