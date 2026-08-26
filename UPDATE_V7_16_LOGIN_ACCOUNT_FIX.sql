-- V7.16 - bảo đảm tài khoản nhân sự mới đăng nhập được
alter table public.employees
  add column if not exists can_login boolean default true;

alter table public.employees
  alter column can_login set default true;

update public.employees
set can_login = true
where can_login is null;

notify pgrst, 'reload schema';
