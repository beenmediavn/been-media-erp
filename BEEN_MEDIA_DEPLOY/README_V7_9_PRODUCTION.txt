BEEN MEDIA ERP V7.9 - BẢN VẬN HÀNH ỔN ĐỊNH
===========================================

GIỮ NGUYÊN:
- Giao diện gốc nền sáng + sidebar xanh đen.
- Khách hàng, Job, lịch chụp, nhân sự, thợ dự phòng.
- Công nợ, Thu/Chi, Lương, Google Drive, Báo cáo.
- PIN bảo vệ sửa/xóa, lọc Job, thợ khách chỉ định, sao chép ngày.
- Tạo Job trực tiếp tại Lịch.

BỔ SUNG V7.9:
1. AI tạm ẩn để không phát sinh lỗi/chi phí. Có thể bật lại sau.
2. Tìm kiếm nhanh thật trên thanh trên cùng: khách, SĐT, Job, nhân sự.
3. Chuông nhắc việc: Job hôm nay/ngày mai + công nợ.
4. Hiển thị trạng thái online/offline.
5. Tạo Job khi mất mạng: form tự giữ bản nháp trên thiết bị; có mạng mở lại và bấm Lưu Job để đồng bộ.
6. PWA/service worker được làm mới và không cache API.
7. Sửa thống kê trạng thái Job trên Tổng quát.

BIẾN MÔI TRƯỜNG CẦN CÓ TRÊN VERCEL:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- ZALO_OA_ACCESS_TOKEN (nếu dùng)
- ZALO_TEMPLATE_CONFIRM_ID (nếu dùng)
- ZALO_TEMPLATE_REVIEW_ID (nếu dùng)

AI TẠM TẮT:
- Không cần xóa OPENAI_API_KEY đã có trên Vercel.
- Không đặt NEXT_PUBLIC_ENABLE_AI=true và ENABLE_AI=true thì menu AI sẽ ẩn.
- Sau này muốn bật AI: thêm/bật hai biến trên thành true rồi Redeploy.

CẬP NHẬT GITHUB/VERCEL:
1. Copy toàn bộ file V7.9 vào thư mục Git hiện tại của project (KHÔNG xóa thư mục .git).
2. PowerShell trong thư mục project:
   git add .
   git commit -m "V7.9 production stable"
   git push origin main
3. Vercel tự Deploy. Chờ trạng thái Ready.

LƯU Ý BẢO MẬT:
- File ZIP này không chứa .env.local hay API key thật.
- Không gửi API key/token lên chat hoặc commit lên GitHub.
- Hệ thống hiện dùng Supabase anon + RLS hiện hữu; nếu lưu dữ liệu rất nhạy cảm, nên làm bước hardening RLS/Auth riêng sau khi vận hành ổn định.
