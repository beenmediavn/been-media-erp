-- BEEN MEDIA ERP V8.1 - OFFLINE SYNC + CHAT RECALL + AUDIT FOUNDATION
-- Chạy file này MỘT LẦN trong Supabase SQL Editor trước khi dùng V8.1.
-- Có thể chạy lại: các lệnh chính đều idempotent.

create extension if not exists pgcrypto;

-- 1) Bảo đảm bảng phát sinh lương tồn tại (sửa lỗi schema cache salary_adjustments).
create table if not exists public.salary_adjustments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  adjustment_date date not null default current_date,
  adjustment_type text not null default 'other'
    check (adjustment_type in ('tip','bonus','penalty','other')),
  amount numeric not null default 0,
  note text,
  received_by_studio boolean not null default false,
  created_at timestamp without time zone default now()
);
create index if not exists salary_adjustments_employee_date_idx on public.salary_adjustments(employee_id, adjustment_date);
create index if not exists salary_adjustments_job_idx on public.salary_adjustments(job_id);
alter table public.salary_adjustments enable row level security;
drop policy if exists "salary_adjustments_all" on public.salary_adjustments;
create policy "salary_adjustments_all" on public.salary_adjustments for all using (true) with check (true);

-- 2) updated_at/version phục vụ phát hiện xung đột khi máy offline đồng bộ lại.
alter table public.jobs add column if not exists updated_at timestamptz default now();
alter table public.jobs add column if not exists version integer not null default 1;
alter table public.customers add column if not exists updated_at timestamptz default now();
alter table public.customers add column if not exists version integer not null default 1;

create or replace function public.been_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  if tg_table_name in ('jobs','customers') then
    new.version = coalesce(old.version,0) + 1;
  end if;
  return new;
end $$;

drop trigger if exists been_jobs_touch on public.jobs;
create trigger been_jobs_touch before update on public.jobs for each row execute function public.been_touch_updated_at();
drop trigger if exists been_customers_touch on public.customers;
create trigger been_customers_touch before update on public.customers for each row execute function public.been_touch_updated_at();

-- 3) Chat: thu hồi với mọi người + xóa phía tôi.
alter table public.chat_messages add column if not exists recalled_at timestamptz;
alter table public.chat_messages add column if not exists recalled_by text;
alter table public.chat_messages add column if not exists hidden_for text[] not null default '{}';

-- 4) Nhật ký hệ thống: nền tảng cho audit log ở các phiên bản tiếp theo.
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id text,
  actor_name text,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_created_idx on public.audit_logs(created_at desc);
create index if not exists audit_logs_entity_idx on public.audit_logs(entity_type, entity_id);
alter table public.audit_logs enable row level security;
drop policy if exists "audit_logs_all" on public.audit_logs;
create policy "audit_logs_all" on public.audit_logs for all using (true) with check (true);

-- 5) Chuẩn bị multi-studio. Chưa siết RLS theo studio ở V8.1 vì app hiện dùng đăng nhập nội bộ,
-- nếu bật ngay sẽ làm mất quyền truy cập. Các cột này cho phép migrate dữ liệu an toàn trước.
create table if not exists public.studios (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
insert into public.studios(id,name,slug)
values ('00000000-0000-0000-0000-000000000001','BEEN MEDIA','been-media')
on conflict (id) do nothing;

alter table public.customers add column if not exists studio_id uuid references public.studios(id) default '00000000-0000-0000-0000-000000000001';
alter table public.jobs add column if not exists studio_id uuid references public.studios(id) default '00000000-0000-0000-0000-000000000001';
alter table public.employees add column if not exists studio_id uuid references public.studios(id) default '00000000-0000-0000-0000-000000000001';
alter table public.salary_adjustments add column if not exists studio_id uuid references public.studios(id) default '00000000-0000-0000-0000-000000000001';
alter table public.chat_rooms add column if not exists studio_id uuid references public.studios(id) default '00000000-0000-0000-0000-000000000001';

update public.customers set studio_id='00000000-0000-0000-0000-000000000001' where studio_id is null;
update public.jobs set studio_id='00000000-0000-0000-0000-000000000001' where studio_id is null;
update public.employees set studio_id='00000000-0000-0000-0000-000000000001' where studio_id is null;
update public.salary_adjustments set studio_id='00000000-0000-0000-0000-000000000001' where studio_id is null;
update public.chat_rooms set studio_id='00000000-0000-0000-0000-000000000001' where studio_id is null;

notify pgrst, 'reload schema';

-- 6) Tự ghi nhật ký thay đổi quan trọng ở cấp database.
create or replace function public.been_audit_row_change()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.audit_logs(action,entity_type,entity_id,before_data,after_data,note)
  values (
    tg_op,
    tg_table_name,
    case when tg_op='DELETE' then old.id::text else new.id::text end,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end,
    'Tự động ghi bởi database trigger'
  );
  return case when tg_op='DELETE' then old else new end;
end $$;

do $$
declare t text;
begin
  foreach t in array array['jobs','customers','job_assignments','salary_adjustments','google_drive_files'] loop
    execute format('drop trigger if exists been_audit_%I on public.%I',t,t);
    execute format('create trigger been_audit_%I after insert or update or delete on public.%I for each row execute function public.been_audit_row_change()',t,t);
  end loop;
end $$;

notify pgrst, 'reload schema';
