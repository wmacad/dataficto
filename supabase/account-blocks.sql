create table if not exists public.account_blocks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete set null,
  blocked_at timestamptz not null default now(),
  blocked_by uuid references auth.users(id) on delete set null,
  reason text
);

alter table public.account_blocks enable row level security;

drop policy if exists account_blocks_self_select on public.account_blocks;
create policy account_blocks_self_select
on public.account_blocks
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists account_blocks_workspace_admin_select on public.account_blocks;
create policy account_blocks_workspace_admin_select
on public.account_blocks
for select
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.workspace_id = account_blocks.workspace_id
      and m.role = 'admin'
  )
);

create or replace function public.get_my_account_access()
returns table (
  is_blocked boolean,
  blocked_at timestamptz,
  reason text
)
language sql
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.account_blocks b
      where b.user_id = auth.uid()
    ) as is_blocked,
    (
      select b.blocked_at
      from public.account_blocks b
      where b.user_id = auth.uid()
      order by b.blocked_at desc
      limit 1
    ) as blocked_at,
    (
      select b.reason
      from public.account_blocks b
      where b.user_id = auth.uid()
      order by b.blocked_at desc
      limit 1
    ) as reason;
$$;

grant execute on function public.get_my_account_access() to authenticated;
grant select on public.account_blocks to authenticated;
