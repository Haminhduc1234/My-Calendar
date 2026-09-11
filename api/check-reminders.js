const admin = require("firebase-admin");

// ─── Firebase Admin SDK Singleton ───────────────────────────────────────────
if (!admin.apps.length) {
  let cert = null;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      cert = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch (e) {
      console.error("[Cron] Lỗi parse FIREBASE_SERVICE_ACCOUNT:", e.message);
    }
  }

  if (cert) {
    admin.initializeApp({
      credential: admin.credential.cert(cert),
      databaseURL: "https://calendar-ac2fa-default-rtdb.firebaseio.com"
    });
  }
}

// ─── Constants ──────────────────────────────────────────────────────────────
const REMINDERS_PATH = "eventReminders";
const TOKENS_PATH = "notificationTokens";
const USER_NOTIFICATIONS_PATH = "userNotifications";

const MAX_OVERDUE_MS = 2 * 60 * 60 * 1000;       // Bỏ qua reminder quá 2 giờ
const CLEANUP_THRESHOLD_MS = 24 * 60 * 60 * 1000; // Xóa reminder đã gửi quá 24h

// ─── Helper: Lấy danh sách profile keys (REST API shallow) ─────────────────
async function getProfileKeys(db) {
  // Dùng REST API với shallow=true để chỉ lấy keys, không tải data
  const dbUrl = "https://calendar-ac2fa-default-rtdb.firebaseio.com";
  const tokenObj = await admin.app().options.credential.getAccessToken();
  const url = `${dbUrl}/${REMINDERS_PATH}.json?shallow=true&access_token=${tokenObj.access_token}`;

  const response = await fetch(url);
  if (!response.ok) return [];
  const data = await response.json();
  if (!data || typeof data !== "object") return [];
  return Object.keys(data);
}

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
  if (!tokenEntries.length) return;

  const tokens = Array.from(new Set(tokenEntries.map((e) => e.token)));
  const eventTitle = reminder.eventTitle || "Sự kiện";
  const eventText = reminder.eventText || "";
  const eventDateTime = reminder.eventDateTime || "";
  const dateKey = reminder.dateKey || "";

  // Tính thời gian còn lại
  let timeLeftStr = "60 phút";
  if (eventDateTime) {
    try {
      const diffMs = new Date(eventDateTime).getTime() - now;
      if (diffMs > 0) {
        const diffMin = Math.round(diffMs / 60000);
        timeLeftStr = diffMin >= 60
          ? `${Math.floor(diffMin / 60)} giờ ${diffMin % 60} phút`
          : `${diffMin} phút`;
      }
    } catch { /* ignore */ }
  }

  const title = `⏰ Sắp đến giờ: ${eventTitle}`;

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
      title, body,
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
      fcmOptions: { link: targetUrl },
      headers: { Urgency: "high" }
    }
  };

  const fcmResponse = await admin.messaging().sendEachForMulticast(message);

  // Dọn token lỗi
  const badIds = [];
  fcmResponse.responses.forEach((r, i) => {
    if (r.success) return;
    const code = r.error?.code || "";
    if (code.includes("not-registered") || code.includes("invalid-registration") || code.includes("mismatched")) {
      if (tokenEntries[i]) badIds.push(tokenEntries[i].deviceId);
    }
  });
  if (badIds.length) {
    await Promise.all(badIds.map((id) => db.ref(`${TOKENS_PATH}/${profileKey}/${id}`).remove()));
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
      title, body, dateKey,
      eventData: reminderEventData,
      createdAt: now,
      read: false
    });
  } catch { /* ignore */ }
}

// ─── Main Handler ───────────────────────────────────────────────────────────
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  // ── Xác thực CRON_SECRET ──────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers["authorization"] || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
    if (token !== cronSecret) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  if (!admin.apps.length) {
    return res.status(500).json({ error: "FIREBASE_SERVICE_ACCOUNT not configured" });
  }

  try {
    const db = admin.database();
    const now = Date.now();
    let processed = 0, skipped = 0, cleaned = 0;

    // ── Bước 1: Lấy danh sách profile keys (shallow - chỉ keys) ────
    const profileKeys = await getProfileKeys(db);

    if (!profileKeys.length) {
      return res.status(200).json({ ok: true, processed: 0 });
    }

    // ── Bước 2: Xử lý từng profile riêng biệt ──────────────────────
    for (const profileKey of profileKeys) {
      const snap = await db.ref(`${REMINDERS_PATH}/${profileKey}`)
        .orderByChild("delivered")
        .equalTo(false)
        .limitToFirst(50)
        .get();

      const reminders = snap.val();
      if (!reminders || typeof reminders !== "object") continue;

      for (const [reminderId, reminder] of Object.entries(reminders)) {
        if (!reminder || reminder.delivered === true) continue;

        const reminderAtMs = Number(reminder.reminderAtMs || 0);
        if (reminderAtMs <= 0) continue;

        // Chưa đến hạn → bỏ qua
        if (reminderAtMs > now) continue;

        // Quá cũ (> 2 giờ) → skip, không gửi
        if (now - reminderAtMs > MAX_OVERDUE_MS) {
          await db.ref(`${REMINDERS_PATH}/${profileKey}/${reminderId}`).update({
            delivered: true, deliveredAt: now, skippedReason: "overdue"
          });
          skipped++;
          continue;
        }

        // ── Gửi FCM push ─────────────────────────────────────────
        try {
          await sendReminderToProfile(db, profileKey, reminder, reminderId, now);
          processed++;
        } catch (err) {
          console.error(`[Cron] Lỗi reminder ${reminderId}:`, err.message);
        }
      }

      // ── Dọn dẹp reminder cũ đã delivered > 24h (tối đa 20) ─────
      const cleanupThreshold = now - CLEANUP_THRESHOLD_MS;
      const oldSnap = await db.ref(`${REMINDERS_PATH}/${profileKey}`)
        .orderByChild("deliveredAt")
        .endAt(cleanupThreshold)
        .limitToFirst(20)
        .get();

      const oldReminders = oldSnap.val();
      if (oldReminders && typeof oldReminders === "object") {
        for (const [rid, r] of Object.entries(oldReminders)) {
          if (r && r.delivered === true) {
            await db.ref(`${REMINDERS_PATH}/${profileKey}/${rid}`).remove();
            cleaned++;
          }
        }
      }
    }

    return res.status(200).json({ ok: true, processed, skipped, cleaned });

  } catch (err) {
    console.error("[Cron] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
