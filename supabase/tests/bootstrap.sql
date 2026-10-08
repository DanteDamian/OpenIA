-- Emulación mínima del contrato SQL de Supabase Auth, solo para PostgreSQL efímero.
-- No usar en un proyecto Supabase: allí estas entidades ya existen.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid;
$$;
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
-- Simular defaults amplios del esquema público para comprobar el cierre explícito.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
