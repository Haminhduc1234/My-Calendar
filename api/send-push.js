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
    const { profileKey, eventData, dateKey, senderDeviceId, notificationType } = req.body || {};

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
    Object.entries(tokenMap).forEach(([devId, value]) => {
      // Bỏ qua thiết bị hiện tại nếu là người tạo sự kiện
      if (senderDeviceId && devId === senderDeviceId) return;
      const t = typeof value === "string" ? value : value?.token;
      if (t && typeof t === "string" && t.length > 20 && !tokens.includes(t)) {
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

    // Xây dựng title, body, url tùy theo notificationType
    const type = notificationType || "event";
    let title = "";
    const bodyParts = [];
    let targetUrl = "/";

    if (type === "cashflow") {
      const isExpense = eventData.cashflowType === "expense";
      title = isExpense ? "💸 Chi tiêu mới" : "💰 Thu nhập mới";
      if (eventData.amount) bodyParts.push(`${Number(eventData.amount).toLocaleString("vi-VN")} đ`);
      if (eventData.category) bodyParts.push(eventData.category);
      if (dateKey) bodyParts.push(`Ngày ${dateKey}`);
      if (eventData.text || eventData.note) bodyParts.push(eventData.text || eventData.note);
      if (eventData.hasImage) bodyParts.push("📎 Kèm hình ảnh");
      targetUrl = `/?action=cashflow&id=${encodeURIComponent(eventData.id || "")}&date=${encodeURIComponent(dateKey || "")}&amount=${encodeURIComponent(eventData.amount || "")}&category=${encodeURIComponent(eventData.category || "")}&cashflowType=${encodeURIComponent(eventData.cashflowType || "")}&note=${encodeURIComponent(eventData.text || eventData.note || "")}&createdAt=${encodeURIComponent(eventData.createdAt || Date.now())}`;
    } else if (type === "fund_allocation" || type === "funds") {
      title = `📊 Phân bổ quỹ: ${eventData.fundName || "Quỹ"}`;
      if (eventData.amount) bodyParts.push(`${Number(eventData.amount).toLocaleString("vi-VN")} đ`);
      if (dateKey) bodyParts.push(`Ngày ${dateKey}`);
      if (eventData.text || eventData.note) bodyParts.push(eventData.text || eventData.note);
      targetUrl = `/?action=funds&id=${encodeURIComponent(eventData.id || "")}&fundName=${encodeURIComponent(eventData.fundName || "")}&amount=${encodeURIComponent(eventData.amount || "")}&note=${encodeURIComponent(eventData.text || eventData.note || "")}&createdAt=${encodeURIComponent(eventData.createdAt || Date.now())}`;
    } else {
      // event (mặc định)
      title = eventData.title ? `🔔 ${eventData.title}` : "🔔 Sự kiện mới từ thiết bị khác";
      if (dateKey) bodyParts.push(`Ngày ${dateKey}`);
      if (eventData.eventDateTime) {
        try {
          const dt = new Date(eventData.eventDateTime);
          if (!Number.isNaN(dt.getTime())) {
            bodyParts.push(`Lúc ${dt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`);
          }
        } catch (e) {}
      }
      if (eventData.text || eventData.note) {
        bodyParts.push(eventData.text || eventData.note);
      }
      targetUrl = `/?action=event&id=${encodeURIComponent(eventData.id || "")}&title=${encodeURIComponent(eventData.title || "")}&text=${encodeURIComponent(eventData.text || eventData.note || "")}&note=${encodeURIComponent(eventData.note || eventData.text || "")}&eventDateTime=${encodeURIComponent(eventData.eventDateTime || "")}&color=${encodeURIComponent(eventData.color || "")}&createdAt=${encodeURIComponent(eventData.createdAt || Date.now())}&date=${encodeURIComponent(dateKey || "")}`;
    }

    const body = bodyParts.join(" | ") || "Có cập nhật mới từ thiết bị khác.";
    const eventId = String(eventData?.id || "");
    const notificationTag = eventId ? `event-${eventId}` : `event-${Date.now()}`;

    // Loại bỏ trường image (base64) để tránh vượt giới hạn 4KB payload của FCM
    const safeEventData = { ...(eventData || {}) };
    delete safeEventData.image;

    const message = {
      tokens: tokens,
      notification: {
        title: title,
        body: body
      },
      data: {
        title: String(title),
        body: String(body),
        notificationType: String(type),
        dateKey: String(dateKey || ""),
        url: String(targetUrl),
        eventId: String(eventId),
        tag: String(notificationTag),
        text: String(eventData?.text || eventData?.note || ""),
        note: String(eventData?.note || eventData?.text || ""),
        amount: String(eventData?.amount || ""),
        category: String(eventData?.category || ""),
        cashflowType: String(eventData?.cashflowType || ""),
        hasImage: eventData?.hasImage ? "true" : "false",
        fundName: String(eventData?.fundName || ""),
        eventDataJson: JSON.stringify(safeEventData)
      },
      webpush: {
        fcmOptions: {
          link: targetUrl
        },
        notification: {
          title: title,
          body: body,
          icon: "/public/favicon.png",
          badge: "/public/favicon.png",
          tag: notificationTag,
          requireInteraction: false,
          vibrate: [200, 100, 200]
        },
        headers: {
          Urgency: "high"
        }
      }
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`[API Push] Đã gửi ${response.successCount} thông báo (${type}) thành công, ${response.failureCount} thất bại.`);

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
