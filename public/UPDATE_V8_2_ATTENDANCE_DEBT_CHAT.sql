-- BEEN MEDIA ERP V8.2
-- Chấm công camera + xóa cả cuộc trò chuyện + nền tảng thông báo chấm công.
-- Chạy toàn bộ file này trong Supabase SQL Editor trước khi dùng bản V8.2.

create extension if not exists pgcrypto;

-- 1) Chat: soft-delete cả cuộc trò chuyện / ẩn theo từng người.
alter table public.chat_rooms add column if not exists hidden_for text[] not null default '{}';
alter table public.chat_rooms add column if not exists deleted_at timestamptz;
alter table public.chat_rooms add column if not exists deleted_by text;

-- 2) Chấm công theo đúng lượt phân công Job.
create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.job_assignments(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  job_day_id uuid references public.job_days(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  check_in_at timestamptz,
  check_in_face_url text,
  check_in_customer_url text,
  check_out_at timestamptz,
  check_out_photo_url text,
  late_minutes integer not null default 0,
  status text not null default 'not_checked_in',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(assignment_id)
);
create index if not exists attendance_employee_idx on public.attendance_records(employee_id, check_in_at desc);
create index if not exists attendance_job_idx on public.attendance_records(job_id, check_in_at desc);
create index if not exists attendance_day_idx on public.attendance_records(job_day_id);

alter table public.attendance_records enable row level security;
drop policy if exists "attendance_all" on public.attendance_records;
create policy "attendance_all" on public.attendance_records for all using (true) with check (true);

create or replace function public.been_touch_attendance()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;
drop trigger if exists been_attendance_touch on public.attendance_records;
create trigger been_attendance_touch before update on public.attendance_records
for each row execute function public.been_touch_attendance();

-- Bật realtime để Admin nhận thông báo Check-in/Check-out ngay khi thợ thao tác.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='attendance_records'
  ) then
    alter publication supabase_realtime add table public.attendance_records;
  end if;
exception when undefined_object then
  null;
end $$;

-- 3) Bucket riêng cho ảnh chấm công. Public để app hiện ảnh bằng URL trực tiếp.
insert into storage.buckets (id,name,public)
values ('attendance','attendance',true)
on conflict (id) do update set public=true;

drop policy if exists "attendance_storage_select" on storage.objects;
create policy "attendance_storage_select" on storage.objects for select using (bucket_id='attendance');
drop policy if exists "attendance_storage_insert" on storage.objects;
create policy "attendance_storage_insert" on storage.objects for insert with check (bucket_id='attendance');
drop policy if exists "attendance_storage_update" on storage.objects;
create policy "attendance_storage_update" on storage.objects for update using (bucket_id='attendance') with check (bucket_id='attendance');

-- Bảo đảm hàm audit tồn tại kể cả khi người dùng chưa chạy file V8.1.
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id text, actor_name text, action text not null, entity_type text not null, entity_id text,
  before_data jsonb, after_data jsonb, note text, created_at timestamptz not null default now()
);
create or replace function public.been_audit_row_change()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.audit_logs(action,entity_type,entity_id,before_data,after_data,note)
  values (tg_op,tg_table_name,case when tg_op='DELETE' then old.id::text else new.id::text end,
          case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
          case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end,
          'Tự động ghi bởi database trigger');
  return case when tg_op='DELETE' then old else new end;
end $$;

-- 4) Audit chấm công.
drop trigger if exists been_audit_attendance_records on public.attendance_records;
create trigger been_audit_attendance_records
after insert or update or delete on public.attendance_records
for each row execute function public.been_audit_row_change();


-- 5) Sửa dữ liệu cũ từng bị đánh dấu Hoàn thành chỉ vì đã thanh toán đủ, trong khi ngày Job vẫn ở tương lai.
update public.jobs j
set status='Đã đặt cọc'
where lower(coalesce(j.status,'')) like '%hoàn thành%'
  and exists (select 1 from public.job_days d where d.job_id=j.id)
  and not exists (select 1 from public.job_days d where d.job_id=j.id and d.shooting_date <= current_date);

notify pgrst, 'reload schema';
