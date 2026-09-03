BEEN MEDIA ERP V6 FINAL

GIAO DIỆN
- Tone chủ đạo #15302B (xanh lục tối) + vàng gold.
- Hoa văn vàng mờ ở nền để giao diện bớt trống nhưng vẫn dễ đọc.
- Desktop và mobile dùng cùng một nhận diện.
- Mobile: Lịch | Job | Trang chủ | Tiền | Báo cáo.
- Dashboard có đồ thị doanh thu, trạng thái Job, Job sắp tới, giao dịch gần đây.

LỊCH & JOB
- Bấm ngày trên Lịch -> thấy số Job, tên Job, giờ, địa điểm, ekip, công nợ.
- Tạo Job NGAY TRÊN LỊCH, không cần nhảy sang trang Job.
- Job khách chỉ định thợ được đánh dấu đỏ + sao.
- Xem/sửa Job; thao tác sửa/xóa quan trọng dùng PIN.
- Trang Job có tìm kiếm, lọc tháng/năm, lọc thợ và Tất cả/Đã hoàn thành/Chưa hoàn thành.
- Có Sao chép ngày chụp, thợ dự phòng, ekip ngoài danh sách Job.

TIỀN
- Ô tiền tự chèn dấu hàng nghìn khi gõ: 1000 -> 1.000; 1000000 -> 1.000.000.
- Công nợ khách, Thu/Chi, lương thợ và báo cáo liên kết dữ liệu.
- Có sửa/xóa giao dịch để xử lý nhập nhầm.
- Báo cáo dùng tên rõ: Khách còn nợ, Chi phí hoạt động, Đã trả/ứng thợ.

THƯƠNG HIỆU
- Cài đặt -> Thương hiệu & tài khoản.
- Có thể thay Logo, ảnh đại diện Admin và tên thương hiệu ngay trong app.

OFFLINE / PWA
- App có service worker và có thể cài lên màn hình chính.
- Khi mất mạng, Job có thể lưu bản nháp cục bộ; khi có mạng mở lại để đồng bộ.

AI
- Giữ chế độ tùy chọn để tránh phát sinh phí ngoài ý muốn.
- Có thể tích hợp AI nhập Job từ tin nhắn, hỏi dữ liệu và tóm tắt tài chính sau khi cấu hình API.

CẬP NHẬT DATABASE
1. Supabase -> SQL Editor -> New query.
2. Dán toàn bộ UPDATE_V6_FINAL.sql.
3. Run 1 lần.
4. Nếu hiện "Success. No rows returned" là xong.

CHẠY TRÊN MÁY
npm install
npm run dev
Mở http://localhost:3000
