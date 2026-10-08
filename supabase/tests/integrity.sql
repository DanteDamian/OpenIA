-- Sin fixtures persistidos. Excepciones fallan la ejecución con ON_ERROR_STOP.
begin;
do $$
declare
  item record;
  expected text;
  count_tables integer;
  checks integer := 0;
  ok boolean;
begin
  select count(*) into count_tables from pg_tables where schemaname = 'public';
  if count_tables <> 16 then raise exception 'Expected 16 application tables, got %', count_tables; end if;
  if (select count(*) from auth.users) <> 0 then raise exception 'Auth users must remain empty'; end if;
  if (select count(*) from public.roles) <> 4 then raise exception 'Role catalog missing'; end if;

  for item in select c.oid, c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
              where n.nspname='public' and c.relkind='r' loop
    if not exists (select 1 from pg_constraint where conrelid=item.oid and contype='p' and convalidated) then
      raise exception 'Missing primary key on %',item.relname;
    end if;
    checks := checks + 1;
  end loop;

  if not exists (select 1 from pg_constraint where conrelid='public.profiles'::regclass
    and confrelid='auth.users'::regclass and contype='f' and confdeltype='c') then
    raise exception 'Profiles must reference Supabase Auth users';
  end if;
  if exists (select 1 from pg_constraint where contype='f' and not convalidated
    and connamespace='public'::regnamespace) then raise exception 'Unvalidated foreign key'; end if;

  -- Toda relación entre registros empresariales incluye organization_id en ambos lados.
  for item in select k.*, c.relname from pg_constraint k join pg_class c on c.oid=k.conrelid
    where k.contype='f' and c.relnamespace='public'::regnamespace
      and c.relname in ('clients','contacts','opportunities','quotes','contracts','projects','invoices','payments','expenses')
      and k.confrelid not in ('public.profiles'::regclass,'public.organizations'::regclass) loop
    if not exists (select 1 from pg_attribute where attrelid=item.conrelid
      and attname='organization_id' and attnum=any(item.conkey))
      or not exists (select 1 from pg_attribute where attrelid=item.confrelid
      and attname='organization_id' and attnum=any(item.confkey)) then
      raise exception 'Cross-tenant FK not protected: %',item.conname;
    end if;
    if item.confdeltype <> 'r' then raise exception 'Financial/business relationships must restrict deletion'; end if;
    checks := checks + 1;
  end loop;

  -- Cada FK empresarial tiene un índice utilizable (orden libre de sus columnas).
  for item in select k.* from pg_constraint k join pg_class c on c.oid=k.conrelid
    where k.contype='f' and c.relnamespace='public'::regnamespace
      and k.confrelid <> 'public.profiles'::regclass loop
    if not exists (select 1 from pg_index i where i.indrelid=item.conrelid
      and i.indisvalid and i.indpred is null and
      (select array_agg(v::smallint order by v) from unnest(i.indkey::smallint[]) with ordinality as x(v,pos)
       where pos <= cardinality(item.conkey)) =
      (select array_agg(v order by v) from unnest(item.conkey) v)) then
      raise exception 'Missing FK index: %',item.conname;
    end if;
    checks := checks + 1;
  end loop;

  for item in select table_name,column_name,numeric_precision,numeric_scale
    from information_schema.columns where table_schema='public' and data_type='numeric' loop
    if item.numeric_precision <> 18 or item.numeric_scale <> 2 then
      raise exception 'Incorrect decimal precision on %.%',item.table_name,item.column_name;
    end if;
    checks := checks + 1;
  end loop;
  for expected in select unnest(array['quotes','invoices']) loop
    if not exists (select 1 from pg_attribute where attrelid=('public.'||expected)::regclass
      and attname='total' and attgenerated='s') then raise exception 'Total must be generated: %',expected; end if;
    checks := checks + 1;
  end loop;

  -- Ejecutar las expresiones CHECK reales con valores escalares; no insertar registros.
  for item in select c.relname, pg_get_expr(k.conbin,k.conrelid) expression
    from pg_constraint k join pg_class c on c.oid=k.conrelid
    where k.contype='c' and c.relnamespace='public'::regnamespace
      and c.relname in ('quotes','invoices')
      and pg_get_expr(k.conbin,k.conrelid) like '%discount_amount%' loop
    execute 'select '||item.expression||' from (select 1::numeric subtotal, 2::numeric discount_amount) v' into ok;
    if ok is distinct from false then raise exception 'Discount exceeds subtotal accepted'; end if;
    execute 'select '||item.expression||' from (select 1::numeric subtotal, 0::numeric discount_amount) v' into ok;
    if ok is distinct from true then raise exception 'Valid discount rejected'; end if;
    checks := checks + 2;
  end loop;
  for item in select c.relname, pg_get_expr(k.conbin,k.conrelid) expression
    from pg_constraint k join pg_class c on c.oid=k.conrelid
    where k.contype='c' and c.relname in ('payments','expenses')
      and pg_get_expr(k.conbin,k.conrelid) like '%amount%' loop
    execute 'select '||item.expression||' from (select ''NaN''::numeric amount) v' into ok;
    if ok is distinct from false then raise exception 'NaN accepted'; end if;
    execute 'select '||item.expression||' from (select 0::numeric amount) v' into ok;
    if ok is distinct from false then raise exception 'Zero payment/expense accepted'; end if;
    execute 'select '||item.expression||' from (select -1::numeric amount) v' into ok;
    if ok is distinct from false then raise exception 'Negative payment/expense accepted'; end if;
    checks := checks + 3;
  end loop;
  select pg_get_expr(conbin,conrelid) into expected from pg_constraint
    where conrelid='public.invoices'::regclass and contype='c' and pg_get_expr(conbin,conrelid) like '%due_on%';
  execute 'select '||expected||' from (select date ''2026-01-02'' issued_on,date ''2026-01-01'' due_on) v' into ok;
  if ok is distinct from false then raise exception 'Invoice due before issue accepted'; end if;
  checks := checks + 1;

  if (select count(*) from pg_trigger where tgrelid='auth.users'::regclass
     and tgname='on_auth_user_created' and not tgisinternal) <> 1 then raise exception 'Missing Auth profile trigger'; end if;
  if (select count(*) from pg_trigger where tgname like '%_stamp' and not tgisinternal) <> 13 then
    raise exception 'Missing immutable identity/audit triggers';
  end if;
  for expected in select unnest(array['organizations','profiles','organization_memberships','clients','contacts',
    'opportunities','quotes','contracts','projects','invoices','payments','expenses']) loop
    execute format('select count(*) = 0 from public.%I', expected) into ok;
    if not ok then raise exception 'Unexpected user/business fixture on %',expected; end if;
  end loop;
  raise notice 'Integrity: % assertions passed; no users or financial rows created', checks + 18;
end $$;
rollback;
