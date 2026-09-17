# BEEN MEDIA ERP V4 - Cập nhật Thợ dự phòng

1. Vào Supabase > SQL Editor.
2. Mở file `UPDATE_V4_THO_DU_PHONG.sql`, copy toàn bộ và bấm Run một lần.
3. Chạy app bằng `npm install` rồi `npm run dev`.
4. Menu mới `Thợ dự phòng`: chọn từ ngày - đến ngày, chọn thợ, vai trò, ghi chú rồi bấm `Chốt dự phòng`.
5. Trong `Lịch chụp`, ngày có thợ dự phòng sẽ có chấm vàng; bấm ngày để xem danh sách.
6. Khi tạo Job và chọn đúng ngày, app tự hiện `Thợ dự phòng ngày ...`; tại từng địa điểm bấm tên thợ để thêm nhanh vào Job.
7. Nút `Sao chép ngày` trong Job giữ nguyên giờ, địa chỉ, thợ, lương và ghi chú; chỉ để trống ngày mới để chọn lại.

Lưu ý: Bản V4 không xóa dữ liệu cũ. Chỉ thêm bảng `reserve_workers`.
