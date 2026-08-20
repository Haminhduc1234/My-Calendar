const admin = require("firebase-admin");

// Khởi tạo Firebase Admin SDK từ biến môi trường FIREBASE_SERVICE_ACCOUNT
if (!admin.apps.length) {
  let cert = null;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      cert = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch (e) {
      console.error("[API] Lỗi parse JSON FIREBASE_SERVICE_ACCOUNT:", e);
    }
  }

  if (cert) {
    admin.initializeApp({
      credential: admin.credential.cert(cert),
      databaseURL: "https://calendar-ac2fa-default-rtdb.firebaseio.com"
    });
    console.log("[API] Firebase Admin đã được khởi tạo thành công.");
  } else {
    console.warn("[API] Cảnh báo: Biến môi trường FIREBASE_SERVICE_ACCOUNT chưa được thiết lập trên Vercel.");
  }
}

module.exports = async (req, res) => {
  // CORS Headers cho phép gọi từ cả domain web app
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Only POST is supported." });
  }

  try {
    const { profileKey, eventData, dateKey, senderDeviceId } = req.body || {};

    if (!profileKey || !eventData) {
      return res.status(400).json({ error: "Thiếu profileKey hoặc eventData." });
    }

    if (!admin.apps.length) {
      return res.status(500).json({
        error: "Chưa cấu hình FIREBASE_SERVICE_ACCOUNT trong Environment Variables của Vercel."
      });
    }

    const db = admin.database();
    const snap = await db.ref(`notificationTokens/${profileKey}`).get();
    const tokenMap = snap.val() || {};

    const tokens = [];
    Object.keys(tokenMap).forEach((devId) => {
      // Bỏ qua thiết bị hiện tại nếu là người tạo sự kiện
      if (senderDeviceId && devId === senderDeviceId) return;
      const t = tokenMap[devId]?.token;
      if (t && typeof t === "string" && !tokens.includes(t)) {
        tokens.push(t);
      }
    });

    if (tokens.length === 0) {
      return res.status(200).json({
        success: true,
        message: "Không có thiết bị nhận nào khác đang đăng ký token.",
        sentCount: 0
      });
    }

    const title = eventData.title ? `🔔 ${eventData.title}` : "🔔 Sự kiện mới từ thiết bị khác";
    const bodyParts = [];
    if (dateKey) bodyParts.push(`Ngày ${dateKey}`);
    if (eventData.eventDateTime) {
      try {
        const dt = new Date(eventData.eventDateTime);
        if (!Number.isNaN(dt.getTime())) {
          bodyParts.push(`Lúc ${dt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`);
        }
      } catch (e) {}
    }
    if (eventData.text) bodyParts.push(eventData.text);
    const body = bodyParts.join(" | ") || "Bạn có một sự kiện mới.";

    const message = {
      tokens: tokens,
      notification: {
        title: title,
        body: body
      },
      data: {
        title: title,
        body: body,
        dateKey: String(dateKey || ""),
        url: `/?date=${dateKey || ""}`
      },
      webpush: {
        fcmOptions: {
          link: `/?date=${dateKey || ""}`
        },
        notification: {
          icon: "/public/favicon.png",
          badge: "/public/favicon.png",
          vibrate: [200, 100, 200]
        }
      }
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`[API Push] Đã gửi ${response.successCount} thông báo thành công, ${response.failureCount} thất bại.`);

    return res.status(200).json({
      success: true,
      sentCount: response.successCount,
      failureCount: response.failureCount
    });
  } catch (err) {
    console.error("[API Push] Lỗi gửi thông báo:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
};
