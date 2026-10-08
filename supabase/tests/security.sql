begin;
do $$
declare
  item record;
  member_role text;
  resource text;
  operation text;
  expected boolean;
  actual boolean;
  checks integer := 0;
begin
  for item in select c.oid,c.relname,c.relrowsecurity,c.relforcerowsecurity
    from pg_class c where c.relnamespace='public'::regnamespace and c.relkind='r' loop
    if not item.relrowsecurity or not item.relforcerowsecurity then
      raise exception 'RLS not enabled/forced: %',item.relname;
    end if;
    if has_table_privilege('anon', item.oid, 'SELECT,INSERT,UPDATE,DELETE') then
      raise exception 'Anonymous table access on %',item.relname;
    end if;
    if not exists (select 1 from pg_policy p where p.polrelid=item.oid and p.polcmd='r'
        and p.polroles=array[(select oid from pg_roles where rolname='authenticated')]) then
      raise exception 'Missing authenticated SELECT policy: %',item.relname;
    end if;
    checks := checks + 3;
  end loop;
  if (select count(*) from pg_policy where polrelid in
      (select oid from pg_class where relnamespace='public'::regnamespace)) <> 45 then
    raise exception 'Unexpected policy count';
  end if;
  if exists (select 1 from pg_policy where polrelid in
      (select oid from pg_class where relnamespace='public'::regnamespace)
      and polpermissive=false) then raise exception 'Unexpected restrictive policy'; end if;
  for item in select c.oid,c.relname from pg_class c where c.relnamespace='public'::regnamespace
      and c.relname in ('clients','contacts','opportunities','quotes','contracts','projects','invoices','payments','expenses') loop
    if (select count(*) from pg_policy where polrelid=item.oid and polcmd='a' and polwithcheck is not null) <> 1
       or (select count(*) from pg_policy where polrelid=item.oid and polcmd='w'
           and polqual is not null and polwithcheck is not null) <> 1 then
      raise exception 'Missing INSERT/UPDATE checks on %',item.relname;
    end if;
    if exists (select 1 from pg_policy where polrelid=item.oid and
      coalesce(pg_get_expr(polqual,polrelid),'')||coalesce(pg_get_expr(polwithcheck,polrelid),'')
        not like '%has_permission(organization_id%') then
      raise exception 'Tenant predicate absent on %',item.relname;
    end if;
    checks := checks + 2;
  end loop;
  for resource in select unnest(array['quotes','contracts','invoices','payments','expenses','organization_memberships','roles']) loop
    if has_table_privilege('authenticated','public.'||resource,'DELETE') then
      raise exception 'Forbidden authenticated deletion: %',resource;
    end if;
    checks := checks + 1;
  end loop;
  if has_table_privilege('authenticated','public.organization_memberships','INSERT,UPDATE')
    or has_table_privilege('authenticated','public.roles','INSERT,UPDATE')
    or has_table_privilege('authenticated','public.organizations','INSERT')
    or has_table_privilege('authenticated','public.profiles','INSERT') then
    raise exception 'Client can bootstrap users or escalate roles';
  end if;
  if has_column_privilege('authenticated','public.profiles','id','UPDATE')
    or has_column_privilege('authenticated','public.organizations','currency','UPDATE')
    or has_column_privilege('authenticated','public.organizations','slug','UPDATE') then
    raise exception 'Unexpected sensitive column update privilege';
  end if;
  if has_schema_privilege('authenticated','public','CREATE')
    or has_schema_privilege('anon','public','CREATE') then raise exception 'Schema write privilege exposed'; end if;
  if has_function_privilege('anon','private.has_permission(uuid,text,text)','EXECUTE')
    or has_function_privilege('authenticated','private.create_auth_profile()','EXECUTE')
 then
    raise exception 'Private helper exposed';
  end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='private' and 'search_path=""'=any(p.proconfig)) <> 7 then
    raise exception 'Private functions must pin empty search_path';
  end if;

  if (select prosecdef from pg_proc where oid='private.has_permission(uuid,text,text)'::regprocedure) then
    raise exception 'Permission resolver must be SECURITY INVOKER';
  end if;
  if (select prosecdef from pg_proc where oid='private.bootstrap_aigenterra(uuid[],text)'::regprocedure)
     or has_function_privilege('authenticated','private.bootstrap_aigenterra(uuid[],text)','EXECUTE')
     or has_function_privilege('service_role','private.bootstrap_aigenterra(uuid[],text)','EXECUTE') then
    raise exception 'Bootstrap exposed or privileged';
  end if;
  if (select count(*) from pg_proc where pronamespace='private'::regnamespace and prosecdef) <> 1 then
    raise exception 'Unexpected SECURITY DEFINER routine';
  end if;
  if has_table_privilege('authenticated','private.organization_bootstrap_audit','SELECT,INSERT,UPDATE,DELETE')
    or has_table_privilege('service_role','private.organization_bootstrap_audit','SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'Bootstrap approval audit exposed';
  end if;
  -- Matriz completa: 4 roles x 11 recursos x 4 operaciones, sin usuarios de prueba.
  foreach member_role in array array['admin','manager','accountant','viewer'] loop
    foreach resource in array array['organizations','memberships','clients','contacts','opportunities',
      'quotes','contracts','projects','invoices','payments','expenses'] loop
      foreach operation in array array['read','write','delete','unknown'] loop
        expected := case operation
          when 'read' then true
          when 'write' then resource <> 'memberships' and (
            member_role='admin' or (member_role='manager' and resource=any(array['clients','contacts','opportunities','quotes','contracts','projects']))
              or (member_role='accountant' and resource=any(array['invoices','payments','expenses'])))
          when 'delete' then member_role=any(array['admin','manager']) and resource=any(array['clients','contacts','opportunities','projects'])
          else false end;
        actual := private.role_allows(member_role,resource,operation);
        if actual is distinct from expected then
          raise exception 'Permission mismatch for %/%/%',member_role,resource,operation;
        end if;
        checks := checks + 1;
      end loop;
    end loop;
  end loop;
  if private.role_allows(null,'invoices','read') or private.role_allows('owner','invoices','write')
     or private.role_allows('admin','unknown','write') then raise exception 'Invalid permission input accepted'; end if;
  raise notice 'Security catalog and permission matrix: % assertions passed',checks + 8;
end $$;

-- Ejecutar consultas reales con roles PostgREST; nunca fabricar usuarios Auth.
set local role anon;
do $$
begin
  begin
    perform 1 from public.clients;
    raise exception 'Anonymous SELECT unexpectedly allowed';
  exception when insufficient_privilege then null;
  end;
  raise notice 'Anonymous query correctly denied';
end $$;
reset role;

set local role authenticated;
do $$
declare table_name text; visible integer;
begin
  if auth.uid() is not null then raise exception 'Unexpected JWT subject'; end if;
  foreach table_name in array array['organizations','profiles','organization_memberships','clients','contacts',
    'opportunities','quotes','contracts','projects','invoices','payments','expenses'] loop
    execute format('select count(*) from public.%I',table_name) into visible;
    if visible <> 0 then raise exception 'Unaffiliated session sees business rows'; end if;
  end loop;
  if private.has_permission(gen_random_uuid(),'clients','write') then raise exception 'Missing member granted permission'; end if;
  begin
    -- Intento rechazado por RLS: no crea registros, ni siquiera transitorios.
    insert into public.clients(organization_id,legal_name) values (gen_random_uuid(),'RLS denied probe');
    raise exception 'Unauthorized client insertion unexpectedly allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.roles set name = 'Escalation denied probe' where id='viewer';
    raise exception 'Role mutation unexpectedly allowed';
  exception when insufficient_privilege then null;
  end;
  -- JWT de una identidad inexistente, con metadatos que intentan asignarse admin.
  -- No se crea ningún usuario: el contrato SQL debe seguir negando acceso.
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub',gen_random_uuid()::text,'user_metadata',jsonb_build_object('role','admin'))::text,true);
  if auth.uid() is null then raise exception 'JWT contract did not resolve subject'; end if;
  if private.has_permission(gen_random_uuid(),'invoices','write') then
    raise exception 'Editable JWT metadata granted permissions';
  end if;
  raise notice 'Authenticated session without membership: SELECT isolation, INSERT denial, role mutation and metadata escalation denial passed';
end $$;
reset role;
rollback;
