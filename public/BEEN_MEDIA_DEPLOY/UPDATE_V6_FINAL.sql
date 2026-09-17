-- BEEN MEDIA ERP V6 FINAL
-- Chạy 1 lần trong Supabase > SQL Editor. Có thể chạy lại an toàn.

-- Thanh toán khách
alter table if exists customer_payments add column if not exists method text;
alter table if exists customer_payments add column if not exists note text;
alter table if exists customer_payments add column if not exists payment_type text default 'Đặt cọc';

-- Thợ khách chỉ định
alter table if exists job_assignments add column if not exists client_requested boolean default false;

-- Liên kết Thu/Chi
alter table if exists finance_transactions add column if not exists source_type text;
alter table if exists finance_transactions add column if not exists source_id uuid;
create index if not exists finance_transactions_source_idx on finance_transactions(source_type, source_id);

-- Thợ dự phòng
create table if not exists reserve_workers (
  id uuid primary key default gen_random_uuid(),
  reserve_date date not null,
  employee_id uuid not null references employees(id) on delete cascade,
  role text not null default 'Thợ chụp',
  note text,
  status text not null default 'reserved' check (status in ('reserved','used','cancelled')),
  created_at timestamptz default now(),
  unique(reserve_date, employee_id)
);
alter table reserve_workers enable row level security;
drop policy if exists "been_media_public_all" on reserve_workers;
create policy "been_media_public_all" on reserve_workers for all using (true) with check (true);
create index if not exists reserve_workers_date_idx on reserve_workers(reserve_date);
create index if not exists reserve_workers_employee_idx on reserve_workers(employee_id);

-- Cài đặt app: PIN, logo, ảnh đại diện, tên thương hiệu
create table if not exists app_settings (
  id text primary key,
  value text,
  note text,
  updated_at timestamptz default now()
);
alter table app_settings enable row level security;
drop policy if exists "been_media_public_all" on app_settings;
create policy "been_media_public_all" on app_settings for all using (true) with check (true);
insert into app_settings(id,value,note) values
 ('edit_pin','2580','PIN xác nhận thao tác sửa/xóa quan trọng'),
 ('company_name','BEEN MEDIA','Tên thương hiệu hiển thị')
on conflict (id) do nothing;
