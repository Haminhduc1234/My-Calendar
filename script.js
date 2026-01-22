/* ========================== CẤU HÌNH ========================== */
let currentDate = new Date();
let selectedKey = "";

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
  let jd = dd + INT((153 * m + 2) / 5) + 365*y + INT(y/4) - INT(y/100) + INT(y/400) - 32045;
  return jd;
}

/* Chuyển JD sang ngày dương */
function jdToDate(jd) {
  let Z = jd;
  let A = Z;
  let alpha = INT((A - 1867216.25)/36524.25);
  A = A + 1 + alpha - INT(alpha/4);
  let B = A + 1524;
  let C = INT((B - 122.1)/365.25);
  let D = INT(365.25 * C);
  let E = INT((B - D)/30.6001);
  let day = B - D - INT(30.6001*E);
  let month = (E < 14) ? E - 1 : E - 13;
  let year = (month > 2) ? C - 4716 : C - 4715;
  return { day, month, year };
}

/* Tính ngày trăng mới (New Moon) theo thuật toán Hồ Ngọc Đức */
function NewMoon(k) {
  let T = k/1236.85;
  let T2 = T*T;
  let T3 = T2*T;
  let dr = PI/180;
  let Jd1 = 2415020.75933 + 29.53058868*k + 0.0001178*T2 - 0.000000155*T3 + 0.00033*Math.sin((166.56 + 132.87*T - 0.009173*T2)*dr);
  let M = 359.2242 + 29.10535608*k - 0.0000333*T2 - 0.00000347*T3;
  let Mpr = 306.0253 + 385.81691806*k + 0.0107306*T2 + 0.00001236*T3;
  let F = 21.2964 + 390.67050646*k - 0.0016528*T2 - 0.00000239*T3;
  let C1 = (0.1734 - 0.000393*T)*Math.sin(M*dr)
         + 0.0021*Math.sin(2*M*dr)
         - 0.4068*Math.sin(Mpr*dr)
         + 0.0161*Math.sin(2*Mpr*dr)
         - 0.0004*Math.sin(3*Mpr*dr)
         + 0.0104*Math.sin(2*F*dr)
         - 0.0051*Math.sin(M+Mpr*dr)
         - 0.0074*Math.sin(M-Mpr*dr)
         + 0.0004*Math.sin(2*F+M*dr)
         - 0.0004*Math.sin(2*F-M*dr)
         - 0.0006*Math.sin(2*F+Mpr*dr)
         + 0.0010*Math.sin(2*F-Mpr*dr)
         + 0.0005*Math.sin(2*Mpr+M*dr);
  let JdNew = Jd1 + C1;
  return INT(JdNew + 0.5 + TIMEZONE/24);
}

/* Kinh độ Mặt Trời tại ngày JDN */
function SunLongitude(jdn) {
  let T = (jdn - 2451545.5 - TIMEZONE/24)/36525;
  let T2 = T*T;
  let dr = PI/180;
  let M = 357.52910 + 35999.05030*T - 0.0001559*T2 - 0.00000048*T*T2;
  let L0 = 280.46645 + 36000.76983*T + 0.0003032*T2;
  let DL = (1.914600 - 0.004817*T - 0.000014*T2)*Math.sin(M*dr)
         + (0.019993 - 0.000101*T)*Math.sin(2*M*dr)
         + 0.000290*Math.sin(3*M*dr);
  let L = L0 + DL;
  L = L - 360*Math.floor(L/360);
  return INT(L/30);
}

/* Tháng 11 âm lịch */
function LunarMonth11(yy) {
  let off = jdFromDate(31,12,yy) - 2415021;
  let k = INT(off / 29.530588853);
  let nm = NewMoon(k);
  let sunLong = SunLongitude(nm);
  if (sunLong >= 9) nm = NewMoon(k-1);
  return nm;
}

/* Tháng nhuận */
function LeapMonthOffset(a11) {
  let k = INT( (a11 - 2415021.076998695)/29.530588853 + 0.5 );
  let last = 0;
  let i=1;
  let arc;
  do {
    arc = SunLongitude(NewMoon(k+i));
    if (arc === last) break;
    last = arc;
    i++;
  } while(i<14);
  return i-1;
}

/* Chuyển dương -> âm */
function convertSolarToLunar(dd, mm, yy) {
  let dayNumber = jdFromDate(dd, mm, yy);
  let k = INT((dayNumber - 2415021.076998695)/29.530588853);
  let monthStart = NewMoon(k+1);
  if (monthStart > dayNumber) monthStart = NewMoon(k);

  let a11 = LunarMonth11(yy);
  let b11 = a11;
  let lunarYear;

  if (a11 >= monthStart) {
    lunarYear = yy;
    a11 = LunarMonth11(yy-1);
  } else {
    lunarYear = yy+1;
    b11 = LunarMonth11(yy+1);
  }

  let lunarDay = dayNumber - monthStart + 1;
  let diff = INT((monthStart - a11)/29);
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

  document.getElementById("monthYear").innerText = `Tháng ${month+1} / ${year}`;

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const startDate = new Date(year, month, 1 - firstDayOfMonth);

  const today = new Date(); today.setHours(0,0,0,0);

  for (let i=0;i<42;i++) {
    const cellDate = new Date(startDate);
    cellDate.setDate(startDate.getDate()+i);

    const d = cellDate.getDate();
    const m = cellDate.getMonth()+1;
    const y = cellDate.getFullYear();

    const div = document.createElement("div");
    div.className = "day";
    if (cellDate.getMonth()!==month) div.classList.add("other-month");

    const lunar = convertSolarToLunar(d,m,y);
    const key = `${y}-${m}-${d}`;

    if (cellDate.getTime() === today.getTime()) div.classList.add("today");
    if (localStorage.getItem(key)) div.classList.add("has-event");
    if (SOLAR_HOLIDAYS[`${d}-${m}`] || LUNAR_HOLIDAYS[`${lunar.lunarDay}-${lunar.lunarMonth}`])
      div.classList.add("holiday");
    div.innerHTML = `<div class="solar">${d}</div><div class="lunar">${lunar.lunarDay}/${lunar.lunarMonth}${lunar.lunarLeap?"N":""}</div>`;
    div.onclick = ()=>openModal(key,d,m,y);

    calDom.appendChild(div);
  }
}

/* ========================== THÁNG ========================== */
function changeMonth(step) { currentDate.setMonth(currentDate.getMonth()+step); renderCalendar(); }

/* ========================== SỰ KIỆN ========================== */
function openModal(key,d,m,y) {
  selectedKey = key;
  document.getElementById("selectedDate").innerText = `${d}/${m}/${y}`;
  document.getElementById("eventText").value = localStorage.getItem(key) || "";
  document.getElementById("eventModal").style.display = "flex";
}

function closeModal() { document.getElementById("eventModal").style.display = "none"; }
document.getElementById("eventModal").addEventListener("click", function (e) {
    if (e.target === this) closeModal();
});

function saveEvent() {
  const t = document.getElementById("eventText").value;
  t ? localStorage.setItem(selectedKey,t) : localStorage.removeItem(selectedKey);
  closeModal();
  renderCalendar();
}
function createPeachBlossom() {
    const flower = document.createElement("div");
    flower.className = "peach-blossom";
    flower.innerText = "🌸";

    flower.style.left = Math.random() * 100 + "vw";
    flower.style.animationDuration = (6 + Math.random() * 4) + "s";
    flower.style.opacity = Math.random();

    document.body.appendChild(flower);

    setTimeout(() => flower.remove(), 10000);
}

// Chỉ bật dịp Tết (tháng 1-2)
if (new Date().getMonth() <= 1) {
    setInterval(createPeachBlossom, 700);
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
const quotes = [
    "Mỗi ngày mới là một cơ hội mới.",
    "Kiên trì hôm nay, thành công ngày mai.",
    "Bình tĩnh – Tập trung – Chiến thắng.",
    "Hãy sống trọn vẹn cho hiện tại.",
    "Đi chậm cũng được, miễn là đừng dừng lại."
];

function renderQuote() {
    const index = new Date().getDate() % quotes.length;
    document.getElementById("todayQuote").innerText =
        "💬 " + quotes[index];
}

function requestLocationPermission() {
    if (!navigator.geolocation) {
        document.getElementById("todayWeather").innerText =
            "Thiết bị không hỗ trợ định vị";
        return;
    }

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
      const detailAddr = data.display_name || "";
        const addr = data.address || {};
        if(detailAddr)
          return detailAddr;
        else
        return `${addr.suburb || addr.county || ""}${addr.city ? ", " + addr.city : ""}`;

    })
    .catch(() => "Vị trí hiện tại");
}

function handleWeather(lat, lon) {
    Promise.all([
        fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`
        ).then(res => res.json()),
        getAddressFromCoords(lat, lon)
    ])
    .then(([weatherData, locationName]) => {
        const w = weatherData.current_weather;

        document.getElementById("todayWeather").innerText =
            `🌤️ ${Math.round(w.temperature)}°C – ${weatherCodeToText(w.weathercode)} | 📍 ${locationName}`;
    })
    .catch(() => {
        document.getElementById("todayWeather").innerText =
            "🌤️ Không lấy được thời tiết";
    });
}

function getWeather() {
    navigator.geolocation.getCurrentPosition(position => {
        handleWeather(position.coords.latitude, position.coords.longitude);
    });
}

function fetchWeatherByLocation() {
    const permission = localStorage.getItem("geoPermission");

    console.log(permission);
    
    // Đã từng từ chối → không hỏi nữa
    if (permission === "denied") {
        document.getElementById("todayWeather").innerText =
            "📍 Thời tiết: chưa bật định vị";
        return;
    }

    // Đã cho phép trước đó → lấy vị trí luôn
    if (permission === "granted") {
        getWeather();
        return;
    }

    // Chưa hỏi lần nào → hỏi 1 lần
    requestLocationPermission();
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
    const can = ["Giáp","Ất","Bính","Đinh","Mậu","Kỷ","Canh","Tân","Nhâm","Quý"];
    const chi = ["Tý","Sửu","Dần","Mão","Thìn","Tỵ","Ngọ","Mùi","Thân","Dậu","Tuất","Hợi"];
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

/* ========================== INIT ========================= */
renderCalendar();
renderToday();
renderQuote();
fetchWeatherByLocation();
renderTodayLunar();
