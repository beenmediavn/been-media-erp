-- BEEN MEDIA ERP V8.3.9 - Sao lưu dữ liệu + Thùng rác 30 ngày
-- Chạy một lần trong Supabase SQL Editor.

alter table public.customers add column if not exists deleted_at timestamptz;
alter table public.customers add column if not exists deleted_by text;
alter table public.employees add column if not exists deleted_at timestamptz;
alter table public.employees add column if not exists deleted_by text;
alter table public.jobs add column if not exists deleted_at timestamptz;
alter table public.jobs add column if not exists deleted_by text;

-- Tách policy SELECT để các bản ghi trong thùng rác không xuất hiện ở app bình thường.
do $$
declare t text;
begin
  foreach t in array array['customers','employees','jobs'] loop
    execute format('drop policy if exists "been_media_public_all" on public.%I', t);
    execute format('drop policy if exists "been_media_active_select" on public.%I', t);
    execute format('drop policy if exists "been_media_insert" on public.%I', t);
    execute format('drop policy if exists "been_media_update" on public.%I', t);
    execute format('drop policy if exists "been_media_delete" on public.%I', t);
    execute format('create policy "been_media_active_select" on public.%I for select using (deleted_at is null)', t);
    execute format('create policy "been_media_insert" on public.%I for insert with check (true)', t);
    execute format('create policy "been_media_update" on public.%I for update using (true) with check (true)', t);
    execute format('create policy "been_media_delete" on public.%I for delete using (true)', t);
  end loop;
end $$;

create or replace function public.been_list_trash()
returns table(entity_type text,id uuid,name text,deleted_at timestamptz,deleted_by text)
language sql security definer set search_path=public as $$
  select 'customers', c.id, coalesce(c.full_name,c.customer_code,'Khách hàng'), c.deleted_at, c.deleted_by from public.customers c where c.deleted_at is not null
  union all
  select 'employees', e.id, coalesce(e.full_name,e.username,'Nhân sự'), e.deleted_at, e.deleted_by from public.employees e where e.deleted_at is not null
  union all
  select 'jobs', j.id, coalesce(j.event_name,j.customer_name,j.job_code,'Job'), j.deleted_at, j.deleted_by from public.jobs j where j.deleted_at is not null
  order by deleted_at desc;
$$;

grant execute on function public.been_list_trash() to anon, authenticated;

create or replace function public.been_restore_trash(p_entity_type text,p_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if p_entity_type='customers' then
    update public.customers set deleted_at=null,deleted_by=null where id=p_id;
  elsif p_entity_type='employees' then
    update public.employees set deleted_at=null,deleted_by=null where id=p_id;
  elsif p_entity_type='jobs' then
    update public.jobs set deleted_at=null,deleted_by=null where id=p_id;
  else
    raise exception 'Loại dữ liệu không hợp lệ';
  end if;
end $$;

grant execute on function public.been_restore_trash(text,uuid) to anon, authenticated;

-- Có thể gọi hàm này khi cần dọn dữ liệu quá 30 ngày. Không tự chạy nền để tránh xóa ngoài ý muốn.
create or replace function public.been_purge_trash_30_days()
returns table(entity_type text,deleted_count bigint)
language plpgsql security definer set search_path=public as $$
declare c1 bigint; c2 bigint; c3 bigint;
begin
  delete from public.jobs where deleted_at < now()-interval '30 days'; get diagnostics c1=row_count;
  delete from public.customers where deleted_at < now()-interval '30 days'; get diagnostics c2=row_count;
  delete from public.employees where deleted_at < now()-interval '30 days'; get diagnostics c3=row_count;
  return query values ('jobs',c1),('customers',c2),('employees',c3);
end $$;

grant execute on function public.been_purge_trash_30_days() to anon, authenticated;

notify pgrst, 'reload schema';
