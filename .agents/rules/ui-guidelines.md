---
description: "Quy tắc thiết kế giao diện, icon và modal toàn hệ thống Personal Assistant / Calendar"
globs: ["*.css", "*.js", "*.html"]
---

# Quy Tắc Thiết Kế Giao Diện & Icon Toàn Hệ Thống

Tài liệu này định nghĩa các quy tắc chuẩn bắt buộc áp dụng khi phát triển giao diện (HTML/CSS/JS) cho toàn bộ ứng dụng.

---

## 1. Quy tắc căn chỉnh quang học cho Icon (Optical Icon Alignment Rule)

### Vấn đề cốt lõi:
Trong font biểu tượng **Flaticon UIcons** (`<i class="fi fi-rr-..."></i>`, `fi-sr-*`, etc.), trọng tâm quang học và baseline của ký tự glyph luôn nằm cao hơn so với trục x-height/cap-height của font chữ văn bản tiếng Việt ('Be Vietnam Pro' và font hệ thống).
Nếu chỉ dùng `display: flex; align-items: center;` thông thường, **icon luôn bị trôi cao hơn khoảng 1px so với chữ viết đứng cạnh nó**.

### Quy tắc bắt buộc:
1. **Khi icon đứng cạnh văn bản** (trong Button, Tab, Pill, Badge, Card, Label, List item...):
   - Phải áp dụng:
     ```css
     i[class*="fi-"],
     i.fi,
     .fi {
       display: inline-flex;
       align-items: center;
       justify-content: center;
       line-height: 1;
       position: relative;
       top: 1px; /* Hạ nhẹ 1px để cân bằng thị giác hoàn hảo với chữ */
     }
     ```
   - Đã được định nghĩa toàn cục tại đầu file `style.css` và `family-cookbook.css`.

2. **Khi icon đứng độc lập một mình** (không có chữ bên cạnh, ví dụ nút tròn/vuông như nút đóng `×`, nút yêu thích ⭐, nút back `←`):
   - Giữ căn giữa tuyệt đối ở tâm:
     ```css
     button:empty > i,
     .modal-close > i,
     .btn-icon-only > i {
       position: static !important;
       top: 0 !important;
     }
     ```

3. **Icon trong ô input tìm kiếm**:
   - Căn giữa chiều dọc kèm bù 1px cho khớp với chữ placeholder:
     ```css
     .search-box i {
       position: absolute !important;
       top: 50% !important;
       transform: translateY(-50%) !important;
       margin-top: 1px !important;
     }
     ```

---

## 2. Quy tắc thiết kế Modal chính (Full-Screen Main Modal Rule)

1. **Modal tính năng chính phải là Full Screen**:
   - Các modal chức năng chính (Sự kiện lặp lại, Danh bạ người cao tuổi, Sổ tay nấu ăn gia đình, v.v.) bắt buộc hiển thị toàn màn hình:
     - `width: 100vw !important; height: 100vh !important; height: 100dvh !important;`
     - `border-radius: 0 !important; border: none !important; margin: 0 !important;`
   - Không thiết kế dạng popup hộp thoại lơ lửng nhỏ giữa màn hình cho các tính năng chính.

2. **Cấu trúc Header & Tabs cố định (Sticky Top)**:
   - Header cố định trên cùng (`backdrop-filter: blur(16px)`), nút đóng góc phải trên kích thước chuẩn `34px` × `34px`, bo góc `9px`.
   - Sub-tabs thiết kế dạng **Segmented Pill/Capsule**:
     - Desktop: Căn lề trái chuẩn `24px` đồng bộ thẳng hàng với Header và vùng nội dung.
     - Mobile: Grid 2 cột cân xứng tuyệt đối, căn lề ngang chuẩn `14px`, nút tab cao `38px` với icon và chữ đặt nằm ngang (`flex-direction: row`).
