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
            let targetUrl = payload.data?.url || payload.fcmOptions?.link || "./";
            const bodyParts = [];

            let eventData = {};
            if (payload.data?.eventDataJson) {
                try { eventData = JSON.parse(payload.data.eventDataJson); } catch (e) { }
            }

            const amount = payload.data?.amount || eventData.amount || "";
            const category = payload.data?.category || eventData.category || "";
            const cashflowType = payload.data?.cashflowType || eventData.cashflowType || "";
            const hasImage = payload.data?.hasImage === "true" || payload.data?.hasImage === true || eventData.hasImage;

            let title = payload.data?.title || payload.notification?.title || "";

            if (type === "cashflow") {
                const isExpense = cashflowType === "expense";
                if (!title) title = isExpense ? "💸 Chi tiêu mới" : "💰 Thu nhập mới";
                if (amount) bodyParts.push(`${Number(amount).toLocaleString("vi-VN")} đ`);
                if (category) bodyParts.push(category);
                if (dateStr) bodyParts.push(`Ngày ${dateStr}`);
                const noteText = payload.data?.text || payload.data?.note || eventData.text || eventData.note;
                if (noteText) bodyParts.push(noteText);
                if (hasImage) bodyParts.push("📎 Kèm hình ảnh");
                targetUrl = targetUrl !== "./" ? targetUrl : (
                    `./?action=cashflow&id=${encodeURIComponent(payload.data?.eventId || eventData.id || "")}&date=${encodeURIComponent(dateStr || "")}&amount=${encodeURIComponent(amount)}&category=${encodeURIComponent(category)}&cashflowType=${encodeURIComponent(cashflowType)}&note=${encodeURIComponent(noteText || "")}&createdAt=${encodeURIComponent(eventData.createdAt || Date.now())}`
                );
            } else if (type === "fund_allocation" || type === "funds") {
                const fundName = payload.data?.fundName || eventData.fundName || "Quỹ";
                if (!title) title = `📊 Phân bổ quỹ: ${fundName}`;
                if (amount) bodyParts.push(`${Number(amount).toLocaleString("vi-VN")} đ`);
                if (dateStr) bodyParts.push(`Ngày ${dateStr}`);
                const noteText = payload.data?.text || payload.data?.note || eventData.text || eventData.note;
                if (noteText) bodyParts.push(noteText);
                targetUrl = targetUrl !== "./" ? targetUrl : `./?action=funds&id=${encodeURIComponent(payload.data?.eventId || eventData.id || "")}&fundName=${encodeURIComponent(fundName)}&amount=${encodeURIComponent(amount)}&note=${encodeURIComponent(noteText || "")}&createdAt=${encodeURIComponent(eventData.createdAt || Date.now())}`;
            } else {
                if (!title) title = "🔔 Sự kiện mới trên Lịch Việt";
                if (dateStr) bodyParts.push(`Ngày ${dateStr}`);
                const evDateTime = payload.data?.eventDateTime || eventData.eventDateTime;
                if (evDateTime) {
                    try {
                        const dt = new Date(evDateTime);
                        if (!Number.isNaN(dt.getTime())) {
                            bodyParts.push(`Lúc ${dt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`);
                        }
                    } catch { }
                }
                const noteText = payload.data?.text || payload.data?.note || eventData.text || eventData.note;
                if (noteText) bodyParts.push(noteText);
                targetUrl = targetUrl !== "./" ? targetUrl : (
                    `./?action=event&id=${encodeURIComponent(payload.data?.eventId || eventData.id || "")}&title=${encodeURIComponent(title)}&text=${encodeURIComponent(noteText || "")}&note=${encodeURIComponent(noteText || "")}&eventDateTime=${encodeURIComponent(evDateTime || "")}&color=${encodeURIComponent(payload.data?.color || eventData.color || "")}&createdAt=${encodeURIComponent(eventData.createdAt || Date.now())}&date=${encodeURIComponent(dateStr || "")}`
                );
            }

            const finalBody = (bodyParts.length > 0 ? bodyParts.join(" | ") : (payload.data?.body || payload.notification?.body)) || "Bạn có một thông báo mới";

            return self.registration.showNotification(title, {
                body: finalBody,
                icon: "/public/favicon.png",
                badge: "/public/favicon.png",
                tag: `notify-${type}-${dateStr || payload.data?.eventId || Date.now()}`,
                vibrate: [200, 100, 200],
                data: {
                    url: targetUrl,
                    dateKey: dateStr,
                    notificationType: type,
                    eventData: {
                        ...(eventData || {}),
                        ...(payload.data || {})
                    }
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
