create table chat_messages (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  message jsonb not null,
  created_at timestamptz not null default now()
);

alter table chat_messages enable row level security;

create policy "users manage own chat messages"
  on chat_messages for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index on chat_messages (user_id, created_at desc);
