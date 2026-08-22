importScripts("./firebase-config.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

if (self.FIREBASE_WEB_CONFIG && self.FIREBASE_WEB_CONFIG.messagingSenderId) {
    try {
        firebase.initializeApp(self.FIREBASE_WEB_CONFIG);
        const messaging = firebase.messaging();

        messaging.onBackgroundMessage((payload) => {
            console.log("[FCM-SW] onBackgroundMessage received:", payload);

            // Nếu payload đã chứa block notification, Firebase SDK sẽ tự động hiển thị thông báo.
            // Tránh gọi showNotification thủ công tại đây để không bị bắn 2 thông báo trùng nhau.
            if (payload.notification) {
                console.log("[FCM-SW] Notification handled automatically by SDK.");
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
                targetUrl = targetUrl !== "./" ? targetUrl : (
                    `./?action=event&title=${encodeURIComponent(payload.data?.title || "")}&text=${encodeURIComponent(payload.data?.text || "")}&eventDateTime=${encodeURIComponent(payload.data?.eventDateTime || "")}&color=${encodeURIComponent(payload.data?.color || "")}&date=${encodeURIComponent(dateStr || "")}`
                );
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
        console.error("[FCM-SW] Firebase messaging init failed:", e);
    }
}

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
