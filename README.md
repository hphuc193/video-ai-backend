# ⚙️ AI Video Generator - Core Backend API
 
Máy chủ cốt lõi xử lý toàn bộ logic nghiệp vụ, xác thực bảo mật, quản lý cơ sở dữ liệu và điều phối luồng xử lý tới AI Server. Được xây dựng theo kiến trúc RESTful API.
 
## 🚀 Trách nhiệm chính (Core Responsibilities)
- **Xác thực (Authentication):** Xử lý luồng đăng nhập Google OAuth 2.0, cấp phát và xác minh JWT Token (RBAC - Role Based Access Control).
- **Toàn vẹn Dữ liệu Tài chính:** Sử dụng Database Transactions để xử lý việc nạp, trừ Credit, đảm bảo quy tắc ACID (không bao giờ trừ tiền nếu lịch sử giao dịch chưa được ghi lại).
- **Điều phối AI (Worker Coordination):** Nhận lệnh tạo video từ Mobile, ghi nhận trạng thái Pending vào DB, sau đó trigger HTTP Request sang AI Server để kết xuất đồ họa.
- **Webhook Handler:** Mở cổng Webhook nhận thông báo từ AI Server để cập nhật trạng thái Video (Success/Failed) và thực hiện hoàn tiền tự động nếu render lỗi.
## 🛠 Ngăn xếp công nghệ (Tech Stack)
- **Runtime:** Node.js
- **Framework:** Express.js
- **Database ORM:** Prisma
- **Database:** PostgreSQL (khuyến nghị chạy qua Docker)
- **Bảo mật:** JWT (JSON Web Token), bcrypt
## ⚙️ Hướng dẫn cài đặt
 
1. Clone dự án:
```bash
   git clone <repo_url>
```
 
2. Cài đặt thư viện:
```bash
   npm install
```
 
3. Tạo file `.env` (tham khảo `.env.sample`) với thông tin kết nối DB và JWT Secret.
4. Chạy cấu trúc Database (Migrations):
```bash
   npx prisma migrate dev
```
 
5. Khởi động Server:
```bash
   npm start
```
 
   Server sẽ chạy mặc định ở cổng `3000`.
 
---
 
*Dự án thuộc Hệ sinh thái AI Video Generator:*
https://github.com/hphuc193/ai-video-python-server
https://github.com/hphuc193/ai-video-generator-mobile
https://github.com/hphuc193/video-ai-admin
