-- BEEN MEDIA ERP V7.10 - Đăng nhập nhân sự + mobile
-- Chạy 1 lần trong Supabase > SQL Editor. Có thể chạy lại an toàn.

alter table if exists employees add column if not exists app_role text default 'viewer';
alter table if exists employees add column if not exists can_login boolean default true;
alter table if exists employees add column if not exists username text;
alter table if exists employees add column if not exists password text;
alter table if exists employees add column if not exists active boolean default true;

update employees
set app_role = case
  when lower(coalesce(role,'')) in ('admin','quản trị','quan tri','quản trị viên','quan tri vien') then 'admin'
  when lower(coalesce(role,'')) in ('sale','điều phối','dieu phoi','điều phối / sale','dieu phoi / sale') then 'coordinator'
  when lower(coalesce(role,'')) in ('thợ chụp','tho chup','photographer','chụp','chup') then 'photographer'
  when lower(coalesce(role,'')) in ('thợ quay','tho quay','videographer','quay','quay phim','flycam') then 'videographer'
  when lower(coalesce(role,'')) in ('editor','hậu kỳ','hau ky','dựng','dung','thiết kế','thiet ke') then 'editor'
  when lower(coalesce(role,'')) in ('kế toán','ke toan','accountant') then 'accountant'
  else coalesce(nullif(app_role,''), 'viewer')
end
where app_role is null or app_role = '' or app_role = 'viewer';

update employees set can_login = true where can_login is null;
update employees set active = true where active is null;

-- Không tự đổi username/mật khẩu hiện có.
-- Sau khi chạy, vào Nhân sự > Sửa để đặt Username + Mật khẩu cho từng người.
