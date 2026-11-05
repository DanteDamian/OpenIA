-- Solo lectura. Ejecutar con ON_ERROR_STOP antes de las tres migraciones.
-- No ejecutar bootstrap.sql de las pruebas en un proyecto gestionado.
begin read only;
do $$
declare
  object_name text;
  permission text;
  column_spec record;
begin
  if current_setting('server_version_num')::integer / 10000 <> 17 then
    raise exception 'Staging requires PostgreSQL major version 17';
  end if;
  if current_user <> 'postgres' or not exists (
    select 1 from pg_roles where rolname = current_user and rolbypassrls
  ) then
    raise exception 'Use the reviewed postgres migration operator with BYPASSRLS';
  end if;
  foreach object_name in array array['anon', 'authenticated', 'service_role'] loop
    if not exists (select 1 from pg_roles where rolname = object_name) then
      raise exception 'Missing Supabase role: %', object_name;
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname in ('anon', 'authenticated')
    and (rolsuper or rolbypassrls)) then
    raise exception 'Client roles must not bypass RLS';
  end if;
  if to_regclass('auth.users') is null or to_regprocedure('auth.uid()') is null then
    raise exception 'Supabase Auth must already be installed';
  end if;
  if (select prorettype from pg_proc where oid = 'auth.uid()'::regprocedure) <> 'uuid'::regtype then
    raise exception 'auth.uid() must return uuid';
  end if;
  for column_spec in select * from (values
    ('id', 'uuid'), ('email_confirmed_at', 'timestamptz'),
    ('phone_confirmed_at', 'timestamptz'), ('deleted_at', 'timestamptz'),
    ('is_anonymous', 'bool'), ('banned_until', 'timestamptz')
  ) as required(name, type_name) loop
    if not exists (select 1 from pg_attribute where attrelid = 'auth.users'::regclass
      and attname = column_spec.name and not attisdropped
      and atttypid = column_spec.type_name::regtype) then
      raise exception 'Missing/incompatible Auth column: %', column_spec.name;
    end if;
  end loop;
  if not has_database_privilege(current_user, current_database(), 'CREATE')
    or not has_schema_privilege(current_user, 'public', 'CREATE')
    or not has_schema_privilege(current_user, 'auth', 'USAGE') then
    raise exception 'Migration operator lacks database/schema privileges';
  end if;
  foreach permission in array array['SELECT', 'REFERENCES', 'TRIGGER'] loop
    if not has_table_privilege(current_user, 'auth.users', permission) then
      raise exception 'Migration operator lacks % on auth.users', permission;
    end if;
  end loop;
  foreach object_name in array array['organizations','profiles','roles','organization_memberships',
    'clients','contacts','opportunities','quotes','contracts','projects','invoices','payments','expenses'] loop
    if to_regclass('public.' || object_name) is not null then
      raise exception 'Initial deployment collides with public.%: inspect migration history', object_name;
    end if;
  end loop;
  -- Una private preexistente puede contener rutinas/ACL ajenas. No alterarla a ciegas.
  if to_regnamespace('private') is not null then
    raise exception 'Existing private schema requires separate review before initial deployment';
  end if;
  if exists (select 1 from pg_trigger where tgrelid = 'auth.users'::regclass
    and tgname = 'on_auth_user_created') then
    raise exception 'Auth trigger name is already in use';
  end if;
  raise notice 'Staging SQL preflight passed; target identity and hosted Auth/API settings still require review';
end $$;
rollback;
