-- Proyecto -> actividades existentes -> partes de horas -> actas inmutables.
-- Migración aditiva: no modifica proyectos, contratos o actividades anteriores.
begin;
create table public.project_hour_settings (
 organization_id uuid not null references public.organizations(id) on delete restrict,
 project_id uuid not null,
 contracted_hours numeric(10,2) check (contracted_hours is null or contracted_hours >= 0),
 notes text check (notes is null or char_length(notes)<=1000),
 updated_at timestamptz not null default now(),
 primary key (organization_id,project_id),
 foreign key (organization_id,project_id) references public.projects(organization_id,id) on delete restrict
);
create table public.project_time_entries (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete restrict,
 project_id uuid not null,
 work_item_id uuid,
 activity_date date not null,
 consultant_name text not null check (char_length(consultant_name) between 2 and 160),
 description text not null check (char_length(description) between 4 and 2000),
 hours numeric(6,2) not null check (hours>0 and hours<=24),
 status text not null default 'draft' check (status in ('draft','approved')),
 created_by uuid not null references auth.users(id) on delete restrict,
 approved_by uuid references auth.users(id) on delete restrict,
 approved_at timestamptz,
 act_id uuid,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(organization_id,id),
 foreign key(organization_id,project_id) references public.projects(organization_id,id) on delete restrict,
 foreign key(organization_id,work_item_id) references public.project_work_items(organization_id,id) on delete restrict,
 constraint project_time_approval_consistency check (
  (status='draft' and approved_by is null and approved_at is null)
  or (status='approved' and approved_by is not null and approved_at is not null)
 )
);
create table public.project_hour_acts (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete restrict,
 project_id uuid not null,
 number integer not null check(number>0),
 period_from date not null,
 period_to date not null check(period_to>=period_from),
 total_hours numeric(12,2) not null check(total_hours>0),
 snapshot jsonb not null,
 prepared_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 unique(organization_id,id), unique(organization_id,project_id,number),
 foreign key(organization_id,project_id) references public.projects(organization_id,id) on delete restrict
);
alter table public.project_time_entries
 add constraint project_time_entries_act_fk foreign key(organization_id,act_id)
 references public.project_hour_acts(organization_id,id) on delete restrict;
create index project_time_project_idx on public.project_time_entries(organization_id,project_id,activity_date);
create index project_time_unbilled_idx on public.project_time_entries(organization_id,project_id,status,act_id);
create index project_act_project_idx on public.project_hour_acts(organization_id,project_id,created_at);
-- A work item cannot silently belong to another project, even if in the same company.
create or replace function public.check_project_time_work_item() returns trigger language plpgsql set search_path=public as $$
begin
 if new.work_item_id is not null and not exists (
  select 1 from public.project_work_items i
  where i.organization_id=new.organization_id and i.id=new.work_item_id and i.project_id=new.project_id
 ) then raise exception 'La actividad no pertenece al proyecto'; end if;
 return new;
end $$;
create trigger project_time_work_item_guard before insert or update on public.project_time_entries
 for each row execute function public.check_project_time_work_item();
create or replace function public.guard_project_time_entry() returns trigger language plpgsql set search_path=public as $$
begin
 if tg_op='DELETE' then
  if old.act_id is not null then raise exception 'No se puede eliminar una hora incluida en acta'; end if;
  return old;
 end if;
 if old.act_id is not null then
  if new.act_id is distinct from old.act_id or
   (to_jsonb(new)-'updated_at') is distinct from (to_jsonb(old)-'updated_at')
  then raise exception 'El registro incluido en acta es inmutable'; end if;
 end if;
 return new;
end $$;
create trigger project_time_immutable before update or delete on public.project_time_entries
 for each row execute function public.guard_project_time_entry();
-- Tenant isolation: all authenticated members read, managers/admins write.
do $$
declare tbl text;
begin
 foreach tbl in array array['project_hour_settings','project_time_entries','project_hour_acts'] loop
  execute format('alter table public.%I enable row level security',tbl);
  execute format('alter table public.%I force row level security',tbl);
  execute format('revoke all on public.%I from public,anon,authenticated',tbl);
  execute format('grant select on public.%I to authenticated',tbl);
  execute format('create policy %I on public.%I for select to authenticated using (exists (select 1 from public.organization_memberships m where m.organization_id=%I.organization_id and m.user_id=(select auth.uid()) and m.is_active=true))',
   tbl||'_read',tbl,tbl);
 end loop;
end $$;
grant insert,update on public.project_hour_settings to authenticated;
grant insert on public.project_time_entries to authenticated;
-- No direct permission to change project/tenant/author/act links after creation.
grant update(activity_date,consultant_name,description,hours,status,approved_by,approved_at,work_item_id,updated_at)
 on public.project_time_entries to authenticated;

do $$
declare tbl text;
begin
 foreach tbl in array array['project_hour_settings','project_time_entries'] loop
  execute format('create policy %I on public.%I for insert to authenticated with check (exists (select 1 from public.organization_memberships m where m.organization_id=%I.organization_id and m.user_id=(select auth.uid()) and m.is_active=true and m.role_id in (''admin'',''manager'')))',
   tbl||'_insert',tbl,tbl);
  execute format('create policy %I on public.%I for update to authenticated using (exists (select 1 from public.organization_memberships m where m.organization_id=%I.organization_id and m.user_id=(select auth.uid()) and m.is_active=true and m.role_id in (''admin'',''manager''))) with check (exists (select 1 from public.organization_memberships m where m.organization_id=%I.organization_id and m.user_id=(select auth.uid()) and m.is_active=true and m.role_id in (''admin'',''manager'')))',
   tbl||'_update',tbl,tbl,tbl);
 end loop;
end $$;
-- Actas solo mediante la función transaccional; se deniega INSERT directo.
revoke insert on public.project_hour_acts from authenticated;
create or replace function public.issue_project_hour_act(p_organization uuid,p_project uuid,p_from date,p_to date)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_user uuid:=auth.uid();v_number integer;v_act uuid;v_total numeric;v_snapshot jsonb;v_project text;
begin
 if v_user is null or p_from is null or p_to is null or p_to<p_from then raise exception 'Rango de fechas inválido'; end if;
 if not exists(select 1 from public.organization_memberships m where m.organization_id=p_organization and m.user_id=v_user
  and m.is_active=true and m.role_id in ('admin','manager')) then raise exception 'Sin permiso para emitir actas'; end if;
 select name into v_project from public.projects where id=p_project and organization_id=p_organization;
 if v_project is null then raise exception 'Proyecto no encontrado'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_organization::text||':'||p_project::text,0));
 -- Prevent concurrent approval/act creation races by locking included rows before snapshot.
 perform 1 from public.project_time_entries
  where organization_id=p_organization and project_id=p_project and status='approved' and act_id is null
    and activity_date between p_from and p_to for update;
 select coalesce(sum(hours),0),coalesce(jsonb_agg(jsonb_build_object(
  'id',id,'date',activity_date,'consultant',consultant_name,'description',description,
  'work_item_id',work_item_id,'hours',hours) order by activity_date,created_at,id),'[]'::jsonb)
 into v_total,v_snapshot
 from public.project_time_entries
 where organization_id=p_organization and project_id=p_project and status='approved' and act_id is null
   and activity_date between p_from and p_to;
 if v_total<=0 then raise exception 'No existen horas aprobadas pendientes en el periodo'; end if;
 select coalesce(max(number),0)+1 into v_number from public.project_hour_acts
 where organization_id=p_organization and project_id=p_project;
 insert into public.project_hour_acts(organization_id,project_id,number,period_from,period_to,total_hours,snapshot,prepared_by)
 values(p_organization,p_project,v_number,p_from,p_to,v_total,v_snapshot,v_user) returning id into v_act;
 update public.project_time_entries set act_id=v_act
 where organization_id=p_organization and project_id=p_project and status='approved' and act_id is null
   and activity_date between p_from and p_to;
 return v_act;
end $$;
-- Only SECURITY DEFINER RPC may create actas: it checks auth.uid, active membership, organization and project.\n-- Callers have no direct INSERT grant on the immutable act table.
grant execute on function public.issue_project_hour_act(uuid,uuid,date,date) to authenticated;
revoke execute on function public.issue_project_hour_act(uuid,uuid,date,date) from public,anon;
commit;