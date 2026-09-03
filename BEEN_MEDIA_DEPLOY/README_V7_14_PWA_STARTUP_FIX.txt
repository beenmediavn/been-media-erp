BEEN MEDIA ERP V7.14 - PWA STARTUP FIX

Sửa lỗi: mở website bằng Chrome bình thường nhưng khi thêm ra màn hình chính thì mở ra màn hình trắng.

Nguyên nhân chính:
- Trang chủ cũ trả về null khi phiên đăng nhập chưa tồn tại trong ngữ cảnh PWA độc lập.
- PWA có thể giữ bundle Next.js cũ trong cache.

Đã sửa:
1. Nếu PWA chưa có phiên đăng nhập, tự chuyển sang /login thay vì màn hình trắng.
2. Có màn hình 'Đang mở ứng dụng...' trong lúc kiểm tra phiên.
3. Manifest mở canonical root '/'.
4. Service worker V7.14 không cache-first bundle /_next/.
5. Service worker tự kiểm tra cập nhật.
6. Thêm metadata standalone cho thiết bị di động.

Sau khi deploy:
- Xóa icon ERP cũ khỏi màn hình chính.
- Mở erp.beenmedia.com.vn bằng trình duyệt và tải lại.
- Thêm lại vào màn hình chính.
