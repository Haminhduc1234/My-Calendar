/* ==================== CHINESE TUTOR - AI GIA SƯ TIẾNG TRUNG RIÊNG BIỆT ==================== */

// Tutor State
let tutorApiKey = localStorage.getItem("aiApiKey") || "";
let tutorConversationHistory = [];
let currentTutorScenario = "free";
let isTutorSpeaking = false;
let tutorRecognition = null;
let isTutorListening = false;

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

let firebaseTutorDb = null;
let tutorProfileKey = "";
let firebaseTutorRef = null;

// Firebase initialization for Chinese Tutor
function initChineseTutorFirebase(db, profileKey) {
  firebaseTutorDb = db || window.firebaseDb || null;
  tutorProfileKey = profileKey || window.userProfileKey || localStorage.getItem("currentProfileKey") || "default";
  if (firebaseTutorDb && tutorProfileKey) {
    try {
      firebaseTutorRef = firebaseTutorDb.ref(`chineseTutor/${tutorProfileKey}`);
      console.log("[Chinese Tutor] Firebase synced for profile:", tutorProfileKey);
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
  }
  renderTutorScenarioPills();
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

  // Prepare context
  const scenario = CHINESE_TUTOR_SCENARIOS[currentTutorScenario];
  const messagesPayload = [
    { role: "system", content: scenario.systemPrompt },
    ...tutorConversationHistory.slice(-8).map(msg => {
      if (msg.role === "user") {
        return { role: "user", content: msg.text };
      } else {
        return { role: "assistant", content: `[ZH]${msg.zh}[/ZH]\n[PINYIN]${msg.pinyin}[/PINYIN]\n[VI]${msg.vi}[/VI]` };
      }
    }),
    { role: "user", content: userText }
  ];

  tutorApiKey = localStorage.getItem("aiApiKey") || tutorApiKey || "";

  if (!tutorApiKey) {
    // Elegant fallback simulation
    setTimeout(() => {
      showTutorTyping(false);
      const fallback = TUTOR_FALLBACK_RESPONSES[Math.floor(Math.random() * TUTOR_FALLBACK_RESPONSES.length)];
      appendTutorMessage({
        role: "assistant",
        zh: fallback.zh,
        pinyin: fallback.pinyin,
        vi: fallback.vi,
        feedback: fallback.feedback
      });
    }, 900);
    return;
  }

let activeGroqModel = "";

// Dynamically discover active models supported by the current Groq API Key
async function resolveGroqModel(apiKey) {
  if (activeGroqModel) return activeGroqModel;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { "Authorization": `Bearer ${apiKey}` }
    });
    if (res.ok) {
      const json = await res.json();
      if (json && Array.isArray(json.data) && json.data.length > 0) {
        const modelIds = json.data.map(m => m.id);
        console.log("[Chinese Tutor] Available Groq models for this key:", modelIds);

        // Priority list for Chinese conversation & reasoning
        const preferred = [
          "qwen/qwen3.8-27b",
          "openai/gpt-oss-120b",
          "openai/gpt-oss-20b",
          "qwen/qwen3.6-27b",
          "llama-3.3-70b-versatile",
          "llama-3.1-8b-instant"
        ];

        for (const pref of preferred) {
          if (modelIds.includes(pref)) {
            activeGroqModel = pref;
            console.log("[Chinese Tutor] Selected optimal Groq model:", activeGroqModel);
            return pref;
          }
        }

        // Match any Qwen or GPT-OSS model
        const matched = modelIds.find(id => id.includes("qwen") || id.includes("gpt-oss") || id.includes("llama"));
        if (matched) {
          activeGroqModel = matched;
          return matched;
        }

        activeGroqModel = modelIds[0];
        return activeGroqModel;
      }
    }
  } catch (e) {
    console.warn("[Chinese Tutor] Could not fetch models list:", e);
  }

  // Modern default active models on Groq
  activeGroqModel = "openai/gpt-oss-120b";
  return activeGroqModel;
}

  try {
    let modelToUse = await resolveGroqModel(tutorApiKey);
    console.log("[Chinese Tutor] Calling Groq with model:", modelToUse);

    let response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${tutorApiKey}`
      },
      body: JSON.stringify({
        model: modelToUse,
        messages: messagesPayload,
        temperature: 0.7,
        max_tokens: 600
      })
    });

    // If 404 model not found, try fallback models
    if (!response.ok && response.status === 404) {
      const candidateFallbackModels = [
        "openai/gpt-oss-120b",
        "openai/gpt-oss-20b",
        "qwen/qwen3.8-27b",
        "llama-3.3-70b-versatile"
      ].filter(m => m !== modelToUse);

      for (const fallbackModel of candidateFallbackModels) {
        console.warn(`[Chinese Tutor] Trying fallback model ${fallbackModel}...`);
        response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${tutorApiKey}`
          },
          body: JSON.stringify({
            model: fallbackModel,
            messages: messagesPayload,
            temperature: 0.7,
            max_tokens: 600
          })
        });
        if (response.ok) {
          activeGroqModel = fallbackModel;
          console.log(`[Chinese Tutor] Fallback succeeded with model: ${fallbackModel}`);
          break;
        }
      }
    }

    showTutorTyping(false);

    if (!response.ok) {
      let errorMsg = `API Error: ${response.status}`;
      try {
        const errorJson = await response.json();
        if (errorJson && errorJson.error && errorJson.error.message) {
          errorMsg = errorJson.error.message;
        }
      } catch (e) {}
      throw new Error(errorMsg);
    }

    const data = await response.json();
    const rawAiReply = data.choices[0]?.message?.content || "";
    const parsed = parseTutorAiResponse(rawAiReply);

    appendTutorMessage({
      role: "assistant",
      zh: parsed.zh,
      pinyin: parsed.pinyin,
      vi: parsed.vi,
      feedback: parsed.feedback
    });

  } catch (err) {
    console.warn("[Chinese Tutor] API Call failed, using fallback:", err);
    showTutorTyping(false);
    const fallback = TUTOR_FALLBACK_RESPONSES[Math.floor(Math.random() * TUTOR_FALLBACK_RESPONSES.length)];
    appendTutorMessage({
      role: "assistant",
      zh: fallback.zh,
      pinyin: fallback.pinyin,
      vi: fallback.vi,
      feedback: `${fallback.feedback}\n*(Lưu ý: Không thể kết nối Groq API: ${err.message}. Đang hiển thị câu phản hồi mẫu)*`
    });
  }
}

// Prompt API Key setup directly from Tutor tab
function promptTutorApiKey() {
  const currentKey = localStorage.getItem("aiApiKey") || tutorApiKey || "";
  const newKey = prompt(
    "Nhập Groq API Key của bạn (bắt đầu bằng gsk_...):\n(Bạn có thể lấy miễn phí tại https://console.groq.com/keys)",
    currentKey
  );
  if (newKey !== null) {
    const trimmed = newKey.trim();
    localStorage.setItem("aiApiKey", trimmed);
    tutorApiKey = trimmed;
    activeGroqModel = ""; // Reset cached model to re-probe available models for new key
    alert(trimmed ? "Đã lưu Groq API Key thành công!" : "Đã xóa API Key, hệ thống sẽ sử dụng kịch bản phản hồi mẫu.");
  }
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
  promptTutorApiKey();
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

window.toggleTutorMoreMenu = toggleTutorMoreMenu;
window.closeTutorMoreMenu = closeTutorMoreMenu;
window.handleTutorMenuApiKey = handleTutorMenuApiKey;
window.handleTutorMenuClear = handleTutorMenuClear;

