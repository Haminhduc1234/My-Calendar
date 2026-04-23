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
    <div class="today-events-header">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
      Sự kiện hôm nay
    </div>
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
  if (input) input.focus({ preventScroll: true });
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
  initTranslateHistoryCollapsed();
  document.getElementById("translateInput").focus();
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
  const arrowEl = document.getElementById("translateHistoryArrow");
  listEl.classList.toggle("collapsed", isCollapsed);
  arrowEl.classList.toggle("collapsed", isCollapsed);
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

function detectLanguage() {
  const fromLang = document.getElementById("translateFromLang").value;
  const toLang = document.getElementById("translateToLang").value;
  saveLanguages(fromLang, toLang);
}

function saveToLangSelection() {
  const fromLang = document.getElementById("translateFromLang").value;
  const toLang = document.getElementById("translateToLang").value;
  saveLanguages(fromLang, toLang);
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
