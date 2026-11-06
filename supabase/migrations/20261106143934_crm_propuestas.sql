-- CRM Propuestas: extensión aislada del modelo existente de AIGENTERRA Finance AI.
begin;

create or replace function private.role_allows(member_role text, resource text, operation text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(
    member_role in ('admin', 'manager', 'accountant', 'viewer')
    and resource in ('organizations', 'memberships', 'clients', 'contacts', 'opportunities',
                     'quotes', 'contracts', 'projects', 'invoices', 'payments', 'expenses', 'proposals')
    and (
      operation = 'read'
      or (operation = 'write' and resource <> 'memberships' and (
        member_role = 'admin'
        or (member_role = 'manager' and resource in ('clients', 'contacts', 'opportunities', 'quotes', 'contracts', 'projects', 'proposals'))
        or (member_role = 'accountant' and resource in ('invoices', 'payments', 'expenses'))
      ))
      or (operation = 'delete' and resource in ('clients', 'contacts', 'opportunities', 'projects')
          and member_role in ('admin', 'manager'))
    ), false);
$$;
revoke all on function private.role_allows(text, text, text) from public, anon, authenticated;
grant execute on function private.role_allows(text, text, text) to authenticated;

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  client_id uuid not null,
  call_for_proposal_id uuid,
  opportunity_id uuid,
  code text not null check (length(btrim(code)) between 1 and 60),
  version integer not null default 1 check (version > 0),
  title text not null check (length(btrim(title)) between 1 and 200),
  status text not null default 'draft' check (status in ('draft','review','pending_approval','approved','rejected','sent','accepted','expired')),
  currency text not null default 'COP' check (currency = 'COP'),
  valid_until date,
  notes text check (notes is null or length(notes) <= 4000),
  approved_by uuid references public.profiles(id) on delete restrict,
  approved_at timestamptz,
  created_by uuid references public.profiles(id) on delete restrict default auth.uid(),
  updated_by uuid references public.profiles(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code, version),
  unique (organization_id, id),
  foreign key (organization_id, client_id) references public.clients(organization_id, id) on delete restrict,
  foreign key (organization_id, call_for_proposal_id) references public.calls_for_proposals(organization_id, id) on delete restrict,
  foreign key (organization_id, client_id, opportunity_id) references public.opportunities(organization_id, client_id, id) on delete restrict,
  check ((approved_by is null and approved_at is null) or (approved_by is not null and approved_at is not null))
);

create table public.proposal_sections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  proposal_id uuid not null,
  section_key text not null check (section_key in ('carta','resumen','objetivos','alcance','metodologia','entregables','cronograma','equipo','riesgos','responsabilidades_exclusiones','oferta_economica','condiciones_comerciales','garantias','aceptacion')),
  title text not null check (length(btrim(title)) between 1 and 120),
  content text not null default '' check (length(content) <= 30000),
  position smallint not null check (position between 1 and 14),
  created_by uuid references public.profiles(id) on delete restrict default auth.uid(),
  updated_by uuid references public.profiles(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (organization_id, proposal_id, section_key),
  unique (organization_id, proposal_id, position),
  foreign key (organization_id, proposal_id) references public.proposals(organization_id, id) on delete restrict
);

create table public.proposal_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  proposal_id uuid not null,
  description text not null check (length(btrim(description)) between 1 and 500),
  quantity numeric(18,2) not null check (quantity > 0 and quantity <> 'NaN'::numeric),
  unit_price numeric(18,2) not null check (unit_price >= 0 and unit_price <> 'NaN'::numeric),
  discount_amount numeric(18,2) not null default 0 check (discount_amount >= 0 and discount_amount <> 'NaN'::numeric),
  tax_amount numeric(18,2) not null default 0 check (tax_amount >= 0 and tax_amount <> 'NaN'::numeric),
  subtotal numeric(18,2) generated always as (round(quantity * unit_price, 2)) stored,
  total numeric(18,2) generated always as (round(quantity * unit_price, 2) - discount_amount + tax_amount) stored,
  position integer not null default 1 check (position > 0),
  created_by uuid references public.profiles(id) on delete restrict default auth.uid(),
  updated_by uuid references public.profiles(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (organization_id, proposal_id) references public.proposals(organization_id, id) on delete restrict,
  check (discount_amount <= round(quantity * unit_price, 2))
);

create table public.proposal_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  proposal_id uuid not null,
  version integer not null check (version > 0),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  created_by uuid references public.profiles(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  unique (organization_id, proposal_id, version),
  foreign key (organization_id, proposal_id) references public.proposals(organization_id, id) on delete restrict
);

create table public.proposal_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete restrict,
  name text not null check (length(btrim(name)) between 1 and 120),
  is_corporate boolean not null default false,
  sections jsonb not null check (jsonb_typeof(sections) = 'array'),
  brand jsonb not null check (jsonb_typeof(brand) = 'object'),
  created_by uuid references public.profiles(id) on delete restrict default auth.uid(),
  updated_by uuid references public.profiles(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique nulls not distinct (organization_id, name)
);

create table public.proposal_approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  proposal_id uuid not null,
  decision text not null check (decision in ('approved','rejected')),
  comment text check (comment is null or length(comment) <= 2000),
  decided_by uuid not null references public.profiles(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (organization_id, proposal_id) references public.proposals(organization_id, id) on delete restrict
);

create table public.proposal_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  proposal_id uuid not null,
  format text not null check (format in ('docx','pdf')),
  storage_path text not null check (length(btrim(storage_path)) between 1 and 500),
  file_name text not null check (length(btrim(file_name)) between 1 and 200),
  byte_size bigint not null check (byte_size > 0),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  created_by uuid references public.profiles(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  unique (organization_id, storage_path),
  foreign key (organization_id, proposal_id) references public.proposals(organization_id, id) on delete restrict
);

create index proposals_client_idx on public.proposals(organization_id, client_id);
create index proposals_call_idx on public.proposals(organization_id, call_for_proposal_id);
create index proposals_opportunity_idx on public.proposals(organization_id, client_id, opportunity_id);
create index proposals_status_idx on public.proposals(organization_id, status, updated_at desc);
create index proposal_sections_proposal_idx on public.proposal_sections(organization_id, proposal_id);
create index proposal_items_proposal_idx on public.proposal_items(organization_id, proposal_id, position);
create index proposal_versions_proposal_idx on public.proposal_versions(organization_id, proposal_id, version desc);
create index proposal_templates_org_idx on public.proposal_templates(organization_id, updated_at desc);
create index proposal_approvals_proposal_idx on public.proposal_approvals(organization_id, proposal_id, created_at desc);
create index proposal_documents_proposal_idx on public.proposal_documents(organization_id, proposal_id, created_at desc);

insert into public.proposal_templates(organization_id,name,is_corporate,sections,brand,created_by,updated_by)
values (null,'AIGENTERRA corporativa',true,
  '[{"key":"carta","title":"Carta de presentación"},{"key":"resumen","title":"Resumen ejecutivo"},{"key":"objetivos","title":"Objetivos"},{"key":"alcance","title":"Alcance"},{"key":"metodologia","title":"Metodología"},{"key":"entregables","title":"Entregables"},{"key":"cronograma","title":"Cronograma"},{"key":"equipo","title":"Equipo"},{"key":"riesgos","title":"Riesgos"},{"key":"responsabilidades_exclusiones","title":"Responsabilidades y exclusiones"},{"key":"oferta_economica","title":"Oferta económica"},{"key":"condiciones_comerciales","title":"Condiciones comerciales"},{"key":"garantias","title":"Garantías"},{"key":"aceptacion","title":"Aceptación"}]'::jsonb,
  '{"primary":"#12233D","secondary":"#0D8C87","accent":"#4AC5B5","background":"#FFFFFF","muted":"#E5E7EB"}'::jsonb,
  null,null);

do $$ declare table_name text;
begin
  foreach table_name in array array['proposals','proposal_sections','proposal_items','proposal_versions','proposal_templates','proposal_approvals','proposal_documents'] loop
    execute format('alter table public.%I enable row level security',table_name);
    execute format('alter table public.%I force row level security',table_name);
    execute format('revoke all on public.%I from public,anon,authenticated',table_name);
    execute format('grant all on public.%I to service_role',table_name);
  end loop;
end $$;

grant select,insert,update on public.proposals,public.proposal_sections,public.proposal_items,public.proposal_templates to authenticated;
grant select,insert on public.proposal_versions,public.proposal_approvals,public.proposal_documents to authenticated;

create policy proposals_read on public.proposals for select to authenticated using (private.has_permission(organization_id,'proposals','read'));
create policy proposals_insert on public.proposals for insert to authenticated with check (private.has_permission(organization_id,'proposals','write'));
create policy proposals_update on public.proposals for update to authenticated using (private.has_permission(organization_id,'proposals','write')) with check (private.has_permission(organization_id,'proposals','write'));
create policy proposal_sections_read on public.proposal_sections for select to authenticated using (private.has_permission(organization_id,'proposals','read'));
create policy proposal_sections_insert on public.proposal_sections for insert to authenticated with check (private.has_permission(organization_id,'proposals','write'));
create policy proposal_sections_update on public.proposal_sections for update to authenticated using (private.has_permission(organization_id,'proposals','write')) with check (private.has_permission(organization_id,'proposals','write'));
create policy proposal_items_read on public.proposal_items for select to authenticated using (private.has_permission(organization_id,'proposals','read'));
create policy proposal_items_insert on public.proposal_items for insert to authenticated with check (private.has_permission(organization_id,'proposals','write'));
create policy proposal_items_update on public.proposal_items for update to authenticated using (private.has_permission(organization_id,'proposals','write')) with check (private.has_permission(organization_id,'proposals','write'));
create policy proposal_versions_read on public.proposal_versions for select to authenticated using (private.has_permission(organization_id,'proposals','read'));
create policy proposal_versions_insert on public.proposal_versions for insert to authenticated with check (private.has_permission(organization_id,'proposals','write'));
create policy proposal_templates_read on public.proposal_templates for select to authenticated using (
  (organization_id is null and exists (select 1 from public.organization_memberships m where m.user_id=(select auth.uid()) and m.is_active))
  or private.has_permission(organization_id,'proposals','read'));
create policy proposal_templates_insert on public.proposal_templates for insert to authenticated with check (organization_id is not null and private.has_permission(organization_id,'proposals','write'));
create policy proposal_templates_update on public.proposal_templates for update to authenticated using (organization_id is not null and private.has_permission(organization_id,'proposals','write')) with check (organization_id is not null and private.has_permission(organization_id,'proposals','write'));
create policy proposal_approvals_read on public.proposal_approvals for select to authenticated using (private.has_permission(organization_id,'proposals','read'));
create policy proposal_approvals_insert on public.proposal_approvals for insert to authenticated with check (exists (select 1 from public.organization_memberships m where m.organization_id=proposal_approvals.organization_id and m.user_id=(select auth.uid()) and m.role_id='admin' and m.is_active));
create policy proposal_documents_read on public.proposal_documents for select to authenticated using (private.has_permission(organization_id,'proposals','read'));
create policy proposal_documents_insert on public.proposal_documents for insert to authenticated with check (private.has_permission(organization_id,'proposals','write'));

create trigger proposals_stamp before insert or update on public.proposals for each row execute function private.stamp_business_record();
create trigger proposal_sections_stamp before insert or update on public.proposal_sections for each row execute function private.stamp_business_record();
create trigger proposal_items_stamp before insert or update on public.proposal_items for each row execute function private.stamp_business_record();
create trigger proposal_templates_stamp before insert or update on public.proposal_templates for each row execute function private.stamp_business_record();

-- En Supabase gestionado se crea un bucket privado y políticas por carpeta de organización.
do $$ begin
  if to_regclass('storage.buckets') is not null and to_regclass('storage.objects') is not null then
    insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
      values ('proposal-documents','proposal-documents',false,15728640,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
      on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
    execute $policy$create policy proposal_files_read on storage.objects for select to authenticated using (bucket_id='proposal-documents' and exists (select 1 from public.organization_memberships m where m.organization_id=(storage.foldername(name))[1]::uuid and m.user_id=(select auth.uid()) and m.is_active))$policy$;
    execute $policy$create policy proposal_files_insert on storage.objects for insert to authenticated with check (bucket_id='proposal-documents' and exists (select 1 from public.organization_memberships m where m.organization_id=(storage.foldername(name))[1]::uuid and m.user_id=(select auth.uid()) and m.role_id in ('admin','manager') and m.is_active))$policy$;
  end if;
end $$;

commit;
