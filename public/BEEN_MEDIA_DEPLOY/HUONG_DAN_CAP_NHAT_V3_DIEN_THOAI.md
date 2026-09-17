# BEEN MEDIA ERP V3 - Bản điện thoại

## Có gì mới
- Trang chủ ưu tiên việc cần xử lý: job hôm nay/ngày mai, nhắc trong 24 giờ, job đã xong còn nợ.
- Lịch tháng tối ưu điện thoại: ngày có job được đánh dấu, bấm ngày xem toàn bộ job.
- Thanh điều hướng dưới điện thoại: Trang chủ / Lịch / Thu-Chi / Công nợ / Thêm.
- Mục Thu / Chi: nhập chi phí như "1.000.000đ mua đồ" và tự lên báo cáo.
- Báo cáo tháng/năm: doanh thu job, đã thu, khách còn nợ, chi vận hành, lương đã trả và còn phải trả.

## Bắt buộc trước khi dùng Thu / Chi
1. Vào Supabase của BEEN MEDIA.
2. Chọn SQL Editor > New query.
3. Mở file `UPDATE_V3_THU_CHI.sql`, copy toàn bộ và Run.
4. Sau khi báo Success mới deploy bản code mới.

## Chạy thử trên máy
```bash
npm install
npm run dev
```
Mở http://localhost:3000

## Deploy
Deploy lại đúng project/domain `erp.beenmedia.com.vn` như bản hiện tại. Giữ nguyên hai biến môi trường Supabase đang dùng.

## Lưu ý
Thông báo 24 giờ hiện ở Trang chủ khi mở app/web. Đây là nhắc việc trong hệ thống, chưa phải push notification khi điện thoại đóng trình duyệt.
