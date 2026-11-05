-- Verificar estado seguro si no llega a aplicarse la migración de políticas.
do $$
declare item record;
begin
  for item in select c.oid,c.relname,c.relrowsecurity,c.relforcerowsecurity from pg_class c
    where c.relnamespace='public'::regnamespace and c.relkind='r' loop
    if not item.relrowsecurity or not item.relforcerowsecurity
      or has_table_privilege('anon',item.oid,'SELECT,INSERT,UPDATE,DELETE')
      or has_table_privilege('authenticated',item.oid,'SELECT,INSERT,UPDATE,DELETE') then
      raise exception 'Initial migration left table exposed: %',item.relname;
    end if;
  end loop;
  raise notice 'Initial migration alone: 13 tables deny anonymous/authenticated access';
end $$;
