-- BEEN MEDIA ERP V7.20
-- Phát sinh cộng/trừ lương theo Job + khấu trừ vi phạm nhân sự.

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

create index if not exists salary_adjustments_employee_date_idx
  on public.salary_adjustments(employee_id, adjustment_date);

create index if not exists salary_adjustments_job_idx
  on public.salary_adjustments(job_id);

alter table public.salary_adjustments enable row level security;

drop policy if exists "salary_adjustments_all" on public.salary_adjustments;
create policy "salary_adjustments_all"
on public.salary_adjustments
for all
using (true)
with check (true);

notify pgrst, 'reload schema';
