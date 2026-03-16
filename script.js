/* ========================== CẤU HÌNH ========================== */
let currentDate = new Date();
let selectedKey = "";
let geoPromptRequestedThisLoad = false;
const TOOLBOX_STATE_KEY = "quickToolboxState";
const GEO_PROMPT_ASKED_KEY = "geoPromptAsked";
const FIREBASE_EVENTS_PATH = self.FIREBASE_EVENTS_PATH || "calendarEvents";
const FIREBASE_TOKEN_PATH = self.FIREBASE_TOKEN_PATH || "notificationTokens";
const FIREBASE_CLIENT_ID_KEY = "firebaseClientId";
const FIREBASE_CONFIG = self.FIREBASE_WEB_CONFIG || {};
const FIREBASE_WEB_PUSH_VAPID_KEY = self.FIREBASE_WEB_PUSH_VAPID_KEY || "";

let firebaseDb = null;
let firebaseEventsRef = null;
let firebaseReady = false;
let firebaseAuth = null;
let firebaseMessaging = null;
const scheduledNotifyTimers = new Map();

// Lễ dương lịch
const SOLAR_HOLIDAYS = {
  "1-1": "Tết Dương",
  "30-4": "30/4",
  "1-5": "1/5",
  "2-9": "Quốc khánh"
};

// Lễ âm lịch
const LUNAR_HOLIDAYS = {
  "1-1": "Tết Nguyên Đán",
  "15-1": "Rằm tháng Giêng",
  "10-3": "Giỗ Tổ",
  "15-8": "Trung Thu"
};

/* ========================== HÀM HỖ TRỢ ========================== */
const PI = Math.PI;
const TIMEZONE = 7; // GMT+7

function INT(d) { return Math.floor(d); }

/* Julian Day từ ngày dương */
function jdFromDate(dd, mm, yy) {
  let a = INT((14 - mm) / 12);
  let y = yy + 4800 - a;
  let m = mm + 12 * a - 3;
  let jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - INT(y / 100) + INT(y / 400) - 32045;
  return jd;
}

/* Chuyển JD sang ngày dương */
function jdToDate(jd) {
  let Z = jd;
  let A = Z;
  let alpha = INT((A - 1867216.25) / 36524.25);
  A = A + 1 + alpha - INT(alpha / 4);
  let B = A + 1524;
  let C = INT((B - 122.1) / 365.25);
  let D = INT(365.25 * C);
  let E = INT((B - D) / 30.6001);
  let day = B - D - INT(30.6001 * E);
  let month = (E < 14) ? E - 1 : E - 13;
  let year = (month > 2) ? C - 4716 : C - 4715;
  return { day, month, year };
}

/* Tính ngày trăng mới (New Moon) theo thuật toán Hồ Ngọc Đức */
function NewMoon(k) {
  let T = k / 1236.85;
  let T2 = T * T;
  let T3 = T2 * T;
  let dr = PI / 180;
  let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3 + 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  let M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  let Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  let F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr)
    + 0.0021 * Math.sin(2 * M * dr)
    - 0.4068 * Math.sin(Mpr * dr)
    + 0.0161 * Math.sin(2 * Mpr * dr)
    - 0.0004 * Math.sin(3 * Mpr * dr)
    + 0.0104 * Math.sin(2 * F * dr)
    - 0.0051 * Math.sin(M + Mpr * dr)
    - 0.0074 * Math.sin(M - Mpr * dr)
    + 0.0004 * Math.sin(2 * F + M * dr)
    - 0.0004 * Math.sin(2 * F - M * dr)
    - 0.0006 * Math.sin(2 * F + Mpr * dr)
    + 0.0010 * Math.sin(2 * F - Mpr * dr)
    + 0.0005 * Math.sin(2 * Mpr + M * dr);
  let JdNew = Jd1 + C1;
  return INT(JdNew + 0.5 + TIMEZONE / 24);
}

/* Kinh độ Mặt Trời tại ngày JDN */
function SunLongitude(jdn) {
  let T = (jdn - 2451545.5 - TIMEZONE / 24) / 36525;
  let T2 = T * T;
  let dr = PI / 180;
  let M = 357.52910 + 35999.05030 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  let L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL = (1.914600 - 0.004817 * T - 0.000014 * T2) * Math.sin(M * dr)
    + (0.019993 - 0.000101 * T) * Math.sin(2 * M * dr)
    + 0.000290 * Math.sin(3 * M * dr);
  let L = L0 + DL;
  L = L - 360 * Math.floor(L / 360);
  return INT(L / 30);
}

/* Tháng 11 âm lịch */
function LunarMonth11(yy) {
  let off = jdFromDate(31, 12, yy) - 2415021;
  let k = INT(off / 29.530588853);
  let nm = NewMoon(k);
  let sunLong = SunLongitude(nm);
  if (sunLong >= 9) nm = NewMoon(k - 1);
  return nm;
}

/* Tháng nhuận */
function LeapMonthOffset(a11) {
  let k = INT((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let last = 0;
  let i = 1;
  let arc;
  do {
    arc = SunLongitude(NewMoon(k + i));
    if (arc === last) break;
    last = arc;
    i++;
  } while (i < 14);
  return i - 1;
}

/* Chuyển dương -> âm */
function convertSolarToLunar(dd, mm, yy) {
  let dayNumber = jdFromDate(dd, mm, yy);
  let k = INT((dayNumber - 2415021.076998695) / 29.530588853);
  let monthStart = NewMoon(k + 1);
  if (monthStart > dayNumber) monthStart = NewMoon(k);

  let a11 = LunarMonth11(yy);
  let b11 = a11;
  let lunarYear;

  if (a11 >= monthStart) {
    lunarYear = yy;
    a11 = LunarMonth11(yy - 1);
  } else {
    lunarYear = yy + 1;
    b11 = LunarMonth11(yy + 1);
  }

  let lunarDay = dayNumber - monthStart + 1;
  let diff = INT((monthStart - a11) / 29);
  let lunarMonth = diff + 11;
  let lunarLeap = false;

  if (b11 - a11 > 365) {
    let leapMonthDiff = LeapMonthOffset(a11);
    if (diff >= leapMonthDiff) {
      lunarMonth--;
      if (diff === leapMonthDiff) lunarLeap = true;
    }
  }

  if (lunarMonth > 12) lunarMonth -= 12;
  if (lunarMonth >= 11 && diff < 4) lunarYear--;

  return { lunarDay, lunarMonth, lunarYear, lunarLeap };
}

/* ========================== RENDER CALENDAR ========================== */
function renderCalendar() {
  const calDom = document.getElementById("calendar");
  calDom.innerHTML = "";

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  document.getElementById("monthYear").innerText = `Tháng ${month + 1} / ${year}`;

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const startDate = new Date(year, month, 1 - firstDayOfMonth);

  const today = new Date(); today.setHours(0, 0, 0, 0);

  for (let i = 0; i < 42; i++) {
    const cellDate = new Date(startDate);
    cellDate.setDate(startDate.getDate() + i);

    const d = cellDate.getDate();
    const m = cellDate.getMonth() + 1;
    const y = cellDate.getFullYear();

    const div = document.createElement("div");
    div.className = "day";
    if (cellDate.getMonth() !== month) div.classList.add("other-month");

    const lunar = convertSolarToLunar(d, m, y);
    const key = `${y}-${m}-${d}`;

    if (cellDate.getTime() === today.getTime()) div.classList.add("today");
    if (localStorage.getItem(key)) div.classList.add("has-event");
    if (SOLAR_HOLIDAYS[`${d}-${m}`] || LUNAR_HOLIDAYS[`${lunar.lunarDay}-${lunar.lunarMonth}`])
      div.classList.add("holiday");
    let holidayName = "";

    if (SOLAR_HOLIDAYS[`${d}-${m}`]) {
      holidayName = SOLAR_HOLIDAYS[`${d}-${m}`];
    }

    if (LUNAR_HOLIDAYS[`${lunar.lunarDay}-${lunar.lunarMonth}`]) {
      holidayName = LUNAR_HOLIDAYS[`${lunar.lunarDay}-${lunar.lunarMonth}`];
    }
    div.innerHTML = `
  <div class="solar">${d}</div>
  <div class="lunar">${lunar.lunarDay}/${lunar.lunarMonth}${lunar.lunarLeap ? "N" : ""}</div>
`;

    div.onclick = () => openModal(key, d, m, y);

    calDom.appendChild(div);
  }
}

/* ========================== THÁNG ========================== */
function changeMonth(step) {
  currentDate.setMonth(currentDate.getMonth() + step);
  renderCalendar();
  renderOvertime();
  renderOvertimeSalary();
}

function isDateKey(key) {
  return /^\d{4}-\d{1,2}-\d{1,2}$/.test(key);
}

function parseLegacyOvertimeHours(raw) {
  const text = String(raw || "").trim();
  if (!/^\d+$/.test(text)) return 0;
  const hours = parseInt(text, 10);
  return Number.isFinite(hours) && hours > 0 ? hours : 0;
}

function parseEventRecord(raw) {
  if (!raw) return null;

  const text = String(raw).trim();
  if (!text) return null;

  try {
    const parsed = JSON.parse(text);
    if (parsed && parsed.__type === "calendar_event") {
      const overtimeHours = Math.max(0, parseInt(parsed.overtimeHours, 10) || 0);
      return {
        title: String(parsed.title || ""),
        text: String(parsed.text || ""),
        overtimeHours,
        realtimeNotify: Boolean(parsed.realtimeNotify),
        notifyAt: String(parsed.notifyAt || "")
      };
    }
  } catch {
    // Dữ liệu cũ không phải JSON.
  }

  const legacyHours = parseLegacyOvertimeHours(text);
  return {
    title: "",
    text: legacyHours > 0 ? "" : text,
    overtimeHours: legacyHours,
    realtimeNotify: false,
    notifyAt: ""
  };
}

function encodeEventRecord(record) {
  return JSON.stringify({
    __type: "calendar_event",
    title: String(record.title || "").trim(),
    text: String(record.text || "").trim(),
    overtimeHours: Math.max(0, parseInt(record.overtimeHours, 10) || 0),
    realtimeNotify: Boolean(record.realtimeNotify),
    notifyAt: String(record.notifyAt || ""),
    updatedAt: Date.now()
  });
}

function toDatetimeLocalValue(dateInput) {
  if (!dateInput) return "";
  const dt = new Date(dateInput);
  if (Number.isNaN(dt.getTime())) return "";
  const tzOffset = dt.getTimezoneOffset() * 60000;
  const local = new Date(dt.getTime() - tzOffset);
  return local.toISOString().slice(0, 16);
}

function toNotifyTimestamp(dateInput) {
  if (!dateInput) return null;
  const ts = new Date(dateInput).getTime();
  if (!Number.isFinite(ts)) return null;
  return ts;
}

function buildReminderPayload(dateKey, event) {
  if (!event || !event.realtimeNotify || !event.notifyAt) return null;

  const notifyAtMs = toNotifyTimestamp(event.notifyAt);
  if (!notifyAtMs) return null;

  return {
    date: dateKey,
    title: event.title || "Sự kiện mới",
    text: event.text || "",
    overtimeHours: Math.max(0, parseInt(event.overtimeHours, 10) || 0),
    notifyAt: event.notifyAt,
    notifyAtMs
  };
}

function getFirebaseConfigIssues() {
  const requiredKeys = [
    "apiKey",
    "authDomain",
    "databaseURL",
    "projectId",
    "storageBucket",
    "messagingSenderId",
    "appId"
  ];
  return requiredKeys.filter((k) => String(FIREBASE_CONFIG[k] || "").trim().length === 0);
}

function isMessagingSupported() {
  return (
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    !!window.firebase?.messaging
  );
}

function getFirebaseMessagingIssues() {
  const issues = [];
  if (!FIREBASE_WEB_PUSH_VAPID_KEY) issues.push("webPushVapidKey");
  if (!isMessagingSupported()) issues.push("browserSupport");
  return issues;
}

function readEventByKey(key) {
  return parseEventRecord(localStorage.getItem(key));
}

function getOvertimeHoursForDateKey(key) {
  const event = readEventByKey(key);
  if (!event) return 0;
  return Math.max(0, parseInt(event.overtimeHours, 10) || 0);
}

function getOrCreateFirebaseClientId() {
  let id = localStorage.getItem(FIREBASE_CLIENT_ID_KEY);
  if (!id) {
    id = `client_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(FIREBASE_CLIENT_ID_KEY, id);
  }
  return id;
}

function getFirebaseSenderId() {
  const uid = firebaseAuth?.currentUser?.uid;
  return uid || getOrCreateFirebaseClientId();
}

function isFirebaseConfigReady() {
  return getFirebaseConfigIssues().length === 0;
}

function maybeRequestNotificationPermission() {
  if (!("Notification" in window)) return Promise.resolve("denied");
  if (Notification.permission === "granted") return Promise.resolve("granted");
  if (Notification.permission === "denied") return Promise.resolve("denied");
  return Notification.requestPermission();
}

function showRealtimeNotification(payload) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const title = payload.title?.trim() || "Sự kiện mới";
  const bodyParts = [];
  if (payload.date) bodyParts.push(`Ngày ${payload.date}`);
  if (payload.text) bodyParts.push(payload.text);
  if (Number(payload.overtimeHours) > 0) bodyParts.push(`OT: ${payload.overtimeHours}h`);

  const notification = new Notification(title, {
    body: bodyParts.join(" | ") || "Bạn có một sự kiện vừa được tạo",
    icon: "public/favicon.png",
    tag: `event-${payload.id || Date.now()}`
  });

  setTimeout(() => notification.close(), 10000);
}

function scheduleRealtimeNotification(payload, id) {
  if (!payload) return;
  if (id && scheduledNotifyTimers.has(id)) {
    clearTimeout(scheduledNotifyTimers.get(id));
    scheduledNotifyTimers.delete(id);
  }

  const notifyAtMs = Number(payload.notifyAtMs || 0);
  if (!Number.isFinite(notifyAtMs) || notifyAtMs <= 0) {
    showRealtimeNotification({ ...payload, id });
    return;
  }

  const waitMs = notifyAtMs - Date.now();
  if (waitMs <= 0) {
    showRealtimeNotification({ ...payload, id });
    return;
  }

  const timer = setTimeout(() => {
    showRealtimeNotification({ ...payload, id });
    if (id) scheduledNotifyTimers.delete(id);
  }, waitMs);

  if (id) scheduledNotifyTimers.set(id, timer);
}

function cancelScheduledNotification(id) {
  if (!id || !scheduledNotifyTimers.has(id)) return;
  clearTimeout(scheduledNotifyTimers.get(id));
  scheduledNotifyTimers.delete(id);
}

function scheduleLocalEventReminder(dateKey, event) {
  const timerId = `local-${dateKey}`;
  cancelScheduledNotification(timerId);

  const payload = buildReminderPayload(dateKey, event);
  if (!payload) return;

  scheduleRealtimeNotification(payload, timerId);
}

function restoreLocalScheduledNotifications() {
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index);
    if (!isDateKey(key)) continue;

    const event = readEventByKey(key);
    if (!event) continue;
    scheduleLocalEventReminder(key, event);
  }
}

async function pushRealtimeEvent(payload) {
  if (!firebaseReady || !firebaseEventsRef) return;
  const record = {
    ...payload,
    createdAt: Date.now(),
    senderId: getFirebaseSenderId()
  };
  await firebaseEventsRef.push(record);
}

async function ensureFirebaseAuth() {
  if (!window.firebase?.auth) return false;
  firebaseAuth = window.firebase.auth();

  if (firebaseAuth.currentUser) return true;

  try {
    await firebaseAuth.signInAnonymously();
    return true;
  } catch {
    return false;
  }
}

async function saveMessagingToken(token) {
  if (!firebaseDb || !firebaseAuth?.currentUser?.uid || !token) return;
  await firebaseDb.ref(`${FIREBASE_TOKEN_PATH}/${firebaseAuth.currentUser.uid}`).set({
    token,
    updatedAt: Date.now(),
    userAgent: navigator.userAgent.slice(0, 240)
  });
}

async function ensureMessagingServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;

  try {
    if (window.firebaseMessagingBootstrap?.registrationPromise) {
      return await window.firebaseMessagingBootstrap.registrationPromise;
    }

    return await navigator.serviceWorker.register("./firebase-messaging-sw.js");
  } catch (error) {
    console.error("Messaging service worker registration failed", error);
    return null;
  }
}

async function initFirebaseMessaging() {
  if (!firebaseReady) return;
  if (getFirebaseMessagingIssues().length > 0) return;

  try {
    firebaseMessaging = window.firebase.messaging();
    const serviceWorkerRegistration = await ensureMessagingServiceWorker();
    if (!serviceWorkerRegistration) return;

    const permission = await maybeRequestNotificationPermission();
    if (permission !== "granted") return;

    const token = await firebaseMessaging.getToken({
      vapidKey: FIREBASE_WEB_PUSH_VAPID_KEY,
      serviceWorkerRegistration
    });

    if (token) {
      await saveMessagingToken(token);
    }

    firebaseMessaging.onMessage((payload) => {
      if (document.visibilityState === "visible") return;

      showRealtimeNotification({
        id: payload.data?.eventId,
        date: payload.data?.date,
        title: payload.notification?.title || payload.data?.title,
        text: payload.notification?.body || payload.data?.text,
        overtimeHours: Number(payload.data?.overtimeHours || 0)
      });
    });
  } catch (error) {
    console.error("FCM init failed", error);
  }
}

async function initFirebaseRealtime() {
  if (!window.firebase || !window.firebase.apps) return;
  if (!isFirebaseConfigReady()) return;

  if (!window.firebase.apps.length) {
    window.firebase.initializeApp(FIREBASE_CONFIG);
  }

  await ensureFirebaseAuth();

  firebaseDb = window.firebase.database();
  firebaseEventsRef = firebaseDb.ref(FIREBASE_EVENTS_PATH);
  firebaseReady = true;

  firebaseEventsRef.once("value").then((snapshot) => {
    const existingIds = new Set(Object.keys(snapshot.val() || {}));
    firebaseEventsRef.on("child_added", (childSnap) => {
      if (existingIds.has(childSnap.key)) return;

      const payload = childSnap.val() || {};
      if (payload.senderId && payload.senderId === getFirebaseSenderId()) return;
      scheduleRealtimeNotification(payload, childSnap.key);
    });
  });
}

async function initFirebaseServices() {
  await initFirebaseRealtime();
  await initFirebaseMessaging();
}

function toggleOvertimeInput() {
  const checked = document.getElementById("eventHasOvertime").checked;
  document.getElementById("overtimeInputWrap").classList.toggle("show", checked);
  if (!checked) {
    document.getElementById("eventOvertimeHours").value = "";
  }
}

function toggleNotifyInput() {
  const checked = document.getElementById("eventRealtimeNotify").checked;
  document.getElementById("notifyInputWrap").classList.toggle("show", checked);
  if (!checked) {
    document.getElementById("eventNotifyAt").value = "";
  }
}

function openAddEventModalForToday() {
  const today = new Date();
  const key = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
  openModal(key, today.getDate(), today.getMonth() + 1, today.getFullYear());
}

/* ========================== SỰ KIỆN ========================== */
function openModal(key, d, m, y) {
  selectedKey = key;
  const event = readEventByKey(key) || {
    title: "",
    text: "",
    overtimeHours: 0,
    realtimeNotify: true,
    notifyAt: ""
  };

  document.getElementById("selectedDate").innerText = `${d}/${m}/${y}`;
  document.getElementById("eventTitle").value = event.title;
  document.getElementById("eventText").value = event.text;
  document.getElementById("eventHasOvertime").checked = Number(event.overtimeHours) > 0;
  document.getElementById("eventOvertimeHours").value =
    Number(event.overtimeHours) > 0 ? String(event.overtimeHours) : "";
  document.getElementById("eventRealtimeNotify").checked = event.realtimeNotify !== false;
  document.getElementById("eventNotifyAt").value = toDatetimeLocalValue(event.notifyAt);
  toggleOvertimeInput();
  toggleNotifyInput();

  document.getElementById("eventModal").style.display = "flex";
}

function closeModal() { document.getElementById("eventModal").style.display = "none"; }
document.getElementById("eventModal").addEventListener("click", function (e) {
  if (e.target === this) closeModal();
});

function openOvertimeModal() {
  document.getElementById("overtimeModal").style.display = "flex";
}

function closeOvertimeModal() {
  document.getElementById("overtimeModal").style.display = "none";
}

function openGoldModal() {
  document.getElementById("goldModal").style.display = "flex";
  loadGoldMarketData();
}

function closeGoldModal() {
  document.getElementById("goldModal").style.display = "none";
}

function toggleToolbox() {
  const toolbox = document.getElementById("quickToolbox");
  const toggleBtn = document.getElementById("toolboxToggle");

  const isCollapsed = toolbox.classList.toggle("is-collapsed");
  localStorage.setItem(TOOLBOX_STATE_KEY, isCollapsed ? "collapsed" : "expanded");
  toggleBtn.setAttribute("aria-expanded", String(!isCollapsed));
  toggleBtn.setAttribute(
    "aria-label",
    isCollapsed ? "Mở thanh công cụ" : "Thu gọn thanh công cụ"
  );
}

function applyStoredToolboxState() {
  const toolbox = document.getElementById("quickToolbox");
  const toggleBtn = document.getElementById("toolboxToggle");
  if (!toolbox || !toggleBtn) return;

  const savedState = localStorage.getItem(TOOLBOX_STATE_KEY);
  const isCollapsed = savedState === "collapsed";

  toolbox.classList.toggle("is-collapsed", isCollapsed);
  toggleBtn.setAttribute("aria-expanded", String(!isCollapsed));
  toggleBtn.setAttribute(
    "aria-label",
    isCollapsed ? "Mở thanh công cụ" : "Thu gọn thanh công cụ"
  );
}

document.getElementById("overtimeModal").addEventListener("click", function (e) {
  if (e.target === this) closeOvertimeModal();
});

document.getElementById("goldModal").addEventListener("click", function (e) {
  if (e.target === this) closeGoldModal();
});

function saveEvent() {
  const title = document.getElementById("eventTitle").value.trim();
  const text = document.getElementById("eventText").value.trim();
  const hasOvertime = document.getElementById("eventHasOvertime").checked;
  const realtimeNotify = document.getElementById("eventRealtimeNotify").checked;
  const notifyAt = document.getElementById("eventNotifyAt").value;
  const overtimeHours = hasOvertime
    ? Math.max(0, parseInt(document.getElementById("eventOvertimeHours").value, 10) || 0)
    : 0;

  if (realtimeNotify && !notifyAt) {
    alert("Vui lòng chọn giờ thông báo sự kiện trước khi lưu.");
    return;
  }

  const notifyAtMs = realtimeNotify ? toNotifyTimestamp(notifyAt) : null;
  if (realtimeNotify && !notifyAtMs) {
    alert("Giờ thông báo không hợp lệ.");
    return;
  }

  const hasData = Boolean(title || text || overtimeHours > 0);

  if (hasData) {
    const storedEvent = {
      title,
      text,
      overtimeHours,
      realtimeNotify,
      notifyAt: realtimeNotify ? notifyAt : ""
    };

    localStorage.setItem(selectedKey, encodeEventRecord(storedEvent));
    scheduleLocalEventReminder(selectedKey, storedEvent);

    if (realtimeNotify && !isFirebaseConfigReady()) {
      const missingConfig = getFirebaseConfigIssues();
      alert(`Thiếu cấu hình Firebase: ${missingConfig.join(", ")}. Vui lòng cập nhật để gửi thông báo realtime.`);
    }

    if (realtimeNotify && isFirebaseConfigReady()) {
      maybeRequestNotificationPermission().finally(() => {
        pushRealtimeEvent({
          date: selectedKey,
          title: title || "Sự kiện mới",
          text,
          overtimeHours,
          notifyAt,
          notifyAtMs
        }).catch(() => {
          alert("Không thể gửi sự kiện lên Firebase. Vui lòng kiểm tra Rules, databaseURL và kết nối mạng.");
        });
      });
    }
  } else {
    cancelScheduledNotification(`local-${selectedKey}`);
    localStorage.removeItem(selectedKey);
  }

  renderOvertime();
  renderOvertimeSalary();
  closeModal();
  renderCalendar();
}

function renderToday() {
  const today = new Date();

  const weekdays = [
    "Chủ nhật", "Thứ Hai", "Thứ Ba",
    "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"
  ];

  document.getElementById("todayWeekday").innerText =
    weekdays[today.getDay()];

  document.getElementById("todayDate").innerText =
    today.getDate();

  document.getElementById("todayMonthYear").innerText =
    `Tháng ${today.getMonth() + 1} năm ${today.getFullYear()}`;
}

const vietnameseQuotes = [
  "Muốn lấy mật thì đừng phá tổ ong.",
  "Hãy thành thật khen ngợi và biết ơn người khác.",
  "Cách duy nhất để chiến thắng trong tranh cãi là tránh nó.",
  "Hãy đặt mình vào vị trí của người khác.",
  "Luôn làm cho người khác cảm thấy quan trọng.",
  "Hãy lắng nghe nhiều hơn nói.",
  "Thành công đến từ khả năng hiểu và cảm thông.",
  "Một nụ cười có giá trị hơn ngàn lời nói.",
  "Muốn người khác yêu quý bạn, hãy chân thành yêu quý họ trước.",
  "Hãy khơi gợi mong muốn mãnh liệt ở người khác.",
  "Khen ngợi khéo léo có sức mạnh hơn chỉ trích.",
  "Đừng chỉ trích, đừng oán trách, đừng than phiền.",
  "Hãy nói về điều người khác quan tâm nhất – chính họ.",
  "Hãy để người khác cảm thấy ý kiến của họ được tôn trọng.",
  "Thừa nhận sai lầm nhanh chóng và thẳng thắn.",
  "Một lời nói dịu dàng có thể thay đổi cả một cuộc đời.",
  "Hãy làm cho người khác vui khi gặp bạn.",
  "Đừng ra lệnh, hãy gợi ý.",
  "Luôn cho người khác thấy họ có giá trị.",
  "Sự chân thành là nền tảng của mọi mối quan hệ.",
  "Muốn thay đổi người khác, hãy bắt đầu từ chính mình.",
  "Hãy nhớ tên người khác – đó là âm thanh ngọt ngào nhất với họ.",
  "Khuyến khích thay vì phê bình.",
  "Tôn trọng cảm xúc của người khác dù bạn không đồng ý.",
  "Hãy gieo thiện cảm trước khi đưa ra ý kiến.",
  "Sự tử tế tạo nên sức mạnh bền vững.",
  "Đừng tranh cãi để thắng, hãy thấu hiểu để thành công.",
  "Luôn giữ thể diện cho người khác.",
  "Một lời khen chân thành có thể thay đổi cả ngày.",
  "Hãy khích lệ những điều tốt đẹp, dù là nhỏ nhất.",
  "Cách cư xử quyết định giá trị con người.",
  "Hãy nói lời cảm ơn nhiều hơn bạn nghĩ.",
  "Sự quan tâm chân thành tạo nên ảnh hưởng lớn.",
  "Muốn được yêu mến, hãy biết cho đi.",
  "Hãy để người khác tự nói nhiều hơn.",
  "Đừng làm tổn thương lòng tự trọng của ai.",
  "Cư xử khéo léo là nghệ thuật của thành công.",
  "Hãy mỉm cười – nó mở ra mọi cánh cửa.",
  "Người thành công là người biết tôn trọng người khác.",
  "Luôn bắt đầu bằng lời khen chân thành.",
  "Một trái tim chân thành có sức mạnh hơn quyền lực.",
  "Hãy khiến người khác cảm thấy họ quan trọng – thật lòng.",
  "Cách bạn đối xử với người khác nói lên con người bạn.",
  "Thành công đến từ khả năng kết nối con người.",
  "Hãy nói chuyện bằng sự cảm thông.",
  "Lời nói xuất phát từ trái tim sẽ chạm đến trái tim.",
  "Hãy khơi dậy niềm tự hào nơi người khác.",
  "Sự chân thành là chìa khóa của lòng tin.",
  "Muốn dẫn dắt người khác, hãy hiểu họ trước."
];

function loadQuote() {
  const rand = Math.floor(Math.random() * vietnameseQuotes.length);
  document.getElementById("quoteText").innerHTML =
    `<img src="public/quote.png" alt="quote">${vietnameseQuotes[rand]}`;
}


function requestLocationPermission() {
  if (!navigator.geolocation) {
    document.getElementById("todayWeather").innerText =
      "Thiết bị không hỗ trợ định vị";
    return;
  }

  // Chỉ tự động xin quyền 1 lần giữa các lần truy cập.
  localStorage.setItem(GEO_PROMPT_ASKED_KEY, "1");

  navigator.geolocation.getCurrentPosition(
    position => {
      localStorage.setItem("geoPermission", "granted");
      handleWeather(position.coords.latitude, position.coords.longitude);
    },
    () => {
      localStorage.setItem("geoPermission", "denied");
      document.getElementById("todayWeather").innerText =
        "📍 Bạn đã tắt định vị";
    }
  );
}

function showLocationDisabledMessage() {
  document.getElementById("todayWeather").innerText =
    "📍 Thời tiết: chưa bật định vị";
}

function loadWeatherFromCurrentPosition() {
  navigator.geolocation.getCurrentPosition(
    position => {
      localStorage.setItem("geoPermission", "granted");
      handleWeather(position.coords.latitude, position.coords.longitude);
    },
    () => {
      localStorage.setItem("geoPermission", "denied");
      showLocationDisabledMessage();
    }
  );
}

function getAddressFromCoords(lat, lon) {
  return fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`,
    {
      headers: {
        "Accept-Language": "vi"
      }
    }
  )
    .then(res => res.json())
    .then(data => {
      const addr = data.address || {};

      const ward =
        addr.suburb ||
        addr.quarter ||
        addr.city ||
        addr.town ||
        addr.village ||
        "";

      const province = (addr.state || "")
        .replace("Tỉnh ", "")
        .replace("Thành phố ", "");

      if (ward && province) {
        return `${ward}, ${province}`;
      }

      return ward || province || "Vị trí hiện tại";
    })
    .catch(() => "Vị trí hiện tại");
}

function getWeatherIcon(code) {
  if (code === 0) return "☀️";
  if ([1, 2].includes(code)) return "🌤️";
  if (code === 3) return "☁️";
  if ([45, 48].includes(code)) return "🌫️";
  if ([51, 53, 55].includes(code)) return "🌦️";
  if ([61, 63, 65].includes(code)) return "🌧️";
  if ([66, 67].includes(code)) return "🌧️❄️";
  if ([71, 73, 75].includes(code)) return "❄️";
  if (code === 77) return "🌨️";
  if ([80, 81, 82].includes(code)) return "🌧️";
  if ([85, 86].includes(code)) return "❄️";
  if ([95, 96, 99].includes(code)) return "⛈️";
  return "🌤️";
}

function getWeatherColor(code) {
  if (code === 0) return "#e3efff";
  if ([1, 2].includes(code)) return "#c9dcff";
  if (code === 3) return "#b7c9e6";
  if ([45, 48].includes(code)) return "#9bb1d3";
  if ([61, 63, 65, 80, 81, 82].includes(code)) return "#8cb2ee";
  if ([71, 73, 75, 85, 86].includes(code)) return "#abc3e6";
  if ([95, 96, 99].includes(code)) return "#7ea7df";
  return "#d0e2ff";
}

function handleWeather(lat, lon) {
  Promise.all([
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}
&current_weather=true
&hourly=relativehumidity_2m
&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max,windspeed_10m_max,sunrise,sunset
&timezone=auto`
    ).then(res => res.json()),
    getAddressFromCoords(lat, lon)
  ])
    .then(([data, locationName]) => {
      const w = data.current_weather;
      const icon = getWeatherIcon(w.weathercode);
      const color = getWeatherColor(w.weathercode);

      const sunrise = data.daily.sunrise[0].slice(11, 16);
      const sunset = data.daily.sunset[0].slice(11, 16);
      
      const weatherEl = document.getElementById("todayWeather");

      weatherEl.innerHTML = `
              <div class="weather-row">
                  <div class="weather-main">
                      ${icon} ${Math.round(w.temperature)}°C – ${weatherCodeToText(w.weathercode)}
                  </div>
                  <div class="sun-time">
                      <img src="public/mostly-sunny.png" alt="icon"> ${sunrise} &nbsp;&nbsp; <img src="public/sun.png" alt="quote"> ${sunset}
                  </div>
              </div>
              <div class="gg-maps" style="font-size:14px;margin-top:4px;color:${color}">
                  <img src="public/google-maps.png" alt="icon"> ${locationName}
              </div>
          `;

      renderForecast(data.daily, data.hourly);
    })
    .catch(() => {
      document.getElementById("todayWeather").innerText =
        "Không lấy được dữ liệu thời tiết";
    });
}

function getDailyHumidity(hourly, dateStr) {
  const day = dateStr;
  let sum = 0, count = 0;

  hourly.time.forEach((t, i) => {
    if (t.startsWith(day)) {
      sum += hourly.relativehumidity_2m[i];
      count++;
    }
  });

  return count ? Math.round(sum / count) : "--";
}


function renderForecast(daily, hourly) {
  const forecastEl = document.getElementById("weatherForecast");
  forecastEl.innerHTML = "";

  for (let i = 1; i < daily.time.length; i++) {
    const date = new Date(daily.time[i]);
    const day = date.toLocaleDateString("vi-VN", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit"
    });

    const icon = getWeatherIcon(daily.weathercode[i]);
    const desc = weatherCodeToText(daily.weathercode[i]);

    const max = Math.round(daily.temperature_2m_max[i]);
    const min = Math.round(daily.temperature_2m_min[i]);
    const rain = daily.precipitation_probability_max[i] ?? 0;
    const wind = Math.round(daily.windspeed_10m_max[i]);

    // Tính độ ẩm trung bình trong ngày
    const humidity = getDailyHumidity(hourly, daily.time[i]);

    forecastEl.innerHTML += `
      <div class="forecast-card">
        <div class="fc-header">
          <div class="fc-day">${day}</div>
          <div class="fc-icon">${icon}</div>
        </div>

        <div class="fc-desc">${desc}</div>

        <div class="fc-temp">
          <span class="max">${max}°</span>
          <span class="min">${min}°</span>
        </div>

        <div class="fc-extra">
          <div>💧 ${humidity}%</div>
          <div>🌧 ${rain}%</div>
          <div>💨 ${wind} km/h</div>
        </div>
      </div>
    `;
  }
}


async function fetchWeatherByLocation() {
  if (!navigator.geolocation) {
    document.getElementById("todayWeather").innerText =
      "Thiết bị không hỗ trợ định vị";
    return;
  }

  if (!window.isSecureContext) {
    document.getElementById("todayWeather").innerText =
      "📍 Cần mở bằng HTTPS hoặc localhost để dùng định vị";
    return;
  }

  // Ưu tiên trạng thái quyền thật của trình duyệt thay vì chỉ dựa localStorage.
  if (navigator.permissions && navigator.permissions.query) {
    try {
      const status = await navigator.permissions.query({ name: "geolocation" });
      const askedBefore = localStorage.getItem(GEO_PROMPT_ASKED_KEY) === "1";

      if (status.state === "granted") {
        localStorage.setItem("geoPermission", "granted");
        loadWeatherFromCurrentPosition();
        return;
      }

      if (status.state === "denied") {
        localStorage.setItem("geoPermission", "denied");
        showLocationDisabledMessage();
        return;
      }

      // Trạng thái prompt: tự động xin quyền đúng yêu cầu.
      if (!askedBefore && !geoPromptRequestedThisLoad) {
        geoPromptRequestedThisLoad = true;
        requestLocationPermission();
      } else {
        showLocationDisabledMessage();
      }
      return;
    } catch {
      // Fallback cho trình duyệt không hỗ trợ đầy đủ Permissions API.
    }
  }

  const permission = localStorage.getItem("geoPermission");
  const askedBefore = localStorage.getItem(GEO_PROMPT_ASKED_KEY) === "1";
  if (permission === "denied") {
    showLocationDisabledMessage();
    return;
  }

  if (permission === "granted") {
    loadWeatherFromCurrentPosition();
    return;
  }

  if (!askedBefore && !geoPromptRequestedThisLoad) {
    geoPromptRequestedThisLoad = true;
    requestLocationPermission();
    return;
  }

  showLocationDisabledMessage();
}

function weatherCodeToText(code) {
  const map = {
    0: "Trời quang",
    1: "Ít mây",
    2: "Mây rải rác",
    3: "Nhiều mây",
    45: "Sương mù",
    48: "Sương mù dày",
    51: "Mưa phùn nhẹ",
    53: "Mưa phùn",
    55: "Mưa phùn dày",
    61: "Mưa nhỏ",
    63: "Mưa vừa",
    65: "Mưa to",
    71: "Tuyết nhẹ",
    73: "Tuyết",
    75: "Tuyết dày",
    80: "Mưa rào nhẹ",
    81: "Mưa rào",
    82: "Mưa rào mạnh",
    95: "Dông",
    99: "Dông mạnh"
  };
  return map[code] || "Thời tiết không xác định";
}
function getCanChiYear(year) {
  const can = ["Giáp", "Ất", "Bính", "Đinh", "Mậu", "Kỷ", "Canh", "Tân", "Nhâm", "Quý"];
  const chi = ["Tý", "Sửu", "Dần", "Mão", "Thìn", "Tỵ", "Ngọ", "Mùi", "Thân", "Dậu", "Tuất", "Hợi"];
  return `${can[(year + 6) % 10]} ${chi[(year + 8) % 12]}`;
}

function renderTodayLunar() {
  const today = new Date();

  const lunar = convertSolarToLunar(
    today.getDate(),
    today.getMonth() + 1,
    today.getFullYear()
  );

  const canChiYear = getCanChiYear(lunar.lunarYear);

  document.getElementById("todayLunar").innerText =
    `Âm lịch: ${lunar.lunarDay} tháng ${lunar.lunarMonth} năm ${canChiYear}`;
}

function updateClock() {
  const now = new Date();

  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");

  document.getElementById("clock").innerText = `${h}:${m}:${s}`;
}

function calcOvertimeSummary(viewYear, viewMonth) {
  let weekday = { base: 0, bonus: 0 };
  let sunday = { base: 0, bonus: 0 };

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!isDateKey(key)) continue;

    const [y, m, d] = key.split("-").map(Number);

    // ✅ LỌC THEO THÁNG ĐANG XEM TRÊN LỊCH
    if (y !== viewYear || m !== viewMonth + 1) continue;

    const baseHours = getOvertimeHoursForDateKey(key);
    if (baseHours <= 0) continue;

    const date = new Date(y, m - 1, d);
    const dayOfWeek = date.getDay(); // 0 = Chủ nhật

    let bonusHours = 0;

    if (dayOfWeek === 0) {
      // Chủ nhật phải > 10 tiếng
      if (baseHours >= 10) {
        bonusHours = 0.5;
      }
    } else {
      // Ngày thường ≥ 2 tiếng
      if (baseHours >= 2) {
        bonusHours = 0.5;
      }
    }

    if (dayOfWeek === 0) {
      sunday.base += baseHours;
      sunday.bonus += bonusHours;
    } else {
      weekday.base += baseHours;
      weekday.bonus += bonusHours;
    }
  }

  return {
    weekday,
    sunday,
    total: {
      base: weekday.base + sunday.base,
      bonus: weekday.bonus + sunday.bonus,
      sum:
        weekday.base +
        sunday.base +
        weekday.bonus +
        sunday.bonus
    }
  };
}

function renderOvertime() {
  const ot = calcOvertimeSummary(currentDate.getFullYear(), currentDate.getMonth());

  otWeekdayBase.innerText = ot.weekday.base;
  otWeekdayBonus.innerText = ot.weekday.bonus;

  otSundayBase.innerText = ot.sunday.base;
  otSundayBonus.innerText = ot.sunday.bonus;

  otTotalBase.innerText = ot.total.base;
  otTotalBonus.innerText = ot.total.bonus;
  otTotalSum.innerText = ot.total.sum;
}

function calcOvertimeSalary(viewYear, viewMonth, hourlyRate) {
  let weekday = {
    hours: 0,
    salary: 0
  };

  let sunday = {
    hours: 0,
    salary: 0
  };

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!isDateKey(key)) continue;

    const [y, m, d] = key.split("-").map(Number);

    // 🚫 BỎ QUA NẾU KHÔNG PHẢI THÁNG ĐANG XEM
    if (y !== viewYear || m !== viewMonth + 1) continue;

    const date = new Date(y, m - 1, d);
    const dow = date.getDay(); // 0 = Chủ nhật

    const baseHours = getOvertimeHoursForDateKey(key);
    if (baseHours <= 0) continue;

    const bonusHours = dow === 0 ? (baseHours >= 10 ? 0.5 : 0) : (baseHours >= 2 ? 0.5 : 0);
    const totalHours = baseHours + bonusHours;



    if (dow === 0) {
      // 🟥 CHỦ NHẬT – tách 2 mốc
      const firstPart = Math.min(totalHours, 8);
      const extraPart = Math.max(totalHours - 8, 0);

      sunday.hours += totalHours;

      sunday.salary +=
        firstPart * hourlyRate * 2 +
        extraPart * hourlyRate * 3;
    }
    else {
      // 🟦 NGÀY THƯỜNG
      weekday.hours += totalHours;
      weekday.salary += totalHours * hourlyRate * 1.5;
    }
  }

  return {
    weekday,
    sunday,
    total: {
      hours: weekday.hours + sunday.hours,
      salary: weekday.salary + sunday.salary
    }
  };
}


function formatCurrencyInput(input) {
  // Lấy vị trí con trỏ
  const cursorPos = input.selectionStart;

  // Chỉ giữ số
  let raw = input.value.replace(/\D/g, "");
  if (!raw) {
    input.value = "";
    return;
  }

  // Format tiền VN
  const formatted = Number(raw).toLocaleString("vi-VN");

  // Tính lại vị trí con trỏ
  const diff = formatted.length - input.value.length;
  input.value = formatted;
  input.setSelectionRange(cursorPos + diff, cursorPos + diff);
}

function formatVnd(value) {
  return Math.round(value).toLocaleString("vi-VN");
}

function parseVietnamPrice(valueText) {
  if (!valueText) return null;
  const normalized = valueText.replace(/\./g, "").replace(/,/g, ".");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function parseCurrentVietnamGold(content) {
  const updatedMatch =
    content.match(/Cập nhật lúc\s+([^\n]+)/i) ||
    content.match(/Cập nhật:\s*([^\n]+)/i) ||
    content.match(/Giá vàng tại thời điểm\s+([^\n]+?)\s+như sau:/i) ||
    content.match(/Published Time:\s*([^\n]+)/i);

  const headlineMatch = content.match(
    /Giá vàng SJC hôm nay[\s\S]{0,600}?Mua vào\s+([0-9.,]+)[\s\S]{0,220}?Bán ra\s+([0-9.,]+)/i
  );
  const tableMatch = content.match(
    /\|\s*Hồ Chí Minh\s*\|\s*Vàng SJC 1L, 10L, 1KG\s*\|\s*([0-9.,]+)\s*\|\s*([0-9.,]+)\s*\|/i
  );
  const fallbackBuy = content.match(/Mua vào\s+([0-9.,]+)/i);
  const fallbackSell = content.match(/Bán ra\s+([0-9.,]+)/i);

  const buyRaw = headlineMatch?.[1] || tableMatch?.[1] || fallbackBuy?.[1] || null;
  const sellRaw = headlineMatch?.[2] || tableMatch?.[2] || fallbackSell?.[1] || null;

  const buyThousand = parseVietnamPrice(buyRaw);
  const sellThousand = parseVietnamPrice(sellRaw);
  if (!Number.isFinite(buyThousand) || !Number.isFinite(sellThousand)) return null;

  return {
    updatedAt: updatedMatch ? updatedMatch[1].trim() : "--",
    buyThousand,
    sellThousand
  };
}

function parseVietnamHistoryDates(content) {
  const matches = content.match(/\d{4}-\d{2}-\d{2}\.html/g) || [];
  const uniqueDates = [...new Set(matches.map(x => x.replace(".html", "")))];
  return uniqueDates.sort((a, b) => b.localeCompare(a));
}

function parseDailyVietnamGold(content, date) {
  const buyMatch = content.match(/Mua vào\s+([0-9.,]+)\s+x1000đ\/lượng/i);
  const sellMatch = content.match(/Bán ra\s+([0-9.,]+)\s+x1000đ\/lượng/i);

  if (!buyMatch || !sellMatch) return null;

  const buyThousand = parseVietnamPrice(buyMatch[1]);
  const sellThousand = parseVietnamPrice(sellMatch[1]);
  if (!buyThousand || !sellThousand) return null;

  const parts = date.split("-");
  const label = parts.length === 3 ? `${parts[2]}/${parts[1]}` : date;

  return {
    label,
    buyValue: buyThousand * 1000,
    sellValue: sellThousand * 1000
  };
}

function drawGoldChart(canvasId, points) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !points.length) return;

  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 680;
  const height = 240;
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);

  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const pad = { top: 16, right: 12, bottom: 30, left: 12 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  const values = points.flatMap(p => [p.buyValue, p.sellValue]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);

  ctx.strokeStyle = "rgba(183,208,255,0.22)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const y = pad.top + (chartH / 3) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();
  }

  const toXY = (value, idx) => {
    const x = pad.left + (chartW * idx) / Math.max(points.length - 1, 1);
    const y = pad.top + ((max - value) / range) * chartH;
    return { x, y };
  };

  const drawLine = (key, color) => {
    ctx.beginPath();
    points.forEach((point, idx) => {
      const { x, y } = toXY(point[key], idx);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  drawLine("buyValue", "#7fd3ff");
  drawLine("sellValue", "#ffe39c");

  // Dots on every point
  points.forEach((p, idx) => {
    const buy = toXY(p.buyValue, idx);
    const sell = toXY(p.sellValue, idx);

    ctx.fillStyle = "#7fd3ff";
    ctx.beginPath();
    ctx.arc(buy.x, buy.y, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffe39c";
    ctx.beginPath();
    ctx.arc(sell.x, sell.y, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  // Labels for all 7 points
  ctx.fillStyle = "#bdd0ee";
  ctx.font = "11px Be Vietnam Pro";
  points.forEach((p, idx) => {
    const { x } = toXY(p.buyValue, idx);
    ctx.textAlign = "center";
    ctx.fillText(p.label, x, height - 6);
  });

  // Legend
  ctx.font = "12px Be Vietnam Pro";
  ctx.fillStyle = "#7fd3ff";
  ctx.textAlign = "left";
  ctx.fillText("● Mua", pad.left + 4, pad.top + 12);
  ctx.fillStyle = "#ffe39c";
  ctx.fillText("● Bán", pad.left + 60, pad.top + 12);
}

async function fetchTextWithCorsFallback(url) {
  const proxyUrl = `https://r.jina.ai/http://${url.replace(/^https?:\/\//, "")}`;
  const res = await fetch(proxyUrl);
  if (!res.ok) throw new Error("Không thể tải dữ liệu do CORS");

  const raw = await res.text();
  const marker = "Markdown Content:";
  const markerIndex = raw.indexOf(marker);

  if (markerIndex === -1) return raw.trim();
  return raw.slice(markerIndex + marker.length).trim();
}

async function getRecentVietnamGoldHistory(limit = 7) {
  const indexContent = await fetchTextWithCorsFallback("https://giavang.org/trong-nuoc/sjc/lich-su");
  const candidateDates = parseVietnamHistoryDates(indexContent).slice(0, 10);
  const points = [];

  for (const date of candidateDates) {
    if (points.length >= limit) break;

    try {
      const dayContent = await fetchTextWithCorsFallback(`https://giavang.org/trong-nuoc/sjc/lich-su/${date}.html`);
      const point = parseDailyVietnamGold(dayContent, date);
      if (point) points.push(point);
    } catch {
      // bỏ qua ngày lỗi mạng hoặc thiếu dữ liệu
    }
  }

  return points.reverse();
}

async function loadGoldMarketData() {
  const updatedEl = document.getElementById("goldUpdatedAt");
  const buyEl = document.getElementById("goldBuyLuong");
  const sellEl = document.getElementById("goldSellLuong");
  const noteEl = document.getElementById("goldSourceNote");

  updatedEl.innerText = "Đang tải dữ liệu giá vàng Việt Nam...";
  buyEl.innerText = "--";
  sellEl.innerText = "--";

  try {
    const currentContent = await fetchTextWithCorsFallback("https://giavang.org/trong-nuoc/sjc");
    const current = parseCurrentVietnamGold(currentContent);
    if (!current) {
      throw new Error("Thiếu dữ liệu giá vàng Việt Nam hiện tại");
    }

    const buyVnd = current.buyThousand * 1000;
    const sellVnd = current.sellThousand * 1000;

    buyEl.innerText = formatVnd(buyVnd);
    sellEl.innerText = formatVnd(sellVnd);
    updatedEl.innerText = `Giá vàng SJC hôm nay Cập nhật lúc ${current.updatedAt}`;

    noteEl.innerText = "Nguồn: giavang.org (giá vàng trong nước SJC toàn quốc hiện tại) qua proxy r.jina.ai.";
  } catch {
    noteEl.innerText = "Nguồn nội địa đang lỗi mạng hoặc bị chặn. Vui lòng thử lại sau.";
  }
}

const salaryInput = document.getElementById("hourSalary");

salaryInput.addEventListener("input", () => {
  formatCurrencyInput(salaryInput);
  renderOvertimeSalary();
});


function renderOvertimeSalary() {
  const salaryPerHour = parseInt(
    hourSalary.value.replace(/\D/g, ""),
    10
  );
  if (!salaryPerHour || salaryPerHour <= 0) {
    document.getElementById("otSalary").innerText = "0";
    return;
  }

  const otSalary = calcOvertimeSalary(currentDate.getFullYear(), currentDate.getMonth(), salaryPerHour);

  const totalMoney = otSalary.total.salary;

  document.getElementById("otSalary").innerText =
    totalMoney.toLocaleString("vi-VN");
}

hourSalary.addEventListener("input", renderOvertimeSalary);



renderOvertime();
document.getElementById("eventHasOvertime").addEventListener("change", toggleOvertimeInput);
document.getElementById("eventRealtimeNotify").addEventListener("change", toggleNotifyInput);


// cập nhật mỗi giây
setInterval(updateClock, 1000);
updateClock();


/* ========================== INIT ========================= */
applyStoredToolboxState();
renderCalendar();
renderToday();
loadQuote();
fetchWeatherByLocation();
renderTodayLunar();
initFirebaseServices();
restoreLocalScheduledNotifications();
