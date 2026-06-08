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
const CASHFLOW_CATEGORY_ID_MIGRATION_FLAG_PREFIX = "cashflowCategoryIdMigrated:";
const LEGACY_CASHFLOW_STORAGE_KEY = "cashflowEntriesV1";
const FIREBASE_CONFIG = self.FIREBASE_WEB_CONFIG || {};
const FIREBASE_TRANSLATE_HISTORY_PATH =
  self.FIREBASE_TRANSLATE_HISTORY_PATH || "translateHistory";

let firebaseDb = null;
let firebaseDatesRef = null;
let firebaseQuickNotesRef = null;
let firebaseTranslateHistoryRef = null;
let firebaseAISettingsRef = null;
let firebaseProfileSettingsRef = null;
let firebaseReady = false;
let firebaseAuth = null;
let firebaseProjectsRef = null;
let userProfileKey = "";
let dateDataCache = {};
let quickNotesCache = [];
let translateHistoryCache = [];
let syncWriteErrorShown = false;
let profileSettingsCache = {};

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
  // Load calendar on first interaction
  loadCalendarOnDemand();
  
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
        category: String(entry?.category || "").trim(),
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
      // Initialize profile UI after profile key is set
      setTimeout(() => initProfileOnLoad(), 0);
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
      // Initialize profile UI after profile key is set
      setTimeout(() => initProfileOnLoad(), 0);
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
    avatarPlaceholder.style.display = "none";
  } else {
    avatarEl.style.display = "none";
    avatarPlaceholder.style.display = "flex";
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
  } catch {}

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
  // Hiển thị PIN ngay để người dùng nhập mà không phải chờ auth Firebase.
  if (!(await ensureProfileKey())) {
    alert("Bạn cần nhập mật khẩu đồng bộ để sử dụng dữ liệu đa thiết bị.");
    return;
  }

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

  // AI Settings reference (API Key + Model)
  firebaseAISettingsRef = firebaseDb.ref(`aiSettings/${userProfileKey}`);

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
    loadCalendarOnDemand();
    renderCalendar();
    renderOvertime();
    renderOvertimeSalary();
    if (LAZY_LOAD.cashflow) {
      renderCashflowDashboard();
    }
  });

  firebaseQuickNotesRef.on("value", (snapshot) => {
    const incoming = snapshot.val();
    if (Array.isArray(incoming)) {
      quickNotesCache = incoming;
      localStorage.setItem(getQuickNoteStorageKey(), JSON.stringify(incoming));
      // Only render if already loaded or if quickNotes is visible
      if (LAZY_LOAD.quickNotes) {
        renderQuickNotes();
      }
    }
  });

  firebaseReady = true;

  // Initialize countdown
  initCountdown();

  // Initialize profile UI
  initProfileOnLoad();

  // Load AI Settings from Firebase
  loadAISettingsFromFirebase();

  // Realtime database initialized
  console.log("Firebase Realtime Database connected");
}

// Load AI Settings from Firebase
function loadAISettingsFromFirebase() {
  if (!firebaseAISettingsRef) return;

  firebaseAISettingsRef
    .once("value")
    .then((snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Update global variables
        if (data.apiKey) {
          aiApiKey = data.apiKey;
          localStorage.setItem("aiApiKey", data.apiKey);
        }
        if (data.model) {
          aiModel = data.model;
          localStorage.setItem("aiModel", data.model);
        }
        // Update UI
        updateAIStatus();
        console.log("AI Settings loaded from Firebase");
      }
    })
    .catch((err) => {
      console.error("Error loading AI settings from Firebase:", err);
    });

  // Listen for real-time updates
  firebaseAISettingsRef.on("value", (snapshot) => {
    const data = snapshot.val();
    if (data) {
      if (data.apiKey && data.apiKey !== aiApiKey) {
        aiApiKey = data.apiKey;
        localStorage.setItem("aiApiKey", data.apiKey);
        updateAIStatus();
        showToast("API Key đã được đồng bộ từ thiết bị khác!");
      }
      if (data.model && data.model !== aiModel) {
        aiModel = data.model;
        localStorage.setItem("aiModel", data.model);
      }
    }
  });
}

// Save AI Settings to Firebase
function saveAISettingsToFirebase(apiKey, model) {
  if (!firebaseAISettingsRef) {
    // Fallback to localStorage
    localStorage.setItem("aiApiKey", apiKey);
    localStorage.setItem("aiModel", model);
    return;
  }

  const settings = {
    apiKey: apiKey,
    model: model,
    updatedAt: Date.now(),
  };

  firebaseAISettingsRef
    .set(settings)
    .then(() => {
      console.log("AI Settings saved to Firebase");
    })
    .catch((err) => {
      console.error("Error saving AI settings to Firebase:", err);
      // Fallback to localStorage
      localStorage.setItem("aiApiKey", apiKey);
      localStorage.setItem("aiModel", model);
    });
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
    "currencyModal",
    "fundsModal",
    "fundModal",
    "allocateModal",
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
  loadCalendarOnDemand();
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
  loadCalendarOnDemand();
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
      <div style="text-align: center; padding: 40px 20px; color: var(--muted);">
        <p>Chưa có dự án nào.</p>
        <p>Nhấn "+ Thêm dự án mới" để bắt đầu.</p>
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
      <div style="text-align: center; padding: 40px 20px; color: var(--muted);">
        <p>Chưa có công việc nào.</p>
        <p>Nhấn "+ Thêm công việc" để bắt đầu.</p>
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

    // Mobile touch events
    item.addEventListener("touchstart", handleTaskTouchStart, {
      passive: false,
    });
    item.addEventListener("touchmove", handleTaskTouchMove, { passive: false });
    item.addEventListener("touchend", (e) => handleTaskTouchEnd(e, projectId));
  });
}

function handleTaskTouchStart(e) {
  if (
    e.target.closest(".item-actions") ||
    e.target.closest(".task-drag-handle")
  ) {
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

  document.querySelectorAll(".task-item.draggable").forEach((item) => {
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
  loadGoldOnDemand();
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
  loadQuickNotesOnDemand();
  document.getElementById("quickNoteModal").style.display = "flex";

  const input = document.getElementById("quickNoteInput");
  if (input) {
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
  // Default to collapsed if no saved state
  const isCollapsed = savedState !== "expanded";

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
&hourly=relativehumidity_2m,temperature_2m,weathercode,precipitation_probability
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

  for (let i = 1; i < daily.time.length; i++) {
    const date = new Date(daily.time[i]);

    // Format day label: Ngày mai, Ngày kia, or weekday + date
    let dayLabel;
    if (i === 1) {
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
      "Cache-Control": "no-cache",
    },
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
let cashflowAnalyticsRange = "all";
let cashflowSummaryRange = "all";
let cashflowShowAllRecent = false;
let selectedCashflowId = "";

const CASHFLOW_PIE_COLORS = [
  "#60a5fa",
  "#34d399",
  "#f59e0b",
  "#f472b6",
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

function openCashflowModal() {
  closeAllModals();
  const modal = document.getElementById("cashflowModal");
  const dateInput = document.getElementById("cashflowDate");
  if (!dateInput.value) {
    dateInput.value = getTodayIsoDate();
  }

  cashflowShowAllRecent = false;
  modal.style.display = "flex";
  updateCashflowCategoryDropdowns();
  syncCashflowFormMode();
  syncCashflowRangeFilterUI();
  loadCashflowOnDemand();
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
  const categoryInput = document.getElementById("cashflowCategory");
  const amountInput = document.getElementById("cashflowAmount");
  const noteInput = document.getElementById("cashflowNote");

  const date = normalizeIsoDateString(dateInput.value);
  const type = typeInput.value === "expense" ? "expense" : "income";
  const category = categoryInput.value;
  const amount = parseInt(amountInput.value.replace(/\D/g, ""), 10) || 0;
  const note = noteInput.value.trim();
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
      createdAt: located.entry.createdAt || Date.now(),
      updatedAt: Date.now(),
    });
    saveDateData(targetDateKey, targetData);
  } else {
    const entry = {
      id: `cf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date,
      type,
      category,
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
  updateCashflowCategoryDropdowns();
  document.getElementById("cashflowAmount").value =
    entry.amount.toLocaleString("vi-VN");
  document.getElementById("cashflowNote").value = entry.note || "";

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

function resetCashflowForm() {
  editingCashflowId = "";
  document.getElementById("cashflowDate").value = getTodayIsoDate();
  document.getElementById("cashflowType").value = "income";
  updateCashflowCategoryDropdowns();
  document.getElementById("cashflowAmount").value = "";
  document.getElementById("cashflowNote").value = "";
  syncCashflowFormMode();
  renderCashflowQuickView();
}

function syncCashflowFormMode() {
  const submitBtn = document.getElementById("cashflowSubmitBtn");
  const cancelBtn = document.getElementById("cashflowCancelEditBtn");
  if (!submitBtn || !cancelBtn) return;

  if (editingCashflowId) {
    submitBtn.innerText = "Lưu chỉnh sửa";
    cancelBtn.style.display = "block";
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

  if (selectedCashflowId === id) {
    selectedCashflowId = "";
  }

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
    empty.className = "cashflow-recent-empty";
    empty.innerText = "Chưa có giao dịch nào. Hãy thêm khoản thu/chi đầu tiên.";
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
      renderCashflowRecentList();
      openCashflowQuickViewModal();
    });
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectedCashflowId = entry.id;
        renderCashflowRecentList();
        openCashflowQuickViewModal();
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

    const editBtn = document.createElement("button");
    editBtn.className = "cashflow-row-edit";
    editBtn.type = "button";
    editBtn.title = "Sửa giao dịch";
    editBtn.setAttribute("aria-label", "Sửa giao dịch");
    editBtn.innerHTML = "&#9998;";
    editBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      startCashflowEdit(entry.id);
    });

    const delBtn = document.createElement("button");
    delBtn.className = "cashflow-row-delete";
    delBtn.type = "button";
    delBtn.title = "Xóa giao dịch";
    delBtn.setAttribute("aria-label", "Xóa giao dịch");
    delBtn.innerText = "×";
    delBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      removeCashflowEntry(entry.id);
    });

    actionsEl.appendChild(editBtn);
    actionsEl.appendChild(delBtn);

    row.appendChild(topLineEl);
    row.appendChild(amountEl);
    row.appendChild(actionsEl);
    row.appendChild(noteEl);
    row.appendChild(sublineEl);
    listEl.appendChild(row);
  }

  renderCashflowQuickView();
}

function toggleCashflowRecentList() {
  cashflowShowAllRecent = !cashflowShowAllRecent;
  renderCashflowRecentList();
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

function getCashflowCategoryLabel(type, categoryValue) {
  const normalizedValue = String(categoryValue || "").trim();
  if (!normalizedValue) return "Chưa phân loại";

  const categories = cashflowCategories[type] || [];
  const matchedCategory = categories.find(
    (category) =>
      String(category?.id || "").trim() === normalizedValue ||
      String(category?.name || "").trim() === normalizedValue,
  );

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
  modal.style.display = "flex";
}

function closeCashflowQuickViewModal() {
  const modal = document.getElementById("cashflowQuickViewModal");
  if (!modal) return;
  modal.style.display = "none";
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

  const entry = ensureSelectedCashflowEntry();
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

  quickViewEl.innerHTML = `
    <div class="cashflow-quickview-head">
      <div>
        <div class="cashflow-quickview-eyebrow">Xem nhanh giao dịch</div>
        <div class="cashflow-quickview-title">${typeLabel} • ${categoryLabel}</div>
      </div>
      <div class="cashflow-quickview-amount ${entry.type === "income" ? "is-income" : "is-expense"}">${amountLabel}</div>
    </div>
    <div class="cashflow-quickview-note">${noteLabel}</div>
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
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeCashflowQuickViewModal();
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
let cashflowCategories = {
  income: [],
  expense: [],
};

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
    list.innerHTML = `<div style="text-align: center; color: #999; padding: 40px 20px;">Chưa có danh mục ${typeLabel} nào</div>`;
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
  if (!confirm("Bạn có chắc muốn xóa loại này?")) return;

  const type = document.getElementById("cashflowCategoryType").value;
  cashflowCategories[type] = cashflowCategories[type].filter(
    (c) => c.id !== id,
  );
  saveCashflowCategoriesToStorage();
  renderCategoryList();
  updateCashflowCategoryDropdowns();
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
let selectedFundColor = "#a855f7";

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

function openFundsModal() {
  closeAllModals();
  const modal = document.getElementById("fundsModal");

  fundsData.totalIncome = calculateTotalIncome();

  modal.style.display = "flex";
  loadFundsOnDemand();
}

function closeFundsModal() {
  document.getElementById("fundsModal").style.display = "none";
}

function renderFundsDashboard() {
  const totalIncome = fundsData.totalIncome || calculateTotalIncome();
  const totalAllocated = calculateTotalAllocated();
  const available = totalIncome - totalAllocated;

  document.getElementById("fundsTotalIncome").innerText =
    `${totalIncome.toLocaleString("vi-VN")} đ`;
  document.getElementById("fundsTotalAllocated").innerText =
    `${totalAllocated.toLocaleString("vi-VN")} đ`;

  const availableEl = document.getElementById("fundsAvailable");
  availableEl.innerText = `${available.toLocaleString("vi-VN")} đ`;
  availableEl.style.color = available < 0 ? "#ef4444" : "#10b981";

  // Update allocate info
  const allocateInfo = document.getElementById("fundsAllocateInfo");
  if (available > 0) {
    allocateInfo.innerText = `Còn ${available.toLocaleString("vi-VN")} đ có thể phân bổ vào các quỹ`;
    allocateInfo.style.color = "#10b981";
  } else {
    allocateInfo.innerText =
      available < 0
        ? `Số dư âm ${Math.abs(available).toLocaleString("vi-VN")} đ - Đã phân bổ vượt thu nhập`
        : "Đã phân bổ hết thu nhập vào các quỹ";
    allocateInfo.style.color = available < 0 ? "#ef4444" : "#f59e0b";
  }

  renderFundsList();
}

function renderFundsList() {
  const listEl = document.getElementById("fundsList");
  listEl.innerHTML = "";

  if (fundsData.funds.length === 0) {
    const empty = document.createElement("div");
    empty.className = "funds-empty";
    empty.innerText = "Chưa có quỹ nào. Nhấn 'Thêm Quỹ' để tạo quỹ đầu tiên.";
    listEl.appendChild(empty);
    return;
  }

  for (const fund of fundsData.funds) {
    const balance = getFundBalance(fund.id);
    const item = document.createElement("div");
    item.className = "fund-item";
    item.innerHTML = `
      <div class="fund-item-color" style="background: ${fund.color}"></div>
      <div class="fund-item-info">
        <div class="fund-item-name">${fund.name}</div>
        <div class="fund-item-balance">Số dư: <span>${balance.toLocaleString("vi-VN")} đ</span></div>
      </div>
      <div class="fund-item-actions">
        <button class="fund-item-btn edit" onclick="editFund('${fund.id}')" title="Sửa">✎</button>
        <button class="fund-item-btn delete" onclick="confirmDeleteFund('${fund.id}')" title="Xóa">×</button>
      </div>
    `;
    listEl.appendChild(item);
  }
}

function openAddFundModal() {
  editingFundId = "";
  document.getElementById("fundModalTitle").innerText = "Thêm Quỹ mới";
  document.getElementById("fundName").value = "";
  selectedFundColor = "#a855f7";

  // Hide initial amount field for new fund
  document.getElementById("fundInitialAmountLabel").style.display = "none";
  document.getElementById("fundInitialAmount").value = "";

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

      fundsData.funds[fundIndex].name = name;
      fundsData.funds[fundIndex].color = selectedFundColor;
      fundsData.funds[fundIndex].initialAmount = newInitialAmount;
      fundsData.funds[fundIndex].updatedAt = Date.now();
    }
  } else {
    // Add new fund
    const newFund = {
      id: `fund-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      color: selectedFundColor,
      initialAmount: 0,
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

  if (
    !confirm(
      `Bạn có chắc muốn xóa quỹ "${fund.name}"? Các khoản đã phân bổ vào quỹ này sẽ không bị mất.`,
    )
  ) {
    return;
  }

  fundsData.funds = fundsData.funds.filter((f) => f.id !== fundId);
  saveFundsToFirebase();
  renderFundsDashboard();
}

function openAllocateModal() {
  const totalIncome = fundsData.totalIncome || calculateTotalIncome();
  const totalAllocated = calculateTotalAllocated();
  const available = totalIncome - totalAllocated;

  if (fundsData.funds.length === 0) {
    alert("Bạn cần tạo ít nhất một quỹ trước khi phân bổ.");
    return;
  }

  const availableEl = document.getElementById("allocateAvailableAmount");
  availableEl.innerText = `${available.toLocaleString("vi-VN")} đ`;
  availableEl.style.color = available < 0 ? "#ef4444" : "#10b981";

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

  if (!fundId) {
    alert("Vui lòng chọn một quỹ");
    return;
  }

  if (amount <= 0) {
    alert("Vui lòng nhập số tiền lớn hơn 0");
    return;
  }

  const totalIncome = fundsData.totalIncome || calculateTotalIncome();
  const totalAllocated = calculateTotalAllocated();
  const available = totalIncome - totalAllocated;

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

  // Update UI
  amountInput.value = "";
  renderAllocateHistory();
  renderFundsDashboard();

  alert(`Đã phân bổ ${amount.toLocaleString("vi-VN")} đ vào quỹ thành công!`);
}

function renderAllocateHistory() {
  const listEl = document.getElementById("allocateHistoryList");
  listEl.innerHTML = "";

  if (fundsData.allocations.length === 0) {
    const empty = document.createElement("div");
    empty.className = "allocate-empty";
    empty.innerText = "Chưa có phân bổ nào";
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

// Initialize allocate amount input formatting
(function initAllocateInput() {
  const amountInput = document.getElementById("allocateAmount");
  if (!amountInput) return;

  amountInput.addEventListener("input", () => {
    formatCurrencyInput(amountInput);
  });
})();

// Initialize fund initial amount input formatting
(function initFundInitialAmountInput() {
  const amountInput = document.getElementById("fundInitialAmount");
  if (!amountInput) return;

  amountInput.addEventListener("input", () => {
    formatCurrencyInput(amountInput);
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
  todayLunar: false
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

// Lazy load trigger functions
function loadCalendarOnDemand() {
  if (LAZY_LOAD.calendar) return;
  showSkeleton('calendarSkeleton');
  LAZY_LOAD.calendar = true;
  renderCalendar();
  hideSkeleton('calendarSkeleton');
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
  showSkeleton('quicknotesSkeleton');
  LAZY_LOAD.quickNotes = true;
  renderQuickNotes();
  hideSkeleton('quicknotesSkeleton');
}

function loadMyMusicOnDemand() {
  if (LAZY_LOAD.myMusic) return;
  LAZY_LOAD.myMusic = true;
  initMyMusicPlayer();
}

function loadCashflowOnDemand() {
  if (LAZY_LOAD.cashflow) return;
  showSkeleton('cashflowSkeleton');
  LAZY_LOAD.cashflow = true;
  renderCashflowDashboard();
  hideSkeleton('cashflowSkeleton');
}

function loadFundsOnDemand() {
  if (LAZY_LOAD.funds) return;
  showSkeleton('fundsSkeleton');
  LAZY_LOAD.funds = true;
  renderFundsDashboard();
  hideSkeleton('fundsSkeleton');
}

function loadGoldOnDemand() {
  if (LAZY_LOAD.gold) return;
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
  LAZY_LOAD.translate = true;
}

function loadProjectsOnDemand() {
  if (LAZY_LOAD.projects) return;
  showSkeleton('projectsSkeleton');
  LAZY_LOAD.projects = true;
  renderProjectsList();
  hideSkeleton('projectsSkeleton');
}

function loadProfileOnDemand() {
  if (LAZY_LOAD.profile) return;
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
  // Step 1: Render UI immediately (no waiting)
  applyStoredToolboxState();
  initToolboxAutoCollapse();
  initQuickNoteModal();
  renderToday();
  
  // Step 2: Initialize Firebase in background (non-blocking)
  initFirebaseServices().catch(err => {
    console.error("[Init] Firebase error:", err);
  });
  
  // Step 3: Load essential items on demand (when user interacts)
  // These will be triggered by user actions, not upfront
  
  // Step 4: Load weather data in background (low priority)
  setTimeout(() => loadWeatherOnDemand(), 1000);
  
  // Step 5: Load quote in background
  setTimeout(() => loadQuoteOnDemand(), 500);
  
  // Step 6: Load countdown in background
  setTimeout(() => loadCountdownOnDemand(), 800);
  
  // Step 7: Load lunar calendar in background
  setTimeout(() => loadTodayLunarOnDemand(), 600);
  
  // Step 8: Calendar loads on first interaction
  // User must click calendar tab to trigger renderCalendar()
  
  console.log("[Init] App started - content loads on demand");
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
      } catch (e) {}
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

// Vocabulary data for business English
const VOCABULARY_DATA = {
  // Existing categories with expanded words
  email: [
    {
      word: "attachment",
      phonetic: "/əˈtætʃmənt/",
      meaning: "Tệp đính kèm",
      example: "Please find the attachment.",
      exampleVi: "Vui lòng xem tệp đính kèm.",
    },
    {
      word: "forward",
      phonetic: "/fɔːˈwɑːrd/",
      meaning: "Chuyển tiếp",
      example: "I'll forward this to the team.",
      exampleVi: "Tôi sẽ chuyển tiếp điều này cho nhóm.",
    },
    {
      word: "cc (carbon copy)",
      phonetic: "/siː siː/",
      meaning: "Gửi chồng",
      example: "Please cc the manager.",
      exampleVi: "Vui lòng gửi chồng cho quản lý.",
    },
    {
      word: "follow up",
      phonetic: "/ˈfɑːloʊ ʌp/",
      meaning: "Theo dõi, nhắc nhở",
      example: "I need to follow up on this email.",
      exampleVi: "Tôi cần theo dõi email này.",
    },
    {
      word: "deadline",
      phonetic: "/ˈdedlaɪn/",
      meaning: "Thời hạn cuối cùng",
      example: "The deadline is Friday.",
      exampleVi: "Thời hạn là thứ Sáu.",
    },
    {
      word: "recipient",
      phonetic: "/rɪˈsɪpiənt/",
      meaning: "Người nhận",
      example: "The recipient has confirmed receipt.",
      exampleVi: "Người nhận đã xác nhận đã nhận được.",
    },
    {
      word: "subject line",
      phonetic: "/ˈsʌbdʒekt laɪn/",
      meaning: "Dòng tiêu đề",
      example: "Use a clear subject line.",
      exampleVi: "Sử dụng dòng tiêu đề rõ ràng.",
    },
    {
      word: "draft",
      phonetic: "/dræft/",
      meaning: "Bản nháp",
      example: "I'll save it as a draft.",
      exampleVi: "Tôi sẽ lưu nó thành bản nháp.",
    },
    {
      word: "acknowledge",
      phonetic: "/əkˈnɒlɪdʒ/",
      meaning: "Xác nhận đã nhận",
      example: "Please acknowledge receipt.",
      exampleVi: "Vui lòng xác nhận đã nhận được.",
    },
    {
      word: "urgent",
      phonetic: "/ˈɜːrdʒənt/",
      meaning: "Khẩn cấp",
      example: "This is urgent, please respond ASAP.",
      exampleVi: "Đây là khẩn cấp, vui lòng phản hồi sớm nhất có thể.",
    },
    {
      word: "bcc",
      phonetic: "/biː siː siː/",
      meaning: "Gửi ẩn",
      example: "Please bcc the legal team.",
      exampleVi: "Vui lòng gửi ẩn cho pháp lý.",
    },
    {
      word: "reply all",
      phonetic: "/rɪˈplaɪ ɔːl/",
      meaning: "Trả lời tất cả",
      example: "Please don't reply all.",
      exampleVi: "Vui lòng không trả lời tất cả.",
    },
    {
      word: "thread",
      phonetic: "/θred/",
      meaning: "Chuỗi email",
      example: "Check the email thread for context.",
      exampleVi: "Kiểm tra chuỗi email để hiểu ngữ cảnh.",
    },
    {
      word: "flag",
      phonetic: "/flæɡ/",
      meaning: "Đánh dấu",
      example: "I'll flag this for follow-up.",
      exampleVi: "Tôi sẽ đánh dấu điều này để theo dõi.",
    },
    {
      word: "archive",
      phonetic: "/ˈɑːrkaɪv/",
      meaning: "Lưu trữ",
      example: "Archive emails you don't need.",
      exampleVi: "Lưu trữ những email bạn không cần.",
    },
    {
      word: "inbox",
      phonetic: "/ˈɪnbɒks/",
      meaning: "Hộp thư đến",
      example: "My inbox is full.",
      exampleVi: "Hộp thư đến của tôi đầy.",
    },
    {
      word: "sent",
      phonetic: "/sent/",
      meaning: "Đã gửi",
      example: "Check your sent folder.",
      exampleVi: "Kiểm tra thư mục đã gửi.",
    },
    {
      word: "compose",
      phonetic: "/kəmˈpoʊz/",
      meaning: "Soạn email",
      example: "Compose a new email.",
      exampleVi: "Soạn một email mới.",
    },
  ],
  meeting: [
    {
      word: "agenda",
      phonetic: "/əˈdʒendə/",
      meaning: "Chương trình cuộc họp",
      example: "Let's review the agenda.",
      exampleVi: "Hãy xem lại chương trình họp.",
    },
    {
      word: "minutes",
      phonetic: "/ˈmɪnɪts/",
      meaning: "Biên bản cuộc họp",
      example: "I'll take the minutes.",
      exampleVi: "Tôi sẽ ghi biên bản.",
    },
    {
      word: "adjourn",
      phonetic: "/əˈdʒɜːrn/",
      meaning: "Hoãn, tạm ngưng",
      example: "Let's adjourn the meeting.",
      exampleVi: "Hãy hoãn cuộc họp lại.",
    },
    {
      word: "consensus",
      phonetic: "/kənˈsensəs/",
      meaning: "Sự đồng thuận",
      example: "We reached a consensus.",
      exampleVi: "Chúng tôi đạt được sự đồng thuận.",
    },
    {
      word: "action items",
      phonetic: "/ˈækʃn ˈaɪtəmz/",
      meaning: "Việc cần làm",
      example: "Let's list the action items.",
      exampleVi: "Hãy liệt kê những việc cần làm.",
    },
    {
      word: "brainstorm",
      phonetic: "/ˈbreɪnstɔːrm/",
      meaning: "Động não, brainstorm",
      example: "Let's brainstorm some ideas.",
      exampleVi: "Hãy cùng động não các ý tưởng.",
    },
    {
      word: "stakeholder",
      phonetic: "/ˈsteɪkhoʊldər/",
      meaning: "Bên liên quan",
      example: "We need stakeholder buy-in.",
      exampleVi: "Chúng tôi cần sự ủng hộ từ các bên liên quan.",
    },
    {
      word: "logistics",
      phonetic: "/ləˈdʒɪstɪks/",
      meaning: "Hậu cần, logistics",
      example: "Let's discuss the logistics.",
      exampleVi: "Hãy thảo luận về hậu cần.",
    },
    {
      word: "quorum",
      phonetic: "/ˈkwɔːrəm/",
      meaning: "Số người tối thiểu",
      example: "We have quorum to proceed.",
      exampleVi: "Chúng ta đủ số người để tiến hành.",
    },
    {
      word: "virtual meeting",
      phonetic: "/ˈvɜːrtʃuəl ˈmiːtɪŋ/",
      meaning: "Họp trực tuyến",
      example: "Join the virtual meeting at 3 PM.",
      exampleVi: "Tham gia cuộc họp trực tuyến lúc 3 giờ chiều.",
    },
    {
      word: "conference call",
      phonetic: "/ˈkɒnfərəns kɔːl/",
      meaning: "Hội nghị gọi điện",
      example: "Set up a conference call.",
      exampleVi: "Thiết lập một hội nghị gọi điện.",
    },
    {
      word: "agenda item",
      phonetic: "/əˈdʒendə ˈaɪtəm/",
      meaning: "Mục trong chương trình",
      example: "Let's move to the next agenda item.",
      exampleVi: "Hãy chuyển sang mục tiếp theo trong chương trình.",
    },
    {
      word: "recap",
      phonetic: "/ˈriːkæp/",
      meaning: "Tóm tắt lại",
      example: "Let me give you a quick recap.",
      exampleVi: "Để tôi tóm tắt nhanh cho bạn.",
    },
    {
      word: "wrap up",
      phonetic: "/ræp ʌp/",
      meaning: "Kết thúc",
      example: "Let's wrap up this discussion.",
      exampleVi: "Hãy kết thúc cuộc thảo luận này.",
    },
    {
      word: "timekeeper",
      phonetic: "/ˈtaɪmkiːpər/",
      meaning: "Người giữ thời gian",
      example: "Who will be the timekeeper?",
      exampleVi: "Ai sẽ là người giữ thời gian?",
    },
    {
      word: "facilitator",
      phonetic: "/fəˈsɪlɪteɪtər/",
      meaning: "Người điều phối",
      example: "The facilitator will guide us.",
      exampleVi: "Người điều phối sẽ hướng dẫn chúng ta.",
    },
    {
      word: "propose",
      phonetic: "/prəˈpoʊz/",
      meaning: "Đề xuất",
      example: "I propose we take a vote.",
      exampleVi: "Tôi đề xuất chúng ta bỏ phiếu.",
    },
    {
      word: "veto",
      phonetic: "/ˈviːtoʊ/",
      meaning: "Phủ quyết",
      example: "The manager has veto power.",
      exampleVi: "Quản lý có quyền phủ quyết.",
    },
  ],
  presentation: [
    {
      word: "delegate",
      phonetic: "/ˈdelɪɡeɪt/",
      meaning: "Ủy quyền, đại diện",
      example: "I need to delegate this task.",
      exampleVi: "Tôi cần ủy quyền công việc này.",
    },
    {
      word: "stakeholder",
      phonetic: "/ˈsteɪkhoʊldər/",
      meaning: "Bên liên quan",
      example: "We need stakeholder approval.",
      exampleVi: "Chúng tôi cần sự chấp thuận của các bên liên quan.",
    },
    {
      word: "metrics",
      phonetic: "/ˈmetrɪks/",
      meaning: "Chỉ số đo lường",
      example: "Let's review the key metrics.",
      exampleVi: "Hãy xem lại các chỉ số chính.",
    },
    {
      word: "insights",
      phonetic: "/ˈɪnsaɪts/",
      meaning: "Nhận định, hiểu biết",
      example: "This gives us valuable insights.",
      exampleVi: "Điều này mang lại những nhận định giá trị.",
    },
    {
      word: "benchmark",
      phonetic: "/ˈbentʃmɑːrk/",
      meaning: "Mốc chuẩn, tiêu chuẩn",
      example: "We need to set a benchmark.",
      exampleVi: "Chúng tôi cần đặt ra một mốc chuẩn.",
    },
    {
      word: "slide deck",
      phonetic: "/slaɪd dek/",
      meaning: "Bộ trình chiếu",
      example: "I'll send the slide deck tomorrow.",
      exampleVi: "Tôi sẽ gửi bộ trình chiếu vào ngày mai.",
    },
    {
      word: "takeaway",
      phonetic: "/ˈteɪkəweɪ/",
      meaning: "Điểm chính rút ra",
      example: "Here are the key takeaways.",
      exampleVi: "Đây là những điểm chính cần nhớ.",
    },
    {
      word: "visuals",
      phonetic: "/ˈvɪʒuəlz/",
      meaning: "Hình ảnh trực quan",
      example: "Let's add more visuals.",
      exampleVi: "Hãy thêm nhiều hình ảnh trực quan hơn.",
    },
    {
      word: "rehearse",
      phonetic: "/rɪˈhɜːrs/",
      meaning: "Tập dượt",
      example: "We need to rehearse the presentation.",
      exampleVi: "Chúng ta cần tập dượt bài thuyết trình.",
    },
    {
      word: "deliver",
      phonetic: "/dɪˈlɪvər/",
      meaning: "Trình bày, thuyết trình",
      example: "She will deliver the presentation.",
      exampleVi: "Cô ấy sẽ trình bày bài thuyết trình.",
    },
    {
      word: "Q&A",
      phonetic: "/kjuː ənd ˈeɪ/",
      meaning: "Hỏi và đáp",
      example: "We'll have Q&A at the end.",
      exampleVi: "Chúng ta sẽ có phần hỏi và đáp vào cuối.",
    },
    {
      word: "handout",
      phonetic: "/ˈhændaʊt/",
      meaning: "Tài liệu phát",
      example: "Please distribute the handouts.",
      exampleVi: "Vui lòng phát tài liệu.",
    },
    {
      word: "infographic",
      phonetic: "/ˈɪnfoʊɡræfɪk/",
      meaning: "Đồ họa thông tin",
      example: "Use an infographic for this data.",
      exampleVi: "Sử dụng đồ họa thông tin cho dữ liệu này.",
    },
    {
      word: "bullet points",
      phonetic: "/ˈbʊlɪt pɔɪnts/",
      meaning: "Dấu đầu dòng",
      example: "Keep it to 5 bullet points max.",
      exampleVi: "Giới hạn tối đa 5 dấu đầu dòng.",
    },
    {
      word: "flowchart",
      phonetic: "/ˈfloʊtʃɑːrt/",
      meaning: "Sơ đồ quy trình",
      example: "Add a flowchart for clarity.",
      exampleVi: "Thêm sơ đồ quy trình để rõ ràng.",
    },
    {
      word: "pie chart",
      phonetic: "/paɪ tʃɑːrt/",
      meaning: "Biểu đồ tròn",
      example: "The pie chart shows market share.",
      exampleVi: "Biểu đồ tròn cho thấy thị phần.",
    },
    {
      word: "bar graph",
      phonetic: "/bɑːr ɡræf/",
      meaning: "Biểu đồ cột",
      example: "Use a bar graph for comparison.",
      exampleVi: "Sử dụng biểu đồ cột để so sánh.",
    },
    {
      word: "highlight",
      phonetic: "/ˈhaɪlaɪt/",
      meaning: "Nhấn mạnh",
      example: "Let me highlight the key points.",
      exampleVi: "Để tôi nhấn mạnh các điểm chính.",
    },
  ],
  negotiation: [
    {
      word: "proposal",
      phonetic: "/prəˈpoʊzl/",
      meaning: "Đề xuất",
      example: "I'll prepare a proposal.",
      exampleVi: "Tôi sẽ chuẩn bị một đề xuất.",
    },
    {
      word: "compromise",
      phonetic: "/ˈkɑːmprəmaɪz/",
      meaning: "Thỏa hiệp, nhượng bộ",
      example: "We need to find a compromise.",
      exampleVi: "Chúng tôi cần tìm một giải pháp thỏa hiệp.",
    },
    {
      word: "terms",
      phonetic: "/tɜːrmz/",
      meaning: "Điều khoản",
      example: "These are the agreed terms.",
      exampleVi: "Đây là những điều khoản đã thống nhất.",
    },
    {
      word: "leverage",
      phonetic: "/ˈlevərɪdʒ/",
      meaning: "Lợi thế, ảnh hưởng",
      example: "We have leverage in this negotiation.",
      exampleVi: "Chúng tôi có lợi thế trong cuộc đàm phán này.",
    },
    {
      word: "mutual benefit",
      phonetic: "/ˈmjuːtʃuəl ˈbenɪfɪt/",
      meaning: "Lợi ích chung",
      example: "This is for mutual benefit.",
      exampleVi: "Đây là vì lợi ích chung.",
    },
    {
      word: "counteroffer",
      phonetic: "/ˈkaʊntərˌɔːrfər/",
      meaning: "Phản đề xuất",
      example: "We received a counteroffer.",
      exampleVi: "Chúng tôi nhận được một phản đề xuất.",
    },
    {
      word: "concession",
      phonetic: "/kənˈseʃn/",
      meaning: "Nhượng bộ",
      example: "Make a small concession.",
      exampleVi: "Hãy đưa ra một chút nhượng bộ.",
    },
    {
      word: "deadlock",
      phonetic: "/ˈdedlɒk/",
      meaning: "Bế tắc",
      example: "We reached a deadlock.",
      exampleVi: "Chúng tôi đã đi đến bế tắc.",
    },
    {
      word: "win-win",
      phonetic: "/wɪn wɪn/",
      meaning: "Cùng có lợi",
      example: "Let's find a win-win solution.",
      exampleVi: "Hãy tìm giải pháp mà cả hai đều có lợi.",
    },
    {
      word: "sign off",
      phonetic: "/saɪn ɒf/",
      meaning: "Phê duyệt, đồng ý",
      example: "Let's sign off on this deal.",
      exampleVi: "Hãy đồng ý ký kết thỏa thuận này.",
    },
    {
      word: "bid",
      phonetic: "/bɪd/",
      meaning: "Giá thầu",
      example: "Submit your bid by Friday.",
      exampleVi: "Nộp giá thầu trước thứ Sáu.",
    },
    {
      word: "renegotiate",
      phonetic: "/ˌriːnɪˈɡoʊʃieɪt/",
      meaning: "Đàm phán lại",
      example: "We need to renegotiate the terms.",
      exampleVi: "Chúng tôi cần đàm phán lại các điều khoản.",
    },
    {
      word: "contract",
      phonetic: "/ˈkɒntrækt/",
      meaning: "Hợp đồng",
      example: "Review the contract carefully.",
      exampleVi: "Xem xét hợp đồng cẩn thận.",
    },
    {
      word: "clause",
      phonetic: "/klɔːz/",
      meaning: "Điều khoản, điều khoản",
      example: "Check the termination clause.",
      exampleVi: "Kiểm tra điều khoản chấm dứt.",
    },
    {
      word: "ratify",
      phonetic: "/ˈrætɪfaɪ/",
      meaning: "Phê chuẩn",
      example: "The board will ratify the agreement.",
      exampleVi: "Hội đồng sẽ phê chuẩn thỏa thuận.",
    },
    {
      word: "arbitration",
      phonetic: "/ˌɑːrbɪˈtreɪʃn/",
      meaning: "Trọng tài",
      example: "We prefer arbitration over litigation.",
      exampleVi: "Chúng tôi thích trọng tài hơn kiện tụng.",
    },
    {
      word: "guarantee",
      phonetic: "/ˌɡærənˈtiː/",
      meaning: "Bảo đảm",
      example: "We offer a money-back guarantee.",
      exampleVi: "Chúng tôi cung cấp bảo đảm hoàn tiền.",
    },
    {
      word: "deposit",
      phonetic: "/dɪˈpɒzɪt/",
      meaning: "Tiền đặt cọc",
      example: "A 10% deposit is required.",
      exampleVi: "Yêu cầu đặt cọc 10%.",
    },
  ],
  report: [
    {
      word: "quarterly",
      phonetic: "/ˈkwɔːrtərli/",
      meaning: "Hàng quý",
      example: "The quarterly report is ready.",
      exampleVi: "Báo cáo quý đã sẵn sàng.",
    },
    {
      word: "revenue",
      phonetic: "/ˈrevənuː/",
      meaning: "Doanh thu",
      example: "Revenue increased by 15%.",
      exampleVi: "Doanh thu tăng 15%.",
    },
    {
      word: "expense",
      phonetic: "/ɪkˈspens/",
      meaning: "Chi phí",
      example: "We need to cut expenses.",
      exampleVi: "Chúng tôi cần cắt giảm chi phí.",
    },
    {
      word: "forecast",
      phonetic: "/ˈfɔːrkæst/",
      meaning: "Dự báo",
      example: "Sales forecast looks promising.",
      exampleVi: "Dự báo doanh số rất khả quan.",
    },
    {
      word: "ROI (Return on Investment)",
      phonetic: "/ˌɑːr oʊ ˈaɪ/",
      meaning: "Lợi tức đầu tư",
      example: "What's the expected ROI?",
      exampleVi: "Lợi tức đầu tư dự kiến là bao nhiêu?",
    },
    {
      word: "KPI",
      phonetic: "/keɪ piː aɪ/",
      meaning: "Chỉ số hiệu suất",
      example: "We need to track our KPIs.",
      exampleVi: "Chúng tôi cần theo dõi các chỉ số hiệu suất.",
    },
    {
      word: "bottom line",
      phonetic: "/ˈbɒtəm laɪn/",
      meaning: "Kết quả cuối cùng",
      example: "What's the bottom line?",
      exampleVi: "Kết quả cuối cùng là gì?",
    },
    {
      word: "breakdown",
      phonetic: "/ˈbreɪkdaʊn/",
      meaning: "Phân tích chi tiết",
      example: "Here's a breakdown of costs.",
      exampleVi: "Đây là phân tích chi tiết về chi phí.",
    },
    {
      word: "snapshot",
      phonetic: "/ˈsnæpʃɒt/",
      meaning: "Bức tranh tổng quan",
      example: "This is a snapshot of Q3 performance.",
      exampleVi: "Đây là bức tranh tổng quan về hiệu suất Q3.",
    },
    {
      word: "trend",
      phonetic: "/trend/",
      meaning: "Xu hướng",
      example: "The trend is upward.",
      exampleVi: "Xu hướng đang tăng lên.",
    },
    {
      word: "margin",
      phonetic: "/ˈmɑːrdʒɪn/",
      meaning: "Biên lợi nhuận",
      example: "Our profit margin improved.",
      exampleVi: "Biên lợi nhuận của chúng tôi đã cải thiện.",
    },
    {
      word: "overhead",
      phonetic: "/ˈoʊvərhed/",
      meaning: "Chi phí gián tiếp",
      example: "Cut overhead costs.",
      exampleVi: "Cắt giảm chi phí gián tiếp.",
    },
    {
      word: "assets",
      phonetic: "/ˈæsets/",
      meaning: "Tài sản",
      example: "Total assets exceed liabilities.",
      exampleVi: "Tổng tài sản vượt quá nợ phải trả.",
    },
    {
      word: "equity",
      phonetic: "/ˈekwəti/",
      meaning: "Vốn chủ sở hữu",
      example: "Maintain equity ratio.",
      exampleVi: "Duy trì tỷ lệ vốn chủ sở hữu.",
    },
    {
      word: "deficit",
      phonetic: "/ˈdefɪsɪt/",
      meaning: "Thâm hụt",
      example: "We have a budget deficit.",
      exampleVi: "Chúng tôi có thâm hụt ngân sách.",
    },
    {
      word: "surplus",
      phonetic: "/ˈsɜːrpləs/",
      meaning: "Thặng dư",
      example: "We have a budget surplus.",
      exampleVi: "Chúng tôi có thặng dư ngân sách.",
    },
    {
      word: "fiscal year",
      phonetic: "/ˈfɪskl jɪr/",
      meaning: "Năm tài chính",
      example: "Our fiscal year ends in December.",
      exampleVi: "Năm tài chính của chúng tôi kết thúc vào tháng 12.",
    },
    {
      word: "amortize",
      phonetic: "/ˈæmərtaɪz/",
      meaning: "Khấu hao",
      example: "We amortize equipment over 5 years.",
      exampleVi: "Chúng tôi khấu hao thiết bị trong 5 năm.",
    },
  ],
  marketing: [
    {
      word: "campaign",
      phonetic: "/kæmˈpeɪn/",
      meaning: "Chiến dịch",
      example: "Launch the marketing campaign.",
      exampleVi: "Khởi động chiến dịch marketing.",
    },
    {
      word: "target audience",
      phonetic: "/ˈtɑːrɡɪt ˈɔːdiəns/",
      meaning: "Đối tượng mục tiêu",
      example: "Identify the target audience.",
      exampleVi: "Xác định đối tượng mục tiêu.",
    },
    {
      word: "engagement",
      phonetic: "/ɪnˈɡeɪdʒmənt/",
      meaning: "Mức độ tương tác",
      example: "Increase user engagement.",
      exampleVi: "Tăng mức độ tương tác của người dùng.",
    },
    {
      word: "conversion",
      phonetic: "/kənˈvɜːrʒn/",
      meaning: "Tỷ lệ chuyển đổi",
      example: "Our conversion rate improved.",
      exampleVi: "Tỷ lệ chuyển đổi của chúng tôi đã cải thiện.",
    },
    {
      word: "brand awareness",
      phonetic: "/brænd əˈwerərnəs/",
      meaning: "Nhận diện thương hiệu",
      example: "We need to build brand awareness.",
      exampleVi: "Chúng tôi cần xây dựng nhận diện thương hiệu.",
    },
    {
      word: "lead generation",
      phonetic: "/liːd ˌdʒenəˈreɪʃn/",
      meaning: "Tạo khách hàng tiềm năng",
      example: "Focus on lead generation.",
      exampleVi: "Tập trung vào tạo khách hàng tiềm năng.",
    },
    {
      word: "viral",
      phonetic: "/ˈvaɪrəl/",
      meaning: "Lan truyền",
      example: "The content went viral.",
      exampleVi: "Nội dung đã lan truyền.",
    },
    {
      word: "call to action",
      phonetic: "/kɔːl tuː ˈækʃn/",
      meaning: "Lời kêu gọi hành động",
      example: "Add a clear call to action.",
      exampleVi: "Thêm lời kêu gọi hành động rõ ràng.",
    },
    {
      word: "analytics",
      phonetic: "/ˌænəˈlɪtɪks/",
      meaning: "Phân tích dữ liệu",
      example: "Check the analytics dashboard.",
      exampleVi: "Kiểm tra bảng phân tích dữ liệu.",
    },
    {
      word: "outreach",
      phonetic: "/ˈaʊtriːtʃ/",
      meaning: "Tiếp cận, mở rộng",
      example: "Our outreach efforts are working.",
      exampleVi: "Nỗ lực tiếp cận của chúng tôi đang hiệu quả.",
    },
    {
      word: "segmentation",
      phonetic: "/ˌseɡmenˈteɪʃn/",
      meaning: "Phân khúc thị trường",
      example: "Market segmentation is key.",
      exampleVi: "Phân khúc thị trường là chìa khóa.",
    },
    {
      word: "demographics",
      phonetic: "/ˌdeməˈɡræfɪks/",
      meaning: "Nhân khẩu học",
      example: "Analyze demographics data.",
      exampleVi: "Phân tích dữ liệu nhân khẩu học.",
    },
    {
      word: "impressions",
      phonetic: "/ɪmˈpreʃnz/",
      meaning: "Số lần hiển thị",
      example: "We got 10,000 impressions.",
      exampleVi: "Chúng tôi có 10.000 lần hiển thị.",
    },
    {
      word: "click-through rate",
      phonetic: "/klɪk θruː reɪt/",
      meaning: "Tỷ lệ nhấp chuột",
      example: "Improve your click-through rate.",
      exampleVi: "Cải thiện tỷ lệ nhấp chuột.",
    },
    {
      word: "bounce rate",
      phonetic: "/baʊns reɪt/",
      meaning: "Tỷ lệ thoát",
      example: "Reduce the bounce rate.",
      exampleVi: "Giảm tỷ lệ thoát.",
    },
    {
      word: "SEO",
      phonetic: "/ˌes iː ˈoʊ/",
      meaning: "Tối ưu hóa tìm kiếm",
      example: "Invest in SEO.",
      exampleVi: "Đầu tư vào SEO.",
    },
    {
      word: "PPC",
      phonetic: "/piː piː siː/",
      meaning: "Quảng cáo trả tiền",
      example: "Run a PPC campaign.",
      exampleVi: "Chạy chiến dịch quảng cáo trả tiền.",
    },
    {
      word: "affiliate",
      phonetic: "/əˈfɪlieɪt/",
      meaning: "Liên kết tiếp thị",
      example: "Start an affiliate program.",
      exampleVi: "Bắt đầu chương trình liên kết.",
    },
  ],
  it: [
    {
      word: "deploy",
      phonetic: "/dɪˈplɔɪ/",
      meaning: "Triển khai",
      example: "We will deploy the update tonight.",
      exampleVi: "Chúng tôi sẽ triển khai bản cập nhật vào tối nay.",
    },
    {
      word: "debug",
      phonetic: "/diːˈbʌɡ/",
      meaning: "Gỡ lỗi",
      example: "I need to debug this code.",
      exampleVi: "Tôi cần gỡ lỗi đoạn code này.",
    },
    {
      word: "scalability",
      phonetic: "/ˌskeɪləˈbɪləti/",
      meaning: "Khả năng mở rộng",
      example: "Check the scalability of the system.",
      exampleVi: "Kiểm tra khả năng mở rộng của hệ thống.",
    },
    {
      word: "infrastructure",
      phonetic: "/ˈɪnfrəstrʌktʃər/",
      meaning: "Hạ tầng",
      example: "Upgrade the infrastructure.",
      exampleVi: "Nâng cấp hạ tầng.",
    },
    {
      word: "backup",
      phonetic: "/ˈbækʌp/",
      meaning: "Sao lưu",
      example: "Create a backup before updating.",
      exampleVi: "Tạo bản sao lưu trước khi cập nhật.",
    },
    {
      word: "server",
      phonetic: "/ˈsɜːrvər/",
      meaning: "Máy chủ",
      example: "The server is down.",
      exampleVi: "Máy chủ đang gặp sự cố.",
    },
    {
      word: "firewall",
      phonetic: "/ˈfaɪərwɔːl/",
      meaning: "Tường lửa",
      example: "Configure the firewall settings.",
      exampleVi: "Cấu hình cài đặt tường lửa.",
    },
    {
      word: "bandwidth",
      phonetic: "/ˈbændwɪdθ/",
      meaning: "Băng thông",
      example: "We need more bandwidth.",
      exampleVi: "Chúng tôi cần thêm băng thông.",
    },
    {
      word: "latency",
      phonetic: "/ˈleɪtənsi/",
      meaning: "Độ trễ",
      example: "Reduce the latency.",
      exampleVi: "Giảm độ trễ.",
    },
    {
      word: "encryption",
      phonetic: "/ɪnˈkrɪpʃn/",
      meaning: "Mã hóa",
      example: "Use strong encryption.",
      exampleVi: "Sử dụng mã hóa mạnh.",
    },
    {
      word: "API",
      phonetic: "/eɪ piː aɪ/",
      meaning: "Giao diện lập trình",
      example: "Use our API.",
      exampleVi: "Sử dụng API của chúng tôi.",
    },
    {
      word: "database",
      phonetic: "/ˈdeɪtəbeɪs/",
      meaning: "Cơ sở dữ liệu",
      example: "Query the database.",
      exampleVi: "Truy vấn cơ sở dữ liệu.",
    },
    {
      word: "cloud",
      phonetic: "/klaʊd/",
      meaning: "Đám mây",
      example: "Move to the cloud.",
      exampleVi: "Chuyển lên đám mây.",
    },
    {
      word: "integration",
      phonetic: "/ˌɪntɪˈɡreɪʃn/",
      meaning: "Tích hợp",
      example: "Complete the integration.",
      exampleVi: "Hoàn thành tích hợp.",
    },
    {
      word: "migration",
      phonetic: "/maɪˈɡreɪʃn/",
      meaning: "Di chuyển, chuyển đổi",
      example: "Plan the data migration.",
      exampleVi: "Lên kế hoạch di chuyển dữ liệu.",
    },
    {
      word: "repository",
      phonetic: "/rɪˈpɒzətɔːri/",
      meaning: "Kho lưu trữ",
      example: "Push to the repository.",
      exampleVi: "Đẩy lên kho lưu trữ.",
    },
    {
      word: "version control",
      phonetic: "/ˈvɜːrʒn kənˈtroʊl/",
      meaning: "Kiểm soát phiên bản",
      example: "Use version control.",
      exampleVi: "Sử dụng kiểm soát phiên bản.",
    },
    {
      word: "agile",
      phonetic: "/ˈædʒaɪl/",
      meaning: "Phương pháp linh hoạt",
      example: "Follow agile methodology.",
      exampleVi: "Tuân theo phương pháp linh hoạt.",
    },
  ],
  finance: [
    {
      word: "invoice",
      phonetic: "/ˈɪnvɔɪs/",
      meaning: "Hóa đơn",
      example: "Send the invoice to the client.",
      exampleVi: "Gửi hóa đơn cho khách hàng.",
    },
    {
      word: "balance sheet",
      phonetic: "/ˈbæləns ʃiːt/",
      meaning: "Bảng cân đối kế toán",
      example: "Review the balance sheet.",
      exampleVi: "Xem lại bảng cân đối kế toán.",
    },
    {
      word: "cash flow",
      phonetic: "/kæʃ floʊ/",
      meaning: "Dòng tiền",
      example: "Manage the cash flow carefully.",
      exampleVi: "Quản lý dòng tiền cẩn thận.",
    },
    {
      word: "asset",
      phonetic: "/ˈæset/",
      meaning: "Tài sản",
      example: "List all company assets.",
      exampleVi: "Liệt kê tất cả tài sản công ty.",
    },
    {
      word: "liability",
      phonetic: "/ˌlaɪəˈbɪləti/",
      meaning: "Nợ phải trả",
      example: "Reduce company liabilities.",
      exampleVi: "Giảm nợ phải trả của công ty.",
    },
    {
      word: "budget",
      phonetic: "/ˈbʌdʒɪt/",
      meaning: "Ngân sách",
      example: "Stay within budget.",
      exampleVi: "Giữ trong ngân sách.",
    },
    {
      word: "audit",
      phonetic: "/ˈɔːdɪt/",
      meaning: "Kiểm toán",
      example: "Schedule an external audit.",
      exampleVi: "Lên lịch kiểm toán bên ngoài.",
    },
    {
      word: "equity",
      phonetic: "/ˈekwəti/",
      meaning: "Vốn chủ sở hữu",
      example: "Maintain equity ratio.",
      exampleVi: "Duy trì tỷ lệ vốn chủ sở hữu.",
    },
    {
      word: "depreciation",
      phonetic: "/ˌdiːpriːʃiˈeɪʃn/",
      meaning: "Khấu hao",
      example: "Calculate depreciation.",
      exampleVi: "Tính khấu hao.",
    },
    {
      word: "amortization",
      phonetic: "/ˌæmərtɪˈzeɪʃn/",
      meaning: "Trả góp, khấu hao",
      example: "Record amortization expense.",
      exampleVi: "Ghi nhận chi phí khấu hao.",
    },
    {
      word: "dividend",
      phonetic: "/ˈdɪvɪdend/",
      meaning: "Cổ tức",
      example: "The company declared a dividend.",
      exampleVi: "Công ty đã công bố cổ tức.",
    },
    {
      word: "collateral",
      phonetic: "/kəˈlætərəl/",
      meaning: "Tài sản thế chấp",
      example: "Use property as collateral.",
      exampleVi: "Sử dụng tài sản làm thế chấp.",
    },
    {
      word: "interest rate",
      phonetic: "/ˈɪntrəst reɪt/",
      meaning: "Lãi suất",
      example: "The interest rate increased.",
      exampleVi: "Lãi suất đã tăng.",
    },
    {
      word: "principal",
      phonetic: "/ˈprɪnsəpl/",
      meaning: "Vốn gốc",
      example: "Repay the principal.",
      exampleVi: "Trả vốn gốc.",
    },
    {
      word: "fiscal",
      phonetic: "/ˈfɪskl/",
      meaning: "Tài khóa",
      example: "Fiscal year ends in June.",
      exampleVi: "Năm tài khóa kết thúc vào tháng 6.",
    },
    {
      word: "accounts payable",
      phonetic: "/əˈkaʊnts ˈpeɪəbl/",
      meaning: "Phải trả người bán",
      example: "Track accounts payable.",
      exampleVi: "Theo dõi phải trả người bán.",
    },
    {
      word: "accounts receivable",
      phonetic: "/əˈkaʊnts rɪˈsiːvəbl/",
      meaning: "Phải thu khách hàng",
      example: "Collect accounts receivable.",
      exampleVi: "Thu hồi phải thu khách hàng.",
    },
    {
      word: "ledger",
      phonetic: "/ˈledʒər/",
      meaning: "Sổ cái",
      example: "Update the ledger.",
      exampleVi: "Cập nhật sổ cái.",
    },
  ],
  hr: [
    {
      word: "onboarding",
      phonetic: "/ˈɒnbɔːrdɪŋ/",
      meaning: "Đào tạo nhân viên mới",
      example: "Complete the onboarding process.",
      exampleVi: "Hoàn thành quy trình đào tạo nhân viên mới.",
    },
    {
      word: "appraisal",
      phonetic: "/əˈpreɪzl/",
      meaning: "Đánh giá hiệu suất",
      example: "Annual performance appraisal.",
      exampleVi: "Đánh giá hiệu suất hàng năm.",
    },
    {
      word: "recruitment",
      phonetic: "/rɪˈkruːtmənt/",
      meaning: "Tuyển dụng",
      example: "Improve recruitment process.",
      exampleVi: "Cải thiện quy trình tuyển dụng.",
    },
    {
      word: "retain",
      phonetic: "/rɪˈteɪn/",
      meaning: "Giữ chân",
      example: "How to retain talent?",
      exampleVi: "Làm thế nào để giữ chân nhân tài?",
    },
    {
      word: "probation",
      phonetic: "/proʊˈbeɪʃn/",
      meaning: "Thời gian thử việc",
      example: "Complete the probation period.",
      exampleVi: "Hoàn thành thời gian thử việc.",
    },
    {
      word: "resignation",
      phonetic: "/ˌrezɪɡˈneɪʃn/",
      meaning: "Đơn xin nghỉ việc",
      example: "Accept the resignation.",
      exampleVi: "Chấp nhận đơn xin nghỉ việc.",
    },
    {
      word: "redundancy",
      phonetic: "/rɪˈdʌndənsi/",
      meaning: "Thuyên chuyển, sa thải",
      example: "Handle redundancy process.",
      exampleVi: "Xử lý quy trình sa thải.",
    },
    {
      word: "compensation",
      phonetic: "/ˌkɒmpenˈseɪʃn/",
      meaning: "Lương, thưởng",
      example: "Review compensation package.",
      exampleVi: "Xem lại gói lương thưởng.",
    },
    {
      word: "benefits",
      phonetic: "/ˈbenɪfɪts/",
      meaning: "Phúc lợi",
      example: "Explain the benefits package.",
      exampleVi: "Giải thích gói phúc lợi.",
    },
    {
      word: "leave policy",
      phonetic: "/liːv ˈpɒləsi/",
      meaning: "Chính sách nghỉ phép",
      example: "Update the leave policy.",
      exampleVi: "Cập nhật chính sách nghỉ phép.",
    },
    {
      word: "promotion",
      phonetic: "/prəˈmoʊʃn/",
      meaning: "Thăng chức",
      example: "She got a promotion.",
      exampleVi: "Cô ấy được thăng chức.",
    },
    {
      word: "lateral move",
      phonetic: "/ˈlætərəl muːv/",
      meaning: "Chuyển vị trí ngang",
      example: "Consider a lateral move.",
      exampleVi: "Cân nhắc chuyển vị trí ngang.",
    },
    {
      word: "succession planning",
      phonetic: "/səkˈseʃn ˈplænɪŋ/",
      meaning: "Kế hoạch kế nhiệm",
      example: "Implement succession planning.",
      exampleVi: "Thực hiện kế hoạch kế nhiệm.",
    },
    {
      word: "headcount",
      phonetic: "/ˈhedkaʊnt/",
      meaning: "Số nhân sự",
      example: "We need to increase headcount.",
      exampleVi: "Chúng tôi cần tăng nhân sự.",
    },
    {
      word: "job description",
      phonetic: "/dʒɒb dɪˈskrɪpʃn/",
      meaning: "Mô tả công việc",
      example: "Review the job description.",
      exampleVi: "Xem lại mô tả công việc.",
    },
    {
      word: "competency",
      phonetic: "/ˈkɒmpɪtənsi/",
      meaning: "Năng lực",
      example: "Define core competencies.",
      exampleVi: "Xác định năng lực cốt lõi.",
    },
    {
      word: "workforce",
      phonetic: "/ˈwɜːrkfɔːrs/",
      meaning: "Lực lượng lao động",
      example: "Train the workforce.",
      exampleVi: "Đào tạo lực lượng lao động.",
    },
    {
      word: "severance",
      phonetic: "/ˈsevərəns/",
      meaning: "Trợ cấp thôi việc",
      example: "Negotiate severance package.",
      exampleVi: "Đàm phán gói trợ cấp thôi việc.",
    },
  ],
  general: [
    {
      word: "synergy",
      phonetic: "/ˈsɪnərdʒi/",
      meaning: "Hiệu quả kết hợp",
      example: "Create synergy between teams.",
      exampleVi: "Tạo hiệu quả kết hợp giữa các nhóm.",
    },
    {
      word: "pivot",
      phonetic: "/ˈpɪvət/",
      meaning: "Chuyển hướng",
      example: "Pivot the business strategy.",
      exampleVi: "Chuyển hướng chiến lược kinh doanh.",
    },
    {
      word: "streamline",
      phonetic: "/ˈstriːmlaɪn/",
      meaning: "Hợp lý hóa",
      example: "Streamline the process.",
      exampleVi: "Hợp lý hóa quy trình.",
    },
    {
      word: "bandwidth",
      phonetic: "/ˈbændwɪdθ/",
      meaning: "Công suất, thời gian",
      example: "I don't have the bandwidth.",
      exampleVi: "Tôi không có thời gian/năng lực.",
    },
    {
      word: "circle back",
      phonetic: "/ˈsɜːrkl bæk/",
      meaning: "Quay lại bàn bạc",
      example: "Let's circle back on this.",
      exampleVi: "Hãy quay lại bàn bạc về điều này.",
    },
    {
      word: "touch base",
      phonetic: "/tʌtʃ beɪs/",
      meaning: "Liên lạc, gặp gỡ",
      example: "Let's touch base tomorrow.",
      exampleVi: "Hãy gặp nhau vào ngày mai.",
    },
    {
      word: "drill down",
      phonetic: "/drɪl daʊn/",
      meaning: "Phân tích sâu",
      example: "We need to drill down.",
      exampleVi: "Chúng tôi cần phân tích sâu hơn.",
    },
    {
      word: "move the needle",
      phonetic: "/muːv ðə ˈniːdl/",
      meaning: "Tạo ra thay đổi",
      example: "This will move the needle.",
      exampleVi: "Điều này sẽ tạo ra thay đổi đáng kể.",
    },
    {
      word: "low-hanging fruit",
      phonetic: "/loʊ ˈhæŋɪŋ fruːt/",
      meaning: "Việc dễ làm trước",
      example: "Start with low-hanging fruit.",
      exampleVi: "Bắt đầu với những việc dễ làm trước.",
    },
    {
      word: "best practice",
      phonetic: "/best ˈpræktɪs/",
      meaning: "Thực hành tốt nhất",
      example: "Follow best practices.",
      exampleVi: "Tuân theo các thực hành tốt nhất.",
    },
    {
      word: "take ownership",
      phonetic: "/teɪk ˈoʊnərʃɪp/",
      meaning: "Chịu trách nhiệm",
      example: "Take ownership of this project.",
      exampleVi: "Chịu trách nhiệm về dự án này.",
    },
    {
      word: "value proposition",
      phonetic: "/ˈvæljuː ˌprɒpəˈzɪʃn/",
      meaning: "Giá trị đề xuất",
      example: "What's your value proposition?",
      exampleVi: "Giá trị đề xuất của bạn là gì?",
    },
    {
      word: "scope",
      phonetic: "/skoʊp/",
      meaning: "Phạm vi",
      example: "Define the project scope.",
      exampleVi: "Xác định phạm vi dự án.",
    },
    {
      word: "milestone",
      phonetic: "/ˈmaɪlstoʊn/",
      meaning: "Cột mốc",
      example: "We hit a major milestone.",
      exampleVi: "Chúng tôi đạt được một cột mốc quan trọng.",
    },
    {
      word: "deliverable",
      phonetic: "/dɪˈlɪvərəbl/",
      meaning: "Sản phẩm bàn giao",
      example: "List all deliverables.",
      exampleVi: "Liệt kê tất cả sản phẩm bàn giao.",
    },
    {
      word: "pipeline",
      phonetic: "/ˈpaɪplaɪn/",
      meaning: "Quy trình xử lý",
      example: "Add this to the pipeline.",
      exampleVi: "Thêm vào quy trình xử lý.",
    },
    {
      word: "incentivize",
      phonetic: "/ɪnˈsentɪvaɪz/",
      meaning: "Khuyến khích",
      example: "Incentivize the team.",
      exampleVi: "Khuyến khích nhóm.",
    },
    {
      word: "offshore",
      phonetic: "/ˈɒfʃɔːr/",
      meaning: "Thuê ngoài",
      example: "Offshore the production.",
      exampleVi: "Thuê ngoài sản xuất.",
    },
  ],
  // NEW CATEGORIES
  travel: [
    {
      word: "itinerary",
      phonetic: "/aɪˈtɪnəreri/",
      meaning: "Lịch trình",
      example: "Check your itinerary.",
      exampleVi: "Kiểm tra lịch trình của bạn.",
    },
    {
      word: "book",
      phonetic: "/bʊk/",
      meaning: "Đặt trước",
      example: "Book a flight.",
      exampleVi: "Đặt một chuyến bay.",
    },
    {
      word: "check-in",
      phonetic: "/ˈtʃek ɪn/",
      meaning: "Đăng ký, nhận phòng",
      example: "Online check-in is available.",
      exampleVi: "Đăng ký trực tuyến đã có sẵn.",
    },
    {
      word: "boarding pass",
      phonetic: "/ˈbɔːrdɪŋ pæs/",
      meaning: "Thẻ lên máy bay",
      example: "Show your boarding pass.",
      exampleVi: "Xuất trình thẻ lên máy bay.",
    },
    {
      word: "departure",
      phonetic: "/dɪˈpɑːrtʃər/",
      meaning: "Khởi hành",
      example: "Departure at 10 AM.",
      exampleVi: "Khởi hành lúc 10 giờ sáng.",
    },
    {
      word: "arrival",
      phonetic: "/əˈraɪvl/",
      meaning: "Đến nơi",
      example: "Arrival scheduled for 3 PM.",
      exampleVi: "Dự kiến đến nơi lúc 3 giờ chiều.",
    },
    {
      word: "accommodation",
      phonetic: "/əˌkɒməˈdeɪʃn/",
      meaning: "Chỗ ở",
      example: "Arrange accommodation.",
      exampleVi: "Sắp xếp chỗ ở.",
    },
    {
      word: "itinerary",
      phonetic: "/aɪˈtɪnəreri/",
      meaning: "Lịch trình",
      example: "Review the itinerary.",
      exampleVi: "Xem lại lịch trình.",
    },
    {
      word: "layover",
      phonetic: "/ˈleɪoʊvər/",
      meaning: "Quá cảnh",
      example: "Short layover in Dubai.",
      exampleVi: "Quá cảnh ngắn ở Dubai.",
    },
    {
      word: "visa",
      phonetic: "/ˈviːzə/",
      meaning: "Thị thực",
      example: "Do you need a visa?",
      exampleVi: "Bạn có cần visa không?",
    },
    {
      word: "passport",
      phonetic: "/ˈpæspɔːrt/",
      meaning: "Hộ chiếu",
      example: "Your passport is expired.",
      exampleVi: "Hộ chiếu của bạn đã hết hạn.",
    },
    {
      word: "expense report",
      phonetic: "/ɪkˈspens rɪˈpɔːrt/",
      meaning: "Báo cáo chi phí",
      example: "Submit your expense report.",
      exampleVi: "Nộp báo cáo chi phí của bạn.",
    },
    {
      word: "reimburse",
      phonetic: "/ˌriːɪmˈbɜːrs/",
      meaning: "Hoàn tiền",
      example: "They will reimburse expenses.",
      exampleVi: "Họ sẽ hoàn tiền chi phí.",
    },
    {
      word: "per diem",
      phonetic: "/pɜːr ˈdaɪəm/",
      meaning: "Phụ cấp ngày",
      example: "What's the per diem rate?",
      exampleVi: "Mức phụ cấp ngày là bao nhiêu?",
    },
    {
      word: "travel policy",
      phonetic: "/ˈtrævl ˈpɒləsi/",
      meaning: "Chính sách đi công tác",
      example: "Follow the travel policy.",
      exampleVi: "Tuân theo chính sách đi công tác.",
    },
    {
      word: "car rental",
      phonetic: "/kɑːr ˈrentl/",
      meaning: "Thuê xe",
      example: "Book a car rental.",
      exampleVi: "Đặt thuê xe.",
    },
    {
      word: "corporate rate",
      phonetic: "/ˈkɔːrpərət reɪt/",
      meaning: "Giá công ty",
      example: "Use the corporate rate.",
      exampleVi: "Sử dụng giá công ty.",
    },
    {
      word: "itinerary",
      phonetic: "/aɪˈtɪnəreri/",
      meaning: "Lịch trình",
      example: "Update the itinerary.",
      exampleVi: "Cập nhật lịch trình.",
    },
  ],
  networking: [
    {
      word: "connect",
      phonetic: "/kəˈnekt/",
      meaning: "Kết nối",
      example: "Let's connect on LinkedIn.",
      exampleVi: "Hãy kết nối trên LinkedIn.",
    },
    {
      word: "introduce",
      phonetic: "/ˌɪntrəˈdjuːs/",
      meaning: "Giới thiệu",
      example: "Allow me to introduce...",
      exampleVi: "Để tôi giới thiệu...",
    },
    {
      word: "referral",
      phonetic: "/ˈrefrəl/",
      meaning: "Giới thiệu",
      example: "I got a referral.",
      exampleVi: "Tôi có người giới thiệu.",
    },
    {
      word: "mutual contact",
      phonetic: "/ˈmjuːtʃuəl ˈkɒntækt/",
      meaning: "Người quen chung",
      example: "We have a mutual contact.",
      exampleVi: "Chúng ta có người quen chung.",
    },
    {
      word: "business card",
      phonetic: "/ˈbɪznəs kɑːrd/",
      meaning: "Danh thiếp",
      example: "Here's my business card.",
      exampleVi: "Đây là danh thiếp của tôi.",
    },
    {
      word: "follow up",
      phonetic: "/ˈfɑːloʊ ʌp/",
      meaning: "Theo dõi sau cuộc gặp",
      example: "I'll follow up next week.",
      exampleVi: "Tôi sẽ theo dõi vào tuần sau.",
    },
    {
      word: "warm lead",
      phonetic: "/wɔːrm liːd/",
      meaning: "Khách hàng tiềm năng",
      example: "This is a warm lead.",
      exampleVi: "Đây là khách hàng tiềm năng.",
    },
    {
      word: "cold call",
      phonetic: "/koʊld kɔːl/",
      meaning: "Gọi điện không hẹn",
      example: "I hate making cold calls.",
      exampleVi: "Tôi ghét gọi điện không hẹn.",
    },
    {
      word: " rapport",
      phonetic: "/ræˈpɔːr/",
      meaning: "Mối quan hệ tốt",
      example: "Build rapport with clients.",
      exampleVi: "Xây dựng mối quan hệ tốt với khách hàng.",
    },
    {
      word: "leverage",
      phonetic: "/ˈlevərɪdʒ/",
      meaning: "Tận dụng",
      example: "Leverage your network.",
      exampleVi: "Tận dụng mạng lưới của bạn.",
    },
    {
      word: "partnership",
      phonetic: "/ˈpɑːrtnərʃɪp/",
      meaning: "Đối tác",
      example: "Form a strategic partnership.",
      exampleVi: "Hình thành đối tác chiến lược.",
    },
    {
      word: "collaborate",
      phonetic: "/kəˈlæbəreɪt/",
      meaning: "Cộng tác",
      example: "We should collaborate.",
      exampleVi: "Chúng ta nên cộng tác.",
    },
    {
      word: "outreach",
      phonetic: "/ˈaʊtriːtʃ/",
      meaning: "Tiếp cận",
      example: "Increase outreach efforts.",
      exampleVi: "Tăng nỗ lực tiếp cận.",
    },
    {
      word: "introduction",
      phonetic: "/ˌɪntrəˈdʌkʃn/",
      meaning: "Lời giới thiệu",
      example: "Thank you for the introduction.",
      exampleVi: "Cảm ơn lời giới thiệu.",
    },
    {
      word: "refer",
      phonetic: "/rɪˈfɜːr/",
      meaning: "Giới thiệu",
      example: "Can I refer you to someone?",
      exampleVi: "Tôi có thể giới thiệu bạn đến ai đó không?",
    },
    {
      word: "endorse",
      phonetic: "/ɪnˈdɔːrs/",
      meaning: "Đề xuất",
      example: "I'll endorse your skills.",
      exampleVi: "Tôi sẽ đề xuất kỹ năng của bạn.",
    },
    {
      word: "alumni network",
      phonetic: "/əˈlʌmnaɪ ˈnetwɜːrk/",
      meaning: "Mạng lưới cựu sinh viên",
      example: "Join the alumni network.",
      exampleVi: "Tham gia mạng lưới cựu sinh viên.",
    },
    {
      word: "mentor",
      phonetic: "/ˈmentɔːr/",
      meaning: "Người cố vấn",
      example: "Find a mentor.",
      exampleVi: "Tìm một người cố vấn.",
    },
  ],
  social: [
    {
      word: "catch up",
      phonetic: "/kætʃ ʌp/",
      meaning: "Cập nhật tin tức",
      example: "Let's catch up over coffee.",
      exampleVi: "Hãy cập nhật tin tức uống cà phê.",
    },
    {
      word: "how's it going",
      phonetic: "/haʊz ɪt ˈɡoʊɪŋ/",
      meaning: "Dạo này thế nào",
      example: "Hey, how's it going?",
      exampleVi: "Này, dạo này thế nào?",
    },
    {
      word: "long time no see",
      phonetic: "/lɔːŋ taɪm noʊ siː/",
      meaning: "Lâu rồi không gặp",
      example: "Long time no see!",
      exampleVi: "Lâu rồi không gặp!",
    },
    {
      word: "what's up",
      phonetic: "/wɒts ʌp/",
      meaning: "Có gì mới",
      example: "Hey, what's up?",
      exampleVi: "Này, có gì mới không?",
    },
    {
      word: "nice to meet you",
      phonetic: "/naɪs tuː miːt juː/",
      meaning: "Rất vui được gặp",
      example: "Nice to meet you!",
      exampleVi: "Rất vui được gặp bạn!",
    },
    {
      word: "keep in touch",
      phonetic: "/kiːp ɪn tʌtʃ/",
      meaning: "Giữ liên lạc",
      example: "Let's keep in touch.",
      exampleVi: "Hãy giữ liên lạc nhé.",
    },
    {
      word: "have a good one",
      phonetic: "/hæv ə ɡʊd wʌn/",
      meaning: "Chúc tốt lành",
      example: "Have a good one!",
      exampleVi: "Chúc tốt lành!",
    },
    {
      word: "take care",
      phonetic: "/teɪk ker/",
      meaning: "Giữ gìn sức khỏe",
      example: "Take care!",
      exampleVi: "Giữ gìn sức khỏe nhé!",
    },
    {
      word: "cheers",
      phonetic: "/tʃɪrz/",
      meaning: "Cảm ơn, chúc mừng",
      example: "Cheers! Thank you.",
      exampleVi: "Cảm ơn! Chúc mừng!",
    },
    {
      word: "congratulations",
      phonetic: "/kənˌrætʃuˈleɪʃnz/",
      meaning: "Chúc mừng",
      example: "Congratulations!",
      exampleVi: "Chúc mừng!",
    },
    {
      word: "best wishes",
      phonetic: "/best ˈwɪʃɪz/",
      meaning: "Lời chúc tốt đẹp",
      example: "Best wishes for your new job.",
      exampleVi: "Lời chúc tốt đẹp cho công việc mới của bạn.",
    },
    {
      word: "get well soon",
      phonetic: "/ɡet wel suːn/",
      meaning: "Chóng khỏe mạnh",
      example: "Get well soon!",
      exampleVi: "Chóng khỏe mạnh nhé!",
    },
    {
      word: "happy birthday",
      phonetic: "/ˈhæpi ˈbɜːrθdeɪ/",
      meaning: "Chúc mừng sinh nhật",
      example: "Happy birthday!",
      exampleVi: "Chúc mừng sinh nhật!",
    },
    {
      word: "enjoy",
      phonetic: "/ɪnˈdʒɔɪ/",
      meaning: "Tận hưởng",
      example: "Enjoy your vacation!",
      exampleVi: "Tận hưởng kỳ nghỉ nhé!",
    },
    {
      word: "good luck",
      phonetic: "/ɡʊd lʌk/",
      meaning: "Chúc may mắn",
      example: "Good luck with your presentation!",
      exampleVi: "Chúc may mắn với bài thuyết trình!",
    },
    {
      word: "no worries",
      phonetic: "/noʊ ˈwɜːriz/",
      meaning: "Không sao đâu",
      example: "No worries at all!",
      exampleVi: "Không sao đâu!",
    },
    {
      word: "sounds good",
      phonetic: "/saʊndz ɡʊd/",
      meaning: "Nghe hay đấy",
      example: "That sounds good to me.",
      exampleVi: "Nghe hay đấy.",
    },
    {
      word: "I agree",
      phonetic: "/aɪ əˈɡriː/",
      meaning: "Tôi đồng ý",
      example: "I agree with you.",
      exampleVi: "Tôi đồng ý với bạn.",
    },
  ],
  project: [
    {
      word: "kick off",
      phonetic: "/kɪk ɒf/",
      meaning: "Bắt đầu",
      example: "Let's kick off the project.",
      exampleVi: "Hãy bắt đầu dự án.",
    },
    {
      word: "roadmap",
      phonetic: "/ˈroʊdmæp/",
      meaning: "Lộ trình",
      example: "Review the project roadmap.",
      exampleVi: "Xem lại lộ trình dự án.",
    },
    {
      word: "sprint",
      phonetic: "/sprɪnt/",
      meaning: "Giai đoạn phát triển",
      example: "Complete this in two sprints.",
      exampleVi: "Hoàn thành điều này trong hai giai đoạn.",
    },
    {
      word: "backlog",
      phonetic: "/ˈbæklɒɡ/",
      meaning: "Danh sách công việc",
      example: "Prioritize the backlog.",
      exampleVi: "Ưu tiên danh sách công việc.",
    },
    {
      word: "scrum",
      phonetic: "/skrʌm/",
      meaning: "Phương pháp scrum",
      example: "Use scrum methodology.",
      exampleVi: "Sử dụng phương pháp scrum.",
    },
    {
      word: "stand-up",
      phonetic: "/stænd ʌp/",
      meaning: "Họp ngắn hàng ngày",
      example: "Daily stand-up at 9 AM.",
      exampleVi: "Họp ngắn hàng ngày lúc 9 giờ.",
    },
    {
      word: "retrospective",
      phonetic: "/ˌretrəˈspektɪv/",
      meaning: "Họp rút kinh nghiệm",
      example: "Let's have a retrospective.",
      exampleVi: "Hãy họp rút kinh nghiệm.",
    },
    {
      word: "burndown chart",
      phonetic: "/ˈbɜːrndaʊn tʃɑːrt/",
      meaning: "Biểu đồ tiến độ",
      example: "Check the burndown chart.",
      exampleVi: "Kiểm tra biểu đồ tiến độ.",
    },
    {
      word: "velocity",
      phonetic: "/vəˈlɒsəti/",
      meaning: "Tốc độ làm việc",
      example: "Our velocity is improving.",
      exampleVi: "Tốc độ làm việc của chúng tôi đang cải thiện.",
    },
    {
      word: "epic",
      phonetic: "/ˈepɪk/",
      meaning: "Tính năng lớn",
      example: "This is a big epic.",
      exampleVi: "Đây là một tính năng lớn.",
    },
    {
      word: "user story",
      phonetic: "/ˈjuːzər ˈstɔːri/",
      meaning: "Yêu cầu người dùng",
      example: "Write a user story.",
      exampleVi: "Viết yêu cầu người dùng.",
    },
    {
      word: "task",
      phonetic: "/tæsk/",
      meaning: "Nhiệm vụ",
      example: "Assign this task.",
      exampleVi: "Giao nhiệm vụ này.",
    },
    {
      word: "subtask",
      phonetic: "/ˈsʌbtæsk/",
      meaning: "Công việc con",
      example: "Create a subtask.",
      exampleVi: "Tạo công việc con.",
    },
    {
      word: "dependency",
      phonetic: "/dɪˈpendənsi/",
      meaning: "Phụ thuộc",
      example: "Check dependencies.",
      exampleVi: "Kiểm tra các phụ thuộc.",
    },
    {
      word: "blocker",
      phonetic: "/ˈblɒkər/",
      meaning: "Trở ngại",
      example: "This is a blocker.",
      exampleVi: "Đây là một trở ngại.",
    },
    {
      word: "scope creep",
      phonetic: "/skoʊp kriːp/",
      meaning: "Mở rộng phạm vi",
      example: "Avoid scope creep.",
      exampleVi: "Tránh mở rộng phạm vi.",
    },
    {
      word: "resource allocation",
      phonetic: "/ˈriːsɔːrs ˌæləˈkeɪʃn/",
      meaning: "Phân bổ nguồn lực",
      example: "Optimize resource allocation.",
      exampleVi: "Tối ưu hóa phân bổ nguồn lực.",
    },
    {
      word: "project charter",
      phonetic: "/ˈprɒdʒekt ˈtʃɑːrtər/",
      meaning: "Giấy phép dự án",
      example: "Sign the project charter.",
      exampleVi: "Ký giấy phép dự án.",
    },
  ],
  customer: [
    {
      word: "complaint",
      phonetic: "/kəmˈpleɪnt/",
      meaning: "Khiếu nại",
      example: "Handle customer complaints.",
      exampleVi: "Xử lý khiếu nại của khách hàng.",
    },
    {
      word: "refund",
      phonetic: "/ˈriːfʌnd/",
      meaning: "Hoàn tiền",
      example: "Process a refund.",
      exampleVi: "Xử lý hoàn tiền.",
    },
    {
      word: "warranty",
      phonetic: "/ˈwɒrənti/",
      meaning: "Bảo hành",
      example: "The warranty is valid.",
      exampleVi: "Bảo hành còn hiệu lực.",
    },
    {
      word: "satisfaction",
      phonetic: "/ˌsætɪsˈfækʃn/",
      meaning: "Sự hài lòng",
      example: "Ensure customer satisfaction.",
      exampleVi: "Đảm bảo sự hài lòng của khách hàng.",
    },
    {
      word: "feedback",
      phonetic: "/ˈfiːdbæk/",
      meaning: "Phản hồi",
      example: "We appreciate your feedback.",
      exampleVi: "Chúng tôi đánh giá cao phản hồi của bạn.",
    },
    {
      word: "resolve",
      phonetic: "/rɪˈzɒlv/",
      meaning: "Giải quyết",
      example: "Resolve the issue quickly.",
      exampleVi: "Giải quyết vấn đề nhanh chóng.",
    },
    {
      word: "escalate",
      phonetic: "/ˈeskəleɪt/",
      meaning: "Chuyển lên",
      example: "Escalate to management.",
      exampleVi: "Chuyển lên ban quản lý.",
    },
    {
      word: "churn",
      phonetic: "/tʃɜːrn/",
      meaning: "Mất khách hàng",
      example: "Reduce customer churn.",
      exampleVi: "Giảm mất khách hàng.",
    },
    {
      word: "retention",
      phonetic: "/rɪˈtenʃn/",
      meaning: "Giữ chân khách",
      example: "Improve customer retention.",
      exampleVi: "Cải thiện giữ chân khách hàng.",
    },
    {
      word: "loyalty",
      phonetic: "/ˈlɔɪəlti/",
      meaning: "Lòng trung thành",
      example: "Build customer loyalty.",
      exampleVi: "Xây dựng lòng trung thành của khách hàng.",
    },
    {
      word: "onboarding",
      phonetic: "/ˈɒnbɔːrdɪŋ/",
      meaning: "Đón tiếp khách hàng",
      example: "Improve onboarding process.",
      exampleVi: "Cải thiện quy trình đón tiếp khách hàng.",
    },
    {
      word: "account manager",
      phonetic: "/əˈkaʊnt ˈmænɪdʒər/",
      meaning: "Quản lý tài khoản",
      example: "Contact your account manager.",
      exampleVi: "Liên hệ quản lý tài khoản của bạn.",
    },
    {
      word: "upsell",
      phonetic: "/ˈʌpsel/",
      meaning: "Bán thêm",
      example: "Try to upsell.",
      exampleVi: "Cố gắng bán thêm.",
    },
    {
      word: "cross-sell",
      phonetic: "/krɒs sel/",
      meaning: "Bán kèm",
      example: "Cross-sell related products.",
      exampleVi: "Bán kèm các sản phẩm liên quan.",
    },
    {
      word: "NPS",
      phonetic: "/en piː es/",
      meaning: "Chỉ số hài lòng",
      example: "Our NPS score is high.",
      exampleVi: "Điểm NPS của chúng tôi cao.",
    },
    {
      word: "CLV",
      phonetic: "/siː el viː/",
      meaning: "Giá trị trọn đời",
      example: "Calculate customer lifetime value.",
      exampleVi: "Tính giá trị trọn đời của khách hàng.",
    },
    {
      word: "support ticket",
      phonetic: "/səˈpɔːrt ˈtɪkɪt/",
      meaning: "Phiếu hỗ trợ",
      example: "Open a support ticket.",
      exampleVi: "Mở một phiếu hỗ trợ.",
    },
    {
      word: " SLA",
      phonetic: "/es el eɪ/",
      meaning: "Thỏa thuận dịch vụ",
      example: "Meet the SLA.",
      exampleVi: "Đáp ứng thỏa thuận dịch vụ.",
    },
  ],
  leadership: [
    {
      word: "vision",
      phonetic: "/ˈvɪʒn/",
      meaning: "Tầm nhìn",
      example: "Share your vision.",
      exampleVi: "Chia sẻ tầm nhìn của bạn.",
    },
    {
      word: "inspire",
      phonetic: "/ɪnˈspaɪər/",
      meaning: "Truyền cảm hứng",
      example: "Lead and inspire the team.",
      exampleVi: "Lãnh đạo và truyền cảm hứng cho nhóm.",
    },
    {
      word: "empower",
      phonetic: "/ɪmˈpaʊər/",
      meaning: "Trao quyền",
      example: "Empower your employees.",
      exampleVi: "Trao quyền cho nhân viên của bạn.",
    },
    {
      word: "mentor",
      phonetic: "/ˈmentɔːr/",
      meaning: "Hướng dẫn",
      example: "Mentor new team members.",
      exampleVi: "Hướng dẫn các thành viên mới.",
    },
    {
      word: "delegate",
      phonetic: "/ˈdelɪɡeɪt/",
      meaning: "Ủy quyền",
      example: "Learn to delegate.",
      exampleVi: "Học cách ủy quyền.",
    },
    {
      word: "accountability",
      phonetic: "/əˌkaʊntəˈbɪləti/",
      meaning: "Trách nhiệm giải trình",
      example: "Ensure accountability.",
      exampleVi: "Đảm bảo trách nhiệm giải trình.",
    },
    {
      word: "integrity",
      phonetic: "/ɪnˈteɡrəti/",
      meaning: "Liêm chính",
      example: "Show integrity.",
      exampleVi: "Thể hiện sự liêm chính.",
    },
    {
      word: "strategy",
      phonetic: "/ˈstrætədʒi/",
      meaning: "Chiến lược",
      example: "Develop a strategy.",
      exampleVi: "Phát triển một chiến lược.",
    },
    {
      word: "objective",
      phonetic: "/əbˈdʒektɪv/",
      meaning: "Mục tiêu",
      example: "Set clear objectives.",
      exampleVi: "Đặt ra mục tiêu rõ ràng.",
    },
    {
      word: "align",
      phonetic: "/əˈlaɪn/",
      meaning: "Căn chỉnh",
      example: "Align team goals.",
      exampleVi: "Căn chỉnh mục tiêu nhóm.",
    },
    {
      word: "decision",
      phonetic: "/dɪˈsɪʒn/",
      meaning: "Quyết định",
      example: "Make a decision.",
      exampleVi: "Đưa ra quyết định.",
    },
    {
      word: "influence",
      phonetic: "/ˈɪnfluəns/",
      meaning: "Ảnh hưởng",
      example: "Use your influence wisely.",
      exampleVi: "Sử dụng ảnh hưởng của bạn một cách khôn ngoan.",
    },
    {
      word: "change management",
      phonetic: "/tʃeɪndʒ ˈmænɪdʒmənt/",
      meaning: "Quản lý thay đổi",
      example: "Lead change management.",
      exampleVi: "Lãnh đạo quản lý thay đổi.",
    },
    {
      word: "coaching",
      phonetic: "/ˈkoʊtʃɪŋ/",
      meaning: "Huấn luyện",
      example: "Provide coaching.",
      exampleVi: "Cung cấp huấn luyện.",
    },
    {
      word: "conflict",
      phonetic: "/ˈkɒnflɪkt/",
      meaning: "Xung đột",
      example: "Resolve conflict.",
      exampleVi: "Giải quyết xung đột.",
    },
    {
      word: "motivate",
      phonetic: "/ˈmoʊtɪveɪt/",
      meaning: "Động viên",
      example: "Motivate your team.",
      exampleVi: "Động viên nhóm của bạn.",
    },
    {
      word: "recognize",
      phonetic: "/ˈrekəɡnaɪz/",
      meaning: "Công nhận",
      example: "Recognize achievements.",
      exampleVi: "Công nhận thành tích.",
    },
    {
      word: "innovate",
      phonetic: "/ˈɪnəveɪt/",
      meaning: "Đổi mới",
      example: "Encourage innovation.",
      exampleVi: "Khuyến khích đổi mới.",
    },
  ],
  legal: [
    {
      word: "contract",
      phonetic: "/ˈkɒntrækt/",
      meaning: "Hợp đồng",
      example: "Sign the contract.",
      exampleVi: "Ký hợp đồng.",
    },
    {
      word: "agreement",
      phonetic: "/əˈɡriːmənt/",
      meaning: "Thỏa thuận",
      example: "Draft an agreement.",
      exampleVi: "Soạn thảo một thỏa thuận.",
    },
    {
      word: "compliance",
      phonetic: "/kəmˈplaɪəns/",
      meaning: "Tuân thủ",
      example: "Ensure compliance.",
      exampleVi: "Đảm bảo tuân thủ.",
    },
    {
      word: "confidential",
      phonetic: "/ˌkɒnfɪˈdenʃl/",
      meaning: "Bí mật",
      example: "Keep it confidential.",
      exampleVi: "Giữ bí mật.",
    },
    {
      word: "intellectual property",
      phonetic: "/ˌɪntəˈlektʃuəl ˈprɒpərti/",
      meaning: "Sở hữu trí tuệ",
      example: "Protect intellectual property.",
      exampleVi: "Bảo vệ sở hữu trí tuệ.",
    },
    {
      word: "liability",
      phonetic: "/ˌlaɪəˈbɪləti/",
      meaning: "Trách nhiệm pháp lý",
      example: "Limit liability.",
      exampleVi: "Giới hạn trách nhiệm pháp lý.",
    },
    {
      word: "indemnify",
      phonetic: "/ɪnˈdemnɪfaɪ/",
      meaning: "Bồi thường",
      example: "Indemnify the parties.",
      exampleVi: "Bồi thường cho các bên.",
    },
    {
      word: "terminate",
      phonetic: "/ˈtɜːrmɪneɪt/",
      meaning: "Chấm dứt",
      example: "Terminate the contract.",
      exampleVi: "Chấm dứt hợp đồng.",
    },
    {
      word: "breach",
      phonetic: "/briːtʃ/",
      meaning: "Vi phạm",
      example: "Breach of contract.",
      exampleVi: "Vi phạm hợp đồng.",
    },
    {
      word: "jurisdiction",
      phonetic: "/ˌdʒʊərɪsˈdɪkʃn/",
      meaning: "Thẩm quyền",
      example: "Specify jurisdiction.",
      exampleVi: "Xác định thẩm quyền.",
    },
    {
      word: "arbitration",
      phonetic: "/ˌɑːrbɪˈtreɪʃn/",
      meaning: "Trọng tài",
      example: "Settle via arbitration.",
      exampleVi: "Giải quyết qua trọng tài.",
    },
    {
      word: "copyright",
      phonetic: "/ˈkɒpirʌɪt/",
      meaning: "Bản quyền",
      example: "Copyright protected.",
      exampleVi: "Được bảo vệ bản quyền.",
    },
    {
      word: "trademark",
      phonetic: "/ˈtreɪdmɑːrk/",
      meaning: "Nhãn hiệu",
      example: "Register a trademark.",
      exampleVi: "Đăng ký nhãn hiệu.",
    },
    {
      word: "dispute",
      phonetic: "/dɪˈspjuːt/",
      meaning: "Tranh chấp",
      example: "Resolve a dispute.",
      exampleVi: "Giải quyết tranh chấp.",
    },
    {
      word: "negotiate",
      phonetic: "/nɪˈɡoʊʃieɪt/",
      meaning: "Đàm phán",
      example: "Negotiate terms.",
      exampleVi: "Đàm phán các điều khoản.",
    },
    {
      word: "witness",
      phonetic: "/ˈwɪtnəs/",
      meaning: "Người làm chứng",
      example: "Sign as witness.",
      exampleVi: "Ký làm người làm chứng.",
    },
    {
      word: "notary",
      phonetic: "/ˈnoʊtəri/",
      meaning: "Công chứng",
      example: "Get it notarized.",
      exampleVi: "Công chứng nó.",
    },
    {
      word: "amendment",
      phonetic: "/əˈmendmənt/",
      meaning: "Sửa đổi",
      example: "Propose an amendment.",
      exampleVi: "Đề xuất sửa đổi.",
    },
  ],
  // Daily communication vocabulary
  restaurant: [
    {
      word: "reservation",
      phonetic: "/ˌrezərˈveɪʃn/",
      meaning: "Đặt bàn",
      example: "I'd like to make a reservation.",
      exampleVi: "Tôi muốn đặt một bàn.",
    },
    {
      word: "menu",
      phonetic: "/ˈmenjuː/",
      meaning: "Thực đơn",
      example: "May I see the menu?",
      exampleVi: "Tôi có thể xem thực đơn không?",
    },
    {
      word: "appetizer",
      phonetic: "/ˈæpɪtaɪzər/",
      meaning: "Món khai vị",
      example: "We'll start with an appetizer.",
      exampleVi: "Chúng tôi bắt đầu với món khai vị.",
    },
    {
      word: "entree",
      phonetic: "/ˈɒntreɪ/",
      meaning: "Món chính",
      example: "What's the entree today?",
      exampleVi: "Món chính hôm nay là gì?",
    },
    {
      word: "dessert",
      phonetic: "/dɪˈzɜːrt/",
      meaning: "Tráng miệng",
      example: "Can I see the dessert menu?",
      exampleVi: "Tôi có thể xem thực đơn tráng miệng không?",
    },
    {
      word: "bill",
      phonetic: "/bɪl/",
      meaning: "Hóa đơn",
      example: "Can I have the bill?",
      exampleVi: "Tôi có thể thanh toán được không?",
    },
    {
      word: "tip",
      phonetic: "/tɪp/",
      meaning: "Tiền tip",
      example: "Leave a tip.",
      exampleVi: "Để lại tiền tip.",
    },
    {
      word: "delicious",
      phonetic: "/dɪˈlɪʃəs/",
      meaning: "Ngon",
      example: "This is delicious!",
      exampleVi: "Điều này rất ngon!",
    },
    {
      word: "vegetarian",
      phonetic: "/ˌvedʒəˈteriən/",
      meaning: "Người ăn chay",
      example: "Is this vegetarian?",
      exampleVi: "Đây có phải là món chay không?",
    },
    {
      word: "allergic",
      phonetic: "/əˈlɜːrdʒɪk/",
      meaning: "Dị ứng",
      example: "I'm allergic to peanuts.",
      exampleVi: "Tôi bị dị ứng với đậu phộng.",
    },
    {
      word: "to-go",
      phonetic: "/tə ˈɡoʊ/",
      meaning: "Mang đi",
      example: "Can I get this to-go?",
      exampleVi: "Tôi có thể mang đi không?",
    },
    {
      word: "refill",
      phonetic: "/ˈriːfɪl/",
      meaning: "Thêm nước",
      example: "Can I get a refill?",
      exampleVi: "Tôi có thể xin thêm nước không?",
    },
    {
      word: "split the bill",
      phonetic: "/splɪt ðə bɪl/",
      meaning: "Chia hóa đơn",
      example: "Let's split the bill.",
      exampleVi: "Chúng ta chia hóa đơn nhé.",
    },
    {
      word: "drinks",
      phonetic: "/drɪŋks/",
      meaning: "Đồ uống",
      example: "What would you like to drink?",
      exampleVi: "Bạn muốn uống gì?",
    },
    {
      word: "water",
      phonetic: "/ˈwɔːtər/",
      meaning: "Nước",
      example: "A glass of water, please.",
      exampleVi: "Một ly nước.",
    },
    {
      word: "diet",
      phonetic: "/ˈdaɪət/",
      meaning: "Ăn kiêng",
      example: "I'm on a diet.",
      exampleVi: "Tôi đang ăn kiêng.",
    },
    {
      word: "spicy",
      phonetic: "/ˈspaɪsi/",
      meaning: "Cay",
      example: "Is this dish spicy?",
      exampleVi: "Món này có cay không?",
    },
    {
      word: "recommend",
      phonetic: "/ˌrekəˈmend/",
      meaning: "Khuyên",
      example: "What do you recommend?",
      exampleVi: "Bạn khuyên món gì?",
    },
  ],
  shopping: [
    {
      word: "discount",
      phonetic: "/ˈdɪskaʊnt/",
      meaning: "Giảm giá",
      example: "Is there a discount?",
      exampleVi: "Có giảm giá không?",
    },
    {
      word: "price",
      phonetic: "/praɪs/",
      meaning: "Giá",
      example: "What's the price?",
      exampleVi: "Giá bao nhiêu?",
    },
    {
      word: "sale",
      phonetic: "/seɪl/",
      meaning: "Khuyến mãi",
      example: "Everything is on sale.",
      exampleVi: "Mọi thứ đang khuyến mãi.",
    },
    {
      word: "size",
      phonetic: "/saɪz/",
      meaning: "Kích thước",
      example: "Do you have this in a larger size?",
      exampleVi: "Bạn có kích thước lớn hơn không?",
    },
    {
      word: "color",
      phonetic: "/ˈkʌlər/",
      meaning: "Màu sắc",
      example: "What colors are available?",
      exampleVi: "Có những màu nào?",
    },
    {
      word: "fit",
      phonetic: "/fɪt/",
      meaning: "Vừa vặn",
      example: "It doesn't fit.",
      exampleVi: "Nó không vừa.",
    },
    {
      word: "receipt",
      phonetic: "/rɪˈsiːt/",
      meaning: "Hóa đơn",
      example: "I need a receipt.",
      exampleVi: "Tôi cần hóa đơn.",
    },
    {
      word: "return",
      phonetic: "/rɪˈtɜːrn/",
      meaning: "Trả lại",
      example: "Can I return this?",
      exampleVi: "Tôi có thể trả lại không?",
    },
    {
      word: "exchange",
      phonetic: "/ɪksˈtʃeɪndʒ/",
      meaning: "Đổi",
      example: "I'd like to exchange this.",
      exampleVi: "Tôi muốn đổi cái này.",
    },
    {
      word: "cash",
      phonetic: "/kæʃ/",
      meaning: "Tiền mặt",
      example: "Cash or card?",
      exampleVi: "Tiền mặt hay thẻ?",
    },
    {
      word: "card",
      phonetic: "/kɑːrd/",
      meaning: "Thẻ",
      example: "Do you accept credit cards?",
      exampleVi: "Bạn có chấp nhận thẻ tín dụng không?",
    },
    {
      word: "online",
      phonetic: "/ˈɒnlɪn/",
      meaning: "Trực tuyến",
      example: "Is it available online?",
      exampleVi: "Có bán trực tuyến không?",
    },
    {
      word: "shipping",
      phonetic: "/ˈʃɪpɪŋ/",
      meaning: "Vận chuyển",
      example: "What's the shipping fee?",
      exampleVi: "Phí vận chuyển bao nhiêu?",
    },
    {
      word: "out of stock",
      phonetic: "/aʊt əv stɒk/",
      meaning: "Hết hàng",
      example: "This item is out of stock.",
      exampleVi: "Món này đã hết hàng.",
    },
    {
      word: "in stock",
      phonetic: "/ɪn stɒk/",
      meaning: "Còn hàng",
      example: "When will it be in stock?",
      exampleVi: "Khi nào sẽ có hàng?",
    },
    {
      word: "browse",
      phonetic: "/braʊz/",
      meaning: "Xem qua",
      example: "I'm just browsing.",
      exampleVi: "Tôi chỉ xem qua thôi.",
    },
    {
      word: "try on",
      phonetic: "/traɪ ɒn/",
      meaning: "Thử",
      example: "Can I try this on?",
      exampleVi: "Tôi có thể thử không?",
    },
    {
      word: "checkout",
      phonetic: "/ˈtʃekaʊt/",
      meaning: "Thanh toán",
      example: "Proceed to checkout.",
      exampleVi: "Tiến hành thanh toán.",
    },
  ],
  directions: [
    {
      word: "where",
      phonetic: "/wer/",
      meaning: "Ở đâu",
      example: "Where is the restroom?",
      exampleVi: "Nhà vệ sinh ở đâu?",
    },
    {
      word: "turn",
      phonetic: "/tɜːrn/",
      meaning: "Rẽ",
      example: "Turn left at the corner.",
      exampleVi: "Rẽ trái ở góc.",
    },
    {
      word: "straight",
      phonetic: "/streɪt/",
      meaning: "Thẳng",
      example: "Go straight ahead.",
      exampleVi: "Đi thẳng phía trước.",
    },
    {
      word: "near",
      phonetic: "/nɪr/",
      meaning: "Gần",
      example: "Is it near here?",
      exampleVi: "Có gần đây không?",
    },
    {
      word: "far",
      phonetic: "/fɑːr/",
      meaning: "Xa",
      example: "How far is it?",
      exampleVi: "Có xa không?",
    },
    {
      word: "next to",
      phonetic: "/nekst tuː/",
      meaning: "Cạnh",
      example: "It's next to the bank.",
      exampleVi: "Nó cạnh ngân hàng.",
    },
    {
      word: "between",
      phonetic: "/bɪˈtwiːn/",
      meaning: "Giữa",
      example: "It's between the stores.",
      exampleVi: "Nó ở giữa các cửa hàng.",
    },
    {
      word: "behind",
      phonetic: "/bɪˈhaɪnd/",
      meaning: "Sau",
      example: "It's behind the building.",
      exampleVi: "Nó ở sau tòa nhà.",
    },
    {
      word: "in front of",
      phonetic: "/ɪn frʌnt əv/",
      meaning: "Trước",
      example: "It's in front of the park.",
      exampleVi: "Nó ở trước công viên.",
    },
    {
      word: "map",
      phonetic: "/mæp/",
      meaning: "Bản đồ",
      example: "Can I see a map?",
      exampleVi: "Tôi có thể xem bản đồ không?",
    },
    {
      word: "address",
      phonetic: "/əˈdres/",
      meaning: "Địa chỉ",
      example: "What's the address?",
      exampleVi: "Địa chỉ là gì?",
    },
    {
      word: "landmark",
      phonetic: "/ˈlændmɑːrk/",
      meaning: "Mốc địa điểm",
      example: "Meet me at the landmark.",
      exampleVi: "Gặp tôi ở mốc địa điểm.",
    },
    {
      word: "block",
      phonetic: "/blɒk/",
      meaning: "Dãy nhà",
      example: "It's two blocks away.",
      exampleVi: "Cách đây hai dãy nhà.",
    },
    {
      word: "traffic",
      phonetic: "/ˈtræfɪk/",
      meaning: "Giao thông",
      example: "There's heavy traffic.",
      exampleVi: "Giao thông đông đúc.",
    },
    {
      word: "downtown",
      phonetic: "/ˈdaʊntaʊn/",
      meaning: "Trung tâm thành phố",
      example: "Go downtown.",
      exampleVi: "Đi vào trung tâm thành phố.",
    },
    {
      word: "subway",
      phonetic: "/ˈsʌbweɪ/",
      meaning: "Tàu điện ngầm",
      example: "Take the subway.",
      exampleVi: "Đi tàu điện ngầm.",
    },
    {
      word: "bus",
      phonetic: "/bʌs/",
      meaning: "Xe buýt",
      example: "Which bus should I take?",
      exampleVi: "Tôi nên đi xe buýt nào?",
    },
    {
      word: "taxi",
      phonetic: "/ˈtæksi/",
      meaning: "Taxi",
      example: "Call a taxi.",
      exampleVi: "Gọi một chiếc taxi.",
    },
  ],
  health: [
    {
      word: "headache",
      phonetic: "/ˈhedeɪk/",
      meaning: "Đau đầu",
      example: "I have a headache.",
      exampleVi: "Tôi bị đau đầu.",
    },
    {
      word: "stomachache",
      phonetic: "/ˈstʌməkeɪk/",
      meaning: "Đau bụng",
      example: "I have a stomachache.",
      exampleVi: "Tôi bị đau bụng.",
    },
    {
      word: "fever",
      phonetic: "/ˈfiːvər/",
      meaning: "Sốt",
      example: "I have a fever.",
      exampleVi: "Tôi bị sốt.",
    },
    {
      word: "cold",
      phonetic: "/koʊld/",
      meaning: "Cảm lạnh",
      example: "I caught a cold.",
      exampleVi: "Tôi bị cảm lạnh.",
    },
    {
      word: "flu",
      phonetic: "/fluː/",
      meaning: "Cúm",
      example: "I have the flu.",
      exampleVi: "Tôi bị cúm.",
    },
    {
      word: "doctor",
      phonetic: "/ˈdɒktər/",
      meaning: "Bác sĩ",
      example: "See a doctor.",
      exampleVi: "Đi khám bác sĩ.",
    },
    {
      word: "medicine",
      phonetic: "/ˈmedɪsn/",
      meaning: "Thuốc",
      example: "Take this medicine.",
      exampleVi: "Uống thuốc này.",
    },
    {
      word: "appointment",
      phonetic: "/əˈpɔɪntmənt/",
      meaning: "Lịch hẹn",
      example: "Make an appointment.",
      exampleVi: "Đặt lịch hẹn.",
    },
    {
      word: "allergy",
      phonetic: "/ˈælərdʒi/",
      meaning: "Dị ứng",
      example: "I have an allergy.",
      exampleVi: "Tôi bị dị ứng.",
    },
    {
      word: "pain",
      phonetic: "/peɪn/",
      meaning: "Đau",
      example: "Where does it hurt?",
      exampleVi: "Chỗ nào đau?",
    },
    {
      word: "rest",
      phonetic: "/rest/",
      meaning: "Nghỉ ngơi",
      example: "You need to rest.",
      exampleVi: "Bạn cần nghỉ ngơi.",
    },
    {
      word: "hospital",
      phonetic: "/ˈhɒspɪtl/",
      meaning: "Bệnh viện",
      example: "Go to the hospital.",
      exampleVi: "Đi bệnh viện.",
    },
    {
      word: "pharmacy",
      phonetic: "/ˈfɑːrməsi/",
      meaning: "Hiệu thuốc",
      example: "Find a pharmacy.",
      exampleVi: "Tìm một hiệu thuốc.",
    },
    {
      word: "symptom",
      phonetic: "/ˈsɪmptəm/",
      meaning: "Triệu chứng",
      example: "What are your symptoms?",
      exampleVi: "Bạn có triệu chứng gì?",
    },
    {
      word: "prescription",
      phonetic: "/prɪˈskrɪpʃn/",
      meaning: "Đơn thuốc",
      example: "I need a prescription.",
      exampleVi: "Tôi cần đơn thuốc.",
    },
    {
      word: "health insurance",
      phonetic: "/helθ ɪnˈʃʊərəns/",
      meaning: "Bảo hiểm y tế",
      example: "Do you have health insurance?",
      exampleVi: "Bạn có bảo hiểm y tế không?",
    },
    {
      word: "checkup",
      phonetic: "/ˈtʃekʌp/",
      meaning: "Khám sức khỏe",
      example: "I need a checkup.",
      exampleVi: "Tôi cần khám sức khỏe.",
    },
    {
      word: "better",
      phonetic: "/ˈbetər/",
      meaning: "Tốt hơn",
      example: "I'm feeling better.",
      exampleVi: "Tôi cảm thấy tốt hơn.",
    },
  ],
  hotel: [
    {
      word: "check-in",
      phonetic: "/ˈtʃek ɪn/",
      meaning: "Nhận phòng",
      example: "I'd like to check in.",
      exampleVi: "Tôi muốn nhận phòng.",
    },
    {
      word: "check-out",
      phonetic: "/ˈtʃek aʊt/",
      meaning: "Trả phòng",
      example: "When is checkout?",
      exampleVi: "Khi nào trả phòng?",
    },
    {
      word: "room",
      phonetic: "/ruːm/",
      meaning: "Phòng",
      example: "I booked a room.",
      exampleVi: "Tôi đã đặt phòng.",
    },
    {
      word: "key",
      phonetic: "/kiː/",
      meaning: "Chìa khóa",
      example: "I lost my key.",
      exampleVi: "Tôi làm mất chìa khóa.",
    },
    {
      word: "wifi",
      phonetic: "/ˈwaɪfaɪ/",
      meaning: "Wifi",
      example: "What's the wifi password?",
      exampleVi: "Mật khẩu wifi là gì?",
    },
    {
      word: "breakfast",
      phonetic: "/ˈbrekfəst/",
      meaning: "Bữa sáng",
      example: "Is breakfast included?",
      exampleVi: "Bữa sáng đã bao gồm chưa?",
    },
    {
      word: "air conditioning",
      phonetic: "/er kənˈdɪʃənɪŋ/",
      meaning: "Điều hòa",
      example: "The AC is not working.",
      exampleVi: "Điều hòa không hoạt động.",
    },
    {
      word: "elevator",
      phonetic: "/ˈelɪveɪtər/",
      meaning: "Thang máy",
      example: "Where is the elevator?",
      exampleVi: "Thang máy ở đâu?",
    },
    {
      word: "floor",
      phonetic: "/flɔːr/",
      meaning: "Tầng",
      example: "What floor is it on?",
      exampleVi: "Ở tầng nào?",
    },
    {
      word: "single room",
      phonetic: "/ˈsɪŋɡl ruːm/",
      meaning: "Phòng đơn",
      example: "I need a single room.",
      exampleVi: "Tôi cần phòng đơn.",
    },
    {
      word: "double room",
      phonetic: "/ˈdʌbl ruːm/",
      meaning: "Phòng đôi",
      example: "A double room, please.",
      exampleVi: "Một phòng đôi.",
    },
    {
      word: "suite",
      phonetic: "/swiːt/",
      meaning: "Phòng suite",
      example: "Upgrade to a suite.",
      exampleVi: "Nâng cấp lên phòng suite.",
    },
    {
      word: "clean",
      phonetic: "/kliːn/",
      meaning: "Sạch",
      example: "The room is not clean.",
      exampleVi: "Phòng không sạch.",
    },
    {
      word: "towel",
      phonetic: "/ˈtaʊəl/",
      meaning: "Khăn",
      example: "I need more towels.",
      exampleVi: "Tôi cần thêm khăn.",
    },
    {
      word: "laundry",
      phonetic: "/ˈlɔːndri/",
      meaning: "Giặt ủi",
      example: "Is there laundry service?",
      exampleVi: "Có dịch vụ giặt ủi không?",
    },
    {
      word: "pool",
      phonetic: "/puːl/",
      meaning: "Hồ bơi",
      example: "Where is the pool?",
      exampleVi: "Hồ bơi ở đâu?",
    },
    {
      word: "gym",
      phonetic: "/dʒɪm/",
      meaning: "Phòng gym",
      example: "Does the hotel have a gym?",
      exampleVi: "Khách sạn có phòng gym không?",
    },
    {
      word: "bellboy",
      phonetic: "/ˈbelbɔɪ/",
      meaning: "Người khuân vác",
      example: "Call the bellboy.",
      exampleVi: "Gọi người khuân vác.",
    },
  ],
  weather: [
    {
      word: "sunny",
      phonetic: "/ˈsʌni/",
      meaning: "Nắng",
      example: "It's sunny today.",
      exampleVi: "Hôm nay trời nắng.",
    },
    {
      word: "rainy",
      phonetic: "/ˈreɪni/",
      meaning: "Mưa",
      example: "It's rainy.",
      exampleVi: "Trời mưa.",
    },
    {
      word: "cloudy",
      phonetic: "/ˈklaʊdi/",
      meaning: "Âm u",
      example: "It's cloudy today.",
      exampleVi: "Hôm nay âm u.",
    },
    {
      word: "windy",
      phonetic: "/ˈwɪndi/",
      meaning: "Gió",
      example: "It's windy.",
      exampleVi: "Trời có gió.",
    },
    {
      word: "cold",
      phonetic: "/koʊld/",
      meaning: "Lạnh",
      example: "It's cold outside.",
      exampleVi: "Bên ngoài lạnh.",
    },
    {
      word: "hot",
      phonetic: "/hɒt/",
      meaning: "Nóng",
      example: "It's very hot.",
      exampleVi: "Rất nóng.",
    },
    {
      word: "warm",
      phonetic: "/wɔːrm/",
      meaning: "Ấm",
      example: "It's warm today.",
      exampleVi: "Hôm nay ấm áp.",
    },
    {
      word: "cool",
      phonetic: "/kuːl/",
      meaning: "Mát",
      example: "It's cool in the evening.",
      exampleVi: "Buổi tối mát mẻ.",
    },
    {
      word: "snow",
      phonetic: "/snoʊ/",
      meaning: "Tuyết",
      example: "It's going to snow.",
      exampleVi: "Sẽ có tuyết.",
    },
    {
      word: "storm",
      phonetic: "/stɔːrm/",
      meaning: "Bão",
      example: "There's a storm coming.",
      exampleVi: "Có bão sắp đến.",
    },
    {
      word: "foggy",
      phonetic: "/ˈfɒɡi/",
      meaning: "Sương mù",
      example: "It's foggy this morning.",
      exampleVi: "Sáng nay có sương mù.",
    },
    {
      word: "humid",
      phonetic: "/ˈhjuːmɪd/",
      meaning: "Ẩm ướt",
      example: "It's humid here.",
      exampleVi: "Ở đây ẩm ướt.",
    },
    {
      word: "forecast",
      phonetic: "/ˈfɔːrkæst/",
      meaning: "Dự báo thời tiết",
      example: "Check the weather forecast.",
      exampleVi: "Xem dự báo thời tiết.",
    },
    {
      word: "temperature",
      phonetic: "/ˈtemprətʃər/",
      meaning: "Nhiệt độ",
      example: "What's the temperature?",
      exampleVi: "Nhiệt độ là bao nhiêu?",
    },
    {
      word: "umbrella",
      phonetic: "/ʌmˈbrelə/",
      meaning: "Ô",
      example: "Bring an umbrella.",
      exampleVi: "Mang theo ô.",
    },
    {
      word: "jacket",
      phonetic: "/ˈdʒækɪt/",
      meaning: "Áo khoác",
      example: "You need a jacket.",
      exampleVi: "Bạn cần áo khoác.",
    },
    {
      word: "weather",
      phonetic: "/ˈweðər/",
      meaning: "Thời tiết",
      example: "What's the weather like?",
      exampleVi: "Thời tiết như thế nào?",
    },
    {
      word: "season",
      phonetic: "/ˈsiːzn/",
      meaning: "Mùa",
      example: "What's the season?",
      exampleVi: "Bây giờ là mùa gì?",
    },
  ],
  time: [
    {
      word: "today",
      phonetic: "/təˈdeɪ/",
      meaning: "Hôm nay",
      example: "What are you doing today?",
      exampleVi: "Hôm nay bạn làm gì?",
    },
    {
      word: "tomorrow",
      phonetic: "/təˈmɒroʊ/",
      meaning: "Ngày mai",
      example: "See you tomorrow.",
      exampleVi: "Hẹn gặp ngày mai.",
    },
    {
      word: "yesterday",
      phonetic: "/ˈjestərdeɪ/",
      meaning: "Hôm qua",
      example: "I saw him yesterday.",
      exampleVi: "Tôi gặp anh ấy hôm qua.",
    },
    {
      word: "week",
      phonetic: "/wiːk/",
      meaning: "Tuần",
      example: "This week is busy.",
      exampleVi: "Tuần này bận.",
    },
    {
      word: "month",
      phonetic: "/mʌnθ/",
      meaning: "Tháng",
      example: "It's my birthday month.",
      exampleVi: "Đây là tháng sinh nhật tôi.",
    },
    {
      word: "year",
      phonetic: "/jɪr/",
      meaning: "Năm",
      example: "Happy New Year!",
      exampleVi: "Chúc mừng năm mới!",
    },
    {
      word: "morning",
      phonetic: "/ˈmɔːrnɪŋ/",
      meaning: "Buổi sáng",
      example: "Good morning!",
      exampleVi: "Chào buổi sáng!",
    },
    {
      word: "afternoon",
      phonetic: "/ˌæftərˈnuːn/",
      meaning: "Buổi chiều",
      example: "Good afternoon!",
      exampleVi: "Chào buổi chiều!",
    },
    {
      word: "evening",
      phonetic: "/ˈiːvnɪŋ/",
      meaning: "Buổi tối",
      example: "Good evening!",
      exampleVi: "Chào buổi tối!",
    },
    {
      word: "night",
      phonetic: "/naɪt/",
      meaning: "Đêm",
      example: "Good night!",
      exampleVi: "Chúc ngủ ngon!",
    },
    {
      word: "hour",
      phonetic: "/ˈaʊər/",
      meaning: "Giờ",
      example: "It's been an hour.",
      exampleVi: "Đã một giờ rồi.",
    },
    {
      word: "minute",
      phonetic: "/ˈmɪnɪt/",
      meaning: "Phút",
      example: "Just a minute.",
      exampleVi: "Chỉ một chút.",
    },
    {
      word: "second",
      phonetic: "/ˈsekənd/",
      meaning: "Giây",
      example: "Wait a second.",
      exampleVi: "Đợi một giây.",
    },
    {
      word: "early",
      phonetic: "/ˈɜːrli/",
      meaning: "Sớm",
      example: "I'm early.",
      exampleVi: "Tôi đến sớm.",
    },
    {
      word: "late",
      phonetic: "/leɪt/",
      meaning: "Muộn",
      example: "I'm sorry I'm late.",
      exampleVi: "Xin lỗi tôi đến muộn.",
    },
    {
      word: "on time",
      phonetic: "/ɒn taɪm/",
      meaning: "Đúng giờ",
      example: "Be there on time.",
      exampleVi: "Hãy đến đúng giờ.",
    },
    {
      word: "schedule",
      phonetic: "/ˈskedʒuːl/",
      meaning: "Lịch trình",
      example: "What's your schedule?",
      exampleVi: "Lịch trình của bạn như thế nào?",
    },
    {
      word: "appointment",
      phonetic: "/əˈpɔɪntmənt/",
      meaning: "Cuộc hẹn",
      example: "I have an appointment.",
      exampleVi: "Tôi có một cuộc hẹn.",
    },
  ],
  numbers: [
    {
      word: "one",
      phonetic: "/wʌn/",
      meaning: "Một",
      example: "One, two, three...",
      exampleVi: "Một, hai, ba...",
    },
    {
      word: "two",
      phonetic: "/tuː/",
      meaning: "Hai",
      example: "Two please.",
      exampleVi: "Hai cái.",
    },
    {
      word: "three",
      phonetic: "/θriː/",
      meaning: "Ba",
      example: "Three is enough.",
      exampleVi: "Ba là đủ.",
    },
    {
      word: "five",
      phonetic: "/faɪv/",
      meaning: "Năm",
      example: "Give me five.",
      exampleVi: "Đếm đến năm.",
    },
    {
      word: "ten",
      phonetic: "/ten/",
      meaning: "Mười",
      example: "Count to ten.",
      exampleVi: "Đếm đến mười.",
    },
    {
      word: "twenty",
      phonetic: "/ˈtwenti/",
      meaning: "Hai mươi",
      example: "I'm twenty years old.",
      exampleVi: "Tôi hai mươi tuổi.",
    },
    {
      word: "hundred",
      phonetic: "/ˈhʌndrəd/",
      meaning: "Trăm",
      example: "One hundred dollars.",
      exampleVi: "Một trăm đô la.",
    },
    {
      word: "thousand",
      phonetic: "/ˈθaʊzənd/",
      meaning: "Nghìn",
      example: "A thousand times.",
      exampleVi: "Một nghìn lần.",
    },
    {
      word: "million",
      phonetic: "/ˈmɪljən/",
      meaning: "Triệu",
      example: "One million.",
      exampleVi: "Một triệu.",
    },
    {
      word: "first",
      phonetic: "/fɜːrst/",
      meaning: "Đầu tiên",
      example: "You're first.",
      exampleVi: "Bạn là người đầu tiên.",
    },
    {
      word: "second",
      phonetic: "/ˈsekənd/",
      meaning: "Thứ hai",
      example: "I'm second.",
      exampleVi: "Tôi là người thứ hai.",
    },
    {
      word: "last",
      phonetic: "/læst/",
      meaning: "Cuối cùng",
      example: "This is the last one.",
      exampleVi: "Đây là cái cuối cùng.",
    },
    {
      word: "next",
      phonetic: "/nekst/",
      meaning: "Tiếp theo",
      example: "What's next?",
      exampleVi: "Tiếp theo là gì?",
    },
    {
      word: "half",
      phonetic: "/hæf/",
      meaning: "Nửa",
      example: "Half of it.",
      exampleVi: "Nửa của nó.",
    },
    {
      word: "double",
      phonetic: "/ˈdʌbl/",
      meaning: "Gấp đôi",
      example: "I want a double.",
      exampleVi: "Tôi muốn gấp đôi.",
    },
    {
      word: "pair",
      phonetic: "/per/",
      meaning: "Đôi",
      example: "A pair of shoes.",
      exampleVi: "Một đôi giày.",
    },
    {
      word: "dozen",
      phonetic: "/ˈdʌzn/",
      meaning: "Tá",
      example: "A dozen eggs.",
      exampleVi: "Một tá trứng.",
    },
    {
      word: "percent",
      phonetic: "/pərˈsent/",
      meaning: "Phần trăm",
      example: "Ten percent off.",
      exampleVi: "Giảm mười phần trăm.",
    },
  ],
  feelings: [
    {
      word: "happy",
      phonetic: "/ˈhæpi/",
      meaning: "Vui vẻ",
      example: "I'm happy.",
      exampleVi: "Tôi vui vẻ.",
    },
    {
      word: "sad",
      phonetic: "/sæd/",
      meaning: "Buồn",
      example: "Don't be sad.",
      exampleVi: "Đừng buồn.",
    },
    {
      word: "angry",
      phonetic: "/ˈæŋɡri/",
      meaning: "Tức giận",
      example: "I'm angry.",
      exampleVi: "Tôi đang tức giận.",
    },
    {
      word: "excited",
      phonetic: "/ɪkˈsaɪtɪd/",
      meaning: "Hào hứng",
      example: "I'm excited!",
      exampleVi: "Tôi rất hào hứng!",
    },
    {
      word: "tired",
      phonetic: "/ˈtaɪərd/",
      meaning: "Mệt mỏi",
      example: "I'm so tired.",
      exampleVi: "Tôi mệt quá.",
    },
    {
      word: "stressed",
      phonetic: "/strest/",
      meaning: "Căng thẳng",
      example: "I'm stressed.",
      exampleVi: "Tôi đang căng thẳng.",
    },
    {
      word: "worried",
      phonetic: "/ˈwʌrid/",
      meaning: "Lo lắng",
      example: "Don't worry.",
      exampleVi: "Đừng lo lắng.",
    },
    {
      word: "confused",
      phonetic: "/kənˈfjuːzd/",
      meaning: "Bối rối",
      example: "I'm confused.",
      exampleVi: "Tôi bối rối.",
    },
    {
      word: "surprised",
      phonetic: "/sərˈpraɪzd/",
      meaning: "Ngạc nhiên",
      example: "I'm surprised!",
      exampleVi: "Tôi ngạc nhiên!",
    },
    {
      word: "proud",
      phonetic: "/praʊd/",
      meaning: "Tự hào",
      example: "I'm proud of you.",
      exampleVi: "Tôi tự hào về bạn.",
    },
    {
      word: "nervous",
      phonetic: "/ˈnɜːrvəs/",
      meaning: "Hồi hộp",
      example: "I'm nervous.",
      exampleVi: "Tôi hồi hộp.",
    },
    {
      word: "bored",
      phonetic: "/bɔːrd/",
      meaning: "Chán",
      example: "I'm bored.",
      exampleVi: "Tôi chán.",
    },
    {
      word: "grateful",
      phonetic: "/ˈɡreɪtfl/",
      meaning: "Biết ơn",
      example: "I'm grateful.",
      exampleVi: "Tôi biết ơn.",
    },
    {
      word: "relaxed",
      phonetic: "/rɪˈlækst/",
      meaning: "Thư giãn",
      example: "I feel relaxed.",
      exampleVi: "Tôi cảm thấy thư giãn.",
    },
    {
      word: "hopeful",
      phonetic: "/ˈhoʊpfl/",
      meaning: "Hy vọng",
      example: "I'm hopeful.",
      exampleVi: "Tôi hy vọng.",
    },
    {
      word: "disappointed",
      phonetic: "/ˌdɪsəˈpɔɪntɪd/",
      meaning: "Thất vọng",
      example: "I'm disappointed.",
      exampleVi: "Tôi thất vọng.",
    },
    {
      word: "jealous",
      phonetic: "/ˈdʒeləs/",
      meaning: "Ghen tị",
      example: "Don't be jealous.",
      exampleVi: "Đừng ghen tị.",
    },
    {
      word: "lonely",
      phonetic: "/ˈloʊnli/",
      meaning: "Cô đơn",
      example: "I feel lonely.",
      exampleVi: "Tôi cảm thấy cô đơn.",
    },
  ],
  family: [
    {
      word: "mother",
      phonetic: "/ˈmʌðər/",
      meaning: "Mẹ",
      example: "My mother is kind.",
      exampleVi: "Mẹ tôi dịu dàng.",
    },
    {
      word: "father",
      phonetic: "/ˈfɑːðər/",
      meaning: "Cha",
      example: "My father works hard.",
      exampleVi: "Cha tôi làm việc chăm chỉ.",
    },
    {
      word: "brother",
      phonetic: "/ˈbrʌðər/",
      meaning: "Anh em trai",
      example: "My brother is tall.",
      exampleVi: "Anh tôi cao.",
    },
    {
      word: "sister",
      phonetic: "/ˈsɪstər/",
      meaning: "Chị em gái",
      example: "My sister is smart.",
      exampleVi: "Chị tôi thông minh.",
    },
    {
      word: "parents",
      phonetic: "/ˈperənts/",
      meaning: "Bố mẹ",
      example: "My parents are home.",
      exampleVi: "Bố mẹ tôi ở nhà.",
    },
    {
      word: "children",
      phonetic: "/ˈtʃɪldrən/",
      meaning: "Con cái",
      example: "We have three children.",
      exampleVi: "Chúng tôi có ba con.",
    },
    {
      word: "son",
      phonetic: "/sʌn/",
      meaning: "Con trai",
      example: "My son is cute.",
      exampleVi: "Con trai tôi dễ thương.",
    },
    {
      word: "daughter",
      phonetic: "/ˈdɔːtər/",
      meaning: "Con gái",
      example: "My daughter is smart.",
      exampleVi: "Con gái tôi thông minh.",
    },
    {
      word: "grandparents",
      phonetic: "/ˈɡrænperənts/",
      meaning: "Ông bà",
      example: "I visit my grandparents.",
      exampleVi: "Tôi thăm ông bà.",
    },
    {
      word: "uncle",
      phonetic: "/ˈʌŋkl/",
      meaning: "Chú, bác",
      example: "My uncle is funny.",
      exampleVi: "Chú tôi vui vẻ.",
    },
    {
      word: "aunt",
      phonetic: "/ænt/",
      meaning: "Cô, dì",
      example: "My aunt is here.",
      exampleVi: "Cô tôi ở đây.",
    },
    {
      word: "cousin",
      phonetic: "/ˈkʌzn/",
      meaning: "Anh chị em họ",
      example: "My cousin is my age.",
      exampleVi: "Anh họ tôi cùng tuổi.",
    },
    {
      word: "married",
      phonetic: "/ˈmærid/",
      meaning: "Đã kết hôn",
      example: "Are you married?",
      exampleVi: "Bạn đã kết hôn chưa?",
    },
    {
      word: "single",
      phonetic: "/ˈsɪŋɡl/",
      meaning: "Độc thân",
      example: "I'm single.",
      exampleVi: "Tôi độc thân.",
    },
    {
      word: "divorced",
      phonetic: "/dɪˈvɔːrst/",
      meaning: "Ly dị",
      example: "They are divorced.",
      exampleVi: "Họ đã ly dị.",
    },
    {
      word: "widowed",
      phonetic: "/ˈwɪdoʊd/",
      meaning: "Góa phụ",
      example: "She is widowed.",
      exampleVi: "Bà ấy góa phụ.",
    },
    {
      word: "family",
      phonetic: "/ˈfæməli/",
      meaning: "Gia đình",
      example: "Family is important.",
      exampleVi: "Gia đình quan trọng.",
    },
    {
      word: "relatives",
      phonetic: "/ˈrelətɪvz/",
      meaning: "Họ hàng",
      example: "Visit relatives.",
      exampleVi: "Thăm họ hàng.",
    },
  ],
};

// Grammar data for business English
const GRAMMAR_DATA = {
  tenses: [
    {
      title: "Present Perfect",
      formula: "S + have/has + V3",
      usage:
        "Dùng để diễn tả hành động bắt đầu trong quá khứ và vẫn còn liên quan đến hiện tại",
      example: "We have completed the project.",
      exampleVi: "Chúng tôi đã hoàn thành dự án.",
      note: "Thường dùng với: already, yet, just, recently, for, since",
    },
    {
      title: "Present Perfect Continuous",
      formula: "S + have/has + been + V-ing",
      usage: "Nhấn mạnh sự tiếp tục của hành động từ quá khứ đến hiện tại",
      example: "I have been working on this report all morning.",
      exampleVi: "Tôi đã làm báo cáo này suốt buổi sáng.",
    },
    {
      title: "Future Perfect",
      formula: "S + will + have + V3",
      usage: "Hành động sẽ hoàn thành trước một thời điểm trong tương lai",
      example: "By next month, we will have launched the product.",
      exampleVi: "Đến tháng sau, chúng tôi sẽ đã ra mắt sản phẩm.",
    },
    {
      title: "Past Perfect",
      formula: "S + had + V3",
      usage: "Hành động đã hoàn thành trước một thời điểm trong quá khứ",
      example: "By the time I arrived, the meeting had started.",
      exampleVi: "Khi tôi đến, cuộc họp đã bắt đầu.",
    },
    {
      title: "Present Simple",
      formula: "S + V(s/es)",
      usage: "Thói quen, sự thật, lịch trình",
      example: "The company opens at 9 AM every day.",
      exampleVi: "Công ty mở cửa lúc 9 giờ sáng hàng ngày.",
    },
  ],
  conditionals: [
    {
      title: "Zero Conditional",
      formula: "If + Present Simple, Present Simple",
      usage: "Sự thật luôn đúng, quy luật tự nhiên",
      example: "If you heat water to 100°C, it boils.",
      exampleVi: "Nếu bạn đun nước đến 100°C, nó sôi.",
    },
    {
      title: "First Conditional",
      formula: "If + Present Simple, Will + V",
      usage: "Khả năng cao xảy ra trong tương lai",
      example: "If we get approval, we'll start immediately.",
      exampleVi: "Nếu chúng tôi được chấp thuận, chúng tôi sẽ bắt đầu ngay.",
    },
    {
      title: "Second Conditional",
      formula: "If + Past Simple, Would + V",
      usage: "Tình huống giả định, ít có khả năng xảy ra",
      example: "If I had more budget, I would hire more staff.",
      exampleVi: "Nếu tôi có thêm ngân sách, tôi sẽ tuyển thêm nhân viên.",
    },
    {
      title: "Third Conditional",
      formula: "If + Past Perfect, Would have + V3",
      usage: "Nói về điều không thể thay đổi trong quá khứ",
      example: "If we had planned better, we would have succeeded.",
      exampleVi:
        "Nếu chúng tôi đã lập kế hoạch tốt hơn, chúng tôi đã thành công.",
    },
    {
      title: "Mixed Conditional",
      formula: "If + Past Perfect, would + V (nguyên mẫu)",
      usage: "Kết hợp điều kiện từ quá khứ với kết quả hiện tại",
      example: "If I had studied harder, I would have a better job now.",
      exampleVi:
        "Nếu tôi đã học chăm chỉ hơn, bây giờ tôi sẽ có công việc tốt hơn.",
    },
  ],
  passive: [
    {
      title: "Passive Voice - Present Simple",
      formula: "S + am/is/are + V3 (by...)",
      usage: "Khi người thực hiện không quan trọng hoặc không xác định",
      example: "The report is reviewed by the manager.",
      exampleVi: "Báo cáo được quản lý xem xét.",
    },
    {
      title: "Passive Voice - Past Simple",
      formula: "S + was/were + V3 (by...)",
      usage:
        "Sự việc đã xảy ra trong quá khứ, người thực hiện không cần nhấn mạnh",
      example: "The contract was signed yesterday.",
      exampleVi: "Hợp đồng đã được ký hôm qua.",
    },
    {
      title: "Passive Voice - Future",
      formula: "S + will be + V3 (by...)",
      usage: "Hành động sẽ được thực hiện trong tương lai",
      example: "The decision will be announced next week.",
      exampleVi: "Quyết định sẽ được công bố vào tuần sau.",
    },
    {
      title: "Passive Voice - Present Continuous",
      formula: "S + am/is/are + being + V3",
      usage: "Hành động đang được thực hiện tại thời điểm nói",
      example: "The report is being reviewed by the manager.",
      exampleVi: "Báo cáo đang được quản lý xem xét.",
    },
    {
      title: "Passive Voice - Present Perfect",
      formula: "S + have/has + been + V3",
      usage: "Hành động đã hoàn thành và có kết quả liên quan đến hiện tại",
      example: "The project has been completed successfully.",
      exampleVi: "Dự án đã được hoàn thành thành công.",
    },
  ],
  modal: [
    {
      title: "Must / Have to",
      formula: "S + must/have to + V",
      usage: "Phải làm gì (bắt buộc)",
      example: "We must submit the report by Friday.",
      exampleVi: "Chúng tôi phải nộp báo cáo trước thứ Sáu.",
    },
    {
      title: "Should / Shouldn't",
      formula: "S + should/shouldn't + V",
      usage: "Nên / Không nên",
      example: "You should discuss this with your team.",
      exampleVi: "Bạn nên thảo luận điều này với nhóm của bạn.",
    },
    {
      title: "Could / Might",
      formula: "S + could/might + V",
      usage: "Có thể (khả năng)",
      example: "We might need more time to complete.",
      exampleVi: "Chúng tôi có thể cần thêm thời gian để hoàn thành.",
    },
    {
      title: "May",
      formula: "S + may + V",
      usage: "Xin phép hoặc khả năng",
      example: "May I schedule a meeting for tomorrow?",
      exampleVi: "Tôi có thể lên lịch họp cho ngày mai không?",
    },
    {
      title: "Mustn't vs Don't have to",
      formula: "Mustn't = không được / Don't have to = không cần",
      usage: "Phân biệt giữa cấm và không bắt buộc",
      example:
        "You mustn't share this information. / You don't have to attend the meeting.",
      exampleVi:
        "Bạn không được chia sẻ thông tin này. / Bạn không cần dự cuộc họp.",
    },
    {
      title: "Will vs Would (yêu cầu lịch sự)",
      formula: "Will you + V? / Would you + V?",
      usage: "Would lịch sự hơn Will trong yêu cầu",
      example:
        "Will you send me the report? / Would you mind sending the report?",
      exampleVi:
        "Bạn sẽ gửi cho tôi báo cáo chứ? / Bạn có phiền gửi báo cáo không?",
    },
  ],
  reported: [
    {
      title: "Reported Speech - Present Simple",
      formula: "said that + S + V (past)",
      usage: "Chuyển câu trực tiếp sang gián tiếp",
      example:
        "He said, 'The project is complete.' → He said that the project was complete.",
      exampleVi:
        "Anh ấy nói, 'Dự án đã hoàn thành.' → Anh ấy nói rằng dự án đã hoàn thành.",
    },
    {
      title: "Reported Speech - Commands",
      formula: "told + O + to + V",
      usage: "Chuyển mệnh lệnh sang gián tiếp",
      example:
        "She said, 'Please submit the report.' → She told me to submit the report.",
      exampleVi:
        "Cô ấy nói, 'Vui lòng nộp báo cáo.' → Cô ấy bảo tôi nộp báo cáo.",
    },
    {
      title: "Reported Speech - Questions",
      formula: "asked + if/whether + S + V",
      usage: "Chuyển câu hỏi sang gián tiếp",
      example:
        "'Did you finish the report?' → He asked if I had finished the report.",
      exampleVi:
        "'Bạn đã hoàn thành báo cáo chưa?' → Anh ấy hỏi liệu tôi đã hoàn thành báo cáo chưa.",
    },
  ],
  relative: [
    {
      title: "Defining Relative Clause",
      formula: "who/which/that + clause",
      usage: "Mệnh đề quan trọng, không thể bỏ",
      example: "The employee who works the hardest gets the promotion.",
      exampleVi: "Nhân viên làm việc chăm chỉ nhất được thăng chức.",
    },
    {
      title: "Non-Defining Relative Clause",
      formula: "who/which/that (có dấu phẩy)",
      usage: "Mệnh đề bổ sung, có thể bỏ",
      example: "Mr. Smith, who is the CEO, will attend the meeting.",
      exampleVi: "Ông Smith, người là CEO, sẽ tham dự cuộc họp.",
    },
    {
      title: "Relative Pronouns - People",
      formula: "who / whom / that",
      usage: "Dùng cho người",
      example: "The manager who approved the budget is on leave.",
      exampleVi: "Quản lý người đã phê duyệt ngân sách đang nghỉ.",
    },
    {
      title: "Relative Pronouns - Things",
      formula: "which / that",
      usage: "Dùng cho vật/sự vật",
      example: "The report which I mentioned is on your desk.",
      exampleVi: "Báo cáo mà tôi đề cập nằm trên bàn của bạn.",
    },
    {
      title: "Whose",
      formula: "whose + noun",
      usage: "Chỉ sở hữu cho cả người và vật",
      example: "The company whose profits increased hired new staff.",
      exampleVi: "Công ty có lợi nhuận tăng đã tuyển nhân viên mới.",
    },
  ],
};

// Phrases data for business communication
const PHRASES_DATA = {
  greeting: [
    // Short phrases
    { phrase: "Hi there!", situation: "Chào hỏi", meaning: "Này!" },
    { phrase: "Hey!", situation: "Chào", meaning: "Này!" },
    {
      phrase: "Good morning!",
      situation: "Chào buổi sáng",
      meaning: "Chào buổi sáng!",
    },
    {
      phrase: "Good afternoon!",
      situation: "Chào buổi chiều",
      meaning: "Chào buổi chiều!",
    },
    {
      phrase: "Good evening!",
      situation: "Chào buổi tối",
      meaning: "Chào buổi tối!",
    },
    {
      phrase: "How's it going?",
      situation: "Dạo này sao?",
      meaning: "Dạo này thế nào?",
    },
    {
      phrase: "How are you?",
      situation: "Bạn khỏe không?",
      meaning: "Bạn khỏe không?",
    },
    {
      phrase: "What's up?",
      situation: "Có gì mới?",
      meaning: "Có gì mới không?",
    },
    {
      phrase: "Nice to see you!",
      situation: "Rất vui gặp bạn!",
      meaning: "Rất vui gặp bạn!",
    },
    {
      phrase: "Long time no see!",
      situation: "Lâu rồi không gặp",
      meaning: "Lâu rồi không gặp!",
    },
    {
      phrase: "Hope you're doing well.",
      situation: "Hy vọng bạn ổn",
      meaning: "Hy vọng bạn vẫn ổn.",
    },
    {
      phrase: "Hope this finds you well.",
      situation: "Email mở đầu",
      meaning: "Hy vọng bạn khỏe mạnh.",
    },
    {
      phrase: "Thank you for your time.",
      situation: "Cảm ơn đã dành thời gian",
      meaning: "Cảm ơn bạn đã dành thời gian.",
    },
    {
      phrase: "Thanks for meeting.",
      situation: "Cảm ơn đã gặp",
      meaning: "Cảm ơn đã gặp mặt.",
    },
    {
      phrase: "Hope you had a great weekend!",
      situation: "Chúc cuối tuần vui",
      meaning: "Chúc bạn cuối tuần vui vẻ!",
    },
    {
      phrase: "Welcome back!",
      situation: "Chào mừng quay lại",
      meaning: "Chào mừng quay lại!",
    },
  ],
  goodbye: [
    { phrase: "See you!", situation: "Tạm biệt", meaning: "Hẹn gặp lại!" },
    {
      phrase: "See you later!",
      situation: "Hẹn gặp sau",
      meaning: "Hẹn gặp sau nhé!",
    },
    {
      phrase: "Talk to you soon.",
      situation: "Sớm nói chuyện",
      meaning: "Sớm nói chuyện với bạn.",
    },
    {
      phrase: "Have a good one!",
      situation: "Chúc tốt lành",
      meaning: "Chúc tốt lành!",
    },
    {
      phrase: "Take care!",
      situation: "Giữ gìn sức khỏe",
      meaning: "Giữ gìn sức khỏe nhé!",
    },
    { phrase: "Bye for now!", situation: "Tạm biệt", meaning: "Tạm biệt nhé!" },
    {
      phrase: "Keep in touch!",
      situation: "Giữ liên lạc",
      meaning: "Giữ liên lạc nhé!",
    },
    {
      phrase: "It was great talking to you.",
      situation: "Rất vui được nói chuyện",
      meaning: "Rất vui được nói chuyện với bạn.",
    },
    {
      phrase: "Looking forward to hearing from you.",
      situation: "Mong phản hồi",
      meaning: "Mong sớm nhận được phản hồi.",
    },
    {
      phrase: "Best regards.",
      situation: "Trân trọng",
      meaning: "Trân trọng.",
    },
    {
      phrase: "Kind regards.",
      situation: "Kính trọng",
      meaning: "Kính trọng.",
    },
    {
      phrase: "Warm regards.",
      situation: "Chào thân mật",
      meaning: "Chào thân mật.",
    },
    {
      phrase: "All the best!",
      situation: "Mọi điều tốt đẹp",
      meaning: "Mọi điều tốt đẹp!",
    },
  ],
  thanks: [
    { phrase: "Thanks!", situation: "Cảm ơn", meaning: "Cảm ơn!" },
    { phrase: "Thank you!", situation: "Cảm ơn bạn", meaning: "Cảm ơn bạn!" },
    {
      phrase: "Thanks a lot!",
      situation: "Cảm ơn nhiều",
      meaning: "Cảm ơn nhiều!",
    },
    {
      phrase: "Thank you so much!",
      situation: "Cảm ơn rất nhiều",
      meaning: "Cảm ơn bạn rất nhiều!",
    },
    {
      phrase: "I appreciate it.",
      situation: "Tôi trân trọng",
      meaning: "Tôi rất trân trọng điều này.",
    },
    {
      phrase: "Much appreciated!",
      situation: "Rất biết ơn",
      meaning: "Rất biết ơn!",
    },
    {
      phrase: "Thanks for your help.",
      situation: "Cảm ơn đã giúp",
      meaning: "Cảm ơn đã giúp đỡ.",
    },
    {
      phrase: "Thanks for getting back to me.",
      situation: "Cảm ơn đã phản hồi",
      meaning: "Cảm ơn đã phản hồi.",
    },
    {
      phrase: "I really appreciate your help.",
      situation: "Rất biết ơn sự giúp đỡ",
      meaning: "Tôi rất biết ơn sự giúp đỡ của bạn.",
    },
    {
      phrase: "Thanks for the update.",
      situation: "Cảm ơn đã cập nhật",
      meaning: "Cảm ơn đã cập nhật.",
    },
    {
      phrase: "Thank you for your patience.",
      situation: "Cảm ơn đã kiên nhẫn",
      meaning: "Cảm ơn đã kiên nhẫn.",
    },
    {
      phrase: "Thanks for understanding.",
      situation: "Cảm ơn đã thấu hiểu",
      meaning: "Cảm ơn đã thấu hiểu.",
    },
  ],
  request: [
    {
      phrase: "Can you help me?",
      situation: "Bạn giúp được không?",
      meaning: "Bạn có thể giúp tôi không?",
    },
    {
      phrase: "Could you...?",
      situation: "Bạn có thể...?",
      meaning: "Bạn có thể...?",
    },
    {
      phrase: "Would you mind...?",
      situation: "Bạn có phiền...?",
      meaning: "Bạn có phiền...?",
    },
    {
      phrase: "Can I ask a favor?",
      situation: "Nhờ giúp một việc",
      meaning: "Tôi có thể nhờ giúp một việc không?",
    },
    {
      phrase: "I need your help.",
      situation: "Tôi cần giúp đỡ",
      meaning: "Tôi cần bạn giúp đỡ.",
    },
    {
      phrase: "Please send me...",
      situation: "Gửi cho tôi...",
      meaning: "Vui lòng gửi cho tôi...",
    },
    {
      phrase: "Could you check this?",
      situation: "Kiểm tra giúp",
      meaning: "Bạn có thể kiểm tra điều này không?",
    },
    {
      phrase: "Can we schedule a call?",
      situation: "Sắp xếp cuộc gọi",
      meaning: "Chúng ta có thể sắp xếp một cuộc gọi không?",
    },
    {
      phrase: "I was wondering if...",
      situation: "Tôi đang tự hỏi liệu...",
      meaning: "Tôi đang tự hỏi liệu...",
    },
    {
      phrase: "Is it possible to...?",
      situation: "Có thể...?",
      meaning: "Có thể...?",
    },
    {
      phrase: "Would it be okay if...?",
      situation: "Có ổn không nếu...?",
      meaning: "Có ổn không nếu...?",
    },
    {
      phrase: "I'd like to request...",
      situation: "Tôi muốn yêu cầu...",
      meaning: "Tôi muốn yêu cầu...",
    },
  ],
  agreement: [
    { phrase: "Sure!", situation: "Được chứ!", meaning: "Được chứ!" },
    { phrase: "No problem!", situation: "Không sao!", meaning: "Không sao!" },
    {
      phrase: "Sounds good!",
      situation: "Nghe hay đấy!",
      meaning: "Nghe hay đấy!",
    },
    { phrase: "I agree.", situation: "Tôi đồng ý", meaning: "Tôi đồng ý." },
    { phrase: "That's fine.", situation: "Được đấy", meaning: "Được đấy." },
    { phrase: "Perfect!", situation: "Hoàn hảo!", meaning: "Hoàn hảo!" },
    {
      phrase: "Absolutely!",
      situation: "Hoàn toàn đồng ý!",
      meaning: "Hoàn toàn đồng ý!",
    },
    {
      phrase: "Count me in!",
      situation: "Tính tôi vào!",
      meaning: "Tính tôi vào!",
    },
    { phrase: "Let's do it!", situation: "Làm thôi!", meaning: "Làm thôi!" },
    { phrase: "Deal!", situation: "Deal!", meaning: "Thỏa thuận!" },
    { phrase: "You got it!", situation: "Được rồi!", meaning: "Được rồi!" },
    { phrase: "I'm in!", situation: "Tôi tham gia!", meaning: "Tôi tham gia!" },
    {
      phrase: "We are on the same page.",
      situation: "Cùng chung quan điểm",
      meaning: "Chúng ta cùng chung quan điểm.",
    },
    {
      phrase: "That's a great idea!",
      situation: "Ý hay đấy!",
      meaning: "Đó là một ý hay!",
    },
  ],
  disagreement: [
    {
      phrase: "I'm not sure.",
      situation: "Tôi không chắc",
      meaning: "Tôi không chắc.",
    },
    {
      phrase: "I see it differently.",
      situation: "Tôi nghĩ khác",
      meaning: "Tôi nhìn nhận khác.",
    },
    {
      phrase: "I have concerns.",
      situation: "Tôi có lo ngại",
      meaning: "Tôi có một số lo ngại.",
    },
    {
      phrase: "That's not ideal.",
      situation: "Không lý tưởng",
      meaning: "Đó không phải là lý tưởng.",
    },
    {
      phrase: "I don't think that will work.",
      situation: "Không khả thi",
      meaning: "Tôi không nghĩ điều đó sẽ hiệu quả.",
    },
    {
      phrase: "We might need to reconsider.",
      situation: "Cần xem xét lại",
      meaning: "Chúng ta có thể cần xem xét lại.",
    },
    {
      phrase: "I see your point, but...",
      situation: "Hiểu ý bạn, nhưng...",
      meaning: "Tôi hiểu ý bạn, nhưng...",
    },
    {
      phrase: "Let's find a middle ground.",
      situation: "Tìm giải pháp trung gian",
      meaning: "Hãy tìm giải pháp trung gian.",
    },
    {
      phrase: "I respectfully disagree.",
      situation: "Không đồng ý",
      meaning: "Tôi kính trọng không đồng ý.",
    },
    {
      phrase: "That might not work.",
      situation: "Có thể không ổn",
      meaning: "Điều đó có thể không ổn.",
    },
  ],
  apology: [
    { phrase: "Sorry!", situation: "Xin lỗi!", meaning: "Xin lỗi!" },
    { phrase: "My bad!", situation: "Lỗi của tôi!", meaning: "Lỗi của tôi!" },
    { phrase: "I'm sorry.", situation: "Tôi xin lỗi", meaning: "Tôi xin lỗi." },
    { phrase: "Oops!", situation: "Ồ!", meaning: "Ồ!" },
    { phrase: "My mistake!", situation: "Sai rồi!", meaning: "Sai rồi!" },
    {
      phrase: "I apologize.",
      situation: "Tôi xin lỗi",
      meaning: "Tôi xin lỗi.",
    },
    {
      phrase: "Sorry about that.",
      situation: "Xin lỗi về điều đó",
      meaning: "Xin lỗi về điều đó.",
    },
    { phrase: "My apologies.", situation: "Xin lỗi", meaning: "Xin lỗi." },
    {
      phrase: "I didn't mean to...",
      situation: "Tôi không có ý...",
      meaning: "Tôi không có ý...",
    },
    {
      phrase: "Please forgive me.",
      situation: "Xin hãy tha thứ",
      meaning: "Xin hãy tha thứ cho tôi.",
    },
    {
      phrase: "I'll make it right.",
      situation: "Tôi sẽ sửa chữa",
      meaning: "Tôi sẽ sửa chữa.",
    },
    {
      phrase: "Sorry for the inconvenience.",
      situation: "Xin lỗi bất tiện",
      meaning: "Xin lỗi về sự bất tiện.",
    },
  ],
  confirmation: [
    { phrase: "Got it!", situation: "Hiểu rồi!", meaning: "Hiểu rồi!" },
    { phrase: "Understood!", situation: "Đã hiểu!", meaning: "Đã hiểu!" },
    { phrase: "Copy that!", situation: "Nhận được!", meaning: "Nhận được!" },
    { phrase: "Will do!", situation: "Sẽ làm!", meaning: "Sẽ làm!" },
    { phrase: "On it!", situation: "Đang làm!", meaning: "Đang làm!" },
    { phrase: "Noted!", situation: "Đã ghi nhận!", meaning: "Đã ghi nhận!" },
    { phrase: "Makes sense.", situation: "Hợp lý", meaning: "Hợp lý." },
    { phrase: "I see.", situation: "Tôi hiểu", meaning: "Tôi hiểu." },
    {
      phrase: "Okay, got it.",
      situation: "Được rồi, hiểu",
      meaning: "Được rồi, tôi hiểu.",
    },
    {
      phrase: "I'll get right on it.",
      situation: "Sẽ làm ngay",
      meaning: "Tôi sẽ làm ngay.",
    },
    {
      phrase: "Leave it with me.",
      situation: "Để tôi lo",
      meaning: "Để tôi lo.",
    },
    {
      phrase: "Consider it done.",
      situation: "Coi như xong",
      meaning: "Coig như xong rồi.",
    },
  ],
  question: [
    {
      phrase: "Can I ask...?",
      situation: "Tôi hỏi được không...?",
      meaning: "Tôi hỏi được không...?",
    },
    {
      phrase: "Do you have a minute?",
      situation: "Bạn có thời gian không?",
      meaning: "Bạn có một chút thời gian không?",
    },
    {
      phrase: "Quick question:",
      situation: "Câu hỏi nhanh:",
      meaning: "Câu hỏi nhanh:",
    },
    {
      phrase: "Just curious,",
      situation: "Tò mò thôi,",
      meaning: "Tò mò thôi,",
    },
    {
      phrase: "Out of curiosity,",
      situation: "Để tìm hiểu,",
      meaning: "Để tìm hiểu,",
    },
    {
      phrase: "I was wondering...",
      situation: "Tôi đang tự hỏi...",
      meaning: "Tôi đang tự hỏi...",
    },
    {
      phrase: "Could you clarify?",
      situation: "Làm rõ giúp",
      meaning: "Bạn có thể làm rõ không?",
    },
    {
      phrase: "What do you think?",
      situation: "Bạn nghĩ sao?",
      meaning: "Bạn nghĩ sao?",
    },
    {
      phrase: "Does that make sense?",
      situation: "Hợp lý không?",
      meaning: "Điều đó có hợp lý không?",
    },
    {
      phrase: "Any questions?",
      situation: "Có câu hỏi không?",
      meaning: "Có câu hỏi gì không?",
    },
    {
      phrase: "Is everything clear?",
      situation: "Rõ ràng chứ?",
      meaning: "Mọi thứ rõ ràng chứ?",
    },
  ],
  meeting: [
    {
      phrase: "Let's start.",
      situation: "Bắt đầu thôi",
      meaning: "Hãy bắt đầu.",
    },
    {
      phrase: "Where were we?",
      situation: "Ở đâu rồi?",
      meaning: "Chúng ta đang ở đâu rồi?",
    },
    {
      phrase: "Back to the topic.",
      situation: "Quay lại chủ đề",
      meaning: "Quay lại chủ đề chính.",
    },
    {
      phrase: "Let's move on.",
      situation: "Chuyển tiếp",
      meaning: "Hãy chuyển tiếp.",
    },
    {
      phrase: "Any updates?",
      situation: "Có cập nhật gì?",
      meaning: "Có cập nhật gì không?",
    },
    {
      phrase: "Let's wrap up.",
      situation: "Kết thúc thôi",
      meaning: "Hãy kết thúc thôi.",
    },
    { phrase: "Who's next?", situation: "Ai tiếp?", meaning: "Ai tiếp theo?" },
    {
      phrase: "Let's take notes.",
      situation: "Ghi chép thôi",
      meaning: "Hãy ghi chép.",
    },
    {
      phrase: "Action items?",
      meaning: "Việc cần làm?",
      meaning: "Có việc gì cần làm không?",
    },
    {
      phrase: "Next steps?",
      situation: "Bước tiếp theo?",
      meaning: "Bước tiếp theo là gì?",
    },
    {
      phrase: "Let's revisit this later.",
      situation: " Quay lại sau",
      meaning: "Hãy quay lại vấn đề này sau.",
    },
    {
      phrase: "Are we aligned?",
      situation: "Cùng quan điểm chứ?",
      meaning: "Chúng ta cùng quan điểm chứ?",
    },
    {
      phrase: "Can we agree on...?",
      situation: "Thống nhất được không...?",
      meaning: "Chúng ta thống nhất được không...?",
    },
    {
      phrase: "Let's vote.",
      situation: "Bỏ phiếu thôi",
      meaning: "Hãy bỏ phiếu.",
    },
  ],
  email: [
    {
      phrase: "As discussed,",
      situation: "Như đã thảo luận,",
      meaning: "Như đã thảo luận,",
    },
    {
      phrase: "Per our conversation,",
      situation: "Theo cuộc trò chuyện,",
      meaning: "Theo cuộc trò chuyện của chúng ta,",
    },
    {
      phrase: "Please find attached.",
      situation: "File đính kèm",
      meaning: "Vui lòng xem file đính kèm.",
    },
    {
      phrase: "Following up on...",
      meaning: "Theo dõi...",
      meaning: "Theo dõi về...",
    },
    {
      phrase: "Just a reminder...",
      meaning: "Nhắc nhở...",
      meaning: "Chỉ là nhắc nhở...",
    },
    {
      phrase: "Quick heads-up...",
      meaning: "Thông báo nhanh...",
      meaning: "Thông báo nhanh...",
    },
    {
      phrase: "For your reference.",
      meaning: "Để bạn tham khảo",
      meaning: "Để bạn tham khảo.",
    },
    {
      phrase: "Please let me know.",
      meaning: "Cho tôi biết",
      meaning: "Vui lòng cho tôi biết.",
    },
    {
      phrase: "Feel free to reach out.",
      meaning: "Liên hệ thoải mái",
      meaning: "Liên hệ thoải mái nhé.",
    },
    { phrase: "Best regards,", meaning: "Trân trọng,", meaning: "Trân trọng," },
    {
      phrase: "Thanks in advance.",
      meaning: "Cảm ơn trước",
      meaning: "Cảm ơn trước.",
    },
    {
      phrase: "Looking forward to your reply.",
      meaning: "Mong phản hồi",
      meaning: "Mong nhận được phản hồi.",
    },
  ],
  telephone: [
    {
      phrase: "Thank you for calling.",
      situation: "Cảm ơn đã gọi",
      meaning: "Cảm ơn bạn đã gọi.",
    },
    {
      phrase: "How can I help?",
      situation: "Tôi giúp gì được?",
      meaning: "Tôi có thể giúp gì cho bạn?",
    },
    {
      phrase: "Who's calling, please?",
      situation: "Ai gọi vậy?",
      meaning: "Cho tôi xin tên người gọi?",
    },
    {
      phrase: "Please hold.",
      situation: "Đợi một chút",
      meaning: "Vui lòng đợi một chút.",
    },
    {
      phrase: "One moment, please.",
      situation: "Một chút thôi",
      meaning: "Một chút thôi nhé.",
    },
    {
      phrase: "Let me transfer you.",
      situation: "Chuyển cuộc gọi",
      meaning: "Để tôi chuyển cuộc gọi.",
    },
    {
      phrase: "He's not available.",
      situation: "Không có mặt",
      meaning: "Anh ấy hiện không có mặt.",
    },
    {
      phrase: "Can I take a message?",
      situation: "Nhắn tin được không?",
      meaning: "Tôi có thể nhận tin nhắn không?",
    },
    {
      phrase: "Please call back later.",
      situation: "Gọi lại sau",
      meaning: "Vui lòng gọi lại sau.",
    },
    {
      phrase: "The line is busy.",
      situation: "Đường dây bận",
      meaning: "Đường dây đang bận.",
    },
    {
      phrase: "Can you hear me?",
      situation: "Nghe rõ không?",
      meaning: "Bạn nghe rõ tôi không?",
    },
    {
      phrase: "You're on speaker.",
      situation: "Đang mở loa",
      meaning: "Tôi đang mở loa đấy.",
    },
  ],
  problem: [
    {
      phrase: "We have an issue.",
      situation: "Có vấn đề",
      meaning: "Chúng ta có một vấn đề.",
    },
    {
      phrase: "There's a problem.",
      situation: "Có lỗi",
      meaning: "Có một lỗi.",
    },
    {
      phrase: "It's not working.",
      situation: "Không hoạt động",
      meaning: "Nó không hoạt động.",
    },
    {
      phrase: "Something went wrong.",
      situation: "Có gì sai",
      meaning: "Có gì đó đã sai.",
    },
    {
      phrase: "We hit a snag.",
      situation: "Gặp trở ngại",
      meaning: "Chúng ta gặp trở ngại.",
    },
    {
      phrase: "This is urgent.",
      situation: "Khẩn cấp",
      meaning: "Đây là khẩn cấp.",
    },
    {
      phrase: "We need to fix this.",
      situation: "Cần sửa",
      meaning: "Chúng ta cần sửa điều này.",
    },
    {
      phrase: "Can you look into this?",
      situation: "Kiểm tra giúp",
      meaning: "Bạn có thể kiểm tra điều này không?",
    },
    {
      phrase: "This is critical.",
      situation: "Rất quan trọng",
      meaning: "Điều này rất quan trọng.",
    },
    {
      phrase: "We need a solution.",
      situation: "Cần giải pháp",
      meaning: "Chúng ta cần một giải pháp.",
    },
    {
      phrase: "How do we solve this?",
      situation: "Giải quyết sao?",
      meaning: "Chúng ta giải quyết điều này như thế nào?",
    },
    {
      phrase: "Let me check.",
      situation: "Để tôi kiểm tra",
      meaning: "Để tôi kiểm tra.",
    },
  ],
  celebration: [
    {
      phrase: "Great job!",
      situation: "Làm tốt lắm!",
      meaning: "Làm tốt lắm!",
    },
    { phrase: "Well done!", situation: "Xuất sắc!", meaning: "Xuất sắc!" },
    { phrase: "Congrats!", situation: "Chúc mừng!", meaning: "Chúc mừng!" },
    {
      phrase: "Congratulations!",
      situation: "Chúc mừng!",
      meaning: "Chúc mừng!",
    },
    {
      phrase: "Nice work!",
      situation: "Làm hay đấy!",
      meaning: "Làm hay đấy!",
    },
    { phrase: "Brilliant!", situation: "Tuyệt vời!", meaning: "Tuyệt vời!" },
    { phrase: "Awesome!", situation: "Tuyệt vời!", meaning: "Tuyệt vời!" },
    {
      phrase: "Happy birthday!",
      situation: "Chúc mừng sinh nhật!",
      meaning: "Chúc mừng sinh nhật!",
    },
    {
      phrase: "Happy holidays!",
      situation: "Chúc lễ vui!",
      meaning: "Chúc các ngày lễ vui vẻ!",
    },
    {
      phrase: "Good luck!",
      situation: "Chúc may mắn!",
      meaning: "Chúc may mắn!",
    },
    {
      phrase: "Break a leg!",
      situation: "May mắn!",
      meaning: "Chúc may mắn! (trước khi thi)",
    },
    {
      phrase: "Get well soon!",
      situation: "Chóng khỏe nhé!",
      meaning: "Chóng khỏe mạnh nhé!",
    },
  ],
  explanation: [
    {
      phrase: "Here's the thing:",
      situation: "Vấn đề là:",
      meaning: "Vấn đề là:",
    },
    {
      phrase: "The thing is...",
      situation: "Vấn đề là...",
      meaning: "Vấn đề là...",
    },
    {
      phrase: "Long story short,",
      situation: "Nói ngắn gọn,",
      meaning: "Nói ngắn gọn,",
    },
    {
      phrase: "To make a long story short...",
      situation: "Nói tóm lại...",
      meaning: "Nói tóm lại...",
    },
    {
      phrase: "In other words,",
      situation: "Nói cách khác,",
      meaning: "Nói cách khác,",
    },
    {
      phrase: "Let me explain:",
      situation: "Để tôi giải thích:",
      meaning: "Để tôi giải thích:",
    },
    {
      phrase: "To put it simply,",
      situation: "Nói đơn giản,",
      meaning: "Nói đơn giản,",
    },
    {
      phrase: "The bottom line is...",
      situation: "Kết quả là...",
      meaning: "Kết quả cuối cùng là...",
    },
    {
      phrase: "What I mean is...",
      meaning: "Ý tôi là...",
      meaning: "Ý tôi là...",
    },
    { phrase: "In short,", meaning: "Tóm lại,", meaning: "Tóm lại," },
    { phrase: "Basically,", meaning: "Về cơ bản,", meaning: "Về cơ bản," },
    {
      phrase: "Essentially,",
      meaning: "Về bản chất,",
      meaning: "Về bản chất,",
    },
  ],
  time: [
    {
      phrase: "As soon as possible",
      situation: "Sớm nhất có thể",
      meaning: "Sớm nhất có thể (ASAP)",
    },
    {
      phrase: "At your earliest convenience",
      situation: "Khi thuận tiện",
      meaning: "Khi bạn sớm thuận tiện nhất",
    },
    {
      phrase: "Right away",
      situation: "Ngay lập tức",
      meaning: "Ngay lập tức",
    },
    { phrase: "No rush", situation: "Không vội", meaning: "Không vội" },
    {
      phrase: "Whenever works for you",
      situation: "Bất cứ khi nào bạn thuận tiện",
      meaning: "Bất cứ khi nào bạn thuận tiện",
    },
    {
      phrase: "By end of day",
      situation: "Trước cuối ngày",
      meaning: "Trước cuối ngày làm việc",
    },
    {
      phrase: "By tomorrow",
      situation: "Trước ngày mai",
      meaning: "Trước ngày mai",
    },
    { phrase: "Next week", situation: "Tuần sau", meaning: "Tuần sau" },
    { phrase: "This week", situation: "Tuần này", meaning: "Tuần này" },
    {
      phrase: "Anytime",
      situation: "Bất cứ lúc nào",
      meaning: "Bất cứ lúc nào",
    },
    { phrase: "Later", situation: "Sau", meaning: "Sau" },
    { phrase: "Soon", situation: "Sớm", meaning: "Sớm" },
  ],
  followup: [
    {
      phrase: "Just checking in.",
      situation: "Kiểm tra tình hình",
      meaning: "Chỉ kiểm tra tình hình thôi.",
    },
    {
      phrase: "Any update?",
      situation: "Có gì mới không?",
      meaning: "Có cập nhật gì không?",
    },
    {
      phrase: "Following up.",
      situation: "Theo dõi",
      meaning: "Theo dõi thôi.",
    },
    {
      phrase: "Just wanted to follow up.",
      situation: "Muốn theo dõi",
      meaning: "Tôi chỉ muốn theo dõi.",
    },
    {
      phrase: "How's it going?",
      situation: "Tiến triển sao?",
      meaning: "Mọi thứ tiến triển sao?",
    },
    {
      phrase: "Any progress?",
      situation: "Có tiến triển gì không?",
      meaning: "Có tiến triển gì không?",
    },
    {
      phrase: "Just a quick follow-up.",
      situation: "Theo dõi nhanh",
      meaning: "Chỉ là theo dõi nhanh thôi.",
    },
    {
      phrase: "Wanted to check on this.",
      situation: "Kiểm tra việc này",
      meaning: "Muốn kiểm tra việc này.",
    },
  ],
};

// Learning state variables
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

// Initialize all vocabulary
function getAllVocabulary() {
  return Object.values(VOCABULARY_DATA).flat();
}

// Initialize all grammar
function getAllGrammar() {
  return Object.values(GRAMMAR_DATA).flat();
}

// Initialize all phrases
function getAllPhrases() {
  return Object.values(PHRASES_DATA).flat();
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
    // Check if input is Vietnamese (contains Vietnamese characters)
    const isVietnamese =
      /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(
        query,
      );

    let searchQuery = query;
    let translatedQuery = null;

    // If Vietnamese input, translate to English first
    if (isVietnamese) {
      translatedQuery = await translateViToEn(query);
      if (translatedQuery) {
        searchQuery = translatedQuery;
      }
    }

    // First search local data (search both original and translated)
    const localResults = searchLocalVocabulary(query, translatedQuery);

    // Then search API with English query
    const response = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(searchQuery)}`,
    );

    if (response.ok) {
      const data = await response.json();
      // Fetch translations for API results
      displayAPIVocabularyResultsWithTranslation(
        data,
        localResults,
        query,
        translatedQuery,
      );
    } else {
      // No API results, show local only
      const wrapper = document.getElementById("vocabSearchResultsWrapper");
      if (localResults.length > 0) {
        displayLocalVocabularyResults(localResults, translatedQuery);
      } else {
        resultsContainer.innerHTML = getNoResultsHTML();
        wrapper.classList.remove("has-results");
      }
    }
  } catch (error) {
    // Fallback to local results only
    const wrapper = document.getElementById("vocabSearchResultsWrapper");
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

// Translate Vietnamese to English
async function translateViToEn(text) {
  try {
    const response = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=vi|en`,
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
  try {
    const response = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|vi`,
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

function searchLocalVocabulary(query, translatedQuery = null) {
  const allVocab = getAllVocabulary();
  const searchTerms = [query];
  if (translatedQuery) searchTerms.push(translatedQuery.toLowerCase());

  return allVocab.filter((item) =>
    searchTerms.some(
      (term) =>
        item.word.toLowerCase().includes(term) ||
        item.meaning.toLowerCase().includes(term),
    ),
  );
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

  // If there was a Vietnamese input, show header
  let headerHtml = "";
  if (translatedQuery) {
    headerHtml = `<div style="padding:12px 16px;background:linear-gradient(135deg,var(--accent),#8b5cf6);color:white;border-radius:8px;margin:12px 16px 8px;">
      <div style="font-size:12px;opacity:0.9;">Từ tiếng Việt:</div>
      <div style="font-size:18px;font-weight:600;margin-top:4px;">${results[0]?.meaning || ""}</div>
    </div>`;
  }

  resultsContainer.innerHTML =
    headerHtml +
    results
      .map(
        (item) => `
    <div class="learn-search-result-item">
      <div class="learn-search-result-word">${item.word}</div>
      <div class="learn-search-result-phonetic">${item.phonetic || ""}</div>
      <div class="learn-search-result-meaning">${item.meaning}</div>
      <div class="learn-search-result-example">${item.example}</div>
      <div class="learn-search-result-example">${item.exampleVi}</div>
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

  // Get main Vietnamese translation for the word
  const mainTranslation = await fetchTranslation(translatedQuery || query);

  // Show Vietnamese translation header (for Vietnamese input or English input)
  if (translatedQuery) {
    // User typed Vietnamese - show what we found
    html += `<div style="padding:12px 16px;background:linear-gradient(135deg,var(--accent),#8b5cf6);color:white;border-radius:8px;margin:12px 16px 8px;">
      <div style="font-size:12px;opacity:0.9;">🔍 Từ tiếng Việt: "${query}"</div>
      <div style="font-size:14px;opacity:0.9;margin-top:4px;">→ Từ tiếng Anh: "${translatedQuery}"</div>
      <div style="font-size:18px;font-weight:600;margin-top:8px;">${mainTranslation}</div>
    </div>`;
  } else {
    // User typed English - show Vietnamese meaning
    html += `<div style="padding:12px 16px;background:linear-gradient(135deg,var(--accent),#8b5cf6);color:white;border-radius:8px;margin:12px 16px 8px;">
      <div style="font-size:12px;opacity:0.9;">Nghĩa tiếng Việt:</div>
      <div style="font-size:18px;font-weight:600;margin-top:4px;">${mainTranslation}</div>
    </div>`;
  }

  // Mark local matches to avoid duplicates
  const localWords = new Set(localResults.map((r) => r.word.toLowerCase()));

  // Prepare API results with translations
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

      // Translate definitions
      for (let defIdx = 0; defIdx < Math.min(definitions.length, 3); defIdx++) {
        const def = definitions[defIdx];
        const definition = def.definition || "";
        const example = def.example || "";

        // Translate this definition
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

  // Add API results
  html += apiResultsHtml.join("");

  // Add local results if any
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
  const wrapper = document.getElementById("vocabSearchResultsWrapper");

  // Toggle clear button visibility
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

  input.value = "";
  if (clearBtn) clearBtn.style.display = "none";
  if (wrapper) wrapper.classList.remove("has-results");

  input.focus();
}

function closeVocabSearchResults() {
  const wrapper = document.getElementById("vocabSearchResultsWrapper");
  if (wrapper) wrapper.classList.remove("has-results");
}

// Open Learn Modal
function openLearnModal() {
  const modal = document.getElementById("learnModal");
  modal.style.display = "flex";
  document.body.style.overflow = "hidden";
  // Reset to first tab content
  document
    .querySelectorAll(".learn-tab")
    .forEach((t) => t.classList.remove("active"));
  document
    .querySelectorAll(".learn-tab-content")
    .forEach((c) => c.classList.remove("active"));
  document
    .querySelector('.learn-tab[data-tab="vocabulary"]')
    .classList.add("active");
  document.getElementById("learnVocabularyTab").classList.add("active");
  initVocabSearchResultsCollapsed();
  selectVocabCategory("all");
}

// Close Learn Modal
function closeLearnModal() {
  document.getElementById("learnModal").style.display = "none";
  document.body.style.overflow = "";
}

// Switch Learn Tab
function switchLearnTab(tab) {
  document
    .querySelectorAll(".learn-tab")
    .forEach((t) => t.classList.remove("active"));
  document
    .querySelectorAll(".learn-tab-content")
    .forEach((c) => c.classList.remove("active"));
  document
    .querySelector(`.learn-tab[data-tab="${tab}"]`)
    .classList.add("active");
  document
    .getElementById(`learn${tab.charAt(0).toUpperCase() + tab.slice(1)}Tab`)
    .classList.add("active");

  if (tab === "vocabulary") selectVocabCategory("all");
  else if (tab === "grammar") selectGrammarCategory("all");
  else if (tab === "phrases") selectPhraseCategory("all");
}

// Vocabulary Category Selection
function selectVocabCategory(category) {
  currentVocabCategory = category;
  currentVocabIndex = 0;

  document
    .querySelectorAll("#learnVocabularyTab .learn-category-btn")
    .forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.cat === category);
    });

  if (category === "all") {
    currentVocabList = getAllVocabulary();
  } else {
    currentVocabList = VOCABULARY_DATA[category] || [];
  }

  renderVocabCard();
}

// Grammar Category Selection
function selectGrammarCategory(category) {
  currentGrammarCategory = category;
  currentGrammarIndex = 0;

  document
    .querySelectorAll("#learnGrammarTab .learn-category-btn")
    .forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.cat === category);
    });

  if (category === "all") {
    currentGrammarList = getAllGrammar();
  } else {
    currentGrammarList = GRAMMAR_DATA[category] || [];
  }

  renderGrammarCard();
}

// Phrase Category Selection
function selectPhraseCategory(category) {
  currentPhraseCategory = category;
  currentPhraseIndex = 0;

  document
    .querySelectorAll("#learnPhrasesTab .learn-category-btn")
    .forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.cat === category);
    });

  if (category === "all") {
    currentPhraseList = getAllPhrases();
  } else {
    currentPhraseList = PHRASES_DATA[category] || [];
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

  container.innerHTML = `
    <div class="learn-card">
      <div class="learn-card-category">${getCategoryName(currentVocabCategory)}</div>
      <div class="learn-card-word">${item.word}</div>
      <div class="learn-card-phonetic">${item.phonetic}</div>
      <div class="learn-card-meaning">${item.meaning}</div>
      <div class="learn-card-example">
        <div class="learn-card-example-label">Ví dụ</div>
        <div class="learn-card-example-en">${item.example}</div>
        <div class="learn-card-example-vi">${item.exampleVi}</div>
      </div>
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

  container.innerHTML = `
    <div class="learn-card">
      <div class="learn-card-category">${getGrammarCategoryName(currentGrammarCategory)}</div>
      <div class="learn-card-word">${item.title}</div>
      <div class="learn-card-formula">${item.formula}</div>
      <div class="learn-card-usage">${item.usage}</div>
      <div class="learn-card-example">
        <div class="learn-card-example-label">Ví dụ</div>
        <div class="learn-card-example-en">${item.example}</div>
        <div class="learn-card-example-vi">${item.exampleVi}</div>
      </div>
      ${item.note ? `<div class="learn-card-usage" style="margin-top: 10px; font-style: italic;">${item.note}</div>` : ""}
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

  container.innerHTML = `
    <div class="learn-card">
      <div class="learn-card-situation">${item.situation}</div>
      <div class="learn-card-phrase">${item.phrase}</div>
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
  const names = {
    all: "Tất cả",
    email: "Email",
    meeting: "Họp hành",
    presentation: "Thuyết trình",
    negotiation: "Đàm phán",
    report: "Báo cáo",
  };
  return names[cat] || cat;
}

function getGrammarCategoryName(cat) {
  const names = {
    all: "Tất cả",
    tenses: "Thì",
    conditionals: "Điều kiện",
    passive: "Bị động",
    modal: "Trợ động từ",
  };
  return names[cat] || cat;
}

// Quiz Functions
function startVocabQuiz() {
  currentQuizType = "vocabulary";
  currentQuizQuestions = shuffleArray([...getAllVocabulary()]).slice(0, 10);
  currentQuizIndex = 0;
  currentQuizScore = 0;
  document.getElementById("quizTitle").textContent = "Kiểm Tra Từ Vựng";
  openQuizModal();
}

function startGrammarQuiz() {
  currentQuizType = "grammar";
  currentQuizQuestions = shuffleArray([...getAllGrammar()]).slice(0, 8);
  currentQuizIndex = 0;
  currentQuizScore = 0;
  document.getElementById("quizTitle").textContent = "Kiểm Tra Ngữ Pháp";
  openQuizModal();
}

function startPhraseQuiz() {
  currentQuizType = "phrases";
  currentQuizQuestions = shuffleArray([...getAllPhrases()]).slice(0, 10);
  currentQuizIndex = 0;
  currentQuizScore = 0;
  document.getElementById("quizTitle").textContent = "Kiểm Tra Câu Giao Tiếp";
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
    question.textContent = `"${item.word}" có nghĩa là gì?`;
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

  // Hiện section và countdown display khi có data
  section.style.display = "block";
  display.style.display = "flex";
  
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
      progressBar.style.background =
        "linear-gradient(90deg, #f472b6 0%, #fb7185 100%)";
      progressBar.style.boxShadow =
        "0 0 12px rgba(244, 114, 182, 0.6), 0 0 24px rgba(251, 113, 133, 0.3)";
    } else if (progress >= 70) {
      progressBar.style.background =
        "linear-gradient(90deg, #818cf8 0%, #a78bfa 100%)";
      progressBar.style.boxShadow =
        "0 0 12px rgba(129, 140, 248, 0.6), 0 0 24px rgba(167, 139, 250, 0.3)";
    } else {
      progressBar.style.background =
        "linear-gradient(90deg, #6366f1 0%, #818cf8 50%, #a78bfa 100%)";
      progressBar.style.boxShadow =
        "0 0 12px rgba(167, 139, 250, 0.6), 0 0 24px rgba(99, 102, 241, 0.3)";
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
  if (!confirm("Xóa đếm ngược hiện tại?")) return;

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

function loadCountdownFromLocal() {
  try {
    const stored = localStorage.getItem("countdown");
    if (stored) {
      countdownData = JSON.parse(stored);
      renderCountdown();
      startCountdownTimer();
    }
  } catch (e) {}
}
