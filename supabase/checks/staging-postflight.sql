-- Solo metadatos/configuración de roles: no consulta identidades ni finanzas.
begin read only;
do $$
declare
  object_name text;
  relation_oid oid;
  application_oids oid[] := '{}';
  routine record;
begin
  if current_user <> 'postgres' or current_setting('server_version_num')::integer / 10000 <> 17 then
    raise exception 'Expected reviewed postgres operator on PostgreSQL 17';
  end if;
  foreach object_name in array array['organizations','profiles','roles','organization_memberships',
    'clients','contacts','opportunities','quotes','contracts','projects','invoices','payments','expenses'] loop
    relation_oid := to_regclass('public.' || object_name);
    if relation_oid is null or not exists (select 1 from pg_class
      where oid = relation_oid and relkind = 'r' and relrowsecurity and relforcerowsecurity
        and relowner = (select oid from pg_roles where rolname = 'postgres')) then
      raise exception 'Missing table, trusted ownership or forced RLS: %', object_name;
    end if;
    if has_table_privilege('anon', relation_oid, 'SELECT,INSERT,UPDATE,DELETE') then
      raise exception 'Anonymous access on %', object_name;
    end if;
    if not exists (select 1 from pg_constraint where conrelid = relation_oid
      and contype = 'p' and convalidated) or exists (select 1 from pg_constraint
      where conrelid = relation_oid and not convalidated) then
      raise exception 'Invalid constraints on %', object_name;
    end if;
    application_oids := array_append(application_oids, relation_oid);
  end loop;
  if (select count(*) from pg_policy where polrelid = any(application_oids)) <> 37 then
    raise exception 'Expected 37 application policies';
  end if;
  if (select array_agg(id order by id) from public.roles) is distinct from
    array['accountant','admin','manager','viewer']::text[] then
    raise exception 'Role catalog mismatch';
  end if;
  if not exists (select 1 from pg_policy where polrelid = 'public.organization_memberships'::regclass
    and polname = 'memberships_read' and pg_get_expr(polqual, polrelid) like '%user_id%auth.uid()%') then
    raise exception 'Membership self-read policy missing';
  end if;
  if has_table_privilege('authenticated', 'public.organization_memberships', 'INSERT,UPDATE,DELETE')
    or has_table_privilege('authenticated', 'public.roles', 'INSERT,UPDATE,DELETE')
    or has_table_privilege('authenticated', 'private.organization_bootstrap_audit', 'SELECT,INSERT,UPDATE,DELETE')
    or has_table_privilege('service_role', 'private.organization_bootstrap_audit', 'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'Administrative objects exposed';
  end if;
  if (select count(*) from pg_proc where pronamespace = 'private'::regnamespace) <> 6 then
    raise exception 'Unexpected private routines';
  end if;
  for routine in select p.*, pg_get_userbyid(p.proowner) owner_name from pg_proc p
    where pronamespace = 'private'::regnamespace loop
    if routine.owner_name <> 'postgres' or not coalesce('search_path=""' = any(routine.proconfig), false)
      or routine.prosecdef is distinct from (routine.proname = 'create_auth_profile') then
      raise exception 'Unsafe owner/search_path/security mode: %', routine.proname;
    end if;
  end loop;
  if has_function_privilege('authenticated', 'private.create_auth_profile()', 'EXECUTE')
    or has_function_privilege('anon', 'private.has_permission(uuid,text,text)', 'EXECUTE')
    or has_function_privilege('authenticated', 'private.bootstrap_aigenterra(uuid[],text)', 'EXECUTE')
    or has_function_privilege('service_role', 'private.bootstrap_aigenterra(uuid[],text)', 'EXECUTE') then
    raise exception 'Private privileged function exposed';
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'auth.users'::regclass
    and tgname = 'on_auth_user_created' and tgenabled in ('O','A')
    and tgfoid = 'private.create_auth_profile()'::regprocedure) then
    raise exception 'Auth profile trigger missing/disabled';
  end if;
  raise notice 'Staging SQL postflight passed; HTTP Auth and tenant/role acceptance remain required';
end $$;
rollback;
