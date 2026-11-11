/* ==========================================================================
   Border Pet — Thú cưng dễ thương chạy quanh viền màn hình
   - Hiển thị phía trên mọi màn hình, modal, dialog (z-index tối đa)
   - Danh sách thú cưng có thể chọn, lưu lựa chọn trong localStorage
   - Hành vi ngẫu nhiên: đi bộ, chạy, quay đầu, đứng nghỉ, ngủ, nhảy, thả tim
   ========================================================================== */
(function () {
  'use strict';

  const STORAGE_KEY = 'borderPet.settings.v1';
  // stay: ở yên tại vị trí đã kéo thả; pos: vị trí trên viền (tỉ lệ 0..1) hoặc null; hidden: ẩn thú cưng
  const DEFAULTS = { pet: 'cat', speed: 'normal', size: 'medium', effects: true, stay: true, pos: null, hidden: false };

  const SPEEDS = { slow: 36, normal: 60, fast: 92 }; // px / giây
  const SIZES = { small: 44, medium: 56, large: 72 }; // chiều rộng px
  const VB_W = 72;
  const VB_H = 54;

  /* ----------------------------------------------------------------------
     Danh sách thú cưng
     ---------------------------------------------------------------------- */
  const PETS = [
    {
      id: 'cat', name: 'Mèo Cam', kind: 'quad',
      body: '#f7a24f', dark: '#dd8435', belly: '#ffe7cc', line: '#b8641f',
      ear: 'cat', inner: '#ffb7c5', tail: 'cat', stripes: '#d9772e', whiskers: true,
    },
    {
      id: 'shiba', name: 'Cún Shiba', kind: 'quad',
      body: '#eaa45c', dark: '#cd8642', belly: '#fff6ea', line: '#a8652a',
      ear: 'cat', inner: '#fff1e0', tail: 'curl', muzzle: '#fff6ea',
    },
    {
      id: 'bunny', name: 'Thỏ Bông', kind: 'quad',
      body: '#ffffff', dark: '#ece6f2', belly: '#ffffff', line: '#b9adc7',
      ear: 'long', inner: '#ffc2d1', tail: 'pom',
    },
    {
      id: 'panda', name: 'Gấu Trúc', kind: 'quad',
      body: '#ffffff', dark: '#2c2c36', legs: '#2c2c36', line: '#55556a',
      ear: 'round', earColor: '#2c2c36', inner: '#2c2c36', tail: 'small', tailColor: '#2c2c36', patches: '#2c2c36',
    },
    {
      id: 'fox', name: 'Cáo Nhỏ', kind: 'quad',
      body: '#f2873a', dark: '#d46d24', belly: '#fffaf3', line: '#b4561a',
      ear: 'fox', inner: '#3b2a26', tail: 'fox', muzzle: '#fffaf3', legs: '#4a3330', legFar: '#3b2a26',
    },
    {
      id: 'pig', name: 'Heo Hồng', kind: 'quad',
      body: '#ffb9cb', dark: '#f29ab2', belly: '#ffd3df', line: '#d9728f',
      ear: 'floppy', inner: '#ff98b5', tail: 'curl', snout: true,
    },
    {
      id: 'blackcat', name: 'Mèo Mun', kind: 'quad',
      body: '#3b3b4a', dark: '#2a2a36', belly: '#4a4a5c', line: '#1e1e28',
      ear: 'cat', inner: '#ff9db4', tail: 'cat', eye: '#ffd93d', pupil: '#1e1e28', nose: '#ff9db4', whiskers: true,
    },
    {
      id: 'hamster', name: 'Hamster', kind: 'quad',
      body: '#f4c58c', dark: '#dea86c', belly: '#fffaf2', line: '#b98144',
      ear: 'round', earColor: '#f4c58c', inner: '#ffb7c5', tail: 'none', muzzle: '#fffaf2',
    },
    {
      id: 'chick', name: 'Gà Con', kind: 'biped',
      body: '#ffd84d', dark: '#f5bf1f', line: '#d79b00', wing: '#ffc928', beak: '#ff9f1c', legColor: '#ff9f1c',
      tuft: true,
    },
    {
      id: 'penguin', name: 'Cánh Cụt', kind: 'biped',
      body: '#33394a', dark: '#262b38', line: '#1a1e28', wing: '#2a2f3d', beak: '#ffa62b', legColor: '#ffa62b',
      belly: '#ffffff', face: true,
    },
  ];

  const PET_MAP = PETS.reduce((m, p) => { m[p.id] = p; return m; }, {});

  /* ----------------------------------------------------------------------
     Lưu trữ
     ---------------------------------------------------------------------- */
  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULTS };
      const parsed = JSON.parse(raw);
      const s = { ...DEFAULTS, ...parsed };
      if (s.pet !== 'none' && !PET_MAP[s.pet]) s.pet = DEFAULTS.pet;
      if (!SPEEDS[s.speed]) s.speed = DEFAULTS.speed;
      if (!SIZES[s.size]) s.size = DEFAULTS.size;
      s.effects = s.effects !== false;
      s.stay = s.stay !== false;
      s.pos = (typeof s.pos === 'number' && s.pos >= 0 && s.pos <= 1) ? s.pos : null;
      s.hidden = !!s.hidden;
      return s;
    } catch (_) {
      return { ...DEFAULTS };
    }
  }

  function saveSettings() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch (_) { /* ignore */ }
  }

  let settings = loadSettings();

  /* ----------------------------------------------------------------------
     Vẽ SVG thú cưng
     ---------------------------------------------------------------------- */
  function leg(x, y, h, w, fill, line, cls) {
    return `<g transform="translate(${x},${y})"><g class="bp-leg ${cls}">` +
      `<rect x="${-w / 2}" y="0" width="${w}" height="${h}" rx="${w / 2}" fill="${fill}" stroke="${line}" stroke-width="1.2"/>` +
      `</g></g>`;
  }

  function eyes(p, lx, rx, y) {
    const eyeFill = p.eye || '#2d2438';
    let out = `<g class="bp-eyes">`;
    [lx, rx].forEach((x) => {
      out += `<circle cx="${x}" cy="${y}" r="2.4" fill="${eyeFill}"/>`;
      if (p.pupil) out += `<ellipse cx="${x + 0.3}" cy="${y}" rx="0.9" ry="1.9" fill="${p.pupil}"/>`;
      out += `<circle cx="${x + 0.8}" cy="${y - 0.9}" r="0.85" fill="#fff"/>`;
    });
    out += `</g>`;
    return out;
  }

  function cheeks(lx, rx, y) {
    return `<ellipse cx="${lx}" cy="${y}" rx="2.7" ry="1.6" fill="#ff7fa3" opacity="0.5"/>` +
      `<ellipse cx="${rx}" cy="${y}" rx="2.7" ry="1.6" fill="#ff7fa3" opacity="0.5"/>`;
  }

  function quadSVG(p) {
    const line = p.line;
    const legNear = p.legs || p.body;
    const legFar = p.legFar || p.dark;
    let tail = '';
    const tc = p.tailColor || p.body;
    switch (p.tail) {
      case 'cat':
        tail = `<g class="bp-tail" style="transform-origin:100% 100%"><path d="M15 35 C5 34 2.5 23 8 15.5" fill="none" stroke="${line}" stroke-width="6.6" stroke-linecap="round"/><path d="M15 35 C5 34 2.5 23 8 15.5" fill="none" stroke="${tc}" stroke-width="4.4" stroke-linecap="round"/></g>`;
        break;
      case 'curl':
        tail = `<g class="bp-tail" style="transform-origin:100% 85%"><path d="M15 31 c-6 -1 -8.5 -8 -3.2 -10.2 c4.2 -1.6 5.4 3.6 1.6 4.3" fill="none" stroke="${line}" stroke-width="6" stroke-linecap="round"/><path d="M15 31 c-6 -1 -8.5 -8 -3.2 -10.2 c4.2 -1.6 5.4 3.6 1.6 4.3" fill="none" stroke="${tc}" stroke-width="3.8" stroke-linecap="round"/></g>`;
        break;
      case 'pom':
        tail = `<g class="bp-tail" style="transform-origin:100% 50%"><circle cx="13" cy="33" r="5.2" fill="${tc}" stroke="${line}" stroke-width="1.2"/></g>`;
        break;
      case 'small':
        tail = `<g class="bp-tail" style="transform-origin:100% 50%"><circle cx="13.8" cy="32" r="3.6" fill="${tc}" stroke="${line}" stroke-width="1.2"/></g>`;
        break;
      case 'fox':
        tail = `<g class="bp-tail" style="transform-origin:100% 100%">` +
          `<ellipse cx="8.5" cy="27" rx="10" ry="5.6" transform="rotate(-52 8.5 27)" fill="${tc}" stroke="${line}" stroke-width="1.2"/>` +
          `<ellipse cx="3.6" cy="19.6" rx="4.4" ry="3.6" transform="rotate(-52 3.6 19.6)" fill="#fffaf3" stroke="${line}" stroke-width="1"/></g>`;
        break;
      default:
        tail = '';
    }

    let ears = '';
    const ec = p.earColor || p.body;
    switch (p.ear) {
      case 'cat':
        ears = `<g class="bp-ears">` +
          `<polygon points="39.5,18 41.5,4.5 49.5,12" fill="${ec}" stroke="${line}" stroke-width="1.2" stroke-linejoin="round"/>` +
          `<polygon points="53,11 61.5,4.5 63,18" fill="${ec}" stroke="${line}" stroke-width="1.2" stroke-linejoin="round"/>` +
          `<polygon points="41.8,15 42.8,8.2 46.8,12.2" fill="${p.inner}"/>` +
          `<polygon points="55.6,12 60.3,8.2 61,15" fill="${p.inner}"/></g>`;
        break;
      case 'fox':
        ears = `<g class="bp-ears">` +
          `<polygon points="38.5,19 40,1.5 50,11.5" fill="${ec}" stroke="${line}" stroke-width="1.2" stroke-linejoin="round"/>` +
          `<polygon points="52.5,10.5 62.5,1.5 64.5,19" fill="${ec}" stroke="${line}" stroke-width="1.2" stroke-linejoin="round"/>` +
          `<polygon points="40.6,10 40.2,3.8 44.6,8" fill="${p.inner}"/>` +
          `<polygon points="58.6,7.6 62.2,3.8 62.6,10" fill="${p.inner}"/></g>`;
        break;
      case 'long':
        ears = `<g class="bp-ears">` +
          `<ellipse cx="45" cy="6" rx="4.3" ry="11" transform="rotate(-12 45 6)" fill="${ec}" stroke="${line}" stroke-width="1.2"/>` +
          `<ellipse cx="56.5" cy="5.5" rx="4.3" ry="11" transform="rotate(14 56.5 5.5)" fill="${ec}" stroke="${line}" stroke-width="1.2"/>` +
          `<ellipse cx="45" cy="6.5" rx="2" ry="7.5" transform="rotate(-12 45 6.5)" fill="${p.inner}"/>` +
          `<ellipse cx="56.5" cy="6" rx="2" ry="7.5" transform="rotate(14 56.5 6)" fill="${p.inner}"/></g>`;
        break;
      case 'round':
        ears = `<g class="bp-ears">` +
          `<circle cx="41" cy="13" r="5.2" fill="${ec}" stroke="${line}" stroke-width="1.2"/>` +
          `<circle cx="61" cy="13" r="5.2" fill="${ec}" stroke="${line}" stroke-width="1.2"/>` +
          `<circle cx="41.3" cy="13.4" r="2.5" fill="${p.inner}"/>` +
          `<circle cx="60.7" cy="13.4" r="2.5" fill="${p.inner}"/></g>`;
        break;
      case 'floppy':
        ears = `<g class="bp-ears">` +
          `<path d="M41 12 q-7 1 -5.5 10.5 q4.5 -1.5 9 -7.5 z" fill="${p.inner}" stroke="${line}" stroke-width="1.2" stroke-linejoin="round"/>` +
          `<path d="M61 12 q7 1 5.5 10.5 q-4.5 -1.5 -9 -7.5 z" fill="${p.inner}" stroke="${line}" stroke-width="1.2" stroke-linejoin="round"/></g>`;
        break;
      default:
        ears = '';
    }

    let face = '';
    if (p.patches) {
      face += `<ellipse cx="46" cy="23.5" rx="3.8" ry="4.6" transform="rotate(-22 46 23.5)" fill="${p.patches}"/>` +
        `<ellipse cx="57" cy="23.5" rx="3.8" ry="4.6" transform="rotate(22 57 23.5)" fill="${p.patches}"/>`;
    }
    if (p.muzzle) face += `<ellipse cx="51.5" cy="29" rx="6.4" ry="4.6" fill="${p.muzzle}"/>`;
    const eyeP = p.patches ? { eye: '#ffffff', pupil: '#2d2438' } : p;
    face += eyes(eyeP, 46.4, 56.6, 23.2);
    face += cheeks(42.4, 60.6, 28.6);
    if (p.snout) {
      face += `<ellipse cx="51.5" cy="28.6" rx="4.8" ry="3.5" fill="#ff93b2" stroke="${line}" stroke-width="1"/>` +
        `<ellipse cx="49.8" cy="28.6" rx="0.95" ry="1.3" fill="#c25275"/>` +
        `<ellipse cx="53.2" cy="28.6" rx="0.95" ry="1.3" fill="#c25275"/>`;
    } else {
      face += `<ellipse cx="51.5" cy="27.4" rx="1.6" ry="1.15" fill="${p.nose || '#4b3530'}"/>` +
        `<path d="M49.4 29.1 q1.05 1.4 2.1 0 q1.05 1.4 2.1 0" fill="none" stroke="${p.eye && p.pupil ? '#cfcfe0' : '#4b3530'}" stroke-width="0.95" stroke-linecap="round"/>`;
    }
    if (p.whiskers) {
      const wc = p.pupil ? '#9a9ab0' : '#b06a30';
      face += `<g stroke="${wc}" stroke-width="0.7" stroke-linecap="round" opacity="0.8">` +
        `<path d="M44 28.2 l-5.5 -0.8 M44 29.6 l-5.2 1.2 M59 28.2 l5.5 -0.8 M59 29.6 l5.2 1.2"/></g>`;
    }

    let stripes = '';
    if (p.stripes) {
      stripes = `<g stroke="${p.stripes}" stroke-width="2.2" stroke-linecap="round" fill="none">` +
        `<path d="M25 26.2 q1.2 3.6 0 6.6"/><path d="M30.5 25.4 q1.2 3.8 0 7"/><path d="M36 25.8 q1.2 3.6 0 6.4"/></g>`;
    }

    return `<svg class="bp-svg" viewBox="0 0 ${VB_W} ${VB_H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
      `<g class="bp-bob">` +
      leg(26, 38, 14.5, 6.4, legFar, line, 'bp-leg-b') +
      leg(43, 38, 14.5, 6.4, legFar, line, 'bp-leg-a') +
      tail +
      `<ellipse cx="31" cy="36" rx="18.5" ry="11.5" fill="${p.body}" stroke="${line}" stroke-width="1.3"/>` +
      (p.belly ? `<ellipse cx="33" cy="41" rx="11" ry="5" fill="${p.belly}"/>` : '') +
      stripes +
      leg(20, 39.5, 13.5, 6.6, legNear, line, 'bp-leg-a') +
      leg(37.5, 39.5, 13.5, 6.6, legNear, line, 'bp-leg-b') +
      `<g class="bp-head">` + ears +
      `<circle cx="51.5" cy="23" r="13.6" fill="${p.body}" stroke="${line}" stroke-width="1.3"/>` +
      (p.stripes ? `<g stroke="${p.stripes}" stroke-width="2" stroke-linecap="round"><path d="M48 11.2 l0.6 3.2"/><path d="M51.5 10 l0 3.4"/><path d="M55 11.2 l-0.6 3.2"/></g>` : '') +
      face + `</g>` +
      `</g></svg>`;
  }

  function bipedSVG(p) {
    const line = p.line;
    const legC = p.legColor;
    const bLeg = (x, cls, fill) => `<g transform="translate(${x},44.5)"><g class="bp-leg ${cls}">` +
      `<rect x="-1.3" y="0" width="2.6" height="7" rx="1.2" fill="${fill}"/>` +
      `<ellipse cx="1.6" cy="7.4" rx="3.6" ry="1.4" fill="${fill}"/></g></g>`;

    let body = '';
    if (p.face) {
      // Chim cánh cụt
      body = `<ellipse cx="36" cy="29" rx="15.5" ry="17.5" fill="${p.body}" stroke="${line}" stroke-width="1.3"/>` +
        `<ellipse cx="40" cy="34" rx="10" ry="12" fill="${p.belly}"/>` +
        `<ellipse cx="38.5" cy="23" rx="6" ry="6.5" fill="${p.belly}"/>` +
        `<ellipse cx="48" cy="23" rx="6" ry="6.5" fill="${p.belly}"/>`;
    } else {
      body = `<ellipse cx="36" cy="30.5" rx="16.5" ry="15.5" fill="${p.body}" stroke="${line}" stroke-width="1.3"/>`;
    }
    const tuft = p.tuft
      ? `<path d="M37 15.6 q-3 -6 1.2 -7.6 q-1 4 1.2 6 q0.8 -5.4 4.6 -4.4 q-3.4 2 -3.6 6.4 z" fill="${p.body}" stroke="${line}" stroke-width="1.1" stroke-linejoin="round"/>`
      : '';
    return `<svg class="bp-svg" viewBox="0 0 ${VB_W} ${VB_H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
      bLeg(32, 'bp-leg-b', '#e0820c') +
      `<g class="bp-bob"><g class="bp-waddle">` +
      (p.face ? `<g class="bp-tail" style="transform-origin:100% 50%"><path d="M22 40 l-5 4 l6 0 z" fill="${p.body}" stroke="${line}" stroke-width="1"/></g>` : '') +
      tuft + body +
      `<g class="bp-head">` +
      eyes({}, 41.6, 50.4, 23.4) +
      cheeks(39, 53, 28.4) +
      `<path d="M50.5 26.2 L59 28.4 L50.5 30.8 Z" fill="${p.beak}" stroke="#d97706" stroke-width="0.9" stroke-linejoin="round"/>` +
      `</g>` +
      `<g class="bp-wing" style="transform-origin:50% 15%"><ellipse cx="31" cy="33" rx="5.6" ry="9.2" transform="rotate(14 31 33)" fill="${p.wing}" stroke="${line}" stroke-width="1.1"/></g>` +
      `</g></g>` +
      bLeg(41, 'bp-leg-a', legC) +
      `</svg>`;
  }

  function petSVG(p) {
    return p.kind === 'biped' ? bipedSVG(p) : quadSVG(p);
  }

  /* ----------------------------------------------------------------------
     Engine chuyển động quanh viền
     ---------------------------------------------------------------------- */
  const state = {
    layer: null, mover: null, jumpWrap: null, flip: null, pet: null, shadow: null,
    rafId: 0, lastTs: 0,
    s: 0, dir: 1,
    mode: 'walk', modeLeft: 4, speedMul: 1,
    vw: 0, vh: 0, inset: { t: 0, r: 0, b: 0, l: 0 },
    w: 56, h: 42,
    pose: { x: 0, y: 0, a: 0 },
    nextFx: 1.2, nextBubble: 9, dustAcc: 0,
    zzzEl: null, bubbleEl: null, bubbleLeft: 0,
    drag: null, dragging: false, drop: null, marker: null,
  };

  /** Bé đang được "ghim" tại vị trí người dùng đã thả. */
  function isPinned() {
    return settings.stay && settings.pos != null;
  }

  function readInsets() {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;' +
      'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px);';
    document.body.appendChild(probe);
    const cs = getComputedStyle(probe);
    state.inset = {
      t: parseFloat(cs.paddingTop) || 0,
      r: parseFloat(cs.paddingRight) || 0,
      b: parseFloat(cs.paddingBottom) || 0,
      l: parseFloat(cs.paddingLeft) || 0,
    };
    probe.remove();
  }

  function measure() {
    if (!state.layer) return;
    const oldTotal = state.vw ? track().total : 0;
    state.vw = state.layer.clientWidth || window.innerWidth;
    state.vh = state.layer.clientHeight || window.innerHeight;
    readInsets();
    // Giữ nguyên vị trí tương đối trên viền khi xoay / đổi kích thước màn hình
    const newTotal = track().total;
    if (isPinned()) state.s = settings.pos * newTotal;
    else if (oldTotal > 0 && newTotal > 0) state.s = (state.s / oldTotal) * newTotal;
  }

  /** Tìm điểm trên viền gần (x, y) nhất, trả về quãng đường s. */
  function nearestS(x, y, t) {
    let best = 0;
    let bestD = Infinity;
    const test = (s) => {
      const p = poseAt(s, t);
      const d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
      if (d < bestD) { bestD = d; best = s; }
    };
    for (let s = 0; s < t.total; s += 4) test(s);
    const c = best;
    for (let s = c - 4; s <= c + 4; s += 0.5) test((s + t.total) % t.total);
    return best;
  }

  /** Tính đường đi hình chữ nhật bo góc theo viền màn hình. */
  function track() {
    const m = 2;
    const left = state.inset.l + m;
    const right = state.vw - state.inset.r - m;
    const top = state.inset.t + m;
    const bottom = state.vh - state.inset.b - m;
    const R = Math.max(8, Math.min(34, (right - left) / 4, (bottom - top) / 4));
    const hLen = Math.max(0, right - left - 2 * R);
    const vLen = Math.max(0, bottom - top - 2 * R);
    const arc = (Math.PI / 2) * R;
    return { left, right, top, bottom, R, hLen, vLen, arc, total: 2 * hLen + 2 * vLen + 4 * arc };
  }

  /** Trả về vị trí bàn chân (x, y) và góc xoay (độ) theo quãng đường s. */
  function poseAt(s, t) {
    const { left, right, top, bottom, R, hLen, vLen, arc } = t;
    const arcPt = (cx, cy, a0, frac) => {
      const a = a0 - 90 * frac;
      const rad = (a * Math.PI) / 180;
      return { x: cx + R * -Math.sin(rad), y: cy + R * Math.cos(rad), a };
    };
    // 1. Cạnh dưới: trái -> phải
    if (s < hLen) return { x: left + R + s, y: bottom, a: 0 };
    s -= hLen;
    if (s < arc) return arcPt(right - R, bottom - R, 0, s / arc);
    s -= arc;
    // 2. Cạnh phải: dưới -> trên
    if (s < vLen) return { x: right, y: bottom - R - s, a: -90 };
    s -= vLen;
    if (s < arc) return arcPt(right - R, top + R, -90, s / arc);
    s -= arc;
    // 3. Cạnh trên: phải -> trái
    if (s < hLen) return { x: right - R - s, y: top, a: -180 };
    s -= hLen;
    if (s < arc) return arcPt(left + R, top + R, -180, s / arc);
    s -= arc;
    // 4. Cạnh trái: trên -> dưới
    if (s < vLen) return { x: left, y: top + R + s, a: -270 };
    s -= vLen;
    return arcPt(left + R, bottom - R, -270, Math.min(1, s / arc));
  }

  /** Vector hướng vào trong màn hình (hướng "lên" của thú cưng). */
  function upVec(a) {
    const rad = (a * Math.PI) / 180;
    return { x: Math.sin(rad), y: -Math.cos(rad) };
  }

  function setPetMode(mode) {
    if (!state.pet) return;
    state.pet.classList.remove('bp-walk', 'bp-run', 'bp-idle', 'bp-sleep', 'bp-drag');
    state.pet.classList.add('bp-' + mode);
  }

  function rand(a, b) { return a + Math.random() * (b - a); }

  function chooseNextMode() {
    const r = Math.random();
    let mode;
    if (r < 0.46) mode = 'walk';
    else if (r < 0.64) mode = 'run';
    else if (r < 0.86) mode = 'idle';
    else if (r < 0.94) mode = 'sleep';
    else mode = 'hop';

    // Đang ghim: chỉ đứng chơi tại chỗ, thỉnh thoảng quay đầu nhìn quanh
    if (isPinned() && (mode === 'walk' || mode === 'run')) {
      mode = 'idle';
      if (Math.random() < 0.5) state.dir *= -1;
    }

    removeZzz();
    if (mode === 'walk') {
      state.modeLeft = rand(4, 10);
      if (Math.random() < 0.22) state.dir *= -1;
    } else if (mode === 'run') {
      state.modeLeft = rand(1.8, 4);
      if (Math.random() < 0.15) state.dir *= -1;
    } else if (mode === 'idle') {
      state.modeLeft = rand(2, 4.5);
      if (Math.random() < 0.5) showBubble(pick(['💕', '✨', '🎵', '🌸', '😺', '🍀']));
    } else if (mode === 'sleep') {
      state.modeLeft = rand(6, 11);
      showZzz();
    } else {
      // Nhảy tại chỗ vài cái rồi đi tiếp
      state.modeLeft = 1.4;
      jump();
      mode = 'idle';
    }
    state.mode = mode;
    setPetMode(mode);
    applyDir();
  }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function frame(ts) {
    state.rafId = requestAnimationFrame(frame);
    if (!state.lastTs) state.lastTs = ts;
    const dt = Math.min(0.1, (ts - state.lastTs) / 1000);
    state.lastTs = ts;
    if (!state.vw) measure();

    const t = track();
    if (t.total <= 0) return;

    // Đang bị kéo: bé lủng lẳng theo ngón tay / chuột
    if (state.dragging && state.drag) {
      dragFrame(t);
      return;
    }

    let p;
    if (state.drop) {
      // Đang rơi về vị trí viền vừa thả
      p = dropFrame(dt);
    } else {
      // Cập nhật hành vi
      state.modeLeft -= dt;
      if (state.modeLeft <= 0) chooseNextMode();

      let v = 0;
      const base = SPEEDS[settings.speed] || SPEEDS.normal;
      if (!isPinned()) {
        if (state.mode === 'walk') v = base;
        else if (state.mode === 'run') v = base * 2.4;
      }
      state.s = ((state.s + v * dt * state.dir) % t.total + t.total) % t.total;
      p = poseAt(state.s, t);
    }

    state.pose = p;
    state.mover.style.transform =
      `translate3d(${(p.x - state.w / 2).toFixed(2)}px, ${(p.y - state.h).toFixed(2)}px, 0) rotate(${p.a.toFixed(2)}deg)`;

    // Hiệu ứng phụ
    if (settings.effects) {
      if (state.mode === 'run') {
        state.dustAcc += dt;
        if (state.dustAcc > 0.09) { state.dustAcc = 0; spawnDust(p); }
      } else if (state.mode === 'walk') {
        state.nextFx -= dt;
        if (state.nextFx <= 0) {
          state.nextFx = rand(2.2, 4.5);
          spawnParticle(p, pick(['💗', '✨', '💖', '⭐', '🌸']), 'bp-float');
        }
      }
    }

    if (state.bubbleEl) {
      state.bubbleLeft -= dt;
      positionAboveHead(state.bubbleEl, p, 1.25);
      if (state.bubbleLeft <= 0) removeBubble();
    }
    if (state.zzzEl) positionAboveHead(state.zzzEl, p, 1.05);
  }

  function headPoint(p, k) {
    const up = upVec(p.a);
    // dịch về phía đầu (phía trước theo hướng đi)
    const fwdSign = state.dir;
    const rad = (p.a * Math.PI) / 180;
    const fwd = { x: Math.cos(rad) * fwdSign, y: Math.sin(rad) * fwdSign };
    const ahead = state.w * 0.2;
    return {
      x: p.x + up.x * state.h * k + fwd.x * ahead,
      y: p.y + up.y * state.h * k + fwd.y * ahead,
    };
  }

  function positionAboveHead(el, p, k) {
    const hp = headPoint(p, k);
    el.style.transform = `translate3d(${hp.x.toFixed(1)}px, ${hp.y.toFixed(1)}px, 0) translate(-50%, -50%)`;
  }

  function spawnParticle(p, char, cls) {
    if (!state.layer) return;
    const el = document.createElement('span');
    el.className = 'bp-particle ' + cls;
    el.textContent = char;
    const hp = headPoint(p, 0.9);
    const up = upVec(p.a);
    el.style.left = hp.x + 'px';
    el.style.top = hp.y + 'px';
    const side = rand(-14, 14);
    el.style.setProperty('--dx', (up.x * 46 + up.y * side).toFixed(1) + 'px');
    el.style.setProperty('--dy', (up.y * 46 - up.x * side).toFixed(1) + 'px');
    el.style.setProperty('--rot', rand(-25, 25).toFixed(0) + 'deg');
    state.layer.appendChild(el);
    setTimeout(() => el.remove(), 1700);
  }

  function spawnDust(p) {
    if (!state.layer) return;
    const el = document.createElement('span');
    el.className = 'bp-dust';
    const rad = (p.a * Math.PI) / 180;
    const back = -state.dir * state.w * 0.32;
    const up = upVec(p.a);
    const x = p.x + Math.cos(rad) * back + up.x * 3;
    const y = p.y + Math.sin(rad) * back + up.y * 3;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.setProperty('--dx', (-Math.cos(rad) * state.dir * 10 + up.x * 6).toFixed(1) + 'px');
    el.style.setProperty('--dy', (-Math.sin(rad) * state.dir * 10 + up.y * 6).toFixed(1) + 'px');
    state.layer.appendChild(el);
    setTimeout(() => el.remove(), 650);
  }

  function showBubble(text, dur) {
    if (!state.layer || !settings.effects) return;
    removeBubble();
    const el = document.createElement('div');
    el.className = 'bp-bubble';
    el.textContent = text;
    state.layer.appendChild(el);
    state.bubbleEl = el;
    state.bubbleLeft = dur || 2.2;
    positionAboveHead(el, state.pose, 1.25);
  }

  function removeBubble() {
    if (state.bubbleEl) { state.bubbleEl.remove(); state.bubbleEl = null; }
  }

  function showZzz() {
    if (!state.layer) return;
    removeZzz();
    const el = document.createElement('div');
    el.className = 'bp-zzz';
    el.innerHTML = '<span>z</span><span>z</span><span>Z</span>';
    state.layer.appendChild(el);
    state.zzzEl = el;
    positionAboveHead(el, state.pose, 1.05);
  }

  function removeZzz() {
    if (state.zzzEl) { state.zzzEl.remove(); state.zzzEl = null; }
  }

  function jump() {
    if (!state.jumpWrap) return;
    state.jumpWrap.classList.remove('bp-jumping');
    void state.jumpWrap.offsetWidth; // restart animation
    state.jumpWrap.classList.add('bp-jumping');
  }

  let lastTapTime = 0;

  function onPetTap() {
    const now = Date.now();
    const isDoubleTap = (now - lastTapTime) < 350;
    lastTapTime = now;

    if (isDoubleTap) {
      lastTapTime = 0; // Reset tránh kích hoạt lần 3
      // Nếu đang ghim hoặc đang dừng tại chỗ, hủy ghim để bé chạy tiếp
      settings.stay = false;
      settings.pos = null;
      saveSettings();
      syncModal();

      removeZzz();
      state.mode = 'run';
      state.modeLeft = rand(3, 6);
      setPetMode('run');
      jump();
      const p = state.pose;
      if (settings.effects) {
        for (let i = 0; i < 4; i++) setTimeout(() => spawnDust(p), i * 50);
        setTimeout(() => spawnParticle(p, '💨', 'bp-burst'), 50);
        setTimeout(() => spawnParticle(p, '✨', 'bp-float'), 120);
      }
      showBubble(pick(['Chạy thôiii! 🐾', 'Đi chơi tiếp nà! 💨', 'Gâu gâu / Meo meo~ ✨', 'Vù vùuu~ 🚀']), 1.8);
      return;
    }

    removeZzz();
    state.mode = 'idle';
    state.modeLeft = isPinned() ? rand(3, 5) : 1.6;
    setPetMode('idle');
    jump();
    const p = state.pose;
    for (let i = 0; i < 5; i++) {
      setTimeout(() => spawnParticle(p, pick(['💗', '💖', '💕', '✨']), 'bp-burst'), i * 70);
    }
    showBubble(pick(['💕', '😻', '🥰', 'Hihi!', 'Meo~', '♪♪']), 1.6);
  }

  function stopEvent(e) { e.stopPropagation(); }

  /* ----------------------------------------------------------------------
     Kéo & thả thú cưng tới vị trí viền mong muốn
     ---------------------------------------------------------------------- */
  const DRAG_THRESHOLD = 6;

  function onPointerDown(e) {
    closeContextMenu();
    e.stopPropagation();
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    state.drag = {
      id: e.pointerId, sx: e.clientX, sy: e.clientY,
      x: e.clientX, y: e.clientY, lastX: e.clientX, swing: 0, active: false,
    };
    try { state.mover.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
  }

  function onPointerMove(e) {
    const d = state.drag;
    if (!d || e.pointerId !== d.id) return;
    e.stopPropagation();
    d.x = e.clientX;
    d.y = e.clientY;
    if (!d.active && Math.hypot(d.x - d.sx, d.y - d.sy) > DRAG_THRESHOLD) startDrag();
    if (d.active && e.cancelable) e.preventDefault();
  }

  function onPointerUp(e) {
    const d = state.drag;
    if (!d || e.pointerId !== d.id) return;
    e.stopPropagation();
    state.drag = null;
    try { state.mover.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    if (d.active) endDrag(d);
    else if (e.type === 'pointerup') onPetTap();
  }

  function onClickCapture(e) {
    // Không để click lọt xuống giao diện / modal phía dưới
    e.preventDefault();
    e.stopPropagation();
  }

  function startDrag() {
    const d = state.drag;
    d.active = true;
    state.dragging = true;
    state.drop = null;
    removeZzz();
    removeBubble();
    setPetMode('drag');
    state.mover.classList.add('bp-grabbing');
    document.documentElement.classList.add('bp-is-dragging');
    if (!state.marker) {
      const m = document.createElement('div');
      m.className = 'bp-snap-marker';
      m.innerHTML = '<span></span>';
      state.layer.appendChild(m);
      state.marker = m;
    }
    if (settings.effects) spawnParticle(state.pose, pick(['💦', '❗', '😳']), 'bp-burst');
  }

  function dragFrame(t) {
    const d = state.drag;
    const vx = d.x - d.lastX;
    d.lastX = d.x;
    // Đung đưa theo quán tính khi kéo ngang
    d.swing += (Math.max(-38, Math.min(38, -vx * 2.4)) - d.swing) * 0.18;
    if (Math.abs(vx) > 1.5) {
      const nd = vx > 0 ? 1 : -1;
      if (nd !== state.dir) { state.dir = nd; applyDir(); }
    }
    state.mover.style.transform =
      `translate3d(${(d.x - state.w / 2).toFixed(1)}px, ${(d.y - state.h * 0.22).toFixed(1)}px, 0) rotate(${d.swing.toFixed(1)}deg)`;

    // Hiển thị điểm đáp trên viền
    if (state.marker) {
      const s = nearestS(d.x, d.y + state.h * 0.5, t);
      const p = poseAt(s, t);
      state.marker.style.transform =
        `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0) translate(-50%, -50%) rotate(${p.a.toFixed(1)}deg)`;
    }
  }

  function endDrag(d) {
    state.dragging = false;
    state.mover.classList.remove('bp-grabbing');
    document.documentElement.classList.remove('bp-is-dragging');
    if (state.marker) { state.marker.remove(); state.marker = null; }

    const t = track();
    const s = nearestS(d.x, d.y + state.h * 0.5, t);
    const to = poseAt(s, t);
    // Vị trí bàn chân hiện tại (gốc xoay ở đáy)
    const from = { x: d.x, y: d.y - state.h * 0.22 + state.h, a: d.swing };
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    state.drop = { from, to, s, t: 0, dur: Math.min(0.6, 0.22 + dist / 1600) };
    setPetMode('drag');

    settings.pos = t.total > 0 ? s / t.total : null;
    saveSettings();
  }

  function dropFrame(dt) {
    const dr = state.drop;
    dr.t += dt;
    const k = Math.min(1, dr.t / dr.dur);
    const e = k * k * (3 - 2 * k); // smoothstep
    const up = upVec(dr.to.a);
    const hop = Math.sin(Math.PI * k) * Math.min(26, 8 + dr.dur * 30);
    const diff = ((dr.to.a - dr.from.a + 540) % 360) - 180;
    const p = {
      x: dr.from.x + (dr.to.x - dr.from.x) * e + up.x * hop,
      y: dr.from.y + (dr.to.y - dr.from.y) * e + up.y * hop,
      a: dr.from.a + diff * e,
    };
    if (k >= 1) {
      state.drop = null;
      state.s = dr.s;
      state.mode = 'idle';
      state.modeLeft = isPinned() ? rand(4, 7) : rand(2.5, 4);
      setPetMode('idle');
      jump();
      const landed = poseAt(dr.s, track());
      if (settings.effects) {
        for (let i = 0; i < 4; i++) setTimeout(() => spawnDust(landed), i * 40);
        setTimeout(() => spawnParticle(landed, pick(['✨', '⭐', '💖']), 'bp-burst'), 120);
      }
      showBubble(isPinned() ? pick(['📌 Ở đây nha!', 'Chỗ này đẹp!', 'Gõ 2 lần để bé chạy nha!']) : pick(['Hihi!', 'Wiii~', '💕']), 1.8);
      return landed;
    }
    return p;
  }

  function buildLayer() {
    destroyLayer();
    if (settings.hidden) return;
    const p = PET_MAP[settings.pet];
    if (!p) return;

    state.w = SIZES[settings.size] || SIZES.medium;
    state.h = Math.round(state.w * (VB_H / VB_W));

    const layer = document.createElement('div');
    layer.className = 'bp-layer';
    layer.setAttribute('aria-hidden', 'true');

    const mover = document.createElement('div');
    mover.className = 'bp-mover';
    mover.style.width = state.w + 'px';
    mover.style.height = state.h + 'px';
    mover.title = p.name;

    const shadow = document.createElement('div');
    shadow.className = 'bp-shadow';

    const jumpWrap = document.createElement('div');
    jumpWrap.className = 'bp-jumpwrap';
    jumpWrap.addEventListener('animationend', () => jumpWrap.classList.remove('bp-jumping'));

    const flip = document.createElement('div');
    flip.className = 'bp-flip';

    const pet = document.createElement('div');
    pet.className = 'bp-pet bp-walk ' + (p.kind === 'biped' ? 'bp-biped' : 'bp-quad');
    pet.innerHTML = petSVG(p);

    flip.appendChild(pet);
    jumpWrap.appendChild(flip);
    mover.appendChild(shadow);
    mover.appendChild(jumpWrap);
    layer.appendChild(mover);

    mover.addEventListener('click', onClickCapture);
    mover.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openContextMenu(e.clientX, e.clientY);
    });
    mover.addEventListener('pointerdown', onPointerDown);
    mover.addEventListener('pointermove', onPointerMove);
    mover.addEventListener('pointerup', onPointerUp);
    mover.addEventListener('pointercancel', onPointerUp);
    mover.addEventListener('dragstart', (e) => e.preventDefault());
    ['mousedown', 'touchstart', 'mouseup', 'touchend'].forEach((ev) =>
      mover.addEventListener(ev, stopEvent, { passive: true }));

    document.body.appendChild(layer);

    Object.assign(state, { layer, mover, jumpWrap, flip, pet, shadow });
    state.drag = null;
    state.dragging = false;
    state.drop = null;
    measure();
    const total = track().total;
    if (settings.pos != null && (isPinned() || !state.s)) state.s = settings.pos * total;
    else if (!state.s) state.s = rand(0, total * 0.25);
    state.mode = isPinned() ? 'idle' : 'walk';
    setPetMode(state.mode);
    state.modeLeft = rand(4, 8);
    state.lastTs = 0;
    applyDir();
    state.rafId = requestAnimationFrame(frame);
  }

  function applyDir() {
    if (state.flip) state.flip.style.transform = state.dir < 0 ? 'scaleX(-1)' : '';
  }

  function destroyLayer() {
    closeContextMenu();
    if (state.rafId) cancelAnimationFrame(state.rafId);
    state.rafId = 0;
    if (state.layer) state.layer.remove();
    state.layer = state.mover = state.jumpWrap = state.flip = state.pet = state.shadow = null;
    state.zzzEl = state.bubbleEl = state.marker = null;
    state.drag = state.drop = null;
    state.dragging = false;
    document.documentElement.classList.remove('bp-is-dragging');
  }

  /* ----------------------------------------------------------------------
     Menu ngữ cảnh (chuột phải) nhanh trên thú cưng
     ---------------------------------------------------------------------- */
  let menuEl = null;

  function closeContextMenu() {
    if (menuEl) {
      menuEl.remove();
      menuEl = null;
      document.removeEventListener('click', onDocClickCloseMenu, true);
      document.removeEventListener('keydown', onDocKeyCloseMenu, true);
    }
  }

  function onDocClickCloseMenu(e) {
    if (menuEl && !menuEl.contains(e.target)) {
      closeContextMenu();
    }
  }

  function onDocKeyCloseMenu(e) {
    if (e.key === 'Escape') closeContextMenu();
  }

  function openContextMenu(x, y) {
    closeContextMenu();
    const m = document.createElement('div');
    m.className = 'bp-context-menu';
    m.setAttribute('role', 'menu');
    m.innerHTML = `
      <button type="button" class="bp-context-menu-item" data-action="hide" role="menuitem">
        <i class="fi fi-rr-eye-crossed"></i><span>Ẩn thú cưng</span>
      </button>
      <button type="button" class="bp-context-menu-item" data-action="settings" role="menuitem">
        <i class="fi fi-rr-settings"></i><span>Cài đặt thú cưng...</span>
      </button>
    `;
    document.body.appendChild(m);
    menuEl = m;

    const rect = m.getBoundingClientRect();
    const pad = 10;
    let left = x;
    let top = y;
    if (left + rect.width > window.innerWidth - pad) {
      left = window.innerWidth - rect.width - pad;
    }
    if (top + rect.height > window.innerHeight - pad) {
      top = window.innerHeight - rect.height - pad;
    }
    m.style.left = Math.max(pad, left) + 'px';
    m.style.top = Math.max(pad, top) + 'px';

    m.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const act = btn.dataset.action;
      closeContextMenu();
      if (act === 'hide') {
        settings.hidden = true;
        saveSettings();
        syncModal();
        destroyLayer();
        if (typeof showToast === 'function') {
          showToast('Đã ẩn thú cưng. Bạn có thể bật lại trong Menu > Thú Cưng.');
        }
      } else if (act === 'settings') {
        openBorderPetModal();
      }
    });

    setTimeout(() => {
      document.addEventListener('click', onDocClickCloseMenu, true);
      document.addEventListener('keydown', onDocKeyCloseMenu, true);
    }, 10);
  }

  /* ----------------------------------------------------------------------
     Modal chọn thú cưng (toàn màn hình)
     ---------------------------------------------------------------------- */
  let modalEl = null;

  function ensureModal() {
    if (modalEl) return modalEl;
    modalEl = document.createElement('div');
    modalEl.id = 'borderPetModal';
    modalEl.className = 'bp-modal';
    modalEl.setAttribute('role', 'dialog');
    modalEl.setAttribute('aria-modal', 'true');
    modalEl.setAttribute('aria-labelledby', 'bpModalTitle');
    modalEl.innerHTML = `
      <div class="bp-modal-header">
        <div class="bp-modal-title-wrap">
          <span class="bp-modal-title-icon"><i class="fi fi-rr-paw"></i></span>
          <div>
            <h3 id="bpModalTitle" class="bp-modal-title">Thú Cưng</h3>
            <p class="bp-modal-subtitle">Chọn một bé dễ thương chạy quanh</p>
          </div>
        </div>
        <button type="button" class="bp-modal-close" aria-label="Đóng" data-bp-close>&times;</button>
      </div>
      <div class="bp-modal-body">
        <section class="bp-section">
          <h4 class="bp-section-title"><i class="fi fi-rr-heart"></i><span>Chọn thú cưng</span></h4>
          <div class="bp-grid" id="bpGrid"></div>
        </section>
        <section class="bp-section">
          <h4 class="bp-section-title"><i class="fi fi-rr-dashboard"></i><span>Tốc độ</span></h4>
          <div class="bp-segment" data-bp-group="speed">
            <button type="button" data-value="slow">Chậm</button>
            <button type="button" data-value="normal">Vừa</button>
            <button type="button" data-value="fast">Nhanh</button>
          </div>
        </section>
        <section class="bp-section">
          <h4 class="bp-section-title"><i class="fi fi-rr-expand"></i><span>Kích thước</span></h4>
          <div class="bp-segment" data-bp-group="size">
            <button type="button" data-value="small">Nhỏ</button>
            <button type="button" data-value="medium">Vừa</button>
            <button type="button" data-value="large">Lớn</button>
          </div>
        </section>
        <section class="bp-section">
          <label class="bp-toggle-row">
            <span class="bp-toggle-text">
              <strong>Ẩn thú cưng</strong>
              <small>Tạm thời ẩn bé thú cưng khỏi viền màn hình</small>
            </span>
            <input type="checkbox" id="bpHiddenToggle" class="bp-toggle-input" />
            <span class="bp-toggle" aria-hidden="true"></span>
          </label>
          <label class="bp-toggle-row">
            <span class="bp-toggle-text">
              <strong>Hiệu ứng lấp lánh</strong>
              <small>Thả tim, bụi khi chạy, bong bóng cảm xúc</small>
            </span>
            <input type="checkbox" id="bpEffectsToggle" class="bp-toggle-input" />
            <span class="bp-toggle" aria-hidden="true"></span>
          </label>
          <label class="bp-toggle-row">
            <span class="bp-toggle-text">
              <strong>Ở yên chỗ đã thả</strong>
              <small>Kéo bé tới vị trí viền bạn thích, bé sẽ ngồi chơi tại đó. Gõ 2 lần vào bé (hoặc tắt mục này) để bé chạy tiếp.</small>
            </span>
            <input type="checkbox" id="bpStayToggle" class="bp-toggle-input" />
            <span class="bp-toggle" aria-hidden="true"></span>
          </label>
          <p class="bp-hint"><i class="fi fi-rr-info"></i><span>Chạm 1 lần để bé nhảy và thả tim. Gõ 2 lần liên tiếp (double click/tap) để bé chạy tiếp. Kéo thả để đặt bé vào vị trí viền bất kỳ. Nhấp chuột phải vào bé để mở menu ẩn nhanh.</span></p>
        </section>
      </div>`;
    document.body.appendChild(modalEl);

    // Lưới thú cưng
    const grid = modalEl.querySelector('#bpGrid');
    let html = `<button type="button" class="bp-card bp-card-none" data-pet="none">
        <span class="bp-card-preview"><i class="fi fi-rr-ban"></i></span>
        <span class="bp-card-name">Tắt</span>
      </button>`;
    PETS.forEach((p) => {
      html += `<button type="button" class="bp-card" data-pet="${p.id}">
          <span class="bp-card-preview"><span class="bp-pet bp-walk ${p.kind === 'biped' ? 'bp-biped' : 'bp-quad'}">${petSVG(p)}</span></span>
          <span class="bp-card-name">${p.name}</span>
        </button>`;
    });
    grid.innerHTML = html;

    grid.addEventListener('click', (e) => {
      const card = e.target.closest('.bp-card');
      if (!card) return;
      settings.pet = card.dataset.pet;
      if (settings.pet !== 'none') {
        settings.hidden = false;
      }
      saveSettings();
      syncModal();
      if (settings.pet === 'none' || settings.hidden) {
        destroyLayer();
      } else {
        buildLayer();
        setTimeout(() => showBubble('💕', 1.8), 200);
      }
    });

    modalEl.querySelectorAll('.bp-segment').forEach((seg) => {
      seg.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-value]');
        if (!btn) return;
        const group = seg.dataset.bpGroup;
        settings[group] = btn.dataset.value;
        saveSettings();
        syncModal();
        if (group === 'size') buildLayer();
      });
    });

    modalEl.querySelector('#bpHiddenToggle').addEventListener('change', (e) => {
      settings.hidden = e.target.checked;
      if (!settings.hidden && settings.pet === 'none') {
        settings.pet = 'cat';
      }
      saveSettings();
      syncModal();
      if (settings.hidden || settings.pet === 'none') {
        destroyLayer();
      } else {
        buildLayer();
        setTimeout(() => showBubble('Bé đã trở lại! 💕', 1.8), 200);
      }
    });

    modalEl.querySelector('#bpEffectsToggle').addEventListener('change', (e) => {
      settings.effects = e.target.checked;
      saveSettings();
      if (!settings.effects) removeBubble();
    });

    modalEl.querySelector('#bpStayToggle').addEventListener('change', (e) => {
      settings.stay = e.target.checked;
      if (settings.stay && state.layer) {
        // Ghim ngay tại vị trí hiện tại
        const total = track().total;
        if (total > 0) settings.pos = state.s / total;
      }
      saveSettings();
      if (state.layer && !state.drop && !state.dragging) {
        state.modeLeft = settings.stay ? rand(3, 5) : 0.3;
        if (settings.stay) { state.mode = 'idle'; setPetMode('idle'); }
      }
    });

    modalEl.addEventListener('click', (e) => {
      if (e.target.closest('[data-bp-close]')) closeBorderPetModal();
    });

    return modalEl;
  }

  function syncModal() {
    if (!modalEl) return;
    modalEl.querySelectorAll('.bp-card').forEach((c) => {
      const active = c.dataset.pet === settings.pet;
      c.classList.toggle('is-active', active);
      c.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    modalEl.querySelectorAll('.bp-segment').forEach((seg) => {
      const val = settings[seg.dataset.bpGroup];
      seg.querySelectorAll('button').forEach((b) => b.classList.toggle('is-active', b.dataset.value === val));
    });
    const hiddenToggle = modalEl.querySelector('#bpHiddenToggle');
    if (hiddenToggle) hiddenToggle.checked = !!settings.hidden;
    modalEl.querySelector('#bpEffectsToggle').checked = !!settings.effects;
    modalEl.querySelector('#bpStayToggle').checked = !!settings.stay;
  }

  function onKeydown(e) {
    if (e.key === 'Escape' && modalEl && modalEl.classList.contains('is-open')) {
      e.stopPropagation();
      closeBorderPetModal();
    }
  }

  function openBorderPetModal() {
    ensureModal();
    syncModal();
    modalEl.classList.add('is-open');
    document.addEventListener('keydown', onKeydown, true);
  }

  function closeBorderPetModal() {
    if (!modalEl) return;
    modalEl.classList.remove('is-open');
    document.removeEventListener('keydown', onKeydown, true);
  }

  /* ----------------------------------------------------------------------
     Khởi tạo
     ---------------------------------------------------------------------- */
  function init() {
    if (settings.pet !== 'none' && !settings.hidden) buildLayer();
    let resizeTimer = 0;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(measure, 80);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    // Đồng bộ khi đổi lựa chọn ở tab khác
    window.addEventListener('storage', (e) => {
      if (e.key !== STORAGE_KEY) return;
      settings = loadSettings();
      syncModal();
      if (settings.pet === 'none' || settings.hidden) destroyLayer(); else buildLayer();
    });
  }

  window.openBorderPetModal = openBorderPetModal;
  window.closeBorderPetModal = closeBorderPetModal;
  window.BorderPet = {
    pets: PETS.map((p) => ({ id: p.id, name: p.name })),
    getSettings: () => ({ ...settings }),
    setPet(id) {
      if (id !== 'none' && !PET_MAP[id]) return;
      settings.pet = id;
      if (id !== 'none') settings.hidden = false;
      saveSettings();
      syncModal();
      if (id === 'none' || settings.hidden) destroyLayer(); else buildLayer();
    },
    setHidden(hidden) {
      settings.hidden = !!hidden;
      if (!settings.hidden && settings.pet === 'none') settings.pet = 'cat';
      saveSettings();
      syncModal();
      if (settings.hidden || settings.pet === 'none') destroyLayer(); else buildLayer();
    },
    hide() { this.setHidden(true); },
    show() { this.setHidden(false); },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
