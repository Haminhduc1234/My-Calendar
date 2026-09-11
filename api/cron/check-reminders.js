const admin = require("firebase-admin");

// ─── Firebase Admin SDK Singleton ───────────────────────────────────────────
if (!admin.apps.length) {
  let cert = null;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      cert = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch (e) {
      console.error("[Cron] Lỗi parse JSON FIREBASE_SERVICE_ACCOUNT:", e);
    }
  }

  if (cert) {
    admin.initializeApp({
      credential: admin.credential.cert(cert),
      databaseURL: "https://calendar-ac2fa-default-rtdb.firebaseio.com"
    });
    console.log("[Cron] Firebase Admin đã được khởi tạo thành công.");
  } else {
    console.warn("[Cron] Cảnh báo: Biến môi trường FIREBASE_SERVICE_ACCOUNT chưa được thiết lập.");
  }
}

// ─── Constants ──────────────────────────────────────────────────────────────
const REMINDERS_PATH = "eventReminders";
const TOKENS_PATH = "notificationTokens";
const USER_NOTIFICATIONS_PATH = "userNotifications";
const ICON_PATH = "/public/favicon.png";

// Bỏ qua reminder quá cũ (> 2 giờ) để tránh spam nếu cron ngừng hoạt động lâu
const MAX_OVERDUE_MS = 2 * 60 * 60 * 1000;
// Xóa reminder đã gửi sau 24 giờ
const CLEANUP_THRESHOLD_MS = 24 * 60 * 60 * 1000;

// ─── Helper: Lấy FCM tokens của một profile ────────────────────────────────
async function getProfileTokens(db, profileKey) {
  const snap = await db.ref(`${TOKENS_PATH}/${profileKey}`).get();
  const tokenMap = snap.val() || {};
  const entries = [];

  if (typeof tokenMap === "object") {
    Object.entries(tokenMap).forEach(([deviceId, value]) => {
      if (typeof value === "string" && value.length > 20) {
        entries.push({ deviceId, token: value });
      } else if (value && typeof value.token === "string" && value.token.length > 20) {
        entries.push({ deviceId, token: value.token });
      }
    });
  }

  return entries;
}

// ─── Helper: Gửi FCM push đến profile ──────────────────────────────────────
async function sendReminderToProfile(db, profileKey, reminder, reminderId, now) {
  const tokenEntries = await getProfileTokens(db, profileKey);
  if (!tokenEntries.length) {
    console.log(`[Cron] Không có FCM token nào cho profile: ${profileKey}`);
    return { success: false, reason: "no_tokens" };
  }

  const tokens = Array.from(new Set(tokenEntries.map((e) => e.token)));

  const eventTitle = reminder.eventTitle || "Sự kiện";
  const eventText = reminder.eventText || "";
  const eventDateTime = reminder.eventDateTime || "";
  const dateKey = reminder.dateKey || "";

  // Tính thời gian còn lại đến sự kiện
  let timeLeftStr = "60 phút";
  if (eventDateTime) {
    try {
      const eventTime = new Date(eventDateTime).getTime();
      const diffMs = eventTime - now;
      if (diffMs > 0) {
        const diffMin = Math.round(diffMs / 60000);
        timeLeftStr = diffMin >= 60
          ? `${Math.floor(diffMin / 60)} giờ ${diffMin % 60} phút`
          : `${diffMin} phút`;
      }
    } catch { /* ignore */ }
  }

  const title = `⏰ Sắp đến giờ: ${eventTitle}`;

  // Build body
  const bodyParts = [];
  if (dateKey) bodyParts.push(`Ngày ${dateKey}`);
  if (eventDateTime) {
    try {
      const dt = new Date(eventDateTime);
      if (!Number.isNaN(dt.getTime())) {
        bodyParts.push(`Lúc ${dt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`);
      }
    } catch { /* ignore */ }
  }
  bodyParts.push(`Còn ${timeLeftStr}`);
  if (eventText) bodyParts.push(eventText);
  const body = bodyParts.join(" | ") || `Sự kiện diễn ra sau ${timeLeftStr}`;

  const reminderEventData = {
    id: reminder.eventId || reminderId,
    title: title,
    text: eventText,
    note: eventText,
    eventDateTime: eventDateTime,
    date: dateKey,
    color: reminder.eventColor || "#f59e0b",
    createdAt: reminder.createdAt || now
  };

  const targetUrl = `/?action=event&id=${encodeURIComponent(reminderEventData.id)}&title=${encodeURIComponent(eventTitle)}&text=${encodeURIComponent(eventText)}&note=${encodeURIComponent(eventText)}&eventDateTime=${encodeURIComponent(eventDateTime)}&color=${encodeURIComponent(reminderEventData.color)}&createdAt=${encodeURIComponent(reminderEventData.createdAt)}&date=${encodeURIComponent(dateKey)}`;

  const message = {
    tokens,
    data: {
      title: title,
      body: body,
      notificationType: "event_reminder",
      dateKey: String(dateKey),
      url: targetUrl,
      eventId: String(reminderEventData.id),
      tag: `reminder-${reminderEventData.id}-${Date.now()}`,
      text: String(eventText),
      note: String(eventText),
      eventDateTime: String(eventDateTime),
      eventDataJson: JSON.stringify(reminderEventData)
    },
    webpush: {
      fcmOptions: {
        link: targetUrl
      },
      headers: {
        Urgency: "high"
      }
    }
  };

  const response = await admin.messaging().sendEachForMulticast(message);

  // Dọn dẹp token lỗi
  const invalidDeviceIds = [];
  response.responses.forEach((result, index) => {
    if (result.success) return;
    const code = result.error?.code || "unknown";
    if (
      code === "messaging/registration-token-not-registered" ||
      code === "messaging/invalid-registration-token" ||
      code === "messaging/mismatched-credential"
    ) {
      if (tokenEntries[index]) {
        invalidDeviceIds.push(tokenEntries[index].deviceId);
      }
    }
  });

  if (invalidDeviceIds.length > 0) {
    await Promise.all(
      invalidDeviceIds.map((deviceId) =>
        db.ref(`${TOKENS_PATH}/${profileKey}/${deviceId}`).remove()
      )
    );
    console.log(`[Cron] Đã xóa ${invalidDeviceIds.length} token lỗi của profile: ${profileKey}`);
  }

  // Đánh dấu đã gửi
  await db.ref(`${REMINDERS_PATH}/${profileKey}/${reminderId}`).update({
    delivered: true,
    deliveredAt: now
  });

  // Lưu vào lịch sử thông báo (quả chuông)
  try {
    const notifRef = db.ref(`${USER_NOTIFICATIONS_PATH}/${profileKey}`).push();
    await notifRef.set({
      id: notifRef.key,
      notificationType: "reminder",
      title: title,
      body: body,
      dateKey: dateKey,
      eventData: reminderEventData,
      createdAt: now,
      read: false
    });
  } catch (nErr) {
    console.warn("[Cron] Lỗi ghi userNotifications:", nErr.message);
  }

  console.log(`[Cron] ✅ Đã gửi nhắc nhở "${eventTitle}" → ${response.successCount} thành công, ${response.failureCount} thất bại`);

  return {
    success: true,
    successCount: response.successCount,
    failureCount: response.failureCount
  };
}

// ─── Main Handler ───────────────────────────────────────────────────────────
module.exports = async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // ── Xác thực CRON_SECRET ──────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers["authorization"] || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : authHeader;

    if (token !== cronSecret) {
      console.warn("[Cron] ❌ Unauthorized request - CRON_SECRET không khớp");
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  // ── Kiểm tra Firebase Admin ───────────────────────────────────────────
  if (!admin.apps.length) {
    return res.status(500).json({
      error: "Chưa cấu hình FIREBASE_SERVICE_ACCOUNT trong Environment Variables của Vercel."
    });
  }

  try {
    const db = admin.database();
    const now = Date.now();

    // ── Lấy danh sách profile keys (chỉ lấy key, không tải data) ────
    const profilesSnap = await db.ref(REMINDERS_PATH).get();
    const allProfiles = profilesSnap.val();

    if (!allProfiles || typeof allProfiles !== "object" || !Object.keys(allProfiles).length) {
      return res.status(200).json({
        success: true,
        message: "Không có reminder nào.",
        processed: 0
      });
    }

    let processedCount = 0;
    let skippedCount = 0;
    let cleanedCount = 0;
    const cleanupThreshold = now - CLEANUP_THRESHOLD_MS;

    for (const [profileKey, reminders] of Object.entries(allProfiles)) {
      if (!reminders || typeof reminders !== "object") continue;

      for (const [reminderId, reminder] of Object.entries(reminders)) {
        if (!reminder) continue;

        // ── Dọn dẹp reminder đã gửi quá 24 giờ ───────────────────
        if (
          reminder.delivered === true &&
          Number(reminder.deliveredAt || 0) < cleanupThreshold
        ) {
          await db.ref(`${REMINDERS_PATH}/${profileKey}/${reminderId}`).remove();
          cleanedCount++;
          continue;
        }

        // Đã gửi rồi → bỏ qua
        if (reminder.delivered === true) continue;

        const reminderAtMs = Number(reminder.reminderAtMs || 0);
        if (reminderAtMs <= 0) continue;

        // Chưa đến hạn → bỏ qua
        if (reminderAtMs > now) continue;

        // Quá cũ (> 2 giờ) → đánh dấu skip, không gửi
        if (now - reminderAtMs > MAX_OVERDUE_MS) {
          await db.ref(`${REMINDERS_PATH}/${profileKey}/${reminderId}`).update({
            delivered: true,
            deliveredAt: now,
            skippedReason: "overdue"
          });
          skippedCount++;
          continue;
        }

        // ── Gửi FCM push ───────────────────────────────────────────
        try {
          await sendReminderToProfile(db, profileKey, reminder, reminderId, now);
          processedCount++;
        } catch (err) {
          console.error(`[Cron] Lỗi gửi reminder ${reminderId}:`, err.message);
        }
      }
    }

    console.log(`[Cron] ✅ Hoàn tất: ${processedCount} gửi, ${skippedCount} bỏ qua, ${cleanedCount} dọn dẹp`);

    return res.status(200).json({
      success: true,
      ts: new Date(now).toISOString(),
      processed: processedCount,
      skipped: skippedCount,
      cleaned: cleanedCount
    });

  } catch (err) {
    console.error("[Cron] ❌ Lỗi tổng:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
};
