/* ==================== CHINESE TUTOR - AI GIA SƯ TIẾNG TRUNG RIÊNG BIỆT (GOOGLE GEMINI) ==================== */

// Predefined Google Gemini Models
const GEMINI_TUTOR_MODELS = [
  {
    id: "gemini-3.6-flash",
    name: "Gemini 3.6 Flash",
    desc: "Mô hình mới nhất của Google AI, suy nghĩ thông minh, phân tích sâu và sửa lỗi chính xác (Khuyên dùng)"
  },
  {
    id: "gemini-3.1-flash-lite",
    name: "Gemini 3.1 Flash-Lite",
    desc: "Mô hình siêu nhẹ, tốc độ phản hồi cực nhanh, tối ưu chi phí và hạn mức quota cao (Tiết kiệm lượt gọi)"
  },
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    desc: "Mô hình cân bằng giữa hiệu năng và tốc độ, hỗ trợ đa nhiệm và sáng tạo hiệu quả (Cân bằng)"
  }
];
const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";

// Tutor State (Per Account)
let currentTutorModel = DEFAULT_GEMINI_MODEL;
let tutorGeminiKey = "";
let tutorConversationHistory = [];
let currentTutorScenario = "free";
let isTutorSpeaking = false;
let tutorRecognition = null;
let isTutorListening = false;

let firebaseTutorDb = null;
let tutorProfileKey = "";
let firebaseTutorRef = null;

// Helper to get active user profile key
function getActiveTutorProfileKey() {
  return tutorProfileKey || window.userProfileKey || localStorage.getItem("currentProfileKey") || "default";
}

// Helper to check if current account has configured Gemini API Key
function hasTutorApiKey() {
  const pKey = getActiveTutorProfileKey();
  const key = tutorGeminiKey || localStorage.getItem(`geminiApiKey_${pKey}`) || localStorage.getItem("geminiApiKey") || "";
  return !!(key && key.trim().length > 10);
}
window.hasTutorApiKey = hasTutorApiKey;

// Update UI Notice (Banner & FAB Dot) based on whether API Key is configured
function checkTutorApiKeyNotice() {
  const banner = document.getElementById("tutorKeyWarningBanner");
  const noticeDot = document.getElementById("tutorFabNoticeDot");
  const hasKey = hasTutorApiKey();

  if (banner) {
    banner.style.display = hasKey ? "none" : "flex";
  }
  if (noticeDot) {
    noticeDot.style.display = hasKey ? "none" : "flex";
  }
}
window.checkTutorApiKeyNotice = checkTutorApiKeyNotice;

// Show or hide Floating Chat Button
function showTutorFloatingBtn(show) {
  const btn = document.getElementById("tutorFloatingChatBtn");
  if (!btn) return;
  btn.style.display = show ? "flex" : "none";
  checkTutorApiKeyNotice();
}
window.showTutorFloatingBtn = showTutorFloatingBtn;

// Tự động kiểm tra và đồng bộ trạng thái hiển thị của nút Chatbox AI
function initTutorFloatingAutoCheck() {
  const checkAndShow = () => {
    const learnModal = document.getElementById("learnModal");
    const isLearnOpen = learnModal && (learnModal.style.display === "flex" || learnModal.style.display === "block" || (window.getComputedStyle && getComputedStyle(learnModal).display !== "none"));
    const lang = window.currentLearnLanguage || localStorage.getItem("learnSelectedLanguage") || "en";
    const btn = document.getElementById("tutorFloatingChatBtn");
    if (btn) {
      if (isLearnOpen && lang === "zh") {
        btn.style.display = "flex";
      } else {
        btn.style.display = "none";
      }
    }
    checkTutorApiKeyNotice();
  };

  const learnModal = document.getElementById("learnModal");
  if (learnModal && window.MutationObserver) {
    const observer = new MutationObserver(checkAndShow);
    observer.observe(learnModal, { attributes: true, attributeFilter: ["style", "class"] });
  }

  // Chạy ngay kiểm tra
  checkAndShow();
}
window.initTutorFloatingAutoCheck = initTutorFloatingAutoCheck;

// Cuộn cửa sổ chat xuống tin nhắn mới nhất
function scrollTutorToBottom() {
  const container = document.getElementById("tutorChatMessages");
  if (container) {
    container.scrollTop = container.scrollHeight;
  }
}
window.scrollTutorToBottom = scrollTutorToBottom;

// Open Chinese Tutor Modal (Full Screen)
function openChineseTutorModal() {
  try {
    const modal = document.getElementById("chineseTutorModal");
    if (!modal) {
      console.warn("[Chinese Tutor] Không tìm thấy modal #chineseTutorModal");
      return;
    }

    // Khởi tạo kịch bản và dữ liệu gia sư AI
    if (typeof initChineseTutor === "function") {
      initChineseTutor();
    } else {
      if (typeof renderTutorScenarioPills === "function") renderTutorScenarioPills();
      if (typeof loadTutorScenarioHistory === "function") loadTutorScenarioHistory(currentTutorScenario);
    }

    modal.style.display = "flex";
    modal.classList.add("active");
    document.body.style.overflow = "hidden";

    updateTutorModelBadge();
    checkTutorApiKeyNotice();
    scrollTutorToBottom();

    if (!hasTutorApiKey()) {
      if (typeof showToast === "function") {
        showToast("Chưa cài đặt Google Gemini API Key. Bấm vào banner để cài đặt miễn phí!", 4000);
      }
    } else {
      setTimeout(() => {
        const input = document.getElementById("tutorChatInput");
        if (input) input.focus();
      }, 200);
    }
  } catch (err) {
    console.error("[Chinese Tutor] Lỗi khi mở modal chat:", err);
  }
}
window.openChineseTutorModal = openChineseTutorModal;

// Close Chinese Tutor Modal
function closeChineseTutorModal() {
  const modal = document.getElementById("chineseTutorModal");
  if (modal) {
    modal.style.display = "none";
    modal.classList.remove("active");
  }

  // Restore scroll overflow for learnModal if still open
  const learnModal = document.getElementById("learnModal");
  if (learnModal && (learnModal.style.display === "flex" || (window.getComputedStyle && getComputedStyle(learnModal).display !== "none"))) {
    document.body.style.overflow = "hidden";
  } else {
    document.body.style.overflow = "";
  }
}
window.closeChineseTutorModal = closeChineseTutorModal;

// Load Account-Specific Settings (from LocalStorage first, then Firebase)
function loadTutorAccountSettings() {
  const pKey = getActiveTutorProfileKey();
  const savedKey = localStorage.getItem(`geminiApiKey_${pKey}`) || localStorage.getItem("geminiApiKey") || "";
  const savedModel = localStorage.getItem(`tutorAiModel_${pKey}`) || localStorage.getItem("tutorAiModel") || DEFAULT_GEMINI_MODEL;

  if (savedKey) {
    tutorGeminiKey = savedKey;
  }

  // Chuẩn hóa và chuyển đổi nếu model cũ là 2.5 (đã bị Google ngừng hỗ trợ) hoặc không có trong danh sách
  let effectiveModel = savedModel;
  if (!effectiveModel || effectiveModel.includes("2.5") || !GEMINI_TUTOR_MODELS.some(m => m.id === effectiveModel)) {
    effectiveModel = DEFAULT_GEMINI_MODEL;
    localStorage.setItem(`tutorAiModel_${pKey}`, effectiveModel);
    localStorage.setItem("tutorAiModel", effectiveModel);
  }
  currentTutorModel = effectiveModel;
  updateTutorModelBadge();
  checkTutorApiKeyNotice();

  // If Firebase ref exists, fetch remote settings
  if (firebaseTutorRef) {
    firebaseTutorRef.child("settings").once("value").then(snap => {
      const data = snap.val();
      if (data) {
        if (data.geminiApiKey) {
          tutorGeminiKey = data.geminiApiKey;
          localStorage.setItem(`geminiApiKey_${pKey}`, data.geminiApiKey);
          localStorage.setItem("geminiApiKey", data.geminiApiKey);
        }
        let remoteModel = data.model;
        if (remoteModel && !remoteModel.includes("2.5") && GEMINI_TUTOR_MODELS.some(m => m.id === remoteModel)) {
          currentTutorModel = remoteModel;
          localStorage.setItem(`tutorAiModel_${pKey}`, remoteModel);
          localStorage.setItem("tutorAiModel", remoteModel);
        } else {
          currentTutorModel = DEFAULT_GEMINI_MODEL;
        }
        updateTutorModelBadge();
        checkTutorApiKeyNotice();
        console.log(`[Chinese Tutor] Loaded Gemini settings from Firebase for account ${pKey}`);
      }
    }).catch(err => {
      console.warn("[Chinese Tutor] Could not load settings from Firebase:", err);
    });
  }
}

// Trò chuyện tự do duy nhất (đã loại bỏ hệ thống chọn chủ đề để đơn giản hóa & tiết kiệm API quota)
const CHINESE_TUTOR_SCENARIOS = {
  free: {
    id: "free",
    name: "Trò chuyện tự do",
    icon: "☕",
    level: "Mọi cấp độ",
    description: "Nói chuyện tự do về mọi chủ đề. Gia sư sẽ sửa ngữ pháp và gợi ý từ vựng chuẩn HSK.",
    initialMessage: {
      zh: "你好！我是你的中文助教。今天你想聊些什么？我们可以聊日常、兴趣、或者练习任何语法点！",
      pinyin: "Nǐ hǎo! Wǒ shì nǐ de Zhōngwén zhùjiào. Jīntiān nǐ xiǎng liáo xiē shénme? Wǒmen kěyǐ liáo rìcháng, xìngqù, huòzhě liànxí rènhé yǔfǎ diǎn!",
      vi: "Xin chào! Tôi là trợ giảng tiếng Trung của bạn. Hôm nay bạn muốn trò chuyện về điều gì? Chúng ta có thể nói về đời sống thường ngày, sở thích, hoặc luyện tập bất kỳ điểm ngữ pháp nào!"
    },
    systemPrompt: `Bạn là một gia sư tiếng Trung (Chinese Tutor) bản địa cực kỳ thân thiện, kiên nhẫn và chuyên nghiệp.
Nhiệm vụ của bạn:
1. Luôn phản hồi theo cấu trúc 3 phần rõ ràng:
   [ZH] Câu trả lời tiếng Trung (Hán tự giản thể) [/ZH]
   [PINYIN] Phiên âm Pinyin đầy đủ dấu thanh [/PINYIN]
   [VI] Bản dịch tiếng Việt tự nhiên [/VI]
2. Nếu câu tiếng Trung của học viên có lỗi ngữ pháp, dùng từ chưa tự nhiên hoặc sai thanh điệu, hãy thêm phần:
   [FEEDBACK] 💡 Nhận xét: Sửa lỗi và giải thích ngắn gọn bằng tiếng Việt [/FEEDBACK]
3. Đặt một câu hỏi mở ngắn gọn ở cuối để khuyến khích học viên tiếp tục hội thoại.
4. Trình độ ngôn ngữ: Tùy chỉnh tương ứng HSK 1-4, từ ngữ phổ thông, dễ hiểu.`
  }
};

// Firebase initialization for Chinese Tutor
function initChineseTutorFirebase(db, profileKey) {
  firebaseTutorDb = db || window.firebaseDb || null;
  tutorProfileKey = profileKey || window.userProfileKey || localStorage.getItem("currentProfileKey") || "default";
  if (firebaseTutorDb && tutorProfileKey) {
    try {
      firebaseTutorRef = firebaseTutorDb.ref(`chineseTutor/${tutorProfileKey}`);
      console.log("[Chinese Tutor] Firebase synced for profile:", tutorProfileKey);
      loadTutorAccountSettings();
    } catch (e) {
      console.warn("[Chinese Tutor] Firebase ref init error:", e);
    }
  }
}
window.initChineseTutorFirebase = initChineseTutorFirebase;

// Initialize Tutor Tab — Mở lên là sẵn sàng trò chuyện tự do ngay lập tức
function initChineseTutor() {
  if (!tutorProfileKey) {
    tutorProfileKey = window.userProfileKey || localStorage.getItem("currentProfileKey") || "default";
  }
  if (!firebaseTutorRef && (window.firebaseDb || firebaseTutorDb)) {
    initChineseTutorFirebase(window.firebaseDb || firebaseTutorDb, tutorProfileKey);
  } else {
    loadTutorAccountSettings();
  }
  updateTutorModelBadge();
  setupTutorSpeechRecognition();

  // Cố định chế độ trò chuyện tự do
  currentTutorScenario = "free";

  // Nếu có lịch sử chat cũ, tải lại; nếu không, bắt đầu cuộc hội thoại mới ngay lập tức
  const pKey = tutorProfileKey || window.userProfileKey || "default";
  let hasRecent = false;
  try {
    const raw = localStorage.getItem(`chineseTutor_${pKey}_free`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) hasRecent = true;
    }
  } catch (e) { }

  if (hasRecent) {
    loadTutorScenarioHistory("free");
  } else {
    startFreeTutorChat();
  }
}

// Badge chủ đề không còn dùng (đã loại bỏ hệ thống chọn chủ đề)
function updateTutorActiveTopicBadge() {
  const badge = document.getElementById("tutorActiveTopicBadge");
  if (badge) badge.style.display = "none";
}
window.updateTutorActiveTopicBadge = updateTutorActiveTopicBadge;

// Load Conversation History (Firebase with LocalStorage fallback)
function loadTutorScenarioHistory(scenarioId) {
  const pKey = tutorProfileKey || window.userProfileKey || "default";
  let localData = null;
  try {
    const raw = localStorage.getItem(`chineseTutor_${pKey}_${scenarioId}`);
    if (raw) localData = JSON.parse(raw);
  } catch (e) { }

  if (firebaseTutorRef) {
    firebaseTutorRef.child(`scenarios/${scenarioId}/history`).once("value").then(snap => {
      const fbData = snap.val();
      if (Array.isArray(fbData) && fbData.length > 0) {
        tutorConversationHistory = fbData;
        renderTutorChatHistory();
        return;
      }
      if (Array.isArray(localData) && localData.length > 0) {
        tutorConversationHistory = localData;
        renderTutorChatHistory();
      } else {
        startFreeTutorChat();
      }
    }).catch(err => {
      console.warn("[Chinese Tutor] Firebase load history error:", err);
      if (Array.isArray(localData) && localData.length > 0) {
        tutorConversationHistory = localData;
        renderTutorChatHistory();
      } else {
        startFreeTutorChat();
      }
    });
  } else {
    if (Array.isArray(localData) && localData.length > 0) {
      tutorConversationHistory = localData;
      renderTutorChatHistory();
    } else {
      startFreeTutorChat();
    }
  }
}

// Save Conversation History
function saveTutorScenarioHistory(scenarioId) {
  const pKey = tutorProfileKey || window.userProfileKey || "default";

  // Sanitize toàn bộ mảng lịch sử để loại bỏ triệt để các thuộc tính undefined trước khi ghi vào Firebase
  let sanitized = [];
  try {
    sanitized = JSON.parse(JSON.stringify(tutorConversationHistory || []));
  } catch (e) {
    sanitized = tutorConversationHistory || [];
  }

  try {
    localStorage.setItem(`chineseTutor_${pKey}_${scenarioId}`, JSON.stringify(sanitized));
  } catch (e) { }

  if (!firebaseTutorRef && (window.firebaseDb || firebaseTutorDb)) {
    initChineseTutorFirebase(window.firebaseDb || firebaseTutorDb, pKey);
  }

  if (firebaseTutorRef) {
    try {
      firebaseTutorRef.child(`scenarios/${scenarioId}/history`).set(sanitized)
        .catch(e => console.warn("[Chinese Tutor] Firebase save history error:", e));
    } catch (fbErr) {
      console.warn("[Chinese Tutor] Firebase sync error:", fbErr);
    }
  }
}

// Render Existing History into Chat Window
function renderTutorChatHistory() {
  const chatContainer = document.getElementById("tutorChatMessages");
  if (!chatContainer) return;
  chatContainer.innerHTML = "";

  const historyToRender = [...tutorConversationHistory];
  tutorConversationHistory = [];
  historyToRender.forEach(msg => appendTutorMessage(msg, true));
}

// Clear Current Conversation History
function clearTutorCurrentHistory() {
  if (!confirm("Bạn có chắc chắn muốn làm mới và xóa toàn bộ lịch sử trò chuyện không?")) return;
  const pKey = tutorProfileKey || window.userProfileKey || "default";
  tutorConversationHistory = [];
  try {
    localStorage.removeItem(`chineseTutor_${pKey}_free`);
  } catch (e) { }

  if (firebaseTutorRef) {
    firebaseTutorRef.child("scenarios/free/history").remove()
      .catch(e => console.warn("[Chinese Tutor] Firebase clear history error:", e));
  }
  startFreeTutorChat();
}
window.clearTutorCurrentHistory = clearTutorCurrentHistory;

// Bắt đầu trò chuyện tự do ngay lập tức (không qua Start Screen hay Topic Picker)
function startFreeTutorChat() {
  currentTutorScenario = "free";
  const scenario = CHINESE_TUTOR_SCENARIOS.free;
  const chatContainer = document.getElementById("tutorChatMessages");
  if (!chatContainer) return;
  chatContainer.innerHTML = "";
  tutorConversationHistory = [];

  // Gửi tin nhắn mở đầu của Gia sư AI
  appendTutorMessage({
    role: "assistant",
    zh: scenario.initialMessage.zh || "",
    pinyin: scenario.initialMessage.pinyin || "",
    vi: scenario.initialMessage.vi || "",
    feedback: "",
    extra: ""
  });

  // Focus ô nhập
  setTimeout(() => {
    const input = document.getElementById("tutorChatInput");
    if (input) input.focus();
  }, 200);
}
window.startFreeTutorChat = startFreeTutorChat;

// Backward-compatible wrappers (giữ lại để không gây lỗi nếu HTML còn gọi)
function renderTutorStartScreen() { startFreeTutorChat(); }
window.renderTutorStartScreen = renderTutorStartScreen;
function showTutorTopicPicker() { startFreeTutorChat(); }
window.showTutorTopicPicker = showTutorTopicPicker;
function selectAndStartScenario() { startFreeTutorChat(); }
window.selectAndStartScenario = selectAndStartScenario;
function continueRecentTutorChat() { loadTutorScenarioHistory("free"); }
window.continueRecentTutorChat = continueRecentTutorChat;
function startCurrentTutorScenario() { startFreeTutorChat(); }
window.startCurrentTutorScenario = startCurrentTutorScenario;
function resetTutorConversation() { startFreeTutorChat(); }
function renderTutorScenarioPills() { /* no-op */ }

// Parse AI Raw Response
function parseTutorAiResponse(raw) {
  if (!raw || typeof raw !== "string") {
    return { zh: "", pinyin: "", vi: "", feedback: "", extra: "" };
  }

  const zhMatch = raw.match(/\[ZH\]([\s\S]*?)\[\/ZH\]/i);
  const pinyinMatch = raw.match(/\[PINYIN\]([\s\S]*?)\[\/PINYIN\]/i);
  const viMatch = raw.match(/\[VI\]([\s\S]*?)\[\/VI\]/i);
  const feedbackMatch = raw.match(/\[FEEDBACK\]([\s\S]*?)\[\/FEEDBACK\]/i);

  const zh = zhMatch ? zhMatch[1].trim() : "";
  const pinyin = pinyinMatch ? pinyinMatch[1].trim() : "";
  const vi = viMatch ? viMatch[1].trim() : "";
  const feedback = feedbackMatch ? feedbackMatch[1].trim() : "";

  // Nếu có ít nhất 1 thẻ được trích xuất
  if (zh || pinyin || vi || feedback) {
    const extra = raw
      .replace(/\[ZH\][\s\S]*?\[\/ZH\]/gi, "")
      .replace(/\[PINYIN\][\s\S]*?\[\/PINYIN\]/gi, "")
      .replace(/\[VI\][\s\S]*?\[\/VI\]/gi, "")
      .replace(/\[FEEDBACK\][\s\S]*?\[\/FEEDBACK\]/gi, "")
      .trim();

    return { zh, pinyin, vi, feedback, extra };
  }

  // Fallback parsing nếu AI không dùng thẻ chuẩn
  const lines = raw.split("\n").map(l => l.trim()).filter(Boolean);
  return {
    zh: lines[0] || raw,
    pinyin: lines[1] || "",
    vi: lines[2] || "Bản dịch đang cập nhật",
    feedback: lines.slice(3).join("\n") || "",
    extra: ""
  };
}

// Update active model badge in scenario bar and modal header
function updateTutorModelBadge() {
  const modelObj = GEMINI_TUTOR_MODELS.find(m => m.id === currentTutorModel) || GEMINI_TUTOR_MODELS[0];
  const modelName = modelObj ? modelObj.name : currentTutorModel;

  const badgeBtn = document.getElementById("tutorModelBadgeBtn");
  const badgeText = document.getElementById("tutorModelBadgeText");
  if (badgeBtn && badgeText) {
    badgeText.textContent = modelName;
    badgeBtn.className = "tutor-model-badge-btn provider-gemini";
    badgeBtn.title = `Đang dùng: Google Gemini (${modelName}). Bấm để cài đặt API Key.`;
  }

  const headerTag = document.getElementById("tutorHeaderModelTag");
  if (headerTag) {
    headerTag.textContent = `✨ ${modelName}`;
  }
}
window.updateTutorModelBadge = updateTutorModelBadge;

// Send Message from User
async function sendTutorMessage() {
  const inputEl = document.getElementById("tutorChatInput");
  if (!inputEl) return;
  const userText = inputEl.value.trim();
  if (!userText) return;

  const pKey = getActiveTutorProfileKey();
  const activeKey = tutorGeminiKey || localStorage.getItem(`geminiApiKey_${pKey}`) || localStorage.getItem("geminiApiKey") || "";

  // Nếu tài khoản chưa cài đặt API Key: thông báo rõ ràng và mở modal hướng dẫn cài đặt
  if (!activeKey) {
    if (typeof showToast === "function") {
      showToast("Vui lòng cài đặt Google Gemini API Key để trò chuyện cùng Gia sư AI!", 4500);
    }
    checkTutorApiKeyNotice();
    openTutorSettingsModal();
    return;
  }

  inputEl.value = "";
  inputEl.style.height = "auto";
  inputEl.style.overflowY = "hidden";

  // Append User message to UI
  appendTutorMessage({
    role: "user",
    text: userText
  });

  // Show typing indicator
  showTutorTyping(true);

  const scenario = CHINESE_TUTOR_SCENARIOS[currentTutorScenario] || CHINESE_TUTOR_SCENARIOS.free;
  const modelToUse = currentTutorModel || DEFAULT_GEMINI_MODEL;

  let aiResult;
  try {
    aiResult = await callTutorGemini(activeKey, modelToUse, scenario, tutorConversationHistory, userText);
  } catch (err) {
    console.warn("[Chinese Tutor] Gemini API Call failed:", err);
    showTutorTyping(false);

    // Hiển thị trực tiếp lỗi API lên đoạn chat nếu gọi API thất bại
    appendTutorErrorMessage({
      code: err.code || 500,
      status: err.status || "",
      message: err.message || "Không thể kết nối đến máy chủ Google Gemini.",
      model: modelToUse,
      retryText: userText,
      retryDelaySec: err.retryDelaySec || (err.code === 429 ? 28 : 0)
    });
    return;
  }

  showTutorTyping(false);

  try {
    const resultText = (typeof aiResult === "object" && aiResult !== null) ? (aiResult.text || "") : String(aiResult || "");
    const parsed = parseTutorAiResponse(resultText);
    appendTutorMessage({
      role: "assistant",
      zh: parsed.zh || "",
      pinyin: parsed.pinyin || "",
      vi: parsed.vi || "",
      feedback: parsed.feedback || "",
      extra: parsed.extra || "",
      metadata: {
        modelVersion: aiResult.modelVersion || modelToUse,
        responseId: aiResult.responseId || "",
        finishReason: aiResult.finishReason || "STOP",
        usageMetadata: aiResult.usageMetadata || null,
        rawJson: aiResult.rawResponse || null
      }
    });

    // Cảnh báo nếu phản hồi bị cắt ngang do giới hạn token
    if (aiResult.truncated) {
      if (typeof showToast === "function") {
        showToast("⚠️ Phản hồi AI có thể bị cắt ngang do giới hạn token. Hãy thử hỏi lại ngắn gọn hơn.", 4000);
      }
    }
  } catch (renderErr) {
    console.error("[Chinese Tutor] Lỗi render phản hồi:", renderErr);
  }
}

// Call Google Gemini API (generateContent endpoint)
async function callTutorGemini(apiKey, model, scenario, history, userText) {
  const modelToUse = (model && GEMINI_TUTOR_MODELS.some(m => m.id === model)) ? model : (currentTutorModel || DEFAULT_GEMINI_MODEL);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${apiKey}`;

  const contents = [];
  history.slice(-8).forEach(msg => {
    if (msg.role === "user") {
      contents.push({
        role: "user",
        parts: [{ text: msg.text }]
      });
    } else {
      const assistantText = `[ZH]${msg.zh}[/ZH]\n[PINYIN]${msg.pinyin}[/PINYIN]\n[VI]${msg.vi}[/VI]${msg.feedback ? `\n[FEEDBACK]${msg.feedback}[/FEEDBACK]` : ""}`;
      contents.push({
        role: "model",
        parts: [{ text: assistantText }]
      });
    }
  });

  contents.push({
    role: "user",
    parts: [{ text: userText }]
  });

  const generationConfig = {
    temperature: 0.7,
    maxOutputTokens: 8192
  };
  // Model gemini-3.6-flash có khả năng suy nghĩ chuyên sâu; gemini-3.1-flash-lite tối ưu tốc độ và phản hồi tức thì
  if (modelToUse === "gemini-3.6-flash") {
    generationConfig.thinkingConfig = {
      thinkingBudget: 1024
    };
  }

  const body = {
    systemInstruction: {
      parts: [{ text: scenario.systemPrompt }]
    },
    contents: contents,
    generationConfig: generationConfig
  };

  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    // Không tự động gửi lại ngầm - chỉ gửi lại khi người dùng click icon resend
  } catch (networkErr) {
    const netErr = new Error(`Không thể kết nối mạng tới Google Gemini (${networkErr.message})`);
    netErr.code = 0;
    netErr.status = "NETWORK_ERROR";
    netErr.model = modelToUse;
    throw netErr;
  }

  if (!response.ok) {
    let errCode = response.status;
    let errMsg = `Lỗi Gemini API (${response.status})`;
    let errStatus = "";
    let retryDelaySec = 0;

    try {
      const errJson = await response.json();
      const errObj = errJson?.error || errJson;
      if (errObj) {
        if (errObj.message) errMsg = errObj.message;
        if (errObj.code) errCode = errObj.code;
        if (errObj.status) errStatus = errObj.status;

        // Trích xuất retryDelay từ details của Google API (ví dụ "28s")
        if (Array.isArray(errObj.details)) {
          const retryInfo = errObj.details.find(d => d.retryDelay || (d["@type"] && d["@type"].includes("RetryInfo")));
          if (retryInfo?.retryDelay) {
            retryDelaySec = parseInt(retryInfo.retryDelay, 10);
          }
        }
      }
    } catch (e) { }

    // Quét regex từ chuỗi message (ví dụ: "Please retry in 28.7428s")
    if (!retryDelaySec) {
      const m = errMsg.match(/retry in\s+([\d\.]+)s/i);
      if (m && m[1]) {
        retryDelaySec = Math.ceil(parseFloat(m[1]));
      }
    }
    if (errCode === 429 && !retryDelaySec) {
      retryDelaySec = 28;
    }

    const customErr = new Error(errMsg);
    customErr.code = errCode;
    customErr.status = errStatus;
    customErr.model = modelToUse;
    customErr.retryDelaySec = retryDelaySec;
    throw customErr;
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  const finishReason = candidate?.finishReason || "STOP";

  // Tìm part có thuộc tính 'text' và 'thoughtSignature'
  const parts = candidate?.content?.parts || [];
  let rawText = "";
  let thoughtSignature = "";
  for (const part of parts) {
    if (part.text) {
      rawText += part.text;
    }
    if (part.thoughtSignature) {
      thoughtSignature = part.thoughtSignature;
    }
  }

  if (!rawText) {
    const emptyErr = new Error("Máy chủ Google Gemini không trả về nội dung trả lời (Empty Candidates).");
    emptyErr.code = 204;
    emptyErr.status = "NO_CONTENT";
    emptyErr.model = modelToUse;
    throw emptyErr;
  }

  // Nếu bị cắt ngang do MAX_TOKENS, log cảnh báo
  if (finishReason === "MAX_TOKENS") {
    console.warn("[Chinese Tutor] Phản hồi bị cắt ngang (finishReason: MAX_TOKENS). Nội dung có thể không đầy đủ.");
  }

  return {
    text: rawText,
    usedModel: modelToUse,
    modelVersion: data.modelVersion || modelToUse,
    responseId: data.responseId || "",
    finishReason: finishReason,
    usageMetadata: data.usageMetadata || null,
    thoughtSignature: thoughtSignature,
    rawResponse: data,
    switched: false,
    truncated: finishReason === "MAX_TOKENS"
  };
}

// ==================== TUTOR AI SETTINGS MODAL (GEMINI ONLY) ====================
function openTutorSettingsModal() {
  closeTutorMoreMenu();
  const modal = document.getElementById("tutorSettingsModal");
  if (!modal) return;

  const pKey = getActiveTutorProfileKey();
  const modelSelect = document.getElementById("tutorModelSelect");
  const keyInput = document.getElementById("tutorApiKeyInput");

  if (modelSelect) {
    if (GEMINI_TUTOR_MODELS.some(m => m.id === currentTutorModel)) {
      modelSelect.value = currentTutorModel;
    } else {
      modelSelect.value = DEFAULT_GEMINI_MODEL;
    }
  }

  if (keyInput) {
    keyInput.value = tutorGeminiKey || localStorage.getItem(`geminiApiKey_${pKey}`) || localStorage.getItem("geminiApiKey") || "";
  }

  handleTutorModelChange();
  clearTutorStatus();

  modal.style.zIndex = "100200";
  modal.style.display = "flex";
}
window.openTutorSettingsModal = openTutorSettingsModal;

function closeTutorSettingsModal() {
  const modal = document.getElementById("tutorSettingsModal");
  if (modal) modal.style.display = "none";
}
window.closeTutorSettingsModal = closeTutorSettingsModal;

function handleTutorModalBackdropClick(e) {
  if (e.target && e.target.id === "tutorSettingsModal") {
    closeTutorSettingsModal();
  }
}
window.handleTutorModalBackdropClick = handleTutorModalBackdropClick;

function handleTutorModelChange() {
  const modelSelect = document.getElementById("tutorModelSelect");
  const modelDesc = document.getElementById("tutorModelDesc");
  if (!modelSelect || !modelDesc) return;

  const found = GEMINI_TUTOR_MODELS.find(m => m.id === modelSelect.value);
  modelDesc.textContent = found ? found.desc : "Mô hình trí tuệ nhân tạo từ Google.";
}
window.handleTutorModelChange = handleTutorModelChange;

function toggleTutorKeyVisibility() {
  const input = document.getElementById("tutorApiKeyInput");
  const icon = document.getElementById("tutorEyeIcon");
  if (!input || !icon) return;

  if (input.type === "password") {
    input.type = "text";
    icon.className = "fi fi-rr-eye-crossed";
  } else {
    input.type = "password";
    icon.className = "fi fi-rr-eye";
  }
}
window.toggleTutorKeyVisibility = toggleTutorKeyVisibility;

function clearTutorStatus() {
  const statusEl = document.getElementById("tutorConnectionStatus");
  if (statusEl) {
    statusEl.style.display = "none";
    statusEl.className = "tutor-connection-status";
    statusEl.innerHTML = "";
  }
}

function setTutorStatus(type, message) {
  const statusEl = document.getElementById("tutorConnectionStatus");
  if (!statusEl) return;
  statusEl.style.display = "flex";
  statusEl.className = `tutor-connection-status ${type}`;
  let iconHtml = '<i class="fi fi-rr-info"></i>';
  if (type === "loading") iconHtml = '<i class="fi fi-rr-spinner"></i>';
  if (type === "success") iconHtml = '<i class="fi fi-rr-check"></i>';
  if (type === "error") iconHtml = '<i class="fi fi-rr-cross-circle"></i>';
  statusEl.innerHTML = `${iconHtml} <span>${message}</span>`;
}

async function testTutorConnection() {
  const keyInput = document.getElementById("tutorApiKeyInput");
  const modelSelect = document.getElementById("tutorModelSelect");
  const model = (modelSelect && modelSelect.value) ? modelSelect.value : (currentTutorModel || DEFAULT_GEMINI_MODEL);
  const apiKey = keyInput ? keyInput.value.trim() : "";

  if (!apiKey) {
    setTutorStatus("error", "Vui lòng nhập Google Gemini API Key trước khi kiểm tra!");
    return;
  }

  setTutorStatus("loading", `Đang kiểm tra kết nối với Google Gemini (${model})...`);

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "Hello, reply with 1 word: OK" }] }]
      })
    });

    if (!res.ok) {
      let errDetail = `Mã lỗi ${res.status}`;
      try {
        const errData = await res.json();
        const errObj = errData?.error || errData;
        if (errObj?.message) {
          errDetail = `${errObj.message} (Mã ${res.status}${errObj.status ? ` • ${errObj.status}` : ""})`;
        }
      } catch (e) { }
      throw new Error(errDetail);
    }
    setTutorStatus("success", `Kết nối Google Gemini (${model}) thành công! Sẵn sàng học tiếng Trung.`);
  } catch (err) {
    setTutorStatus("error", `Không thể kết nối: ${err.message}`);
  }
}
window.testTutorConnection = testTutorConnection;

function saveTutorSettings() {
  const modelSelect = document.getElementById("tutorModelSelect");
  const keyInput = document.getElementById("tutorApiKeyInput");
  const model = modelSelect ? modelSelect.value : DEFAULT_GEMINI_MODEL;
  const apiKey = keyInput ? keyInput.value.trim() : "";

  currentTutorModel = model;
  tutorGeminiKey = apiKey;

  const pKey = getActiveTutorProfileKey();

  // Lưu theo từng tài khoản vào LocalStorage
  localStorage.setItem(`tutorAiModel_${pKey}`, model);
  localStorage.setItem("tutorAiModel", model);
  localStorage.setItem(`geminiApiKey_${pKey}`, apiKey);
  localStorage.setItem("geminiApiKey", apiKey);

  if (apiKey) {
    localStorage.setItem("aiApiKey", apiKey);
  }

  // Đồng bộ lên Firebase theo tài khoản đang đăng nhập
  if (firebaseTutorRef) {
    firebaseTutorRef.child("settings").update({
      geminiApiKey: apiKey,
      model: model,
      updatedAt: Date.now()
    }).then(() => {
      console.log(`[Chinese Tutor] Đã lưu cấu hình Gemini vào Firebase cho tài khoản: ${pKey}`);
    }).catch(e => {
      console.warn("[Chinese Tutor] Firebase sync settings error:", e);
    });
  }

  updateTutorModelBadge();
  checkTutorApiKeyNotice();
  closeTutorSettingsModal();

  if (typeof showToast === "function") {
    showToast(`Đã lưu cấu hình Google Gemini (${model}) cho tài khoản này!`);
  }
}
window.saveTutorSettings = saveTutorSettings;

// Khởi tạo Firebase cho Chinese Tutor theo tài khoản đăng nhập
function initChineseTutorFirebase(firebaseDb, userProfileKey) {
  if (!firebaseDb) return;
  firebaseTutorDb = firebaseDb;
  tutorProfileKey = userProfileKey || window.userProfileKey || "default";
  firebaseTutorRef = firebaseTutorDb.ref(`chineseTutor/${tutorProfileKey}`);
  console.log(`[Chinese Tutor] Khởi tạo Firebase cho tài khoản: ${tutorProfileKey}`);

  // Tải cài đặt theo tài khoản
  loadTutorAccountSettings();

  // Lắng nghe cập nhật settings từ Firebase theo tài khoản
  firebaseTutorRef.child("settings").on("value", snapshot => {
    const data = snapshot.val();
    if (data) {
      let changed = false;
      if (data.geminiApiKey !== undefined && data.geminiApiKey !== tutorGeminiKey) {
        tutorGeminiKey = data.geminiApiKey || "";
        localStorage.setItem(`geminiApiKey_${tutorProfileKey}`, tutorGeminiKey);
        localStorage.setItem("geminiApiKey", tutorGeminiKey);
        changed = true;
      }
      if (data.model && data.model !== "gemini-2.5-flash" && GEMINI_TUTOR_MODELS.some(m => m.id === data.model) && data.model !== currentTutorModel) {
        currentTutorModel = data.model;
        localStorage.setItem(`tutorAiModel_${tutorProfileKey}`, currentTutorModel);
        localStorage.setItem("tutorAiModel", currentTutorModel);
        changed = true;
      }
      if (changed) {
        updateTutorModelBadge();
        checkTutorApiKeyNotice();
      }
    }
  });
}
window.initChineseTutorFirebase = initChineseTutorFirebase;

// Backward-compatible prompt wrapper
function promptTutorApiKey() {
  openTutorSettingsModal();
}
window.promptTutorApiKey = promptTutorApiKey;

// Append Message to UI
function appendTutorMessage(msg, skipSave) {
  const container = document.getElementById("tutorChatMessages");
  if (!container) return;

  const msgDiv = document.createElement("div");
  msgDiv.className = `tutor-msg-item tutor-msg-${msg.role}`;

  if (msg.role === "user") {
    const encodedUserText = encodeURIComponent(msg.text || "");
    msgDiv.setAttribute("data-msg-text", msg.text || "");
    msgDiv.innerHTML = `
      <div class="tutor-msg-user-content">
        <button type="button" class="tutor-msg-resend-btn" onclick="retryTutorMessage(decodeURIComponent('${encodedUserText}'), this)" title="Gửi lại tin nhắn này">
          <i class="fi fi-rr-refresh"></i>
        </button>
        <div class="tutor-msg-bubble user-bubble">
          <div class="tutor-user-text">${escapeHtml(msg.text)}</div>
        </div>
      </div>
    `;
    tutorConversationHistory.push({ role: "user", text: msg.text });
  } else {
    const escapedZh = escapeHtml(msg.zh || "");
    const escapedPinyin = escapeHtml(msg.pinyin || "");
    const escapedVi = escapeHtml(msg.vi || "");
    const escapedFeedback = msg.feedback ? escapeHtml(msg.feedback) : "";
    const escapedExtra = msg.extra ? escapeHtml(msg.extra) : "";
    const msgId = "tutor_resp_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6);

    const metaHtml = renderTutorResponseMetadata(msg.metadata, msgId);

    msgDiv.innerHTML = `
      <div class="tutor-avatar-icon">🐼</div>
      <div class="tutor-msg-bubble assistant-bubble">
        <div class="tutor-bubble-top">
          <div class="tutor-zh-text">${escapedZh}</div>
          <div class="tutor-msg-actions">
            <button type="button" class="tutor-action-icon-btn tutor-speak-btn" onclick="speakTutorChinese('${escapedZh.replace(/'/g, "\\'")}')" title="Phát âm tiếng Trung">
              <i class="fi fi-rr-volume"></i>
            </button>
            <button type="button" class="tutor-action-icon-btn tutor-copy-btn" onclick="copyTutorText('${escapedZh.replace(/'/g, "\\'")}', this)" title="Sao chép chữ Hán">
              <i class="fi fi-rr-copy"></i>
            </button>
          </div>
        </div>
        ${escapedPinyin ? `<div class="tutor-pinyin-text">${escapedPinyin}</div>` : ""}
        ${escapedVi ? `<div class="tutor-vi-text">${escapedVi}</div>` : ""}
        ${escapedFeedback ? `
          <div class="tutor-feedback-box">
            <div class="tutor-feedback-header">
              <i class="fi fi-rr-bulb"></i>
              <span>Nhận xét & Hướng dẫn</span>
            </div>
            <div class="tutor-feedback-content">${escapedFeedback}</div>
          </div>
        ` : ""}
      </div>
    `;
    tutorConversationHistory.push({
      role: "assistant",
      zh: msg.zh || "",
      pinyin: msg.pinyin || "",
      vi: msg.vi || "",
      feedback: msg.feedback || "",
      extra: msg.extra || "",
      metadata: msg.metadata || null
    });
  }

  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;

  if (!skipSave) {
    saveTutorScenarioHistory(currentTutorScenario);
  }
}

// Render chi tiết phản hồi AI (Mô hình, Token Usage Breakdown, Response ID, Finish Reason, Raw JSON)
function renderTutorResponseMetadata(meta, msgId) {
  if (!meta) return "";

  const model = meta.modelVersion || meta.usedModel || "gemini-3.6-flash";
  const responseId = meta.responseId || "";
  const finishReason = meta.finishReason || "STOP";
  const usage = meta.usageMetadata || {};

  const promptTokens = Number(usage.promptTokenCount || 0);
  const thoughtsTokens = Number(usage.thoughtsTokenCount || 0);
  const candidatesTokens = Number(usage.candidatesTokenCount || 0);
  const totalTokens = Number(usage.totalTokenCount || (promptTokens + thoughtsTokens + candidatesTokens));
  const serviceTier = usage.serviceTier || "standard";

  const rawJsonStr = meta.rawJson ? escapeHtml(JSON.stringify(meta.rawJson, null, 2)) : "";
  const containerId = msgId || "meta_" + Math.random().toString(36).substr(2, 8);

  const promptPct = totalTokens > 0 ? Math.max(3, (promptTokens / totalTokens * 100)).toFixed(1) : 0;
  const thoughtsPct = totalTokens > 0 ? Math.max(3, (thoughtsTokens / totalTokens * 100)).toFixed(1) : 0;
  const candidatesPct = totalTokens > 0 ? Math.max(3, (candidatesTokens / totalTokens * 100)).toFixed(1) : 0;

  return `
    <div class="tutor-response-meta-container" id="${containerId}">
      <!-- Thanh tóm tắt thông số nhanh -->
      <div class="tutor-meta-summary-bar">
        <div class="tutor-meta-badges-left">
          <span class="tutor-meta-badge badge-model" title="Phiên bản mô hình AI: ${escapeHtml(model)}">
            <i class="fi fi-rr-cpu"></i>
            <span>${escapeHtml(model)}</span>
          </span>
          ${totalTokens > 0 ? `
          <span class="tutor-meta-badge badge-tokens" title="Tổng tokens: ${totalTokens.toLocaleString()} (Prompt: ${promptTokens}, Thoughts: ${thoughtsTokens}, Output: ${candidatesTokens})">
            <i class="fi fi-rr-database"></i>
            <span>${totalTokens.toLocaleString()} tokens</span>
          </span>
          ` : ""}
          <span class="tutor-meta-badge badge-finish" title="Trạng thái hoàn tất: ${escapeHtml(finishReason)}">
            <i class="fi fi-rr-check-circle"></i>
            <span>${escapeHtml(finishReason)}</span>
          </span>
        </div>

        <button type="button" class="tutor-meta-toggle-btn" onclick="toggleTutorResponseDetails('${containerId}')" title="Bấm để xem chi tiết Token và JSON phản hồi từ Gemini API">
          <i class="fi fi-rr-info"></i>
          <span>Chi tiết</span>
          <i class="fi fi-rr-angle-small-down meta-chevron"></i>
        </button>
      </div>

      <!-- Khung chi tiết mở rộng -->
      <div class="tutor-meta-details-drawer" style="display: none;">
        <!-- Lưới thống kê 4 nhóm Token -->
        <div class="tutor-token-grid">
          <div class="tutor-token-stat-item">
            <div class="tutor-token-stat-label">
              <i class="fi fi-rr-sign-in-alt"></i>
              <span>Prompt Tokens</span>
            </div>
            <div class="tutor-token-stat-val val-prompt">${promptTokens.toLocaleString()}</div>
            <div class="tutor-token-stat-sub">Câu hỏi & Ngữ cảnh</div>
          </div>

          <div class="tutor-token-stat-item">
            <div class="tutor-token-stat-label">
              <i class="fi fi-rr-brain"></i>
              <span>Thoughts Tokens</span>
            </div>
            <div class="tutor-token-stat-val val-thoughts">${thoughtsTokens.toLocaleString()}</div>
            <div class="tutor-token-stat-sub">Suy nghĩ (Gemini 3.6 Flash)</div>
          </div>

          <div class="tutor-token-stat-item">
            <div class="tutor-token-stat-label">
              <i class="fi fi-rr-sign-out-alt"></i>
              <span>Candidates Tokens</span>
            </div>
            <div class="tutor-token-stat-val val-candidates">${candidatesTokens.toLocaleString()}</div>
            <div class="tutor-token-stat-sub">Câu trả lời tạo ra</div>
          </div>

          <div class="tutor-token-stat-item">
            <div class="tutor-token-stat-label">
              <i class="fi fi-rr-calculator"></i>
              <span>Total Tokens</span>
            </div>
            <div class="tutor-token-stat-val val-total">${totalTokens.toLocaleString()}</div>
            <div class="tutor-token-stat-sub">Tổng tokens phiên này</div>
          </div>
        </div>

        <!-- Thanh tỷ lệ phân bổ Token trực quan -->
        ${totalTokens > 0 ? `
        <div class="tutor-token-distribution" title="Phân bổ: Prompt ${promptTokens} | Thoughts ${thoughtsTokens} | Output ${candidatesTokens}">
          <div class="tutor-dist-seg seg-prompt" style="width: ${promptPct}%" title="Prompt: ${promptTokens}"></div>
          <div class="tutor-dist-seg seg-thoughts" style="width: ${thoughtsPct}%" title="Thoughts: ${thoughtsTokens}"></div>
          <div class="tutor-dist-seg seg-output" style="width: ${candidatesPct}%" title="Output: ${candidatesTokens}"></div>
        </div>
        ` : ""}

        <!-- Thông số hệ thống bổ sung -->
        <div class="tutor-tech-meta-row">
          ${responseId ? `
          <div class="tutor-tech-item">
            <span class="tutor-tech-key">Response ID:</span>
            <code class="tutor-tech-val">${escapeHtml(responseId)}</code>
          </div>
          ` : ""}
          <div class="tutor-tech-item">
            <span class="tutor-tech-key">Service Tier:</span>
            <span class="tutor-tech-pill">${escapeHtml(serviceTier)}</span>
          </div>
          <div class="tutor-tech-item">
            <span class="tutor-tech-key">Finish Reason:</span>
            <span class="tutor-tech-pill finish-pill">${escapeHtml(finishReason)}</span>
          </div>
        </div>

        <!-- Khối xem Raw JSON API đúng như trên DevTools -->
        ${rawJsonStr ? `
        <div class="tutor-raw-json-wrap">
          <div class="tutor-raw-json-header">
            <span class="tutor-raw-json-title">
              <i class="fi fi-rr-brackets-curly"></i>
              <span>JSON Response Payload (DevTools Object)</span>
            </span>
            <button type="button" class="tutor-raw-copy-btn" onclick="copyTutorRawJson(this)" title="Sao chép toàn bộ JSON">
              <i class="fi fi-rr-copy"></i>
              <span>Sao chép JSON</span>
            </button>
          </div>
          <pre class="tutor-raw-json-code"><code>${rawJsonStr}</code></pre>
        </div>
        ` : ""}
      </div>
    </div>
  `;
}

// Toggle mở rộng / thu gọn chi tiết phản hồi
function toggleTutorResponseDetails(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const drawer = container.querySelector(".tutor-meta-details-drawer");
  const btn = container.querySelector(".tutor-meta-toggle-btn");
  if (!drawer) return;

  const isHidden = drawer.style.display === "none" || !drawer.style.display;
  if (isHidden) {
    drawer.style.display = "block";
    if (btn) btn.classList.add("active");
  } else {
    drawer.style.display = "none";
    if (btn) btn.classList.remove("active");
  }
}
window.toggleTutorResponseDetails = toggleTutorResponseDetails;

// Sao chép văn bản
function copyTutorText(text, btn) {
  if (!text) return;
  const doFeedback = () => {
    if (btn) {
      const origHtml = btn.innerHTML;
      btn.innerHTML = '<i class="fi fi-rr-check"></i>';
      btn.classList.add("copied");
      setTimeout(() => {
        btn.innerHTML = origHtml;
        btn.classList.remove("copied");
      }, 1800);
    }
    if (typeof showToast === "function") {
      showToast("Đã sao chép vào bộ nhớ tạm!", 2000);
    }
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(doFeedback).catch(() => {
      fallbackCopyText(text);
      doFeedback();
    });
  } else {
    fallbackCopyText(text);
    doFeedback();
  }
}
window.copyTutorText = copyTutorText;

function fallbackCopyText(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); } catch (e) { }
  document.body.removeChild(ta);
}

// Sao chép toàn bộ Raw JSON phản hồi
function copyTutorRawJson(btn) {
  if (!btn) return;
  const wrap = btn.closest(".tutor-raw-json-wrap");
  const codeEl = wrap ? wrap.querySelector("code") : null;
  if (codeEl) {
    copyTutorText(codeEl.textContent, btn);
  }
}
window.copyTutorRawJson = copyTutorRawJson;

// Giữ lại hàm rỗng tương thích ngược nếu có sự kiện gọi cancelTutorCountdown
function cancelTutorCountdown() { /* Cơ chế tự động gửi lại đã được loại bỏ */ }
window.cancelTutorCountdown = cancelTutorCountdown;

// Append Error Message directly to Chat UI (Chỉ gửi lại khi người dùng chủ động bấm icon resend)
function appendTutorErrorMessage({ code, status, message, model, retryText, retryDelaySec = 0 }) {
  const container = document.getElementById("tutorChatMessages");
  if (!container) return;

  const msgDiv = document.createElement("div");
  msgDiv.className = "tutor-msg-item tutor-msg-error";

  let statusBadge = code ? `Mã ${code}` : "Lỗi kết nối";
  if (status) statusBadge += ` • ${status}`;

  const lowerMsg = (message || "").toLowerCase();
  const lowerStatus = (status || "").toLowerCase();
  const isQuotaError = code === 429 || lowerStatus === "resource_exhausted" || lowerMsg.includes("quota");
  const isHighDemandOrNotFound = code === 503 || lowerStatus === "unavailable" || lowerMsg.includes("high demand") || code === 404;

  let suggestion = "Vui lòng kiểm tra lại kết nối mạng hoặc thử lại sau vài giây.";
  if (isQuotaError) {
    const waitHint = retryDelaySec > 0 ? ` (khuyến nghị chờ khoảng ${retryDelaySec}s để hạn mức hồi phục)` : "";
    suggestion = `Mô hình <strong>${escapeHtml(model || "Gemini 3.6 Flash")}</strong> đã đạt giới hạn 20 lượt/phút của gói miễn phí Google API. Vui lòng bấm vào icon <strong>Gửi lại</strong> (<i class="fi fi-rr-refresh"></i>) khi bạn sẵn sàng${waitHint}.`;
  } else if (isHighDemandOrNotFound) {
    suggestion = "Máy chủ Google hiện đang bận hoặc quá tải tạm thời. Bạn có thể nhấn icon <strong>Gửi lại</strong> (<i class='fi fi-rr-refresh'></i>) sau ít giây.";
  } else if (code === 400 || code === 403 || lowerMsg.includes("api key")) {
    suggestion = "Google Gemini API Key không hợp lệ hoặc đã hết hạn. Vui lòng kiểm tra lại trong phần Cài đặt AI.";
  }

  const encodedRetry = encodeURIComponent(retryText || "");

  msgDiv.innerHTML = `
    <div class="tutor-avatar-icon tutor-avatar-error">⚠️</div>
    <div class="tutor-msg-bubble error-bubble">
      <div class="tutor-error-header">
        <span class="tutor-error-badge">
          <i class="fi fi-rr-cross-circle"></i>
          <span>Lỗi kết nối Gemini API</span>
        </span>
        <span class="tutor-error-code">${escapeHtml(statusBadge)}</span>
      </div>
      
      ${model ? `
      <div class="tutor-error-model-tag">
        <span class="tutor-error-model-label">Mô hình đang gọi:</span>
        <code class="tutor-error-model-code">${escapeHtml(model)}</code>
      </div>
      ` : ""}

      <div class="tutor-error-message">
        <i class="fi fi-rr-info"></i>
        <div class="tutor-error-text">${escapeHtml(message || "Đã xảy ra lỗi khi giao tiếp với Google Gemini.")}</div>
      </div>

      <div class="tutor-error-suggestion">
        <div class="tutor-error-suggestion-icon">💡</div>
        <div class="tutor-error-suggestion-text">${suggestion}</div>
      </div>

      <div class="tutor-error-actions">
        ${retryText ? `
          <button type="button" class="tutor-error-btn retry-btn" onclick="retryTutorMessage(decodeURIComponent('${encodedRetry}'), this)" title="Gửi lại tin nhắn này">
            <i class="fi fi-rr-refresh"></i>
            <span>Gửi lại</span>
          </button>
        ` : ""}
        <button type="button" class="tutor-error-btn settings-btn" onclick="openTutorSettingsModal()">
          <i class="fi fi-rr-settings-sliders"></i>
          <span>Cài đặt AI</span>
        </button>
      </div>
    </div>
  `;

  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;
}
window.appendTutorErrorMessage = appendTutorErrorMessage;

// Thử gửi lại tin nhắn (chỉ kích hoạt khi người dùng click icon resend)
async function retryTutorMessage(text, triggerEl) {
  if (!text) return;

  // Xóa thẻ thông báo lỗi tương ứng hoặc thẻ lỗi gần nhất
  if (triggerEl) {
    const errorBubble = triggerEl.closest(".tutor-msg-error");
    if (errorBubble) {
      errorBubble.remove();
    } else {
      const userItem = triggerEl.closest(".tutor-msg-user");
      if (userItem && userItem.nextElementSibling && userItem.nextElementSibling.classList.contains("tutor-msg-error")) {
        userItem.nextElementSibling.remove();
      }
    }
  } else {
    const allErrors = document.querySelectorAll("#tutorChatMessages .tutor-msg-error");
    if (allErrors.length > 0) {
      allErrors[allErrors.length - 1].remove();
    }
  }

  const pKey = getActiveTutorProfileKey();
  const activeKey = tutorGeminiKey || localStorage.getItem(`geminiApiKey_${pKey}`) || localStorage.getItem("geminiApiKey") || "";

  if (!activeKey) {
    if (typeof showToast === "function") {
      showToast("Vui lòng cài đặt Google Gemini API Key để trò chuyện cùng Gia sư AI!", 4500);
    }
    checkTutorApiKeyNotice();
    openTutorSettingsModal();
    return;
  }

  // Đảm bảo không tạo tin nhắn người dùng trùng lặp trong lịch sử
  const lastHistory = tutorConversationHistory[tutorConversationHistory.length - 1];
  if (!lastHistory || lastHistory.role !== "user" || lastHistory.text !== text) {
    appendTutorMessage({ role: "user", text: text });
  }

  // Hiển thị trạng thái đang soạn
  showTutorTyping(true);

  const scenario = CHINESE_TUTOR_SCENARIOS[currentTutorScenario] || CHINESE_TUTOR_SCENARIOS.free;
  const modelToUse = currentTutorModel || DEFAULT_GEMINI_MODEL;

  let aiResult;
  try {
    aiResult = await callTutorGemini(activeKey, modelToUse, scenario, tutorConversationHistory, text);
  } catch (err) {
    console.warn("[Chinese Tutor] Gemini API retry failed:", err);
    showTutorTyping(false);

    appendTutorErrorMessage({
      code: err.code || 500,
      status: err.status || "",
      message: err.message || "Không thể kết nối đến máy chủ Google Gemini.",
      model: modelToUse,
      retryText: text,
      retryDelaySec: err.retryDelaySec || (err.code === 429 ? 28 : 0)
    });
    return;
  }

  showTutorTyping(false);

  try {
    const resultText = (typeof aiResult === "object" && aiResult !== null) ? (aiResult.text || "") : String(aiResult || "");
    const parsed = parseTutorAiResponse(resultText);
    appendTutorMessage({
      role: "assistant",
      zh: parsed.zh || "",
      pinyin: parsed.pinyin || "",
      vi: parsed.vi || "",
      feedback: parsed.feedback || "",
      extra: parsed.extra || "",
      metadata: {
        modelVersion: aiResult.modelVersion || modelToUse,
        responseId: aiResult.responseId || "",
        finishReason: aiResult.finishReason || "STOP",
        usageMetadata: aiResult.usageMetadata || null,
        rawJson: aiResult.rawResponse || null
      }
    });

    if (aiResult.truncated) {
      if (typeof showToast === "function") {
        showToast("⚠️ Phản hồi AI có thể bị cắt ngang do giới hạn token. Hãy thử hỏi lại ngắn gọn hơn.", 4000);
      }
    }
  } catch (renderErr) {
    console.error("[Chinese Tutor] Lỗi render phản hồi khi retry:", renderErr);
  }
}
window.retryTutorMessage = retryTutorMessage;

// Show/Hide Typing Indicator
function showTutorTyping(show) {
  let typingEl = document.getElementById("tutorTypingIndicator");
  const container = document.getElementById("tutorChatMessages");
  if (!container) return;

  if (show) {
    if (!typingEl) {
      typingEl = document.createElement("div");
      typingEl.id = "tutorTypingIndicator";
      typingEl.className = "tutor-msg-item tutor-msg-assistant typing-state";
      typingEl.innerHTML = `
        <div class="tutor-avatar-icon">🐼</div>
        <div class="tutor-typing-dots">
          <span></span><span></span><span></span>
        </div>
      `;
      container.appendChild(typingEl);
    }
    container.scrollTop = container.scrollHeight;
  } else {
    if (typingEl) typingEl.remove();
  }
}

// Speak Chinese TTS for Tutor
function speakTutorChinese(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-CN";
  utterance.rate = 0.85; // Slightly slower for clear learning comprehension

  // Choose Chinese voice if available
  const voices = window.speechSynthesis.getVoices();
  const zhVoice = voices.find(v => v.lang.startsWith("zh") || v.lang.includes("Chinese"));
  if (zhVoice) utterance.voice = zhVoice;

  window.speechSynthesis.speak(utterance);
}

// Speech Recognition for User Speaking Practice
function setupTutorSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    const micBtn = document.getElementById("tutorMicBtn");
    if (micBtn) micBtn.title = "Trình duyệt không hỗ trợ nhận diện giọng nói";
    return;
  }

  tutorRecognition = new SpeechRecognition();
  tutorRecognition.lang = "zh-CN"; // Default recognize Mandarin
  tutorRecognition.continuous = false;
  tutorRecognition.interimResults = false;

  tutorRecognition.onstart = () => {
    isTutorListening = true;
    const micBtn = document.getElementById("tutorMicBtn");
    if (micBtn) micBtn.classList.add("recording");
  };

  tutorRecognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    const inputEl = document.getElementById("tutorChatInput");
    if (inputEl) {
      inputEl.value = (inputEl.value ? inputEl.value + " " : "") + transcript;
      autoResizeTutorInput();
    }
  };

  tutorRecognition.onerror = (event) => {
    console.warn("[Tutor Speech Recognition Error]", event.error);
    stopTutorListening();
  };

  tutorRecognition.onend = () => {
    stopTutorListening();
  };
}

function toggleTutorVoiceInput() {
  if (!tutorRecognition) {
    setupTutorSpeechRecognition();
    if (!tutorRecognition) {
      alert("Trình duyệt của bạn không hỗ trợ Web Speech API nhận diện giọng nói.");
      return;
    }
  }

  if (isTutorListening) {
    tutorRecognition.stop();
    stopTutorListening();
  } else {
    try {
      tutorRecognition.start();
    } catch (e) {
      console.warn("Could not start recognition:", e);
    }
  }
}

function stopTutorListening() {
  isTutorListening = false;
  const micBtn = document.getElementById("tutorMicBtn");
  if (micBtn) micBtn.classList.remove("recording");
}

// Tự động co giãn chiều cao của input chat (tối đa 100px mới xuất hiện scrollbar)
function autoResizeTutorInput() {
  const textarea = document.getElementById("tutorChatInput");
  if (!textarea) return;
  textarea.style.height = "auto";
  const maxHeight = 100;
  const scrollHeight = textarea.scrollHeight;
  if (scrollHeight > maxHeight) {
    textarea.style.height = `${maxHeight}px`;
    textarea.style.overflowY = "auto";
  } else {
    textarea.style.height = `${scrollHeight}px`;
    textarea.style.overflowY = "hidden";
  }
}
window.autoResizeTutorInput = autoResizeTutorInput;

// Handle Auto-expand textarea & Enter to send
function handleTutorInputKeydown(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendTutorMessage();
  }
}

// 3-Dots Action Dropdown Menu
function toggleTutorMoreMenu(event) {
  if (event) event.stopPropagation();
  const menu = document.getElementById("tutorMoreMenu");
  const btn = document.getElementById("tutorMoreBtn");
  if (!menu) return;
  const isOpen = menu.classList.contains("active");
  if (isOpen) {
    menu.classList.remove("active");
    if (btn) btn.classList.remove("active");
  } else {
    menu.classList.add("active");
    if (btn) btn.classList.add("active");
  }
}

function closeTutorMoreMenu() {
  const menu = document.getElementById("tutorMoreMenu");
  const btn = document.getElementById("tutorMoreBtn");
  if (menu) menu.classList.remove("active");
  if (btn) btn.classList.remove("active");
}

function handleTutorMenuApiKey() {
  closeTutorMoreMenu();
  openTutorSettingsModal();
}

function handleTutorMenuClear() {
  closeTutorMoreMenu();
  clearTutorCurrentHistory();
}

// Close tutor action menu when clicking outside
document.addEventListener("click", (e) => {
  const wrapper = document.getElementById("tutorMoreDropdownWrapper");
  if (wrapper && !wrapper.contains(e.target)) {
    closeTutorMoreMenu();
  }
});

// Close tutor settings modal on Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeTutorSettingsModal();
  }
});

document.addEventListener("DOMContentLoaded", () => {
  loadTutorAccountSettings();
  updateTutorModelBadge();
  initTutorFloatingAutoCheck();
  if (window.firebaseDb && typeof initChineseTutorFirebase === "function") {
    initChineseTutorFirebase(window.firebaseDb, window.userProfileKey);
  }
});

// Gọi ngay nếu script load sau DOMContentLoaded
if (document.readyState === "interactive" || document.readyState === "complete") {
  initTutorFloatingAutoCheck();
}

window.toggleTutorMoreMenu = toggleTutorMoreMenu;
window.closeTutorMoreMenu = closeTutorMoreMenu;
window.handleTutorMenuApiKey = handleTutorMenuApiKey;
window.handleTutorMenuClear = handleTutorMenuClear;


