-- Administración de acceso organizacional. No crea identidades ni cambia contraseñas.
begin;
alter table public.organization_memberships add column is_active boolean not null default true;
create table private.membership_audit (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  actor_id uuid not null references public.profiles(id),
  user_id uuid not null references public.profiles(id),
  action text not null check (action in ('add','change')),
  previous_role text,
  previous_active boolean,
  role_id text not null references public.roles(id),
  is_active boolean not null,
  created_at timestamptz not null default now()
);
create index membership_audit_org_time on private.membership_audit(organization_id,created_at desc);
alter table private.membership_audit enable row level security;
alter table private.membership_audit force row level security;
revoke all on private.membership_audit from public,anon,authenticated,service_role;

create or replace function private.has_permission(target_organization uuid, resource text, operation text)
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists (select 1 from public.organization_memberships m
    where m.organization_id = target_organization and m.user_id = (select auth.uid())
    and m.is_active and private.role_allows(m.role_id,resource,operation));
$$;

-- Funciones expuestas deliberadamente: identidad/empresa autorizadas dentro de SQL.
-- El propietario postgres es necesario para consultar perfiles de miembros sin recursión RLS.
create function public.manage_organization_members(target_organization uuid)
returns table(user_id uuid,display_name text,email text,role_id text,is_active boolean)
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.organization_memberships m
    where m.organization_id=target_organization and m.user_id=auth.uid()
      and m.role_id='admin' and m.is_active) then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  return query select m.user_id,p.display_name,u.email::text,m.role_id,m.is_active
    from public.organization_memberships m join public.profiles p on p.id=m.user_id
    join auth.users u on u.id=m.user_id where m.organization_id=target_organization
    order by m.created_at,m.user_id;
end $$;

create function public.change_organization_member(target_organization uuid,target_user uuid,new_role text,new_active boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare previous public.organization_memberships%rowtype;
begin
  -- Bloqueo común a todos los cambios: impide demociones concurrentes del último administrador.
  if not exists (select 1 from public.organization_memberships m where m.organization_id=target_organization
    and m.user_id=auth.uid() and m.role_id='admin' and m.is_active) then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  perform 1 from public.organizations where id=target_organization for update;
  if not exists (select 1 from public.organization_memberships m where m.organization_id=target_organization
    and m.user_id=auth.uid() and m.role_id='admin' and m.is_active) then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  if new_role is null or new_role not in ('admin','manager','accountant','viewer') or new_active is null then
    raise exception 'Invalid membership' using errcode='22023';
  end if;
  select * into previous from public.organization_memberships where organization_id=target_organization and user_id=target_user;
  if not found then raise exception 'Membership unavailable' using errcode='22023'; end if;
  if previous.role_id='admin' and previous.is_active and (new_role<>'admin' or not new_active)
    and not exists (select 1 from public.organization_memberships m where m.organization_id=target_organization
      and m.user_id<>target_user and m.role_id='admin' and m.is_active) then
    raise exception 'Last administrator' using errcode='23514';
  end if;
  if previous.role_id=new_role and previous.is_active=new_active then return; end if;
  update public.organization_memberships set role_id=new_role,is_active=new_active
    where organization_id=target_organization and user_id=target_user;
  insert into private.membership_audit(organization_id,actor_id,user_id,action,previous_role,previous_active,role_id,is_active)
    values(target_organization,auth.uid(),target_user,'change',previous.role_id,previous.is_active,new_role,new_active);
end $$;

create function public.add_organization_member(target_organization uuid,target_email text,new_role text)
returns void language plpgsql security definer set search_path = '' as $$
declare member_id uuid;
begin
  if not exists (select 1 from public.organization_memberships m where m.organization_id=target_organization
    and m.user_id=auth.uid() and m.role_id='admin' and m.is_active) then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  perform 1 from public.organizations where id=target_organization for update;
  if not exists (select 1 from public.organization_memberships m where m.organization_id=target_organization
    and m.user_id=auth.uid() and m.role_id='admin' and m.is_active) then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  if new_role is null or new_role not in ('admin','manager','accountant','viewer')
    or target_email is null or length(target_email)>254 then
    raise exception 'Invalid membership' using errcode='22023';
  end if;
  select u.id into member_id from auth.users u join public.profiles p on p.id=u.id
    where lower(u.email)=lower(btrim(target_email)) and u.email_confirmed_at is not null
      and (u.banned_until is null or u.banned_until<=now()) and u.deleted_at is null;
  if member_id is null then raise exception 'Account unavailable' using errcode='22023'; end if;
  insert into public.organization_memberships(organization_id,user_id,role_id,is_active)
    values(target_organization,member_id,new_role,true);
  insert into private.membership_audit(organization_id,actor_id,user_id,action,role_id,is_active)
    values(target_organization,auth.uid(),member_id,'add',new_role,true);
end $$;
revoke all on function public.manage_organization_members(uuid),public.change_organization_member(uuid,uuid,text,boolean),public.add_organization_member(uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.manage_organization_members(uuid),public.change_organization_member(uuid,uuid,text,boolean),public.add_organization_member(uuid,text,text) to authenticated;
commit;
