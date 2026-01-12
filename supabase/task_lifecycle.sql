-- Task lifecycle fields and offers table

alter table public.tasks
  add column if not exists status text default 'open',
  add column if not exists assigned_helper_id uuid references public.profiles(id),
  add column if not exists assigned_at timestamptz,
  add column if not exists done_at timestamptz,
  add column if not exists cancelled_at timestamptz;

create table if not exists public.task_offers (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete cascade,
  helper_id uuid references public.profiles(id) on delete cascade,
  message text,
  created_at timestamptz default now(),
  status text default 'pending'
);

create index if not exists task_offers_task_id_idx on public.task_offers(task_id);
create index if not exists task_offers_helper_id_idx on public.task_offers(helper_id);
