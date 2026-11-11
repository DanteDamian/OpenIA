-- AIGENTERRA Radar, additive and isolated from existing manual convocatorias.
begin;
create table public.radar_sources (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete restrict,
 name text not null, country text not null, category text not null default 'Contratación',
 official_url text not null check (official_url ~ '^https://'),
 query_method text not null default 'manual' check(query_method in ('manual','socrata')),
 enabled boolean not null default false,
 technical_status text not null default 'pending',
 last_checked_at timestamptz, last_result text,
 created_at timestamptz not null default now(),
 unique(organization_id,official_url), unique(organization_id,id)
);
create table public.radar_services (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete restrict,
 name text not null, category text not null, enabled boolean not null default true,
 created_at timestamptz not null default now(),
 unique(organization_id,name)
);
create table public.radar_runs (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete restrict,
 status text not null default 'queued' check(status in ('queued','running','completed','failed')),
 started_at timestamptz not null default now(), finished_at timestamptz,
 checked_sources integer not null default 0, discovered integer not null default 0,
 verified integer not null default 0, error_summary text,
 unique(organization_id,id)
);
create table public.radar_opportunities (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete restrict,
 source_id uuid not null,
 official_id text,
 title text not null, description text, country text not null,
 issuer_name text, opportunity_type text,
 published_on date, deadline_on date,
 budget numeric(18,2) check(budget>=0 and budget <> 'NaN'::numeric),
 currency text,
 official_url text not null check(official_url ~ '^https://'),
 normalized_url text not null,
 verification_status text not null default 'Pendiente de verificación'
   check(verification_status in ('Detectada','Pendiente de verificación','Verificada abierta','Cerrada','Descartada','Error de verificación')),
 service_name text, match_score integer check(match_score between 0 and 100),
 match_reason text, eligibility text, priority text, responsible text, observations text,
 verified_at timestamptz, last_checked_at timestamptz,
 added_to_calls uuid references public.calls_for_proposals(id) on delete restrict,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key (organization_id,source_id) references public.radar_sources(organization_id,id) on delete restrict,
 unique(organization_id,normalized_url), unique(organization_id,id)
);
create table public.radar_evidence (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete restrict,
 opportunity_id uuid not null,
 official_url text not null check(official_url ~ '^https://'),
 excerpt text not null, checked_at timestamptz not null default now(),
 result text not null,
 foreign key (organization_id,opportunity_id) references public.radar_opportunities(organization_id,id) on delete restrict
);
create index radar_sources_org_idx on public.radar_sources(organization_id);
create index radar_services_org_idx on public.radar_services(organization_id);
create index radar_runs_org_idx on public.radar_runs(organization_id,started_at desc);
create index radar_opportunities_org_source_idx on public.radar_opportunities(organization_id,source_id);
create index radar_opportunities_org_date_idx on public.radar_opportunities(organization_id,deadline_on);
create index radar_evidence_org_opportunity_idx on public.radar_evidence(organization_id,opportunity_id);
-- Standard role/tenant policy, consistent with commercial workspace.
do $$
declare tbl text;
begin
 foreach tbl in array array['radar_sources','radar_services','radar_runs','radar_opportunities','radar_evidence'] loop
  execute format('alter table public.%I enable row level security',tbl);
  execute format('alter table public.%I force row level security',tbl);
  execute format('revoke all on public.%I from public, anon, authenticated',tbl);
  execute format('grant select,insert,update on public.%I to authenticated',tbl);
  execute format('grant all on public.%I to service_role',tbl);
  execute format('create policy %I on public.%I for select to authenticated using (exists(select 1 from public.organization_memberships m where m.organization_id=%I.organization_id and m.user_id=(select auth.uid()) and m.is_active is distinct from false))',tbl||'_read',tbl,tbl);
  execute format('create policy %I on public.%I for insert to authenticated with check (exists(select 1 from public.organization_memberships m where m.organization_id=%I.organization_id and m.user_id=(select auth.uid()) and m.role_id in (''admin'',''manager'') and m.is_active is distinct from false))',tbl||'_insert',tbl,tbl);
  execute format('create policy %I on public.%I for update to authenticated using (exists(select 1 from public.organization_memberships m where m.organization_id=%I.organization_id and m.user_id=(select auth.uid()) and m.role_id in (''admin'',''manager'') and m.is_active is distinct from false)) with check (exists(select 1 from public.organization_memberships m where m.organization_id=%I.organization_id and m.user_id=(select auth.uid()) and m.role_id in (''admin'',''manager'') and m.is_active is distinct from false))',tbl||'_update',tbl,tbl,tbl);
 end loop;
end $$;
commit;
