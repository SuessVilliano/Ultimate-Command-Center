-- LIV8 account-scoped state + affiliate import history
create extension if not exists pgcrypto;

create table if not exists public.liv8_user_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  state_key text not null,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, state_key)
);

create table if not exists public.liv8_affiliate_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  imported_at timestamptz not null default now(),
  filename text,
  source text not null default 'ghl-toolbar',
  row_count integer not null default 0,
  rows jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists liv8_affiliate_imports_user_time_idx
  on public.liv8_affiliate_imports(user_id, imported_at desc);

alter table public.liv8_user_state enable row level security;
alter table public.liv8_affiliate_imports enable row level security;

-- Only the authenticated LIV8 owner account can read/write its own state.
drop policy if exists liv8_owner_state_select on public.liv8_user_state;
create policy liv8_owner_state_select on public.liv8_user_state
for select using (
  auth.uid() = user_id and lower(coalesce(auth.jwt()->>'email','')) = 'liv8ent@gmail.com'
);

drop policy if exists liv8_owner_state_insert on public.liv8_user_state;
create policy liv8_owner_state_insert on public.liv8_user_state
for insert with check (
  auth.uid() = user_id and lower(coalesce(auth.jwt()->>'email','')) = 'liv8ent@gmail.com'
);

drop policy if exists liv8_owner_state_update on public.liv8_user_state;
create policy liv8_owner_state_update on public.liv8_user_state
for update using (
  auth.uid() = user_id and lower(coalesce(auth.jwt()->>'email','')) = 'liv8ent@gmail.com'
) with check (
  auth.uid() = user_id and lower(coalesce(auth.jwt()->>'email','')) = 'liv8ent@gmail.com'
);

drop policy if exists liv8_owner_state_delete on public.liv8_user_state;
create policy liv8_owner_state_delete on public.liv8_user_state
for delete using (
  auth.uid() = user_id and lower(coalesce(auth.jwt()->>'email','')) = 'liv8ent@gmail.com'
);

drop policy if exists liv8_owner_imports_select on public.liv8_affiliate_imports;
create policy liv8_owner_imports_select on public.liv8_affiliate_imports
for select using (
  auth.uid() = user_id and lower(coalesce(auth.jwt()->>'email','')) = 'liv8ent@gmail.com'
);

drop policy if exists liv8_owner_imports_insert on public.liv8_affiliate_imports;
create policy liv8_owner_imports_insert on public.liv8_affiliate_imports
for insert with check (
  auth.uid() = user_id and lower(coalesce(auth.jwt()->>'email','')) = 'liv8ent@gmail.com'
);

drop policy if exists liv8_owner_imports_delete on public.liv8_affiliate_imports;
create policy liv8_owner_imports_delete on public.liv8_affiliate_imports
for delete using (
  auth.uid() = user_id and lower(coalesce(auth.jwt()->>'email','')) = 'liv8ent@gmail.com'
);
