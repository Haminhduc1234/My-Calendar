/* ==========================================================================
   ZH-DATA-LOADER: Bộ Nạp & Quản Lý Dữ Liệu Tiếng Trung HSK Mở (JSON Datasets)
   - Tải theo nhu cầu (Lazy-loading) từng cấp độ HSK 1 - 4
   - Bộ nhớ đệm (Cache) trên LocalStorage / IndexedDB
   - Tải nền (Preload) toàn bộ kho dữ liệu
   - Nhập / Xuất dữ liệu JSON (Import / Export)
   ========================================================================== */

const ZHDataLoader = {
  levels: ["hsk1", "hsk2", "hsk3", "hsk4"],
  meta: {
    hsk1: { name: "HSK 1", label: "⭐ HSK 1 (152 từ căn bản)", count: 152, desc: "Căn bản" },
    hsk2: { name: "HSK 2", label: "⭐⭐ HSK 2 (144 từ sơ cấp)", count: 144, desc: "Sơ cấp" },
    hsk3: { name: "HSK 3", label: "⭐⭐⭐ HSK 3 (282 từ trung cấp 1)", count: 282, desc: "Trung cấp 1" },
    hsk4: { name: "HSK 4", label: "⭐⭐⭐⭐ HSK 4 (362 từ trung cấp 2)", count: 362, desc: "Trung cấp 2" }
  },

  loadedStatus: {
    hsk1: false,
    hsk2: false,
    hsk3: false,
    hsk4: false
  },

  isPreloading: false,

  // Kiểm tra xem cấp độ đã được nạp vào bộ nhớ chưa
  isLevelLoaded(level) {
    if (typeof ZH_VOCABULARY_DATA === "undefined") return false;
    return Array.isArray(ZH_VOCABULARY_DATA[level]) && ZH_VOCABULARY_DATA[level].length > 0;
  },

  // Lấy tổng số từ HSK đã nạp vào bộ nhớ
  getTotalLoadedCount() {
    if (typeof ZH_VOCABULARY_DATA === "undefined") return 0;
    let count = 0;
    this.levels.forEach(lvl => {
      if (Array.isArray(ZH_VOCABULARY_DATA[lvl])) {
        count += ZH_VOCABULARY_DATA[lvl].length;
      }
    });
    return count;
  },

  // Nạp 1 cấp độ HSK (Cache-First -> Network Fallback)
  async loadHskLevel(level) {
    if (!this.levels.includes(level)) return [];
    if (typeof ZH_VOCABULARY_DATA === "undefined") window.ZH_VOCABULARY_DATA = {};

    // 1. Kiểm tra trong bộ nhớ RAM
    if (this.isLevelLoaded(level)) {
      this.loadedStatus[level] = true;
      return ZH_VOCABULARY_DATA[level];
    }

    // 2. Kiểm tra bộ nhớ đệm LocalStorage
    const cacheKey = `zh_hsk_cache_${level}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          ZH_VOCABULARY_DATA[level] = parsed;
          this.loadedStatus[level] = true;
          return parsed;
        }
      }
    } catch (e) {
      console.warn("ZHDataLoader: LocalStorage read error", e);
    }

    // 3. Tải từ file tĩnh JSON
    try {
      const url = `data/zh/${level}.json?v=20260923`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        ZH_VOCABULARY_DATA[level] = data;
        this.loadedStatus[level] = true;

        // Lưu đệm vào LocalStorage để lần sau dùng Offline tức thì
        try {
          localStorage.setItem(cacheKey, JSON.stringify(data));
        } catch (storageErr) {
          console.warn("ZHDataLoader: LocalStorage quota exceeded, skipping persistent cache", storageErr);
        }

        return data;
      }
    } catch (err) {
      console.error(`ZHDataLoader: Không thể tải ${level}.json:`, err);
    }

    return ZH_VOCABULARY_DATA[level] || [];
  },

  // Nạp toàn bộ HSK 1 - 4 chạy ngầm
  async preloadAllHsk(silent = true) {
    if (this.isPreloading) return;
    this.isPreloading = true;

    if (!silent) this.showToast("Đang nạp trọn bộ HSK 1 - 4 vào bộ nhớ...");

    for (const lvl of this.levels) {
      if (!this.isLevelLoaded(lvl)) {
        await this.loadHskLevel(lvl);
      }
    }

    this.isPreloading = false;
    this.updateDataModalUI();

    // Cập nhật lại danh sách và thẻ flashcard nếu người dùng đang ở tab từ vựng tiếng Trung
    if (typeof currentLearnLanguage !== "undefined" && currentLearnLanguage === "zh") {
      if (typeof currentVocabCategory !== "undefined") {
        if (currentVocabCategory === "all" || this.levels.includes(currentVocabCategory)) {
          if (typeof selectVocabCategory === "function") {
            selectVocabCategory(currentVocabCategory);
          }
        }
      }
      if (typeof updateSrsUI === "function") {
        updateSrsUI();
      }
    }

    if (!silent) {
      this.showToast(`Đã nạp hoàn tất ${this.getTotalLoadedCount()} từ vựng HSK 1 - 4!`);
    }
  },

  // Xuất dữ liệu JSON ra file để người dùng tải về máy
  exportHskJson(level = "all") {
    let exportData = [];
    let filename = "hsk_vocabulary.json";

    if (level === "all") {
      this.levels.forEach(lvl => {
        if (Array.isArray(ZH_VOCABULARY_DATA[lvl])) {
          exportData = exportData.concat(ZH_VOCABULARY_DATA[lvl]);
        }
      });
      filename = "all_hsk1_to_hsk4_vocab.json";
    } else if (this.levels.includes(level)) {
      exportData = ZH_VOCABULARY_DATA[level] || [];
      filename = `${level}_vocab.json`;
    }

    if (!exportData.length) {
      alert("Chưa có dữ liệu từ vựng để xuất!");
      return;
    }

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", filename);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  },

  // Nhập dữ liệu JSON tùy chỉnh từ file người dùng tải lên
  async importCustomHskJson(file) {
    if (!file) return;

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target.result);
          if (!Array.isArray(json) || json.length === 0) {
            throw new Error("File JSON phải là một mảng danh sách từ vựng hợp lệ.");
          }

          // Chuẩn hóa từng bản ghi
          const validWords = json.filter(item => item && (item.word || item.hanzi));
          if (validWords.length === 0) {
            throw new Error("Không tìm thấy từ vựng hợp lệ trong file JSON.");
          }

          const importedList = validWords.map((item, idx) => ({
            id: item.id || `custom_zh_${Date.now()}_${idx}`,
            level: item.level || 0,
            word: item.word || item.hanzi,
            phonetic: item.phonetic || item.pinyin || "",
            hanviet: item.hanviet || "",
            meaning: item.meaning || item.vi || "",
            example: item.example || "",
            examplePinyin: item.examplePinyin || "",
            exampleVi: item.exampleVi || ""
          }));

          // Gán vào danh mục tùy chỉnh
          if (typeof ZH_VOCABULARY_DATA === "undefined") window.ZH_VOCABULARY_DATA = {};
          ZH_VOCABULARY_DATA.custom = (ZH_VOCABULARY_DATA.custom || []).concat(importedList);

          // Cập nhật danh mục
          if (typeof ZH_VOCAB_CATEGORIES !== "undefined") {
            ZH_VOCAB_CATEGORIES.custom = `⭐ Nhập Tùy Chỉnh (${ZH_VOCABULARY_DATA.custom.length} từ)`;
            const catSelect = document.getElementById("vocabCategorySelector");
            if (catSelect && typeof renderCategoryButtons === "function") {
              renderCategoryButtons("vocabCategorySelector", ZH_VOCAB_CATEGORIES, "custom", "selectVocabCategory");
            }
          }

          // Lưu vào LocalStorage
          try {
            localStorage.setItem("zh_hsk_custom_data", JSON.stringify(ZH_VOCABULARY_DATA.custom));
          } catch (e) {
            console.warn("Storage quota limit reached for custom data");
          }

          if (typeof selectVocabCategory === "function") {
            selectVocabCategory("custom");
          }

          ZHDataLoader.showToast(`Nhập thành công ${importedList.length} từ vựng mới!`);
          ZHDataLoader.closeZhDataModal();
          resolve(importedList);
        } catch (err) {
          alert("Lỗi khi đọc file JSON: " + err.message);
          reject(err);
        }
      };
      reader.readAsText(file, "UTF-8");
    });
  },

  // Hiển thị thông báo nhỏ Toast
  showToast(message) {
    let toast = document.getElementById("zhDataLoaderToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "zhDataLoaderToast";
      toast.style.position = "fixed";
      toast.style.bottom = "24px";
      toast.style.right = "24px";
      toast.style.background = "#0f172a";
      toast.style.color = "#38bdf8";
      toast.style.padding = "12px 20px";
      toast.style.borderRadius = "10px";
      toast.style.border = "1px solid rgba(56, 189, 248, 0.3)";
      toast.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.4)";
      toast.style.fontSize = "13.5px";
      toast.style.fontWeight = "600";
      toast.style.zIndex = "99999";
      toast.style.display = "flex";
      toast.style.alignItems = "center";
      toast.style.gap = "8px";
      toast.style.transition = "opacity 0.3s ease, transform 0.3s ease";
      document.body.appendChild(toast);
    }

    const safeMsg = typeof escapeHtml === "function" ? escapeHtml(message) : message;
    toast.innerHTML = `<i class="fi fi-rr-check-circle" style="color: #10b981; position: relative; top: 1px;"></i> <span>${safeMsg}</span>`;
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";

    setTimeout(() => {
      if (toast) {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(10px)";
      }
    }, 3200);
  },

  // Cập nhật giao diện Modal Quản Lý Dữ Liệu HSK
  updateDataModalUI() {
    if (typeof document === "undefined") return;
    const container = document.getElementById("zhDataModalLevelsList");
    if (!container) return;

    let html = "";
    this.levels.forEach(lvl => {
      const isLoaded = this.isLevelLoaded(lvl);
      const m = this.meta[lvl];
      const count = isLoaded && Array.isArray(ZH_VOCABULARY_DATA[lvl]) ? ZH_VOCABULARY_DATA[lvl].length : m.count;

      html += `
        <div class="zh-data-level-row">
          <div class="zh-data-level-info">
            <span class="zh-data-level-badge">${m.name}</span>
            <div class="zh-data-level-text">
              <span class="zh-data-level-title">${m.desc}</span>
              <span class="zh-data-level-sub">${count} từ vựng chuẩn HSK</span>
            </div>
          </div>
          <div class="zh-data-level-action">
            <span class="zh-data-status-pill ${isLoaded ? 'ready' : 'pending'}">
              <i class="fi ${isLoaded ? 'fi-rr-check' : 'fi-rr-clock'}" style="position: relative; top: 1px;"></i>
              <span>${isLoaded ? 'Đã nạp' : 'Chưa nạp'}</span>
            </span>
            <button class="zh-data-btn-sm" onclick="ZHDataLoader.loadAndSelect('${lvl}')" title="Nạp và học ngay">
              Học ngay
            </button>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;

    const totalEl = document.getElementById("zhDataModalTotalCount");
    if (totalEl) {
      totalEl.textContent = `${this.getTotalLoadedCount()} / 940 từ đã sẵn sàng`;
    }
  },

  // Nạp 1 cấp độ và chuyển người dùng vào học ngay
  async loadAndSelect(level) {
    await this.loadHskLevel(level);
    this.closeZhDataModal();
    if (typeof selectVocabCategory === "function") {
      selectVocabCategory(level);
    }
    this.showToast(`Đã chọn học ${this.meta[level].name}!`);
  },

  // Mở Modal Quản Lý Dữ Liệu
  openZhDataModal() {
    if (typeof document === "undefined") return;
    const modal = document.getElementById("zhDataManagerModal");
    if (!modal) return;
    this.updateDataModalUI();
    modal.style.display = "flex";
  },

  // Đóng Modal Quản Lý Dữ Liệu
  closeZhDataModal() {
    if (typeof document === "undefined") return;
    const modal = document.getElementById("zhDataManagerModal");
    if (modal) modal.style.display = "none";
  }
};

if (typeof window !== "undefined") {
  window.ZHDataLoader = ZHDataLoader;
}

// Khởi chạy khi tài liệu sẵn sàng
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    // Nạp dữ liệu tùy chỉnh từ LocalStorage nếu có
    try {
      const savedCustom = localStorage.getItem("zh_hsk_custom_data");
      if (savedCustom) {
        const parsed = JSON.parse(savedCustom);
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (typeof ZH_VOCABULARY_DATA !== "undefined") {
            ZH_VOCABULARY_DATA.custom = parsed;
            if (typeof ZH_VOCAB_CATEGORIES !== "undefined") {
              ZH_VOCAB_CATEGORIES.custom = `⭐ Nhập Tùy Chỉnh (${parsed.length} từ)`;
            }
          }
        }
      }
    } catch (e) {
      console.warn("ZHDataLoader: Error restoring custom vocab", e);
    }
  });
}
