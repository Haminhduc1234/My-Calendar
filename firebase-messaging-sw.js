importScripts("./firebase-config.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

if (self.FIREBASE_WEB_CONFIG && self.FIREBASE_WEB_CONFIG.messagingSenderId) {
    try {
        firebase.initializeApp(self.FIREBASE_WEB_CONFIG);
        const messaging = firebase.messaging();

        messaging.onBackgroundMessage((payload) => {
            console.log("[FCM-SW] onBackgroundMessage received:", payload);
            const title = payload.notification?.title || payload.data?.title || "🔔 Sự kiện mới trên Lịch Việt";
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
                icon: "./public/favicon.png",
                badge: "./public/favicon.png",
                tag: `event-${dateStr || payload.data?.eventId || Date.now()}`,
                vibrate: [200, 100, 200],
                data: {
                    url: targetUrl,
                    dateKey: dateStr
                }
            });
        });
    } catch (e) {
        console.error("[FCM-SW] Firebase messaging init failed:", e);
    }
}

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
