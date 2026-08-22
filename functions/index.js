const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");
const { onValueWritten } = require("firebase-functions/v2/database");
const { onSchedule } = require("firebase-functions/v2/scheduler");

admin.initializeApp();

const db = admin.database();
const EVENTS_PATH = "calendarEvents";
const TOKENS_PATH = "notificationTokens";
const QUEUE_PATH = "eventNotificationQueue";
const REMINDERS_PATH = "eventReminders";
const MAX_BATCH_SIZE = 100;
const EVENT_LINK = "/";
const ICON_PATH = "/public/favicon.png";

function buildNotificationBody(event, dateKey) {
  const bodyParts = [];
  const dateStr = event.date || dateKey;
  if (dateStr) bodyParts.push(`Ngày ${dateStr}`);
  if (event.eventDateTime) {
    try {
      const dt = new Date(event.eventDateTime);
      if (!Number.isNaN(dt.getTime())) {
        const timeStr = dt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
        bodyParts.push(`Lúc ${timeStr}`);
      }
    } catch { }
  }
  if (event.text || event.note) bodyParts.push(event.text || event.note);
  if (Number(event.overtimeHours) > 0) bodyParts.push(`OT: ${event.overtimeHours}h`);
  return bodyParts.join(" | ") || "Bạn có một sự kiện mới";
}

/**
 * Lấy danh sách FCM tokens của một profileKey (hỗ trợ nhiều thiết bị)
 */
async function getProfileTokens(profileKey, excludeDeviceId = "") {
  const snap = await db.ref(`${TOKENS_PATH}/${profileKey}`).get();
  const tokenMap = snap.val() || {};

  const entries = [];

  if (typeof tokenMap === "object") {
    // Có thể lưu dạng { deviceId: { token, updatedAt, ... } } hoặc { token: "..." }
    Object.entries(tokenMap).forEach(([deviceId, value]) => {
      if (excludeDeviceId && deviceId === excludeDeviceId) return;

      if (typeof value === "string" && value.length > 20) {
        entries.push({ deviceId, token: value });
      } else if (value && typeof value.token === "string" && value.token.length > 20) {
        entries.push({ deviceId, token: value.token });
      }
    });
  }

  return entries;
}

/**
 * Gửi push notification đến danh sách tokens của profile
 */
async function sendNotificationToProfile(profileKey, eventData, dateKey = "", excludeDeviceId = "", notificationType = "event") {
  const tokenEntries = await getProfileTokens(profileKey, excludeDeviceId);
  if (!tokenEntries.length) {
    logger.info(`Không có FCM token nào cho profile: ${profileKey}`);
    return { successCount: 0, failureCount: 0 };
  }

  const tokens = Array.from(new Set(tokenEntries.map((e) => e.token)));
  const type = notificationType || "event";
  let title = "";
  let targetUrl = "/";

  if (type === "cashflow") {
    const isExpense = eventData.cashflowType === "expense";
    title = isExpense ? "💸 Chi tiêu mới" : "💰 Thu nhập mới";
    targetUrl = `/?action=cashflow&id=${encodeURIComponent(eventData.id || "")}&date=${encodeURIComponent(dateKey || "")}&amount=${encodeURIComponent(eventData.amount || "")}&category=${encodeURIComponent(eventData.category || "")}&cashflowType=${encodeURIComponent(eventData.cashflowType || "")}&note=${encodeURIComponent(eventData.text || eventData.note || "")}&createdAt=${encodeURIComponent(eventData.createdAt || Date.now())}`;
  } else if (type === "fund_allocation" || type === "funds") {
    title = "📊 Phân bổ quỹ mới";
    targetUrl = `/?action=funds&id=${encodeURIComponent(eventData.id || "")}&fundName=${encodeURIComponent(eventData.fundName || "")}&amount=${encodeURIComponent(eventData.amount || "")}&note=${encodeURIComponent(eventData.text || eventData.note || "")}&createdAt=${encodeURIComponent(eventData.createdAt || Date.now())}`;
  } else if (type === "event_reminder") {
    // Nhắc nhở trước 60 phút - title đã được set từ caller (⏰ Sắp đến giờ: ...)
    title = eventData.title || "⏰ Nhắc nhở sự kiện";
    targetUrl = `/?action=event&id=${encodeURIComponent(eventData.id || "")}&title=${encodeURIComponent(eventData.title || "")}&text=${encodeURIComponent(eventData.text || eventData.note || "")}&note=${encodeURIComponent(eventData.note || eventData.text || "")}&eventDateTime=${encodeURIComponent(eventData.eventDateTime || "")}&color=${encodeURIComponent(eventData.color || "")}&createdAt=${encodeURIComponent(eventData.createdAt || Date.now())}&date=${encodeURIComponent(dateKey || "")}`;
  } else {
    title = eventData.title ? `🔔 ${eventData.title}` : "🔔 Sự kiện mới";
    targetUrl = `/?action=event&id=${encodeURIComponent(eventData.id || "")}&title=${encodeURIComponent(eventData.title || "")}&text=${encodeURIComponent(eventData.text || eventData.note || "")}&note=${encodeURIComponent(eventData.note || eventData.text || "")}&eventDateTime=${encodeURIComponent(eventData.eventDateTime || "")}&color=${encodeURIComponent(eventData.color || "")}&createdAt=${encodeURIComponent(eventData.createdAt || Date.now())}&date=${encodeURIComponent(dateKey || "")}`;
  }

  const body = buildNotificationBody(eventData, dateKey);

  const message = {
    tokens,
    notification: {
      title,
      body
    },
    webpush: {
      fcmOptions: {
        link: targetUrl
      },
      notification: {
        title,
        body,
        icon: ICON_PATH,
        badge: ICON_PATH,
        tag: `notify-${type}-${dateKey || Date.now()}`,
        requireInteraction: false,
        vibrate: [200, 100, 200]
      },
      data: {
        url: targetUrl,
        dateKey: String(dateKey || ""),
        notificationType: type
      }
    },
    data: {
      type: "calendar_event_added",
      notificationType: type,
      profileKey: String(profileKey),
      dateKey: String(dateKey || ""),
      title: String(title),
      text: String(eventData.text || ""),
      eventDateTime: String(eventData.eventDateTime || ""),
      createdAt: String(eventData.createdAt || Date.now()),
      url: targetUrl,
      eventDataJson: JSON.stringify(eventData || {})
    }
  };

  const response = await admin.messaging().sendEachForMulticast(message);

  // Dọn dẹp các token lỗi hoặc đã hủy đăng ký
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
  }

  logger.info("Đã gửi thông báo sự kiện", {
    profileKey,
    title,
    successCount: response.successCount,
    failureCount: response.failureCount
  });

  return response;
}

/**
 * Queue gửi thông báo chủ động từ client (loại trừ thiết bị gửi, đầy đủ thông tin createdAt và text)
 */
exports.onNotificationQueueCreated = onValueWritten(
  "/eventNotificationQueue/{profileKey}/{queueId}",
  async (event) => {
    const profileKey = event.params.profileKey;
    const queueId = event.params.queueId;
    const payload = event.data.after.val();

    if (!payload || payload.processed) return;

    const { eventData, dateKey, senderDeviceId, notificationType } = payload;
    if (eventData) {
      await sendNotificationToProfile(profileKey, eventData, dateKey || "", senderDeviceId || "", notificationType || "event");
    }

    // Xóa item sau khi xử lý
    await db.ref(`${QUEUE_PATH}/${profileKey}/${queueId}`).remove();
  }
);

/**
 * Cron Job định kỳ (tương thích backward)
 */
exports.dispatchCalendarNotifications = onSchedule("every 1 minutes", async () => {
  const now = Date.now();
  const eventSnap = await db
    .ref(EVENTS_PATH)
    .orderByChild("notifyAtMs")
    .endAt(now)
    .limitToFirst(MAX_BATCH_SIZE)
    .get();

  const events = eventSnap.val() || {};
  const dueEntries = Object.entries(events).filter(
    ([, ev]) => !ev?.deliveredAt && Number(ev?.notifyAtMs || 0) > 0
  );

  if (!dueEntries.length) return;

  const snap = await db.ref(TOKENS_PATH).get();
  const allTokensData = snap.val() || {};
  const allTokens = [];

  Object.values(allTokensData).forEach((userTokens) => {
    if (typeof userTokens === "object") {
      Object.values(userTokens).forEach((item) => {
        const token = typeof item === "string" ? item : item?.token;
        if (typeof token === "string" && token.length > 20) {
          allTokens.push(token);
        }
      });
    }
  });

  if (!allTokens.length) return;

  for (const [eventId, ev] of dueEntries) {
    const message = {
      tokens: allTokens,
      notification: {
        title: ev.title || "Sự kiện",
        body: buildNotificationBody(ev)
      },
      webpush: {
        fcmOptions: { link: EVENT_LINK },
        notification: { icon: ICON_PATH, badge: ICON_PATH, tag: `event-${eventId}` }
      },
      data: {
        eventId,
        title: String(ev.title || ""),
        text: String(ev.text || "")
      }
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    await db.ref(`${EVENTS_PATH}/${eventId}`).update({
      deliveredAt: now,
      deliveredCount: response.successCount,
      deliveryErrorCount: response.failureCount
    });
  }
});

/**
 * Cron Job nhắc nhở sự kiện trước 60 phút
 * Quét tất cả eventReminders, tìm reminder đến hạn, gửi FCM push
 */
exports.checkEventReminders = onSchedule("every 1 minutes", async () => {
  const now = Date.now();
  const remindersSnap = await db.ref(REMINDERS_PATH).get();
  const allProfiles = remindersSnap.val() || {};

  if (!Object.keys(allProfiles).length) return;

  const promises = [];

  for (const [profileKey, reminders] of Object.entries(allProfiles)) {
    if (!reminders || typeof reminders !== "object") continue;

    for (const [reminderId, reminder] of Object.entries(reminders)) {
      if (!reminder || reminder.delivered === true) continue;

      const reminderAtMs = Number(reminder.reminderAtMs || 0);
      if (reminderAtMs <= 0 || reminderAtMs > now) continue;

      // Reminder đã đến hạn → gửi thông báo
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
        } catch {}
      }

      const reminderEventData = {
        id: reminder.eventId || reminderId,
        title: `⏰ Sắp đến giờ: ${eventTitle}`,
        text: eventText,
        note: eventText,
        eventDateTime: eventDateTime,
        date: dateKey,
        color: reminder.eventColor || "#f59e0b",
        createdAt: reminder.createdAt || now
      };

      // Gửi đến tất cả thiết bị của profile (không loại trừ thiết bị nào)
      const sendPromise = sendNotificationToProfile(
        profileKey,
        reminderEventData,
        dateKey,
        "",  // không exclude device nào
        "event_reminder"
      ).then(async () => {
        // Đánh dấu đã gửi
        await db.ref(`${REMINDERS_PATH}/${profileKey}/${reminderId}`).update({
          delivered: true,
          deliveredAt: now
        });
        logger.info("Đã gửi nhắc nhở sự kiện", { profileKey, eventTitle, reminderId });
      }).catch((err) => {
        logger.error("Lỗi gửi nhắc nhở:", { profileKey, reminderId, error: err.message });
      });

      promises.push(sendPromise);
    }
  }

  if (promises.length > 0) {
    await Promise.all(promises);
    logger.info(`Đã xử lý ${promises.length} nhắc nhở sự kiện`);
  }

  // Dọn dẹp reminder đã gửi quá 24 giờ
  const cleanupThreshold = now - 24 * 60 * 60 * 1000;
  for (const [profileKey, reminders] of Object.entries(allProfiles)) {
    if (!reminders || typeof reminders !== "object") continue;
    for (const [reminderId, reminder] of Object.entries(reminders)) {
      if (reminder?.delivered === true && Number(reminder.deliveredAt || 0) < cleanupThreshold) {
        await db.ref(`${REMINDERS_PATH}/${profileKey}/${reminderId}`).remove();
      }
    }
  }
});
