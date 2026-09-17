BEEN MEDIA ERP V8.1 - OFFLINE COMPLETE

ĐÃ LÀM TRONG SOURCE:
1. Job tạo/sửa khi mất mạng được lưu vào IndexedDB thay vì chỉ localStorage.
2. Khi có mạng trở lại, OfflineSyncManager tự đồng bộ queue lên Supabase mỗi 30 giây và ngay khi nhận sự kiện online.
3. Dùng UUID tạo sẵn cho Job/Ngày/Địa điểm/Phân công để retry không sinh bản ghi trùng.
4. Có kiểm tra updated_at khi đồng bộ Job đã sửa offline; nếu server đã đổi thì giữ trạng thái conflict, không ghi đè mù.
5. Tạo Job nhanh ngay trên Lịch cũng đưa vào queue offline và tự sync.
6. Widget mạng luôn hiện: Online/Offline, ping, loại mạng, tốc độ ước tính nếu trình duyệt hỗ trợ, số thay đổi chưa sync.
7. Widget có nút Đồng bộ ngay.
8. Service Worker V8.1 cache trang đã mở + Next static chunks; có offline.html dự phòng.
9. Sửa form số thợ CHỤP/QUAY trên mobile thành 1 cột, từ sm trở lên 2 cột.
10. Sửa Dashboard: Job quá ngày không tự bị coi là hoàn thành; chỉ status Hoàn thành/Đã bàn giao mới tính đã xong.
11. Chat: nhân sự chỉ được mở chat riêng với Admin; Admin tạo nhóm. Thêm Thu hồi và Xóa phía tôi.
12. Thêm SQL hợp nhất để tạo salary_adjustments, cột version/updated_at, chat recall và nền tảng audit/multi-studio.

BẮT BUỘC TRƯỚC KHI DÙNG V8.1:
- Supabase > SQL Editor > chạy toàn bộ UPDATE_V8_1_OFFLINE_CHAT_COMPLETE.sql.
- Sau đó deploy source V8.1.
- Trên điện thoại đã cài PWA: đóng app mở lại. Service Worker mới sẽ tự thay bản cũ.

LƯU Ý BẢO MẬT/MULTI-STUDIO:
- Source hiện tại dùng đăng nhập nội bộ + anon key, chưa phải Supabase Auth.
- V8.1 chỉ thêm studio_id và bảng studios để chuẩn bị dữ liệu. CHƯA bật RLS cô lập studio vì bật ngay trên kiến trúc đăng nhập hiện tại sẽ khóa app.
- Muốn bán cho nhiều studio với dữ liệu cách ly thật sự, bước tiếp theo phải chuyển login sang Supabase Auth/server session rồi mới siết RLS theo studio_members.
