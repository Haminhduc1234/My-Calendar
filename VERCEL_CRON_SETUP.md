# Hướng dẫn thiết lập Vercel Cron — Tự động gửi Push Notification trước sự kiện 1 tiếng

## Tổng quan

Hệ thống hoạt động như sau:

```
┌──────────────┐    Tạo sự kiện    ┌──────────────────────────────┐
│  Client App  │ ────────────────→ │ Firebase RTDB                │
│  (script.js) │                   │ eventReminders/{profile}/{id}│
└──────────────┘                   │   reminderAtMs: 1694000000   │
                                   │   delivered: false            │
                                   └──────────────┬───────────────┘
                                                  │
┌──────────────┐   Mỗi 5 phút     │
│  Cron Job    │ ────────────────→ │
│  (Vercel /   │   GET request     │
│  cron-job.org│                   ▼
└──────────────┘         ┌─────────────────────────┐
                         │ /api/cron/check-reminders│
                         │ (Vercel Serverless Func) │
                         │                         │
                         │ 1. Quét eventReminders   │
                         │ 2. Lọc: delivered=false  │
                         │    & reminderAtMs <= now │
                         │ 3. Gửi FCM push         │
                         │ 4. Update delivered=true │
                         └─────────────────────────┘
```

---

## Bước 1: Lấy Service Account Key từ Firebase Console

1. Truy cập [Firebase Console](https://console.firebase.google.com/)
2. Chọn project **calendar-ac2fa**
3. Nhấn **⚙️ Project Settings** (biểu tượng bánh răng góc trên bên trái)
4. Chọn tab **Service accounts**
5. Nhấn nút **Generate new private key**
6. Xác nhận → File JSON sẽ được tải về máy

> ⚠️ **QUAN TRỌNG**: File này chứa private key. Không commit vào git, không chia sẻ công khai.

---

## Bước 2: Đặt biến môi trường trên Vercel

### 2.1 FIREBASE_SERVICE_ACCOUNT

1. Truy cập [Vercel Dashboard](https://vercel.com/dashboard)
2. Chọn project của bạn
3. Vào **Settings** → **Environment Variables**
4. Thêm biến mới:
   - **Name**: `FIREBASE_SERVICE_ACCOUNT`
   - **Value**: Copy-paste **TOÀN BỘ** nội dung file JSON vừa tải về
   - **Environment**: Chọn cả Production, Preview, Development

> **Lưu ý về Private Key (\\n)**:
> - Vercel xử lý ký tự `\n` trong JSON string đúng cách khi bạn paste nguyên file.
> - **KHÔNG** cần escape thêm hay thay `\n` bằng ký tự nào khác.
> - Nếu gặp lỗi parse, kiểm tra bạn đã paste đúng toàn bộ nội dung file JSON (bắt đầu bằng `{` và kết thúc bằng `}`).

**Nếu bạn muốn dùng từng key riêng lẻ** (thay vì paste cả file JSON):

| Biến | Giá trị (lấy từ file JSON) |
|------|---------------------------|
| `FIREBASE_PROJECT_ID` | `project_id` |
| `FIREBASE_CLIENT_EMAIL` | `client_email` |
| `FIREBASE_PRIVATE_KEY` | `private_key` (paste nguyên, bao gồm `-----BEGIN PRIVATE KEY-----`) |

Khi đó cần sửa code khởi tạo thành:
```javascript
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  }),
  databaseURL: "https://calendar-ac2fa-default-rtdb.firebaseio.com"
});
```

### 2.2 CRON_SECRET

1. Tạo một chuỗi bí mật ngẫu nhiên, ví dụ:
   ```
   my-super-secret-cron-key-2024
   ```
   Hoặc tạo UUID: truy cập https://www.uuidgenerator.net/ và copy UUID.

2. Thêm biến trên Vercel:
   - **Name**: `CRON_SECRET`
   - **Value**: Chuỗi bí mật vừa tạo
   - **Environment**: Production, Preview, Development

---

## Bước 3: Thiết lập Cron Job

### Option A: Vercel Cron Jobs (Yêu cầu Vercel Pro)

File `vercel.json` đã được cấu hình sẵn:

```json
{
  "crons": [
    {
      "path": "/api/cron/check-reminders",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

- Vercel Pro: Chạy mỗi 5 phút ✅
- Vercel Hobby (miễn phí): Chỉ chạy 1 lần/ngày ❌ → Dùng Option B

**Sau khi deploy**, kiểm tra tại: Vercel Dashboard → Project → **Cron Jobs** tab.

Vercel Cron tự động gửi header `Authorization: Bearer <CRON_SECRET>` khi gọi.

---

### Option B: cron-job.org (Miễn phí, khuyến nghị cho Hobby plan)

1. Truy cập [cron-job.org](https://cron-job.org/) và tạo tài khoản miễn phí
2. Nhấn **Create cronjob**
3. Cấu hình:

| Trường | Giá trị |
|--------|---------|
| **Title** | Check Event Reminders |
| **URL** | `https://your-vercel-domain.vercel.app/api/cron/check-reminders` |
| **Schedule** | Every 5 minutes (`*/5 * * * *`) |
| **Request Method** | `GET` |
| **Notifications** | Tắt (hoặc bật nếu muốn nhận email khi fail) |

4. Thêm **Header**:
   - Nhấn **Advanced** → **Request Headers**
   - Thêm header:
     - **Name**: `Authorization`
     - **Value**: `Bearer <CRON_SECRET>` (thay `<CRON_SECRET>` bằng giá trị thực)

5. Nhấn **Create** → Done!

> **Lưu ý**: cron-job.org miễn phí cho tối đa **50 cron jobs** với interval tối thiểu **1 phút**. Quá đủ cho use case này.

---

## Bước 4: Deploy và Kiểm tra

### Deploy
```bash
# Nếu dùng Vercel CLI
vercel --prod

# Hoặc push code lên Git → Vercel auto deploy
git add .
git commit -m "feat: add Vercel Cron for event reminders"
git push
```

### Kiểm tra thủ công

Dùng curl hoặc Postman để test API:

```bash
curl -X GET "https://your-vercel-domain.vercel.app/api/cron/check-reminders" \
  -H "Authorization: Bearer YOUR_CRON_SECRET_HERE"
```

**Response thành công (không có reminder đến hạn):**
```json
{
  "success": true,
  "timestamp": "2024-09-11T03:20:00.000Z",
  "processed": 0,
  "skipped": 0,
  "cleaned": 0,
  "results": []
}
```

**Response thành công (có reminder được gửi):**
```json
{
  "success": true,
  "timestamp": "2024-09-11T03:20:00.000Z",
  "processed": 2,
  "skipped": 0,
  "cleaned": 1,
  "results": [
    {
      "profileKey": "abc123",
      "reminderId": "-NxYz...",
      "eventTitle": "Họp team",
      "success": true,
      "successCount": 2,
      "failureCount": 0
    }
  ]
}
```

### Test end-to-end

1. Mở ứng dụng Lịch, tạo 1 sự kiện mới với thời gian = **thời gian hiện tại + 61 phút**
2. Kiểm tra Firebase RTDB → `eventReminders/{profileKey}` → phải có record mới với `delivered: false`
3. Đợi 1 phút (để `reminderAtMs <= now`) hoặc gọi API thủ công
4. Kiểm tra:
   - Push notification xuất hiện trên thiết bị/browser ✅
   - Record trong RTDB có `delivered: true` ✅
   - `userNotifications/{profileKey}` có entry mới ✅

---

## Cấu trúc thư mục

```
calendar/
├── api/
│   ├── send-push.js              ← (đã có) Gửi push khi tạo sự kiện
│   └── cron/
│       └── check-reminders.js    ← (MỚI) Quét & gửi nhắc nhở định kỳ
├── vercel.json                   ← (CẬP NHẬT) Thêm crons config & route
├── VERCEL_CRON_SETUP.md          ← (MỚI) File hướng dẫn này
└── ...
```

---

## Troubleshooting

### Lỗi "Unauthorized" (401)
- Kiểm tra `CRON_SECRET` trên Vercel khớp với header `Authorization: Bearer <secret>` gửi từ cron.
- Vercel Cron Jobs tự lấy `CRON_SECRET` từ env var. cron-job.org cần set header thủ công.

### Lỗi "Chưa cấu hình FIREBASE_SERVICE_ACCOUNT" (500)
- Kiểm tra biến `FIREBASE_SERVICE_ACCOUNT` đã đặt đúng trên Vercel Dashboard.
- Đảm bảo nội dung là JSON hợp lệ (không bị cắt, không thiếu dấu `{}`).

### Không nhận được push notification
- Kiểm tra `notificationTokens/{profileKey}` có token hợp lệ.
- Kiểm tra browser đã cấp quyền notification (Settings → Notifications → Allow).
- Kiểm tra Service Worker (`firebase-messaging-sw.js`) đang chạy.

### Reminder bị skip (skippedReason: "overdue")
- Reminder quá hạn > 2 giờ sẽ bị đánh dấu skip, không gửi push.
- Điều này là cơ chế an toàn để tránh spam nếu cron tạm ngừng lâu.
