# BEEN MEDIA ERP - BẢN HOÀN THIỆN THEO QUY TRÌNH JOB / THỢ / LƯƠNG / CÔNG NỢ

## Việc cần làm trước khi chạy

1. Mở Supabase → SQL Editor.
2. Mở file `SUPABASE_SCHEMA.sql` trong project.
3. Copy toàn bộ SQL và bấm Run.

File SQL đã tạo các bảng:

- `customers`: khách hàng CRM
- `employees`: danh sách thợ / nhân sự / user đăng nhập
- `jobs`: booking/job chính
- `job_days`: từng ngày chụp của job
- `job_assignments`: phân công thợ từng ngày, từng nhiệm vụ, kèm lương
- `salary_advances`: ứng lương
- `salary_payments`: thanh toán lương
- `customer_payments`: lịch sử khách thanh toán
- `schedules`: bảng cũ vẫn giữ để không mất dữ liệu cũ

## Cách chạy

```bash
npm install
npm run dev
```

Mở:

```text
http://localhost:3000
```

## Quy trình dùng chính

### 1. Vào Nhân sự
Tạo danh sách thợ:

- Thợ chụp
- Thợ quay
- Flycam
- Editor
- Livestream
- Makeup

Mỗi người có username/password để sau này làm đăng nhập riêng.

### 2. Vào Job
Bấm `+ Tạo job mới`.

Tại đây nhập luôn:

- Thông tin khách hàng hoặc chọn khách CRM cũ
- Ngày khách đặt lịch
- Gói dịch vụ
- Tổng tiền / đặt cọc / còn nợ
- Ngày chụp 1, 2, 3...
- Giờ bắt đầu / kết thúc
- Phân công thợ từng ngày
- Lương từng thợ

Ví dụ:

- Khách Tuấn
- Gói Combo VIP
- 2 ngày
- Mỗi ngày 3 thợ chụp + 2 thợ quay
- Nhập lương từng thợ ngay trong form

### 3. Vào Lịch chụp
Lịch lấy dữ liệu từ `job_days`.

Bấm vào từng ngày sẽ thấy:

- Ngày đó có bao nhiêu job
- Khách nào
- Dịch vụ gì
- Giờ chụp
- Ai làm nhiệm vụ gì
- Lương từng người
- Khách còn nợ bao nhiêu

### 4. Vào Lương
Bấm vào tên thợ để xem:

- Tổng lương phát sinh tháng
- Đã ứng
- Đã thanh toán
- Còn phải trả
- Danh sách job đã làm

Có nút:

- `+ Ứng lương`
- `+ Thanh toán lương`

### 5. Vào Thanh toán
Xem khách nào còn nợ và bấm `Thu thêm` để cập nhật tiền thu.

## Ghi chú

Đây là bản nền tảng dùng thật cho quy trình BEEN MEDIA. Bước sau có thể làm tiếp:

- đăng nhập từng thợ
- thợ chỉ xem job của mình
- chống trùng lịch thợ
- hợp đồng PDF
- Google Drive
- giao diện điện thoại PWA
