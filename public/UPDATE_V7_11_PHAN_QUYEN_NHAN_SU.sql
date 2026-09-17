-- BEEN MEDIA ERP V7.11
alter table if exists job_assignments add column if not exists contact_visible boolean default false;
create index if not exists job_assignments_employee_date_idx on job_assignments(employee_id, job_day_id);
