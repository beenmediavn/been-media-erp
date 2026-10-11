-- Chạy một lần trong Supabase SQL Editor, sao lưu trước khi chạy.
create table if not exists public.job_postproduction (
 id uuid primary key default gen_random_uuid(),
 job_id uuid not null references public.jobs(id) on delete cascade,
 task_type text not null check (task_type in ('video','photo')),
 employee_id uuid references public.employees(id) on delete set null,
 salary_amount numeric not null default 0 check (salary_amount >= 0),
 status text not null default 'pending' check (status in ('pending','in_progress','completed')),
 updated_at timestamptz not null default now(),
 unique (job_id,task_type)
);
create index if not exists idx_job_postproduction_employee on public.job_postproduction(employee_id);
-- Bảo mật: chỉ cấp quyền truy cập theo chính sách RLS của dự án.
alter table public.job_postproduction enable row level security;
-- Không tự tạo policy mở rộng quyền truy cập dữ liệu lương.

-- Tương thích với mô hình truy cập hiện tại của ERP (các bảng Job cũng đang dùng policy public_all).
-- CẢNH BÁO: policy này không bảo vệ dữ liệu khỏi người có anon key; cần nâng cấp xác thực/RLS trước khi đưa vào môi trường bảo mật cao.
drop policy if exists "been_media_postproduction_all" on public.job_postproduction;
create policy "been_media_postproduction_all" on public.job_postproduction for all using (true) with check (true);
