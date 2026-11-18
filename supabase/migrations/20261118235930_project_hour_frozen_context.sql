-- Frozen client/contract identity for immutable acts and prevention of forged act links.
begin;
alter table public.project_hour_acts add column if not exists frozen_context jsonb not null default '{}'::jsonb;
create or replace function public.guard_project_time_entry() returns trigger language plpgsql set search_path=public as $$
begin
 if tg_op='INSERT' then
  if new.act_id is not null then raise exception 'No se puede insertar horas directamente en un acta'; end if;
  return new;
 end if;
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
drop trigger if exists project_time_immutable on public.project_time_entries;
create trigger project_time_immutable before insert or update or delete on public.project_time_entries
 for each row execute function public.guard_project_time_entry();
create or replace function public.issue_project_hour_act(p_organization uuid,p_project uuid,p_from date,p_to date)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_user uuid:=auth.uid();v_number integer;v_act uuid;v_total numeric;v_snapshot jsonb;v_project text;v_context jsonb;
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
 select jsonb_build_object('project_name',p.name,'client_name',c.legal_name,
  'client_document',c.document_number,'contract_number',co.number,
  'contract_title',co.title,'contracted_hours',s.contracted_hours)
 into v_context
 from public.projects p join public.clients c on c.organization_id=p.organization_id and c.id=p.client_id
 left join public.contracts co on co.organization_id=p.organization_id and co.id=p.contract_id
 left join public.project_hour_settings s on s.organization_id=p.organization_id and s.project_id=p.id
 where p.organization_id=p_organization and p.id=p_project;
 insert into public.project_hour_acts(organization_id,project_id,number,period_from,period_to,total_hours,snapshot,frozen_context,prepared_by)
 values(p_organization,p_project,v_number,p_from,p_to,v_total,v_snapshot,v_context,v_user) returning id into v_act;
 update public.project_time_entries set act_id=v_act
 where organization_id=p_organization and project_id=p_project and status='approved' and act_id is null
   and activity_date between p_from and p_to;
 return v_act;
end $$;
commit;