const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");
const { onValueWritten } = require("firebase-functions/v2/database");
const { onSchedule } = require("firebase-functions/v2/scheduler");

admin.initializeApp();

const db = admin.database();
const EVENTS_PATH = "calendarEvents";
const TOKENS_PATH = "notificationTokens";
const QUEUE_PATH = "eventNotificationQueue";
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
  if (event.text) bodyParts.push(event.text);
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
async function sendNotificationToProfile(profileKey, eventData, dateKey = "", excludeDeviceId = "") {
  const tokenEntries = await getProfileTokens(profileKey, excludeDeviceId);
  if (!tokenEntries.length) {
    logger.info(`Không có FCM token nào cho profile: ${profileKey}`);
    return { successCount: 0, failureCount: 0 };
  }

  const tokens = Array.from(new Set(tokenEntries.map((e) => e.token)));
  const title = eventData.title ? `🔔 ${eventData.title}` : "🔔 Sự kiện mới trên Lịch Việt";
  const body = buildNotificationBody(eventData, dateKey);
  const targetUrl = dateKey ? `/?date=${dateKey}` : EVENT_LINK;

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
        tag: `event-${dateKey || Date.now()}`,
        requireInteraction: false,
        vibrate: [200, 100, 200]
      }
    },
    data: {
      type: "calendar_event_added",
      profileKey: String(profileKey),
      dateKey: String(dateKey || ""),
      title: String(eventData.title || "Sự kiện mới"),
      text: String(eventData.text || ""),
      eventDateTime: String(eventData.eventDateTime || ""),
      createdAt: String(eventData.createdAt || Date.now()),
      url: targetUrl
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
 * Trigger Realtime Database: Tự động phát hiện khi có sự kiện mới được thêm vào ngày
 */
exports.onCalendarDateWritten = onValueWritten(
  "/calendarEvents/{profileKey}/dates/{dateKey}",
  async (event) => {
    const profileKey = event.params.profileKey;
    const dateKey = event.params.dateKey;

    const beforeData = event.data.before.val() || {};
    const afterData = event.data.after.val();

    if (!afterData) return; // Bị xóa, không bắn thông báo

    const beforeEvents = Array.isArray(beforeData.events)
      ? beforeData.events
      : typeof beforeData.events === "object" && beforeData.events !== null
      ? Object.values(beforeData.events)
      : [];

    const afterEvents = Array.isArray(afterData.events)
      ? afterData.events
      : typeof afterData.events === "object" && afterData.events !== null
      ? Object.values(afterData.events)
      : [];

    // Tìm các sự kiện mới thêm (sau - trước)
    const newEvents = afterEvents.filter((afterEv) => {
      if (!afterEv || !afterEv.title) return false;
      const existsInBefore = beforeEvents.some(
        (b) => b.title === afterEv.title && (b.eventDateTime === afterEv.eventDateTime || b.createdAt === afterEv.createdAt)
      );
      return !existsInBefore;
    });

    if (newEvents.length > 0) {
      for (const newEv of newEvents) {
        await sendNotificationToProfile(profileKey, newEv, dateKey);
      }
    }
  }
);

/**
 * Trigger Realtime Database: Queue gửi thông báo chủ động từ client
 */
exports.onNotificationQueueCreated = onValueWritten(
  "/eventNotificationQueue/{profileKey}/{queueId}",
  async (event) => {
    const profileKey = event.params.profileKey;
    const queueId = event.params.queueId;
    const payload = event.data.after.val();

    if (!payload || payload.processed) return;

    const { eventData, dateKey, senderDeviceId } = payload;
    if (eventData) {
      await sendNotificationToProfile(profileKey, eventData, dateKey || "", senderDeviceId || "");
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
