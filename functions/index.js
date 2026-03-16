const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");
const { onSchedule } = require("firebase-functions/v2/scheduler");

admin.initializeApp();

const db = admin.database();
const EVENTS_PATH = "calendarEvents";
const TOKENS_PATH = "notificationTokens";
const MAX_BATCH_SIZE = 100;
const EVENT_LINK = "/";
const ICON_PATH = "/public/favicon.png";

function buildNotificationBody(event) {
  const bodyParts = [];
  if (event.date) bodyParts.push(`Ngay ${event.date}`);
  if (event.text) bodyParts.push(event.text);
  if (Number(event.overtimeHours) > 0) bodyParts.push(`OT: ${event.overtimeHours}h`);
  return bodyParts.join(" | ") || "Ban co mot su kien moi";
}

async function getTargetTokens() {
  const snap = await db.ref(TOKENS_PATH).get();
  const tokenMap = snap.val() || {};

  return Object.entries(tokenMap)
    .map(([uid, value]) => ({ uid, token: value?.token }))
    .filter((entry) => typeof entry.token === "string" && entry.token.length > 20);
}

exports.dispatchCalendarNotifications = onSchedule("every 1 minutes", async () => {
  const now = Date.now();
  const eventSnap = await db
    .ref(EVENTS_PATH)
    .orderByChild("notifyAtMs")
    .endAt(now)
    .limitToFirst(MAX_BATCH_SIZE)
    .get();

  const events = eventSnap.val() || {};
  const dueEntries = Object.entries(events).filter(([, event]) => !event?.deliveredAt && Number(event?.notifyAtMs || 0) > 0);

  if (!dueEntries.length) {
    logger.info("No due notification jobs.");
    return;
  }

  const tokenEntries = await getTargetTokens();
  if (!tokenEntries.length) {
    logger.warn("No FCM tokens available.");
    return;
  }

  const tokens = tokenEntries.map((entry) => entry.token);

  for (const [eventId, event] of dueEntries) {
    const message = {
      tokens,
      notification: {
        title: event.title || "Su kien moi",
        body: buildNotificationBody(event)
      },
      webpush: {
        fcmOptions: {
          link: EVENT_LINK
        },
        notification: {
          icon: ICON_PATH,
          badge: ICON_PATH,
          tag: `event-${eventId}`
        }
      },
      data: {
        eventId,
        date: String(event.date || ""),
        title: String(event.title || "Su kien moi"),
        text: String(event.text || ""),
        overtimeHours: String(event.overtimeHours || 0),
        notifyAt: String(event.notifyAt || "")
      }
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    const invalidUids = [];
    response.responses.forEach((result, index) => {
      if (result.success) return;
      const code = result.error?.code || "unknown";
      if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
        invalidUids.push(tokenEntries[index].uid);
      }
    });

    await db.ref(`${EVENTS_PATH}/${eventId}`).update({
      deliveredAt: now,
      deliveredCount: response.successCount,
      deliveryErrorCount: response.failureCount
    });

    await Promise.all(invalidUids.map((uid) => db.ref(`${TOKENS_PATH}/${uid}`).remove()));

    logger.info("Notification dispatched", {
      eventId,
      successCount: response.successCount,
      failureCount: response.failureCount
    });
  }
});
