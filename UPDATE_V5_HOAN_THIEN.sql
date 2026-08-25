-- BEEN MEDIA ERP V5 - HOAN THIEN
-- Chay 1 lan trong Supabase > SQL Editor. An toan khi chay lai.

alter table customer_payments add column if not exists method text;
alter table customer_payments add column if not exists note text;
alter table customer_payments add column if not exists payment_type text default 'Đặt cọc';

alter table job_assignments add column if not exists client_requested boolean default false;

alter table finance_transactions add column if not exists source_type text;
alter table finance_transactions add column if not exists source_id uuid;

create table if not exists app_settings (
  id text primary key,
  value text,
  note text,
  updated_at timestamptz default now()
);
alter table app_settings enable row level security;
drop policy if exists "been_media_public_all" on app_settings;
create policy "been_media_public_all" on app_settings for all using (true) with check (true);
insert into app_settings(id,value,note) values ('edit_pin','2580','PIN xác nhận thao tác sửa/xóa quan trọng') on conflict (id) do nothing;

create index if not exists finance_transactions_source_idx on finance_transactions(source_type, source_id);
