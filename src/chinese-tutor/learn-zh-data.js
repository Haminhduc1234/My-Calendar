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
  // 23 Thanh mẫu (Phụ âm đầu) - Chuẩn âm vị Hán ngữ quốc tế (汉语拼音声母表)
  initials: [
    { char: "b", pinyin: "b", sound: "bō", ipa: "[p]", tip: "Âm hai môi, không bật hơi, đọc giống 'p' tiếng Việt nhưng nhẹ hơn (VD: 八 bā - số 8)", hanziAudio: "玻", exampleWord: "八 bā (số 8)", exampleHanzi: "八" },
    { char: "p", pinyin: "p", sound: "pō", ipa: "[pʰ]", tip: "Âm hai môi, bật hơi thật mạnh luồng gió từ môi (VD: 跑 pǎo - chạy)", hanziAudio: "坡", exampleWord: "跑 pǎo (chạy)", exampleHanzi: "跑" },
    { char: "m", pinyin: "m", sound: "mō", ipa: "[m]", tip: "Âm mũi hai môi, đọc giống 'm' trong tiếng Việt (VD: 妈妈 māma - mẹ)", hanziAudio: "摸", exampleWord: "妈 mā (mẹ)", exampleHanzi: "妈" },
    { char: "f", pinyin: "f", sound: "fō", ipa: "[f]", tip: "Răng trên chạm môi dưới đẩy hơi, giống 'ph/f' tiếng Việt (VD: 发 fā - phát)", hanziAudio: "佛", exampleWord: "发 fā (phát)", exampleHanzi: "发" },
    { char: "d", pinyin: "d", sound: "dē", ipa: "[t]", tip: "Đầu lưỡi chạm chân răng trên, không bật hơi, đọc giống 't' tiếng Việt (VD: 大 dà - to lớn)", hanziAudio: "得", exampleWord: "大 dà (to lớn)", exampleHanzi: "大" },
    { char: "t", pinyin: "t", sound: "tè", ipa: "[tʰ]", tip: "Vị trí như 'd' nhưng bật hơi mạnh, đọc giống 'th' tiếng Việt (VD: 他 tā - anh ấy)", hanziAudio: "特", exampleWord: "他 tā (anh ấy)", exampleHanzi: "他" },
    { char: "n", pinyin: "n", sound: "nè", ipa: "[n]", tip: "Âm mũi đầu lưỡi, đọc giống 'n' trong tiếng Việt (VD: 你 nǐ - bạn)", hanziAudio: "讷", exampleWord: "你 nǐ (bạn)", exampleHanzi: "你" },
    { char: "l", pinyin: "l", sound: "lè", ipa: "[l]", tip: "Âm bên, đầu lưỡi chạm lợi trên, đọc giống 'l' tiếng Việt (VD: 来 lái - đến)", hanziAudio: "勒", exampleWord: "来 lái (đến)", exampleHanzi: "来" },
    { char: "g", pinyin: "g", sound: "gē", ipa: "[k]", tip: "Cuống lưỡi nâng lên ngạc mềm, không bật hơi, đọc giống 'c/k' tiếng Việt (VD: 高 gāo - cao)", hanziAudio: "哥", exampleWord: "高 gāo (cao)", exampleHanzi: "高" },
    { char: "k", pinyin: "k", sound: "kē", ipa: "[kʰ]", tip: "Cuống lưỡi bật hơi mạnh, đọc giống 'kh' bật gió (VD: 看 kàn - xem)", hanziAudio: "科", exampleWord: "看 kàn (xem)", exampleHanzi: "看" },
    { char: "h", pinyin: "h", sound: "hē", ipa: "[x]", tip: "Hơi cọ xát nhẹ qua cuống họng, lai giữa 'h' và 'kh' tiếng Việt (VD: 好 hǎo - tốt)", hanziAudio: "喝", exampleWord: "好 hǎo (tốt)", exampleHanzi: "好" },
    { char: "j", pinyin: "j", sound: "jī", ipa: "[tɕ]", tip: "Mặt lưỡi áp ngạc cứng, không bật hơi, đọc giống 'ch' nhẹ tiếng Việt (VD: 家 jiā - nhà)", hanziAudio: "基", exampleWord: "家 jiā (nhà)", exampleHanzi: "家" },
    { char: "q", pinyin: "q", sound: "qī", ipa: "[tɕʰ]", tip: "Mặt lưỡi bẹt, bật hơi cực mạnh từ kẽ răng (VD: 去 qù - đi)", hanziAudio: "欺", exampleWord: "去 qù (đi)", exampleHanzi: "去" },
    { char: "x", pinyin: "x", sound: "xī", ipa: "[ɕ]", tip: "Mặt lưỡi nâng sát ngạc cứng, ma sát nhẹ, đọc giống 'x' bẹt tiếng Việt (VD: 谢 xiè - cảm ơn)", hanziAudio: "希", exampleWord: "谢 xiè (cảm ơn)", exampleHanzi: "谢" },
    { char: "zh", pinyin: "zh", sound: "zhī", ipa: "[ʈʂ]", tip: "Uốn cong đầu lưỡi lên ngạc cứng, không bật hơi, đọc giống 'tr' tiếng Việt (VD: 中 zhōng - trung)", hanziAudio: "知", exampleWord: "中 zhōng (trung)", exampleHanzi: "中" },
    { char: "ch", pinyin: "ch", sound: "chī", ipa: "[ʈʂʰ]", tip: "Uốn cong đầu lưỡi lên ngạc cứng và bật hơi thật mạnh (VD: 吃 chī - ăn)", hanziAudio: "吃", exampleWord: "茶 chá (trà)", exampleHanzi: "茶" },
    { char: "sh", pinyin: "sh", sound: "shī", ipa: "[ʂ]", tip: "Uốn cong đầu lưỡi, ma sát thoát hơi, đọc giống 's' nặng tiếng Việt (VD: 书 shū - sách)", hanziAudio: "诗", exampleWord: "书 shū (sách)", exampleHanzi: "书" },
    { char: "r", pinyin: "r", sound: "rì", ipa: "[ʐ]", tip: "Uốn cong đầu lưỡi như 'sh' nhưng dây thanh rung nhẹ, giống 'r' tiếng Việt (VD: 人 rén - người)", hanziAudio: "日", exampleWord: "人 rén (người)", exampleHanzi: "人" },
    { char: "z", pinyin: "z", sound: "zī", ipa: "[ts]", tip: "Đầu lưỡi thẳng chạm mặt sau răng trên, không bật hơi, đọc giống 'ch/tz' (VD: 早 zǎo - sớm)", hanziAudio: "资", exampleWord: "早 zǎo (sớm)", exampleHanzi: "早" },
    { char: "c", pinyin: "c", sound: "cī", ipa: "[tsʰ]", tip: "Đầu lưỡi thẳng sát răng, bật hơi mạnh như tiếng xì hơi (VD: 菜 cài - món ăn)", hanziAudio: "疵", exampleWord: "菜 cài (món ăn)", exampleHanzi: "菜" },
    { char: "s", pinyin: "s", sound: "sī", ipa: "[s]", tip: "Đầu lưỡi thẳng sát chân răng trên, thoát hơi nhẹ, đọc giống 'x' tiếng Việt (VD: 三 sān - số 3)", hanziAudio: "思", exampleWord: "三 sān (số 3)", exampleHanzi: "三" },
    { char: "y", pinyin: "y", sound: "yī", ipa: "[j]", tip: "Bán nguyên âm /i/, đọc kéo dài như 'i/y' (VD: 月 yuè - trăng)", hanziAudio: "衣", exampleWord: "一 yī (số 1)", exampleHanzi: "一" },
    { char: "w", pinyin: "w", sound: "wū", ipa: "[w]", tip: "Bán nguyên âm /u/, tròn môi nhô ra như 'u/w' (VD: 我 wǒ - tôi)", hanziAudio: "乌", exampleWord: "五 wǔ (số 5)", exampleHanzi: "五" }
  ],
  // 36 Vận mẫu (Nguyên âm) - Chuẩn âm vị Hán ngữ (汉语拼音韵母表)
  finals: [
    { char: "a", pinyin: "a", sound: "ā", ipa: "[a]", tip: "Mở rộng miệng, hạ thấp lưỡi, đọc như 'a' (VD: 爸 bà)", hanziAudio: "啊" },
    { char: "o", pinyin: "o", sound: "ō", ipa: "[o]", tip: "Tròn môi nhô ra trước, đọc như 'ô' (VD: 窝 wō)", hanziAudio: "喔" },
    { char: "e", pinyin: "e", sound: "ē", ipa: "[ɤ]", tip: "Mở miệng vừa, khóe môi kéo nhẹ, đọc như 'ưa/ơ' (VD: 喝 hē)", hanziAudio: "婀" },
    { char: "i", pinyin: "i", sound: "yī", ipa: "[i]", tip: "Kéo mép sang hai bên như cười, đọc như 'i' (VD: 你 nǐ)", hanziAudio: "衣" },
    { char: "u", pinyin: "u", sound: "wū", ipa: "[u]", tip: "Tròn môi chúm lại nhô ra, đọc như 'u' (VD: 不 bù)", hanziAudio: "乌" },
    { char: "ü", pinyin: "ü", sound: "yū", ipa: "[y]", tip: "Giữ khẩu hình tròn môi 'u' nhưng phát ra âm 'i' (VD: 绿 lǜ)", hanziAudio: "迂" },
    { char: "ai", pinyin: "ai", sound: "āi", ipa: "[ai]", tip: "Trượt từ 'a' sang 'i', đọc giống 'ai' tiếng Việt (VD: 爱 ài - yêu)", hanziAudio: "哀" },
    { char: "ei", pinyin: "ei", sound: "ēi", ipa: "[ei]", tip: "Trượt từ 'e' sang 'i', đọc giống 'ây' tiếng Việt (VD: 累 lèi - mệt)", hanziAudio: "诶" },
    { char: "ao", pinyin: "ao", sound: "āo", ipa: "[au]", tip: "Trượt từ 'a' sang 'o', đọc giống 'ao' tiếng Việt (VD: 高 gāo - cao)", hanziAudio: "熬" },
    { char: "ou", pinyin: "ou", sound: "ōu", ipa: "[ou]", tip: "Trượt từ 'o' sang 'u', đọc giống 'âu' tiếng Việt (VD: 头 tóu - đầu)", hanziAudio: "欧" },
    { char: "an", pinyin: "an", sound: "ān", ipa: "[an]", tip: "Vận mẫu mũi trước, đầu lưỡi chạm lợi, đọc như 'an' (VD: 看 kàn - xem)", hanziAudio: "安" },
    { char: "en", pinyin: "en", sound: "ēn", ipa: "[ən]", tip: "Vận mẫu mũi trước, đọc giống 'ân' trong tiếng Việt (VD: 门 mén - cửa)", hanziAudio: "恩" },
    { char: "ang", pinyin: "ang", sound: "āng", ipa: "[aŋ]", tip: "Vận mẫu mũi sau, cuống lưỡi chạm ngạc mềm, giống 'ang' (VD: 忙 máng - bận)", hanziAudio: "肮" },
    { char: "eng", pinyin: "eng", sound: "ēng", ipa: "[əŋ]", tip: "Vận mẫu mũi sau, đọc giống 'âng' trong tiếng Việt (VD: 冷 lěng - lạnh)", hanziAudio: "鞥" },
    { char: "ong", pinyin: "ong", sound: "hōng", ipa: "[ʊŋ]", tip: "Tròn môi rồi khép cuống họng, đọc giống 'ung' (VD: 红 hóng - đỏ)", hanziAudio: "轰" },
    { char: "ia", pinyin: "ia", sound: "yā", ipa: "[ia]", tip: "Trượt từ 'i' sang 'a', đọc giống 'i-a' (VD: 家 jiā - nhà)", hanziAudio: "鸭" },
    { char: "ie", pinyin: "ie", sound: "yē", ipa: "[iɛ]", tip: "Trượt từ 'i' sang 'ê', đọc giống 'i-ê' (VD: 写 xiě - viết)", hanziAudio: "椰" },
    { char: "iao", pinyin: "iao", sound: "yāo", ipa: "[iau]", tip: "Trượt từ 'i' sang 'ao', đọc giống 'i-ao' (VD: 小 xiǎo - nhỏ)", hanziAudio: "腰" },
    { char: "iu", pinyin: "iu (iou)", sound: "yōu", ipa: "[iou]", tip: "Kết hợp 'i + ou', đọc giống 'iêu' tiếng Việt (VD: 六 liù - số 6)", hanziAudio: "优" },
    { char: "ian", pinyin: "ian", sound: "yān", ipa: "[iɛn]", tip: "Trượt từ 'i' sang 'en', đọc giống 'i-en' (VD: 天 tiān - trời)", hanziAudio: "烟" },
    { char: "in", pinyin: "in", sound: "yīn", ipa: "[in]", tip: "Đọc giống 'in' trong tiếng Việt (VD: 心 xīn - tim)", hanziAudio: "因" },
    { char: "iang", pinyin: "iang", sound: "yāng", ipa: "[iaŋ]", tip: "Trượt từ 'i' sang 'ang', giống 'i-ang' (VD: 想 xiǎng - nghĩ)", hanziAudio: "央" },
    { char: "ing", pinyin: "ing", sound: "yīng", ipa: "[iŋ]", tip: "Đọc giống 'inh' tiếng Việt nhưng ngân dài hơn (VD: 听 tīng - nghe)", hanziAudio: "英" },
    { char: "iong", pinyin: "iong", sound: "yōng", ipa: "[yʊŋ]", tip: "Trượt từ 'i' sang 'ong', giống 'i-ung' (VD: 穷 qióng - nghèo)", hanziAudio: "雍" },
    { char: "ua", pinyin: "ua", sound: "wā", ipa: "[ua]", tip: "Trượt từ 'u' sang 'a', đọc giống 'oa' tiếng Việt (VD: 花 huā - hoa)", hanziAudio: "蛙" },
    { char: "uo", pinyin: "uo", sound: "wō", ipa: "[uo]", tip: "Trượt từ 'u' sang 'o', đọc giống 'ua/uô' (VD: 多 duō - nhiều)", hanziAudio: "窝" },
    { char: "uai", pinyin: "uai", sound: "wāi", ipa: "[uai]", tip: "Trượt từ 'u' sang 'ai', đọc giống 'oai' (VD: 快 kuài - nhanh)", hanziAudio: "歪" },
    { char: "ui", pinyin: "ui (uei)", sound: "wēi", ipa: "[uei]", tip: "Kết hợp 'u + ei', đọc giống 'uây' (VD: 水 shuǐ - nước)", hanziAudio: "威" },
    { char: "uan", pinyin: "uan", sound: "wān", ipa: "[uan]", tip: "Trượt từ 'u' sang 'an', đọc giống 'oan' (VD: 关 guān - đóng)", hanziAudio: "弯" },
    { char: "un", pinyin: "un (uen)", sound: "wēn", ipa: "[uən]", tip: "Kết hợp 'u + en', đọc giống 'uân' (VD: 问 wèn - hỏi)", hanziAudio: "温" },
    { char: "uang", pinyin: "uang", sound: "wāng", ipa: "[uaŋ]", tip: "Trượt từ 'u' sang 'ang', đọc giống 'oang' (VD: 光 guāng - sáng)", hanziAudio: "汪" },
    { char: "üe", pinyin: "üe", sound: "yuē", ipa: "[yɛ]", tip: "Khẩu hình tròn môi từ 'ü' trượt sang 'ê' (VD: 月 yuè - tháng)", hanziAudio: "约" },
    { char: "üan", pinyin: "üan", sound: "yuān", ipa: "[yɛn]", tip: "Khẩu hình tròn môi từ 'ü' trượt sang 'en' (VD: 远 yuǎn - xa)", hanziAudio: "冤" },
    { char: "ün", pinyin: "ün", sound: "yūn", ipa: "[yn]", tip: "Khẩu hình tròn môi từ 'ü' sang 'n' (VD: 裙 qún - váy)", hanziAudio: "晕" },
    { char: "er", pinyin: "er", sound: "ér", ipa: "[ɑɻ]", tip: "Vận mẫu uốn lưỡi đặc biệt, đọc 'ơ' uốn cong đầu lưỡi (VD: 儿 ér - con)", hanziAudio: "儿" }
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
    { char: "亻", name: "Bộ Nhân đứng", pinyin: "rén", speakText: "人", meaning: "Liên quan đến con người", example: "你 (bạn), 他 (anh ấy)" },
    { char: "口", name: "Bộ Khẩu", pinyin: "kǒu", speakText: "口", meaning: "Liên quan đến miệng, ăn nói", example: "吃 (ăn), 喝 (uống), 叫 (kêu)" },
    { char: "氵", name: "Bộ Tam Điểm Thủy", pinyin: "shuǐ", speakText: "水", meaning: "Liên quan đến nước, chất lỏng", example: "河 (sông), 海 (biển), 洗 (rửa)" },
    { char: "木", name: "Bộ Mộc", pinyin: "mù", speakText: "木", meaning: "Liên quan đến cây cối, gỗ", example: "树 (cây), 桌 (bàn), 椅 (ghế)" },
    { char: "女", name: "Bộ Nữ", pinyin: "nǚ", speakText: "女", meaning: "Liên quan đến phụ nữ, phái đẹp", example: "好 (tốt), 妈 (mẹ), 妹 (em gái)" },
    { char: "忄 / 心", name: "Bộ Tâm", pinyin: "xīn", speakText: "心", meaning: "Liên quan đến tâm tư, cảm xúc", example: "想 (nhớ), 快 (vui), 懂 (hiểu)" },
    { char: "日", name: "Bộ Nhật", pinyin: "rì", speakText: "日", meaning: "Liên quan đến mặt trời, thời gian", example: "明 (sáng), 早 (sớm), 时 (giờ)" },
    { char: "月", name: "Bộ Nguyệt", pinyin: "yuè", speakText: "月", meaning: "Mặt trăng hoặc các bộ phận cơ thể (nhục)", example: "朋 (bạn), 肥 (béo), 肚 (bụng)" },
    { char: "火 / 灬", name: "Bộ Hỏa", pinyin: "huǒ", speakText: "火", meaning: "Liên quan đến lửa, nhiệt độ", example: "热 (nóng), 烤 (nướng), 烧 (cháy)" },
    { char: "辶", name: "Bộ Quai Xước", pinyin: "chuò", speakText: "走", meaning: "Liên quan đến di chuyển, bước đi", example: "进 (vào), 远 (xa), 近 (gần)" },
    { char: "讠", name: "Bộ Ngôn", pinyin: "yán", speakText: "言", meaning: "Liên quan đến ngôn ngữ, lời nói", example: "说 (nói), 话 (lời), 语 (ngôn ngữ)" },
    { char: "饣", name: "Bộ Thực", pinyin: "shí", speakText: "食", meaning: "Liên quan đến đồ ăn, ẩm thực", example: "饭 (cơm), 饱 (no), 饮 (uống)" },
    { char: "艹", name: "Bộ Thảo", pinyin: "cǎo", speakText: "草", meaning: "Liên quan đến cỏ cây hoa lá", example: "茶 (trà), 花 (hoa), 药 (thuốc)" },
    { char: "目", name: "Bộ Mục", pinyin: "mù", speakText: "目", meaning: "Liên quan đến mắt, nhìn ngắm", example: "看 (nhìn), 眼 (mắt), 睛 (tròng mắt)" },
    { char: "扌", name: "Bộ Thủ (tay)", pinyin: "shǒu", speakText: "手", meaning: "Liên quan đến động tác của tay", example: "打 (đánh), 找 (tìm), 拿 (cầm)" },
    { char: "足 / 𧾷", name: "Bộ Túc (chân)", pinyin: "zú", speakText: "足", meaning: "Liên quan đến bàn chân, bước chân", example: "跑 (chạy), 跳 (nhảy), 路 (đường)" }
  ],

  // Các chữ Hán tiêu biểu để luyện viết nét bút
  practiceChars: [
    { char: "你", pinyin: "nǐ", hanviet: "Nhĩ", meaning: "Bạn, anh, chị" },
    { char: "好", pinyin: "hǎo", hanviet: "Hảo", meaning: "Tốt, đẹp, hay" },
    { char: "我", pinyin: "wǒ", hanviet: "Ngã", meaning: "Tôi, mình, ta" },
    { char: "中", pinyin: "zhōng", hanviet: "Trung", meaning: "Ở giữa, Trung Quốc" },
    { char: "国", pinyin: "guó", hanviet: "Quốc", meaning: "Đất nước, quốc gia" },
    { char: "爱", pinyin: "ài", hanviet: "Ái", meaning: "Yêu, thương" },
    { char: "学", pinyin: "xué", hanviet: "Học", meaning: "Học tập" },
    { char: "生", pinyin: "shēng", hanviet: "Sinh", meaning: "Học sinh, sinh sống" },
    { char: "家", pinyin: "jiā", hanviet: "Gia", meaning: "Nhà, gia đình" },
    { char: "福", pinyin: "fú", hanviet: "Phúc", meaning: "Phúc lành, may mắn" },
    { char: "春", pinyin: "chūn", hanviet: "Xuân", meaning: "Mùa xuân" },
    { char: "龙", pinyin: "lóng", hanviet: "Long", meaning: "Con rồng" },
    { char: "茶", pinyin: "chá", hanviet: "Trà", meaning: "Trà, chè" },
    { char: "心", pinyin: "xīn", hanviet: "Tâm", meaning: "Trái tim, tấm lòng" }
  ],

  // Các cặp âm dễ nhầm lẫn cho người Việt (Confusion Pairs)
  confusionPairs: [
    {
      groupName: "Âm bật hơi vs Không bật hơi (送气 vs 不送气)",
      groupTip: "Đặt tay trước miệng khi phát âm: âm bật hơi sẽ có luồng gió mạnh thổi vào lòng bàn tay, âm không bật hơi thì không có.",
      pairs: [
        { left: "b [p]", right: "p [pʰ]", leftDesc: "Không bật hơi", rightDesc: "Bật hơi mạnh", leftExample: "八 bā (tám)", rightExample: "怕 pà (sợ)", leftAudio: "八", rightAudio: "怕", tip: "'b' đọc giống 'p' tiếng Việt (nhẹ, không gió). 'p' bật hơi mạnh hơn nhiều." },
        { left: "d [t]", right: "t [tʰ]", leftDesc: "Không bật hơi", rightDesc: "Bật hơi mạnh", leftExample: "大 dà (to)", rightExample: "他 tā (anh ấy)", leftAudio: "大", rightAudio: "他", tip: "'d' đọc giống 't' tiếng Việt (nhẹ). 't' bật luồng gió mạnh giống 'th' tiếng Việt." },
        { left: "g [k]", right: "k [kʰ]", leftDesc: "Không bật hơi", rightDesc: "Bật hơi mạnh", leftExample: "高 gāo (cao)", rightExample: "看 kàn (xem)", leftAudio: "高", rightAudio: "看", tip: "'g' đọc giống 'c/k' tiếng Việt (nhẹ). 'k' bật hơi mạnh giống 'kh' bật gió." },
        { left: "j [tɕ]", right: "q [tɕʰ]", leftDesc: "Không bật hơi", rightDesc: "Bật hơi mạnh", leftExample: "家 jiā (nhà)", rightExample: "去 qù (đi)", leftAudio: "家", rightAudio: "去", tip: "'j' mặt lưỡi áp nhẹ ngạc. 'q' vị trí giống 'j' nhưng bật gió cực mạnh." },
        { left: "z [ts]", right: "c [tsʰ]", leftDesc: "Không bật hơi", rightDesc: "Bật hơi mạnh", leftExample: "早 zǎo (sớm)", rightExample: "菜 cài (rau)", leftAudio: "早", rightAudio: "菜", tip: "'z' đầu lưỡi chạm răng, không gió. 'c' bật hơi mạnh như tiếng xì." },
        { left: "zh [ʈʂ]", right: "ch [ʈʂʰ]", leftDesc: "Không bật hơi", rightDesc: "Bật hơi mạnh", leftExample: "中 zhōng (giữa)", rightExample: "吃 chī (ăn)", leftAudio: "中", rightAudio: "吃", tip: "Cả 2 đều uốn lưỡi. 'zh' không bật hơi giống 'tr'. 'ch' bật hơi rất mạnh." }
      ]
    },
    {
      groupName: "Âm uốn lưỡi vs Âm bẹt lưỡi (翘舌音 vs 平舌音)",
      groupTip: "Âm uốn lưỡi (zh, ch, sh, r): đầu lưỡi uốn cong lên chạm ngạc cứng. Âm bẹt lưỡi (z, c, s): đầu lưỡi để thẳng chạm mặt sau răng trên.",
      pairs: [
        { left: "zh [ʈʂ]", right: "z [ts]", leftDesc: "Uốn lưỡi", rightDesc: "Bẹt lưỡi", leftExample: "知 zhī (biết)", rightExample: "字 zì (chữ)", leftAudio: "知道", rightAudio: "字", tip: "'zh': uốn cong đầu lưỡi lên ngạc cứng. 'z': đầu lưỡi thẳng chạm mặt sau răng trên." },
        { left: "ch [ʈʂʰ]", right: "c [tsʰ]", leftDesc: "Uốn lưỡi", rightDesc: "Bẹt lưỡi", leftExample: "吃 chī (ăn)", rightExample: "次 cì (lần)", leftAudio: "吃", rightAudio: "次", tip: "'ch': uốn lưỡi + bật hơi. 'c': lưỡi thẳng + bật hơi. Vị trí lưỡi là khác biệt chính." },
        { left: "sh [ʂ]", right: "s [s]", leftDesc: "Uốn lưỡi", rightDesc: "Bẹt lưỡi", leftExample: "书 shū (sách)", rightExample: "四 sì (bốn)", leftAudio: "书", rightAudio: "四", tip: "'sh': uốn cong lưỡi, âm dày hơn. 's': lưỡi thẳng sát răng, đọc như 'x' tiếng Việt." },
        { left: "r [ʐ]", right: "l [l]", leftDesc: "Uốn lưỡi rung", rightDesc: "Âm bên", leftExample: "人 rén (người)", rightExample: "冷 lěng (lạnh)", leftAudio: "人", rightAudio: "冷", tip: "'r': uốn cong lưỡi rung nhẹ. 'l': đầu lưỡi chạm lợi trên, giống 'l' tiếng Việt." }
      ]
    },
    {
      groupName: "Âm mũi cuối -n vs -ng (前鼻音 vs 后鼻音)",
      groupTip: "'-n': đầu lưỡi chạm lợi trên (giống 'n' tiếng Việt). '-ng': cuống lưỡi nâng lên chạm ngạc mềm (giống 'ng' tiếng Việt).",
      pairs: [
        { left: "an [an]", right: "ang [aŋ]", leftDesc: "Mũi trước -n", rightDesc: "Mũi sau -ng", leftExample: "看 kàn (xem)", rightExample: "忙 máng (bận)", leftAudio: "看", rightAudio: "忙", tip: "'an': miệng mở, kết thúc bằng đầu lưỡi chạm lợi. 'ang': miệng mở rộng hơn, kết thúc bằng cuống lưỡi." },
        { left: "en [ən]", right: "eng [əŋ]", leftDesc: "Mũi trước -n", rightDesc: "Mũi sau -ng", leftExample: "门 mén (cửa)", rightExample: "冷 lěng (lạnh)", leftAudio: "门", rightAudio: "冷", tip: "'en': đọc giống 'ân' tiếng Việt. 'eng': đọc giống 'âng' tiếng Việt." },
        { left: "in [in]", right: "ing [iŋ]", leftDesc: "Mũi trước -n", rightDesc: "Mũi sau -ng", leftExample: "心 xīn (tim)", rightExample: "听 tīng (nghe)", leftAudio: "心", rightAudio: "听", tip: "'in': đọc giống 'in' tiếng Việt. 'ing': đọc giống 'inh' tiếng Việt, ngân dài hơn." }
      ]
    }
  ]
};

// ==================== 2. KHO TỪ VỰNG TIẾNG TRUNG CHO NGƯỜI MỚI (HSK 1-2) ====================
const ZH_VOCABULARY_DATA = {
  hsk1: [],
  hsk2: [],
  hsk3: [],
  hsk4: [],
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
  ],

  // ==================== TỪ VỰNG HSK 3 (TRUNG CẤP NỀN TẢNG) ====================
  travel: [
    {
      word: "机场",
      phonetic: "jīchǎng",
      hanviet: "Cơ trường",
      level: "HSK 3",
      meaning: "Sân bay, phi trường",
      example: "我们必须提前两个小时到达机场。",
      examplePinyin: "Wǒmen bìxū tíqián liǎng ge xiǎoshí dàodá jīchǎng.",
      exampleVi: "Chúng ta phải đến sân bay trước hai tiếng đồng hồ."
    },
    {
      word: "护照",
      phonetic: "hùzhào",
      hanviet: "Hộ chiếu",
      level: "HSK 3",
      meaning: "Hộ chiếu (Passport)",
      example: "请出示您的护照和登机牌。",
      examplePinyin: "Qǐng chūshì nín de hùzhào hé dēngjīpái.",
      exampleVi: "Vui lòng xuất trình hộ chiếu và thẻ lên máy bay của quý khách."
    },
    {
      word: "行李",
      phonetic: "xíngli",
      hanviet: "Hành lý",
      level: "HSK 3",
      meaning: "Hành lý, va-li mang theo",
      example: "你的行李箱超重了，需要托运。",
      examplePinyin: "Nǐ de xínglixiāng chāozhòng le, xūyào tuōyùn.",
      exampleVi: "Va-li hành lý của bạn quá cân rồi, cần phải ký gửi."
    },
    {
      word: "地铁",
      phonetic: "dìtiě",
      hanviet: "Địa thiết",
      level: "HSK 3",
      meaning: "Tàu điện ngầm",
      example: "坐地铁去市中心既方便又快捷。",
      examplePinyin: "Zuò dìtiě qù shìzhōngxīn jì fāngbiàn yòu kuàijié.",
      exampleVi: "Đi tàu điện ngầm vào trung tâm thành phố vừa tiện vừa nhanh."
    },
    {
      word: "出租车",
      phonetic: "chūzūchē",
      hanviet: "Xuất tô xa",
      level: "HSK 3",
      meaning: "Xe taxi",
      example: "外面下大雨了，我们打出租车回家吧。",
      examplePinyin: "Wàimiàn xià dàyǔ le, wǒmen dǎ chūzūchē huíjiā ba.",
      exampleVi: "Bên ngoài mưa to rồi, chúng ta bắt taxi về nhà đi."
    },
    {
      word: "宾馆",
      phonetic: "bīnguǎn",
      hanviet: "Tân quán",
      level: "HSK 3",
      meaning: "Khách sạn, nhà khách",
      example: "我已经网上预订了这家五星级宾馆。",
      examplePinyin: "Wǒ yǐjīng wǎngshang yùdìng le zhè jiā wǔxīngjí bīnguǎn.",
      exampleVi: "Tôi đã đặt trước khách sạn 5 sao này trên mạng rồi."
    },
    {
      word: "航班",
      phonetic: "hángbān",
      hanviet: "Hàng ban",
      level: "HSK 3",
      meaning: "Chuyến bay",
      example: "因为天气原因，今天的航班延误了。",
      examplePinyin: "Yīnwèi tiānqì yuányīn, jīntiān de hángbān yánwù le.",
      exampleVi: "Vì nguyên nhân thời tiết, chuyến bay hôm nay đã bị hoãn."
    },
    {
      word: "路线",
      phonetic: "lùxiàn",
      hanviet: "Lộ tuyến",
      level: "HSK 3",
      meaning: "Tuyến đường, lịch trình đi",
      example: "请在手机地图上查看最佳旅游路线。",
      examplePinyin: "Qǐng zài shǒujī dìtú shang chákàn zuì jiā lǚyóu lùxiàn.",
      exampleVi: "Vui lòng xem lộ trình du lịch tối ưu nhất trên bản đồ điện thoại."
    }
  ],

  study: [
    {
      word: "成绩",
      phonetic: "chéngjì",
      hanviet: "Thành tích",
      level: "HSK 3",
      meaning: "Thành tích, điểm số",
      example: "他的汉语水平考试成绩非常优异。",
      examplePinyin: "Tā de Hànyǔ shuǐpíng kǎoshì chéngjì fēicháng yōuyì.",
      exampleVi: "Điểm thi HSK của cậu ấy vô cùng xuất sắc."
    },
    {
      word: "考试",
      phonetic: "kǎoshì",
      hanviet: "Khảo thí",
      level: "HSK 3",
      meaning: "Thi cử, bài kiểm tra",
      example: "下周一上午我们要进行期末考试。",
      examplePinyin: "Xià zhōuyī shàngwǔ wǒmen yào jìnxíng qīmò kǎoshì.",
      exampleVi: "Sáng thứ Hai tuần tới chúng ta sẽ thi học kỳ."
    },
    {
      word: "复习",
      phonetic: "fùxí",
      hanviet: "Phục tập",
      level: "HSK 3",
      meaning: "Ôn tập bài học",
      example: "每天睡觉前复习半小时生词。",
      examplePinyin: "Měitiān shuìjiào qián fùxí bàn xiǎoshí shēngcí.",
      exampleVi: "Mỗi ngày trước khi đi ngủ ôn tập từ mới nửa tiếng."
    },
    {
      word: "简单",
      phonetic: "jiǎndān",
      hanviet: "Giản đơn",
      level: "HSK 3",
      meaning: "Đơn giản, dễ dàng",
      example: "这道数学题其实并不简单。",
      examplePinyin: "Zhè dào shùxuétí qíshí bìng bù jiǎndān.",
      exampleVi: "Câu toán này thực ra không hề đơn giản chút nào."
    },
    {
      word: "难",
      phonetic: "nán",
      hanviet: "Nan",
      level: "HSK 3",
      meaning: "Khó, phức tạp",
      example: "学写汉字虽然有点难，但很有趣。",
      examplePinyin: "Xué xiě hànzì suīrán yǒudiǎn nán, dàn hěn yǒuqù.",
      exampleVi: "Học viết chữ Hán tuy hơi khó nhưng rất thú vị."
    },
    {
      word: "提高",
      phonetic: "tígāo",
      hanviet: "Đề cao",
      level: "HSK 3",
      meaning: "Nâng cao, cải thiện",
      example: "多听广播能快速提高中文听力水平。",
      examplePinyin: "Duō tīng guǎngbō néng kuàisù tígāo Zhōngwén tīnglì shuǐpíng.",
      exampleVi: "Nghe nhiều đài phát thanh giúp nâng cao trình độ nghe tiếng Trung nhanh chóng."
    },
    {
      word: "练习",
      phonetic: "liànxí",
      hanviet: "Luyện tập",
      level: "HSK 3",
      meaning: "Luyện tập, bài tập rèn luyện",
      example: "做完课后练习才能巩固知识。",
      examplePinyin: "Zuò wán kèhòu liànxí cái néng gǒnggù zhīshi.",
      exampleVi: "Làm xong bài tập sau giờ học mới củng cố được kiến thức."
    },
    {
      word: "解决",
      phonetic: "jiějué",
      hanviet: "Giải quyết",
      level: "HSK 3",
      meaning: "Giải quyết (vấn đề, khó khăn)",
      example: "老师耐心地帮我们解决语法难题。",
      examplePinyin: "Lǎoshī nàixīn de bāng wǒmen jiějué yǔfǎ nántí.",
      exampleVi: "Thầy giáo kiên nhẫn giúp chúng tôi giải quyết các bài toán ngữ pháp hóc búa."
    }
  ],

  health_zh: [
    {
      word: "感冒",
      phonetic: "gǎnmào",
      hanviet: "Cảm mạo",
      level: "HSK 3",
      meaning: "Bị cảm lạnh, cảm cúm",
      example: "天气突然变冷，我不小心感冒了。",
      examplePinyin: "Tiānqì tūrán biàn lěng, wǒ bù xiǎoxīn gǎnmào le.",
      exampleVi: "Thời tiết đột ngột trở lạnh, tôi vô tình bị cảm rồi."
    },
    {
      word: "发烧",
      phonetic: "fāshāo",
      hanviet: "Phát thiêu",
      level: "HSK 3",
      meaning: "Bị sốt, phát sốt",
      example: "他今天发烧到三十八度五，请假在家休息。",
      examplePinyin: "Tā jīntiān fāshāo dào sānshíbā dù wǔ, qǐngjià zài jiā xiūxi.",
      exampleVi: "Hôm nay cậu ấy sốt tới 38 độ 5, đã xin nghỉ ở nhà tịnh dưỡng."
    },
    {
      word: "检查",
      phonetic: "jiǎnchá",
      hanviet: "Kiểm tra",
      level: "HSK 3",
      meaning: "Khám bệnh, kiểm tra",
      example: "医生建议他每年去医院做一次全面体检。",
      examplePinyin: "Yīshēng jiànyì tā měinián qù yīyuàn zuò yí cì quánmiàn tǐjiǎn.",
      exampleVi: "Bác sĩ khuyên anh ấy mỗi năm nên đi bệnh viện khám sức khỏe tổng quát một lần."
    },
    {
      word: "药",
      phonetic: "yào",
      hanviet: "Dược",
      level: "HSK 3",
      meaning: "Thuốc, viên thuốc",
      example: "这种药一日三次，饭后温水送服。",
      examplePinyin: "Zhè zhǒng yào yí rì sān cì, fànhòu wēnshuǐ sòng fú.",
      exampleVi: "Loại thuốc này ngày uống ba lần, uống sau bữa ăn cùng nước ấm."
    },
    {
      word: "身体",
      phonetic: "shēntǐ",
      hanviet: "Thân thể",
      level: "HSK 3",
      meaning: "Cơ thể, sức khỏe",
      example: "祝您身体健康，万事如意！",
      examplePinyin: "Zhù nín shēntǐ jiànkāng, wànshì rúyì!",
      exampleVi: "Kính chúc ngài dồi dào sức khỏe, vạn sự như ý!"
    },
    {
      word: "锻炼",
      phonetic: "duànliàn",
      hanviet: "Đoàn luyện",
      level: "HSK 3",
      meaning: "Rèn luyện thân thể, tập thể dục",
      example: "坚持晨跑是锻炼身体的好方法。",
      examplePinyin: "Jiānchí chénpǎo shì duànliàn shēntǐ de hǎo fāngfǎ.",
      exampleVi: "Kiên trì chạy bộ buổi sáng là phương pháp rèn luyện sức khỏe rất tốt."
    },
    {
      word: "舒服",
      phonetic: "shūfu",
      hanviet: "Thư phục",
      level: "HSK 3",
      meaning: "Dễ chịu, thoải mái",
      example: "喝了一杯热茶，感觉舒服多了。",
      examplePinyin: "Hē le yì bēi rèchá, gǎnjué shūfu duō le.",
      exampleVi: "Uống một tách trà nóng, cảm thấy dễ chịu hơn nhiều rồi."
    }
  ],

  environment: [
    {
      word: "环境",
      phonetic: "huánjìng",
      hanviet: "Hoàn cảnh",
      level: "HSK 3",
      meaning: "Môi trường sống, cảnh quan xung quanh",
      example: "学校周围的环境非常安静优美。",
      examplePinyin: "Xuéxiào zhōuwéi de huánjìng fēicháng ānjìng yōuměi.",
      exampleVi: "Môi trường xung quanh trường học rất yên tĩnh và trong lành."
    },
    {
      word: "空气",
      phonetic: "kōngqì",
      hanviet: "Không khí",
      level: "HSK 3",
      meaning: "Không khí, bầu khí quyển",
      example: "森林里的空气十分清新。",
      examplePinyin: "Sēnlín lǐ de kōngqì shífēn qīngxīn.",
      exampleVi: "Không khí trong rừng cây vô cùng mát lành, tươi mới."
    },
    {
      word: "刮风",
      phonetic: "guāfēng",
      hanviet: "Quát phong",
      level: "HSK 3",
      meaning: "Gió thổi, nổi gió",
      example: "外面开始刮大风了，快关上窗户。",
      examplePinyin: "Wàimiàn kāishǐ guā dàfēng le, kuài guānshang chuānghu.",
      exampleVi: "Bên ngoài bắt đầu nổi gió lớn rồi, mau đóng cửa sổ lại."
    },
    {
      word: "季节",
      phonetic: "jìjié",
      hanviet: "Quý tiết",
      level: "HSK 3",
      meaning: "Mùa trong năm",
      example: "秋天是我最喜欢的季节，气候宜人。",
      examplePinyin: "Qiūtiān shì wǒ zuì xǐhuan de jìjié, qìhòu yírén.",
      exampleVi: "Mùa thu là mùa tôi thích nhất, khí hậu mát mẻ dễ chịu."
    },
    {
      word: "干净",
      phonetic: "gānjìng",
      hanviet: "Can tịnh",
      level: "HSK 3",
      meaning: "Sạch sẽ, ngăn nắp",
      example: "把房间收拾得干干净净。",
      examplePinyin: "Bǎ fángjiān shōushi de gāngānjìngjìng.",
      exampleVi: "Dọn dẹp phòng ốc sạch sẽ tinh tươm."
    }
  ],

  // ==================== TỪ VỰNG HSK 4 (TRUNG CẤP CAO) ====================
  career: [
    {
      word: "招聘",
      phonetic: "zhāopìn",
      hanviet: "Chiêu sính",
      level: "HSK 4",
      meaning: "Tuyển dụng nhân sự",
      example: "我们公司正在招聘市场部经理。",
      examplePinyin: "Wǒmen gōngsī zhèngzài zhāopìn shìchǎngbù jīnglǐ.",
      exampleVi: "Công ty chúng tôi đang tuyển dụng trưởng phòng marketing."
    },
    {
      word: "简历",
      phonetic: "jiǎnlì",
      hanviet: "Giản lịch",
      level: "HSK 4",
      meaning: "Sơ yếu lý lịch, CV xin việc",
      example: "请将您的个人简历发送到人事部邮箱。",
      examplePinyin: "Qǐng jiāng nín de gèrén jiǎnlì fāsòng dào rénshìbù yóuxiāng.",
      exampleVi: "Vui lòng gửi CV cá nhân của bạn vào hòm thư phòng nhân sự."
    },
    {
      word: "面试",
      phonetic: "miànshì",
      hanviet: "Diện thí",
      level: "HSK 4",
      meaning: "Phỏng vấn trực tiếp",
      example: "他在面试中的表现给考官留下了深刻印象。",
      examplePinyin: "Tā zài miànshì zhōng de biǎoxiàn gěi kǎoguān liúxià le shēnkè yìnxiàng.",
      exampleVi: "Biểu hiện trong buổi phỏng vấn của anh ấy để lại ấn tượng sâu sắc cho người phỏng vấn."
    },
    {
      word: "薪水",
      phonetic: "xīnshui",
      hanviet: "Tân thủy",
      level: "HSK 4",
      meaning: "Mức lương, tiền lương đãi ngộ",
      example: "这份工作的薪水待遇符合我的期望。",
      examplePinyin: "Zhè fèn gōngzuò de xīnshui dàiyù fúhé wǒ de qīwàng.",
      exampleVi: "Chế độ đãi ngộ tiền lương của công việc này đáp ứng đúng kỳ vọng của tôi."
    },
    {
      word: "经验",
      phonetic: "jīngyàn",
      hanviet: "Kinh nghiệm",
      level: "HSK 4",
      meaning: "Kinh nghiệm thực tiễn",
      example: "积累丰富的工作经验对未来发展非常关键。",
      examplePinyin: "Jīlěi fēngfù de gōngzuò jīngyàn duì wèilái fāzhǎn fēicháng guānjiàn.",
      exampleVi: "Tích lũy kinh nghiệm làm việc phong phú là điều then chốt cho sự phát triển tương lai."
    },
    {
      word: "责任",
      phonetic: "zérèn",
      hanviet: "Trách nhiệm",
      level: "HSK 4",
      meaning: "Trách nhiệm, bổn phận",
      example: "作为项目负责人，他做事认真有责任心。",
      examplePinyin: "Zuòwéi xiàngmù fùzérén, tā zuòshì rènzhēn yǒu zérènxīn.",
      exampleVi: "Với tư cách là người phụ trách dự án, anh ấy làm việc rất cẩn thận và có tinh thần trách nhiệm."
    },
    {
      word: "专业",
      phonetic: "zhuānyè",
      hanviet: "Chuyên nghiệp",
      level: "HSK 4",
      meaning: "Chuyên ngành, tính chuyên nghiệp",
      example: "他在大学学的是国际经济与贸易专业。",
      examplePinyin: "Tā zài dàxué xué de shì guójì jīngjì yǔ màoyì zhuānyè.",
      exampleVi: "Chuyên ngành đại học của anh ấy là Kinh tế và Thương mại Quốc tế."
    },
    {
      word: "优秀",
      phonetic: "yōuxiù",
      hanviet: "Ưu tú",
      level: "HSK 4",
      meaning: "Xuất sắc, ưu tú",
      example: "他是我们团队中最优秀的软件工程师之一。",
      examplePinyin: "Tā shì wǒmen tuánduì zhōng zuì yōuxiù de ruǎnjiàn gōngchéngshī zhīyī.",
      exampleVi: "Anh ấy là một trong những kỹ sư phần mềm xuất sắc nhất trong đội ngũ của chúng tôi."
    }
  ],

  business: [
    {
      word: "合同",
      phonetic: "hétong",
      hanviet: "Hợp đồng",
      level: "HSK 4",
      meaning: "Bản hợp đồng thương mại",
      example: "双方代表在友好的气氛中签署了合作合同。",
      examplePinyin: "Shuāngfāng dàibiǎo zài yǒuhǎo de qìfēn zhōng qiānshǔ le hézuò hétong.",
      exampleVi: "Đại diện hai bên đã ký kết hợp đồng hợp tác trong bầu không khí thân thiện."
    },
    {
      word: "谈判",
      phonetic: "tánpàn",
      hanviet: "Đàm phán",
      level: "HSK 4",
      meaning: "Đàm phán, thương lượng",
      example: "经过艰苦的商业谈判，我们终于达成了共识。",
      examplePinyin: "Jīngguò jiānkǔ de shāngyè tánpàn, wǒmen zhōngyú dáchéng le gòngshí.",
      exampleVi: "Trải qua quá trình đàm phán thương mại gian nan, chúng tôi cuối cùng đã đạt được đồng thuận chung."
    },
    {
      word: "顺利",
      phonetic: "shùnlì",
      hanviet: "Thuận lợi",
      level: "HSK 4",
      meaning: "Suôn sẻ, thuận buồm xuôi gió",
      example: "祝愿我们的合作一切顺利，互利共赢！",
      examplePinyin: "Zhùyuàn wǒmen de hézuò yíqiè shùnlì, hùlì gòngyíng!",
      exampleVi: "Chúc sự hợp tác của chúng ta mọi bề thuận lợi, đôi bên cùng có lợi!"
    },
    {
      word: "客户",
      phonetic: "kèhù",
      hanviet: "Khách hộ",
      level: "HSK 4",
      meaning: "Khách hàng, đối tác tiêu dùng",
      example: "维护良好的客户关系是企业成功的基石。",
      examplePinyin: "Wéihù liánghǎo de kèhù guānxì shì qǐyè chénggōng de jīshí.",
      exampleVi: "Duy trì mối quan hệ khách hàng tốt đẹp là nền tảng thành công của doanh nghiệp."
    },
    {
      word: "质量",
      phonetic: "zhìliàng",
      hanviet: "Chất lượng",
      level: "HSK 4",
      meaning: "Chất lượng sản phẩm / dịch vụ",
      example: "产品质量是赢得市场信赖的第一要素。",
      examplePinyin: "Chǎnpǐn zhìliàng shì yíngdé shìchǎng xìnlài de dì yī yàosù.",
      exampleVi: "Chất lượng sản phẩm là yếu tố đầu tiên để giành lấy niềm tin của thị trường."
    },
    {
      word: "投资",
      phonetic: "tóuzī",
      hanviet: "Đầu tư",
      level: "HSK 4",
      meaning: "Đầu tư vốn kinh doanh",
      example: "这家科技公司获得了五千万元的战略投资。",
      examplePinyin: "Zhè jiā kējì gōngsī huòdé le wǔqiān wàn yuán de zhànlüè tóuzī.",
      exampleVi: "Công ty công nghệ này đã nhận được khoản đầu tư chiến lược trị giá 50 triệu nhân dân tệ."
    },
    {
      word: "按照",
      phonetic: "ànzhào",
      hanviet: "Án chiếu",
      level: "HSK 4",
      meaning: "Căn cứ theo, dựa theo kế hoạch",
      example: "请按照合同条款严格执行项目进度。",
      examplePinyin: "Qǐng ànzhào hétong tiáokuǎn yángé zhíxíng xiàngmù jìndù.",
      exampleVi: "Vui lòng tuân thủ nghiêm ngặt tiến độ dự án theo các điều khoản hợp đồng."
    }
  ],

  society: [
    {
      word: "礼貌",
      phonetic: "lǐmào",
      hanviet: "Lễ mạo",
      level: "HSK 4",
      meaning: "Lịch sự, lễ phép",
      example: "与人交往时，礼貌得体的言行令人感到愉悦。",
      examplePinyin: "Yǔ rén jiāowǎng shí, lǐmào détǐ de yánxíng lìng rén gǎndào yúyuè.",
      exampleVi: "Khi giao tiếp với người khác, lời ăn tiếng nói lịch thiệp khiến mọi người cảm thấy thoải mái."
    },
    {
      word: "幽默",
      phonetic: "yōumò",
      hanviet: "U mặc",
      level: "HSK 4",
      meaning: "Hài hước, dí dỏm",
      example: "他说话幽默风趣，总能逗大家开心笑。",
      examplePinyin: "Tā shuōhuà yōumò fēngqù, zǒng néng dòu dàjiā kāixīn xiào.",
      exampleVi: "Anh ấy ăn nói hài hước dí dỏm, luôn làm mọi người bật cười sảng khoái."
    },
    {
      word: "严格",
      phonetic: "yángé",
      hanviet: "Nghiêm cách",
      level: "HSK 4",
      meaning: "Nghiêm khắc, khắt khe",
      example: "王老师对学术研究的要求一贯非常严格。",
      examplePinyin: "Wáng lǎoshī duì xuéshù yánjiū de yāoqiú yíguàn fēicháng yángé.",
      exampleVi: "Thầy Vương xưa nay luôn có yêu cầu vô cùng nghiêm khắc đối với nghiên cứu học thuật."
    },
    {
      word: "诚实",
      phonetic: "chéngshí",
      hanviet: "Thành thực",
      level: "HSK 4",
      meaning: "Trung thực, thật thà",
      example: "诚实守信是做人立身的最崇高品质。",
      examplePinyin: "Chéngshí shǒuxìn shì zuòrén lìshēn de zuì chónggāo pǐnzhì.",
      exampleVi: "Trung thực giữ chữ tín là phẩm chất cao đẹp nhất để làm người."
    },
    {
      word: "互相",
      phonetic: "hùxiāng",
      hanviet: "Hỗ tương",
      level: "HSK 4",
      meaning: "Lẫn nhau, qua lại",
      example: "同事之间应当互相支持、互相学习。",
      examplePinyin: "Tóngshì zhījiān yīngdāng hùxiāng zhīchí, hùxiāng xuéxí.",
      exampleVi: "Giữa các đồng nghiệp với nhau nên tương trợ và học hỏi lẫn nhau."
    },
    {
      word: "尊重",
      phonetic: "zūnzhòng",
      hanviet: "Tôn trọng",
      level: "HSK 4",
      meaning: "Tôn trọng, kính trọng",
      example: "每个人都渴望得到他人的尊重与认可。",
      examplePinyin: "Měi ge rén dōu kěwàng dédào tārén de zūnzhòng yǔ rènkě.",
      exampleVi: "Mỗi người đều khao khát nhận được sự tôn trọng và công nhận từ người khác."
    },
    {
      word: "关键",
      phonetic: "guānjiàn",
      hanviet: "Quan kiện",
      level: "HSK 4",
      meaning: "Then chốt, mấu chốt quyết định",
      example: "坚持不懈才是取得最终成功的关键所在。",
      examplePinyin: "Jiānchí bú xiè cái shì qǔdé zuìzhōng chénggōng de guānjiàn suǒzài.",
      exampleVi: "Kiên trì không bỏ cuộc mới chính là chìa khóa then chốt dẫn tới thành công cuối cùng."
    }
  ],

  emotions_adv: [
    {
      word: "骄傲",
      phonetic: "jiāo'ào",
      hanviet: "Kiêu ngạo",
      level: "HSK 4",
      meaning: "Tự hào, kiêu hãnh (hoặc kiêu ngạo)",
      example: "父母为孩子取得的优异成绩感到无比骄傲。",
      examplePinyin: "Fùmǔ wèi háizi qǔdé de yōuyì chéngjì gǎndào wúbǐ jiāo'ào.",
      exampleVi: "Cha mẹ cảm thấy vô cùng tự hào về thành tích xuất sắc mà con mình đạt được."
    },
    {
      word: "害羞",
      phonetic: "hàixiū",
      hanviet: "Hại tu",
      level: "HSK 4",
      meaning: "Ngượng ngùng, e thẹn",
      example: "那个小女孩第一次上台演讲有点害羞。",
      examplePinyin: "Nà ge xiǎo nǚhái dì yī cì shàngtái yǎnjiǎng yǒudiǎn hàixiū.",
      exampleVi: "Cô bé ấy lần đầu lên sân khấu thuyết trình nên có chút bẽn lẽn ngượng ngùng."
    },
    {
      word: "紧张",
      phonetic: "jǐnzhāng",
      hanviet: "Khẩn trương",
      level: "HSK 4",
      meaning: "Hồi hộp, căng thẳng",
      example: "考试前深呼吸可以缓解心理紧张。",
      examplePinyin: "Kǎoshì qián shēn hūxī kěyǐ huǎnjiě xīnlǐ jǐnzhāng.",
      exampleVi: "Hít thở sâu trước giờ thi có thể xoa dịu sự căng thẳng tâm lý."
    },
    {
      word: "兴奋",
      phonetic: "xīngfèn",
      hanviet: "Hưng phấn",
      level: "HSK 4",
      meaning: "Hào hứng, phấn khích",
      example: "得知中奖的喜讯，大家都兴奋得欢呼起来。",
      examplePinyin: "Dédi zhī zhōngjiǎng de xǐxùn, dàjiā dōu xīngfèn de huānhū qǐlái.",
      exampleVi: "Hay tin vui trúng giải, mọi người ai nấy đều phấn khích reo hò."
    },
    {
      word: "轻松",
      phonetic: "qīngsōng",
      hanviet: "Khinh tùng",
      level: "HSK 4",
      meaning: "Nhẹ nhõm, thư thái",
      example: "交完项目报告后，整个人都觉得轻松了。",
      examplePinyin: "Jiāo wán xiàngmù bàogào hòu, zhěng ge rén dōu juéde qīngsōng le.",
      exampleVi: "Sau khi nộp xong báo cáo dự án, cả người tôi cảm thấy nhẹ nhõm hẳn."
    },
    {
      word: "后悔",
      phonetic: "hòuhuǐ",
      hanviet: "Hậu hối",
      level: "HSK 4",
      meaning: "Hối hận, ân hận",
      example: "世上没有后悔药，做事必须深思熟虑。",
      examplePinyin: "Shìshang méiyǒu hòuhuǐyào, zuòshì bìxū shēnsī shúlǜ.",
      exampleVi: "Trên đời không có thuốc chữa hối hận, làm việc gì cũng phải suy nghĩ chín chắn."
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
  ],

  // ==================== NGỮ PHÁP TRUNG CẤP (HSK 3-4) ====================
  complement_result: [
    {
      title: "Bổ ngữ kết quả (结果补语)",
      formula: "Động từ + Bổ ngữ kết quả (完/好/到/见/懂/清楚/干净...)",
      usage: "Bổ ngữ kết quả đứng ngay sau động từ, biểu thị kết quả mà hành động đạt được. Phủ định: 没 + Động từ + Bổ ngữ.",
      example: "这本书我看完了，但是没看懂。",
      examplePinyin: "Zhè běn shū wǒ kànwán le, dànshì méi kàndǒng.",
      exampleVi: "Quyển sách này tôi đã đọc xong rồi, nhưng không hiểu.",
      note: "Các bổ ngữ kết quả thông dụng: 完 (xong), 好 (xong/tốt), 到 (được/đến), 见 (thấy), 懂 (hiểu), 清楚 (rõ ràng), 干净 (sạch). VD: 听懂 (nghe hiểu), 做好 (làm xong tốt), 找到 (tìm thấy)."
    }
  ],

  complement_direction: [
    {
      title: "Bổ ngữ xu hướng (趋向补语)",
      formula: "Động từ + 上/下/进/出/回/过/起 + 来/去",
      usage: "Biểu thị phương hướng di chuyển hoặc trạng thái biến đổi của hành động. '来' hướng về phía người nói, '去' hướng ra xa người nói.",
      example: "他从楼上跑下来了，又跑出去买东西。",
      examplePinyin: "Tā cóng lóu shàng pǎo xiàlái le, yòu pǎo chūqù mǎi dōngxi.",
      exampleVi: "Anh ấy từ trên lầu chạy xuống rồi, lại chạy ra ngoài mua đồ.",
      note: "Bổ ngữ xu hướng phức hợp (2 thành phần): 上来/上去, 下来/下去, 进来/进去, 出来/出去, 回来/回去, 过来/过去, 起来. Nghĩa mở rộng: 想起来 (nhớ ra), 看出来 (nhận ra), 冷下来 (lạnh dần đi)."
    }
  ],

  complement_degree: [
    {
      title: "Bổ ngữ trạng thái / Mức độ (状态补语 - 得)",
      formula: "Động từ + 得 + Tính từ / Cụm từ mô tả",
      usage: "Biểu thị mức độ, trạng thái, hoặc đánh giá cách thức hành động diễn ra. '得' là cầu nối giữa động từ và phần mô tả.",
      example: "她汉语说得非常流利，写得也很漂亮。",
      examplePinyin: "Tā Hànyǔ shuō de fēicháng liúlì, xiě de yě hěn piàoliang.",
      exampleVi: "Cô ấy nói tiếng Trung rất lưu loát, viết cũng rất đẹp.",
      note: "Phủ định: 动词 + 得 + 不 + Tính từ (说得不好 - nói không tốt). Lưu ý phân biệt 3 chữ 'de': 的 (bổ nghĩa danh từ), 地 (bổ nghĩa động từ phía trước), 得 (bổ nghĩa động từ phía sau)."
    }
  ],

  complement_potential: [
    {
      title: "Bổ ngữ khả năng (可能补语)",
      formula: "Khẳng định: Động từ + 得 + Bổ ngữ | Phủ định: Động từ + 不 + Bổ ngữ",
      usage: "Biểu thị khả năng hoặc không thể thực hiện/đạt được kết quả nào đó. Chèn '得' (khẳng định) hoặc '不' (phủ định) giữa động từ và bổ ngữ.",
      example: "这个箱子太重了，我搬不动。你听得懂她说什么吗？",
      examplePinyin: "Zhè ge xiāngzi tài zhòng le, wǒ bān bú dòng. Nǐ tīng de dǒng tā shuō shénme ma?",
      exampleVi: "Chiếc thùng này nặng quá, tôi khiêng không nổi. Bạn có nghe hiểu cô ấy nói gì không?",
      note: "Cấu trúc phổ biến: 看得见/看不见 (nhìn thấy/không thấy), 听得懂/听不懂 (nghe hiểu/không hiểu), 吃得完/吃不完 (ăn hết/ăn không hết), 做得到/做不到 (làm được/không làm được)."
    }
  ],

  conjunctions: [
    {
      title: "Liên từ ghép đôi (关联词语)",
      formula: "虽然A...但是B / 因为A...所以B / 不但A...而且B / 如果A...就B",
      usage: "Liên từ luôn đi thành cặp, nối hai vế câu biểu thị quan hệ logic: nhượng bộ, nhân quả, tăng tiến, giả thiết.",
      example: "虽然今天下雨，但是我们还是决定出发。因为准备得很充分，所以结果非常成功。",
      examplePinyin: "Suīrán jīntiān xià yǔ, dànshì wǒmen háishi juédìng chūfā. Yīnwèi zhǔnbèi de hěn chōngfèn, suǒyǐ jiéguǒ fēicháng chénggōng.",
      exampleVi: "Mặc dù hôm nay mưa, nhưng chúng tôi vẫn quyết định khởi hành. Vì chuẩn bị rất đầy đủ, nên kết quả rất thành công.",
      note: "Các cặp quan trọng: 虽然...但是/可是... (tuy...nhưng), 因为...所以... (vì...nên), 不但...而且... (không chỉ...mà còn), 如果/要是...就... (nếu...thì), 只要...就... (chỉ cần...thì), 无论/不管...都... (bất kể...đều)."
    }
  ],

  comparison_adv: [
    {
      title: "Cấu trúc so sánh nâng cao (高级比较句)",
      formula: "A + 跟/和 + B + 一样 + Adj | A + 没有 + B + (那么) + Adj | 越来越 + Adj",
      usage: "Mở rộng so sánh ngoài câu chữ '比': so sánh bằng (一样), so sánh kém (没有...那么), và mức độ tăng dần (越来越).",
      example: "他跟他哥哥一样高。我的汉语没有你的那么好。天气越来越冷了。",
      examplePinyin: "Tā gēn tā gēge yíyàng gāo. Wǒ de Hànyǔ méiyǒu nǐ de nàme hǎo. Tiānqì yuèláiyuè lěng le.",
      exampleVi: "Anh ấy cao bằng anh trai. Tiếng Trung của tôi không tốt bằng bạn. Thời tiết ngày càng lạnh.",
      note: "Bổ sung cấu trúc: 越A越B (càng A càng B): 越吃越胖 (càng ăn càng béo). A + 比 + B + Adj + 多了/得多/一点儿 (mức chênh lệch): 他比我大三岁 (Anh ấy lớn hơn tôi 3 tuổi)."
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
  hsk1: "HSK 1 (152 từ căn bản)",
  hsk2: "HSK 2 (144 từ sơ cấp)",
  hsk3: "HSK 3 (282 từ trung cấp 1)",
  hsk4: "HSK 4 (362 từ trung cấp 2)",
  basics: "Đại Từ & Nhập Môn",
  greeting: "Chào Hỏi & Xã Giao",
  numbers: "Số Đếm & Số Lượng",
  time: "Thời Gian & Ngày Tháng",
  family: "Gia Đình & Xưng Hô",
  dining: "Ăn Uống & Nhà Hàng",
  shopping: "Mua Sắm & Giá Cả",
  office: "Công Sở & Văn Phòng",
  feelings: "Cảm Xúc & Đời Sống",
  travel: "Du Lịch & Di Chuyển (HSK 3)",
  study: "Học Tập & Thi Cử (HSK 3)",
  health_zh: "Sức Khỏe & Y Tế (HSK 3)",
  environment: "Tự Nhiên & Thời Tiết (HSK 3)",
  career: "Nghề Nghiệp & Tuyển Dụng (HSK 4)",
  business: "Thương Mại & Hợp Tác (HSK 4)",
  society: "Xã Hội & Giao Tiếp (HSK 4)",
  emotions_adv: "Tâm Lý & Cảm Xúc (HSK 4)",
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
  complement_result: "Bổ ngữ Kết quả (HSK 3)",
  complement_direction: "Bổ ngữ Xu hướng (HSK 3)",
  complement_degree: "Bổ ngữ Trạng thái 得 (HSK 3)",
  complement_potential: "Bổ ngữ Khả năng (HSK 4)",
  conjunctions: "Liên từ Ghép đôi (HSK 3-4)",
  comparison_adv: "So sánh Nâng cao (HSK 4)",
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

// =========================================================================
// PHASE 2.1: SENTENCE BUILDER DATA (RÁP CÂU TIẾNG TRUNG THEO TRẬT TỰ CHUẨN)
// =========================================================================
const ZH_SENTENCE_BUILDER_DATA = [
  // --- HSK 1 ---
  {
    id: 1,
    level: "HSK 1",
    pattern: "Chủ ngữ + Thời gian + Động từ + Tân ngữ",
    words: ["我", "明天", "去", "学校"],
    correctOrder: ["我", "明天", "去", "学校"],
    fullSentence: "我明天去学校。",
    fullPinyin: "Wǒ míngtiān qù xuéxiào.",
    translation: "Ngày mai tôi đi đến trường.",
    explanation: "Trật tự thời gian trong tiếng Trung: Trạng ngữ chỉ thời gian (明天) đứng sau chủ ngữ hoặc đầu câu, trước động từ."
  },
  {
    id: 2,
    level: "HSK 1",
    pattern: "Chủ ngữ + Ở đâu (在...) + Làm gì",
    words: ["他", "在", "图书馆", "看书"],
    correctOrder: ["他", "在", "图书馆", "看书"],
    fullSentence: "他在图书馆看书。",
    fullPinyin: "Tā zài túshūguǎn kànshū.",
    translation: "Anh ấy đọc sách ở thư viện.",
    explanation: "Quy tắc 'ở đâu làm gì': Cụm giới từ địa điểm [在 + Nơi chốn] luôn đứng TRƯỚC hành động, ngược với tiếng Việt."
  },
  {
    id: 3,
    level: "HSK 1",
    pattern: "Chủ ngữ + Năng nguyện từ + Động từ + Tân ngữ",
    words: ["我", "想", "喝", "一杯", "茶"],
    correctOrder: ["我", "想", "喝", "一杯", "茶"],
    fullSentence: "我想喝一杯茶。",
    fullPinyin: "Wǒ xiǎng hē yì bēi chá.",
    translation: "Tôi muốn uống một tách trà.",
    explanation: "Động từ năng nguyện '想' (muốn) đứng trước động từ chính '喝'."
  },
  {
    id: 4,
    level: "HSK 1",
    pattern: "Định ngữ + 的 + Trung tâm ngữ",
    words: ["这", "是", "我", "的", "汉语", "老师"],
    correctOrder: ["这", "是", "我", "的", "汉语", "老师"],
    fullSentence: "这是我的汉语老师。",
    fullPinyin: "Zhè shì wǒ de Hànyǔ lǎoshī.",
    translation: "Đây là giáo viên tiếng Trung của tôi.",
    explanation: "Định ngữ đứng trước danh từ chính: '我的' (của tôi) bổ nghĩa cho '汉语老师' (giáo viên tiếng Trung)."
  },
  {
    id: 5,
    level: "HSK 1",
    pattern: "Chủ ngữ + Thời gian + Phó từ + Vị ngữ",
    words: ["爸爸", "今天", "不", "回家", "吃饭"],
    correctOrder: ["爸爸", "今天", "不", "回家", "吃饭"],
    fullSentence: "爸爸今天不回家吃饭。",
    fullPinyin: "Bàba jīntiān bù huíjiā chīfàn.",
    translation: "Hôm nay bố không về nhà ăn cơm.",
    explanation: "Phó từ phủ định '不' đứng trước liên động từ '回家吃饭'."
  },
  {
    id: 6,
    level: "HSK 1",
    pattern: "Đại từ nghi vấn hỏi số lượng / thời gian",
    words: ["你", "昨天", "几点", "睡觉？"],
    correctOrder: ["你", "昨天", "几点", "睡觉？"],
    fullSentence: "你昨天几点睡觉？",
    fullPinyin: "Nǐ zuótiān jǐdiǎn shuìjiào?",
    translation: "Hôm qua bạn mấy giờ đi ngủ?",
    explanation: "Từ để hỏi '几点' (mấy giờ) thay thế đúng vào vị trí trạng ngữ thời gian trong câu trần thuật."
  },
  {
    id: 7,
    level: "HSK 1",
    pattern: "Cùng ai làm gì: 跟...一起 + Động từ",
    words: ["我", "跟", "朋友", "一起", "去", "商店"],
    correctOrder: ["我", "跟", "朋友", "一起", "去", "商店"],
    fullSentence: "我跟朋友一起去商店。",
    fullPinyin: "Wǒ gēn péngyou yìqǐ qù shāngdiàn.",
    translation: "Tôi cùng bạn bè đi đến cửa hàng.",
    explanation: "Cấu trúc '跟 / 和 + Ai + 一起 + Động từ' biểu thị cùng ai làm việc gì đó."
  },

  // --- HSK 2 ---
  {
    id: 8,
    level: "HSK 2",
    pattern: "So sánh chữ 比: A + 比 + B + Tính từ + Mức chênh lệch",
    words: ["我", "比", "弟弟", "大", "两岁"],
    correctOrder: ["我", "比", "弟弟", "大", "两岁"],
    fullSentence: "我比弟弟大两岁。",
    fullPinyin: "Wǒ bǐ dìdi dà liǎng suì.",
    translation: "Tôi lớn hơn em trai hai tuổi.",
    explanation: "Số lượng chênh lệch cụ thể (两岁) phải đứng SAU tính từ (大)."
  },
  {
    id: 9,
    level: "HSK 2",
    pattern: "Câu chữ 把: Chủ ngữ + 把 + Tân ngữ + Động từ + Thành phần khác",
    words: ["请", "你", "把", "门", "关上"],
    correctOrder: ["请", "你", "把", "门", "关上"],
    fullSentence: "请你把门关上。",
    fullPinyin: "Qǐng nǐ bǎ mén guān shàng.",
    translation: "Xin bạn hãy đóng cửa lại.",
    explanation: "Câu chữ 把 dùng khi muốn tác động lên tân ngữ (门) và tạo ra kết quả/trạng thái mới (关上)."
  },
  {
    id: 10,
    level: "HSK 2",
    pattern: "Bổ ngữ trạng thái: Động từ + 得 + Tính từ mô tả",
    words: ["她", "汉字", "写", "得", "非常", "漂亮"],
    correctOrder: ["她", "汉字", "写", "得", "非常", "漂亮"],
    fullSentence: "她汉字写得非常漂亮。",
    fullPinyin: "Tā Hànzì xiě de fēicháng piàoliang.",
    translation: "Cô ấy viết chữ Hán rất đẹp.",
    explanation: "Dùng '得' để nối giữa động từ '写' và mức độ đánh giá '非常漂亮'."
  },
  {
    id: 11,
    level: "HSK 2",
    pattern: "Cặp liên từ: 虽然...但是... (Tuy...nhưng...)",
    words: ["虽然", "今天", "很冷", "但是", "他", "还是", "去", "跑步"],
    correctOrder: ["虽然", "今天", "很冷", "但是", "他", "还是", "去", "跑步"],
    fullSentence: "虽然今天很冷，但是他还是去跑步。",
    fullPinyin: "Suīrán jīntiān hěn lěng, dànshì tā háishi qù pǎobù.",
    translation: "Tuy hôm nay rất lạnh, nhưng anh ấy vẫn đi chạy bộ.",
    explanation: "'虽然' mở đầu vế nhượng bộ, '但是' mở đầu vế chính kết hợp '还是' (vẫn)."
  },
  {
    id: 12,
    level: "HSK 2",
    pattern: "Thời lượng: Động từ + Thời lượng + Tân ngữ",
    words: ["我", "学", "了", "一年", "汉语"],
    correctOrder: ["我", "学", "了", "一年", "汉语"],
    fullSentence: "我学了一年汉语。",
    fullPinyin: "Wǒ xué le yì nián Hànyǔ.",
    translation: "Tôi đã học tiếng Trung được một năm.",
    explanation: "Bổ ngữ thời lượng '一年' đứng giữa động từ mang '了' và tân ngữ '汉语'."
  },
  {
    id: 13,
    level: "HSK 2",
    pattern: "Liên từ Vì...Nên...: 因为...所以...",
    words: ["因为", "生病", "所以", "他", "没", "去", "上课"],
    correctOrder: ["因为", "生病", "所以", "他", "没", "去", "上课"],
    fullSentence: "因为生病，所以他没去上课。",
    fullPinyin: "Yīnwèi shēngbìng, suǒyǐ tā méi qù shàngkè.",
    translation: "Vì bị bệnh nên anh ấy đã không đi học.",
    explanation: "Cặp liên từ chỉ nguyên nhân - kết quả: 因为 (Bởi vì) ... 所以 (Cho nên)."
  },

  // --- HSK 3 ---
  {
    id: 14,
    level: "HSK 3",
    pattern: "Câu chữ 把 + Bổ ngữ kết quả",
    words: ["我", "把", "今天的", "作业", "做完", "了"],
    correctOrder: ["我", "把", "今天的", "作业", "做完", "了"],
    fullSentence: "我把今天的作业做完了。",
    fullPinyin: "Wǒ bǎ jīntiān de zuòyè zuòwán le.",
    translation: "Tôi đã làm xong bài tập của ngày hôm nay rồi.",
    explanation: "Tân ngữ '今天的作业' được đưa lên trước động từ '做', kết quả là '完' + trợ từ '了'."
  },
  {
    id: 15,
    level: "HSK 3",
    pattern: "Bổ ngữ xu hướng phức hợp: Từ đâu + Động từ + Bổ ngữ xu hướng",
    words: ["他", "从", "房间", "里", "跑", "出来", "了"],
    correctOrder: ["他", "从", "房间", "里", "跑", "出来", "了"],
    fullSentence: "他从房间里跑出来了。",
    fullPinyin: "Tā cóng fángjiān lǐ pǎo chūlái le.",
    translation: "Anh ấy từ trong phòng chạy ra ngoài rồi.",
    explanation: "Bổ ngữ xu hướng '出来' chỉ phương hướng di chuyển ra phía người quan sát."
  },
  {
    id: 16,
    level: "HSK 3",
    pattern: "Bổ ngữ khả năng phủ định: Động từ + 不 + Bổ ngữ",
    words: ["这个", "生词", "太难", "我", "记不住"],
    correctOrder: ["这个", "生词", "太难", "我", "记不住"],
    fullSentence: "这个生词太难，我记不住。",
    fullPinyin: "Zhè ge shēngcí tài nán, wǒ jìbuzhù.",
    translation: "Từ mới này khó quá, tôi không nhớ nổi.",
    explanation: "Bổ ngữ khả năng '记不住' = không có năng lực ghi nhớ được."
  },
  {
    id: 17,
    level: "HSK 3",
    pattern: "Cấu trúc tăng tiến: 不但...而且...",
    words: ["他", "不但", "会", "汉语", "而且", "说得", "很流利"],
    correctOrder: ["他", "不但", "会", "汉语", "而且", "说得", "很流利"],
    fullSentence: "他不但会汉语，而且说得很流利。",
    fullPinyin: "Tā búdàn huì Hànyǔ, érqiě shuō de hěn liúlì.",
    translation: "Anh ấy không chỉ biết tiếng Trung, mà còn nói rất lưu loát.",
    explanation: "Biểu thị quan hệ tăng tiến: không những biết (vế 1) mà còn đạt trình độ cao (vế 2)."
  },
  {
    id: 18,
    level: "HSK 3",
    pattern: "Cấu trúc biến đổi: 越来越 + Tính từ / Tâm lý",
    words: ["天气", "越", "来", "越", "冷", "了"],
    correctOrder: ["天气", "越", "来", "越", "冷", "了"],
    fullSentence: "天气越来越冷了。",
    fullPinyin: "Tiānqì yuèláiyuè lěng le.",
    translation: "Thời tiết càng ngày càng lạnh rồi.",
    explanation: "'越来越...' biểu thị mức độ tính chất tăng dần theo thời gian."
  },
  {
    id: 19,
    level: "HSK 3",
    pattern: "Câu bị động: Chủ ngữ + 被 + Người tác động + Động từ + Kết quả",
    words: ["我的", "自行车", "被", "弟弟", "借走", "了"],
    correctOrder: ["我的", "自行车", "被", "弟弟", "借走", "了"],
    fullSentence: "我的自行车被弟弟借走了。",
    fullPinyin: "Wǒ de zìxíngchē bèi dìdi jièzǒu le.",
    translation: "Xe đạp của tôi đã bị em trai mượn đi rồi.",
    explanation: "Câu chữ 被 nhấn mạnh đối tượng tiếp nhận hành động (自行车) chịu ảnh hưởng từ hành động của tác nhân (弟弟)."
  },
  {
    id: 20,
    level: "HSK 3",
    pattern: "Cấu trúc giả thiết: 如果...就...",
    words: ["如果", "明天", "不下雨", "我们", "就", "去", "爬山"],
    correctOrder: ["如果", "明天", "不下雨", "我们", "就", "去", "爬山"],
    fullSentence: "如果明天不下雨，我们就去爬山。",
    fullPinyin: "Rúguǒ míngtiān bú xià yǔ, wǒmen jiù qù páshān.",
    translation: "Nếu ngày mai trời không mưa, chúng ta sẽ đi leo núi.",
    explanation: "Cặp liên từ giả thiết điều kiện: 如果 (Nếu) ở vế trước, 就 (Thì) đứng trước vị ngữ vế sau."
  }
];

// =========================================================================
// PHASE 2.3: ETYMOLOGY DATA (BÓC TÁCH CẤU TẠO CHỮ HÁN & GHI NHỚ MẸO)
// =========================================================================
const ZH_ETYMOLOGY_DATA = {
  "休": {
    char: "休",
    pinyin: "xiū",
    hanviet: "Hưu",
    type: "Hội ý (会意)",
    meaning: "Nghỉ ngơi, thôi, ngừng",
    parts: [
      { char: "亻", name: "Nhân đứng", role: "Biểu ý (Người)" },
      { char: "木", name: "Mộc", role: "Biểu ý (Cây cối)" }
    ],
    story: "Hình ảnh một người (亻) đứng tựa lưng vào gốc cây (木) để bóng mát nghỉ ngơi sau giờ làm việc đồng áng mệt mỏi.",
    mnemonic: "Người đứng cạnh Cây là đang Hưu trí (nghỉ ngơi)."
  },
  "妈": {
    char: "妈",
    pinyin: "mā",
    hanviet: "Mã / Mẹ",
    type: "Hình thanh (形声)",
    meaning: "Mẹ, má",
    parts: [
      { char: "女", name: "Nữ", role: "Biểu ý (Phụ nữ)" },
      { char: "马", name: "Mã", role: "Biểu âm (Đọc là mǎ)" }
    ],
    story: "Chữ hình thanh điển hình: Bộ Nữ (女) chỉ người mẹ là phụ nữ, chữ Mã (马 - mǎ) gợi âm đọc tương đồng thành 'mā'.",
    mnemonic: "Người Phụ nữ (女) mượn âm Mã (马) đọc thành Mẹ (妈)."
  },
  "明": {
    char: "明",
    pinyin: "míng",
    hanviet: "Minh",
    type: "Hội ý (会意)",
    meaning: "Sáng sủa, thông minh, ngày mai",
    parts: [
      { char: "日", name: "Nhật", role: "Biểu ý (Mặt trời)" },
      { char: "月", name: "Nguyệt", role: "Biểu ý (Mặt trăng)" }
    ],
    story: "Mặt trời (日) là nguồn sáng ban ngày, Mặt trăng (月) là nguồn sáng ban đêm. Hai nguồn sáng hội tụ lại tạo nên sự sáng suốt, rực rỡ vô cùng.",
    mnemonic: "Nhật (mặt trời) bên cạnh Nguyệt (mặt trăng) tạo nên ánh sáng Minh bạch."
  },
  "好": {
    char: "好",
    pinyin: "hǎo",
    hanviet: "Hảo",
    type: "Hội ý (会意)",
    meaning: "Tốt, đẹp, hay",
    parts: [
      { char: "女", name: "Nữ", role: "Biểu ý (Người phụ nữ / Con gái)" },
      { char: "子", name: "Tử", role: "Biểu ý (Đứa trẻ / Con trai)" }
    ],
    story: "Người phụ nữ (女) sinh được cả con trai lẫn con gái (子), gia đình có nếp có tẻ, là điều tốt đẹp và trọn vẹn nhất trong quan niệm xưa.",
    mnemonic: "Người Mẹ (女) ôm đứa Con (子) là điều Tốt đẹp (Hảo) nhất."
  },
  "家": {
    char: "家",
    pinyin: "jiā",
    hanviet: "Gia",
    type: "Hội ý (会意)",
    meaning: "Nhà, gia đình",
    parts: [
      { char: "宀", name: "Miên", role: "Biểu ý (Mái nhà)" },
      { char: "豕", name: "Thỉ", role: "Biểu ý (Con lợn/heo)" }
    ],
    story: "Thời cổ đại, dưới mái nhà (宀) có nuôi một con lợn (豕) chứng tỏ gia đình no ấm, có của ăn của để, tạo nên tổ ấm thực sự.",
    mnemonic: "Dưới Mái nhà (宀) có con Lợn (豕) tức là Gia đình sung túc."
  },
  "安": {
    char: "安",
    pinyin: "ān",
    hanviet: "An",
    type: "Hội ý (会意)",
    meaning: "Bình an, yên ổn",
    parts: [
      { char: "宀", name: "Miên", role: "Biểu ý (Mái nhà)" },
      { char: "女", name: "Nữ", role: "Biểu ý (Người phụ nữ)" }
    ],
    story: "Trong nhà (宀) có bàn tay chăm sóc, vun vén của người phụ nữ (女) thì trong ấm ngoài êm, gia đạo bình an.",
    mnemonic: "Dưới mái nhà (宀) có người phụ nữ (女) thì lòng dạ bình An."
  },
  "森": {
    char: "森",
    pinyin: "sēn",
    hanviet: "Sâm",
    type: "Hội ý (会意)",
    meaning: "Rừng rậm rạp",
    parts: [
      { char: "木", name: "Mộc", role: "Biểu ý (Cây)" },
      { char: "林", name: "Lâm", role: "Biểu ý (Hai cây = Rừng thưa)" }
    ],
    story: "Một cây là Mộc (木), hai cây thành Rừng (林 - Lâm), ba cây tầng tầng lớp lớp tạo nên Rừng già rậm rạp (森 - Sâm).",
    mnemonic: "Ba cây (木) chụm lại thành Rừng rậm bạt ngàn."
  },
  "看": {
    char: "看",
    pinyin: "kàn",
    hanviet: "Khán",
    type: "Hội ý (会意)",
    meaning: "Xem, nhìn, đọc",
    parts: [
      { char: "手/龵", name: "Thủ", role: "Biểu ý (Bàn tay)" },
      { char: "目", name: "Mục", role: "Biểu ý (Mắt)" }
    ],
    story: "Hình ảnh một người đưa bàn tay (手) lên che phía trên mắt (目) để chắn ánh nắng gắt mà nhìn xa trông rộng.",
    mnemonic: "Lấy Tay (手) đặt trên Mắt (目) để Nhìn / Xem (看)."
  },
  "信": {
    char: "信",
    pinyin: "xìn",
    hanviet: "Tín",
    type: "Hội ý (会意)",
    meaning: "Tin tưởng, thư từ, uy tín",
    parts: [
      { char: "亻", name: "Nhân", role: "Biểu ý (Con người)" },
      { char: "言", name: "Ngôn", role: "Biểu ý (Lời nói)" }
    ],
    story: "Con người (亻) nói ra lời nào (言) thì phải giữ đúng lời ấy, tạo dựng lòng tin và chữ tín ở đời.",
    mnemonic: "Lời nói (言) của Con người (亻) phải có Uy tín (信)."
  },
  "问": {
    char: "问",
    pinyin: "wèn",
    hanviet: "Vấn",
    type: "Hình thanh kiêm hội ý",
    meaning: "Hỏi",
    parts: [
      { char: "门", name: "Môn", role: "Biểu âm (mén) & Cổng" },
      { char: "口", name: "Khẩu", role: "Biểu ý (Cái miệng)" }
    ],
    story: "Đến trước cổng nhà (门), dùng miệng (口) cất tiếng gọi để hỏi thăm chủ nhà.",
    mnemonic: "Đứng ở Cửa (门) mở Miệng (口) để Hỏi (问 - Vấn)."
  },
  "闻": {
    char: "闻",
    pinyin: "wén",
    hanviet: "Văn",
    type: "Hình thanh kiêm hội ý",
    meaning: "Nghe thấy, ngửi, tin tức",
    parts: [
      { char: "门", name: "Môn", role: "Biểu âm (mén) & Cửa" },
      { char: "耳", name: "Nhĩ", role: "Biểu ý (Tai)" }
    ],
    story: "Ghé tai (耳) sát vào cánh cửa (门) để nghe ngóng xem bên ngoài có động tĩnh tin tức gì.",
    mnemonic: "Ghé Tai (耳) vào Cửa (门) để Nghe ngóng tin tức (Tân văn)."
  },
  "闷": {
    char: "闷",
    pinyin: "mèn",
    hanviet: "Muộn",
    type: "Hội ý (会意)",
    meaning: "Buồn bực, ngột ngạt, bí bách",
    parts: [
      { char: "门", name: "Môn", role: "Biểu ý (Cánh cửa đóng kín)" },
      { char: "心", name: "Tâm", role: "Biểu ý (Trái tim/tâm trạng)" }
    ],
    story: "Trái tim (心) bị nhốt kín bên trong cánh cửa (门) không thể giãi bày tâm sự, cảm thấy u sầu, ngột ngạt.",
    mnemonic: "Tâm (心) bị đóng kín trong Cửa (门) sinh ra Muộn phiền (闷)."
  },
  "想": {
    char: "想",
    pinyin: "xiǎng",
    hanviet: "Tưởng",
    type: "Hình thanh (形声)",
    meaning: "Nghĩ, nhớ, muốn",
    parts: [
      { char: "相", name: "Tương", role: "Biểu âm (xiāng/xiàng)" },
      { char: "心", name: "Tâm", role: "Biểu ý (Trái tim, suy nghĩ)" }
    ],
    story: "Những hình ảnh (相) luôn đọng lại sâu đậm trong lòng dạ, trái tim (心), gợi nỗi tương tư, tưởng nhớ khôn nguôi.",
    mnemonic: "Tâm (心) khắc ghi Tướng mạo (相) người thương là đang Tưởng nhớ (想)."
  },
  "忘": {
    char: "忘",
    pinyin: "wàng",
    hanviet: "Vong",
    type: "Hội ý kiêm hình thanh",
    meaning: "Quên",
    parts: [
      { char: "亡", name: "Vong", role: "Biểu âm (wáng) & Mất đi" },
      { char: "心", name: "Tâm", role: "Biểu ý (Tâm trí)" }
    ],
    story: "Trong tâm trí (心) mà ký ức bị tiêu biến, chết đi (亡) thì chính là đã lãng quên.",
    mnemonic: "Tâm (心) đã Vong (亡 - mất) tức là Quên bẵng (忘)."
  },
  "意": {
    char: "意",
    pinyin: "yì",
    hanviet: "Ý",
    type: "Hội ý (会意)",
    meaning: "Ý nghĩ, ý nghĩa, ý định",
    parts: [
      { char: "音", name: "Âm", role: "Biểu ý (Âm thanh)" },
      { char: "心", name: "Tâm", role: "Biểu ý (Trái tim)" }
    ],
    story: "Âm thanh (音) phát ra từ tận sâu đáy lòng, đáy tim (心) chính là tâm ý, ý nghĩ chân thành nhất.",
    mnemonic: "Âm thanh (音) từ cõi Lòng (心) biểu đạt Tâm ý (意)."
  },
  "男": {
    char: "男",
    pinyin: "nán",
    hanviet: "Nam",
    type: "Hội ý (会意)",
    meaning: "Nam giới, con trai",
    parts: [
      { char: "田", name: "Điền", role: "Biểu ý (Ruộng đồng)" },
      { char: "力", name: "Lực", role: "Biểu ý (Sức lực)" }
    ],
    story: "Người đem hết sức lực (力) cày cấy trên đồng ruộng (田) để nuôi sống gia đình trong xã hội nông nghiệp thời xưa chính là đàn ông con trai.",
    mnemonic: "Dùng Sức (力) làm Ruộng (田) là người Nam nhi (男)."
  },
  "泪 / 淚": {
    char: "泪",
    pinyin: "lèi",
    hanviet: "Lệ",
    type: "Hội ý (会意)",
    meaning: "Nước mắt",
    parts: [
      { char: "氵", name: "Thủy", role: "Biểu ý (Nước)" },
      { char: "目", name: "Mục", role: "Biểu ý (Mắt)" }
    ],
    story: "Giọt nước (氵) trào ra từ khóe mắt (目) khi xúc động hay buồn bã chính là giọt nước mắt.",
    mnemonic: "Nước (氵) chảy ra từ Mắt (目) là Nước mắt (Lệ - 泪)."
  },
  "语": {
    char: "语",
    pinyin: "yǔ",
    hanviet: "Ngữ",
    type: "Hình thanh (形声)",
    meaning: "Ngôn ngữ, lời nói",
    parts: [
      { char: "讠", name: "Ngôn", role: "Biểu ý (Lời nói)" },
      { char: "吾", name: "Ngô", role: "Biểu âm (wú) nghĩa là Ta/Tôi" }
    ],
    story: "Ngôn từ (讠) do chính bản thân mình (吾 - ta) nói ra tạo nên ngôn ngữ giao tiếp.",
    mnemonic: "Ngôn (讠) của Ta (吾) là Ngôn ngữ (语)."
  },
  "饭": {
    char: "饭",
    pinyin: "fàn",
    hanviet: "Phạn",
    type: "Hình thanh (形声)",
    meaning: "Cơm, bữa ăn",
    parts: [
      { char: "饣", name: "Thực", role: "Biểu ý (Thức ăn/ăn uống)" },
      { char: "反", name: "Phản", role: "Biểu âm (fǎn)" }
    ],
    story: "Chữ thuộc bộ Thực (饣 - ăn uống), mượn âm của chữ Phản (反) biến âm thành fàn.",
    mnemonic: "Thực phẩm (饣) mượn âm Phản (反) thành Cơm ăn (饭)."
  },
  "喝": {
    char: "喝",
    pinyin: "hē",
    hanviet: "Hát",
    type: "Hình thanh (形声)",
    meaning: "Uống",
    parts: [
      { char: "口", name: "Khẩu", role: "Biểu ý (Cái miệng)" },
      { char: "曷", name: "Hạt", role: "Biểu âm (hé)" }
    ],
    story: "Hành động uống cần dùng đến miệng (口), kết hợp với chữ 曷 làm phần biểu âm.",
    mnemonic: "Dùng Miệng (口) để Uống (喝) nước giải khát."
  }
};

// =========================================================================
// PHASE 3.2: LISTENING CLOZE TEST DATA (NGHE ĐOÁN TỪ)
// =========================================================================
const ZH_LISTENING_CLOZE_DATA = [
  {
    id: 1,
    level: "HSK 1",
    audioSentence: "请问洗手间在哪儿？",
    displaySentence: "请问____在哪儿？",
    blankWord: "洗手间",
    pinyin: "xǐshǒujiān",
    translation: "Xin hỏi nhà vệ sinh ở đâu?",
    options: ["洗手间", "图书馆", "飞机场", "火车站"]
  },
  {
    id: 2,
    level: "HSK 1",
    audioSentence: "我想喝一杯热茶。",
    displaySentence: "我想喝一杯____。",
    blankWord: "热茶",
    pinyin: "rè chá",
    translation: "Tôi muốn uống một cốc trà nóng.",
    options: ["热茶", "牛奶", "咖啡", "啤酒"]
  },
  {
    id: 3,
    level: "HSK 2",
    audioSentence: "外面下雨了，你带雨伞了吗？",
    displaySentence: "外面下雨了，你带____了吗？",
    blankWord: "雨伞",
    pinyin: "yǔsǎn",
    translation: "Bên ngoài mưa rồi, bạn có mang ô (dù) không?",
    options: ["雨伞", "钥匙", "钱包", "手机"]
  },
  {
    id: 4,
    level: "HSK 2",
    audioSentence: "我今天太忙了，没有时间吃午饭。",
    displaySentence: "我今天太____了，没有时间吃午饭。",
    blankWord: "忙",
    pinyin: "máng",
    translation: "Hôm nay tôi bận quá, không có thời gian ăn trưa.",
    options: ["忙", "累", "冷", "渴"]
  },
  {
    id: 5,
    level: "HSK 3",
    audioSentence: "明天我们要去参加一个重要的会议。",
    displaySentence: "明天我们要去参加一个重要的____。",
    blankWord: "会议",
    pinyin: "huìyì",
    translation: "Ngày mai chúng tôi phải đi tham gia một cuộc họp quan trọng.",
    options: ["会议", "比赛", "考试", "晚会"]
  },
  {
    id: 6,
    level: "HSK 3",
    audioSentence: "这个汉语词典非常有用，推荐你买一本。",
    displaySentence: "这个汉语____非常有用，推荐你买一本。",
    blankWord: "词典",
    pinyin: "cídiǎn",
    translation: "Quyển từ điển tiếng Trung này rất hữu ích, khuyên bạn nên mua một cuốn.",
    options: ["词典", "地图", "小说", "杂志"]
  }
];

// =========================================================================
// PHASE 4.1: CHENGYU DATA (THÀNH NGỮ 4 CHỮ BẢN ĐỊA HÓA)
// =========================================================================
const ZH_CHENGYU_DATA = [
  {
    chengyu: "画蛇添足",
    pinyin: "Huà shé tiān zú",
    hanviet: "Họa xà thiêm túc",
    literal: "Vẽ rắn thêm chân",
    meaning: "Làm chuyện thừa thãi, tự chuốc lấy thất bại",
    origin: "Thời Chiến Quốc, nước Sở có người thi vẽ rắn, người xong trước vẽ thêm chân cho rắn nên bị xử thua.",
    example: "写文章要简明扼要，千万不要画蛇添足。",
    examplePinyin: "Xiě wénzhāng yào jiǎnmíng èyào, qiānwàn bú yào huàshétiānzú.",
    exampleVi: "Viết văn cần ngắn gọn súc tích, tuyệt đối không được vẽ rắn thêm chân làm thừa thãi."
  },
  {
    chengyu: "一石二鸟",
    pinyin: "Yī shí èr niǎo",
    hanviet: "Nhất thạch nhị điểu",
    literal: "Một hòn đá bắn trúng hai con chim",
    meaning: "Một mũi tên trúng hai đích, một hành động đạt hai mục đích tốt đẹp",
    origin: "Tương đương thành ngữ phương Tây 'Kill two birds with one stone'.",
    example: "学汉语既能了解中国文化，又能增加就业机会，真是一石二鸟。",
    examplePinyin: "Xué Hànyǔ jì néng liǎojiě Zhōngguó wénhuà, yòu néng zēngjiā jiùyè jīhuì, zhēn shì yì shí èr niǎo.",
    exampleVi: "Học tiếng Trung vừa hiểu được văn hóa, vừa tăng cơ hội việc làm, quả là một mũi tên trúng hai đích."
  },
  {
    chengyu: "守株待兔",
    pinyin: "Shǒu zhū dài tù",
    hanviet: "Thủ chu đãi thố",
    literal: "Ôm cây đợi thỏ",
    meaning: "Trông chờ may mắn ngẫu nhiên, không chịu nỗ lực phấn đấu",
    origin: "Người nước Tống thấy thỏ chạy va vào gốc cây chết, liền bỏ cày ruộng ngồi ôm cây chờ thỏ tiếp theo.",
    example: "只有努力工作才能成功，守株待兔是不会有好结果的。",
    examplePinyin: "Zhǐyǒu nǔlì gōngzuò cáinéng chénggōng, shǒuzhūdàitù shì bú huì yǒu hǎo jiéguǒ de.",
    exampleVi: "Chỉ có chăm chỉ làm việc mới thành công, ôm cây đợi thỏ sẽ chẳng có kết quả tốt đâu."
  },
  {
    chengyu: "半途而废",
    pinyin: "Bàn tú ér fèi",
    hanviet: "Bán đồ nhi phế",
    literal: "Nửa đường bỏ dở",
    meaning: "Bỏ cuộc giữa chừng, thiếu kiên trì bền bỉ",
    origin: "Thầy Mạnh Tử dạy học trò: Học hành giống như dệt vải, bỏ dở giữa chừng thì vải hỏng việc hỏng.",
    example: "学外语最怕半途而废，坚持下去才能看到进步。",
    examplePinyin: "Xué wàiyǔ zuì pà bàntú'érfèi, jiānchí xiàqù cáinéng kàndào jìnbù.",
    exampleVi: "Học ngoại ngữ sợ nhất là bỏ dở giữa chừng, kiên trì theo đuổi mới thấy sự tiến bộ."
  },
  {
    chengyu: "入乡随俗",
    pinyin: "Rù xiāng suí sú",
    hanviet: "Nhập hương tùy tục",
    literal: "Vào làng theo tục làng",
    meaning: "Đến đâu phải tuân theo phong tục tập quán ở nơi đó (Nhập gia tùy tục)",
    origin: "Lời răn người xưa khi đi xa quê hương cần tôn trọng văn hóa bản địa.",
    example: "出国旅游应该入乡随俗，尊重当地的风俗习惯。",
    examplePinyin: "Chūguó lǚyóu yīnggāi rùxiāngsuísú, zūnzhòng dāngdì de fēngsú xíguàn.",
    exampleVi: "Đi du lịch nước ngoài nên nhập gia tùy tục, tôn trọng phong tục tập quán địa phương."
  }
];
