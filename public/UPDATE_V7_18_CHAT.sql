-- BEEN MEDIA ERP V7.18 - CHAT NỘI BỘ
create extension if not exists pgcrypto;

create table if not exists public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  name text,
  room_type text not null default 'private' check (room_type in ('private','group')),
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  user_id text not null,
  display_name text not null,
  role text,
  joined_at timestamptz not null default now(),
  unique(room_id,user_id)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  sender_id text not null,
  sender_name text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_members_user_idx on public.chat_members(user_id);
create index if not exists chat_messages_room_created_idx on public.chat_messages(room_id,created_at);
create index if not exists chat_rooms_updated_idx on public.chat_rooms(updated_at desc);

alter table public.chat_rooms enable row level security;
alter table public.chat_members enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "been_chat_rooms" on public.chat_rooms;
drop policy if exists "been_chat_members" on public.chat_members;
drop policy if exists "been_chat_messages" on public.chat_messages;

-- App hiện dùng đăng nhập nội bộ (không dùng Supabase Auth), nên quyền hiển thị thành viên
-- được kiểm soát bởi ứng dụng. Các policy này cho anon key truy cập tính năng chat.
create policy "been_chat_rooms" on public.chat_rooms for all using (true) with check (true);
create policy "been_chat_members" on public.chat_members for all using (true) with check (true);
create policy "been_chat_messages" on public.chat_messages for all using (true) with check (true);

do $$
begin
  alter publication supabase_realtime add table public.chat_messages;
exception when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
