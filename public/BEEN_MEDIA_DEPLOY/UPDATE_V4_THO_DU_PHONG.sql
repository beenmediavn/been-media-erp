-- BEEN MEDIA ERP V4 - Tho du phong
create table if not exists reserve_workers (
  id uuid primary key default gen_random_uuid(),
  reserve_date date not null,
  employee_id uuid not null references employees(id) on delete cascade,
  role text not null default 'Tho chup',
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
