-- Incremental y no destructiva. No modificar migraciones históricas.
begin;
alter table public.organizations
  add column tax_id text check (length(tax_id) <= 40),
  add column email text check (length(email) <= 254),
  add column phone text check (length(phone) <= 40),
  add column address text check (length(address) <= 1000);
grant update(tax_id,email,phone,address) on public.organizations to authenticated;

create table public.project_work_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  project_id uuid not null,
  kind text not null check (kind in ('activity','deliverable','milestone')),
  title text not null check (length(btrim(title)) between 1 and 200),
  description text check (length(description) <= 1000),
  status text not null default 'pending' check (status in ('pending','in_progress','done','cancelled')),
  assignee_id uuid,
  due_on date,
  foreign key (organization_id,project_id) references public.projects(organization_id,id) on delete restrict,
  foreign key (organization_id,assignee_id) references public.organization_memberships(organization_id,user_id) on delete restrict,
  created_by uuid references public.profiles(id) on delete restrict default auth.uid(),
  updated_by uuid references public.profiles(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(organization_id,id)
);
create index work_project_idx on public.project_work_items(organization_id,project_id);
create index work_assignee_idx on public.project_work_items(organization_id,assignee_id);
create table public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  project_id uuid, contract_id uuid,
  direction text not null check(direction in ('income','outgoing')),
  description text not null check(length(btrim(description)) between 1 and 1000),
  amount numeric(18,2) not null check(amount > 0 and amount <> 'NaN'::numeric),
  currency text not null default 'COP' check(currency='COP'),
  occurred_on date not null,
  method text not null check(method in ('bank_transfer','card','cash','other')),
  status text not null default 'recorded' check(status in ('recorded','void')),
  reference text check(length(reference) <= 120),
  foreign key(organization_id,project_id) references public.projects(organization_id,id) on delete restrict,
  foreign key(organization_id,contract_id) references public.contracts(organization_id,id) on delete restrict,
  created_by uuid references public.profiles(id) on delete restrict default auth.uid(),
  updated_by uuid references public.profiles(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(organization_id,id)
);
create index cash_project_idx on public.cash_movements(organization_id,project_id);
create index cash_contract_idx on public.cash_movements(organization_id,contract_id);
create index cash_date_idx on public.cash_movements(organization_id,occurred_on);
create table public.assistant_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  user_id uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key(organization_id,user_id) references public.organization_memberships(organization_id,user_id) on delete restrict
);
create index assistant_user_date_idx on public.assistant_requests(organization_id,user_id,created_at);
-- SECURITY INVOKER; cuenta solo los registros del usuario bajo RLS. El bloqueo
-- serializa solicitudes concurrentes; nadie puede actualizar/borrar su consumo.
create function private.limit_assistant_requests() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Authenticated identity required'; end if;
  new.user_id := auth.uid(); new.created_at := statement_timestamp();
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.organization_id::text||new.user_id::text,0));
  if (select count(*) from public.assistant_requests where organization_id=new.organization_id
      and user_id=new.user_id and created_at >= (date_trunc('day',statement_timestamp() at time zone 'UTC') at time zone 'UTC')) >= 30 then
    raise exception 'Daily assistant quota reached' using errcode='P0001';
  end if;
  return new;
end;
$$;
revoke all on function private.limit_assistant_requests() from public,anon,authenticated;
create trigger assistant_quota before insert on public.assistant_requests
for each row execute function private.limit_assistant_requests();
create trigger work_stamp before insert or update on public.project_work_items
for each row execute function private.stamp_business_record();
create trigger cash_stamp before insert or update on public.cash_movements
for each row execute function private.stamp_business_record();

alter table public.project_work_items enable row level security;
alter table public.project_work_items force row level security;
revoke all on public.project_work_items from public,anon,authenticated;
grant select,insert,update on public.project_work_items to authenticated;
create policy work_read on public.project_work_items for select to authenticated using(private.has_permission(organization_id,'projects','read'));
create policy work_insert on public.project_work_items for insert to authenticated with check(private.has_permission(organization_id,'projects','write'));
create policy work_update on public.project_work_items for update to authenticated using(private.has_permission(organization_id,'projects','write')) with check(private.has_permission(organization_id,'projects','write'));
alter table public.cash_movements enable row level security;
alter table public.cash_movements force row level security;
revoke all on public.cash_movements from public,anon,authenticated;
grant select,insert,update on public.cash_movements to authenticated;
create policy cash_read on public.cash_movements for select to authenticated using(private.has_permission(organization_id,'expenses','read'));
create policy cash_insert on public.cash_movements for insert to authenticated with check(private.has_permission(organization_id,'expenses','write'));
create policy cash_update on public.cash_movements for update to authenticated using(private.has_permission(organization_id,'expenses','write')) with check(private.has_permission(organization_id,'expenses','write'));
alter table public.assistant_requests enable row level security;
alter table public.assistant_requests force row level security;
revoke all on public.assistant_requests from public,anon,authenticated;
grant select on public.assistant_requests to authenticated;
grant insert(organization_id) on public.assistant_requests to authenticated;
create policy assistant_read on public.assistant_requests for select to authenticated using(user_id=auth.uid() and private.has_permission(organization_id,'projects','read'));
create policy assistant_insert on public.assistant_requests for insert to authenticated with check(user_id=auth.uid() and private.has_permission(organization_id,'projects','read'));
commit;
