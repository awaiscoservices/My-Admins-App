-- ============================================================================
-- Internal staff Support (team chat + platform support)
--
-- Two kinds of thread, both staff-only (never players):
--   kind='platform' : ONE thread per tenant. The casino's staff on one side,
--                     the platform owner (super_admin) on the other. This is
--                     how a tenant gets help from the platform.
--   kind='dm'       : a 1:1 direct message between two staff of the SAME tenant
--                     (any role to any role — a team chat).
--
-- All reads/writes go through the service-role API (lib/adminGuard). RLS is
-- enabled so that Supabase Realtime can safely deliver changes to a
-- participant's browser; the API never relies on it.
-- Run this in the Supabase SQL editor.
-- ============================================================================

create table if not exists public.internal_conversations (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  kind            text not null check (kind in ('dm','platform')),
  a_user_id       uuid references public.profiles(id) on delete cascade,
  b_user_id       uuid references public.profiles(id) on delete cascade,
  last_message_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Exactly one platform thread per tenant.
create unique index if not exists internal_conv_platform_uniq
  on public.internal_conversations (tenant_id) where kind = 'platform';

-- Exactly one DM per unordered pair per tenant. The API always stores the pair
-- with a_user_id < b_user_id so (x,y) and (y,x) collapse to one row.
create unique index if not exists internal_conv_dm_uniq
  on public.internal_conversations (tenant_id, a_user_id, b_user_id) where kind = 'dm';

create index if not exists internal_conv_tenant_idx
  on public.internal_conversations (tenant_id, last_message_at desc nulls last);

create table if not exists public.internal_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.internal_conversations(id) on delete cascade,
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  body            text,
  file_url        text,
  file_name       text,
  file_type       text,
  created_at      timestamptz not null default now()
);
create index if not exists internal_msg_conv_idx
  on public.internal_messages (conversation_id, created_at);

-- Per-user read state + star. Unread = messages after last_read_at not sent by
-- me. A single read_at on the message would not work for the platform thread,
-- which has many staff on one side.
create table if not exists public.internal_reads (
  conversation_id uuid not null references public.internal_conversations(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  last_read_at    timestamptz,
  is_starred      boolean not null default false,
  primary key (conversation_id, user_id)
);

-- ── RLS (for Realtime delivery; the API uses the service role and bypasses it) ──
alter table public.internal_conversations enable row level security;
alter table public.internal_messages      enable row level security;
alter table public.internal_reads         enable row level security;

drop policy if exists internal_conv_sel  on public.internal_conversations;
drop policy if exists internal_msg_sel   on public.internal_messages;
drop policy if exists internal_reads_sel on public.internal_reads;

-- A super admin sees every thread. A tenant staff member sees their own
-- tenant's platform thread and any DM they are part of.
create policy internal_conv_sel on public.internal_conversations
for select to authenticated using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'super_admin')
  or (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.tenant_id = internal_conversations.tenant_id and p.role <> 'player'
    )
    and (kind = 'platform' or auth.uid() = a_user_id or auth.uid() = b_user_id)
  )
);

create policy internal_msg_sel on public.internal_messages
for select to authenticated using (
  exists (
    select 1 from public.internal_conversations c
    where c.id = internal_messages.conversation_id
      and (
        exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'super_admin')
        or (
          exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.tenant_id = c.tenant_id and p.role <> 'player'
          )
          and (c.kind = 'platform' or auth.uid() = c.a_user_id or auth.uid() = c.b_user_id)
        )
      )
  )
);

create policy internal_reads_sel on public.internal_reads
for select to authenticated using (user_id = auth.uid());

-- Let Realtime stream these tables. (Safe to re-run: ignore "already member".)
do $$ begin
  alter publication supabase_realtime add table public.internal_messages;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.internal_conversations;
exception when duplicate_object then null; end $$;
