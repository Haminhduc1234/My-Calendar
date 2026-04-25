/* ========================== CẤU HÌNH ========================== */
let currentDate = new Date();
let selectedKey = "";
let selectedEventIndex = -1;
let geoPromptRequestedThisLoad = false;
const TOOLBOX_STATE_KEY = "quickToolboxState";
const GEO_PROMPT_ASKED_KEY = "geoPromptAsked";
const QUICK_NOTE_STORAGE_KEY_PREFIX = "quickNotesV1";
const MY_MUSIC_PREFS_KEY_PREFIX = "myMusicPrefsV1";
const FIREBASE_EVENTS_PATH = self.FIREBASE_EVENTS_PATH || "calendarEvents";
const FIREBASE_CLIENT_ID_KEY = "firebaseClientId";
const FIREBASE_PROFILE_KEY_STORAGE = "calendarProfileKey";
const LEGACY_MIGRATION_FLAG_PREFIX = "calendarLegacyMigrated:";
const LEGACY_CASHFLOW_MIGRATION_FLAG_PREFIX = "calendarLegacyCashflowMigrated:";
const LEGACY_CASHFLOW_STORAGE_KEY = "cashflowEntriesV1";
const FIREBASE_CONFIG = self.FIREBASE_WEB_CONFIG || {};
const FIREBASE_TRANSLATE_HISTORY_PATH = self.FIREBASE_TRANSLATE_HISTORY_PATH || "translateHistory";

let firebaseDb = null;
let firebaseDatesRef = null;
let firebaseQuickNotesRef = null;
let firebaseTranslateHistoryRef = null;
let firebaseReady = false;
let firebaseAuth = null;
let firebaseProjectsRef = null;
let userProfileKey = "";
let dateDataCache = {};
let quickNotesCache = [];
let translateHistoryCache = [];
let syncWriteErrorShown = false;

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
  panel.innerHTML = `
    <div class="today-events-list">${events
      .map((ev) => {
        const timeStr = ev.eventDateTime
          ? new Date(ev.eventDateTime).toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
          })
          : "";
        return `<div class="today-event-item">
        ${timeStr ? `<span class="today-event-time">${timeStr}</span>` : ""}
        <span class="today-event-title">${ev.title || "(Không có tiêu đề)"}</span>
        ${ev.text ? `<span class="today-event-text">${ev.text}</span>` : ""}
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

    if (cellDate.getTime() === today.getTime()) div.classList.add("today");
    if (getEventsForDate(key).length > 0) div.classList.add("has-event");
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
      return {
        id: String(entry?.id || "").trim(),
        date: normalizedDate,
        type,
        amount,
        note: String(entry?.note || "").trim(),
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
  return Object.keys(dateDataCache).filter(isDateKey);
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

function ensureProfileKey() {
  return new Promise((resolve) => {
    const storedProfileKey = localStorage.getItem(FIREBASE_PROFILE_KEY_STORAGE);
    if (storedProfileKey && /^u_[0-9a-f]{8}$/.test(storedProfileKey)) {
      userProfileKey = storedProfileKey;
      const modal = document.getElementById("passwordModal");
      if (modal) modal.style.display = "none";
      resolve(true);
      return;
    }

    const modal = document.getElementById("passwordModal");
    const otpGroup = document.getElementById("otpGroup");
    const masterInput = document.getElementById("otpMasterInput");
    const slots = Array.from(document.querySelectorAll(".otp-slot"));
    const errorEl = document.getElementById("passwordError");

    modal.style.display = "flex";
    masterInput.value = "";
    errorEl.style.display = "none";
    renderOtpSlots();

    // Focus immediately on the input field
    masterInput.focus({ preventScroll: true });

    // Ensure focus is properly set even if first attempt doesn't work
    requestAnimationFrame(() => {
      masterInput.focus({ preventScroll: true });
    });

    function getOtpValue() {
      return masterInput.value.replace(/\D/g, "").slice(0, 6);
    }

    function cleanup() {
      masterInput.removeEventListener("keydown", onKeydown);
      masterInput.removeEventListener("input", onInput);
      masterInput.removeEventListener("paste", onPaste);
      otpGroup.removeEventListener("click", onGroupActivate);
      otpGroup.removeEventListener("keydown", onGroupKeydown);
    }

    function renderOtpSlots() {
      const value = getOtpValue();
      if (masterInput.value !== value) {
        masterInput.value = value;
      }

      slots.forEach((slot, index) => {
        const filled = index < value.length;
        slot.classList.toggle("is-filled", filled);
        slot.classList.toggle("is-active", index === Math.min(value.length, 5));
      });

      return value;
    }

    function doSubmit() {
      const value = renderOtpSlots();
      if (value.length < 6) {
        errorEl.style.display = "block";
        masterInput.focus({ preventScroll: true });
        return;
      }
      errorEl.style.display = "none";
      userProfileKey = hashProfilePassword(value);
      localStorage.setItem(FIREBASE_PROFILE_KEY_STORAGE, userProfileKey);
      modal.style.display = "none";
      cleanup();
      resolve(true);
    }

    function onInput() {
      const value = renderOtpSlots();
      if (value.length === 6) {
        requestAnimationFrame(doSubmit);
      }
    }

    function onKeydown(e) {
      if (e.key === "Enter") {
        doSubmit();
      }
    }

    function onPaste(e) {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData)
        .getData("text")
        .replace(/\D/g, "")
        .slice(0, 6);
      masterInput.value = text;
      renderOtpSlots();
      if (text.length === 6) doSubmit();
    }

    function onGroupActivate() {
      masterInput.focus({ preventScroll: true });
    }

    function onGroupKeydown(e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        masterInput.focus({ preventScroll: true });
      }
    }

    masterInput.addEventListener("input", onInput);
    masterInput.addEventListener("keydown", onKeydown);
    masterInput.addEventListener("paste", onPaste);
    otpGroup.addEventListener("click", onGroupActivate);
    otpGroup.addEventListener("keydown", onGroupKeydown);
  });
}

function logoutProfileSession() {
  const confirmed = window.confirm(
    "Đăng xuất phiên PIN hiện tại để nhập PIN khác?",
  );
  if (!confirmed) return;

  localStorage.removeItem(FIREBASE_PROFILE_KEY_STORAGE);
  userProfileKey = "";
  dateDataCache = {};

  if (firebaseDatesRef) {
    firebaseDatesRef.off();
  }

  window.location.reload();
}

window.logoutProfileSession = logoutProfileSession;

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

// Chỉ tin bản ghi Firebase nếu pKey khớp với profile hiện tại,
// hoặc không có pKey nhưng đây là profile gốc ban đầu (backward compat)
function isDateRecordTrusted(raw) {
  if (!raw) return false;
  const originalKey = localStorage.getItem(FIREBASE_PROFILE_KEY_STORAGE);
  if (raw.pKey !== undefined) return raw.pKey === userProfileKey;
  return userProfileKey === originalKey;
}

function getDateData(dateKey) {
  if (dateDataCache[dateKey]) return normalizeDateData(dateDataCache[dateKey]);
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

function exportCashflowCsv() {
  reloadCashflowEntriesFromCache();

  if (cashflowEntries.length === 0) {
    alert("Chưa có dữ liệu thu chi để xuất CSV.");
    return;
  }

  const rows = cashflowEntries.map((entry) => [
    entry.id,
    normalizeIsoDateString(entry.date),
    entry.type === "income" ? "Thu" : "Chi",
    entry.amount,
    entry.note || "",
    formatTimestampForCsv(entry.createdAt),
    formatTimestampForCsv(entry.updatedAt),
  ]);

  const csv = toCsvContent(
    ["ID", "Ngày", "Loại", "Số tiền", "Ghi chú", "Tạo lúc", "Cập nhật lúc"],
    rows,
  );
  triggerCsvDownload(`thu_chi_${getCsvDateSuffix()}.csv`, csv);
}

function addEventToDate(dateKey, eventData) {
  const data = getDateData(dateKey);
  data.events.push({
    title: String(eventData.title || "").trim(),
    text: String(eventData.text || "").trim(),
    eventDateTime: String(eventData.eventDateTime || ""),
    createdAt: Date.now(),
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
    createdAt: previous.createdAt || Date.now(),
    updatedAt: Date.now(),
  };

  saveDateData(dateKey, data);
}

function deleteEventFromDate(dateKey, eventIndex) {
  const data = getDateData(dateKey);
  if (eventIndex >= 0 && eventIndex < data.events.length) {
    data.events.splice(eventIndex, 1);
    saveDateData(dateKey, data);
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
  // Hiển thị PIN ngay để người dùng nhập mà không phải chờ auth Firebase.
  if (!(await ensureProfileKey())) {
    alert("Bạn cần nhập mật khẩu đồng bộ để sử dụng dữ liệu đa thiết bị.");
    return;
  }

  if (!window.firebase || !window.firebase.apps) return;
  if (!isFirebaseConfigReady()) return;

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
  firebaseDatesRef = firebaseDb.ref(
    `${FIREBASE_EVENTS_PATH}/${userProfileKey}/dates`,
  );
  firebaseQuickNotesRef = firebaseDb.ref(
    `quickNotes/${userProfileKey}`,
  );
  firebaseProjectsRef = firebaseDb.ref(
    `projects/${userProfileKey}`,
  );
  firebaseTranslateHistoryRef = firebaseDb.ref(
    `${FIREBASE_TRANSLATE_HISTORY_PATH}/${userProfileKey}`,
  );

  // Lắng nghe sự thay đổi của Translate History
  firebaseTranslateHistoryRef.on("value", (snapshot) => {
    const remoteData = snapshot.val() || {};
    translateHistoryCache = Object.keys(remoteData).map(key => ({
      id: key,
      ...remoteData[key]
    })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    console.log("Translate history: Loaded", translateHistoryCache.length, "items from Firebase");
    renderTranslateHistory();
  });

  // Lắng nghe sự thay đổi của Projects
  firebaseProjectsRef.on("value", (snapshot) => {
    const remoteData = snapshot.val() || {};

    // Separate projects and tasks
    projectsDataCache = {};
    const newTasksCache = {};

    Object.keys(remoteData).forEach(key => {
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

  if (Array.isArray(remoteNotes)) {
    quickNotesCache = remoteNotes;
    // Update local storage as backup
    localStorage.setItem(getQuickNoteStorageKey(), JSON.stringify(remoteNotes));
    renderQuickNotes();
  } else {
    // Migration: if empty on Firebase, try local storage
    const localNotes = loadQuickNotes();
    if (localNotes.length > 0) {
      quickNotesCache = localNotes;
      await firebaseQuickNotesRef.set(localNotes);
      renderQuickNotes();
    }
  }

  // Initial Projects Sync
  const projSnapshot = await firebaseProjectsRef.once("value");
  const remoteProjects = projSnapshot.val();

  if (remoteProjects && typeof remoteProjects === "object") {
    projectsDataCache = {};
    Object.keys(remoteProjects).forEach(key => {
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
    localStorage.setItem(`projects:${userProfileKey}`, JSON.stringify(projectsDataCache));
  } else {
    const localProjects = loadProjectsFromLocalStorage();
    if (localProjects) {
      projectsDataCache = localProjects;
      await firebaseProjectsRef.set(localProjects);
    }
  }

  // Load tasks for each project from local storage if not loaded from Firebase
  Object.keys(projectsDataCache).forEach(projectId => {
    if (!projectTasksCache[projectId]) {
      const localTasks = loadProjectTasksFromLocalStorage(projectId);
      if (localTasks) {
        projectTasksCache[projectId] = localTasks;
      }
    }
  });

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

    dateDataCache = nextCache;
    renderCalendar();
    renderOvertime();
    renderOvertimeSalary();
    renderCashflowDashboard();
  });

  firebaseQuickNotesRef.on("value", (snapshot) => {
    const incoming = snapshot.val();
    if (Array.isArray(incoming)) {
      quickNotesCache = incoming;
      localStorage.setItem(
        getQuickNoteStorageKey(),
        JSON.stringify(incoming),
      );
      renderQuickNotes();
    }
  });

  firebaseReady = true;

  // Realtime database initialized
  console.log("Firebase Realtime Database connected");
}

function closeAllModals() {
  const modals = [
    "addEventModal",
    "dayDetailsModal",
    "overtimeModal",
    "goldModal",
    "quickNoteModal",
    "myMusicModal",
    "cashflowModal",
    "cashflowDeleteConfirmModal",
    "currencyModal"
  ];
  modals.forEach(id => {
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

/* ========================== MO-ĐAL ========================== */

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
  renderCalendar();
}

// Day Details Modal - shows events list and overtime editor
function openDayDetailsModal(dateKey, d, m, y) {
  closeAllModals();
  selectedKey = dateKey;
  const data = getDateData(dateKey);

  document.getElementById("dayDetailsDate").innerText = `${d}/${m}/${y}`;
  document.getElementById("dayOvertimeHours").value = data.overtimeHours || 0;

  const holidayCheckbox = document.getElementById("dayIsHoliday");
  if (holidayCheckbox) {
    holidayCheckbox.checked = !!data.isHoliday;
  }

  // Render events list
  const eventsList = document.getElementById("dayEventsList");
  eventsList.innerHTML = "";

  if (data.events.length === 0) {
    eventsList.innerHTML = '<div class="no-events">Chưa có sự kiện</div>';
  } else {
    data.events.forEach((event, idx) => {
      const eventDiv = document.createElement("div");
      eventDiv.className = "event-item";
      const timeStr = event.eventDateTime
        ? new Date(event.eventDateTime).toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        })
        : "--:--";
      eventDiv.innerHTML = `
        <div class="event-time">${timeStr}</div>
        <div class="event-content">
          <div class="event-title">${event.title || "(Không có tiêu đề)"}</div>
          <div class="event-text">${event.text}</div>
        </div>
        <div class="event-actions">
          <button class="event-edit" onclick="openEditEventModal(${idx})" title="Sửa" aria-label="Sửa sự kiện">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Zm17.71-10.04a1.003 1.003 0 0 0 0-1.42l-2.5-2.5a1.003 1.003 0 0 0-1.42 0l-1.96 1.96 3.75 3.75 2.13-2.09Z" />
            </svg>
          </button>
          <button class="event-delete" onclick="deleteEventFromDateUI(${idx})" title="Xóa">×</button>
        </div>
      `;
      eventsList.appendChild(eventDiv);
    });
  }

  document.getElementById("dayDetailsModal").style.display = "flex";
}

function closeDayDetailsModal() {
  document.getElementById("dayDetailsModal").style.display = "none";
}

function saveDayOvertime() {
  const hours =
    parseInt(document.getElementById("dayOvertimeHours").value, 10) || 0;
  updateOvertimeForDate(selectedKey, Math.max(0, hours));
  renderOvertime();
  renderOvertimeSalary();
}

function deleteEventFromDateUI(eventIndex) {
  deleteEventFromDate(selectedKey, eventIndex);
  renderCalendar();
  const [y, m, d] = selectedKey.split("-").map(Number);
  openDayDetailsModal(selectedKey, d, m, y);
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

  if (!title && !text) {
    alert("Vui lòng nhập tiêu đề hoặc nội dung sự kiện");
    return;
  }

  const eventPayload = {
    title,
    text,
    eventDateTime,
  };

  if (selectedEventIndex >= 0) {
    updateEventInDate(selectedKey, selectedEventIndex, eventPayload);
  } else {
    addEventToDate(selectedKey, eventPayload);
  }

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
  renderProjectsList();
}

function closeProjectsModal() {
  document.getElementById("projectsModal").style.display = "none";
  _editingProjectId = null;
}

function openProjectTasksModal(projectId, projectTitle) {
  currentOpenedProjectId = projectId;
  document.getElementById("currentProjectTitle").textContent = projectTitle || "Dự án";
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
      <div style="text-align: center; padding: 40px 20px; color: var(--muted);">
        <p>Chưa có dự án nào.</p>
        <p>Nhấn "+ Thêm dự án mới" để bắt đầu.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = projects.map(project => `
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
  `).join("");
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
        updatedAt: Date.now()
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
        updatedAt: Date.now()
      }
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
    projectId
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
  localStorage.setItem(`projects:${userProfileKey}`, JSON.stringify(projectsDataCache));
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
      <div style="text-align: center; padding: 40px 20px; color: var(--muted);">
        <p>Chưa có công việc nào.</p>
        <p>Nhấn "+ Thêm công việc" để bắt đầu.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = tasks.map((task, idx) => `
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
  `).join("");

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

// Custom Confirm Popup
let _confirmPopupCallback = null;
let _confirmPopupArgs = null;

function showConfirmPopup(title, message, confirmText, callback, args) {
  const popup = document.getElementById("confirmPopup");
  const titleEl = document.getElementById("confirmPopupTitle");
  const messageEl = document.getElementById("confirmPopupMessage");
  const confirmBtn = document.getElementById("confirmPopupConfirmBtn");

  titleEl.textContent = title;
  messageEl.textContent = message;
  confirmBtn.textContent = confirmText || "Xóa";

  _confirmPopupCallback = callback;
  _confirmPopupArgs = args;

  popup.classList.add("show");
}

function closeConfirmPopup() {
  const popup = document.getElementById("confirmPopup");
  popup.classList.remove("show");
  _confirmPopupCallback = null;
  _confirmPopupArgs = null;
}

function confirmPopupAction() {
  if (_confirmPopupCallback) {
    if (_confirmPopupArgs) {
      if (Array.isArray(_confirmPopupArgs)) {
        _confirmPopupCallback(..._confirmPopupArgs);
      } else {
        _confirmPopupCallback(_confirmPopupArgs);
      }
    } else {
      _confirmPopupCallback();
    }
  }
  closeConfirmPopup();
}

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
        updatedAt: Date.now()
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
      updatedAt: Date.now()
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
    { projectId, taskId }
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
    updatedAt: Date.now()
  };

  saveProjectTasksToFirebase(projectId);
  renderProjectTasksList(projectId);
}

function moveTaskUp(projectId, taskId) {
  const tasks = Object.entries(projectTasksCache[projectId] || {})
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const idx = tasks.findIndex(t => t.id === taskId);
  if (idx <= 0) return;

  // Swap orders
  const tempOrder = tasks[idx].order;
  tasks[idx].order = tasks[idx - 1].order;
  tasks[idx - 1].order = tempOrder;

  // Rebuild cache
  const newCache = {};
  tasks.forEach(t => {
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

  const idx = tasks.findIndex(t => t.id === taskId);
  if (idx < 0 || idx >= tasks.length - 1) return;

  // Swap orders
  const tempOrder = tasks[idx].order;
  tasks[idx].order = tasks[idx + 1].order;
  tasks[idx + 1].order = tempOrder;

  // Rebuild cache
  const newCache = {};
  tasks.forEach(t => {
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

  firebaseProjectsRef.child(projectId).child("tasks").set(projectTasksCache[projectId] || {}).catch(() => {
    saveProjectTasksToLocalStorage(projectId);
  });
}

function saveProjectTasksToLocalStorage(projectId) {
  if (!userProfileKey) return;
  localStorage.setItem(`projectTasks:${userProfileKey}:${projectId}`, JSON.stringify(projectTasksCache[projectId] || {}));
}

function loadProjectTasksFromLocalStorage(projectId) {
  if (!userProfileKey) return null;
  const data = localStorage.getItem(`projectTasks:${userProfileKey}:${projectId}`);
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
  items.forEach(item => {
    // Desktop drag events
    item.addEventListener("dragstart", handleTaskDragStart);
    item.addEventListener("dragover", handleTaskDragOver);
    item.addEventListener("dragenter", handleTaskDragEnter);
    item.addEventListener("dragleave", handleTaskDragLeave);
    item.addEventListener("drop", (e) => handleTaskDrop(e, projectId));
    item.addEventListener("dragend", handleTaskDragEnd);

    // Mobile touch events
    item.addEventListener("touchstart", handleTaskTouchStart, { passive: false });
    item.addEventListener("touchmove", handleTaskTouchMove, { passive: false });
    item.addEventListener("touchend", (e) => handleTaskTouchEnd(e, projectId));
  });
}

function handleTaskTouchStart(e) {
  if (e.target.closest(".item-actions") || e.target.closest(".task-drag-handle")) {
    return;
  }
  e.preventDefault();
  _touchStartY = e.touches[0].clientY;
  _touchCurrentY = _touchStartY;
  _touchDragSrcEl = e.currentTarget;
  _taskDragSrcId = e.currentTarget.dataset.taskId;
  _touchDragging = false;

  _touchDragSrcEl.classList.add("dragging");
  _touchDragSrcEl.style.opacity = "0.4";

  document.querySelectorAll(".task-item.draggable").forEach(item => {
    if (item.dataset.taskId !== _taskDragSrcId) {
      item.classList.add("drop-target");
    }
  });
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
    items.forEach(item => {
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

  document.querySelectorAll(".drop-target, .drag-over").forEach(el => {
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
    const targetItem = targetEl ? targetEl.closest(".task-item.draggable") : null;

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

  const srcIdx = tasks.findIndex(t => t.id === srcId);
  const targetIdx = tasks.findIndex(t => t.id === targetId);

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
  document.querySelectorAll(".task-item.draggable").forEach(item => {
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
  document.querySelectorAll(".drop-indicator").forEach(el => el.remove());

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
  document.querySelectorAll(".drop-target, .drag-over").forEach(el => {
    el.classList.remove("drop-target", "drag-over");
    el.style.transform = "";
    el.style.boxShadow = "";
    el.style.zIndex = "";
    el.style.borderTop = "";
    el.style.borderBottom = "";
  });
  document.querySelectorAll(".drop-indicator").forEach(el => el.remove());

  const targetId = e.currentTarget.dataset.taskId;
  if (!_taskDragSrcId || _taskDragSrcId === targetId) return;

  const tasks = Object.entries(projectTasksCache[projectId] || {})
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const srcIdx = tasks.findIndex(t => t.id === _taskDragSrcId);
  const targetIdx = tasks.findIndex(t => t.id === targetId);

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
  document.querySelectorAll(".task-item").forEach(item => {
    item.classList.remove("dragging", "drag-over", "drop-target");
    item.style.opacity = "";
    item.style.transform = "";
    item.style.boxShadow = "";
    item.style.zIndex = "";
    item.style.borderTop = "";
    item.style.borderBottom = "";
  });
  document.querySelectorAll(".drop-indicator").forEach(el => el.remove());
}

function openGoldModal() {
  closeAllModals();
  document.getElementById("goldModal").style.display = "flex";
  loadGoldMarketData();
}

function closeGoldModal() {
  document.getElementById("goldModal").style.display = "none";
}

function getQuickNoteStorageKey() {
  return userProfileKey
    ? `${QUICK_NOTE_STORAGE_KEY_PREFIX}:${userProfileKey}`
    : QUICK_NOTE_STORAGE_KEY_PREFIX;
}

function loadQuickNotes() {
  if (Array.isArray(quickNotesCache) && quickNotesCache.length > 0) {
    return quickNotesCache;
  }

  const key = getQuickNoteStorageKey();
  const raw = localStorage.getItem(key);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((note) => ({
        id: String(note?.id || "").trim(),
        text: String(note?.text || "").trim(),
        done: Boolean(note?.done),
        createdAt: Number(note?.createdAt || Date.now()),
      }))
      .filter((note) => note.id && note.text);
  } catch {
    return [];
  }
}

function saveQuickNotes(notes) {
  const normalized = Array.isArray(notes)
    ? notes
      .map((note) => ({
        id: String(note?.id || "").trim(),
        text: String(note?.text || "").trim(),
        done: Boolean(note?.done),
        createdAt: Number(note?.createdAt || Date.now()),
      }))
      .filter((note) => note.id && note.text)
    : [];

  quickNotesCache = normalized;
  localStorage.setItem(getQuickNoteStorageKey(), JSON.stringify(normalized));

  if (firebaseQuickNotesRef) {
    firebaseQuickNotesRef.set(normalized).catch((err) => {
      console.error("Firebase Quick Notes save error:", err);
    });
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
    listEl.innerHTML =
      '<div class="quick-note-empty">Chưa có ghi chú nào. Hãy thêm việc cần làm.</div>';
    return;
  }

  listEl.innerHTML = notes
    .map((note) => {
      return `
      <div class="quick-note-item ${note.done ? "is-done" : ""}" draggable="true" data-note-id="${note.id}">
        <span class="note-drag-handle" aria-hidden="true">☰</span>
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
  items.forEach(item => {
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
  const srcIdx = notes.findIndex(n => n.id === _noteDragSrcId);
  const targetIdx = notes.findIndex(n => n.id === targetId);

  if (srcIdx < 0 || targetIdx < 0) return;

  const [movedNote] = notes.splice(srcIdx, 1);
  notes.splice(targetIdx, 0, movedNote);

  saveQuickNotes(notes);
  renderQuickNotes();
}

function handleNoteDragEnd(e) {
  _noteDragSrcId = null;
  document.querySelectorAll("#quickNoteList .quick-note-item").forEach(item => {
    item.classList.remove("is-dragging", "drag-over");
  });
}

let _editingQuickNoteId = null;

function editQuickNote(noteId) {
  const notes = loadQuickNotes();
  const note = notes.find(n => n.id === noteId);
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
  if (cancelBtn) cancelBtn.style.display = "block";
}

function cancelEditQuickNote() {
  _editingQuickNoteId = null;
  const input = document.getElementById("quickNoteInput");
  const submitBtn = document.getElementById("quickNoteSubmitBtn");
  const cancelBtn = document.getElementById("quickNoteCancelBtn");

  if (input) input.value = "";
  if (submitBtn) submitBtn.innerText = "+ Thêm";
  if (cancelBtn) cancelBtn.style.display = "none";
}

function openQuickNoteModal() {
  closeAllModals();
  renderQuickNotes();
  document.getElementById("quickNoteModal").style.display = "flex";

  const input = document.getElementById("quickNoteInput");
  if (input) {
    input.focus({ preventScroll: true });
    // Remove old listener if exists
    input.removeEventListener("keydown", handleQuickNoteKeydown);
    // Add Enter key listener (Shift+Enter for new line, Enter to submit)
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
  document.getElementById("quickNoteModal").style.display = "none";
  cancelEditQuickNote();
}

function submitQuickNote() {
  const input = document.getElementById("quickNoteInput");
  if (!input) return;

  const text = input.value.trim();
  if (!text) return;

  const notes = loadQuickNotes();

  if (_editingQuickNoteId) {
    const idx = notes.findIndex(n => n.id === _editingQuickNoteId);
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
  cancelEditQuickNote();
  renderQuickNotes();
  input.focus({ preventScroll: true });
}

function toggleQuickNoteDone(noteId) {
  const notes = loadQuickNotes();
  const idx = notes.findIndex((note) => note.id === noteId);
  if (idx < 0) return;

  notes[idx].done = !notes[idx].done;
  saveQuickNotes(notes);
  renderQuickNotes();
}

function deleteQuickNote(noteId) {
  const notes = loadQuickNotes().filter((note) => note.id !== noteId);
  saveQuickNotes(notes);
  renderQuickNotes();
}

function initQuickNoteModal() {
  const modal = document.getElementById("quickNoteModal");
  const input = document.getElementById("quickNoteInput");

  if (modal) {
    modal.addEventListener("click", function (e) {
      if (e.target === this) closeQuickNoteModal();
    });
  }

  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submitQuickNote();
      }
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
  items.forEach(item => {
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
    } else if (myMusicState.index < _dragSrcIndex && myMusicState.index >= minIdx) {
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
  document.querySelectorAll(".my-music-track-item").forEach(item => {
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
  if (playIcon) playIcon.src = isPlaying ? "public/pause.png" : "public/app.png";
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

  if (!myMusicState.initialized) {
    initMyMusicPlayer();
  }

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

  const isCollapsed = toolbox.classList.toggle("is-collapsed");
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
  const isCollapsed = savedState === "collapsed";

  toolbox.classList.toggle("is-collapsed", isCollapsed);
  toggleBtn.setAttribute("aria-expanded", String(!isCollapsed));
  toggleBtn.setAttribute(
    "aria-label",
    isCollapsed ? "Mở thanh công cụ" : "Thu gọn thanh công cụ",
  );
}

function collapseQuickToolbox() {
  const toolbox = document.getElementById("quickToolbox");
  const toggleBtn = document.getElementById("toolboxToggle");
  if (!toolbox || !toggleBtn) return;
  if (toolbox.classList.contains("is-collapsed")) return;

  toolbox.classList.add("is-collapsed");
  localStorage.setItem(TOOLBOX_STATE_KEY, "collapsed");
  toggleBtn.setAttribute("aria-expanded", "false");
  toggleBtn.setAttribute("aria-label", "Mở thanh công cụ");
}

function initToolboxAutoCollapse() {
  const toolbox = document.getElementById("quickToolbox");
  if (!toolbox) return;

  toolbox.querySelectorAll(".tool-btn").forEach((btn) => {
    btn.addEventListener("click", collapseQuickToolbox);
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

  if (!title && !text) {
    alert("Vui lòng nhập tiêu đề hoặc nội dung sự kiện");
    return;
  }

  addEventToDate(selectedKey, {
    title,
    text,
    eventDateTime,
  });

  renderOvertime();
  renderOvertimeSalary();
  closeAddEventModal();
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
      handleWeather(position.coords.latitude, position.coords.longitude);
    },
    handleLocationError,
    getGeolocationOptions(),
  );
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
&timezone=auto`,
    ).then((res) => res.json()),
    getAddressFromCoords(lat, lon),
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

function renderForecast(daily, hourly) {
  const forecastEl = document.getElementById("weatherForecast");
  forecastEl.innerHTML = "";

  for (let i = 1; i < daily.time.length; i++) {
    const date = new Date(daily.time[i]);
    const day = date.toLocaleDateString("vi-VN", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
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

  const cachedPermission = localStorage.getItem("geoPermission");

  // Đã từng được cấp quyền → thử lấy vị trí trực tiếp, không hỏi lại.
  // handleLocationError sẽ cập nhật cache nếu user thu hồi quyền sau này.
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
    99: "Dông mạnh",
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
  const matches = content.match(/\d{4}-\d{2}-\d{2}\.html/g) || [];
  const uniqueDates = [...new Set(matches.map((x) => x.replace(".html", "")))];
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

async function fetchTextWithCorsFallback(url) {
  // Add timestamp to bypass caching
  const timestamp = Date.now();
  const separator = url.includes("?") ? "&" : "?";
  const finalUrl = `${url}${separator}t=${timestamp}`;

  const proxyUrl = `https://r.jina.ai/http://${finalUrl.replace(/^https?:\/\//, "")}`;

  const res = await fetch(proxyUrl, {
    cache: "no-cache",
    headers: {
      "Cache-Control": "no-cache"
    }
  });
  if (!res.ok) throw new Error("Không thể tải dữ liệu do CORS");

  const raw = await res.text();
  const marker = "Markdown Content:";
  const markerIndex = raw.indexOf(marker);

  if (markerIndex === -1) return raw.trim();
  return raw.slice(markerIndex + marker.length).trim();
}

async function getRecentVietnamGoldHistory(limit = 7) {
  const indexContent = await fetchTextWithCorsFallback(
    "https://giavang.org/trong-nuoc/sjc/lich-su",
  );
  const candidateDates = parseVietnamHistoryDates(indexContent).slice(0, 10);
  const points = [];

  for (const date of candidateDates) {
    if (points.length >= limit) break;

    try {
      const dayContent = await fetchTextWithCorsFallback(
        `https://giavang.org/trong-nuoc/sjc/lich-su/${date}.html`,
      );
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

  if (buyEl && sellEl) {
    buyEl.classList.add("is-loading");
    sellEl.classList.add("is-loading");
  }

  updatedEl.innerText = "Đang tải dữ liệu giá vàng Việt Nam...";
  buyEl.innerText = "--";
  sellEl.innerText = "--";

  try {
    const currentContent = await fetchTextWithCorsFallback(
      "https://giavang.org/trong-nuoc/sjc",
    );
    const current = parseCurrentVietnamGold(currentContent);
    if (!current) {
      throw new Error("Thiếu dữ liệu giá vàng Việt Nam hiện tại");
    }

    const buyVnd = current.buyThousand * 1000;
    const sellVnd = current.sellThousand * 1000;

    buyEl.innerText = formatVnd(buyVnd);
    sellEl.innerText = formatVnd(sellVnd);
    updatedEl.innerText = `Giá vàng SJC hôm nay Cập nhật lúc ${current.updatedAt}`;

    if (noteEl) {
      noteEl.innerText =
        "Nguồn: giavang.org (giá vàng trong nước SJC toàn quốc hiện tại) qua proxy r.jina.ai.";
    }
  } catch {
    if (noteEl) {
      noteEl.innerText =
        "Nguồn nội địa đang lỗi mạng hoặc bị chặn. Vui lòng thử lại sau.";
    }
  } finally {
    if (buyEl && sellEl) {
      buyEl.classList.remove("is-loading");
      sellEl.classList.remove("is-loading");
    }
  }
}

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

function openCashflowModal() {
  closeAllModals();
  const modal = document.getElementById("cashflowModal");
  const dateInput = document.getElementById("cashflowDate");
  if (!dateInput.value) {
    dateInput.value = getTodayIsoDate();
  }

  modal.style.display = "flex";
  syncCashflowFormMode();
  renderCashflowDashboard();
}

function closeCashflowModal() {
  resetCashflowForm();
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
  const amountInput = document.getElementById("cashflowAmount");
  const noteInput = document.getElementById("cashflowNote");

  const date = normalizeIsoDateString(dateInput.value);
  const type = typeInput.value === "expense" ? "expense" : "income";
  const amount = parseInt(amountInput.value.replace(/\D/g, ""), 10) || 0;
  const note = noteInput.value.trim();
  const targetDateKey = isoDateToDateKey(date);

  if (!date || !targetDateKey) {
    alert("Vui lòng chọn ngày giao dịch");
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
    const previousData = getDateData(previousDateKey);
    previousData.cashflowEntries.splice(located.index, 1);
    saveDateData(previousDateKey, previousData);

    const targetData = getDateData(targetDateKey);
    targetData.cashflowEntries.push({
      id: located.entry.id,
      date,
      type,
      amount,
      note,
      createdAt: located.entry.createdAt || Date.now(),
      updatedAt: Date.now(),
    });
    saveDateData(targetDateKey, targetData);
  } else {
    const entry = {
      id: `cf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date,
      type,
      amount,
      note,
      createdAt: Date.now(),
    };

    const data = getDateData(targetDateKey);
    data.cashflowEntries.push(entry);
    saveDateData(targetDateKey, data);
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
  document.getElementById("cashflowAmount").value =
    entry.amount.toLocaleString("vi-VN");
  document.getElementById("cashflowNote").value = entry.note || "";

  syncCashflowFormMode();
}

function cancelCashflowEdit() {
  resetCashflowForm();
}

function resetCashflowForm() {
  editingCashflowId = "";
  document.getElementById("cashflowDate").value = getTodayIsoDate();
  document.getElementById("cashflowType").value = "income";
  document.getElementById("cashflowAmount").value = "";
  document.getElementById("cashflowNote").value = "";
  syncCashflowFormMode();
}

function syncCashflowFormMode() {
  const submitBtn = document.getElementById("cashflowSubmitBtn");
  const cancelBtn = document.getElementById("cashflowCancelEditBtn");
  if (!submitBtn || !cancelBtn) return;

  if (editingCashflowId) {
    submitBtn.innerText = "Lưu chỉnh sửa";
    cancelBtn.style.display = "inline-flex";
  } else {
    submitBtn.innerText = "+ Thêm giao dịch";
    cancelBtn.style.display = "none";
  }
}

function removeCashflowEntry(id) {
  pendingDeleteCashflowId = id;
  openCashflowDeleteConfirmModal();
}

function openCashflowDeleteConfirmModal() {
  const modal = document.getElementById("cashflowDeleteConfirmModal");
  if (!modal) return;
  modal.style.display = "flex";
}

function closeCashflowDeleteConfirmModal() {
  const modal = document.getElementById("cashflowDeleteConfirmModal");
  if (!modal) return;
  modal.style.display = "none";
  pendingDeleteCashflowId = "";
}

function confirmRemoveCashflowEntry() {
  const id = pendingDeleteCashflowId;
  if (!id) {
    closeCashflowDeleteConfirmModal();
    return;
  }

  const located = findCashflowEntryLocation(id);
  if (!located) {
    closeCashflowDeleteConfirmModal();
    return;
  }

  const data = getDateData(located.dateKey);
  data.cashflowEntries.splice(located.index, 1);
  saveDateData(located.dateKey, data);

  reloadCashflowEntriesFromCache();

  if (editingCashflowId === id) {
    resetCashflowForm();
  }
  closeCashflowDeleteConfirmModal();
  renderCashflowDashboard();
}

function renderCashflowDashboard() {
  reloadCashflowEntriesFromCache();
  renderCashflowMonthSummary();
  renderCashflowRecentList();
  renderCashflowChart();
}

function renderCashflowMonthSummary() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  let income = 0;
  let expense = 0;

  for (const entry of cashflowEntries) {
    const [y, m] = entry.date.split("-").map(Number);
    if (y !== year || m !== month) continue;
    if (entry.type === "income") income += entry.amount;
    else expense += entry.amount;
  }

  const net = income - expense;
  document.getElementById("cashflowIncomeMonth").innerText =
    `${income.toLocaleString("vi-VN")} đ`;
  document.getElementById("cashflowExpenseMonth").innerText =
    `${expense.toLocaleString("vi-VN")} đ`;

  const netEl = document.getElementById("cashflowNetMonth");
  netEl.innerText = `${net.toLocaleString("vi-VN")} đ`;
  netEl.style.color = net >= 0 ? "#8fe5b7" : "#ffb3b3";
}

function renderCashflowRecentList() {
  const listEl = document.getElementById("cashflowRecentList");
  listEl.innerHTML = "";

  if (cashflowEntries.length === 0) {
    const empty = document.createElement("div");
    empty.className = "cashflow-recent-empty";
    empty.innerText = "Chưa có giao dịch nào. Hãy thêm khoản thu/chi đầu tiên.";
    listEl.appendChild(empty);
    return;
  }

  const recent = cashflowEntries.slice(0, 8);
  for (const entry of recent) {
    const row = document.createElement("div");
    row.className = "cashflow-row";

    const dateEl = document.createElement("div");
    dateEl.className = "cashflow-row-date";
    dateEl.innerText = formatCashflowDate(entry.date);

    const noteEl = document.createElement("div");
    noteEl.className = "cashflow-row-note";
    noteEl.innerText =
      entry.note || (entry.type === "income" ? "Khoản thu" : "Khoản chi");

    const amountEl = document.createElement("div");
    amountEl.className = `cashflow-row-amount ${entry.type === "income" ? "is-income" : "is-expense"}`;
    amountEl.innerText = `${entry.type === "income" ? "+" : "-"}${entry.amount.toLocaleString("vi-VN")} đ`;

    const editBtn = document.createElement("button");
    editBtn.className = "cashflow-row-edit";
    editBtn.type = "button";
    editBtn.title = "Sửa giao dịch";
    editBtn.setAttribute("aria-label", "Sửa giao dịch");
    editBtn.innerHTML = "&#9998;";
    editBtn.addEventListener("click", () => startCashflowEdit(entry.id));

    const delBtn = document.createElement("button");
    delBtn.className = "cashflow-row-delete";
    delBtn.type = "button";
    delBtn.title = "Xóa giao dịch";
    delBtn.innerText = "×";
    delBtn.addEventListener("click", () => removeCashflowEntry(entry.id));

    row.appendChild(dateEl);
    row.appendChild(noteEl);
    row.appendChild(amountEl);
    row.appendChild(editBtn);
    row.appendChild(delBtn);
    listEl.appendChild(row);
  }
}

function buildCashflowByMonth() {
  const now = new Date();
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: `T${d.getMonth() + 1}`,
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

function renderCashflowChart() {
  const canvas = document.getElementById("cashflowChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const rows = buildCashflowByMonth();
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

  rows.forEach((row, i) => {
    const gx = padL + i * (groupW + groupGap);
    const yBottom = padT + chartH;
    const incomeH = (row.income / maxVal) * chartH;
    const expenseH = (row.expense / maxVal) * chartH;
    const nowMonth =
      row.year === now.getFullYear() && row.month === now.getMonth() + 1;

    const incomeX = gx;
    const expenseX = gx + oneBarW + 2;

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
}

function formatCashflowDate(dateIso) {
  const [y, m, d] = dateIso.split("-");
  return `${d}/${m}/${y}`;
}

(function initCashflowModal() {
  reloadCashflowEntriesFromCache();

  const modal = document.getElementById("cashflowModal");
  modal.addEventListener("click", function (e) {
    if (e.target === this) closeCashflowModal();
  });

  const amountInput = document.getElementById("cashflowAmount");
  amountInput.addEventListener("input", () => {
    formatCurrencyInput(amountInput);
  });

  const dateInput = document.getElementById("cashflowDate");
  if (!dateInput.value) {
    dateInput.value = getTodayIsoDate();
  }

  syncCashflowFormMode();

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

// cập nhật mỗi giây
setInterval(updateClock, 1000);
updateClock();

function setAppInitLoading(visible) {
  const loading = document.getElementById("appInitLoading");
  if (!loading) return;
  loading.classList.toggle("is-visible", Boolean(visible));
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
  DKK: { name: "Krone Đan Mạch", flag: "https://flagcdn.com/w40/dk.png" }
};

function initCurrencySelects() {
  ["currencyFrom", "currencyTo"].forEach(id => {
    const select = document.getElementById(id);
    const dropdown = document.getElementById(id + "Dropdown");
    const selectBox = document.getElementById(id + "Select");
    const valueSpan = selectBox.querySelector(".currency-select-value");
    const arrowSpan = selectBox.querySelector(".currency-select-arrow");

    const options = Array.from(select.options);
    dropdown.innerHTML = options.map(opt => {
      const code = opt.value;
      const data = CURRENCY_DATA[code];
      if (!data) return "";
      return `<div class="currency-option" data-value="${code}">
        <img src="${data.flag}" alt="${data.name}" onerror="this.style.display='none'">
        <span>${code} - ${data.name}</span>
      </div>`;
    }).join("");

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
        dropdown.querySelectorAll(".currency-option").forEach(o => o.classList.remove("selected"));
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

  document.querySelectorAll(".currency-dropdown").forEach(d => {
    if (d !== dropdown) d.classList.remove("show");
  });
  document.querySelectorAll(".currency-select-arrow").forEach(a => {
    if (a !== arrowSpan) a.style.transform = "";
  });

  dropdown.classList.toggle("show");
  arrowSpan.style.transform = dropdown.classList.contains("show") ? "rotate(180deg)" : "";
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".currency-select-wrapper")) {
    document.querySelectorAll(".currency-dropdown").forEach(d => d.classList.remove("show"));
    document.querySelectorAll(".currency-select-arrow").forEach(a => a.style.transform = "");
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
      const lastUpdate = new Date(data.time_last_update_unix * 1000).toLocaleString("vi-VN");
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
  let amountStr = document.getElementById("currencyAmount").value.replace(/[^\d]/g, "");
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
      formattedResult = result.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
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

/* ========================== INIT ========================= */
// Show password modal IMMEDIATELY (before heavy rendering)
(async () => {
  setAppInitLoading(true);
  try {
    // Priority 1: Show password modal first (non-blocking)
    await initFirebaseServices();

    // Priority 2: Heavy rendering tasks (after modal is ready)
    applyStoredToolboxState();
    initToolboxAutoCollapse();
    initQuickNoteModal();
    initMyMusicPlayer();
    renderCalendar();
    renderToday();
    loadQuote();
    fetchWeatherByLocation();
    renderTodayLunar();
  } finally {
    setAppInitLoading(false);
  }
})();

/* ========================== TIN TỨC ========================== */
let currentNewsTab = "vn";
let newsCache = {
  vn: null, global: null, sports: null, business: null,
  tech: null, realestate: null, health: null,
  entertainment: null, cars: null, travel: null
};

function openNewsModal() {
  closeAllModals();
  document.getElementById("newsModal").style.display = "flex";

  // Load news if not cached or cache is old
  if (!newsCache[currentNewsTab]) {
    fetchNews(currentNewsTab);
  } else {
    renderNewsItems(newsCache[currentNewsTab]);
  }
}

async function refreshNews() {
  const btn = document.getElementById("newsRefreshBtn");
  if (btn) btn.classList.add("spinning");

  // Clear cache for current tab
  newsCache[currentNewsTab] = null;

  await fetchNews(currentNewsTab);

  if (btn) {
    setTimeout(() => {
      btn.classList.remove("spinning");
    }, 600); // Keep spinning for at least 600ms for visual feel
  }
}

function closeNewsModal() {
  document.getElementById("newsModal").style.display = "none";
}

function switchNewsTab(type) {
  if (currentNewsTab === type) return;

  currentNewsTab = type;
  const tabIds = {
    vn: "newsTabVN", global: "newsTabGlobal", sports: "newsTabSports",
    business: "newsTabBusiness", tech: "newsTabTech", realestate: "newsTabRealEstate",
    health: "newsTabHealth", entertainment: "newsTabEntertainment",
    cars: "newsTabCars", travel: "newsTabTravel"
  };

  Object.values(tabIds).forEach(id => {
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

  const sources = {
    vn: "vnexpress.net",
    global: "vnexpress.net/the-gioi",
    sports: "vnexpress.net/the-thao",
    business: "vnexpress.net/kinh-doanh",
    tech: "vnexpress.net/so-hoa",
    realestate: "vnexpress.net/bat-dong-san",
    health: "vnexpress.net/suc-khoe",
    entertainment: "vnexpress.net/giai-tri",
    cars: "vnexpress.net/oto-xe-may",
    travel: "vnexpress.net/du-lich"
  };

  const targetUrl = sources[type];

  try {
    const markdown = await fetchTextWithCorsFallback(targetUrl);
    const items = parseNewsMarkdown(markdown);

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

function parseNewsMarkdown(md) {
  const items = [];
  // Use ### instead of ## as Jina uses H3 for news items on VNExpress
  // Catch both the Title and the Link
  const pattern = /### \[([^\]]+)\]\((https?:\/\/vnexpress\.net\/[^\)\s]+)(?:\s+"[^"]*")?\)([\s\S]*?)(?=### \[|$)/g;

  let match;
  let count = 0;

  // To handle shifted thumbnails, we'll first find all image-link pairs in the document
  // Structure: [![Alt](ImgURL)](LinkURL)
  const imgLinkPattern = /\[!\[.*?\]\((https?:\/\/.*?)\)\]\((https?:\/\/vnexpress\.net\/[^\)\s]+)(?:\s+"[^"]*")?\)/g;
  const imgMap = {};
  let imgMatch;
  while ((imgMatch = imgLinkPattern.exec(md)) !== null) {
    const imgUrl = imgMatch[1];
    const linkUrl = imgMatch[2];
    imgMap[linkUrl] = imgUrl;
  }

  while ((match = pattern.exec(md)) !== null && count < 25) {
    const title = match[1].trim();
    const link = match[2];
    const contentChunk = match[3].trim();

    // 1. Try to find thumbnail by matching the article link (Best accuracy)
    let thumb = imgMap[link] || "";

    // 2. Fallback: Find first image in the local content chunk
    if (!thumb) {
      const localImgMatch = contentChunk.match(/!\[.*?\]\((https?:\/\/.*?)\)/);
      thumb = localImgMatch ? localImgMatch[1] : "";
    }

    // Get description (Joining multiple lines to ensure 3-line requirement is met)
    const filteredLines = contentChunk
      .replace(/\[!\[.*?\]\((.*?)\)\]\((.*?)\)/g, "") // Remove image-link markdown
      .replace(/!\[.*?\]\((.*?)\)/g, "") // Remove image markdown
      .replace(/\[\d+\]\(.*?#box_comment_vne\)/g, "") // Specifically remove comment counts
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, "$1") // Simplify links to just their text
      .trim()
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.length > 10 && !line.includes("box_comment_vne"));

    // Take a larger slice to fill the 3-line UI
    let description = filteredLines.slice(0, 4).join(" ") || "Bấm để xem chi tiết bài viết và các thông tin liên quan từ nguồn VNExpress...";
    if (description.length > 250) description = description.substring(0, 240).trim() + "...";

    if (title.length < 10 || title.includes("Loại bài") || title.includes("Xem thêm")) continue;

    items.push({
      title,
      link,
      thumb,
      description: description || "Bấm để xem chi tiết bài viết...",
      pubDate: new Date().toISOString()
    });
    count++;
  }
  return items;
}

function renderNewsItems(items) {
  const container = document.getElementById("newsContainer");
  if (!items || items.length === 0) {
    container.innerHTML = "<p style='text-align:center; padding: 20px; color: #a6bde2;'>Không có tin nào.</p>";
    return;
  }

  const html = items.map(item => {
    const dateStr = new Date(item.pubDate).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
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
  }).join("");

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
document.addEventListener("keydown", function(e) {
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
  localStorage.setItem(TRANSLATE_STORAGE_KEY, JSON.stringify({ fromLang, toLang }));
}

function loadSavedLanguages() {
  const { fromLang, toLang } = getSavedLanguages();
  document.getElementById("translateFromLang").value = fromLang;
  document.getElementById("translateToLang").value = toLang;
}

function saveApiSelection() {
  const selectedApi = document.querySelector('input[name="translateApi"]:checked');
  if (selectedApi) {
    localStorage.setItem(TRANSLATE_API_KEY, selectedApi.value);
  }
}

function loadApiSelection() {
  const saved = localStorage.getItem(TRANSLATE_API_KEY);
  if (saved) {
    const radio = document.querySelector(`input[name="translateApi"][value="${saved}"]`);
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

document.addEventListener("click", function(e) {
  const dropdown = document.getElementById("translateApiDropdown");
  const btn = document.querySelector(".translate-api-btn");
  if (!dropdown.contains(e.target) && !btn.contains(e.target)) {
    dropdown.classList.remove("show");
  }
});

function openTranslateModal() {
  const modal = document.getElementById("translateModal");
  modal.style.display = "flex";
  loadSavedLanguages();
  loadApiSelection();
  loadSavedPronunciation();
  document.getElementById("translateInput").focus();
}

function openTranslateHistoryModal() {
  const modal = document.getElementById("translateHistoryModal");
  modal.style.display = "flex";
  renderTranslateHistoryModal();
}

function closeTranslateHistoryModal() {
  document.getElementById("translateHistoryModal").style.display = "none";
}

function renderTranslateHistoryModal() {
  const container = document.getElementById("translateHistoryModalList");
  if (!container) return;

  if (translateHistoryCache.length === 0) {
    container.innerHTML = '<div class="translate-history-empty">Chưa có lịch sử dịch</div>';
    return;
  }

  const langNames = {
    "auto": "Tự động",
    "en": "Tiếng Anh",
    "ko": "Tiếng Hàn",
    "zh": "Tiếng Trung",
    "vi": "Tiếng Việt"
  };

  container.innerHTML = translateHistoryCache.map(item => {
    const date = new Date(item.timestamp);
    const timeStr = date.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
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
  }).join("");
}

function toggleTranslateHistory() {
  const listEl = document.getElementById("translateHistoryList");
  const arrowEl = document.getElementById("translateHistoryArrow");
  const isCollapsed = listEl.classList.toggle("collapsed");
  arrowEl.classList.toggle("collapsed", isCollapsed);
  localStorage.setItem(TRANSLATE_HISTORY_COLLAPSED_KEY, isCollapsed ? "true" : "false");
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
  }
}

function performTranslationFromButton() {
  const input = document.getElementById("translateInput");
  const text = input.value.trim();
  
  if (!text) {
    document.getElementById("translateError").innerText = "Vui lòng nhập văn bản cần dịch.";
    document.getElementById("translateError").style.display = "block";
    return;
  }
  
  performTranslation(text);
}

function togglePronunciation() {
  const showPronunciation = document.getElementById("showPronunciation").checked;
  const pronunciationEl = document.getElementById("translatePronunciation");
  
  localStorage.setItem(PRONUNCIATION_VISIBLE_KEY, showPronunciation ? "true" : "false");
  
  if (showPronunciation) {
    pronunciationEl.style.display = "block";
    const translatedText = document.getElementById("translateOutput").value;
    const toLang = document.getElementById("translateToLang").value;
    if (translatedText) {
      loadPronunciation(translatedText, toLang);
    }
  } else {
    pronunciationEl.style.display = "none";
  }
}

function loadSavedPronunciation() {
  const saved = localStorage.getItem(PRONUNCIATION_VISIBLE_KEY);
  if (saved === "true") {
    document.getElementById("showPronunciation").checked = true;
    document.getElementById("translatePronunciation").style.display = "block";
  }
}

async function loadPronunciation(text, lang) {
  const pronunciationEl = document.getElementById("translatePronunciation");
  pronunciationEl.innerHTML = '<div class="pronunciation-loading">Đang tải phiên âm...</div>';
  
  try {
    if (lang === "vi") {
      pronunciationEl.innerHTML = '<div class="pronunciation-note">Tiếng Việt sử dụng bảng chữ cái Latin, không cần phiên âm.</div>';
      return;
    }
    
    if (lang === "en") {
      await loadEnglishPhonetics(text, pronunciationEl);
    } else if (lang === "ko") {
      await loadKoreanRomanization(text, pronunciationEl);
    } else if (lang === "zh") {
      await loadChinesePinyin(text, pronunciationEl);
    } else {
      pronunciationEl.innerHTML = '<div class="pronunciation-note">Ngôn ngữ này chưa được hỗ trợ phiên âm.</div>';
    }
  } catch (error) {
    pronunciationEl.innerHTML = '<div class="pronunciation-error">Không thể tải phiên âm. Vui lòng thử lại.</div>';
  }
}

async function loadEnglishPhonetics(text, pronunciationEl) {
  const words = text.split(/\s+/).filter(w => w.length > 1).slice(0, 8);
  const phoneticResults = [];
  
  for (const word of words) {
    const cleanWord = word.replace(/[^\w\s]/g, '').toLowerCase();
    if (cleanWord.length > 1) {
      try {
        const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${cleanWord}`);
        if (response.ok) {
          const data = await response.json();
          if (data[0]?.phonetics) {
            const phonetic = data[0].phonetics.find(p => p.text && p.text.includes('/')) 
              || data[0].phonetics.find(p => p.text) 
              || data[0].phonetics[0];
            if (phonetic?.text) {
              phoneticResults.push({ word: cleanWord, phonetic: phonetic.text });
            }
          }
        }
      } catch (e) {}
    }
  }
  
  if (phoneticResults.length > 0) {
    pronunciationEl.innerHTML = `
      <div class="pronunciation-label">Phiên âm IPA / Pronunciation:</div>
      <div class="pronunciation-text">${phoneticResults.map(p => `<span class="phonetic-item">${p.word} <span class="phonetic-value">${p.phonetic}</span></span>`).join(' ')}</div>
    `;
  } else {
    pronunciationEl.innerHTML = '<div class="pronunciation-note">Không tìm thấy phiên âm cho văn bản này.</div>';
  }
}

async function loadKoreanRomanization(text, pronunciationEl) {
  const words = text.split(/\s+/).filter(w => w.length > 0).slice(0, 10);
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
      <div class="pronunciation-text">${results.map(r => `<span class="phonetic-item">${r.korean} <span class="phonetic-value">[${r.roman}]</span></span>`).join(' ')}</div>
    `;
  } else {
    pronunciationEl.innerHTML = '<div class="pronunciation-note">Không tìm thấy phiên âm cho văn bản này.</div>';
  }
}

async function loadChinesePinyin(text, pronunciationEl) {
  pronunciationEl.innerHTML = '<div class="pronunciation-loading">Đang tải phiên âm...</div>';
  
  try {
    // Extract only Chinese characters
    const chineseOnly = text.replace(/[^\u4e00-\u9fff]/g, '');
    
    if (!chineseOnly) {
      pronunciationEl.innerHTML = '<div class="pronunciation-note">Không tìm thấy ký tự Trung Quốc trong văn bản này.</div>';
      return;
    }
    
    // Try multiple CDN sources for pinyin-pro
    const cdnUrls = [
      'https://unpkg.com/pinyin-pro@3.18.6/dist/index.js',
      'https://cdn.jsdelivr.net/npm/pinyin-pro@3.18.6/dist/index.js'
    ];
    
    let loaded = false;
    for (const url of cdnUrls) {
      if (typeof pinyin !== 'undefined') break;
      try {
        await loadScript(url);
        loaded = true;
      } catch (e) {
        continue;
      }
    }
    
    if (typeof pinyin !== 'undefined' && typeof pinyin === 'function') {
      // Process character by character for complete coverage
      let resultHTML = '';
      
      for (const char of chineseOnly) {
        try {
          const py = pinyin(char, { toneType: 'symbol' });
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
      '道':'dào','公':'gōng','务':'wù','员':'yuán',
      '你':'nǐ','好':'hǎo','我':'wǒ','是':'shì','中':'zhōng','国':'guó','人':'rén',
      '的':'de','在':'zài','有':'yǒu','了':'le','们':'men','不':'bù','这':'zhè','那':'nà',
      '他':'tā','她':'tā','它':'tā','什':'shén','么':'me','吗':'ma','很':'hěn','会':'huì',
      '能':'néng','想':'xiǎng','爱':'ài','喜':'xǐ','欢':'huān','谢':'xiè','对':'duì','起':'qǐ',
      '没':'méi','关':'guān','系':'xì','请':'qǐng','问':'wèn','昨':'zuó','天':'tiān',
      '今':'jīn','年':'nián','月':'yuè','日':'rì','时':'shí','分':'fēn','钟':'zhōng',
      '快':'kuài','乐':'lè','东':'dōng','西':'xī','南':'nán','北':'běi','京':'jīng',
      '上':'shàng','海':'hǎi','广':'guǎng','州':'zhōu','深':'shēn','圳':'zhèn',
      '见':'jiàn','面':'miàn','认':'rèn','识':'shí','朋':'péng','友':'yǒu','家':'jiā',
      '工':'gōng','作':'zuò','学':'xué','校':'xiào','老':'lǎo','师':'shī','同':'tóng',
      '公':'gōng','司':'sī','医':'yī','院':'yuàn','银':'yín','行':'háng',
      '饭':'fàn','店':'diàn','酒':'jiǔ','吧':'ba','咖':'kā','啡':'fēi','茶':'chá',
      '水':'shuǐ','果':'guǒ','苹':'píng','香':'xiāng','蕉':'jiāo',
      '葡':'pú','萄':'táo','西':'xī','瓜':'guā','米':'mǐ','包':'bāo',
      '蛋':'dàn','肉':'ròu','鱼':'yú','鸡':'jī','鸭':'yā','猪':'zhū','牛':'niú','羊':'yáng',
      '马':'mǎ','车':'chē','路':'lù','地':'dì','铁':'tiě','站':'zhàn','机':'jī','场':'chǎng',
      '票':'piào','钱':'qián','买':'mǎi','卖':'mài','贵':'guì','便宜':'piányi',
      '多':'duō','少':'shǎo','大':'dà','小':'xiǎo','高':'gāo','矮':'ǎi',
      '长':'cháng','短':'duǎn','宽':'kuān','窄':'zhǎi','新':'xīn','旧':'jiù',
      '热':'rè','冷':'lěng','暖':'nuǎn','凉':'liáng','早':'zǎo','晚':'wǎn',
      '忙':'máng','闲':'xián','远':'yuǎn','近':'jìn','难':'nán','易':'yì',
      '听':'tīng','说':'shuō','读':'dú','写':'xiě','看':'kàn','走':'zǒu',
      '跑':'pǎo','飞':'fēi','吃':'chī','喝':'hē','睡':'shuì','觉':'jiào','醒':'xǐng',
      '坐':'zuò','站':'zhàn','躺':'tǎng','开':'kāi','关':'guān',
      '来':'lái','去':'qù','回':'huí','到':'dào','过':'guò','给':'gěi',
      '和':'hé','与':'yǔ','或':'huò','但':'dàn','却':'què','因':'yīn','为':'wèi',
      '所':'suǒ','以':'yǐ','如':'rú','果':'guǒ','虽':'suī','然':'rán',
      '只':'zhǐ','要':'yào','需':'xū','应':'yīng','该':'gāi','可':'kě',
      '以':'yǐ','够':'gòu','将':'jiāng','已':'yǐ','经':'jīng','正':'zhèng',
      '被':'bèi','把':'bǎ','让':'ràng','叫':'jiào','使':'shǐ','令':'lìng',
      '劝':'quàn','求':'qiú','帮':'bāng','助':'zhù','教':'jiào','答':'dá',
      '告':'gào','诉':'sù','怎':'zěn','么':'me','怎':'zěn','么':'me',
      '永':'yǒng','远':'yuǎn','经':'jīng','常':'cháng','往':'wǎng',
      '突':'tū','然':'rán','须':'xū','须':'xū','准':'zhǔn','备':'bèi',
      '始':'shǐ','束':'shù','完':'wán','成':'chéng','失':'shī','败':'bài',
      '功':'gōng','步':'bù','迎':'yíng','送':'sòng','光':'guāng','临':'lín',
      '参':'cān','加':'jiā','观':'guān','考':'kǎo','试':'shì','业':'yè',
      '案':'àn','题':'tí','问':'wèn','题':'tí','解':'jiě','决':'jué',
      '法':'fǎ','懂':'dǒng','记':'jì','得':'dé','忘':'wàng','白':'bái',
      '楚':'chǔ','确':'què','定':'dìng','一':'yī','定':'dìng','肯':'kěn',
      '许':'xǔ','点':'diǎn','半':'bàn','刻':'kè','秒':'miǎo','候':'hòu',
      '样':'yàng','错':'cuò','棒':'bàng','帅':'shuài','酷':'kù',
      '累':'lèi','舒':'shū','服':'fu','饿':'è','饱':'bǎo','渴':'kě',
      '痛':'tòng','病':'bìng','士':'shì','护':'hù','房':'fáng','间':'jiān',
      '厕':'cè','所':'suǒ','厨':'chú','厅':'tīng','床':'chuáng','桌':'zhuō',
      '椅':'yǐ','沙':'shā','发':'fā','门':'mén','窗':'chuāng','匙':'shi',
      '永':'yǒng','远':'yuǎn','健':'jiàn','康':'kāng','祝':'zhù','福':'fú',
      '庆':'qìng','恭':'gōng','喜':'xǐ','诞':'dàn','庆':'qìng','礼':'lǐ',
      '拜':'bài','星':'xīng','期':'qī',
      '从':'cóng','池':'chí','市':'shì','环':'huán','保':'bǎo','境':'jìng',
      '美':'měi','丽':'lì','女':'nǚ','孩':'hái','男':'nán','生':'shēng',
      '老':'lǎo','板':'bǎn','秘':'mì','书':'shū','助':'zhù','理':'lǐ',
      '总':'zǒng','经':'jīng','销':'xiāo','售':'shòu','客':'kè',
      '户':'hù','投':'tóu','资':'zī','金':'jīn','账':'zhàng','单':'dān',
      '计':'jì','划':'huà','节':'jié','假':'jià','旅':'lǚ','游':'yóu',
      '剧':'jù','院':'yuàn','百':'bǎi','姓':'xìng','名':'míng','电':'diàn',
      '话':'huà','号':'hào','码':'mǎ','微':'wēi','信':'xìn','邮':'yóu',
      '箱':'xiāng','省':'shěng','区':'qū','址':'zhǐ','楼':'lóu','层':'céng',
      '牌':'pái','照':'zhào','证':'zhèng','签':'qiān','出':'chū','入':'rù',
      '口':'kǒu','岸':'àn','税':'shuì','免':'miǎn','退':'tuì','换':'huàn',
      '货':'huò','网':'wǎng','购':'gòu','支':'zhī','付':'fù','宝':'bǎo',
      '现':'xiàn','用':'yòng','卡':'kǎ','租':'zū','押':'yā','修':'xiū',
      '装':'zhuāng','价':'jià','格':'gé','便':'biàn','宜':'yí','打':'dǎ',
      '折':'zhé','扣':'kòu','费':'fèi','优':'yōu','惠':'huì','券':'quàn',
      '积':'jī','品':'pǐn','赠':'zèng','包':'bāo','量':'liàng','尺':'chǐ',
      '寸':'cùn','规':'guī','型':'xíng','批':'pī','零':'líng','代':'dài',
      '招':'zhāo','商':'shāng','盟':'méng','连':'lián','锁':'suǒ','直':'zhí',
      '营':'yíng','转':'zhuǎn','让':'ràng','兑':'duì','汇':'huì','率':'lǜ',
      '款':'kuǎn','余':'yú','额':'é','存':'cún','取':'qǔ','利':'lì',
      '息':'xī','通':'tōng','知':'zhī','催':'cuī','欠':'qiàn','债':'zhài',
      '借':'jiè','还':'huán','条':'tiáo','约':'yuē','同':'tóng','字':'zì',
      '章':'zhāng','印':'yìn','明':'míng','暗':'àn','显':'xiǎn','示':'shì',
      '屏':'píng','幕':'mù','亮':'liàng','控':'kòng','制':'zhì','调':'diào',
      '温':'wēn','度':'dù','空':'kōng','调':'tiáo','暖':'nuǎn','气':'qì',
      '线':'xiàn','池':'chí','充':'chōng','宝':'bǎo','耳':'ěr','麦':'mài',
      '克':'kè','摄':'shè','像':'xiàng','拍':'pāi','录':'lù','视':'shì',
      '频':'pín','档':'dǎng','输':'shū','印':'yìn','扫':'sǎo','描':'miáo',
      '夹':'jiá','钉':'dīng','剪':'jiǎn','橡':'xiàng','皮':'pí','擦':'cā',
      '圆':'yuán','珠':'zhū','铅':'qiān','粉':'fěn','蜡':'là','墨':'mò',
      '砚':'yàn','镇':'zhèn','规':'guī','三':'sān','角':'jiǎo','算':'suàn',
      '盘':'pán','器':'qì','脑':'nǎo','平':'píng','本':'běn','台':'tái',
      '主':'zhǔ','显':'xiǎn','键':'jiàn','鼠':'shǔ','标':'biāo','U':'U',
      '移':'yí','动':'dòng','硬':'yìng','内':'nèi','显':'xiǎn','声':'shēng',
      '由':'yóu','猫':'māo','基':'jī','W':'W','I':'I','F':'F','密':'mì',
      '绑':'bǎng','登':'dēng','录':'lù','注':'zhù','册':'cè','销':'xiāo',
      '改':'gǎi','验':'yàn','短':'duǎn','众':'zhòng','平':'píng','台':'tái',
      '程':'chéng','序':'xù','软':'ruǎn','件':'jiàn','硬':'yìng','系':'xì',
      '统':'tǒng','应':'yìng','设':'shè','计':'jì','测':'cè','运':'yùn',
      '维':'wéi','更':'gēng','升':'shēng','级':'jí','优':'yōu','化':'huà',
      '删':'shān','除':'chú','备':'bèi','份':'fèn','恢':'huī','复':'fù',
      '还':'huán','原':'yuán','格':'gé','化':'huà','磁':'cí','清':'qīng',
      '理':'lǐ','垃':'lā','圾':'jī','收':'shōu','绿':'lǜ','色':'sè',
      '碳':'tàn','排':'pái','放':'fàng','减':'jiǎn','再':'zài','生':'shēng',
      '循':'xún','环':'huán','造':'zào','塑':'sù','料':'liào','玻':'bō',
      '璃':'lí','属':'shǔ','废':'fèi','物':'wù','处':'chǔ','桶':'tǒng',
      '袋':'dài','洁':'jié','卫':'wèi','扫':'sǎo','拖':'tuō','布':'bù',
      '抹':'mā','拭':'shì','洗':'xǐ','消':'xiāo','毒':'dú','杀':'shā',
      '菌':'jūn','防':'fáng','疫':'yì','罩':'zhào','液':'yè','精':'jīng',
      '巾':'jīn','湿':'shī','牙':'yá','膏':'gāo','漱':'shù','杯':'bēi',
      '乳':'rǔ','器':'qì','毛':'máo','浴':'yù','龙':'lóng','头':'tóu',
      '壶':'hú','瓶':'píng','饮':'yǐn','料':'liào','冰':'bīng','波':'bō',
      '炉':'lú','电':'diàn','磁':'cí','锅':'guō','铲':'chǎn','勺':'sháo',
      '碗':'wǎn','筷':'kuài','叉':'chā','羹':'gēng','凳':'dèng','垫':'diàn',
      '枕':'zhěn','被':'bèi','褥':'rù','毯':'tǎn','蚊':'wén','帐':'zhàng',
      '纱':'shā','帘':'lián','泡':'pào','管':'guǎn','插':'chā','座':'zuò',
      '接':'jiē','钥':'yào','锁':'suǒ','盗':'dào','铃':'líng','栏':'lán',
      '杆':'gǎn','阳':'yáng','台':'tái','露':'lòu','庭':'tíng','院':'yuàn',
      '园':'yuán','草':'cǎo','坪':'píng','树':'shù','木':'mù','浇':'jiāo',
      '肥':'féi','农':'nóng','药':'yào','具':'jù','锹':'qiāo','锄':'chú',
      '锤':'chuí','螺':'luó','丝':'sī','扳':'bān','钳':'qián','锯':'jù',
      '钻':'zuàn','泵':'bèng','漆':'qī','油':'yóu','滚':'gǔn','筒':'tǒng',
      '胶':'jiāo','带':'dài','双':'shuāng','壁':'bì','贴':'tiē','框':'kuàng',
      '挂':'guà','历':'lì','筒':'tǒng','架':'jià','盒':'hé','夹':'jiá',
      '环':'huán','链':'liàn','胸':'xiōng','针':'zhēn','帽':'mào','檐':'yán',
      '鞋':'xié','袜':'wà','仔':'zǎi','背':'bèi','七':'qī','九':'jiǔ',
      '装':'zhuāng','服':'fú','棉':'mián','羽':'yǔ','绒':'róng','皮':'pí',
      '大':'dài','马':'mǎ','甲':'jiǎ','织':'zhī','衬':'chèn','衫':'shān',
      '结':'jié','纽':'niǔ','魔':'mó','术':'shù','提':'tí','钱':'qián',
      '腰':'yāo','尚':'shàng','行':'xíng','李':'lǐ','肩':'jiān','化':'huà',
      '妆':'zhuāng','肤':'fū','霜':'shuāng','唇':'chún','红':'hóng','眉':'méi',
      '影':'yǐng','睫':'jié','底':'dǐ','瑕':'xiá','遮':'zhē','散':'sǎn',
      '腮':'sāi','容':'róng','卡':'kǎ','蜡':'là','胶':'jiāo','粘':'nián',
      '芯':'xīn','芯':'xīn','蜡':'là','棒':'bàng','转':'zhuǎn','印':'yìn',
      '戳':'chuō','固':'gù','体':'tǐ','珠':'zhū','石':'shí','锉':'cuò',
      '砂':'shā','薰':'xūn','灯':'dēng','炉':'lú','固':'gù'
    };
    
    let resultHTML = '';
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
    console.error('Pinyin error:', error);
    pronunciationEl.innerHTML = '<div class="pronunciation-error">Lỗi khi tải pinyin.</div>';
  }
}

// Basic pinyin lookup for common Chinese characters
function getBasicPinyin(text) {
  // Single character pinyin dictionary
  const charDict = {
    '一': 'yī', '二': 'èr', '三': 'sān', '四': 'sì', '五': 'wǔ',
    '六': 'liù', '七': 'qī', '八': 'bā', '九': 'jiǔ', '十': 'shí',
    '百': 'bǎi', '千': 'qiān', '万': 'wàn', '亿': 'yì',
    '零': 'líng', '两': 'liǎng', '几': 'jǐ', '多': 'duō', '少': 'shǎo',
    '大': 'dà', '小': 'xiǎo', '高': 'gāo', '低': 'dī', '长': 'cháng',
    '短': 'duǎn', '宽': 'kuān', '窄': 'zhǎi', '厚': 'hòu', '薄': 'báo',
    '深': 'shēn', '浅': 'qiǎn', '远': 'yuǎn', '近': 'jìn', '快': 'kuài',
    '慢': 'màn', '早': 'zǎo', '晚': 'wǎn', '新': 'xīn', '旧': 'jiù',
    '好': 'hǎo', '坏': 'huài', '对': 'duì', '错': 'cuò', '真': 'zhēn',
    '假': 'jiǎ', '美': 'měi', '丑': 'chǒu', '贵': 'guì', '便宜': 'piányi',
    '多': 'duō', '少': 'shǎo', '都': 'dōu', '很': 'hěn', '太': 'tài',
    '最': 'zuì', '更': 'gèng', '非常': 'fēicháng', '特别': 'tèbié',
    '我': 'wǒ', '你': 'nǐ', '他': 'tā', '她': 'tā', '它': 'tā',
    '们': 'men', '的': 'de', '了': 'le', '是': 'shì', '在': 'zài',
    '有': 'yǒu', '没': 'méi', '无': 'wú', '不': 'bù', '吗': 'ma',
    '呢': 'ne', '啊': 'a', '吧': 'ba', '呀': 'ya', '哦': 'ó',
    '这': 'zhè', '那': 'nà', '哪': 'nǎ', '谁': 'shuí', '什么': 'shénme',
    '怎': 'zěn', '么': 'me', '怎么': 'zěnme', '为': 'wèi', '什么': 'shénme',
    '为什': 'wèishén', '为什 么': 'wèishénme', '因为': 'yīnwèi', '所以': 'suǒyǐ',
    '但': 'dàn', '是': 'shì', '然': 'rán', '但是': 'dànshì', '虽然': 'suīrán',
    '如': 'rú', '果': 'guǒ', '如果': 'rúguǒ', '只': 'zhǐ', '要': 'yào',
    '需': 'xū', '需 要': 'xūyào', '应': 'yīng', '该': 'gāi', '应该': 'yīnggāi',
    '能': 'néng', '会': 'huì', '可': 'kě', '以': 'yǐ', '可以': 'kěyǐ',
    '想': 'xiǎng', '要': 'yào', '得': 'dé', '到': 'dào', '去': 'qù',
    '来': 'lái', '回': 'huí', '过': 'guò', '出': 'chū', '入': 'rù',
    '上': 'shàng', '下': 'xià', '左': 'zuǒ', '右': 'yòu', '前': 'qián',
    '后': 'hòu', '里': 'lǐ', '外': 'wài', '中': 'zhōng', '东': 'dōng',
    '南': 'nán', '西': 'xī', '北': 'běi',
    '天': 'tiān', '地': 'dì', '人': 'rén', '国': 'guó', '家': 'jiā',
    '中 国': 'zhōngguó', '美国': 'Měiguó', '英国': 'Yīngguó', '法国': 'Fàguó',
    '德国': 'Déguó', '日本': 'Rìběn', '韩国': 'Hánguó', '俄国': 'Éguó',
    '京': 'jīng', '上海': 'Shànghǎi', '广州': 'Guǎngzhōu', '深圳': 'Shēnzhèn',
    '香港': 'Xiānggǎng', '澳门': 'Aomen', '台湾': 'Táiwān', '新加坡': 'Xīnjiāpō',
    '公': 'gōng', '司': 'sī', '公 司': 'gōngsī', '银': 'yín', '行': 'háng',
    '银 行': 'yínháng', '学': 'xué', '校': 'xiào', '学 校': 'xuéxiào',
    '老': 'lǎo', '师': 'shī', '老 师': 'lǎoshī', '生': 'shēng', '学 生': 'xuéshēng',
    '朋': 'péng', '友': 'yǒu', '朋 友': 'péngyǒu', '同': 'tóng', '学': 'xué',
    '同 学': 'tóngxué', '爸': 'bà', '妈': 'mā', '爸 爸': 'bàba', '妈 妈': 'māma',
    '父': 'fù', '母': 'mǔ', '亲': 'qīn', '父 母': 'fùmǔ', '亲 戚': 'qīnqi',
    '哥': 'gē', '弟': 'dì', '姐': 'jiě', '妹': 'mèi', '哥 哥': 'gēge',
    '弟 弟': 'dìdi', '姐 姐': 'jiějie', '妹 妹': 'mèimei',
    '见': 'jiàn', '面': 'miàn', '见 面': 'jiànmiàn', '认': 'rèn', '识': 'shí',
    '认 识': 'rènshi', '告': 'gào', '诉': 'sù', '告 诉': 'gàosù',
    '聊': 'liáo', '天': 'tiān', '聊 天': 'liáotiān', '说': 'shuō', '话': 'huà',
    '说 话': 'shuōhuà', '问': 'wèn', '答': 'dá', '问 答': 'wèndá',
    '听': 'tīng', '写': 'xiě', '读': 'dú', '看': 'kàn', '读': 'dú',
    '书': 'shū', '读 书': 'dúshū', '习': 'xí', '学': 'xué', '学 习': 'xuéxí',
    '工': 'gōng', '作': 'zuò', '工 作': 'gōngzuò', '上班': 'shàngbān', '下班': 'xiàbān',
    '请': 'qǐng', '问': 'wèn', '请 问': 'qǐngwèn', '谢': 'xiè', '谢 谢': 'xièxie',
    '对': 'duì', '不': 'bù', '对 不 起': 'duìbùqǐ', '起': 'qǐ', '对': 'duì',
    '没': 'méi', '关': 'guān', '系': 'xì', '没 关 系': 'méiguānxi',
    '爱': 'ài', '喜': 'xǐ', '欢': 'huān', '喜 欢': 'xǐhuan', '爱': 'ài',
    '医': 'yī', '院': 'yuàn', '医 院': 'yīyuàn', '药': 'yào', '药 店': 'yàodiàn',
    '饭': 'fàn', '吃': 'chī', '吃 饭': 'chīfàn', '店': 'diàn', '酒': 'jiǔ',
    '酒 店': 'jiǔdiàn', '咖': 'kā', '啡': 'fēi', '咖 啡': 'kāfēi', '茶': 'chá',
    '水': 'shuǐ', '果': 'guǒ', '水 果': 'shuǐguǒ', '苹': 'píng', '果': 'guǒ',
    '苹 果': 'píngguǒ', '香': 'xiāng', '蕉': 'jiāo', '香 蕉': 'xiāngjiāo',
    '葡': 'pú', '萄': 'táo', '葡 萄': 'pútao', '西': 'xī', '瓜': 'guā',
    '西 瓜': 'xīguā', '肉': 'ròu', '鱼': 'yú', '鸡': 'jī', '鸭': 'yā',
    '猪': 'zhū', '牛': 'niú', '羊': 'yáng', '蛋': 'dàn', '面': 'miàn',
    '米': 'mǐ', '米 饭': 'mǐfàn', '包': 'bāo', '面 包': 'miànbāo',
    '车': 'chē', '汽': 'qì', '汽 车': 'qìchē', '火': 'huǒ', '车': 'chē',
    '火 车': 'huǒchē', '地': 'dì', '铁': 'tiě', '地 铁': 'dìtiě',
    '站': 'zhàn', '机': 'jī', '场': 'chǎng', '机 场': 'jīchǎng',
    '票': 'piào', '钱': 'qián', '买': 'mǎi', '卖': 'mài', '买 东 西': 'mǎi dōngxi',
    '路': 'lù', '走': 'zǒu', '跑': 'pǎo', '飞': 'fēi', '坐': 'zuò',
    '躺': 'tǎng', '站': 'zhàn', '开': 'kāi', '关': 'guān', '睡': 'shuì',
    '觉': 'jiào', '睡 觉': 'shuìjiào', '醒': 'xǐng', '吃': 'chī', '喝': 'hē',
    '打': 'dǎ', '电': 'diàn', '话': 'huà', '打 电 话': 'dǎ diànhuà',
    '网': 'wǎng', '络': 'luò', '网 络': 'wǎngluò', '微': 'wēi', '信': 'xìn',
    '微 信': 'wēixìn', '邮': 'yóu', '件': 'jiàn', '邮 件': 'yóujiàn',
    '时': 'shí', '间': 'jiān', '时 间': 'shíjiān', '现': 'xiàn', '在': 'zài',
    '现 在': 'xiànzài', '今': 'jīn', '天': 'tiān', '今 天': 'jīntiān',
    '昨': 'zuó', '天': 'tiān', '昨 天': 'zuótiān', '明': 'míng', '天': 'tiān',
    '明 天': 'míngtiān', '年': 'nián', '月': 'yuè', '日': 'rì', '号': 'hào',
    '今 年': 'jīnnián', '昨 年': 'zuónián', '明 年': 'míngnián',
    '礼': 'lǐ', '拜': 'bài', '礼 拜': 'lǐbài', '星': 'xīng', '期': 'qī',
    '星 期': 'xīngqī', '一': 'yī', '二': 'èr', '三': 'sān', '四': 'sì',
    '五': 'wǔ', '六': 'liù', '七': 'qī', '星 期 一': 'xīngqī yī',
    '星 期 二': 'xīngqī èr', '星 期 三': 'xīngqī sān', '星 期 四': 'xīngqī sì',
    '星 期 五': 'xīngqī wǔ', '星 期 六': 'xīngqī liù', '星 期 天': 'xīngqī tiān',
    '早': 'zǎo', '上': 'shàng', '早 上': 'zǎoshang', '中': 'zhōng', '午': 'wǔ',
    '中 午': 'zhōngwǔ', '下': 'xià', '午': 'wǔ', '下 午': 'xiàwǔ',
    '晚': 'wǎn', '上': 'shàng', '晚 上': 'wǎnshang', '夜': 'yè', '晚': 'wǎn',
    '昨': 'zuó', '晚': 'wǎn', '昨 晚': 'zuówǎn', '夜': 'yè',
    '半': 'bàn', '点': 'diǎn', '半 点': 'bàndiǎn', '刻': 'kè', '分': 'fēn',
    '钟': 'zhōng', '秒': 'miǎo', '什': 'shén', '么': 'me', '时': 'shí',
    '候': 'hòu', '什 么 时 候': 'shénme shíhòu', '怎': 'zěn', '么': 'me',
    '么': 'me', '怎 么': 'zěnme', '样': 'yàng', '怎 么 样': 'zěnmeyàng',
    '样': 'yàng', '怎 么 样': 'zěnmeyàng', '还': 'hái', '好': 'hǎo',
    '还': 'hái', '吗': 'ma', '还 好': 'háihǎo', '不': 'bù', '错': 'cuò',
    '不 错': 'bùcuò', '棒': 'bàng', '帅': 'shuài', '酷': 'kù',
    '忙': 'máng', '闲': 'xián', '累': 'lèi', '舒': 'shū', '服': 'fu',
    '舒 服': 'shūfu', '饿': 'è', '饱': 'bǎo', '渴': 'kě', '口': 'kǒu',
    '渴': 'kě', '口 渴': 'kǒukě', '痛': 'tòng', '病': 'bìng', '医': 'yī',
    '医 生': 'yīsheng', '护': 'hù', '士': 'shì', '护 士': 'hùshi',
    '房': 'fáng', '间': 'jiān', '房 间': 'fángjiān', '厕': 'cè', '所': 'suǒ',
    '厕 所': 'cèsuǒ', '厨': 'chú', '房': 'fáng', '厨 房': 'chúfáng',
    '客': 'kè', '厅': 'tīng', '客 厅': 'kètīng', '床': 'chuáng', '桌': 'zhuō',
    '椅': 'yǐ', '沙': 'shā', '发': 'fā', '沙 发': 'shāfā',
    '门': 'mén', '窗': 'chuāng', '钥': 'yào', '匙': 'shi', '钥 匙': 'yàoshi',
    '钥': 'yào', '怎': 'zěn', '怎 么': 'zěnme', '你': 'nǐ', '们': 'men',
    '三': 'sān', '个': 'gè', '都': 'dōu', '没': 'méi', '事': 'shì',
    '怎 么 你 们 三 个 都 没 事': 'zěnme nǐmen sān gè dōu méi shì',
    '你 好': 'nǐhǎo', '再 见': 'zàijiàn', '保 重': 'bǎozhòng', '注': 'zhù',
    '意': 'yì', '注 意': 'zhùyì', '安': 'ān', '全': 'quán', '安 全': 'ānquán',
    '健': 'jiàn', '康': 'kāng', '健 康': 'jiànkāng', '祝': 'zhù', '福': 'fú',
    '祝 福': 'zhùfú', '庆': 'qìng', '祝': 'zhù', '恭': 'gōng', '喜': 'xǐ',
    '恭 喜': 'gōngxǐ', '新': 'xīn', '年': 'nián', '快': 'kuài', '新 年 快 乐': 'xīnnián kuàilè',
    '圣': 'shèng', '诞': 'dàn', '快': 'kuài', '圣 诞 快 乐': 'shèngdàn kuàilè',
    '生': 'shēng', '日': 'rì', '快': 'kuài', '生 日 快 乐': 'shēngrì kuàilè',
    '永': 'yǒng', '远': 'yuǎn', '永 远': 'yǒngyuǎn', '经': 'jīng', '常': 'cháng',
    '经 常': 'jīngcháng', '往': 'wǎng', '往': 'wǎng', '以': 'yǐ', '往': 'wǎng',
    '以 往': 'yǐwǎng', '突': 'tū', '然': 'rán', '突 然': 'tūrán',
    '必': 'bì', '须': 'xū', '必 须': 'bìxū', '需': 'xū', '要': 'yào',
    '需 要': 'xūyào', '正': 'zhèng', '在': 'zài', '正 在': 'zhèngzài',
    '马': 'mǎ', '上': 'shàng', '马 上': 'mǎshàng', '立': 'lì', '刻': 'kè',
    '立 刻': 'lìkè', '已': 'yǐ', '经': 'jīng', '已 经': 'yǐjing',
    '马': 'mǎ', '上': 'shàng', '马 上': 'mǎshàng', '准': 'zhǔn', '备': 'bèi',
    '准 备': 'zhǔnbèi', '开': 'kāi', '始': 'shǐ', '开 始': 'kāishǐ',
    '结': 'jié', '束': 'shù', '结 束': 'jiéshù', '完': 'wán', '成': 'chéng',
    '完 成': 'wánchéng', '失': 'shī', '败': 'bài', '失 败': 'shībài',
    '成': 'chéng', '功': 'gōng', '成 功': 'chénggōng', '进': 'jìn', '步': 'bù',
    '进 步': 'jìnbù', '欢': 'huān', '迎': 'yíng', '欢 迎': 'huānyíng',
    '送': 'sòng', '欢': 'huān', '迎': 'yíng', '欢 送': 'huānsòng',
    '欢': 'huān', '迎': 'yíng', '光': 'guāng', '临': 'lín', '欢 迎 光 临': 'huānyíng guānglín',
    '参': 'cān', '加': 'jiā', '参 加': 'cānjiā', '参': 'cān', '观': 'guān',
    '参 观': 'cānguān', '参': 'cān', '考': 'kǎo', '参 考': 'cānkǎo',
    '考': 'kǎo', '试': 'shì', '考 试': 'kǎoshì', '作': 'zuò', '业': 'yè',
    '作 业': 'zuòyè', '答': 'dá', '案': 'àn', '答 案': 'dáàn',
    '题': 'tí', '问': 'wèn', '问 题': 'wèntí', '解': 'jiě', '决': 'jué',
    '解 决': 'jiějué', '办': 'bàn', '法': 'fǎ', '办 法': 'bànfǎ',
    '知': 'zhī', '道': 'dào', '知 道': 'zhīdào', '懂': 'dǒng', '不': 'bù',
    '懂': 'dǒng', '懂 不 懂': 'dǒngbùdǒng', '会': 'huì', '不': 'bù',
    '会': 'huì', '会 不 会': 'huìbùhuì', '记': 'jì', '得': 'dé',
    '记 得': 'jìde', '忘': 'wàng', '记': 'jì', '忘 记': 'wàngjì',
    '明': 'míng', '白': 'bái', '明 白': 'míngbai', '清': 'qīng', '楚': 'chǔ',
    '清 楚': 'qīngchu', '确': 'què', '定': 'dìng', '确 定': 'quèdìng',
    '一': 'yī', '定': 'dìng', '一 定': 'yīdìng', '肯': 'kěn', '定': 'dìng',
    '肯 定': 'kěndìng', '许': 'xǔ', '多': 'duō', '许 多': 'xǔduō',
    '少': 'shǎo', '一': 'yī', '点': 'diǎn', '少 一 点': 'shǎo yīdiǎn',
    '帮': 'bāng', '助': 'zhù', '帮 助': 'bāngzhù', '谢': 'xiè', '谢': 'xiè',
    '谢 谢': 'xièxie', '不': 'bù', '谢': 'xiè', '不 谢': 'bùxiè',
    '没': 'méi', '事': 'shì', '没 事': 'méishì', '不': 'bù', '用': 'yòng',
    '不 用': 'bùyòng', '客': 'kè', '气': 'qì', '不 客 气': 'bùkèqi',
    '没': 'méi', '关': 'guān', '系': 'xì', '没 关 系': 'méiguānxi',
    '不': 'bù', '好': 'hǎo', '意': 'yì', '思': 'si', '不 好 意 思': 'bùhǎoyìsi',
    '麻': 'má', '烦': 'fan', '麻 烦': 'máfan', '辛': 'xīn', '苦': 'kǔ',
    '辛 苦': 'xīnkǔ', '累': 'lèi', '抱': 'bào', '歉': 'qiàn', '抱 歉': 'bàoqiàn',
    '对': 'duì', '不': 'bù', '起': 'qǐ', '对 不 起': 'duìbùqǐ',
    '没': 'méi', '关': 'guān', '系': 'xì', '没 关 系': 'méiguānxi'
  };
  
  const results = [];
  
  // Extract only Chinese characters and spaces from text
  const chineseOnly = text.replace(/[^\u4e00-\u9fff\s]/g, '').trim();
  
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
      results.push({ chinese: phrase, pinyin: charPinyins.join('') });
    }
  }
  
  return results;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
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
    'ㄱ': 'g', 'ㄲ': 'kk', 'ㄴ': 'n', 'ㄷ': 'd', 'ㄸ': 'tt', 'ㄹ': 'r',
    'ㅁ': 'm', 'ㅂ': 'b', 'ㅃ': 'pp', 'ㅅ': 's', 'ㅆ': 'ss', 'ㅇ': '',
    'ㅈ': 'j', 'ㅉ': 'jj', 'ㅊ': 'ch', 'ㅋ': 'k', 'ㅌ': 't', 'ㅍ': 'p', 'ㅎ': 'h'
  };
  
  // Medial vowels ( nucleus )
  const nucleus = {
    'ㅏ': 'a', 'ㅐ': 'ae', 'ㅑ': 'ya', 'ㅒ': 'yae', 'ㅓ': 'eo', 'ㅔ': 'e',
    'ㅕ': 'yeo', 'ㅖ': 'ye', 'ㅗ': 'o', 'ㅘ': 'wa', 'ㅙ': 'wae', 'ㅚ': 'oe',
    'ㅛ': 'yo', 'ㅜ': 'u', 'ㅝ': 'wo', 'ㅞ': 'we', 'ㅟ': 'wi',
    'ㅠ': 'yu', 'ㅡ': 'eu', 'ㅢ': 'ui', 'ㅣ': 'i'
  };
  
  // Final consonants ( coda )
  const coda = {
    '': '', 'ㄱ': 'k', 'ㄲ': 'k', 'ㄳ': 'ks', 'ㄴ': 'n', 'ㄵ': 'nj', 'ㄶ': 'nh',
    'ㄷ': 't', 'ㄹ': 'l', 'ㄺ': 'lk', 'ㄻ': 'lm', 'ㄼ': 'lp', 'ㄽ': 'ls',
    'ㄾ': 'lt', 'ㄿ': 'lp', 'ㅀ': 'lh', 'ㅁ': 'm', 'ㅂ': 'p', 'ㅄ': 'ps',
    'ㅅ': 't', 'ㅆ': 't', 'ㅇ': 'ng', 'ㅈ': 't', 'ㅊ': 't', 'ㅋ': 'k',
    'ㅌ': 't', 'ㅍ': 'p', 'ㅎ': 't'
  };
  
  const chars = [...text];
  let result = '';
  
  for (const char of chars) {
    const code = char.charCodeAt(0);
    
    // Check if it's a Hangul syllable
    if (code >= 0xAC00 && code <= 0xD7A3) {
      const syllableIndex = code - 0xAC00;
      const onsetIndex = Math.floor(syllableIndex / 588);
      const nucleusIndex = Math.floor((syllableIndex % 588) / 28);
      const codaIndex = syllableIndex % 28;
      
      const onsetChars = Object.keys(onset);
      const nucleusChars = Object.keys(nucleus);
      const codaChars = Object.keys(coda);
      
      const o = onset[onsetChars[onsetIndex]] || '';
      const v = nucleus[nucleusChars[nucleusIndex]] || '';
      const c = coda[codaChars[codaIndex]] || '';
      
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
  const api = document.querySelector('input[name="translateApi"]:checked')?.value || 'mymemory';

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
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(input)}&langpair=${langPair}`
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
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(input)}`
      );

      if (!response.ok) {
        throw new Error("Google Translate error");
      }

      const data = await response.json();
      if (data && data[0]) {
        translatedText = data[0].map(item => item[0]).join("");
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
    const showPronunciation = document.getElementById("showPronunciation")?.checked;
    if (showPronunciation && translatedText) {
      loadPronunciation(translatedText, toLang);
    }

    if (fromLang === "auto" && detectedLanguage) {
      const detectedLang = detectedLanguage.toLowerCase();
      const langNames = {
        "en": "Tiếng Anh",
        "ko": "Tiếng Hàn",
        "zh": "Tiếng Trung",
        "vi": "Tiếng Việt"
      };
      const langEmojis = {
        "en": "🇬🇧",
        "ko": "🇰🇷",
        "zh": "🇨🇳",
        "vi": "🇻🇳"
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

async function saveTranslateToHistory(originalText, translatedText, fromLang, toLang) {
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
    timestamp: new Date().toISOString()
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
    container.innerHTML = '<div class="translate-history-empty">Chưa có lịch sử dịch</div>';
    return;
  }

  const langNames = {
    "auto": "Tự động",
    "en": "Tiếng Anh",
    "ko": "Tiếng Hàn",
    "zh": "Tiếng Trung",
    "vi": "Tiếng Việt"
  };

  container.innerHTML = translateHistoryCache.map(item => {
    const date = new Date(item.timestamp);
    const timeStr = date.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
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
  }).join("");
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
  } catch (err) {
    console.error("Lỗi xóa lịch sử dịch:", err);
    showToast("Lỗi khi xóa lịch sử dịch");
  }
}

async function confirmDeleteAllTranslateHistory() {
  // Close history modal if open, since the action is from there
  const historyModal = document.getElementById("translateHistoryModal");
  const isHistoryModalOpen = historyModal && historyModal.style.display === "flex";
  
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
      } catch (err) {
        console.error("Lỗi xóa tất cả lịch sử dịch:", err);
        showToast("Lỗi khi xóa lịch sử dịch");
      }
    }
  );
}

function exportTranslateHistoryCsv() {
  if (translateHistoryCache.length === 0) {
    showToast("Không có lịch sử để xuất");
    return;
  }

  const langNames = {
    "auto": "Tự động",
    "en": "Tiếng Anh",
    "ko": "Tiếng Hàn",
    "zh": "Tiếng Trung",
    "vi": "Tiếng Việt"
  };

  let csvContent = "\uFEFF"; // BOM for UTF-8
  csvContent += "STT,Ngày giờ,Ngôn ngữ nguồn,Ngôn ngữ đích,Văn bản gốc,Văn bản dịch\n";

  translateHistoryCache.forEach((item, index) => {
    const date = new Date(item.timestamp).toLocaleString("vi-VN");
    const fromLang = langNames[item.fromLang] || item.fromLang;
    const toLang = langNames[item.toLang] || item.toLang;
    const original = (item.original || "").replace(/"/g, '""');
    const translated = (item.translated || "").replace(/"/g, '""');

    csvContent += `${index + 1},"${date}","${fromLang}","${toLang}","${original}","${translated}"\n`;
  });

  downloadCsvFile(csvContent, `lich-su-dich-${formatDateForFilename(new Date())}.csv`);
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
performTranslation = async function(text) {
  const fromLang = document.getElementById("translateFromLang").value;
  const toLang = document.getElementById("translateToLang").value;

  await originalPerformTranslation(text);

  // Save to history after successful translation (only if there's output)
  const outputEl = document.getElementById("translateOutput");
  const translatedText = outputEl ? outputEl.value : "";

  if (translatedText && translatedText.trim() && text && text.trim()) {
    saveTranslateToHistory(text.trim(), translatedText.trim(), fromLang, toLang);
  }
};
