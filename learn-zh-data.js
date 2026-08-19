/* ==========================================================================
   Chinese Learning Dataset (Tiếng Trung Toàn Diện Cho Người Mới Bắt Đầu)
   - ZH_BASICS_DATA (Pinyin: Thanh mẫu, Vận mẫu, Thanh điệu, Các nét, Bộ thủ)
   - ZH_VOCABULARY_DATA (Từ vựng HSK 1-2, Pinyin, Hán Việt, Ví dụ có Pinyin)
   - ZH_GRAMMAR_DATA (Ngữ pháp sơ cấp kèm ví dụ phiên âm Pinyin)
   - ZH_PHRASES_DATA (Câu giao tiếp kèm Pinyin và phân tích)
   - Category Maps (ZH_VOCAB_CATEGORIES, ZH_GRAMMAR_CATEGORIES, ZH_PHRASE_CATEGORIES)
   ========================================================================== */

// ==================== 1. DỮ LIỆU NHẬP MÔN (PINYIN & CƠ BẢN) ====================
const ZH_BASICS_DATA = {
  // 23 Thanh mẫu (Phụ âm đầu)
  initials: [
    { char: "b", pinyin: "b", ipa: "[p]", tip: "Đọc giống 'p' trong tiếng Việt nhưng không bật hơi (VD: 八 bā - số 8)", audioText: "八 bā" },
    { char: "p", pinyin: "p", ipa: "[pʰ]", tip: "Bật hơi mạnh, đọc giống 'p-h' bật luồng gió từ môi (VD: 跑 pǎo - chạy)", audioText: "跑 pǎo" },
    { char: "m", pinyin: "m", ipa: "[m]", tip: "Đọc giống 'm' trong tiếng Việt (VD: 妈妈 māma - mẹ)", audioText: "妈妈 māma" },
    { char: "f", pinyin: "f", ipa: "[f]", tip: "Đọc giống 'ph/f' trong tiếng Việt (VD: 发 fā - phát)", audioText: "发 fā" },
    { char: "d", pinyin: "d", ipa: "[t]", tip: "Đọc giống 't' trong tiếng Việt, không bật hơi (VD: 大 dà - to lớn)", audioText: "大 dà" },
    { char: "t", pinyin: "t", ipa: "[tʰ]", tip: "Bật hơi mạnh, đọc giống 'th' trong tiếng Việt (VD: 他 tā - anh ấy)", audioText: "他 tā" },
    { char: "n", pinyin: "n", ipa: "[n]", tip: "Đọc giống 'n' trong tiếng Việt (VD: 你 nǐ - bạn)", audioText: "你 nǐ" },
    { char: "l", pinyin: "l", ipa: "[l]", tip: "Đọc giống 'l' trong tiếng Việt (VD: 来 lái - đến)", audioText: "来 lái" },
    { char: "g", pinyin: "g", ipa: "[k]", tip: "Đọc giống 'c/k' trong tiếng Việt, không bật hơi (VD: 高 gāo - cao)", audioText: "高 gāo" },
    { char: "k", pinyin: "k", ipa: "[kʰ]", tip: "Bật hơi mạnh từ cuống họng, giống 'kh' bật hơi (VD: 看 kàn - xem)", audioText: "看 kàn" },
    { char: "h", pinyin: "h", ipa: "[x]", tip: "Đọc lai giữa 'h' và 'kh' tiếng Việt, nhẹ nhàng (VD: 好 hǎo - tốt)", audioText: "好 hǎo" },
    { char: "j", pinyin: "j", ipa: "[tɕ]", tip: "Mặt lưỡi áp ngạc cứng, đọc giống 'ch' nhẹ tiếng Việt (VD: 家 jiā - nhà)", audioText: "家 jiā" },
    { char: "q", pinyin: "q", ipa: "[tɕʰ]", tip: "Vị trí như 'j' nhưng bật hơi thật mạnh (VD: 去 qù - đi)", audioText: "去 qù" },
    { char: "x", pinyin: "x", ipa: "[ɕ]", tip: "Đọc giống 'x' nhẹ và bẹt miệng trong tiếng Việt (VD: 谢 xiè - cảm ơn)", audioText: "谢谢 xièxie" },
    { char: "zh", pinyin: "zh", ipa: "[ʈʂ]", tip: "Uốn đầu lưỡi lên ngạc cứng, đọc giống 'tr' không bật hơi (VD: 中 zhōng - trung)", audioText: "中国 zhōngguó" },
    { char: "ch", pinyin: "ch", ipa: "[ʈʂʰ]", tip: "Uốn cong đầu lưỡi và bật hơi thật mạnh (VD: 吃 chī - ăn)", audioText: "吃饭 chīfàn" },
    { char: "sh", pinyin: "sh", ipa: "[ʂ]", tip: "Uốn cong đầu lưỡi, đọc giống 's' nặng tiếng Việt (VD: 书 shū - sách)", audioText: "书 shū" },
    { char: "r", pinyin: "r", ipa: "[ʐ]", tip: "Uốn cong lưỡi, đọc rung nhẹ như 'r' tiếng Việt (VD: 人 rén - người)", audioText: "人 rén" },
    { char: "z", pinyin: "z", ipa: "[ts]", tip: "Đầu lưỡi thẳng chạm răng trên, đọc giống 'ch/tz' (VD: 早 zǎo - sớm)", audioText: "早上 zǎoshang" },
    { char: "c", pinyin: "c", ipa: "[tsʰ]", tip: "Vị trí như 'z' nhưng bật hơi mạnh như tiếng xì (VD: 菜 cài - món ăn)", audioText: "菜 cài" },
    { char: "s", pinyin: "s", ipa: "[s]", tip: "Đầu lưỡi thẳng sát răng, đọc như 'x' tiếng Việt (VD: 三 sān - số 3)", audioText: "三 sān" },
    { char: "y", pinyin: "y", ipa: "[j]", tip: "Bán nguyên âm /i/, đọc như 'd/y' (VD: 月 yuè - trăng)", audioText: "月 yuè" },
    { char: "w", pinyin: "w", ipa: "[w]", tip: "Bán nguyên âm /u/, đọc như 'qu/u' (VD: 我 wǒ - tôi)", audioText: "我 wǒ" }
  ],

  // 36 Vận mẫu (Nguyên âm)
  finals: [
    { char: "a", pinyin: "a", tip: "Mở rộng miệng, đọc như 'a' (VD: 爸 bà)" },
    { char: "o", pinyin: "o", tip: "Tròn môi, đọc như 'ô' hoặc lai 'ua' (VD: 窝 wō)" },
    { char: "e", pinyin: "e", tip: "Mở miệng vừa, đọc như 'ưa/ơ' (VD: 喝 hē)" },
    { char: "i", pinyin: "i", tip: "Kéo mép sang hai bên, đọc như 'i' (VD: 你 nǐ)" },
    { char: "u", pinyin: "u", tip: "Tròn môi nhô ra, đọc như 'u' (VD: 不 bù)" },
    { char: "ü", pinyin: "ü", tip: "Khẩu hình 'u' nhưng phát âm 'i' (tròn môi suốt) (VD: 绿 lǜ)" },
    { char: "ai", pinyin: "ai", tip: "Đọc giống 'ai' trong tiếng Việt (VD: 爱 ài - yêu)" },
    { char: "ei", pinyin: "ei", tip: "Đọc giống 'ây' trong tiếng Việt (VD: 累 lèi - mệt)" },
    { char: "ao", pinyin: "ao", tip: "Đọc giống 'ao' trong tiếng Việt (VD: 高 gāo - cao)" },
    { char: "ou", pinyin: "ou", tip: "Đọc giống 'âu/âu' trong tiếng Việt (VD: 头 tóu - đầu)" },
    { char: "an", pinyin: "an", tip: "Đọc giống 'an' trong tiếng Việt (VD: 看 kàn - xem)" },
    { char: "en", pinyin: "en", tip: "Đọc giống 'ân' trong tiếng Việt (VD: 门 mén - cửa)" },
    { char: "ang", pinyin: "ang", tip: "Đọc giống 'ang' trong tiếng Việt (VD: 忙 máng - bận)" },
    { char: "eng", pinyin: "eng", tip: "Đọc giống 'âng' trong tiếng Việt (VD: 冷 lěng - lạnh)" },
    { char: "ong", pinyin: "ong", tip: "Đọc giống 'ung' trong tiếng Việt (VD: 红 hóng - đỏ)" },
    { char: "ia", pinyin: "ia", tip: "Đọc giống 'i-a' (VD: 家 jiā - nhà)" },
    { char: "ie", pinyin: "ie", tip: "Đọc giống 'i-ê' (VD: 写 xiě - viết)" },
    { char: "iao", pinyin: "iao", tip: "Đọc giống 'i-ao' (VD: 小 xiǎo - nhỏ)" },
    { char: "iu", pinyin: "iu (iou)", tip: "Đọc giống 'iêu' (VD: 六 liù - số 6)" },
    { char: "ian", pinyin: "ian", tip: "Đọc giống 'i-en' (VD: 天 tiān - trời)" },
    { char: "in", pinyin: "in", tip: "Đọc giống 'in' (VD: 心 xīn - tim)" },
    { char: "iang", pinyin: "iang", tip: "Đọc giống 'i-ang' (VD: 想 xiǎng - nghĩ)" },
    { char: "ing", pinyin: "ing", tip: "Đọc giống 'inh' (VD: 听 tīng - nghe)" },
    { char: "iong", pinyin: "iong", tip: "Đọc giống 'i-ung' (VD: 穷 qióng - nghèo)" },
    { char: "ua", pinyin: "ua", tip: "Đọc giống 'oa' (VD: 花 huā - hoa)" },
    { char: "uo", pinyin: "uo", tip: "Đọc giống 'ua/uô' (VD: 多 duō - nhiều)" },
    { char: "uai", pinyin: "uai", tip: "Đọc giống 'oai' (VD: 快 kuài - nhanh)" },
    { char: "ui", pinyin: "ui (uei)", tip: "Đọc giống 'uây' (VD: 水 shuǐ - nước)" },
    { char: "uan", pinyin: "uan", tip: "Đọc giống 'oan' (VD: 关 guān - đóng)" },
    { char: "un", pinyin: "un (uen)", tip: "Đọc giống 'uân' (VD: 问 wèn - hỏi)" },
    { char: "uang", pinyin: "uang", tip: "Đọc giống 'oang' (VD: 光 guāng - sáng)" },
    { char: "üe", pinyin: "üe", tip: "Khẩu hình tròn môi đọc 'u-ê' (VD: 月 yuè - tháng)" },
    { char: "üan", pinyin: "üan", tip: "Khẩu hình tròn môi đọc 'u-en' (VD: 远 yuǎn - xa)" },
    { char: "ün", pinyin: "ün", tip: "Khẩu hình tròn môi đọc 'u-in' (VD: 裙 qún - váy)" }
  ],

  // 4 Thanh điệu & Biến điệu
  tones: [
    {
      tone: "Thanh 1 (Âm Bình)",
      symbol: "ā (55)",
      desc: "Cao và bằng phẳng, giữ đều giọng ở mức cao nhất.",
      example: "mā (妈 - Mẹ)",
      audioText: "妈"
    },
    {
      tone: "Thanh 2 (Dương Bình)",
      symbol: "á (35)",
      desc: "Kéo từ mức trung bình lên cao, giống dấu sắc nhẹ trong tiếng Việt.",
      example: "má (麻 - Vừng/Gai)",
      audioText: "麻"
    },
    {
      tone: "Thanh 3 (Thượng Thanh)",
      symbol: "ǎ (214)",
      desc: "Hạ giọng xuống thấp nhất rồi hơi đưa lên, giống dấu hỏi kết hợp dấu ngã.",
      example: "mǎ (马 - Con ngựa)",
      audioText: "马"
    },
    {
      tone: "Thanh 4 (Khứ Thanh)",
      symbol: "à (51)",
      desc: "Rơi thẳng từ đỉnh cao xuống thấp nhất một cách dứt khoát, mạnh mẽ.",
      example: "mà (骂 - Mắng mỏ)",
      audioText: "骂"
    },
    {
      tone: "Khinh Thanh (Thanh nhẹ)",
      symbol: "ma (không dấu)",
      desc: "Đọc thật nhẹ, ngắn gọn, lướt qua.",
      example: "māma (妈妈 - Mẹ)",
      audioText: "妈妈"
    },
    {
      tone: "Quy tắc biến điệu quan trọng",
      symbol: "Biến điệu",
      desc: "1. Hai thanh 3 đi liền nhau: Thanh 3 thứ nhất đọc thành Thanh 2 (Nǐ hǎo -> Ní hǎo).\n2. Biến điệu của 不 (bù): Khi đứng trước thanh 4 đổi thành 'bú' (bú shì).\n3. Biến điệu của 一 (yī): Trước thanh 4 đọc là 'yí' (yí ge), trước thanh 1,2,3 đọc là 'yì' (yì tiān).",
      example: "你好 (Ní hǎo), 不是 (Bú shì), 一个 (Yí ge)",
      audioText: "你好 不是 一个"
    }
  ],

  // 8 Nét viết cơ bản & Quy tắc bút thuận
  strokes: [
    { name: "Nét Ngang (Héng)", char: "一", desc: "Kéo từ trái sang phải, hơi chếch nhẹ lên trên." },
    { name: "Nét Sổ (Shù)", char: "丨", desc: "Kéo thẳng đứng từ trên xuống dưới." },
    { name: "Nét Phẩy (Piě)", char: "丿", desc: "Kéo cong từ trên xuống sang hướng bên trái." },
    { name: "Nét Mác (Nà)", char: "㇏", desc: "Kéo nghiêng từ trên xuống sang hướng bên phải, đậm dần." },
    { name: "Nét Chấm (Diǎn)", char: "丶", desc: "Chấm dứt khoát từ trên xuống dưới." },
    { name: "Nét Hất (Tí)", char: "㇀", desc: "Đưa nhanh từ dưới chếch lên trên bên phải." },
    { name: "Nét Gập (Zhé)", char: "𠃍", desc: "Đang đi ngang hoặc sổ thì bẻ gập hướng khác." },
    { name: "Nét Móc (Gōu)", char: "亅", desc: "Cuối nét móc nhọn lên sang trái hoặc phải." }
  ],

  // 24 Bộ thủ phổ biến nhất
  radicals: [
    { char: "亻", name: "Bộ Nhân đứng", pinyin: "rén", meaning: "Liên quan đến con người", example: "你 (bạn), 他 (anh ấy)" },
    { char: "口", name: "Bộ Khẩu", pinyin: "kǒu", meaning: "Liên quan đến miệng, ăn nói", example: "吃 (ăn), 喝 (uống), 叫 (kêu)" },
    { char: "氵", name: "Bộ Tam Điểm Thủy", pinyin: "shuǐ", meaning: "Liên quan đến nước, chất lỏng", example: "河 (sông), 海 (biển), 洗 (rửa)" },
    { char: "木", name: "Bộ Mộc", pinyin: "mù", meaning: "Liên quan đến cây cối, gỗ", example: "树 (cây), 桌 (bàn), 椅 (ghế)" },
    { char: "女", name: "Bộ Nữ", pinyin: "nǚ", meaning: "Liên quan đến phụ nữ, phái đẹp", example: "好 (tốt), 妈 (mẹ), 妹 (em gái)" },
    { char: "忄 / 心", name: "Bộ Tâm", pinyin: "xīn", meaning: "Liên quan đến tâm tư, cảm xúc", example: "想 (nhớ), 快 (vui), 懂 (hiểu)" },
    { char: "日", name: "Bộ Nhật", pinyin: "rì", meaning: "Liên quan đến mặt trời, thời gian", example: "明 (sáng), 早 (sớm), 时 (giờ)" },
    { char: "月", name: "Bộ Nguyệt", pinyin: "yuè", meaning: "Mặt trăng hoặc các bộ phận cơ thể (nhục)", example: "朋 (bạn), 肥 (béo), 肚 (bụng)" },
    { char: "火 / 灬", name: "Bộ Hỏa", pinyin: "huǒ", meaning: "Liên quan đến lửa, nhiệt độ", example: "热 (nóng), 烤 (nướng), 烧 (cháy)" },
    { char: "辶", name: "Bộ Quai Xước", pinyin: "chuò", meaning: "Liên quan đến di chuyển, bước đi", example: "进 (vào), 远 (xa), 近 (gần)" },
    { char: "讠", name: "Bộ Ngôn", pinyin: "yán", meaning: "Liên quan đến ngôn ngữ, lời nói", example: "说 (nói), 话 (lời), 语 (ngôn ngữ)" },
    { char: "饣", name: "Bộ Thực", pinyin: "shí", meaning: "Liên quan đến đồ ăn, ẩm thực", example: "饭 (cơm), 饱 (no), 饮 (uống)" },
    { char: "艹", name: "Bộ Thảo", pinyin: "cǎo", meaning: "Liên quan đến cỏ cây hoa lá", example: "茶 (trà), 花 (hoa), 药 (thuốc)" },
    { char: "目", name: "Bộ Mục", pinyin: "mù", meaning: "Liên quan đến mắt, nhìn ngắm", example: "看 (nhìn), 眼 (mắt), 睛 (tròng mắt)" },
    { char: "扌", name: "Bộ Thủ (tay)", pinyin: "shǒu", meaning: "Liên quan đến động tác của tay", example: "打 (đánh), 找 (tìm), 拿 (cầm)" },
    { char: "足 / 𧾷", name: "Bộ Túc (chân)", pinyin: "zú", meaning: "Liên quan đến bàn chân, bước chân", example: "跑 (chạy), 跳 (nhảy), 路 (đường)" }
  ]
};

// ==================== 2. KHO TỪ VỰNG TIẾNG TRUNG CHO NGƯỜI MỚI (HSK 1-2) ====================
const ZH_VOCABULARY_DATA = {
  basics: [
    {
      word: "我",
      phonetic: "wǒ",
      hanviet: "Ngã",
      meaning: "Tôi, ta, mình",
      example: "我是中国人，你呢？",
      examplePinyin: "Wǒ shì Zhōngguó rén, nǐ ne?",
      exampleVi: "Tôi là người Trung Quốc, còn bạn thì sao?",
    },
    {
      word: "你",
      phonetic: "nǐ",
      hanviet: "Nhĩ",
      meaning: "Bạn, anh, chị (ngôi thứ hai)",
      example: "你好，很高兴认识你！",
      examplePinyin: "Nǐ hǎo, hěn gāoxìng rènshí nǐ!",
      exampleVi: "Xin chào, rất vui được làm quen với bạn!",
    },
    {
      word: "他",
      phonetic: "tā",
      hanviet: "Tha",
      meaning: "Anh ấy, cậu ấy, ông ấy (nam giới)",
      example: "他是我的大学汉语老师。",
      examplePinyin: "Tā shì wǒ de dàxué Hànyǔ lǎoshī.",
      exampleVi: "Thầy ấy là giáo viên tiếng Trung đại học của tôi.",
    },
    {
      word: "她",
      phonetic: "tā",
      hanviet: "Tha (nữ)",
      meaning: "Cô ấy, chị ấy, bà ấy (nữ giới)",
      example: "她现在不在办公室。",
      examplePinyin: "Tā xiànzài bú zài bàngōngshì.",
      exampleVi: "Cô ấy hiện giờ không có ở văn phòng.",
    },
    {
      word: "我们",
      phonetic: "wǒmen",
      hanviet: "Ngã môn",
      meaning: "Chúng tôi, chúng ta",
      example: "我们一起学习汉语吧！",
      examplePinyin: "Wǒmen yìqǐ xuéxí Hànyǔ ba!",
      exampleVi: "Chúng ta cùng nhau học tiếng Trung đi!",
    },
    {
      word: "什么",
      phonetic: "shénme",
      hanviet: "Thập ma",
      meaning: "Cái gì, gì",
      example: "请问你叫什么名字？",
      examplePinyin: "Qǐngwèn nǐ jiào shénme míngzi?",
      exampleVi: "Xin hỏi bạn tên là gì?",
    },
    {
      word: "谁",
      phonetic: "shéi / shuí",
      hanviet: "Thùy",
      meaning: "Ai",
      example: "那位穿红衣服的人是谁？",
      examplePinyin: "Nà wèi chuān hóng yīfu de rén shì shéi?",
      exampleVi: "Người mặc áo màu đỏ kia là ai vậy?",
    },
    {
      word: "哪儿",
      phonetic: "nǎr",
      hanviet: "Nơi nào",
      meaning: "Ở đâu, chỗ nào",
      example: "请问洗手间在哪儿？",
      examplePinyin: "Qǐngwèn xǐshǒujiān zài nǎr?",
      exampleVi: "Xin hỏi nhà vệ sinh ở đâu?",
    },
    {
      word: "这 / 那",
      phonetic: "zhè / nà",
      hanviet: "Giá / Na",
      meaning: "Đây, này / Kia, đó",
      example: "这是我的书，那是他的电脑。",
      examplePinyin: "Zhè shì wǒ de shū, nà shì tā de diànnǎo.",
      exampleVi: "Đây là sách của tôi, kia là máy tính của anh ấy.",
    }
  ],

  greeting: [
    {
      word: "你好",
      phonetic: "nǐ hǎo",
      hanviet: "Nhĩ hảo",
      meaning: "Xin chào",
      example: "你好！很高兴认识你。",
      examplePinyin: "Nǐ hǎo! Hěn gāoxìng rènshi nǐ.",
      exampleVi: "Xin chào! Rất vui được quen biết bạn.",
    },
    {
      word: "早上好",
      phonetic: "zǎoshang hǎo",
      hanviet: "Tảo thượng hảo",
      meaning: "Chào buổi sáng",
      example: "大家早上好，今天开始新的工作。",
      examplePinyin: "Dàjiā zǎoshang hǎo, jīntiān kāishǐ xīn de gōngzuò.",
      exampleVi: "Chào buổi sáng mọi người, hôm nay bắt đầu công việc mới.",
    },
    {
      word: "谢谢",
      phonetic: "xièxie",
      hanviet: "Tạ tạ",
      meaning: "Cảm ơn",
      example: "谢谢你的热情帮助！",
      examplePinyin: "Xièxie nǐ de rèqíng bāngzhù!",
      exampleVi: "Cảm ơn sự giúp đỡ nhiệt tình của bạn!",
    },
    {
      word: "不客气",
      phonetic: "bú kèqì",
      hanviet: "Bất khách khí",
      meaning: "Không có chi, đừng khách sáo",
      example: "不用谢，不客气！",
      examplePinyin: "Bú yòng xiè, bú kèqì!",
      exampleVi: "Không cần cảm ơn, đừng khách sáo!",
    },
    {
      word: "对不起",
      phonetic: "duìbuqǐ",
      hanviet: "Đối bất khởi",
      meaning: "Xin lỗi",
      example: "对不起，我来晚了。",
      examplePinyin: "Duìbuqǐ, wǒ lái wǎn le.",
      exampleVi: "Xin lỗi, tôi đến muộn rồi.",
    },
    {
      word: "没关系",
      phonetic: "méi guānxi",
      hanviet: "Một quan hệ",
      meaning: "Không sao đâu, không hề gì",
      example: "没关系，下次注意就好。",
      examplePinyin: "Méi guānxi, xià cì zhùyì jiù hǎo.",
      exampleVi: "Không sao, lần sau chú ý là được rồi.",
    },
    {
      word: "再见",
      phonetic: "zàijiàn",
      hanviet: "Tái kiến",
      meaning: "Tạm biệt, hẹn gặp lại",
      example: "明天见，祝你周末愉快，再见！",
      examplePinyin: "Míngtiān jiàn, zhù nǐ zhōumò yúkuài, zàijiàn!",
      exampleVi: "Hẹn ngày mai gặp, chúc bạn cuối tuần vui vẻ, tạm biệt!",
    },
    {
      word: "请问",
      phonetic: "qǐngwèn",
      hanviet: "Thỉnh vấn",
      meaning: "Xin hỏi, làm phiền cho hỏi",
      example: "请问，去会议室怎么走？",
      examplePinyin: "Qǐngwèn, qù huìyìshì zěnme zǒu?",
      exampleVi: "Xin hỏi, đi đến phòng họp đi đường nào?",
    },
    {
      word: "麻烦你",
      phonetic: "máfan nǐ",
      hanviet: "Ma phiền nhĩ",
      meaning: "Làm phiền bạn, phiền bạn",
      example: "麻烦你帮我复印一下这份资料。",
      examplePinyin: "Máfan nǐ bāng wǒ fùyìn yíxià zhè fèn zīliào.",
      exampleVi: "Phiền bạn photo giúp tôi tài liệu này một chút.",
    }
  ],

  numbers: [
    {
      word: "一 二 三 四 五",
      phonetic: "yī, èr, sān, sì, wǔ",
      hanviet: "Nhất, Nhị, Tam, Tứ, Ngũ",
      meaning: "Số 1, 2, 3, 4, 5",
      example: "我有三个苹果。",
      examplePinyin: "Wǒ yǒu sān ge píngguǒ.",
      exampleVi: "Tôi có 3 quả táo.",
    },
    {
      word: "六 七 八 九 十",
      phonetic: "liù, qī, bā, jiǔ, shí",
      hanviet: "Lục, Thất, Bát, Cửu, Thập",
      meaning: "Số 6, 7, 8, 9, 10",
      example: "这本书十块钱。",
      examplePinyin: "Zhè běn shū shí kuài qián.",
      exampleVi: "Cuốn sách này 10 đồng.",
    },
    {
      word: "百 / 千 / 万",
      phonetic: "bǎi / qiān / wàn",
      hanviet: "Bách / Thiên / Vạn",
      meaning: "Trăm (100) / Nghìn (1.000) / Vạn (10.000)",
      example: "这部手机三千块。",
      examplePinyin: "Zhè bù shǒujī sānqiān kuài.",
      exampleVi: "Chiếc điện thoại này 3.000 tệ.",
    },
    {
      word: "两",
      phonetic: "liǎng",
      hanviet: "Lưỡng",
      meaning: "Hai (dùng trước lượng từ: 2 người, 2 cái)",
      example: "我要两个人吃套餐。",
      examplePinyin: "Wǒ yào liǎng ge rén chī tàocān.",
      exampleVi: "Tôi muốn set ăn dành cho 2 người.",
    },
    {
      word: "多少",
      phonetic: "duōshao",
      hanviet: "Đa thiểu",
      meaning: "Bao nhiêu",
      example: "请问这个多少钱？",
      examplePinyin: "Qǐngwèn zhè ge duōshao qián?",
      exampleVi: "Xin hỏi cái này bao nhiêu tiền?",
    },
    {
      word: "几",
      phonetic: "jǐ",
      hanviet: "Kỷ",
      meaning: "Mấy, bao nhiêu (thường dưới 10)",
      example: "现在几点？",
      examplePinyin: "Xiànzài jǐ diǎn?",
      exampleVi: "Bây giờ là mấy giờ?",
    }
  ],

  time: [
    {
      word: "今天",
      phonetic: "jīntiān",
      hanviet: "Kim thiên",
      meaning: "Hôm nay",
      example: "今天天气很好，阳光明媚。",
      examplePinyin: "Jīntiān tiānqì hěn hǎo, yángguāng míngmèi.",
      exampleVi: "Hôm nay thời tiết rất đẹp, trời nắng chan hòa.",
    },
    {
      word: "明天",
      phonetic: "míngtiān",
      hanviet: "Minh thiên",
      meaning: "Ngày mai",
      example: "明天上午九点准时开会。",
      examplePinyin: "Míngtiān shàngwǔ jiǔ diǎn zhǔnshí kāihuì.",
      exampleVi: "Sáng mai 9 giờ đúng họp.",
    },
    {
      word: "昨天",
      phonetic: "zuótiān",
      hanviet: "Tạc thiên",
      meaning: "Hôm qua",
      example: "昨天我买了一本汉语书。",
      examplePinyin: "Zuótiān wǒ mǎi le yì běn Hànyǔ shū.",
      exampleVi: "Hôm qua tôi đã mua một quyển sách tiếng Trung.",
    },
    {
      word: "星期 / 周",
      phonetic: "xīngqī / zhōu",
      hanviet: "Tinh kỳ / Chu",
      meaning: "Tuần, thứ trong tuần (Thứ 2 = 星期一)",
      example: "这个星期五我们有团建活动。",
      examplePinyin: "Zhè ge xīngqīwǔ wǒmen yǒu tuánjiàn huódòng.",
      exampleVi: "Thứ Sáu tuần này chúng ta có hoạt động team building.",
    },
    {
      word: "点 / 分",
      phonetic: "diǎn / fēn",
      hanviet: "Điểm / Phân",
      meaning: "Giờ / Phút (Thời gian)",
      example: "现在是早上八点三十分。",
      examplePinyin: "Xiànzài shì zǎoshang bā diǎn sānshí fēn.",
      exampleVi: "Bây giờ là 8 giờ 30 phút sáng.",
    },
    {
      word: "月 / 号 (日)",
      phonetic: "yuè / hào (rì)",
      hanviet: "Nguyệt / Hào (Nhật)",
      meaning: "Tháng / Ngày (ngày trong tháng)",
      example: "我的生日是十月八号。",
      examplePinyin: "Wǒ de shēngrì shì shí yuè bā hào.",
      exampleVi: "Sinh nhật của tôi là ngày 8 tháng 10.",
    },
    {
      word: "年",
      phonetic: "nián",
      hanviet: "Niên",
      meaning: "Năm",
      example: "我学了一年汉语了。",
      examplePinyin: "Wǒ xué le yì nián Hànyǔ le.",
      exampleVi: "Tôi đã học tiếng Trung được một năm rồi.",
    }
  ],

  family: [
    {
      word: "家",
      phonetic: "jiā",
      hanviet: "Gia",
      meaning: "Nhà, gia đình",
      example: "我家有四口人。",
      examplePinyin: "Wǒ jiā yǒu sì kǒu rén.",
      exampleVi: "Gia đình tôi có 4 người.",
    },
    {
      word: "爸爸",
      phonetic: "bàba",
      hanviet: "Bá bá",
      meaning: "Bố, ba",
      example: "我爸爸是医生。",
      examplePinyin: "Wǒ bàba shì yīshēng.",
      exampleVi: "Bố tôi là bác sĩ.",
    },
    {
      word: "妈妈",
      phonetic: "māma",
      hanviet: "Ma ma",
      meaning: "Mẹ, má",
      example: "我妈妈做的菜非常好吃。",
      examplePinyin: "Wǒ māma zuò de cài fēicháng hǎochī.",
      exampleVi: "Món mẹ tôi nấu rất ngon.",
    },
    {
      word: "哥哥 / 弟弟",
      phonetic: "gēge / dìdi",
      hanviet: "Ca ca / Đệ đệ",
      meaning: "Anh trai / Em trai",
      example: "我哥哥在北京工作。",
      examplePinyin: "Wǒ gēge zài Běijīng gōngzuò.",
      exampleVi: "Anh trai tôi làm việc ở Bắc Kinh.",
    },
    {
      word: "姐姐 / 妹妹",
      phonetic: "jiějie / mèimei",
      hanviet: "Tỷ tỷ / Muội muội",
      meaning: "Chị gái / Em gái",
      example: "我妹妹喜欢画画。",
      examplePinyin: "Wǒ mèimei xǐhuan huàhuà.",
      exampleVi: "Em gái tôi thích vẽ tranh.",
    },
    {
      word: "朋友",
      phonetic: "péngyou",
      hanviet: "Bằng hữu",
      meaning: "Bạn bè",
      example: "他是我的好朋友。",
      examplePinyin: "Tā shì wǒ de hǎo péngyou.",
      exampleVi: "Anh ấy là bạn thân của tôi.",
    }
  ],

  dining: [
    {
      word: "吃",
      phonetic: "chī",
      hanviet: "Cật",
      meaning: "Ăn",
      example: "你吃午饭了吗？",
      examplePinyin: "Nǐ chī wǔfàn le ma?",
      exampleVi: "Bạn đã ăn cơm trưa chưa?",
    },
    {
      word: "喝",
      phonetic: "hē",
      hanviet: "Hát",
      meaning: "Uống",
      example: "你想喝茶还是喝咖啡？",
      examplePinyin: "Nǐ xiǎng hē chá háishì hē kāfēi?",
      exampleVi: "Bạn muốn uống trà hay uống cà phê?",
    },
    {
      word: "水",
      phonetic: "shuǐ",
      hanviet: "Thủy",
      meaning: "Nước",
      example: "服务员，请给我一杯水。",
      examplePinyin: "Fúwùyuán, qǐng gěi wǒ yì bēi shuǐ.",
      exampleVi: "Phục vụ ơi, vui lòng cho tôi một cốc nước.",
    },
    {
      word: "菜 / 米饭",
      phonetic: "cài / mǐfàn",
      hanviet: "Thái / Mễ phạn",
      meaning: "Thức ăn, món ăn / Cơm trắng",
      example: "中国菜很有名。",
      examplePinyin: "Zhōngguó cài hěn yǒumíng.",
      exampleVi: "Món ăn Trung Quốc rất nổi tiếng.",
    },
    {
      word: "买单",
      phonetic: "mǎidān",
      hanviet: "Mãi đơn",
      meaning: "Thanh toán, tính tiền",
      example: "服务员，买单，可以微信支付吗？",
      examplePinyin: "Fúwùyuán, mǎidān, kěyǐ Wēixìn zhīfù ma?",
      exampleVi: "Phục vụ ơi tính tiền, có thể quẹt WeChat Pay không?",
    },
    {
      word: "好吃",
      phonetic: "hǎochī",
      hanviet: "Hảo cật",
      meaning: "Ngon (đồ ăn)",
      example: "这里的饺子真好吃！",
      examplePinyin: "Zhèlǐ de jiǎozi zhēn hǎochī!",
      exampleVi: "Bánh chẻo ở đây ngon thật đấy!",
    }
  ],

  office: [
    {
      word: "工作",
      phonetic: "gōngzuò",
      hanviet: "Công tác",
      meaning: "Làm việc, công việc",
      example: "你喜欢现在的工作吗？",
      examplePinyin: "Nǐ xǐhuan xiànzài de gōngzuò ma?",
      exampleVi: "Bạn có thích công việc hiện tại không?",
    },
    {
      word: "会议",
      phonetic: "huìyì",
      hanviet: "Hội nghị",
      meaning: "Cuộc họp, hội nghị",
      example: "下午两点我们有一个部门会议。",
      examplePinyin: "Xiàwǔ liǎng diǎn wǒmen yǒu yí ge bùmén huìyì.",
      exampleVi: "2 giờ chiều chúng ta có một cuộc họp phòng ban.",
    },
    {
      word: "邮件",
      phonetic: "yóujiàn",
      hanviet: "Bưu kiện / Thư",
      meaning: "Email, thư điện tử",
      example: "请查收我刚才发的邮件。",
      examplePinyin: "Qǐng cháchōu wǒ gāngcái fā de yóujiàn.",
      exampleVi: "Vui lòng kiểm tra email tôi vừa gửi.",
    },
    {
      word: "经理 / 老板",
      phonetic: "jīnglǐ / lǎobǎn",
      hanviet: "Kinh lý / Lão bản",
      meaning: "Giám đốc, quản lý / Sếp, ông chủ",
      example: "王经理在办公室等你。",
      examplePinyin: "Wáng jīnglǐ zài bàngōngshì děng nǐ.",
      exampleVi: "Giám đốc Vương đang đợi bạn ở văn phòng.",
    },
    {
      word: "公司",
      phonetic: "gōngsī",
      hanviet: "Công ty",
      meaning: "Công ty",
      example: "我们公司离地铁站很近。",
      examplePinyin: "Wǒmen gōngsī lí dìtiě zhàn hěn jìn.",
      exampleVi: "Công ty chúng tôi rất gần ga tàu điện ngầm.",
    }
  ],

  shopping: [
    {
      word: "买 / 卖",
      phonetic: "mǎi / mài",
      hanviet: "Mãi / Mại",
      meaning: "Mua / Bán",
      example: "我想买一件衣服。",
      examplePinyin: "Wǒ xiǎng mǎi yí jiàn yīfu.",
      exampleVi: "Tôi muốn mua một chiếc áo.",
    },
    {
      word: "贵 / 便宜",
      phonetic: "guì / piányi",
      hanviet: "Quý / Tiện nghi",
      meaning: "Đắt / Rẻ",
      example: "太贵了，能便宜一点吗？",
      examplePinyin: "Tài guì le, néng piányi yìdiǎn ma?",
      exampleVi: "Đắt quá, có thể rẻ hơn một chút không?",
    },
    {
      word: "钱",
      phonetic: "qián",
      hanviet: "Tiền",
      meaning: "Tiền bạc (Đơn vị: 块 kuài / 元 yuán)",
      example: "我没有带现金。",
      examplePinyin: "Wǒ méiyǒu dài xiànjīn.",
      exampleVi: "Tôi không mang theo tiền mặt.",
    },
    {
      word: "商店",
      phonetic: "shāngdiàn",
      hanviet: "Thương điếm",
      meaning: "Cửa hàng, tiệm",
      example: "我去商店买点水果。",
      examplePinyin: "Wǒ qù shāngdiàn mǎi diǎn shuǐguǒ.",
      exampleVi: "Tôi đi cửa hàng mua chút hoa quả.",
    }
  ],

  feelings: [
    {
      word: "高兴",
      phonetic: "gāoxìng",
      hanviet: "Cao hứng",
      meaning: "Vui vẻ, phấn khởi",
      example: "今天见到你很高兴！",
      examplePinyin: "Jīntiān jiàndào nǐ hěn gāoxìng!",
      exampleVi: "Hôm nay được gặp bạn rất vui!",
    },
    {
      word: "喜欢",
      phonetic: "xǐhuan",
      hanviet: "Hỷ hoan",
      meaning: "Thích, yêu thích",
      example: "我很喜欢学习中文。",
      examplePinyin: "Wǒ hěn xǐhuan xuéxí Zhōngwén.",
      exampleVi: "Tôi rất thích học tiếng Trung.",
    },
    {
      word: "累",
      phonetic: "lèi",
      hanviet: "Luy",
      meaning: "Mệt mỏi",
      example: "工作了一整天，觉得有点累。",
      examplePinyin: "Gōngzuò le yì zhěng tiān, juéde yǒudiǎn lèi.",
      exampleVi: "Làm việc cả ngày, cảm thấy hơi mệt mỏi.",
    },
    {
      word: "放心",
      phonetic: "fàngxīn",
      hanviet: "Phóng tâm",
      meaning: "Yên tâm, an tâm",
      example: "交给我办，请您放心！",
      examplePinyin: "Jiāo gěi wǒ bàn, qǐng nín fàngxīn!",
      exampleVi: "Giao cho tôi làm, xin ngài cứ yên tâm!",
    }
  ]
};

// ==================== 3. NGỮ PHÁP TIẾNG TRUNG NỀN TẢNG (GRAMMAR) ====================
const ZH_GRAMMAR_DATA = {
  sentence_order: [
    {
      title: "Trật tự câu cơ bản trong tiếng Trung",
      formula: "Chủ ngữ + (Thời gian) + (Địa điểm) + Động từ + Tân ngữ",
      usage: "Khác với tiếng Việt, trạng ngữ chỉ THỜI GIAN và ĐỊA ĐIỂM trong tiếng Trung bắt buộc phải đứng TRƯỚC động từ chính.",
      example: "我明天在图书馆看书。",
      examplePinyin: "Wǒ míngtiān zài túshūguǎn kàn shū.",
      exampleVi: "Tôi đọc sách ở thư viện vào ngày mai. (Không nói: 我看书在图书馆明天)",
      note: "Quy tắc vàng: 'Ai - Khi nào - Ở đâu - Làm gì'."
    }
  ],

  shi_sentence: [
    {
      title: "Câu phán đoán chữ 是 (shì - là)",
      formula: "Khẳng định: A + 是 + B | Phủ định: A + 不是 + B",
      usage: "Dùng để biểu thị A là B (nghề nghiệp, quốc tịch, danh tính...). Không dùng '是' trước tính từ đơn thuần.",
      example: "我是越南人，他不是老师。",
      examplePinyin: "Wǒ shì Yuènán rén, tā bú shì lǎoshī.",
      exampleVi: "Tôi là người Việt Nam, anh ấy không phải là giáo viên.",
      note: "Lưu ý: Nói 'Cô ấy rất đẹp' là '她很漂亮' (Tā hěn piàoliang), KHÔNG nói '她是漂亮'."
    }
  ],

  you_sentence: [
    {
      title: "Câu tồn tại & sở hữu chữ 有 (yǒu - có)",
      formula: "Khẳng định: A + 有 + B | Phủ định: A + 没有 + B",
      usage: "Dùng để biểu thị sự sở hữu (có cái gì) hoặc sự tồn tại ở một vị trí nào đó.",
      example: "我有两只猫。桌子上没有水。",
      examplePinyin: "Wǒ yǒu liǎng zhī māo. Zhuōzi shang méiyǒu shuǐ.",
      exampleVi: "Tôi có 2 con mèo. Trên bàn không có nước.",
      note: "Phủ định của '有' luôn luôn là '没有' (méiyǒu), tuyệt đối KHÔNG dùng '不有'."
    }
  ],

  questions: [
    {
      title: "Các dạng câu hỏi thông dụng (吗, 呢, 什么, 哪儿)",
      formula: "Câu trần thuật + 吗? | Đại từ/Danh từ + 呢? | Động từ + 什么?",
      usage: "1. '吗' (ma): Câu hỏi Có/Không? đặt cuối câu.\n2. '呢' (ne): Còn... thì sao?\n3. '什么' (shénme): Cái gì? (giữ nguyên vị trí tân ngữ).",
      example: "你是学生吗？我喝茶，你呢？你想买什么？",
      examplePinyin: "Nǐ shì xuésheng ma? Wǒ hē chá, nǐ ne? Nǐ xiǎng mǎi shénme?",
      exampleVi: "Bạn là học sinh phải không? Tôi uống trà, còn bạn? Bạn muốn mua cái gì?",
      note: "Trong câu hỏi có từ nghi vấn (什么, 谁, 哪儿) thì không được dùng kèm '吗'."
    }
  ],

  de_particle: [
    {
      title: "Trợ từ kết cấu 的 (de - của / bổ nghĩa)",
      formula: "Định ngữ + 的 + Trung tâm ngữ (Cái sở hữu/Tính chất + 的 + Danh từ chính)",
      usage: "Dùng để biểu thị quan hệ sở hữu ('của') hoặc khi cụm từ/tính từ bổ nghĩa cho danh từ đứng sau.",
      example: "这是我的书。漂亮的衣服。",
      examplePinyin: "Zhè shì wǒ de shū. Piàoliang de yīfu.",
      exampleVi: "Đây là sách của tôi. Quần áo đẹp.",
      note: "Quan hệ thân mật (bố mẹ, bạn bè) có thể lược bỏ '的': 我爸爸 (bố tôi)."
    }
  ],

  ba_sentence: [
    {
      title: "Câu chữ 把 (把字句 - Xử lý tân ngữ)",
      formula: "Chủ ngữ + 把 + Tân ngữ + Động từ + Thành phần khác",
      usage: "Dùng để nhấn mạnh hành động tác động làm thay đổi vị trí, trạng thái hoặc kết quả của tân ngữ.",
      example: "请把这份合同打印出来。",
      examplePinyin: "Qǐng bǎ zhè fèn hétong dǎyìn chūlái.",
      exampleVi: "Làm ơn in bản hợp đồng này ra giúp tôi.",
      note: "Động từ chính bắt buộc phải kèm thành phần khác (bổ ngữ, 了...), không đứng đơn độc."
    }
  ],

  bei_sentence: [
    {
      title: "Câu bị động chữ 被 (被字句)",
      formula: "Chủ ngữ + 被 (让/叫) + Tác nhân + Động từ + Thành phần khác",
      usage: "Dùng để biểu thị đối tượng chủ ngữ chịu sự tác động, biến đổi bởi một tác nhân bên ngoài.",
      example: "我的文件被同事不小心删除了。",
      examplePinyin: "Wǒ de wénjiàn bèi tóngshì bù xiǎoxīn shānchú le.",
      exampleVi: "Tài liệu của tôi bị đồng nghiệp vô tình xóa mất rồi.",
      note: "Trong khẩu ngữ thân mật thường dùng '让' (ràng) hoặc '叫' (jiào) thay cho '被'."
    }
  ],

  bijiao_sentence: [
    {
      title: "Câu so sánh chữ 比 (比字句)",
      formula: "A + 比 + B + Tính từ / (Động từ + Bổ ngữ)",
      usage: "Dùng để so sánh mức độ khác nhau giữa hai đối tượng A và B (A hơn B về mặt nào).",
      example: "今年的业绩比去年好很多。",
      examplePinyin: "Jīnnián de yèjì bǐ qùnián hǎo hěn duō.",
      exampleVi: "Thành tích năm nay tốt hơn năm ngoái rất nhiều.",
      note: "Không thêm các phó từ '很', '非常' ngay trước tính từ trong câu so sánh chữ 比."
    }
  ],

  aspect_particles: [
    {
      title: "Trợ từ động thái: 了, 着, 过",
      formula: "Động từ + 了 (Hoàn thành) / 着 (Tiếp diễn) / 过 (Đã từng trải qua)",
      usage: "Biểu thị trạng thái thời gian và khía cạnh diễn tiến của hành động.",
      example: "我看过这本书，现在正写着总结呢。",
      examplePinyin: "Wǒ kànguo zhè běn shū, xiànzài zhèng xiězhe zǒngjié ne.",
      exampleVi: "Tôi từng đọc cuốn sách này rồi, hiện giờ đang viết tóm tắt đây.",
      note: "'了' biểu thị hành động hoàn tất; '着' biểu thị trạng thái duy trì; '过' biểu thị kinh nghiệm từng trải qua."
    }
  ]
};

// ==================== 4. CÂU GIAO TIẾP THÔNG DỤNG (PHRASES) ====================
const ZH_PHRASES_DATA = {
  greeting: [
    {
      situation: "Chào hỏi lần đầu gặp gỡ",
      phrase: "初次见面，请多关照。",
      phonetic: "Chūcì jiànmiàn, qǐng duō guānzhào.",
      meaning: "Lần đầu gặp gỡ, xin được chỉ giáo và giúp đỡ nhiều hơn.",
    },
    {
      situation: "Hỏi thăm người quen lâu ngày",
      phrase: "好久不见，最近工作怎么样？",
      phonetic: "Hǎojiǔ bú jiàn, zuìjìn gōngzuò zěnmeyàng?",
      meaning: "Lâu rồi không gặp, dạo này công việc thế nào?",
    },
    {
      situation: "Hỏi tên lịch sự",
      phrase: "请问您贵姓？怎么称呼您？",
      phonetic: "Qǐngwèn nín guìxìng? Zěnme chēnghu nín?",
      meaning: "Xin hỏi quý danh của ngài là gì? Xưng hô với ngài thế nào ạ?",
    },
    {
      situation: "Tạm biệt và giữ liên lạc",
      phrase: "常联系，祝您工作顺利，下次见！",
      phonetic: "Cháng liánxì, zhù nín gōngzuò shùnlì, xià cì jiàn!",
      meaning: "Thường xuyên liên lạc nhé, chúc ngài công tác tốt, hẹn gặp lần sau!",
    }
  ],

  daily: [
    {
      situation: "Hỏi đường đi cơ bản",
      phrase: "请问去地铁站怎么走？",
      phonetic: "Qǐngwèn qù dìtiězhàn zěnme zǒu?",
      meaning: "Xin hỏi đi đến ga tàu điện ngầm đi đường nào?",
    },
    {
      situation: "Nhờ người khác nói chậm lại",
      phrase: "对不起，请您说慢一点，我汉语不太好。",
      phonetic: "Duìbuqǐ, qǐng nín shuō màn yìdiǎn, wǒ Hànyǔ bú tài hǎo.",
      meaning: "Xin lỗi, xin ngài nói chậm lại một chút, tiếng Trung của tôi chưa tốt lắm.",
    },
    {
      situation: "Hỏi thời gian hiện tại",
      phrase: "请问现在几点了？",
      phonetic: "Qǐngwèn xiànzài jǐ diǎn le?",
      meaning: "Xin hỏi bây giờ là mấy giờ rồi ạ?",
    },
    {
      situation: "Hỏi có thể giúp gì không",
      phrase: "请问有什么可以帮您的吗？",
      phonetic: "Qǐngwèn yǒu shénme kěyǐ bāng nín de ma?",
      meaning: "Xin hỏi có điều gì tôi có thể giúp được ngài không ạ?",
    }
  ],

  dining: [
    {
      situation: "Gọi phục vụ xin thực đơn",
      phrase: "服务员，请给我们一份菜单，准备点菜。",
      phonetic: "Fúwùyuán, qǐng gěi wǒmen yí fèn càidān, zhǔnbèi diǎncài.",
      meaning: "Phục vụ ơi, vui lòng cho xin thực đơn, chúng tôi chuẩn bị gọi món.",
    },
    {
      situation: "Hỏi món đặc sản của quán",
      phrase: "请问你们店里有什么招牌菜推荐？",
      phonetic: "Qǐngwèn nǐmen diàn lǐ yǒu shénme zhāopái cài tuījiàn?",
      meaning: "Xin hỏi nhà hàng mình có món ăn đặc trưng nào gợi ý không?",
    },
    {
      situation: "Yêu cầu không ăn cay",
      phrase: "我们不吃辣，请做清淡一点。",
      phonetic: "Wǒmen bù chī là, qǐng zuò qīngdàn yìdiǎn.",
      meaning: "Chúng tôi không ăn cay, xin hãy làm thanh đạm một chút.",
    },
    {
      situation: "Thanh toán hoá đơn",
      phrase: "服务员买单，可以微信或者支付宝支付吗？",
      phonetic: "Fúwùyuán mǎidān, kěyǐ Wēixìn huòzhě Zhīfùbǎo zhīfù ma?",
      meaning: "Phục vụ tính tiền giúp, có thể thanh toán qua WeChat hoặc Alipay không?",
    }
  ],

  shopping: [
    {
      situation: "Hỏi giá cả món đồ",
      phrase: "老板，请问这个多少钱一件？",
      phonetic: "Lǎobǎn, qǐngwèn zhè ge duōshao qián yí jiàn?",
      meaning: "Chủ quán ơi, xin hỏi cái này bao nhiêu tiền một chiếc?",
    },
    {
      situation: "Mặc cả / Trả giá",
      phrase: "太贵了，能便宜一点吗？",
      phonetic: "Tài guì le, néng piányi yìdiǎn ma?",
      meaning: "Đắt quá rồi, có thể giảm giá rẻ hơn chút không?",
    },
    {
      situation: "Muốn thử đồ",
      phrase: "请问我可以试穿一下这件衣服吗？",
      phonetic: "Qǐngwèn wǒ kěyǐ shìchuān yíxià zhè jiàn yīfu ma?",
      meaning: "Xin hỏi tôi có thể mặc thử chiếc áo này được không?",
    },
    {
      situation: "Đồng ý mua hàng",
      phrase: "好的，质量挺不错的，我就买这个了。",
      phonetic: "Hǎode, zhìliàng tǐng búcuò de, wǒ jiù mǎi zhè ge le.",
      meaning: "Được rồi, chất lượng rất tốt, tôi mua cái này nhé.",
    }
  ],

  work: [
    {
      situation: "Bắt đầu cuộc họp",
      phrase: "时间差不多了，我们现在开始开会吧。",
      phonetic: "Shíjiān chàbuduō le, wǒmen xiànzài kāishǐ kāihuì ba.",
      meaning: "Thời gian vừa vặn rồi, chúng ta bắt đầu cuộc họp bây giờ nhé.",
    },
    {
      situation: "Hỏi ý kiến đóng góp",
      phrase: "大家对这个方案有什么意见或建议吗？",
      phonetic: "Dàjiā duì zhè ge fāng'àn yǒu shénme yìjiàn huò jiànyì ma?",
      meaning: "Mọi người có ý kiến hoặc đề xuất gì cho phương án này không?",
    },
    {
      situation: "Báo cáo tiến độ hoàn thành",
      phrase: "本周的项目任务已经全部按时完成了。",
      phonetic: "Běn zhōu de xiàngmù rènwù yǐjīng quánbù ànshí wánchéng le.",
      meaning: "Nhiệm vụ dự án của tuần này đều đã hoàn thành đúng hạn.",
    },
    {
      situation: "Gửi tài liệu qua email",
      phrase: "我已经把详细资料发到您的电子邮箱了。",
      phonetic: "Wǒ yǐjīng bǎ xiángxì zīliào fā dào nín de diànzǐ yóuxiāng le.",
      meaning: "Tôi đã gửi tài liệu chi tiết vào hòm thư điện tử của ngài rồi.",
    }
  ],

  thanks: [
    {
      situation: "Cảm ơn chân thành",
      phrase: "非常感谢您的热情接待和大力支持！",
      phonetic: "Fēicháng gǎnxiè nín de rèqíng jiēdài hé dàlì zhīchí!",
      meaning: "Rất cảm ơn sự đón tiếp nồng hậu và sự ủng hộ to lớn của ngài!",
    },
    {
      situation: "Nhờ vả sự giúp đỡ",
      phrase: "不好意思打扰了，您能帮我一个忙吗？",
      phonetic: "Bù hǎoyìsi dǎrǎo le, nín néng bāng wǒ yí ge máng ma?",
      meaning: "Ngại quá làm phiền bạn rồi, bạn có thể giúp tôi một việc được không?",
    },
    {
      situation: "Xin lỗi vì sự bất tiện",
      phrase: "给您添麻烦了，真的非常抱歉！",
      phonetic: "Gěi nín tiān máfan le, zhēnde fēicháng bàoqiàn!",
      meaning: "Đã gây thêm phiền phức cho ngài, thật sự vô cùng xin lỗi!",
    }
  ]
};

// ==================== 5. DANH MỤC PHÂN LOẠI (CATEGORY MAPS) ====================
const ZH_VOCAB_CATEGORIES = {
  all: "Tất cả",
  basics: "Đại Từ & Nhập Môn",
  greeting: "Chào Hỏi & Xã Giao",
  numbers: "Số Đếm & Số Lượng",
  time: "Thời Gian & Ngày Tháng",
  family: "Gia Đình & Xưng Hô",
  dining: "Ăn Uống & Nhà Hàng",
  shopping: "Mua Sắm & Giá Cả",
  office: "Công Sở & Văn Phòng",
  feelings: "Cảm Xúc & Đời Sống",
};

const ZH_GRAMMAR_CATEGORIES = {
  all: "Tất cả",
  sentence_order: "Trật Tự Câu",
  shi_sentence: "Câu chữ 是 (Là)",
  you_sentence: "Câu chữ 有 (Có)",
  questions: "Câu Hỏi (吗/呢/什么)",
  de_particle: "Trợ từ 的",
  ba_sentence: "Câu chữ 把",
  bei_sentence: "Câu chữ 被",
  bijiao_sentence: "Câu chữ 比",
  aspect_particles: "Trợ từ 了/着/过",
};

const ZH_PHRASE_CATEGORIES = {
  all: "Tất cả",
  greeting: "Chào Hỏi & Giới Thiệu",
  daily: "Sinh Hoạt Thường Ngày",
  dining: "Ăn Uống & Nhà Hàng",
  shopping: "Mua Sắm & Giá Cả",
  work: "Công Việc & Họp Hành",
  thanks: "Cảm Ơn & Nhờ Vả",
};
