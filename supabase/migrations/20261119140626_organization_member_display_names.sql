begin;

alter table public.organization_memberships add column display_name text
  check (display_name is null or length(btrim(display_name)) between 1 and 200);

alter table private.membership_audit drop constraint membership_audit_action_check;
alter table private.membership_audit add constraint membership_audit_action_check
  check (action in ('add', 'change', 'rename'));

create or replace function public.list_project_assignees(target_organization uuid)
returns table(user_id uuid, display_name text)
language sql stable security definer
set search_path = ''
as $$
  select m.user_id, coalesce(m.display_name, nullif(btrim(p.display_name), ''))
  from public.organization_memberships m
  join public.profiles p on p.id = m.user_id
  where m.organization_id = target_organization
    and m.is_active
    and exists (
      select 1 from public.organization_memberships requester
      where requester.organization_id = target_organization
        and requester.user_id = (select auth.uid())
        and requester.is_active
    )
  order by 2 nulls last, m.user_id
$$;

create or replace function public.manage_organization_members(target_organization uuid)
returns table(user_id uuid, display_name text, email text, role_id text, is_active boolean)
language plpgsql security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.organization_memberships m
    where m.organization_id = target_organization and m.user_id = auth.uid()
      and m.role_id = 'admin' and m.is_active
  ) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  return query
    select m.user_id, coalesce(m.display_name, nullif(btrim(p.display_name), '')),
      u.email::text, m.role_id, m.is_active
    from public.organization_memberships m
    join public.profiles p on p.id = m.user_id
    join auth.users u on u.id = m.user_id
    where m.organization_id = target_organization
    order by m.created_at, m.user_id;
end
$$;

create function public.set_organization_member_display_name(
  target_organization uuid, target_user uuid, new_display_name text
)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  admin_id uuid := auth.uid();
  member_role text;
  member_active boolean;
begin
  -- Serializa la edición con los cambios de acceso de la organización.
  if not exists (
    select 1 from public.organization_memberships m
    where m.organization_id = target_organization and m.user_id = admin_id
      and m.role_id = 'admin' and m.is_active
  ) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  perform 1 from public.organizations where id = target_organization for update;

  perform 1 from public.organization_memberships m
  where m.organization_id = target_organization and m.user_id = admin_id
    and m.role_id = 'admin' and m.is_active;
  if not found then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  new_display_name := btrim(new_display_name);
  if new_display_name is null or length(new_display_name) not between 1 and 200 then
    raise exception 'Invalid name' using errcode = '22023';
  end if;

  update public.organization_memberships m
  set display_name = new_display_name
  where m.organization_id = target_organization and m.user_id = target_user
    and m.display_name is distinct from new_display_name
  returning m.role_id, m.is_active into member_role, member_active;

  if found then
    insert into private.membership_audit
      (organization_id, actor_id, user_id, action, role_id, is_active)
    values (target_organization, admin_id, target_user, 'rename', member_role, member_active);
  elsif not exists (
    select 1 from public.organization_memberships m
    where m.organization_id = target_organization and m.user_id = target_user
  ) then
    raise exception 'Membership unavailable' using errcode = '22023';
  end if;
end
$$;

revoke all on function public.set_organization_member_display_name(uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.set_organization_member_display_name(uuid, uuid, text)
  to authenticated;

commit;
