# Hướng dẫn bật nút gửi Zalo OA trong BEEN MEDIA ERP

Bản này đã thêm 2 nút trong chi tiết Job:

- **Gửi OA xác nhận**: gửi template xác nhận lịch.
- **Gửi OA đánh giá**: gửi template đánh giá sau khi hoàn thành Job.

## 1. Cấu hình `.env.local`

Mở file `.env.local` và điền 3 dòng này:

```env
ZALO_OA_ACCESS_TOKEN=ACCESS_TOKEN_OA_CUA_BAN
ZALO_TEMPLATE_CONFIRM_ID=ID_TEMPLATE_XAC_NHAN_LICH
ZALO_TEMPLATE_REVIEW_ID=ID_TEMPLATE_DANH_GIA
```

Sau khi sửa `.env.local`, bắt buộc tắt server rồi chạy lại:

```bash
Ctrl + C
npm run dev
```

## 2. Dữ liệu gửi template xác nhận lịch

ERP sẽ tự lấy dữ liệu từ Job theo file mẫu `SampleTemplate_ xác nhận lich.xlsx`:

- `phone`: SĐT khách
- `date`: ngày gửi
- `address`: địa chỉ chụp đầu tiên
- `price`: còn nợ, nếu không có thì tổng tiền
- `event_date`: ngày + giờ chụp
- `name`: tên khách
- `service_package`: gói dịch vụ
- `phone_number`: SĐT khách
- `customer_name`: tên sự kiện / tên dâu rể

## 3. Dữ liệu gửi template đánh giá

ERP sẽ tự lấy dữ liệu theo file mẫu `SampleTemplate_danh gia.xlsx`:

- `phone`: SĐT khách
- `order_code`: gói dịch vụ hoặc mã Job
- `order_date`: ngày chụp đầu tiên
- `$zReqId`: để trống
- `$zReqTime`: để trống
- `customer_name`: tên sự kiện / tên dâu rể

## 4. Lưu ý

Nếu bấm gửi mà báo chưa cấu hình, nghĩa là bạn chưa điền access token hoặc template ID.
Nếu Zalo báo lỗi, kiểm tra:

- SĐT khách có tài khoản Zalo không.
- Template đã được duyệt chưa.
- Tên biến trong template có khớp đúng không.
- Access token OA còn hạn không.
