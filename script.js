/* ========================== CẤU HÌNH ========================== */
let currentDate = new Date();
let selectedKey = "";
let selectedEventIndex = -1;
let geoPromptRequestedThisLoad = false;
const TOOLBOX_STATE_KEY = "quickToolboxState";
const GEO_PROMPT_ASKED_KEY = "geoPromptAsked";
const GEO_COORDS_CACHE_KEY = "geoCoordsCache";
const QUICK_NOTE_STORAGE_KEY_PREFIX = "quickNotesV1";
const MY_MUSIC_PREFS_KEY_PREFIX = "myMusicPrefsV1";
const FIREBASE_EVENTS_PATH = self.FIREBASE_EVENTS_PATH || "calendarEvents";
const FIREBASE_CLIENT_ID_KEY = "firebaseClientId";
const FIREBASE_PROFILE_KEY_STORAGE = "calendarProfileKey";
const FIREBASE_USERS_PATH = "users";
const LEGACY_MIGRATION_FLAG_PREFIX = "calendarLegacyMigrated:";
const LEGACY_CASHFLOW_MIGRATION_FLAG_PREFIX = "calendarLegacyCashflowMigrated:";
const CASHFLOW_CATEGORY_ID_MIGRATION_FLAG_PREFIX = "cashflowCategoryIdMigrated:";
const LEGACY_CASHFLOW_STORAGE_KEY = "cashflowEntriesV1";
const FIREBASE_CONFIG = self.FIREBASE_WEB_CONFIG || {};
const FIREBASE_TRANSLATE_HISTORY_PATH =
  self.FIREBASE_TRANSLATE_HISTORY_PATH || "translateHistory";
const FIREBASE_NOTIFICATION_TOKENS_PATH = "notificationTokens";
const FIREBASE_EVENT_NOTIFICATION_QUEUE_PATH = "eventNotificationQueue";
const FIREBASE_EVENT_REMINDERS_PATH = "eventReminders";
const FIREBASE_USER_NOTIFICATIONS_PATH = "userNotifications";
const DEVICE_ID_STORAGE_KEY = "calendarDeviceId";

let firebaseDb = null;
let firebaseDatesRef = null;
let firebaseQuickNotesRef = null;
let firebaseTranslateHistoryRef = null;
let firebaseUserNotificationsRef = null;
let userNotificationsCache = [];
let notificationFilterMode = "all";
let firebaseProfileSettingsRef = null;
let firebaseMessaging = null;
let isPushNotificationSubscribed = false;
let firebaseReady = false;
let firebaseAuth = null;
let firebaseUsersRef = null;
let firebaseProjectsRef = null;
let userProfileKey = "";
let currentUsername = "";
let legacyProfileKey = "";
let dateDataCache = {};
let quickNotesCache = null;
let translateHistoryCache = [];
let syncWriteErrorShown = false;
let profileSettingsCache = {};

// Modal history management for back-button support
let _modalHistoryStack = [];
let _isHandlingHistoryModal = false;

function getOpenModalId() {
  const modalIds = [
    "addEventModal",
    "dayDetailsModal",
    "overtimeModal",
    "goldModal",
    "quickNoteModal",
    "myMusicModal",
    "cashflowModal",
    "cashflowDeleteConfirmModal",
    "currencyModal",
    "fundsModal",
    "fundModal",
    "allocateModal",
    "topupFundModal",
    "profileSettingsModal",
    "cropModal",
    "newsModal",
    "translateModal",
    "learnModal",
    "quizModal",
    "countdownModal",
    "projectsModal",
    "projectTasksModal",
    "projectFormModal",
    "taskFormModal",
    "cashflowQuickViewModal",
    "eventQuickViewModal",
    "cashflowCategoryModal",
  ];
  for (const id of modalIds) {
    const el = document.getElementById(id);
    if (el && el.style.display === "flex") return id;
  }
  return null;
}

function closeCurrentModalForHistory() {
  const openId = getOpenModalId();
  if (!openId) return false;
  const closer = window[`close${openId
    .replace(/([A-Z])/g, (m) => m)
    .replace(/^[a-z]/, (m) => m.toUpperCase())}Modal`];
  if (typeof closer === "function") {
    closer();
  } else {
    const el = document.getElementById(openId);
    if (el) el.style.display = "none";
  }
  return true;
}

function _syncModalHistoryState() {
  const openId = getOpenModalId();
  const url = openId ? `#modal:${openId}` : window.location.pathname;
  if (window.location.hash !== `#modal:${openId}`) {
    if (openId) {
      history.pushState({ modal: openId }, "", url);
    } else {
      history.pushState({ modal: null }, "", url);
    }
  }
}

function initModalHistory() {
  window.addEventListener(
    "popstate",
    (e) => {
      if (_isHandlingHistoryModal) return;
      _isHandlingHistoryModal = true;

      const openId = getOpenModalId();
      if (openId) {
        closeCurrentModalForHistory();
      } else if (
        e.state &&
        typeof e.state.modal === "string" &&
        e.state.modal !== "null"
      ) {
        const opener = window[`open${e.state.modal
          .replace(/([A-Z])/g, (m) => m)
          .replace(/^[a-z]/, (m) => m.toUpperCase())}Modal`];
        if (typeof opener === "function") opener();
      }

      setTimeout(() => {
        _isHandlingHistoryModal = false;
      }, 0);
    },
    false,
  );

  const observer = new MutationObserver(() => {
    if (_isHandlingHistoryModal) return;
    _syncModalHistoryState();
  });

  document.querySelectorAll(".modal").forEach((modal) => {
    observer.observe(modal, {
      attributes: true,
      attributeFilter: ["style"],
    });
  });
}

// Projects state
let projectsDataCache = {};
let currentOpenedProjectId = null;
let projectTasksCache = {};
let _editingProjectId = null;
let _editingTaskId = null;

function generateId() {
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// Lễ dương lịch
const SOLAR_HOLIDAYS = {
  "1-1": "Tết Dương",
  "30-4": "30/4",
  "1-5": "1/5",
  "2-9": "Quốc khánh",
};

// Lễ âm lịch
const LUNAR_HOLIDAYS = {
  "1-1": "Tết Nguyên Đán",
  "15-1": "Rằm tháng Giêng",
  "10-3": "Giỗ Tổ",
  "15-8": "Trung Thu",
};

/* ========================== HÀM HỖ TRỢ ========================== */
const PI = Math.PI;
const TIMEZONE = 7; // GMT+7

function INT(d) {
  return Math.floor(d);
}

/* Julian Day từ ngày dương */
function jdFromDate(dd, mm, yy) {
  let a = INT((14 - mm) / 12);
  let y = yy + 4800 - a;
  let m = mm + 12 * a - 3;
  let jd =
    dd +
    INT((153 * m + 2) / 5) +
    365 * y +
    INT(y / 4) -
    INT(y / 100) +
    INT(y / 400) -
    32045;
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
  let month = E < 14 ? E - 1 : E - 13;
  let year = month > 2 ? C - 4716 : C - 4715;
  return { day, month, year };
}

/* Tính ngày trăng mới (New Moon) theo thuật toán Hồ Ngọc Đức */
function NewMoon(k) {
  let T = k / 1236.85;
  let T2 = T * T;
  let T3 = T2 * T;
  let dr = PI / 180;
  let Jd1 =
    2415020.75933 +
    29.53058868 * k +
    0.0001178 * T2 -
    0.000000155 * T3 +
    0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  let M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  let Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  let F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let C1 =
    (0.1734 - 0.000393 * T) * Math.sin(M * dr) +
    0.0021 * Math.sin(2 * M * dr) -
    0.4068 * Math.sin(Mpr * dr) +
    0.0161 * Math.sin(2 * Mpr * dr) -
    0.0004 * Math.sin(3 * Mpr * dr) +
    0.0104 * Math.sin(2 * F * dr) -
    0.0051 * Math.sin(M + Mpr * dr) -
    0.0074 * Math.sin(M - Mpr * dr) +
    0.0004 * Math.sin(2 * F + M * dr) -
    0.0004 * Math.sin(2 * F - M * dr) -
    0.0006 * Math.sin(2 * F + Mpr * dr) +
    0.001 * Math.sin(2 * F - Mpr * dr) +
    0.0005 * Math.sin(2 * Mpr + M * dr);
  let JdNew = Jd1 + C1;
  return INT(JdNew + 0.5 + TIMEZONE / 24);
}

/* Kinh độ Mặt Trời tại ngày JDN */
function SunLongitude(jdn) {
  let T = (jdn - 2451545.5 - TIMEZONE / 24) / 36525;
  let T2 = T * T;
  let dr = PI / 180;
  let M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  let L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL =
    (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(M * dr) +
    (0.019993 - 0.000101 * T) * Math.sin(2 * M * dr) +
    0.00029 * Math.sin(3 * M * dr);
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
function renderTodayEvents() {
  const today = new Date();
  const key = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
  const events = getEventsForDate(key);
  const panel = document.getElementById("todayEvents");
  if (!panel) return;

  if (events.length === 0) {
    panel.style.display = "none";
    return;
  }

  panel.style.display = "block";
  const nowTime = Date.now();

  panel.innerHTML = `
    <div class="today-events-list">${events
      .map((ev, idx) => {
        const timeStr = ev.eventDateTime
          ? new Date(ev.eventDateTime).toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
          })
          : "";
        const evColor = escapeHtml(ev.color || "#3b82f6");

        let imminentBadge = "";

        if (ev.eventDateTime) {
          try {
            const evTime = new Date(ev.eventDateTime).getTime();
            if (!Number.isNaN(evTime)) {
              const diffMinutes = Math.round((evTime - nowTime) / (60 * 1000));
              if (diffMinutes > 0 && diffMinutes <= 60) {
                // Sắp đến hạn (trong 60 phút tới): Tag đỏ thỉnh thoảng rung
                imminentBadge = `<span class="imminent-badge" title="Sự kiện sắp đến hạn trong ${diffMinutes} phút">🔥 Còn ${diffMinutes}p</span>`;
              } else if (diffMinutes <= 0 && diffMinutes >= -60) {
                // Đang diễn ra: Tag xanh lá cây đứng im
                imminentBadge = `<span class="imminent-badge is-live" title="Sự kiện đang diễn ra">⚡ Đang diễn ra</span>`;
              }
            }
          } catch (e) { }
        }

        return `<div class="today-event-item" 
                     style="--event-color: ${evColor}; border-left-color: ${evColor}; cursor: pointer;"
                     onclick="selectedKey='${key}'; openEventQuickViewModal(getEventsForDate('${key}')[${idx}], '${key}', ${idx});"
                     title="Nhấp để xem chi tiết sự kiện">
          ${timeStr ? `<span class="today-event-time" style="color: ${evColor};">${timeStr}</span>` : ""}
          <span class="today-event-title">${escapeHtml(ev.title || "(Không có tiêu đề)")}</span>
          ${imminentBadge}
          ${ev.text ? `<span class="today-event-text">${escapeHtml(ev.text)}</span>` : ""}
        </div>`;
      })
      .join("")}</div>
  `;
}

function renderCalendar() {
  const calDom = document.getElementById("calendar");
  calDom.innerHTML = "";
  renderTodayEvents();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  document.getElementById("monthYear").innerText =
    `Tháng ${month + 1} / ${year}`;

  let firstDayOfMonth = new Date(year, month, 1).getDay();
  // Chuyển Chủ Nhật (0) thành 6, Thứ Hai (1) thành 0... để tuần bắt đầu từ Thứ Hai
  firstDayOfMonth = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
  const startDate = new Date(year, month, 1 - firstDayOfMonth);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

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
    const dayEvents = getEventsForDate(key);

    if (cellDate.getTime() === today.getTime()) div.classList.add("today");
    if (dayEvents.length > 0) div.classList.add("has-event");
    if (getOvertimeHoursForDateKey(key) > 0) div.classList.add("has-overtime");

    const isCustomHoliday = !!getDateData(key).isHoliday;

    if (
      SOLAR_HOLIDAYS[`${d}-${m}`] ||
      LUNAR_HOLIDAYS[`${lunar.lunarDay}-${lunar.lunarMonth}`] ||
      isCustomHoliday
    ) {
      div.classList.add("holiday");
    }

    let holidayName = "";

    if (SOLAR_HOLIDAYS[`${d}-${m}`]) {
      holidayName = SOLAR_HOLIDAYS[`${d}-${m}`];
    }

    if (LUNAR_HOLIDAYS[`${lunar.lunarDay}-${lunar.lunarMonth}`]) {
      holidayName = LUNAR_HOLIDAYS[`${lunar.lunarDay}-${lunar.lunarMonth}`];
    }

    if (isCustomHoliday && !holidayName) {
      holidayName = "Ngày nghỉ lễ";
    }

    const hasOvertime = getOvertimeHoursForDateKey(key) > 0;
    let dotsHtml = "";
    if (dayEvents.length > 0 || hasOvertime) {
      const displayDots = dayEvents.slice(0, 5);
      const extraCount = dayEvents.length - displayDots.length;
      const overtimeDot = hasOvertime
        ? `<span class="day-event-dot day-overtime-dot" style="background-color: #4ade80; color: #4ade80;" title="Tăng ca"></span>`
        : "";
      dotsHtml = `
        <div class="day-event-dots">
          ${displayDots
          .map((ev) => {
            const c = escapeHtml(ev.color || "#3b82f6");
            return `<span class="day-event-dot" style="background-color: ${c}; color: ${c};" title="${escapeHtml(ev.title || "Sự kiện")}"></span>`;
          })
          .join("")}
          ${extraCount > 0 ? `<span class="day-event-more">+${extraCount}</span>` : ""}
          ${overtimeDot}
        </div>
      `;
    }

    div.innerHTML = `
  <div class="solar">${d}</div>
  <div class="lunar">${lunar.lunarDay}/${lunar.lunarMonth}${lunar.lunarLeap ? "N" : ""}</div>
  ${dotsHtml}
`;

    div.onclick = () => openModal(key, d, m, y);

    calDom.appendChild(div);
  }
}

/* ========================== THÁNG ========================== */
function changeMonth(step) {
  const calDom = document.getElementById("calendar");
  if (!calDom) {
    currentDate.setMonth(currentDate.getMonth() + step);
    renderCalendar();
    renderOvertime();
    renderOvertimeSalary();
    return;
  }

  // Hướng slide: step > 0 (tháng sau) → slide sang trái; step < 0 (tháng trước) → slide sang phải
  const outClass = step > 0 ? "cal-slide-out-left" : "cal-slide-out-right";
  const inClass = step > 0 ? "cal-slide-in-right" : "cal-slide-in-left";

  // Xoá class cũ nếu animation đang chạy dở
  calDom.classList.remove(
    "cal-slide-in-right", "cal-slide-in-left",
    "cal-slide-out-left", "cal-slide-out-right"
  );

  // Bước 1: slide out
  calDom.classList.add(outClass);

  const onOutEnd = () => {
    calDom.removeEventListener("animationend", onOutEnd);
    calDom.classList.remove(outClass);

    // Bước 2: đổi tháng và re-render
    currentDate.setMonth(currentDate.getMonth() + step);
    renderCalendar();
    renderOvertime();
    renderOvertimeSalary();

    // Bước 3: slide in
    // Dùng requestAnimationFrame để đảm bảo DOM đã cập nhật trước khi thêm class
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        calDom.classList.add(inClass);
        calDom.addEventListener("animationend", () => {
          calDom.classList.remove(inClass);
        }, { once: true });
      });
    });
  };

  calDom.addEventListener("animationend", onOutEnd, { once: true });
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

/* ====== ĐỘC GHI DỮ LIỆU NGÀY (Hỗ trợ nhiều sự kiện) ====== */
function normalizeDateData(raw) {
  const payload = raw || {};
  const rawEvents = Array.isArray(payload.events)
    ? payload.events
    : payload.events && typeof payload.events === "object"
      ? Object.keys(payload.events)
        .sort((a, b) => Number(a) - Number(b))
        .map((key) => payload.events[key])
      : [];

  const events = rawEvents.map((event) => ({
    title: String(event?.title || "").trim(),
    text: String(event?.text || "").trim(),
    eventDateTime: String(event?.eventDateTime || ""),
    color: String(event?.color || "").trim() || "#3b82f6",
    createdAt: Number(event?.createdAt || Date.now()),
    updatedAt: Number(event?.updatedAt || 0),
  }));

  const rawCashflowEntries = Array.isArray(payload.cashflowEntries)
    ? payload.cashflowEntries
    : payload.cashflowEntries && typeof payload.cashflowEntries === "object"
      ? Object.keys(payload.cashflowEntries)
        .sort((a, b) => Number(a) - Number(b))
        .map((key) => payload.cashflowEntries[key])
      : [];

  const cashflowEntries = rawCashflowEntries
    .map((entry) => {
      const normalizedDate = normalizeIsoDateString(entry?.date || "");
      const type = entry?.type === "expense" ? "expense" : "income";
      const amount = Math.max(0, parseInt(entry?.amount, 10) || 0);
      const image = entry?.image && entry.image.startsWith("data:") ? entry.image : "";
      return {
        id: String(entry?.id || "").trim(),
        date: normalizedDate,
        type,
        category: String(entry?.category || "").trim(),
        amount,
        note: String(entry?.note || "").trim(),
        image,
        createdAt: Number(entry?.createdAt || Date.now()),
        updatedAt: Number(entry?.updatedAt || 0),
      };
    })
    .filter((entry) => entry.id && entry.date && entry.amount > 0);

  return {
    events,
    overtimeHours: Math.max(0, parseInt(payload.overtimeHours, 10) || 0),
    cashflowEntries,
    isHoliday: !!payload.isHoliday,
    updatedAt: Number(payload.updatedAt || Date.now()),
  };
}

function normalizeIsoDateString(value) {
  const text = String(value || "").trim();
  const m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return "";
  const y = m[1];
  const mm = String(Number(m[2])).padStart(2, "0");
  const dd = String(Number(m[3])).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

function isoDateToDateKey(isoDate) {
  const normalized = normalizeIsoDateString(isoDate);
  if (!normalized) return "";
  const [y, m, d] = normalized.split("-").map(Number);
  return `${y}-${m}-${d}`;
}

function dateKeyToIsoDate(dateKey) {
  const m = String(dateKey || "")
    .trim()
    .match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return "";
  return `${m[1]}-${String(Number(m[2])).padStart(2, "0")}-${String(Number(m[3])).padStart(2, "0")}`;
}

function getAllDateKeysFromCache() {
  const keys = new Set(Object.keys(dateDataCache).filter(isDateKey));
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && isDateKey(k)) {
        keys.add(k);
      }
    }
  } catch (e) { }
  return Array.from(keys);
}

function hashProfilePassword(password) {
  let hash = 2166136261;
  for (let i = 0; i < password.length; i++) {
    hash ^= password.charCodeAt(i);
    hash +=
      (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return `u_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function hashPasswordWithSalt(password) {
  const salt = "calendar_v2_";
  let hash = 2166136261;
  const input = salt + password;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

// Toggle password visibility for auth forms
function togglePasswordVisibility(inputId, iconId) {
  const input = document.getElementById(inputId);
  const icon = document.getElementById(iconId);
  if (!input || !icon) return;

  if (input.type === "password") {
    input.type = "text";
    icon.innerHTML = `<path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>`;
  } else {
    input.type = "password";
    icon.innerHTML = `<path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>`;
  }
}

function switchAuthTab(tab) {
  const loginForm = document.getElementById("authLoginForm");
  const registerForm = document.getElementById("authRegisterForm");
  const upgradeForm = document.getElementById("authUpgradeForm");
  const loginTab = document.getElementById("authTabLogin");
  const registerTab = document.getElementById("authTabRegister");

  if (tab === "login") {
    loginForm.style.display = "block";
    registerForm.style.display = "none";
    upgradeForm.style.display = "none";
    loginTab.classList.add("active");
    registerTab.classList.remove("active");
    document.getElementById("loginUsername").value = "";
    document.getElementById("loginPassword").value = "";
    document.getElementById("loginError").style.display = "none";
    setTimeout(() => document.getElementById("loginUsername").focus(), 50);
  } else if (tab === "register") {
    loginForm.style.display = "none";
    registerForm.style.display = "block";
    upgradeForm.style.display = "none";
    loginTab.classList.remove("active");
    registerTab.classList.add("active");
    document.getElementById("regUsername").value = "";
    document.getElementById("regPassword").value = "";
    document.getElementById("registerError").style.display = "none";
    setTimeout(() => document.getElementById("regUsername").focus(), 50);
  } else if (tab === "upgrade") {
    loginForm.style.display = "none";
    registerForm.style.display = "none";
    upgradeForm.style.display = "block";
    loginTab.classList.remove("active");
    registerTab.classList.remove("active");
    document.getElementById("upgradeUsername").value = "";
    document.getElementById("upgradePassword").value = "";
    document.getElementById("upgradeError").style.display = "none";
    setTimeout(() => document.getElementById("upgradeUsername").focus(), 50);
  }

  document.getElementById("authModal").style.display = "flex";
}

function showLoginForm() { switchAuthTab("login"); }
function showRegisterForm() { switchAuthTab("register"); }
function showUpgradeForm() { switchAuthTab("upgrade"); }

window.showLoginForm = showLoginForm;
window.showRegisterForm = showRegisterForm;
window.showUpgradeForm = showUpgradeForm;

function isUserLoggedIn() {
  return !!(localStorage.getItem(FIREBASE_PROFILE_KEY_STORAGE) && localStorage.getItem("calendarUsername"));
}

function closeAuthModal() {
  document.getElementById("authModal").style.display = "none";
}

function logoutAndStartFresh() {
  showConfirmPopup(
    "Cảnh báo xóa dữ liệu",
    "Thao tác này sẽ xóa toàn bộ dữ liệu cũ của bạn trên thiết bị. Bạn có chắc chắn muốn tiếp tục?",
    "Tiếp tục",
    () => {
      unregisterDeviceNotificationToken();
      localStorage.removeItem(FIREBASE_PROFILE_KEY_STORAGE);
      localStorage.removeItem("calendarUsername");
      legacyProfileKey = "";
      window.location.reload();
    },
    undefined,
    { type: "warning", icon: "⚠️", btnType: "danger" }
  );
}

window.logoutAndStartFresh = logoutAndStartFresh;

async function handleUpgrade() {
  const username = document.getElementById("upgradeUsername").value.trim().toLowerCase();
  const password = document.getElementById("upgradePassword").value.trim();
  const errorEl = document.getElementById("upgradeError");

  if (!username) {
    errorEl.textContent = "Vui lòng nhập tên đăng nhập.";
    errorEl.style.display = "block";
    return;
  }

  if (username.length < 3) {
    errorEl.textContent = "Tên đăng nhập phải có ít nhất 3 ký tự.";
    errorEl.style.display = "block";
    return;
  }

  if (!/^[a-z0-9_]+$/.test(username)) {
    errorEl.textContent = "Tên đăng nhập chỉ chứa chữ cái, số và dấu gạch dưới.";
    errorEl.style.display = "block";
    return;
  }

  if (!password || password.length !== 6 || !/^\d+$/.test(password)) {
    errorEl.textContent = "Mật khẩu phải là 6 chữ số.";
    errorEl.style.display = "block";
    return;
  }

  errorEl.style.display = "none";

  try {
    // Check if username already exists
    const usersSnapshot = await firebaseUsersRef.orderByChild("username").equalTo(username).once("value");

    if (usersSnapshot.exists()) {
      errorEl.textContent = "Tên đăng nhập đã tồn tại. Vui lòng chọn tên khác.";
      errorEl.style.display = "block";
      return;
    }

    // Create new user with new ID
    const userId = `u_${Date.now().toString(16)}_${Math.random().toString(16).slice(2, 6)}`;
    const passwordHash = hashPasswordWithSalt(username + password);

    // Create new user in Firebase
    await firebaseUsersRef.child(userId).set({
      username: username,
      passwordHash: passwordHash,
      createdAt: firebase.database.ServerValue.TIMESTAMP,
      upgradedFrom: legacyProfileKey
    });

    // Migrate all legacy data to new user ID
    await migrateLegacyData(legacyProfileKey, userId);

    // Update local storage with new credentials
    localStorage.setItem(FIREBASE_PROFILE_KEY_STORAGE, userId);
    localStorage.setItem("calendarUsername", username);
    localStorage.setItem("legacyProfileKey", legacyProfileKey); // Keep for reference
    const upgradedFromKey = legacyProfileKey;
    userProfileKey = userId;
    currentUsername = username;
    legacyProfileKey = ""; // Clear legacy key after successful upgrade

    document.getElementById("authModal").style.display = "none";
    await reloadFirebaseForUser();

    // Fix migrated data with correct pKey
    await fixMigratedCalendarData(upgradedFromKey, userId);

    showToast("Cập nhật thành công! Dữ liệu cũ đã được bảo toàn.", "success");

  } catch (err) {
    console.error("[Auth] Upgrade error:", err);
    errorEl.textContent = "Đã xảy ra lỗi. Vui lòng thử lại.";
    errorEl.style.display = "block";
  }
}

window.handleUpgrade = handleUpgrade;

async function migrateLegacyData(oldKey, newKey) {
  console.log("[Migration] Starting data migration from", oldKey, "to", newKey);

  // Special handling for calendarEvents - need to update pKey in each record
  try {
    const calendarPath = `calendarEvents/${oldKey}`;
    const snapshot = await firebaseDb.ref(calendarPath).once("value");
    if (snapshot.exists()) {
      const calendarData = snapshot.val();
      // Update pKey in each date record
      const datesData = calendarData.dates || calendarData;
      if (datesData && typeof datesData === "object") {
        const migratedDates = {};
        Object.keys(datesData).forEach((dateKey) => {
          if (!isDateKey(dateKey)) return;
          const record = datesData[dateKey];
          if (record && typeof record === "object") {
            migratedDates[dateKey] = {
              ...record,
              pKey: newKey // Update pKey to new user ID
            };
          }
        });
        // Save to new location with updated pKey
        await firebaseDb.ref(`calendarEvents/${newKey}`).set({
          dates: migratedDates
        });
        console.log("[Migration] Migrated calendarEvents with updated pKey");
      }
    }
  } catch (err) {
    console.error("[Migration] Error migrating calendarEvents:", err);
  }

  // Migrate other paths
  const otherPathsToMigrate = [
    `quickNotes/${oldKey}`,
    `projects/${oldKey}`,
    `translateHistory/${oldKey}`,
    `profileSettings/${oldKey}`,
    `categories/${oldKey}`,
    `funds/${oldKey}`,
    `countdown/${oldKey}`
  ];

  for (const path of otherPathsToMigrate) {
    try {
      const snapshot = await firebaseDb.ref(path).once("value");
      if (snapshot.exists()) {
        const newPath = path.replace(`/${oldKey}`, `/${newKey}`);
        await firebaseDb.ref(newPath).set(snapshot.val());
        console.log("[Migration] Migrated:", path, "->", newPath);
      }
    } catch (err) {
      console.error("[Migration] Error migrating", path, ":", err);
    }
  }

  console.log("[Migration] Complete!");
}

async function fixMigratedCalendarData(oldKey, newKey) {
  if (!oldKey || !newKey || oldKey === newKey) return;

  try {
    const snapshot = await firebaseDb.ref(`calendarEvents/${oldKey}`).once("value");
    if (!snapshot.exists()) {
      console.log("[FixMigrated] No legacy calendar data found at", oldKey);
      return;
    }

    const calendarData = snapshot.val();
    const datesData = calendarData.dates || calendarData;

    if (!datesData || typeof datesData !== "object") return;

    const fixedDates = {};
    let needsUpdate = false;

    Object.keys(datesData).forEach((dateKey) => {
      if (!isDateKey(dateKey)) return;
      const record = datesData[dateKey];
      if (record && typeof record === "object" && record.pKey !== newKey) {
        fixedDates[dateKey] = {
          ...record,
          pKey: newKey
        };
        needsUpdate = true;
      }
    });

    if (needsUpdate) {
      await firebaseDb.ref(`calendarEvents/${newKey}`).set({
        dates: fixedDates
      });
      console.log("[FixMigrated] Fixed pKey for calendar data from", oldKey, "to", newKey);
    }
  } catch (err) {
    console.error("[FixMigrated] Error fixing migrated data:", err);
  }
}

async function handleRegister() {
  const username = document.getElementById("regUsername").value.trim().toLowerCase();
  const password = document.getElementById("regPassword").value.trim();
  const errorEl = document.getElementById("registerError");

  if (!username) {
    errorEl.textContent = "Vui lòng nhập tên đăng nhập.";
    errorEl.style.display = "block";
    return;
  }

  if (username.length < 3) {
    errorEl.textContent = "Tên đăng nhập phải có ít nhất 3 ký tự.";
    errorEl.style.display = "block";
    return;
  }

  if (!/^[a-z0-9_]+$/.test(username)) {
    errorEl.textContent = "Tên đăng nhập chỉ chứa chữ cái, số và dấu gạch dưới.";
    errorEl.style.display = "block";
    return;
  }

  if (!password || password.length !== 6 || !/^\d+$/.test(password)) {
    errorEl.textContent = "Mật khẩu phải là 6 chữ số.";
    errorEl.style.display = "block";
    return;
  }

  errorEl.style.display = "none";

  try {
    const usersSnapshot = await firebaseUsersRef.orderByChild("username").equalTo(username).once("value");

    if (usersSnapshot.exists()) {
      errorEl.textContent = "Tên đăng nhập đã tồn tại. Vui lòng chọn tên khác.";
      errorEl.style.display = "block";
      return;
    }

    const userId = `u_${Date.now().toString(16)}_${Math.random().toString(16).slice(2, 6)}`;
    const passwordHash = hashPasswordWithSalt(username + password);

    await firebaseUsersRef.child(userId).set({
      username: username,
      passwordHash: passwordHash,
      createdAt: firebase.database.ServerValue.TIMESTAMP
    });

    localStorage.setItem(FIREBASE_PROFILE_KEY_STORAGE, userId);
    localStorage.setItem("calendarUsername", username);
    userProfileKey = userId;
    currentUsername = username;

    document.getElementById("authModal").style.display = "none";
    await reloadFirebaseForUser();
    showToast("Đăng ký thành công! Chào mừng " + username + "!", "success");

  } catch (err) {
    console.error("[Auth] Register error:", err);
    errorEl.textContent = "Đã xảy ra lỗi. Vui lòng thử lại.";
    errorEl.style.display = "block";
  }
}

window.handleRegister = handleRegister;

async function handleLogin() {
  const username = document.getElementById("loginUsername").value.trim().toLowerCase();
  const password = document.getElementById("loginPassword").value.trim();
  const errorEl = document.getElementById("loginError");
  const submitBtn = document.querySelector("#loginForm .auth-submit-btn") || document.querySelector(".auth-submit-btn");

  if (!username) {
    errorEl.textContent = "Vui lòng nhập tên đăng nhập.";
    errorEl.style.display = "block";
    return;
  }

  if (!password || password.length !== 6 || !/^\d+$/.test(password)) {
    errorEl.textContent = "Mật khẩu phải là 6 chữ số.";
    errorEl.style.display = "block";
    return;
  }

  errorEl.style.display = "none";

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.dataset.originalText = submitBtn.dataset.originalText || submitBtn.textContent.trim();
    submitBtn.innerHTML = '<span class="auth-submit-spinner" aria-hidden="true"></span><span>Đang đăng nhập...</span>';
  }

  try {
    const usersSnapshot = await firebaseUsersRef.orderByChild("username").equalTo(username).once("value");

    if (!usersSnapshot.exists()) {
      errorEl.textContent = "Tên đăng nhập không tồn tại.";
      errorEl.style.display = "block";
      return;
    }

    let foundUser = null;
    let foundUserId = null;

    usersSnapshot.forEach((child) => {
      foundUser = child.val();
      foundUserId = child.key;
    });

    const passwordHash = hashPasswordWithSalt(username + password);

    if (foundUser.passwordHash !== passwordHash) {
      errorEl.textContent = "Mật khẩu không đúng.";
      errorEl.style.display = "block";
      return;
    }

    localStorage.setItem(FIREBASE_PROFILE_KEY_STORAGE, foundUserId);
    localStorage.setItem("calendarUsername", username);
    userProfileKey = foundUserId;
    currentUsername = username;

    document.getElementById("authModal").style.display = "none";
    await reloadFirebaseForUser();

    // Auto-fix migrated data if this user was upgraded from legacy
    if (foundUser.upgradedFrom) {
      await fixMigratedCalendarData(foundUser.upgradedFrom, foundUserId);
    }

    showToast("Đăng nhập thành công!", "success");

  } catch (err) {
    console.error("[Auth] Login error:", err);
    if (err.code === "PERMISSION_DENIED") {
      errorEl.textContent = "Không có quyền truy cập. Vui lòng thử lại.";
    } else {
      errorEl.textContent = "Đã xảy ra lỗi. Vui lòng thử lại.";
    }
    errorEl.style.display = "block";
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = submitBtn.dataset.originalText || "Đăng Nhập";
      delete submitBtn.dataset.originalText;
    }
  }
}

window.handleLogin = handleLogin;

// Cho phép nhấn Enter trong ô tên đăng nhập/mật khẩu để đăng nhập
(function setupLoginEnterKey() {
  const usernameInput = document.getElementById("loginUsername");
  const passwordInput = document.getElementById("loginPassword");
  if (!usernameInput || !passwordInput) return;

  const triggerLogin = (e) => {
    if (e.key === "Enter" || e.keyCode === 13) {
      e.preventDefault();
      handleLogin();
    }
  };

  usernameInput.addEventListener("keydown", triggerLogin);
  passwordInput.addEventListener("keydown", triggerLogin);
})();

async function ensureProfileKey() {
  return new Promise((resolve) => {
    const storedProfileKey = localStorage.getItem(FIREBASE_PROFILE_KEY_STORAGE);
    const storedUsername = localStorage.getItem("calendarUsername");

    if (storedProfileKey && storedUsername) {
      userProfileKey = storedProfileKey;
      currentUsername = storedUsername;
      const modal = document.getElementById("authModal");
      if (modal) modal.style.display = "none";
      setTimeout(() => initProfileOnLoad(), 0);
      resolve(true);
      return;
    }

    // Check for legacy user (has profile key but no username)
    if (storedProfileKey && /^u_[0-9a-f]{8}$/.test(storedProfileKey)) {
      // Check if this legacy profile has already been upgraded on another device
      // by querying Firebase for any user with upgradedFrom === this legacy key
      const checkUpgraded = async () => {
        try {
          const usersSnapshot = await firebaseUsersRef.orderByChild("upgradedFrom").equalTo(storedProfileKey).once("value");
          if (usersSnapshot.exists()) {
            // This legacy account has been upgraded, show login form
            legacyProfileKey = storedProfileKey;
            showLoginForm();
          } else {
            // Not upgraded yet, need to upgrade
            legacyProfileKey = storedProfileKey;
            showUpgradeForm();
          }
        } catch (err) {
          console.error("[Auth] Error checking upgrade status:", err);
          // Fallback to upgrade form
          legacyProfileKey = storedProfileKey;
          showUpgradeForm();
        }
      };

      checkUpgraded().then(() => {
        const checkReady = setInterval(() => {
          if (userProfileKey) {
            clearInterval(checkReady);
            resolve(true);
          }
        }, 100);
      });
      return;
    } else {
      showLoginForm();
    }

    const checkReady = setInterval(() => {
      if (userProfileKey) {
        clearInterval(checkReady);
        resolve(true);
      }
    }, 100);
  });
}

function logoutProfileSession() {
  showConfirmPopup(
    "Đăng xuất",
    "Bạn có chắc chắn muốn đăng xuất tài khoản hiện tại?",
    "Đăng xuất",
    () => {
      localStorage.removeItem(FIREBASE_PROFILE_KEY_STORAGE);
      localStorage.removeItem("calendarUsername");
      userProfileKey = "";
      currentUsername = "";
      dateDataCache = {};

      if (firebaseDatesRef) {
        firebaseDatesRef.off();
      }

      window.location.reload();
    },
    undefined,
    { type: "warning", icon: "🚪", btnType: "danger" }
  );
}

window.logoutProfileSession = logoutProfileSession;

/* ==================== PROFILE SETTINGS ==================== */

const PROFILE_SETTINGS_PREFIX = "profileSettingsV1";
const FIREBASE_PROFILE_SETTINGS_PATH = "profileSettings";

function getProfileSettingsKey() {
  return `${PROFILE_SETTINGS_PREFIX}:${userProfileKey}`;
}

function loadProfileSettings() {
  if (!userProfileKey) return {};
  const raw = localStorage.getItem(getProfileSettingsKey());
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveProfileSettingsData(settings) {
  if (!userProfileKey) return;
  localStorage.setItem(getProfileSettingsKey(), JSON.stringify(settings));
}

function openProfileSettingsModal() {
  loadProfileOnDemand();

  const modal = document.getElementById("profileSettingsModal");
  const settings =
    Object.keys(profileSettingsCache).length > 0
      ? profileSettingsCache
      : loadProfileSettings();

  // Load avatar
  const avatarPreview = document.getElementById("profileAvatarPreview");
  const avatarPlaceholder = document.getElementById("profileAvatarPlaceholder");
  const avatarDeleteBtn = document.getElementById("profileAvatarDeleteBtn");

  if (settings.avatar) {
    avatarPreview.src = settings.avatar;
    avatarPreview.classList.add("has-image");
    avatarPlaceholder.style.display = "none";
    avatarDeleteBtn.style.display = "flex";
  } else {
    avatarPreview.src = "";
    avatarPreview.classList.remove("has-image");
    avatarPlaceholder.style.display = "flex";
    avatarDeleteBtn.style.display = "none";
  }

  // Load cover
  const coverPreview = document.getElementById("profileCoverPreview");
  const coverPlaceholder = document.getElementById("profileCoverPlaceholder");
  const coverDeleteBtn = document.getElementById("profileCoverDeleteBtn");

  if (settings.cover) {
    coverPreview.src = settings.cover;
    coverPreview.classList.add("has-image");
    coverPlaceholder.style.display = "none";
    coverDeleteBtn.style.display = "flex";
  } else {
    coverPreview.src = "";
    coverPreview.classList.remove("has-image");
    coverPlaceholder.style.display = "flex";
    coverDeleteBtn.style.display = "none";
  }

  // Load name and bio
  document.getElementById("profileDisplayName").value =
    settings.displayName || "";
  document.getElementById("profileBio").value = settings.bio || "";
  document.getElementById("profileBioCount").textContent = (
    settings.bio || ""
  ).length;

  updateNotificationUIState();
  modal.style.display = "flex";
}

window.openProfileSettingsModal = openProfileSettingsModal;

function closeProfileSettingsModal() {
  const modal = document.getElementById("profileSettingsModal");
  modal.style.display = "none";
}

window.closeProfileSettingsModal = closeProfileSettingsModal;

function triggerAvatarUpload() {
  document.getElementById("profileAvatarInput").click();
}

function triggerCoverUpload() {
  document.getElementById("profileCoverInput").click();
}

window.triggerAvatarUpload = triggerAvatarUpload;
window.triggerCoverUpload = triggerCoverUpload;
window.openCropModal = openCropModal;
window.closeCropModal = closeCropModal;
window.applyCrop = applyCrop;

function handleAvatarSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  openCropModal(file, "avatar");
}

function handleCoverSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  openCropModal(file, "cover");
}

// Crop modal state
let cropper = null;
let cropModalType = null;
let cropModalFile = null;

function openCropModal(file, type) {
  // Validate file type
  if (!file.type.startsWith("image/")) {
    showToast("Vui lòng chọn file hình ảnh.", "error");
    return;
  }

  // Validate file size (max 5MB for Firebase - data URL has ~33% overhead)
  if (file.size > 5 * 1024 * 1024) {
    showToast("Kích thước ảnh không được vượt quá 5MB.", "error");
    return;
  }

  cropModalType = type;
  cropModalFile = file;

  const reader = new FileReader();
  reader.onload = function (e) {
    const dataUrl = e.target.result;
    const cropImage = document.getElementById("cropImage");
    cropImage.src = dataUrl;

    // Destroy previous cropper if exists
    if (cropper) {
      cropper.destroy();
      cropper = null;
    }

    // Show modal first, then initialize cropper
    const modal = document.getElementById("cropModal");
    modal.style.display = "flex";

    // Initialize Cropper.js
    cropper = new Cropper(cropImage, {
      aspectRatio: type === "avatar" ? 1 : NaN,
      viewMode: 1,
      dragMode: "move",
      autoCropArea: 0.9,
      restore: false,
      guides: true,
      center: true,
      highlight: false,
      cropBoxMovable: true,
      cropBoxResizable: true,
      toggleDragModeOnDblclick: false,
    });
  };
  reader.readAsDataURL(file);
}

function closeCropModal() {
  const modal = document.getElementById("cropModal");
  modal.style.display = "none";

  if (cropper) {
    cropper.destroy();
    cropper = null;
  }
  cropModalType = null;
  cropModalFile = null;
}

function applyCrop() {
  if (!cropper || !cropModalType) {
    closeCropModal();
    return;
  }

  const croppedCanvas = cropper.getCroppedCanvas({
    maxWidth: cropModalType === "avatar" ? 512 : 1920,
    maxHeight: cropModalType === "avatar" ? 512 : 1080,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: "high",
  });

  const dataUrl = croppedCanvas.toDataURL("image/jpeg", 0.9);
  const previewId =
    cropModalType === "avatar" ? "profileAvatarPreview" : "profileCoverPreview";
  const placeholderId =
    cropModalType === "avatar"
      ? "profileAvatarPlaceholder"
      : "profileCoverPlaceholder";
  const deleteBtnId =
    cropModalType === "avatar"
      ? "profileAvatarDeleteBtn"
      : "profileCoverDeleteBtn";

  const preview = document.getElementById(previewId);
  const placeholder = document.getElementById(placeholderId);
  const deleteBtn = document.getElementById(deleteBtnId);

  preview.src = dataUrl;
  preview.classList.add("has-image");
  if (placeholder) placeholder.style.display = "none";
  if (deleteBtn) deleteBtn.style.display = "flex";

  closeCropModal();
}

function processImageFile(file, type) {
  // Validate file type
  if (!file.type.startsWith("image/")) {
    showToast("Vui lòng chọn file hình ảnh.", "error");
    return;
  }

  // Validate file size (max 5MB for Firebase - data URL has ~33% overhead)
  if (file.size > 5 * 1024 * 1024) {
    showToast("Kích thước ảnh không được vượt quá 5MB.", "error");
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    const dataUrl = e.target.result;
    const previewId =
      type === "avatar" ? "profileAvatarPreview" : "profileCoverPreview";
    const placeholderId =
      type === "avatar"
        ? "profileAvatarPlaceholder"
        : "profileCoverPlaceholder";
    const deleteBtnId =
      type === "avatar" ? "profileAvatarDeleteBtn" : "profileCoverDeleteBtn";

    const preview = document.getElementById(previewId);
    const placeholder = document.getElementById(placeholderId);
    const deleteBtn = document.getElementById(deleteBtnId);

    preview.src = dataUrl;
    preview.classList.add("has-image");
    if (placeholder) placeholder.style.display = "none";
    if (deleteBtn) deleteBtn.style.display = "flex";
  };
  reader.readAsDataURL(file);
}

function removeProfileAvatar() {
  const preview = document.getElementById("profileAvatarPreview");
  const placeholder = document.getElementById("profileAvatarPlaceholder");
  const deleteBtn = document.getElementById("profileAvatarDeleteBtn");

  preview.src = "";
  preview.classList.remove("has-image");
  placeholder.style.display = "flex";
  if (deleteBtn) deleteBtn.style.display = "none";

  // Clear the input
  document.getElementById("profileAvatarInput").value = "";
}

function removeProfileCover() {
  const preview = document.getElementById("profileCoverPreview");
  const placeholder = document.getElementById("profileCoverPlaceholder");
  const deleteBtn = document.getElementById("profileCoverDeleteBtn");

  preview.src = "";
  preview.classList.remove("has-image");
  placeholder.style.display = "flex";
  if (deleteBtn) deleteBtn.style.display = "none";

  // Clear the input
  document.getElementById("profileCoverInput").value = "";
}

window.removeProfileAvatar = removeProfileAvatar;
window.removeProfileCover = removeProfileCover;

function saveProfileSettings() {
  const avatarPreview = document.getElementById("profileAvatarPreview");
  const coverPreview = document.getElementById("profileCoverPreview");
  const displayName = document
    .getElementById("profileDisplayName")
    .value.trim();
  const bio = document.getElementById("profileBio").value.trim();

  const settings = {
    avatar: avatarPreview.classList.contains("has-image")
      ? avatarPreview.src
      : null,
    cover: coverPreview.classList.contains("has-image")
      ? coverPreview.src
      : null,
    displayName: displayName,
    bio: bio,
    updatedAt: Date.now(),
  };

  // Save to localStorage immediately
  saveProfileSettingsData(settings);
  profileSettingsCache = settings;

  // Save to Firebase
  saveProfileSettingsToFirebase(settings);

  closeProfileSettingsModal();
  applyProfileToUI(settings);
  showToast("Đã lưu cài đặt hồ sơ!", "success");
}

window.saveProfileSettings = saveProfileSettings;

async function handleChangePassword() {
  if (!currentUsername || !userProfileKey || !firebaseUsersRef) {
    showToast("Vui lòng đăng nhập trước khi đổi mật khẩu.", "error");
    return;
  }

  const currentPassword = document
    .getElementById("profileCurrentPassword")
    .value.trim();
  const newPassword = document
    .getElementById("profileNewPassword")
    .value.trim();
  const confirmNewPassword = document
    .getElementById("profileConfirmNewPassword")
    .value.trim();
  const errorEl = document.getElementById("profileChangePasswordError");

  if (!currentPassword || !newPassword || !confirmNewPassword) {
    errorEl.textContent = "Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới.";
    errorEl.style.display = "block";
    return;
  }

  if (!/^[0-9]{6}$/.test(newPassword)) {
    errorEl.textContent = "Mật khẩu mới phải là 6 chữ số.";
    errorEl.style.display = "block";
    return;
  }

  if (newPassword !== confirmNewPassword) {
    errorEl.textContent = "Mật khẩu mới không khớp.";
    errorEl.style.display = "block";
    return;
  }

  errorEl.style.display = "none";

  try {
    const usersSnapshot = await firebaseUsersRef
      .orderByChild("username")
      .equalTo(currentUsername)
      .once("value");

    if (!usersSnapshot.exists()) {
      errorEl.textContent = "Không tìm thấy tài khoản. Vui lòng đăng nhập lại.";
      errorEl.style.display = "block";
      return;
    }

    let foundUser = null;
    let foundUserId = null;

    usersSnapshot.forEach((child) => {
      foundUser = child.val();
      foundUserId = child.key;
    });

    const currentPasswordHash = hashPasswordWithSalt(currentUsername + currentPassword);
    if (foundUser.passwordHash !== currentPasswordHash) {
      errorEl.textContent = "Mật khẩu hiện tại không đúng.";
      errorEl.style.display = "block";
      return;
    }

    const newPasswordHash = hashPasswordWithSalt(currentUsername + newPassword);
    await firebaseUsersRef.child(foundUserId).update({
      passwordHash: newPasswordHash,
    });

    document.getElementById("profileCurrentPassword").value = "";
    document.getElementById("profileNewPassword").value = "";
    document.getElementById("profileConfirmNewPassword").value = "";
    errorEl.style.display = "none";

    showToast("Đã đổi mật khẩu thành công!", 2000);
  } catch (err) {
    console.error("[Auth] Change password error:", err);
    errorEl.textContent = "Đã xảy ra lỗi. Vui lòng thử lại.";
    errorEl.style.display = "block";
  }
}

window.handleChangePassword = handleChangePassword;

function saveProfileSettingsToFirebase(settings) {
  console.log(
    "[Profile] saveProfileSettingsToFirebase called, firebaseProfileSettingsRef:",
    !!firebaseProfileSettingsRef,
    "userProfileKey:",
    userProfileKey,
  );

  if (!firebaseProfileSettingsRef) {
    console.log("[Profile] Firebase chưa sẵn sàng, chỉ lưu local");
    return;
  }

  firebaseProfileSettingsRef
    .set(settings)
    .then(() => {
      console.log("[Profile] Đã lưu lên Firebase");
    })
    .catch((err) => {
      console.error("[Profile] Lỗi lưu Firebase:", err);
      showToast("Lưu lên cloud thất bại, đã lưu local", "error");
    });
}

function applyProfileToUI(settings) {
  if (!settings) return;

  const todayPanel = document.querySelector(".today-panel");
  if (!todayPanel) return;

  // Use existing profile elements from HTML
  const profileWrapper = document.getElementById("todayProfile");
  const avatarEl = document.getElementById("todayProfileAvatar");
  const avatarPlaceholder = document.getElementById("todayProfilePlaceholder");
  const nameEl = document.getElementById("todayProfileName");
  const bioEl = document.getElementById("todayProfileBio");

  // Update name and bio
  if (nameEl) {
    nameEl.textContent = settings.displayName || "";
  }
  if (bioEl) {
    bioEl.textContent = settings.bio || "";
  }

  // Update avatar
  if (settings.avatar) {
    avatarEl.src = settings.avatar;
    avatarEl.style.display = "block";
    if (avatarPlaceholder) avatarPlaceholder.style.display = "none";
    avatarEl.onerror = () => {
      avatarEl.style.display = "none";
      if (avatarPlaceholder) avatarPlaceholder.style.display = "none";
    };
  } else {
    avatarEl.style.display = "none";
    if (avatarPlaceholder) avatarPlaceholder.style.display = "none";
  }

  // Apply cover to today panel
  if (settings.cover) {
    todayPanel.classList.add("has-cover");
    let bgEl = todayPanel.querySelector(".today-panel-bg");
    if (!bgEl) {
      bgEl = document.createElement("div");
      bgEl.className = "today-panel-bg";
      todayPanel.insertBefore(bgEl, todayPanel.firstChild);
    }
    bgEl.style.backgroundImage = `url(${settings.cover})`;
  } else {
    todayPanel.classList.remove("has-cover");
    const bgEl = todayPanel.querySelector(".today-panel-bg");
    if (bgEl) bgEl.remove();
  }
}

function initProfileOnLoad() {
  const settings = loadProfileSettings();
  if (Object.keys(settings).length > 0) {
    profileSettingsCache = settings;
    applyProfileToUI(settings);
  } else if (currentUsername) {
    // If no profile settings, show username
    const nameEl = document.getElementById("todayProfileName");
    if (nameEl) {
      nameEl.textContent = currentUsername;
    }
  }

  // Setup file input listeners
  document
    .getElementById("profileAvatarInput")
    .addEventListener("change", handleAvatarSelect);
  document
    .getElementById("profileCoverInput")
    .addEventListener("change", handleCoverSelect);

  // Setup bio character counter
  document.getElementById("profileBio").addEventListener("input", function () {
    document.getElementById("profileBioCount").textContent = this.value.length;
  });
}

function setupProfileFirebaseListener() {
  if (!firebaseProfileSettingsRef) return;

  firebaseProfileSettingsRef.on("value", (snapshot) => {
    const remoteData = snapshot.val();
    if (remoteData) {
      console.log("[Profile] Nhận dữ liệu từ Firebase");
      profileSettingsCache = remoteData;
      saveProfileSettingsData(remoteData);
      applyProfileToUI(remoteData);

      // If modal is open, refresh it
      const modal = document.getElementById("profileSettingsModal");
      if (modal && modal.style.display === "flex") {
        openProfileSettingsModal();
      }
    }
  });
}

function loadProfileSettingsFromFirebase() {
  console.log(
    "[Profile] loadProfileSettingsFromFirebase called, firebaseProfileSettingsRef:",
    !!firebaseProfileSettingsRef,
  );

  if (!firebaseProfileSettingsRef) {
    console.log("[Profile] Firebase chưa sẵn sàng, dùng localStorage");
    return;
  }

  firebaseProfileSettingsRef
    .once("value")
    .then((snapshot) => {
      const remoteData = snapshot.val();
      if (remoteData) {
        console.log("[Profile] Đã tải từ Firebase");
        profileSettingsCache = remoteData;
        saveProfileSettingsData(remoteData);
        applyProfileToUI(remoteData);
      }
    })
    .catch((err) => {
      console.error("[Profile] Lỗi tải từ Firebase:", err);
    });

  // Setup real-time listener
  setupProfileFirebaseListener();
}

function collectLegacyLocalDateData() {
  const localData = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!isDateKey(key)) continue;

    const raw = localStorage.getItem(key);
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);
      // Bỏ qua data do Firebase sync ghi — chỉ migrate data legacy thực sự
      if (parsed?.__type === "date_data") continue;
    } catch {
      // dữ liệu cũ dạng text/json không đúng cấu trúc
    }

    const legacyEvent = parseEventRecord(raw);
    if (!legacyEvent) continue;

    localData[key] = normalizeDateData({
      events: [
        {
          title: legacyEvent.title,
          text: legacyEvent.text,
          eventDateTime: "",
          createdAt: Date.now(),
        },
      ],
      overtimeHours: legacyEvent.overtimeHours,
      updatedAt: Date.now(),
    });
  }

  return localData;
}

function collectLegacyCashflowEntries() {
  try {
    const raw = localStorage.getItem(LEGACY_CASHFLOW_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((entry) => {
        const date = normalizeIsoDateString(entry?.date || "");
        const type = entry?.type === "expense" ? "expense" : "income";
        const amount = Math.max(0, parseInt(entry?.amount, 10) || 0);
        const note = String(entry?.note || "").trim();
        const id =
          String(entry?.id || "").trim() ||
          `cf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const createdAt = Number(entry?.createdAt || Date.now());

        return {
          id,
          date,
          type,
          amount,
          note,
          createdAt,
          updatedAt: Number(entry?.updatedAt || 0),
        };
      })
      .filter((entry) => entry.date && entry.amount > 0);
  } catch {
    return [];
  }
}

async function migrateLegacyCashflowEntriesIfNeeded() {
  const migrationFlag = `${LEGACY_CASHFLOW_MIGRATION_FLAG_PREFIX}${userProfileKey}`;
  const migrated = localStorage.getItem(migrationFlag) === "1";
  if (migrated) return;

  const legacyEntries = collectLegacyCashflowEntries();
  if (legacyEntries.length === 0) {
    localStorage.setItem(migrationFlag, "1");
    return;
  }

  for (const legacyEntry of legacyEntries) {
    const dateKey = isoDateToDateKey(legacyEntry.date);
    if (!dateKey) continue;

    const data = getDateData(dateKey);
    const exists = data.cashflowEntries.some(
      (entry) => entry.id === legacyEntry.id,
    );
    if (exists) continue;

    data.cashflowEntries.push(legacyEntry);
    saveDateData(dateKey, data);
  }

  localStorage.removeItem(LEGACY_CASHFLOW_STORAGE_KEY);
  localStorage.setItem(migrationFlag, "1");
}

function resolveCashflowCategoryId(type, rawCategoryValue) {
  const normalizedValue = String(rawCategoryValue || "").trim();
  if (!normalizedValue) return "";

  const categories = cashflowCategories[type] || [];
  const matchedCategory = categories.find(
    (category) =>
      String(category?.id || "").trim() === normalizedValue ||
      String(category?.name || "").trim() === normalizedValue,
  );

  return matchedCategory ? matchedCategory.id : "";
}

async function migrateCashflowCategoryIdsIfNeeded() {
  if (!userProfileKey) return;

  const migrationFlag = `${CASHFLOW_CATEGORY_ID_MIGRATION_FLAG_PREFIX}${userProfileKey}`;
  const migrated = localStorage.getItem(migrationFlag) === "1";
  if (migrated) return;

  const dateKeys = Object.keys(dateDataCache).filter(isDateKey);
  let hasChanges = false;

  for (const dateKey of dateKeys) {
    const data = getDateData(dateKey);
    let dateChanged = false;

    const nextEntries = data.cashflowEntries.map((entry) => {
      const resolvedCategoryId = resolveCashflowCategoryId(
        entry.type,
        entry.category,
      );

      if (!resolvedCategoryId || resolvedCategoryId === entry.category) {
        return entry;
      }

      dateChanged = true;
      return {
        ...entry,
        category: resolvedCategoryId,
        updatedAt: Date.now(),
      };
    });

    if (!dateChanged) continue;

    hasChanges = true;
    saveDateData(dateKey, {
      ...data,
      cashflowEntries: nextEntries,
    });
  }

  if (hasChanges) {
    reloadCashflowEntriesFromCache();
  }

  localStorage.setItem(migrationFlag, "1");
}

// Chỉ tin bản ghi Firebase nếu pKey khớp với profile hiện tại,
// hoặc không có pKey nhưng đây là profile gốc ban đầu (backward compat)
function isDateRecordTrusted(raw) {
  if (!raw) return false;
  const originalKey = localStorage.getItem(FIREBASE_PROFILE_KEY_STORAGE);
  if (raw.pKey !== undefined) return raw.pKey === userProfileKey;
  return userProfileKey === originalKey;
}

function getDateData(dateKey) {
  if (!dateKey) {
    return normalizeDateData({ events: [], overtimeHours: 0, cashflowEntries: [] });
  }
  if (dateDataCache[dateKey]) {
    return normalizeDateData(dateDataCache[dateKey]);
  }
  try {
    const raw = localStorage.getItem(dateKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        dateDataCache[dateKey] = normalizeDateData(parsed);
        return dateDataCache[dateKey];
      }
    }
  } catch (e) { }
  return normalizeDateData({
    events: [],
    overtimeHours: 0,
    cashflowEntries: [],
  });
}

function saveDateData(dateKey, data) {
  const normalized = normalizeDateData(data);

  const record = {
    __type: "date_data",
    events: normalized.events,
    overtimeHours: normalized.overtimeHours,
    cashflowEntries: normalized.cashflowEntries,
    isHoliday: normalized.isHoliday,
    updatedAt: Date.now(),
  };

  const firebaseRecord = {
    __type: "date_data",
    pKey: userProfileKey,
    // Realtime Database xử lý mảng rỗng không ổn định; dùng object rỗng để luôn tồn tại node events.
    events: normalized.events.length > 0 ? normalized.events : {},
    overtimeHours: normalized.overtimeHours,
    cashflowEntries:
      normalized.cashflowEntries.length > 0 ? normalized.cashflowEntries : {},
    isHoliday: normalized.isHoliday,
    updatedAt: Date.now(),
  };

  if (
    normalized.events.length === 0 &&
    normalized.overtimeHours <= 0 &&
    normalized.cashflowEntries.length === 0 &&
    !normalized.isHoliday
  ) {
    delete dateDataCache[dateKey];
    localStorage.removeItem(dateKey);
    if (firebaseDatesRef) {
      firebaseDatesRef
        .child(dateKey)
        .remove()
        .catch(() => {
          console.error("Không thể xóa dữ liệu ngày khỏi Firebase.");
          if (!syncWriteErrorShown) {
            syncWriteErrorShown = true;
            alert(
              "Không thể đồng bộ dữ liệu lên Firebase. Vui lòng kiểm tra Firebase Rules và deploy rules mới.",
            );
          }
        });
    }
    return;
  }

  dateDataCache[dateKey] = normalizeDateData(record);
  localStorage.setItem(dateKey, JSON.stringify(record));
  if (typeof syncCombinedNotifications === "function") {
    syncCombinedNotifications();
  }

  if (firebaseDatesRef) {
    firebaseDatesRef
      .child(dateKey)
      .set(firebaseRecord)
      .then(() => showCloudSyncedBadge())
      .catch(() => {
        console.error("Không thể lưu dữ liệu ngày lên Firebase.");
        if (!syncWriteErrorShown) {
          syncWriteErrorShown = true;
          alert(
            "Không thể đồng bộ dữ liệu lên Firebase. Vui lòng kiểm tra Firebase Rules và deploy rules mới.",
          );
        }
      });
  }
}

let _cloudSyncedTimer = null;
function showCloudSyncedBadge() {
  let badge = document.getElementById("cloudSyncedBadge");
  if (!badge) return;
  clearTimeout(_cloudSyncedTimer);
  badge.classList.add("visible");
  _cloudSyncedTimer = setTimeout(() => badge.classList.remove("visible"), 2200);
}

function escapeCsvValue(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsvContent(headers, rows) {
  const head = headers.map((h) => escapeCsvValue(h)).join(",");
  const body = rows
    .map((row) => row.map((cell) => escapeCsvValue(cell)).join(","))
    .join("\n");
  return `${head}\n${body}`;
}

function triggerCsvDownload(fileName, csvContent) {
  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function getCsvDateSuffix() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${y}${m}${d}_${hh}${mm}`;
}

function formatTimestampForCsv(ts) {
  const t = Number(ts || 0);
  if (!t) return "";
  const dt = new Date(t);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleString("vi-VN");
}

async function getAllDateDataForExport() {
  const output = {};

  if (firebaseDatesRef) {
    try {
      const snapshot = await firebaseDatesRef.once("value");
      const remoteData = snapshot.val() || {};

      Object.keys(remoteData).forEach((dateKey) => {
        if (!isDateKey(dateKey)) return;
        if (!isDateRecordTrusted(remoteData[dateKey])) return;
        output[dateKey] = normalizeDateData(remoteData[dateKey]);
      });

      if (Object.keys(output).length > 0) {
        return output;
      }
    } catch {
      // fallback to cache below
    }
  }

  const dateKeys = getAllDateKeysFromCache();
  dateKeys.forEach((dateKey) => {
    output[dateKey] = getDateData(dateKey);
  });

  return output;
}

async function exportEventsCsv() {
  const rows = [];
  const allDateData = await getAllDateDataForExport();
  const dateKeys = Object.keys(allDateData).sort((a, b) => {
    const da = new Date(dateKeyToIsoDate(a));
    const db = new Date(dateKeyToIsoDate(b));
    return da - db;
  });

  for (const dateKey of dateKeys) {
    const data = allDateData[dateKey];
    for (const ev of data.events || []) {
      rows.push([
        dateKeyToIsoDate(dateKey),
        ev.title || "",
        ev.text || "",
        ev.eventDateTime || "",
        ev.color || "#3b82f6",
        formatTimestampForCsv(ev.createdAt),
        formatTimestampForCsv(ev.updatedAt),
      ]);
    }
  }

  if (rows.length === 0) {
    alert("Chưa có sự kiện để xuất CSV.");
    return;
  }

  const csv = toCsvContent(
    [
      "Ngày",
      "Tiêu đề",
      "Nội dung",
      "Ngày giờ sự kiện",
      "Màu sắc",
      "Tạo lúc",
      "Cập nhật lúc",
    ],
    rows,
  );
  triggerCsvDownload(`su_kien_${getCsvDateSuffix()}.csv`, csv);
}

async function exportOvertimeCsv() {
  const rows = [];
  const allDateData = await getAllDateDataForExport();
  const dateKeys = Object.keys(allDateData).sort((a, b) => {
    const da = new Date(dateKeyToIsoDate(a));
    const db = new Date(dateKeyToIsoDate(b));
    return da - db;
  });

  for (const dateKey of dateKeys) {
    const baseHours = Math.max(
      0,
      parseInt(allDateData[dateKey]?.overtimeHours, 10) || 0,
    );
    if (baseHours <= 0) continue;

    const [y, m, d] = dateKey.split("-").map(Number);
    const dow = new Date(y, m - 1, d).getDay();
    const bonusHours =
      dow === 0 ? (baseHours >= 10 ? 0.5 : 0) : baseHours >= 2 ? 0.5 : 0;
    const totalHours = baseHours + bonusHours;
    const type = dow === 0 ? "Chu nhat" : "Ngay thuong";

    rows.push([
      dateKeyToIsoDate(dateKey),
      type,
      baseHours,
      bonusHours,
      totalHours,
    ]);
  }

  if (rows.length === 0) {
    alert("Chưa có dữ liệu tăng ca để xuất CSV.");
    return;
  }

  const csv = toCsvContent(
    [
      "Ngày",
      "Loại ngày",
      "Giờ tăng ca gốc",
      "Giờ bonus",
      "Tổng giờ tính lương",
    ],
    rows,
  );
  triggerCsvDownload(`tang_ca_${getCsvDateSuffix()}.csv`, csv);
}

function getCashflowEntriesInRange() {
  const now = new Date();
  const safeMonthsCount = Math.max(1, Math.min(cashflowChartMonths, 24));
  const minDate = new Date(now.getFullYear(), now.getMonth() - safeMonthsCount + 1, 1);
  const minDateStr = `${minDate.getFullYear()}-${String(minDate.getMonth() + 1).padStart(2, "0")}-01`;

  return cashflowEntries.filter((entry) => entry.date >= minDateStr);
}

function exportCashflowCsv() {
  reloadCashflowEntriesFromCache();

  if (cashflowEntries.length === 0) {
    alert("Chưa có dữ liệu thu chi để xuất CSV.");
    return;
  }

  const filteredEntries = getCashflowEntriesInRange();

  if (filteredEntries.length === 0) {
    alert("Không có dữ liệu thu chi trong khoảng thời gian đã chọn.");
    return;
  }

  const rows = filteredEntries
    .map((entry) => {
      const imageHtml = entry.image && entry.image.trim() && entry.image.startsWith("data:")
        ? `<img src="${entry.image}" style="max-width:120px;max-height:120px;cursor:pointer;" onclick="window.open(this.src)" title="Click để xem lớn hơn" />`
        : "—";
      return `
      <tr>
        <td class="sticky-col">${normalizeIsoDateString(entry.date)}</td>
        <td style="color:${entry.type === "income" ? "#28a745" : "#dc3545"};font-weight:bold;">${entry.type === "income" ? "Thu" : "Chi"}</td>
        <td>${getCashflowCategoryLabel(entry.type, entry.category)}</td>
        <td style="text-align:right;">${entry.amount.toLocaleString("vi-VN")}</td>
        <td>${(entry.note || "").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>
        <td style="text-align:center;">${imageHtml}</td>
        <td>${formatTimestampForCsv(entry.createdAt)}</td>
        <td>${formatTimestampForCsv(entry.updatedAt)}</td>
      </tr>`;
    })
    .join("");

  const now = new Date();
  const safeMonthsCount = Math.max(1, Math.min(cashflowChartMonths, 24));
  const startDate = new Date(now.getFullYear(), now.getMonth() - safeMonthsCount + 1, 1);
  const startLabel = `T${startDate.getMonth() + 1}/${startDate.getFullYear()}`;
  const endLabel = `T${now.getMonth() + 1}/${now.getFullYear()}`;
  const periodLabel = `${startLabel} - ${endLabel}`;

  const totalIncome = filteredEntries.filter((e) => e.type === "income").reduce((sum, e) => sum + e.amount, 0);
  const totalExpense = filteredEntries.filter((e) => e.type === "expense").reduce((sum, e) => sum + e.amount, 0);
  const balance = totalIncome - totalExpense;

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Báo cáo Thu Chi</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; padding: 16px; background: #f5f5f5; margin: 0; }
    h1 { color: #333; text-align: center; font-size: 20px; margin: 0 0 12px; }
    .export-info { text-align: center; color: #666; margin-bottom: 16px; font-size: 13px; }
    .summary { display: flex; justify-content: center; gap: 24px; margin-bottom: 16px; flex-wrap: wrap; }
    .summary-item { background: #fff; padding: 12px 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); text-align: center; min-width: 140px; }
    .summary-item .label { font-size: 12px; color: #666; margin-bottom: 4px; }
    .summary-item .value { font-size: 16px; font-weight: bold; }
    .summary-item .income .value { color: #28a745; }
    .summary-item .expense .value { color: #dc3545; }
    .summary-item .balance .value { color: #333; }
    .table-wrapper { overflow-x: auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    table { width: 100%; min-width: 700px; border-collapse: collapse; position: relative; }
    th, td { padding: 10px 12px; font-size: 13px; vertical-align: middle; white-space: nowrap; position: relative; z-index: 0; }
    th { background: #4a90d9; color: #fff; text-align: left; position: sticky; top: 0; z-index: 2; }
    td { background: #fff; }
    tr:hover td { background: #f8f9fa; }
    th.sticky-col { position: sticky; left: 0; z-index: 50; background: #3a7fc4; }
    td.sticky-col { position: sticky; left: 0; z-index: 40; background: #fff; }
    tr:hover td.sticky-col { background: #e8f4fc; }
    img { border-radius: 4px; }
    .amount { text-align: right; font-variant-numeric: tabular-nums; }
    .center { text-align: center; }
  </style>
</head>
<body>
  <h1>Báo Cáo Thu Chi</h1>
  <div class="export-info">Xuất: ${new Date().toLocaleString("vi-VN")} | Thời gian: ${periodLabel}</div>
  <div class="summary">
    <div class="summary-item income">
      <div class="label">Tổng Thu</div>
      <div class="value">+${totalIncome.toLocaleString("vi-VN")} đ</div>
    </div>
    <div class="summary-item expense">
      <div class="label">Tổng Chi</div>
      <div class="value">-${totalExpense.toLocaleString("vi-VN")} đ</div>
    </div>
    <div class="summary-item balance">
      <div class="label">Chênh lệch</div>
      <div class="value" style="color:${balance >= 0 ? "#28a745" : "#dc3545"};">${balance >= 0 ? "+" : ""}${balance.toLocaleString("vi-VN")} đ</div>
    </div>
  </div>
  <div class="table-wrapper">
    <table>
      <thead>
        <tr>
          <th class="sticky-col">Ngày</th>
          <th>Loại</th>
          <th>Danh mục</th>
          <th class="amount">Số tiền</th>
          <th>Ghi chú</th>
          <th class="center">Hình ảnh</th>
          <th>Tạo lúc</th>
          <th>Cập nhật</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  </div>
</body>
</html>`;

  const blob = new Blob(["\uFEFF" + html], { type: "text/html;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `thu_chi_${getCsvDateSuffix()}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

function addEventToDate(dateKey, eventData) {
  const data = getDateData(dateKey);
  const now = Date.now();
  data.events.push({
    id: String(eventData.id || `ev-${now}-${Math.random().toString(36).slice(2, 6)}`),
    title: String(eventData.title || "").trim(),
    text: String(eventData.text || eventData.note || "").trim(),
    note: String(eventData.note || eventData.text || "").trim(),
    eventDateTime: String(eventData.eventDateTime || ""),
    color: String(eventData.color || "").trim() || "#3b82f6",
    createdAt: Number(eventData.createdAt || now),
    updatedAt: Number(eventData.updatedAt || eventData.createdAt || now)
  });
  saveDateData(dateKey, data);
}

function updateEventInDate(dateKey, eventIndex, eventData) {
  const data = getDateData(dateKey);
  if (eventIndex < 0 || eventIndex >= data.events.length) return;

  const previous = data.events[eventIndex] || {};
  data.events[eventIndex] = {
    title: String(eventData.title || "").trim(),
    text: String(eventData.text || "").trim(),
    eventDateTime: String(eventData.eventDateTime || ""),
    color: String(eventData.color || "").trim() || previous.color || "#3b82f6",
    createdAt: previous.createdAt || Date.now(),
    updatedAt: Date.now(),
  };

  saveDateData(dateKey, data);
}

function deleteEventFromDate(dateKey, eventIndex) {
  const data = getDateData(dateKey);
  if (eventIndex >= 0 && eventIndex < data.events.length) {
    const removedEvent = data.events[eventIndex];
    data.events.splice(eventIndex, 1);
    saveDateData(dateKey, data);
    // Xoá reminder tương ứng nếu có
    if (removedEvent && removedEvent.id) {
      cancelEventReminder(removedEvent.id);
    }
  }
}

function updateOvertimeForDate(dateKey, hours) {
  const data = getDateData(dateKey);
  data.overtimeHours = Math.max(0, parseInt(hours, 10) || 0);
  saveDateData(dateKey, data);
}

function getEventsForDate(dateKey) {
  const data = getDateData(dateKey);
  return data.events || [];
}

function getOvertimeHoursForDateKey(dateKey) {
  const data = getDateData(dateKey);
  return data.overtimeHours || 0;
}

/* Legacy function for backwards compatibility */
function parseEventRecord(raw) {
  if (!raw) return null;

  const text = String(raw).trim();
  if (!text) return null;

  try {
    const parsed = JSON.parse(text);
    if (parsed && parsed.__type === "calendar_event") {
      return {
        title: String(parsed.title || ""),
        text: String(parsed.text || ""),
        overtimeHours: Math.max(0, parseInt(parsed.overtimeHours, 10) || 0),
      };
    }
  } catch { }

  const legacyHours = parseLegacyOvertimeHours(text);
  return {
    title: "",
    text: legacyHours > 0 ? "" : text,
    overtimeHours: legacyHours,
  };
}

function toDatetimeLocalValue(dateInput) {
  if (!dateInput) return "";
  const dt = new Date(dateInput);
  if (Number.isNaN(dt.getTime())) return "";
  const tzOffset = dt.getTimezoneOffset() * 60000;
  const local = new Date(dt.getTime() - tzOffset);
  return local.toISOString().slice(0, 16);
}

function getFirebaseConfigIssues() {
  const requiredKeys = [
    "apiKey",
    "authDomain",
    "databaseURL",
    "projectId",
    "storageBucket",
    "messagingSenderId",
    "appId",
  ];
  return requiredKeys.filter(
    (k) => String(FIREBASE_CONFIG[k] || "").trim().length === 0,
  );
}

function readEventByKey(key) {
  return parseEventRecord(localStorage.getItem(key));
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

async function initFirebaseRealtime() {
  console.log("[Firebase] Bắt đầu khởi tạo Firebase Realtime...");

  if (!window.firebase || !window.firebase.apps) {
    console.log("[Firebase] window.firebase không tồn tại");
    return;
  }
  if (!isFirebaseConfigReady()) {
    console.log("[Firebase] Firebase config chưa sẵn sàng");
    return;
  }

  if (!window.firebase.apps.length) {
    window.firebase.initializeApp(FIREBASE_CONFIG);
  }

  const signedIn = await ensureFirebaseAuth();
  if (!signedIn) {
    alert(
      "Không thể đăng nhập ẩn danh với Firebase. Vui lòng bật Anonymous Authentication trong Firebase Console.",
    );
    return;
  }

  firebaseDb = window.firebase.database();

  // Users collection reference (for authentication)
  firebaseUsersRef = firebaseDb.ref(FIREBASE_USERS_PATH);

  // Show auth modal BEFORE checking profile key
  // This ensures firebaseUsersRef is available for login/register
  await ensureProfileKey();

  firebaseDatesRef = firebaseDb.ref(
    `${FIREBASE_EVENTS_PATH}/${userProfileKey}/dates`,
  );
  firebaseQuickNotesRef = firebaseDb.ref(`quickNotes/${userProfileKey}`);
  firebaseProjectsRef = firebaseDb.ref(`projects/${userProfileKey}`);
  firebaseTranslateHistoryRef = firebaseDb.ref(
    `${FIREBASE_TRANSLATE_HISTORY_PATH}/${userProfileKey}`,
  );

  // Funds reference
  initFundsFirebase();

  // Cashflow categories
  loadCashflowCategoriesFromStorage();

  // Profile Settings reference (Avatar, Cover, DisplayName, Bio)
  firebaseProfileSettingsRef = firebaseDb.ref(
    `${FIREBASE_PROFILE_SETTINGS_PATH}/${userProfileKey}`,
  );
  console.log(
    "[Firebase] Profile settings ref path:",
    `${FIREBASE_PROFILE_SETTINGS_PATH}/${userProfileKey}`,
  );
  console.log(
    "[Firebase] firebaseProfileSettingsRef created:",
    !!firebaseProfileSettingsRef,
  );

  // Setup real-time listener for profile settings
  setupProfileFirebaseListener();

  // Load Profile Settings from Firebase
  loadProfileSettingsFromFirebase();

  console.log("[Firebase] Đã khởi tạo thành công, firebaseDb:", !!firebaseDb);

  // Lắng nghe sự thay đổi của Translate History
  firebaseTranslateHistoryRef.on("value", (snapshot) => {
    const remoteData = snapshot.val() || {};
    translateHistoryCache = Object.keys(remoteData)
      .map((key) => ({
        id: key,
        ...remoteData[key],
      }))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    console.log(
      "Translate history: Loaded",
      translateHistoryCache.length,
      "items from Firebase",
    );
    renderTranslateHistory();
  });

  // Lắng nghe sự thay đổi của Projects
  firebaseProjectsRef.on("value", (snapshot) => {
    const remoteData = snapshot.val() || {};

    // Separate projects and tasks
    projectsDataCache = {};
    const newTasksCache = {};

    Object.keys(remoteData).forEach((key) => {
      const val = remoteData[key];
      if (val && typeof val === "object") {
        if (val.tasks) {
          newTasksCache[key] = val.tasks;
          const { tasks, ...projectData } = val;
          projectsDataCache[key] = projectData;
        } else if (val.id || val.title) {
          projectsDataCache[key] = val;
        }
      }
    });

    projectTasksCache = { ...projectTasksCache, ...newTasksCache };
    renderProjectsList();
    if (currentOpenedProjectId) {
      renderProjectTasksList(currentOpenedProjectId);
    }
  });

  // Xóa date cache localStorage của profile cũ để tránh cross-profile pollution
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k && isDateKey(k)) localStorage.removeItem(k);
  }

  const snapshot = await firebaseDatesRef.once("value");
  const remoteData = snapshot.val() || {};

  dateDataCache = {};
  Object.keys(remoteData).forEach((dateKey) => {
    if (!isDateKey(dateKey)) return;
    if (!isDateRecordTrusted(remoteData[dateKey])) return;
    dateDataCache[dateKey] = normalizeDateData(remoteData[dateKey]);
  });

  // Render calendar immediately after loading Firebase data
  renderCalendar();
  renderOvertime();
  renderOvertimeSalary();

  const migrationFlag = `${LEGACY_MIGRATION_FLAG_PREFIX}${userProfileKey}`;
  const migrated = localStorage.getItem(migrationFlag) === "1";
  if (!migrated) {
    const localData = collectLegacyLocalDateData();
    const localKeys = Object.keys(localData);
    for (const dateKey of localKeys) {
      if (dateDataCache[dateKey]) continue;
      dateDataCache[dateKey] = normalizeDateData(localData[dateKey]);
      await firebaseDatesRef.child(dateKey).set({
        __type: "date_data",
        events:
          dateDataCache[dateKey].events.length > 0
            ? dateDataCache[dateKey].events
            : {},
        overtimeHours: dateDataCache[dateKey].overtimeHours,
        cashflowEntries:
          dateDataCache[dateKey].cashflowEntries.length > 0
            ? dateDataCache[dateKey].cashflowEntries
            : {},
        updatedAt: Date.now(),
      });
    }
    localStorage.setItem(migrationFlag, "1");
  }

  await migrateLegacyCashflowEntriesIfNeeded();

  // Initial Quick Notes Sync
  const qnSnapshot = await firebaseQuickNotesRef.once("value");
  const remoteNotes = qnSnapshot.val();

  if (remoteNotes !== null && remoteNotes !== undefined) {
    const parsed = normalizeQuickNotes(remoteNotes);
    quickNotesCache = parsed;
    localStorage.setItem(getQuickNoteStorageKey(), JSON.stringify(parsed));
    if (LAZY_LOAD.quickNotes) {
      renderQuickNotes();
    }
  } else {
    // Migration: only migrate from legacy local storage ONCE per profile if flag not set
    const migrationFlag = `quickNotesMigrated:${userProfileKey}`;
    const migrated = localStorage.getItem(migrationFlag) === "1";
    if (!migrated) {
      const localRaw = localStorage.getItem(getQuickNoteStorageKey()) || localStorage.getItem(QUICK_NOTE_STORAGE_KEY_PREFIX);
      let localNotes = [];
      try {
        if (localRaw) localNotes = normalizeQuickNotes(JSON.parse(localRaw));
      } catch (e) { }

      if (localNotes.length > 0) {
        quickNotesCache = localNotes;
        await firebaseQuickNotesRef.set(localNotes);
        if (LAZY_LOAD.quickNotes) {
          renderQuickNotes();
        }
      } else {
        quickNotesCache = [];
        localStorage.setItem(getQuickNoteStorageKey(), JSON.stringify([]));
      }
      localStorage.setItem(migrationFlag, "1");
    } else {
      quickNotesCache = [];
      localStorage.setItem(getQuickNoteStorageKey(), JSON.stringify([]));
      if (LAZY_LOAD.quickNotes) {
        renderQuickNotes();
      }
    }
  }

  // Initial Projects Sync
  const projSnapshot = await firebaseProjectsRef.once("value");
  const remoteProjects = projSnapshot.val();

  if (remoteProjects && typeof remoteProjects === "object") {
    projectsDataCache = {};
    Object.keys(remoteProjects).forEach((key) => {
      const val = remoteProjects[key];
      if (val && typeof val === "object") {
        if (val.tasks) {
          projectTasksCache[key] = val.tasks;
          const { tasks, ...projectData } = val;
          projectsDataCache[key] = projectData;
        } else if (val.id || val.title) {
          projectsDataCache[key] = val;
        }
      }
    });
    localStorage.setItem(
      `projects:${userProfileKey}`,
      JSON.stringify(projectsDataCache),
    );
  } else {
    const localProjects = loadProjectsFromLocalStorage();
    if (localProjects) {
      projectsDataCache = localProjects;
      await firebaseProjectsRef.set(localProjects);
    }
  }

  // Load tasks for each project from local storage if not loaded from Firebase
  Object.keys(projectsDataCache).forEach((projectId) => {
    if (!projectTasksCache[projectId]) {
      const localTasks = loadProjectTasksFromLocalStorage(projectId);
      if (localTasks) {
        projectTasksCache[projectId] = localTasks;
      }
    }
  });

  // Listen for date data changes from Firebase
  let isInitialDatesLoad = true;
  firebaseDatesRef.on("value", (dataSnapshot) => {
    const incoming = dataSnapshot.val() || {};
    const nextCache = {};

    Object.keys(incoming).forEach((dateKey) => {
      if (!isDateKey(dateKey)) return;
      if (!isDateRecordTrusted(incoming[dateKey])) return;
      nextCache[dateKey] = normalizeDateData(incoming[dateKey]);
      localStorage.setItem(
        dateKey,
        JSON.stringify({
          __type: "date_data",
          events: nextCache[dateKey].events,
          overtimeHours: nextCache[dateKey].overtimeHours,
          cashflowEntries: nextCache[dateKey].cashflowEntries,
          updatedAt: Date.now(),
        }),
      );
    });

    // Dọn dẹp localStorage cho các dateKey không còn nằm trên Firebase (xoá sự kiện trên thiết bị khác)
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && isDateKey(k) && !incoming[k]) {
        localStorage.removeItem(k);
      }
    }

    dateDataCache = nextCache;

    // Re-render calendar after Firebase data loads to display events and overtime
    renderCalendar();
    renderOvertime();
    renderOvertimeSalary();

    if (LAZY_LOAD.cashflow) {
      renderCashflowDashboard();
    }

    // Nếu modal chi tiết ngày đang mở trên thiết bị này cho ngày vừa được cập nhật/xóa:
    if (selectedKey && document.getElementById("dayDetailsModal")?.style.display !== "none") {
      openDayDetails(selectedKey);
    }
  });

  firebaseQuickNotesRef.on("value", (snapshot) => {
    const incoming = snapshot.val();
    const normalized = normalizeQuickNotes(incoming);
    quickNotesCache = normalized;
    localStorage.setItem(getQuickNoteStorageKey(), JSON.stringify(normalized));
    if (LAZY_LOAD.quickNotes) {
      renderQuickNotes();
    }
  });

  firebaseReady = true;

  // Initialize countdown
  initCountdown();

  // Initialize profile UI
  initProfileOnLoad();

  // Initialize Firebase Cloud Messaging for Push Notifications
  initFirebaseMessaging();
  setupNotificationQueueListener();
  setupNotificationHistoryListener();

  // Realtime database initialized
  console.log("Firebase Realtime Database connected");
}

// Reload all Firebase references and data when user changes (after login/register/upgrade)
async function reloadFirebaseForUser() {
  if (!firebaseDb || !userProfileKey) {
    console.warn("[Firebase] Cannot reload - firebaseDb or userProfileKey not ready");
    return;
  }

  console.log("[Firebase] Reloading Firebase data for user:", userProfileKey);

  // Clear existing caches
  dateDataCache = {};
  quickNotesCache = [];
  translateHistoryCache = [];
  projectsDataCache = {};
  projectTasksCache = {};

  // Off existing listeners to prevent duplicates
  if (firebaseDatesRef) firebaseDatesRef.off();
  if (firebaseQuickNotesRef) firebaseQuickNotesRef.off();
  if (firebaseTranslateHistoryRef) firebaseTranslateHistoryRef.off();
  if (firebaseProjectsRef) firebaseProjectsRef.off();

  // Update Firebase references with new userProfileKey
  firebaseDatesRef = firebaseDb.ref(`${FIREBASE_EVENTS_PATH}/${userProfileKey}/dates`);
  firebaseQuickNotesRef = firebaseDb.ref(`quickNotes/${userProfileKey}`);
  firebaseProjectsRef = firebaseDb.ref(`projects/${userProfileKey}`);
  firebaseTranslateHistoryRef = firebaseDb.ref(`${FIREBASE_TRANSLATE_HISTORY_PATH}/${userProfileKey}`);
  firebaseProfileSettingsRef = firebaseDb.ref(`${FIREBASE_PROFILE_SETTINGS_PATH}/${userProfileKey}`);

  // Reload Funds
  initFundsFirebase();

  // Reload Cashflow categories
  loadCashflowCategoriesFromStorage();

  // Load dates from Firebase
  try {
    const datesSnapshot = await firebaseDatesRef.once("value");
    const remoteDates = datesSnapshot.val() || {};
    Object.keys(remoteDates).forEach((dateKey) => {
      if (!isDateKey(dateKey)) return;
      if (!isDateRecordTrusted(remoteDates[dateKey])) return;
      dateDataCache[dateKey] = normalizeDateData(remoteDates[dateKey]);
    });
    console.log("[Firebase] Loaded", Object.keys(dateDataCache).length, "date records");
  } catch (err) {
    console.error("[Firebase] Error loading dates:", err);
  }

  // Load Quick Notes
  try {
    const quickNotesSnapshot = await firebaseQuickNotesRef.once("value");
    const quickNotesData = quickNotesSnapshot.val();
    const normalized = normalizeQuickNotes(quickNotesData);
    quickNotesCache = normalized;
    localStorage.setItem(getQuickNoteStorageKey(), JSON.stringify(normalized));
  } catch (err) {
    console.error("[Firebase] Error loading quick notes:", err);
  }

  // Load Projects
  try {
    const projectsSnapshot = await firebaseProjectsRef.once("value");
    const projectsData = projectsSnapshot.val() || {};
    Object.keys(projectsData).forEach((key) => {
      const val = projectsData[key];
      if (val && typeof val === "object") {
        if (val.tasks) {
          projectTasksCache[key] = val.tasks;
          const { tasks, ...projectData } = val;
          projectsDataCache[key] = projectData;
        } else if (val.id || val.title) {
          projectsDataCache[key] = val;
        }
      }
    });
  } catch (err) {
    console.error("[Firebase] Error loading projects:", err);
  }

  // Load Translate History
  try {
    const translateSnapshot = await firebaseTranslateHistoryRef.once("value");
    const translateData = translateSnapshot.val() || {};
    translateHistoryCache = Object.keys(translateData)
      .map((key) => ({ id: key, ...translateData[key] }))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  } catch (err) {
    console.error("[Firebase] Error loading translate history:", err);
  }

  // Setup real-time listeners
  setupProfileFirebaseListener();
  loadProfileSettingsFromFirebase();

  // Track first Firebase data load for this user
  let isFirstReloadLoad = true;

  // Realtime listener for dates
  firebaseDatesRef.on("value", (dataSnapshot) => {
    const incoming = dataSnapshot.val() || {};
    const nextCache = {};

    Object.keys(incoming).forEach((dateKey) => {
      if (!isDateKey(dateKey)) return;
      if (!isDateRecordTrusted(incoming[dateKey])) return;
      nextCache[dateKey] = normalizeDateData(incoming[dateKey]);
      localStorage.setItem(
        dateKey,
        JSON.stringify({
          __type: "date_data",
          events: nextCache[dateKey].events,
          overtimeHours: nextCache[dateKey].overtimeHours,
          cashflowEntries: nextCache[dateKey].cashflowEntries,
          updatedAt: Date.now(),
        }),
      );
    });

    // Dọn dẹp localStorage cho các dateKey không còn nằm trên Firebase (xoá sự kiện trên thiết bị khác)
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && isDateKey(k) && !incoming[k]) {
        localStorage.removeItem(k);
      }
    }

    dateDataCache = nextCache;

    // Always render calendar after login (user changed)
    renderCalendar();
    renderOvertime();
    renderOvertimeSalary();

    if (LAZY_LOAD.cashflow) {
      renderCashflowDashboard();
    }

    // Nếu modal chi tiết ngày đang mở trên thiết bị này cho ngày vừa được cập nhật/xóa:
    if (selectedKey && document.getElementById("dayDetailsModal")?.style.display !== "none") {
      openDayDetails(selectedKey);
    }
  });

  // Realtime listener for quick notes
  firebaseQuickNotesRef.on("value", (snapshot) => {
    const incoming = snapshot.val();
    const normalized = normalizeQuickNotes(incoming);
    quickNotesCache = normalized;
    localStorage.setItem(getQuickNoteStorageKey(), JSON.stringify(normalized));
    if (LAZY_LOAD.quickNotes) {
      renderQuickNotes();
    }
  });

  // Realtime listener for translate history
  firebaseTranslateHistoryRef.on("value", (snapshot) => {
    const remoteData = snapshot.val() || {};
    translateHistoryCache = Object.keys(remoteData)
      .map((key) => ({ id: key, ...remoteData[key] }))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    renderTranslateHistory();
  });

  // Realtime listener for projects
  firebaseProjectsRef.on("value", (snapshot) => {
    const remoteData = snapshot.val() || {};
    projectsDataCache = {};
    const newTasksCache = {};

    Object.keys(remoteData).forEach((key) => {
      const val = remoteData[key];
      if (val && typeof val === "object") {
        if (val.tasks) {
          newTasksCache[key] = val.tasks;
          const { tasks, ...projectData } = val;
          projectsDataCache[key] = projectData;
        } else if (val.id || val.title) {
          projectsDataCache[key] = val;
        }
      }
    });

    projectTasksCache = { ...projectTasksCache, ...newTasksCache };
    renderProjectsList();
    if (currentOpenedProjectId) {
      renderProjectTasksList(currentOpenedProjectId);
    }
  });

  // Clear local date cache to avoid cross-profile pollution
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k && isDateKey(k)) localStorage.removeItem(k);
  }

  // Re-render UI
  renderCalendar();
  renderOvertime();
  renderOvertimeSalary();
  if (LAZY_LOAD.quickNotes) {
    renderQuickNotes();
  }
  renderProjectsList();
  renderTranslateHistory();

  // Re-sync Push Notification token for the new user profile
  initFirebaseMessaging();
  setupNotificationQueueListener();
  setupNotificationHistoryListener();

  console.log("[Firebase] Reload complete for user:", userProfileKey);
}

function closeAllModals() {
  const modals = [
    "addEventModal",
    "dayDetailsModal",
    "eventQuickViewModal",
    "overtimeModal",
    "goldModal",
    "quickNoteModal",
    "myMusicModal",
    "cashflowModal",
    "cashflowQuickViewModal",
    "cashflowDeleteConfirmModal",
    "cashflowAllTransactionsModal",
    "currencyModal",
    "fundsModal",
    "fundModal",
    "allocateModal",
    "congratulationsModal",
    "modalNotificationList",
  ];
  modals.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });
}

async function initFirebaseServices() {
  await initFirebaseRealtime();
}

function openAddEventModalForToday() {
  closeAllModals();
  const today = new Date();
  const key = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
  openAddEventModal(
    key,
    today.getDate(),
    today.getMonth() + 1,
    today.getFullYear(),
  );
}

/* ==================== PUSH NOTIFICATION & FCM MULTI-DEVICE ==================== */

let _currentTabSessionId = null;
function getOrCreateTabSessionId() {
  if (!_currentTabSessionId) {
    try {
      _currentTabSessionId = sessionStorage.getItem("calendarTabSessionId");
      if (!_currentTabSessionId) {
        _currentTabSessionId = `tab_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
        sessionStorage.setItem("calendarTabSessionId", _currentTabSessionId);
      }
    } catch (e) {
      _currentTabSessionId = `tab_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    }
  }
  return _currentTabSessionId;
}

function getOrCreateDeviceId() {
  let devId = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (!devId) {
    devId = `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, devId);
  }
  return devId;
}

function playNotificationChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5

    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) { }
}

function handleNotificationNavigation(notificationType, dateKey, eventData, targetUrl) {
  let type = notificationType || "event";
  let dKey = dateKey || "";

  if (targetUrl) {
    try {
      const parsedUrl = new URL(targetUrl, window.location.origin);
      const action = parsedUrl.searchParams.get("action");
      const date = parsedUrl.searchParams.get("date");
      if (action === "cashflow" || action === "expense" || action === "income") {
        type = "cashflow";
      } else if (action === "funds" || action === "fund") {
        type = "fund_allocation";
      }
      if (date) {
        dKey = date;
      }
    } catch (e) { }
  }

  console.log("[NotificationNav] Điều hướng tới:", { type, dKey, eventData, targetUrl });

  if (type === "cashflow") {
    // 1. Tải danh sách giao dịch từ cache & local
    reloadCashflowEntriesFromCache();

    let targetEntry = null;
    if (eventData) {
      if (eventData.id) {
        targetEntry = cashflowEntries.find((e) => e.id === eventData.id) || null;
      }
      if (!targetEntry && eventData.amount) {
        targetEntry = cashflowEntries.find((e) => {
          const matchAmt = Number(e.amount) === Number(eventData.amount);
          const matchCat = !eventData.category || e.category === eventData.category;
          const matchDate = !dateKey || e.date === normalizeIsoDateString(dateKey);
          return matchAmt && matchCat && matchDate;
        }) || null;
      }
    }

    if (!targetEntry && !eventData && dKey) {
      const isoDate = normalizeIsoDateString(dKey) || dKey;
      targetEntry = cashflowEntries.find((e) => e.date === isoDate) || null;
    }

    if (!targetEntry && eventData && (eventData.amount || eventData.category || eventData.text || eventData.title)) {
      const isoDate = normalizeIsoDateString(eventData.date || dateKey || getTodayIsoDate());
      targetEntry = {
        id: eventData.id || `cf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        date: isoDate,
        type: eventData.cashflowType || (eventData.title?.includes("Thu nhập") ? "income" : "expense"),
        category: eventData.category || "Ăn uống",
        amount: Number(eventData.amount || 0),
        note: eventData.text || eventData.note || "",
        image: eventData.image || "",
        createdAt: Number(eventData.createdAt || Date.now()),
        updatedAt: Number(eventData.updatedAt || eventData.createdAt || Date.now())
      };
      const targetDateKey = isoDateToDateKey(isoDate);
      if (targetDateKey) {
        const dData = getDateData(targetDateKey);
        const exists = (dData.cashflowEntries || []).some((e) => e.id === targetEntry.id);
        if (!exists) {
          dData.cashflowEntries.push(targetEntry);
          dateDataCache[targetDateKey] = dData;
          try {
            localStorage.setItem(targetDateKey, JSON.stringify({
              __type: "date_data",
              events: dData.events,
              overtimeHours: dData.overtimeHours,
              cashflowEntries: dData.cashflowEntries,
              isHoliday: dData.isHoliday,
              updatedAt: Date.now()
            }));
          } catch (e) { }
          reloadCashflowEntriesFromCache();
        }
      }
    }

    closeAllModals();
    if (targetEntry) {
      activeQuickViewEntry = targetEntry;
      selectedCashflowId = targetEntry.id;
      renderCashflowQuickView();
      openCashflowQuickViewModal();
    } else {
      openCashflowModal();
      if (dKey) {
        const isoDate = dateKeyToIsoDate(dKey) || dKey;
        const dateInput = document.getElementById("cashflowDate");
        if (dateInput) dateInput.value = isoDate;
      }
    }
    return;
  }

  if (type === "fund_allocation" || type === "funds") {
    if (typeof openFundsModal === "function") {
      openFundsModal();
    }
    return;
  }

  // Event (sự kiện lịch)
  const targetKey = isoDateToDateKey(dKey) || dKey || `${new Date().getFullYear()}-${new Date().getMonth() + 1}-${new Date().getDate()}`;
  const parts = targetKey ? targetKey.split("-").map(Number) : [];

  if (eventData && (eventData.title || eventData.text || eventData.note)) {
    if (targetKey) {
      const currentData = getDateData(targetKey);
      const existsIdx = (currentData.events || []).findIndex(
        (ev) => (ev.id && eventData.id && ev.id === eventData.id) ||
          (ev.title === eventData.title && (ev.eventDateTime === eventData.eventDateTime || Math.abs((ev.createdAt || 0) - (eventData.createdAt || 0)) < 10000))
      );
      if (existsIdx === -1) {
        const newEv = {
          id: eventData.id || `ev-${Date.now()}`,
          title: eventData.title || "",
          text: eventData.text || eventData.note || "",
          note: eventData.note || eventData.text || "",
          eventDateTime: eventData.eventDateTime || "",
          color: eventData.color || EVENT_COLOR_DEFAULT,
          createdAt: Number(eventData.createdAt || Date.now())
        };
        currentData.events.push(newEv);
        dateDataCache[targetKey] = currentData;
        try {
          localStorage.setItem(targetKey, JSON.stringify({
            __type: "date_data",
            events: currentData.events,
            overtimeHours: currentData.overtimeHours,
            cashflowEntries: currentData.cashflowEntries,
            updatedAt: Date.now()
          }));
        } catch (e) { }
      }
    }
    closeAllModals();
    openEventQuickViewModal(eventData, targetKey, -1);
    if (parts.length === 3) {
      selectedKey = targetKey;
    }
    return;
  }

  // Nếu không có eventData cụ thể trong payload, mở sự kiện mới nhất trong ngày targetKey
  closeAllModals();
  const currentData = getDateData(targetKey);
  const events = currentData.events || [];
  if (events.length > 0) {
    const latestEvent = events[events.length - 1];
    openEventQuickViewModal(latestEvent, targetKey, events.length - 1);
    if (parts.length === 3) {
      selectedKey = targetKey;
    }
    return;
  }

  // Nếu chưa có trong cache, fetch Firebase ngầm và hiển thị modal chi tiết sự kiện khi nhận được
  if (firebaseDb && userProfileKey) {
    firebaseDb.ref(`${FIREBASE_EVENTS_PATH}/${userProfileKey}/dates/${targetKey}`).once("value").then((snap) => {
      const remote = snap.val();
      if (remote && isDateRecordTrusted(remote)) {
        dateDataCache[targetKey] = normalizeDateData(remote);
        const remoteEvents = dateDataCache[targetKey].events || [];
        if (remoteEvents.length > 0) {
          openEventQuickViewModal(remoteEvents[remoteEvents.length - 1], targetKey, remoteEvents.length - 1);
        }
      }
    }).catch(() => { });
  }
  if (parts.length === 3) {
    selectedKey = targetKey;
  }
}
window.handleNotificationNavigation = handleNotificationNavigation;

function showAppPushToast(title, body, dateKey, notificationType, eventData) {
  // Đã bỏ toast in-app theo yêu cầu - chỉ sử dụng thông báo gốc của hệ thống/trình duyệt
  return;
}
window.showAppPushToast = showAppPushToast;

const _recentlyNotifiedIds = new Map();

function isDuplicateNotification(uniqueId) {
  if (!uniqueId) return false;
  const now = Date.now();
  for (const [id, time] of _recentlyNotifiedIds.entries()) {
    if (now - time > 120000) _recentlyNotifiedIds.delete(id);
  }
  if (_recentlyNotifiedIds.has(uniqueId)) {
    return true;
  }
  _recentlyNotifiedIds.set(uniqueId, now);
  return false;
}

function openEventDateFromPush(dateKey) {
  handleNotificationNavigation("event", dateKey);
}
window.openEventDateFromPush = openEventDateFromPush;

/**
 * Xử lý bắn thông báo Realtime đa thiết bị (Hỗ trợ 100% gói miễn phí Spark)
 */
function notifyNewEventFromRealtime(eventData, dateKey, notificationType) {
  if (!eventData) return;
  if (localStorage.getItem("calendarDevicePushEnabled") === "0") return;

  const type = notificationType || "event";
  const uniqueKey = eventData.id || `${type}-${eventData.title || ""}-${eventData.amount || ""}-${eventData.createdAt || dateKey || ""}`;
  if (isDuplicateNotification(uniqueKey)) {
    console.log("[Notification] Bỏ qua thông báo trùng lặp:", uniqueKey);
    return;
  }

  let title = "";
  const bodyParts = [];
  let notificationUrl = "./";
  let notificationTag = "";

  if (type === "cashflow") {
    const isExpense = eventData.cashflowType === "expense";
    title = isExpense ? "💸 Chi tiêu mới" : "💰 Thu nhập mới";
    if (eventData.amount) bodyParts.push(`${Number(eventData.amount).toLocaleString("vi-VN")} đ`);
    if (eventData.category) bodyParts.push(eventData.category);
    if (dateKey) bodyParts.push(`Ngày ${dateKey}`);
    const cleanNote = String(eventData.text || eventData.note || "").replace(/^undefined$/i, "").trim();
    if (cleanNote) bodyParts.push(cleanNote);
    notificationUrl = `./?action=cashflow&id=${encodeURIComponent(eventData.id || "")}&date=${encodeURIComponent(dateKey || "")}&amount=${encodeURIComponent(eventData.amount || "")}&category=${encodeURIComponent(eventData.category || "")}&cashflowType=${encodeURIComponent(eventData.cashflowType || "")}&note=${encodeURIComponent(eventData.text || eventData.note || "")}&createdAt=${encodeURIComponent(eventData.createdAt || Date.now())}`;
    notificationTag = `cashflow-${eventData.id || dateKey || Date.now()}`;
  } else if (type === "fund_allocation" || type === "funds") {
    title = `📊 Phân bổ quỹ: ${eventData.fundName || "Quỹ"}`;
    if (eventData.amount) bodyParts.push(`${Number(eventData.amount).toLocaleString("vi-VN")} đ`);
    if (dateKey) bodyParts.push(`Ngày ${dateKey}`);
    const cleanNote = String(eventData.text || eventData.note || "").replace(/^undefined$/i, "").trim();
    if (cleanNote) bodyParts.push(cleanNote);
    notificationUrl = `./?action=funds&id=${encodeURIComponent(eventData.id || "")}&fundName=${encodeURIComponent(eventData.fundName || "")}&amount=${encodeURIComponent(eventData.amount || "")}&note=${encodeURIComponent(eventData.text || eventData.note || "")}&createdAt=${encodeURIComponent(eventData.createdAt || Date.now())}`;
    notificationTag = `fund-${eventData.id || Date.now()}`;
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
      } catch { }
    }
    const cleanNote = String(eventData.text || eventData.note || "").replace(/^undefined$/i, "").trim();
    if (cleanNote) bodyParts.push(cleanNote);
    notificationUrl = `./?action=event&id=${encodeURIComponent(eventData.id || "")}&title=${encodeURIComponent(eventData.title || "")}&text=${encodeURIComponent(eventData.text || eventData.note || "")}&note=${encodeURIComponent(eventData.note || eventData.text || "")}&eventDateTime=${encodeURIComponent(eventData.eventDateTime || "")}&color=${encodeURIComponent(eventData.color || "")}&createdAt=${encodeURIComponent(eventData.createdAt || Date.now())}&date=${encodeURIComponent(dateKey || "")}`;
    notificationTag = `event-${eventData.id || dateKey || Date.now()}`;
  }

  const body = bodyParts.join(" | ") || "Có cập nhật mới từ thiết bị khác.";

  // 1. Phát chuông thông báo & hiển thị Toast trong ứng dụng
  playNotificationChime();
  showAppPushToast(title, body, notificationUrl);

  // 2. Hiển thị System Notification của trình duyệt qua Service Worker hoặc Notification API
  if ("Notification" in window && Notification.permission === "granted") {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification(title, {
          body: body,
          icon: "/public/favicon.png",
          badge: "/public/favicon.png",
          tag: notificationTag,
          vibrate: [200, 100, 200],
          data: {
            url: notificationUrl,
            dateKey: dateKey,
            notificationType: type,
            eventData: eventData
          }
        });
      }).catch(() => {
        try {
          const n = new Notification(title, { body, icon: "/public/favicon.png" });
          n.onclick = () => {
            window.focus();
            handleNotificationNavigation(type, dateKey, eventData, notificationUrl);
            n.close();
          };
        } catch (e) { }
      });
    } else {
      try {
        const n = new Notification(title, { body, icon: "/public/favicon.png" });
        n.onclick = () => {
          window.focus();
          handleNotificationNavigation(type, dateKey, eventData, notificationUrl);
          n.close();
        };
      } catch (e) { }
    }
  }

  // 3. Rung nếu thiết bị hỗ trợ
  if ("vibrate" in navigator) {
    try { navigator.vibrate([100, 50, 100]); } catch (e) { }
  }
}
window.notifyNewEventFromRealtime = notifyNewEventFromRealtime;

async function initFirebaseMessaging() {
  // Lắng nghe postMessage từ Service Worker khi người dùng click vào thông báo trên background
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data && event.data.type === "NOTIFICATION_CLICKED") {
        console.log("[SW->Client] Nhận sự kiện click thông báo:", event.data);
        const { url, notificationType, dateKey, eventData } = event.data;
        handleNotificationNavigation(
          notificationType || event.data.data?.notificationType,
          dateKey || event.data.data?.dateKey,
          eventData || event.data.data?.eventData,
          url || event.data.data?.url
        );
      }
    });
  }

  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    console.log("[FCM] Trình duyệt không hỗ trợ Web Push Notification.");
    updateNotificationUIState();
    return;
  }

  if (!window.firebase || !window.firebase.messaging) {
    console.log("[FCM] Firebase messaging SDK chưa sẵn sàng.");
    return;
  }

  try {
    if (!firebaseMessaging) {
      firebaseMessaging = window.firebase.messaging();

      // Lắng nghe tin nhắn khi ứng dụng đang mở ở tab hiện tại (Foreground)
      firebaseMessaging.onMessage((payload) => {
        console.log("[FCM] Foreground message received:", payload);
        const title = payload.notification?.title || payload.data?.title || "Sự kiện mới từ thiết bị khác";
        const body = payload.notification?.body || payload.data?.text || payload.data?.body || "";
        const dateKey = payload.data?.dateKey || payload.data?.date || "";
        const notificationType = payload.data?.notificationType || "event";
        let parsedEventData = null;
        if (payload.data?.eventDataJson) {
          try { parsedEventData = JSON.parse(payload.data.eventDataJson); } catch (e) { }
        } else if (payload.data?.eventData) {
          parsedEventData = payload.data.eventData;
        }

        const fcmUniqueKey = parsedEventData?.id
          ? `event-${parsedEventData.id}`
          : (payload.data?.eventId ? `event-${payload.data.eventId}` : payload.data?.id || payload.messageId || `${notificationType}-${title}-${body}-${dateKey}`);

        if (isDuplicateNotification(fcmUniqueKey)) {
          console.log("[FCM] Bỏ qua thông báo FCM trùng lặp:", fcmUniqueKey);
          return;
        }

        playNotificationChime();

        // Hiển thị thông báo hệ thống của trình duyệt (System Browser Notification)
        if ("Notification" in window && Notification.permission === "granted") {
          let notificationUrl = "./";
          if (notificationType === "cashflow" && parsedEventData) {
            notificationUrl = `./?action=cashflow&id=${encodeURIComponent(parsedEventData.id || "")}&date=${encodeURIComponent(dateKey || "")}&amount=${encodeURIComponent(parsedEventData.amount || "")}&category=${encodeURIComponent(parsedEventData.category || "")}&cashflowType=${encodeURIComponent(parsedEventData.cashflowType || "")}&note=${encodeURIComponent(parsedEventData.text || parsedEventData.note || "")}&createdAt=${encodeURIComponent(parsedEventData.createdAt || Date.now())}`;
          } else if ((notificationType === "fund_allocation" || notificationType === "funds") && parsedEventData) {
            notificationUrl = `./?action=funds&id=${encodeURIComponent(parsedEventData.id || "")}&fundName=${encodeURIComponent(parsedEventData.fundName || "")}&amount=${encodeURIComponent(parsedEventData.amount || "")}&note=${encodeURIComponent(parsedEventData.text || parsedEventData.note || "")}&createdAt=${encodeURIComponent(parsedEventData.createdAt || Date.now())}`;
          } else if (notificationType === "fund_allocation" || notificationType === "funds") {
            notificationUrl = "./?action=funds";
          } else if (parsedEventData) {
            notificationUrl = `./?action=event&id=${encodeURIComponent(parsedEventData.id || "")}&title=${encodeURIComponent(parsedEventData.title || "")}&text=${encodeURIComponent(parsedEventData.text || parsedEventData.note || "")}&note=${encodeURIComponent(parsedEventData.note || parsedEventData.text || "")}&eventDateTime=${encodeURIComponent(parsedEventData.eventDateTime || "")}&color=${encodeURIComponent(parsedEventData.color || "")}&createdAt=${encodeURIComponent(parsedEventData.createdAt || Date.now())}&date=${encodeURIComponent(dateKey || "")}`;
          } else {
            notificationUrl = `./?date=${dateKey}`;
          }

          if ("serviceWorker" in navigator) {
            navigator.serviceWorker.ready.then((reg) => {
              reg.showNotification(title, {
                body: body,
                icon: "/public/favicon.png",
                badge: "/public/favicon.png",
                tag: `fcm-${Date.now()}`,
                vibrate: [200, 100, 200],
                data: {
                  url: notificationUrl,
                  dateKey: dateKey,
                  notificationType: notificationType,
                  eventData: parsedEventData
                }
              });
            }).catch(() => {
              try {
                const n = new Notification(title, { body, icon: "/public/favicon.png" });
                n.onclick = () => {
                  window.focus();
                  handleNotificationNavigation(notificationType, dateKey, parsedEventData, notificationUrl);
                  n.close();
                };
              } catch (e) { }
            });
          } else {
            try {
              const n = new Notification(title, { body, icon: "/public/favicon.png" });
              n.onclick = () => {
                window.focus();
                handleNotificationNavigation(notificationType, dateKey, parsedEventData, notificationUrl);
                n.close();
              };
            } catch (e) { }
          }
        }

        // Vibrate nhẹ nếu hỗ trợ
        if ("vibrate" in navigator) {
          try { navigator.vibrate([100, 50, 100]); } catch (e) { }
        }
      });
    }

    // Nếu người dùng đã cấp quyền, tự động đồng bộ token cho profile hiện tại
    // Nhưng phải kiểm tra xem người dùng có chủ động tắt thông báo không
    const isManuallyDisabled = localStorage.getItem("calendarDevicePushEnabled") === "0";
    if (Notification.permission === "granted" && userProfileKey && !isManuallyDisabled) {
      await requestNotificationPermissionAndRegisterToken(true);
    } else {
      updateNotificationUIState();
    }
  } catch (err) {
    console.error("[FCM] Lỗi khởi tạo Firebase Messaging:", err);
  }
}

async function requestNotificationPermissionAndRegisterToken(silent = false) {
  if (!("Notification" in window)) {
    if (!silent) alert("Trình duyệt của bạn không hỗ trợ nhận thông báo đẩy Web Push.");
    updateNotificationUIState();
    return false;
  }

  if (!userProfileKey) {
    if (!silent) alert("Vui lòng đăng nhập để bật tính năng nhận thông báo trên thiết bị này.");
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      if (!silent) {
        alert("Quyền nhận thông báo chưa được cấp. Vui lòng cho phép trong cài đặt trình duyệt.");
      }
      updateNotificationUIState();
      return false;
    }

    // Đảm bảo Service Worker đã được đăng ký và sẵn sàng hoạt động
    let swReg = null;
    if ("serviceWorker" in navigator) {
      try {
        // Hủy đăng ký các service worker cũ hoặc xung đột (ví dụ firebase-messaging-sw.js)
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          const scriptURL = reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || "";
          if (scriptURL && !scriptURL.includes("service-worker.js")) {
            console.log("[SW] Hủy đăng ký service worker xung đột:", scriptURL);
            await reg.unregister();
          }
        }

        // Luôn đăng ký service-worker.js mới nhất
        swReg = await navigator.serviceWorker.register("./service-worker.js");
        await navigator.serviceWorker.ready;
      } catch (swErr) {
        console.warn("[SW] Lỗi cấu hình service worker:", swErr);
      }
    }

    // Cố gắng lấy FCM token nếu cấu hình sẵn sàng
    if (window.firebase?.messaging) {
      try {
        if (!firebaseMessaging) {
          firebaseMessaging = window.firebase.messaging();
        }

        const vapidKey = (FIREBASE_CONFIG.vapidKey && FIREBASE_CONFIG.vapidKey.length > 20)
          ? FIREBASE_CONFIG.vapidKey
          : undefined;

        const tokenOptions = {};
        if (vapidKey) tokenOptions.vapidKey = vapidKey;
        if (swReg) tokenOptions.serviceWorkerRegistration = swReg;

        const token = await firebaseMessaging.getToken(tokenOptions);
        if (token) {
          const deviceId = getOrCreateDeviceId();
          const tokenData = {
            token: token,
            deviceId: deviceId,
            userAgent: navigator.userAgent.slice(0, 200),
            platform: navigator.platform || "",
            updatedAt: Date.now()
          };

          if (firebaseDb && userProfileKey) {
            await firebaseDb.ref(`${FIREBASE_NOTIFICATION_TOKENS_PATH}/${userProfileKey}/${deviceId}`).set(tokenData);
          }
          console.log("[FCM] Đã đăng ký FCM Token thành công.");
        }
      } catch (fcmErr) {
        console.warn("[FCM] FCM Token đăng ký nền (tiếp tục với Realtime Sync):", fcmErr);
      }
    }

    localStorage.setItem("calendarDevicePushEnabled", "1");
    isPushNotificationSubscribed = true;
    updateNotificationUIState();

    if (!silent) {
      showAppPushToast("Thông báo đã được bật!", "Thiết bị này sẽ nhận thông báo khi có sự kiện mới được thêm.", "");
    }
    return true;
  } catch (err) {
    console.error("[Notification] Lỗi bật thông báo:", err);
    if (!silent) {
      alert("Đã xảy ra lỗi khi đăng ký thông báo: " + (err.message || err));
    }
    updateNotificationUIState();
    return false;
  }
}

async function unregisterDeviceNotificationToken() {
  const deviceId = getOrCreateDeviceId();
  if (firebaseDb && userProfileKey && deviceId) {
    try {
      await firebaseDb.ref(`${FIREBASE_NOTIFICATION_TOKENS_PATH}/${userProfileKey}/${deviceId}`).remove();
    } catch (e) {
      console.warn("[FCM] Lỗi xóa token khỏi Firebase:", e);
    }
  }
  localStorage.setItem("calendarDevicePushEnabled", "0");
  isPushNotificationSubscribed = false;
  updateNotificationUIState();
}

function updateNotificationUIState() {
  const statusEl = document.getElementById("deviceNotifyStatus");
  const descEl = document.getElementById("deviceNotifyDesc");
  const btnToggle = document.getElementById("btnToggleNotification");
  const btnTest = document.getElementById("btnTestNotification");

  if (!statusEl || !btnToggle) return;

  // Luôn đặt nowrap cho tất cả nút
  btnToggle.style.whiteSpace = "nowrap";
  if (btnTest) btnTest.style.whiteSpace = "nowrap";

  if (!("Notification" in window)) {
    statusEl.textContent = "Không hỗ trợ";
    statusEl.style.color = "#ef4444";
    descEl.textContent = "Trình duyệt không hỗ trợ Web Push";
    btnToggle.style.display = "none";
    if (btnTest) btnTest.style.display = "none";
    return;
  }

  const permission = Notification.permission;
  const isManuallyDisabled = localStorage.getItem("calendarDevicePushEnabled") === "0";

  if (permission === "denied") {
    statusEl.textContent = "Bị chặn";
    statusEl.style.color = "#ef4444";
    descEl.textContent = "Bạn đã chặn quyền thông báo trong cài đặt trình duyệt";
    btnToggle.textContent = "Bị chặn";
    btnToggle.disabled = true;
    btnToggle.style.opacity = "0.6";
    if (btnTest) btnTest.style.display = "none";
  } else if (permission === "granted" && !isManuallyDisabled) {
    statusEl.textContent = "Đang hoạt động";
    statusEl.style.color = "#10b981";
    descEl.textContent = "";
    btnToggle.textContent = "Tắt thông báo";
    btnToggle.disabled = false;
    btnToggle.style.opacity = "1";
    btnToggle.className = "btn-secondary";
    if (btnTest) btnTest.style.display = "inline-flex";
  } else if (permission === "granted" && isManuallyDisabled) {
    statusEl.textContent = "Đã tắt";
    statusEl.style.color = "#f59e0b";
    descEl.textContent = "Thông báo đang tạm tắt trên thiết bị này";
    btnToggle.textContent = "Bật lại thông báo";
    btnToggle.disabled = false;
    btnToggle.style.opacity = "1";
    btnToggle.className = "btn-primary";
    if (btnTest) btnTest.style.display = "none";
  } else {
    statusEl.textContent = "Chưa bật";
    statusEl.style.color = "#f59e0b";
    descEl.textContent = "Chạm để cấp quyền và bật nhận thông báo";
    btnToggle.textContent = "Bật thông báo";
    btnToggle.disabled = false;
    btnToggle.style.opacity = "1";
    btnToggle.className = "btn-primary";
    if (btnTest) btnTest.style.display = "none";
  }
}

async function toggleDeviceNotificationPermission() {
  if (!("Notification" in window)) {
    alert("Trình duyệt này không hỗ trợ Web Push Notification.");
    return;
  }

  const isManuallyDisabled = localStorage.getItem("calendarDevicePushEnabled") === "0";

  if (Notification.permission === "granted" && !isManuallyDisabled) {
    showConfirmPopup(
      "Tắt thông báo",
      "Bạn có muốn tắt nhận thông báo đẩy trên thiết bị này không?",
      "Tắt thông báo",
      async () => {
        await unregisterDeviceNotificationToken();
        showAppPushToast("Đã tắt thông báo", "Thiết bị này sẽ không nhận thông báo cho đến khi bạn bật lại.", "");
      },
      undefined,
      { type: "warning", icon: "🔕", btnType: "danger" }
    );
  } else {
    localStorage.setItem("calendarDevicePushEnabled", "1");
    await requestNotificationPermissionAndRegisterToken(false);
  }
}

async function sendTestPushNotification() {
  if (!userProfileKey) {
    alert("Vui lòng đăng nhập trước khi thử nghiệm.");
    return;
  }

  const testEvent = {
    title: "Thông báo thử nghiệm",
    text: "Hệ thống thông báo đẩy trên các thiết bị đang hoạt động rất tốt!",
    eventDateTime: new Date().toISOString(),
    createdAt: Date.now()
  };

  await queueEventNotification(testEvent, `${new Date().getFullYear()}-${new Date().getMonth() + 1}-${new Date().getDate()}`);
  showAppPushToast("Đã gửi lệnh bắn thông báo thử nghiệm", "Các thiết bị cùng đăng nhập tài khoản sẽ nhận được thông báo sau vài giây.", "");
}

let firebaseNotificationQueueRef = null;
const _processedNotificationKeys = new Set();
const _appStartTime = Date.now();

function setupNotificationQueueListener() {
  if (!firebaseDb || !userProfileKey) return;

  if (firebaseNotificationQueueRef) {
    try {
      firebaseNotificationQueueRef.off();
    } catch (e) { }
  }

  firebaseNotificationQueueRef = firebaseDb.ref(
    `${FIREBASE_EVENT_NOTIFICATION_QUEUE_PATH}/${userProfileKey}`,
  );

  console.log("[NotificationQueue] Đang lắng nghe thông báo cho user:", userProfileKey);

  let isInitialSnapshotLoaded = false;

  // 1. Quét qua một lần tất cả thông báo cũ đang tồn tại trong Queue để bỏ qua không bắn toast trùng khi mở app
  firebaseNotificationQueueRef.limitToLast(50).once("value", (snapshot) => {
    const dataMap = snapshot.val() || {};
    Object.keys(dataMap).forEach((k) => {
      _processedNotificationKeys.add(k);
    });
    isInitialSnapshotLoaded = true;
  });

  // 2. Lắng nghe các thông báo MỚI THỰC SỰ được thêm vào Queue từ thời điểm hiện tại
  firebaseNotificationQueueRef
    .limitToLast(30)
    .on("child_added", (snapshot) => {
      const key = snapshot.key;
      if (!key) return;

      // Nếu thông báo này đã tồn tại trước đó -> Bỏ qua không phát chuông/toast
      if (_processedNotificationKeys.has(key)) return;
      _processedNotificationKeys.add(key);

      // Nếu chưa nạp xong snapshot ban đầu -> Bỏ qua
      if (!isInitialSnapshotLoaded) return;

      const data = snapshot.val();
      if (!data || !data.eventData) return;

      const mySessionId = getOrCreateTabSessionId();
      // Nếu sự kiện được gửi từ tab khác hoặc thiết bị khác (Session ID khác nhau 100%)
      if (!data.senderSessionId || data.senderSessionId !== mySessionId) {
        console.log("[NotificationQueue] Nhận thông báo MỚI từ thiết bị/tab khác:", data);
        notifyNewEventFromRealtime(data.eventData, data.dateKey, data.notificationType);
      }
    });
}
window.setupNotificationQueueListener = setupNotificationQueueListener;

async function queueEventNotification(eventData, dateKey, notificationType) {
  if (!userProfileKey || !eventData) return;

  const type = notificationType || "event";
  const payload = {
    profileKey: userProfileKey,
    notificationType: type,
    eventData: {
      id: String(eventData.id || ""),
      title: String(eventData.title || "").trim(),
      text: String(eventData.text || eventData.note || "").trim(),
      note: String(eventData.note || eventData.text || "").trim(),
      date: String(eventData.date || dateKey || ""),
      eventDateTime: String(eventData.eventDateTime || ""),
      color: String(eventData.color || EVENT_COLOR_DEFAULT),
      createdAt: Number(eventData.createdAt || Date.now()),
      // Dữ liệu bổ sung cho cashflow
      cashflowType: String(eventData.cashflowType || ""),
      category: String(eventData.category || ""),
      amount: Number(eventData.amount || 0),
      image: String(eventData.image || ""),
      // Dữ liệu bổ sung cho fund allocation
      fundName: String(eventData.fundName || "")
    },
    dateKey: String(dateKey || ""),
    senderSessionId: getOrCreateTabSessionId(),
    senderDeviceId: getOrCreateDeviceId(),
    timestamp: Date.now()
  };

  // 1. Ghi vào Realtime Database Queue (đồng bộ tức thì các tab / app đang mở)
  if (firebaseDb) {
    try {
      const queueRef = firebaseDb.ref(`${FIREBASE_EVENT_NOTIFICATION_QUEUE_PATH}/${userProfileKey}`).push();
      await queueRef.set(payload);
      console.log(`[NotificationQueue] Đã ghi ${type} vào RTDB queue:`, dateKey);
    } catch (err) {
      console.warn("[NotificationQueue] Lỗi ghi RTDB queue:", err);
    }
  }

  // 2. Lưu vào Lịch sử thông báo (để người dùng xem lại ở quả chuông)
  let notifTitle = "";
  const bodyParts = [];

  if (type === "cashflow") {
    const isExpense = payload.eventData.cashflowType === "expense";
    notifTitle = isExpense ? "💸 Chi tiêu mới" : "💰 Thu nhập mới";
    if (payload.eventData.amount) {
      bodyParts.push(`${Number(payload.eventData.amount).toLocaleString("vi-VN")} đ`);
    }
    if (payload.eventData.category) {
      bodyParts.push(payload.eventData.category);
    }
    if (dateKey) bodyParts.push(`Ngày ${dateKey}`);
    const cleanText = String(payload.eventData.text || payload.eventData.note || "").replace(/^undefined$/i, "").trim();
    if (cleanText) bodyParts.push(cleanText);
  } else if (type === "funds" || type === "fund_allocation") {
    notifTitle = `📊 Phân bổ quỹ: ${payload.eventData.fundName || "Quỹ"}`;
    if (payload.eventData.amount) {
      bodyParts.push(`${Number(payload.eventData.amount).toLocaleString("vi-VN")} đ`);
    }
    if (dateKey) bodyParts.push(`Ngày ${dateKey}`);
    const cleanText = String(payload.eventData.text || payload.eventData.note || "").replace(/^undefined$/i, "").trim();
    if (cleanText) bodyParts.push(cleanText);
  } else {
    notifTitle = payload.eventData.title ? `🔔 ${payload.eventData.title}` : "🔔 Sự kiện mới";
    if (dateKey) bodyParts.push(`Ngày ${dateKey}`);
    if (payload.eventData.eventDateTime) {
      try {
        const dt = new Date(payload.eventData.eventDateTime);
        if (!Number.isNaN(dt.getTime())) {
          bodyParts.push(`Lúc ${dt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`);
        }
      } catch { }
    }
    const cleanText = String(payload.eventData.text || payload.eventData.note || "").replace(/^undefined$/i, "").trim();
    if (cleanText) bodyParts.push(cleanText);
  }

  const notifBody = bodyParts.join(" | ") || "";
  saveNotificationToHistory(type, notifTitle, notifBody, dateKey, payload.eventData);

  // 3. Gọi Serverless Endpoint /api/send-push.js (gửi FCM đánh thức các thiết bị đang đóng app)
  try {
    fetch("/api/send-push.js", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then((res) => res.json())
      .then((data) => {
        console.log("[FCM Push API] Kết quả:", data);
      })
      .catch((apiErr) => {
        console.log("[FCM Push API] API push ngầm:", apiErr.message);
      });
  } catch (e) { }
}

/* ==================== NOTIFICATION HISTORY & LISTENER ==================== */

const _recentHistoryNotifKeys = new Set();

/**
 * Lưu lịch sử thông báo vào Firebase Realtime Database
 */
async function saveNotificationToHistory(notificationType, title, body, dateKey, eventData) {
  if (!firebaseDb || !userProfileKey) return;

  const cleanTitle = sanitizeString(title) || (eventData ? sanitizeString(eventData.title) : "");
  const cleanBody = sanitizeString(body);
  const cleanDateKey = sanitizeString(dateKey || eventData?.date);

  const eventIdStr = eventData?.id || `${notificationType}-${cleanTitle}-${cleanDateKey}`;
  if (_recentHistoryNotifKeys.has(eventIdStr)) {
    console.log("[NotificationHistory] Bỏ qua lưu thông báo trùng lặp:", eventIdStr);
    return;
  }
  _recentHistoryNotifKeys.add(eventIdStr);
  setTimeout(() => _recentHistoryNotifKeys.delete(eventIdStr), 15000);

  try {
    const type = notificationType || "event";
    let defaultTitle = cleanTitle;
    if (!defaultTitle) {
      if (type === "cashflow") defaultTitle = "Giao dịch thu chi mới";
      else if (type === "funds" || type === "fund_allocation") defaultTitle = "Phân bổ quỹ mới";
      else if (type === "reminder") defaultTitle = "Nhắc nhở sự kiện";
      else defaultTitle = "Sự kiện lịch mới";
    }

    const notifRef = firebaseDb.ref(`${FIREBASE_USER_NOTIFICATIONS_PATH}/${userProfileKey}`).push();
    const payload = {
      id: notifRef.key,
      notificationType: type,
      title: defaultTitle,
      body: cleanBody,
      dateKey: cleanDateKey,
      eventData: eventData ? JSON.parse(JSON.stringify(eventData)) : null,
      createdAt: Date.now(),
      read: false
    };

    await notifRef.set(payload);
    console.log("[NotificationHistory] Đã lưu thông báo vào lịch sử:", payload.id);
  } catch (err) {
    console.warn("[NotificationHistory] Lỗi lưu lịch sử thông báo:", err);
  }
}
window.saveNotificationToHistory = saveNotificationToHistory;

/**
 * Thiết lập listener Realtime lắng nghe danh sách lịch sử thông báo
 */
let firebaseEventRemindersRef = null;
let eventRemindersCache = [];
let combinedNotificationsList = [];
let readNotificationIds = new Set();
try {
  readNotificationIds = new Set(JSON.parse(localStorage.getItem("readNotificationIds") || "[]"));
} catch (e) { }

function markNotificationIdAsReadLocal(id) {
  if (!id) return;
  readNotificationIds.add(id);
  try {
    localStorage.setItem("readNotificationIds", JSON.stringify(Array.from(readNotificationIds)));
  } catch (e) { }
}

function sanitizeString(val) {
  if (!val) return "";
  if (typeof val === "object" && typeof val.then === "function") {
    return "";
  }
  const str = String(val).trim();
  if (
    str === "[object Promise]" ||
    str.includes("Promise {<pending>}") ||
    str.toLowerCase() === "undefined" ||
    str.toLowerCase() === "null"
  ) {
    return "";
  }
  return str;
}

function syncCombinedNotifications() {
  const map = new Map();

  // 1. Chỉ thêm các bản ghi từ eventReminders đã ĐƯỢC GỬI (delivered === true)
  eventRemindersCache.forEach((rem) => {
    if (!rem.delivered) return;
    const id = `rem_${rem.id}`;
    const cleanTitle = sanitizeString(rem.eventTitle) || "Nhắc nhở sự kiện";
    const cleanBody = sanitizeString(rem.eventText);
    map.set(id, {
      id: id,
      notificationType: "reminder",
      title: `⏰ Nhắc nhở: ${cleanTitle}`,
      body: cleanBody || (rem.eventDateTime ? `Lúc ${new Date(rem.eventDateTime).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}` : ""),
      dateKey: sanitizeString(rem.dateKey),
      eventData: {
        id: rem.eventId,
        title: cleanTitle,
        text: cleanBody,
        note: cleanBody,
        eventDateTime: rem.eventDateTime,
        color: rem.eventColor,
        date: rem.dateKey
      },
      createdAt: Number(rem.reminderAtMs || rem.createdAt || Date.now()),
      read: readNotificationIds.has(id)
    });
  });

  // 2. Thêm các bản ghi từ userNotifications (thông báo thực tế đã đẩy)
  userNotificationsCache.forEach((item) => {
    let cleanTitle = sanitizeString(item.title);
    if (!cleanTitle && item.eventData) {
      cleanTitle = sanitizeString(item.eventData.title);
    }
    if (!cleanTitle) cleanTitle = "Sự kiện mới";

    let cleanBody = sanitizeString(item.body);
    const type = item.notificationType || "event";
    if (type === "cashflow" && item.eventData) {
      const parts = [];
      const amt = item.eventData.amount;
      if (amt) parts.push(`${Number(amt).toLocaleString("vi-VN")} đ`);
      const cat = sanitizeString(item.eventData.category);
      if (cat) parts.push(cat);
      const dk = sanitizeString(item.dateKey || item.eventData.date);
      if (dk) parts.push(`Ngày ${dk}`);
      const noteStr = sanitizeString(item.eventData.text || item.eventData.note);
      if (noteStr) parts.push(noteStr);
      cleanBody = parts.join(" | ");
    } else if ((type === "funds" || type === "fund_allocation") && item.eventData) {
      const parts = [];
      const amt = item.eventData.amount;
      if (amt) parts.push(`${Number(amt).toLocaleString("vi-VN")} đ`);
      const dk = sanitizeString(item.dateKey || item.eventData.date);
      if (dk) parts.push(`Ngày ${dk}`);
      const noteStr = sanitizeString(item.eventData.text || item.eventData.note);
      if (noteStr) parts.push(noteStr);
      cleanBody = parts.join(" | ");
    } else if (!cleanBody && item.eventData) {
      const parts = [];
      const dk = sanitizeString(item.dateKey || item.eventData.date);
      if (dk) parts.push(`Ngày ${dk}`);
      if (item.eventData.eventDateTime) {
        try {
          const dt = new Date(item.eventData.eventDateTime);
          if (!Number.isNaN(dt.getTime())) {
            parts.push(`Lúc ${dt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`);
          }
        } catch { }
      }
      const noteStr = sanitizeString(item.eventData.text || item.eventData.note);
      if (noteStr) parts.push(noteStr);
      cleanBody = parts.join(" | ");
    }

    map.set(item.id, {
      ...item,
      title: cleanTitle.startsWith("🔔") || cleanTitle.startsWith("💸") || cleanTitle.startsWith("📊") || cleanTitle.startsWith("⏰") ? cleanTitle : `🔔 ${cleanTitle}`,
      body: cleanBody,
      read: readNotificationIds.has(item.id) || Boolean(item.read)
    });
  });

  // 3. Deduplicate (Lọc trùng lặp bản ghi có cùng eventId hoặc cùng nội dung/thời gian)
  const uniqueItemsMap = new Map();
  const list = Array.from(map.values());
  list.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));

  list.forEach((item) => {
    const timeGroup = Math.floor(Number(item.createdAt || 0) / 60000);
    const eventId = item.eventData?.id;
    const dedupKey = eventId
      ? `ev_${eventId}`
      : `${item.title}_${item.body}_${item.dateKey}_${timeGroup}`;

    if (!uniqueItemsMap.has(dedupKey)) {
      uniqueItemsMap.set(dedupKey, item);
    }
  });

  combinedNotificationsList = Array.from(uniqueItemsMap.values());

  // Tính số lượng chưa đọc
  const unreadCount = combinedNotificationsList.filter((item) => !item.read).length;
  updateNotificationBadgeUI(unreadCount);

  // Nếu modal đang mở thì re-render
  const modal = document.getElementById("modalNotificationList");
  if (modal && modal.style.display !== "none") {
    renderNotificationList();
  }
}
window.syncCombinedNotifications = syncCombinedNotifications;

let isNotificationsLoading = true;

/**
 * Thiết lập listener Realtime lắng nghe danh sách lịch sử thông báo & nhắc nhở
 */
function setupNotificationHistoryListener() {
  isNotificationsLoading = true;
  const modal = document.getElementById("modalNotificationList");
  if (modal && modal.style.display !== "none") {
    renderNotificationList();
  }

  // Safety fallback: Tự động tắt hiệu ứng loading sau 2.5 giây nếu kết nối mạng chậm
  setTimeout(() => {
    if (isNotificationsLoading) {
      isNotificationsLoading = false;
      if (document.getElementById("modalNotificationList")?.style.display !== "none") {
        renderNotificationList();
      }
    }
  }, 2500);

  if (!firebaseDb || !userProfileKey) {
    isNotificationsLoading = false;
    syncCombinedNotifications();
    return;
  }

  let userNotifLoaded = false;
  let eventRemindersLoaded = false;
  const checkFinishLoading = () => {
    if (userNotifLoaded && eventRemindersLoaded) {
      isNotificationsLoading = false;
    }
  };

  if (firebaseUserNotificationsRef) {
    try { firebaseUserNotificationsRef.off(); } catch (e) { }
  }
  if (firebaseEventRemindersRef) {
    try { firebaseEventRemindersRef.off(); } catch (e) { }
  }

  firebaseUserNotificationsRef = firebaseDb
    .ref(`${FIREBASE_USER_NOTIFICATIONS_PATH}/${userProfileKey}`)
    .orderByChild("createdAt")
    .limitToLast(100);

  firebaseEventRemindersRef = firebaseDb
    .ref(`${FIREBASE_EVENT_REMINDERS_PATH}/${userProfileKey}`)
    .limitToLast(50);

  firebaseUserNotificationsRef.on("value", (snapshot) => {
    userNotifLoaded = true;
    checkFinishLoading();
    const data = snapshot.val() || {};
    userNotificationsCache = Object.keys(data).map((key) => ({
      id: key,
      ...data[key]
    }));
    syncCombinedNotifications();
  }, (err) => {
    userNotifLoaded = true;
    checkFinishLoading();
    syncCombinedNotifications();
  });

  firebaseEventRemindersRef.on("value", (snapshot) => {
    eventRemindersLoaded = true;
    checkFinishLoading();
    const data = snapshot.val() || {};
    eventRemindersCache = Object.keys(data).map((key) => ({
      id: key,
      ...data[key]
    }));
    syncCombinedNotifications();
  }, (err) => {
    eventRemindersLoaded = true;
    checkFinishLoading();
    syncCombinedNotifications();
  });
}
window.setupNotificationHistoryListener = setupNotificationHistoryListener;

function updateNotificationBadgeUI(unreadCount) {
  const badgeEl = document.getElementById("notificationBadge");
  if (!badgeEl) return;

  if (unreadCount > 0) {
    badgeEl.textContent = unreadCount > 99 ? "99+" : unreadCount;
    badgeEl.style.display = "inline-flex";
  } else {
    badgeEl.style.display = "none";
  }
}

function openNotificationModal() {
  const modal = document.getElementById("modalNotificationList");
  if (!modal) return;
  closeAllModals();
  modal.style.display = "flex";
  renderNotificationList();
}
window.openNotificationModal = openNotificationModal;

function closeNotificationModal() {
  const modal = document.getElementById("modalNotificationList");
  if (modal) modal.style.display = "none";
}
window.closeNotificationModal = closeNotificationModal;

function filterNotifications(filterMode, tabBtn) {
  notificationFilterMode = filterMode;
  const tabs = document.querySelectorAll(".notif-tab");
  tabs.forEach((tab) => tab.classList.remove("active"));
  if (tabBtn) tabBtn.classList.add("active");
  renderNotificationList();
}
window.filterNotifications = filterNotifications;

function renderNotificationList() {
  const bodyEl = document.getElementById("notificationListBody");
  if (!bodyEl) return;

  if (isNotificationsLoading) {
    bodyEl.innerHTML = `
      <div class="notification-skeleton-container">
        <div class="notification-skeleton-item">
          <div class="skeleton-icon"></div>
          <div class="skeleton-content">
            <div class="skeleton-line short"></div>
            <div class="skeleton-line long"></div>
            <div class="skeleton-line time"></div>
          </div>
        </div>
        <div class="notification-skeleton-item">
          <div class="skeleton-icon"></div>
          <div class="skeleton-content">
            <div class="skeleton-line short"></div>
            <div class="skeleton-line long"></div>
            <div class="skeleton-line time"></div>
          </div>
        </div>
        <div class="notification-skeleton-item">
          <div class="skeleton-icon"></div>
          <div class="skeleton-content">
            <div class="skeleton-line short"></div>
            <div class="skeleton-line long"></div>
            <div class="skeleton-line time"></div>
          </div>
        </div>
      </div>
    `;
    return;
  }

  let items = combinedNotificationsList.length > 0 ? [...combinedNotificationsList] : [...userNotificationsCache];
  if (notificationFilterMode === "unread") {
    items = items.filter((item) => !item.read);
  }

  if (items.length === 0) {
    bodyEl.innerHTML = `
      <div class="notification-empty-state">
        <div class="notification-empty-icon">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
        </div>
        <div class="notification-empty-text">${notificationFilterMode === "unread" ? "Không có thông báo chưa đọc" : "Chưa có thông báo nào"}</div>
      </div>
    `;
    return;
  }

  let html = "";
  items.forEach((item, index) => {
    const isUnread = !item.read;
    const type = item.notificationType || "event";

    let iconText = "📅";
    let iconClass = "event";
    let typeLabel = "Sự kiện";
    if (type === "cashflow") {
      iconText = "💸";
      iconClass = "cashflow";
      typeLabel = "Thu chi";
    } else if (type === "funds" || type === "fund_allocation") {
      iconText = "🏦";
      iconClass = "funds";
      typeLabel = "Quỹ";
    } else if (type === "reminder") {
      iconText = "⏰";
      iconClass = "reminder";
      typeLabel = "Nhắc nhở";
    }

    const title = escapeHtml(item.title || "Thông báo");
    const body = escapeHtml(item.body || "");
    const timeStr = formatRelativeTime(item.createdAt);
    const delayStyle = `animation-delay: ${Math.min(index * 0.04, 0.3)}s;`;

    html += `
      <div class="notification-item type-${iconClass} ${isUnread ? "unread" : ""}" style="${delayStyle}" onclick="handleNotificationItemClick('${item.id}')">
        <div class="notif-item-icon ${iconClass}">${iconText}</div>
        <div class="notif-item-content">
          <div class="notif-item-title">
            <span>${title}</span>
            <span class="notif-badge ${iconClass}">${typeLabel}</span>
          </div>
          <div class="notif-item-body">${body}</div>
          <div class="notif-item-time">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span>${timeStr}</span>
          </div>
        </div>
        <button type="button" class="notif-item-delete" title="Xóa thông báo" onclick="deleteNotificationItem('${item.id}', event)">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    `;
  });

  bodyEl.innerHTML = html;
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return "";
  const now = Date.now();
  const diff = now - Number(timestamp);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "Vừa xong";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày trước`;

  const d = new Date(timestamp);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

async function handleNotificationItemClick(notifId) {
  const item = combinedNotificationsList.find((i) => i.id === notifId) || userNotificationsCache.find((i) => i.id === notifId);
  if (!item) return;

  if (!item.read) {
    item.read = true;
    markNotificationIdAsReadLocal(notifId);
    markNotificationAsRead(notifId);
  }

  closeNotificationModal();

  handleNotificationNavigation(
    item.notificationType,
    item.dateKey,
    item.eventData
  );
}
window.handleNotificationItemClick = handleNotificationItemClick;

async function markNotificationAsRead(notifId) {
  markNotificationIdAsReadLocal(notifId);
  if (!firebaseDb || !userProfileKey || !notifId) return;
  try {
    if (notifId.startsWith("rem_")) {
      const remId = notifId.replace("rem_", "");
      await firebaseDb.ref(`${FIREBASE_EVENT_REMINDERS_PATH}/${userProfileKey}/${remId}`).update({ delivered: true });
    } else {
      await firebaseDb.ref(`${FIREBASE_USER_NOTIFICATIONS_PATH}/${userProfileKey}/${notifId}`).update({ read: true });
    }
  } catch (e) {
    console.warn("[NotificationHistory] Lỗi đánh dấu đã đọc:", e);
  }
}
window.markNotificationAsRead = markNotificationAsRead;

async function markAllNotificationsAsRead() {
  const unreadItems = combinedNotificationsList.filter((i) => !i.read);
  if (unreadItems.length === 0) return;

  unreadItems.forEach((i) => {
    i.read = true;
    markNotificationIdAsReadLocal(i.id);
  });

  if (!firebaseDb || !userProfileKey) {
    updateNotificationBadgeUI(0);
    return;
  }

  try {
    const updates = {};
    unreadItems.forEach((i) => {
      if (i.id.startsWith("rem_")) {
        const remId = i.id.replace("rem_", "");
        updates[`${FIREBASE_EVENT_REMINDERS_PATH}/${userProfileKey}/${remId}/delivered`] = true;
      } else if (!i.id.startsWith("ev_") && !i.id.startsWith("cf_")) {
        updates[`${FIREBASE_USER_NOTIFICATIONS_PATH}/${userProfileKey}/${i.id}/read`] = true;
      }
    });
    if (Object.keys(updates).length > 0) {
      await firebaseDb.ref().update(updates);
    }
    updateNotificationBadgeUI(0);
  } catch (e) {
    console.warn("[NotificationHistory] Lỗi đánh dấu tất cả đã đọc:", e);
  }
}
window.markAllNotificationsAsRead = markAllNotificationsAsRead;

async function deleteNotificationItem(notifId, event) {
  if (event) event.stopPropagation();
  if (!firebaseDb || !userProfileKey || !notifId) return;
  try {
    if (notifId.startsWith("rem_")) {
      const remId = notifId.replace("rem_", "");
      await firebaseDb.ref(`${FIREBASE_EVENT_REMINDERS_PATH}/${userProfileKey}/${remId}`).remove();
    } else {
      await firebaseDb.ref(`${FIREBASE_USER_NOTIFICATIONS_PATH}/${userProfileKey}/${notifId}`).remove();
    }
  } catch (e) {
    console.warn("[NotificationHistory] Lỗi xóa thông báo:", e);
  }
}
window.deleteNotificationItem = deleteNotificationItem;

async function clearAllNotifications() {
  if (!firebaseDb || !userProfileKey) return;
  if (combinedNotificationsList.length === 0 && userNotificationsCache.length === 0) return;

  showConfirmPopup(
    "Xóa tất cả thông báo",
    "Bạn có chắc chắn muốn xóa toàn bộ lịch sử thông báo không?",
    "Xóa tất cả",
    async () => {
      try {
        await firebaseDb.ref(`${FIREBASE_USER_NOTIFICATIONS_PATH}/${userProfileKey}`).remove();
        await firebaseDb.ref(`${FIREBASE_EVENT_REMINDERS_PATH}/${userProfileKey}`).remove();
      } catch (e) {
        console.warn("[NotificationHistory] Lỗi dọn lịch sử thông báo:", e);
      }
    },
    undefined,
    { type: "danger", icon: "🗑️", btnType: "danger" }
  );
}
window.clearAllNotifications = clearAllNotifications;

/* ==================== EVENT REMINDER (60 phút trước sự kiện) ==================== */

/**
 * Lên lịch nhắc nhở 60 phút trước sự kiện.
 * Ghi vào Firebase RTDB node eventReminders/{profileKey}/{reminderId}
 * Cloud Function checkEventReminders sẽ quét và gửi push khi đến hạn.
 */
async function scheduleEventReminder(eventData, dateKey) {
  if (!userProfileKey || !firebaseDb || !eventData) return;
  if (!eventData.eventDateTime) return; // Không có giờ sự kiện thì không nhắc

  try {
    const eventTime = new Date(eventData.eventDateTime).getTime();
    if (Number.isNaN(eventTime)) return;

    const REMINDER_BEFORE_MS = 60 * 60 * 1000; // 60 phút
    const reminderAtMs = eventTime - REMINDER_BEFORE_MS;

    // Không tạo reminder nếu thời gian nhắc đã qua hoặc sự kiện trong quá khứ
    if (reminderAtMs <= Date.now()) {
      console.log("[Reminder] Bỏ qua - thời gian nhắc đã qua:", eventData.title);
      return;
    }

    const reminderData = {
      eventId: String(eventData.id || ""),
      profileKey: userProfileKey,
      eventTitle: String(eventData.title || "").trim(),
      eventText: String(eventData.text || eventData.note || "").trim(),
      eventDateTime: String(eventData.eventDateTime || ""),
      eventColor: String(eventData.color || ""),
      dateKey: String(dateKey || ""),
      reminderAtMs: reminderAtMs,
      createdAt: Date.now(),
      delivered: false
    };

    const reminderRef = firebaseDb
      .ref(`${FIREBASE_EVENT_REMINDERS_PATH}/${userProfileKey}`)
      .push();
    await reminderRef.set(reminderData);

    console.log(
      `[Reminder] Đã lên lịch nhắc nhở cho "${eventData.title}" lúc`,
      new Date(reminderAtMs).toLocaleString("vi-VN")
    );
  } catch (err) {
    console.warn("[Reminder] Lỗi lên lịch nhắc nhở:", err);
  }
}

/**
 * Huỷ nhắc nhở khi xoá sự kiện.
 * Tìm và xoá tất cả reminder có eventId tương ứng.
 */
async function cancelEventReminder(eventId) {
  if (!userProfileKey || !firebaseDb || !eventId) return;

  try {
    const remindersRef = firebaseDb.ref(
      `${FIREBASE_EVENT_REMINDERS_PATH}/${userProfileKey}`
    );
    const snap = await remindersRef.get();
    const reminders = snap.val();
    if (!reminders) return;

    const deletePromises = [];
    for (const [reminderId, reminder] of Object.entries(reminders)) {
      if (reminder && reminder.eventId === eventId) {
        deletePromises.push(remindersRef.child(reminderId).remove());
      }
    }

    if (deletePromises.length > 0) {
      await Promise.all(deletePromises);
      console.log(`[Reminder] Đã huỷ ${deletePromises.length} nhắc nhở cho event: ${eventId}`);
    }
  } catch (err) {
    console.warn("[Reminder] Lỗi huỷ nhắc nhở:", err);
  }
}

/**
 * Kiểm tra tham số URL (?date=YYYY-M-D hoặc ?action=cashflow|funds) để tự động mở chi tiết khi click từ thông báo
 */
function checkUrlParamsForDateNavigation() {
  try {
    const params = new URLSearchParams(window.location.search);
    const dateParam = params.get("date");
    const actionParam = params.get("action");
    const idParam = params.get("id");
    const amountParam = params.get("amount");
    const categoryParam = params.get("category");
    const cashflowTypeParam = params.get("cashflowType");
    const noteParam = params.get("note");
    const titleParam = params.get("title");
    const textParam = params.get("text");
    const eventDateTimeParam = params.get("eventDateTime");
    const colorParam = params.get("color");
    const createdAtParam = params.get("createdAt");

    if (!dateParam && !actionParam && !idParam && !titleParam && !textParam) return;

    let eventData = null;
    if (idParam || amountParam || categoryParam || cashflowTypeParam || noteParam || titleParam || textParam || eventDateTimeParam || colorParam || createdAtParam) {
      eventData = {
        id: idParam || "",
        amount: Number(amountParam || 0),
        category: categoryParam || "",
        cashflowType: cashflowTypeParam || "",
        text: textParam || noteParam || "",
        note: noteParam || textParam || "",
        title: titleParam || "",
        eventDateTime: eventDateTimeParam || "",
        color: colorParam || "",
        createdAt: Number(createdAtParam) || Date.now(),
        date: dateParam || ""
      };
      if (eventData.id) {
        _recentlyNotifiedIds.set(eventData.id, Date.now());
      }
    }

    const executeNav = () => {
      handleNotificationNavigation(actionParam, dateParam, eventData, window.location.href);
      try {
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (e) { }
    };

    // Đợi một chút để toàn bộ UI và dữ liệu calendar/cashflow được nạp xong
    setTimeout(executeNav, 450);
  } catch (e) {
    console.warn("[UrlNav] Lỗi kiểm tra URL params:", e);
  }
}
window.checkUrlParamsForDateNavigation = checkUrlParamsForDateNavigation;

window.toggleDeviceNotificationPermission = toggleDeviceNotificationPermission;
window.sendTestPushNotification = sendTestPushNotification;

/* ========================== MO-ĐAL ========================== */

/* ========================== EVENT COLOR HELPERS ========================== */
const EVENT_COLOR_DEFAULT = "#3b82f6";

function setEventModalColor(hex) {
  const color = hex || EVENT_COLOR_DEFAULT;
  const hiddenInput = document.getElementById("newEventColor");
  const colorPicker = document.getElementById("newEventColorPicker");
  if (hiddenInput) hiddenInput.value = color;
  if (colorPicker) colorPicker.value = color;

  const swatches = document.querySelectorAll("#eventColorPalette .event-color-swatch");
  let matchedSwatch = false;
  swatches.forEach((swatch) => {
    if (
      swatch.dataset.color &&
      swatch.dataset.color.toLowerCase() === color.toLowerCase()
    ) {
      swatch.classList.add("active");
      matchedSwatch = true;
    } else {
      swatch.classList.remove("active");
    }
  });

  const customBtn = document.querySelector(".event-custom-color-btn");
  if (customBtn) {
    if (!matchedSwatch) {
      customBtn.style.borderColor = color;
      customBtn.style.boxShadow = `0 0 10px ${color}`;
    } else {
      customBtn.style.borderColor = "";
      customBtn.style.boxShadow = "";
    }
  }
}

function onCustomEventColorChange(hex) {
  setEventModalColor(hex);
}

function initEventColorPalette() {
  const palette = document.getElementById("eventColorPalette");
  if (!palette) return;
  if (palette._colorPaletteInited) return;
  palette._colorPaletteInited = true;
  palette.addEventListener("click", (e) => {
    const swatch = e.target.closest(".event-color-swatch");
    if (swatch && swatch.dataset.color) {
      setEventModalColor(swatch.dataset.color);
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initEventColorPalette);
} else {
  initEventColorPalette();
}

function openAddEventModalFromDayDetails() {
  if (!selectedKey) return;
  const [y, m, d] = selectedKey.split("-").map(Number);
  openAddEventModal(selectedKey, d, m, y);
}

function openEditEventModal(eventIndex) {
  closeAllModals();
  if (!selectedKey) return;

  const data = getDateData(selectedKey);
  const event = data.events[eventIndex];
  if (!event) return;

  selectedEventIndex = eventIndex;

  const [y, m, d] = selectedKey.split("-").map(Number);
  document.getElementById("addEventDate").innerText = `${d}/${m}/${y}`;
  document.getElementById("newEventTitle").value = String(event.title || "");
  document.getElementById("newEventText").value = String(event.text || "");
  document.getElementById("newEventDateTime").value = toDatetimeLocalValue(
    event.eventDateTime,
  );
  setEventModalColor(event.color || EVENT_COLOR_DEFAULT);
  document.getElementById("addEventModalTitle").innerText = "Chỉnh sửa sự kiện";
  document.getElementById("saveEventBtn").innerText = "Cập nhật";

  document.getElementById("addEventModal").style.display = "flex";
}

function toggleDayHoliday() {
  if (!selectedKey) return;
  const data = getDateData(selectedKey);
  const checkbox = document.getElementById("dayIsHoliday");
  if (!checkbox) return;

  data.isHoliday = checkbox.checked;
  saveDateData(selectedKey, data);
  loadCalendarOnDemand();
  renderCalendar();
}

// Day Details Modal - shows events list and overtime editor
function renderDayDetailsModalUI(dateKey, d, m, y, data) {
  const dateEl = document.getElementById("dayDetailsDate");
  if (dateEl) dateEl.innerText = `${d}/${m}/${y}`;
  const otEl = document.getElementById("dayOvertimeHours");
  if (otEl) otEl.value = data.overtimeHours || 0;

  const holidayCheckbox = document.getElementById("dayIsHoliday");
  if (holidayCheckbox) {
    holidayCheckbox.checked = !!data.isHoliday;
  }

  // Render events list
  const eventsList = document.getElementById("dayEventsList");
  if (!eventsList) return;
  eventsList.innerHTML = "";

  // Toggle header "+ Thêm" button depending on whether events exist
  const headerAddBtn = document.querySelector("#dayDetailsModal .btn-add-event");

  if (!data.events || data.events.length === 0) {
    if (headerAddBtn) headerAddBtn.style.display = "none";
    eventsList.innerHTML = `
      <div class="empty-events-state">
        <div class="empty-events-text">Chưa có sự kiện nào cho ngày này</div>
        <button type="button" class="empty-events-add-btn" onclick="openAddEventModalFromDayDetails()" title="Thêm sự kiện mới" aria-label="Thêm sự kiện mới">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 2v4M16 2v4"></path>
            <rect x="3" y="4" width="18" height="18" rx="3"></rect>
            <path d="M3 10h18"></path>
            <path d="M12 14v4M10 16h4"></path>
          </svg>
        </button>
      </div>
    `;
  } else {
    if (headerAddBtn) headerAddBtn.style.display = "";
    data.events.forEach((event, idx) => {
      const eventDiv = document.createElement("div");
      eventDiv.className = "event-item";
      eventDiv.style.cursor = "pointer";
      const evColor = escapeHtml(event.color || EVENT_COLOR_DEFAULT);
      eventDiv.style.setProperty("--event-color", evColor);
      eventDiv.style.borderLeftColor = evColor;
      const timeStr = event.eventDateTime
        ? new Date(event.eventDateTime).toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        })
        : "--:--";
      eventDiv.innerHTML = `
        <div class="event-time" style="color: ${evColor};">${timeStr}</div>
        <div class="event-content">
          <div class="event-title">${escapeHtml(event.title || "(Không có tiêu đề)")}</div>
          ${event.text ? `<div class="event-text">${escapeHtml(event.text)}</div>` : ""}
        </div>
        <div class="event-actions">
          <button class="event-edit" onclick="event.stopPropagation(); openEditEventModal(${idx})" title="Sửa" aria-label="Sửa sự kiện">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Zm17.71-10.04a1.003 1.003 0 0 0 0-1.42l-2.5-2.5a1.003 1.003 0 0 0-1.42 0l-1.96 1.96 3.75 3.75 2.13-2.09Z" />
            </svg>
          </button>
          <button class="event-delete" onclick="event.stopPropagation(); deleteEventFromDateUI(${idx})" title="Xóa">×</button>
        </div>
      `;
      // Click vào thẻ sự kiện để mở xem chi tiết sự kiện
      eventDiv.onclick = (e) => {
        if (e.target.closest(".event-actions")) return;
        openEventQuickViewModal(event, dateKey, idx);
      };
      eventsList.appendChild(eventDiv);
    });
  }
}

async function openDayDetailsModal(dateKey, d, m, y) {
  closeAllModals();
  selectedKey = dateKey;
  const data = getDateData(dateKey);

  renderDayDetailsModalUI(dateKey, d, m, y, data);
  document.getElementById("dayDetailsModal").style.display = "flex";

  // Nếu đã đăng nhập Firebase, tự động fetch dữ liệu mới nhất từ server cho ngày này nếu cache đang trống hoặc cần đồng bộ
  if (firebaseDb && userProfileKey) {
    try {
      const snap = await firebaseDb.ref(`${FIREBASE_EVENTS_PATH}/${userProfileKey}/dates/${dateKey}`).once("value");
      const remote = snap.val();
      if (remote && isDateRecordTrusted(remote)) {
        dateDataCache[dateKey] = normalizeDateData(remote);
        localStorage.setItem(
          dateKey,
          JSON.stringify({
            __type: "date_data",
            events: dateDataCache[dateKey].events,
            overtimeHours: dateDataCache[dateKey].overtimeHours,
            cashflowEntries: dateDataCache[dateKey].cashflowEntries,
            updatedAt: Date.now(),
          })
        );
        if (selectedKey === dateKey && document.getElementById("dayDetailsModal") && document.getElementById("dayDetailsModal").style.display === "flex") {
          renderDayDetailsModalUI(dateKey, d, m, y, dateDataCache[dateKey]);
        }
      }
    } catch (e) {
      console.warn("[DayDetails] Lỗi fetch Firebase ngày:", dateKey, e);
    }
  }
}

function closeDayDetailsModal() {
  document.getElementById("dayDetailsModal").style.display = "none";
}

/* ========================== EVENT QUICKVIEW MODAL ========================== */
let currentQuickViewEvent = null;
let currentQuickViewDateKey = "";
let currentQuickViewIndex = -1;

function openEventQuickViewModal(eventObj, dateKey, eventIndex = -1) {
  if (!eventObj) return;
  currentQuickViewEvent = eventObj;
  currentQuickViewDateKey = dateKey || selectedKey || getTodayIsoDate();
  currentQuickViewIndex = eventIndex;

  renderEventQuickView(eventObj, currentQuickViewDateKey, eventIndex);

  const modal = document.getElementById("eventQuickViewModal");
  if (modal) {
    modal.style.display = "flex";
  }
}
window.openEventQuickViewModal = openEventQuickViewModal;

function openEventQuickViewModalByIndex(idx) {
  if (!selectedKey) return;
  const data = getDateData(selectedKey);
  if (data.events && data.events[idx]) {
    openEventQuickViewModal(data.events[idx], selectedKey, idx);
  }
}
window.openEventQuickViewModalByIndex = openEventQuickViewModalByIndex;

function closeEventQuickViewModal() {
  const modal = document.getElementById("eventQuickViewModal");
  if (modal) modal.style.display = "none";
  currentQuickViewEvent = null;
}
window.closeEventQuickViewModal = closeEventQuickViewModal;

(function initEventQuickViewModal() {
  const modal = document.getElementById("eventQuickViewModal");
  if (modal) {
    modal.addEventListener("click", function (e) {
      if (e.target === this) closeEventQuickViewModal();
    });
  }
})();

function renderEventQuickView(eventObj, dateKey, eventIndex) {
  const quickViewEl = document.getElementById("eventQuickView");
  if (!quickViewEl || !eventObj) return;

  const color = eventObj.color || EVENT_COLOR_DEFAULT;
  const title = eventObj.title || "(Không có tiêu đề)";
  const note = eventObj.text || "Không có ghi chú thêm";

  let timeStr = "Cả ngày";
  let timeDetail = "--:--";
  if (eventObj.eventDateTime) {
    try {
      const dt = new Date(eventObj.eventDateTime);
      if (!Number.isNaN(dt.getTime())) {
        timeStr = dt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
        timeDetail = dt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      }
    } catch (e) { }
  }

  const dKey = dateKey || selectedKey || getTodayIsoDate();
  const parts = (dKey || "").split("-").map(Number);
  const formattedDate = parts.length === 3
    ? `${String(parts[2]).padStart(2, "0")}/${String(parts[1]).padStart(2, "0")}/${parts[0]}`
    : (formatCashflowDate(dKey) || dKey);

  const createdLabel = eventObj.createdAt
    ? (typeof formatTimestampForCsv === "function" ? formatTimestampForCsv(eventObj.createdAt) : new Date(eventObj.createdAt).toLocaleString("vi-VN"))
    : "Chưa rõ";

  let effectiveIndex = eventIndex;
  if (effectiveIndex < 0 && dKey) {
    const evList = getEventsForDate(dKey);
    effectiveIndex = evList.findIndex(
      (ev) => (ev.id && eventObj.id && ev.id === eventObj.id) ||
        (ev.title === eventObj.title && (ev.eventDateTime === eventObj.eventDateTime || ev.createdAt === eventObj.createdAt))
    );
  }

  quickViewEl.innerHTML = `
    <div class="cashflow-quickview-head">
      <div>
        <div class="cashflow-quickview-eyebrow">Xem nhanh sự kiện</div>
        <div class="cashflow-quickview-title" style="border-left: 3px solid ${escapeHtml(color)}; padding-left: 8px;">
          ${escapeHtml(title)}
        </div>
      </div>
      <div class="cashflow-quickview-amount" style="color: ${escapeHtml(color)}; font-size: 14px;">
        ⏰ ${timeStr}
      </div>
    </div>
    <div class="cashflow-quickview-note">${escapeHtml(note)}</div>
    <div class="cashflow-quickview-grid">
      <div class="cashflow-quickview-item">
        <span class="cashflow-quickview-label">Ngày sự kiện</span>
        <strong>${formattedDate}</strong>
      </div>
      <div class="cashflow-quickview-item">
        <span class="cashflow-quickview-label">Thời gian</span>
        <strong>${timeDetail !== "--:--" ? timeDetail : timeStr}</strong>
      </div>
      <div class="cashflow-quickview-item cashflow-quickview-item-full">
        <span class="cashflow-quickview-label">Tạo lúc</span>
        <strong>${createdLabel}</strong>
      </div>
    </div>
    ${effectiveIndex >= 0 ? `
      <div class="cashflow-quickview-actions" style="display: flex; gap: 10px; margin-top: 18px; justify-content: flex-end; align-items: center; flex-wrap: wrap;">
        <button type="button" class="cashflow-quickview-btn-delete" style="display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 8px 16px; font-size: 13px; font-weight: 600; color: #ffffff !important; background: linear-gradient(135deg, #ef4444, #dc2626); border: 1px solid rgba(252, 165, 165, 0.35); border-radius: 10px; box-shadow: 0 4px 14px rgba(220, 38, 38, 0.3); cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);" onclick="deleteEventFromQuickView('${dKey}', ${effectiveIndex});">
          🗑️ Xóa sự kiện
        </button>
        <button type="button" class="cashflow-quickview-btn-primary" style="display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 8px 16px; font-size: 13px; font-weight: 600; color: #ffffff !important; background: linear-gradient(135deg, #3b82f6, #2563eb); border: 1px solid rgba(147, 197, 253, 0.35); border-radius: 10px; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.3); cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);" onclick="selectedKey='${dKey}'; closeEventQuickViewModal(); openEditEventModal(${effectiveIndex});">
          ✏️ Chỉnh sửa
        </button>
      </div>
    ` : ""}
  `;
}

function deleteEventFromQuickView(dateKey, eventIndex) {
  const dKey = dateKey || selectedKey;
  showConfirmPopup(
    "Xóa sự kiện",
    "Bạn có chắc chắn muốn xóa sự kiện này không?",
    "Xóa",
    () => {
      deleteEventFromDate(dKey, eventIndex);
      closeEventQuickViewModal();
      loadCalendarOnDemand();
      renderCalendar();
      renderTodayEvents();
      renderOvertime();
      renderOvertimeSalary();
    }
  );
}
window.deleteEventFromQuickView = deleteEventFromQuickView;

function saveDayOvertime() {
  const hours =
    parseInt(document.getElementById("dayOvertimeHours").value, 10) || 0;
  updateOvertimeForDate(selectedKey, Math.max(0, hours));
  renderOvertime();
  renderOvertimeSalary();
}

function deleteEventFromDateUI(eventIndex) {
  showConfirmPopup(
    "Xóa sự kiện",
    "Bạn có chắc chắn muốn xóa sự kiện này không?",
    "Xóa",
    () => {
      deleteEventFromDate(selectedKey, eventIndex);
      loadCalendarOnDemand();
      renderCalendar();
      renderTodayEvents();
      const [y, m, d] = selectedKey.split("-").map(Number);
      openDayDetailsModal(selectedKey, d, m, y);
    }
  );
}

// Add Event Modal - for creating new event
function openAddEventModal(dateKey, d, m, y) {
  closeAllModals();
  selectedKey = dateKey;
  selectedEventIndex = -1;

  document.getElementById("addEventDate").innerText = `${d}/${m}/${y}`;
  document.getElementById("newEventTitle").value = "";
  document.getElementById("newEventText").value = "";
  document.getElementById("newEventDateTime").value = toDatetimeLocalValue(
    new Date(
      `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T09:00`,
    ),
  );
  setEventModalColor(EVENT_COLOR_DEFAULT);
  document.getElementById("addEventModalTitle").innerText = "Thêm sự kiện";
  document.getElementById("saveEventBtn").innerText = "Lưu";

  document.getElementById("addEventModal").style.display = "flex";
}

function closeAddEventModal() {
  document.getElementById("addEventModal").style.display = "none";
}

function saveNewEvent() {
  const title = document.getElementById("newEventTitle").value.trim();
  const text = document.getElementById("newEventText").value.trim();
  const eventDateTime = document.getElementById("newEventDateTime").value;
  const colorInput = document.getElementById("newEventColor");
  const color = colorInput && colorInput.value ? colorInput.value.trim() : EVENT_COLOR_DEFAULT;

  if (!title && !text) {
    alert("Vui lòng nhập tiêu đề hoặc nội dung sự kiện");
    return;
  }

  const now = Date.now();
  const eventPayload = {
    id: `ev-${now}-${Math.random().toString(36).slice(2, 6)}`,
    title,
    text,
    note: text,
    eventDateTime,
    color,
    createdAt: now,
    updatedAt: now
  };

  if (selectedEventIndex >= 0) {
    updateEventInDate(selectedKey, selectedEventIndex, eventPayload);
  } else {
    addEventToDate(selectedKey, eventPayload);
    // Bắn thông báo đẩy đến tất cả thiết bị cùng tài khoản
    queueEventNotification(eventPayload, selectedKey);
    // Lên lịch nhắc nhở 60 phút trước sự kiện
    scheduleEventReminder(eventPayload, selectedKey);
  }

  loadCalendarOnDemand();
  renderCalendar();
  renderOvertime();
  renderOvertimeSalary();
  closeAddEventModal();

  // Tự động mở lại day details modal để hiển thị sự kiện mới
  const [y, m, d] = selectedKey.split("-").map(Number);
  openDayDetailsModal(selectedKey, d, m, y);
}


function openModal(key, d, m, y) {
  // Alias for backwards compatibility - now opens day details
  openDayDetailsModal(key, d, m, y);
}

function closeModal() {
  closeDayDetailsModal();
}

function openOvertimeModal() {
  closeAllModals();
  document.getElementById("overtimeModal").style.display = "flex";
}

function closeOvertimeModal() {
  document.getElementById("overtimeModal").style.display = "none";
}

// ===================== PROJECT MANAGEMENT =====================

function openProjectsModal() {
  closeAllModals();
  document.getElementById("projectsModal").style.display = "flex";
  loadProjectsOnDemand();
}

function closeProjectsModal() {
  document.getElementById("projectsModal").style.display = "none";
  _editingProjectId = null;
}

function openProjectTasksModal(projectId, projectTitle) {
  currentOpenedProjectId = projectId;
  document.getElementById("currentProjectTitle").textContent =
    projectTitle || "Dự án";
  document.getElementById("projectsModal").style.display = "none";
  document.getElementById("projectTasksModal").style.display = "flex";
  renderProjectTasksList(projectId);
}

function closeProjectTasksModal() {
  document.getElementById("projectTasksModal").style.display = "none";
  currentOpenedProjectId = null;
  _editingTaskId = null;
  renderProjectsList();
}

function backToProjectsList() {
  closeProjectTasksModal();
  openProjectsModal();
}

function renderProjectsList() {
  const container = document.getElementById("projectsList");
  if (!container) return;

  const projects = Object.entries(projectsDataCache || {})
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  if (projects.length === 0) {
    container.innerHTML = `
      <div class="app-empty-state">
        <div class="app-empty-icon">📋</div>
        <div class="app-empty-title">Chưa có dự án nào</div>
        <div class="app-empty-desc">Nhấn "+ Thêm dự án mới" để bắt đầu quản lý công việc.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = projects
    .map(
      (project) => `
    <div class="project-item" data-project-id="${project.id}" onclick="if(!event.target.closest('.item-actions')) openProjectTasksModal('${project.id}', '${escapeHtml(project.title || "")}')">
      <div class="project-item-header">
        <div class="project-item-title">
          ${escapeHtml(project.title || "Dự án không tên")}
        </div>
        <div class="item-actions">
          <button class="item-btn" onclick="event.stopPropagation(); editProject('${project.id}')" title="Sửa">✎</button>
          <button class="item-btn delete" onclick="event.stopPropagation(); deleteProject('${project.id}')" title="Xóa">✕</button>
        </div>
      </div>
      ${project.description ? `<div class="project-item-text">${escapeHtml(project.description)}</div>` : ""}
      <div class="project-item-meta">
        <span>${countTasksInProject(project.id)} công việc</span>
      </div>
    </div>
  `,
    )
    .join("");
}

function countTasksInProject(projectId) {
  const tasks = projectTasksCache[projectId] || {};
  return Object.keys(tasks).length;
}

function openProjectFormModal(isEdit, projectId) {
  const modal = document.getElementById("projectFormModal");
  const titleEl = document.getElementById("projectFormTitle");
  const idInput = document.getElementById("projectFormId");
  const nameInput = document.getElementById("projectFormName");
  const descInput = document.getElementById("projectFormDesc");

  if (isEdit && projectId) {
    const project = projectsDataCache[projectId];
    if (!project) return;
    titleEl.textContent = "Sửa dự án";
    idInput.value = projectId;
    nameInput.value = project.title || "";
    descInput.value = project.description || "";
  } else {
    titleEl.textContent = "Thêm dự án mới";
    idInput.value = "";
    nameInput.value = "";
    descInput.value = "";
  }

  modal.style.display = "flex";
  nameInput.focus();
}

function closeProjectFormModal() {
  document.getElementById("projectFormModal").style.display = "none";
}

function handleProjectFormSubmit(e) {
  e.preventDefault();
  const idInput = document.getElementById("projectFormId");
  const nameInput = document.getElementById("projectFormName");
  const descInput = document.getElementById("projectFormDesc");

  const title = nameInput.value.trim();
  const description = descInput.value.trim();

  if (!title) {
    nameInput.focus();
    return;
  }

  const projectId = idInput.value;

  if (projectId) {
    // Edit existing project
    const project = projectsDataCache[projectId];
    if (project) {
      projectsDataCache[projectId] = {
        ...project,
        title,
        description,
        updatedAt: Date.now(),
      };
    }
  } else {
    // Create new project
    const id = generateId();
    const projects = projectsDataCache || {};
    const order = Object.keys(projects).length;

    projectsDataCache = {
      ...projects,
      [id]: {
        id,
        title,
        description,
        order,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    };
  }

  saveProjectsToFirebase();
  closeProjectFormModal();
}

function createNewProject() {
  openProjectFormModal(false);
}

function editProject(projectId) {
  openProjectFormModal(true, projectId);
}

function deleteProject(projectId) {
  showConfirmPopup(
    "Xóa dự án",
    "Bạn có chắc muốn xóa dự án này? Tất cả công việc trong dự án cũng sẽ bị xóa.",
    "Xóa",
    doDeleteProject,
    projectId,
  );
}

function doDeleteProject(projectId) {
  const projects = projectsDataCache || {};
  delete projects[projectId];
  projectsDataCache = projects;

  // Also delete tasks for this project
  delete projectTasksCache[projectId];

  saveProjectsToFirebase();
  saveProjectTasksToFirebase(projectId);
  renderProjectsList();
}

function saveProjectsToFirebase() {
  if (!firebaseProjectsRef) {
    saveProjectsToLocalStorage();
    return;
  }

  firebaseProjectsRef.set(projectsDataCache).catch(() => {
    saveProjectsToLocalStorage();
  });
}

function saveProjectsToLocalStorage() {
  if (!userProfileKey) return;
  localStorage.setItem(
    `projects:${userProfileKey}`,
    JSON.stringify(projectsDataCache),
  );
}

function loadProjectsFromLocalStorage() {
  if (!userProfileKey) return null;
  const data = localStorage.getItem(`projects:${userProfileKey}`);
  return data ? JSON.parse(data) : null;
}

// Task Management
function renderProjectTasksList(projectId) {
  const container = document.getElementById("projectTasksList");
  if (!container) return;

  const tasks = Object.entries(projectTasksCache[projectId] || {})
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  if (tasks.length === 0) {
    container.innerHTML = `
      <div class="app-empty-state">
        <div class="app-empty-icon">📌</div>
        <div class="app-empty-title">Chưa có công việc nào</div>
        <div class="app-empty-desc">Nhấn "+ Thêm công việc" để tạo nhiệm vụ cho dự án này.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = tasks
    .map(
      (task, idx) => `
    <div class="task-item draggable" draggable="true" data-task-id="${task.id}" data-project-id="${projectId}" data-task-order="${task.order || idx}" onclick="event.stopPropagation();">
      <div class="task-item-header">
        <div class="drag-controls">
          <button class="task-drag-handle" onclick="event.stopPropagation();" title="Kéo để sắp xếp">☰</button>
        </div>
        <div class="task-item-title" onclick="event.stopPropagation(); toggleTaskComplete('${projectId}', '${task.id}')">
          <span class="task-checkbox ${task.completed ? "completed" : ""}">${task.completed ? "☑" : "☐"}</span>
          <span class="task-name ${task.completed ? "done" : ""}">${escapeHtml(task.title || "")}</span>
        </div>
        <div class="item-actions">
          <button class="item-btn" onclick="event.stopPropagation(); editTask('${projectId}', '${task.id}')" title="Sửa">✎</button>
          <button class="item-btn delete" onclick="event.stopPropagation(); deleteTask('${projectId}', '${task.id}')" title="Xóa">✕</button>
        </div>
      </div>
      ${task.description ? `<div class="task-item-text">${escapeHtml(task.description)}</div>` : ""}
    </div>
  `,
    )
    .join("");

  bindTaskDragDrop(projectId);
}

// Task Form Modal
function openTaskFormModal(isEdit, projectId, taskId) {
  const modal = document.getElementById("taskFormModal");
  const titleEl = document.getElementById("taskFormTitle");
  const idInput = document.getElementById("taskFormId");
  const projectIdInput = document.getElementById("taskFormProjectId");
  const nameInput = document.getElementById("taskFormName");
  const descInput = document.getElementById("taskFormDesc");

  if (!document.getElementById("taskFormProjectId")) {
    const hiddenInput = document.createElement("input");
    hiddenInput.type = "hidden";
    hiddenInput.id = "taskFormProjectId";
    document.getElementById("taskForm").appendChild(hiddenInput);
  }

  if (isEdit && taskId && projectId) {
    const task = (projectTasksCache[projectId] || {})[taskId];
    if (!task) return;
    titleEl.textContent = "Sửa công việc";
    idInput.value = taskId;
    projectIdInput.value = projectId;
    nameInput.value = task.title || "";
    descInput.value = task.description || "";
  } else {
    titleEl.textContent = "Thêm công việc";
    idInput.value = "";
    projectIdInput.value = projectId || currentOpenedProjectId;
    nameInput.value = "";
    descInput.value = "";
  }

  modal.style.display = "flex";
  nameInput.focus();
}

function closeTaskFormModal() {
  document.getElementById("taskFormModal").style.display = "none";
}

// Custom Unified Confirm Popup
let _confirmPopupCallback = null;
let _confirmPopupArgs = null;

function showConfirmPopup(title, message, confirmText, callback, args, options = {}) {
  const popup = document.getElementById("confirmPopup");
  const titleEl = document.getElementById("confirmPopupTitle");
  const messageEl = document.getElementById("confirmPopupMessage");
  const confirmBtn = document.getElementById("confirmPopupConfirmBtn");
  const cancelBtn = document.getElementById("confirmPopupCancelBtn");
  const iconEl = document.getElementById("confirmPopupIcon");

  if (!popup || !titleEl || !messageEl || !confirmBtn) {
    if (typeof callback === "function") {
      if (args !== undefined && args !== null) {
        Array.isArray(args) ? callback(...args) : callback(args);
      } else {
        callback();
      }
    }
    return;
  }

  titleEl.textContent = title || "Xác nhận";
  messageEl.textContent = message || "Bạn có chắc chắn muốn thực hiện thao tác này?";
  confirmBtn.textContent = confirmText || "Xóa";
  if (cancelBtn) cancelBtn.textContent = options.cancelText || "Hủy";

  const popupType = options.type || "danger";
  if (iconEl) {
    iconEl.textContent = options.icon || (popupType === "warning" ? "⚠️" : (popupType === "primary" ? "ℹ️" : "🗑️"));
    iconEl.className = `confirm-popup-icon ${popupType}`;
  }

  if (confirmBtn) {
    confirmBtn.className = `confirm-popup-btn ${options.btnType || popupType}`;
  }

  _confirmPopupCallback = callback;
  _confirmPopupArgs = args;

  popup.classList.add("show");
}
window.showConfirmPopup = showConfirmPopup;

function closeConfirmPopup() {
  const popup = document.getElementById("confirmPopup");
  if (popup) popup.classList.remove("show");
  _confirmPopupCallback = null;
  _confirmPopupArgs = null;
}
window.closeConfirmPopup = closeConfirmPopup;

function confirmPopupAction() {
  const cb = _confirmPopupCallback;
  const args = _confirmPopupArgs;
  closeConfirmPopup();
  if (typeof cb === "function") {
    if (args !== undefined && args !== null) {
      if (Array.isArray(args)) {
        cb(...args);
      } else {
        cb(args);
      }
    } else {
      cb();
    }
  }
}
window.confirmPopupAction = confirmPopupAction;

function showToast(message, duration = 2500) {
  let toast = document.getElementById("toastNotification");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toastNotification";
    toast.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(20, 30, 50, 0.95);
      color: #e6f0ff;
      padding: 12px 24px;
      border-radius: 10px;
      font-size: 14px;
      z-index: 9999;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(0, 204, 68, 0.4);
      animation: toastIn 0.3s ease;
      max-width: 90vw;
      text-align: center;
    `;
    document.body.appendChild(toast);

    const style = document.createElement("style");
    style.textContent = `
      @keyframes toastIn { from { opacity: 0; transform: translateX(-50%) translateY(20px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
      @keyframes toastOut { from { opacity: 1; transform: translateX(-50%) translateY(0); } to { opacity: 0; transform: translateX(-50%) translateY(-10px); } }
    `;
    document.head.appendChild(style);
  }

  toast.textContent = message;
  toast.style.animation = "toastIn 0.3s ease";

  setTimeout(() => {
    toast.style.animation = "toastOut 0.3s ease";
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, duration);
}

function handleTaskFormSubmit(e) {
  e.preventDefault();
  const idInput = document.getElementById("taskFormId");
  const projectIdInput = document.getElementById("taskFormProjectId");
  const nameInput = document.getElementById("taskFormName");
  const descInput = document.getElementById("taskFormDesc");

  const title = nameInput.value.trim();
  const description = descInput.value.trim();
  const projectId = projectIdInput.value;

  if (!title || !projectId) return;

  const taskId = idInput.value;

  if (taskId) {
    // Edit existing task
    const task = (projectTasksCache[projectId] || {})[taskId];
    if (task) {
      projectTasksCache[projectId][taskId] = {
        ...task,
        title,
        description,
        updatedAt: Date.now(),
      };
    }
  } else {
    // Create new task
    const id = generateId();
    const tasks = projectTasksCache[projectId] || {};
    const order = Object.keys(tasks).length;

    if (!projectTasksCache[projectId]) {
      projectTasksCache[projectId] = {};
    }

    projectTasksCache[projectId][id] = {
      id,
      title,
      description,
      completed: false,
      order,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  saveProjectTasksToFirebase(projectId);
  closeTaskFormModal();
  renderProjectTasksList(projectId);
  renderProjectsList();
}

function createNewTask() {
  if (!currentOpenedProjectId) return;
  openTaskFormModal(false, currentOpenedProjectId);
}

function editTask(projectId, taskId) {
  openTaskFormModal(true, projectId, taskId);
}

function deleteTask(projectId, taskId) {
  showConfirmPopup(
    "Xóa công việc",
    "Bạn có chắc muốn xóa công việc này?",
    "Xóa",
    doDeleteTask,
    { projectId, taskId },
  );
}

function doDeleteTask(args) {
  const { projectId, taskId } = args;
  const tasks = projectTasksCache[projectId] || {};
  delete tasks[taskId];
  projectTasksCache[projectId] = tasks;

  saveProjectTasksToFirebase(projectId);
  renderProjectTasksList(projectId);
  renderProjectsList();
}

function toggleTaskComplete(projectId, taskId) {
  const task = (projectTasksCache[projectId] || {})[taskId];
  if (!task) return;

  projectTasksCache[projectId][taskId] = {
    ...task,
    completed: !task.completed,
    updatedAt: Date.now(),
  };

  saveProjectTasksToFirebase(projectId);
  renderProjectTasksList(projectId);
}

function moveTaskUp(projectId, taskId) {
  const tasks = Object.entries(projectTasksCache[projectId] || {})
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const idx = tasks.findIndex((t) => t.id === taskId);
  if (idx <= 0) return;

  // Swap orders
  const tempOrder = tasks[idx].order;
  tasks[idx].order = tasks[idx - 1].order;
  tasks[idx - 1].order = tempOrder;

  // Rebuild cache
  const newCache = {};
  tasks.forEach((t) => {
    newCache[t.id] = projectTasksCache[projectId][t.id];
    newCache[t.id].order = t.order;
  });
  projectTasksCache[projectId] = newCache;

  saveProjectTasksToFirebase(projectId);
  renderProjectTasksList(projectId);
}

function moveTaskDown(projectId, taskId) {
  const tasks = Object.entries(projectTasksCache[projectId] || {})
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const idx = tasks.findIndex((t) => t.id === taskId);
  if (idx < 0 || idx >= tasks.length - 1) return;

  // Swap orders
  const tempOrder = tasks[idx].order;
  tasks[idx].order = tasks[idx + 1].order;
  tasks[idx + 1].order = tempOrder;

  // Rebuild cache
  const newCache = {};
  tasks.forEach((t) => {
    newCache[t.id] = projectTasksCache[projectId][t.id];
    newCache[t.id].order = t.order;
  });
  projectTasksCache[projectId] = newCache;

  saveProjectTasksToFirebase(projectId);
  renderProjectTasksList(projectId);
}

function saveProjectTasksToFirebase(projectId) {
  if (!firebaseProjectsRef) {
    saveProjectTasksToLocalStorage(projectId);
    return;
  }

  firebaseProjectsRef
    .child(projectId)
    .child("tasks")
    .set(projectTasksCache[projectId] || {})
    .catch(() => {
      saveProjectTasksToLocalStorage(projectId);
    });
}

function saveProjectTasksToLocalStorage(projectId) {
  if (!userProfileKey) return;
  localStorage.setItem(
    `projectTasks:${userProfileKey}:${projectId}`,
    JSON.stringify(projectTasksCache[projectId] || {}),
  );
}

function loadProjectTasksFromLocalStorage(projectId) {
  if (!userProfileKey) return null;
  const data = localStorage.getItem(
    `projectTasks:${userProfileKey}:${projectId}`,
  );
  return data ? JSON.parse(data) : null;
}

// Drag and Drop for Tasks
let _taskDragSrcId = null;
let _touchDragSrcEl = null;
let _touchStartY = 0;
let _touchCurrentY = 0;
let _touchDragging = false;

function bindTaskDragDrop(projectId) {
  const items = document.querySelectorAll(".task-item.draggable");
  items.forEach((item) => {
    // Desktop drag events
    item.addEventListener("dragstart", handleTaskDragStart);
    item.addEventListener("dragover", handleTaskDragOver);
    item.addEventListener("dragenter", handleTaskDragEnter);
    item.addEventListener("dragleave", handleTaskDragLeave);
    item.addEventListener("drop", (e) => handleTaskDrop(e, projectId));
    item.addEventListener("dragend", handleTaskDragEnd);

    // Mobile touch events - only on handle
    const handle = item.querySelector(".task-drag-handle");
    if (handle) {
      handle.addEventListener("touchstart", handleTaskTouchStart, {
        passive: false,
      });
      handle.addEventListener("touchmove", handleTaskTouchMove, { passive: false });
      handle.addEventListener("touchend", (e) => handleTaskTouchEnd(e, projectId));
    }
  });
}

function handleTaskTouchStart(e) {
  const handle = e.target.closest(".task-drag-handle");
  if (!handle) return;

  const item = handle.closest(".task-item.draggable");
  if (!item) return;

  e.preventDefault();
  _touchStartY = e.touches[0].clientY;
  _touchCurrentY = _touchStartY;
  _touchDragSrcEl = item;
  _taskDragSrcId = item.dataset.taskId;
  _touchDragging = false;

  _touchDragSrcEl.classList.add("dragging");
  _touchDragSrcEl.style.opacity = "0.4";
}

function handleTaskTouchMove(e) {
  if (!_touchDragSrcEl) return;
  e.preventDefault();

  _touchCurrentY = e.touches[0].clientY;
  const diff = Math.abs(_touchCurrentY - _touchStartY);

  if (diff > 10) {
    _touchDragging = true;
    _touchDragSrcEl.style.transform = `translateY(${_touchCurrentY - _touchStartY}px)`;
    _touchDragSrcEl.style.zIndex = "1000";
    _touchDragSrcEl.style.position = "relative";

    // Highlight drop target
    const items = Array.from(document.querySelectorAll(".task-item.draggable"));
    items.forEach((item) => {
      if (item === _touchDragSrcEl) return;
      item.style.borderTop = "";
      item.style.borderBottom = "";

      const rect = item.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;

      if (_touchCurrentY < midY) {
        item.style.borderTop = "3px solid #66b2ff";
      } else {
        item.style.borderBottom = "3px solid #66b2ff";
      }
    });
  }
}

function handleTaskTouchEnd(e, projectId) {
  if (!_touchDragSrcEl) return;

  _touchDragSrcEl.classList.remove("dragging");
  _touchDragSrcEl.style.opacity = "";
  _touchDragSrcEl.style.transform = "";
  _touchDragSrcEl.style.zIndex = "";
  _touchDragSrcEl.style.position = "";

  document.querySelectorAll(".drop-target, .drag-over").forEach((el) => {
    el.classList.remove("drop-target", "drag-over");
    el.style.transform = "";
    el.style.boxShadow = "";
    el.style.zIndex = "";
    el.style.borderTop = "";
    el.style.borderBottom = "";
  });

  if (_touchDragging && _taskDragSrcId) {
    // Find target element under touch point
    const touch = e.changedTouches[0];
    const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
    const targetItem = targetEl
      ? targetEl.closest(".task-item.draggable")
      : null;

    if (targetItem && targetItem.dataset.taskId !== _taskDragSrcId) {
      const targetId = targetItem.dataset.taskId;
      const rect = targetItem.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const insertAbove = touch.clientY < midY;

      performTaskReorder(projectId, _taskDragSrcId, targetId, insertAbove);
    }
  }

  _touchDragSrcEl = null;
  _taskDragSrcId = null;
  _touchDragging = false;
}

function performTaskReorder(projectId, srcId, targetId, insertAbove) {
  const tasks = Object.entries(projectTasksCache[projectId] || {})
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const srcIdx = tasks.findIndex((t) => t.id === srcId);
  const targetIdx = tasks.findIndex((t) => t.id === targetId);

  if (srcIdx < 0 || targetIdx < 0) return;

  const [movedTask] = tasks.splice(srcIdx, 1);

  let insertIdx = insertAbove ? targetIdx : targetIdx + 1;
  if (srcIdx < targetIdx && !insertAbove) {
    insertIdx = targetIdx;
  } else if (srcIdx > targetIdx && insertAbove) {
    insertIdx = targetIdx + 1;
  }

  tasks.splice(Math.max(0, Math.min(insertIdx, tasks.length)), 0, movedTask);

  const newCache = {};
  tasks.forEach((t, idx) => {
    newCache[t.id] = projectTasksCache[projectId][t.id];
    newCache[t.id].order = idx;
  });
  projectTasksCache[projectId] = newCache;

  saveProjectTasksToFirebase(projectId);
  renderProjectTasksList(projectId);
}

function handleTaskDragStart(e) {
  _taskDragSrcId = e.currentTarget.dataset.taskId;
  e.currentTarget.classList.add("dragging");
  e.currentTarget.style.opacity = "0.4";
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", _taskDragSrcId);

  // Add drop indicator style to all items
  document.querySelectorAll(".task-item.draggable").forEach((item) => {
    if (item.dataset.taskId !== _taskDragSrcId) {
      item.classList.add("drop-target");
    }
  });
}

function handleTaskDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";

  // Add visual indicator line
  const rect = e.currentTarget.getBoundingClientRect();
  const midY = rect.top + rect.height / 2;

  // Remove existing indicator
  document.querySelectorAll(".drop-indicator").forEach((el) => el.remove());

  if (e.clientY < midY) {
    e.currentTarget.style.borderTop = "3px solid #66b2ff";
    e.currentTarget.style.borderBottom = "";
  } else {
    e.currentTarget.style.borderBottom = "3px solid #66b2ff";
    e.currentTarget.style.borderTop = "";
  }
}

function handleTaskDragEnter(e) {
  e.preventDefault();
  e.currentTarget.classList.add("drag-over");
  e.currentTarget.style.transform = "scale(1.02)";
  e.currentTarget.style.boxShadow = "0 8px 24px rgba(102, 178, 255, 0.3)";
  e.currentTarget.style.zIndex = "10";
}

function handleTaskDragLeave(e) {
  e.currentTarget.classList.remove("drag-over");
  e.currentTarget.style.transform = "";
  e.currentTarget.style.boxShadow = "";
  e.currentTarget.style.zIndex = "";
}

function handleTaskDrop(e, projectId) {
  e.preventDefault();

  // Clean up visual indicators first
  document.querySelectorAll(".drop-target, .drag-over").forEach((el) => {
    el.classList.remove("drop-target", "drag-over");
    el.style.transform = "";
    el.style.boxShadow = "";
    el.style.zIndex = "";
    el.style.borderTop = "";
    el.style.borderBottom = "";
  });
  document.querySelectorAll(".drop-indicator").forEach((el) => el.remove());

  const targetId = e.currentTarget.dataset.taskId;
  if (!_taskDragSrcId || _taskDragSrcId === targetId) return;

  const tasks = Object.entries(projectTasksCache[projectId] || {})
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const srcIdx = tasks.findIndex((t) => t.id === _taskDragSrcId);
  const targetIdx = tasks.findIndex((t) => t.id === targetId);

  if (srcIdx < 0 || targetIdx < 0) return;

  const [movedTask] = tasks.splice(srcIdx, 1);
  tasks.splice(targetIdx, 0, movedTask);

  // Determine actual insert position
  const rect = e.currentTarget.getBoundingClientRect();
  const midY = rect.top + rect.height / 2;
  let insertIdx = targetIdx;
  if (e.clientY < midY && srcIdx < targetIdx) {
    insertIdx = targetIdx - 1;
  } else if (e.clientY >= midY && srcIdx > targetIdx) {
    insertIdx = targetIdx + 1;
  }

  // Rebuild with correct order
  const newCache = {};
  tasks.forEach((t, idx) => {
    newCache[t.id] = projectTasksCache[projectId][t.id];
    newCache[t.id].order = idx;
  });
  projectTasksCache[projectId] = newCache;

  // Add drop animation feedback
  e.currentTarget.style.transition = "background 0.3s, border-color 0.3s";
  e.currentTarget.style.background = "rgba(102, 178, 255, 0.15)";
  e.currentTarget.style.borderColor = "rgba(102, 178, 255, 0.6)";
  setTimeout(() => {
    e.currentTarget.style.background = "";
    e.currentTarget.style.borderColor = "";
  }, 300);

  saveProjectTasksToFirebase(projectId);
  renderProjectTasksList(projectId);
}

function handleTaskDragEnd(e) {
  _taskDragSrcId = null;
  e.currentTarget.style.opacity = "";

  // Clean up all drag effects
  document.querySelectorAll(".task-item").forEach((item) => {
    item.classList.remove("dragging", "drag-over", "drop-target");
    item.style.opacity = "";
    item.style.transform = "";
    item.style.boxShadow = "";
    item.style.zIndex = "";
    item.style.borderTop = "";
    item.style.borderBottom = "";
  });
  document.querySelectorAll(".drop-indicator").forEach((el) => el.remove());
}

function openGoldModal() {
  closeAllModals();
  document.getElementById("goldModal").style.display = "flex";
  hideGoldTooltip();
  loadGoldOnDemand();
}

function closeGoldModal() {
  document.getElementById("goldModal").style.display = "none";
  hideGoldTooltip();
}

function hideGoldTooltip() {
  const tooltip = document.getElementById("goldTooltip");
  if (tooltip) {
    tooltip.classList.remove("is-visible");
    tooltip.setAttribute("aria-hidden", "true");
  }
}

function getQuickNoteStorageKey() {
  return userProfileKey
    ? `${QUICK_NOTE_STORAGE_KEY_PREFIX}:${userProfileKey}`
    : QUICK_NOTE_STORAGE_KEY_PREFIX;
}

function normalizeQuickNotes(raw) {
  if (!raw) return [];
  let list = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (typeof raw === "object") {
    list = Object.values(raw);
  }
  return list
    .filter((note) => note && typeof note === "object")
    .map((note) => ({
      id: String(note?.id || "").trim() || `qn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text: String(note?.text || "").trim(),
      done: Boolean(note?.done),
      createdAt: Number(note?.createdAt || Date.now()),
    }))
    .filter((note) => note.id && note.text);
}

function loadQuickNotes() {
  if (Array.isArray(quickNotesCache)) {
    return quickNotesCache;
  }

  const key = getQuickNoteStorageKey();
  const raw = localStorage.getItem(key);
  if (!raw) {
    quickNotesCache = [];
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    quickNotesCache = normalizeQuickNotes(parsed);
    return quickNotesCache;
  } catch {
    quickNotesCache = [];
    return [];
  }
}

function saveQuickNotes(notes) {
  const normalized = normalizeQuickNotes(notes);

  quickNotesCache = normalized;
  localStorage.setItem(getQuickNoteStorageKey(), JSON.stringify(normalized));

  if (firebaseQuickNotesRef) {
    if (normalized.length === 0) {
      firebaseQuickNotesRef.set(null).catch((err) => {
        console.error("Firebase Quick Notes clear error:", err);
      });
    } else {
      firebaseQuickNotesRef.set(normalized).catch((err) => {
        console.error("Firebase Quick Notes save error:", err);
      });
    }
  }
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderQuickNotes() {
  const listEl = document.getElementById("quickNoteList");
  if (!listEl) return;

  const notes = loadQuickNotes();
  listEl.innerHTML = "";

  if (notes.length === 0) {
    listEl.innerHTML = `
      <div class="app-empty-state">
        <div class="app-empty-icon">📝</div>
        <div class="app-empty-title">Chưa có ghi chú nào</div>
        <div class="app-empty-desc">Nhập việc cần làm ở trên và nhấn "+ Thêm" để lưu lại.</div>
      </div>
    `;
    return;
  }

  listEl.innerHTML = notes
    .map((note) => {
      return `
      <div class="quick-note-item ${note.done ? "is-done" : ""}" draggable="true" data-note-id="${note.id}">
        <span class="note-drag-handle" aria-hidden="true" data-drag-handle="true">☰</span>
        <input type="checkbox" ${note.done ? "checked" : ""} aria-label="Đánh dấu hoàn thành" onclick="toggleQuickNoteDone('${note.id}')">
        <div class="quick-note-text" onclick="editQuickNote('${note.id}')" title="Nhấn để sửa">${escapeHtml(note.text)}</div>
        <button type="button" class="quick-note-delete" onclick="deleteQuickNote('${note.id}')" aria-label="Xóa ghi chú">×</button>
      </div>
    `;
    })
    .join("");

  bindQuickNoteDragDrop();
}

let _noteDragSrcId = null;

function bindQuickNoteDragDrop() {
  const items = document.querySelectorAll("#quickNoteList .quick-note-item");
  items.forEach((item) => {
    item.addEventListener("dragstart", handleNoteDragStart);
    item.addEventListener("dragenter", handleNoteDragEnter);
    item.addEventListener("dragover", handleNoteDragOver);
    item.addEventListener("dragleave", handleNoteDragLeave);
    item.addEventListener("drop", handleNoteDrop);
    item.addEventListener("dragend", handleNoteDragEnd);
  });
}

function handleNoteDragStart(e) {
  _noteDragSrcId = e.currentTarget.dataset.noteId;
  e.currentTarget.classList.add("is-dragging");
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", _noteDragSrcId);
}

function handleNoteDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  return false;
}

function handleNoteDragEnter(e) {
  e.preventDefault();
  if (e.currentTarget.dataset.noteId !== _noteDragSrcId) {
    e.currentTarget.classList.add("drag-over");
  }
}

function handleNoteDragLeave(e) {
  e.currentTarget.classList.remove("drag-over");
}

function handleNoteDrop(e) {
  e.stopPropagation();
  e.preventDefault();
  const targetId = e.currentTarget.dataset.noteId;
  if (!_noteDragSrcId || _noteDragSrcId === targetId) return;

  const notes = loadQuickNotes();
  const srcIdx = notes.findIndex((n) => n.id === _noteDragSrcId);
  const targetIdx = notes.findIndex((n) => n.id === targetId);

  if (srcIdx < 0 || targetIdx < 0) return;

  const [movedNote] = notes.splice(srcIdx, 1);
  notes.splice(targetIdx, 0, movedNote);

  saveQuickNotes(notes);
  renderQuickNotes();
}

function handleNoteDragEnd(e) {
  _noteDragSrcId = null;
  document
    .querySelectorAll("#quickNoteList .quick-note-item")
    .forEach((item) => {
      item.classList.remove("is-dragging", "drag-over");
    });
}

let _editingQuickNoteId = null;
const QUICK_NOTE_DRAFT_KEY = "quickNoteDraft_v1";

function editQuickNote(noteId) {
  const notes = loadQuickNotes();
  const note = notes.find((n) => n.id === noteId);
  if (!note) return;

  _editingQuickNoteId = noteId;
  const input = document.getElementById("quickNoteInput");
  const submitBtn = document.getElementById("quickNoteSubmitBtn");
  const cancelBtn = document.getElementById("quickNoteCancelBtn");

  if (input) {
    input.value = note.text;
    input.focus({ preventScroll: true });
  }
  if (submitBtn) submitBtn.innerText = "Lưu";
}

function cancelEditQuickNote() {
  _editingQuickNoteId = null;
  const input = document.getElementById("quickNoteInput");
  const submitBtn = document.getElementById("quickNoteSubmitBtn");

  if (input) input.value = "";
  if (submitBtn) submitBtn.innerText = "+ Thêm";
  try {
    localStorage.removeItem(QUICK_NOTE_DRAFT_KEY);
  } catch (e) {}
}

function openQuickNoteDraftModal() {
  const modal = document.getElementById("quickNoteDraftModal");
  if (modal) modal.style.display = "flex";
}

function closeQuickNoteDraftModal() {
  const modal = document.getElementById("quickNoteDraftModal");
  if (modal) modal.style.display = "none";
}

function saveQuickNoteDraftAndClose() {
  const input = document.getElementById("quickNoteInput");
  const text = input ? input.value : "";
  if (text && text.trim()) {
    try {
      localStorage.setItem(
        QUICK_NOTE_DRAFT_KEY,
        JSON.stringify({
          text: text,
          editingId: _editingQuickNoteId || null,
          savedAt: Date.now(),
        })
      );
      showToast("Đã lưu bản nháp ghi chú");
    } catch (e) {}
  }
  closeQuickNoteDraftModal();
  forceCloseQuickNoteModal();
}

function discardQuickNoteDraft() {
  try {
    localStorage.removeItem(QUICK_NOTE_DRAFT_KEY);
  } catch (e) {}
  closeQuickNoteDraftModal();
  cancelEditQuickNote();
  forceCloseQuickNoteModal();
}

function forceCloseQuickNoteModal() {
  const modal = document.getElementById("quickNoteModal");
  if (modal) modal.style.display = "none";
}

function openQuickNoteModal() {
  closeAllModals();
  loadQuickNotesOnDemand();
  document.getElementById("quickNoteModal").style.display = "flex";

  const input = document.getElementById("quickNoteInput");
  if (input) {
    // Restore draft if present and input is empty
    try {
      const savedDraft = localStorage.getItem(QUICK_NOTE_DRAFT_KEY);
      if (savedDraft && (!input.value || !input.value.trim())) {
        const draftObj = JSON.parse(savedDraft);
        if (draftObj && draftObj.text) {
          input.value = draftObj.text;
          if (draftObj.editingId) {
            _editingQuickNoteId = draftObj.editingId;
            const submitBtn = document.getElementById("quickNoteSubmitBtn");
            const cancelBtn = document.getElementById("quickNoteCancelBtn");
            if (submitBtn) submitBtn.innerText = "Lưu";
            if (cancelBtn) cancelBtn.style.display = "block";
          }
          showToast("Đã khôi phục bản nháp chưa lưu", 2000);
        }
      }
    } catch (e) {
      localStorage.removeItem(QUICK_NOTE_DRAFT_KEY);
    }

    input.focus({ preventScroll: true });
    input.removeEventListener("keydown", handleQuickNoteKeydown);
    input.addEventListener("keydown", handleQuickNoteKeydown);
  }
}

function handleQuickNoteKeydown(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    submitQuickNote();
  }
}

function closeQuickNoteModal() {
  const input = document.getElementById("quickNoteInput");
  const text = input ? input.value.trim() : "";

  let hasUnsaved = false;
  if (_editingQuickNoteId) {
    const notes = loadQuickNotes();
    const note = notes.find((n) => n.id === _editingQuickNoteId);
    if (note && text !== note.text.trim()) {
      hasUnsaved = true;
    }
  } else {
    if (text.length > 0) {
      hasUnsaved = true;
    }
  }

  if (hasUnsaved) {
    openQuickNoteDraftModal();
    return;
  }

  forceCloseQuickNoteModal();
  cancelEditQuickNote();
}

function submitQuickNote() {
  const input = document.getElementById("quickNoteInput");
  if (!input) return;

  const text = input.value.trim();
  if (!text) return;

  const notes = loadQuickNotes();

  if (_editingQuickNoteId) {
    const idx = notes.findIndex((n) => n.id === _editingQuickNoteId);
    if (idx >= 0) {
      notes[idx].text = text;
    }
  } else {
    notes.unshift({
      id: `qn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text,
      done: false,
      createdAt: Date.now(),
    });
  }

  saveQuickNotes(notes);
  try {
    localStorage.removeItem(QUICK_NOTE_DRAFT_KEY);
  } catch (e) {}
  cancelEditQuickNote();
  renderQuickNotes();
  input.focus({ preventScroll: true });
}

function toggleQuickNoteDone(noteId) {
  const notes = loadQuickNotes();
  const idx = notes.findIndex((note) => String(note.id) === String(noteId));
  if (idx < 0) return;

  notes[idx].done = !notes[idx].done;
  saveQuickNotes(notes);
  renderQuickNotes();
}

function deleteQuickNote(noteId) {
  const currentNotes = loadQuickNotes();
  const notes = currentNotes.filter((note) => String(note.id) !== String(noteId));
  saveQuickNotes(notes);
  renderQuickNotes();
}

function initQuickNoteModal() {
  const modal = document.getElementById("quickNoteModal");
  if (modal) {
    modal.addEventListener("click", function (e) {
      if (e.target === this) closeQuickNoteModal();
    });
  }

  const draftModal = document.getElementById("quickNoteDraftModal");
  if (draftModal) {
    draftModal.addEventListener("click", function (e) {
      if (e.target === this) closeQuickNoteDraftModal();
    });
  }
}

let MY_MUSIC_TRACKS = Array.isArray(self.MY_LOCAL_MUSIC_TRACKS)
  ? self.MY_LOCAL_MUSIC_TRACKS.filter((track) => {
    return (
      track &&
      typeof track.title === "string" &&
      typeof track.artist === "string" &&
      typeof track.src === "string" &&
      typeof track.cover === "string" &&
      track.src.trim().length > 0
    );
  })
  : [];

const myMusicState = {
  initialized: false,
  index: 0,
  shuffle: false,
  repeatOne: false,
};

function getMyMusicPrefsKey() {
  return userProfileKey
    ? `${MY_MUSIC_PREFS_KEY_PREFIX}:${userProfileKey}`
    : MY_MUSIC_PREFS_KEY_PREFIX;
}

function loadMyMusicPrefs() {
  const raw = localStorage.getItem(getMyMusicPrefsKey());
  if (!raw) return { index: 0, shuffle: false, repeatOne: false };

  try {
    const parsed = JSON.parse(raw);
    const shuffle = Boolean(parsed?.shuffle);
    const repeatOne = Boolean(parsed?.repeatOne);
    return {
      index: Number.isFinite(Number(parsed?.index)) ? Number(parsed.index) : 0,
      shuffle,
      repeatOne: shuffle ? false : repeatOne,
    };
  } catch {
    return { index: 0, shuffle: false, repeatOne: false };
  }
}

function saveMyMusicPrefs() {
  localStorage.setItem(
    getMyMusicPrefsKey(),
    JSON.stringify({
      index: myMusicState.index,
      shuffle: myMusicState.shuffle,
      repeatOne: myMusicState.repeatOne,
    }),
  );
}

function formatMusicTime(seconds) {
  const sec = Math.max(0, Math.floor(Number(seconds) || 0));
  const m = Math.floor(sec / 60);
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function getMyMusicAudio() {
  return document.getElementById("myMusicAudio");
}

function getTrackByIndex(index) {
  const size = MY_MUSIC_TRACKS.length;
  if (size <= 0) {
    return {
      track: {
        title: "Chưa có bài hát",
        artist: "",
        src: "",
        cover:
          "https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=640&q=80",
      },
      index: 0,
    };
  }
  const safe = (((Number(index) || 0) % size) + size) % size;
  return { track: MY_MUSIC_TRACKS[safe], index: safe };
}

function renderMyMusicMeta() {
  const { track, index } = getTrackByIndex(myMusicState.index);
  myMusicState.index = index;

  const titleEl = document.getElementById("myMusicTitle");
  const artistEl = document.getElementById("myMusicArtist");
  const coverEl = document.getElementById("myMusicCover");
  const shuffleBtn = document.getElementById("myMusicShuffleBtn");
  const repeatBtn = document.getElementById("myMusicRepeatOneBtn");

  if (titleEl) titleEl.innerText = track.title;
  if (artistEl) artistEl.innerText = track.artist;
  if (coverEl) {
    coverEl.src = track.cover;
    coverEl.alt = `${track.title} cover`;
  }

  if (shuffleBtn)
    shuffleBtn.classList.toggle("is-active", myMusicState.shuffle);
  if (repeatBtn)
    repeatBtn.classList.toggle("is-active", myMusicState.repeatOne);
  renderMyMusicPlaylist();
}

function renderMyMusicPlaylist() {
  const listEl = document.getElementById("myMusicPlaylist");
  const audio = getMyMusicAudio();
  if (!listEl) return;

  if (MY_MUSIC_TRACKS.length === 0) {
    listEl.innerHTML =
      '<div class="quick-note-empty">Chưa tải được danh sách bài hát.</div>';
    return;
  }

  const activeIndex = getTrackByIndex(myMusicState.index).index;
  const isPlaying = Boolean(audio && !audio.paused);

  listEl.innerHTML = MY_MUSIC_TRACKS.map((track, idx) => {
    const isActive = idx === activeIndex;
    const status = isActive ? (isPlaying ? "Playing" : "Ready") : "";
    return `
      <button type="button" class="my-music-track-item ${isActive ? "is-active" : ""} ${isActive && isPlaying ? "is-playing" : ""}" draggable="true" data-track-index="${idx}" onclick="selectMyMusicTrack(${idx})" aria-label="Phát bài ${escapeHtml(track.title)}">
        <span class="drag-handle" aria-hidden="true">☰</span>
        <span class="my-music-track-index">${String(idx + 1).padStart(2, "0")}</span>
        <span class="my-music-track-text">
          <span class="my-music-track-name">${escapeHtml(track.title)}</span>
          <span class="my-music-track-artist">${escapeHtml(track.artist)}</span>
        </span>
        <span class="my-music-track-status">${status}</span>
      </button>
    `;
  }).join("");

  bindPlaylistDragDrop();
}

let _dragSrcIndex = null;

function bindPlaylistDragDrop() {
  const listEl = document.getElementById("myMusicPlaylist");
  if (!listEl) return;

  const items = listEl.querySelectorAll(".my-music-track-item");
  items.forEach((item) => {
    item.addEventListener("dragstart", handleDragStart);
    item.addEventListener("dragenter", handleDragEnter);
    item.addEventListener("dragover", handleDragOver);
    item.addEventListener("dragleave", handleDragLeave);
    item.addEventListener("drop", handleDrop);
    item.addEventListener("dragend", handleDragEnd);
  });
}

function handleDragStart(e) {
  _dragSrcIndex = Number(e.currentTarget.dataset.trackIndex);
  e.currentTarget.classList.add("is-dragging");
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", _dragSrcIndex);
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  return false;
}

function handleDragEnter(e) {
  e.preventDefault();
  const target = e.currentTarget;
  if (Number(target.dataset.trackIndex) !== _dragSrcIndex) {
    target.classList.add("drag-over");
  }
}

function handleDragLeave(e) {
  e.currentTarget.classList.remove("drag-over");
}

function handleDrop(e) {
  e.stopPropagation();
  e.preventDefault();
  const targetIndex = Number(e.currentTarget.dataset.trackIndex);
  if (_dragSrcIndex === null || _dragSrcIndex === targetIndex) return;

  if (myMusicState.index === _dragSrcIndex) {
    myMusicState.index = targetIndex;
  } else {
    const minIdx = Math.min(_dragSrcIndex, targetIndex);
    const maxIdx = Math.max(_dragSrcIndex, targetIndex);
    if (myMusicState.index > _dragSrcIndex && myMusicState.index <= maxIdx) {
      myMusicState.index--;
    } else if (
      myMusicState.index < _dragSrcIndex &&
      myMusicState.index >= minIdx
    ) {
      myMusicState.index++;
    }
  }

  const [movedTrack] = MY_MUSIC_TRACKS.splice(_dragSrcIndex, 1);
  MY_MUSIC_TRACKS.splice(targetIndex, 0, movedTrack);

  saveMyMusicPrefs();
  renderMyMusicPlaylist();
}

function handleDragEnd(e) {
  _dragSrcIndex = null;
  document.querySelectorAll(".my-music-track-item").forEach((item) => {
    item.classList.remove("is-dragging", "drag-over");
  });
}

function selectMyMusicTrack(index) {
  const safeIndex = getTrackByIndex(index).index;
  loadMyMusicTrack(safeIndex, true);
}

function setMyMusicPlayUI(isPlaying) {
  const playBtn = document.getElementById("myMusicPlayBtn");
  const playIcon = document.getElementById("myMusicPlayIcon");
  const disc = document.getElementById("myMusicDisc");
  if (playBtn)
    playBtn.setAttribute("aria-label", isPlaying ? "Tạm dừng" : "Phát");
  if (playIcon)
    playIcon.src = isPlaying ? "public/pause.png" : "public/app.png";
  if (disc) disc.classList.toggle("is-spinning", isPlaying);
  renderMyMusicPlaylist();
}

function syncMyMusicProgress() {
  const audio = getMyMusicAudio();
  const progress = document.getElementById("myMusicProgress");
  const currentEl = document.getElementById("myMusicCurrentTime");
  const durationEl = document.getElementById("myMusicDuration");
  if (!audio || !progress || !currentEl || !durationEl) return;

  const duration = Number(audio.duration);
  const current = Number(audio.currentTime || 0);

  if (Number.isFinite(duration) && duration > 0) {
    progress.value = String(Math.floor((current / duration) * 1000));
    durationEl.innerText = formatMusicTime(duration);
  } else {
    progress.value = "0";
    durationEl.innerText = "0:00";
  }

  currentEl.innerText = formatMusicTime(current);
}

function loadMyMusicTrack(index, shouldPlay = false) {
  const audio = getMyMusicAudio();
  if (!audio) return;

  const { track, index: safeIndex } = getTrackByIndex(index);
  myMusicState.index = safeIndex;
  renderMyMusicMeta();

  if (audio.src !== track.src) {
    audio.src = track.src;
    audio.load();
  }

  syncMyMusicProgress();
  saveMyMusicPrefs();

  if (shouldPlay) {
    audio.play().catch(() => {
      setMyMusicPlayUI(false);
    });
  } else {
    setMyMusicPlayUI(!audio.paused);
  }
}

function pickRandomTrackIndex(exceptIndex) {
  const size = MY_MUSIC_TRACKS.length;
  if (size <= 1) return 0;

  let idx = exceptIndex;
  while (idx === exceptIndex) {
    idx = Math.floor(Math.random() * size);
  }
  return idx;
}

function openMyMusicModal() {
  closeAllModals();
  const modal = document.getElementById("myMusicModal");
  if (!modal) return;

  loadMyMusicOnDemand();

  modal.style.display = "flex";
  syncMyMusicProgress();
}

function closeMyMusicModal() {
  const modal = document.getElementById("myMusicModal");
  // Intentionally keep audio playing when closing modal.
  if (modal) modal.style.display = "none";
}

function toggleMyMusicPlayPause() {
  const audio = getMyMusicAudio();
  if (!audio) return;

  if (!audio.src) {
    loadMyMusicTrack(myMusicState.index, true);
    return;
  }

  if (audio.paused) {
    audio.play().catch(() => {
      setMyMusicPlayUI(false);
    });
  } else {
    audio.pause();
  }
}

function playNextMusic() {
  const nextIndex = myMusicState.shuffle
    ? pickRandomTrackIndex(myMusicState.index)
    : myMusicState.index + 1;
  loadMyMusicTrack(nextIndex, true);
}

function playPrevMusic() {
  const prevIndex = myMusicState.shuffle
    ? pickRandomTrackIndex(myMusicState.index)
    : myMusicState.index - 1;
  loadMyMusicTrack(prevIndex, true);
}

function toggleMyMusicShuffle() {
  const next = !myMusicState.shuffle;
  myMusicState.shuffle = next;
  if (next) myMusicState.repeatOne = false;
  renderMyMusicMeta();
  saveMyMusicPrefs();
}

function toggleMyMusicRepeatOne() {
  const next = !myMusicState.repeatOne;
  myMusicState.repeatOne = next;
  if (next) myMusicState.shuffle = false;
  renderMyMusicMeta();
  saveMyMusicPrefs();
}

function initMyMusicPlayer() {
  const modal = document.getElementById("myMusicModal");
  const audio = getMyMusicAudio();
  const progress = document.getElementById("myMusicProgress");
  if (!modal || !audio || !progress) return;

  if (myMusicState.initialized) return;

  const prefs = loadMyMusicPrefs();
  myMusicState.index = prefs.index;
  myMusicState.shuffle = prefs.shuffle;
  myMusicState.repeatOne = prefs.repeatOne;

  audio.addEventListener("play", () => setMyMusicPlayUI(true));
  audio.addEventListener("pause", () => setMyMusicPlayUI(false));
  audio.addEventListener("timeupdate", syncMyMusicProgress);
  audio.addEventListener("loadedmetadata", syncMyMusicProgress);
  audio.addEventListener("ended", () => {
    if (myMusicState.repeatOne) {
      audio.currentTime = 0;
      audio.play().catch(() => {
        setMyMusicPlayUI(false);
      });
      return;
    }
    playNextMusic();
  });

  progress.addEventListener("input", () => {
    const duration = Number(audio.duration);
    if (!Number.isFinite(duration) || duration <= 0) return;
    const nextTime = (Number(progress.value) / 1000) * duration;
    audio.currentTime = nextTime;
    syncMyMusicProgress();
  });

  modal.addEventListener("click", function (e) {
    if (e.target === this) closeMyMusicModal();
  });

  loadMyMusicTrack(myMusicState.index, false);
  myMusicState.initialized = true;
}

function toggleToolbox() {
  const toolbox = document.getElementById("quickToolbox");
  const toggleBtn = document.getElementById("toolboxToggle");
  if (!toolbox || !toggleBtn) return;

  const isCollapsed = toolbox.classList.toggle("is-collapsed");
  toggleBtn.classList.toggle("is-collapsed", isCollapsed);
  localStorage.setItem(
    TOOLBOX_STATE_KEY,
    isCollapsed ? "collapsed" : "expanded",
  );
  toggleBtn.setAttribute("aria-expanded", String(!isCollapsed));
  toggleBtn.setAttribute(
    "aria-label",
    isCollapsed ? "Mở thanh công cụ" : "Thu gọn thanh công cụ",
  );
}

function applyStoredToolboxState() {
  const toolbox = document.getElementById("quickToolbox");
  const toggleBtn = document.getElementById("toolboxToggle");
  if (!toolbox || !toggleBtn) return;

  const savedState = localStorage.getItem(TOOLBOX_STATE_KEY);
  const shouldBeCollapsed = savedState !== "expanded";

  if (shouldBeCollapsed) {
    toolbox.classList.add("is-collapsed");
    toggleBtn.classList.add("is-collapsed");
  } else {
    toolbox.classList.remove("is-collapsed");
    toggleBtn.classList.remove("is-collapsed");
  }
  toggleBtn.setAttribute("aria-expanded", String(!shouldBeCollapsed));
  toggleBtn.setAttribute(
    "aria-label",
    shouldBeCollapsed ? "Mở thanh công cụ" : "Thu gọn thanh công cụ",
  );
}

// ========================== MORE MENU ==========================
// On desktop the more dropdown is moved out of .bottom-nav and appended
// directly to <body> so its position:fixed is relative to the viewport
// (no backdrop-filter/overflow ancestor can clip it).
function positionMoreMenu() {
  const dropdown = document.getElementById("moreMenuDropdown");
  const btn = document.querySelector(".nav-item.more-fab");
  if (!dropdown || !btn) return;
  const isDesktop =
    window.matchMedia && window.matchMedia("(min-width: 1024px)").matches;
  if (isDesktop) {
    // Move out of .bottom-nav so backdrop-filter doesn't capture it.
    if (dropdown.parentElement !== document.body) {
      document.body.appendChild(dropdown);
    }
    const rect = btn.getBoundingClientRect();
    // Anchor: right of the sidebar, aligned with the button's BOTTOM.
    // (The "Khác" button is the last item in the sidebar so anchoring
    // top→button.top would push the dropdown below the viewport.)
    const sidebar = document.querySelector(".bottom-nav");
    const sidebarRect = sidebar ? sidebar.getBoundingClientRect() : null;
    const left = sidebarRect ? sidebarRect.right + 12 : rect.right + 12;
    dropdown.style.position = "fixed";
    dropdown.style.left = `${left}px`;
    dropdown.style.bottom = `${window.innerHeight - rect.bottom}px`;
    dropdown.style.top = "auto";
    dropdown.style.right = "auto";
    dropdown.style.transformOrigin = "bottom left";
  } else {
    // Restore DOM placement & let default CSS handle positioning (popup above).
    const wrapper = document.querySelector(".nav-more-wrapper");
    if (wrapper && dropdown.parentElement !== wrapper) {
      wrapper.appendChild(dropdown);
    }
    dropdown.style.position = "";
    dropdown.style.left = "";
    dropdown.style.top = "";
    dropdown.style.right = "";
    dropdown.style.bottom = "";
    dropdown.style.transformOrigin = "";
  }
}

function toggleMoreMenu() {
  const dropdown = document.getElementById("moreMenuDropdown");
  const btn = document.querySelector(".nav-item.more-fab");
  if (!dropdown || !btn) return;

  const isOpen = dropdown.classList.toggle("is-open");
  if (isOpen) positionMoreMenu();
  btn.setAttribute("aria-expanded", String(isOpen));
}

function closeMoreMenu() {
  const dropdown = document.getElementById("moreMenuDropdown");
  const btn = document.querySelector(".nav-item.more-fab");
  if (dropdown) dropdown.classList.remove("is-open");
  if (btn) btn.setAttribute("aria-expanded", "false");
}

// Close more menu when clicking outside
document.addEventListener("click", (e) => {
  const wrapper = document.querySelector(".nav-more-wrapper");
  if (wrapper && !wrapper.contains(e.target)) {
    closeMoreMenu();
  }
});

let toolboxUserInteracted = false;

function initToolboxAutoCollapse() {
  const toolbox = document.getElementById("quickToolbox");
  if (!toolbox) return;

  // Only auto-collapse if user hasn't interacted yet
  toolbox.querySelectorAll(".tool-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      toolboxUserInteracted = true;
      collapseQuickToolbox();
    });
  });
}

document
  .getElementById("dayDetailsModal")
  .addEventListener("click", function (e) {
    if (e.target === this) closeDayDetailsModal();
  });

document
  .getElementById("addEventModal")
  .addEventListener("click", function (e) {
    if (e.target === this) closeAddEventModal();
  });

document
  .getElementById("overtimeModal")
  .addEventListener("click", function (e) {
    if (e.target === this) closeOvertimeModal();
  });

document.getElementById("goldModal").addEventListener("click", function (e) {
  if (e.target === this) closeGoldModal();
});

function saveEvent() {
  const title = document.getElementById("newEventTitle").value.trim();
  const text = document.getElementById("newEventText").value.trim();
  const eventDateTime = document.getElementById("newEventDateTime").value;
  const colorInput = document.getElementById("newEventColor");
  const color = colorInput && colorInput.value ? colorInput.value.trim() : "#3b82f6";

  if (!title && !text) {
    alert("Vui lòng nhập tiêu đề hoặc nội dung sự kiện");
    return;
  }

  addEventToDate(selectedKey, {
    title,
    text,
    eventDateTime,
    color,
  });

  renderOvertime();
  renderOvertimeSalary();
  closeAddEventModal();
  loadCalendarOnDemand();
  renderCalendar();
}

function renderToday() {
  const today = new Date();

  const weekdays = [
    "Chủ nhật",
    "Thứ Hai",
    "Thứ Ba",
    "Thứ Tư",
    "Thứ Năm",
    "Thứ Sáu",
    "Thứ Bảy",
  ];

  document.getElementById("todayWeekday").innerText = weekdays[today.getDay()];

  document.getElementById("todayDate").innerText = today.getDate();

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
  "Muốn dẫn dắt người khác, hãy hiểu họ trước.",
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
    (position) => {
      localStorage.setItem("geoPermission", "granted");
      handleWeather(position.coords.latitude, position.coords.longitude);
    },
    handleLocationError,
    getGeolocationOptions(),
  );
}

function showLocationDisabledMessage() {
  document.getElementById("todayWeather").innerText =
    "📍 Thời tiết: chưa bật định vị";
}

function showLocationUnavailableMessage() {
  document.getElementById("todayWeather").innerText =
    "📍 Tạm thời chưa lấy được vị trí, vui lòng thử lại";
}

function getGeolocationOptions() {
  return {
    enableHighAccuracy: false,
    timeout: 12000,
    maximumAge: 300000,
  };
}

function handleLocationError(error) {
  if (error?.code === 1) {
    // Người dùng từ chối quyền → ghi nhớ để không hỏi lại.
    localStorage.setItem("geoPermission", "denied");
    showLocationDisabledMessage();
    return;
  }

  // Timeout hoặc vị trí không khả dụng (code 2, 3) → KHÔNG xóa cache quyền,
  // vì người dùng vẫn đã cấp quyền, chỉ là thiết bị/mạng tạm thời không lấy được vị trí.
  showLocationUnavailableMessage();
}

function loadWeatherFromCurrentPosition() {
  navigator.geolocation.getCurrentPosition(
    (position) => {
      localStorage.setItem("geoPermission", "granted");
      localStorage.setItem(GEO_COORDS_CACHE_KEY, JSON.stringify({
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        timestamp: Date.now()
      }));
      handleWeather(position.coords.latitude, position.coords.longitude);
    },
    (error) => {
      // Fallback: thử dùng cached coordinates trước khi báo lỗi
      const cached = getCachedGeoCoords();
      if (cached) {
        localStorage.setItem("geoPermission", "granted");
        handleWeather(cached.lat, cached.lon);
      } else {
        handleLocationError(error);
      }
    },
    getGeolocationOptions(),
  );
}

function getCachedGeoCoords() {
  try {
    const cached = localStorage.getItem(GEO_COORDS_CACHE_KEY);
    if (!cached) return null;
    const data = JSON.parse(cached);
    // Cache có hiệu lực trong 24 giờ
    if (Date.now() - data.timestamp > 86400000) {
      localStorage.removeItem(GEO_COORDS_CACHE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function getAddressFromCoords(lat, lon) {
  return fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`,
    {
      headers: {
        "Accept-Language": "vi",
      },
    },
  )
    .then((res) => res.json())
    .then((data) => {
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

function getWeatherIcon(code, isDay = 1) {
  if (code === 0) return isDay ? "☀️" : "🌙";
  if ([1, 2].includes(code)) return isDay ? "🌤️" : "🌙☁️";
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
  return isDay ? "🌤️" : "🌙";
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
&hourly=relativehumidity_2m,temperature_2m,weathercode,precipitation_probability
&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max,windspeed_10m_max,sunrise,sunset
&timezone=auto`,
    ).then((res) => res.json()),
    getAddressFromCoords(lat, lon),
  ])
    .then(([data, locationName]) => {
      const w = data.current_weather;
      const isDay = w.is_day !== undefined ? w.is_day : 1;
      const icon = getWeatherIcon(w.weathercode, isDay);
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

      // Cập nhật biểu tượng và tooltip của nút nổi theo thời tiết thực tế
      const floatingIconEl = document.querySelector("#floatingTodayExtraBtn .floating-btn-icon");
      const floatingBtn = document.getElementById("floatingTodayExtraBtn");
      if (floatingIconEl) {
        floatingIconEl.textContent = icon;
      }
      if (floatingBtn) {
        floatingBtn.title = `Thời tiết: ${Math.round(w.temperature)}°C - ${weatherCodeToText(w.weathercode)}`;
      }
      try {
        localStorage.setItem("lastWeatherIcon", icon);
        localStorage.setItem("lastWeatherText", `Thời tiết: ${Math.round(w.temperature)}°C - ${weatherCodeToText(w.weathercode)}`);
      } catch { }

      renderHourlyForecast(data.hourly, data.current_weather.time);
      renderForecast(data.daily, data.hourly);
    })
    .catch(() => {
      document.getElementById("todayWeather").innerText =
        "Không lấy được dữ liệu thời tiết";
      document.getElementById("hourlyForecastContainer").style.display = "none";
    });
}

function getDailyHumidity(hourly, dateStr) {
  const day = dateStr;
  let sum = 0,
    count = 0;

  hourly.time.forEach((t, i) => {
    if (t.startsWith(day)) {
      sum += hourly.relativehumidity_2m[i];
      count++;
    }
  });

  return count ? Math.round(sum / count) : "--";
}

function renderHourlyForecast(hourly, currentTime) {
  const container = document.getElementById("hourlyForecastContainer");
  if (!container) return;

  const now = new Date(currentTime);
  const todayStr = now.toISOString().slice(0, 10);
  const currentHour = now.getHours();

  // Find the index for today's data that matches current hour
  let currentHourIndex = -1;
  for (let i = 0; i < hourly.time.length; i++) {
    const timeHour = new Date(hourly.time[i]).getHours();
    const timeDay = hourly.time[i].slice(0, 10);
    if (timeDay === todayStr && timeHour === currentHour) {
      currentHourIndex = i;
      break;
    }
  }

  // Fallback: find first entry of today
  if (currentHourIndex === -1) {
    currentHourIndex = hourly.time.findIndex((t) => t.startsWith(todayStr));
  }

  if (currentHourIndex === -1) return;

  // Start from 0h of today, show 24 hours
  const startIndex = hourly.time.findIndex((t) => t.startsWith(todayStr));
  const endIndex = startIndex + 24;

  // Highlight next hour after current
  const nextHourIndex = currentHourIndex + 1;

  let html = `<div class="hourly-scroll">`;

  for (let i = startIndex; i < endIndex && i < hourly.time.length; i++) {
    const timeStr = hourly.time[i];
    const hour = new Date(timeStr).getHours();
    const hourLabel = hour.toString().padStart(2, "0") + ":00";
    const temp = Math.round(hourly.temperature_2m[i]);
    const icon = getWeatherIcon(hourly.weathercode[i]);
    const humidity = hourly.relativehumidity_2m[i];
    const rain = hourly.precipitation_probability[i] ?? 0;

    // Highlight next hour
    const isNextHour = i === nextHourIndex;
    const itemClass = isNextHour ? "hourly-item next-hour" : "hourly-item";

    html += `
      <div class="${itemClass}">
        <div class="hourly-time">${hourLabel}</div>
        <div class="hourly-icon">${icon}</div>
        <div class="hourly-temp">${temp}°</div>
        <div class="hourly-extra">
          <div>💧 ${humidity}%</div>
          <div>🌧 ${rain}%</div>
        </div>
      </div>
    `;
  }

  html += `</div>`;
  container.innerHTML = html;
  container.style.display = "block";

  // Scroll to next hour after render
  requestAnimationFrame(() => {
    const nextHourEl = container.querySelector(".hourly-item.next-hour");
    if (nextHourEl) {
      nextHourEl.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }
  });
}

function renderForecast(daily, hourly) {
  const forecastEl = document.getElementById("weatherForecast");
  forecastEl.innerHTML = "";
  const today = new Date().toISOString().slice(0, 10);

  for (let i = 0; i < daily.time.length; i++) {
    const date = new Date(daily.time[i]);

    // Format day label: Hôm nay, Ngày mai, Ngày kia, or weekday + date
    let dayLabel;
    if (i === 0) {
      dayLabel = "Hôm nay";
    } else if (i === 1) {
      dayLabel = "Ngày mai";
    } else if (i === 2) {
      dayLabel = "Ngày kia";
    } else {
      dayLabel = date.toLocaleDateString("vi-VN", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
      });
    }

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
          <div class="fc-day">${dayLabel}</div>
          <div class="fc-icon">${icon}</div>
        </div>

        <div class="fc-desc">${desc}</div>

        <div class="fc-temp">
          <span class="max">${max}°</span>
          <span class="min">${min}°</span>
        </div>

        <div class="fc-extra">
          <div>🌧 ${rain}%</div>
        </div>
      </div>
    `;
  }
}

async function fetchWeatherByLocation() {
  if (!navigator.geolocation) {
    document.getElementById("todayWeather").innerText =
      "Thiết bị không hỗ trợ định vị";
    document.getElementById("hourlyForecastContainer").style.display = "none";
    return;
  }

  if (!window.isSecureContext) {
    document.getElementById("todayWeather").innerText =
      "📍 Cần mở bằng HTTPS hoặc localhost để dùng định vị";
    document.getElementById("hourlyForecastContainer").style.display = "none";
    return;
  }

  const cachedPermission = localStorage.getItem("geoPermission");

  // Ưu tiên 1: Đã có cached coordinates → dùng luôn, không cần browser prompt
  const cachedCoords = getCachedGeoCoords();
  if (cachedCoords) {
    localStorage.setItem("geoPermission", "granted");
    handleWeather(cachedCoords.lat, cachedCoords.lon);
    return;
  }

  // Ưu tiên 2: Đã từng được cấp quyền → thử lấy vị trí hiện tại (browser sẽ dùng internal cache)
  if (cachedPermission === "granted") {
    loadWeatherFromCurrentPosition();
    return;
  }

  // Đã từng bị từ chối → không hỏi nữa.
  if (cachedPermission === "denied") {
    showLocationDisabledMessage();
    return;
  }

  // Chưa có cache → kiểm tra Permissions API nếu trình duyệt hỗ trợ.
  if (navigator.permissions && navigator.permissions.query) {
    try {
      const status = await navigator.permissions.query({ name: "geolocation" });

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
      // "prompt" → fall through để xin quyền lần đầu bên dưới.
    } catch {
      // Fallback cho trình duyệt không hỗ trợ đầy đủ Permissions API.
    }
  }

  // Chưa biết trạng thái (lần đầu dùng) → xin quyền một lần duy nhất mỗi session.
  if (!geoPromptRequestedThisLoad) {
    geoPromptRequestedThisLoad = true;
    requestLocationPermission();
  } else {
    showLocationDisabledMessage();
  }
}

function weatherCodeToText(code) {
  const map = {
    // Trời quang
    0: "Trời quang",
    // Mây che phủ
    1: "Ít mây",
    2: "Mây rải rác",
    3: "Nhiều mây",
    // Sương mù
    45: "Sương mù",
    48: "Sương mù dày",
    // Mưa phùn
    51: "Mưa phùn nhẹ",
    53: "Mưa phùn",
    55: "Mưa phùn dày",
    // Mưa phùn đóng băng
    56: "Mưa phùn đóng băng nhẹ",
    57: "Mưa phùn đóng băng dày",
    // Mưa
    61: "Mưa nhỏ",
    63: "Mưa vừa",
    65: "Mưa to",
    // Mưa đóng băng
    66: "Mưa đóng băng nhẹ",
    67: "Mưa đóng băng nặng",
    // Tuyết
    71: "Tuyết nhẹ",
    73: "Tuyết",
    75: "Tuyết dày",
    77: "Mưa tuyết",
    // Mưa rào
    80: "Mưa rào nhẹ",
    81: "Mưa rào",
    82: "Mưa rào mạnh",
    // Mưa tuyết rào
    85: "Mưa tuyết nhẹ",
    86: "Mưa tuyết mạnh",
    // Dông
    95: "Dông",
    96: "Dông kèm mưa đá nhẹ",
    99: "Dông kèm mưa đá mạnh",
  };
  return map[code] || "Thời tiết không xác định";
}
function getCanChiYear(year) {
  const can = [
    "Giáp",
    "Ất",
    "Bính",
    "Đinh",
    "Mậu",
    "Kỷ",
    "Canh",
    "Tân",
    "Nhâm",
    "Quý",
  ];
  const chi = [
    "Tý",
    "Sửu",
    "Dần",
    "Mão",
    "Thìn",
    "Tỵ",
    "Ngọ",
    "Mùi",
    "Thân",
    "Dậu",
    "Tuất",
    "Hợi",
  ];
  return `${can[(year + 6) % 10]} ${chi[(year + 8) % 12]}`;
}

function renderTodayLunar() {
  const today = new Date();

  const lunar = convertSolarToLunar(
    today.getDate(),
    today.getMonth() + 1,
    today.getFullYear(),
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

  const dateKeys = getAllDateKeysFromCache();
  for (const key of dateKeys) {
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
      sum: weekday.base + sunday.base + weekday.bonus + sunday.bonus,
    },
  };
}

function renderOvertime() {
  const ot = calcOvertimeSummary(
    currentDate.getFullYear(),
    currentDate.getMonth(),
  );

  otWeekdayBase.innerText = ot.weekday.base;
  otWeekdayBonus.innerText = ot.weekday.bonus;

  otSundayBase.innerText = ot.sunday.base;
  otSundayBonus.innerText = ot.sunday.bonus;

  otTotalBase.innerText = ot.total.base;
  otTotalBonus.innerText = ot.total.bonus;
  otTotalSum.innerText = ot.total.sum;

  // Render line chart for 12 months
  renderOvertimeLineChart();
}

function calcOvertimeByMonthForYear(year) {
  const monthlyData = [];

  for (let month = 1; month <= 12; month++) {
    let weekday = { base: 0, bonus: 0 };
    let sunday = { base: 0, bonus: 0 };
    const dateKeys = getAllDateKeysFromCache();

    for (const key of dateKeys) {
      const [y, m, d] = key.split("-").map(Number);

      if (y !== year || m !== month) continue;

      const date = new Date(y, m - 1, d);
      const dayOfWeek = date.getDay();

      const baseHours = getOvertimeHoursForDateKey(key);
      if (baseHours <= 0) continue;

      let bonusHours = 0;
      if (dayOfWeek === 0) {
        if (baseHours >= 10) bonusHours = 0.5;
      } else {
        if (baseHours >= 2) bonusHours = 0.5;
      }

      if (dayOfWeek === 0) {
        sunday.base += baseHours;
        sunday.bonus += bonusHours;
      } else {
        weekday.base += baseHours;
        weekday.bonus += bonusHours;
      }
    }

    monthlyData.push({
      month,
      weekday: weekday,
      sunday: sunday,
      total: {
        base: weekday.base + sunday.base,
        bonus: weekday.bonus + sunday.bonus,
        sum: weekday.base + sunday.base + weekday.bonus + sunday.bonus
      }
    });
  }

  return monthlyData;
}

function renderOvertimeLineChart() {
  const canvas = document.getElementById("overtimeLineChart");
  if (!canvas) return;

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const monthNames = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"];

  const data = calcOvertimeByMonthForYear(currentYear);
  const currentMonthEl = document.getElementById("otChartCurrentMonth");
  if (currentMonthEl) {
    currentMonthEl.textContent = `Tháng hiện tại: ${monthNames[currentMonth - 1]}/${currentYear}`;
  }

  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 480;
  const height = 180;
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);

  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const pad = { top: 20, right: 12, bottom: 28, left: 36 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  const values = data.map(d => d.total.sum);
  const max = Math.max(...values, 1);

  // Grid lines
  ctx.strokeStyle = "rgba(183, 208, 255, 0.12)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();

    // Y-axis labels
    const val = Math.round(max - (max / 4) * i);
    ctx.fillStyle = "#7a92c4";
    ctx.font = "10px Be Vietnam Pro";
    ctx.textAlign = "right";
    ctx.fillText(val + "h", pad.left - 6, y + 3);
  }

  const toXY = (value, idx) => {
    const x = pad.left + (chartW * idx) / Math.max(data.length - 1, 1);
    const y = pad.top + ((max - value) / max) * chartH;
    return { x, y };
  };

  // Store point positions for tooltip detection
  const pointPositions = data.map((d, idx) => {
    const pos = toXY(d.total.sum, idx);
    return { ...pos, month: d.month, data: d };
  });

  // Draw area fill for all months
  ctx.beginPath();
  data.forEach((d, idx) => {
    const { x, y } = toXY(d.total.sum, idx);
    if (idx === 0) ctx.moveTo(x, pad.top + chartH);
    ctx.lineTo(x, y);
  });
  ctx.lineTo(pad.left + chartW, pad.top + chartH);
  ctx.lineTo(pad.left, pad.top + chartH);
  ctx.closePath();
  ctx.fillStyle = "rgba(255, 136, 0, 0.12)";
  ctx.fill();

  // Draw main line (all months)
  ctx.beginPath();
  data.forEach((d, idx) => {
    const { x, y } = toXY(d.total.sum, idx);
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = "#64B5F6";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Highlight current month point
  const currentPoint = toXY(data[currentMonth - 1].total.sum, currentMonth - 1);

  // Draw vertical line for current month
  ctx.strokeStyle = "rgba(0, 212, 255, 0.4)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(currentPoint.x, pad.top);
  ctx.lineTo(currentPoint.x, pad.top + chartH);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw dots for all months
  data.forEach((d, idx) => {
    const { x, y } = toXY(d.total.sum, idx);
    const isCurrentMonth = idx === currentMonth - 1;

    ctx.beginPath();
    ctx.arc(x, y, isCurrentMonth ? 6 : 4, 0, Math.PI * 2);
    ctx.fillStyle = isCurrentMonth ? "#00d4ff" : "#64B5F6";
    ctx.fill();

    if (isCurrentMonth) {
      ctx.strokeStyle = "rgba(0, 212, 255, 0.4)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.stroke();
    }
  });

  // X-axis labels
  ctx.fillStyle = "#8db4ff";
  ctx.font = "11px Be Vietnam Pro";
  ctx.textAlign = "center";
  data.forEach((d, idx) => {
    const { x } = toXY(d.total.sum, idx);
    ctx.fillText(monthNames[idx], x, height - 8);
  });

  // Current month label above point
  ctx.fillStyle = "#00d4ff";
  ctx.font = "bold 11px Be Vietnam Pro";
  ctx.fillText(data[currentMonth - 1].total.sum + "h", currentPoint.x, currentPoint.y - 14);

  // ============ TOOLTIP HANDLING ============
  let hoveredIndex = -1;
  let tooltipVisible = false;

  function showTooltip(index, x, y) {
    const tooltip = document.getElementById("otChartTooltip");
    if (!tooltip) return;

    const d = data[index];
    const isCurrentMonth = index === currentMonth - 1;

    tooltip.innerHTML = `
      <div class="tooltip-header">${monthNames[index]}/${currentYear}${isCurrentMonth ? ' <span class="current-badge">Hiện tại</span>' : ''}</div>
      <div class="tooltip-divider"></div>
      <div class="tooltip-row">
        <span class="tooltip-label">Ngày thường:</span>
        <span class="tooltip-value">${d.weekday.base}h <span class="tooltip-bonus">(+${d.weekday.bonus}h)</span></span>
      </div>
      <div class="tooltip-row">
        <span class="tooltip-label">Chủ nhật:</span>
        <span class="tooltip-value">${d.sunday.base}h <span class="tooltip-bonus">(+${d.sunday.bonus}h)</span></span>
      </div>
      <div class="tooltip-divider"></div>
      <div class="tooltip-row total">
        <span class="tooltip-label">Tổng cộng:</span>
        <span class="tooltip-value">${d.total.sum}h</span>
      </div>
    `;

    // Position tooltip
    const canvasRect = canvas.getBoundingClientRect();
    const tooltipWidth = 180;
    let left = x + 10;
    let top = y - 60;

    // Adjust if tooltip goes off canvas
    if (left + tooltipWidth > canvasRect.width) {
      left = x - tooltipWidth - 10;
    }
    if (top < 0) {
      top = y + 15;
    }

    tooltip.style.left = left + "px";
    tooltip.style.top = top + "px";
    tooltip.style.display = "block";
    tooltipVisible = true;
  }

  function hideTooltip() {
    const tooltip = document.getElementById("otChartTooltip");
    if (tooltip) tooltip.style.display = "none";
    tooltipVisible = false;
    hoveredIndex = -1;
  }

  function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  function findClosestPoint(mouseX, mouseY) {
    let closestIndex = -1;
    let closestDist = Infinity;
    const hitRadius = 20;

    pointPositions.forEach((p, idx) => {
      const dist = Math.sqrt(Math.pow(mouseX - p.x, 2) + Math.pow(mouseY - p.y, 2));
      if (dist < hitRadius && dist < closestDist) {
        closestDist = dist;
        closestIndex = idx;
      }
    });

    return closestIndex;
  }

  // Mouse move handler
  canvas.onmousemove = function (e) {
    const pos = getMousePos(e);
    const idx = findClosestPoint(pos.x, pos.y);

    if (idx !== hoveredIndex) {
      hoveredIndex = idx;
      if (idx >= 0) {
        const p = pointPositions[idx];
        showTooltip(idx, p.x, p.y);

        // Redraw with hover highlight
        redrawChartWithHover(idx);
      } else {
        hideTooltip();
        renderOvertimeLineChart();
      }
    }
  };

  // Click handler
  canvas.onclick = function (e) {
    const pos = getMousePos(e);
    const idx = findClosestPoint(pos.x, pos.y);

    if (idx >= 0) {
      const p = pointPositions[idx];
      showTooltip(idx, p.x, p.y);

      // Keep the hover state after click
      redrawChartWithHover(idx);
    }
  };

  function redrawChartWithHover(hoverIdx) {
    ctx.clearRect(0, 0, width, height);

    // Redraw grid
    ctx.strokeStyle = "rgba(183, 208, 255, 0.12)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
      ctx.stroke();

      const val = Math.round(max - (max / 4) * i);
      ctx.fillStyle = "#7a92c4";
      ctx.font = "10px Be Vietnam Pro";
      ctx.textAlign = "right";
      ctx.fillText(val + "h", pad.left - 6, y + 3);
    }

    // Redraw area fill
    ctx.beginPath();
    data.forEach((d, idx) => {
      const { x, y } = toXY(d.total.sum, idx);
      if (idx === 0) ctx.moveTo(x, pad.top + chartH);
      ctx.lineTo(x, y);
    });
    ctx.lineTo(pad.left + chartW, pad.top + chartH);
    ctx.lineTo(pad.left, pad.top + chartH);
    ctx.closePath();
    ctx.fillStyle = "rgba(255, 136, 0, 0.12)";
    ctx.fill();

    // Redraw main line
    ctx.beginPath();
    data.forEach((d, idx) => {
      const { x, y } = toXY(d.total.sum, idx);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = "#64B5F6";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Redraw vertical line for current month
    const curPt = toXY(data[currentMonth - 1].total.sum, currentMonth - 1);
    ctx.strokeStyle = "rgba(0, 212, 255, 0.4)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(curPt.x, pad.top);
    ctx.lineTo(curPt.x, pad.top + chartH);
    ctx.stroke();
    ctx.setLineDash([]);

    // Redraw all dots with hover effect
    data.forEach((d, idx) => {
      const { x, y } = toXY(d.total.sum, idx);
      const isCurrentMonth = idx === currentMonth - 1;
      const isHovered = idx === hoverIdx;

      if (isHovered) {
        // Hover effect - outer glow
        ctx.beginPath();
        ctx.arc(x, y, 14, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 136, 0, 0.3)";
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(x, y, isCurrentMonth ? 6 : (isHovered ? 6 : 4), 0, Math.PI * 2);
      ctx.fillStyle = isCurrentMonth ? "#00d4ff" : (isHovered ? "#90CAF9" : "#64B5F6");
      ctx.fill();

      if (isCurrentMonth) {
        ctx.strokeStyle = "rgba(0, 212, 255, 0.4)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    // X-axis labels
    ctx.fillStyle = "#8db4ff";
    ctx.font = "11px Be Vietnam Pro";
    ctx.textAlign = "center";
    data.forEach((d, idx) => {
      const { x } = toXY(d.total.sum, idx);
      ctx.fillText(monthNames[idx], x, height - 8);
    });

    // Current month label above point
    ctx.fillStyle = "#00d4ff";
    ctx.font = "bold 11px Be Vietnam Pro";
    ctx.fillText(data[currentMonth - 1].total.sum + "h", curPt.x, curPt.y - 14);
  }
}

function calcOvertimeSalary(viewYear, viewMonth, hourlyRate) {
  let weekday = {
    hours: 0,
    salary: 0,
  };

  let sunday = {
    hours: 0,
    salary: 0,
  };

  const dateKeys = getAllDateKeysFromCache();
  for (const key of dateKeys) {
    const [y, m, d] = key.split("-").map(Number);

    // 🚫 BỎ QUA NẾU KHÔNG PHẢI THÁNG ĐANG XEM
    if (y !== viewYear || m !== viewMonth + 1) continue;

    const date = new Date(y, m - 1, d);
    const dow = date.getDay(); // 0 = Chủ nhật

    const baseHours = getOvertimeHoursForDateKey(key);
    if (baseHours <= 0) continue;

    const bonusHours =
      dow === 0 ? (baseHours >= 10 ? 0.5 : 0) : baseHours >= 2 ? 0.5 : 0;
    const totalHours = baseHours + bonusHours;

    if (dow === 0) {
      // 🟥 CHỦ NHẬT – tách 2 mốc
      const firstPart = Math.min(totalHours, 8);
      const extraPart = Math.max(totalHours - 8, 0);

      sunday.hours += totalHours;

      sunday.salary += firstPart * hourlyRate * 2 + extraPart * hourlyRate * 3;
    } else {
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
      salary: weekday.salary + sunday.salary,
    },
  };
}

function formatCurrencyInput(input) {
  const oldValue = input.value;
  const cursorPos = input.selectionStart;

  let raw = oldValue.replace(/\D/g, "");
  if (!raw) {
    input.value = "";
    return;
  }

  const formatted = Number(raw).toLocaleString("vi-VN");
  input.value = formatted;

  // Đếm số chữ số trong chuỗi cũ trước con trỏ
  let digitsBefore = 0;
  for (let i = 0; i < cursorPos && i < oldValue.length; i++) {
    if (/\d/.test(oldValue[i])) digitsBefore++;
  }

  // Tìm vị trí con trỏ mới trong chuỗi đã format
  let newPos = 0;
  let count = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i])) {
      count++;
      if (count > digitsBefore) break;
    }
    newPos = i + 1;
  }

  input.setSelectionRange(newPos, newPos);
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
    /Giá vàng SJC hôm nay[\s\S]{0,600}?Mua vào\s+([0-9.,]+)[\s\S]{0,220}?Bán ra\s+([0-9.,]+)/i,
  );
  const tableMatch = content.match(
    /\|\s*Hồ Chí Minh\s*\|\s*Vàng SJC 1L, 10L, 1KG\s*\|\s*([0-9.,]+)\s*\|\s*([0-9.,]+)\s*\|/i,
  );
  const fallbackBuy = content.match(/Mua vào\s+([0-9.,]+)/i);
  const fallbackSell = content.match(/Bán ra\s+([0-9.,]+)/i);

  const buyRaw =
    headlineMatch?.[1] || tableMatch?.[1] || fallbackBuy?.[1] || null;
  const sellRaw =
    headlineMatch?.[2] || tableMatch?.[2] || fallbackSell?.[1] || null;

  const buyThousand = parseVietnamPrice(buyRaw);
  const sellThousand = parseVietnamPrice(sellRaw);
  if (!Number.isFinite(buyThousand) || !Number.isFinite(sellThousand))
    return null;

  return {
    updatedAt: updatedMatch ? updatedMatch[1].trim() : "--",
    buyThousand,
    sellThousand,
  };
}

function parseVietnamHistoryDates(content) {
  const dates = [];
  const monthYearRegex = /Tháng\s+(\d{1,2})\s*\/\s*(\d{4})/g;
  let match;
  let lastIndex = 0;

  while ((match = monthYearRegex.exec(content)) !== null) {
    const month = String(match[1]).padStart(2, "0");
    const year = match[2];

    const sectionStart = match.index + match[0].length;
    const nextMonthMatch = content.indexOf("Tháng", sectionStart);
    const sectionEnd = nextMonthMatch > 0 ? nextMonthMatch : content.length;
    const monthContent = content.slice(sectionStart, sectionEnd);

    const lines = monthContent.split('\n');
    for (const line of lines) {
      const dayMatches = line.match(/\b([0-9]{1,2})\b/g) || [];
      for (const day of dayMatches) {
        const dayNum = parseInt(day, 10);
        if (dayNum >= 1 && dayNum <= 31) {
          const dateStr = `${year}-${month}-${String(dayNum).padStart(2, "0")}`;
          dates.push(dateStr);
        }
      }
    }

    lastIndex = match.index;
  }

  const uniqueDates = [...new Set(dates)];
  return uniqueDates.sort((a, b) => b.localeCompare(a));
}

function parseDailyVietnamGold(content, date) {
  const buyMatch = content.match(/(?:Mua\s*vào|Giá\s*mua)\s*[≤]?\s*([0-9.,]+)\s*(?:x\s*1000\s*đ\/lượng|lượng|VND)/i) ||
    content.match(/([0-9.,]+)\s*x\s*1000\s*đ\/lượng/i);
  const sellMatch = content.match(/(?:Bán\s*ra|Giá\s*bán)\s*[≤]?\s*([0-9.,]+)\s*(?:x\s*1000\s*đ\/lượng|lượng|VND)/i);

  let buyThousand = null;
  let sellThousand = null;

  if (buyMatch) {
    buyThousand = parseVietnamPrice(buyMatch[1]);
  }
  if (sellMatch) {
    sellThousand = parseVietnamPrice(sellMatch[1]);
  }

  if (!buyThousand || !sellThousand) {
    const allNumbers = content.match(/\b([0-9]{1,3}(?:[.,][0-9]{3})+)\b/g) || [];
    if (allNumbers.length >= 2) {
      buyThousand = parseVietnamPrice(allNumbers[0]);
      sellThousand = parseVietnamPrice(allNumbers[1]);
    }
  }

  if (!buyThousand || !sellThousand) return null;

  const parts = date.split("-");
  const label = parts.length === 3 ? `${parts[2]}/${parts[1]}` : date;

  return {
    date,
    label,
    buyValue: buyThousand * 1000,
    sellValue: sellThousand * 1000,
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

  const values = points.flatMap((p) => [p.buyValue, p.sellValue]);
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

async function fetchGoldApi(path) {
  const url = `https://giavang.now${path}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Gold API error ${res.status}`);
  return res.json();
}

async function getRecentVietnamGoldHistory(limit = 30) {
  const safeLimit = Math.min(limit, 30);
  const data = await fetchGoldApi(`/api/prices?type=SJL1L10&days=${safeLimit}`);
  if (!data?.success || !Array.isArray(data.history)) {
    return [];
  }
  return data.history
    .map((item) => {
      const price = item?.prices?.SJL1L10;
      if (!price || !Number.isFinite(price.buy) || !Number.isFinite(price.sell)) {
        return null;
      }
      return {
        date: item.date,
        label: item.date ? item.date.slice(8, 10) + "/" + item.date.slice(5, 7) : "",
        buyValue: price.buy,
        sellValue: price.sell,
      };
    })
    .filter((point) => point != null);
}

async function loadGoldMarketData() {
  const updatedEl = document.getElementById("goldUpdatedAt");
  const buyEl = document.getElementById("goldBuyLuong");
  const sellEl = document.getElementById("goldSellLuong");
  const noteEl = document.getElementById("goldSourceNote");

  if (buyEl && sellEl) {
    buyEl.classList.add("is-loading");
    sellEl.classList.add("is-loading");
  }

  updatedEl.innerText = "Đang tải dữ liệu giá vàng Việt Nam...";
  buyEl.innerText = "--";
  sellEl.innerText = "--";

  try {
    const data = await fetchGoldApi("/api/prices?type=SJL1L10");
    if (!data?.success) {
      throw new Error("Thiếu dữ liệu giá vàng Việt Nam hiện tại");
    }

    const buyVnd = data.buy;
    const sellVnd = data.sell;
    const dateStr = data.date || new Date().toISOString().slice(0, 10);
    const timeStr = data.time || "";

    buyEl.innerText = formatVnd(buyVnd);
    sellEl.innerText = formatVnd(sellVnd);
    updatedEl.innerText = `Giá vàng SJC ${dateStr}${timeStr ? ' ' + timeStr : ''}`;

    if (noteEl) {
      noteEl.innerText = "Nguồn: giavang.now (giá vàng trong nước SJC, cập nhật 5 phút/lần).";
    }
  } catch {
    if (noteEl) {
      noteEl.innerText = "Không thể tải giá vàng hiện tại. Vui lòng thử lại sau.";
    }
  } finally {
    if (buyEl && sellEl) {
      buyEl.classList.remove("is-loading");
      sellEl.classList.remove("is-loading");
    }
  }

  loadGoldChartData();
}

let goldChartRange = "month";
let goldChartData = [];
let goldChartLoading = false;
let goldChartPoints = [];

const GOLD_CHART_RANGE_KEY = "goldChartRange";

function restoreGoldChartRange() {
  try {
    const saved = localStorage.getItem(GOLD_CHART_RANGE_KEY);
    if (["week", "month"].includes(saved)) {
      goldChartRange = saved;
    }
  } catch { }
}

function saveGoldChartRange(range) {
  goldChartRange = range;
  localStorage.setItem(GOLD_CHART_RANGE_KEY, range);
  updateGoldRangeFilterUI();
}

function updateGoldRangeFilterUI() {
  document.querySelectorAll(".gold-range-chip").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.range === goldChartRange);
  });
}

function setGoldChartRange(range) {
  saveGoldChartRange(range);
  loadGoldChartData();
}

function getGoldChartPointsForRange(range, rawData) {
  if (!rawData || rawData.length === 0) return [];

  const now = new Date();

  switch (range) {
    case "week": {
      const points = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const found = rawData.find((p) => p.date === dateStr);
        if (found) {
          points.push({ ...found, label: `${d.getDate()}/${d.getMonth() + 1}` });
        }
      }
      return points;
    }

    case "month": {
      const points = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const found = rawData.find((p) => p.date === dateStr);
        if (found) {
          points.push({ ...found, label: `${d.getDate()}/${d.getMonth() + 1}` });
        }
      }
      return points;
    }

    default:
      return [];
  }
}

async function loadGoldChartData() {
  if (goldChartLoading) return;
  goldChartLoading = true;

  const canvas = document.getElementById("goldChart");
  const summaryEl = document.getElementById("goldChartSummary");
  if (!canvas) {
    goldChartLoading = false;
    return;
  }

  summaryEl.innerHTML = '<div class="gold-chart-loading">Đang tải dữ liệu biểu đồ...</div>';

  try {
    const rawData = await getRecentVietnamGoldHistory(30);
    console.log('Gold chart rawData:', rawData);
    goldChartData = rawData;
    const points = getGoldChartPointsForRange(goldChartRange, rawData);
    console.log('Gold chart points:', points);
    renderGoldChart(points);
    renderGoldChartSummary(points, rawData);
  } catch (err) {
    console.error('Gold chart error:', err);
    summaryEl.innerHTML = '<div class="gold-chart-loading">Không thể tải dữ liệu. Vui lòng thử lại.</div>';
  } finally {
    goldChartLoading = false;
  }
}

function renderGoldChart(points) {
  const canvas = document.getElementById("goldChart");
  const tooltip = document.getElementById("goldTooltip");
  if (!canvas || points.length === 0) return;

  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 680;
  const height = 240;
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);

  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const validBuy = points.filter((p) => p.buyValue != null && !p.isPlaceholder).map((p) => p.buyValue);
  const validSell = points.filter((p) => p.sellValue != null && !p.isPlaceholder).map((p) => p.sellValue);

  if (validBuy.length === 0 && validSell.length === 0) return;

  const allValues = [...validBuy, ...validSell];
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const padding = (max - min) * 0.1 || 1000000;
  const chartMin = min - padding;
  const chartMax = max + padding;
  const range = chartMax - chartMin || 1;

  const pad = { top: 20, right: 12, bottom: 36, left: 12 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  ctx.strokeStyle = "rgba(183, 208, 255, 0.15)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 3; i++) {
    const y = pad.top + (chartH / 3) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();
    const val = chartMax - (range * i) / 3;
    ctx.fillStyle = "rgba(183, 208, 255, 0.45)";
    ctx.font = "10px Be Vietnam Pro";
    ctx.textAlign = "left";
    ctx.fillText(formatVnd(Math.round(val)), pad.left + 2, y - 3);
  }

  const toXY = (value, idx) => {
    const x = pad.left + (chartW * idx) / Math.max(points.length - 1, 1);
    const y = pad.top + ((chartMax - value) / range) * chartH;
    return { x, y };
  };

  const drawLine = (key, color) => {
    const validPoints = points.filter((p) => p[key] != null && !p.isPlaceholder);
    if (validPoints.length < 2) return;

    ctx.beginPath();
    validPoints.forEach((point, idx) => {
      const globalIdx = points.indexOf(point);
      const { x, y } = toXY(point[key], globalIdx);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  drawLine("buyValue", "#7fd3ff");
  drawLine("sellValue", "#ffe39c");

  const pointCoords = [];

  points.forEach((p, idx) => {
    const coords = [];

    if (p.buyValue != null && !p.isPlaceholder) {
      const { x, y } = toXY(p.buyValue, idx);
      ctx.fillStyle = "#7fd3ff";
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      coords.push({ x, y, type: "Mua vào", value: p.buyValue });
    }
    if (p.sellValue != null && !p.isPlaceholder) {
      const { x, y } = toXY(p.sellValue, idx);
      ctx.fillStyle = "#ffe39c";
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      coords.push({ x, y, type: "Bán ra", value: p.sellValue });
    }

    if (coords.length > 0) {
      pointCoords.push({ date: p.label, coords });
    }
  });

  ctx.fillStyle = "#9ab3e4";
  ctx.font = "11px Be Vietnam Pro";
  const step = Math.max(1, Math.floor(points.length / 6));

  points.forEach((p, idx) => {
    if (idx % step === 0 || idx === points.length - 1) {
      const { x } = toXY(p.buyValue != null ? p.buyValue : p.sellValue, idx);
      ctx.textAlign = "center";
      ctx.fillText(p.label, x, height - 6);
    }
  });

  goldChartPoints = pointCoords;

  canvas.onclick = (event) => {
    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    let hoveredPoint = null;
    let hoveredCoord = null;

    for (const point of goldChartPoints) {
      for (const coord of point.coords) {
        const distance = Math.sqrt((clickX - coord.x) ** 2 + (clickY - coord.y) ** 2);
        if (distance <= 10) {
          hoveredPoint = point;
          hoveredCoord = coord;
          break;
        }
      }
      if (hoveredPoint) break;
    }

    if (hoveredPoint && hoveredCoord && tooltip) {
      tooltip.innerHTML = `
        <div class="gold-tooltip-row">
          <span class="gold-tooltip-label">Ngày</span>
          <span class="gold-tooltip-value">${hoveredPoint.date}</span>
        </div>
        <div class="gold-tooltip-row">
          <span class="gold-tooltip-label">${hoveredCoord.type}</span>
          <span class="gold-tooltip-value">${formatVnd(Math.round(hoveredCoord.value))} đ</span>
        </div>
      `;

      const wrap = canvas.closest(".gold-chart-wrap");
      const wrapRect = wrap.getBoundingClientRect();

      let left = hoveredCoord.x + 12;
      let top = hoveredCoord.y - 12;

      if (left + tooltip.offsetWidth > wrapRect.width - 10) {
        left = hoveredCoord.x - tooltip.offsetWidth - 12;
      }
      if (top + tooltip.offsetHeight > wrapRect.height - 10) {
        top = wrapRect.height - tooltip.offsetHeight - 10;
      }
      if (top < 10) top = 10;
      if (left < 10) left = 10;

      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
      tooltip.classList.add("is-visible");
      tooltip.setAttribute("aria-hidden", "false");
    } else if (tooltip) {
      tooltip.classList.remove("is-visible");
      tooltip.setAttribute("aria-hidden", "true");
    }
  };
}

function renderGoldChartSummary(points, rawData) {
  const summaryEl = document.getElementById("goldChartSummary");
  if (!summaryEl || points.length === 0) return;

  const validPoints = points.filter((p) => p.buyValue != null && !p.isPlaceholder);
  if (validPoints.length === 0) {
    summaryEl.innerHTML = '<div class="gold-chart-loading">Không đủ dữ liệu cho khoảng thời gian này.</div>';
    return;
  }

  const first = validPoints[0];
  const last = validPoints[validPoints.length - 1];

  const buyChange = first.buyValue ? ((last.buyValue - first.buyValue) / first.buyValue) * 100 : 0;
  const sellChange = first.sellValue ? ((last.sellValue - first.sellValue) / first.sellValue) * 100 : 0;
  const avgBuy = validPoints.reduce((s, p) => s + p.buyValue, 0) / validPoints.length;
  const avgSell = validPoints.reduce((s, p) => s + p.sellValue, 0) / validPoints.length;
  const maxBuy = Math.max(...validPoints.map((p) => p.buyValue));
  const minBuy = Math.min(...validPoints.map((p) => p.buyValue));
  const maxSell = Math.max(...validPoints.map((p) => p.sellValue));
  const minSell = Math.min(...validPoints.map((p) => p.sellValue));

  summaryEl.innerHTML = `
    <div class="gold-summary-stat">
      <div class="stat-label">Giá mua TB</div>
      <div class="stat-value">${formatVnd(Math.round(avgBuy))}</div>
      <div class="stat-change ${buyChange >= 0 ? 'up' : 'down'}">${buyChange >= 0 ? "+" : ""}${buyChange.toFixed(2)}%</div>
    </div>
    <div class="gold-summary-stat">
      <div class="stat-label">Cao nhất</div>
      <div class="stat-value">${formatVnd(Math.round(maxBuy))}</div>
      <div class="stat-change">Mua: ${formatVnd(Math.round(maxSell))}</div>
    </div>
    <div class="gold-summary-stat">
      <div class="stat-label">Thấp nhất</div>
      <div class="stat-value">${formatVnd(Math.round(minBuy))}</div>
      <div class="stat-change">Bán: ${formatVnd(Math.round(minSell))}</div>
    </div>
  `;
}

restoreGoldChartRange();
updateGoldRangeFilterUI();

const salaryInput = document.getElementById("hourSalary");
const OVERTIME_HOURLY_SALARY_KEY = "overtimeHourlySalary";

function restoreSalaryInputs() {
  const savedHourly =
    parseInt(localStorage.getItem(OVERTIME_HOURLY_SALARY_KEY) || "0", 10) || 0;

  if (savedHourly > 0) {
    salaryInput.value = savedHourly.toLocaleString("vi-VN");
  }
}

salaryInput.addEventListener("input", () => {
  formatCurrencyInput(salaryInput);
  renderOvertimeSalary();
});

function renderOvertimeSalary() {
  const salaryPerHour = parseInt(salaryInput.value.replace(/\D/g, ""), 10) || 0;

  localStorage.setItem(OVERTIME_HOURLY_SALARY_KEY, String(salaryPerHour));

  let overtimeMoney = 0;
  if (salaryPerHour > 0) {
    const otSalary = calcOvertimeSalary(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      salaryPerHour,
    );
    overtimeMoney = otSalary.total.salary;
  }

  document.getElementById("otSalary").innerText =
    overtimeMoney.toLocaleString("vi-VN");
}

salaryInput.addEventListener("input", renderOvertimeSalary);

restoreSalaryInputs();
renderOvertimeSalary();

/* ========================== QUẢN LÝ THU CHI ========================== */
let cashflowEntries = [];
let editingCashflowId = "";
let pendingDeleteCashflowId = "";
let cashflowAnalyticsRange = "all";
let cashflowSummaryRange = "all";
let cashflowChartMonths = 12;
let cashflowShowAllRecent = false;
let selectedCashflowId = "";

const CASHFLOW_PIE_COLORS = [
  "#60a5fa",
  "#34d399",
  "#f59e0b",
  "#64B5F6",
  "#a78bfa",
  "#f87171",
  "#22d3ee",
  "#facc15",
  "#fb7185",
  "#4ade80",
  "#38bdf8",
  "#c084fc",
];

function getAllCashflowEntriesFromCache() {
  const rows = [];
  const dateKeys = getAllDateKeysFromCache();
  for (const dateKey of dateKeys) {
    const data = getDateData(dateKey);
    const entries = data.cashflowEntries || [];
    for (const entry of entries) {
      rows.push({
        ...entry,
        date: normalizeIsoDateString(entry.date || dateKeyToIsoDate(dateKey)),
      });
    }
  }
  return rows;
}

function reloadCashflowEntriesFromCache() {
  cashflowEntries = getAllCashflowEntriesFromCache();
  sortCashflowEntries();
}

function sortCashflowEntries() {
  cashflowEntries.sort((a, b) => {
    if (a.date === b.date) return b.createdAt - a.createdAt;
    return a.date < b.date ? 1 : -1;
  });
}

function getTodayIsoDate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function openCashflowModal() {
  closeAllModals();
  const modal = document.getElementById("cashflowModal");
  if (!modal) return;
  const dateInput = document.getElementById("cashflowDate");
  if (dateInput && !dateInput.value) {
    dateInput.value = getTodayIsoDate();
  }

  restoreCashflowChartMonths();
  applyCashflowMonthSelectValue();
  cashflowShowAllRecent = false;
  modal.style.display = "flex";
  updateCashflowCategoryDropdowns();
  syncCashflowFormMode();
  syncCashflowRangeFilterUI();
  initCashflowImageUpload();

  // 1. Tải tức thì từ cache / localStorage
  reloadCashflowEntriesFromCache();
  renderCashflowDashboard();

  // 2. Nếu cache rỗng và có Firebase, hiện skeleton trong lúc tải dữ liệu
  const isCacheEmpty = cashflowEntries.length === 0;
  if (isCacheEmpty && firebaseDb && userProfileKey) {
    showSkeleton('cashflowSkeleton');
  } else {
    hideSkeleton('cashflowSkeleton');
  }

  // 3. Nếu đã đăng nhập Firebase, fetch dữ liệu mới nhất từ server để đồng bộ và cập nhật danh sách
  if (firebaseDb && userProfileKey) {
    try {
      const datesRef = firebaseDatesRef || firebaseDb.ref(`${FIREBASE_EVENTS_PATH}/${userProfileKey}/dates`);
      const snap = await datesRef.once("value");
      const remoteDates = snap.val() || {};
      let updated = false;
      Object.keys(remoteDates).forEach((dKey) => {
        if (!isDateKey(dKey)) return;
        if (!isDateRecordTrusted(remoteDates[dKey])) return;
        dateDataCache[dKey] = normalizeDateData(remoteDates[dKey]);
        localStorage.setItem(
          dKey,
          JSON.stringify({
            __type: "date_data",
            events: dateDataCache[dKey].events,
            overtimeHours: dateDataCache[dKey].overtimeHours,
            cashflowEntries: dateDataCache[dKey].cashflowEntries,
            updatedAt: Date.now(),
          })
        );
        updated = true;
      });
      if (document.getElementById("cashflowModal") && document.getElementById("cashflowModal").style.display === "flex") {
        reloadCashflowEntriesFromCache();
        renderCashflowDashboard();
      }
    } catch (e) {
      console.warn("[Cashflow] Lỗi fetch Firebase:", e);
    } finally {
      hideSkeleton('cashflowSkeleton');
    }
  }
}

function closeCashflowModal() {
  resetCashflowForm();
  hideSkeleton('cashflowSkeleton');
  document.getElementById("cashflowModal").style.display = "none";
}

function findCashflowEntryLocation(entryId) {
  const dateKeys = getAllDateKeysFromCache();
  for (const dateKey of dateKeys) {
    const data = getDateData(dateKey);
    const idx = (data.cashflowEntries || []).findIndex(
      (entry) => entry.id === entryId,
    );
    if (idx >= 0) {
      return { dateKey, index: idx, entry: data.cashflowEntries[idx] };
    }
  }
  return null;
}

function addCashflowEntry() {
  const dateInput = document.getElementById("cashflowDate");
  const typeInput = document.getElementById("cashflowType");
  const categoryInput = document.getElementById("cashflowCategory");
  const amountInput = document.getElementById("cashflowAmount");
  const noteInput = document.getElementById("cashflowNote");

  const date = normalizeIsoDateString(dateInput.value);
  const type = typeInput.value === "expense" ? "expense" : "income";
  const category = categoryInput.value;
  const amount = parseInt(amountInput.value.replace(/\D/g, ""), 10) || 0;
  const note = noteInput.value.trim();
  const image = getCashflowImageData();
  const targetDateKey = isoDateToDateKey(date);

  if (!date || !targetDateKey) {
    alert("Vui lòng chọn ngày giao dịch");
    return;
  }
  if (!category) {
    alert("Vui lòng chọn danh mục");
    return;
  }
  if (amount <= 0) {
    alert("Vui lòng nhập số tiền lớn hơn 0");
    return;
  }

  if (editingCashflowId) {
    const located = findCashflowEntryLocation(editingCashflowId);
    if (!located) {
      editingCashflowId = "";
      syncCashflowFormMode();
      alert("Giao dịch cần sửa không còn tồn tại.");
      return;
    }

    const previousDateKey = located.dateKey;
    const sameDate = previousDateKey === targetDateKey;

    if (sameDate) {
      const data = getDateData(targetDateKey);
      const entry = data.cashflowEntries[located.index];
      entry.date = date;
      entry.type = type;
      entry.category = category;
      entry.amount = amount;
      entry.note = note;
      entry.image = image;
      entry.updatedAt = Date.now();
      saveDateData(targetDateKey, data);
    } else {
      const previousData = getDateData(previousDateKey);
      previousData.cashflowEntries.splice(located.index, 1);
      saveDateData(previousDateKey, previousData);

      const targetData = getDateData(targetDateKey);
      targetData.cashflowEntries.push({
        id: located.entry.id,
        date,
        type,
        category,
        amount,
        note,
        image,
        createdAt: located.entry.createdAt || Date.now(),
        updatedAt: Date.now(),
      });
      saveDateData(targetDateKey, targetData);
    }
  } else {
    const entry = {
      id: `cf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date,
      type,
      category,
      amount,
      note,
      image,
      createdAt: Date.now(),
    };

    const data = getDateData(targetDateKey);
    data.cashflowEntries.push(entry);
    saveDateData(targetDateKey, data);

    // Bắn thông báo đẩy đến tất cả thiết bị cùng tài khoản
    const categoryName = (cashflowCategories[type] || []).find(c => c.id === category)?.name || category;
    queueEventNotification({
      id: entry.id,
      title: type === "expense" ? "Chi tiêu mới" : "Thu nhập mới",
      text: note || "",
      note: note || "",
      date: date,
      cashflowType: type,
      category: categoryName,
      amount: amount,
      image: image || "",
      createdAt: entry.createdAt || Date.now()
    }, targetDateKey, "cashflow");
  }

  reloadCashflowEntriesFromCache();

  resetCashflowForm();

  renderCashflowDashboard();
}

function startCashflowEdit(id) {
  const entry = cashflowEntries.find((item) => item.id === id);
  if (!entry) return;

  editingCashflowId = id;

  document.getElementById("cashflowDate").value = entry.date;
  document.getElementById("cashflowType").value = entry.type;
  updateCashflowCategoryDropdowns();
  document.getElementById("cashflowAmount").value =
    entry.amount.toLocaleString("vi-VN");
  document.getElementById("cashflowNote").value = entry.note || "";
  setCashflowImageData(entry.image || "");

  if (entry.category) {
    document.getElementById("cashflowCategory").value = entry.category;
  }

  syncCashflowFormMode();

  const section = document.getElementById("cashflowEntrySection");
  if (section) {
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function cancelCashflowEdit() {
  resetCashflowForm();
}

function initCashflowImageUpload() {
  const uploadArea = document.getElementById("cashflowImageUploadArea");
  const fileInput = document.getElementById("cashflowImageInput");
  const placeholder = document.getElementById("cashflowImagePlaceholder");
  const preview = document.getElementById("cashflowImagePreview");
  const previewImg = document.getElementById("cashflowImageImg");
  const removeBtn = document.querySelector(".cashflow-image-remove");

  if (!uploadArea || !fileInput) return;

  if (removeBtn) {
    removeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      removeCashflowImage();
    });
  }

  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Vui lòng chọn file ảnh");
      return;
    }

    placeholder.style.display = "none";
    preview.style.display = "none";
    const loadingEl = document.createElement("div");
    loadingEl.className = "cashflow-image-loading";
    loadingEl.id = "cashflowImageLoading";
    loadingEl.innerHTML = `
      <div class="cashflow-image-loading-spinner"></div>
      <span class="cashflow-image-loading-text">Đang xử lý...</span>
    `;
    uploadArea.appendChild(loadingEl);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        if (loadingEl.parentNode) loadingEl.remove();

        let w = img.width, h = img.height;
        const maxW = 800;
        const maxH = 800;
        if (w > maxW || h > maxH) {
          const ratio = Math.min(maxW / w, maxH / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        let compressed = canvas.toDataURL("image/jpeg", 0.5);

        const base64Len = compressed.length - "data:image/jpeg;base64,".length;
        const sizeKB = Math.round(base64Len * 0.75 / 1024);

        if (sizeKB > 200) {
          compressed = canvas.toDataURL("image/jpeg", 0.3);
        }

        previewImg.src = compressed;
        preview.style.display = "flex";
        uploadArea.classList.add("has-image");
      };
      img.onerror = () => {
        if (loadingEl.parentNode) loadingEl.remove();
        previewImg.src = event.target.result;
        preview.style.display = "flex";
        uploadArea.classList.add("has-image");
      };
      img.src = event.target.result;
    };
    reader.onerror = () => {
      if (loadingEl.parentNode) loadingEl.remove();
      placeholder.style.display = "flex";
      alert("Không thể đọc file ảnh. Vui lòng thử lại.");
    };
    reader.readAsDataURL(file);
  });
}

function removeCashflowImage() {
  const uploadArea = document.getElementById("cashflowImageUploadArea");
  const fileInput = document.getElementById("cashflowImageInput");
  const placeholder = document.getElementById("cashflowImagePlaceholder");
  const preview = document.getElementById("cashflowImagePreview");
  const previewImg = document.getElementById("cashflowImageImg");

  if (fileInput) fileInput.value = "";
  if (previewImg) previewImg.src = "";
  if (placeholder) placeholder.style.display = "flex";
  if (preview) preview.style.display = "none";
  if (uploadArea) uploadArea.classList.remove("has-image");
}

function getCashflowImageData() {
  const previewImg = document.getElementById("cashflowImageImg");
  if (previewImg && previewImg.src && !previewImg.src.includes("data:,")) {
    return previewImg.src;
  }
  return "";
}

function setCashflowImageData(imageData) {
  const uploadArea = document.getElementById("cashflowImageUploadArea");
  const placeholder = document.getElementById("cashflowImagePlaceholder");
  const preview = document.getElementById("cashflowImagePreview");
  const previewImg = document.getElementById("cashflowImageImg");

  if (imageData && imageData.trim() && imageData.startsWith("data:")) {
    if (previewImg) previewImg.src = imageData;
    if (placeholder) placeholder.style.display = "none";
    if (preview) preview.style.display = "flex";
    if (uploadArea) uploadArea.classList.add("has-image");
  } else {
    removeCashflowImage();
  }
}

function resetCashflowForm() {
  editingCashflowId = "";
  document.getElementById("cashflowDate").value = getTodayIsoDate();
  document.getElementById("cashflowType").value = "income";
  updateCashflowCategoryDropdowns();
  document.getElementById("cashflowAmount").value = "";
  document.getElementById("cashflowNote").value = "";
  removeCashflowImage();
  syncCashflowFormMode();
  renderCashflowQuickView();
}

function syncCashflowFormMode() {
  const submitBtn = document.getElementById("cashflowSubmitBtn");
  const cancelBtn = document.getElementById("cashflowCancelEditBtn");
  const mobileAddBtn = document.getElementById("cashflowMobileAddBtn");
  const mobileCloseBtn = document.querySelector(".cashflow-mobile-close-btn");

  if (editingCashflowId) {
    if (submitBtn) submitBtn.innerText = "Lưu chỉnh sửa";
    if (cancelBtn) cancelBtn.style.display = "block";
    if (mobileAddBtn) mobileAddBtn.innerText = "Lưu chỉnh sửa";
    if (mobileCloseBtn) {
      mobileCloseBtn.innerText = "Hủy sửa";
      mobileCloseBtn.onclick = cancelCashflowEdit;
      mobileCloseBtn.classList.add("is-cancel-mode");
    }
  } else {
    if (submitBtn) submitBtn.innerText = "+ Thêm giao dịch";
    if (cancelBtn) cancelBtn.style.display = "none";
    if (mobileAddBtn) mobileAddBtn.innerText = "+ Thêm thu chi";
    if (mobileCloseBtn) {
      mobileCloseBtn.innerText = "Đóng";
      mobileCloseBtn.onclick = closeCashflowModal;
      mobileCloseBtn.classList.remove("is-cancel-mode");
    }
  }
}

function removeCashflowEntry(id) {
  if (!id) return;
  showConfirmPopup(
    "Xóa giao dịch",
    "Bạn có chắc muốn xóa giao dịch này không? Thao tác này không thể hoàn tác.",
    "Xóa",
    () => {
      const located = findCashflowEntryLocation(id);
      if (!located) return;

      const data = getDateData(located.dateKey);
      data.cashflowEntries.splice(located.index, 1);
      saveDateData(located.dateKey, data);

      if (selectedCashflowId === id) {
        selectedCashflowId = "";
      }

      reloadCashflowEntriesFromCache();

      if (editingCashflowId === id) {
        resetCashflowForm();
      }
      renderCashflowDashboard();
    }
  );
}

function openCashflowDeleteConfirmModal() {
  // Legacy fallback
  if (pendingDeleteCashflowId) removeCashflowEntry(pendingDeleteCashflowId);
}

function closeCashflowDeleteConfirmModal() {
  const modal = document.getElementById("cashflowDeleteConfirmModal");
  if (modal) modal.style.display = "none";
  pendingDeleteCashflowId = "";
}

function confirmRemoveCashflowEntry() {
  if (pendingDeleteCashflowId) {
    removeCashflowEntry(pendingDeleteCashflowId);
  }
}

function renderCashflowDashboard() {
  reloadCashflowEntriesFromCache();
  renderCashflowMonthSummary();
  renderCashflowRecentList();
  renderCashflowPieCharts();
  renderCashflowChart();
}

function setCashflowAnalyticsRange(range) {
  const allowedRanges = ["all", "year", "month", "week"];
  const nextRange = allowedRanges.includes(range) ? range : "all";
  if (nextRange === cashflowAnalyticsRange) return;

  cashflowAnalyticsRange = nextRange;
  syncCashflowRangeFilterUI();
  animateCashflowAnalyticsTransition();
}

function setCashflowSummaryRange(range) {
  const allowedRanges = ["all", "year", "month", "week"];
  const nextRange = allowedRanges.includes(range) ? range : "all";
  if (nextRange === cashflowSummaryRange) return;

  cashflowSummaryRange = nextRange;
  syncCashflowRangeFilterUI();
  renderCashflowMonthSummary();
}

function animateCashflowAnalyticsTransition() {
  const targets = Array.from(
    document.querySelectorAll(".cashflow-analytics-fade-target"),
  );

  if (targets.length === 0) {
    renderCashflowPieCharts();
    return;
  }

  targets.forEach((target) => {
    target.classList.add("is-animating");
  });

  window.setTimeout(() => {
    renderCashflowPieCharts();

    requestAnimationFrame(() => {
      targets.forEach((target) => {
        target.classList.remove("is-animating");
      });
    });
  }, 120);
}

function syncCashflowRangeFilterUI() {
  const chips = document.querySelectorAll(
    "#cashflowRangeFilter .cashflow-range-chip",
  );
  chips.forEach((chip) => {
    const isActive = chip.dataset.range === cashflowAnalyticsRange;
    chip.classList.toggle("active", isActive);
    chip.setAttribute("aria-pressed", isActive ? "true" : "false");
  });

  const summaryChips = document.querySelectorAll(
    "#cashflowSummaryRangeFilter .cashflow-range-chip",
  );
  summaryChips.forEach((chip) => {
    const isActive = chip.dataset.range === cashflowSummaryRange;
    chip.classList.toggle("active", isActive);
    chip.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function getCashflowRangeMeta(range) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const today = new Date(currentYear, now.getMonth(), now.getDate());
  const day = today.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() + mondayOffset);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  if (range === "year") {
    return {
      label: `Phân tích theo năm ${currentYear}.`,
      test(dateObj) {
        return dateObj.getFullYear() === currentYear;
      },
    };
  }

  if (range === "month") {
    return {
      label: `Phân tích theo tháng ${currentMonth}/${currentYear}.`,
      test(dateObj) {
        return (
          dateObj.getFullYear() === currentYear &&
          dateObj.getMonth() + 1 === currentMonth
        );
      },
    };
  }

  if (range === "week") {
    return {
      label: `Phân tích theo tuần này (${formatCashflowDateObj(startOfWeek)} - ${formatCashflowDateObj(endOfWeek)}).`,
      test(dateObj) {
        return dateObj >= startOfWeek && dateObj <= endOfWeek;
      },
    };
  }

  return {
    label: "Phân tích theo toàn bộ dữ liệu thu chi đã lưu.",
    test() {
      return true;
    },
  };
}

function getCashflowEntriesByRange(range = cashflowAnalyticsRange) {
  const meta = getCashflowRangeMeta(range);
  const entries = cashflowEntries.filter((entry) => {
    const dateObj = parseCashflowDateToLocalDate(entry.date);
    return dateObj && meta.test(dateObj);
  });

  return { entries, label: meta.label };
}

function parseCashflowDateToLocalDate(dateIso) {
  if (!dateIso) return null;
  const [year, month, day] = dateIso.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function formatCashflowDateObj(dateObj) {
  const day = String(dateObj.getDate()).padStart(2, "0");
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const year = dateObj.getFullYear();
  return `${day}/${month}/${year}`;
}

function buildCashflowCategoryBreakdown(entries, type) {
  const totals = new Map();
  const categories = cashflowCategories[type] || [];

  for (const entry of entries) {
    if (entry.type !== type) continue;

    const storedCategoryValue = String(entry.category || "").trim();
    const catObj = categories.find(
      (c) => c.id === storedCategoryValue || c.name === storedCategoryValue,
    );
    const key = catObj ? catObj.name : storedCategoryValue || "Khác";
    totals.set(key, (totals.get(key) || 0) + (entry.amount || 0));
  }

  const items = Array.from(totals.entries())
    .map(([name, amount], index) => ({
      name,
      amount,
      color: CASHFLOW_PIE_COLORS[index % CASHFLOW_PIE_COLORS.length],
    }))
    .sort((a, b) => b.amount - a.amount);

  const total = items.reduce((sum, item) => sum + item.amount, 0);

  return {
    total,
    items: items.map((item) => ({
      ...item,
      percent: total > 0 ? (item.amount / total) * 100 : 0,
    })),
  };
}

function renderCashflowPieCharts() {
  const captionEl = document.getElementById("cashflowAnalysisCaption");
  const { entries, label } = getCashflowEntriesByRange();
  if (captionEl) {
    captionEl.innerText = label;
  }

  const incomeData = buildCashflowCategoryBreakdown(entries, "income");
  const expenseData = buildCashflowCategoryBreakdown(entries, "expense");

  renderCashflowPieChartCard({
    canvasId: "cashflowIncomePieChart",
    legendId: "cashflowIncomePieLegend",
    emptyMessage: "Chưa có khoản thu trong phạm vi đang chọn.",
    totalLabel: "Tổng thu",
    data: incomeData,
  });

  renderCashflowPieChartCard({
    canvasId: "cashflowExpensePieChart",
    legendId: "cashflowExpensePieLegend",
    emptyMessage: "Chưa có khoản chi trong phạm vi đang chọn.",
    totalLabel: "Tổng chi",
    data: expenseData,
  });
}

function renderCashflowPieChartCard({
  canvasId,
  legendId,
  emptyMessage,
  totalLabel,
  data,
}) {
  const canvas = document.getElementById(canvasId);
  const legend = document.getElementById(legendId);
  if (!canvas || !legend) return;

  if (!data.items.length || data.total <= 0) {
    drawCashflowPieEmptyState(canvas, emptyMessage);
    legend.innerHTML = `<div class="cashflow-pie-empty">${emptyMessage}</div>`;
    return;
  }

  drawCashflowPieChart(canvas, data.items, {
    total: data.total,
    totalLabel,
  });

  legend.innerHTML = data.items
    .map(
      (item) => `
        <div class="cashflow-pie-legend-item">
          <span class="cashflow-pie-legend-color" style="background:${item.color}"></span>
          <div class="cashflow-pie-legend-label">
            <div class="cashflow-pie-legend-name">${escapeHtml(item.name)}</div>
            <div class="cashflow-pie-legend-meta">${item.percent.toFixed(1)}% tổng</div>
          </div>
          <div class="cashflow-pie-legend-value">${formatVnd(item.amount)}</div>
        </div>
      `,
    )
    .join("");
}

function drawCashflowPieEmptyState(canvas, message) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.parentElement?.clientWidth || 320;
  const height = canvas.parentElement?.clientHeight || 220;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = "rgba(5, 12, 24, 0.45)";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#9cb4d7";
  ctx.font = '13px "Be Vietnam Pro", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  wrapCanvasText(ctx, message, width / 2, height / 2, width - 48, 20);
}

function drawCashflowPieChart(canvas, items, { total, totalLabel }) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.parentElement?.clientWidth || 320;
  const height = canvas.parentElement?.clientHeight || 240;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.36;
  const innerRadius = radius * 0.54;
  let startAngle = -Math.PI / 2;

  items.forEach((item) => {
    const sliceAngle = (item.amount / total) * Math.PI * 2;
    const endAngle = startAngle + sliceAngle;

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = item.color;
    ctx.fill();

    startAngle = endAngle;
  });

  ctx.beginPath();
  ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(7, 16, 34, 0.98)";
  ctx.fill();
  ctx.strokeStyle = "rgba(183, 208, 255, 0.12)";
  ctx.lineWidth = 1;
  ctx.stroke();

  const labelFontSize = Math.max(11, Math.min(13, innerRadius * 0.18));
  ctx.fillStyle = "#8db4ff";
  ctx.font = `600 ${labelFontSize}px "Be Vietnam Pro", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(totalLabel, centerX, centerY - innerRadius * 0.24);

  ctx.fillStyle = "#eff6ff";
  fitAndDrawCanvasText(ctx, formatVnd(total), {
    x: centerX,
    y: centerY + innerRadius * 0.12,
    maxWidth: innerRadius * 1.45,
    maxFontSize: Math.max(13, Math.min(18, innerRadius * 0.24)),
    minFontSize: 11,
    lineHeight: 18,
    fontWeight: 700,
    fontFamily: '"Space Grotesk", "Be Vietnam Pro", sans-serif',
  });
}

function fitAndDrawCanvasText(
  ctx,
  text,
  {
    x,
    y,
    maxWidth,
    maxFontSize,
    minFontSize,
    lineHeight,
    fontWeight,
    fontFamily,
  },
) {
  let fontSize = maxFontSize;
  let lines = [];

  while (fontSize >= minFontSize) {
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    lines = measureCanvasWrappedLines(ctx, text, maxWidth);
    const widestLine = Math.max(
      ...lines.map((line) => ctx.measureText(line).width),
      0,
    );
    if (widestLine <= maxWidth && lines.length <= 2) {
      break;
    }
    fontSize -= 1;
  }

  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  wrapCanvasText(ctx, text, x, y, maxWidth, Math.max(lineHeight, fontSize + 2));
}

function measureCanvasWrappedLines(ctx, text, maxWidth) {
  const words = String(text).split(" ");
  const lines = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text).split(" ");
  const lines = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) lines.push(currentLine);

  const totalHeight = (lines.length - 1) * lineHeight;
  lines.forEach((line, index) => {
    ctx.fillText(line, x, y - totalHeight / 2 + index * lineHeight);
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderCashflowMonthSummary() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const today = new Date(currentYear, now.getMonth(), now.getDate());
  const day = today.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() + mondayOffset);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  const weekStartStr = `${startOfWeek.getFullYear()}-${String(startOfWeek.getMonth() + 1).padStart(2, "0")}-${String(startOfWeek.getDate()).padStart(2, "0")}`;
  const weekEndStr = `${endOfWeek.getFullYear()}-${String(endOfWeek.getMonth() + 1).padStart(2, "0")}-${String(endOfWeek.getDate()).padStart(2, "0")}`;

  let income = 0;
  let expense = 0;

  for (const entry of cashflowEntries) {
    const entryDate = entry.date;

    if (cashflowSummaryRange === "all") {
      if (entry.type === "income") income += entry.amount;
      else expense += entry.amount;
    } else if (cashflowSummaryRange === "year") {
      const [y] = entryDate.split("-").map(Number);
      if (y === currentYear) {
        if (entry.type === "income") income += entry.amount;
        else expense += entry.amount;
      }
    } else if (cashflowSummaryRange === "month") {
      const [y, m] = entryDate.split("-").map(Number);
      if (y === currentYear && m === currentMonth) {
        if (entry.type === "income") income += entry.amount;
        else expense += entry.amount;
      }
    } else if (cashflowSummaryRange === "week") {
      if (entryDate >= weekStartStr && entryDate <= weekEndStr) {
        if (entry.type === "income") income += entry.amount;
        else expense += entry.amount;
      }
    }
  }

  const net = income - expense;
  document.getElementById("cashflowIncomeMonth").innerText =
    `${income.toLocaleString("vi-VN")} đ`;
  document.getElementById("cashflowExpenseMonth").innerText =
    `${expense.toLocaleString("vi-VN")} đ`;

  const netEl = document.getElementById("cashflowNetMonth");
  netEl.innerText = `${net.toLocaleString("vi-VN")} đ`;
  netEl.style.color = net >= 0 ? "#8fe5b7" : "#ffb3b3";

  const cards = document.querySelectorAll(".cashflow-summary-card");
  cards.forEach((card) => {
    card.classList.remove("is-animating");
    void card.offsetWidth;
    card.classList.add("is-animating");
    setTimeout(() => card.classList.remove("is-animating"), 400);
  });
}

function renderCashflowRecentList() {
  const listEl = document.getElementById("cashflowRecentList");
  const viewAllBtn = document.getElementById("cashflowViewAllBtn");
  listEl.innerHTML = "";

  if (cashflowEntries.length === 0) {
    selectedCashflowId = "";
    closeCashflowQuickViewModal();
    if (viewAllBtn) viewAllBtn.style.display = "none";
    const empty = document.createElement("div");
    empty.className = "app-empty-state";
    empty.innerHTML = `
      <div class="app-empty-icon">💰</div>
      <div class="app-empty-title">Chưa có giao dịch nào</div>
      <div class="app-empty-desc">Hãy thêm khoản thu hoặc chi đầu tiên của bạn.</div>
    `;
    listEl.appendChild(empty);
    renderCashflowQuickView();
    return;
  }

  const selectedEntry = ensureSelectedCashflowEntry();
  const hasMoreThanDefault = cashflowEntries.length > 5;
  const visibleEntries = cashflowShowAllRecent
    ? cashflowEntries
    : cashflowEntries.slice(0, 6);

  if (viewAllBtn) {
    viewAllBtn.style.display = hasMoreThanDefault ? "inline-flex" : "none";
    viewAllBtn.innerText = cashflowShowAllRecent ? "Thu gọn" : "Xem tất cả";
  }

  for (const entry of visibleEntries) {
    const row = document.createElement("div");
    row.className = "cashflow-row";
    row.tabIndex = 0;
    row.setAttribute("role", "button");
    row.setAttribute("aria-label", `Xem chi tiết giao dịch ${getCashflowCategoryLabel(entry.type, entry.category)}`);
    if (selectedEntry && selectedEntry.id === entry.id) {
      row.classList.add("is-selected");
    }
    row.addEventListener("click", () => {
      selectedCashflowId = entry.id;
      activeQuickViewEntry = entry;
      renderCashflowQuickView();
      openCashflowQuickViewModal();
      renderCashflowRecentList();
    });
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectedCashflowId = entry.id;
        activeQuickViewEntry = entry;
        renderCashflowQuickView();
        openCashflowQuickViewModal();
        renderCashflowRecentList();
      }
    });

    const metaEl = document.createElement("div");
    metaEl.className = "cashflow-row-meta";

    const topLineEl = document.createElement("div");
    topLineEl.className = "cashflow-row-topline";

    const typeBadgeEl = document.createElement("span");
    typeBadgeEl.className = `cashflow-row-type ${entry.type === "income" ? "is-income" : "is-expense"}`;
    typeBadgeEl.innerText = getCashflowTypeLabel(entry.type);

    const categoryBadgeEl = document.createElement("span");
    categoryBadgeEl.className = "cashflow-row-category";
    categoryBadgeEl.innerText = getCashflowCategoryLabel(
      entry.type,
      entry.category,
    );

    topLineEl.appendChild(typeBadgeEl);
    topLineEl.appendChild(categoryBadgeEl);

    const noteEl = document.createElement("div");
    noteEl.className = "cashflow-row-note";
    noteEl.innerText = entry.note || "Không có ghi chú";

    const sublineEl = document.createElement("div");
    sublineEl.className = "cashflow-row-subline";
    sublineEl.innerText = `Ngày giao dịch: ${formatCashflowDate(entry.date)} • Cập nhật: ${formatTimestampForCsv(entry.updatedAt || entry.createdAt) || "Chưa rõ"}`;

    metaEl.appendChild(topLineEl);

    const amountEl = document.createElement("div");
    amountEl.className = `cashflow-row-amount ${entry.type === "income" ? "is-income" : "is-expense"}`;
    amountEl.innerText = `${entry.type === "income" ? "+" : "-"}${entry.amount.toLocaleString("vi-VN")} đ`;

    const actionsEl = document.createElement("div");
    actionsEl.className = "cashflow-row-actions";

    const actionBtn = document.createElement("button");
    actionBtn.className = "cashflow-action-btn";
    actionBtn.type = "button";
    actionBtn.title = "Tùy chọn";
    actionBtn.setAttribute("aria-label", "Tùy chọn");
    actionBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="8" cy="3" r="1.5"/>
      <circle cx="8" cy="8" r="1.5"/>
      <circle cx="8" cy="13" r="1.5"/>
    </svg>`;
    actionBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleCashflowAction(actionBtn);
    });

    const dropdownEl = document.createElement("div");
    dropdownEl.className = "cashflow-action-dropdown";

    const editItem = document.createElement("button");
    editItem.className = "cashflow-action-item";
    editItem.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg> Sửa giao dịch`;
    editItem.addEventListener("click", (event) => {
      event.stopPropagation();
      startCashflowEdit(entry.id);
      closeCashflowActionDropdown();
    });

    const deleteItem = document.createElement("button");
    deleteItem.className = "cashflow-action-item danger";
    deleteItem.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    </svg> Xóa giao dịch`;
    deleteItem.addEventListener("click", (event) => {
      event.stopPropagation();
      removeCashflowEntry(entry.id);
      closeCashflowActionDropdown();
    });

    dropdownEl.appendChild(editItem);
    dropdownEl.appendChild(deleteItem);
    actionsEl.appendChild(actionBtn);
    actionsEl.appendChild(dropdownEl);

    row.appendChild(topLineEl);
    row.appendChild(amountEl);
    row.appendChild(actionsEl);
    row.appendChild(noteEl);
    row.appendChild(sublineEl);

    if (entry.image && entry.image.trim() && entry.image.startsWith("data:")) {
      const imageEl = document.createElement("img");
      imageEl.className = "cashflow-row-image";
      imageEl.src = entry.image;
      imageEl.alt = "Ảnh mô tả";
      imageEl.loading = "lazy";
      imageEl.addEventListener("click", (e) => {
        e.stopPropagation();
        selectedCashflowId = entry.id;
        renderCashflowRecentList();
        openCashflowQuickViewModal();
      });
      row.appendChild(imageEl);
    }

    listEl.appendChild(row);
  }

  renderCashflowQuickView();
}

function toggleCashflowRecentList() {
  cashflowShowAllRecent = !cashflowShowAllRecent;
  renderCashflowRecentList();
}

async function openCashflowAllTransactionsModal() {
  const modal = document.getElementById("cashflowAllTransactionsModal");
  if (!modal) return;

  reloadCashflowEntriesFromCache();
  renderCashflowAllTransactionsList();
  modal.style.display = "flex";

  if (firebaseDb && userProfileKey) {
    try {
      const datesRef = firebaseDatesRef || firebaseDb.ref(`${FIREBASE_EVENTS_PATH}/${userProfileKey}/dates`);
      const snap = await datesRef.once("value");
      const remoteDates = snap.val() || {};
      let updated = false;
      Object.keys(remoteDates).forEach((dKey) => {
        if (!isDateKey(dKey)) return;
        if (!isDateRecordTrusted(remoteDates[dKey])) return;
        dateDataCache[dKey] = normalizeDateData(remoteDates[dKey]);
        updated = true;
      });
      if (updated && modal.style.display === "flex") {
        reloadCashflowEntriesFromCache();
        renderCashflowAllTransactionsList();
      }
    } catch (e) { }
  }
}

function renderCashflowAllTransactionsList() {
  const listEl = document.getElementById("cashflowAllList");
  if (!listEl) return;
  listEl.innerHTML = "";

  if (cashflowEntries.length === 0) {
    const empty = document.createElement("div");
    empty.className = "app-empty-state";
    empty.innerHTML = `
      <div class="app-empty-icon">📊</div>
      <div class="app-empty-title">Chưa có giao dịch nào</div>
      <div class="app-empty-desc">Tất cả các khoản thu chi của bạn sẽ xuất hiện tại đây.</div>
    `;
    listEl.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const entry of cashflowEntries) {
    const row = document.createElement("div");
    row.className = "cashflow-row";
    row.tabIndex = 0;
    row.setAttribute("role", "button");

    const metaEl = document.createElement("div");
    metaEl.className = "cashflow-row-meta";

    const topLineEl = document.createElement("div");
    topLineEl.className = "cashflow-row-topline";

    const typeBadgeEl = document.createElement("span");
    typeBadgeEl.className = `cashflow-row-type ${entry.type === "income" ? "is-income" : "is-expense"}`;
    typeBadgeEl.innerText = getCashflowTypeLabel(entry.type);

    const categoryBadgeEl = document.createElement("span");
    categoryBadgeEl.className = "cashflow-row-category";
    categoryBadgeEl.innerText = getCashflowCategoryLabel(entry.type, entry.category);

    topLineEl.appendChild(typeBadgeEl);
    topLineEl.appendChild(categoryBadgeEl);

    const noteEl = document.createElement("div");
    noteEl.className = "cashflow-row-note";
    noteEl.innerText = entry.note || "Không có ghi chú";

    const sublineEl = document.createElement("div");
    sublineEl.className = "cashflow-row-subline";
    sublineEl.innerText = `Ngày giao dịch: ${formatCashflowDate(entry.date)} • Cập nhật: ${formatTimestampForCsv(entry.updatedAt || entry.createdAt) || "Chưa rõ"}`;

    metaEl.appendChild(topLineEl);

    const amountEl = document.createElement("div");
    amountEl.className = `cashflow-row-amount ${entry.type === "income" ? "is-income" : "is-expense"}`;
    amountEl.innerText = `${entry.type === "income" ? "+" : "-"}${entry.amount.toLocaleString("vi-VN")} đ`;

    const actionsEl = document.createElement("div");
    actionsEl.className = "cashflow-row-actions";

    const actionBtn = document.createElement("button");
    actionBtn.className = "cashflow-action-btn";
    actionBtn.type = "button";
    actionBtn.title = "Tùy chọn";
    actionBtn.setAttribute("aria-label", "Tùy chọn");
    actionBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="8" cy="3" r="1.5"/>
      <circle cx="8" cy="8" r="1.5"/>
      <circle cx="8" cy="13" r="1.5"/>
    </svg>`;
    actionBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleCashflowAction(actionBtn);
    });

    const dropdownEl = document.createElement("div");
    dropdownEl.className = "cashflow-action-dropdown";

    const editItem = document.createElement("button");
    editItem.className = "cashflow-action-item";
    editItem.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg> Sửa giao dịch`;
    editItem.addEventListener("click", (event) => {
      event.stopPropagation();
      closeCashflowAllTransactionsModal();
      startCashflowEdit(entry.id);
      closeCashflowActionDropdown();
    });

    const deleteItem = document.createElement("button");
    deleteItem.className = "cashflow-action-item danger";
    deleteItem.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    </svg> Xóa giao dịch`;
    deleteItem.addEventListener("click", (event) => {
      event.stopPropagation();
      removeCashflowEntry(entry.id);
      closeCashflowAllTransactionsModal();
      closeCashflowActionDropdown();
    });

    dropdownEl.appendChild(editItem);
    dropdownEl.appendChild(deleteItem);
    actionsEl.appendChild(actionBtn);
    actionsEl.appendChild(dropdownEl);

    row.appendChild(topLineEl);
    row.appendChild(amountEl);
    row.appendChild(actionsEl);
    row.appendChild(noteEl);
    row.appendChild(sublineEl);

    if (entry.image && entry.image.trim() && entry.image.startsWith("data:")) {
      const imageEl = document.createElement("img");
      imageEl.className = "cashflow-row-image";
      imageEl.src = entry.image;
      imageEl.alt = "Ảnh mô tả";
      imageEl.loading = "lazy";
      row.appendChild(imageEl);
    }

    row.addEventListener("click", () => {
      selectedCashflowId = entry.id;
      activeQuickViewEntry = entry;
      renderCashflowQuickView();
      openCashflowQuickViewModal();
    });
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectedCashflowId = entry.id;
        activeQuickViewEntry = entry;
        renderCashflowQuickView();
        openCashflowQuickViewModal();
      }
    });

    fragment.appendChild(row);
  }
  listEl.appendChild(fragment);
}

function closeCashflowAllTransactionsModal() {
  const modal = document.getElementById("cashflowAllTransactionsModal");
  if (modal) modal.style.display = "none";
}

const CASHFLOW_CHART_MONTHS_KEY = "cashflowChartMonths";
const CASHFLOW_CHART_MONTHS_DEFAULT = 12;

function restoreCashflowChartMonths() {
  try {
    const saved = parseInt(localStorage.getItem(CASHFLOW_CHART_MONTHS_KEY), 10);
    if (saved >= 1 && saved <= 24) {
      cashflowChartMonths = saved;
    }
  } catch {
    cashflowChartMonths = CASHFLOW_CHART_MONTHS_DEFAULT;
  }
}

function applyCashflowMonthSelectValue() {
  const select = document.getElementById("cashflowMonthSelect");
  if (!select) return;

  if (!select.options.length) {
    const fragment = document.createDocumentFragment();
    for (let i = 1; i <= 24; i++) {
      const option = document.createElement("option");
      option.value = String(i);
      option.textContent = `${i} tháng`;
      fragment.appendChild(option);
    }
    select.appendChild(fragment);
  }

  select.value = String(cashflowChartMonths);
}

function onCashflowMonthSelectChange() {
  const select = document.getElementById("cashflowMonthSelect");
  if (!select) return;
  const value = parseInt(select.value, 10);
  if (value < 1 || value > 24) return;
  cashflowChartMonths = value;
  localStorage.setItem(CASHFLOW_CHART_MONTHS_KEY, String(value));
  renderCashflowChart();
}

function buildCashflowByMonth(monthsCount = cashflowChartMonths) {
  const now = new Date();
  const safeMonthsCount = Math.max(1, Math.min(monthsCount, 24));
  const months = [];
  for (let i = safeMonthsCount - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: `T${d.getMonth() + 1}/${d.getFullYear().toString().slice(-2)}`,
      income: 0,
      expense: 0,
    });
  }

  for (const entry of cashflowEntries) {
    const [year, month] = entry.date.split("-").map(Number);
    const target = months.find(
      (item) => item.year === year && item.month === month,
    );
    if (!target) continue;
    if (entry.type === "income") target.income += entry.amount;
    else target.expense += entry.amount;
  }

  return months;
}

let cashflowChartHovered = null;

function renderCashflowChart() {
  const canvas = document.getElementById("cashflowChart");
  const tooltip = document.getElementById("cashflowChartTooltip");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const rows = buildCashflowByMonth(cashflowChartMonths);
  const maxVal = Math.max(
    1,
    ...rows.map((row) => Math.max(row.income, row.expense)),
  );

  const dpr = window.devicePixelRatio || 1;
  const wrap = canvas.parentElement;
  const cssW = wrap.clientWidth;
  const cssH = wrap.clientHeight;
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  ctx.scale(dpr, dpr);

  const W = cssW;
  const H = cssH;
  const padL = 8;
  const padR = 8;
  const padT = 16;
  const padB = 30;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  ctx.clearRect(0, 0, W, H);

  ctx.strokeStyle = "rgba(154, 183, 231, 0.12)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 3; i++) {
    const y = padT + chartH - (chartH * i) / 3;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(padL + chartW, y);
    ctx.stroke();
  }

  const n = rows.length;
  const groupGap = 3;
  const groupW = Math.max(9, (chartW - groupGap * (n - 1)) / n);
  const oneBarW = Math.max(3, Math.floor((groupW - 2) / 2));
  const now = new Date();

  const barPositions = canvas._barPositions || [];

  rows.forEach((row, i) => {
    const gx = padL + i * (groupW + groupGap);
    const yBottom = padT + chartH;
    const incomeH = (row.income / maxVal) * chartH;
    const expenseH = (row.expense / maxVal) * chartH;
    const nowMonth =
      row.year === now.getFullYear() && row.month === now.getMonth() + 1;

    const incomeX = gx;
    const expenseX = gx + oneBarW + 2;

    barPositions[i] = {
      index: i,
      income: { x: incomeX, y: yBottom - incomeH, w: oneBarW, h: incomeH, value: row.income },
      expense: { x: expenseX, y: yBottom - expenseH, w: oneBarW, h: expenseH, value: row.expense },
    };

    if (row.income > 0) {
      const gi = ctx.createLinearGradient(
        incomeX,
        yBottom - incomeH,
        incomeX,
        yBottom,
      );
      gi.addColorStop(0, nowMonth ? "#53d792" : "#32b873");
      gi.addColorStop(1, nowMonth ? "#249965" : "#1c7b4d");
      ctx.fillStyle = gi;
      ctx.beginPath();
      ctx.roundRect(incomeX, yBottom - incomeH, oneBarW, incomeH, [3, 3, 0, 0]);
      ctx.fill();
    }

    if (row.expense > 0) {
      const ge = ctx.createLinearGradient(
        expenseX,
        yBottom - expenseH,
        expenseX,
        yBottom,
      );
      ge.addColorStop(0, nowMonth ? "#ff8080" : "#f25f5f");
      ge.addColorStop(1, nowMonth ? "#ca4848" : "#b73737");
      ctx.fillStyle = ge;
      ctx.beginPath();
      ctx.roundRect(
        expenseX,
        yBottom - expenseH,
        oneBarW,
        expenseH,
        [3, 3, 0, 0],
      );
      ctx.fill();
    }

    if (row.income <= 0 && row.expense <= 0) {
      ctx.fillStyle = "rgba(154, 183, 231, 0.1)";
      ctx.fillRect(gx, yBottom - 2, groupW, 2);
    }

    ctx.fillStyle = nowMonth ? "#a8cbff" : "#7a9ac8";
    ctx.font = `${nowMonth ? "bold " : ""}9px "Be Vietnam Pro", sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(row.label, gx + groupW / 2, H - 10);
  });

  canvas._barPositions = barPositions;
  attachCashflowChartHover();
}

function getBarCenter(meta) {
  const midX = meta.income.x + meta.income.w / 2;
  const topY = Math.min(meta.income.y, meta.expense.y);
  return { midX, topY };
}

function showCashflowChartTooltip(meta) {
  const tooltip = document.getElementById("cashflowChartTooltip");
  if (!tooltip) return;

  if (meta.income.value > 0) {
    tooltip.innerHTML = `<strong>Thu: ${meta.income.value.toLocaleString("vi-VN")} đ</strong>`;
  }
  if (meta.expense.value > 0) {
    tooltip.innerHTML = `<strong>Chi: ${meta.expense.value.toLocaleString("vi-VN")} đ</strong>`;
  }
  if (meta.income.value > 0 && meta.expense.value > 0) {
    tooltip.innerHTML = `<strong>Thu: ${meta.income.value.toLocaleString("vi-VN")} đ<br>Chi: ${meta.expense.value.toLocaleString("vi-VN")} đ</strong>`;
  }
  if (!meta.income.value && !meta.expense.value) {
    tooltip.innerHTML = `<strong>0 đ</strong>`;
  }

  tooltip.style.display = "block";
}

function positionCashflowTooltip(meta) {
  const tooltip = document.getElementById("cashflowChartTooltip");
  if (!tooltip) return;

  const { midX, topY } = getBarCenter(meta);
  const wrap = tooltip.parentElement;
  const canvas = document.getElementById("cashflowChart");
  if (!wrap || !canvas) return;

  const tooltipRect = tooltip.getBoundingClientRect();
  const wrapRect = wrap.getBoundingClientRect();
  const canvasRect = canvas.getBoundingClientRect();

  const relLeft = midX + (canvasRect.left - wrapRect.left);
  const relTop = topY + (canvasRect.top - wrapRect.top);

  const left = relLeft - tooltipRect.width / 2;
  tooltip.style.left = `${Math.max(4, Math.min(left, wrap.clientWidth - tooltipRect.width - 4))}px`;
  tooltip.style.top = `${Math.max(4, relTop - tooltipRect.height - 6)}px`;
}

function hideCashflowChartTooltip() {
  const tooltip = document.getElementById("cashflowChartTooltip");
  if (tooltip) {
    tooltip.style.display = "none";
  }
}

function handleCashflowChartHover(event) {
  const canvas = document.getElementById("cashflowChart");
  const tooltip = document.getElementById("cashflowChartTooltip");
  if (!canvas || !tooltip) return;

  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const positions = canvas._barPositions;

  let matched = null;
  if (positions) {
    for (let i = 0; i < positions.length; i++) {
      const bar = positions[i];
      const topY = Math.min(bar.income.y, bar.expense.y);
      const bottomY = Math.max(
        bar.income.y + bar.income.h,
        bar.expense.y + bar.expense.h,
      );
      if (
        x >= bar.income.x - 4 &&
        x <= bar.expense.x + bar.expense.w + 4 &&
        y >= topY - 4 &&
        y <= bottomY + 4
      ) {
        matched = bar;
        break;
      }
    }
  }

  if (matched) {
    if (cashflowChartHovered !== matched.index) {
      cashflowChartHovered = matched.index;
    }
    showCashflowChartTooltip(matched);
    positionCashflowTooltip(matched);
  } else {
    if (cashflowChartHovered !== null) {
      cashflowChartHovered = null;
    }
    tooltip.style.display = "none";
  }
}

function handleCashflowChartClick(event) {
  const canvas = document.getElementById("cashflowChart");
  const tooltip = document.getElementById("cashflowChartTooltip");
  if (!canvas || !tooltip) return;

  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const positions = canvas._barPositions;

  let matched = null;
  if (positions) {
    for (let i = 0; i < positions.length; i++) {
      const bar = positions[i];
      const topY = Math.min(bar.income.y, bar.expense.y);
      const bottomY = Math.max(
        bar.income.y + bar.income.h,
        bar.expense.y + bar.expense.h,
      );
      if (
        x >= bar.income.x - 4 &&
        x <= bar.expense.x + bar.expense.w + 4 &&
        y >= topY - 4 &&
        y <= bottomY + 4
      ) {
        matched = bar;
        break;
      }
    }
  }

  if (matched) {
    if (cashflowChartHovered === matched.index && tooltip.style.display === "block") {
      tooltip.style.display = "none";
      cashflowChartHovered = null;
    } else {
      cashflowChartHovered = matched.index;
      showCashflowChartTooltip(matched);
      positionCashflowTooltip(matched);
    }
  } else {
    tooltip.style.display = "none";
    cashflowChartHovered = null;
  }
}

function attachCashflowChartHover() {
  const canvas = document.getElementById("cashflowChart");
  if (!canvas) return;
  if (canvas._hoverAttached) return;
  canvas._hoverAttached = true;
  canvas.addEventListener("mousemove", handleCashflowChartHover);
  canvas.addEventListener("mouseleave", () => {
    cashflowChartHovered = null;
    hideCashflowChartTooltip();
  });
  canvas.addEventListener("click", handleCashflowChartClick);
}

function formatCashflowDate(dateIso) {
  const [y, m, d] = dateIso.split("-");
  return `${d}/${m}/${y}`;
}

function getCashflowCategoryLabel(type, categoryValue) {
  const normalizedValue = String(categoryValue || "").trim();
  if (!normalizedValue) return "Chưa phân loại";

  // 1. Search in current type categories
  const categories = cashflowCategories[type] || [];
  let matchedCategory = categories.find(
    (category) =>
      String(category?.id || "").trim() === normalizedValue ||
      String(category?.name || "").trim() === normalizedValue,
  );

  // 2. Fallback: Search in all active cashflowCategories (income + expense)
  if (!matchedCategory) {
    const allActive = [
      ...(cashflowCategories.income || []),
      ...(cashflowCategories.expense || []),
    ];
    matchedCategory = allActive.find(
      (category) =>
        String(category?.id || "").trim() === normalizedValue ||
        String(category?.name || "").trim() === normalizedValue,
    );
  }

  // 3. Fallback: Search in default categories
  if (!matchedCategory) {
    const defaults = getDefaultCategories();
    const allDefaults = [
      ...(defaults.income || []),
      ...(defaults.expense || []),
    ];
    matchedCategory = allDefaults.find(
      (category) =>
        String(category?.id || "").trim() === normalizedValue ||
        String(category?.name || "").trim() === normalizedValue,
    );
  }

  return matchedCategory?.name || normalizedValue;
}

function getCashflowTypeLabel(type) {
  return type === "income" ? "Khoản thu" : "Khoản chi";
}

function getSelectedCashflowEntry() {
  if (!selectedCashflowId) return null;
  return cashflowEntries.find((entry) => entry.id === selectedCashflowId) || null;
}

function openCashflowQuickViewModal() {
  const modal = document.getElementById("cashflowQuickViewModal");
  if (!modal) return;
  const atModal = document.getElementById("cashflowAllTransactionsModal");
  if (atModal) atModal.style.pointerEvents = "none";
  modal.style.display = "flex";
}

let activeQuickViewEntry = null;

function closeCashflowQuickViewModal() {
  activeQuickViewEntry = null;
  const modal = document.getElementById("cashflowQuickViewModal");
  if (modal) modal.style.display = "none";
  const atModal = document.getElementById("cashflowAllTransactionsModal");
  if (atModal) atModal.style.pointerEvents = "";
}

function ensureSelectedCashflowEntry() {
  if (cashflowEntries.length === 0) {
    selectedCashflowId = "";
    return null;
  }

  const selectedEntry = getSelectedCashflowEntry();
  if (selectedEntry) return selectedEntry;

  selectedCashflowId = cashflowEntries[0].id;
  return cashflowEntries[0];
}

function renderCashflowQuickView() {
  const quickViewEl = document.getElementById("cashflowQuickView");
  if (!quickViewEl) return;

  const entry = activeQuickViewEntry || ensureSelectedCashflowEntry();
  if (!entry) {
    quickViewEl.innerHTML =
      '<div class="cashflow-quickview-empty">Chọn một giao dịch để xem nhanh đầy đủ chi tiết.</div>';
    return;
  }

  const typeLabel = getCashflowTypeLabel(entry.type);
  const categoryLabel = getCashflowCategoryLabel(entry.type, entry.category);
  const updatedLabel =
    formatTimestampForCsv(entry.updatedAt || entry.createdAt) || "Chưa rõ";
  const createdLabel = formatTimestampForCsv(entry.createdAt) || "Chưa rõ";
  const noteLabel = entry.note || "Không có ghi chú";
  const amountLabel = `${entry.type === "income" ? "+" : "-"}${entry.amount.toLocaleString("vi-VN")} đ`;
  const imageHtml = entry.image && entry.image.trim() && entry.image.startsWith("data:")
    ? `<div class="cashflow-quickview-image"><img src="${entry.image}" alt="Ảnh mô tả" /></div>`
    : "";

  quickViewEl.innerHTML = `
    <div class="cashflow-quickview-head">
      <div>
        <div class="cashflow-quickview-eyebrow">Xem nhanh giao dịch</div>
        <div class="cashflow-quickview-title">${typeLabel} • ${categoryLabel}</div>
      </div>
      <div class="cashflow-quickview-amount ${entry.type === "income" ? "is-income" : "is-expense"}">${amountLabel}</div>
    </div>
    <div class="cashflow-quickview-note">${noteLabel}</div>
    ${imageHtml}
    <div class="cashflow-quickview-grid">
      <div class="cashflow-quickview-item">
        <span class="cashflow-quickview-label">Ngày giao dịch</span>
        <strong>${formatCashflowDate(entry.date)}</strong>
      </div>
      <div class="cashflow-quickview-item">
        <span class="cashflow-quickview-label">Danh mục</span>
        <strong>${categoryLabel}</strong>
      </div>
      <div class="cashflow-quickview-item">
        <span class="cashflow-quickview-label">Tạo lúc</span>
        <strong>${createdLabel}</strong>
      </div>
      <div class="cashflow-quickview-item">
        <span class="cashflow-quickview-label">Cập nhật</span>
        <strong>${updatedLabel}</strong>
      </div>
      <div class="cashflow-quickview-item cashflow-quickview-item-full">
        <span class="cashflow-quickview-label">Mã giao dịch</span>
        <strong>${entry.id}</strong>
      </div>
    </div>
    <div class="cashflow-quickview-actions" style="display: flex; gap: 10px; margin-top: 18px; justify-content: flex-end; align-items: center; flex-wrap: wrap;">
      <button type="button" class="cashflow-quickview-btn-primary" style="display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 8px 16px; font-size: 13px; font-weight: 600; color: #ffffff !important; background: linear-gradient(135deg, #3b82f6, #2563eb); border: 1px solid rgba(147, 197, 253, 0.35); border-radius: 10px; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.3); cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);" onclick="closeCashflowQuickViewModal(); openCashflowAllTransactionsModal();">
        📋 Xem tất cả thu chi
      </button>
    </div>
  `;
}

(function initCashflowModal() {
  reloadCashflowEntriesFromCache();

  const modal = document.getElementById("cashflowModal");
  modal.addEventListener("click", function (e) {
    if (e.target === this) closeCashflowModal();
  });

  const quickViewModal = document.getElementById("cashflowQuickViewModal");
  if (quickViewModal) {
    quickViewModal.addEventListener("click", function (e) {
      if (e.target === this) closeCashflowQuickViewModal();
    });
  }

  const allTransactionsModal = document.getElementById("cashflowAllTransactionsModal");
  if (allTransactionsModal) {
    allTransactionsModal.addEventListener("click", function (e) {
      if (e.target === this) closeCashflowAllTransactionsModal();
    });
  }

  const amountInput = document.getElementById("cashflowAmount");
  amountInput.addEventListener("input", () => {
    formatCurrencyInput(amountInput);
  });

  const dateInput = document.getElementById("cashflowDate");
  if (!dateInput.value) {
    dateInput.value = getTodayIsoDate();
  }

  syncCashflowFormMode();
  syncCashflowRangeFilterUI();

  window.addEventListener("resize", () => {
    if (document.getElementById("cashflowModal").style.display === "flex") {
      renderCashflowChart();
      renderCashflowPieCharts();
    }
    const moreDropdown = document.getElementById("moreMenuDropdown");
    if (moreDropdown && moreDropdown.classList.contains("is-open")) {
      positionMoreMenu();
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      const qvModal = document.getElementById("cashflowQuickViewModal");
      const atModal = document.getElementById("cashflowAllTransactionsModal");
      const qvVisible = qvModal && qvModal.style.display === "flex";

      if (qvVisible) {
        closeCashflowQuickViewModal();
      } else if (atModal && atModal.style.display === "flex") {
        closeCashflowAllTransactionsModal();
      }
    }
  });

  const deleteConfirmModal = document.getElementById(
    "cashflowDeleteConfirmModal",
  );
  if (deleteConfirmModal) {
    deleteConfirmModal.addEventListener("click", function (e) {
      if (e.target === this) closeCashflowDeleteConfirmModal();
    });
  }
})();

renderOvertime();

/* ========================== LOẠI THU CHI ========================== */
const FIREBASE_CATEGORIES_PATH = "cashflowCategories";
let firebaseCategoriesRef = null;
let cashflowCategories = getDefaultCategories();

function getDefaultCategories() {
  return {
    income: [
      { id: "income-1", name: "Lương" },
      { id: "income-2", name: "Thưởng" },
      { id: "income-3", name: "Phụ cấp" },
      { id: "income-4", name: "Thu nhập phụ" },
      { id: "income-5", name: "Khác" },
    ],
    expense: [
      { id: "expense-1", name: "Ăn uống" },
      { id: "expense-2", name: "Đi lại" },
      { id: "expense-3", name: "Nhà ở" },
      { id: "expense-4", name: "Điện nước" },
      { id: "expense-5", name: "Internet/Điện thoại" },
      { id: "expense-6", name: "Y tế" },
      { id: "expense-7", name: "Mua sắm" },
      { id: "expense-8", name: "Giải trí" },
      { id: "expense-9", name: "Giáo dục" },
      { id: "expense-10", name: "Khác" },
    ],
  };
}

function initCategoriesFirebase() {
  if (!firebaseDb || !userProfileKey) {
    console.log(
      "Firebase not ready: db=",
      !!firebaseDb,
      "userKey=",
      userProfileKey,
    );
    return;
  }
  console.log(
    "Initializing categories Firebase with path:",
    FIREBASE_CATEGORIES_PATH,
    userProfileKey,
  );
  firebaseCategoriesRef = firebaseDb.ref(
    `${FIREBASE_CATEGORIES_PATH}/${userProfileKey}`,
  );

  firebaseCategoriesRef.on(
    "value",
    async (snapshot) => {
      console.log("Categories snapshot received:", snapshot.val());
      const data = snapshot.val();
      if (data && data.income && data.expense) {
        cashflowCategories = data;
      } else if (!snapshot.exists()) {
        console.log("No categories exist, creating defaults");
        cashflowCategories = getDefaultCategories();
        saveCashflowCategoriesToFirebase();
      }
      updateCashflowCategoryDropdowns();
      if (typeof renderCashflowDashboard === "function") {
        renderCashflowDashboard();
      }
      if (typeof renderCashflowAllTransactionsList === "function") {
        renderCashflowAllTransactionsList();
      }
      await migrateCashflowCategoryIdsIfNeeded();
    },
    (error) => {
      console.error("Categories Firebase error:", error);
    },
  );
}

function loadCashflowCategoriesFromStorage() {
  initCategoriesFirebase();
}

function saveCashflowCategoriesToFirebase() {
  if (!firebaseCategoriesRef) {
    console.log("Firebase categories ref not ready yet");
    return;
  }
  console.log("Saving categories to Firebase:", cashflowCategories);
  firebaseCategoriesRef
    .set(cashflowCategories)
    .then(() => {
      console.log("Categories saved to Firebase successfully");
    })
    .catch((err) => {
      console.error("Error saving categories:", err);
    });
}

function saveCashflowCategoriesToStorage() {
  saveCashflowCategoriesToFirebase();
}

function openCashflowCategoryModal() {
  document.getElementById("cashflowCategoryModal").style.display = "flex";
  document.getElementById("cashflowCategoryType").value = "income";
  renderCategoryList();
}

function closeCashflowCategoryModal() {
  document.getElementById("cashflowCategoryModal").style.display = "none";
  cancelCategoryForm();
}

let draggedItem = null;
let categoryTouchDragState = {
  active: false,
  dragging: false,
  list: null,
  item: null,
  itemId: "",
  type: "",
  startY: 0,
  currentY: 0,
  offsetY: 0,
  placeholder: null,
  startedFromHandle: false,
};

function renderCategoryList() {
  const type = document.getElementById("cashflowCategoryType").value;
  const list = document.getElementById("cashflowCategoryList");
  const categories = cashflowCategories[type] || [];
  const typeLabel = type === "income" ? "Thu" : "Chi";

  if (categories.length === 0) {
    list.innerHTML = `
      <div class="app-empty-state">
        <div class="app-empty-icon">🏷️</div>
        <div class="app-empty-title">Chưa có danh mục ${typeLabel} nào</div>
        <div class="app-empty-desc">Nhấn "Thêm loại ${typeLabel.toLowerCase()}" để tạo danh mục mới.</div>
      </div>
    `;
    return;
  }

  list.innerHTML = categories
    .map(
      (cat, index) => `
    <div 
      draggable="true" 
      data-id="${cat.id}" 
      data-index="${index}"
      data-type="${type}"
      style="display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 12px 16px; border-bottom: 1px solid #f0f0f0; cursor: grab; background: white; transition: background 0.15s; user-select: none; -webkit-user-select: none; touch-action: pan-y;"
      class="category-item"
    >
      <button
        type="button"
        data-drag-handle="true"
        aria-label="Kéo để sắp xếp"
        style="border: none; background: transparent; color: #9ca3af; margin-right: 2px; font-size: 18px; line-height: 1; padding: 6px 4px; cursor: grab; touch-action: none;"
      >☰</button>
      <span style="flex: 1; color: #374151; min-width: 0;">${cat.name}</span>
      <div style="display: flex; gap: 4px; flex-shrink: 0;">
        <button onclick="editCategory('${cat.id}')" title="Sửa" style="background: #f3f4f6; border: none; cursor: pointer; padding: 6px 10px; border-radius: 6px; color: #374151; font-size: 13px;">✏️ Sửa</button>
        <button onclick="deleteCategory('${cat.id}')" title="Xóa" style="background: #fef2f2; border: none; cursor: pointer; padding: 6px 10px; border-radius: 6px; color: #dc2626; font-size: 13px;">🗑️ Xóa</button>
      </div>
    </div>
  `,
    )
    .join("");

  initDragDrop();
}

function initDragDrop() {
  const list = document.getElementById("cashflowCategoryList");
  let draggedIndex = null;

  list.querySelectorAll(".category-item").forEach((item) => {
    item.addEventListener("dragstart", function (e) {
      draggedIndex = parseInt(this.dataset.index);
      this.style.opacity = "0.5";
      this.style.background = "#e0f2fe";
      e.dataTransfer.effectAllowed = "move";
    });

    item.addEventListener("dragover", function (e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      this.style.background = "#bae6fd";
    });

    item.addEventListener("dragleave", function () {
      this.style.background = "white";
    });

    item.addEventListener("drop", function (e) {
      e.preventDefault();
      const toIndex = parseInt(this.dataset.index);
      if (draggedIndex === null || draggedIndex === toIndex) return;

      const type = this.dataset.type;
      const items = cashflowCategories[type];
      const [moved] = items.splice(draggedIndex, 1);
      items.splice(toIndex, 0, moved);

      saveCashflowCategoriesToStorage();
      renderCategoryList();
    });

    item.addEventListener("dragend", function () {
      list.querySelectorAll(".category-item").forEach((el) => {
        el.style.opacity = "";
        el.style.background = "white";
      });
      draggedIndex = null;
    });

    item.addEventListener("touchstart", handleCategoryTouchStart, {
      passive: true,
    });
    item.addEventListener("touchmove", handleCategoryTouchMove, {
      passive: false,
    });
    item.addEventListener("touchend", handleCategoryTouchEnd);
    item.addEventListener("touchcancel", resetCategoryTouchDrag);
  });
}

function handleCategoryTouchStart(e) {
  const handle = e.target.closest('[data-drag-handle="true"]');
  if (!handle) return;

  const item = e.currentTarget;
  const list = document.getElementById("cashflowCategoryList");
  if (!item || !list) return;

  const touch = e.touches[0];
  const rect = item.getBoundingClientRect();
  categoryTouchDragState.active = true;
  categoryTouchDragState.dragging = false;
  categoryTouchDragState.list = list;
  categoryTouchDragState.item = item;
  categoryTouchDragState.itemId = item.dataset.id || "";
  categoryTouchDragState.type = item.dataset.type || "income";
  categoryTouchDragState.startY = touch.clientY;
  categoryTouchDragState.currentY = touch.clientY;
  categoryTouchDragState.offsetY = touch.clientY - rect.top;
  categoryTouchDragState.placeholder = null;
  categoryTouchDragState.startedFromHandle = true;
}

function handleCategoryTouchMove(e) {
  if (!categoryTouchDragState.active || !categoryTouchDragState.item) return;

  const touch = e.touches[0];
  categoryTouchDragState.currentY = touch.clientY;
  const deltaY = touch.clientY - categoryTouchDragState.startY;

  if (!categoryTouchDragState.dragging && Math.abs(deltaY) < 8) {
    return;
  }

  e.preventDefault();

  if (!categoryTouchDragState.dragging) {
    startCategoryTouchDragging();
  }

  const { item, list, offsetY } = categoryTouchDragState;
  const listRect = list.getBoundingClientRect();
  const top = touch.clientY - listRect.top - offsetY + list.scrollTop;

  item.style.transform = "none";
  item.style.position = "absolute";
  item.style.left = "0";
  item.style.right = "0";
  item.style.top = `${top}px`;
  item.style.zIndex = "1000";
  item.style.pointerEvents = "none";

  const siblings = Array.from(
    list.querySelectorAll(".category-item:not(.category-item-touch-dragging)"),
  );
  const currentYInList = touch.clientY - listRect.top + list.scrollTop;
  let inserted = false;

  siblings.forEach((sibling) => {
    const siblingTop = sibling.offsetTop;
    const siblingMiddle = siblingTop + sibling.offsetHeight / 2;
    if (!inserted && currentYInList < siblingMiddle) {
      list.insertBefore(categoryTouchDragState.placeholder, sibling);
      inserted = true;
    }
  });

  if (!inserted) {
    list.appendChild(categoryTouchDragState.placeholder);
  }
}

function startCategoryTouchDragging() {
  const { item, list } = categoryTouchDragState;
  if (!item || !list) return;

  categoryTouchDragState.dragging = true;

  const placeholder = item.cloneNode(false);
  placeholder.className = "category-item category-item-placeholder";
  placeholder.removeAttribute("draggable");
  placeholder.innerHTML = "";
  placeholder.style.visibility = "hidden";
  placeholder.style.height = `${item.offsetHeight}px`;
  placeholder.style.margin = "0";
  placeholder.style.borderBottom = "1px solid #f0f0f0";

  categoryTouchDragState.placeholder = placeholder;

  list.insertBefore(placeholder, item.nextSibling);
  list.style.position = "relative";

  item.classList.add("category-item-touch-dragging");
  item.style.width = `${item.offsetWidth}px`;
  item.style.opacity = "0.92";
  item.style.background = "#e0f2fe";
  item.style.boxShadow = "0 10px 24px rgba(15, 23, 42, 0.16)";
}

function handleCategoryTouchEnd() {
  if (!categoryTouchDragState.active) return;

  const { dragging, item, placeholder, type, itemId } = categoryTouchDragState;
  if (!dragging || !item || !placeholder || !type || !itemId) {
    resetCategoryTouchDrag();
    return;
  }

  placeholder.replaceWith(item);

  const items = cashflowCategories[type] || [];
  const fromIndex = items.findIndex((cat) => cat.id === itemId);
  const domItems = Array.from(
    document.querySelectorAll("#cashflowCategoryList .category-item"),
  );
  const toIndex = domItems.findIndex((el) => el.dataset.id === itemId);

  if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
    const [moved] = items.splice(fromIndex, 1);
    items.splice(toIndex, 0, moved);
    saveCashflowCategoriesToStorage();
    renderCategoryList();
  } else {
    resetCategoryTouchDrag();
  }
}

function resetCategoryTouchDrag() {
  const { item, placeholder, list } = categoryTouchDragState;

  if (item) {
    item.classList.remove("category-item-touch-dragging");
    item.style.opacity = "";
    item.style.background = "white";
    item.style.boxShadow = "";
    item.style.width = "";
    item.style.position = "";
    item.style.left = "";
    item.style.right = "";
    item.style.top = "";
    item.style.zIndex = "";
    item.style.pointerEvents = "";
    item.style.transform = "";
  }

  if (placeholder && placeholder.parentNode) {
    placeholder.parentNode.removeChild(placeholder);
  }

  if (list) {
    list.style.position = "";
  }

  categoryTouchDragState.active = false;
  categoryTouchDragState.dragging = false;
  categoryTouchDragState.list = null;
  categoryTouchDragState.item = null;
  categoryTouchDragState.itemId = "";
  categoryTouchDragState.type = "";
  categoryTouchDragState.startY = 0;
  categoryTouchDragState.currentY = 0;
  categoryTouchDragState.offsetY = 0;
  categoryTouchDragState.placeholder = null;
  categoryTouchDragState.startedFromHandle = false;
}

function openAddCategoryForm() {
  document.getElementById("cashflowCategoryForm").style.display = "block";
  document.getElementById("editingCategoryId").value = "";
  document.getElementById("newCategoryName").value = "";
  document.getElementById("newCategoryName").focus();
}

function cancelCategoryForm() {
  document.getElementById("cashflowCategoryForm").style.display = "none";
  document.getElementById("editingCategoryId").value = "";
  document.getElementById("newCategoryName").value = "";
}

function saveCategory() {
  const name = document.getElementById("newCategoryName").value.trim();
  if (!name) {
    alert("Vui lòng nhập tên loại");
    return;
  }

  const editingId = document.getElementById("editingCategoryId").value;
  const type = document.getElementById("cashflowCategoryType").value;

  if (editingId) {
    const cat = cashflowCategories[type].find((c) => c.id === editingId);
    if (cat) cat.name = name;
  } else {
    cashflowCategories[type].push({
      id: `${type}-${Date.now()}`,
      name,
    });
  }

  saveCashflowCategoriesToStorage();
  renderCategoryList();
  cancelCategoryForm();
  updateCashflowCategoryDropdowns();
}

function editCategory(id) {
  const type = document.getElementById("cashflowCategoryType").value;
  const cat = cashflowCategories[type].find((c) => c.id === id);
  if (!cat) return;

  document.getElementById("cashflowCategoryForm").style.display = "block";
  document.getElementById("editingCategoryId").value = id;
  document.getElementById("newCategoryName").value = cat.name;
  document.getElementById("newCategoryName").focus();
}

function deleteCategory(id) {
  showConfirmPopup(
    "Xóa danh mục",
    "Bạn có chắc muốn xóa danh mục này không?",
    "Xóa",
    () => {
      const type = document.getElementById("cashflowCategoryType").value;
      cashflowCategories[type] = cashflowCategories[type].filter(
        (c) => c.id !== id,
      );
      saveCashflowCategoriesToStorage();
      renderCategoryList();
      updateCashflowCategoryDropdowns();
    }
  );
}

function updateCashflowCategoryDropdowns() {
  const typeSelect = document.getElementById("cashflowType");
  const categorySelect = document.getElementById("cashflowCategory");
  if (!typeSelect || !categorySelect) return;

  const currentType = typeSelect.value;
  const categories = cashflowCategories[currentType] || [];
  const currentVal = String(categorySelect.value || "").trim();

  categorySelect.innerHTML = categories
    .map((c) => `<option value="${c.id}">${c.name}</option>`)
    .join("");

  const matchedCategory = categories.find(
    (c) => c.id === currentVal || c.name === currentVal,
  );

  if (matchedCategory) {
    categorySelect.value = matchedCategory.id;
  } else if (categories.length > 0) {
    categorySelect.value = categories[0].id;
  }
}

function onCashflowTypeChange() {
  updateCashflowCategoryDropdowns();
}

/* ========================== QUẢN LÝ QUỸ ========================== */
const FIREBASE_FUNDS_PATH = "funds";
let firebaseFundsRef = null;
let fundsData = {
  funds: [],
  allocations: [],
  totalIncome: 0,
};
let editingFundId = "";
let selectedFundColor = "#64B5F6";

function initFundsFirebase() {
  if (!firebaseDb || !userProfileKey) return;
  firebaseFundsRef = firebaseDb.ref(`${FIREBASE_FUNDS_PATH}/${userProfileKey}`);

  firebaseFundsRef.on(
    "value",
    (snapshot) => {
      const data = snapshot.val();
      if (data) {
        fundsData = {
          funds: data.funds || [],
          allocations: data.allocations || [],
          totalIncome: data.totalIncome || 0,
        };
      } else {
        fundsData = { funds: [], allocations: [], totalIncome: 0 };
      }
      renderFundsDashboard();
    },
    (error) => {
      console.error("Funds Firebase error:", error);
      loadFundsFromLocalStorage();
      renderFundsDashboard();
    },
  );
}

function loadFundsFromLocalStorage() {
  const stored = localStorage.getItem(`funds_${userProfileKey}`);
  if (stored) {
    try {
      fundsData = JSON.parse(stored);
    } catch (e) {
      fundsData = { funds: [], allocations: [], totalIncome: 0 };
    }
  }
}

function saveFundsToFirebase() {
  if (!firebaseFundsRef) return;
  firebaseFundsRef.set({
    funds: fundsData.funds,
    allocations: fundsData.allocations,
    totalIncome: fundsData.totalIncome,
  });
  localStorage.setItem(`funds_${userProfileKey}`, JSON.stringify(fundsData));
}

function calculateTotalIncome() {
  let total = 0;
  for (const entry of cashflowEntries) {
    if (entry.type === "income") {
      total += entry.amount;
    }
  }
  return total;
}

function calculateTotalExpense() {
  let total = 0;
  for (const entry of cashflowEntries) {
    if (entry.type === "expense") {
      total += entry.amount;
    }
  }
  return total;
}

function calculateTotalAllocated() {
  let total = 0;
  for (const fund of fundsData.funds) {
    total += getFundBalance(fund.id);
  }
  return total;
}

function getFundBalance(fundId) {
  const fund = fundsData.funds.find((f) => f.id === fundId);
  const initialAmount = fund ? fund.initialAmount || 0 : 0;
  let balance = initialAmount;
  for (const alloc of fundsData.allocations) {
    if (alloc.fundId === fundId) {
      balance += alloc.amount;
    }
  }
  return balance;
}

/**
 * Tính số dư khả dụng thực tế chuẩn xác = (Tổng Thu - Tổng Chi) - Tổng đã phân bổ vào quỹ
 */
function calculateAvailableFundBalance() {
  reloadCashflowEntriesFromCache();
  const totalIncome = calculateTotalIncome();
  const totalExpense = calculateTotalExpense();
  const difference = totalIncome - totalExpense;
  const totalAllocated = calculateTotalAllocated();
  return difference - totalAllocated;
}

function openFundsModal() {
  closeAllModals();
  const modal = document.getElementById("fundsModal");
  modal.style.display = "flex";

  // Show loading state for balance section
  const balanceSection = document.querySelector(".funds-balance-section");
  if (balanceSection) {
    balanceSection.classList.add("is-loading");
  }

  // Initial load from cache
  reloadCashflowEntriesFromCache();

  // If cashflowEntries is still empty, wait for Firebase sync
  if (cashflowEntries.length === 0) {
    let attempts = 0;
    const maxAttempts = 10;
    const checkInterval = setInterval(() => {
      reloadCashflowEntriesFromCache();
      attempts++;
      if (cashflowEntries.length > 0 || attempts >= maxAttempts) {
        clearInterval(checkInterval);
        if (balanceSection) {
          balanceSection.classList.remove("is-loading");
        }
        renderFundsDashboard();
      }
    }, 200);
  } else {
    // Small delay to show loading animation, then render
    setTimeout(() => {
      if (balanceSection) {
        balanceSection.classList.remove("is-loading");
      }
      renderFundsDashboard();
    }, 300);
  }

  // Load on demand only if not loaded yet
  if (!LAZY_LOAD.funds) {
    showSkeleton('fundsSkeleton');
    LAZY_LOAD.funds = true;
    hideSkeleton('fundsSkeleton');
  }
}

function closeFundsModal() {
  document.getElementById("fundsModal").style.display = "none";
}

function renderFundsDashboard() {
  reloadCashflowEntriesFromCache();
  const totalIncome = calculateTotalIncome();
  const totalExpense = calculateTotalExpense();
  const difference = totalIncome - totalExpense;
  const totalAllocated = calculateTotalAllocated();
  const available = calculateAvailableFundBalance();

  document.getElementById("fundsTotalIncome").innerText =
    `${difference.toLocaleString("vi-VN")} đ`;
  document.getElementById("fundsTotalIncome").style.color = difference >= 0 ? "#10b981" : "#ef4444";
  document.getElementById("fundsTotalAllocated").innerText =
    `${totalAllocated.toLocaleString("vi-VN")} đ`;

  const availableEl = document.getElementById("fundsAvailable");
  availableEl.innerText = `${available.toLocaleString("vi-VN")} đ`;
  availableEl.style.color = available < 0 ? "#ef4444" : "#10b981";

  // Update allocate info
  const allocateSection = document.querySelector(".funds-allocate-section");
  const allocateInfo = document.getElementById("fundsAllocateInfo");
  if (allocateInfo) {
    if (available > 0) {
      allocateInfo.innerText = "";
      if (allocateSection) allocateSection.style.display = "none";
    } else {
      if (allocateSection) allocateSection.style.display = "block";
      allocateInfo.innerText =
        available < 0
          ? `Số dư âm ${Math.abs(available).toLocaleString("vi-VN")} đ - Đã phân bổ vượt chênh lệch`
          : "Đã phân bổ hết chênh lệch thu - chi";
      allocateInfo.style.color = available < 0 ? "#ef4444" : "#f59e0b";
    }
  }

  renderFundsList();
}

function renderFundsList() {
  const listEl = document.getElementById("fundsList");
  listEl.innerHTML = "";

  if (fundsData.funds.length === 0) {
    const empty = document.createElement("div");
    empty.className = "app-empty-state";
    empty.innerHTML = `
      <div class="app-empty-icon">🏺</div>
      <div class="app-empty-title">Chưa có quỹ nào</div>
      <div class="app-empty-desc">Nhấn "Thêm Quỹ" để tạo hũ tiết kiệm hoặc chi tiêu đầu tiên.</div>
    `;
    listEl.appendChild(empty);
    return;
  }

  // Sort by sortOrder
  const sortedFunds = [...fundsData.funds].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  for (const fund of sortedFunds) {
    const balance = getFundBalance(fund.id);
    const target = fund.target || 0;
    // Percentage based on target (not total balance)
    const percentage = target > 0 ? Math.min((balance / target) * 100, 100) : 100;
    const color = fund.color;
    const colorRgb = hexToRgb(color);

    // Determine progress status
    let progressClass = "";
    let progressText = "";
    if (target > 0) {
      if (balance >= target) {
        progressClass = "is-complete";
        progressText = "✓ Đạt mục tiêu";
      } else {
        const remaining = target - balance;
        progressText = `Còn ${remaining.toLocaleString("vi-VN")} đ`;
      }
    } else {
      progressText = "Không giới hạn";
    }

    const item = document.createElement("div");
    item.className = "fund-item";
    item.draggable = true;
    item.dataset.fundId = fund.id;
    item.style.setProperty("--fund-color", color);
    item.style.setProperty("--fund-color-light", `rgba(${colorRgb}, 0.4)`);
    item.innerHTML = `
      <div class="drag-controls">
        <button class="fund-drag-handle" data-drag-handle="true" title="Kéo để sắp xếp">☰</button>
      </div>
      <div class="fund-jar">
        <div class="fund-jar-lid"></div>
        <div class="fund-jar-neck"></div>
        <div class="fund-jar-body">
          <div class="fund-jar-fill" style="height: ${Math.max(percentage, 5)}%;">
            <div class="fund-jar-shine"></div>
          </div>
          <div class="fund-percentage">${percentage.toFixed(1)}%</div>
        </div>
        <div class="fund-jar-glow"></div>
      </div>
      <div class="fund-item-info">
        <div class="fund-item-name">${fund.name}</div>
        <div class="fund-item-balance">
          <span>${balance.toLocaleString("vi-VN")}</span>
          ${target > 0 ? ` / <span class="target-value">${target.toLocaleString("vi-VN")} đ</span>` : ` <span class="target-value">đ</span>`}
        </div>
      </div>
      <div class="fund-item-actions">
        <button class="fund-action-btn" onclick="toggleFundAction(this, event)" title="Tùy chọn">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="8" cy="3" r="1.5"/>
            <circle cx="8" cy="8" r="1.5"/>
            <circle cx="8" cy="13" r="1.5"/>
          </svg>
        </button>
        <div class="fund-action-dropdown">
          <button class="fund-action-item" onclick="editFund('${fund.id}'); closeFundActionDropdown(this);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Sửa quỹ
          </button>
          <button class="fund-action-item" onclick="openTopupFundModal('${fund.id}'); closeFundActionDropdown(this);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Thêm vào quỹ
          </button>
          <button class="fund-action-item" onclick="openWithdrawFundModal('${fund.id}'); closeFundActionDropdown(this);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Lấy ra từ quỹ
          </button>
          <button class="fund-action-item danger" onclick="confirmDeleteFund('${fund.id}'); closeFundActionDropdown(this);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
            Xóa quỹ
          </button>
        </div>
      </div>
    `;
    item.style.opacity = "0";
    item.style.transform = "translateY(20px)";
    listEl.appendChild(item);

    // Animate in
    requestAnimationFrame(() => {
      item.style.transition = "opacity 0.4s ease, transform 0.4s ease";
      item.style.opacity = "1";
      item.style.transform = "translateY(0)";
    });
  }

  attachFundDragEvents();
}

function attachFundDragEvents() {
  const listEl = document.getElementById("fundsList");
  if (!listEl || listEl._dragAttached) return;
  listEl._dragAttached = true;

  listEl.addEventListener("dragstart", (e) => {
    const item = e.target.closest(".fund-item");
    if (!item) return;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", item.dataset.fundId);
    item.classList.add("dragging");
    listEl.classList.add("dragging-active");
    setTimeout(() => {
      item.style.opacity = "0.4";
    }, 0);
  });

  listEl.addEventListener("dragend", (e) => {
    const item = e.target.closest(".fund-item");
    if (item) {
      item.classList.remove("dragging");
      item.style.opacity = "";
    }
    listEl.classList.remove("dragging-active");
    listEl.querySelectorAll(".drag-over").forEach((el) => el.classList.remove("drag-over"));
    listEl.querySelectorAll(".drag-placeholder").forEach((el) => el.remove());
  });

  listEl.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const draggingItem = listEl.querySelector(".dragging");
    if (!draggingItem) return;

    // Remove previous indicators
    listEl.querySelectorAll(".drag-over").forEach((el) => el.classList.remove("drag-over"));
    listEl.querySelectorAll(".drag-position-indicator").forEach((el) => el.remove());

    const afterElement = getDragAfterElement(listEl, e.clientY);

    // Insert at new position (creates visual gap as items shift)
    if (afterElement == null) {
      listEl.appendChild(draggingItem);
    } else if (afterElement !== draggingItem) {
      listEl.insertBefore(draggingItem, afterElement);
    }
  });

  listEl.addEventListener("dragleave", (e) => {
    if (!listEl.contains(e.relatedTarget)) {
      listEl.querySelectorAll(".drag-over").forEach((el) => el.classList.remove("drag-over"));
    }
  });

  listEl.addEventListener("drop", (e) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData("text/plain");
    if (!draggedId) return;

    listEl.querySelectorAll(".drag-over").forEach((el) => el.classList.remove("drag-over"));
    const indicator = listEl.querySelector(".drag-position-indicator");
    if (indicator) indicator.remove();

    const newOrder = [...listEl.querySelectorAll(".fund-item")].map((el) => el.dataset.fundId);
    newOrder.forEach((id, index) => {
      const fund = fundsData.funds.find((f) => f.id === id);
      if (fund) fund.sortOrder = index;
    });

    saveFundsToFirebase();
    renderFundsList();
  });

  listEl.querySelectorAll(".fund-drag-handle").forEach((handle) => {
    handle.addEventListener("touchstart", handleFundTouchStart, {
      passive: false,
    });
    handle.addEventListener("touchmove", handleFundTouchMove, { passive: false });
    handle.addEventListener("touchend", handleFundTouchEnd);
    handle.addEventListener("touchcancel", handleFundTouchCancel);
  });
}

let _fundTouchSrcEl = null;
let _fundTouchSrcId = null;
let _fundTouchDragging = false;
let _fundTouchStartY = 0;
let _fundTouchCurrentY = 0;

function handleFundTouchStart(e) {
  const handle = e.target.closest(".fund-drag-handle");
  if (!handle) return;

  const item = handle.closest(".fund-item");
  if (!item) return;

  e.preventDefault();

  _fundTouchStartY = e.touches[0].clientY;
  _fundTouchCurrentY = _fundTouchStartY;
  _fundTouchSrcEl = item;
  _fundTouchSrcId = item.dataset.fundId;
  _fundTouchDragging = false;

  _fundTouchSrcEl.classList.add("dragging");
  _fundTouchSrcEl.style.opacity = "0.4";

  document.querySelectorAll(".fund-item").forEach((el) => {
    if (el.dataset.fundId !== _fundTouchSrcId) {
      el.classList.add("drop-target");
    }
  });
}

function handleFundTouchMove(e) {
  if (!_fundTouchSrcEl) return;
  e.preventDefault();

  _fundTouchCurrentY = e.touches[0].clientY;
  const diff = Math.abs(_fundTouchCurrentY - _fundTouchStartY);

  if (diff > 10) {
    _fundTouchDragging = true;
    _fundTouchSrcEl.style.transform = `translateY(${_fundTouchCurrentY - _fundTouchStartY}px)`;
    _fundTouchSrcEl.style.zIndex = "1000";
    _fundTouchSrcEl.style.position = "relative";

    const dragRect = _fundTouchSrcEl.getBoundingClientRect();
    const dragMidY = dragRect.top + dragRect.height / 2;
    const items = Array.from(document.querySelectorAll(".fund-item"));
    const draggedIndex = items.indexOf(_fundTouchSrcEl);

    items.forEach((item, index) => {
      if (item === _fundTouchSrcEl) return;

      item.style.transform = "";
      item.style.transition = "";

      const rect = item.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const itemHeight = rect.height;

      if (draggedIndex !== -1 && index > draggedIndex && _fundTouchCurrentY > dragMidY) {
        const distance = Math.min(_fundTouchCurrentY - dragMidY, itemHeight);
        item.style.transform = `translateY(${distance}px)`;
        item.style.transition = "transform 0.1s ease";
      } else if (draggedIndex !== -1 && index < draggedIndex && _fundTouchCurrentY < dragMidY) {
        const distance = Math.max(_fundTouchCurrentY - dragMidY, -itemHeight);
        item.style.transform = `translateY(${distance}px)`;
        item.style.transition = "transform 0.1s ease";
      }
    });
  }
}

function handleFundTouchEnd(e) {
  if (!_fundTouchSrcEl) return;

  _fundTouchSrcEl.classList.remove("dragging");
  _fundTouchSrcEl.style.opacity = "";
  _fundTouchSrcEl.style.transform = "";
  _fundTouchSrcEl.style.zIndex = "";
  _fundTouchSrcEl.style.position = "";

  document.querySelectorAll(".fund-item").forEach((el) => {
    el.style.transform = "";
    el.style.transition = "";
  });

  document.querySelectorAll(".drop-target, .drag-over").forEach((el) => {
    el.classList.remove("drop-target", "drag-over");
    el.style.boxShadow = "";
    el.style.zIndex = "";
  });

  if (_fundTouchDragging && _fundTouchSrcId) {
    const touch = e.changedTouches[0];
    const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
    const targetItem = targetEl
      ? targetEl.closest(".fund-item")
      : null;

    if (targetItem && targetItem.dataset.fundId !== _fundTouchSrcId) {
      const targetId = targetItem.dataset.fundId;
      const rect = targetItem.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const insertAbove = touch.clientY < midY;

      performFundReorder(_fundTouchSrcId, targetId, insertAbove);
    }
  }

  _fundTouchSrcEl = null;
  _fundTouchSrcId = null;
  _fundTouchDragging = false;
}

function handleFundTouchCancel() {
  if (_fundTouchSrcEl) {
    _fundTouchSrcEl.classList.remove("dragging");
    _fundTouchSrcEl.style.opacity = "";
    _fundTouchSrcEl.style.transform = "";
    _fundTouchSrcEl.style.zIndex = "";
    _fundTouchSrcEl.style.position = "";
  }

  document.querySelectorAll(".fund-item").forEach((el) => {
    el.style.transform = "";
    el.style.transition = "";
  });

  document.querySelectorAll(".drop-target, .drag-over").forEach((el) => {
    el.classList.remove("drop-target", "drag-over");
    el.style.boxShadow = "";
    el.style.zIndex = "";
  });

  _fundTouchSrcEl = null;
  _fundTouchSrcId = null;
  _fundTouchDragging = false;
}

function performFundReorder(srcId, targetId, insertAbove) {
  const sortedFunds = [...fundsData.funds].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  const srcIdx = sortedFunds.findIndex((f) => f.id === srcId);
  const targetIdx = sortedFunds.findIndex((f) => f.id === targetId);

  if (srcIdx < 0 || targetIdx < 0) return;

  const [movedFund] = sortedFunds.splice(srcIdx, 1);

  let insertIdx = insertAbove ? targetIdx : targetIdx + 1;
  if (srcIdx < targetIdx && !insertAbove) {
    insertIdx = targetIdx;
  } else if (srcIdx > targetIdx && insertAbove) {
    insertIdx = targetIdx + 1;
  }

  sortedFunds.splice(Math.max(0, Math.min(insertIdx, sortedFunds.length)), 0, movedFund);

  sortedFunds.forEach((f, idx) => {
    const fund = fundsData.funds.find((x) => x.id === f.id);
    if (fund) fund.sortOrder = idx;
  });

  saveFundsToFirebase();
  renderFundsList();
}

function resetFundTouchDrag() {
  // Legacy function - kept for compatibility
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll(".fund-item:not(.dragging)")];
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset, element: child };
    }
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
  }
  return "255, 255, 255";
}

function toggleFundAction(btn, event) {
  event.stopPropagation();
  const dropdown = btn.nextElementSibling;
  const isOpen = dropdown.classList.contains("is-open");

  document.querySelectorAll(".fund-action-dropdown.is-open").forEach((d) => {
    if (d !== dropdown) restoreFundDropdown(d);
  });

  if (!isOpen) {
    const originalParent = dropdown.parentNode;
    if (originalParent && originalParent.classList.contains("fund-item-actions")) {
      dropdown._originalParent = originalParent;
      const rect = btn.getBoundingClientRect();
      dropdown.style.position = "fixed";
      dropdown.style.top = `${rect.bottom + 4}px`;
      dropdown.style.right = `${window.innerWidth - rect.right}px`;
      dropdown.style.left = "auto";
      dropdown.style.bottom = "auto";
      dropdown.style.marginTop = "0";
      document.body.appendChild(dropdown);
      dropdown.classList.add("is-open");
    }
  } else {
    restoreFundDropdown(dropdown);
  }
}

function restoreFundDropdown(dropdown) {
  if (!dropdown) return;
  const originalParent = dropdown._originalParent;
  if (originalParent && originalParent.parentNode) {
    dropdown.style.position = "";
    dropdown.style.top = "";
    dropdown.style.right = "";
    dropdown.style.left = "";
    dropdown.style.bottom = "";
    dropdown.style.marginTop = "";
    originalParent.appendChild(dropdown);
  }
  delete dropdown._originalParent;
  dropdown.classList.remove("is-open");
}

function closeFundActionDropdown(btn) {
  const dropdown = btn.closest(".fund-action-dropdown");
  if (dropdown) {
    restoreFundDropdown(dropdown);
  }
}

// Close dropdown when clicking outside
document.addEventListener("click", (e) => {
  if (!e.target.closest(".fund-item-actions")) {
    document.querySelectorAll(".fund-action-dropdown.is-open").forEach((d) => {
      restoreFundDropdown(d);
    });
  }
  if (!e.target.closest(".cashflow-row-actions")) {
    document.querySelectorAll(".cashflow-action-dropdown.is-open").forEach((d) => {
      restoreCashflowDropdown(d);
    });
  }
});

function toggleCashflowAction(btn) {
  const dropdown = btn.nextElementSibling;
  if (!dropdown) return;
  const isOpen = dropdown.classList.contains("is-open");

  document.querySelectorAll(".cashflow-action-dropdown.is-open").forEach((d) => {
    if (d !== dropdown) {
      restoreCashflowDropdown(d);
    }
  });

  if (!isOpen) {
    const originalParent = dropdown.parentNode;
    if (originalParent && originalParent.classList.contains("cashflow-row-actions")) {
      dropdown._originalParent = originalParent;
      const rect = btn.getBoundingClientRect();
      dropdown.style.position = "fixed";
      dropdown.style.top = `${rect.bottom + 4}px`;
      dropdown.style.right = `${window.innerWidth - rect.right}px`;
      dropdown.style.left = "auto";
      dropdown.style.bottom = "auto";
      dropdown.style.marginTop = "0";
      document.body.appendChild(dropdown);
      dropdown.classList.add("is-open");
    }
  } else {
    restoreCashflowDropdown(dropdown);
  }
}

function restoreCashflowDropdown(dropdown) {
  if (!dropdown) return;
  const originalParent = dropdown._originalParent;
  if (originalParent && originalParent.parentNode) {
    dropdown.style.position = "";
    dropdown.style.top = "";
    dropdown.style.right = "";
    dropdown.style.left = "";
    dropdown.style.bottom = "";
    dropdown.style.marginTop = "";
    originalParent.appendChild(dropdown);
  }
  delete dropdown._originalParent;
  dropdown.classList.remove("is-open");
}

function closeCashflowActionDropdown() {
  document.querySelectorAll(".cashflow-action-dropdown.is-open").forEach((d) => {
    restoreCashflowDropdown(d);
  });
}

function openAddFundModal() {
  editingFundId = "";
  document.getElementById("fundModalTitle").innerText = "Thêm Quỹ mới";
  document.getElementById("fundName").value = "";
  selectedFundColor = "#64B5F6";

  // Hide initial amount field for new fund
  document.getElementById("fundInitialAmountLabel").style.display = "none";
  document.getElementById("fundInitialAmount").value = "";

  // Reset target field
  document.getElementById("fundTarget").value = "";

  // Reset color buttons
  document.querySelectorAll(".fund-color-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.color === selectedFundColor);
  });

  document.getElementById("fundModal").style.display = "flex";
}

function editFund(fundId) {
  const fund = fundsData.funds.find((f) => f.id === fundId);
  if (!fund) return;

  editingFundId = fundId;
  document.getElementById("fundModalTitle").innerText = "Sửa Quỹ";
  document.getElementById("fundName").value = fund.name;
  selectedFundColor = fund.color;

  // Show current balance as initial amount for editing
  document.getElementById("fundInitialAmountLabel").style.display = "flex";
  const initialAmountInput = document.getElementById("fundInitialAmount");
  initialAmountInput.value = getFundBalance(fundId);
  formatCurrencyInput(initialAmountInput);

  // Show target value
  const targetInput = document.getElementById("fundTarget");
  targetInput.value = fund.target ? fund.target.toLocaleString("vi-VN") : "";
  formatCurrencyInput(targetInput);

  // Set active color
  document.querySelectorAll(".fund-color-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.color === selectedFundColor);
  });

  document.getElementById("fundModal").style.display = "flex";
}

function closeFundModal() {
  document.getElementById("fundModal").style.display = "none";
  editingFundId = "";
}

function saveFund() {
  const nameInput = document.getElementById("fundName");
  const name = nameInput.value.trim();
  const initialAmountInput = document.getElementById("fundInitialAmount");
  const newBalance =
    parseFloat(initialAmountInput.value.replace(/\D/g, "")) || 0;

  if (!name) {
    alert("Vui lòng nhập tên quỹ");
    return;
  }

  if (editingFundId) {
    // Edit existing fund
    const fundIndex = fundsData.funds.findIndex((f) => f.id === editingFundId);
    if (fundIndex >= 0) {
      // Calculate current allocations sum
      const allocationsSum = fundsData.allocations
        .filter((a) => a.fundId === editingFundId)
        .reduce((sum, a) => sum + a.amount, 0);

      // New initialAmount = new balance - allocations sum
      const newInitialAmount = newBalance - allocationsSum;

      // Get target value
      const targetInput = document.getElementById("fundTarget");
      const newTarget = parseFloat(targetInput.value.replace(/\D/g, "")) || 0;

      fundsData.funds[fundIndex].name = name;
      fundsData.funds[fundIndex].color = selectedFundColor;
      fundsData.funds[fundIndex].initialAmount = newInitialAmount;
      fundsData.funds[fundIndex].target = newTarget;
      fundsData.funds[fundIndex].updatedAt = Date.now();
    }
  } else {
    // Add new fund
    const targetInput = document.getElementById("fundTarget");
    const target = parseFloat(targetInput.value.replace(/\D/g, "")) || 0;
    const sortOrder = fundsData.funds.length;
    const newFund = {
      id: `fund-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      color: selectedFundColor,
      initialAmount: 0,
      target: target,
      sortOrder,
      createdAt: Date.now(),
    };
    fundsData.funds.push(newFund);
  }

  saveFundsToFirebase();
  closeFundModal();
  renderFundsDashboard();
}

function confirmDeleteFund(fundId) {
  const fund = fundsData.funds.find((f) => f.id === fundId);
  if (!fund) return;

  showConfirmPopup(
    "Xóa quỹ",
    `Bạn có chắc muốn xóa quỹ "${fund.name}"? Các khoản đã phân bổ vào quỹ này sẽ không bị mất.`,
    "Xóa",
    () => {
      fundsData.funds = fundsData.funds.filter((f) => f.id !== fundId);
      saveFundsToFirebase();
      renderFundsDashboard();
    }
  );
}

let topupFundId = "";
let topupFundMode = "topup"; // 'topup' | 'withdraw'

function openTopupFundModal(fundId) {
  const fund = fundsData.funds.find((f) => f.id === fundId);
  if (!fund) return;

  topupFundId = fundId;
  topupFundMode = "topup";
  document.getElementById("topupFundModalTitle").innerText = "Thêm vào quỹ";
  document.getElementById("topupFundAmountLabel").innerText = "Số tiền thêm vào";
  document.getElementById("topupFundConfirmBtn").innerText = "Xác nhận";
  document.getElementById("topupAmount").placeholder = "VD: 500.000";
  document.getElementById("topupAmount").value = "";
  document.getElementById("topupFundModal").style.display = "flex";
}

function openWithdrawFundModal(fundId) {
  const fund = fundsData.funds.find((f) => f.id === fundId);
  if (!fund) return;

  topupFundId = fundId;
  topupFundMode = "withdraw";
  document.getElementById("topupFundModalTitle").innerText = "Lấy ra từ quỹ";
  document.getElementById("topupFundAmountLabel").innerText = "Số tiền lấy ra";
  document.getElementById("topupFundConfirmBtn").innerText = "Xác nhận";
  document.getElementById("topupAmount").placeholder = "VD: 500.000";
  document.getElementById("topupAmount").value = "";
  document.getElementById("topupFundModal").style.display = "flex";
}

function closeTopupFundModal() {
  document.getElementById("topupFundModal").style.display = "none";
  topupFundId = "";
  topupFundMode = "topup";
}

function confirmTopupFund() {
  const amountInput = document.getElementById("topupAmount");
  const amount = parseInt(amountInput.value.replace(/\D/g, ""), 10) || 0;

  if (amount <= 0) {
    alert("Vui lòng nhập số tiền lớn hơn 0");
    return;
  }

  const fund = fundsData.funds.find((f) => f.id === topupFundId);
  if (!fund) return;

  if (topupFundMode === "withdraw") {
    const balance = getFundBalance(topupFundId);
    if (amount > balance) {
      alert(`Số tiền vượt quá số dư hiện có của quỹ (${balance.toLocaleString("vi-VN")} đ).`);
      return;
    }

    const fundIndex = fundsData.funds.findIndex((f) => f.id === topupFundId);
    if (fundIndex >= 0) {
      fundsData.funds[fundIndex].initialAmount = (fundsData.funds[fundIndex].initialAmount || 0) - amount;
      fundsData.funds[fundIndex].updatedAt = Date.now();
    }

    saveFundsToFirebase();
    closeTopupFundModal();
    renderFundsDashboard();
    return;
  }

  // Topup logic
  const balance = getFundBalance(topupFundId);
  const target = fund.target || 0;

  if (target > 0) {
    const maxAllowed = target - balance;
    if (amount > maxAllowed) {
      alert(`Số tiền vượt quá giới hạn khả dụng. Bạn chỉ có thể thêm tối đa ${maxAllowed.toLocaleString("vi-VN")} đ vào quỹ này.`);
      return;
    }
  }

  const fundIndex = fundsData.funds.findIndex((f) => f.id === topupFundId);
  if (fundIndex >= 0) {
    fundsData.funds[fundIndex].initialAmount = (fundsData.funds[fundIndex].initialAmount || 0) + amount;
    fundsData.funds[fundIndex].updatedAt = Date.now();
  }

  saveFundsToFirebase();
  closeTopupFundModal();
  renderFundsDashboard();
}

function openAllocateModal() {
  const available = calculateAvailableFundBalance();

  if (fundsData.funds.length === 0) {
    alert("Bạn cần tạo ít nhất một quỹ trước khi phân bổ.");
    return;
  }

  const availableEl = document.getElementById("allocateAvailableAmount");
  if (availableEl) {
    availableEl.innerText = `${available.toLocaleString("vi-VN")} đ`;
    availableEl.style.color = available < 0 ? "#ef4444" : "#10b981";
  }

  document.getElementById("allocateAmount").value = "";

  // Populate fund select
  const select = document.getElementById("allocateFundSelect");
  select.innerHTML = '<option value="">-- Chọn quỹ --</option>';

  for (const fund of fundsData.funds) {
    const option = document.createElement("option");
    option.value = fund.id;
    option.textContent = fund.name;
    select.appendChild(option);
  }

  document.getElementById("allocateModal").style.display = "flex";
  renderAllocateHistory();
}

function closeAllocateModal() {
  document.getElementById("allocateModal").style.display = "none";
}

function confirmAllocate() {
  const fundSelect = document.getElementById("allocateFundSelect");
  const amountInput = document.getElementById("allocateAmount");

  const fundId = fundSelect.value;
  const amount = parseInt(amountInput.value.replace(/\D/g, ""), 10) || 0;

  const fund = fundsData.funds.find((f) => f.id === fundId);
  if (!fund) {
    alert("Vui lòng chọn một quỹ hợp lệ");
    return;
  }

  const available = calculateAvailableFundBalance();

  if (available <= 0) {
    alert("Số dư khả dụng hiện tại không đủ để phân bổ quỹ (Số dư khả dụng: 0 đ).");
    return;
  }

  if (amount > available) {
    alert(`Số tiền phân bổ (${amount.toLocaleString("vi-VN")} đ) không được vượt quá số dư khả dụng (${available.toLocaleString("vi-VN")} đ).`);
    return;
  }

  // Kiểm tra không cho phép phân bổ làm vượt quá mục tiêu quỹ
  const currentFundBalance = getFundBalance(fundId);
  const fundTarget = Number(fund.target || 0);

  if (fundTarget > 0) {
    const remainingTargetSpace = fundTarget - currentFundBalance;
    if (remainingTargetSpace <= 0) {
      alert(`Quỹ "${fund.name}" đã đạt mục tiêu (${fundTarget.toLocaleString("vi-VN")} đ).\nVui lòng chỉnh sửa và tăng Mục tiêu của quỹ đó lên trước khi thêm vào quỹ.`);
      return;
    }
    if (amount > remainingTargetSpace) {
      alert(`Số tiền phân bổ (${amount.toLocaleString("vi-VN")} đ) sẽ làm tổng dư quỹ "${fund.name}" (${(currentFundBalance + amount).toLocaleString("vi-VN")} đ) vượt quá Mục tiêu (${fundTarget.toLocaleString("vi-VN")} đ).\nSố tiền tối đa có thể thêm lúc này là ${remainingTargetSpace.toLocaleString("vi-VN")} đ. Vui lòng tăng Mục tiêu của quỹ lên trước khi thêm!`);
      return;
    }
  }

  // Add allocation
  const allocation = {
    id: `alloc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fundId,
    amount,
    date: getTodayIsoDate(),
    createdAt: Date.now(),
  };

  fundsData.allocations.push(allocation);
  saveFundsToFirebase();

  // Bắn thông báo đẩy đến tất cả thiết bị cùng tài khoản
  const fundName = fund ? fund.name : "";
  queueEventNotification({
    id: allocation.id,
    title: "Phân bổ quỹ mới",
    text: `Đã phân bổ ${amount.toLocaleString("vi-VN")} đ vào quỹ ${fundName}`,
    note: `Đã phân bổ ${amount.toLocaleString("vi-VN")} đ vào quỹ ${fundName}`,
    fundName: fundName,
    amount: amount,
    date: allocation.date,
    createdAt: allocation.createdAt
  }, "", "fund_allocation");

  // Update UI
  amountInput.value = "";
  amountInput.style.borderColor = "";
  renderAllocateHistory();
  renderFundsDashboard();

  closeAllocateModal();
  openCelebrationModal(amount, fundName);
}

function triggerFireworksAnimation() {
  if (typeof confetti === "function") {
    const duration = 2.2 * 1000;
    const end = Date.now() + duration;

    (function frame() {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors: ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6']
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors: ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    })();

    setTimeout(() => {
      confetti({
        particleCount: 90,
        spread: 100,
        origin: { y: 0.5 },
        colors: ['#10b981', '#3b82f6', '#f59e0b', '#ffffff']
      });
    }, 250);
  }
}
window.triggerFireworksAnimation = triggerFireworksAnimation;

function openCelebrationModal(amount, fundName) {
  const amtEl = document.getElementById("celebrationAmount");
  const fnEl = document.getElementById("celebrationFundName");
  if (amtEl) amtEl.innerText = `+${Number(amount || 0).toLocaleString("vi-VN")} đ`;
  if (fnEl) fnEl.innerText = `vào ${fundName || "quỹ"}`;

  const modal = document.getElementById("congratulationsModal");
  if (modal) {
    modal.style.display = "flex";
    triggerFireworksAnimation();
  }
}
window.openCelebrationModal = openCelebrationModal;

function closeCelebrationModal() {
  const modal = document.getElementById("congratulationsModal");
  if (modal) modal.style.display = "none";
}
window.closeCelebrationModal = closeCelebrationModal;

function renderAllocateHistory() {
  const listEl = document.getElementById("allocateHistoryList");
  listEl.innerHTML = "";

  if (fundsData.allocations.length === 0) {
    const empty = document.createElement("div");
    empty.className = "app-empty-state";
    empty.innerHTML = `
      <div class="app-empty-icon">📜</div>
      <div class="app-empty-title">Chưa có phân bổ nào</div>
      <div class="app-empty-desc">Lịch sử nạp và rút tiền từ các quỹ sẽ hiển thị tại đây.</div>
    `;
    listEl.appendChild(empty);
    return;
  }

  // Sort by date descending
  const sorted = [...fundsData.allocations].sort(
    (a, b) => b.createdAt - a.createdAt,
  );
  const recent = sorted.slice(0, 10);

  for (const alloc of recent) {
    const fund = fundsData.funds.find((f) => f.id === alloc.fundId);
    if (!fund) continue;

    const item = document.createElement("div");
    item.className = "allocate-history-item";
    item.innerHTML = `
      <div class="allocate-history-item-info">
        <div class="allocate-history-item-color" style="background: ${fund.color}"></div>
        <span class="allocate-history-item-name">${fund.name}</span>
      </div>
      <span class="allocate-history-item-amount">+${alloc.amount.toLocaleString("vi-VN")} đ</span>
      <span class="allocate-history-item-date">${formatCashflowDate(alloc.date)}</span>
    `;
    listEl.appendChild(item);
  }
}

// Initialize fund color picker
(function initFundColorPicker() {
  const colorPicker = document.getElementById("fundColorPicker");
  if (!colorPicker) return;

  colorPicker.addEventListener("click", (e) => {
    const btn = e.target.closest(".fund-color-btn");
    if (!btn) return;

    selectedFundColor = btn.dataset.color;
    document.querySelectorAll(".fund-color-btn").forEach((b) => {
      b.classList.toggle("active", b === btn);
    });
  });
})();

// Initialize allocate amount input formatting & target validation
(function initAllocateInput() {
  const amountInput = document.getElementById("allocateAmount");
  const fundSelect = document.getElementById("allocateFundSelect");
  if (!amountInput) return;

  function validateInputState() {
    formatCurrencyInput(amountInput);
    const amount = parseInt(amountInput.value.replace(/\D/g, ""), 10) || 0;
    const available = calculateAvailableFundBalance();
    const fundId = fundSelect ? fundSelect.value : "";
    const fund = fundId ? fundsData.funds.find((f) => f.id === fundId) : null;

    let isInvalid = false;
    if (amount > available && available > 0) {
      isInvalid = true;
    }
    if (fund && Number(fund.target || 0) > 0) {
      const currentBal = getFundBalance(fund.id);
      if ((currentBal + amount) > Number(fund.target)) {
        isInvalid = true;
      }
    }

    amountInput.style.borderColor = isInvalid ? "#ef4444" : "";
  }

  amountInput.addEventListener("input", validateInputState);
  if (fundSelect) {
    fundSelect.addEventListener("change", validateInputState);
  }
})();

// Initialize fund initial amount input formatting
(function initFundInitialAmountInput() {
  const amountInput = document.getElementById("fundInitialAmount");
  if (!amountInput) return;

  amountInput.addEventListener("input", () => {
    formatCurrencyInput(amountInput);
  });
})();

// Initialize fund target input formatting
(function initFundTargetInput() {
  const targetInput = document.getElementById("fundTarget");
  if (!targetInput) return;

  targetInput.addEventListener("input", () => {
    formatCurrencyInput(targetInput);
  });
})();

// Modal click-outside handlers
(function initFundsModals() {
  const fundsModal = document.getElementById("fundsModal");
  if (fundsModal) {
    fundsModal.addEventListener("click", (e) => {
      if (e.target === fundsModal) closeFundsModal();
    });
  }

  const fundModal = document.getElementById("fundModal");
  if (fundModal) {
    fundModal.addEventListener("click", (e) => {
      if (e.target === fundModal) closeFundModal();
    });
  }

  const allocateModal = document.getElementById("allocateModal");
  if (allocateModal) {
    allocateModal.addEventListener("click", (e) => {
      if (e.target === allocateModal) closeAllocateModal();
    });
  }

  const topupFundModal = document.getElementById("topupFundModal");
  if (topupFundModal) {
    topupFundModal.addEventListener("click", (e) => {
      if (e.target === topupFundModal) closeTopupFundModal();
    });
  }

  // Initialize topup amount input formatting
  const topupAmountInput = document.getElementById("topupAmount");
  if (topupAmountInput) {
    topupAmountInput.addEventListener("input", () => {
      formatCurrencyInput(topupAmountInput);
    });
  }
})();

// cập nhật mỗi giây
setInterval(updateClock, 1000);
updateClock();

function setAppInitLoading(visible) {
  const loading = document.getElementById("appInitLoading");
  if (!loading) return;
  if (visible) {
    loading.style.display = "flex";
    loading.classList.add("is-visible");
  } else {
    loading.classList.remove("is-visible");
    // After transition, fully hide from layout
    loading.addEventListener("transitionend", function handler() {
      if (!loading.classList.contains("is-visible")) {
        loading.style.display = "none";
        loading.removeEventListener("transitionend", handler);
      }
    });
    // Fallback: force hide after 400ms (transition duration)
    setTimeout(() => {
      loading.style.display = "none";
    }, 400);
  }
}

/* ========================== CURRENCY DATA ========================== */
const CURRENCY_DATA = {
  USD: { name: "Đô la Mỹ", flag: "https://flagcdn.com/w40/us.png" },
  VND: { name: "Việt Nam Đồng", flag: "https://flagcdn.com/w40/vn.png" },
  EUR: { name: "Euro", flag: "https://flagcdn.com/w40/eu.png" },
  JPY: { name: "Yên Nhật", flag: "https://flagcdn.com/w40/jp.png" },
  KRW: { name: "Won Hàn", flag: "https://flagcdn.com/w40/kr.png" },
  CNY: { name: "Nhân dân tệ", flag: "https://flagcdn.com/w40/cn.png" },
  GBP: { name: "Bảng Anh", flag: "https://flagcdn.com/w40/gb.png" },
  AUD: { name: "Đô la Úc", flag: "https://flagcdn.com/w40/au.png" },
  CAD: { name: "Đô la Canada", flag: "https://flagcdn.com/w40/ca.png" },
  SGD: { name: "Đô la Singapore", flag: "https://flagcdn.com/w40/sg.png" },
  THB: { name: "Baht Thái Lan", flag: "https://flagcdn.com/w40/th.png" },
  HKD: { name: "Đô la Hồng Kông", flag: "https://flagcdn.com/w40/hk.png" },
  NZD: { name: "Đô la New Zealand", flag: "https://flagcdn.com/w40/nz.png" },
  CHF: { name: "Franc Thụy Sĩ", flag: "https://flagcdn.com/w40/ch.png" },
  INR: { name: "Rupee Ấn Độ", flag: "https://flagcdn.com/w40/in.png" },
  PHP: { name: "Peso Philippines", flag: "https://flagcdn.com/w40/ph.png" },
  MYR: { name: "Ringgit Malaysia", flag: "https://flagcdn.com/w40/my.png" },
  IDR: { name: "Rupiah Indonesia", flag: "https://flagcdn.com/w40/id.png" },
  TWD: { name: "Đô la Đài Loan", flag: "https://flagcdn.com/w40/tw.png" },
  RUB: { name: "Rúp Nga", flag: "https://flagcdn.com/w40/ru.png" },
  MXN: { name: "Peso Mexico", flag: "https://flagcdn.com/w40/mx.png" },
  BRL: { name: "Real Brazil", flag: "https://flagcdn.com/w40/br.png" },
  ZAR: { name: "Rand Nam Phi", flag: "https://flagcdn.com/w40/za.png" },
  AED: { name: "Dirham UAE", flag: "https://flagcdn.com/w40/ae.png" },
  SAR: { name: "Riyal Ả Rập Xê Út", flag: "https://flagcdn.com/w40/sa.png" },
  SEK: { name: "Krona Thụy Điển", flag: "https://flagcdn.com/w40/se.png" },
  NOK: { name: "Krone Na Uy", flag: "https://flagcdn.com/w40/no.png" },
  DKK: { name: "Krone Đan Mạch", flag: "https://flagcdn.com/w40/dk.png" },
};

function initCurrencySelects() {
  ["currencyFrom", "currencyTo"].forEach((id) => {
    const select = document.getElementById(id);
    const dropdown = document.getElementById(id + "Dropdown");
    const selectBox = document.getElementById(id + "Select");
    const valueSpan = selectBox.querySelector(".currency-select-value");
    const arrowSpan = selectBox.querySelector(".currency-select-arrow");

    const options = Array.from(select.options);
    dropdown.innerHTML = options
      .map((opt) => {
        const code = opt.value;
        const data = CURRENCY_DATA[code];
        if (!data) return "";
        return `<div class="currency-option" data-value="${code}">
        <img src="${data.flag}" alt="${data.name}" onerror="this.style.display='none'">
        <span>${code} - ${data.name}</span>
      </div>`;
      })
      .join("");

    const updateDisplay = () => {
      const selectedCode = select.value;
      const data = CURRENCY_DATA[selectedCode];
      if (data) {
        valueSpan.innerHTML = `<img src="${data.flag}" alt="${data.name}" onerror="this.style.display='none'" style="width:24px;height:18px;object-fit:cover;border-radius:2px;box-shadow:0 1px 3px rgba(0,0,0,0.3)"> <span>${selectedCode} - ${data.name}</span>`;
      }
    };

    dropdown.addEventListener("click", (e) => {
      const option = e.target.closest(".currency-option");
      if (option) {
        select.value = option.dataset.value;
        dropdown
          .querySelectorAll(".currency-option")
          .forEach((o) => o.classList.remove("selected"));
        option.classList.add("selected");
        updateDisplay();
        dropdown.classList.remove("show");
        arrowSpan.style.transform = "";
        convertCurrency();
      }
    });

    updateDisplay();
  });
}

function toggleCurrencySelect(id) {
  const dropdown = document.getElementById(id + "Dropdown");
  const selectBox = document.getElementById(id + "Select");
  const arrowSpan = selectBox.querySelector(".currency-select-arrow");

  document.querySelectorAll(".currency-dropdown").forEach((d) => {
    if (d !== dropdown) d.classList.remove("show");
  });
  document.querySelectorAll(".currency-select-arrow").forEach((a) => {
    if (a !== arrowSpan) a.style.transform = "";
  });

  dropdown.classList.toggle("show");
  arrowSpan.style.transform = dropdown.classList.contains("show")
    ? "rotate(180deg)"
    : "";
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".currency-select-wrapper")) {
    document
      .querySelectorAll(".currency-dropdown")
      .forEach((d) => d.classList.remove("show"));
    document
      .querySelectorAll(".currency-select-arrow")
      .forEach((a) => (a.style.transform = ""));
  }
});

/* ========================== CURRENCY CONVERTER ========================== */
function formatCurrencyInput(input) {
  let value = input.value.replace(/[^\d]/g, "");
  if (value) {
    value = parseInt(value, 10).toLocaleString("vi-VN");
  }
  input.value = value;
}

function openCurrencyModal() {
  try {
    loadCountdownFromLocal();
  } catch (e) { }
  closeAllModals();
  document.getElementById("currencyModal").style.display = "flex";
  if (!window.currencyInitialized) {
    initCurrencySelects();
    window.currencyInitialized = true;
  }
  let amountInput = document.getElementById("currencyAmount");
  let value = amountInput.value.replace(/[^\d]/g, "");
  if (value) {
    amountInput.value = parseInt(value, 10).toLocaleString("vi-VN");
  }
  if (!window.exchangeRates) {
    fetchExchangeRates();
  }
}

function closeCurrencyModal() {
  document.getElementById("currencyModal").style.display = "none";
}

async function fetchExchangeRates() {
  const infoEl = document.getElementById("currencyUpdateInfo");
  try {
    infoEl.innerText = "Đang tải tỷ giá...";
    const response = await fetch("https://open.er-api.com/v6/latest/USD");
    const data = await response.json();
    if (data && data.rates) {
      window.exchangeRates = data.rates;
      const lastUpdate = new Date(
        data.time_last_update_unix * 1000,
      ).toLocaleString("vi-VN");
      infoEl.innerText = `Cập nhật lần cuối: ${lastUpdate}`;
      let amountInput = document.getElementById("currencyAmount");
      let value = amountInput.value.replace(/[^\d]/g, "");
      if (value) {
        amountInput.value = parseInt(value, 10).toLocaleString("vi-VN");
      }
      convertCurrency();
    } else {
      infoEl.innerText = "Lỗi khi lấy tỷ giá.";
    }
  } catch (err) {
    console.error("Lỗi tỷ giá:", err);
    infoEl.innerText = "Lỗi kết nối khi lấy tỷ giá.";
  }
}

function convertCurrency() {
  if (!window.exchangeRates) return;
  let amountStr = document
    .getElementById("currencyAmount")
    .value.replace(/[^\d]/g, "");
  const amount = parseFloat(amountStr) || 0;
  const from = document.getElementById("currencyFrom").value;
  const to = document.getElementById("currencyTo").value;

  const rateFrom = window.exchangeRates[from];
  const rateTo = window.exchangeRates[to];

  if (rateFrom && rateTo) {
    const result = (amount / rateFrom) * rateTo;
    let formattedResult = "";
    if (["VND", "JPY", "KRW", "IDR", "KHR", "LAK", "MMK"].includes(to)) {
      formattedResult = Math.round(result).toLocaleString("vi-VN");
    } else {
      formattedResult = result.toLocaleString("vi-VN", {
        maximumFractionDigits: 2,
      });
    }
    document.getElementById("currencyResult").value = formattedResult;
  }
}

function swapCurrency() {
  const from = document.getElementById("currencyFrom");
  const to = document.getElementById("currencyTo");
  const temp = from.value;
  from.value = to.value;
  to.value = temp;
  let amountInput = document.getElementById("currencyAmount");
  let value = amountInput.value.replace(/[^\d]/g, "");
  if (value) {
    amountInput.value = parseInt(value, 10).toLocaleString("vi-VN");
  }
  convertCurrency();
}

/* ========================== LAZY LOADING STATE ========================= */
const LAZY_LOAD = {
  calendar: false,
  weather: false,
  quote: false,
  countdown: false,
  quickNotes: false,
  myMusic: false,
  cashflow: false,
  funds: false,
  gold: false,
  news: false,
  translate: false,
  projects: false,
  profile: false,
  todayLunar: false,
  fundsBalanceLoading: false
};

// Skeleton helpers
function showSkeleton(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('is-loading');
}

function hideSkeleton(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('is-loading');
}

// Render calendar immediately - no skeleton, no waiting
// Calendar renders instantly on app load, Firebase data updates in background
function loadCalendarOnDemand() {
  renderCalendar();
  renderOvertime();
  renderOvertimeSalary();
}

// Refresh calendar UI after Firebase data loads
function refreshCalendarUI() {
  if (!LAZY_LOAD.calendar) return;
  renderCalendar();
  renderOvertime();
  renderOvertimeSalary();
  renderTodayEvents();
}

function loadWeatherOnDemand() {
  if (LAZY_LOAD.weather) return;
  showSkeleton('weatherSkeleton');
  LAZY_LOAD.weather = true;
  fetchWeatherByLocation();
}

function loadQuoteOnDemand() {
  if (LAZY_LOAD.quote) return;
  LAZY_LOAD.quote = true;
  loadQuote();
}

function loadCountdownOnDemand() {
  if (LAZY_LOAD.countdown) return;
  LAZY_LOAD.countdown = true;
  loadCountdownFromLocal();
}

function loadQuickNotesOnDemand() {
  if (LAZY_LOAD.quickNotes) return;
  if (!isUserLoggedIn()) return;
  showSkeleton('quicknotesSkeleton');
  LAZY_LOAD.quickNotes = true;
  renderQuickNotes();
  hideSkeleton('quicknotesSkeleton');
}

function loadMyMusicOnDemand() {
  if (LAZY_LOAD.myMusic) return;
  if (!isUserLoggedIn()) return;
  LAZY_LOAD.myMusic = true;
  initMyMusicPlayer();
}

function loadCashflowOnDemand() {
  if (LAZY_LOAD.cashflow) return;
  if (!isUserLoggedIn()) return;
  showSkeleton('cashflowSkeleton');
  LAZY_LOAD.cashflow = true;
  renderCashflowDashboard();
  hideSkeleton('cashflowSkeleton');
}

function loadFundsOnDemand() {
  if (LAZY_LOAD.funds) return;
  if (!isUserLoggedIn()) return;
  showSkeleton('fundsSkeleton');
  LAZY_LOAD.funds = true;
  renderFundsDashboard();
  hideSkeleton('fundsSkeleton');
}

function loadGoldOnDemand() {
  if (LAZY_LOAD.gold) return;
  if (!isUserLoggedIn()) return;
  showSkeleton('goldSkeleton');
  LAZY_LOAD.gold = true;
  loadGoldMarketData();
  hideSkeleton('goldSkeleton');
}

function loadNewsOnDemand() {
  if (LAZY_LOAD.news) {
    if (newsCache[currentNewsTab]) {
      renderNewsItems(newsCache[currentNewsTab]);
    }
    return;
  }
  LAZY_LOAD.news = true;
  if (newsCache[currentNewsTab]) {
    renderNewsItems(newsCache[currentNewsTab]);
  } else {
    fetchNews(currentNewsTab);
  }
}

function loadTranslateOnDemand() {
  if (LAZY_LOAD.translate) return;
  if (!isUserLoggedIn()) return;
  LAZY_LOAD.translate = true;
}

function loadProjectsOnDemand() {
  if (LAZY_LOAD.projects) return;
  if (!isUserLoggedIn()) return;
  showSkeleton('projectsSkeleton');
  LAZY_LOAD.projects = true;
  renderProjectsList();
  hideSkeleton('projectsSkeleton');
}

function loadProfileOnDemand() {
  if (LAZY_LOAD.profile) return;
  if (!isUserLoggedIn()) return;
  showSkeleton('profileSkeleton');
  LAZY_LOAD.profile = true;
  initProfileOnLoad();
  hideSkeleton('profileSkeleton');
}

function loadTodayLunarOnDemand() {
  if (LAZY_LOAD.todayLunar) return;
  LAZY_LOAD.todayLunar = true;
  renderTodayLunar();
}

/* ========================== INIT ========================= */
// Fast init - no blocking loading screen
(function initApp() {
  // Step 1: Show main page weather skeleton initially for loading state
  showSkeleton('weatherSkeleton');
  // Note: calendar renders immediately, no skeleton needed

  // Step 2: Render UI immediately (no waiting)
  initQuickNoteModal();
  renderToday();

  // Step 3: Render calendar immediately - no waiting for Firebase!
  console.log("[Init] Rendering calendar...");
  renderCalendar();
  renderOvertime();
  renderOvertimeSalary();
  setInterval(renderTodayEvents, 30000);
  console.log("[Init] Calendar rendered");

  // Step 4: Initialize Firebase in background (non-blocking)
  initFirebaseServices().catch(err => {
    console.error("[Init] Firebase error:", err);
  });

  // Step 4: Load essential items on demand (when user interacts)
  // These will be triggered by user actions, not upfront

  // Step 5: Load weather data in background (low priority)
  setTimeout(() => loadWeatherOnDemand(), 1000);

  // Step 6: Load quote in background
  setTimeout(() => loadQuoteOnDemand(), 500);

  // Step 7: Load countdown in background
  setTimeout(() => loadCountdownOnDemand(), 800);

  // Step 8: Load lunar calendar in background
  setTimeout(() => loadTodayLunarOnDemand(), 600);

  // Step 9: Mark calendar as loaded (already rendered above)
  LAZY_LOAD.calendar = true;

  console.log("[Init] App started - calendar rendered immediately");

  // Swipe gesture để chuyển tháng trên mobile
  (function initCalendarSwipe() {
    const calendarEl = document.getElementById("calendar");
    if (!calendarEl) return;

    let touchStartX = 0;
    let touchStartY = 0;

    calendarEl.addEventListener("touchstart", function (e) {
      touchStartX = e.changedTouches[0].clientX;
      touchStartY = e.changedTouches[0].clientY;
    }, { passive: true });

    calendarEl.addEventListener("touchend", function (e) {
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      const MIN_SWIPE = 50; // px tối thiểu để tính là vuốt

      // Chỉ xử lý nếu vuốt ngang nhiều hơn dọc (tránh nhầm với cuộn)
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > MIN_SWIPE) {
        if (dx > 0) {
          changeMonth(-1); // Vuốt sang phải → tháng trước
        } else {
          changeMonth(1);  // Vuốt sang trái → tháng sau
        }
      }
    }, { passive: true });
  })();
})();

/* ========================== TIN TỨC ========================== */
let currentNewsTab = "vn";
let newsCache = {
  vn: null,
  global: null,
  sports: null,
  business: null,
  tech: null,
  realestate: null,
  health: null,
  entertainment: null,
  cars: null,
  travel: null,
};

function openNewsModal() {
  closeAllModals();
  document.getElementById("newsModal").style.display = "flex";
  loadNewsOnDemand();
}

async function refreshNews() {
  const btn = document.getElementById("newsRefreshBtn");
  if (btn) btn.classList.add("spinning");

  // Clear cache for current tab
  newsCache[currentNewsTab] = null;

  try {
    await fetchNews(currentNewsTab);
  } finally {
    if (btn) {
      btn.classList.remove("spinning");
    }
  }
}

function closeNewsModal() {
  document.getElementById("newsModal").style.display = "none";
}

function switchNewsTab(type) {
  if (currentNewsTab === type) return;

  currentNewsTab = type;
  const tabIds = {
    vn: "newsTabVN",
    global: "newsTabGlobal",
    sports: "newsTabSports",
    business: "newsTabBusiness",
    tech: "newsTabTech",
    realestate: "newsTabRealEstate",
    health: "newsTabHealth",
    entertainment: "newsTabEntertainment",
    cars: "newsTabCars",
    travel: "newsTabTravel",
  };

  Object.values(tabIds).forEach((id) => {
    document.getElementById(id)?.classList.remove("active");
  });
  document.getElementById(tabIds[type])?.classList.add("active");

  if (!newsCache[type]) {
    fetchNews(type);
  } else {
    renderNewsItems(newsCache[type]);
  }
}

async function fetchNews(type) {
  const container = document.getElementById("newsContainer");
  container.innerHTML = renderNewsSkeletons();

  // RSS feeds for VNExpress - much faster than scraping
  const rssSources = {
    vn: "https://vnexpress.net/rss/tin-moi-nhat.rss",
    global: "https://vnexpress.net/rss/the-gioi.rss",
    sports: "https://vnexpress.net/rss/the-thao.rss",
    business: "https://vnexpress.net/rss/kinh-doanh.rss",
    tech: "https://vnexpress.net/rss/so-hoa.rss",
    realestate: "https://vnexpress.net/rss/bat-dong-san.rss",
    health: "https://vnexpress.net/rss/suc-khoe.rss",
    entertainment: "https://vnexpress.net/rss/giai-tri.rss",
    cars: "https://vnexpress.net/rss/oto-xe-may.rss",
    travel: "https://vnexpress.net/rss/du-lich.rss",
  };

  const targetUrl = rssSources[type];

  try {
    const items = await fetchRSS(targetUrl);

    if (items.length === 0) throw new Error("No news found");

    newsCache[type] = items;
    renderNewsItems(items);
  } catch (err) {
    console.error("Lỗi lấy tin tức:", err);
    container.innerHTML = `<div style="text-align:center; padding: 40px; color: #ffb3b3;">
      <p>Không thể tải tin tức lúc này. Vui lòng thử lại sau.</p>
      <button onclick="fetchNews('${type}')" style="margin-top:10px; padding: 5px 15px; background: rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); border-radius:5px; color:#fff; cursor:pointer;">Thử lại</button>
    </div>`;
  }
}

// Fetch RSS using rss2json API (fast and reliable)
async function fetchRSS(rssUrl) {
  const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
  const res = await fetch(apiUrl, { cache: "no-cache" });

  if (!res.ok) throw new Error("Failed to fetch RSS");

  const data = await res.json();

  if (data.status !== "ok" || !data.items) {
    throw new Error("Invalid RSS response");
  }

  return data.items.slice(0, 20).map((item) => ({
    title: item.title || "",
    link: item.link || "",
    thumb:
      item.thumbnail ||
      extractThumbFromContent(item.content) ||
      extractThumbFromEnclosure(item) ||
      "",
    description: stripHtml(item.description || "").substring(0, 200) + "...",
    pubDate: item.pubDate || new Date().toISOString(),
  }));
}

// Extract thumbnail from content if not provided
function extractThumbFromContent(content) {
  const match = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : "";
}

function extractThumbFromEnclosure(item) {
  if (item.enclosure && item.enclosure.link) {
    const type = item.enclosure.type || "";
    if (
      type.startsWith("image/") ||
      item.enclosure.link.match(/\.(jpg|jpeg|png|webp)/i)
    ) {
      return item.enclosure.link;
    }
  }
  return "";
}

// Strip HTML tags from text
function stripHtml(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

function renderNewsItems(items) {
  const container = document.getElementById("newsContainer");
  if (!items || items.length === 0) {
    container.innerHTML =
      "<p style='text-align:center; padding: 20px; color: #a6bde2;'>Không có tin nào.</p>";
    return;
  }

  const html = items
    .map((item) => {
      const dateStr = new Date(item.pubDate).toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });

      const thumbHtml = item.thumb
        ? `<img src="${item.thumb}" class="news-card-thumb" loading="lazy" onerror="this.style.display='none'">`
        : `<div class="news-card-thumb" style="display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.05);"><svg viewBox="0 0 24 24" style="width:24px; fill:rgba(255,255,255,0.2)"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg></div>`;

      return `
      <a href="${item.link}" target="_blank" class="news-card">
        ${thumbHtml}
        <div class="news-card-body">
          <div class="news-card-title">${item.title}</div>
          <div class="news-card-desc">${item.description}</div>
          <div class="news-card-meta">
            <span>VNExpress</span>
            <span>${dateStr}</span>
          </div>
        </div>
      </a>
    `;
    })
    .join("");

  container.innerHTML = html;
}

function renderNewsSkeletons() {
  let skeletons = "";
  for (let i = 0; i < 6; i++) {
    skeletons += `
      <div class="news-skeleton">
        <div class="skeleton-line skeleton-title"></div>
        <div class="skeleton-line skeleton-desc"></div>
        <div class="skeleton-line skeleton-desc"></div>
        <div class="skeleton-line skeleton-desc-short"></div>
      </div>
    `;
  }
  return skeletons;
}

// Global keyboard shortcuts
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") {
    // Close confirm popup first
    const confirmPopup = document.getElementById("confirmPopup");
    if (confirmPopup && confirmPopup.classList.contains("show")) {
      closeConfirmPopup();
      return;
    }

    // Close any open form modals
    const projectFormModal = document.getElementById("projectFormModal");
    const taskFormModal = document.getElementById("taskFormModal");

    if (projectFormModal && projectFormModal.style.display === "flex") {
      closeProjectFormModal();
      return;
    }
    if (taskFormModal && taskFormModal.style.display === "flex") {
      closeTaskFormModal();
      return;
    }
  }
});

/* ========================== TRANSLATE FEATURE ========================== */
const TRANSLATE_STORAGE_KEY = "translateLanguages";
const TRANSLATE_API_KEY = "translateApi";
const TRANSLATE_HISTORY_COLLAPSED_KEY = "translateHistoryCollapsed";
const PRONUNCIATION_VISIBLE_KEY = "pronunciationVisible";
let translateDebounceTimer = null;
let lastTranslatedText = "";

function getSavedLanguages() {
  const saved = localStorage.getItem(TRANSLATE_STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      return { fromLang: "auto", toLang: "vi" };
    }
  }
  return { fromLang: "auto", toLang: "vi" };
}

function saveLanguages(fromLang, toLang) {
  localStorage.setItem(
    TRANSLATE_STORAGE_KEY,
    JSON.stringify({ fromLang, toLang }),
  );
}

function loadSavedLanguages() {
  const { fromLang, toLang } = getSavedLanguages();
  document.getElementById("translateFromLang").value = fromLang;
  document.getElementById("translateToLang").value = toLang;
}

function saveApiSelection() {
  const selectedApi = document.querySelector(
    'input[name="translateApi"]:checked',
  );
  if (selectedApi) {
    localStorage.setItem(TRANSLATE_API_KEY, selectedApi.value);
  }
}

function loadApiSelection() {
  const saved = localStorage.getItem(TRANSLATE_API_KEY);
  if (saved) {
    const radio = document.querySelector(
      `input[name="translateApi"][value="${saved}"]`,
    );
    if (radio) {
      radio.checked = true;
    }
  }
}

function onApiChange() {
  const input = document.getElementById("translateInput").value.trim();
  saveApiSelection();

  if (input) {
    lastTranslatedText = "";
    performTranslation(input);
  }
}

function toggleApiDropdown() {
  const dropdown = document.getElementById("translateApiDropdown");
  dropdown.classList.toggle("show");
}

document.addEventListener("click", function (e) {
  const dropdown = document.getElementById("translateApiDropdown");
  const btn = document.querySelector(".translate-api-btn");
  if (!dropdown.contains(e.target) && !btn.contains(e.target)) {
    dropdown.classList.remove("show");
  }
});

function openTranslateModal() {
  const modal = document.getElementById("translateModal");
  modal.style.display = "flex";
  loadTranslateOnDemand();
  loadSavedLanguages();
  loadApiSelection();
  loadSavedPronunciation();
  document.getElementById("translateInput").focus();
}

function openTranslateHistoryModal() {
  const modal = document.getElementById("translateHistoryModal");
  modal.style.display = "flex";
  updateTranslateHistoryBadge();
  renderTranslateHistoryModal();
}

function closeTranslateHistoryModal() {
  document.getElementById("translateHistoryModal").style.display = "none";
}

function updateTranslateHistoryBadge() {
  const badge = document.getElementById("translateHistoryBadge");
  if (!badge) return;
  const count = translateHistoryCache.length;
  badge.textContent = count > 0 ? count : "";
  badge.style.display = count > 0 ? "inline-flex" : "none";
}

function renderTranslateHistoryModal() {
  const container = document.getElementById("translateHistoryModalList");
  if (!container) return;

  updateTranslateHistoryBadge();

  if (translateHistoryCache.length === 0) {
    container.innerHTML =
      '<div class="translate-history-empty">Chưa có lịch sử dịch</div>';
    return;
  }

  const langNames = {
    auto: "Tự động",
    en: "Tiếng Anh",
    ko: "Tiếng Hàn",
    zh: "Tiếng Trung",
    vi: "Tiếng Việt",
  };

  container.innerHTML = translateHistoryCache
    .map((item) => {
      const date = new Date(item.timestamp);
      const timeStr = date.toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });

      return `
      <div class="translate-history-item" data-id="${item.id}">
        <div class="translate-history-item-header">
          <span class="translate-history-lang">${langNames[item.fromLang] || item.fromLang} → ${langNames[item.toLang] || item.toLang}</span>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="translate-history-time">${timeStr}</span>
            <div class="translate-history-actions-btns">
              <button class="translate-history-delete-btn" onclick="deleteTranslateHistoryItem('${item.id}'); renderTranslateHistoryModal();" title="Xóa">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
        <div class="translate-history-original">${escapeHtml(item.original)}</div>
        <div class="translate-history-translated">${escapeHtml(item.translated)}</div>
      </div>
    `;
    })
    .join("");
}

function toggleTranslateHistory() {
  const listEl = document.getElementById("translateHistoryList");
  const arrowEl = document.getElementById("translateHistoryArrow");
  const isCollapsed = listEl.classList.toggle("collapsed");
  arrowEl.classList.toggle("collapsed", isCollapsed);
  localStorage.setItem(
    TRANSLATE_HISTORY_COLLAPSED_KEY,
    isCollapsed ? "true" : "false",
  );
}

function initTranslateHistoryCollapsed() {
  const saved = localStorage.getItem(TRANSLATE_HISTORY_COLLAPSED_KEY);
  const isCollapsed = saved === "true";
  const listEl = document.getElementById("translateHistoryList");
  if (listEl) {
    const arrowEl = document.getElementById("translateHistoryArrow");
    listEl.classList.toggle("collapsed", isCollapsed);
    if (arrowEl) arrowEl.classList.toggle("collapsed", isCollapsed);
  }
}

function closeTranslateModal() {
  document.getElementById("translateModal").style.display = "none";
  clearTranslateState();
}

function clearTranslateState() {
  document.getElementById("translateInput").value = "";
  document.getElementById("translateOutput").value = "";
  document.getElementById("translateDetected").classList.remove("show");
  document.getElementById("translateDetected").innerText = "";
  document.getElementById("translateLoading").style.display = "none";
  document.getElementById("translateError").style.display = "none";
  document.getElementById("translatePronunciation").style.display = "none";
  lastTranslatedText = "";
}

function clearTranslateInput() {
  const inputEl = document.getElementById("translateInput");
  const outputEl = document.getElementById("translateOutput");

  inputEl.value = "";
  outputEl.value = "";

  document.getElementById("translateDetected").classList.remove("show");
  document.getElementById("translateDetected").innerText = "";
  document.getElementById("translateError").style.display = "none";
  document.getElementById("translatePronunciation").style.display = "none";
  lastTranslatedText = "";
  document.getElementById("translateInput").focus();
}

function onTranslateInput() {
  const input = document.getElementById("translateInput");
  const text = input.value;

  if (!text.trim()) {
    document.getElementById("translateOutput").value = "";
    document.getElementById("translateDetected").classList.remove("show");
    document.getElementById("translateError").style.display = "none";
    document.getElementById("translatePronunciation").style.display = "none";
  }
}

function performTranslationFromButton() {
  const input = document.getElementById("translateInput");
  const text = input.value.trim();

  if (!text) {
    document.getElementById("translateError").innerText =
      "Vui lòng nhập văn bản cần dịch.";
    document.getElementById("translateError").style.display = "block";
    return;
  }

  performTranslation(text);
}

function togglePronunciation() {
  const showPronunciation =
    document.getElementById("showPronunciation").checked;
  const pronunciationEl = document.getElementById("translatePronunciation");

  localStorage.setItem(
    PRONUNCIATION_VISIBLE_KEY,
    showPronunciation ? "true" : "false",
  );

  const translatedText = document.getElementById("translateOutput").value;
  const toLang = document.getElementById("translateToLang").value;

  if (showPronunciation && translatedText) {
    pronunciationEl.style.display = "block";
    loadPronunciation(translatedText, toLang);
  } else {
    pronunciationEl.style.display = "none";
  }
}

function loadSavedPronunciation() {
  const saved = localStorage.getItem(PRONUNCIATION_VISIBLE_KEY);
  if (saved === "true") {
    document.getElementById("showPronunciation").checked = true;
    // KHÔNG hiện box phiên âm ngay - chỉ bật checkbox,
    // box sẽ hiện khi bật checkbox hoặc sau khi dịch xong
  }
}

async function loadPronunciation(text, lang) {
  const pronunciationEl = document.getElementById("translatePronunciation");
  pronunciationEl.innerHTML =
    '<div class="pronunciation-loading">Đang tải phiên âm...</div>';

  try {
    if (lang === "vi") {
      pronunciationEl.innerHTML =
        '<div class="pronunciation-note">Tiếng Việt sử dụng bảng chữ cái Latin, không cần phiên âm.</div>';
      return;
    }

    if (lang === "en") {
      await loadEnglishPhonetics(text, pronunciationEl);
    } else if (lang === "ko") {
      await loadKoreanRomanization(text, pronunciationEl);
    } else if (lang === "zh") {
      await loadChinesePinyin(text, pronunciationEl);
    } else {
      pronunciationEl.innerHTML =
        '<div class="pronunciation-note">Ngôn ngữ này chưa được hỗ trợ phiên âm.</div>';
    }
  } catch (error) {
    pronunciationEl.innerHTML =
      '<div class="pronunciation-error">Không thể tải phiên âm. Vui lòng thử lại.</div>';
  }
}

async function loadEnglishPhonetics(text, pronunciationEl) {
  const words = text
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .slice(0, 8);
  const phoneticResults = [];

  for (const word of words) {
    const cleanWord = word.replace(/[^\w\s]/g, "").toLowerCase();
    if (cleanWord.length > 1) {
      try {
        const response = await fetch(
          `https://api.dictionaryapi.dev/api/v2/entries/en/${cleanWord}`,
        );
        if (response.ok) {
          const data = await response.json();
          if (data[0]?.phonetics) {
            const phonetic =
              data[0].phonetics.find((p) => p.text && p.text.includes("/")) ||
              data[0].phonetics.find((p) => p.text) ||
              data[0].phonetics[0];
            if (phonetic?.text) {
              phoneticResults.push({
                word: cleanWord,
                phonetic: phonetic.text,
              });
            }
          }
        }
      } catch (e) { }
    }
  }

  if (phoneticResults.length > 0) {
    pronunciationEl.innerHTML = `
      <div class="pronunciation-label">Phiên âm IPA / Pronunciation:</div>
      <div class="pronunciation-text">${phoneticResults.map((p) => `<span class="phonetic-item">${p.word} <span class="phonetic-value">${p.phonetic}</span></span>`).join(" ")}</div>
    `;
  } else {
    pronunciationEl.innerHTML =
      '<div class="pronunciation-note">Không tìm thấy phiên âm cho văn bản này.</div>';
  }
}

async function loadKoreanRomanization(text, pronunciationEl) {
  const words = text
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .slice(0, 10);
  const results = [];

  for (const word of words) {
    const romanized = koreanToRoman(word);
    if (romanized !== word) {
      results.push({ korean: word, roman: romanized });
    }
  }

  if (results.length > 0) {
    pronunciationEl.innerHTML = `
      <div class="pronunciation-label">Romanization / 로마자 변환:</div>
      <div class="pronunciation-text">${results.map((r) => `<span class="phonetic-item">${r.korean} <span class="phonetic-value">[${r.roman}]</span></span>`).join(" ")}</div>
    `;
  } else {
    pronunciationEl.innerHTML =
      '<div class="pronunciation-note">Không tìm thấy phiên âm cho văn bản này.</div>';
  }
}

async function loadChinesePinyin(text, pronunciationEl) {
  pronunciationEl.innerHTML =
    '<div class="pronunciation-loading">Đang tải phiên âm...</div>';

  try {
    // Extract only Chinese characters
    const chineseOnly = text.replace(/[^\u4e00-\u9fff]/g, "");

    if (!chineseOnly) {
      pronunciationEl.innerHTML =
        '<div class="pronunciation-note">Không tìm thấy ký tự Trung Quốc trong văn bản này.</div>';
      return;
    }

    // Try multiple CDN sources for pinyin-pro
    const cdnUrls = [
      "https://unpkg.com/pinyin-pro@3.18.6/dist/index.js",
      "https://cdn.jsdelivr.net/npm/pinyin-pro@3.18.6/dist/index.js",
    ];

    let loaded = false;
    for (const url of cdnUrls) {
      if (typeof pinyin !== "undefined") break;
      try {
        await loadScript(url);
        loaded = true;
      } catch (e) {
        continue;
      }
    }

    if (typeof pinyin !== "undefined" && typeof pinyin === "function") {
      // Process character by character for complete coverage
      let resultHTML = "";

      for (const char of chineseOnly) {
        try {
          const py = pinyin(char, { toneType: "symbol" });
          if (py) {
            resultHTML += `<span class="phonetic-item">${char} <span class="phonetic-value">${py}</span></span>`;
          } else {
            resultHTML += `<span class="phonetic-item">${char} <span class="phonetic-value">-</span></span>`;
          }
        } catch (e) {
          resultHTML += `<span class="phonetic-item">${char} <span class="phonetic-value">?</span></span>`;
        }
      }

      if (resultHTML) {
        pronunciationEl.innerHTML = `
          <div class="pronunciation-label">Pinyin / 拼音:</div>
          <div class="pronunciation-text">${resultHTML}</div>
        `;
        return;
      }
    }

    // Fallback: embedded pinyin dictionary (subset of common characters)
    const pinyinDict = {
      道: "dào",
      公: "gōng",
      务: "wù",
      员: "yuán",
      你: "nǐ",
      好: "hǎo",
      我: "wǒ",
      是: "shì",
      中: "zhōng",
      国: "guó",
      人: "rén",
      的: "de",
      在: "zài",
      有: "yǒu",
      了: "le",
      们: "men",
      不: "bù",
      这: "zhè",
      那: "nà",
      他: "tā",
      她: "tā",
      它: "tā",
      什: "shén",
      么: "me",
      吗: "ma",
      很: "hěn",
      会: "huì",
      能: "néng",
      想: "xiǎng",
      爱: "ài",
      喜: "xǐ",
      欢: "huān",
      谢: "xiè",
      对: "duì",
      起: "qǐ",
      没: "méi",
      关: "guān",
      系: "xì",
      请: "qǐng",
      问: "wèn",
      昨: "zuó",
      天: "tiān",
      今: "jīn",
      年: "nián",
      月: "yuè",
      日: "rì",
      时: "shí",
      分: "fēn",
      钟: "zhōng",
      快: "kuài",
      乐: "lè",
      东: "dōng",
      西: "xī",
      南: "nán",
      北: "běi",
      京: "jīng",
      上: "shàng",
      海: "hǎi",
      广: "guǎng",
      州: "zhōu",
      深: "shēn",
      圳: "zhèn",
      见: "jiàn",
      面: "miàn",
      认: "rèn",
      识: "shí",
      朋: "péng",
      友: "yǒu",
      家: "jiā",
      工: "gōng",
      作: "zuò",
      学: "xué",
      校: "xiào",
      老: "lǎo",
      师: "shī",
      同: "tóng",
      公: "gōng",
      司: "sī",
      医: "yī",
      院: "yuàn",
      银: "yín",
      行: "háng",
      饭: "fàn",
      店: "diàn",
      酒: "jiǔ",
      吧: "ba",
      咖: "kā",
      啡: "fēi",
      茶: "chá",
      水: "shuǐ",
      果: "guǒ",
      苹: "píng",
      香: "xiāng",
      蕉: "jiāo",
      葡: "pú",
      萄: "táo",
      西: "xī",
      瓜: "guā",
      米: "mǐ",
      包: "bāo",
      蛋: "dàn",
      肉: "ròu",
      鱼: "yú",
      鸡: "jī",
      鸭: "yā",
      猪: "zhū",
      牛: "niú",
      羊: "yáng",
      马: "mǎ",
      车: "chē",
      路: "lù",
      地: "dì",
      铁: "tiě",
      站: "zhàn",
      机: "jī",
      场: "chǎng",
      票: "piào",
      钱: "qián",
      买: "mǎi",
      卖: "mài",
      贵: "guì",
      便宜: "piányi",
      多: "duō",
      少: "shǎo",
      大: "dà",
      小: "xiǎo",
      高: "gāo",
      矮: "ǎi",
      长: "cháng",
      短: "duǎn",
      宽: "kuān",
      窄: "zhǎi",
      新: "xīn",
      旧: "jiù",
      热: "rè",
      冷: "lěng",
      暖: "nuǎn",
      凉: "liáng",
      早: "zǎo",
      晚: "wǎn",
      忙: "máng",
      闲: "xián",
      远: "yuǎn",
      近: "jìn",
      难: "nán",
      易: "yì",
      听: "tīng",
      说: "shuō",
      读: "dú",
      写: "xiě",
      看: "kàn",
      走: "zǒu",
      跑: "pǎo",
      飞: "fēi",
      吃: "chī",
      喝: "hē",
      睡: "shuì",
      觉: "jiào",
      醒: "xǐng",
      坐: "zuò",
      站: "zhàn",
      躺: "tǎng",
      开: "kāi",
      关: "guān",
      来: "lái",
      去: "qù",
      回: "huí",
      到: "dào",
      过: "guò",
      给: "gěi",
      和: "hé",
      与: "yǔ",
      或: "huò",
      但: "dàn",
      却: "què",
      因: "yīn",
      为: "wèi",
      所: "suǒ",
      以: "yǐ",
      如: "rú",
      果: "guǒ",
      虽: "suī",
      然: "rán",
      只: "zhǐ",
      要: "yào",
      需: "xū",
      应: "yīng",
      该: "gāi",
      可: "kě",
      以: "yǐ",
      够: "gòu",
      将: "jiāng",
      已: "yǐ",
      经: "jīng",
      正: "zhèng",
      被: "bèi",
      把: "bǎ",
      让: "ràng",
      叫: "jiào",
      使: "shǐ",
      令: "lìng",
      劝: "quàn",
      求: "qiú",
      帮: "bāng",
      助: "zhù",
      教: "jiào",
      答: "dá",
      告: "gào",
      诉: "sù",
      怎: "zěn",
      么: "me",
      怎: "zěn",
      么: "me",
      永: "yǒng",
      远: "yuǎn",
      经: "jīng",
      常: "cháng",
      往: "wǎng",
      突: "tū",
      然: "rán",
      须: "xū",
      须: "xū",
      准: "zhǔn",
      备: "bèi",
      始: "shǐ",
      束: "shù",
      完: "wán",
      成: "chéng",
      失: "shī",
      败: "bài",
      功: "gōng",
      步: "bù",
      迎: "yíng",
      送: "sòng",
      光: "guāng",
      临: "lín",
      参: "cān",
      加: "jiā",
      观: "guān",
      考: "kǎo",
      试: "shì",
      业: "yè",
      案: "àn",
      题: "tí",
      问: "wèn",
      题: "tí",
      解: "jiě",
      决: "jué",
      法: "fǎ",
      懂: "dǒng",
      记: "jì",
      得: "dé",
      忘: "wàng",
      白: "bái",
      楚: "chǔ",
      确: "què",
      定: "dìng",
      一: "yī",
      定: "dìng",
      肯: "kěn",
      许: "xǔ",
      点: "diǎn",
      半: "bàn",
      刻: "kè",
      秒: "miǎo",
      候: "hòu",
      样: "yàng",
      错: "cuò",
      棒: "bàng",
      帅: "shuài",
      酷: "kù",
      累: "lèi",
      舒: "shū",
      服: "fu",
      饿: "è",
      饱: "bǎo",
      渴: "kě",
      痛: "tòng",
      病: "bìng",
      士: "shì",
      护: "hù",
      房: "fáng",
      间: "jiān",
      厕: "cè",
      所: "suǒ",
      厨: "chú",
      厅: "tīng",
      床: "chuáng",
      桌: "zhuō",
      椅: "yǐ",
      沙: "shā",
      发: "fā",
      门: "mén",
      窗: "chuāng",
      匙: "shi",
      永: "yǒng",
      远: "yuǎn",
      健: "jiàn",
      康: "kāng",
      祝: "zhù",
      福: "fú",
      庆: "qìng",
      恭: "gōng",
      喜: "xǐ",
      诞: "dàn",
      庆: "qìng",
      礼: "lǐ",
      拜: "bài",
      星: "xīng",
      期: "qī",
      从: "cóng",
      池: "chí",
      市: "shì",
      环: "huán",
      保: "bǎo",
      境: "jìng",
      美: "měi",
      丽: "lì",
      女: "nǚ",
      孩: "hái",
      男: "nán",
      生: "shēng",
      老: "lǎo",
      板: "bǎn",
      秘: "mì",
      书: "shū",
      助: "zhù",
      理: "lǐ",
      总: "zǒng",
      经: "jīng",
      销: "xiāo",
      售: "shòu",
      客: "kè",
      户: "hù",
      投: "tóu",
      资: "zī",
      金: "jīn",
      账: "zhàng",
      单: "dān",
      计: "jì",
      划: "huà",
      节: "jié",
      假: "jià",
      旅: "lǚ",
      游: "yóu",
      剧: "jù",
      院: "yuàn",
      百: "bǎi",
      姓: "xìng",
      名: "míng",
      电: "diàn",
      话: "huà",
      号: "hào",
      码: "mǎ",
      微: "wēi",
      信: "xìn",
      邮: "yóu",
      箱: "xiāng",
      省: "shěng",
      区: "qū",
      址: "zhǐ",
      楼: "lóu",
      层: "céng",
      牌: "pái",
      照: "zhào",
      证: "zhèng",
      签: "qiān",
      出: "chū",
      入: "rù",
      口: "kǒu",
      岸: "àn",
      税: "shuì",
      免: "miǎn",
      退: "tuì",
      换: "huàn",
      货: "huò",
      网: "wǎng",
      购: "gòu",
      支: "zhī",
      付: "fù",
      宝: "bǎo",
      现: "xiàn",
      用: "yòng",
      卡: "kǎ",
      租: "zū",
      押: "yā",
      修: "xiū",
      装: "zhuāng",
      价: "jià",
      格: "gé",
      便: "biàn",
      宜: "yí",
      打: "dǎ",
      折: "zhé",
      扣: "kòu",
      费: "fèi",
      优: "yōu",
      惠: "huì",
      券: "quàn",
      积: "jī",
      品: "pǐn",
      赠: "zèng",
      包: "bāo",
      量: "liàng",
      尺: "chǐ",
      寸: "cùn",
      规: "guī",
      型: "xíng",
      批: "pī",
      零: "líng",
      代: "dài",
      招: "zhāo",
      商: "shāng",
      盟: "méng",
      连: "lián",
      锁: "suǒ",
      直: "zhí",
      营: "yíng",
      转: "zhuǎn",
      让: "ràng",
      兑: "duì",
      汇: "huì",
      率: "lǜ",
      款: "kuǎn",
      余: "yú",
      额: "é",
      存: "cún",
      取: "qǔ",
      利: "lì",
      息: "xī",
      通: "tōng",
      知: "zhī",
      催: "cuī",
      欠: "qiàn",
      债: "zhài",
      借: "jiè",
      还: "huán",
      条: "tiáo",
      约: "yuē",
      同: "tóng",
      字: "zì",
      章: "zhāng",
      印: "yìn",
      明: "míng",
      暗: "àn",
      显: "xiǎn",
      示: "shì",
      屏: "píng",
      幕: "mù",
      亮: "liàng",
      控: "kòng",
      制: "zhì",
      调: "diào",
      温: "wēn",
      度: "dù",
      空: "kōng",
      调: "tiáo",
      暖: "nuǎn",
      气: "qì",
      线: "xiàn",
      池: "chí",
      充: "chōng",
      宝: "bǎo",
      耳: "ěr",
      麦: "mài",
      克: "kè",
      摄: "shè",
      像: "xiàng",
      拍: "pāi",
      录: "lù",
      视: "shì",
      频: "pín",
      档: "dǎng",
      输: "shū",
      印: "yìn",
      扫: "sǎo",
      描: "miáo",
      夹: "jiá",
      钉: "dīng",
      剪: "jiǎn",
      橡: "xiàng",
      皮: "pí",
      擦: "cā",
      圆: "yuán",
      珠: "zhū",
      铅: "qiān",
      粉: "fěn",
      蜡: "là",
      墨: "mò",
      砚: "yàn",
      镇: "zhèn",
      规: "guī",
      三: "sān",
      角: "jiǎo",
      算: "suàn",
      盘: "pán",
      器: "qì",
      脑: "nǎo",
      平: "píng",
      本: "běn",
      台: "tái",
      主: "zhǔ",
      显: "xiǎn",
      键: "jiàn",
      鼠: "shǔ",
      标: "biāo",
      U: "U",
      移: "yí",
      动: "dòng",
      硬: "yìng",
      内: "nèi",
      显: "xiǎn",
      声: "shēng",
      由: "yóu",
      猫: "māo",
      基: "jī",
      W: "W",
      I: "I",
      F: "F",
      密: "mì",
      绑: "bǎng",
      登: "dēng",
      录: "lù",
      注: "zhù",
      册: "cè",
      销: "xiāo",
      改: "gǎi",
      验: "yàn",
      短: "duǎn",
      众: "zhòng",
      平: "píng",
      台: "tái",
      程: "chéng",
      序: "xù",
      软: "ruǎn",
      件: "jiàn",
      硬: "yìng",
      系: "xì",
      统: "tǒng",
      应: "yìng",
      设: "shè",
      计: "jì",
      测: "cè",
      运: "yùn",
      维: "wéi",
      更: "gēng",
      升: "shēng",
      级: "jí",
      优: "yōu",
      化: "huà",
      删: "shān",
      除: "chú",
      备: "bèi",
      份: "fèn",
      恢: "huī",
      复: "fù",
      还: "huán",
      原: "yuán",
      格: "gé",
      化: "huà",
      磁: "cí",
      清: "qīng",
      理: "lǐ",
      垃: "lā",
      圾: "jī",
      收: "shōu",
      绿: "lǜ",
      色: "sè",
      碳: "tàn",
      排: "pái",
      放: "fàng",
      减: "jiǎn",
      再: "zài",
      生: "shēng",
      循: "xún",
      环: "huán",
      造: "zào",
      塑: "sù",
      料: "liào",
      玻: "bō",
      璃: "lí",
      属: "shǔ",
      废: "fèi",
      物: "wù",
      处: "chǔ",
      桶: "tǒng",
      袋: "dài",
      洁: "jié",
      卫: "wèi",
      扫: "sǎo",
      拖: "tuō",
      布: "bù",
      抹: "mā",
      拭: "shì",
      洗: "xǐ",
      消: "xiāo",
      毒: "dú",
      杀: "shā",
      菌: "jūn",
      防: "fáng",
      疫: "yì",
      罩: "zhào",
      液: "yè",
      精: "jīng",
      巾: "jīn",
      湿: "shī",
      牙: "yá",
      膏: "gāo",
      漱: "shù",
      杯: "bēi",
      乳: "rǔ",
      器: "qì",
      毛: "máo",
      浴: "yù",
      龙: "lóng",
      头: "tóu",
      壶: "hú",
      瓶: "píng",
      饮: "yǐn",
      料: "liào",
      冰: "bīng",
      波: "bō",
      炉: "lú",
      电: "diàn",
      磁: "cí",
      锅: "guō",
      铲: "chǎn",
      勺: "sháo",
      碗: "wǎn",
      筷: "kuài",
      叉: "chā",
      羹: "gēng",
      凳: "dèng",
      垫: "diàn",
      枕: "zhěn",
      被: "bèi",
      褥: "rù",
      毯: "tǎn",
      蚊: "wén",
      帐: "zhàng",
      纱: "shā",
      帘: "lián",
      泡: "pào",
      管: "guǎn",
      插: "chā",
      座: "zuò",
      接: "jiē",
      钥: "yào",
      锁: "suǒ",
      盗: "dào",
      铃: "líng",
      栏: "lán",
      杆: "gǎn",
      阳: "yáng",
      台: "tái",
      露: "lòu",
      庭: "tíng",
      院: "yuàn",
      园: "yuán",
      草: "cǎo",
      坪: "píng",
      树: "shù",
      木: "mù",
      浇: "jiāo",
      肥: "féi",
      农: "nóng",
      药: "yào",
      具: "jù",
      锹: "qiāo",
      锄: "chú",
      锤: "chuí",
      螺: "luó",
      丝: "sī",
      扳: "bān",
      钳: "qián",
      锯: "jù",
      钻: "zuàn",
      泵: "bèng",
      漆: "qī",
      油: "yóu",
      滚: "gǔn",
      筒: "tǒng",
      胶: "jiāo",
      带: "dài",
      双: "shuāng",
      壁: "bì",
      贴: "tiē",
      框: "kuàng",
      挂: "guà",
      历: "lì",
      筒: "tǒng",
      架: "jià",
      盒: "hé",
      夹: "jiá",
      环: "huán",
      链: "liàn",
      胸: "xiōng",
      针: "zhēn",
      帽: "mào",
      檐: "yán",
      鞋: "xié",
      袜: "wà",
      仔: "zǎi",
      背: "bèi",
      七: "qī",
      九: "jiǔ",
      装: "zhuāng",
      服: "fú",
      棉: "mián",
      羽: "yǔ",
      绒: "róng",
      皮: "pí",
      大: "dài",
      马: "mǎ",
      甲: "jiǎ",
      织: "zhī",
      衬: "chèn",
      衫: "shān",
      结: "jié",
      纽: "niǔ",
      魔: "mó",
      术: "shù",
      提: "tí",
      钱: "qián",
      腰: "yāo",
      尚: "shàng",
      行: "xíng",
      李: "lǐ",
      肩: "jiān",
      化: "huà",
      妆: "zhuāng",
      肤: "fū",
      霜: "shuāng",
      唇: "chún",
      红: "hóng",
      眉: "méi",
      影: "yǐng",
      睫: "jié",
      底: "dǐ",
      瑕: "xiá",
      遮: "zhē",
      散: "sǎn",
      腮: "sāi",
      容: "róng",
      卡: "kǎ",
      蜡: "là",
      胶: "jiāo",
      粘: "nián",
      芯: "xīn",
      芯: "xīn",
      蜡: "là",
      棒: "bàng",
      转: "zhuǎn",
      印: "yìn",
      戳: "chuō",
      固: "gù",
      体: "tǐ",
      珠: "zhū",
      石: "shí",
      锉: "cuò",
      砂: "shā",
      薰: "xūn",
      灯: "dēng",
      炉: "lú",
      固: "gù",
    };

    let resultHTML = "";
    for (const char of chineseOnly) {
      const py = pinyinDict[char];
      if (py) {
        resultHTML += `<span class="phonetic-item">${char} <span class="phonetic-value">${py}</span></span>`;
      } else {
        resultHTML += `<span class="phonetic-item">${char} <span class="phonetic-value">?</span></span>`;
      }
    }

    pronunciationEl.innerHTML = `
      <div class="pronunciation-label">Pinyin / 拼音:</div>
      <div class="pronunciation-text">${resultHTML}</div>
    `;
  } catch (error) {
    console.error("Pinyin error:", error);
    pronunciationEl.innerHTML =
      '<div class="pronunciation-error">Lỗi khi tải pinyin.</div>';
  }
}

// Basic pinyin lookup for common Chinese characters
function getBasicPinyin(text) {
  // Single character pinyin dictionary
  const charDict = {
    一: "yī",
    二: "èr",
    三: "sān",
    四: "sì",
    五: "wǔ",
    六: "liù",
    七: "qī",
    八: "bā",
    九: "jiǔ",
    十: "shí",
    百: "bǎi",
    千: "qiān",
    万: "wàn",
    亿: "yì",
    零: "líng",
    两: "liǎng",
    几: "jǐ",
    多: "duō",
    少: "shǎo",
    大: "dà",
    小: "xiǎo",
    高: "gāo",
    低: "dī",
    长: "cháng",
    短: "duǎn",
    宽: "kuān",
    窄: "zhǎi",
    厚: "hòu",
    薄: "báo",
    深: "shēn",
    浅: "qiǎn",
    远: "yuǎn",
    近: "jìn",
    快: "kuài",
    慢: "màn",
    早: "zǎo",
    晚: "wǎn",
    新: "xīn",
    旧: "jiù",
    好: "hǎo",
    坏: "huài",
    对: "duì",
    错: "cuò",
    真: "zhēn",
    假: "jiǎ",
    美: "měi",
    丑: "chǒu",
    贵: "guì",
    便宜: "piányi",
    多: "duō",
    少: "shǎo",
    都: "dōu",
    很: "hěn",
    太: "tài",
    最: "zuì",
    更: "gèng",
    非常: "fēicháng",
    特别: "tèbié",
    我: "wǒ",
    你: "nǐ",
    他: "tā",
    她: "tā",
    它: "tā",
    们: "men",
    的: "de",
    了: "le",
    是: "shì",
    在: "zài",
    有: "yǒu",
    没: "méi",
    无: "wú",
    不: "bù",
    吗: "ma",
    呢: "ne",
    啊: "a",
    吧: "ba",
    呀: "ya",
    哦: "ó",
    这: "zhè",
    那: "nà",
    哪: "nǎ",
    谁: "shuí",
    什么: "shénme",
    怎: "zěn",
    么: "me",
    怎么: "zěnme",
    为: "wèi",
    什么: "shénme",
    为什: "wèishén",
    "为什 么": "wèishénme",
    因为: "yīnwèi",
    所以: "suǒyǐ",
    但: "dàn",
    是: "shì",
    然: "rán",
    但是: "dànshì",
    虽然: "suīrán",
    如: "rú",
    果: "guǒ",
    如果: "rúguǒ",
    只: "zhǐ",
    要: "yào",
    需: "xū",
    "需 要": "xūyào",
    应: "yīng",
    该: "gāi",
    应该: "yīnggāi",
    能: "néng",
    会: "huì",
    可: "kě",
    以: "yǐ",
    可以: "kěyǐ",
    想: "xiǎng",
    要: "yào",
    得: "dé",
    到: "dào",
    去: "qù",
    来: "lái",
    回: "huí",
    过: "guò",
    出: "chū",
    入: "rù",
    上: "shàng",
    下: "xià",
    左: "zuǒ",
    右: "yòu",
    前: "qián",
    后: "hòu",
    里: "lǐ",
    外: "wài",
    中: "zhōng",
    东: "dōng",
    南: "nán",
    西: "xī",
    北: "běi",
    天: "tiān",
    地: "dì",
    人: "rén",
    国: "guó",
    家: "jiā",
    "中 国": "zhōngguó",
    美国: "Měiguó",
    英国: "Yīngguó",
    法国: "Fàguó",
    德国: "Déguó",
    日本: "Rìběn",
    韩国: "Hánguó",
    俄国: "Éguó",
    京: "jīng",
    上海: "Shànghǎi",
    广州: "Guǎngzhōu",
    深圳: "Shēnzhèn",
    香港: "Xiānggǎng",
    澳门: "Aomen",
    台湾: "Táiwān",
    新加坡: "Xīnjiāpō",
    公: "gōng",
    司: "sī",
    "公 司": "gōngsī",
    银: "yín",
    行: "háng",
    "银 行": "yínháng",
    学: "xué",
    校: "xiào",
    "学 校": "xuéxiào",
    老: "lǎo",
    师: "shī",
    "老 师": "lǎoshī",
    生: "shēng",
    "学 生": "xuéshēng",
    朋: "péng",
    友: "yǒu",
    "朋 友": "péngyǒu",
    同: "tóng",
    学: "xué",
    "同 学": "tóngxué",
    爸: "bà",
    妈: "mā",
    "爸 爸": "bàba",
    "妈 妈": "māma",
    父: "fù",
    母: "mǔ",
    亲: "qīn",
    "父 母": "fùmǔ",
    "亲 戚": "qīnqi",
    哥: "gē",
    弟: "dì",
    姐: "jiě",
    妹: "mèi",
    "哥 哥": "gēge",
    "弟 弟": "dìdi",
    "姐 姐": "jiějie",
    "妹 妹": "mèimei",
    见: "jiàn",
    面: "miàn",
    "见 面": "jiànmiàn",
    认: "rèn",
    识: "shí",
    "认 识": "rènshi",
    告: "gào",
    诉: "sù",
    "告 诉": "gàosù",
    聊: "liáo",
    天: "tiān",
    "聊 天": "liáotiān",
    说: "shuō",
    话: "huà",
    "说 话": "shuōhuà",
    问: "wèn",
    答: "dá",
    "问 答": "wèndá",
    听: "tīng",
    写: "xiě",
    读: "dú",
    看: "kàn",
    读: "dú",
    书: "shū",
    "读 书": "dúshū",
    习: "xí",
    学: "xué",
    "学 习": "xuéxí",
    工: "gōng",
    作: "zuò",
    "工 作": "gōngzuò",
    上班: "shàngbān",
    下班: "xiàbān",
    请: "qǐng",
    问: "wèn",
    "请 问": "qǐngwèn",
    谢: "xiè",
    "谢 谢": "xièxie",
    对: "duì",
    不: "bù",
    "对 不 起": "duìbùqǐ",
    起: "qǐ",
    对: "duì",
    没: "méi",
    关: "guān",
    系: "xì",
    "没 关 系": "méiguānxi",
    爱: "ài",
    喜: "xǐ",
    欢: "huān",
    "喜 欢": "xǐhuan",
    爱: "ài",
    医: "yī",
    院: "yuàn",
    "医 院": "yīyuàn",
    药: "yào",
    "药 店": "yàodiàn",
    饭: "fàn",
    吃: "chī",
    "吃 饭": "chīfàn",
    店: "diàn",
    酒: "jiǔ",
    "酒 店": "jiǔdiàn",
    咖: "kā",
    啡: "fēi",
    "咖 啡": "kāfēi",
    茶: "chá",
    水: "shuǐ",
    果: "guǒ",
    "水 果": "shuǐguǒ",
    苹: "píng",
    果: "guǒ",
    "苹 果": "píngguǒ",
    香: "xiāng",
    蕉: "jiāo",
    "香 蕉": "xiāngjiāo",
    葡: "pú",
    萄: "táo",
    "葡 萄": "pútao",
    西: "xī",
    瓜: "guā",
    "西 瓜": "xīguā",
    肉: "ròu",
    鱼: "yú",
    鸡: "jī",
    鸭: "yā",
    猪: "zhū",
    牛: "niú",
    羊: "yáng",
    蛋: "dàn",
    面: "miàn",
    米: "mǐ",
    "米 饭": "mǐfàn",
    包: "bāo",
    "面 包": "miànbāo",
    车: "chē",
    汽: "qì",
    "汽 车": "qìchē",
    火: "huǒ",
    车: "chē",
    "火 车": "huǒchē",
    地: "dì",
    铁: "tiě",
    "地 铁": "dìtiě",
    站: "zhàn",
    机: "jī",
    场: "chǎng",
    "机 场": "jīchǎng",
    票: "piào",
    钱: "qián",
    买: "mǎi",
    卖: "mài",
    "买 东 西": "mǎi dōngxi",
    路: "lù",
    走: "zǒu",
    跑: "pǎo",
    飞: "fēi",
    坐: "zuò",
    躺: "tǎng",
    站: "zhàn",
    开: "kāi",
    关: "guān",
    睡: "shuì",
    觉: "jiào",
    "睡 觉": "shuìjiào",
    醒: "xǐng",
    吃: "chī",
    喝: "hē",
    打: "dǎ",
    电: "diàn",
    话: "huà",
    "打 电 话": "dǎ diànhuà",
    网: "wǎng",
    络: "luò",
    "网 络": "wǎngluò",
    微: "wēi",
    信: "xìn",
    "微 信": "wēixìn",
    邮: "yóu",
    件: "jiàn",
    "邮 件": "yóujiàn",
    时: "shí",
    间: "jiān",
    "时 间": "shíjiān",
    现: "xiàn",
    在: "zài",
    "现 在": "xiànzài",
    今: "jīn",
    天: "tiān",
    "今 天": "jīntiān",
    昨: "zuó",
    天: "tiān",
    "昨 天": "zuótiān",
    明: "míng",
    天: "tiān",
    "明 天": "míngtiān",
    年: "nián",
    月: "yuè",
    日: "rì",
    号: "hào",
    "今 年": "jīnnián",
    "昨 年": "zuónián",
    "明 年": "míngnián",
    礼: "lǐ",
    拜: "bài",
    "礼 拜": "lǐbài",
    星: "xīng",
    期: "qī",
    "星 期": "xīngqī",
    一: "yī",
    二: "èr",
    三: "sān",
    四: "sì",
    五: "wǔ",
    六: "liù",
    七: "qī",
    "星 期 一": "xīngqī yī",
    "星 期 二": "xīngqī èr",
    "星 期 三": "xīngqī sān",
    "星 期 四": "xīngqī sì",
    "星 期 五": "xīngqī wǔ",
    "星 期 六": "xīngqī liù",
    "星 期 天": "xīngqī tiān",
    早: "zǎo",
    上: "shàng",
    "早 上": "zǎoshang",
    中: "zhōng",
    午: "wǔ",
    "中 午": "zhōngwǔ",
    下: "xià",
    午: "wǔ",
    "下 午": "xiàwǔ",
    晚: "wǎn",
    上: "shàng",
    "晚 上": "wǎnshang",
    夜: "yè",
    晚: "wǎn",
    昨: "zuó",
    晚: "wǎn",
    "昨 晚": "zuówǎn",
    夜: "yè",
    半: "bàn",
    点: "diǎn",
    "半 点": "bàndiǎn",
    刻: "kè",
    分: "fēn",
    钟: "zhōng",
    秒: "miǎo",
    什: "shén",
    么: "me",
    时: "shí",
    候: "hòu",
    "什 么 时 候": "shénme shíhòu",
    怎: "zěn",
    么: "me",
    么: "me",
    "怎 么": "zěnme",
    样: "yàng",
    "怎 么 样": "zěnmeyàng",
    样: "yàng",
    "怎 么 样": "zěnmeyàng",
    还: "hái",
    好: "hǎo",
    还: "hái",
    吗: "ma",
    "还 好": "háihǎo",
    不: "bù",
    错: "cuò",
    "不 错": "bùcuò",
    棒: "bàng",
    帅: "shuài",
    酷: "kù",
    忙: "máng",
    闲: "xián",
    累: "lèi",
    舒: "shū",
    服: "fu",
    "舒 服": "shūfu",
    饿: "è",
    饱: "bǎo",
    渴: "kě",
    口: "kǒu",
    渴: "kě",
    "口 渴": "kǒukě",
    痛: "tòng",
    病: "bìng",
    医: "yī",
    "医 生": "yīsheng",
    护: "hù",
    士: "shì",
    "护 士": "hùshi",
    房: "fáng",
    间: "jiān",
    "房 间": "fángjiān",
    厕: "cè",
    所: "suǒ",
    "厕 所": "cèsuǒ",
    厨: "chú",
    房: "fáng",
    "厨 房": "chúfáng",
    客: "kè",
    厅: "tīng",
    "客 厅": "kètīng",
    床: "chuáng",
    桌: "zhuō",
    椅: "yǐ",
    沙: "shā",
    发: "fā",
    "沙 发": "shāfā",
    门: "mén",
    窗: "chuāng",
    钥: "yào",
    匙: "shi",
    "钥 匙": "yàoshi",
    钥: "yào",
    怎: "zěn",
    "怎 么": "zěnme",
    你: "nǐ",
    们: "men",
    三: "sān",
    个: "gè",
    都: "dōu",
    没: "méi",
    事: "shì",
    "怎 么 你 们 三 个 都 没 事": "zěnme nǐmen sān gè dōu méi shì",
    "你 好": "nǐhǎo",
    "再 见": "zàijiàn",
    "保 重": "bǎozhòng",
    注: "zhù",
    意: "yì",
    "注 意": "zhùyì",
    安: "ān",
    全: "quán",
    "安 全": "ānquán",
    健: "jiàn",
    康: "kāng",
    "健 康": "jiànkāng",
    祝: "zhù",
    福: "fú",
    "祝 福": "zhùfú",
    庆: "qìng",
    祝: "zhù",
    恭: "gōng",
    喜: "xǐ",
    "恭 喜": "gōngxǐ",
    新: "xīn",
    年: "nián",
    快: "kuài",
    "新 年 快 乐": "xīnnián kuàilè",
    圣: "shèng",
    诞: "dàn",
    快: "kuài",
    "圣 诞 快 乐": "shèngdàn kuàilè",
    生: "shēng",
    日: "rì",
    快: "kuài",
    "生 日 快 乐": "shēngrì kuàilè",
    永: "yǒng",
    远: "yuǎn",
    "永 远": "yǒngyuǎn",
    经: "jīng",
    常: "cháng",
    "经 常": "jīngcháng",
    往: "wǎng",
    往: "wǎng",
    以: "yǐ",
    往: "wǎng",
    "以 往": "yǐwǎng",
    突: "tū",
    然: "rán",
    "突 然": "tūrán",
    必: "bì",
    须: "xū",
    "必 须": "bìxū",
    需: "xū",
    要: "yào",
    "需 要": "xūyào",
    正: "zhèng",
    在: "zài",
    "正 在": "zhèngzài",
    马: "mǎ",
    上: "shàng",
    "马 上": "mǎshàng",
    立: "lì",
    刻: "kè",
    "立 刻": "lìkè",
    已: "yǐ",
    经: "jīng",
    "已 经": "yǐjing",
    马: "mǎ",
    上: "shàng",
    "马 上": "mǎshàng",
    准: "zhǔn",
    备: "bèi",
    "准 备": "zhǔnbèi",
    开: "kāi",
    始: "shǐ",
    "开 始": "kāishǐ",
    结: "jié",
    束: "shù",
    "结 束": "jiéshù",
    完: "wán",
    成: "chéng",
    "完 成": "wánchéng",
    失: "shī",
    败: "bài",
    "失 败": "shībài",
    成: "chéng",
    功: "gōng",
    "成 功": "chénggōng",
    进: "jìn",
    步: "bù",
    "进 步": "jìnbù",
    欢: "huān",
    迎: "yíng",
    "欢 迎": "huānyíng",
    送: "sòng",
    欢: "huān",
    迎: "yíng",
    "欢 送": "huānsòng",
    欢: "huān",
    迎: "yíng",
    光: "guāng",
    临: "lín",
    "欢 迎 光 临": "huānyíng guānglín",
    参: "cān",
    加: "jiā",
    "参 加": "cānjiā",
    参: "cān",
    观: "guān",
    "参 观": "cānguān",
    参: "cān",
    考: "kǎo",
    "参 考": "cānkǎo",
    考: "kǎo",
    试: "shì",
    "考 试": "kǎoshì",
    作: "zuò",
    业: "yè",
    "作 业": "zuòyè",
    答: "dá",
    案: "àn",
    "答 案": "dáàn",
    题: "tí",
    问: "wèn",
    "问 题": "wèntí",
    解: "jiě",
    决: "jué",
    "解 决": "jiějué",
    办: "bàn",
    法: "fǎ",
    "办 法": "bànfǎ",
    知: "zhī",
    道: "dào",
    "知 道": "zhīdào",
    懂: "dǒng",
    不: "bù",
    懂: "dǒng",
    "懂 不 懂": "dǒngbùdǒng",
    会: "huì",
    不: "bù",
    会: "huì",
    "会 不 会": "huìbùhuì",
    记: "jì",
    得: "dé",
    "记 得": "jìde",
    忘: "wàng",
    记: "jì",
    "忘 记": "wàngjì",
    明: "míng",
    白: "bái",
    "明 白": "míngbai",
    清: "qīng",
    楚: "chǔ",
    "清 楚": "qīngchu",
    确: "què",
    定: "dìng",
    "确 定": "quèdìng",
    一: "yī",
    定: "dìng",
    "一 定": "yīdìng",
    肯: "kěn",
    定: "dìng",
    "肯 定": "kěndìng",
    许: "xǔ",
    多: "duō",
    "许 多": "xǔduō",
    少: "shǎo",
    一: "yī",
    点: "diǎn",
    "少 一 点": "shǎo yīdiǎn",
    帮: "bāng",
    助: "zhù",
    "帮 助": "bāngzhù",
    谢: "xiè",
    谢: "xiè",
    "谢 谢": "xièxie",
    不: "bù",
    谢: "xiè",
    "不 谢": "bùxiè",
    没: "méi",
    事: "shì",
    "没 事": "méishì",
    不: "bù",
    用: "yòng",
    "不 用": "bùyòng",
    客: "kè",
    气: "qì",
    "不 客 气": "bùkèqi",
    没: "méi",
    关: "guān",
    系: "xì",
    "没 关 系": "méiguānxi",
    不: "bù",
    好: "hǎo",
    意: "yì",
    思: "si",
    "不 好 意 思": "bùhǎoyìsi",
    麻: "má",
    烦: "fan",
    "麻 烦": "máfan",
    辛: "xīn",
    苦: "kǔ",
    "辛 苦": "xīnkǔ",
    累: "lèi",
    抱: "bào",
    歉: "qiàn",
    "抱 歉": "bàoqiàn",
    对: "duì",
    不: "bù",
    起: "qǐ",
    "对 不 起": "duìbùqǐ",
    没: "méi",
    关: "guān",
    系: "xì",
    "没 关 系": "méiguānxi",
  };

  const results = [];

  // Extract only Chinese characters and spaces from text
  const chineseOnly = text.replace(/[^\u4e00-\u9fff\s]/g, "").trim();

  if (!chineseOnly) {
    return results;
  }

  // Try to match phrases first (longer matches)
  const phrases = chineseOnly.split(/\s+/);

  for (const phrase of phrases) {
    if (!phrase) continue;

    // Try exact phrase match
    if (charDict[phrase]) {
      results.push({ chinese: phrase, pinyin: charDict[phrase] });
      continue;
    }

    // Try character by character
    let allFound = true;
    const charPinyins = [];

    for (const char of phrase) {
      if (charDict[char]) {
        charPinyins.push(charDict[char]);
      } else {
        allFound = false;
        break;
      }
    }

    if (allFound && charPinyins.length > 0) {
      results.push({ chinese: phrase, pinyin: charPinyins.join("") });
    }
  }

  return results;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Comprehensive Korean to Romanization (Revised Romanization by Korean National Institute)
function koreanToRoman(text) {
  // Initial consonants ( onset )
  const onset = {
    ㄱ: "g",
    ㄲ: "kk",
    ㄴ: "n",
    ㄷ: "d",
    ㄸ: "tt",
    ㄹ: "r",
    ㅁ: "m",
    ㅂ: "b",
    ㅃ: "pp",
    ㅅ: "s",
    ㅆ: "ss",
    ㅇ: "",
    ㅈ: "j",
    ㅉ: "jj",
    ㅊ: "ch",
    ㅋ: "k",
    ㅌ: "t",
    ㅍ: "p",
    ㅎ: "h",
  };

  // Medial vowels ( nucleus )
  const nucleus = {
    ㅏ: "a",
    ㅐ: "ae",
    ㅑ: "ya",
    ㅒ: "yae",
    ㅓ: "eo",
    ㅔ: "e",
    ㅕ: "yeo",
    ㅖ: "ye",
    ㅗ: "o",
    ㅘ: "wa",
    ㅙ: "wae",
    ㅚ: "oe",
    ㅛ: "yo",
    ㅜ: "u",
    ㅝ: "wo",
    ㅞ: "we",
    ㅟ: "wi",
    ㅠ: "yu",
    ㅡ: "eu",
    ㅢ: "ui",
    ㅣ: "i",
  };

  // Final consonants ( coda )
  const coda = {
    "": "",
    ㄱ: "k",
    ㄲ: "k",
    ㄳ: "ks",
    ㄴ: "n",
    ㄵ: "nj",
    ㄶ: "nh",
    ㄷ: "t",
    ㄹ: "l",
    ㄺ: "lk",
    ㄻ: "lm",
    ㄼ: "lp",
    ㄽ: "ls",
    ㄾ: "lt",
    ㄿ: "lp",
    ㅀ: "lh",
    ㅁ: "m",
    ㅂ: "p",
    ㅄ: "ps",
    ㅅ: "t",
    ㅆ: "t",
    ㅇ: "ng",
    ㅈ: "t",
    ㅊ: "t",
    ㅋ: "k",
    ㅌ: "t",
    ㅍ: "p",
    ㅎ: "t",
  };

  const chars = [...text];
  let result = "";

  for (const char of chars) {
    const code = char.charCodeAt(0);

    // Check if it's a Hangul syllable
    if (code >= 0xac00 && code <= 0xd7a3) {
      const syllableIndex = code - 0xac00;
      const onsetIndex = Math.floor(syllableIndex / 588);
      const nucleusIndex = Math.floor((syllableIndex % 588) / 28);
      const codaIndex = syllableIndex % 28;

      const onsetChars = Object.keys(onset);
      const nucleusChars = Object.keys(nucleus);
      const codaChars = Object.keys(coda);

      const o = onset[onsetChars[onsetIndex]] || "";
      const v = nucleus[nucleusChars[nucleusIndex]] || "";
      const c = coda[codaChars[codaIndex]] || "";

      result += o + v + c;
    } else if (/[a-zA-Z]/.test(char)) {
      // Keep English letters as is
      result += char;
    } else if (/[\u3000-\u303f\u4e00-\u9fff]/.test(char)) {
      // Chinese character - keep it
      result += char;
    } else if (/[.,!?;:'"()\[\]。，！？；：""''（）【】]/.test(char)) {
      result += char;
    } else {
      // Korean jamo or other - keep as is
      result += char;
    }
  }

  return result;
}

function detectLanguage() {
  const fromLang = document.getElementById("translateFromLang").value;
  const toLang = document.getElementById("translateToLang").value;
  saveLanguages(fromLang, toLang);

  // Re-translate if there's input text
  const inputText = document.getElementById("translateInput").value.trim();
  if (inputText) {
    lastTranslatedText = ""; // Reset to force re-translation
    performTranslation(inputText);
  }
}

function saveToLangSelection() {
  const fromLang = document.getElementById("translateFromLang").value;
  const toLang = document.getElementById("translateToLang").value;
  saveLanguages(fromLang, toLang);

  // Re-translate if there's input text
  const inputText = document.getElementById("translateInput").value.trim();
  if (inputText) {
    lastTranslatedText = ""; // Reset to force re-translation
    performTranslation(inputText);
  }
}

async function performTranslation(text) {
  if (!text.trim() || text === lastTranslatedText) return;

  const input = text.trim();

  const fromLang = document.getElementById("translateFromLang").value;
  const toLang = document.getElementById("translateToLang").value;
  const api =
    document.querySelector('input[name="translateApi"]:checked')?.value ||
    "mymemory";

  const loadingEl = document.getElementById("translateLoading");
  const errorEl = document.getElementById("translateError");
  const outputEl = document.getElementById("translateOutput");
  const detectedEl = document.getElementById("translateDetected");

  loadingEl.style.display = "flex";
  errorEl.style.display = "none";
  outputEl.value = "";
  detectedEl.classList.remove("show");
  document.getElementById("translatePronunciation").innerHTML = "";

  try {
    let translatedText = "";
    let detectedLanguage = null;

    if (api === "mymemory") {
      const fromLangCode = fromLang === "auto" ? "autodetect" : fromLang;
      const langPair = `${fromLangCode}|${toLang}`;

      const response = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(input)}&langpair=${langPair}`,
      );

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      const data = await response.json();

      if (data.responseStatus === 200 && data.responseData) {
        translatedText = data.responseData.translatedText;
        detectedLanguage = data.responseData.detectedLanguage;
      } else {
        throw new Error(data.responseDetails || "Translation failed");
      }
    } else if (api === "google") {
      const sourceLang = fromLang === "auto" ? "auto" : fromLang;
      const targetLang = toLang;

      const response = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(input)}`,
      );

      if (!response.ok) {
        throw new Error("Google Translate error");
      }

      const data = await response.json();
      if (data && data[0]) {
        translatedText = data[0].map((item) => item[0]).join("");
        if (fromLang === "auto" && data[2]) {
          detectedLanguage = data[2];
        }
      } else {
        throw new Error("Translation failed");
      }
    }

    loadingEl.style.display = "none";
    outputEl.value = translatedText;
    lastTranslatedText = input;

    // Auto-load pronunciation if enabled
    const showPronunciation =
      document.getElementById("showPronunciation")?.checked;
    if (showPronunciation && translatedText) {
      document.getElementById("translatePronunciation").style.display = "block";
      loadPronunciation(translatedText, toLang);
    } else {
      document.getElementById("translatePronunciation").style.display = "none";
    }

    if (fromLang === "auto" && detectedLanguage) {
      const detectedLang = detectedLanguage.toLowerCase();
      const langNames = {
        en: "Tiếng Anh",
        ko: "Tiếng Hàn",
        zh: "Tiếng Trung",
        vi: "Tiếng Việt",
      };
      const langEmojis = {
        en: "🇬🇧",
        ko: "🇰🇷",
        zh: "🇨🇳",
        vi: "🇻🇳",
      };
      const langName = langNames[detectedLang] || detectedLang;
      const langEmoji = langEmojis[detectedLang] || "";
      detectedEl.innerHTML = `${langEmoji} Đã nhận diện: <strong>${langName}</strong>`;
      detectedEl.classList.add("show");
    }
  } catch (err) {
    loadingEl.style.display = "none";
    errorEl.innerText = "Lỗi dịch: " + err.message + ". Vui lòng thử lại.";
    errorEl.style.display = "block";
    document.getElementById("translatePronunciation").style.display = "none";
    console.error("Translation error:", err);
  }
}

function swapLanguages() {
  const fromSelect = document.getElementById("translateFromLang");
  const toSelect = document.getElementById("translateToLang");
  const input = document.getElementById("translateInput");
  const output = document.getElementById("translateOutput");

  if (fromSelect.value === "auto") {
    return;
  }

  const tempValue = fromSelect.value;
  fromSelect.value = toSelect.value;
  toSelect.value = tempValue;

  saveLanguages(fromSelect.value, toSelect.value);

  const inputText = input.value;
  const outputText = output.value;

  input.value = outputText;
  output.value = "";

  document.getElementById("translateDetected").classList.remove("show");
}

async function copyTranslation() {
  const output = document.getElementById("translateOutput");
  const text = output.value;

  if (!text) return;

  const copyBtn = document.querySelector(".translate-copy-btn");
  const originalSvg = copyBtn.innerHTML;

  try {
    await navigator.clipboard.writeText(text);
    copyBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
    </svg>`;
    copyBtn.classList.add("copied");

    setTimeout(() => {
      copyBtn.innerHTML = originalSvg;
      copyBtn.classList.remove("copied");
    }, 2000);
  } catch (err) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);

    copyBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
    </svg>`;
    copyBtn.classList.add("copied");

    setTimeout(() => {
      copyBtn.innerHTML = originalSvg;
      copyBtn.classList.remove("copied");
    }, 2000);
  }
}

/* ========================== TRANSLATE HISTORY ========================== */

async function saveTranslateToHistory(
  originalText,
  translatedText,
  fromLang,
  toLang,
) {
  if (!originalText || !translatedText) {
    console.log("Translate history: Missing text, skipping save");
    return;
  }

  if (!firebaseTranslateHistoryRef) {
    console.log("Translate history: Firebase not ready, skipping save");
    return;
  }

  const historyEntry = {
    original: originalText,
    translated: translatedText,
    fromLang: fromLang,
    toLang: toLang,
    timestamp: new Date().toISOString(),
  };

  console.log("Translate history: Saving entry", historyEntry);

  try {
    await firebaseTranslateHistoryRef.push(historyEntry);
    console.log("Translate history: Saved successfully");
  } catch (err) {
    console.error("Lỗi lưu lịch sử dịch:", err);
  }
}

function renderTranslateHistory() {
  const container = document.getElementById("translateHistoryList");
  if (!container) return;

  if (translateHistoryCache.length === 0) {
    container.innerHTML = `
      <div class="app-empty-state">
        <div class="app-empty-icon">🌐</div>
        <div class="app-empty-title">Chưa có lịch sử dịch</div>
        <div class="app-empty-desc">Các đoạn văn bản đã dịch sẽ được tự động lưu lại tại đây.</div>
      </div>
    `;
    return;
  }

  const langNames = {
    auto: "Tự động",
    en: "Tiếng Anh",
    ko: "Tiếng Hàn",
    zh: "Tiếng Trung",
    vi: "Tiếng Việt",
  };

  container.innerHTML = translateHistoryCache
    .map((item) => {
      const date = new Date(item.timestamp);
      const timeStr = date.toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });

      return `
      <div class="translate-history-item" data-id="${item.id}">
        <div class="translate-history-item-header">
          <span class="translate-history-lang">${langNames[item.fromLang] || item.fromLang} → ${langNames[item.toLang] || item.toLang}</span>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="translate-history-time">${timeStr}</span>
            <div class="translate-history-actions-btns">
              <button class="translate-history-delete-btn" onclick="deleteTranslateHistoryItem('${item.id}')" title="Xóa">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
        <div class="translate-history-original">${escapeHtml(item.original)}</div>
        <div class="translate-history-translated">${escapeHtml(item.translated)}</div>
      </div>
    `;
    })
    .join("");
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

async function deleteTranslateHistoryItem(id) {
  if (!firebaseTranslateHistoryRef) return;

  try {
    await firebaseTranslateHistoryRef.child(id).remove();
    updateTranslateHistoryBadge();
  } catch (err) {
    console.error("Lỗi xóa lịch sử dịch:", err);
    showToast("Lỗi khi xóa lịch sử dịch");
  }
}

async function confirmDeleteAllTranslateHistory() {
  // Close history modal if open, since the action is from there
  const historyModal = document.getElementById("translateHistoryModal");
  const isHistoryModalOpen =
    historyModal && historyModal.style.display === "flex";

  if (isHistoryModalOpen) {
    closeTranslateHistoryModal();
  }

  if (!firebaseTranslateHistoryRef) return;

  if (translateHistoryCache.length === 0) {
    showToast("Không có lịch sử để xóa");
    return;
  }

  showConfirmPopup(
    "Xóa tất cả lịch sử dịch",
    `Bạn có chắc muốn xóa tất cả ${translateHistoryCache.length} lịch sử dịch? Hành động này không thể hoàn tác.`,
    "Xóa tất cả",
    async () => {
      try {
        await firebaseTranslateHistoryRef.remove();
        showToast("Đã xóa tất cả lịch sử dịch");
        updateTranslateHistoryBadge();
      } catch (err) {
        console.error("Lỗi xóa tất cả lịch sử dịch:", err);
        showToast("Lỗi khi xóa lịch sử dịch");
      }
    },
  );
}

function exportTranslateHistoryCsv() {
  if (translateHistoryCache.length === 0) {
    showToast("Không có lịch sử để xuất");
    return;
  }

  const langNames = {
    auto: "Tự động",
    en: "Tiếng Anh",
    ko: "Tiếng Hàn",
    zh: "Tiếng Trung",
    vi: "Tiếng Việt",
  };

  let csvContent = "\uFEFF"; // BOM for UTF-8
  csvContent +=
    "STT,Ngày giờ,Ngôn ngữ nguồn,Ngôn ngữ đích,Văn bản gốc,Văn bản dịch\n";

  translateHistoryCache.forEach((item, index) => {
    const date = new Date(item.timestamp).toLocaleString("vi-VN");
    const fromLang = langNames[item.fromLang] || item.fromLang;
    const toLang = langNames[item.toLang] || item.toLang;
    const original = (item.original || "").replace(/"/g, '""');
    const translated = (item.translated || "").replace(/"/g, '""');

    csvContent += `${index + 1},"${date}","${fromLang}","${toLang}","${original}","${translated}"\n`;
  });

  downloadCsvFile(
    csvContent,
    `lich-su-dich-${formatDateForFilename(new Date())}.csv`,
  );
  showToast("Đã xuất file CSV thành công");
}

function formatDateForFilename(date) {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

function downloadCsvFile(content, filename) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Modify performTranslation to save history - save directly after successful translation
const originalPerformTranslation = performTranslation;
performTranslation = async function (text) {
  const fromLang = document.getElementById("translateFromLang").value;
  const toLang = document.getElementById("translateToLang").value;

  await originalPerformTranslation(text);

  // Save to history after successful translation (only if there's output)
  const outputEl = document.getElementById("translateOutput");
  const translatedText = outputEl ? outputEl.value : "";

  if (translatedText && translatedText.trim() && text && text.trim()) {
    saveTranslateToHistory(
      text.trim(),
      translatedText.trim(),
      fromLang,
      toLang,
    );
    updateTranslateHistoryBadge();
  }
};

// Auto-translate on Enter (Shift+Enter for newline)
document.addEventListener("DOMContentLoaded", function () {
  const translateInput = document.getElementById("translateInput");
  if (translateInput) {
    translateInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const text = this.value.trim();
        if (text) {
          performTranslation(text);
        }
      }
    });
  }
});

/* ========================== LEARN MODAL FUNCTIONS ========================== */

// Learning state variables
let currentLearnLanguage = localStorage.getItem("learnSelectedLanguage") || "en";
let currentVocabCategory = "all";
let currentVocabIndex = 0;
let currentVocabList = [];
let currentGrammarCategory = "all";
let currentGrammarIndex = 0;
let currentGrammarList = [];
let currentPhraseCategory = "all";
let currentPhraseIndex = 0;
let currentPhraseList = [];

// Quiz state variables
let currentQuizType = "";
let currentQuizQuestions = [];
let currentQuizIndex = 0;
let currentQuizScore = 0;
let currentQuizAnswered = false;

// Helpers to get active dataset based on current language
function getActiveVocabularyData() {
  return currentLearnLanguage === "zh" ? ZH_VOCABULARY_DATA : VOCABULARY_DATA;
}

function getActiveGrammarData() {
  return currentLearnLanguage === "zh" ? ZH_GRAMMAR_DATA : GRAMMAR_DATA;
}

function getActivePhrasesData() {
  return currentLearnLanguage === "zh" ? ZH_PHRASES_DATA : PHRASES_DATA;
}

// Initialize all vocabulary
function getAllVocabulary() {
  return Object.values(getActiveVocabularyData()).flat();
}

// Initialize all grammar
function getAllGrammar() {
  return Object.values(getActiveGrammarData()).flat();
}

// Initialize all phrases
function getAllPhrases() {
  return Object.values(getActivePhrasesData()).flat();
}

// Render dynamic category pills
function renderCategoryButtons(containerId, categoriesObj, selectedCat, clickHandlerName) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = Object.entries(categoriesObj)
    .map(([catKey, catLabel]) => {
      const activeClass = catKey === selectedCat ? " active" : "";
      return `<button class="learn-category-btn${activeClass}" onclick="${clickHandlerName}('${catKey}')" data-cat="${catKey}">${catLabel}</button>`;
    })
    .join("");
}

// Switch between English and Chinese
function switchLearnLanguage(lang) {
  if (lang !== "en" && lang !== "zh") lang = "en";
  currentLearnLanguage = lang;
  localStorage.setItem("learnSelectedLanguage", lang);

  // Update button active states
  const enBtn = document.getElementById("learnLangEnBtn");
  const zhBtn = document.getElementById("learnLangZhBtn");
  if (enBtn) enBtn.classList.toggle("active", lang === "en");
  if (zhBtn) zhBtn.classList.toggle("active", lang === "zh");

  // Show/Hide Basics Tab Button (Only for Chinese)
  const basicsTabBtn = document.getElementById("learnBasicsTabBtn");
  if (basicsTabBtn) {
    basicsTabBtn.style.display = lang === "zh" ? "flex" : "none";
  }

  // Update modal title
  const titleEl = document.getElementById("learnModalTitle");
  if (titleEl) {
    titleEl.textContent = lang === "zh" ? "Học Tiếng Trung" : "Học Tiếng Anh";
  }

  // Update search placeholder
  const searchInput = document.getElementById("vocabSearchInput");
  if (searchInput) {
    searchInput.placeholder =
      lang === "zh"
        ? "Tìm kiếm từ vựng (Hán tự, Pinyin, Tiếng Việt)..."
        : "Tìm kiếm từ vựng...";
  }

  // Render category buttons for current language
  renderCategoryButtons(
    "vocabCategorySelector",
    lang === "zh" ? ZH_VOCAB_CATEGORIES : EN_VOCAB_CATEGORIES,
    "all",
    "selectVocabCategory",
  );
  renderCategoryButtons(
    "grammarCategorySelector",
    lang === "zh" ? ZH_GRAMMAR_CATEGORIES : EN_GRAMMAR_CATEGORIES,
    "all",
    "selectGrammarCategory",
  );
  renderCategoryButtons(
    "phraseCategorySelector",
    lang === "zh" ? ZH_PHRASE_CATEGORIES : EN_PHRASE_CATEGORIES,
    "all",
    "selectPhraseCategory",
  );

  // Render Basics section if in Chinese mode
  if (lang === "zh") {
    renderBasicsSection();
  }

  // Reset tab contents
  currentVocabCategory = "all";
  currentVocabIndex = 0;
  currentVocabList = getAllVocabulary();
  renderVocabCard();

  currentGrammarCategory = "all";
  currentGrammarIndex = 0;
  currentGrammarList = getAllGrammar();
  renderGrammarCard();

  currentPhraseCategory = "all";
  currentPhraseIndex = 0;
  currentPhraseList = getAllPhrases();
  renderPhraseCard();

  // Clear search results
  clearVocabSearch();
}

// ==================== VOCABULARY SEARCH RESULTS TOGGLE ====================
const VOCAB_SEARCH_COLLAPSED_KEY = "vocabSearchResultsCollapsed";

function toggleVocabSearchResults() {
  const resultsContainer = document.getElementById("vocabSearchResults");
  const arrowEl = document.getElementById("vocabSearchResultsArrow");

  if (!resultsContainer || !arrowEl) return;

  const isCollapsed = resultsContainer.classList.toggle("collapsed");
  arrowEl.classList.toggle("collapsed", isCollapsed);
  localStorage.setItem(
    VOCAB_SEARCH_COLLAPSED_KEY,
    isCollapsed ? "true" : "false",
  );
}

function initVocabSearchResultsCollapsed() {
  const resultsContainer = document.getElementById("vocabSearchResults");
  const arrowEl = document.getElementById("vocabSearchResultsArrow");

  if (!resultsContainer || !arrowEl) return;

  const saved = localStorage.getItem(VOCAB_SEARCH_COLLAPSED_KEY);
  const isCollapsed = saved === "true";

  resultsContainer.classList.toggle("collapsed", isCollapsed);
  arrowEl.classList.toggle("collapsed", isCollapsed);
}

// ==================== VOCABULARY API SEARCH ====================
async function searchVocabFromAPI() {
  const input = document.getElementById("vocabSearchInput");
  const query = input.value.trim().toLowerCase();
  if (!query) return;

  const resultsContainer = document.getElementById("vocabSearchResults");
  const arrowEl = document.getElementById("vocabSearchResultsArrow");
  const wrapper = document.getElementById("vocabSearchResultsWrapper");

  // Ensure results are visible when searching
  resultsContainer.classList.remove("collapsed");
  if (arrowEl) arrowEl.classList.remove("collapsed");
  wrapper.classList.add("has-results");

  resultsContainer.innerHTML =
    '<div style="text-align:center;padding:20px;"><div class="loading-spinner" style="margin:0 auto;"></div></div>';

  try {
    const isVietnamese =
      /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(
        query,
      );

    // Search local data first
    const localResults = searchLocalVocabulary(query);

    if (currentLearnLanguage === "zh") {
      // In Chinese mode: display local matches or translation via API
      if (localResults.length > 0) {
        displayLocalVocabularyResults(localResults);
        return;
      }

      // If not in local data, fetch translation
      const langPair = isVietnamese ? "vi|zh-CN" : "zh-CN|vi";
      const transResult = await fetchTranslationCustom(query, langPair);

      if (transResult) {
        const chineseWord = isVietnamese ? transResult : query;
        const vietnameseMeaning = isVietnamese ? query : transResult;

        // Try to generate Pinyin for the Chinese word
        let pinyinText = "";
        try {
          if (typeof pinyinPro !== "undefined" && pinyinPro.pinyin) {
            pinyinText = pinyinPro.pinyin(chineseWord, { toneType: "symbol" });
          } else {
            // Check basic pinyin dictionary
            const basicResults = getBasicPinyin(chineseWord);
            if (basicResults && basicResults.length > 0) {
              pinyinText = basicResults[0].pinyin;
            }
          }
        } catch (e) {
          console.warn("Pinyin conversion error:", e);
        }

        resultsContainer.innerHTML = `
          <div class="learn-search-result-item">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <div class="learn-search-result-word learn-card-word-zh" style="font-size: 24px;">${chineseWord}</div>
              <button class="learn-card-example-speak-btn" onclick="speakChinese('${escapeHtml(chineseWord)}')" title="Nghe phát âm" style="font-size: 18px; padding: 4px 8px; background: rgba(168, 85, 247, 0.15); border-radius: 50%;">🔊</button>
            </div>
            ${pinyinText ? `<div class="learn-search-result-phonetic" style="color: #38bdf8; font-weight: 500; font-family: 'Fira Code', monospace; margin: 4px 0 6px;">${pinyinText}</div>` : ""}
            <div class="learn-search-result-meaning" style="font-size: 15px; font-weight: 600; color: var(--text);">${vietnameseMeaning}</div>
          </div>
        `;
      } else {
        resultsContainer.innerHTML = getNoResultsHTML();
      }
      return;
    }

    // English mode search
    let searchQuery = query;
    let translatedQuery = null;

    if (isVietnamese) {
      translatedQuery = await translateViToEn(query);
      if (translatedQuery) {
        searchQuery = translatedQuery;
      }
    }

    const localEnglishResults = searchLocalVocabulary(query, translatedQuery);

    const response = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(searchQuery)}`,
    );

    if (response.ok) {
      const data = await response.json();
      displayAPIVocabularyResultsWithTranslation(
        data,
        localEnglishResults,
        query,
        translatedQuery,
      );
    } else {
      if (localEnglishResults.length > 0) {
        displayLocalVocabularyResults(localEnglishResults, translatedQuery);
      } else {
        resultsContainer.innerHTML = getNoResultsHTML();
        wrapper.classList.remove("has-results");
      }
    }
  } catch (error) {
    const localResults = searchLocalVocabulary(query);
    if (localResults && localResults.length > 0) {
      displayLocalVocabularyResults(localResults);
    } else {
      resultsContainer.innerHTML = getNoResultsHTML(
        "Không thể kết nối API. Vui lòng thử lại.",
      );
      wrapper.classList.remove("has-results");
    }
  }
}

// Fetch custom translation pair
async function fetchTranslationCustom(text, langpair = "vi|zh-CN") {
  try {
    const response = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langpair}`,
    );
    if (response.ok) {
      const data = await response.json();
      if (data.responseStatus === 200 && data.responseData) {
        return data.responseData.translatedText;
      }
    }
  } catch (e) {
    // Silently fail
  }
  return null;
}

// Translate Vietnamese to English
async function translateViToEn(text) {
  return fetchTranslationCustom(text, "vi|en");
}

// Open Language Picker Modal (shown first when user clicks "Học Tiếng")
function openLearnModal() {
  const picker = document.getElementById("learnLangPickerModal");
  picker.style.display = "flex";
  document.body.style.overflow = "hidden";
}

// Close Language Picker Modal
function closeLearnLangPicker() {
  const picker = document.getElementById("learnLangPickerModal");
  picker.style.display = "none";
  document.body.style.overflow = "";
}

// User selected a language from picker → open the learn modal
function selectLearnLanguageAndOpen(lang) {
  closeLearnLangPicker();
  const modal = document.getElementById("learnModal");
  modal.style.display = "flex";
  document.body.style.overflow = "hidden";

  // Reset to vocabulary tab
  document.querySelectorAll(".learn-tab").forEach((t) => t.classList.remove("active"));
  document.querySelectorAll(".learn-tab-content").forEach((c) => c.classList.remove("active"));
  document.querySelector('.learn-tab[data-tab="vocabulary"]').classList.add("active");
  document.getElementById("learnVocabularyTab").classList.add("active");
  initVocabSearchResultsCollapsed();

  // Apply chosen language
  switchLearnLanguage(lang);
}

// Back button inside learn modal → close learn modal, reopen picker
function backToLearnLangPicker() {
  document.getElementById("learnModal").style.display = "none";
  const picker = document.getElementById("learnLangPickerModal");
  picker.style.display = "flex";
}

// Close Learn Modal
function closeLearnModal() {
  document.getElementById("learnModal").style.display = "none";
  document.body.style.overflow = "";
}

// No results HTML template with illustration
function getNoResultsHTML(message = "Không tìm thấy kết quả nào.") {
  return `
    <div class="vocab-no-results">
      <svg class="vocab-no-results-icon" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="60" cy="60" r="50" fill="var(--surface-2)" />
        <circle cx="60" cy="60" r="35" stroke="var(--muted)" stroke-width="2" stroke-dasharray="4 4" fill="none" />
        <text x="60" y="55" text-anchor="middle" font-size="28" font-weight="600" fill="var(--text-secondary)">Aa</text>
        <text x="60" y="72" text-anchor="middle" font-size="12" fill="var(--muted)">?</text>
        <line x1="35" y1="95" x2="85" y2="95" stroke="var(--line)" stroke-width="2" stroke-linecap="round" />
        <circle cx="40" cy="95" r="3" fill="var(--accent)" opacity="0.6" />
        <circle cx="60" cy="95" r="3" fill="var(--accent)" opacity="0.4" />
        <circle cx="80" cy="95" r="3" fill="var(--accent)" opacity="0.6" />
      </svg>
      <div class="vocab-no-results-text">${message}</div>
      <div class="vocab-no-results-hint">Thử tìm kiếm với từ khóa khác</div>
    </div>
  `;
}

// Fetch Vietnamese translation using MyMemory API
async function fetchTranslation(text) {
  return fetchTranslationCustom(text, "en|vi");
}

function searchLocalVocabulary(query, translatedQuery = null) {
  const allVocab = getAllVocabulary();
  const searchTerms = [query.toLowerCase()];
  if (translatedQuery) searchTerms.push(translatedQuery.toLowerCase());

  return allVocab.filter((item) => {
    const word = (item.word || "").toLowerCase();
    const phonetic = (item.phonetic || "").toLowerCase();
    const meaning = (item.meaning || "").toLowerCase();
    return searchTerms.some(
      (term) =>
        word.includes(term) ||
        phonetic.includes(term) ||
        meaning.includes(term),
    );
  });
}

async function displayLocalVocabularyResults(results, translatedQuery = null) {
  const resultsContainer = document.getElementById("vocabSearchResults");
  const wrapper = document.getElementById("vocabSearchResultsWrapper");

  if (results.length === 0) {
    wrapper.classList.remove("has-results");
    resultsContainer.innerHTML = "";
    return;
  }

  wrapper.classList.add("has-results");

  let headerHtml = "";
  if (translatedQuery) {
    headerHtml = `<div style="padding:12px 16px;background:#64B5F6;color:white;border-radius:8px;margin:12px 16px 8px;">
      <div style="font-size:12px;opacity:0.9;">Từ tiếng Việt:</div>
      <div style="font-size:18px;font-weight:600;margin-top:4px;">${results[0]?.meaning || ""}</div>
    </div>`;
  }

  const isZh = currentLearnLanguage === "zh";

  resultsContainer.innerHTML =
    headerHtml +
    results
      .map(
        (item) => `
    <div class="learn-search-result-item">
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div class="learn-search-result-word ${isZh ? "learn-card-word-zh" : ""}" style="font-size: 22px;">${item.word}</div>
        <button class="learn-card-example-speak-btn" onclick="${isZh ? `speakChinese('${escapeHtml(item.word)}')` : `speakEnglish('${escapeHtml(item.word)}')`}" title="Nghe phát âm" style="font-size: 16px;">🔊</button>
      </div>
      <div class="learn-search-result-phonetic" style="color: #38bdf8; font-weight: 500;">
        ${item.phonetic || ""} ${item.hanviet ? `<span style="color: #a78bfa; margin-left: 6px;">[${item.hanviet}]</span>` : ""}
      </div>
      <div class="learn-search-result-meaning" style="font-weight: 600; margin-top: 4px;">${item.meaning}</div>
      ${item.example ? `<div class="learn-search-result-example" style="font-style: normal; color: var(--accent-strong);">${item.example}</div>` : ""}
      ${item.examplePinyin ? `<div style="font-size: 12px; color: #38bdf8; font-style: italic;">${item.examplePinyin}</div>` : ""}
      ${item.exampleVi ? `<div class="learn-search-result-example" style="color: var(--muted);">${item.exampleVi}</div>` : ""}
    </div>
  `,
      )
      .join("");
}

// Display API results with Vietnamese translations
async function displayAPIVocabularyResultsWithTranslation(
  apiData,
  localResults,
  query,
  translatedQuery = null,
) {
  const resultsContainer = document.getElementById("vocabSearchResults");
  const wrapper = document.getElementById("vocabSearchResultsWrapper");
  let html = "";

  const mainTranslation = await fetchTranslation(translatedQuery || query);

  if (translatedQuery) {
    html += `<div style="padding:12px 16px;background:#64B5F6;color:white;border-radius:8px;margin:12px 16px 8px;">
      <div style="font-size:12px;opacity:0.9;">🔍 Từ tiếng Việt: "${query}"</div>
      <div style="font-size:14px;opacity:0.9;margin-top:4px;">→ Từ tiếng Anh: "${translatedQuery}"</div>
      <div style="font-size:18px;font-weight:600;margin-top:8px;">${mainTranslation}</div>
    </div>`;
  } else {
    html += `<div style="padding:12px 16px;background:#64B5F6;color:white;border-radius:8px;margin:12px 16px 8px;">
      <div style="font-size:12px;opacity:0.9;">Nghĩa tiếng Việt:</div>
      <div style="font-size:18px;font-weight:600;margin-top:4px;">${mainTranslation}</div>
    </div>`;
  }

  const localWords = new Set(localResults.map((r) => r.word.toLowerCase()));
  const apiResultsHtml = [];

  for (const entry of apiData) {
    const word = entry.word;
    if (localWords.has(word.toLowerCase())) continue;

    const phonetic = entry.phonetic || "";
    const meanings = entry.meanings || [];

    let itemHtml = `<div class="learn-search-result-item">`;
    itemHtml += `<div class="learn-search-result-word">${word}</div>`;
    itemHtml += `<div class="learn-search-result-phonetic">${phonetic}</div>`;

    for (const meaning of meanings) {
      const partOfSpeech = meaning.partOfSpeech || "";
      const definitions = meaning.definitions || [];
      const partOfSpeechVi = translatePartOfSpeech(partOfSpeech);

      for (let defIdx = 0; defIdx < Math.min(definitions.length, 3); defIdx++) {
        const def = definitions[defIdx];
        const definition = def.definition || "";
        const example = def.example || "";

        let meaningVi = "";
        if (definition) {
          meaningVi = await fetchTranslation(definition);
        }

        itemHtml += `<div style="margin-top:${defIdx === 0 ? "10px" : "8px"};padding-left:8px;border-left:2px solid var(--line);">`;
        itemHtml += `<span style="display:inline-block;padding:2px 8px;background:var(--accent);border-radius:10px;color:white;font-size:10px;margin-right:8px;">${partOfSpeechVi}</span>`;
        itemHtml += `<span style="font-size:13px;color:var(--text);">${defIdx + 1}. ${definition}</span>`;

        if (meaningVi) {
          itemHtml += `<div style="font-size:13px;color:var(--accent);margin-top:4px;padding-left:4px;">→ ${meaningVi}</div>`;
        }

        if (example) {
          itemHtml += `<div class="learn-search-result-example">"${example}"</div>`;
        }
        itemHtml += `</div>`;
      }
    }

    itemHtml += `</div>`;
    apiResultsHtml.push(itemHtml);
  }

  html += apiResultsHtml.join("");

  if (localResults.length > 0) {
    html += `<div style="padding:12px 16px;font-weight:600;color:var(--muted);font-size:12px;border-top:1px solid var(--line);margin-top:8px;">📚 Kết quả từ dữ liệu cục bộ (có ví dụ):</div>`;
    html += localResults
      .map(
        (item) => `
      <div class="learn-search-result-item">
        <div class="learn-search-result-word">${item.word}</div>
        <div class="learn-search-result-phonetic">${item.phonetic || ""}</div>
        <div class="learn-search-result-meaning">${item.meaning}</div>
        <div class="learn-search-result-example">📝 ${item.example}</div>
        <div style="font-size:13px;color:var(--accent);margin-top:4px;">💡 ${item.exampleVi}</div>
      </div>
    `,
      )
      .join("");
  }

  if (!html) {
    html = getNoResultsHTML();
    wrapper.classList.remove("has-results");
  } else {
    wrapper.classList.add("has-results");
  }

  resultsContainer.innerHTML = html;
}

// Translate English part of speech to Vietnamese
function translatePartOfSpeech(pos) {
  const translations = {
    noun: "Danh từ",
    verb: "Động từ",
    adjective: "Tính từ",
    adverb: "Trạng từ",
    pronoun: "Đại từ",
    preposition: "Giới từ",
    conjunction: "Liên từ",
    interjection: "Thán từ",
    phrase: "Cụm từ",
    idiom: "Thành ngữ",
    exclamation: "Cảm thán",
    determiner: "Chỉ từ",
    classifier: "Đếm từ",
    article: "Mạo từ",
  };
  return translations[pos.toLowerCase()] || pos;
}

function handleVocabSearch(event) {
  const input = document.getElementById("vocabSearchInput");
  const clearBtn = document.getElementById("vocabSearchClearBtn");

  if (clearBtn) {
    clearBtn.style.display = input.value.trim() ? "flex" : "none";
  }

  if (event.key === "Enter") {
    searchVocabFromAPI();
  }
}

function clearVocabSearch() {
  const input = document.getElementById("vocabSearchInput");
  const clearBtn = document.getElementById("vocabSearchClearBtn");
  const wrapper = document.getElementById("vocabSearchResultsWrapper");

  if (input) input.value = "";
  if (clearBtn) clearBtn.style.display = "none";
  if (wrapper) wrapper.classList.remove("has-results");
}

function closeVocabSearchResults() {
  const wrapper = document.getElementById("vocabSearchResultsWrapper");
  if (wrapper) wrapper.classList.remove("has-results");
}


// Speak Chinese TTS helper
function speakChinese(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel(); // Dừng câu trước nếu đang đọc
  // Lọc bỏ phần Latin/pinyin (ký tự ASCII + dấu thanh Latin), chỉ giữ chữ Hán và khoảng trắng giữa chúng
  const chineseOnly = text.replace(/[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]+/g, " ").replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim();
  const cleanText = (chineseOnly || text).trim();
  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = "zh-CN";
  utterance.rate = 0.85; // Tốc độ vừa phải cho người mới học
  window.speechSynthesis.speak(utterance);
}


// Speak English TTS helper
function speakEnglish(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}

// Switch Learn Tab
function switchLearnTab(tab) {
  document
    .querySelectorAll(".learn-tab")
    .forEach((t) => t.classList.remove("active"));
  document
    .querySelectorAll(".learn-tab-content")
    .forEach((c) => c.classList.remove("active"));

  const targetTabBtn = document.querySelector(`.learn-tab[data-tab="${tab}"]`);
  if (targetTabBtn) targetTabBtn.classList.add("active");

  const targetContent = document.getElementById(`learn${tab.charAt(0).toUpperCase() + tab.slice(1)}Tab`);
  if (targetContent) targetContent.classList.add("active");

  if (tab === "basics") renderBasicsSection();
  else if (tab === "vocabulary") selectVocabCategory("all");
  else if (tab === "grammar") selectGrammarCategory("all");
  else if (tab === "phrases") selectPhraseCategory("all");
}

// Render Chinese Basics (Pinyin, Vận mẫu, Thanh mẫu, Thanh điệu, Các nét, Bộ thủ)
let currentBasicsSubTab = "initials";
function switchBasicsSubTab(subTab) {
  currentBasicsSubTab = subTab;
  const container = document.getElementById("learnBasicsContainer");
  if (!container) return;

  // Chỉ cập nhật active class trên nút, không re-render toàn bộ
  container.querySelectorAll(".basics-subtab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.subTab === subTab);
  });

  // Chỉ render lại phần nội dung
  const panel = container.querySelector(".basics-content-panel");
  if (panel) {
    panel.innerHTML = renderBasicsContentHTML();
  }

  // Cuộn thanh subtab bar ngang đến nút active
  const bar = container.querySelector(".basics-subtab-bar");
  const activeBtn = bar ? bar.querySelector(".basics-subtab-btn.active") : null;
  if (bar && activeBtn) {
    const barRect = bar.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();
    const btnCenter = btnRect.left - barRect.left + bar.scrollLeft + btnRect.width / 2;
    bar.scrollTo({ left: btnCenter - bar.offsetWidth / 2, behavior: "smooth" });
  }
}

// Render only the content panel HTML (no header/subtab bar)
function renderBasicsContentHTML() {
  if (typeof ZH_BASICS_DATA === "undefined") return "";
  let html = "";

  if (currentBasicsSubTab === "initials") {
    html += `
      <div class="basics-grid-intro">
        💡 <strong>Mẹo học Thanh mẫu:</strong> Bấm vào từng âm để nghe giọng đọc bản xứ. Chú ý phân biệt nhóm âm bật hơi (<strong>p, t, k, q, ch, c</strong>) và âm uốn lưỡi (<strong>zh, ch, sh, r</strong>).
      </div>
      <div class="basics-pinyin-grid">
        ${ZH_BASICS_DATA.initials
        .map(
          (item) => `
          <div class="basics-pinyin-card" onclick="speakChinese('${item.audioText || item.char}')" title="Bấm để nghe phát âm">
            <div class="basics-pinyin-top">
              <span class="basics-pinyin-char">${item.char}</span>
              <span class="basics-pinyin-ipa">${item.ipa}</span>
              <button class="basics-audio-btn" aria-label="Phát âm">🔊</button>
            </div>
            <div class="basics-pinyin-tip">${item.tip}</div>
          </div>
        `
        )
        .join("")}
      </div>
    `;
  } else if (currentBasicsSubTab === "finals") {
    html += `
      <div class="basics-grid-intro">
        💡 <strong>Mẹo học Vận mẫu:</strong> Vận mẫu đặc biệt <strong>ü</strong> (u hai chấm) giữ nguyên khẩu hình tròn môi khi phát âm. Bấm vào thẻ để nghe đọc.
      </div>
      <div class="basics-pinyin-grid">
        ${ZH_BASICS_DATA.finals
        .map(
          (item) => `
          <div class="basics-pinyin-card" onclick="speakChinese('${item.char}')" title="Bấm để nghe phát âm">
            <div class="basics-pinyin-top">
              <span class="basics-pinyin-char">${item.char}</span>
              <button class="basics-audio-btn" aria-label="Phát âm">🔊</button>
            </div>
            <div class="basics-pinyin-tip">${item.tip}</div>
          </div>
        `
        )
        .join("")}
      </div>
    `;
  } else if (currentBasicsSubTab === "tones") {
    html += `
      <div class="basics-tones-list">
        ${ZH_BASICS_DATA.tones
        .map(
          (item) => `
          <div class="basics-tone-card">
            <div class="basics-tone-header">
              <div class="basics-tone-badge">${item.symbol}</div>
              <div class="basics-tone-name">${item.tone}</div>
              <button class="basics-tone-play-btn" onclick="speakChinese('${item.audioText}')">🔊 Nghe mẫu (${item.example})</button>
            </div>
            <div class="basics-tone-desc" style="white-space: pre-line;">${item.desc}</div>
          </div>
        `
        )
        .join("")}
      </div>
    `;
  } else if (currentBasicsSubTab === "strokes") {
    html += `
      <div class="basics-grid-intro">
        ✍️ <strong>7 Quy tắc thuận bút:</strong> 1. Ngang trước sổ sau; 2. Phẩy trước mác sau; 3. Trên trước dưới sau; 4. Trái trước phải sau; 5. Ngoài trước trong sau; 6. Vào trước đóng sau; 7. Giữa trước hai bên sau.
      </div>
      <div class="basics-strokes-grid">
        ${ZH_BASICS_DATA.strokes
        .map(
          (item) => `
          <div class="basics-stroke-card">
            <div class="basics-stroke-char">${item.char}</div>
            <div class="basics-stroke-name">${item.name}</div>
            <div class="basics-stroke-desc">${item.desc}</div>
          </div>
        `
        )
        .join("")}
      </div>
    `;
  } else if (currentBasicsSubTab === "radicals") {
    html += `
      <div class="basics-grid-intro">
        🧱 <strong>Bộ thủ (Radicals):</strong> Là linh hồn của chữ Hán, hiểu bộ thủ giúp bạn đoán được 80% trường nghĩa của từ vựng mới!
      </div>
      <div class="basics-radicals-grid">
        ${ZH_BASICS_DATA.radicals
        .map(
          (item) => `
          <div class="basics-radical-card" onclick="speakChinese('${item.char}')">
            <div class="basics-radical-top">
              <span class="basics-radical-char">${item.char}</span>
              <span class="basics-radical-pinyin">${item.pinyin}</span>
              <button class="basics-audio-btn">🔊</button>
            </div>
            <div class="basics-radical-name">${item.name}</div>
            <div class="basics-radical-meaning">${item.meaning}</div>
            <div class="basics-radical-example">Ví dụ: <strong>${item.example}</strong></div>
          </div>
        `
        )
        .join("")}
      </div>
    `;
  }

  return html;
}

// Render full basics section (called once on tab open)
function renderBasicsSection() {
  const container = document.getElementById("learnBasicsContainer");
  if (!container || typeof ZH_BASICS_DATA === "undefined") return;

  const subTabs = [
    { key: "initials", label: "23 Thanh Mẫu (Phụ âm)", icon: "🗣️" },
    { key: "finals", label: "36 Vận Mẫu (Nguyên âm)", icon: "🎵" },
    { key: "tones", label: "4 Thanh Điệu & Biến Điệu", icon: "📈" },
    { key: "strokes", label: "8 Nét & Bút Thuận", icon: "✍️" },
    { key: "radicals", label: "20+ Bộ Thủ Thường Gặp", icon: "🧱" },
  ];

  container.innerHTML = `
    <div class="basics-header-card">
      <div class="basics-header-title">🇨🇳 Nền Tảng Tiếng Trung Dành Cho Người Mới</div>
      <div class="basics-header-desc">Học chắc Bảng chữ cái Pinyin, 4 Thanh điệu và Các bộ thủ cốt lõi để phát âm chuẩn và nhớ chữ Hán siêu tốc.</div>
    </div>
    <div class="basics-subtab-bar">
      ${subTabs
      .map(
        (st) => `
        <button class="basics-subtab-btn ${currentBasicsSubTab === st.key ? "active" : ""}" data-sub-tab="${st.key}" onclick="switchBasicsSubTab('${st.key}')">
          <span>${st.icon}</span> ${st.label}
        </button>
      `
      )
      .join("")}
    </div>
    <div class="basics-content-panel">${renderBasicsContentHTML()}</div>
  `;
}

// Vocabulary Category Selection
function selectVocabCategory(category) {
  currentVocabCategory = category;
  currentVocabIndex = 0;

  document
    .querySelectorAll("#vocabCategorySelector .learn-category-btn")
    .forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.cat === category);
    });

  const data = getActiveVocabularyData();
  if (category === "all") {
    currentVocabList = getAllVocabulary();
  } else {
    currentVocabList = data[category] || [];
  }

  renderVocabCard();
}

// Grammar Category Selection
function selectGrammarCategory(category) {
  currentGrammarCategory = category;
  currentGrammarIndex = 0;

  document
    .querySelectorAll("#grammarCategorySelector .learn-category-btn")
    .forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.cat === category);
    });

  const data = getActiveGrammarData();
  if (category === "all") {
    currentGrammarList = getAllGrammar();
  } else {
    currentGrammarList = data[category] || [];
  }

  renderGrammarCard();
}

// Phrase Category Selection
function selectPhraseCategory(category) {
  currentPhraseCategory = category;
  currentPhraseIndex = 0;

  document
    .querySelectorAll("#phraseCategorySelector .learn-category-btn")
    .forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.cat === category);
    });

  const data = getActivePhrasesData();
  if (category === "all") {
    currentPhraseList = getAllPhrases();
  } else {
    currentPhraseList = data[category] || [];
  }

  renderPhraseCard();
}

// Render Vocabulary Card
function renderVocabCard() {
  const container = document.getElementById("vocabCardContainer");
  const counter = document.getElementById("vocabCardCounter");

  if (!currentVocabList.length) {
    container.innerHTML =
      '<div class="learn-card"><p style="text-align: center; color: var(--muted);">Không có từ vựng nào trong danh mục này.</p></div>';
    counter.textContent = "0 / 0";
    return;
  }

  const item = currentVocabList[currentVocabIndex];
  counter.textContent = `${currentVocabIndex + 1} / ${currentVocabList.length}`;

  const isZh = currentLearnLanguage === "zh";

  container.innerHTML = `
    <div class="learn-card ${isZh ? "learn-card-zh" : ""}">
      <div class="learn-card-top-row">
        <div class="learn-card-category">${getCategoryName(currentVocabCategory)}</div>
        <button class="learn-card-speak-btn" onclick="${isZh ? `speakChinese('${escapeHtml(item.word)}')` : `speakEnglish('${escapeHtml(item.word)}')`}" title="Nghe phát âm">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
          </svg>
          Phát âm
        </button>
      </div>

      <div class="learn-card-word ${isZh ? "learn-card-word-zh" : ""}">${item.word}</div>
      
      ${item.phonetic ? `
        <div class="learn-card-phonetic-badge">
          <span class="learn-card-phonetic">${item.phonetic}</span>
          ${item.hanviet ? `<span class="learn-card-hanviet">[Hán-Việt: ${item.hanviet}]</span>` : ""}
        </div>
      ` : ""}

      <div class="learn-card-meaning">${item.meaning}</div>

      ${item.example
      ? `
      <div class="learn-card-example">
        <div class="learn-card-example-header">
          <div class="learn-card-example-label">Ví dụ minh họa</div>
          <button class="learn-card-example-speak-btn" onclick="${isZh ? `speakChinese('${escapeHtml(item.example)}')` : `speakEnglish('${escapeHtml(item.example)}')`}" title="Nghe ví dụ">🔊</button>
        </div>
        <div class="learn-card-example-en ${isZh ? "learn-card-example-zh" : ""}">${item.example}</div>
        ${item.examplePinyin ? `<div class="learn-card-example-pinyin">${item.examplePinyin}</div>` : ""}
        <div class="learn-card-example-vi">${item.exampleVi || ""}</div>
      </div>
      `
      : ""
    }
    </div>
  `;
}

// Render Grammar Card
function renderGrammarCard() {
  const container = document.getElementById("grammarCardContainer");
  const counter = document.getElementById("grammarCardCounter");

  if (!currentGrammarList.length) {
    container.innerHTML =
      '<div class="learn-card"><p style="text-align: center; color: var(--muted);">Không có ngữ pháp nào trong danh mục này.</p></div>';
    counter.textContent = "0 / 0";
    return;
  }

  const item = currentGrammarList[currentGrammarIndex];
  counter.textContent = `${currentGrammarIndex + 1} / ${currentGrammarList.length}`;
  const isZh = currentLearnLanguage === "zh";

  container.innerHTML = `
    <div class="learn-card ${isZh ? "learn-card-zh" : ""}">
      <div class="learn-card-top-row">
        <div class="learn-card-category">${getGrammarCategoryName(currentGrammarCategory)}</div>
      </div>
      <div class="learn-card-word">${item.title}</div>
      <div class="learn-card-formula">${item.formula}</div>
      <div class="learn-card-usage">${item.usage}</div>
      <div class="learn-card-example">
        <div class="learn-card-example-header">
          <div class="learn-card-example-label">Ví dụ áp dụng</div>
          <button class="learn-card-example-speak-btn" onclick="${isZh ? `speakChinese('${escapeHtml(item.example)}')` : `speakEnglish('${escapeHtml(item.example)}')`}" title="Nghe ví dụ">🔊</button>
        </div>
        <div class="learn-card-example-en ${isZh ? "learn-card-example-zh" : ""}">${item.example}</div>
        ${item.examplePinyin ? `<div class="learn-card-example-pinyin">${item.examplePinyin}</div>` : ""}
        <div class="learn-card-example-vi">${item.exampleVi || ""}</div>
      </div>
      ${item.note ? `<div class="learn-card-note">📌 <strong>Lưu ý:</strong> ${item.note}</div>` : ""}
    </div>
  `;
}

// Render Phrase Card
function renderPhraseCard() {
  const container = document.getElementById("phraseCardContainer");
  const counter = document.getElementById("phraseCardCounter");

  if (!currentPhraseList.length) {
    container.innerHTML =
      '<div class="learn-card"><p style="text-align: center; color: var(--muted);">Không có câu giao tiếp nào trong danh mục này.</p></div>';
    counter.textContent = "0 / 0";
    return;
  }

  const item = currentPhraseList[currentPhraseIndex];
  counter.textContent = `${currentPhraseIndex + 1} / ${currentPhraseList.length}`;
  const isZh = currentLearnLanguage === "zh";

  container.innerHTML = `
    <div class="learn-card ${isZh ? "learn-card-zh" : ""}">
      <div class="learn-card-top-row">
        <div class="learn-card-situation">${item.situation || getPhraseCategoryName(currentPhraseCategory)}</div>
        <button class="learn-card-speak-btn" onclick="${isZh ? `speakChinese('${escapeHtml(item.phrase)}')` : `speakEnglish('${escapeHtml(item.phrase)}')`}" title="Nghe đọc mẫu câu">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
          </svg>
          Phát âm
        </button>
      </div>
      <div class="learn-card-phrase ${isZh ? "learn-card-phrase-zh" : ""}">${item.phrase}</div>
      ${item.phonetic ? `<div class="learn-card-example-pinyin" style="margin-bottom: 8px;">${item.phonetic}</div>` : ""}
      <div class="learn-card-meaning">${item.meaning}</div>
    </div>
  `;
}

// Navigation functions
function prevVocabCard() {
  if (currentVocabIndex > 0) {
    currentVocabIndex--;
    renderVocabCard();
  }
}

function nextVocabCard() {
  if (currentVocabIndex < currentVocabList.length - 1) {
    currentVocabIndex++;
    renderVocabCard();
  }
}

function prevGrammarCard() {
  if (currentGrammarIndex > 0) {
    currentGrammarIndex--;
    renderGrammarCard();
  }
}

function nextGrammarCard() {
  if (currentGrammarIndex < currentGrammarList.length - 1) {
    currentGrammarIndex++;
    renderGrammarCard();
  }
}

function prevPhraseCard() {
  if (currentPhraseIndex > 0) {
    currentPhraseIndex--;
    renderPhraseCard();
  }
}

function nextPhraseCard() {
  if (currentPhraseIndex < currentPhraseList.length - 1) {
    currentPhraseIndex++;
    renderPhraseCard();
  }
}

// Helper functions for category names
function getCategoryName(cat) {
  const dict =
    currentLearnLanguage === "zh" ? ZH_VOCAB_CATEGORIES : EN_VOCAB_CATEGORIES;
  return dict[cat] || cat;
}

function getGrammarCategoryName(cat) {
  const dict =
    currentLearnLanguage === "zh"
      ? ZH_GRAMMAR_CATEGORIES
      : EN_GRAMMAR_CATEGORIES;
  return dict[cat] || cat;
}

function getPhraseCategoryName(cat) {
  const dict =
    currentLearnLanguage === "zh"
      ? ZH_PHRASE_CATEGORIES
      : EN_PHRASE_CATEGORIES;
  return dict[cat] || cat;
}

// Quiz Functions
function startVocabQuiz() {
  currentQuizType = "vocabulary";
  const allVocab = getAllVocabulary();
  currentQuizQuestions = shuffleArray([...allVocab]).slice(
    0,
    Math.min(10, allVocab.length),
  );
  currentQuizIndex = 0;
  currentQuizScore = 0;
  document.getElementById("quizTitle").textContent =
    currentLearnLanguage === "zh"
      ? "Kiểm Tra Từ Vựng Tiếng Trung"
      : "Kiểm Tra Từ Vựng Tiếng Anh";
  openQuizModal();
}

function startGrammarQuiz() {
  currentQuizType = "grammar";
  const allGrammar = getAllGrammar();
  currentQuizQuestions = shuffleArray([...allGrammar]).slice(
    0,
    Math.min(8, allGrammar.length),
  );
  currentQuizIndex = 0;
  currentQuizScore = 0;
  document.getElementById("quizTitle").textContent =
    currentLearnLanguage === "zh"
      ? "Kiểm Tra Ngữ Pháp Tiếng Trung"
      : "Kiểm Tra Ngữ Pháp Tiếng Anh";
  openQuizModal();
}

function startPhraseQuiz() {
  currentQuizType = "phrases";
  const allPhrases = getAllPhrases();
  currentQuizQuestions = shuffleArray([...allPhrases]).slice(
    0,
    Math.min(10, allPhrases.length),
  );
  currentQuizIndex = 0;
  currentQuizScore = 0;
  document.getElementById("quizTitle").textContent =
    currentLearnLanguage === "zh"
      ? "Kiểm Tra Mẫu Câu Tiếng Trung"
      : "Kiểm Tra Câu Giao Tiếp Tiếng Anh";
  openQuizModal();
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function openQuizModal() {
  document.getElementById("quizModal").style.display = "flex";
  document.body.style.overflow = "hidden";
  renderQuizQuestion();
}

function closeQuizModal() {
  document.getElementById("quizModal").style.display = "none";
  document.body.style.overflow = "";
}

function renderQuizQuestion() {
  const questionArea = document.getElementById("quizQuestionArea");
  const resultArea = document.getElementById("quizResultArea");
  const question = document.getElementById("quizQuestion");
  const options = document.getElementById("quizOptions");
  const progress = document.getElementById("quizProgress");
  const progressFill = document.getElementById("quizProgressFill");

  if (currentQuizIndex >= currentQuizQuestions.length) {
    questionArea.style.display = "none";
    resultArea.style.display = "flex";
    document.getElementById("quizScoreNum").textContent = currentQuizScore;
    document.getElementById("quizScoreTotal").textContent =
      currentQuizQuestions.length;

    const percentage = (currentQuizScore / currentQuizQuestions.length) * 100;
    let feedback = "";
    if (percentage >= 90) feedback = "Xuất sắc! Bạn nắm vững kiến thức rồi! 🎉";
    else if (percentage >= 70) feedback = "Tốt lắm! Cần ôn tập thêm một chút.";
    else if (percentage >= 50) feedback = "Khá ổn! Hãy tiếp tục luyện tập nhé.";
    else feedback = "Cần cố gắng hơn. Hãy học lại và thử lại nhé! 💪";
    document.getElementById("quizFeedback").textContent = feedback;
    return;
  }

  questionArea.style.display = "block";
  resultArea.style.display = "none";

  const item = currentQuizQuestions[currentQuizIndex];
  progress.textContent = `Câu ${currentQuizIndex + 1}/${currentQuizQuestions.length}`;
  progressFill.style.width = `${((currentQuizIndex + 1) / currentQuizQuestions.length) * 100}%`;

  currentQuizAnswered = false;

  if (currentQuizType === "vocabulary") {
    question.textContent = `"${item.word}" ${item.phonetic ? "(" + item.phonetic + ") " : ""}có nghĩa là gì?`;
    const wrongAnswers = getAllVocabulary()
      .filter((v) => v.word !== item.word)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map((v) => v.meaning);

    const allOptions = shuffleArray([item.meaning, ...wrongAnswers]);
    options.innerHTML = allOptions
      .map(
        (opt) => `
      <button class="quiz-option" onclick="selectQuizAnswer(this, '${escapeHtml(item.meaning)}')">${opt}</button>
    `,
      )
      .join("");
  } else if (currentQuizType === "grammar") {
    question.textContent = `${item.title}: ${item.example}`;
    const wrongAnswers = getAllGrammar()
      .filter((g) => g.title !== item.title)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map((g) => g.formula);

    const allOptions = shuffleArray([item.formula, ...wrongAnswers]);
    options.innerHTML = allOptions
      .map(
        (opt) => `
      <button class="quiz-option" onclick="selectQuizAnswer(this, '${escapeHtml(item.formula)}')">${opt}</button>
    `,
      )
      .join("");
  } else if (currentQuizType === "phrases") {
    question.textContent = `"${item.phrase}" có nghĩa là gì?`;
    const wrongAnswers = getAllPhrases()
      .filter((p) => p.phrase !== item.phrase)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map((p) => p.meaning);

    const allOptions = shuffleArray([item.meaning, ...wrongAnswers]);
    options.innerHTML = allOptions
      .map(
        (opt) => `
      <button class="quiz-option" onclick="selectQuizAnswer(this, '${escapeHtml(item.meaning)}')">${opt}</button>
    `,
      )
      .join("");
  }
}

function selectQuizAnswer(button, correctAnswer) {
  if (currentQuizAnswered) return;
  currentQuizAnswered = true;

  const allOptions = document.querySelectorAll(".quiz-option");
  const userAnswer = button.textContent;
  const isCorrect = userAnswer === correctAnswer;

  allOptions.forEach((opt) => {
    opt.disabled = true;
    if (opt.textContent === correctAnswer) {
      opt.classList.add("correct");
    } else if (opt === button && !isCorrect) {
      opt.classList.add("incorrect");
    }
  });

  if (isCorrect) currentQuizScore++;

  setTimeout(() => {
    currentQuizIndex++;
    renderQuizQuestion();
  }, 1200);
}

function retryQuiz() {
  if (currentQuizType === "vocabulary") startVocabQuiz();
  else if (currentQuizType === "grammar") startGrammarQuiz();
  else if (currentQuizType === "phrases") startPhraseQuiz();
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/* ==================== COUNTDOWN ==================== */
let countdownData = null;
let countdownTimer = null;
let firebaseCountdownRef = null;
let pendingCountdownData = null; // Lưu data chờ sync lên Firebase

const COUNTDOWN_PATH_PREFIX = "countdown";

async function initCountdown() {
  // Wait for userProfileKey to be ready
  if (!userProfileKey) {
    console.log("[Countdown] Chưa có userProfileKey, thử lại sau...");
    setTimeout(() => initCountdown(), 500);
    return;
  }

  if (!firebaseDb) {
    console.log("[Countdown] Chưa có firebaseDb, thử lại sau...");
    setTimeout(() => initCountdown(), 500);
    return;
  }

  firebaseCountdownRef = firebaseDb.ref(
    `${COUNTDOWN_PATH_PREFIX}/${userProfileKey}`,
  );

  console.log(
    "[Countdown] Đã khởi tạo Firebase ref:",
    `countdown/${userProfileKey}`,
  );

  firebaseCountdownRef.on("value", (snapshot) => {
    countdownData = snapshot.val() || null;
    console.log("[Countdown] Firebase data changed:", countdownData);
    renderCountdown();
    startCountdownTimer();
  });

  // Render immediately in case no data yet
  renderCountdown();

  // Nếu có pending data, sync ngay
  if (pendingCountdownData) {
    console.log(
      "[Countdown] Sync pending data lên Firebase:",
      pendingCountdownData,
    );
    firebaseCountdownRef.set(pendingCountdownData).catch(console.error);
    pendingCountdownData = null;
  }
}

function toggleCountdownSection() {
  const section = document.getElementById("countdownSection");
  if (!section) return;

  section.classList.toggle("collapsed");
}

function toggleCashflowCollapsibleSection(contentId) {
  const content = document.getElementById(contentId);
  if (!content) return;

  const section = content.closest(".cashflow-collapsible-section");
  if (!section) return;

  const shouldCollapse = !section.classList.contains("collapsed");
  content.classList.toggle("collapsed", shouldCollapse);
  section.classList.toggle("collapsed", shouldCollapse);

  if (shouldCollapse) {
    content.style.maxHeight = content.scrollHeight + "px";
    requestAnimationFrame(() => {
      content.style.maxHeight = "0";
    });
  } else {
    content.style.maxHeight = "0";
    requestAnimationFrame(() => {
      content.style.maxHeight = content.scrollHeight + "px";
    });
    content.addEventListener("transitionend", function handler() {
      content.style.maxHeight = "none";
      content.removeEventListener("transitionend", handler);
    });
  }

  if (!shouldCollapse && contentId === "cashflowChartContent") {
    requestAnimationFrame(() => renderCashflowChart());
  }
}

function renderCountdown() {
  const section = document.getElementById("countdownSection");
  const display = document.getElementById("countdownDisplay");
  const title = document.getElementById("countdownTitle");
  const clearBtn = document.getElementById("countdownClearBtn");

  // Ẩn skeleton và countdown display nếu chưa setup countdown
  if (!countdownData || !countdownData.targetDate) {
    section.style.display = "none";
    return;
  }

  // Hiện section khi có data (content visibility do CSS .collapsed handle)
  section.style.display = "block";

  const target = new Date(countdownData.targetDate + "T00:00:00");
  const now = new Date();
  const diff = target - now;

  const totalDays = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (countdownData.label) {
    title.textContent = countdownData.label;
  } else {
    title.textContent = "Đếm ngược";
  }

  // Helper: check if a date is a holiday (solar, lunar, or custom)
  function isDateHoliday(date) {
    const d = date.getDate();
    const m = date.getMonth() + 1;
    const y = date.getFullYear();
    const key = `${y}-${m}-${d}`;

    // Check solar holidays
    if (SOLAR_HOLIDAYS[`${d}-${m}`]) return true;

    // Check lunar holidays
    const lunar = convertSolarToLunar(d, m, y);
    if (LUNAR_HOLIDAYS[`${lunar.lunarDay}-${lunar.lunarMonth}`]) return true;

    // Check custom holidays (user-marked)
    const dateData = getDateData(key);
    if (dateData && dateData.isHoliday) return true;

    return false;
  }

  // Calculate work days (exclude weekends & holidays)
  const workDaysDisplay = document.getElementById("workDaysDisplay");
  if (diff > 0) {
    let workDays = 0;
    const tempDate = new Date(now);
    tempDate.setHours(0, 0, 0, 0);
    const endDate = new Date(target);
    endDate.setHours(0, 0, 0, 0);

    while (tempDate < endDate) {
      const dayOfWeek = tempDate.getDay();
      // Only count if not weekend AND not a holiday
      if (dayOfWeek !== 0 && dayOfWeek !== 6 && !isDateHoliday(tempDate)) {
        workDays++;
      }
      tempDate.setDate(tempDate.getDate() + 1);
    }

    workDaysDisplay.innerHTML = `
      <span class="work-days-label">Số ngày làm việc:</span>
      <span class="work-days-number">${workDays}</span>
      <span class="work-days-unit">ngày</span>
    `;
  } else {
    workDaysDisplay.innerHTML = "";
  }

  // Progress Bar - chỉ hiện khi có startDate
  const progressSection = document.getElementById("countdownProgress");
  const progressBar = document.getElementById("progressBar");
  const progressMarker = document.getElementById("progressMarker");
  const progressPercent = document.getElementById("progressPercent");
  const progressStartLabel = document.getElementById("progressStartLabel");
  const progressEndLabel = document.getElementById("progressEndLabel");
  const progressStartDate = document.getElementById("progressStartDate");
  const progressEndDate = document.getElementById("progressEndDate");

  const startDate = countdownData.startDate
    ? new Date(countdownData.startDate + "T00:00:00")
    : null;

  if (startDate && diff > 0) {
    // Show progress bar
    progressSection.style.display = "block";

    const totalDuration = target - startDate;
    const elapsed = now - startDate;
    const progress = Math.max(
      0,
      Math.min(100, (elapsed / totalDuration) * 100),
    );

    progressBar.style.width = `${progress}%`;
    progressMarker.style.left = `${progress}%`;
    progressPercent.textContent = `${progress.toFixed(5)}%`;

    // Format dates
    const formatDate = (d) => {
      const day = d.getDate().toString().padStart(2, "0");
      const month = (d.getMonth() + 1).toString().padStart(2, "0");
      return `${day}/${month}`;
    };

    progressStartLabel.textContent = "Bắt đầu";
    progressEndLabel.textContent = "Kết thúc";
    progressStartDate.textContent = formatDate(startDate);
    progressEndDate.textContent = formatDate(target);

    // Thay đổi màu progress khi gần hoàn thành
    if (progress >= 90) {
      progressBar.style.background = "#90CAF9";
      progressBar.style.boxShadow =
        "0 0 12px rgba(100, 181, 246, 0.6), 0 0 24px rgba(144, 202, 249, 0.3)";
    } else if (progress >= 70) {
      progressBar.style.background = "#64B5F6";
      progressBar.style.boxShadow =
        "0 0 12px rgba(66, 165, 245, 0.6), 0 0 24px rgba(100, 181, 246, 0.3)";
    } else {
      progressBar.style.background = "#42A5F5";
      progressBar.style.boxShadow =
        "0 0 12px rgba(100, 181, 246, 0.6), 0 0 24px rgba(66, 165, 245, 0.3)";
    }
  } else {
    progressSection.style.display = "none";
  }

  if (diff <= 0) {
    const expiredDays = Math.abs(totalDays);
    let expiredMsg = "Đã đến ngày!";
    if (expiredDays > 0) expiredMsg = `Đã qua ${expiredDays} ngày`;
    display.innerHTML = `<span class="countdown-msg expired">${escapeHtml(expiredMsg)}</span>`;
  } else {
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);

    const html = [];
    html.push(
      `<div class="countdown-unit"><span class="countdown-number">${totalDays}</span><span class="countdown-unit-label">Ngày</span></div>`,
    );
    html.push(`<span class="countdown-sep">:</span>`);
    html.push(
      `<div class="countdown-unit"><span class="countdown-number">${String(hours).padStart(2, "0")}</span><span class="countdown-unit-label">Giờ</span></div>`,
    );
    html.push(`<span class="countdown-sep">:</span>`);
    html.push(
      `<div class="countdown-unit"><span class="countdown-number">${String(mins).padStart(2, "0")}</span><span class="countdown-unit-label">Phút</span></div>`,
    );
    html.push(`<span class="countdown-sep">:</span>`);
    html.push(
      `<div class="countdown-unit"><span class="countdown-number">${String(secs).padStart(2, "0")}</span><span class="countdown-unit-label">Giây</span></div>`,
    );

    display.innerHTML = html.join("");
  }

  if (clearBtn) {
    clearBtn.style.display = countdownData?.targetDate ? "flex" : "none";
  }
}

function startCountdownTimer() {
  stopCountdownTimer();
  countdownTimer = setInterval(renderCountdown, 100);
}

function stopCountdownTimer() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
}

function openCountdownModal() {
  loadCountdownOnDemand();

  const modal = document.getElementById("countdownModal");
  const labelInput = document.getElementById("countdownLabelInput");
  const dateInput = document.getElementById("countdownDateInput");
  const startDateInput = document.getElementById("countdownStartDateInput");
  const clearBtn = document.getElementById("countdownClearBtn");

  if (countdownData) {
    labelInput.value = countdownData.label || "";
    dateInput.value = countdownData.targetDate || "";
    startDateInput.value = countdownData.startDate || "";
    if (clearBtn) clearBtn.style.display = "flex";
  } else {
    labelInput.value = "";
    dateInput.value = "";
    startDateInput.value = "";
    if (clearBtn) clearBtn.style.display = "none";
  }

  modal.style.display = "flex";
  labelInput.focus();
}

function closeCountdownModal() {
  document.getElementById("countdownModal").style.display = "none";
}

async function saveCountdown() {
  const label = document.getElementById("countdownLabelInput").value.trim();
  const targetDate = document.getElementById("countdownDateInput").value;
  const startDate = document.getElementById("countdownStartDateInput").value;

  if (!targetDate) {
    alert("Vui lòng chọn ngày đích.");
    return;
  }

  const data = { label, targetDate, startDate };
  console.log("[Countdown] Đang lưu:", data);

  // Always save to localStorage first
  countdownData = data;
  localStorage.setItem("countdown", JSON.stringify(data));
  renderCountdown();
  startCountdownTimer();

  // Then try to save to Firebase if available
  if (firebaseCountdownRef) {
    try {
      await firebaseCountdownRef.set(data);
      console.log("[Countdown] Đã lưu lên Firebase thành công");
      pendingCountdownData = null;
    } catch (err) {
      console.error("[Countdown] Lỗi lưu Firebase:", err);
      pendingCountdownData = data;
      alert(
        "Lỗi khi lưu lên Firebase: " +
        err.message +
        "\nĐã lưu local. Sẽ thử lại sau.",
      );
    }
  } else {
    console.warn("[Countdown] firebaseCountdownRef = null, lưu pending:", data);
    pendingCountdownData = data;
  }

  closeCountdownModal();
}

async function clearCountdown() {
  showConfirmPopup(
    "Xóa đếm ngược",
    "Bạn có chắc muốn xóa đếm ngược hiện tại không?",
    "Xóa",
    async () => {
      countdownData = null;
      localStorage.removeItem("countdown");
      renderCountdown();
      stopCountdownTimer();

      if (firebaseCountdownRef) {
        try {
          await firebaseCountdownRef.remove();
        } catch (err) {
          console.error("[Countdown] Lỗi xóa Firebase:", err);
        }
      }

      closeCountdownModal();
    }
  );
}

function loadCountdownFromLocal() {
  try {
    const stored = localStorage.getItem("countdown");
    if (stored) {
      countdownData = JSON.parse(stored);
      renderCountdown();
      startCountdownTimer();
    }
  } catch (e) { }
}

// Xử lý điều hướng đến ngày khi mở link từ Push Notification (?date=YYYY-M-D)
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", checkUrlParamsForDateNavigation);
} else {
  checkUrlParamsForDateNavigation();
}

/**
 * Xóa sạch toàn bộ CacheStorage, hủy Service Workers và buộc tải lại bản mới nhất từ Vercel
 */
async function clearCacheAndReloadApp() {
  try {
    // 1. Hủy đăng ký tất cả Service Workers
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        console.log("[CacheClear] Unregistering SW:", reg.active?.scriptURL);
        await reg.unregister();
      }
    }

    // 2. Xóa sạch tất cả các kho CacheStorage
    if ("caches" in window) {
      const keys = await caches.keys();
      for (const key of keys) {
        console.log("[CacheClear] Deleting CacheStorage:", key);
        await caches.delete(key);
      }
    }

    // 3. Clear session storage
    sessionStorage.clear();
  } catch (err) {
    console.warn("[CacheClear] Lỗi trong quá trình dọn dẹp cache:", err);
  } finally {
    // 4. Force reload trang kèm theo timestamp chống HTTP browser cache
    const url = new URL(window.location.href);
    url.searchParams.set("_reload", Date.now().toString());
    window.location.href = url.toString();
  }
}
window.clearCacheAndReloadApp = clearCacheAndReloadApp;

/* Floating Today Extra (Weather & Quote) Modal & Draggable Edge Snapping */
function openTodayExtraModal() {
  const modal = document.getElementById("todayExtraModal");
  if (modal) modal.style.display = "flex";
}

function closeTodayExtraModal() {
  const modal = document.getElementById("todayExtraModal");
  if (modal) modal.style.display = "none";
}

window.openTodayExtraModal = openTodayExtraModal;
window.closeTodayExtraModal = closeTodayExtraModal;

function initFloatingTodayExtraBtn() {
  const btn = document.getElementById("floatingTodayExtraBtn");
  if (!btn) return;

  const STORAGE_KEY = "todayExtraBtnPos_v1";
  const margin = 8;

  let isDragging = false;
  let startX = 0, startY = 0;
  let initialLeft = 0, initialTop = 0;
  let dragMoved = false;

  // Khôi phục vị trí và icon thời tiết đã lưu
  const savedIcon = localStorage.getItem("lastWeatherIcon");
  const savedText = localStorage.getItem("lastWeatherText");
  const floatingIconEl = btn.querySelector(".floating-btn-icon");
  if (savedIcon && floatingIconEl) {
    floatingIconEl.textContent = savedIcon;
  }
  if (savedText) {
    btn.title = savedText;
  }

  const savedPos = localStorage.getItem(STORAGE_KEY);
  if (savedPos) {
    try {
      const pos = JSON.parse(savedPos);
      const btnWidth = btn.offsetWidth || 44;
      const btnHeight = btn.offsetHeight || 44;
      const maxTop = window.innerHeight - btnHeight - margin;
      const top = Math.min(Math.max(margin, pos.top), maxTop);

      btn.style.top = top + "px";
      btn.style.bottom = "auto";

      if (pos.side === "left") {
        btn.style.left = margin + "px";
        btn.style.right = "auto";
        btn.classList.add("snapped-left");
        btn.classList.remove("snapped-right");
      } else {
        btn.style.left = (window.innerWidth - btnWidth - margin) + "px";
        btn.style.right = "auto";
        btn.classList.add("snapped-right");
        btn.classList.remove("snapped-left");
      }
    } catch (e) {
      console.warn("[FloatingBtn] Lỗi khôi phục vị trí nút:", e);
    }
  }

  function onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;

    isDragging = true;
    dragMoved = false;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    startX = clientX;
    startY = clientY;

    const rect = btn.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;

    btn.style.transition = "none";
  }

  function onPointerMove(e) {
    if (!isDragging) return;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const dx = clientX - startX;
    const dy = clientY - startY;

    if (Math.hypot(dx, dy) > 5) {
      dragMoved = true;
      btn.classList.add("dragging");
    }

    if (dragMoved) {
      if (e.cancelable) e.preventDefault();

      const btnWidth = btn.offsetWidth || 44;
      const btnHeight = btn.offsetHeight || 44;

      let newLeft = initialLeft + dx;
      let newTop = initialTop + dy;

      newLeft = Math.min(Math.max(0, newLeft), window.innerWidth - btnWidth);
      newTop = Math.min(Math.max(margin, newTop), window.innerHeight - btnHeight - margin);

      btn.style.left = newLeft + "px";
      btn.style.top = newTop + "px";
      btn.style.right = "auto";
    }
  }

  function onPointerUp() {
    if (!isDragging) return;
    isDragging = false;
    btn.classList.remove("dragging");

    if (!dragMoved) {
      openTodayExtraModal();
      return;
    }

    const rect = btn.getBoundingClientRect();
    const btnWidth = rect.width || 44;
    const btnHeight = rect.height || 44;
    const centerX = rect.left + btnWidth / 2;

    btn.style.transition = "left 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), top 0.15s ease";

    let targetSide = "right";
    let targetLeft = window.innerWidth - btnWidth - margin;

    if (centerX < window.innerWidth / 2) {
      targetSide = "left";
      targetLeft = margin;
      btn.classList.add("snapped-left");
      btn.classList.remove("snapped-right");
    } else {
      btn.classList.add("snapped-right");
      btn.classList.remove("snapped-left");
    }

    btn.style.left = targetLeft + "px";
    btn.style.right = "auto";

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        side: targetSide,
        top: rect.top
      })
    );
  }

  btn.addEventListener("mousedown", onPointerDown);
  window.addEventListener("mousemove", onPointerMove);
  window.addEventListener("mouseup", onPointerUp);

  btn.addEventListener("touchstart", onPointerDown, { passive: false });
  window.addEventListener("touchmove", onPointerMove, { passive: false });
  window.addEventListener("touchend", onPointerUp);

  window.addEventListener("resize", () => {
    const rect = btn.getBoundingClientRect();
    const btnWidth = rect.width || 44;
    const btnHeight = rect.height || 44;

    let isLeft = rect.left < window.innerWidth / 2;
    let targetLeft = isLeft ? margin : window.innerWidth - btnWidth - margin;
    let targetTop = Math.min(Math.max(margin, rect.top), window.innerHeight - btnHeight - margin);

    btn.style.transition = "none";
    btn.style.left = targetLeft + "px";
    btn.style.top = targetTop + "px";
  });
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeTodayExtraModal();
  }
});

document.addEventListener("click", (e) => {
  const modal = document.getElementById("todayExtraModal");
  if (modal && modal.style.display === "flex" && e.target === modal) {
    closeTodayExtraModal();
  }
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initFloatingTodayExtraBtn);
} else {
  initFloatingTodayExtraBtn();
}