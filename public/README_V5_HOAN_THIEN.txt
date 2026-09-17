BEEN MEDIA ERP V5 - BẢN HOÀN THIỆN THEO GÓP Ý

Đã gom các thay đổi chính:
- Lịch tháng: bấm ngày xem số Job, chi tiết Job, ekip, công nợ, thợ khách chỉ định.
- Job: tìm kiếm khách/SĐT/tên sự kiện/mã Job; lọc năm, tháng, thợ; tab Tất cả/Đã hoàn thành/Chưa hoàn thành.
- Hiển thị ekip ngay ngoài danh sách Job.
- Sao chép ngày chụp: giữ địa chỉ, ekip, tiền công, ghi chú; chỉ để trống ngày mới.
- Thợ dự phòng theo ngày và thêm nhanh vào Job.
- Đánh dấu ⭐ thợ khách chỉ định, cảnh báo đỏ trên Lịch.
- Sửa/Xóa Job yêu cầu PIN (mặc định 2580, có thể đổi trong app_settings).
- Công nợ: sửa/xóa giao dịch thu tiền và tính lại công nợ.
- Lương: sửa/xóa khoản ứng/thanh toán, hiển thị rõ BEEN MEDIA còn phải trả / trả dư / đã đủ.
- Thu/Chi + Báo cáo tháng/năm; đổi tên rõ Khách còn nợ / Chi phí hoạt động.
- Nhắc Job trong 24h và Job đã xong nhưng chưa thu đủ trên Dashboard.
- Giao diện mobile có thanh điều hướng dưới, PWA, có thể lưu Job tạm khi offline.
- Tất cả ô tiền chính tự chèn dấu hàng nghìn ngay khi gõ: 1000 -> 1.000; 1000000 -> 1.000.000.
- Lưu Job có khóa chống bấm nhiều lần; nếu lỗi sau khi tạo Job mới, hệ thống tự hoàn tác bản Job lỗi để tránh sinh Job trùng.
- Các form chính có nhãn tên trường cố định phía trên để dễ hiểu trên điện thoại.

CẬP NHẬT DATABASE:
1) Supabase > SQL Editor > New query
2) Chạy UPDATE_V3_THU_CHI.sql nếu chưa chạy.
3) Chạy UPDATE_V4_THO_DU_PHONG.sql nếu chưa chạy.
4) Chạy UPDATE_V5_HOAN_THIEN.sql (an toàn khi chạy lại).

CHẠY THỬ:
npm install
npm run dev
Mở http://localhost:3000

LƯU Ý OFFLINE:
- PWA cache giao diện cơ bản.
- Khi mất mạng, form Job có thể lưu bản nháp cục bộ trên thiết bị.
- Khi có mạng, mở lại bản nháp offline và bấm Lưu để đồng bộ lên Supabase.
