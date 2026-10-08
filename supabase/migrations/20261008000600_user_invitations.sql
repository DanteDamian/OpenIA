-- Invitaciones privadas: no crea usuarios ni envía correos al instalarse.
begin;
create table private.organization_invitations (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 email text not null check(length(email)<=254 and email=lower(btrim(email))),
 role_id text not null references public.roles(id),
 status text not null check(status in ('sending','pending','failed','accepted','cancelled')),
 created_by uuid not null references public.profiles(id),
 updated_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '7 days',
 accepted_by uuid references public.profiles(id),
 accepted_at timestamptz,
 send_attempts integer not null default 1 check(send_attempts>0)
);
create index invitations_org_time on private.organization_invitations(organization_id,created_at desc);
create index invitations_sender_time on private.organization_invitations(updated_by,updated_at desc);
create unique index invitations_open_email on private.organization_invitations(organization_id,email)
 where status in ('sending','pending','failed');
alter table private.organization_invitations enable row level security;
alter table private.organization_invitations force row level security;
revoke all on private.organization_invitations from public,anon,authenticated,service_role;

create function public.list_organization_invitations(target_organization uuid)
returns table(id uuid,email text,role_id text,status text,expires_at timestamptz,created_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.organization_memberships m where m.organization_id=target_organization and m.user_id=auth.uid() and m.role_id='admin' and m.is_active) then raise exception 'Forbidden' using errcode='42501'; end if;
 return query select i.id,i.email,i.role_id,case when i.status in ('sending','pending','failed') and i.expires_at<=now() then 'expired' else i.status end,i.expires_at,i.created_at from private.organization_invitations i where i.organization_id=target_organization order by i.created_at desc;
end $$;

create function public.prepare_organization_invitation(target_organization uuid,target_email text,new_role text,invitation_id uuid default null)
returns table(id uuid,email text,role_id text)
language plpgsql security definer set search_path='' as $$
declare existing private.organization_invitations%rowtype; normalized text:=lower(btrim(target_email));
begin
 if not exists(select 1 from public.organization_memberships m where m.organization_id=target_organization and m.user_id=auth.uid() and m.role_id='admin' and m.is_active) then raise exception 'Forbidden' using errcode='42501'; end if;
 perform 1 from public.organizations where public.organizations.id=target_organization for update;
 if not exists(select 1 from public.organization_memberships m where m.organization_id=target_organization and m.user_id=auth.uid() and m.role_id='admin' and m.is_active) then raise exception 'Forbidden' using errcode='42501'; end if;
 if normalized is null or length(normalized)>254 or normalized !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or new_role is null or new_role not in ('admin','manager','accountant','viewer') then raise exception 'Invalid invitation' using errcode='22023'; end if;
 -- Limitar envío por actor, entre todas sus organizaciones; un reenvío no evade el límite.
 perform pg_advisory_xact_lock(hashtextextended('invitation:'||auth.uid()::text,0));
 if coalesce((select sum(i.send_attempts) from private.organization_invitations i where i.updated_by=auth.uid() and i.updated_at>now()-interval '1 hour'),0)>=20 then raise exception 'Invitation rate limit' using errcode='P0001'; end if;
 if exists(select 1 from public.organization_memberships m join auth.users u on u.id=m.user_id where m.organization_id=target_organization and lower(u.email)=normalized) then raise exception 'Already a member' using errcode='23505'; end if;
 if invitation_id is not null then
  select * into existing from private.organization_invitations i where i.id=invitation_id and i.organization_id=target_organization for update;
 else
  select * into existing from private.organization_invitations i where i.organization_id=target_organization and i.email=normalized and i.status in ('sending','pending','failed') for update;
 end if;
 if found then
  if existing.status not in ('pending','failed','sending') or existing.email<>normalized or existing.role_id<>new_role then raise exception 'Invitation unavailable' using errcode='22023'; end if;
  if existing.updated_at>now()-interval '60 seconds' then raise exception 'Wait before resend' using errcode='P0001'; end if;
  update private.organization_invitations i set status='sending',updated_at=now(),updated_by=auth.uid(),expires_at=now()+interval '7 days',send_attempts=i.send_attempts+1 where i.id=existing.id;
  return query select i.id,i.email,i.role_id from private.organization_invitations i where i.id=existing.id;
 elsif invitation_id is not null then raise exception 'Invitation unavailable' using errcode='22023';
 else
  return query insert into private.organization_invitations(organization_id,email,role_id,status,created_by,updated_by)
    values(target_organization,normalized,new_role,'sending',auth.uid(),auth.uid()) returning organization_invitations.id,organization_invitations.email,organization_invitations.role_id;
 end if;
end $$;

create function public.record_organization_invitation_delivery(target_organization uuid,invitation_id uuid,succeeded boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.organization_memberships m where m.organization_id=target_organization and m.user_id=auth.uid() and m.role_id='admin' and m.is_active) then raise exception 'Forbidden' using errcode='42501'; end if;
 update private.organization_invitations i set status=case when succeeded then 'pending' else 'failed' end
 where i.id=invitation_id and i.organization_id=target_organization and i.updated_by=auth.uid() and i.status='sending';
 -- Un destinatario puede aceptar mientras la API de correo está respondiendo; no revertirlo.
end $$;

create function public.cancel_organization_invitation(target_organization uuid,invitation_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.organization_memberships m where m.organization_id=target_organization and m.user_id=auth.uid() and m.role_id='admin' and m.is_active) then raise exception 'Forbidden' using errcode='42501'; end if;
 perform 1 from public.organizations where id=target_organization for update;
 if not exists(select 1 from public.organization_memberships m where m.organization_id=target_organization and m.user_id=auth.uid() and m.role_id='admin' and m.is_active) then raise exception 'Forbidden' using errcode='42501'; end if;
 update private.organization_invitations i set status='cancelled',updated_by=auth.uid() where i.id=invitation_id and i.organization_id=target_organization and i.status in ('sending','pending','failed');
 if not found then raise exception 'Invitation unavailable' using errcode='22023'; end if;
end $$;

create function public.validate_organization_invitation(invitation_id uuid)
returns table(organization_id uuid,organization_name text)
language plpgsql security definer set search_path='' as $$
begin
 return query select i.organization_id,o.name from private.organization_invitations i
 join public.organizations o on o.id=i.organization_id
 join auth.users u on u.id=auth.uid() and lower(u.email)=i.email
 join public.organization_memberships sender on sender.organization_id=i.organization_id and sender.user_id=i.updated_by and sender.role_id='admin' and sender.is_active
 where i.id=invitation_id and i.status in ('sending','pending') and i.expires_at>now()
   and u.email_confirmed_at is not null and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now());
 if not found then raise exception 'Invitation unavailable' using errcode='42501'; end if;
end $$;

create function public.accept_organization_invitation(invitation_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare invitation private.organization_invitations%rowtype; target_org uuid;
begin
 select i.organization_id into target_org from private.organization_invitations i where i.id=invitation_id;
 perform 1 from public.organizations where id=target_org for update;
 select * into invitation from private.organization_invitations i where i.id=invitation_id for update;
 perform public.validate_organization_invitation(invitation_id);
 -- Un índice PK evita membresías duplicadas. Nunca reactivar o promover una ya existente.
 insert into public.organization_memberships(organization_id,user_id,role_id,is_active) values(invitation.organization_id,auth.uid(),invitation.role_id,true);
 insert into private.membership_audit(organization_id,actor_id,user_id,action,role_id,is_active)
   values(invitation.organization_id,invitation.updated_by,auth.uid(),'add',invitation.role_id,true);
 update private.organization_invitations set status='accepted',accepted_by=auth.uid(),accepted_at=now() where id=invitation_id;
 return invitation.organization_id;
end $$;
revoke all on function public.list_organization_invitations(uuid),public.prepare_organization_invitation(uuid,text,text,uuid),public.record_organization_invitation_delivery(uuid,uuid,boolean),public.cancel_organization_invitation(uuid,uuid),public.validate_organization_invitation(uuid),public.accept_organization_invitation(uuid) from public,anon,authenticated,service_role;
grant execute on function public.list_organization_invitations(uuid),public.prepare_organization_invitation(uuid,text,text,uuid),public.record_organization_invitation_delivery(uuid,uuid,boolean),public.cancel_organization_invitation(uuid,uuid),public.validate_organization_invitation(uuid),public.accept_organization_invitation(uuid) to authenticated;
commit;
