BEEN MEDIA - FIX MAN HINH THO / JOB CUA TOI
Ngay: 14/09/2026

Da sua app/job/WorkerJobPage.tsx:
1. Van hien thi tat ca dia diem cua Job.
2. Doc dung work_location_name/work_location_address cua job_assignments cua thợ dang dang nhap.
3. Dia diem duoc phan cong duoc danh dau ro: "BẠN LÀM TẠI ĐÂY".
4. Hien them dong "Phân công của bạn" + vai tro + dia diem.
5. Khi sao chep cong viec, them dia diem duoc phan cong.
6. Logic SĐT giu nguyen: chi hien truoc 48h HOẶC khi Admin chu dong bat "Mo SĐT cho thợ xem ngay"; job hoan thanh thi an.

Luu y:
- Trong anh Admin gui, mot so phan cong dang hien "Đang mở". Nhung phan cong nay se duoc xem SĐT ngay du con xa hon 48h, vi Admin da mo som.
- Neu muon an lai, Admin bam nut "Đang mở" de chuyen ve "Mở sớm".
