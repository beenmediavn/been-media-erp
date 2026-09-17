-- BEEN MEDIA ERP V7.23
-- Lưu đầy đủ địa điểm từng nhà + avatar nhân sự + bảo đảm lưu số thợ cần.

alter table public.jobs add column if not exists required_photo_count integer not null default 0;
alter table public.jobs add column if not exists required_video_count integer not null default 0;
alter table public.employees add column if not exists avatar_url text;

create table if not exists public.job_locations (
  id uuid primary key default gen_random_uuid(),
  job_day_id uuid not null references public.job_days(id) on delete cascade,
  location_name text,
  address text,
  phone text,
  sort_order integer not null default 0,
  created_at timestamp without time zone default now()
);

create index if not exists job_locations_day_idx on public.job_locations(job_day_id, sort_order);

alter table public.job_locations enable row level security;
drop policy if exists "job_locations_all" on public.job_locations;
create policy "job_locations_all" on public.job_locations for all using (true) with check (true);

notify pgrst, 'reload schema';
