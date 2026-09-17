-- BEEN MEDIA ERP V3 - chạy file này 1 lần trong Supabase > SQL Editor
create table if not exists finance_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_date date not null default current_date,
  transaction_type text not null check (transaction_type in ('income','expense')),
  amount numeric not null default 0,
  category text,
  description text not null,
  payment_method text,
  job_id uuid references jobs(id) on delete set null,
  customer_id uuid references customers(id) on delete set null,
  employee_id uuid references employees(id) on delete set null,
  created_at timestamp default now()
);
alter table finance_transactions enable row level security;
drop policy if exists "been_media_public_all" on finance_transactions;
create policy "been_media_public_all" on finance_transactions for all using (true) with check (true);
create index if not exists finance_transactions_date_idx on finance_transactions(transaction_date);
