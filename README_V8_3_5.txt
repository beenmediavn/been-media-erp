BEEN MEDIA ERP V8.3.5

FIX DỨT ĐIỂM:
- Localhost tự unregister Service Worker và xóa cache cũ để không còn trang /job tụt về V8.2.3.
- Production đổi cache PWA sang v8-3-5 và Next static dùng network-first.
- Dashboard > Sắp xếp ngay dùng full navigation /job?open=<job_id>&edit=1&focus=staff.
- Trang Job đọc job_id từ URL, mở đúng Job ở chế độ sửa và focus Phân công nhân sự.
- Không cần SQL mới.
