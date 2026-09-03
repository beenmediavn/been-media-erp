-- XÓA KHÁCH TRÙNG DO BẤM LƯU NHIỀU LẦN / LƯU LỖI GIỮA CHỪNG
-- Chạy file này trong Supabase SQL Editor nếu danh sách khách bị trùng.
-- Nó giữ lại khách mới nhất theo số điện thoại/email/tên và xóa bản trùng không có job.

with ranked as (
  select
    id,
    coalesce(nullif(trim(phone), ''), nullif(lower(trim(email)), ''), lower(trim(full_name))) as dup_key,
    row_number() over (
      partition by coalesce(nullif(trim(phone), ''), nullif(lower(trim(email)), ''), lower(trim(full_name)))
      order by created_at desc
    ) as rn
  from customers
), duplicates as (
  select r.id
  from ranked r
  where r.dup_key is not null
    and r.rn > 1
    and not exists (select 1 from jobs j where j.customer_id = r.id)
)
delete from customers c
using duplicates d
where c.id = d.id;
