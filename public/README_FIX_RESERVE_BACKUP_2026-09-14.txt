BEEN MEDIA - FIX 14/09/2026

1) THỢ DỰ PHÒNG TRONG FORM JOB
- Khi bấm thợ dự phòng gợi ý, app ưu tiên điền vào ô phân công trống có sẵn đúng vai trò.
- Không tự sinh thêm dòng/cột thứ 3 nếu đang có ô trống.
- Sau khi bấm chọn, thợ đó biến mất ngay khỏi danh sách gợi ý của ngày đang nhập.
- Chặn thêm cùng một thợ 2 lần trong cùng một ngày.
- Khi lưu Job, reserve_workers mới chuyển sang trạng thái "Đã xếp Job" như logic hiện tại.

2) SAO LƯU EXCEL RÚT GỌN
Excel chỉ còn 3 sheet dễ xem:
- TONG HOP: số Job, tổng giá trị Job, tổng đã thu/cọc, tổng còn nợ, tiền vào, tiền ra, tổng lương thợ, còn lãi.
- CHI TIET JOB: ngày Job, khách/Job, tổng tiền, đã cọc/đã thu, còn nợ, ai chụp, ai quay, lương ekip, lãi dự kiến Job.
- LUONG THO: nhân sự, số Job, lượt chụp, lượt quay, việc khác, tổng lương.

JSON vẫn giữ dữ liệu kỹ thuật đầy đủ để phục hồi khi cần.
