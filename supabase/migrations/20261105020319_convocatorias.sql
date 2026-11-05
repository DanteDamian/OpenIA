-- Convocatorias comerciales de AIGENTERRA. No afecta tablas existentes.
begin;

create table public.calls_for_proposals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null check (length(btrim(name)) between 1 and 200),
  issuer_name text not null check (length(btrim(issuer_name)) between 1 and 200),
  amount numeric(18,2) not null check (amount >= 0 and amount <> 'NaN'::numeric),
  currency text not null default 'COP' check (currency = 'COP'),
  topic text not null check (length(btrim(topic)) between 1 and 2000),
  priority text not null check (priority in ('high','medium','low')),
  created_by uuid references public.profiles(id) on delete restrict default auth.uid(),
  updated_by uuid references public.profiles(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,id)
);
create index calls_for_proposals_org_priority_idx
  on public.calls_for_proposals(organization_id,priority,created_at desc);
alter table public.calls_for_proposals enable row level security;
alter table public.calls_for_proposals force row level security;
revoke all on public.calls_for_proposals from public,anon,authenticated;
grant select,insert,update on public.calls_for_proposals to authenticated;
grant all on public.calls_for_proposals to service_role;

create policy calls_read on public.calls_for_proposals
  for select to authenticated using (
    exists (select 1 from public.organization_memberships m
      where m.organization_id = calls_for_proposals.organization_id
        and m.user_id = (select auth.uid()) and m.role_id in ('admin','manager','accountant','viewer')
        and m.is_active is distinct from false)
  );
create policy calls_insert on public.calls_for_proposals
  for insert to authenticated with check (
    exists (select 1 from public.organization_memberships m
      where m.organization_id = calls_for_proposals.organization_id
        and m.user_id = (select auth.uid()) and m.role_id in ('admin','manager')
        and m.is_active is distinct from false)
  );
create policy calls_update on public.calls_for_proposals
  for update to authenticated using (
    exists (select 1 from public.organization_memberships m
      where m.organization_id = calls_for_proposals.organization_id
        and m.user_id = (select auth.uid()) and m.role_id in ('admin','manager')
        and m.is_active is distinct from false)
  ) with check (
    exists (select 1 from public.organization_memberships m
      where m.organization_id = calls_for_proposals.organization_id
        and m.user_id = (select auth.uid()) and m.role_id in ('admin','manager')
        and m.is_active is distinct from false)
  );
commit;
