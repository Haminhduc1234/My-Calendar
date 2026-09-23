/* ==================== CHINESE TUTOR - AI GIA SƯ TIẾNG TRUNG RIÊNG BIỆT (GOOGLE GEMINI) ==================== */

// Predefined Google Gemini Models
const GEMINI_TUTOR_MODELS = [
  { id: "gemini-3.6-flash", name: "Gemini 3.6 Flash", desc: "Mô hình mới nhất của Google, siêu thông minh & siêu tốc, phân tích Hán tự & ngữ pháp HSK xuất sắc (Khuyên dùng)" },
  { id: "gemini-3.6-pro", name: "Gemini 3.6 Pro", desc: "Mô hình suy luận chuyên sâu thế hệ mới, giải nghĩa ngữ cảnh & thành ngữ nâng cao" },
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", desc: "Thế hệ 2.0, phản hồi tức thì, chính xác và mượt mà" },
  { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", desc: "Bản ổn định phổ biến từ Google AI Studio" }
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

// Load Account-Specific Settings (from LocalStorage first, then Firebase)
function loadTutorAccountSettings() {
  const pKey = getActiveTutorProfileKey();
  const savedKey = localStorage.getItem(`geminiApiKey_${pKey}`) || localStorage.getItem("geminiApiKey") || "";
  const savedModel = localStorage.getItem(`tutorAiModel_${pKey}`) || localStorage.getItem("tutorAiModel") || DEFAULT_GEMINI_MODEL;

  if (savedKey) {
    tutorGeminiKey = savedKey;
  }
  if (savedModel && savedModel !== "gemini-2.5-flash" && GEMINI_TUTOR_MODELS.some(m => m.id === savedModel)) {
    currentTutorModel = savedModel;
  } else {
    currentTutorModel = DEFAULT_GEMINI_MODEL;
  }
  updateTutorModelBadge();

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
        if (data.model && data.model !== "gemini-2.5-flash" && GEMINI_TUTOR_MODELS.some(m => m.id === data.model)) {
          currentTutorModel = data.model;
          localStorage.setItem(`tutorAiModel_${pKey}`, data.model);
          localStorage.setItem("tutorAiModel", data.model);
        }
        updateTutorModelBadge();
        console.log(`[Chinese Tutor] Loaded Gemini settings from Firebase for account ${pKey}`);
      }
    }).catch(err => {
      console.warn("[Chinese Tutor] Could not load settings from Firebase:", err);
    });
  }
}

// Predefined Scenarios for Chinese Conversation Practice
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
  },
  dining: {
    id: "dining",
    name: "Gọi món nhà hàng",
    icon: "🍜",
    level: "HSK 1-2",
    description: "Nhập vai phục vụ nhà hàng Trung Quốc: gọi món, hỏi độ cay, thanh toán hóa đơn.",
    initialMessage: {
      zh: "您好，欢迎光临！请问几位？这边有空位，请坐。这是菜单，您想吃点什么？",
      pinyin: "Nín hǎo, huānyíng guānglín! Qǐngwèn jǐ wèi? Zhè biān yǒu kòng wèi, qǐng zuò. Zhè shì càidān, nín xiǎng chī diǎn shénme?",
      vi: "Kính chào quý khách! Xin hỏi quý khách đi mấy người ạ? Bên này có bàn trống, mời ngồi. Đây là thực đơn, quý khách muốn dùng món gì?"
    },
    systemPrompt: `Bạn là nhân viên phục vụ tại một nhà hàng Trung Hoa truyền thống. Học viên là thực khách.
Nhiệm vụ của bạn:
1. Luôn phản hồi theo cấu trúc:
   [ZH] Câu thoại tiếng Trung [/ZH]
   [PINYIN] Pinyin [/PINYIN]
   [VI] Tiếng Việt [/VI]
   [FEEDBACK] Sửa lỗi (nếu có) [/FEEDBACK]
2. Giữ đúng vai nhân viên phục vụ chu đáo: hỏi món ăn, sở thích (cay/không cay, đá/nóng), giới thiệu món đặc sản (sủi cảo, vịt quay Bắc Kinh, đậu phụ Tứ Xuyên), báo giá và tính tiền.`
  },
  shopping: {
    id: "shopping",
    name: "Mua sắm & Trả giá",
    icon: "🛍️",
    level: "HSK 2-3",
    description: "Nhập vai chủ tiệm quần áo / đồ lưu niệm: hỏi giá, thử size, mặc cả giảm giá.",
    initialMessage: {
      zh: "你好帅哥/美女！来看看吧，新到的衣服和特产，质量都非常好。你喜欢哪一件？",
      pinyin: "Nǐ hǎo shuàigē / měinǚ! Lái kàn kan ba, xīn dào de yīfu hé tèchǎn, zhìliàng dōu fēicháng hǎo. Nǐ xǐhuan nǎ yí jiàn?",
      vi: "Chào bạn đẹp trai/xinh gái! Ghé xem đi, quần áo và đặc sản mới về, chất lượng đều rất tốt. Bạn thích chiếc nào?"
    },
    systemPrompt: `Bạn là chủ một cửa hàng thời trang/đồ lưu niệm tại chợ đêm Trung Quốc. Học viên là khách mua hàng.
Nhiệm vụ của bạn:
1. Cấu trúc 3 phần: [ZH], [PINYIN], [VI], [FEEDBACK] (nếu học viên viết sai).
2. Tương tác mua sắm: báo giá, khen ngợi khách hàng, khi khách mặc cả (太贵了, 便宜一点儿吧) thì linh hoạt bớt giá một chút hoặc giải thích chất liệu tốt.`
  },
  hotel: {
    id: "hotel",
    name: "Khách sạn & Thủ tục",
    icon: "🏨",
    level: "HSK 2-3",
    description: "Nhập vai lễ tân khách sạn: nhận phòng, đổi phòng, hỏi mật khẩu wifi, trả phòng.",
    initialMessage: {
      zh: "您好！欢迎入住北京饭店。请问您有预订吗？请出示一下您的护照。",
      pinyin: "Nín hǎo! Huānyíng rùzhù Běijīng Fàndiàn. Qǐngwèn nín yǒu yùdìng ma? Qǐng chūshì yíxià nín de hùzhào.",
      vi: "Kính chào quý khách! Chào mừng quý khách đến với khách sạn Bắc Kinh. Xin hỏi quý khách có đặt phòng trước không ạ? Xin vui lòng xuất trình hộ chiếu."
    },
    systemPrompt: `Bạn là nhân viên lễ tân khách sạn cao cấp tại Trung Quốc. Học viên là du khách làm thủ tục.
Cấu trúc phản hồi bắt buộc: [ZH], [PINYIN], [VI], [FEEDBACK] (nếu cần).
Các chủ đề: nhận phòng (check-in), phòng đơn/đôi, bữa sáng mấy giờ, mật khẩu Wi-Fi, trả phòng (check-out).`
  },
  interview: {
    id: "interview",
    name: "Phỏng vấn xin việc",
    icon: "💼",
    level: "HSK 3-4",
    description: "Nhập vai người phỏng vấn công ty: giới thiệu bản thân, kinh nghiệm làm việc, kỳ vọng lương.",
    initialMessage: {
      zh: "你好，请坐。感谢你来参加今天的面试。首先，请用中文简单介绍一下你自己吧。",
      pinyin: "Nǐ hǎo, qǐng zuò. Gǎnxiè nǐ lái cānjiā jīntiān de miànshì. Shǒuxiān, qǐng yòng Zhōngwén jiǎndān jièshào yíxià nǐ zìjǐ ba.",
      vi: "Chào bạn, mời ngồi. Cảm ơn bạn đã đến tham gia buổi phỏng vấn hôm nay. Trước tiên, xin mời bạn giới thiệu sơ lược về bản thân bằng tiếng Trung nhé."
    },
    systemPrompt: `Bạn là giám đốc nhân sự chuyên nghiệp tại một doanh nghiệp quốc tế. Học viên là ứng viên.
Cấu trúc phản hồi bắt buộc: [ZH], [PINYIN], [VI], [FEEDBACK] (nếu học viên dùng từ chưa chuẩn công sở).
Hỏi các câu hỏi phỏng vấn chuẩn: điểm mạnh/yếu, kinh nghiệm làm việc, tại sao chọn công ty.`
  }
};

// Fallback canned responses if no API key or network failure
const TUTOR_FALLBACK_RESPONSES = [
  {
    zh: "你说得很好！发音也很清楚。继续加油！我们再聊聊你的周末打算吧？",
    pinyin: "Nǐ shuō de hěn hǎo! Fāyīn yě hěn qīngchu. Jìxù jiāyóu! Wǒmen zài liáo liao nǐ de zhōumò dǎsuàn ba?",
    vi: "Bạn nói rất tốt! Phát âm cũng rất rõ ràng. Tiếp tục cố gắng nhé! Chúng ta nói thêm về kế hoạch cuối tuần của bạn nhé?",
    feedback: "💡 Mẹo: Có thể dùng thêm trợ từ '了' hoặc cụm '打算' để diễn đạt dự định."
  },
  {
    zh: "非常有意思！中国人也经常这么说。你可以试着用'虽然...但是...'造一个句子吗？",
    pinyin: "Fēicháng yǒu yìsi! Zhōngguórén yě jīngcháng zhème shuō. Nǐ kěyǐ shì zhe yòng 'suīrán... dànshì...' zào yí ge jùzi ma?",
    vi: "Rất thú vị! Người Trung Quốc cũng thường hay nói như vậy. Bạn có thể thử đặt một câu với 'Tuy...nhưng...' được không?",
    feedback: "💡 Gợi ý: 虽然学汉语有点儿难，但是很有趣。(Tuy học tiếng Trung hơi khó, nhưng rất thú vị.)"
  },
  {
    zh: "听起来很棒！你的汉语水平进步很大。平时你喜欢看中文电影或者听中文歌吗？",
    pinyin: "Tīng qǐlai hěn bàng! Nǐ de Hànyǔ shuǐpíng jìnbù hěn dà. Píngshí nǐ xǐhuan kàn Zhōngwén diànyǐng huòzhě tīng Zhōngwén gē ma?",
    vi: "Nghe tuyệt quá! Trình độ tiếng Trung của bạn tiến bộ rất nhiều. Bình thường bạn có thích xem phim hay nghe nhạc Trung Quốc không?",
    feedback: "💡 Mẹo nhớ: Cấu trúc '平时喜欢...' dùng diễn đạt thói quen hàng ngày."
  }
];

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

// Initialize Tutor Tab
function initChineseTutor() {
  if (!tutorProfileKey) {
    tutorProfileKey = window.userProfileKey || localStorage.getItem("currentProfileKey") || "default";
  }
  if (!firebaseTutorRef && (window.firebaseDb || firebaseTutorDb)) {
    initChineseTutorFirebase(window.firebaseDb || firebaseTutorDb, tutorProfileKey);
  } else {
    loadTutorAccountSettings();
  }
  renderTutorScenarioPills();
  updateTutorModelBadge();
  loadTutorScenarioHistory(currentTutorScenario);
  setupTutorSpeechRecognition();
}

// Render Scenario Pills
function renderTutorScenarioPills() {
  const container = document.getElementById("tutorScenarioPills");
  if (!container) return;

  container.innerHTML = Object.values(CHINESE_TUTOR_SCENARIOS)
    .map(
      (sc) => `
    <button class="tutor-scenario-pill ${sc.id === currentTutorScenario ? "active" : ""}" 
            onclick="switchTutorScenario('${sc.id}')" title="${sc.description}">
      <span class="tutor-pill-icon">${sc.icon}</span>
      <span class="tutor-pill-name">${sc.name}</span>
      <span class="tutor-pill-level">${sc.level}</span>
    </button>
  `
    )
    .join("");
}

// Switch Scenario
function switchTutorScenario(scenarioId) {
  if (!CHINESE_TUTOR_SCENARIOS[scenarioId]) return;
  currentTutorScenario = scenarioId;
  renderTutorScenarioPills();
  loadTutorScenarioHistory(currentTutorScenario);
}

// Load Conversation History (Firebase with LocalStorage fallback)
function loadTutorScenarioHistory(scenarioId) {
  const pKey = tutorProfileKey || window.userProfileKey || "default";
  let localData = null;
  try {
    const raw = localStorage.getItem(`chineseTutor_${pKey}_${scenarioId}`);
    if (raw) localData = JSON.parse(raw);
  } catch (e) {}

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
        resetTutorConversation();
      }
    }).catch(err => {
      console.warn("[Chinese Tutor] Firebase load history error:", err);
      if (Array.isArray(localData) && localData.length > 0) {
        tutorConversationHistory = localData;
        renderTutorChatHistory();
      } else {
        resetTutorConversation();
      }
    });
  } else {
    if (Array.isArray(localData) && localData.length > 0) {
      tutorConversationHistory = localData;
      renderTutorChatHistory();
    } else {
      resetTutorConversation();
    }
  }
}

// Save Conversation History
function saveTutorScenarioHistory(scenarioId) {
  const pKey = tutorProfileKey || window.userProfileKey || "default";
  try {
    localStorage.setItem(`chineseTutor_${pKey}_${scenarioId}`, JSON.stringify(tutorConversationHistory));
  } catch (e) {}

  if (!firebaseTutorRef && (window.firebaseDb || firebaseTutorDb)) {
    initChineseTutorFirebase(window.firebaseDb || firebaseTutorDb, pKey);
  }

  if (firebaseTutorRef) {
    firebaseTutorRef.child(`scenarios/${scenarioId}/history`).set(tutorConversationHistory)
      .catch(e => console.warn("[Chinese Tutor] Firebase save history error:", e));
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

// Clear Current Scenario Conversation History
function clearTutorCurrentHistory() {
  if (!confirm("Bạn có chắc chắn muốn làm mới và xóa toàn bộ lịch sử trò chuyện của tình huống này không?")) return;
  const pKey = tutorProfileKey || window.userProfileKey || "default";
  tutorConversationHistory = [];
  try {
    localStorage.removeItem(`chineseTutor_${pKey}_${currentTutorScenario}`);
  } catch (e) {}

  if (firebaseTutorRef) {
    firebaseTutorRef.child(`scenarios/${currentTutorScenario}/history`).remove()
      .catch(e => console.warn("[Chinese Tutor] Firebase clear history error:", e));
  }
  resetTutorConversation();
}
window.clearTutorCurrentHistory = clearTutorCurrentHistory;

// Reset Conversation with Scenario Initial Message
function resetTutorConversation() {
  const scenario = CHINESE_TUTOR_SCENARIOS[currentTutorScenario];
  tutorConversationHistory = [];

  const chatContainer = document.getElementById("tutorChatMessages");
  if (!chatContainer) return;
  chatContainer.innerHTML = "";

  // Add initial AI welcome message
  appendTutorMessage({
    role: "assistant",
    zh: scenario.initialMessage.zh,
    pinyin: scenario.initialMessage.pinyin,
    vi: scenario.initialMessage.vi,
    feedback: ""
  });
}

// Parse AI Raw Response
function parseTutorAiResponse(raw) {
  const zhMatch = raw.match(/\[ZH\]([\s\S]*?)\[\/ZH\]/i);
  const pinyinMatch = raw.match(/\[PINYIN\]([\s\S]*?)\[\/PINYIN\]/i);
  const viMatch = raw.match(/\[VI\]([\s\S]*?)\[\/VI\]/i);
  const feedbackMatch = raw.match(/\[FEEDBACK\]([\s\S]*?)\[\/FEEDBACK\]/i);

  if (zhMatch && pinyinMatch && viMatch) {
    return {
      zh: zhMatch[1].trim(),
      pinyin: pinyinMatch[1].trim(),
      vi: viMatch[1].trim(),
      feedback: feedbackMatch ? feedbackMatch[1].trim() : ""
    };
  }

  // Fallback parsing if AI didn't use tags strictly
  const lines = raw.split("\n").map(l => l.trim()).filter(Boolean);
  return {
    zh: lines[0] || raw,
    pinyin: lines[1] || "",
    vi: lines[2] || "Bản dịch đang cập nhật",
    feedback: lines.slice(3).join("\n") || ""
  };
}

// Update active model badge in scenario bar
function updateTutorModelBadge() {
  const badgeBtn = document.getElementById("tutorModelBadgeBtn");
  const badgeText = document.getElementById("tutorModelBadgeText");
  if (!badgeBtn || !badgeText) return;

  const modelObj = GEMINI_TUTOR_MODELS.find(m => m.id === currentTutorModel) || GEMINI_TUTOR_MODELS[0];
  const modelName = modelObj ? modelObj.name : currentTutorModel;

  badgeText.textContent = modelName;
  badgeBtn.className = "tutor-model-badge-btn provider-gemini";
  badgeBtn.title = `Đang dùng: Google Gemini (${modelName}). Bấm để cài đặt API Key.`;
}
window.updateTutorModelBadge = updateTutorModelBadge;

// Send Message from User
async function sendTutorMessage() {
  const inputEl = document.getElementById("tutorChatInput");
  if (!inputEl) return;
  const userText = inputEl.value.trim();
  if (!userText) return;

  inputEl.value = "";
  inputEl.style.height = "auto";

  // Append User message to UI
  appendTutorMessage({
    role: "user",
    text: userText
  });

  // Show typing indicator
  showTutorTyping(true);

  const scenario = CHINESE_TUTOR_SCENARIOS[currentTutorScenario] || CHINESE_TUTOR_SCENARIOS.free;
  const modelToUse = currentTutorModel || DEFAULT_GEMINI_MODEL;
  const pKey = getActiveTutorProfileKey();
  const activeKey = tutorGeminiKey || localStorage.getItem(`geminiApiKey_${pKey}`) || localStorage.getItem("geminiApiKey") || "";

  if (!activeKey) {
    // Show polite notification + fallback
    setTimeout(() => {
      showTutorTyping(false);
      const fallback = TUTOR_FALLBACK_RESPONSES[Math.floor(Math.random() * TUTOR_FALLBACK_RESPONSES.length)];
      appendTutorMessage({
        role: "assistant",
        zh: fallback.zh,
        pinyin: fallback.pinyin,
        vi: fallback.vi,
        feedback: `${fallback.feedback}\n*(Chưa cài đặt Google Gemini API Key cho tài khoản này. Bấm vào nút Model góc trên bên phải để nhập Key và trải nghiệm Gia sư AI thực thụ)*`
      });
    }, 700);
    return;
  }

  try {
    const rawAiReply = await callTutorGemini(activeKey, modelToUse, scenario, tutorConversationHistory, userText);
    showTutorTyping(false);

    const parsed = parseTutorAiResponse(rawAiReply);
    appendTutorMessage({
      role: "assistant",
      zh: parsed.zh,
      pinyin: parsed.pinyin,
      vi: parsed.vi,
      feedback: parsed.feedback
    });

  } catch (err) {
    console.warn("[Chinese Tutor] Gemini API Call failed:", err);
    showTutorTyping(false);
    const fallback = TUTOR_FALLBACK_RESPONSES[Math.floor(Math.random() * TUTOR_FALLBACK_RESPONSES.length)];
    appendTutorMessage({
      role: "assistant",
      zh: fallback.zh,
      pinyin: fallback.pinyin,
      vi: fallback.vi,
      feedback: `${fallback.feedback}\n*(Lưu ý: Kết nối Google Gemini gặp lỗi: ${err.message}. Đang hiển thị câu phản hồi mẫu)*`
    });
  }
}

// Call Google Gemini API (generateContent endpoint)
async function callTutorGemini(apiKey, model, scenario, history, userText) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const contents = [];
  // Include conversation history turns
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

  // Current turn
  contents.push({
    role: "user",
    parts: [{ text: userText }]
  });

  const body = {
    systemInstruction: {
      parts: [{ text: scenario.systemPrompt }]
    },
    contents: contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1000
    }
  };

  let response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  // If error on current model (e.g. deprecated or 404), attempt fallback to gemini-3.6-flash or gemini-1.5-flash
  if (!response.ok && model !== "gemini-3.6-flash") {
    console.warn(`[Chinese Tutor] Gemini model ${model} failed (${response.status}), falling back to gemini-3.6-flash...`);
    const fallbackEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;
    response = await fetch(fallbackEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  }

  if (!response.ok) {
    let errorDetail = `Lỗi Gemini API (${response.status})`;
    try {
      const errJson = await response.json();
      if (errJson?.error?.message) errorDetail = errJson.error.message;
    } catch (e) {}
    throw new Error(errorDetail);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  if (!rawText) {
    throw new Error("Không nhận được câu trả lời từ Gemini API.");
  }
  return rawText;
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
  const modelSelect = document.getElementById("tutorModelSelect");
  const keyInput = document.getElementById("tutorApiKeyInput");
  const model = modelSelect ? modelSelect.value : DEFAULT_GEMINI_MODEL;
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
        if (errData?.error?.message) {
          errDetail = errData.error.message;
          // Auto-fallback nếu model yêu cầu gemini-3.6-flash
          if (errDetail.includes("gemini-3.6-flash") && model !== "gemini-3.6-flash") {
            console.log("[Chinese Tutor] Tự động thử lại với gemini-3.6-flash...");
            const retryEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;
            const retryRes = await fetch(retryEndpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: "Hello, reply with 1 word: OK" }] }]
              })
            });
            if (retryRes.ok) {
              if (modelSelect) modelSelect.value = "gemini-3.6-flash";
              currentTutorModel = "gemini-3.6-flash";
              handleTutorModelChange();
              setTutorStatus("success", `✓ Đã tự động chuyển sang mô hình mới nhất: Gemini 3.6 Flash! Kết nối thành công.`);
              return;
            }
          }
        }
      } catch (e) {}
      throw new Error(errDetail);
    }
    setTutorStatus("success", `✓ Kết nối Google Gemini (${model}) thành công! Sẵn sàng học tiếng Trung.`);
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
    msgDiv.innerHTML = `
      <div class="tutor-msg-bubble user-bubble">
        <div class="tutor-user-text">${escapeHtml(msg.text)}</div>
      </div>
    `;
    tutorConversationHistory.push({ role: "user", text: msg.text });
  } else {
    const escapedZh = escapeHtml(msg.zh || "");
    const escapedPinyin = escapeHtml(msg.pinyin || "");
    const escapedVi = escapeHtml(msg.vi || "");
    const escapedFeedback = msg.feedback ? escapeHtml(msg.feedback) : "";

    msgDiv.innerHTML = `
      <div class="tutor-avatar-icon">🐼</div>
      <div class="tutor-msg-bubble assistant-bubble">
        <div class="tutor-bubble-top">
          <div class="tutor-zh-text">${escapedZh}</div>
          <button class="tutor-speak-btn" onclick="speakTutorChinese('${escapedZh.replace(/'/g, "\\'")}')" title="Phát âm">
            <i class="fi fi-rr-volume"></i>
          </button>
        </div>
        <div class="tutor-pinyin-text">${escapedPinyin}</div>
        <div class="tutor-vi-text">${escapedVi}</div>
        ${escapedFeedback ? `<div class="tutor-feedback-box">${escapedFeedback}</div>` : ""}
      </div>
    `;
    tutorConversationHistory.push({
      role: "assistant",
      zh: msg.zh,
      pinyin: msg.pinyin,
      vi: msg.vi,
      feedback: msg.feedback
    });
  }

  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;

  if (!skipSave) {
    saveTutorScenarioHistory(currentTutorScenario);
  }
}

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

// Handle Auto-expand textarea
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
  if (window.firebaseDb && typeof initChineseTutorFirebase === "function") {
    initChineseTutorFirebase(window.firebaseDb, window.userProfileKey);
  }
});

window.toggleTutorMoreMenu = toggleTutorMoreMenu;
window.closeTutorMoreMenu = closeTutorMoreMenu;
window.handleTutorMenuApiKey = handleTutorMenuApiKey;
window.handleTutorMenuClear = handleTutorMenuClear;


