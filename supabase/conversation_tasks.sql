-- Conversation tasks join table and related indexes.

create table if not exists public.conversation_tasks (
  id uuid not null default gen_random_uuid (),
  conversation_id uuid not null,
  task_id uuid not null,
  status text not null default 'requested'::text,
  color_index integer not null default 0,
  highlight_until timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  constraint conversation_tasks_pkey primary key (id),
  constraint conversation_tasks_conversation_id_task_id_key unique (conversation_id, task_id),
  constraint conversation_tasks_conversation_id_fkey foreign key (conversation_id) references conversations (id) on delete cascade,
  constraint conversation_tasks_task_id_fkey foreign key (task_id) references tasks (id) on delete cascade
) tablespace pg_default;

alter table public.conversation_tasks
  add column if not exists color_index integer not null default 0;

create index if not exists conversation_tasks_conversation_created_idx
  on public.conversation_tasks using btree (conversation_id, created_at desc) tablespace pg_default;

create index if not exists conversation_tasks_task_idx
  on public.conversation_tasks using btree (task_id) tablespace pg_default;

create index if not exists conversation_tasks_highlight_idx
  on public.conversation_tasks using btree (conversation_id, highlight_until) tablespace pg_default;
