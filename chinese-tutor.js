/* ==================== CHINESE TUTOR - AI GIA SƯ TIẾNG TRUNG RIÊNG BIỆT (GOOGLE GEMINI) ==================== */

// Predefined Google Gemini Models (Chỉ sử dụng duy nhất mô hình khả dụng gemini-3.6-flash)
const GEMINI_TUTOR_MODELS = [
  { id: "gemini-3.6-flash", name: "Gemini 3.6 Flash", desc: "Mô hình mới nhất và chính thức hoạt động ổn định trên tài khoản Google AI API (Khuyên dùng)" }
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
  greeting: {
    id: "greeting",
    name: "Chào hỏi & Làm quen",
    icon: "👋",
    level: "HSK 1",
    description: "Giao tiếp cơ bản: chào hỏi, giới thiệu tên tuổi, quê quán, nghề nghiệp và sở thích.",
    initialMessage: {
      zh: "你好！很高兴认识你。我叫李明，是你的中文朋友。你叫什么名字？你是哪国人？",
      pinyin: "Nǐ hǎo! Hěn gāoxìng rènshí nǐ. Wǒ jiào Lǐ Míng, shì nǐ de Zhōngwén péngyou. Nǐ jiào shénme míngzi? Nǐ shì nǎ guó rén?",
      vi: "Xin chào! Rất vui được làm quen với bạn. Tôi tên là Lý Minh, là người bạn tiếng Trung của bạn. Bạn tên là gì? Bạn là người nước nào?"
    },
    systemPrompt: `Bạn là Lý Minh (李明), một người bạn Trung Quốc thân thiện đang làm quen với học viên.
Nhiệm vụ: Giao tiếp làm quen cấp độ HSK 1, hỏi tên, tuổi, công việc, sở thích, hướng dẫn học viên trả lời tự nhiên. Cấu trúc: [ZH], [PINYIN], [VI], [FEEDBACK].`
  },
  dining: {
    id: "dining",
    name: "Gọi món nhà hàng",
    icon: "🍜",
    level: "HSK 1-2",
    description: "Nhập vai phục vụ nhà hàng Trung Quốc: gọi món, hỏi khẩu vị độ cay, thanh toán hóa đơn.",
    initialMessage: {
      zh: "您好，欢迎光临！请问几位？这边有空位，请坐。这是菜单，您想吃点什么？",
      pinyin: "Nín hǎo, huānyíng guānglín! Qǐngwèn jǐ wèi? Zhè biān yǒu kòng wèi, qǐng zuò. Zhè shì càidān, nín xiǎng chī diǎn shénme?",
      vi: "Kính chào quý khách! Xin hỏi quý khách đi mấy người ạ? Bên này có bàn trống, mời ngồi. Đây là thực đơn, quý khách muốn dùng món gì?"
    },
    systemPrompt: `Bạn là nhân viên phục vụ tại một nhà hàng Trung Hoa truyền thống. Học viên là thực khách.
Nhiệm vụ của bạn:
1. Luôn phản hồi theo cấu trúc: [ZH], [PINYIN], [VI], [FEEDBACK] (nếu có lỗi).
2. Giữ đúng vai nhân viên phục vụ chu đáo: hỏi món ăn, sở thích (cay/không cay, đá/nóng), giới thiệu món đặc sản, báo giá và tính tiền.`
  },
  shopping: {
    id: "shopping",
    name: "Mua sắm & Trả giá",
    icon: "🛍️",
    level: "HSK 2-3",
    description: "Nhập vai chủ tiệm quần áo / quà lưu niệm: hỏi giá, thử kích cỡ, mặc cả giảm giá.",
    initialMessage: {
      zh: "你好帅哥/美女！来看看吧，新到的衣服和特产，质量都非常好。你喜欢哪一件？",
      pinyin: "Nǐ hǎo shuàigē / měinǚ! Lái kàn kan ba, xīn dào de yīfu hé tèchǎn, zhìliàng dōu fēicháng hǎo. Nǐ xǐhuan nǎ yí jiàn?",
      vi: "Chào bạn đẹp trai/xinh gái! Ghé xem đi, quần áo và đặc sản mới về, chất lượng đều rất tốt. Bạn thích chiếc nào?"
    },
    systemPrompt: `Bạn là chủ một cửa hàng thời trang/đồ lưu niệm tại chợ đêm Trung Quốc. Học viên là khách mua hàng.
Cấu trúc: [ZH], [PINYIN], [VI], [FEEDBACK]. Khi khách mặc cả thì linh hoạt giảm giá hoặc giải thích chất lượng tốt.`
  },
  direction: {
    id: "direction",
    name: "Hỏi đường & Đi lại",
    icon: "🚖",
    level: "HSK 2",
    description: "Hỏi đường đến bến xe, ga tàu điện ngầm, đi taxi, hỏi thời gian và phương tiện.",
    initialMessage: {
      zh: "你好！请问有什么可以帮你的吗？你想去哪里？北京的交通我很熟悉！",
      pinyin: "Nǐ hǎo! Qǐngwèn yǒu shénme kěyǐ bāng nǐ de ma? Nǐ xiǎng qù nǎlǐ? Běijīng de jiāotōng wǒ hěn shúxi!",
      vi: "Xin chào! Xin hỏi tôi có thể giúp gì cho bạn? Bạn muốn đi đâu? Giao thông ở Bắc Kinh tôi rất rành đấy!"
    },
    systemPrompt: `Bạn là người bản địa nhiệt tình chỉ đường ở Trung Quốc. Học viên là du khách đang hỏi đường.
Cấu trúc: [ZH], [PINYIN], [VI], [FEEDBACK]. Hướng dẫn cách rẽ trái, rẽ phải, đi thẳng, đi xe buýt hay tàu điện ngầm (地铁/公交车/出租车).`
  },
  hotel: {
    id: "hotel",
    name: "Khách sạn & Nhận phòng",
    icon: "🏨",
    level: "HSK 2-3",
    description: "Nhập vai lễ tân khách sạn: nhận phòng, đổi phòng, hỏi mật khẩu Wi-Fi, trả phòng.",
    initialMessage: {
      zh: "您好！欢迎入住北京饭店。请问您有预订吗？请出示一下您的护照。",
      pinyin: "Nín hǎo! Huānyíng rùzhù Běijīng Fàndiàn. Qǐngwèn nín yǒu yùdìng ma? Qǐng chūshì yíxià nín de hùzhào.",
      vi: "Kính chào quý khách! Chào mừng quý khách đến với khách sạn Bắc Kinh. Xin hỏi quý khách có đặt phòng trước không ạ? Xin vui lòng xuất trình hộ chiếu."
    },
    systemPrompt: `Bạn là nhân viên lễ tân khách sạn cao cấp tại Trung Quốc. Học viên là du khách làm thủ tục.
Cấu trúc phản hồi: [ZH], [PINYIN], [VI], [FEEDBACK]. Các chủ đề: check-in, phòng đơn/đôi, bữa sáng, mật khẩu Wi-Fi, check-out.`
  },
  travel: {
    id: "travel",
    name: "Du lịch & Tham quan",
    icon: "✈️",
    level: "HSK 2-3",
    description: "Mua vé danh lam thắng cảnh, tìm hiểu lộ trình tham quan, nhờ chụp ảnh lưu niệm.",
    initialMessage: {
      zh: "你好！欢迎来到故宫博物院。今天天气非常好，您想了解哪些游览路线呢？",
      pinyin: "Nǐ hǎo! Huānyíng lái dào Gùgōng Bówùyuàn. Jīntiān tiānqì fēicháng hǎo, nín xiǎng liǎojiě nǎxiē yóulǎn lùxiàn ne?",
      vi: "Xin chào! Chào mừng bạn đến với Bảo tàng Cố Cung. Thời tiết hôm nay rất đẹp, bạn muốn tìm hiểu lộ trình tham quan nào?"
    },
    systemPrompt: `Bạn là hướng dẫn viên du lịch tại Bắc Kinh/Thượng Hải. Học viên là du khách.
Cấu trúc: [ZH], [PINYIN], [VI], [FEEDBACK]. Hướng dẫn mua vé tham quan, giới thiệu thắng cảnh, chụp ảnh kỷ niệm.`
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
Cấu trúc phản hồi: [ZH], [PINYIN], [VI], [FEEDBACK]. Hỏi các câu hỏi phỏng vấn chuẩn công sở: điểm mạnh/yếu, kinh nghiệm làm việc.`
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
  updateTutorModelBadge();
  updateTutorActiveTopicBadge();
  setupTutorSpeechRecognition();

  // Khi mở box chat, luôn hiển thị màn hình Bắt đầu (người dùng click Bắt đầu mới cho chọn chủ đề)
  renderTutorStartScreen();
}

// Cập nhật huy hiệu chủ đề trên Header của modal
function updateTutorActiveTopicBadge() {
  const badge = document.getElementById("tutorActiveTopicBadge");
  const icon = document.getElementById("tutorTopicBadgeIcon");
  const name = document.getElementById("tutorTopicBadgeName");
  if (!badge) return;

  const scenario = CHINESE_TUTOR_SCENARIOS[currentTutorScenario] || CHINESE_TUTOR_SCENARIOS.free;
  if (tutorConversationHistory && tutorConversationHistory.length > 0) {
    if (icon) icon.textContent = scenario.icon;
    if (name) name.textContent = scenario.name;
    badge.style.display = "inline-flex";
  } else {
    badge.style.display = "none";
  }
}
window.updateTutorActiveTopicBadge = updateTutorActiveTopicBadge;

// Render Scenario Pills (fallback giữ lại nếu cần)
function renderTutorScenarioPills() {
  const container = document.getElementById("tutorScenarioPills");
  if (!container) return;

  container.innerHTML = Object.values(CHINESE_TUTOR_SCENARIOS)
    .map(
      (sc) => `
    <button class="tutor-scenario-pill ${sc.id === currentTutorScenario ? "active" : ""}" 
            onclick="selectAndStartScenario('${sc.id}')" title="${sc.description}">
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
  selectAndStartScenario(scenarioId);
}

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
  } catch (e) { }

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
  updateTutorActiveTopicBadge();
}

// Clear Current Scenario Conversation History
function clearTutorCurrentHistory() {
  if (!confirm("Bạn có chắc chắn muốn làm mới và xóa toàn bộ lịch sử trò chuyện của tình huống này không?")) return;
  const pKey = tutorProfileKey || window.userProfileKey || "default";
  tutorConversationHistory = [];
  try {
    localStorage.removeItem(`chineseTutor_${pKey}_${currentTutorScenario}`);
  } catch (e) { }

  if (firebaseTutorRef) {
    firebaseTutorRef.child(`scenarios/${currentTutorScenario}/history`).remove()
      .catch(e => console.warn("[Chinese Tutor] Firebase clear history error:", e));
  }
  resetTutorConversation();
  updateTutorActiveTopicBadge();
}
window.clearTutorCurrentHistory = clearTutorCurrentHistory;

// Hiển thị màn hình chờ ban đầu với nút Bắt đầu (người dùng click Bắt đầu mới cho chọn chủ đề)
function renderTutorStartScreen() {
  const chatContainer = document.getElementById("tutorChatMessages");
  if (!chatContainer) return;
  chatContainer.innerHTML = "";
  tutorConversationHistory = [];

  updateTutorActiveTopicBadge();

  // Kiểm tra xem có phiên hội thoại trước đó trong máy không
  const pKey = tutorProfileKey || window.userProfileKey || "default";
  let hasRecent = false;
  let recentScenario = CHINESE_TUTOR_SCENARIOS[currentTutorScenario] || CHINESE_TUTOR_SCENARIOS.free;
  try {
    const raw = localStorage.getItem(`chineseTutor_${pKey}_${currentTutorScenario}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) hasRecent = true;
    }
  } catch (e) { }

  const startCard = document.createElement("div");
  startCard.className = "tutor-start-screen-wrapper";
  startCard.innerHTML = `
    <div class="tutor-welcome-start-card">
      <div class="tutor-start-icon">🤖</div>
      <h4 class="tutor-start-title">Luyện Hội Thoại & Khẩu Ngữ Thông Minh với Gemini</h4>
      <p class="tutor-start-desc">Trợ giảng tiếng Trung thông minh đồng hành cùng bạn luyện giao tiếp, phản xạ khẩu ngữ, phân tích Hán tự, Pinyin và nhận xét ngữ pháp theo chuẩn HSK.</p>
      
      <div class="tutor-start-hints">
        <div class="tutor-start-hint-item">
          <i class="fi fi-rr-apps"></i>
          <span>Nhiều chủ đề phong phú: Chào hỏi, Gọi món, Mua sắm, Du lịch...</span>
        </div>
        <div class="tutor-start-hint-item">
          <i class="fi fi-rr-sparkles"></i>
          <span>Gia sư AI phản hồi Hán tự, Pinyin và sửa lỗi ngữ pháp</span>
        </div>
        <div class="tutor-start-hint-item">
          <i class="fi fi-rr-microphone"></i>
          <span>Luyện nói phản xạ trực tiếp qua Microphone giọng nói</span>
        </div>
      </div>

      <div class="tutor-start-actions">
        <button type="button" class="tutor-start-btn" onclick="showTutorTopicPicker()">
          <i class="fi fi-rr-play"></i>
          <span>Bắt đầu</span>
        </button>
        ${hasRecent ? `
          <button type="button" class="tutor-continue-btn" onclick="continueRecentTutorChat()" title="Tiếp tục cuộc trò chuyện gần nhất">
            <i class="fi fi-rr-time-past"></i>
            <span>Tiếp tục: ${recentScenario.icon} ${escapeHtml(recentScenario.name)}</span>
          </button>
        ` : ""}
      </div>
    </div>
  `;

  chatContainer.appendChild(startCard);
}
window.renderTutorStartScreen = renderTutorStartScreen;

// Hiển thị màn hình chọn chủ đề đàm thoại khi người dùng bấm Bắt đầu hoặc Đổi chủ đề
function showTutorTopicPicker() {
  closeTutorMoreMenu();
  const chatContainer = document.getElementById("tutorChatMessages");
  if (!chatContainer) return;
  chatContainer.innerHTML = "";

  const badge = document.getElementById("tutorActiveTopicBadge");
  if (badge) badge.style.display = "none";

  const pickerWrapper = document.createElement("div");
  pickerWrapper.className = "tutor-topic-picker-container";

  pickerWrapper.innerHTML = `
    <div class="tutor-topic-picker-header">
      <div class="tutor-topic-picker-badge">Chủ đề đàm thoại HSK</div>
      <h3 class="tutor-topic-picker-title">Chọn chủ đề bạn muốn luyện tập</h3>
      <p class="tutor-topic-picker-subtitle">Chọn một tình huống nhập vai để bắt đầu trò chuyện tương tác cùng Gia sư AI:</p>
    </div>

    <div class="tutor-topic-grid">
      ${Object.values(CHINESE_TUTOR_SCENARIOS).map(sc => `
        <div class="tutor-topic-card ${sc.id === currentTutorScenario ? "active" : ""}" 
             onclick="selectAndStartScenario('${sc.id}')">
          <div class="tutor-topic-card-header">
            <span class="tutor-topic-icon">${sc.icon}</span>
            <span class="tutor-topic-level">${sc.level}</span>
          </div>
          <div class="tutor-topic-name">${escapeHtml(sc.name)}</div>
          <div class="tutor-topic-desc">${escapeHtml(sc.description)}</div>
          <div class="tutor-topic-card-footer">
            <span class="tutor-topic-action">
              <span>Bắt đầu trò chuyện</span>
              <i class="fi fi-rr-arrow-right"></i>
            </span>
          </div>
        </div>
      `).join("")}
    </div>

    <div class="tutor-topic-picker-actions">
      <button type="button" class="tutor-topic-back-btn" onclick="renderTutorStartScreen()">
        <i class="fi fi-rr-arrow-left"></i>
        <span>Quay lại</span>
      </button>
    </div>
  `;

  chatContainer.appendChild(pickerWrapper);
  chatContainer.scrollTop = 0;
}
window.showTutorTopicPicker = showTutorTopicPicker;

// Bắt đầu hội thoại khi người dùng chọn chủ đề
function selectAndStartScenario(scenarioId) {
  if (!CHINESE_TUTOR_SCENARIOS[scenarioId]) return;
  currentTutorScenario = scenarioId;

  const scenario = CHINESE_TUTOR_SCENARIOS[currentTutorScenario];
  const chatContainer = document.getElementById("tutorChatMessages");
  if (!chatContainer) return;
  chatContainer.innerHTML = "";
  tutorConversationHistory = [];

  // Gửi tin nhắn mở đầu của Gia sư AI cho chủ đề này
  appendTutorMessage({
    role: "assistant",
    zh: scenario.initialMessage.zh,
    pinyin: scenario.initialMessage.pinyin,
    vi: scenario.initialMessage.vi,
    feedback: ""
  });

  updateTutorActiveTopicBadge();

  // Focus ô nhập
  setTimeout(() => {
    const input = document.getElementById("tutorChatInput");
    if (input) input.focus();
  }, 200);
}
window.selectAndStartScenario = selectAndStartScenario;

// Tiếp tục phiên chat gần đây
function continueRecentTutorChat() {
  loadTutorScenarioHistory(currentTutorScenario);
  updateTutorActiveTopicBadge();
}
window.continueRecentTutorChat = continueRecentTutorChat;

// Bắt đầu hội thoại tình huống hiện tại
function startCurrentTutorScenario() {
  showTutorTopicPicker();
}
window.startCurrentTutorScenario = startCurrentTutorScenario;

// Reset Conversation to Start Screen
function resetTutorConversation() {
  renderTutorStartScreen();
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

  try {
    const aiResult = await callTutorGemini(activeKey, modelToUse, scenario, tutorConversationHistory, userText);
    showTutorTyping(false);

    const resultText = (typeof aiResult === "object" && aiResult !== null) ? (aiResult.text || "") : String(aiResult || "");
    const parsed = parseTutorAiResponse(resultText);
    appendTutorMessage({
      role: "assistant",
      zh: parsed.zh,
      pinyin: parsed.pinyin,
      vi: parsed.vi,
      feedback: parsed.feedback
    });

    // Cảnh báo nếu phản hồi bị cắt ngang do giới hạn token
    if (aiResult.truncated) {
      if (typeof showToast === "function") {
        showToast("⚠️ Phản hồi AI có thể bị cắt ngang do giới hạn token. Hãy thử hỏi lại ngắn gọn hơn.", 4000);
      }
    }

  } catch (err) {
    console.warn("[Chinese Tutor] Gemini API Call failed:", err);
    showTutorTyping(false);

    // Hiển thị trực tiếp lỗi API lên đoạn chat nếu tất cả mô hình dự phòng đều thất bại
    appendTutorErrorMessage({
      code: err.code || 500,
      status: err.status || "",
      message: err.message || "Không thể kết nối đến máy chủ Google Gemini.",
      model: modelToUse,
      retryText: userText,
      retryDelaySec: err.retryDelaySec || (err.code === 429 ? 28 : 0)
    });
  }
}

// Call Google Gemini API (generateContent endpoint)
async function callTutorGemini(apiKey, model, scenario, history, userText) {
  const modelToUse = "gemini-3.6-flash"; // Mô hình chính thức duy nhất hoạt động trên tài khoản
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

  const body = {
    systemInstruction: {
      parts: [{ text: scenario.systemPrompt }]
    },
    contents: contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192,
      thinkingConfig: {
        thinkingBudget: 1024
      }
    }
  };

  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    // Nếu gặp mã lỗi 503 (High demand spike tạm thời), tự động chờ 1.2 giây và thử lại 1 lần
    if (response.status === 503) {
      console.warn(`[Chinese Tutor] Model ${modelToUse} gặp lỗi 503 (High demand spike), thử lại sau 1.2s...`);
      await new Promise(r => setTimeout(r, 1200));
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
    }
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
  const finishReason = candidate?.finishReason || "";

  // Tìm part có thuộc tính 'text' (bỏ qua các part chỉ có thoughtSignature)
  const parts = candidate?.content?.parts || [];
  let rawText = "";
  for (const part of parts) {
    if (part.text) {
      rawText += part.text;
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
  const model = DEFAULT_GEMINI_MODEL;
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

// Biến lưu interval đếm ngược tự động thử lại khi hết quota
let tutorCountdownInterval = null;

function startTutorCountdown(seconds, retryText) {
  if (tutorCountdownInterval) {
    clearInterval(tutorCountdownInterval);
    tutorCountdownInterval = null;
  }
  let remaining = seconds;
  const total = seconds;
  const numEl = document.getElementById("tutorCountdownNum");
  const barEl = document.getElementById("tutorCountdownBar");

  tutorCountdownInterval = setInterval(() => {
    remaining--;
    if (numEl) numEl.textContent = `${remaining}`;
    if (barEl) {
      const pct = Math.max(0, (remaining / total) * 100);
      barEl.style.width = `${pct}%`;
    }

    if (remaining <= 0) {
      clearInterval(tutorCountdownInterval);
      tutorCountdownInterval = null;
      if (numEl) numEl.textContent = "0";
      if (typeof showToast === "function") {
        showToast("⏳ Hạn mức Quota đã hồi phục! Đang tự động gửi lại câu hỏi...", 2800);
      }
      retryTutorMessage(retryText);
    }
  }, 1000);
}

function cancelTutorCountdown() {
  if (tutorCountdownInterval) {
    clearInterval(tutorCountdownInterval);
    tutorCountdownInterval = null;
  }
  const box = document.getElementById("tutorCountdownBox");
  if (box) {
    box.innerHTML = '<div style="font-size: 12px; color: #94a3b8; padding: 4px 0;">✓ Đã dừng đếm ngược. Bạn có thể nhấn "Thử gửi lại" khi sẵn sàng.</div>';
  }
}
window.cancelTutorCountdown = cancelTutorCountdown;

// Append Error Message directly to Chat UI (No fake fallback sample responses)
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
    suggestion = `Mô hình <strong>${escapeHtml(model || "Gemini 3.6 Flash")}</strong> đã đạt giới hạn 20 lượt/phút của gói miễn phí Google API. Hệ thống đang đếm ngược để <strong>tự động gửi lại câu hỏi</strong> khi hạn mức hồi phục!`;
  } else if (isHighDemandOrNotFound) {
    suggestion = "Máy chủ Google hiện đang bận hoặc quá tải tạm thời. Bạn có thể nhấn <strong>'Thử gửi lại ngay'</strong> sau ít giây.";
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

      ${(isQuotaError && retryDelaySec > 0 && retryText) ? `
      <div class="tutor-quota-countdown-box" id="tutorCountdownBox">
        <div class="tutor-quota-countdown-header">
          <div class="tutor-quota-countdown-title">
            <i class="fi fi-rr-hourglass-end"></i>
            <span>Đang đếm ngược tự động gửi lại:</span>
          </div>
          <div class="tutor-quota-timer-badge">
            <span id="tutorCountdownNum">${retryDelaySec}</span>s
          </div>
        </div>
        <div class="tutor-countdown-progress-track">
          <div class="tutor-countdown-progress-bar" id="tutorCountdownBar" style="width: 100%;"></div>
        </div>
        <div class="tutor-quota-countdown-desc">
          ⏳ Bạn không cần làm gì, hệ thống sẽ <strong>tự động gửi lại câu hỏi</strong> khi bộ đếm về 0!
        </div>
      </div>
      ` : ""}

      <div class="tutor-error-suggestion">
        <div class="tutor-error-suggestion-icon">💡</div>
        <div class="tutor-error-suggestion-text">${suggestion}</div>
      </div>

      <div class="tutor-error-actions">
        ${retryText ? `
          <button type="button" class="tutor-error-btn retry-btn" onclick="retryTutorMessage(decodeURIComponent('${encodedRetry}'))">
            <i class="fi fi-rr-refresh"></i>
            <span>Thử gửi lại ngay</span>
          </button>
        ` : ""}
        ${(isQuotaError && retryDelaySec > 0) ? `
          <button type="button" class="tutor-error-btn cancel-btn" onclick="cancelTutorCountdown()">
            <i class="fi fi-rr-cross"></i>
            <span>Hủy đếm ngược</span>
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

  // Nếu là lỗi Quota 429 có thời gian chờ, tự động kích hoạt đếm ngược
  if (isQuotaError && retryText && retryDelaySec > 0) {
    startTutorCountdown(retryDelaySec, retryText);
  }
}
window.appendTutorErrorMessage = appendTutorErrorMessage;

// Thử gửi lại tin nhắn vừa bị lỗi
function retryTutorMessage(text) {
  if (!text) return;
  const inputEl = document.getElementById("tutorChatInput");
  if (inputEl) {
    inputEl.value = text;
    autoResizeTutorInput();
    sendTutorMessage();
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


