-- BEEN MEDIA ERP V8.3.10
-- FIX CHẤM CÔNG CAMERA + MOBILE TIME 24H
-- Chạy 1 lần trong Supabase SQL Editor trước khi dùng Chấm công nếu trước đây chưa chạy V8.2.

create extension if not exists pgcrypto;

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

insert into storage.buckets (id,name,public)
values ('attendance','attendance',true)
on conflict (id) do update set public=true;

drop policy if exists "attendance_storage_select" on storage.objects;
create policy "attendance_storage_select" on storage.objects for select using (bucket_id='attendance');
drop policy if exists "attendance_storage_insert" on storage.objects;
create policy "attendance_storage_insert" on storage.objects for insert with check (bucket_id='attendance');
drop policy if exists "attendance_storage_update" on storage.objects;
create policy "attendance_storage_update" on storage.objects for update using (bucket_id='attendance') with check (bucket_id='attendance');
drop policy if exists "attendance_storage_delete" on storage.objects;
create policy "attendance_storage_delete" on storage.objects for delete using (bucket_id='attendance');

-- Realtime cho Admin theo dõi Check-in/Check-out.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='attendance_records'
  ) then
    alter publication supabase_realtime add table public.attendance_records;
  end if;
exception when undefined_object then null;
end $$;

notify pgrst, 'reload schema';
