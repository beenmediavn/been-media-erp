BEEN MEDIA ERP V7.23

Đã sửa/thêm:
- Lưu riêng tất cả địa điểm trong Job (Nhà trai, Nhà gái, nhà hàng...) kể cả địa điểm không có thợ được phân công.
- Nhân sự được phân công vào một địa điểm vẫn xem được toàn bộ địa chỉ các địa điểm trong cùng ngày Job.
- SĐT các địa điểm chỉ hiện theo quyền mở/48h và tự ẩn khi Job chuyển trạng thái Hoàn thành.
- Sửa lỗi Tổng thợ CHỤP/QUAY cần: tạo Job mới cũng lưu required_photo_count/required_video_count.
- Thêm avatar_url cho nhân sự.
- Nhân sự bấm ảnh/tên góc trên hoặc Hồ sơ cá nhân để tự cập nhật ảnh đại diện.
- Khi Admin chọn thợ trong Job, danh sách hiển thị avatar + tên + vai trò và vẫn khóa người bị trùng giờ.

BẮT BUỘC: chạy UPDATE_V7_23_LOCATIONS_AVATAR.sql trong Supabase SQL Editor một lần trước khi dùng.
Lưu ý Job cũ chưa từng lưu Nhà gái nếu không có assignment thì không thể khôi phục địa chỉ đã mất; mở Job cũ và nhập lại Nhà gái rồi Cập nhật Job để lưu theo cấu trúc mới.
