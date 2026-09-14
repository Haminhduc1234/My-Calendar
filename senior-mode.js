/**
 * SENIOR MODE - GỌI VIDEO MỘT CHẠM ĐẾN NGƯỜI THÂN & QUẢN LÝ DANH BẠ
 * - Tối giản cho người cao tuổi, font chữ lớn, độ tương phản cao.
 * - Danh sách Avatar người thân kích thước lớn, chạm trực tiếp để gọi Video Zalo.
 * - Quản lý thêm / sửa / xóa người thân trong danh bạ.
 * - Bộ Avatar SVG gia đình chuẩn RFC-2397 Data URI không bao giờ bị lỗi ảnh.
 * - Đồng bộ Firebase Realtime Database & Bộ nhớ đệm LocalStorage (Offline-First).
 */

(function () {
  // Global states
  let seniorContactsCache = [];
  let firebaseSeniorRef = null;
  let editingContactId = null;
  let selectedPresetAvatar = "son";
  let uploadedAvatarData = null;
  let activeProfileKey = "default";

  // Helper tạo SVG Data URI chuẩn RFC-2397
  function makeSeniorSvg(bg, innerSvg) {
    const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">` +
      `<rect width="120" height="120" rx="60" fill="${bg}"/>` +
      innerSvg +
      `</svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgStr);
  }

  // Thư viện SVG Avatar Gia Đình chuẩn đẹp, màu sắc ấm cúng, tương phản tốt
  const SENIOR_PRESETS = {
    son: {
      id: "son",
      label: "Con trai",
      relation: "Con trai",
      bg: "#2563eb",
      svg: makeSeniorSvg("#2563eb", `
        <circle cx="60" cy="45" r="22" fill="#fde047"/>
        <path d="M60 22c-12 0-20 7-20 18 0 3 1 5 2 7 4-1 9-2 18-2 10 0 15 1 18 2 1-2 2-4 2-7 0-11-8-18-20-18z" fill="#1e293b"/>
        <path d="M28 98c4-20 16-30 32-30s28 10 32 30z" fill="#ffffff"/>
      `)
    },
    daughter: {
      id: "daughter",
      label: "Con gái",
      relation: "Con gái",
      bg: "#ec4899",
      svg: makeSeniorSvg("#ec4899", `
        <circle cx="60" cy="45" r="22" fill="#fed7aa"/>
        <path d="M36 45c0-14 10-24 24-24s24 10 24 24c0 12-3 24-7 27-2-7-8-11-17-11s-15 4-17 11c-4-3-7-15-7-27z" fill="#471429"/>
        <path d="M30 100c4-18 16-26 30-26s26 8 30 26z" fill="#ffffff"/>
        <circle cx="48" cy="30" r="5" fill="#fbbf24"/>
      `)
    },
    grandson: {
      id: "grandson",
      label: "Cháu trai",
      relation: "Cháu trai",
      bg: "#0d9488",
      svg: makeSeniorSvg("#0d9488", `
        <circle cx="60" cy="48" r="20" fill="#fef08a"/>
        <path d="M40 40c0-10 9-18 20-18s20 8 20 18c0 1 0 2-1 3-3-2-9-3-19-3s-16 1-19 3c-1-1-1-2-1-3z" fill="#78350f"/>
        <path d="M32 98c3-16 14-24 28-24s25 8 28 24z" fill="#ffffff"/>
        <circle cx="60" cy="46" r="3" fill="#ea580c"/>
      `)
    },
    granddaughter: {
      id: "granddaughter",
      label: "Cháu gái",
      relation: "Cháu gái",
      bg: "#8b5cf6",
      svg: makeSeniorSvg("#8b5cf6", `
        <circle cx="60" cy="48" r="20" fill="#fde68a"/>
        <path d="M38 48c-1-10 7-20 22-20s23 10 22 20c0 8-2 15-5 18-2-5-7-8-17-8s-15 3-17 8c-3-3-5-10-5-18z" fill="#4c1d95"/>
        <path d="M34 100c3-15 13-22 26-22s23 7 26 22z" fill="#ffffff"/>
        <circle cx="75" cy="36" r="5" fill="#f43f5e"/>
      `)
    },
    doctor: {
      id: "doctor",
      label: "Bác sĩ",
      relation: "Bác sĩ",
      bg: "#059669",
      svg: makeSeniorSvg("#059669", `
        <circle cx="60" cy="45" r="21" fill="#fef08a"/>
        <path d="M42 36c2-8 9-14 18-14s16 6 18 14z" fill="#334155"/>
        <path d="M30 100c4-19 16-27 30-27s26 8 30 27z" fill="#ffffff"/>
        <rect x="56" y="78" width="8" height="20" fill="#ef4444" rx="2"/>
        <rect x="50" y="84" width="20" height="8" fill="#ef4444" rx="2"/>
      `)
    },
    friend: {
      id: "friend",
      label: "Bạn bè",
      relation: "Bạn bè",
      bg: "#ea580c",
      svg: makeSeniorSvg("#ea580c", `
        <circle cx="60" cy="46" r="21" fill="#fed7aa"/>
        <path d="M42 35c3-7 10-12 18-12s15 5 18 12z" fill="#57534e"/>
        <path d="M30 100c4-18 16-26 30-26s26 8 30 26z" fill="#ffffff"/>
        <circle cx="53" cy="46" r="2" fill="#444"/>
        <circle cx="67" cy="46" r="2" fill="#444"/>
        <path d="M54 53q6 5 12 0" stroke="#b91c1c" stroke-width="2" fill="none" stroke-linecap="round"/>
      `)
    },
    relative: {
      id: "relative",
      label: "Người thân",
      relation: "Người thân",
      bg: "#4f46e5",
      svg: makeSeniorSvg("#4f46e5", `
        <circle cx="60" cy="45" r="22" fill="#fef08a"/>
        <path d="M40 38c2-10 10-16 20-16s18 6 20 16z" fill="#1e1b4b"/>
        <path d="M28 100c4-20 16-28 32-28s28 8 32 28z" fill="#ffffff"/>
        <path d="M60 76l-4 6h8z" fill="#f59e0b"/>
      `)
    }
  };

  const DEFAULT_SENIOR_AVATAR = SENIOR_PRESETS.relative.svg;

  // Lấy ảnh avatar an toàn cho một contact
  function getSeniorAvatarSrc(contact) {
    if (!contact) return DEFAULT_SENIOR_AVATAR;
    if (contact.avatar && typeof contact.avatar === "string" && contact.avatar.trim() !== "") {
      // Nếu là Data URI svg cũ utf8 thô thì convert sang chuẩn
      if (contact.avatar.startsWith("data:image/svg+xml;utf8,")) {
        const rawSvg = contact.avatar.slice("data:image/svg+xml;utf8,".length);
        return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(rawSvg);
      }
      return contact.avatar;
    }
    if (contact.presetAvatar && SENIOR_PRESETS[contact.presetAvatar]) {
      return SENIOR_PRESETS[contact.presetAvatar].svg;
    }
    return DEFAULT_SENIOR_AVATAR;
  }

  // Khởi tạo mặc định mẫu khi người dùng chưa có dữ liệu
  function getDefaultSeedContacts() {
    return [
      {
        id: "sc_seed_1",
        name: "Con trai",
        relation: "Con trai",
        phone: "",
        presetAvatar: "son",
        avatar: "",
        order: 1,
        updatedAt: Date.now()
      },
      {
        id: "sc_seed_2",
        name: "Con gái",
        relation: "Con gái",
        phone: "",
        presetAvatar: "daughter",
        avatar: "",
        order: 2,
        updatedAt: Date.now()
      },
      {
        id: "sc_seed_3",
        name: "Bác sĩ gia đình",
        relation: "Bác sĩ",
        phone: "115",
        presetAvatar: "doctor",
        avatar: "",
        order: 3,
        updatedAt: Date.now()
      }
    ];
  }

  // Key LocalStorage theo profile
  function getStorageKey() {
    return `seniorContacts_cache_${activeProfileKey || "default"}`;
  }

  // Đọc từ Cache LocalStorage
  function loadFromLocalStorage() {
    try {
      const raw = localStorage.getItem(getStorageKey());
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          seniorContactsCache = parsed;
          return;
        }
      }
    } catch (e) {
      console.warn("[SeniorMode] LocalStorage read error:", e);
    }
    // Nếu chưa có, nạp seed mặc định
    seniorContactsCache = getDefaultSeedContacts();
  }

  // Lưu vào Cache LocalStorage
  function saveToLocalStorage() {
    try {
      localStorage.setItem(getStorageKey(), JSON.stringify(seniorContactsCache));
    } catch (e) {
      console.warn("[SeniorMode] LocalStorage write error:", e);
    }
  }

  // Khởi tạo Firebase listener
  window.initSeniorFirebase = function (firebaseDb, userProfileKey) {
    activeProfileKey = userProfileKey || window.currentProfileKey || "default";
    loadFromLocalStorage();

    if (!firebaseDb) {
      renderSeniorCallList();
      return;
    }

    if (firebaseSeniorRef) {
      try {
        firebaseSeniorRef.off();
      } catch (e) { }
    }

    firebaseSeniorRef = firebaseDb.ref(`seniorContacts/${activeProfileKey}`);

    firebaseSeniorRef.on("value", (snapshot) => {
      const val = snapshot.val();
      if (val && Array.isArray(val.contacts) && val.contacts.length > 0) {
        seniorContactsCache = val.contacts;
        saveToLocalStorage();
      } else if (val && val.contacts && typeof val.contacts === "object") {
        seniorContactsCache = Object.values(val.contacts);
        saveToLocalStorage();
      } else {
        // Chưa có trên cloud, nếu cache có seed thì lưu lên cloud
        if (seniorContactsCache.length > 0) {
          saveToFirebase();
        }
      }
      renderSeniorCallList();
      if (document.getElementById("seniorSettingsModal")?.style.display === "flex") {
        renderSeniorSettingsList();
      }
    }, (error) => {
      console.warn("[SeniorMode] Firebase listener error:", error);
      renderSeniorCallList();
    });
  };

  // Đồng bộ lên Firebase
  function saveToFirebase() {
    saveToLocalStorage();
    if (firebaseSeniorRef) {
      firebaseSeniorRef.set({
        contacts: seniorContactsCache,
        updatedAt: Date.now()
      }).catch((err) => {
        console.error("[SeniorMode] Firebase save error:", err);
      });
    }
  }

  // Chuẩn hóa số điện thoại
  function cleanPhoneNumber(phone) {
    if (!phone) return "";
    return String(phone).replace(/[^0-9+]/g, "").trim();
  }

  // Format số điện thoại hiển thị đẹp mắt (VD: 0988 123 456)
  function formatPhoneDisplay(phone) {
    if (!phone) return "Chưa thiết lập SĐT";
    const cleaned = cleanPhoneNumber(phone);
    if (cleaned.length === 10 && cleaned.startsWith("0")) {
      return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
    }
    if (cleaned.length === 11 && cleaned.startsWith("0")) {
      return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
    }
    return phone;
  }

  // Toast thông báo thị giác lớn, thân thiện cho người cao tuổi
  function showSeniorToast(message, type = "info") {
    let toast = document.getElementById("seniorActionToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "seniorActionToast";
      toast.className = "senior-toast";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = `senior-toast show ${type}`;
    setTimeout(() => {
      toast.classList.remove("show");
    }, 3500);
  }

  // Hành động gọi Video Zalo
  window.callSeniorZalo = function (phone, name) {
    const cleaned = cleanPhoneNumber(phone);
    if (!cleaned) {
      showSeniorToast(`Chưa có số điện thoại của ${name || "người thân"}. Vui lòng cài đặt số điện thoại!`, "warning");
      openSeniorSettingsModal();
      return;
    }

    showSeniorToast(`Đang mở Zalo gọi video cho ${name || "người thân"}...`, "success");

    // Mở trang kết nối Zalo
    const zaloUrl = `https://zalo.me/${cleaned}`;
    setTimeout(() => {
      window.open(zaloUrl, "_blank");
    }, 400);
  };

  // Hành động gọi điện thoại thường
  window.callSeniorPhone = function (phone, name) {
    const cleaned = cleanPhoneNumber(phone);
    if (!cleaned) {
      showSeniorToast(`Chưa có số điện thoại của ${name || "người thân"}!`, "warning");
      return;
    }
    window.location.href = `tel:${cleaned}`;
  };

  // ==========================================
  // MODAL HIỂN THỊ "MỘT CHẠM" (#seniorCallModal)
  // ==========================================

  window.openSeniorCallModal = function () {
    if (typeof closeAllModals === "function") closeAllModals();
    const modal = document.getElementById("seniorCallModal");
    if (!modal) return;
    renderSeniorCallList();
    modal.style.display = "flex";
  };

  window.closeSeniorCallModal = function () {
    const modal = document.getElementById("seniorCallModal");
    if (!modal) return;
    modal.style.display = "none";
  };

  // Render danh sách trong Modal Một Chạm
  function renderSeniorCallList() {
    const container = document.getElementById("seniorContactsGrid");
    if (!container) return;

    if (!seniorContactsCache || seniorContactsCache.length === 0) {
      container.innerHTML = `
        <div class="senior-empty-state">
          <div class="senior-empty-icon"><i class="fi fi-rr-users"></i></div>
          <div class="senior-empty-title">Chưa có người thân trong danh bạ</div>
          <p class="senior-empty-desc">Nhấn vào nút bên dưới để cài đặt tên, avatar và số điện thoại người thân.</p>
          <button class="senior-btn-add-quick" onclick="closeSeniorCallModal(); openSeniorSettingsModal();">
            <i class="fi fi-rr-user-add"></i> Thêm Người Thân Ngay
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = seniorContactsCache.map((c) => {
      const avatarSrc = getSeniorAvatarSrc(c);
      const phoneDisplay = formatPhoneDisplay(c.phone);
      const safeName = c.name || "Người thân";
      const relationBadge = c.relation ? `<span class="senior-relation-tag">${c.relation}</span>` : "";

      return `
        <div class="senior-contact-card" onclick="callSeniorZalo('${c.phone || ""}', '${safeName.replace(/'/g, "\\'")}')">
          <div class="senior-avatar-wrapper">
            <img class="senior-card-avatar" src="${avatarSrc}" alt="${safeName}" onerror="this.src='${DEFAULT_SENIOR_AVATAR}'" />
            <div class="senior-zalo-badge" title="Gọi Zalo">
              <span class="zalo-text-badge">Zalo</span>
            </div>
          </div>
          <div class="senior-contact-info">
            <div class="senior-contact-name-row">
              <span class="senior-contact-name">${safeName}</span>
              ${relationBadge}
            </div>
            <div class="senior-contact-phone">${phoneDisplay}</div>
          </div>
          <div class="senior-card-actions" onclick="event.stopPropagation()">
            <button type="button" class="senior-call-btn senior-btn-zalo" title="Gọi Video Zalo" onclick="callSeniorZalo('${c.phone || ""}', '${safeName.replace(/'/g, "\\'")}')">
              <i class="fi fi-rr-video-camera-alt"></i>
              <span>Gọi Video</span>
            </button>
            ${c.phone ? `
              <button type="button" class="senior-call-btn senior-btn-phone" title="Gọi Thường" onclick="callSeniorPhone('${c.phone || ""}', '${safeName.replace(/'/g, "\\'")}')">
                <i class="fi fi-rr-phone-call"></i>
              </button>
            ` : ""}
          </div>
        </div>
      `;
    }).join("");
  }

  // ==========================================
  // MODAL CÀI ĐẶT NGƯỜI THÂN (#seniorSettingsModal)
  // ==========================================

  window.openSeniorSettingsModal = function () {
    if (typeof closeAllModals === "function") closeAllModals();
    const modal = document.getElementById("seniorSettingsModal");
    if (!modal) return;
    renderSeniorSettingsList();
    renderPresetAvatarGrid();
    resetSeniorForm();
    modal.style.display = "flex";
  };

  window.closeSeniorSettingsModal = function () {
    const modal = document.getElementById("seniorSettingsModal");
    if (!modal) return;
    modal.style.display = "none";
    resetSeniorForm();
  };

  // Render danh sách trong Modal Cài đặt
  function renderSeniorSettingsList() {
    const container = document.getElementById("seniorSettingsList");
    if (!container) return;

    if (!seniorContactsCache || seniorContactsCache.length === 0) {
      container.innerHTML = `
        <div class="senior-settings-empty">Danh bạ đang trống. Hãy thêm người thân ở mẫu bên dưới!</div>
      `;
      return;
    }

    container.innerHTML = seniorContactsCache.map((c, idx) => {
      const avatarSrc = getSeniorAvatarSrc(c);
      const isFirst = idx === 0;
      const isLast = idx === seniorContactsCache.length - 1;

      return `
        <div class="senior-settings-item ${editingContactId === c.id ? "active-edit" : ""}">
          <img class="senior-settings-item-avatar" src="${avatarSrc}" alt="${c.name}" onerror="this.src='${DEFAULT_SENIOR_AVATAR}'" />
          <div class="senior-settings-item-details">
            <div class="senior-item-name">${c.name || "Chưa có tên"}</div>
            <div class="senior-item-sub">
              ${c.relation ? `<span class="senior-item-rel">${c.relation}</span> • ` : ""}
              <span class="senior-item-phone">${c.phone || "Chưa có SĐT"}</span>
            </div>
          </div>
          <div class="senior-item-controls">
            <button type="button" class="senior-ctrl-btn" title="Chuyển lên" onclick="moveSeniorContact('${c.id}', -1)" ${isFirst ? "disabled" : ""}>
              <i class="fi fi-rr-arrow-up"></i>
            </button>
            <button type="button" class="senior-ctrl-btn" title="Chuyển xuống" onclick="moveSeniorContact('${c.id}', 1)" ${isLast ? "disabled" : ""}>
              <i class="fi fi-rr-arrow-down"></i>
            </button>
            <button type="button" class="senior-ctrl-btn edit" title="Sửa" onclick="editSeniorContact('${c.id}')">
              <i class="fi fi-rr-edit"></i>
            </button>
            <button type="button" class="senior-ctrl-btn delete" title="Xóa" onclick="deleteSeniorContact('${c.id}')">
              <i class="fi fi-rr-trash"></i>
            </button>
          </div>
        </div>
      `;
    }).join("");
  }

  // Render lưới avatar minh họa có sẵn
  function renderPresetAvatarGrid() {
    const grid = document.getElementById("seniorPresetGrid");
    if (!grid) return;

    grid.innerHTML = Object.values(SENIOR_PRESETS).map((p) => {
      const isSelected = !uploadedAvatarData && selectedPresetAvatar === p.id;
      return `
        <div class="senior-preset-option ${isSelected ? "selected" : ""}" onclick="selectSeniorPreset('${p.id}')">
          <img class="senior-preset-img" src="${p.svg}" alt="${p.label}" />
          <span class="senior-preset-label">${p.label}</span>
        </div>
      `;
    }).join("");
  }

  window.selectSeniorPreset = function (presetId) {
    if (!SENIOR_PRESETS[presetId]) return;
    selectedPresetAvatar = presetId;
    uploadedAvatarData = null; // Bỏ ảnh upload nếu chọn preset
    updateAvatarPreview();
    renderPresetAvatarGrid();
  };

  // Cập nhật khung xem trước Avatar
  function updateAvatarPreview() {
    const previewImg = document.getElementById("seniorAvatarPreview");
    if (!previewImg) return;

    if (uploadedAvatarData) {
      previewImg.src = uploadedAvatarData;
      previewImg.style.display = "block";
    } else if (selectedPresetAvatar && SENIOR_PRESETS[selectedPresetAvatar]) {
      previewImg.src = SENIOR_PRESETS[selectedPresetAvatar].svg;
      previewImg.style.display = "block";
    } else {
      previewImg.src = DEFAULT_SENIOR_AVATAR;
      previewImg.style.display = "block";
    }
  }

  // Reset form nhập liệu
  function resetSeniorForm() {
    editingContactId = null;
    selectedPresetAvatar = "son";
    uploadedAvatarData = null;

    const nameInput = document.getElementById("seniorInputName");
    const phoneInput = document.getElementById("seniorInputPhone");
    const relInput = document.getElementById("seniorInputRelation");
    const fileInput = document.getElementById("seniorFileInput");
    const submitBtn = document.getElementById("btnSaveSeniorContact");
    const cancelBtn = document.getElementById("btnCancelSeniorEdit");
    const formTitle = document.getElementById("seniorFormTitle");

    if (nameInput) nameInput.value = "";
    if (phoneInput) phoneInput.value = "";
    if (relInput) relInput.value = "Con trai";
    if (fileInput) fileInput.value = "";
    if (formTitle) formTitle.textContent = "Thêm Người Thân Mới";
    if (submitBtn) submitBtn.innerHTML = '<i class="fi fi-rr-disk"></i> Lưu Người Thân';
    if (cancelBtn) cancelBtn.style.display = "none";

    updateAvatarPreview();
    renderPresetAvatarGrid();
  }

  window.cancelSeniorEdit = function () {
    resetSeniorForm();
    renderSeniorSettingsList();
  };

  // Sửa liên hệ
  window.editSeniorContact = function (id) {
    const contact = seniorContactsCache.find((c) => c.id === id);
    if (!contact) return;

    editingContactId = id;
    const nameInput = document.getElementById("seniorInputName");
    const phoneInput = document.getElementById("seniorInputPhone");
    const relInput = document.getElementById("seniorInputRelation");
    const submitBtn = document.getElementById("btnSaveSeniorContact");
    const cancelBtn = document.getElementById("btnCancelSeniorEdit");
    const formTitle = document.getElementById("seniorFormTitle");

    if (nameInput) nameInput.value = contact.name || "";
    if (phoneInput) phoneInput.value = contact.phone || "";
    if (relInput) relInput.value = contact.relation || "";

    if (contact.avatar && contact.avatar.startsWith("data:image")) {
      uploadedAvatarData = contact.avatar;
    } else {
      uploadedAvatarData = null;
      selectedPresetAvatar = contact.presetAvatar || "son";
    }

    if (formTitle) formTitle.textContent = `Chỉnh Sửa: ${contact.name || "Người thân"}`;
    if (submitBtn) submitBtn.innerHTML = '<i class="fi fi-rr-check"></i> Cập Nhật';
    if (cancelBtn) cancelBtn.style.display = "inline-flex";

    updateAvatarPreview();
    renderPresetAvatarGrid();
    renderSeniorSettingsList();

    // Scroll form vào tầm mắt
    document.getElementById("seniorFormContainer")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  // Xóa liên hệ
  window.deleteSeniorContact = function (id) {
    const contact = seniorContactsCache.find((c) => c.id === id);
    if (!contact) return;

    if (!confirm(`Bạn có chắc muốn xóa "${contact.name || "Người thân này"}" khỏi danh bạ?`)) {
      return;
    }

    seniorContactsCache = seniorContactsCache.filter((c) => c.id !== id);
    saveToFirebase();
    renderSeniorSettingsList();
    renderSeniorCallList();
    if (editingContactId === id) {
      resetSeniorForm();
    }
    showSeniorToast("Đã xóa người thân khỏi danh bạ", "info");
  };

  // Di chuyển thứ tự
  window.moveSeniorContact = function (id, direction) {
    const idx = seniorContactsCache.findIndex((c) => c.id === id);
    if (idx === -1) return;
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= seniorContactsCache.length) return;

    const item = seniorContactsCache.splice(idx, 1)[0];
    seniorContactsCache.splice(targetIdx, 0, item);

    saveToFirebase();
    renderSeniorSettingsList();
    renderSeniorCallList();
  };

  // Xử lý upload ảnh cá nhân
  window.handleSeniorFileUpload = function (event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Vui lòng chọn file hình ảnh!");
      return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
      const img = new Image();
      img.onload = function () {
        // Tối ưu nén ảnh về hình tròn 200x200 để lưu Firebase cực nhẹ
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const size = 200;
        canvas.width = size;
        canvas.height = size;

        // Cắt vuông tâm
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;

        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
        uploadedAvatarData = canvas.toDataURL("image/jpeg", 0.85);

        updateAvatarPreview();
        renderPresetAvatarGrid();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  // Lưu Form (Thêm mới hoặc Cập nhật)
  window.saveSeniorContactForm = function (event) {
    if (event) event.preventDefault();

    const nameInput = document.getElementById("seniorInputName");
    const phoneInput = document.getElementById("seniorInputPhone");
    const relInput = document.getElementById("seniorInputRelation");

    const name = (nameInput?.value || "").trim();
    const phone = cleanPhoneNumber(phoneInput?.value || "");
    const relation = (relInput?.value || "").trim();

    if (!name) {
      alert("Vui lòng nhập tên người thân!");
      nameInput?.focus();
      return;
    }

    if (!phone) {
      alert("Vui lòng nhập số điện thoại để gọi Zalo!");
      phoneInput?.focus();
      return;
    }

    const finalAvatar = uploadedAvatarData ? uploadedAvatarData : "";
    const finalPreset = uploadedAvatarData ? "" : (selectedPresetAvatar || "son");

    if (editingContactId) {
      // Cập nhật
      const idx = seniorContactsCache.findIndex((c) => c.id === editingContactId);
      if (idx !== -1) {
        seniorContactsCache[idx] = {
          ...seniorContactsCache[idx],
          name,
          phone,
          relation,
          avatar: finalAvatar,
          presetAvatar: finalPreset,
          updatedAt: Date.now()
        };
      }
      showSeniorToast(`Đã cập nhật thông tin ${name}`, "success");
    } else {
      // Thêm mới
      const newContact = {
        id: `sc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name,
        phone,
        relation,
        avatar: finalAvatar,
        presetAvatar: finalPreset,
        order: seniorContactsCache.length + 1,
        updatedAt: Date.now()
      };
      seniorContactsCache.push(newContact);
      showSeniorToast(`Đã thêm ${name} vào danh bạ`, "success");
    }

    saveToFirebase();
    renderSeniorSettingsList();
    renderSeniorCallList();
    resetSeniorForm();
  };

  // Khởi động sẵn danh bạ từ LocalStorage
  loadFromLocalStorage();
  document.addEventListener("DOMContentLoaded", () => {
    renderSeniorCallList();
  });
})();
