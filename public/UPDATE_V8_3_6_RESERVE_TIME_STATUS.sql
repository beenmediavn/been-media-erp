-- BEEN MEDIA ERP V8.3.6 - Thợ dự phòng theo 1 ngày + giờ tùy chọn + lịch sử đã xếp Job
alter table if exists public.reserve_workers
  add column if not exists start_time time,
  add column if not exists end_time time,
  add column if not exists assigned_job_id uuid references public.jobs(id) on delete set null,
  add column if not exists assigned_at timestamptz;

create index if not exists reserve_workers_status_date_idx on public.reserve_workers(status, reserve_date);
create index if not exists reserve_workers_assigned_job_idx on public.reserve_workers(assigned_job_id);

-- Nếu constraint trạng thái cũ đã tồn tại thì các giá trị reserved/used/cancelled vẫn tương thích.
notify pgrst, 'reload schema';
