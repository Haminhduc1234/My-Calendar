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

        const _recentNotifTags = new Set();
        function shouldShowNotification(tag) {
            if (!tag) return true;
            if (_recentNotifTags.has(tag)) return false;
            _recentNotifTags.add(tag);
            setTimeout(() => _recentNotifTags.delete(tag), 10000);
            return true;
        }

        async function handleIncomingPush(payload) {
            if (!payload) return;
            console.log("[FCM-SW] handleIncomingPush:", payload);

            const type = payload.data?.notificationType || "event";
            const dateStr = cleanStr(payload.data?.dateKey || payload.data?.date || "");
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

            let rawTitle = cleanStr(payload.notification?.title || payload.data?.title || eventData.title);
            let title = rawTitle ? `🔔 ${rawTitle}` : "🔔 Sự kiện mới trên Lịch Việt";

            if (type === "cashflow") {
                const isExpense = cashflowType === "expense";
                if (!rawTitle) title = isExpense ? "💸 Chi tiêu mới" : "💰 Thu nhập mới";
                if (amount) bodyParts.push(`${Number(amount).toLocaleString("vi-VN")} đ`);
                if (category) bodyParts.push(category);
                if (dateStr) bodyParts.push(`Ngày ${dateStr}`);
                const noteText = payload.data?.text || payload.data?.note || eventData.text || eventData.note;
                if (noteText) bodyParts.push(noteText);
                if (hasImage) bodyParts.push("📎 Kèm hình ảnh");
                targetUrl = targetUrl !== "./" ? targetUrl : (
                    `./?action=cashflow&id=${encodeURIComponent(payload.data?.eventId || eventData.id || "")}&date=${encodeURIComponent(dateStr || "")}&amount=${encodeURIComponent(amount)}&category=${encodeURIComponent(category)}&cashflowType=${encodeURIComponent(cashflowType)}&note=${encodeURIComponent(noteText || "")}&createdAt=${encodeURIComponent(eventData.createdAt || Date.now())}`
                );
            } else if (
                type === "fund_allocation" ||
                type === "funds" ||
                type === "fund_topup" ||
                type === "fund_withdraw" ||
                type === "fund_delete" ||
                type === "fund_create" ||
                type === "fund_update"
            ) {
                const fundName = payload.data?.fundName || eventData.fundName || "Quỹ";
                if (!rawTitle) {
                    if (type === "fund_withdraw") title = `💸 Lấy tiền ra từ quỹ: ${fundName}`;
                    else if (type === "fund_delete") title = `🗑️ Xóa quỹ: ${fundName}`;
                    else if (type === "fund_topup") title = `💰 Thêm vào quỹ: ${fundName}`;
                    else if (type === "fund_create") title = `✨ Tạo quỹ mới: ${fundName}`;
                    else if (type === "fund_update") title = `✏️ Cập nhật quỹ: ${fundName}`;
                    else title = `📊 Phân bổ quỹ: ${fundName}`;
                }
                if (fundName) bodyParts.push(`Quỹ: ${fundName}`);
                if (amount && Number(amount) > 0) bodyParts.push(`${Number(amount).toLocaleString("vi-VN")} đ`);
                if (dateStr) bodyParts.push(`Ngày ${dateStr}`);
                const noteText = payload.data?.text || payload.data?.note || eventData.text || eventData.note;
                if (noteText) bodyParts.push(noteText);
                targetUrl = targetUrl !== "./" ? targetUrl : `./?action=funds&id=${encodeURIComponent(payload.data?.eventId || eventData.id || "")}&fundName=${encodeURIComponent(fundName)}&amount=${encodeURIComponent(amount)}&note=${encodeURIComponent(noteText || "")}&createdAt=${encodeURIComponent(eventData.createdAt || Date.now())}`;
            } else {
                if (!rawTitle) title = "🔔 Sự kiện mới trên Lịch Việt";
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

            const notifBody = cleanStr(payload.notification?.body) || (bodyParts.length > 0 ? bodyParts.join(" | ") : (payload.data?.body || payload.notification?.body)) || "Bạn có một thông báo mới";
            const eventId = cleanStr(payload.data?.eventId || payload.data?.id || eventData.id);
            const notificationTag = payload.data?.tag || (eventId ? `event-${eventId}` : `notify-${type}-${dateStr || Date.now()}`);

            if (!shouldShowNotification(notificationTag)) {
                console.log("[FCM-SW] Bỏ qua thông báo trùng lặp:", notificationTag);
                return;
            }

            return self.registration.showNotification(title, {
                body: notifBody,
                icon: "/public/favicon.png",
                badge: "/public/favicon.png",
                tag: notificationTag,
                renotify: true,
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
        }

        messaging.onBackgroundMessage((payload) => {
            console.log("[FCM-SW] onBackgroundMessage received:", payload);
            return handleIncomingPush(payload);
        });

        self.addEventListener("push", (event) => {
            console.log("[FCM-SW] Native push event received:", event);
            let payload = {};
            if (event.data) {
                try {
                    payload = event.data.json();
                } catch (e) {
                    try {
                        payload = { data: { text: event.data.text() } };
                    } catch (e2) { }
                }
            }
            event.waitUntil(handleIncomingPush(payload));
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
