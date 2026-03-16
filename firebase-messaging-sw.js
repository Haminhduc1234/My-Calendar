importScripts("./firebase-config.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

if (self.FIREBASE_WEB_CONFIG && self.FIREBASE_WEB_CONFIG.messagingSenderId) {
    firebase.initializeApp(self.FIREBASE_WEB_CONFIG);

    const messaging = firebase.messaging();
    console.log(messaging);
    

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

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    event.waitUntil(clients.openWindow(event.notification.data?.url || "./"));
});
