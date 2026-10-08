begin;

-- Una identidad solo necesita consultar sus propias membresías. Esto elimina
-- la recursión y permite que el resolver opere con los privilegios del llamador.
drop policy memberships_read on public.organization_memberships;
create policy memberships_read on public.organization_memberships for select to authenticated
using (user_id = (select auth.uid()));
alter function private.has_permission(uuid, text, text) security invoker;
-- Función pura: no consulta datos ni concede privilegios por sí misma.
grant execute on function private.role_allows(text, text, text) to authenticated;

alter table public.organizations add column slug text unique
check (slug is null or slug ~ '^[a-z][a-z0-9-]{1,62}$');

create table private.organization_bootstrap_audit (
  organization_id uuid primary key references public.organizations(id) on delete restrict,
  admin_ids uuid[] not null,
  approval_reference text not null check (length(btrim(approval_reference)) between 8 and 200),
  executed_by name not null,
  executed_at timestamptz not null default statement_timestamp()
);
revoke all on table private.organization_bootstrap_audit from public, anon, authenticated, service_role;

-- Solo el operador de migraciones (propietario postgres), nunca una RPC cliente.
-- SECURITY INVOKER: no es un puente de elevación de privilegios.
create function private.bootstrap_aigenterra(authorized_admin_ids uuid[], approval_reference text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  organization_uuid uuid;
  normalized_ids uuid[];
  previous private.organization_bootstrap_audit%rowtype;
begin
  if current_user <> 'postgres' then
    raise exception 'Only the reviewed database operator may bootstrap' using errcode = '42501';
  end if;
  if authorized_admin_ids is null or cardinality(authorized_admin_ids) not between 1 and 10
     or array_position(authorized_admin_ids, null) is not null
     or approval_reference is null or length(btrim(approval_reference)) not between 8 and 200 then
    raise exception 'Explicit administrator IDs and an approval reference are required' using errcode = '22023';
  end if;
  select array_agg(distinct id order by id) into normalized_ids from unnest(authorized_admin_ids) id;
  if cardinality(normalized_ids) <> cardinality(authorized_admin_ids) then
    raise exception 'Duplicate administrator IDs' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(normalized_ids) administrator_id
    where not exists (
      select 1 from auth.users u join public.profiles p on p.id = u.id
      where u.id = administrator_id and u.deleted_at is null
        and not coalesce(u.is_anonymous, false)
        and (u.email_confirmed_at is not null or u.phone_confirmed_at is not null)
        and (u.banned_until is null or u.banned_until <= statement_timestamp())
    )
  ) then
    raise exception 'Every administrator must be an existing confirmed, active Auth identity' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('aigenterra-initial-bootstrap', 0));
  select id into organization_uuid from public.organizations where slug = 'aigenterra' for update;
  if organization_uuid is not null then
    select * into previous from private.organization_bootstrap_audit where organization_id = organization_uuid;
    if found and previous.admin_ids = normalized_ids
      and previous.approval_reference = btrim(approval_reference)
      and (select count(*) from public.organization_memberships
        where organization_id = organization_uuid and user_id = any(normalized_ids) and role_id = 'admin') = cardinality(normalized_ids) then
      return organization_uuid;
    end if;
    raise exception 'Organization already exists; use a separately reviewed administration procedure' using errcode = '22023';
  end if;
  insert into public.organizations(name, slug) values ('AIGENTERRA', 'aigenterra') returning id into organization_uuid;
  insert into public.organization_memberships(organization_id, user_id, role_id)
    select organization_uuid, id, 'admin' from unnest(normalized_ids) id;
  insert into private.organization_bootstrap_audit(organization_id, admin_ids, approval_reference, executed_by)
    values (organization_uuid, normalized_ids, btrim(approval_reference), current_user);
  return organization_uuid;
end;
$$;
revoke all on function private.bootstrap_aigenterra(uuid[], text) from public, anon, authenticated, service_role;

commit;
