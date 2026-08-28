-- BEEN MEDIA ERP V8.0.2
-- 1) Mật khẩu ban đầu Admin chính
insert into public.app_settings (id,value,note,updated_at)
values ('admin_password','181096','Mật khẩu đăng nhập Admin chính',now())
on conflict (id) do update
set value=excluded.value,
    note=excluded.note,
    updated_at=excluded.updated_at;

-- 2) Chuẩn hóa username nhân sự về chữ thường, bỏ khoảng trắng đầu/cuối.
update public.employees
set username = lower(trim(username))
where username is not null;

-- 3) Không cho nhân sự dùng username dành riêng "admin".
update public.employees
set username = username || '_' || substr(id::text,1,4)
where lower(trim(coalesce(username,''))) = 'admin';

-- 4) Nếu đang có username trùng, tự thêm hậu tố ngắn để không mất tài khoản.
with ranked as (
  select
    id,
    username,
    row_number() over (
      partition by lower(trim(username))
      order by created_at nulls last, id
    ) as rn
  from public.employees
  where username is not null and trim(username) <> ''
)
update public.employees e
set username = lower(trim(e.username)) || '_' || substr(e.id::text,1,4)
from ranked r
where e.id=r.id and r.rn>1;

-- 5) Khóa trùng username ở cấp database, không phân biệt HOA/thường.
create unique index if not exists employees_username_unique_idx
on public.employees (lower(trim(username)))
where username is not null and trim(username) <> '';

notify pgrst, 'reload schema';
