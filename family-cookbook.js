/**
 * ==========================================================================
 * FAMILY COOKBOOK & DIETARY NOTES (Sổ Tay Bí Kíp Nấu Ăn Gia Đình)
 * - Quản lý công thức nấu ăn ruột của gia đình, bí kíp gia truyền
 * - Sổ tay khẩu vị, dị ứng thực phẩm, kiêng cữ sức khỏe của từng thành viên
 * - Chế độ Nấu Bếp (Cooking Mode) với checklist nguyên liệu & các bước
 * - Cảnh báo dị ứng tự động theo thành viên gia đình
 * - Tính năng "Hôm Nay Ăn Gì?" gợi ý mâm cơm 3 món chuẩn Việt
 * - Bảng tra cứu tương khắc thực phẩm truyền thống
 * - Đồng bộ Firebase Realtime Database & Offline-First LocalStorage
 * ==========================================================================
 */

(function () {
  "use strict";

  // State
  let activeProfileKey = "default";
  let firebaseDbInstance = null;
  let firebaseRecipesRef = null;
  let firebaseDietaryRef = null;

  let recipesCache = [];
  let dietaryCache = [];
  let calendarMealsCache = {}; // { [dateKey]: [ mealObj, ... ] }
  let firebaseCalendarMealsRef = null;
  let currentAssigningMealData = null;

  let currentTab = "recipes"; // 'recipes' | 'dietary' | 'mealplan'
  let currentCategory = "all";
  let searchQuery = "";
  let onlyFavorites = false;

  let viewingRecipeId = null;
  let editingRecipeId = null;
  let editingMemberId = null;

  // SVG Presets for Dish Covers (Đảm bảo luôn hiển thị sắc nét, không bị lỗi mạng)
  function makeFoodSvg(bgColor, emoji, title) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 240" width="100%" height="100%">
      <defs>
        <linearGradient id="grad_${bgColor.replace('#', '')}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${bgColor}" stop-opacity="0.95"/>
          <stop offset="100%" stop-color="#0b132b" stop-opacity="0.98"/>
        </linearGradient>
      </defs>
      <rect width="400" height="240" fill="url(#grad_${bgColor.replace('#', '')})"/>
      <circle cx="200" cy="110" r="60" fill="rgba(255,255,255,0.08)"/>
      <text x="200" y="125" font-size="56" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
      <text x="200" y="195" font-family="'Be Vietnam Pro', sans-serif" font-weight="700" font-size="17" fill="#f8fafc" text-anchor="middle">${title}</text>
    </svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  const PRESET_COVERS = {
    thitkho: makeFoodSvg("#b45309", "🥩", "Thịt Kho Tàu Nước Dừa"),
    canhchua: makeFoodSvg("#047857", "🍲", "Canh Chua Cá Lóc"),
    suonchua: makeFoodSvg("#be123c", "🍖", "Sườn Xào Chua Ngọt"),
    bosotvang: makeFoodSvg("#7c2d12", "🥘", "Bò Sốt Vang Bánh Mì"),
    raumuong: makeFoodSvg("#15803d", "🥬", "Rau Muống Xào Tỏi"),
    canhngao: makeFoodSvg("#0e7490", "🥣", "Canh Ngao Nấu Chua"),
    chaoyendinh: makeFoodSvg("#a16207", "🥣", "Cháo Dinh Dưỡng"),
    trungchien: makeFoodSvg("#d97706", "🍳", "Trứng Cuộn Ngũ Sắc"),
    phobo: makeFoodSvg("#991b1b", "🍜", "Phở Bò Gia Truyền"),
    chebuoi: makeFoodSvg("#4338ca", "🍧", "Chè Bưởi An Giang")
  };

  // Dữ liệu mẫu chuẩn vị gia đình Việt Nam
  const DEFAULT_RECIPES = [
    {
      id: "rec_thitkho",
      title: "Thịt Kho Tàu Nước Dừa",
      category: "main",
      author: "Mẹ",
      cookTime: 45,
      prepTime: 20,
      servings: 4,
      difficulty: "medium",
      isFavorite: true,
      coverImage: PRESET_COVERS.thitkho,
      ingredients: [
        { name: "Thịt ba chỉ rút sườn", amount: "500", unit: "g" },
        { name: "Trứng vịt luộc", amount: "5", unit: "quả" },
        { name: "Nước dừa xiêm tươi", amount: "1", unit: "trái" },
        { name: "Hành tím & tỏi băm", amount: "2", unit: "thìa" },
        { name: "Nước mắm truyền thống", amount: "3", unit: "thìa canh" },
        { name: "Đường thốt nốt / đường cát", amount: "2", unit: "thìa" }
      ],
      steps: [
        { stepNumber: 1, instruction: "Thịt cạo sạch bì, thái miếng vuông to 4x4cm. Chần qua nước sôi gừng để khử mùi." },
        { stepNumber: 2, instruction: "Ướp thịt với hành tỏi băm, đường, hạt nêm trong 30 phút cho mỡ trong." },
        { stepNumber: 3, instruction: "Thắng nước màu đường cánh gián, cho thịt vào đảo săn đều các mặt." },
        { stepNumber: 4, instruction: "Đổ nước dừa tươi ngập thịt, đun sôi bùng vớt bọt, hạ lửa liu riu 30 phút." },
        { stepNumber: 5, instruction: "Cho trứng luộc vào kho cùng thêm 15 phút đến khi thịt mềm rục, nước sánh vàng óng." }
      ],
      secretTips: "Ướp đường trước khi cho nước mắm để mỡ thịt trong veo, giòn ngọt. Trong lúc kho không đậy nắp kín để nước dừa trong và màu lên đẹp tự nhiên.",
      notes: "Cả nhà đều thích ăn kèm dưa cải chua hoặc củ kiệu ngâm chua ngọt.",
      createdAt: Date.now() - 86400000 * 5,
      updatedAt: Date.now()
    },
    {
      id: "rec_canhchua",
      title: "Canh Chua Cá Lóc Nam Bộ",
      category: "soup",
      author: "Bà Nội",
      cookTime: 25,
      prepTime: 15,
      servings: 4,
      difficulty: "easy",
      isFavorite: true,
      coverImage: PRESET_COVERS.canhchua,
      ingredients: [
        { name: "Cá lóc đồng", amount: "1", unit: "con (600g)" },
        { name: "Thơm (dứa)", amount: "1/4", unit: "trái" },
        { name: "Cà chua", amount: "2", unit: "trái" },
        { name: "Đậu bắp, bạc hà, giá đỗ", amount: "150", unit: "g" },
        { name: "Nước cốt me chua", amount: "3", unit: "thìa canh" },
        { name: "Rau ngò ôm, ngò gai", amount: "1", unit: "nắm nhỏ" }
      ],
      steps: [
        { stepNumber: 1, instruction: "Cá lóc làm sạch nhớt bằng muối và chanh, cắt khúc vừa ăn." },
        { stepNumber: 2, instruction: "Phi thơm tỏi băm, xào sơ cà chua và thơm cho lên màu đẹp." },
        { stepNumber: 3, instruction: "Đổ 1 lít nước vào đun sôi, cho nước cốt me và thả cá vào nấu chín tới (khoảng 7 phút)." },
        { stepNumber: 4, instruction: "Cho đậu bắp, bạc hà, giá đỗ vào nấu sôi lại, nêm đường, nước mắm vừa vị chua ngọt thanh." },
        { stepNumber: 5, instruction: "Tắt bếp, rắc ngò ôm, ngò gai cắt nhỏ và tỏi phi vàng lên trên." }
      ],
      secretTips: "Phi thật nhiều tỏi để rắc lên mặt canh chua giúp dậy mùi thơm nức mũi và khử hoàn toàn mùi tanh của cá.",
      notes: "Món tủ ngày hè giải nhiệt cực tốt cho cả nhà.",
      createdAt: Date.now() - 86400000 * 4,
      updatedAt: Date.now()
    },
    {
      id: "rec_suonchua",
      title: "Sườn Xào Chua Ngọt Đậm Vị",
      category: "main",
      author: "Bố",
      cookTime: 30,
      prepTime: 15,
      servings: 4,
      difficulty: "medium",
      isFavorite: false,
      coverImage: PRESET_COVERS.suonchua,
      ingredients: [
        { name: "Sườn non tươi", amount: "500", unit: "g" },
        { name: "Cà chua chín", amount: "2", unit: "quả" },
        { name: "Hành tây", amount: "1/2", unit: "củ" },
        { name: "Giấm gạo / Chanh", amount: "2", unit: "thìa" },
        { name: "Đường, tương ớt, nước mắm", amount: "2", unit: "thìa mỗi loại" }
      ],
      steps: [
        { stepNumber: 1, instruction: "Sườn chặt khúc vừa ăn, chần qua nước sôi rồi ướp chút hạt nêm, tiêu." },
        { stepNumber: 2, instruction: "Rán sườn vàng đều 2 mặt với lửa vừa, vớt ra để ráo dầu." },
        { stepNumber: 3, instruction: "Pha sốt chua ngọt: 2 thìa giấm + 2 thìa đường + 2 thìa mắm + 1 thìa tương ớt + 3 thìa nước lọc." },
        { stepNumber: 4, instruction: "Phi thơm hành tỏi, đảo cà chua nát thành sốt sệt, đổ sườn và nước sốt vào rim nhỏ lửa cho thấm đều." },
        { stepNumber: 5, instruction: "Khi nước sốt sánh kẹo lại bọc quanh miếng sườn thì rắc hành tây xắt múi cau, tắt bếp." }
      ],
      secretTips: "Không rán sườn quá khô kẻo thịt bị dai cứng, sốt pha sẵn theo tỷ lệ 2 đường : 2 chua : 2 mặn là chuẩn nhất.",
      notes: "Món ruột của Bé Bo, mỗi lần nấu là vét sạch nồi cơm!",
      createdAt: Date.now() - 86400000 * 3,
      updatedAt: Date.now()
    },
    {
      id: "rec_raumuong",
      title: "Rau Muống Xào Tỏi Xanh Giòn",
      category: "veggie",
      author: "Mẹ",
      cookTime: 10,
      prepTime: 10,
      servings: 4,
      difficulty: "easy",
      isFavorite: true,
      coverImage: PRESET_COVERS.raumuong,
      ingredients: [
        { name: "Rau muống non", amount: "1", unit: "mớ (400g)" },
        { name: "Tỏi bắc đập dập", amount: "2", unit: "củ" },
        { name: "Dầu ăn", amount: "2", unit: "thìa canh" },
        { name: "Hạt nêm, nước mắm, tiêu", amount: "vừa đủ", unit: "" }
      ],
      steps: [
        { stepNumber: 1, instruction: "Rau muống nhặt khúc non, rửa sạch ngâm nước muối loãng rồi để ráo." },
        { stepNumber: 2, instruction: "Đun nồi nước sôi bùng với chút muối, chần nhanh rau trong 30 giây rồi vớt ra thau nước đá lạnh." },
        { stepNumber: 3, instruction: "Phi thơm 1/2 lượng tỏi với dầu ăn, bật lửa lớn hết cỡ cho rau muống vào đảo nhanh tay." },
        { stepNumber: 4, instruction: "Nêm hạt nêm, 1 chút nước mắm quanh thành chảo, cho nốt phần tỏi còn lại vào đảo đều rồi trút ra đĩa." }
      ],
      secretTips: "Chần rau qua nước sôi rồi ngâm ngay vào nước đá lạnh sẽ giúp rau giữ màu xanh mướt và độ giòn sần sật.",
      notes: "Món ăn kèm hoàn hảo cho bữa cơm có thịt kho hoặc cá kho.",
      createdAt: Date.now() - 86400000 * 2,
      updatedAt: Date.now()
    },
    {
      id: "rec_chaoyendinh",
      title: "Cháo Cá Hồi Bí Đỏ Dinh Dưỡng",
      category: "baby",
      author: "Mẹ",
      cookTime: 35,
      prepTime: 15,
      servings: 2,
      difficulty: "easy",
      isFavorite: false,
      coverImage: PRESET_COVERS.chaoyendinh,
      ingredients: [
        { name: "Phi lê cá hồi tươi", amount: "100", unit: "g" },
        { name: "Gạo tẻ thơm", amount: "50", unit: "g" },
        { name: "Bí đỏ ngọt", amount: "60", unit: "g" },
        { name: "Dầu ô liu / dầu mè", amount: "1", unit: "thìa cafe" },
        { name: "Hành củ tím băm nhỏ", amount: "1", unit: "củ" }
      ],
      steps: [
        { stepNumber: 1, instruction: "Gạo vo sạch, nấu cháo nhừ sánh. Bí đỏ gọt vỏ, hấp chín rồi tán nhuyễn." },
        { stepNumber: 2, instruction: "Cá hồi ngâm sữa tươi không đường 15 phút khử tanh, băm nhỏ hoặc thái hạt lựu." },
        { stepNumber: 3, instruction: "Phi thơm hành củ với dầu oliu, xào cá hồi chín tới." },
        { stepNumber: 4, instruction: "Cho bí đỏ tán nhuyễn và cá hồi vào nồi cháo đun sôi liu riu 5 phút cho hòa quyện." }
      ],
      secretTips: "Ngâm cá hồi trong sữa tươi không đường 15 phút giúp cá hết hẳn mùi tanh và thịt thơm béo hơn rất nhiều.",
      notes: "Rất bổ dưỡng cho bé ăn dặm hoặc ông bà khi mệt cần bồi bổ.",
      createdAt: Date.now() - 86400000,
      updatedAt: Date.now()
    }
  ];

  // Dữ liệu mẫu khẩu vị thành viên gia đình
  const DEFAULT_DIETARY = [
    {
      id: "diet_bo",
      memberName: "Bố",
      relation: "Chồng / Bố",
      avatar: "father",
      likes: ["Thịt kho tàu", "Bò sốt vang", "Canh chua", "Đồ xào cay"],
      dislikes: ["Mướp đắng", "Đồ ngọt béo nhiều sữa"],
      allergies: [],
      medicalRestrictions: ["Hạn chế mỡ động vật & phủ tạng (phòng mỡ máu)"],
      note: "Thích ăn cơm nóng sốt, thích vị đậm đà và có chút tiêu cay nồng.",
      updatedAt: Date.now()
    },
    {
      id: "diet_me",
      memberName: "Mẹ",
      relation: "Vợ / Mẹ",
      avatar: "mother",
      likes: ["Rau củ thanh đạm", "Cá hấp hành gừng", "Salad", "Trái cây"],
      dislikes: ["Thịt mỡ ngấy", "Nội tạng động vật"],
      allergies: ["Cua đồng", "Hải sản có vỏ cứng (Tôm càng, ghẹ)"],
      medicalRestrictions: ["Ăn nhạt bảo vệ tim mạch"],
      note: "Ăn hải sản có vỏ bị nổi mẩn ngứa ngay lập tức. Luôn ưu tiên nấu dầu thực vật.",
      updatedAt: Date.now()
    },
    {
      id: "diet_con",
      memberName: "Bé Bo",
      relation: "Con trai",
      avatar: "son",
      likes: ["Sườn xào chua ngọt", "Trứng cuộn", "Gà chiên giòn", "Canh bí đỏ"],
      dislikes: ["Hành lá", "Rau mùi", "Mướp hương"],
      allergies: ["Đậu phộng (Lạc)"],
      medicalRestrictions: ["Hạn chế đồ uống có gas"],
      note: "ĐẶC BIỆT LƯU Ý: Dị ứng đậu phộng/lạc! Khi xào nấu không rắc đậu phộng rang.",
      updatedAt: Date.now()
    },
    {
      id: "diet_ongba",
      memberName: "Bà Nội",
      relation: "Bà nội",
      avatar: "grandmother",
      likes: ["Cháo cá hồi", "Canh ngao nấu chua", "Đậu phụ sốt cà", "Rau luộc mềm"],
      dislikes: ["Thực phẩm quá cay", "Đồ cứng, dai"],
      allergies: [],
      medicalRestrictions: ["Hạn chế muối mặn (Huyết áp cao)", "Hạn chế đường"],
      note: "Thức ăn cần ninh mềm, cắt nhỏ dễ nhai nuốt. Nấu nhạt thanh.",
      updatedAt: Date.now()
    }
  ];

  // Bảng tra cứu tương khắc thực phẩm truyền thống trong gia đình
  const INCOMPATIBLE_FOODS = [
    { pair: "Mật ong + Đậu phụ", reason: "Chứa enzyme phản ứng gây tiêu chảy, đau bụng" },
    { pair: "Trứng ngỗng + Tỏi", reason: "Gây chướng bụng, khó tiêu và sinh khí độc" },
    { pair: "Cua biển + Quả hồng", reason: "Chất chát tanin kết tủa protein tạo sỏi đường ruột" },
    { pair: "Gan lợn + Giá đỗ", reason: "Kim loại trong gan làm oxy hóa phân hủy vitamin C" },
    { pair: "Thịt gà + Rau kinh giới", reason: "Theo y học cổ truyền dễ gây phong ngứa, chóng mặt" },
    { pair: "Thịt bò + Hạt dẻ", reason: "Giảm hấp thu sắt và làm chậm tiêu hóa" }
  ];

  // SVG Avatars cho thành viên khẩu vị
  const MEMBER_AVATARS = {
    father: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="50" fill="#2563eb"/><circle cx="50" cy="40" r="18" fill="#fde047"/><path d="M50 20c-10 0-16 6-16 15 0 2 1 4 2 6 3-1 7-2 14-2 8 0 12 1 14 2 1-2 2-4 2-6 0-9-6-15-16-15z" fill="#1e293b"/><path d="M24 82c3-16 13-24 26-24s23 8 26 24z" fill="#ffffff"/></svg>`),
    mother: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="50" fill="#ec4899"/><circle cx="50" cy="40" r="18" fill="#fed7aa"/><path d="M30 40c0-12 8-20 20-20s20 8 20 20c0 10-3 20-6 22-2-6-7-9-14-9s-12 3-14 9c-3-2-6-12-6-22z" fill="#471429"/><path d="M25 84c3-15 13-22 25-22s22 7 25 22z" fill="#ffffff"/></svg>`),
    son: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="50" fill="#0d9488"/><circle cx="50" cy="42" r="17" fill="#fef08a"/><path d="M34 35c0-8 7-15 16-15s16 7 16 15c0 1 0 2-1 2-2-1-7-2-15-2s-13 1-15 2c-1 0-1-1-1-2z" fill="#78350f"/><path d="M28 82c2-13 11-20 22-20s20 7 22 20z" fill="#ffffff"/></svg>`),
    daughter: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="50" fill="#8b5cf6"/><circle cx="50" cy="42" r="17" fill="#fde68a"/><path d="M32 42c0-8 6-16 18-16s18 8 18 16c0 6-1 12-4 14-2-4-6-6-14-6s-12 2-14 6c-2-2-4-8-4-14z" fill="#4c1d95"/><path d="M28 84c2-12 11-18 22-18s20 6 22 18z" fill="#ffffff"/></svg>`),
    grandfather: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="50" fill="#475569"/><circle cx="50" cy="40" r="18" fill="#fef3c7"/><path d="M32 30c0-6 8-12 18-12s18 6 18 12c0 1-3 1-5 0-3-2-8-3-13-3s-10 1-13 3c-2 1-5 1-5 0z" fill="#cbd5e1"/><path d="M25 84c3-15 13-22 25-22s22 7 25 22z" fill="#ffffff"/><circle cx="50" cy="42" r="3" fill="#94a3b8"/></svg>`),
    grandmother: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="50" fill="#7c3aed"/><circle cx="50" cy="40" r="18" fill="#fef3c7"/><circle cx="50" cy="20" r="8" fill="#cbd5e1"/><path d="M32 38c0-10 8-16 18-16s18 6 18 16c0 8-2 16-5 18-2-5-6-7-13-7s-11 2-13 7c-3-2-5-10-5-18z" fill="#94a3b8"/><path d="M25 84c3-15 13-22 25-22s22 7 25 22z" fill="#ffffff"/></svg>`)
  };

  // Toast notification
  function showCookbookToast(message, type = "success") {
    let toast = document.getElementById("cookbookToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "cookbookToast";
      toast.className = "fc-toast";
      document.body.appendChild(toast);
    }
    const iconClass = type === "error" ? "fi fi-rr-cross-circle" : type === "info" ? "fi fi-rr-info" : "fi fi-rr-check-circle";
    toast.className = `fc-toast ${type} show`;
    toast.innerHTML = `<i class="${iconClass}"></i><span>${message}</span>`;
    setTimeout(() => {
      toast.classList.remove("show");
    }, 2800);
  }

  // LocalStorage Helpers
  function getStorageKey(subKey) {
    return `familyCookbook_${activeProfileKey}_${subKey}`;
  }

  function loadFromLocalStorage() {
    try {
      const storedRecipes = localStorage.getItem(getStorageKey("recipes"));
      if (storedRecipes) {
        recipesCache = JSON.parse(storedRecipes);
      } else {
        recipesCache = [...DEFAULT_RECIPES];
        saveRecipesToLocalStorage();
      }

      const storedDietary = localStorage.getItem(getStorageKey("dietary"));
      if (storedDietary) {
        dietaryCache = JSON.parse(storedDietary);
      } else {
        dietaryCache = [...DEFAULT_DIETARY];
        saveDietaryToLocalStorage();
      }

      const storedCalendarMeals = localStorage.getItem(getStorageKey("calendarMeals"));
      if (storedCalendarMeals) {
        calendarMealsCache = JSON.parse(storedCalendarMeals);
      } else {
        calendarMealsCache = {};
      }
    } catch (e) {
      console.error("[FamilyCookbook] Lỗi đọc LocalStorage:", e);
      recipesCache = [...DEFAULT_RECIPES];
      dietaryCache = [...DEFAULT_DIETARY];
      calendarMealsCache = {};
    }
  }

  function saveRecipesToLocalStorage() {
    try {
      localStorage.setItem(getStorageKey("recipes"), JSON.stringify(recipesCache));
    } catch (e) {
      console.warn("[FamilyCookbook] Không thể ghi LocalStorage:", e);
    }
  }

  function saveDietaryToLocalStorage() {
    try {
      localStorage.setItem(getStorageKey("dietary"), JSON.stringify(dietaryCache));
    } catch (e) {
      console.warn("[FamilyCookbook] Không thể ghi LocalStorage:", e);
    }
  }

  function saveCalendarMealsToLocalStorage() {
    try {
      localStorage.setItem(getStorageKey("calendarMeals"), JSON.stringify(calendarMealsCache));
    } catch (e) {
      console.warn("[FamilyCookbook] Không thể ghi LocalStorage calendarMeals:", e);
    }
  }

  function saveCalendarMealsToFirebase() {
    if (!firebaseCalendarMealsRef) return;
    firebaseCalendarMealsRef.set(calendarMealsCache).catch((err) => {
      console.warn("[FamilyCookbook] Lỗi ghi Firebase calendarMeals:", err);
    });
  }

  // Firebase Realtime DB Sync
  function initCookbookFirebase(firebaseDb, profileKey) {
    if (!firebaseDb || !profileKey) return;
    firebaseDbInstance = firebaseDb;
    activeProfileKey = profileKey || "default";

    // Load local first for instant render
    loadFromLocalStorage();

    // Firebase refs
    firebaseRecipesRef = firebaseDb.ref(`familyCookbook/${activeProfileKey}/recipes`);
    firebaseDietaryRef = firebaseDb.ref(`familyCookbook/${activeProfileKey}/dietaryNotes`);
    firebaseCalendarMealsRef = firebaseDb.ref(`familyCookbook/${activeProfileKey}/calendarMeals`);

    // Listen to recipes
    firebaseRecipesRef.on("value", (snapshot) => {
      const data = snapshot.val();
      if (data) {
        recipesCache = Object.values(data);
      } else {
        // First time initialization in Firebase: save defaults
        saveRecipesToFirebase();
      }
      saveRecipesToLocalStorage();
      renderCookbookContent();
    });

    // Listen to dietary
    firebaseDietaryRef.on("value", (snapshot) => {
      const data = snapshot.val();
      if (data) {
        dietaryCache = Object.values(data);
      } else {
        // First time initialization in Firebase: save defaults
        saveDietaryToFirebase();
      }
      saveDietaryToLocalStorage();
      renderCookbookContent();
    });

    // Listen to calendar meals
    firebaseCalendarMealsRef.on("value", (snapshot) => {
      const data = snapshot.val();
      if (data && typeof data === "object") {
        calendarMealsCache = data;
      } else {
        calendarMealsCache = {};
      }
      saveCalendarMealsToLocalStorage();
      if (typeof window.renderCalendar === "function") {
        window.renderCalendar();
      }
      if (typeof window.renderTodayEvents === "function") {
        window.renderTodayEvents();
      }
    });
  }

  function saveRecipesToFirebase() {
    if (!firebaseRecipesRef) return;
    const map = {};
    recipesCache.forEach((rec) => {
      map[rec.id] = rec;
    });
    firebaseRecipesRef.set(map).catch((err) => {
      console.warn("[FamilyCookbook] Lỗi ghi Firebase recipes:", err);
    });
  }

  function saveDietaryToFirebase() {
    if (!firebaseDietaryRef) return;
    const map = {};
    dietaryCache.forEach((mem) => {
      map[mem.id] = mem;
    });
    firebaseDietaryRef.set(map).catch((err) => {
      console.warn("[FamilyCookbook] Lỗi ghi Firebase dietary:", err);
    });
  }

  // Check if a recipe contains any allergy of family members (removed with dietary tab)
  function checkRecipeAllergies(recipe) {
    return [];
  }

  // Category labels and icons
  const CATEGORIES = {
    all: { label: "Tất cả", icon: "fi fi-rr-apps" },
    main: { label: "Món Mặn", icon: "fi fi-rr-meat" },
    soup: { label: "Canh & Súp", icon: "fi fi-rr-soup" },
    veggie: { label: "Rau & Xào", icon: "fi fi-rr-salad" },
    breakfast: { label: "Bữa Sáng", icon: "fi fi-rr-bread" },
    baby: { label: "Ăn Dặm / Cho Bé", icon: "fi fi-rr-baby-carriage" },
    senior: { label: "Dưỡng Sinh", icon: "fi fi-rr-heart" }
  };

  function removeVietnameseTones(str) {
    if (!str) return "";
    return str
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLowerCase();
  }

  // RENDERERS
  function renderCookbookContent() {
    updateHeaderBadge();
    if (currentTab === "mealplan") {
      renderMealPlanTab();
    } else {
      renderRecipesTab();
    }
  }

  function updateHeaderBadge() {
    const badge = document.getElementById("fcTotalBadge");
    if (badge) {
      badge.textContent = `${recipesCache.length} món ruột`;
    }
  }

  function renderRecipesTab() {
    const container = document.getElementById("fcTabContent");
    if (!container) return;

    let filtered = recipesCache.filter((rec) => {
      if (currentCategory !== "all" && rec.category !== currentCategory) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        const noToneQ = removeVietnameseTones(q);
        const matchTitle = rec.title && (rec.title.toLowerCase().includes(q) || removeVietnameseTones(rec.title).includes(noToneQ));
        const matchAuthor = rec.author && (rec.author.toLowerCase().includes(q) || removeVietnameseTones(rec.author).includes(noToneQ));
        const matchIng = (rec.ingredients || []).some((i) => {
          const n = i.name || "";
          return n.toLowerCase().includes(q) || removeVietnameseTones(n).includes(noToneQ);
        });
        if (!matchTitle && !matchAuthor && !matchIng) return false;
      }
      return true;
    });

    let catFilterHtml = Object.keys(CATEGORIES)
      .map((catKey) => {
        const activeClass = currentCategory === catKey ? "active" : "";
        return `<button type="button" class="fc-cat-pill ${activeClass}" onclick="window.setCookbookCategory('${catKey}')">
          <i class="${CATEGORIES[catKey].icon}"></i>
          <span>${CATEGORIES[catKey].label}</span>
        </button>`;
      })
      .join("");

    let cardsHtml = "";
    if (filtered.length === 0) {
      cardsHtml = `
        <div class="fc-empty-state" style="grid-column: 1 / -1;">
          <div class="fc-empty-icon"><i class="fi fi-rr-search-alt"></i></div>
          <div class="fc-empty-title">Chưa tìm thấy món ăn phù hợp</div>
          <div class="fc-empty-desc">Hãy thử tìm với từ khóa khác hoặc bấm "+ Thêm Món Mới" để ghi lại bí kíp gia đình nhé!</div>
          <button type="button" class="fc-btn fc-btn-primary" onclick="window.openCookbookRecipeFormModal()">
            <i class="fi fi-rr-plus"></i> Thêm Món Ngay
          </button>
        </div>
      `;
    } else {
      cardsHtml = filtered
        .map((rec) => {
          const allergyAlerts = checkRecipeAllergies(rec);
          const allergyBadge = allergyAlerts.length > 0
            ? `<div class="fc-card-allergy-alert" title="${allergyAlerts.map((a) => `${a.memberName} dị ứng ${a.allergy}`).join(', ')}">
                <i class="fi fi-rr-exclamation"></i>
                <span>Cảnh báo dị ứng: ${allergyAlerts[0].memberName}</span>
              </div>`
            : "";

          const catLabel = CATEGORIES[rec.category]?.label || "Món ăn";
          const favClass = rec.isFavorite ? "active" : "";
          const cardFavClass = rec.isFavorite ? "is-favorite" : "";

          return `
            <div class="fc-recipe-card ${cardFavClass}" onclick="window.openCookbookRecipeDetail('${rec.id}')">
              <div class="fc-card-cover">
                <img src="${rec.coverImage || PRESET_COVERS.thitkho}" alt="${rec.title}" loading="lazy" />
                <span class="fc-card-category-badge">${catLabel}</span>
                <button type="button" class="fc-card-fav-btn ${favClass}" onclick="event.stopPropagation(); window.toggleFavoriteRecipe('${rec.id}')" title="${rec.isFavorite ? "Bỏ đánh dấu sao" : "Đánh dấu sao"}">
                  <i class="fi fi-sr-star"></i>
                </button>
              </div>
              <div class="fc-card-body">
                <h4 class="fc-card-title">${rec.title}</h4>
                <div class="fc-card-author-row">
                  <span class="fc-card-author"><i class="fi fi-rr-hat-chef"></i> ${rec.author || "Gia đình"}</span>
                  <span>${rec.ingredients ? rec.ingredients.length : 0} nguyên liệu</span>
                </div>
                ${allergyBadge}
                <div class="fc-card-meta">
                  <div class="fc-meta-item"><i class="fi fi-rr-clock"></i> ${rec.cookTime || 30} phút</div>
                  <div class="fc-meta-item"><i class="fi fi-rr-users-alt"></i> ${rec.servings || 4} người</div>
                  <div class="fc-meta-item"><i class="fi fi-rr-flame"></i> ${rec.difficulty === "hard" ? "Khó" : rec.difficulty === "medium" ? "Vừa" : "Dễ"}</div>
                </div>
              </div>
            </div>
          `;
        })
        .join("");
    }

    const existingToolbar = container.querySelector(".fc-toolbar");
    const existingFilters = container.querySelector(".fc-category-filters");
    const existingGrid = container.querySelector(".fc-recipe-grid");

    if (existingToolbar && existingFilters && existingGrid) {
      existingGrid.innerHTML = cardsHtml;
      existingFilters.innerHTML = catFilterHtml;
      return;
    }

    container.innerHTML = `
      <div class="fc-toolbar">
        <div class="fc-category-filters">
          ${catFilterHtml}
        </div>
      </div>

      <div class="fc-recipe-grid">
        ${cardsHtml}
      </div>
    `;
  }

  function renderDietaryTab() {
    const container = document.getElementById("fcTabContent");
    if (!container) return;

    let memberCardsHtml = dietaryCache
      .map((member) => {
        const likesHtml = (member.likes || []).map((l) => `<span class="fc-tag fc-tag-like"><i class="fi fi-rr-heart"></i> ${l}</span>`).join("");
        const dislikesHtml = (member.dislikes || []).map((d) => `<span class="fc-tag fc-tag-dislike"><i class="fi fi-rr-cross-small"></i> ${d}</span>`).join("");
        const allergiesHtml = (member.allergies || []).map((a) => `<span class="fc-tag fc-tag-allergy"><i class="fi fi-rr-shield-exclamation"></i> ${a}</span>`).join("");
        const restrictionsHtml = (member.medicalRestrictions || []).map((r) => `<span class="fc-tag fc-tag-medical"><i class="fi fi-rr-stethoscope"></i> ${r}</span>`).join("");

        const avatarImg = MEMBER_AVATARS[member.avatar] || MEMBER_AVATARS.father;

        return `
          <div class="fc-member-card">
            <div class="fc-member-top">
              <div class="fc-member-avatar">
                <img src="${avatarImg}" alt="${member.memberName}" />
              </div>
              <div class="fc-member-info">
                <h4 class="fc-member-name">${member.memberName}</h4>
                <div class="fc-member-relation">${member.relation || "Thành viên"}</div>
              </div>
              <div class="fc-member-actions">
                <button type="button" class="fc-member-icon-btn" onclick="window.openDietaryFormModal('${member.id}')" title="Chỉnh sửa">
                  <i class="fi fi-rr-edit"></i>
                </button>
                <button type="button" class="fc-member-icon-btn" onclick="window.deleteDietaryMember('${member.id}')" title="Xóa">
                  <i class="fi fi-rr-trash"></i>
                </button>
              </div>
            </div>

            ${allergiesHtml ? `
              <div class="fc-member-section">
                <div class="fc-member-sec-title" style="color: #fca5a5;"><i class="fi fi-rr-shield-exclamation"></i> Dị ứng nguy hiểm:</div>
                <div class="fc-tags-row">${allergiesHtml}</div>
              </div>
            ` : ""}

            ${restrictionsHtml ? `
              <div class="fc-member-section">
                <div class="fc-member-sec-title"><i class="fi fi-rr-stethoscope"></i> Kiêng khem y tế:</div>
                <div class="fc-tags-row">${restrictionsHtml}</div>
              </div>
            ` : ""}

            ${likesHtml ? `
              <div class="fc-member-section">
                <div class="fc-member-sec-title"><i class="fi fi-rr-smile"></i> Món khoái khẩu:</div>
                <div class="fc-tags-row">${likesHtml}</div>
              </div>
            ` : ""}

            ${dislikesHtml ? `
              <div class="fc-member-section">
                <div class="fc-member-sec-title"><i class="fi fi-rr-frown"></i> Không ăn được / Ghét:</div>
                <div class="fc-tags-row">${dislikesHtml}</div>
              </div>
            ` : ""}

            ${member.note ? `
              <div style="font-size: 0.8rem; color: var(--fc-text-secondary); background: rgba(0,0,0,0.2); padding: 8px 10px; border-radius: 8px; border-left: 3px solid var(--fc-primary);">
                ${member.note}
              </div>
            ` : ""}
          </div>
        `;
      })
      .join("");

    let incompatHtml = INCOMPATIBLE_FOODS.map((item) => `
      <div class="fc-incompat-card">
        <div class="fc-incompat-pair"><i class="fi fi-rr-cross-circle"></i> ${item.pair}</div>
        <div class="fc-incompat-reason">${item.reason}</div>
      </div>
    `).join("");

    container.innerHTML = `
      <div class="fc-dietary-header">
        <div>
          <h3 style="margin: 0; color: #fff; font-size: 1.15rem;"><i class="fi fi-rr-users"></i> Danh Bạ Khẩu Vị Gia Đình</h3>
          <div style="font-size: 0.84rem; color: var(--fc-text-secondary); margin-top: 4px;">
            Ghi nhớ chi tiết để mâm cơm gia đình vừa hợp khẩu vị, vừa an toàn tuyệt đối cho mọi người.
          </div>
        </div>
        <button type="button" class="fc-btn fc-btn-primary" onclick="window.openDietaryFormModal()">
          <i class="fi fi-rr-user-add"></i> Thêm Thành Viên
        </button>
      </div>

      <div class="fc-dietary-grid">
        ${memberCardsHtml}
      </div>

      <div class="fc-incompat-box">
        <div class="fc-incompat-title">
          <i class="fi fi-rr-shield-check"></i> Cẩm Nang 6 Cặp Thực Phẩm Tương Khắc (Cần Tránh Trong Gian Bếp)
        </div>
        <div class="fc-incompat-grid">
          ${incompatHtml}
        </div>
      </div>
    `;
  }

  // Meal Plan State
  let currentSuggestedMeal = null;

  function generateSmartMealPlan() {
    const mains = recipesCache.filter((r) => r.category === "main");
    const soups = recipesCache.filter((r) => r.category === "soup");
    const veggies = recipesCache.filter((r) => r.category === "veggie");

    const pickRandom = (arr) => (arr.length ? arr[Math.floor(Math.random() * arr.length)] : null);

    currentSuggestedMeal = {
      main: pickRandom(mains.length ? mains : recipesCache),
      soup: pickRandom(soups.length ? soups : recipesCache),
      veggie: pickRandom(veggies.length ? veggies : recipesCache)
    };
    renderMealPlanTab();
  }

  function renderMealPlanTab() {
    const container = document.getElementById("fcTabContent");
    if (!container) return;

    if (!currentSuggestedMeal) {
      generateSmartMealPlan();
      return;
    }

    const { main, soup, veggie } = currentSuggestedMeal;

    const renderSlot = (slotType, recipe, icon, label) => {
      if (!recipe) {
        return `
          <div class="fc-mealplan-slot-card">
            <div class="fc-mealplan-slot-type"><i class="${icon}"></i> ${label}</div>
            <div style="color: var(--fc-text-muted); font-size: 0.85rem; padding: 20px 0;">Chưa có món trong danh mục này</div>
          </div>
        `;
      }
      return `
        <div class="fc-mealplan-slot-card">
          <div class="fc-mealplan-slot-type"><i class="${icon}"></i> ${label}</div>
          <div style="height: 120px; border-radius: 8px; overflow: hidden; margin-top: 4px;">
            <img src="${recipe.coverImage}" alt="${recipe.title}" style="width: 100%; height: 100%; object-fit: cover;" />
          </div>
          <h4 style="margin: 6px 0 2px 0; color: #fff; font-size: 1rem;">${recipe.title}</h4>
          <div style="font-size: 0.8rem; color: #fbbf24;"><i class="fi fi-rr-hat-chef"></i> ${recipe.author || "Gia đình"}</div>
          <div style="display: flex; gap: 10px; font-size: 0.76rem; color: var(--fc-text-muted); margin-top: 4px;">
            <span><i class="fi fi-rr-clock"></i> ${recipe.cookTime || 30}p</span>
            <span><i class="fi fi-rr-users-alt"></i> ${recipe.servings || 4} người</span>
          </div>
          <div style="margin-top: 10px; display: flex; gap: 8px;">
            <button type="button" class="fc-btn fc-btn-secondary" style="flex: 1; padding: 6px 10px; font-size: 0.8rem;" onclick="window.openCookbookRecipeDetail('${recipe.id}')">
              Xem Chi Tiết
            </button>
            <button type="button" class="fc-btn fc-btn-secondary" style="padding: 6px 10px; font-size: 0.8rem;" onclick="window.rerollMealSlot('${slotType}')" title="Đổi món khác">
              <i class="fi fi-rr-refresh"></i>
            </button>
          </div>
        </div>
      `;
    };

    container.innerHTML = `
      <div class="fc-mealplan-actions" style="display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 14px; flex-wrap: wrap;">
        <button type="button" class="fc-btn fc-btn-primary" onclick="window.generateSmartMealPlan()">
          <i class="fi fi-rr-refresh"></i> <span>Gợi Ý Mâm Khác</span>
        </button>
        <button type="button" class="fc-btn fc-btn-mealplan fc-assign-mealplan-btn" onclick="window.openAssignMealToCalendarModal('mealplan')" title="Gán mâm cơm này vào lịch">
          <i class="fi fi-rr-calendar-plus"></i> <span>Gán Mâm Cơm Vào Lịch</span>
        </button>
      </div>

      <div class="fc-mealplan-container">
        <div class="fc-mealplan-slots">
          ${renderSlot("main", main, "fi fi-rr-meat", "1. Món Mặn Chính")}
          ${renderSlot("soup", soup, "fi fi-rr-soup", "2. Món Canh / Súp")}
          ${renderSlot("veggie", veggie, "fi fi-rr-salad", "3. Món Rau / Phụ")}
        </div>
      </div>
    `;
  }

  // COOKING DETAIL MODAL
  function openCookbookRecipeDetail(recipeId) {
    const rec = recipesCache.find((r) => r.id === recipeId);
    if (!rec) return;
    viewingRecipeId = recipeId;

    const modal = document.getElementById("cookbookRecipeDetailModal");
    if (!modal) return;

    const allergyAlerts = checkRecipeAllergies(rec);
    const allergyHtml = allergyAlerts.length > 0
      ? `<div style="margin: 14px 0; padding: 12px 16px; border-radius: 12px; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.35); color: #fca5a5; display: flex; gap: 10px; align-items: center;">
          <i class="fi fi-rr-shield-exclamation" style="font-size: 20px;"></i>
          <div>
            <strong>Lưu ý dị ứng trong gia đình:</strong>
            ${allergyAlerts.map((a) => `<div>• <b>${a.memberName}</b> dị ứng với thành phần <i>"${a.allergy}"</i> (trùng từ khóa '${a.matchedWord}')</div>`).join("")}
          </div>
        </div>`
      : "";

    const ingredientsHtml = (rec.ingredients || [])
      .map((ing, idx) => `
        <div class="fc-check-item" id="ing_check_${idx}" onclick="this.classList.toggle('done')">
          <div class="fc-check-box"><i class="fi fi-rr-check"></i></div>
          <span style="font-weight: 500; flex: 1;">${ing.name}</span>
          <span style="color: #fbbf24; font-weight: 600;">${ing.amount} ${ing.unit || ""}</span>
        </div>
      `)
      .join("");

    const stepsHtml = (rec.steps || [])
      .map((step, idx) => `
        <div class="fc-step-card" id="step_card_${idx}">
          <div class="fc-step-num">${step.stepNumber || idx + 1}</div>
          <div style="flex: 1;">
            <div class="fc-step-text">${step.instruction}</div>
            ${step.tip ? `<div style="font-size: 0.78rem; color: #fbbf24; margin-top: 4px;"><i class="fi fi-rr-bulb"></i> Mẹo: ${step.tip}</div>` : ""}
          </div>
        </div>
      `)
      .join("");

    modal.innerHTML = `
      <div class="fc-modal-dialog fc-detail-dialog">
        <div class="fc-detail-hero">
          <img src="${rec.coverImage || PRESET_COVERS.thitkho}" alt="${rec.title}" />
          <div class="fc-detail-hero-overlay">
            <div style="display: flex; justify-content: flex-end; gap: 8px;">
              <button type="button" class="fc-btn-close fc-detail-fav-btn ${rec.isFavorite ? "active" : ""}" onclick="window.toggleFavoriteRecipe('${rec.id}')" title="${rec.isFavorite ? "Bỏ đánh dấu sao" : "Đánh dấu sao"}">
                <i class="fi fi-sr-star"></i>
              </button>
              <button type="button" class="fc-btn-close" onclick="window.closeCookbookRecipeDetail()" title="Đóng">
                <i class="fi fi-rr-cross"></i>
              </button>
            </div>
            <div>
              <h2 class="fc-detail-title">${rec.title} ${rec.isFavorite ? `<span style="color: #fbbf24; font-size: 1.15rem; vertical-align: middle;" title="Đã đánh dấu sao">⭐</span>` : ""}</h2>
              <div class="fc-detail-stat-row" style="margin-top: 8px;">
                <div class="fc-detail-badge"><i class="fi fi-rr-hat-chef" style="color: #fbbf24;"></i> ${rec.author || "Mẹ"}</div>
                <div class="fc-detail-badge"><i class="fi fi-rr-clock"></i> Nấu: ${rec.cookTime || 30} phút</div>
                <div class="fc-detail-badge"><i class="fi fi-rr-users-alt"></i> ${rec.servings || 4} phần ăn</div>
                <div class="fc-detail-badge"><i class="fi fi-rr-flame"></i> ${rec.difficulty === "hard" ? "Độ khó: Cao" : rec.difficulty === "medium" ? "Độ khó: Vừa" : "Dễ làm"}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="fc-body">
          ${allergyHtml}

          <div class="fc-detail-layout">
            <!-- Left: Ingredients -->
            <div>
              <div class="fc-sec-heading">
                <span><i class="fi fi-rr-shopping-basket"></i> Nguyên Liệu Cần Chuẩn Bị</span>
                <button type="button" class="fc-btn fc-btn-secondary" style="padding: 4px 10px; font-size: 0.76rem;" onclick="window.copyIngredientsToClipboard('${rec.id}')">
                  <i class="fi fi-rr-copy"></i> Copy gửi chợ
                </button>
              </div>
              <div class="fc-checklist">
                ${ingredientsHtml}
              </div>
            </div>

            <!-- Right: Steps & Tips -->
            <div style="display: flex; flex-direction: column; gap: 16px;">
              <div>
                <div class="fc-sec-heading">
                  <span><i class="fi fi-rr-list-check"></i> Các Bước Thực Hiện</span>
                </div>
                <div class="fc-steps-list">
                  ${stepsHtml}
                </div>
              </div>

              ${rec.secretTips ? `
                <div class="fc-secret-box">
                  <i class="fi fi-rr-bulb"></i>
                  <div>
                    <div class="fc-secret-title">Bí Kíp Gia Truyền</div>
                    <div class="fc-secret-desc">${rec.secretTips}</div>
                  </div>
                </div>
              ` : ""}

              ${rec.notes ? `
                <div style="font-size: 0.84rem; color: var(--fc-text-secondary); background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); padding: 12px; border-radius: 10px;">
                  <strong style="color: #93c5fd;"><i class="fi fi-rr-comment-alt-edit"></i> Ghi chú lần nấu trước:</strong>
                  <div style="margin-top: 4px;">${rec.notes}</div>
                </div>
              ` : ""}
            </div>
          </div>
        </div>

        <div class="fc-detail-footer">
          <button type="button" class="fc-btn fc-btn-secondary fc-detail-cal-btn" onclick="window.openAssignMealToCalendarModal('recipe', '${rec.id}')" title="Gán vào lịch">
            <i class="fi fi-rr-calendar-plus"></i> <span>Gán Vào Lịch</span>
          </button>
          <button type="button" class="fc-btn fc-btn-secondary fc-detail-edit-btn" onclick="window.editRecipe('${rec.id}')" title="Chỉnh sửa món">
            <i class="fi fi-rr-edit"></i> <span>Chỉnh Sửa</span>
          </button>
          <button type="button" class="fc-btn fc-btn-secondary fc-detail-delete-btn" style="color: #ef4444;" onclick="window.deleteRecipe('${rec.id}')" title="Xóa món">
            <i class="fi fi-rr-trash"></i> <span>Xóa Món</span>
          </button>
          <button type="button" class="fc-btn fc-btn-primary fc-detail-close-btn" onclick="window.closeCookbookRecipeDetail()" title="Đóng lại">
            <span>Đóng Lại</span>
          </button>
        </div>
      </div>
    `;

    modal.style.display = "flex";
    modal.classList.add("active");
  }

  function closeCookbookRecipeDetail() {
    const modal = document.getElementById("cookbookRecipeDetailModal");
    if (modal) {
      modal.style.display = "none";
      modal.classList.remove("active");
    }
  }

  function copyIngredientsToClipboard(recipeId) {
    const rec = recipesCache.find((r) => r.id === recipeId);
    if (!rec || !rec.ingredients) return;
    const text = `🛒 DANH SÁCH MUA ĐỒ NẤU: ${rec.title.toUpperCase()}\n` +
      rec.ingredients.map((i) => `• ${i.name}: ${i.amount} ${i.unit || ""}`).join("\n");
    navigator.clipboard.writeText(text).then(() => {
      showCookbookToast("Đã chép danh sách nguyên liệu vào bộ nhớ đệm!", "success");
    }).catch(() => {
      showCookbookToast("Không thể sao chép tự động", "error");
    });
  }

  // RECIPE FORM MODAL
  let tempIngredients = [];
  let tempSteps = [];
  let selectedCoverImage = "";

  function openCookbookRecipeFormModal(recipeId = null) {
    editingRecipeId = recipeId;
    const modal = document.getElementById("cookbookRecipeFormModal");
    if (!modal) return;

    let initial = {
      title: "",
      category: "main",
      author: "Mẹ",
      cookTime: 30,
      prepTime: 15,
      servings: 4,
      difficulty: "medium",
      coverImage: PRESET_COVERS.thitkho,
      secretTips: "",
      notes: ""
    };

    if (recipeId) {
      const found = recipesCache.find((r) => r.id === recipeId);
      if (found) {
        initial = { ...found };
        tempIngredients = JSON.parse(JSON.stringify(found.ingredients || []));
        tempSteps = JSON.parse(JSON.stringify(found.steps || []));
      }
    } else {
      tempIngredients = [
        { name: "", amount: "", unit: "" },
        { name: "", amount: "", unit: "" }
      ];
      tempSteps = [
        { stepNumber: 1, instruction: "" },
        { stepNumber: 2, instruction: "" }
      ];
    }
    selectedCoverImage = initial.coverImage || PRESET_COVERS.thitkho;

    renderRecipeFormContent(initial);
    modal.style.display = "flex";
    modal.classList.add("active");
  }

  function renderRecipeFormContent(data) {
    const modal = document.getElementById("cookbookRecipeFormModal");
    if (!modal) return;

    const presetKeys = Object.keys(PRESET_COVERS);
    const presetsHtml = presetKeys.map((key) => {
      const isSel = selectedCoverImage === PRESET_COVERS[key] ? "selected" : "";
      return `
        <div class="fc-image-picker-item ${isSel}" onclick="window.selectFormCoverPreset('${key}')">
          <img src="${PRESET_COVERS[key]}" alt="Preset" />
        </div>
      `;
    }).join("");

    modal.innerHTML = `
      <div class="fc-modal-dialog" style="max-width: 780px;">
        <div class="fc-header">
          <div class="fc-header-title-box">
            <div class="fc-header-icon"><i class="fi fi-rr-hat-chef"></i></div>
            <div class="fc-header-text">
              <h3 class="fc-header-title">${editingRecipeId ? "Chỉnh Sửa Bí Kíp" : "Thêm Bí Kíp Món Mới"}</h3>
              <div class="fc-header-sub">Lưu giữ công thức nấu ăn ruột của gia đình</div>
            </div>
          </div>
          <button type="button" class="fc-btn-close" onclick="window.closeCookbookRecipeFormModal()"><i class="fi fi-rr-cross"></i></button>
        </div>

        <form id="cookbookRecipeForm" onsubmit="window.saveRecipeForm(event)" class="fc-body">
          <div class="fc-form-group">
            <label class="fc-form-label">Tên món ăn (*)</label>
            <input type="text" class="fc-form-input" id="rfTitle" required placeholder="Ví dụ: Thịt kho tàu nước dừa, Canh ngao nấu chua..." value="${data.title || ""}" />
          </div>

          <div class="fc-form-row">
            <div class="fc-form-group">
              <label class="fc-form-label">Danh mục món</label>
              <select class="fc-form-select" id="rfCategory">
                <option value="main" ${data.category === "main" ? "selected" : ""}>Món Mặn Chính</option>
                <option value="soup" ${data.category === "soup" ? "selected" : ""}>Canh & Súp</option>
                <option value="veggie" ${data.category === "veggie" ? "selected" : ""}>Rau & Món Xào</option>
                <option value="breakfast" ${data.category === "breakfast" ? "selected" : ""}>Bữa Sáng</option>
                <option value="baby" ${data.category === "baby" ? "selected" : ""}>Ăn Dặm / Cho Bé</option>
                <option value="senior" ${data.category === "senior" ? "selected" : ""}>Dưỡng Sinh Cho Ông Bà</option>
              </select>
            </div>
            <div class="fc-form-group">
              <label class="fc-form-label">Bí kíp của ai? (Tác giả)</label>
              <input type="text" class="fc-form-input" id="rfAuthor" placeholder="Bí kíp của Mẹ, Món ruột của Bố..." value="${data.author || "Mẹ"}" />
            </div>
          </div>

          <div class="fc-form-row">
            <div class="fc-form-group">
              <label class="fc-form-label">Thời gian nấu (phút)</label>
              <input type="number" class="fc-form-input" id="rfCookTime" min="5" max="360" value="${data.cookTime || 30}" />
            </div>
            <div class="fc-form-group">
              <label class="fc-form-label">Khẩu phần (người ăn)</label>
              <input type="number" class="fc-form-input" id="rfServings" min="1" max="50" value="${data.servings || 4}" />
            </div>
          </div>

          <!-- Cover Image Selector -->
          <div class="fc-form-group">
            <label class="fc-form-label">Ảnh bìa món ăn</label>
            <div style="display: flex; gap: 14px; align-items: center;">
              <div style="width: 100px; height: 65px; border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,255,255,0.2); flex-shrink: 0;">
                <img id="rfCoverPreview" src="${selectedCoverImage}" alt="Cover" style="width: 100%; height: 100%; object-fit: cover;" />
              </div>
              <div style="flex: 1;">
                <input type="file" id="rfCoverUpload" accept="image/*" style="display: none;" onchange="window.onCoverImageUploaded(event)" />
                <button type="button" class="fc-btn fc-btn-secondary" style="padding: 6px 12px; font-size: 0.8rem;" onclick="document.getElementById('rfCoverUpload').click()">
                  <i class="fi fi-rr-upload"></i> Tải ảnh từ máy
                </button>
                <div style="font-size: 0.75rem; color: var(--fc-text-muted); margin-top: 4px;">Hoặc chọn nhanh từ mẫu có sẵn bên dưới:</div>
              </div>
            </div>
            <div class="fc-image-picker-grid">
              ${presetsHtml}
            </div>
          </div>

          <!-- Ingredients Editor -->
          <div class="fc-form-group">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <label class="fc-form-label">Danh sách nguyên liệu (*)</label>
              <button type="button" class="fc-btn fc-btn-secondary" style="padding: 4px 10px; font-size: 0.76rem;" onclick="window.addIngredientRow()">
                <i class="fi fi-rr-plus"></i> Thêm dòng
              </button>
            </div>
            <div id="rfIngredientsContainer">
              ${renderIngredientsInputs()}
            </div>
          </div>

          <!-- Steps Editor -->
          <div class="fc-form-group">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <label class="fc-form-label">Các bước thực hiện (*)</label>
              <button type="button" class="fc-btn fc-btn-secondary" style="padding: 4px 10px; font-size: 0.76rem;" onclick="window.addStepRow()">
                <i class="fi fi-rr-plus"></i> Thêm bước
              </button>
            </div>
            <div id="rfStepsContainer">
              ${renderStepsInputs()}
            </div>
          </div>

          <!-- Secret Tips -->
          <div class="fc-form-group">
            <label class="fc-form-label">Bí kíp gia truyền / Mẹo nấu ngon</label>
            <textarea class="fc-form-textarea" id="rfSecretTips" rows="2" placeholder="Ví dụ: Ướp đường trước cho mỡ trong, phi tỏi cháy cạnh...">${data.secretTips || ""}</textarea>
          </div>

          <!-- Notes -->
          <div class="fc-form-group">
            <label class="fc-form-label">Ghi chú rút kinh nghiệm lần sau</label>
            <textarea class="fc-form-textarea" id="rfNotes" rows="2" placeholder="Ví dụ: Lần sau bớt 1 thìa muối kẻo mặn...">${data.notes || ""}</textarea>
          </div>

          <div class="fc-header" style="padding: 14px 0 0 0; justify-content: flex-end; gap: 10px; background: transparent; border-top: 1px solid rgba(255,255,255,0.08);">
            <button type="button" class="fc-btn fc-btn-secondary" onclick="window.closeCookbookRecipeFormModal()">Hủy Bỏ</button>
            <button type="submit" class="fc-btn fc-btn-primary"><i class="fi fi-rr-disk"></i> Lưu Bí Kíp</button>
          </div>
        </form>
      </div>
    `;

    bindStepsDragDrop();
  }

  function renderIngredientsInputs() {
    return tempIngredients
      .map((ing, idx) => `
        <div class="fc-dynamic-row">
          <input type="text" class="fc-form-input" placeholder="Tên nguyên liệu" style="flex: 2;" value="${ing.name || ""}" oninput="window.updateIngredient(${idx}, 'name', this.value)" required />
          <input type="text" class="fc-form-input" placeholder="Số lượng" style="flex: 1;" value="${ing.amount || ""}" oninput="window.updateIngredient(${idx}, 'amount', this.value)" />
          <input type="text" class="fc-form-input" placeholder="Đơn vị (g, quả...)" style="flex: 1;" value="${ing.unit || ""}" oninput="window.updateIngredient(${idx}, 'unit', this.value)" />
          <button type="button" class="fc-dynamic-del-btn" onclick="window.removeIngredientRow(${idx})" title="Xóa dòng"><i class="fi fi-rr-trash"></i></button>
        </div>
      `)
      .join("");
  }

  function renderStepsInputs() {
    return tempSteps
      .map((step, idx) => `
        <div class="fc-dynamic-row fc-step-input-row" data-step-index="${idx}" style="align-items: flex-start;">
          <div class="fc-step-drag-handle" title="Kéo thả để đổi thứ tự bước">
            <i class="fi fi-rr-menu-dots-vertical"></i>
          </div>
          <div class="fc-step-num" style="margin-top: 6px;">${idx + 1}</div>
          <textarea class="fc-form-textarea" rows="2" placeholder="Mô tả chi tiết bước làm ${idx + 1}..." style="flex: 1;" oninput="window.updateStep(${idx}, this.value)" required>${step.instruction || ""}</textarea>
          <button type="button" class="fc-dynamic-del-btn" style="margin-top: 6px;" onclick="window.removeStepRow(${idx})" title="Xóa bước"><i class="fi fi-rr-trash"></i></button>
        </div>
      `)
      .join("");
  }

  function selectFormCoverPreset(key) {
    if (PRESET_COVERS[key]) {
      selectedCoverImage = PRESET_COVERS[key];
      const preview = document.getElementById("rfCoverPreview");
      if (preview) preview.src = selectedCoverImage;
      const items = document.querySelectorAll(".fc-image-picker-item");
      items.forEach((item) => item.classList.remove("selected"));
      if (event && event.currentTarget) event.currentTarget.classList.add("selected");
    }
  }

  function onCoverImageUploaded(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (evt) {
      selectedCoverImage = evt.target.result;
      const preview = document.getElementById("rfCoverPreview");
      if (preview) preview.src = selectedCoverImage;
      showCookbookToast("Đã tải ảnh lên thành công!", "success");
    };
    reader.readAsDataURL(file);
  }

  function saveRecipeForm(e) {
    e.preventDefault();
    const title = document.getElementById("rfTitle").value.trim();
    if (!title) return;

    const validIngs = tempIngredients.filter((i) => i.name.trim().length > 0);
    const validSteps = tempSteps
      .filter((s) => s.instruction.trim().length > 0)
      .map((s, idx) => ({ stepNumber: idx + 1, instruction: s.instruction.trim() }));

    if (validIngs.length === 0) {
      showCookbookToast("Vui lòng nhập ít nhất 1 nguyên liệu!", "error");
      return;
    }
    if (validSteps.length === 0) {
      showCookbookToast("Vui lòng nhập ít nhất 1 bước thực hiện!", "error");
      return;
    }

    const recData = {
      id: editingRecipeId || `rec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title,
      category: document.getElementById("rfCategory").value,
      author: document.getElementById("rfAuthor").value.trim() || "Gia đình",
      cookTime: Number(document.getElementById("rfCookTime").value) || 30,
      servings: Number(document.getElementById("rfServings").value) || 4,
      difficulty: "medium",
      coverImage: selectedCoverImage || PRESET_COVERS.thitkho,
      ingredients: validIngs,
      steps: validSteps,
      secretTips: document.getElementById("rfSecretTips").value.trim(),
      notes: document.getElementById("rfNotes").value.trim(),
      isFavorite: false,
      updatedAt: Date.now()
    };

    if (editingRecipeId) {
      const idx = recipesCache.findIndex((r) => r.id === editingRecipeId);
      if (idx !== -1) {
        recData.isFavorite = recipesCache[idx].isFavorite || false;
        recData.createdAt = recipesCache[idx].createdAt || Date.now();
        recipesCache[idx] = recData;
      }
      showCookbookToast(`Đã cập nhật món "${title}"`, "success");
    } else {
      recData.createdAt = Date.now();
      recipesCache.unshift(recData);
      showCookbookToast(`Đã thêm món "${title}" vào sổ tay!`, "success");
    }

    saveRecipesToLocalStorage();
    saveRecipesToFirebase();
    renderCookbookContent();
    closeCookbookRecipeFormModal();

    // If viewing recipe modal was open, refresh it
    if (viewingRecipeId === recData.id) {
      openCookbookRecipeDetail(recData.id);
    }
  }

  function deleteRecipe(recipeId) {
    if (!confirm("Bạn có chắc chắn muốn xóa món ăn này khỏi sổ tay gia đình?")) return;
    recipesCache = recipesCache.filter((r) => r.id !== recipeId);
    saveRecipesToLocalStorage();
    saveRecipesToFirebase();
    closeCookbookRecipeDetail();
    renderCookbookContent();
    showCookbookToast("Đã xóa món ăn khỏi sổ tay!", "info");
  }

  function toggleFavoriteRecipe(recipeId) {
    const rec = recipesCache.find((r) => r.id === recipeId);
    if (rec) {
      rec.isFavorite = !rec.isFavorite;
      saveRecipesToLocalStorage();
      saveRecipesToFirebase();
      renderCookbookContent();
      const detailModal = document.getElementById("cookbookRecipeDetailModal");
      if (detailModal && detailModal.classList.contains("active") && viewingRecipeId === recipeId) {
        openCookbookRecipeDetail(recipeId);
      }
      showCookbookToast(rec.isFavorite ? `Đã đánh dấu sao "${rec.title}" ⭐` : `Đã bỏ đánh dấu sao "${rec.title}"`, "info");
    }
  }

  // DIETARY FORM MODAL
  function openDietaryFormModal(memberId = null) {
    editingMemberId = memberId;
    const modal = document.getElementById("cookbookDietaryFormModal");
    if (!modal) return;

    let initial = {
      memberName: "",
      relation: "",
      avatar: "father",
      likes: "",
      dislikes: "",
      allergies: "",
      medicalRestrictions: "",
      note: ""
    };

    if (memberId) {
      const found = dietaryCache.find((m) => m.id === memberId);
      if (found) {
        initial = {
          memberName: found.memberName,
          relation: found.relation || "",
          avatar: found.avatar || "father",
          likes: (found.likes || []).join(", "),
          dislikes: (found.dislikes || []).join(", "),
          allergies: (found.allergies || []).join(", "),
          medicalRestrictions: (found.medicalRestrictions || []).join(", "),
          note: found.note || ""
        };
      }
    }

    const avatarKeys = Object.keys(MEMBER_AVATARS);
    const avatarsHtml = avatarKeys.map((k) => `
      <label style="cursor: pointer; text-align: center;">
        <input type="radio" name="dfAvatar" value="${k}" ${initial.avatar === k ? "checked" : ""} style="display: none;" onchange="window.onDietaryAvatarChange()" />
        <div class="fc-member-avatar" style="width: 48px; height: 48px; border: 2px solid ${initial.avatar === k ? 'var(--fc-primary)' : 'transparent'};">
          <img src="${MEMBER_AVATARS[k]}" alt="${k}" />
        </div>
      </label>
    `).join("");

    modal.innerHTML = `
      <div class="fc-modal-dialog" style="max-width: 580px;">
        <div class="fc-header">
          <div class="fc-header-title-box">
            <div class="fc-header-icon" style="background: linear-gradient(135deg, #0284c7 0%, #2563eb 100%);"><i class="fi fi-rr-user"></i></div>
            <div class="fc-header-text">
              <h3 class="fc-header-title">${editingMemberId ? "Sửa Khẩu Vị Thành Viên" : "Thêm Khẩu Vị Thành Viên"}</h3>
              <div class="fc-header-sub">Ghi nhớ sở thích và dị ứng cho an toàn bữa ăn</div>
            </div>
          </div>
          <button type="button" class="fc-btn-close" onclick="window.closeDietaryFormModal()"><i class="fi fi-rr-cross"></i></button>
        </div>

        <form id="cookbookDietaryForm" onsubmit="window.saveDietaryForm(event)" class="fc-body">
          <div class="fc-form-row">
            <div class="fc-form-group">
              <label class="fc-form-label">Tên thành viên (*)</label>
              <input type="text" class="fc-form-input" id="dfName" required placeholder="Bố, Mẹ, Bé Bo, Bà Nội..." value="${initial.memberName}" />
            </div>
            <div class="fc-form-group">
              <label class="fc-form-label">Vai vế trong nhà</label>
              <input type="text" class="fc-form-input" id="dfRelation" placeholder="Con trai, Vợ, Chồng, Ông..." value="${initial.relation}" />
            </div>
          </div>

          <div class="fc-form-group">
            <label class="fc-form-label">Chọn hình đại diện</label>
            <div id="dfAvatarSelector" style="display: flex; gap: 10px; align-items: center; padding: 6px 0;">
              ${avatarsHtml}
            </div>
          </div>

          <div class="fc-form-group">
            <label class="fc-form-label" style="color: #fca5a5;"><i class="fi fi-rr-shield-exclamation"></i> Dị ứng thực phẩm (Cách nhau bằng dấu phẩy)</label>
            <input type="text" class="fc-form-input" id="dfAllergies" placeholder="Ví dụ: Đậu phộng, Tôm cua, Hải sản có vỏ, Sữa bò..." value="${initial.allergies}" />
          </div>

          <div class="fc-form-group">
            <label class="fc-form-label" style="color: #fcd34d;"><i class="fi fi-rr-stethoscope"></i> Kiêng cữ sức khỏe / Bệnh lý</label>
            <input type="text" class="fc-form-input" id="dfRestrictions" placeholder="Ví dụ: Huyết áp cao (ăn nhạt), Tiểu đường (kiêng ngọt), Mỡ máu..." value="${initial.medicalRestrictions}" />
          </div>

          <div class="fc-form-group">
            <label class="fc-form-label"><i class="fi fi-rr-heart" style="color: #10b981;"></i> Món khoái khẩu</label>
            <input type="text" class="fc-form-input" id="dfLikes" placeholder="Ví dụ: Thịt kho, Canh chua, Đồ chiên giòn..." value="${initial.likes}" />
          </div>

          <div class="fc-form-group">
            <label class="fc-form-label"><i class="fi fi-rr-cross-small" style="color: #cbd5e1;"></i> Không thích ăn / Món ghét</label>
            <input type="text" class="fc-form-input" id="dfDislikes" placeholder="Ví dụ: Hành lá, Mướp đắng, Rau ngò..." value="${initial.dislikes}" />
          </div>

          <div class="fc-form-group">
            <label class="fc-form-label">Ghi chú thêm</label>
            <textarea class="fc-form-textarea" id="dfNote" rows="2" placeholder="Ví dụ: Thích đồ ăn mềm, ăn cay vừa...">${initial.note}</textarea>
          </div>

          <div class="fc-header" style="padding: 14px 0 0 0; justify-content: flex-end; gap: 10px; background: transparent; border-top: 1px solid rgba(255,255,255,0.08);">
            <button type="button" class="fc-btn fc-btn-secondary" onclick="window.closeDietaryFormModal()">Hủy Bỏ</button>
            <button type="submit" class="fc-btn fc-btn-primary"><i class="fi fi-rr-disk"></i> Lưu Hồ Sơ</button>
          </div>
        </form>
      </div>
    `;

    modal.style.display = "flex";
    modal.classList.add("active");
  }

  function closeDietaryFormModal() {
    const modal = document.getElementById("cookbookDietaryFormModal");
    if (modal) {
      modal.style.display = "none";
      modal.classList.remove("active");
    }
  }

  function onDietaryAvatarChange() {
    const radios = document.querySelectorAll("input[name='dfAvatar']");
    radios.forEach((r) => {
      const box = r.parentElement.querySelector(".fc-member-avatar");
      if (box) {
        box.style.borderColor = r.checked ? "var(--fc-primary)" : "transparent";
      }
    });
  }

  function saveDietaryForm(e) {
    e.preventDefault();
    const name = document.getElementById("dfName").value.trim();
    if (!name) return;

    const parseList = (val) =>
      val
        ? val
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
        : [];

    const selectedAvatarRadio = document.querySelector("input[name='dfAvatar']:checked");
    const avatar = selectedAvatarRadio ? selectedAvatarRadio.value : "father";

    const memData = {
      id: editingMemberId || `diet_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      memberName: name,
      relation: document.getElementById("dfRelation").value.trim(),
      avatar,
      allergies: parseList(document.getElementById("dfAllergies").value),
      medicalRestrictions: parseList(document.getElementById("dfRestrictions").value),
      likes: parseList(document.getElementById("dfLikes").value),
      dislikes: parseList(document.getElementById("dfDislikes").value),
      note: document.getElementById("dfNote").value.trim(),
      updatedAt: Date.now()
    };

    if (editingMemberId) {
      const idx = dietaryCache.findIndex((m) => m.id === editingMemberId);
      if (idx !== -1) dietaryCache[idx] = memData;
      showCookbookToast(`Đã cập nhật hồ sơ của ${name}`, "success");
    } else {
      dietaryCache.push(memData);
      showCookbookToast(`Đã thêm hồ sơ khẩu vị của ${name}`, "success");
    }

    saveDietaryToLocalStorage();
    saveDietaryToFirebase();
    renderCookbookContent();
    closeDietaryFormModal();
  }

  function deleteDietaryMember(memberId) {
    if (!confirm("Bạn có chắc muốn xóa thành viên này khỏi danh bạ khẩu vị?")) return;
    dietaryCache = dietaryCache.filter((m) => m.id !== memberId);
    saveDietaryToLocalStorage();
    saveDietaryToFirebase();
    renderCookbookContent();
    showCookbookToast("Đã xóa thành viên!", "info");
  }

  // GLOBAL WINDOW EXPORTS
  window.initCookbookFirebase = initCookbookFirebase;
  window.renderCookbookContent = renderCookbookContent;

  window.openFamilyCookbookModal = function () {
    if (typeof closeAllModals === "function") closeAllModals();
    closeCookbookHeaderSearch();
    const modal = document.getElementById("familyCookbookModal");
    if (modal) {
      modal.style.display = "flex";
      modal.classList.add("active");
      try {
        renderCookbookContent();
      } catch (err) {
        console.error("[FamilyCookbook] Lỗi render nội dung:", err);
      }
    }
  };

  window.closeFamilyCookbookModal = function () {
    const modal = document.getElementById("familyCookbookModal");
    if (modal) {
      modal.style.display = "none";
      modal.classList.remove("active");
    }
    closeCookbookHeaderSearch();
  };

  // HEADER SEARCH HELPERS & HANDLERS
  function openCookbookHeaderSearch() {
    if (currentTab !== "recipes") {
      window.switchCookbookTab("recipes");
    }
    const header = document.querySelector("#familyCookbookModal .fc-header");
    const searchBox = document.getElementById("fcHeaderSearchBox");
    const searchInput = document.getElementById("fcSearchInput");
    const titleBox = document.querySelector("#familyCookbookModal .fc-header-title-box");
    const btnSearch = document.getElementById("fcBtnHeaderSearch");

    if (header) header.classList.add("is-searching");
    if (titleBox) titleBox.style.display = "none";
    if (btnSearch) btnSearch.style.display = "none";
    if (searchBox) searchBox.style.display = "flex";

    if (searchInput) {
      searchInput.value = searchQuery || "";
      setTimeout(() => {
        searchInput.focus();
        searchInput.select();
      }, 50);
    }
  }

  function closeCookbookHeaderSearch() {
    const header = document.querySelector("#familyCookbookModal .fc-header");
    const searchBox = document.getElementById("fcHeaderSearchBox");
    const searchInput = document.getElementById("fcSearchInput");
    const titleBox = document.querySelector("#familyCookbookModal .fc-header-title-box");
    const btnSearch = document.getElementById("fcBtnHeaderSearch");

    if (header) header.classList.remove("is-searching");
    if (searchBox) searchBox.style.display = "none";
    if (titleBox) titleBox.style.display = "";
    if (btnSearch) btnSearch.style.display = "";

    if (searchInput) searchInput.value = "";
    if (searchQuery) {
      searchQuery = "";
      renderRecipesTab();
    }
  }

  function clearCookbookSearch() {
    const searchInput = document.getElementById("fcSearchInput");
    if (searchInput) {
      searchInput.value = "";
      searchInput.focus();
    }
    if (searchQuery) {
      searchQuery = "";
      renderRecipesTab();
    }
  }

  function toggleCookbookHeaderSearch() {
    const header = document.querySelector("#familyCookbookModal .fc-header");
    if (header && header.classList.contains("is-searching")) {
      closeCookbookHeaderSearch();
    } else {
      openCookbookHeaderSearch();
    }
  }

  function onCookbookSearchInput(val) {
    searchQuery = val || "";
    renderRecipesTab();
  }

  window.openCookbookHeaderSearch = openCookbookHeaderSearch;
  window.closeCookbookHeaderSearch = closeCookbookHeaderSearch;
  window.clearCookbookSearch = clearCookbookSearch;
  window.toggleCookbookHeaderSearch = toggleCookbookHeaderSearch;
  window.onCookbookSearchInput = onCookbookSearchInput;

  window.switchCookbookTab = function (tab) {
    if (tab === "dietary") tab = "recipes";
    currentTab = tab;
    document.querySelectorAll(".fc-tab-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tab);
    });
    renderCookbookContent();
  };

  window.setCookbookCategory = function (cat) {
    currentCategory = cat;
    renderRecipesTab();
  };

  window.toggleOnlyFavorites = function () {
    // Không còn dùng bộ lọc Món Ruột
    renderRecipesTab();
  };

  window.openCookbookRecipeDetail = openCookbookRecipeDetail;
  window.closeCookbookRecipeDetail = closeCookbookRecipeDetail;
  window.copyIngredientsToClipboard = copyIngredientsToClipboard;

  window.openCookbookRecipeFormModal = openCookbookRecipeFormModal;
  window.closeCookbookRecipeFormModal = function () {
    const modal = document.getElementById("cookbookRecipeFormModal");
    if (modal) {
      modal.style.display = "none";
      modal.classList.remove("active");
    }
  };
  window.selectFormCoverPreset = selectFormCoverPreset;
  window.onCoverImageUploaded = onCoverImageUploaded;
  window.saveRecipeForm = saveRecipeForm;
  window.editRecipe = function (id) {
    closeCookbookRecipeDetail();
    openCookbookRecipeFormModal(id);
  };
  window.deleteRecipe = deleteRecipe;
  window.toggleFavoriteRecipe = toggleFavoriteRecipe;

  window.addIngredientRow = function () {
    tempIngredients.push({ name: "", amount: "", unit: "" });
    const cont = document.getElementById("rfIngredientsContainer");
    if (cont) cont.innerHTML = renderIngredientsInputs();
  };

  window.removeIngredientRow = function (idx) {
    if (tempIngredients.length <= 1) return;
    tempIngredients.splice(idx, 1);
    const cont = document.getElementById("rfIngredientsContainer");
    if (cont) cont.innerHTML = renderIngredientsInputs();
  };

  window.updateIngredient = function (idx, field, val) {
    if (tempIngredients[idx]) tempIngredients[idx][field] = val;
  };

  function syncStepTextareasToState() {
    const cont = document.getElementById("rfStepsContainer");
    if (!cont) return;
    const rows = cont.querySelectorAll(".fc-step-input-row");
    rows.forEach((row) => {
      const idx = parseInt(row.dataset.stepIndex, 10);
      const ta = row.querySelector("textarea");
      if (ta && tempSteps[idx]) {
        tempSteps[idx].instruction = ta.value;
      }
    });
  }

  function renderAndRebindSteps() {
    const cont = document.getElementById("rfStepsContainer");
    if (cont) {
      cont.innerHTML = renderStepsInputs();
      bindStepsDragDrop();
    }
  }

  let draggedStepIndex = null;
  let touchStartStepY = 0;
  let touchDraggedStepRow = null;
  let touchFromStepIdx = null;

  function bindStepsDragDrop() {
    const cont = document.getElementById("rfStepsContainer");
    if (!cont) return;
    const rows = cont.querySelectorAll(".fc-step-input-row");

    rows.forEach((row) => {
      const handle = row.querySelector(".fc-step-drag-handle");
      if (!handle) return;

      // Desktop Drag: enable draggable only when grabbing handle
      handle.addEventListener("mousedown", () => {
        row.draggable = true;
      });

      row.addEventListener("dragstart", (e) => {
        draggedStepIndex = parseInt(row.dataset.stepIndex, 10);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(draggedStepIndex));
        row.classList.add("is-dragging");
      });

      row.addEventListener("dragend", () => {
        row.draggable = false;
        row.classList.remove("is-dragging");
        rows.forEach((r) => r.classList.remove("drag-over-above", "drag-over-below"));
        draggedStepIndex = null;
      });

      row.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        const currentIdx = parseInt(row.dataset.stepIndex, 10);
        if (draggedStepIndex === null || draggedStepIndex === currentIdx) return;

        const rect = row.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const isAbove = e.clientY < midY;

        row.classList.toggle("drag-over-above", isAbove);
        row.classList.toggle("drag-over-below", !isAbove);
      });

      row.addEventListener("dragleave", () => {
        row.classList.remove("drag-over-above", "drag-over-below");
      });

      row.addEventListener("drop", (e) => {
        e.preventDefault();
        row.classList.remove("drag-over-above", "drag-over-below");
        const toIdx = parseInt(row.dataset.stepIndex, 10);
        if (draggedStepIndex === null || draggedStepIndex === toIdx) return;

        syncStepTextareasToState();
        const [movedStep] = tempSteps.splice(draggedStepIndex, 1);
        tempSteps.splice(toIdx, 0, movedStep);
        tempSteps.forEach((s, i) => (s.stepNumber = i + 1));
        draggedStepIndex = null;
        renderAndRebindSteps();
      });

      // Mobile Touch Drag: touch and drag handle to reorder
      handle.addEventListener("touchstart", (e) => {
        if (e.touches.length !== 1) return;
        touchStartStepY = e.touches[0].clientY;
        touchDraggedStepRow = row;
        touchFromStepIdx = parseInt(row.dataset.stepIndex, 10);
        touchDraggedStepRow.classList.add("is-dragging");
      }, { passive: true });

      handle.addEventListener("touchmove", (e) => {
        if (!touchDraggedStepRow) return;
        const touch = e.touches[0];
        const diff = Math.abs(touch.clientY - touchStartStepY);
        if (diff > 8 && e.cancelable) {
          e.preventDefault();
        }

        const elem = document.elementFromPoint(touch.clientX, touch.clientY);
        const overRow = elem ? elem.closest(".fc-step-input-row") : null;

        rows.forEach((r) => {
          if (r === overRow && r !== touchDraggedStepRow) {
            r.classList.add("drag-over-above");
          } else {
            r.classList.remove("drag-over-above", "drag-over-below");
          }
        });
      }, { passive: false });

      handle.addEventListener("touchend", (e) => {
        if (!touchDraggedStepRow) return;
        const touch = e.changedTouches[0];
        const elem = document.elementFromPoint(touch.clientX, touch.clientY);
        const overRow = elem ? elem.closest(".fc-step-input-row") : null;

        touchDraggedStepRow.classList.remove("is-dragging");
        rows.forEach((r) => r.classList.remove("drag-over-above", "drag-over-below"));

        if (overRow && touchFromStepIdx !== null) {
          const toIdx = parseInt(overRow.dataset.stepIndex, 10);
          if (!isNaN(toIdx) && toIdx !== touchFromStepIdx) {
            syncStepTextareasToState();
            const [movedStep] = tempSteps.splice(touchFromStepIdx, 1);
            tempSteps.splice(toIdx, 0, movedStep);
            tempSteps.forEach((s, i) => (s.stepNumber = i + 1));
            renderAndRebindSteps();
          }
        }

        touchDraggedStepRow = null;
        touchFromStepIdx = null;
      });
    });
  }

  window.bindStepsDragDrop = bindStepsDragDrop;

  window.addStepRow = function () {
    syncStepTextareasToState();
    tempSteps.push({ stepNumber: tempSteps.length + 1, instruction: "" });
    renderAndRebindSteps();
  };

  window.removeStepRow = function (idx) {
    if (tempSteps.length <= 1) return;
    syncStepTextareasToState();
    tempSteps.splice(idx, 1);
    tempSteps.forEach((s, i) => (s.stepNumber = i + 1));
    renderAndRebindSteps();
  };

  window.updateStep = function (idx, val) {
    if (tempSteps[idx]) tempSteps[idx].instruction = val;
  };

  window.openDietaryFormModal = openDietaryFormModal;
  window.closeDietaryFormModal = closeDietaryFormModal;
  window.onDietaryAvatarChange = onDietaryAvatarChange;
  window.saveDietaryForm = saveDietaryForm;
  window.deleteDietaryMember = deleteDietaryMember;

  window.generateSmartMealPlan = generateSmartMealPlan;
  window.rerollMealSlot = function (slotType) {
    if (!currentSuggestedMeal) return;
    const cat = slotType === "main" ? "main" : slotType === "soup" ? "soup" : "veggie";
    const pool = recipesCache.filter((r) => r.category === cat);
    if (pool.length > 0) {
      currentSuggestedMeal[slotType] = pool[Math.floor(Math.random() * pool.length)];
      renderMealPlanTab();
    } else {
      showCookbookToast("Chưa có món nào khác trong danh mục này!", "info");
    }
  };

  // ==========================================================================
  // CALENDAR MEAL INTEGRATION (TÍCH HỢP THỰC ĐƠN VÀO LỊCH GIA ĐÌNH)
  // ==========================================================================

  function formatDateKeyToInput(dateKey) {
    if (!dateKey) return "";
    const parts = dateKey.split("-");
    if (parts.length !== 3) return "";
    const y = parts[0];
    const m = String(parts[1]).padStart(2, "0");
    const d = String(parts[2]).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function formatInputToDateKey(inputVal) {
    if (!inputVal) return "";
    const parts = inputVal.split("-");
    if (parts.length !== 3) return "";
    return `${parseInt(parts[0], 10)}-${parseInt(parts[1], 10)}-${parseInt(parts[2], 10)}`;
  }

  function getMealForDate(dateKey) {
    if (!dateKey || !calendarMealsCache) return null;
    const meals = calendarMealsCache[dateKey];
    if (Array.isArray(meals) && meals.length > 0) return meals;
    return null;
  }

  function getAllCalendarMeals() {
    return calendarMealsCache;
  }

  function removeMealFromDate(dateKey, mealId) {
    if (!dateKey || !calendarMealsCache[dateKey]) return;
    if (mealId) {
      calendarMealsCache[dateKey] = calendarMealsCache[dateKey].filter((m) => m.id !== mealId);
      if (calendarMealsCache[dateKey].length === 0) {
        delete calendarMealsCache[dateKey];
      }
    } else {
      delete calendarMealsCache[dateKey];
    }
    saveCalendarMealsToLocalStorage();
    saveCalendarMealsToFirebase();
    if (typeof window.renderCalendar === "function") window.renderCalendar();
    if (typeof window.renderTodayEvents === "function") window.renderTodayEvents();
    if (typeof window.renderDayDetailsModalUI === "function") {
      const parts = dateKey.split("-");
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const d = parseInt(parts[2], 10);
        const dateData = typeof window.getDateData === "function" ? window.getDateData(dateKey) : {};
        window.renderDayDetailsModalUI(dateKey, d, m, y, dateData);
      }
    }
    showCookbookToast("Đã xóa thực đơn khỏi ngày này!", "info");
  }

  function formatDateKeyToDisplay(dateKey) {
    if (!dateKey) return "";
    const parts = dateKey.split("-");
    if (parts.length !== 3) return dateKey;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    const dateObj = new Date(y, m - 1, d);
    const dayNames = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
    const dayOfWeek = dayNames[dateObj.getDay()];
    return `${dayOfWeek}, ${d}/${m}/${y}`;
  }

  function toggleAssignDateChange() {
    const wrap = document.getElementById("fcAssignDateChangeWrap");
    if (wrap) {
      wrap.style.display = wrap.style.display === "none" ? "block" : "none";
    }
  }

  function editCalendarMeal(dateKey, mealId) {
    if (!dateKey || !calendarMealsCache[dateKey]) {
      showCookbookToast("Không tìm thấy thông tin bữa ăn!", "error");
      return;
    }
    const meal = calendarMealsCache[dateKey].find((m) => m.id === mealId);
    if (!meal) {
      showCookbookToast("Không tìm thấy bữa ăn cần sửa!", "error");
      return;
    }
    openAssignMealToCalendarModal("edit", { dateKey, meal });
  }

  function openAssignMealToCalendarModal(sourceType, param) {
    let dishesToAssign = [];
    let initialDateKey = "";
    let initialMealType = "dinner";
    let editingMealId = null;
    let originalDateKey = null;

    const now = new Date();
    const todayKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    const tomorrow = new Date();
    tomorrow.setDate(now.getDate() + 1);
    const tomorrowKey = `${tomorrow.getFullYear()}-${tomorrow.getMonth() + 1}-${tomorrow.getDate()}`;

    // Thứ Bảy & Chủ Nhật tới
    const dayOfWeek = now.getDay();
    const daysUntilSat = (6 - dayOfWeek + 7) % 7;
    const satDate = new Date();
    satDate.setDate(now.getDate() + (daysUntilSat === 0 ? 7 : daysUntilSat));
    const satKey = `${satDate.getFullYear()}-${satDate.getMonth() + 1}-${satDate.getDate()}`;

    const daysUntilSun = (7 - dayOfWeek + 7) % 7;
    const sunDate = new Date();
    sunDate.setDate(now.getDate() + (daysUntilSun === 0 ? 7 : daysUntilSun));
    const sunKey = `${sunDate.getFullYear()}-${sunDate.getMonth() + 1}-${sunDate.getDate()}`;

    const isSpecificDaySource =
      (sourceType === "day" && !!param) ||
      (sourceType === "edit" && param && (param.dateKey || param.meal?.dateKey));

    if (sourceType === "edit" && param && param.meal) {
      const { meal, dateKey } = param;
      editingMealId = meal.id;
      originalDateKey = dateKey || meal.dateKey;
      initialDateKey = originalDateKey || todayKey;
      initialMealType = meal.mealType || "dinner";
      dishesToAssign = (meal.dishes || []).map((d) => {
        const full = recipesCache.find((r) => r.id === d.id);
        return full ? { ...full } : { ...d };
      });
    } else if (sourceType === "mealplan") {
      if (!currentSuggestedMeal) {
        generateSmartMealPlan();
      }
      const { main, soup, veggie } = currentSuggestedMeal || {};
      dishesToAssign = [main, soup, veggie].filter(Boolean);
      initialDateKey = todayKey;
    } else if (sourceType === "recipe") {
      const rec = recipesCache.find((r) => r.id === param);
      if (rec) dishesToAssign = [{ ...rec }];
      initialDateKey = todayKey;
    } else if (sourceType === "day") {
      initialDateKey = param || todayKey;
      dishesToAssign = [];
    } else {
      initialDateKey = todayKey;
    }

    const modal = document.getElementById("cookbookAssignMealModal");
    if (!modal) return;

    let initialDateInput = formatDateKeyToInput(initialDateKey);

    currentAssigningMealData = {
      sourceType,
      editingMealId,
      originalDateKey,
      targetDateKey: initialDateKey,
      mealType: initialMealType,
      dishes: dishesToAssign
    };

    const isEditMode = sourceType === "edit";
    const modalTitle = isEditMode ? "Chỉnh Sửa Thực Đơn" : "Gán Thực Đơn Vào Lịch";
    const modalSub = isEditMode ? "Tùy chỉnh món ăn và các bữa cơm trong gia đình" : "Đồng bộ bữa cơm vào lịch";
    const modalIcon = isEditMode ? "fi-rr-pencil" : "fi-rr-calendar-plus";

    modal.innerHTML = `
      <div class="fc-modal-dialog fc-assign-dialog">
        <div class="fc-header" style="justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div class="fc-header-icon"><i class="fi ${modalIcon}"></i></div>
            <div>
              <h3 class="fc-header-title" style="font-size: 1.1rem;">${modalTitle}</h3>
              <div class="fc-header-sub" style="font-size: 0.78rem;">${modalSub}</div>
            </div>
          </div>
          <button type="button" class="fc-btn-close" onclick="window.closeAssignMealModal()" title="Đóng">
            <i class="fi fi-rr-cross"></i>
          </button>
        </div>

        <div class="fc-body fc-assign-body">
          <!-- 1. Chọn / Hiển thị Ngày -->
          <div class="fc-assign-sec">
            ${isSpecificDaySource ? `
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <div class="fc-assign-sec-title" style="margin-bottom: 0;">
                  <i class="fi fi-rr-calendar"></i> Ngày thực đơn:
                </div>
                <button type="button" class="fc-btn-change-date-link" onclick="window.toggleAssignDateChange()" style="background: transparent; border: none; color: #60a5fa; font-size: 0.78rem; cursor: pointer; text-decoration: underline; font-family: inherit; padding: 2px 4px;">
                  Đổi ngày khác
                </button>
              </div>
              <div class="fc-selected-day-badge" style="margin-top: 8px; display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-radius: 9px; background: rgba(59, 130, 246, 0.14); border: 1px solid rgba(59, 130, 246, 0.28);">
                <i class="fi fi-rr-calendar-check" style="color: #93c5fd; font-size: 15px;"></i>
                <span id="fcSelectedDayBadgeText" style="font-weight: 700; color: #fff; font-size: 0.92rem;">${formatDateKeyToDisplay(initialDateKey)}</span>
                <span style="font-size: 0.75rem; color: #94a3b8; margin-left: auto;">(Đã chọn sẵn)</span>
              </div>
              <div id="fcAssignDateChangeWrap" style="display: none; margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.08);">
                <div class="fc-quick-date-chips">
                  <button type="button" class="fc-date-chip ${initialDateKey === todayKey ? 'active' : ''}" onclick="window.selectQuickAssignDate('${todayKey}')">
                    Hôm Nay
                  </button>
                  <button type="button" class="fc-date-chip ${initialDateKey === tomorrowKey ? 'active' : ''}" onclick="window.selectQuickAssignDate('${tomorrowKey}')">
                    Ngày Mai
                  </button>
                  <button type="button" class="fc-date-chip ${initialDateKey === satKey ? 'active' : ''}" onclick="window.selectQuickAssignDate('${satKey}')">
                    Thứ 7
                  </button>
                  <button type="button" class="fc-date-chip ${initialDateKey === sunKey ? 'active' : ''}" onclick="window.selectQuickAssignDate('${sunKey}')">
                    Chủ Nhật
                  </button>
                </div>
                <div style="margin-top: 8px; display: flex; align-items: center; gap: 8px;">
                  <span style="font-size: 0.8rem; color: var(--fc-text-secondary);">Hoặc chọn ngày:</span>
                  <input type="date" class="fc-form-input" id="fcAssignDateInput" style="max-width: 170px; padding: 6px 10px; font-size: 0.86rem;" value="${initialDateInput}" onchange="window.onAssignDateInputChange(this.value)" />
                </div>
              </div>
            ` : `
              <div class="fc-assign-sec-title"><i class="fi fi-rr-calendar"></i> Chọn Ngày:</div>
              <div class="fc-quick-date-chips">
                <button type="button" class="fc-date-chip ${initialDateKey === todayKey ? 'active' : ''}" onclick="window.selectQuickAssignDate('${todayKey}')">
                  Hôm Nay (${now.getDate()}/${now.getMonth() + 1})
                </button>
                <button type="button" class="fc-date-chip ${initialDateKey === tomorrowKey ? 'active' : ''}" onclick="window.selectQuickAssignDate('${tomorrowKey}')">
                  Ngày Mai (${tomorrow.getDate()}/${tomorrow.getMonth() + 1})
                </button>
                <button type="button" class="fc-date-chip ${initialDateKey === satKey ? 'active' : ''}" onclick="window.selectQuickAssignDate('${satKey}')">
                  Thứ 7 (${satDate.getDate()}/${satDate.getMonth() + 1})
                </button>
                <button type="button" class="fc-date-chip ${initialDateKey === sunKey ? 'active' : ''}" onclick="window.selectQuickAssignDate('${sunKey}')">
                  Chủ Nhật (${sunDate.getDate()}/${sunDate.getMonth() + 1})
                </button>
              </div>
              <div style="margin-top: 10px; display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 0.8rem; color: var(--fc-text-secondary);">Hoặc chọn ngày:</span>
                <input type="date" class="fc-form-input" id="fcAssignDateInput" style="max-width: 170px; padding: 6px 10px; font-size: 0.86rem;" value="${initialDateInput}" onchange="window.onAssignDateInputChange(this.value)" />
              </div>
            `}
          </div>

          <!-- 2. Chọn Bữa Ăn -->
          <div class="fc-assign-sec">
            <div class="fc-assign-sec-title"><i class="fi fi-rr-clock"></i> Chọn bữa:</div>
            <div class="fc-meal-type-segmented">
              <button type="button" class="fc-meal-type-btn ${initialMealType === 'dinner' ? 'active' : ''}" data-type="dinner" onclick="window.selectAssignMealType('dinner')">
                🌙 Tối
              </button>
              <button type="button" class="fc-meal-type-btn ${initialMealType === 'lunch' ? 'active' : ''}" data-type="lunch" onclick="window.selectAssignMealType('lunch')">
                ☀️ Trưa
              </button>
              <button type="button" class="fc-meal-type-btn ${initialMealType === 'breakfast' ? 'active' : ''}" data-type="breakfast" onclick="window.selectAssignMealType('breakfast')">
                🌅 Sáng
              </button>
            </div>
          </div>

          <!-- 3. Món Ăn Trong Bữa -->
          <div class="fc-assign-sec">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
              <div class="fc-assign-sec-title" style="margin-bottom: 0;">
                <i class="fi fi-rr-utensils"></i> Món Ăn Trong Bữa (<span id="fcAssignDishesCount">${dishesToAssign.length}</span> món):
              </div>
            </div>
            
            <div class="fc-assign-dishes-preview" id="fcAssignDishesPreview"></div>

            <!-- Tích chọn thêm món -->
            <div class="fc-assign-add-section" style="margin-top: 12px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 10px;">
              <!-- Header mặc định: Tiêu đề + Nút icon tìm kiếm -->
              <div id="fcAssignSearchHeaderDefault" style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px;">
                <div style="font-size: 0.82rem; font-weight: 600; color: #cbd5e1; display: flex; align-items: center; gap: 6px;">
                  Sổ tay món ăn:
                </div>
                <button type="button" class="fc-assign-search-toggle-btn" onclick="window.toggleAssignDishSearch(true)" title="Tìm kiếm món ăn" aria-label="Tìm kiếm món ăn">
                  <i class="fi fi-rr-search"></i>
                </button>
              </div>

              <!-- Thanh tìm kiếm mở rộng Full Chiều Rộng -->
              <div id="fcAssignSearchExpandWrap" class="fc-assign-search-expand-wrap" style="display: none;">
                <div class="fc-assign-search-box">
                  <i class="fi fi-rr-search fc-assign-search-icon"></i>
                  <input type="text" id="fcAssignDishSearch" class="fc-assign-search-input" placeholder="Tìm tên món, loại món..." oninput="window.filterAssignDishes(this.value)" onkeydown="if(event.key==='Escape') window.toggleAssignDishSearch(false)" />
                  <button type="button" class="fc-assign-search-close-btn" onclick="window.toggleAssignDishSearch(false)" title="Đóng tìm kiếm" aria-label="Đóng tìm kiếm">
                    <i class="fi fi-rr-cross"></i>
                  </button>
                </div>
              </div>

              <div class="fc-assign-dish-selector" id="fcAssignDishSelector"></div>
            </div>
          </div>
        </div>

        <div class="fc-detail-footer" style="${isEditMode ? 'justify-content: space-between;' : 'justify-content: flex-end;'} gap: 10px;">
          ${isEditMode ? `
            <button type="button" class="fc-btn fc-btn-danger fc-btn-icon-only" onclick="window.deleteEditingMeal()" title="Xóa bữa này" aria-label="Xóa bữa này">
              <i class="fi fi-rr-trash"></i>
            </button>
          ` : ''}
          <div style="display: flex; gap: 10px;">
            <button type="button" class="fc-btn fc-btn-secondary fc-btn-icon-only" onclick="window.closeAssignMealModal()" title="Hủy bỏ" aria-label="Hủy bỏ">
              <i class="fi fi-rr-cross"></i>
            </button>
            <button type="button" class="fc-btn fc-btn-mealplan fc-btn-icon-only" onclick="window.confirmAssignMealToCalendar()" title="${isEditMode ? 'Cập nhật bữa ăn' : 'Lưu vào lịch gia đình'}" aria-label="${isEditMode ? 'Cập nhật bữa ăn' : 'Lưu vào lịch gia đình'}">
              <i class="fi fi-rr-check"></i>
            </button>
          </div>
        </div>
      </div>
    `;

    renderAssignDishesPreview();
    renderAssignDishesSelector();

    modal.style.display = "flex";
    modal.classList.add("active");
  }

  function renderAssignDishesPreview() {
    const container = document.getElementById("fcAssignDishesPreview");
    const countEl = document.getElementById("fcAssignDishesCount");
    if (!container || !currentAssigningMealData) return;
    const dishes = currentAssigningMealData.dishes || [];
    if (countEl) countEl.textContent = dishes.length;

    if (dishes.length === 0) {
      container.innerHTML = `
        <div class="fc-assign-dishes-empty">
          Chưa có món ăn nào được chọn cho bữa này.<br/>
          <span style="font-size: 0.76rem; color: #f59e0b;">Hãy tích chọn ít nhất 1 món từ danh sách bên dưới!</span>
        </div>
      `;
      return;
    }

    container.innerHTML = dishes
      .map(
        (d) => `
        <div class="fc-assign-dish-badge" data-dish-id="${d.id}">
          <img src="${d.coverImage || PRESET_COVERS.thitkho}" alt="${d.title}" />
          <div style="flex: 1; min-width: 0;">
            <div class="fc-assign-dish-name">${d.title}</div>
            <div class="fc-assign-dish-cat">${CATEGORIES[d.category]?.label || 'Món ngon'} • ${d.cookTime || 30} phút</div>
          </div>
          <button type="button" class="fc-assign-dish-remove" onclick="window.removeDishFromAssigning('${d.id}')" title="Bỏ món này">
            <i class="fi fi-rr-cross"></i>
          </button>
        </div>
      `
      )
      .join("");
  }

  function renderAssignDishesSelector(filterText = "") {
    const container = document.getElementById("fcAssignDishSelector");
    if (!container || !currentAssigningMealData) return;
    const currentDishes = currentAssigningMealData.dishes || [];
    const query = (filterText || "").trim().toLowerCase();

    const filtered = recipesCache.filter((r) => {
      if (!query) return true;
      return (
        r.title.toLowerCase().includes(query) ||
        (CATEGORIES[r.category]?.label || "").toLowerCase().includes(query)
      );
    });

    if (filtered.length === 0) {
      container.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--fc-text-muted); font-size: 0.8rem; padding: 12px;">Không tìm thấy món ăn phù hợp</div>`;
      return;
    }

    container.innerHTML = filtered
      .map((r) => {
        const isChecked = currentDishes.some((d) => d.id === r.id);
        return `
        <label class="fc-assign-dish-option ${isChecked ? 'selected' : ''}">
          <input type="checkbox" name="assignDishChoice" value="${r.id}" ${isChecked ? 'checked' : ''} onchange="window.toggleAssignDishChoice('${r.id}')" />
          <img src="${r.coverImage || PRESET_COVERS.thitkho}" alt="" />
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 600; font-size: 0.84rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #fff;">${r.title}</div>
            <div style="font-size: 0.74rem; color: var(--fc-text-muted);">${CATEGORIES[r.category]?.label || 'Món ăn'} • ${r.cookTime || 30}p</div>
          </div>
        </label>
      `;
      })
      .join("");
  }

  function filterAssignDishes(text) {
    renderAssignDishesSelector(text);
  }

  function toggleAssignDishSearch(open) {
    const defaultHeader = document.getElementById("fcAssignSearchHeaderDefault");
    const expandWrap = document.getElementById("fcAssignSearchExpandWrap");
    const searchInput = document.getElementById("fcAssignDishSearch");

    if (open) {
      if (defaultHeader) defaultHeader.style.display = "none";
      if (expandWrap) {
        expandWrap.style.display = "block";
        if (searchInput) {
          searchInput.focus();
          if (searchInput.value) {
            filterAssignDishes(searchInput.value);
          }
        }
      }
    } else {
      if (expandWrap) expandWrap.style.display = "none";
      if (defaultHeader) defaultHeader.style.display = "flex";
      if (searchInput) {
        searchInput.value = "";
      }
      filterAssignDishes("");
    }
  }

  function removeDishFromAssigning(dishId) {
    if (!currentAssigningMealData || !currentAssigningMealData.dishes) return;
    currentAssigningMealData.dishes = currentAssigningMealData.dishes.filter((d) => d.id !== dishId);
    renderAssignDishesPreview();
    renderAssignDishesSelector(document.getElementById("fcAssignDishSearch")?.value || "");
  }

  function deleteEditingMeal() {
    if (!currentAssigningMealData || !currentAssigningMealData.editingMealId) return;
    const { originalDateKey, editingMealId } = currentAssigningMealData;
    if (confirm("Bạn có chắc chắn muốn xóa thực đơn bữa này không?")) {
      removeMealFromDate(originalDateKey, editingMealId);
      closeAssignMealModal();
    }
  }

  function closeAssignMealModal() {
    const modal = document.getElementById("cookbookAssignMealModal");
    if (modal) {
      modal.style.display = "none";
      modal.classList.remove("active");
    }
    currentAssigningMealData = null;
  }

  function selectQuickAssignDate(dateKey) {
    if (!currentAssigningMealData) return;
    currentAssigningMealData.targetDateKey = dateKey;
    const input = document.getElementById("fcAssignDateInput");
    if (input) input.value = formatDateKeyToInput(dateKey);
    document.querySelectorAll(".fc-date-chip").forEach((chip) => chip.classList.remove("active"));
    const activeChip = Array.from(document.querySelectorAll(".fc-date-chip")).find((c) => c.getAttribute("onclick")?.includes(dateKey));
    if (activeChip) activeChip.classList.add("active");
    const badgeText = document.getElementById("fcSelectedDayBadgeText");
    if (badgeText) badgeText.textContent = formatDateKeyToDisplay(dateKey);
  }

  function onAssignDateInputChange(val) {
    if (!currentAssigningMealData || !val) return;
    const key = formatInputToDateKey(val);
    currentAssigningMealData.targetDateKey = key;
    document.querySelectorAll(".fc-date-chip").forEach((chip) => chip.classList.remove("active"));
    const activeChip = Array.from(document.querySelectorAll(".fc-date-chip")).find((c) => c.getAttribute("onclick")?.includes(key));
    if (activeChip) activeChip.classList.add("active");
    const badgeText = document.getElementById("fcSelectedDayBadgeText");
    if (badgeText) badgeText.textContent = formatDateKeyToDisplay(key);
  }

  function selectAssignMealType(type) {
    if (!currentAssigningMealData) return;
    currentAssigningMealData.mealType = type;
    document.querySelectorAll(".fc-meal-type-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.type === type);
    });
  }

  function toggleAssignDishChoice(dishId) {
    if (!currentAssigningMealData) return;
    if (!currentAssigningMealData.dishes) currentAssigningMealData.dishes = [];
    const idx = currentAssigningMealData.dishes.findIndex((d) => d.id === dishId);
    if (idx >= 0) {
      currentAssigningMealData.dishes.splice(idx, 1);
    } else {
      const rec = recipesCache.find((r) => r.id === dishId);
      if (rec) currentAssigningMealData.dishes.push({ ...rec });
    }
    renderAssignDishesPreview();
    renderAssignDishesSelector(document.getElementById("fcAssignDishSearch")?.value || "");
  }

  function confirmAssignMealToCalendar() {
    if (!currentAssigningMealData) return;
    const { sourceType, originalDateKey, editingMealId, targetDateKey, mealType, dishes } = currentAssigningMealData;
    if (!targetDateKey) {
      showCookbookToast("Vui lòng chọn ngày để lên thực đơn!", "error");
      return;
    }
    if (!dishes || dishes.length === 0) {
      showCookbookToast("Vui lòng chọn ít nhất 1 món ăn cho bữa này!", "error");
      return;
    }

    // Nếu đang chỉnh sửa và đổi sang ngày khác, gỡ bữa này khỏi ngày cũ trước
    if (sourceType === "edit" && originalDateKey && originalDateKey !== targetDateKey) {
      if (calendarMealsCache[originalDateKey]) {
        calendarMealsCache[originalDateKey] = calendarMealsCache[originalDateKey].filter((m) => m.id !== editingMealId);
        if (calendarMealsCache[originalDateKey].length === 0) {
          delete calendarMealsCache[originalDateKey];
        }
      }
    }

    if (!calendarMealsCache[targetDateKey]) {
      calendarMealsCache[targetDateKey] = [];
    }

    const minimalDishes = dishes.map((d) => ({
      id: d.id,
      title: d.title,
      category: d.category || "main",
      coverImage: d.coverImage || "",
      cookTime: d.cookTime || 30
    }));

    const mealId = (sourceType === "edit" && editingMealId) ? editingMealId : "meal_" + Date.now();
    const mealTitle = mealType === "breakfast" ? "Bữa Sáng" : mealType === "lunch" ? "Bữa Trưa" : "Bữa Tối";
    const mealObj = {
      id: mealId,
      dateKey: targetDateKey,
      mealType: mealType || "dinner",
      title: mealTitle,
      dishes: minimalDishes,
      updatedAt: Date.now()
    };

    const existingIdx = calendarMealsCache[targetDateKey].findIndex((m) => m.id === mealId || (sourceType !== "edit" && m.mealType === mealType));
    if (existingIdx >= 0) {
      calendarMealsCache[targetDateKey][existingIdx] = mealObj;
    } else {
      calendarMealsCache[targetDateKey].push(mealObj);
    }

    saveCalendarMealsToLocalStorage();
    saveCalendarMealsToFirebase();

    if (typeof window.renderCalendar === "function") {
      window.renderCalendar();
    }
    if (typeof window.renderTodayEvents === "function") {
      window.renderTodayEvents();
    }
    if (typeof window.renderDayDetailsModalUI === "function") {
      const parts = targetDateKey.split("-");
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const d = parseInt(parts[2], 10);
        const dateData = typeof window.getDateData === "function" ? window.getDateData(targetDateKey) : {};
        window.renderDayDetailsModalUI(targetDateKey, d, m, y, dateData);
      }
      if (sourceType === "edit" && originalDateKey && originalDateKey !== targetDateKey) {
        const oParts = originalDateKey.split("-");
        if (oParts.length === 3) {
          const oy = parseInt(oParts[0], 10);
          const om = parseInt(oParts[1], 10);
          const od = parseInt(oParts[2], 10);
          const oDateData = typeof window.getDateData === "function" ? window.getDateData(originalDateKey) : {};
          window.renderDayDetailsModalUI(originalDateKey, od, om, oy, oDateData);
        }
      }
    }

    closeAssignMealModal();
    const parts = targetDateKey.split("-");
    const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}` : targetDateKey;
    showCookbookToast(sourceType === "edit" ? `Đã cập nhật ${mealTitle} ngày ${formattedDate}! 🍲` : `Đã gán thực đơn vào ngày ${formattedDate} trên Lịch gia đình! 🍲`, "success");
  }

  window.editCalendarMeal = editCalendarMeal;
  window.openAssignMealToCalendarModal = openAssignMealToCalendarModal;
  window.closeAssignMealModal = closeAssignMealModal;
  window.selectQuickAssignDate = selectQuickAssignDate;
  window.onAssignDateInputChange = onAssignDateInputChange;
  window.toggleAssignDateChange = toggleAssignDateChange;
  window.selectAssignMealType = selectAssignMealType;
  window.toggleAssignDishChoice = toggleAssignDishChoice;
  window.removeDishFromAssigning = removeDishFromAssigning;
  window.filterAssignDishes = filterAssignDishes;
  window.toggleAssignDishSearch = toggleAssignDishSearch;
  window.deleteEditingMeal = deleteEditingMeal;
  window.confirmAssignMealToCalendar = confirmAssignMealToCalendar;
  window.getMealForDate = getMealForDate;
  window.getAllCalendarMeals = getAllCalendarMeals;
  window.removeMealFromDate = removeMealFromDate;
  window.openAssignMealModalForDay = function (dateKey) {
    openAssignMealToCalendarModal("day", dateKey);
  };

  // Pre-load local state on script parse
  loadFromLocalStorage();
})();
