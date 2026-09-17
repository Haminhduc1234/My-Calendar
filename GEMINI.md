# Quy Tắc Phát Triển Dự Án (Project Guidelines)

Tài liệu này chứa các quy chuẩn bắt buộc của dự án khi xây dựng và chỉnh sửa giao diện / tính năng.

---

## 1. Quy tắc căn chỉnh quang học cho Icon (Optical Icon Alignment)
- **Vấn đề**: Ký tự glyph của font biểu tượng Flaticon (`fi`, `fi-rr-*`, `fi-sr-*`) có baseline và trọng tâm quang học cao hơn chữ văn bản tiếng Việt ('Be Vietnam Pro').
- **Quy tắc**:
  - Khi icon đứng ngang hàng với chữ (trong Button, Tab, Pill, Badge, Card, Label...): bắt buộc áp dụng `position: relative; top: 1px; display: inline-flex; align-items: center; justify-content: center; line-height: 1;`.
  - Quy tắc này đã được cấu hình toàn cục trong file [style.css](file:///c:/Users/Admin/Desktop/calendar/style.css) và [family-cookbook.css](file:///c:/Users/Admin/Desktop/calendar/family-cookbook.css).
  - Khi tạo mới các component hoặc style, luôn duy trì quy tắc này, không để icon bị lệch cao hơn chữ.
  - Các nút icon độc lập (không kèm chữ, như nút close `×`, nút favorite, nút back) giữ `position: static; top: 0;` để cân đúng tâm.

---

## 2. Quy tắc thiết kế Modal chính (Full-Screen Main Modal)
- Mọi modal tính năng chính của ứng dụng (Sự kiện lặp lại, Danh bạ người cao tuổi / Gọi Zalo, Sổ tay nấu ăn gia đình, v.v.) **BẮT BUỘC** hiển thị ở chế độ **Toàn Màn Hình (Full Screen: 100vw × 100vh / 100dvh, border-radius: 0px, border: none)**.
- Header và Tabs phải là Sticky Top (`backdrop-filter: blur(16px)`), nút đóng chuẩn `34px` × `34px`, bo góc `9px`.
- Sub-tabs thiết kế theo phong cách **Segmented Pill/Capsule**, đồng bộ lề ngang: `24px` trên Desktop, `14px` trên Mobile.
