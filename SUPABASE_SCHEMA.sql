-- BEEN MEDIA ERP - DATABASE SETUP FULL
-- Chạy toàn bộ file này trong Supabase SQL Editor.
-- File này an toàn để chạy lại nhiều lần.

create extension if not exists pgcrypto;

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  customer_code text,
  full_name text,
  phone text,
  secondary_phone text,
  email text,
  address text,
  facebook text,
  service text,
  total_price numeric default 0,
  deposit numeric default 0,
  debt numeric default 0,
  status text default 'Đang xử lý',
  note text,
  created_at timestamp default now()
);

create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  role text,
  username text,
  password text,
  base_fee numeric default 0,
  active boolean default true,
  created_at timestamp default now()
);

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  job_code text,
  customer_id uuid references customers(id) on delete set null,
  customer_name text,
  customer_phone text,
  secondary_phone text,
  event_name text,
  booking_date date,
  service text,
  total_price numeric default 0,
  deposit numeric default 0,
  debt numeric default 0,
  status text default 'Đã đặt cọc',
  location text,
  note text,
  created_at timestamp default now()
);

create table if not exists job_days (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id) on delete cascade,
  shooting_date date not null,
  start_time text,
  end_time text,
  location text,
  note text,
  created_at timestamp default now()
);

create table if not exists job_assignments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id) on delete cascade,
  job_day_id uuid references job_days(id) on delete cascade,
  employee_id uuid references employees(id) on delete set null,
  role text,
  salary_amount numeric default 0,
  paid boolean default false,
  note text,
  work_location_name text,
  work_location_address text,
  work_location_phone text,
  created_at timestamp default now()
);

create table if not exists salary_advances (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) on delete cascade,
  amount numeric default 0,
  advance_date date default current_date,
  note text,
  created_at timestamp default now()
);

create table if not exists salary_payments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) on delete cascade,
  amount numeric default 0,
  payment_date date default current_date,
  note text,
  created_at timestamp default now()
);

create table if not exists customer_payments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete cascade,
  job_id uuid references jobs(id) on delete cascade,
  amount numeric default 0,
  payment_date date default current_date,
  payment_type text default 'Đặt cọc',
  note text,
  created_at timestamp default now()
);

create table if not exists schedules (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete set null,
  shooting_date date not null,
  shooting_time text,
  location text,
  team text,
  service text,
  note text,
  created_at timestamp default now()
);

create table if not exists google_drive_files (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id) on delete cascade,
  file_type text not null,
  file_url text not null,
  note text,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  unique(job_id, file_type)
);

alter table customers add column if not exists secondary_phone text;
alter table jobs add column if not exists customer_name text;
alter table jobs add column if not exists customer_phone text;
alter table jobs add column if not exists secondary_phone text;
alter table jobs add column if not exists event_name text;
alter table job_assignments add column if not exists work_location_name text;
alter table job_assignments add column if not exists work_location_address text;
alter table job_assignments add column if not exists work_location_phone text;
alter table google_drive_files add column if not exists updated_at timestamp default now();

-- Vì app đang dùng public anon key và chưa có đăng nhập Supabase Auth,
-- bật RLS nhưng mở policy tạm thời để ERP chạy ổn định. Khi có đăng nhập thật sẽ siết lại quyền.
alter table customers enable row level security;
alter table employees enable row level security;
alter table jobs enable row level security;
alter table job_days enable row level security;
alter table job_assignments enable row level security;
alter table salary_advances enable row level security;
alter table salary_payments enable row level security;
alter table customer_payments enable row level security;
alter table schedules enable row level security;
alter table google_drive_files enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'customers','employees','jobs','job_days','job_assignments',
    'salary_advances','salary_payments','customer_payments','schedules','google_drive_files'
  ] loop
    execute format('drop policy if exists "been_media_public_all" on %I', t);
    execute format('create policy "been_media_public_all" on %I for all using (true) with check (true)', t);
  end loop;
end $$;

insert into employees (full_name, phone, role, username, password, base_fee)
select * from (values
  ('Nam - Thợ chụp', '0900000001', 'Thợ chụp', 'nam', '123456', 700000),
  ('Đức - Thợ chụp', '0900000002', 'Thợ chụp', 'duc', '123456', 700000),
  ('Hùng - Thợ chụp', '0900000003', 'Thợ chụp', 'hung', '123456', 700000),
  ('Minh - Thợ quay', '0900000004', 'Thợ quay', 'minh', '123456', 900000),
  ('Tuấn - Thợ quay', '0900000005', 'Thợ quay', 'tuan', '123456', 900000),
  ('Linh - Editor', '0900000006', 'Editor', 'linh', '123456', 500000)
) as v(full_name, phone, role, username, password, base_fee)
where not exists (select 1 from employees limit 1);
