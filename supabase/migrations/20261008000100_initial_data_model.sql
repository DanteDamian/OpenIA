-- AIGENTERRA Finance AI: esquema inicial. Ejecutar únicamente en local/staging revisado.
begin;

create schema if not exists private;
revoke all on schema private from public;
revoke create on schema public from public, anon, authenticated;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 200),
  currency text not null default 'COP' check (currency = 'COP'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- auth.users es gestionada por Supabase Auth; no almacenar contraseñas en public.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or length(btrim(display_name)) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.roles (
  id text primary key check (id in ('admin', 'manager', 'accountant', 'viewer')),
  name text not null unique
);
-- Configuración de permisos, no usuarios ni datos financieros de ejemplo.
insert into public.roles (id, name) values
  ('admin', 'Administrador'), ('manager', 'Gestor'),
  ('accountant', 'Finanzas'), ('viewer', 'Consulta');

create table public.organization_memberships (
  organization_id uuid not null references public.organizations(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  role_id text not null references public.roles(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index memberships_role_idx on public.organization_memberships(role_id);
create index memberships_user_idx on public.organization_memberships(user_id, organization_id);

-- No se copia user_metadata: nunca asignar roles desde metadatos editables por el usuario.
create function private.create_auth_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id) values (new.id);
  return new;
end;
$$;
revoke all on function private.create_auth_profile() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users
for each row execute function private.create_auth_profile();
-- Perfiles de usuarios reales que existan al aplicar la migración; no crear auth.users.
insert into public.profiles(id) select id from auth.users on conflict (id) do nothing;

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  legal_name text not null check (length(btrim(legal_name)) between 1 and 200),
  document_type text check (document_type in ('NIT', 'CC', 'CE', 'PASSPORT', 'OTHER')),
  document_number text check (document_number is null or length(btrim(document_number)) between 1 and 40),
  email text check (email is null or length(email) <= 254),
  phone text check (phone is null or length(phone) <= 40),
  address text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  check ((document_type is null) = (document_number is null)),
  created_by uuid references public.profiles(id) on delete restrict default auth.uid(),
  updated_by uuid references public.profiles(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create index clients_organization_created_idx on public.clients(organization_id, created_at desc);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  client_id uuid not null,
  full_name text not null check (length(btrim(full_name)) between 1 and 200),
  email text check (email is null or length(email) <= 254),
  phone text check (phone is null or length(phone) <= 40),
  job_title text,
  foreign key (organization_id, client_id) references public.clients(organization_id, id) on delete restrict,
  created_by uuid references public.profiles(id) on delete restrict default auth.uid(),
  updated_by uuid references public.profiles(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, client_id, id)
);

create index contacts_organization_created_idx on public.contacts(organization_id, created_at desc);
create index contacts_client_idx on public.contacts(organization_id, client_id);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  client_id uuid not null,
  contact_id uuid,
  title text not null check (length(btrim(title)) between 1 and 200),
  stage text not null default 'new' check (stage in ('new', 'qualified', 'proposal', 'won', 'lost')),
  estimated_amount numeric(18,2) check (estimated_amount >= 0 and estimated_amount <> 'NaN'::numeric),
  currency text not null default 'COP' check (currency = 'COP'),
  expected_close_date date,
  foreign key (organization_id, client_id) references public.clients(organization_id, id) on delete restrict,
  foreign key (organization_id, client_id, contact_id) references public.contacts(organization_id, client_id, id) on delete restrict,
  created_by uuid references public.profiles(id) on delete restrict default auth.uid(),
  updated_by uuid references public.profiles(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, client_id, id)
);

create index opportunities_organization_created_idx on public.opportunities(organization_id, created_at desc);
create index opportunities_client_idx on public.opportunities(organization_id, client_id);
create index opportunities_contact_id_idx on public.opportunities(organization_id, client_id, contact_id);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  client_id uuid not null,
  opportunity_id uuid,
  number text not null check (length(btrim(number)) between 1 and 60),
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'rejected', 'expired')),
  issued_on date not null,
  valid_until date,
  subtotal numeric(18,2) not null check (subtotal >= 0 and subtotal <> 'NaN'::numeric),
  discount_amount numeric(18,2) not null default 0 check (discount_amount >= 0 and discount_amount <= subtotal and discount_amount <> 'NaN'::numeric),
  tax_amount numeric(18,2) not null default 0 check (tax_amount >= 0 and tax_amount <> 'NaN'::numeric),
  total numeric(18,2) generated always as (subtotal - discount_amount + tax_amount) stored,
  currency text not null default 'COP' check (currency = 'COP'),
  check (valid_until is null or valid_until >= issued_on),
  foreign key (organization_id, client_id) references public.clients(organization_id, id) on delete restrict,
  foreign key (organization_id, client_id, opportunity_id) references public.opportunities(organization_id, client_id, id) on delete restrict,
  unique (organization_id, number),
  created_by uuid references public.profiles(id) on delete restrict default auth.uid(),
  updated_by uuid references public.profiles(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, client_id, id)
);

create index quotes_organization_created_idx on public.quotes(organization_id, created_at desc);
create index quotes_client_idx on public.quotes(organization_id, client_id);
create index quotes_opportunity_id_idx on public.quotes(organization_id, client_id, opportunity_id);

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  client_id uuid not null,
  quote_id uuid,
  number text not null check (length(btrim(number)) between 1 and 60),
  title text not null check (length(btrim(title)) between 1 and 200),
  status text not null default 'draft' check (status in ('draft', 'active', 'completed', 'terminated')),
  starts_on date,
  ends_on date,
  amount numeric(18,2) not null check (amount >= 0 and amount <> 'NaN'::numeric),
  currency text not null default 'COP' check (currency = 'COP'),
  check (ends_on is null or (starts_on is not null and ends_on >= starts_on)),
  foreign key (organization_id, client_id) references public.clients(organization_id, id) on delete restrict,
  foreign key (organization_id, client_id, quote_id) references public.quotes(organization_id, client_id, id) on delete restrict,
  unique (organization_id, number),
  created_by uuid references public.profiles(id) on delete restrict default auth.uid(),
  updated_by uuid references public.profiles(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, client_id, id)
);

create index contracts_organization_created_idx on public.contracts(organization_id, created_at desc);
create index contracts_client_idx on public.contracts(organization_id, client_id);
create index contracts_quote_id_idx on public.contracts(organization_id, client_id, quote_id);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  client_id uuid not null,
  contract_id uuid,
  name text not null check (length(btrim(name)) between 1 and 200),
  status text not null default 'planned' check (status in ('planned', 'active', 'paused', 'completed', 'cancelled')),
  starts_on date,
  ends_on date,
  budget numeric(18,2) check (budget >= 0 and budget <> 'NaN'::numeric),
  currency text not null default 'COP' check (currency = 'COP'),
  check (ends_on is null or (starts_on is not null and ends_on >= starts_on)),
  foreign key (organization_id, client_id) references public.clients(organization_id, id) on delete restrict,
  foreign key (organization_id, client_id, contract_id) references public.contracts(organization_id, client_id, id) on delete restrict,
  created_by uuid references public.profiles(id) on delete restrict default auth.uid(),
  updated_by uuid references public.profiles(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, client_id, id)
);

create index projects_organization_created_idx on public.projects(organization_id, created_at desc);
create index projects_client_idx on public.projects(organization_id, client_id);
create index projects_contract_id_idx on public.projects(organization_id, client_id, contract_id);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  client_id uuid not null,
  project_id uuid,
  contract_id uuid,
  number text not null check (length(btrim(number)) between 1 and 60),
  status text not null default 'draft' check (status in ('draft', 'issued', 'void')),
  issued_on date not null,
  due_on date not null,
  subtotal numeric(18,2) not null check (subtotal >= 0 and subtotal <> 'NaN'::numeric),
  discount_amount numeric(18,2) not null default 0 check (discount_amount >= 0 and discount_amount <= subtotal and discount_amount <> 'NaN'::numeric),
  tax_amount numeric(18,2) not null default 0 check (tax_amount >= 0 and tax_amount <> 'NaN'::numeric),
  total numeric(18,2) generated always as (subtotal - discount_amount + tax_amount) stored,
  currency text not null default 'COP' check (currency = 'COP'),
  check (due_on >= issued_on),
  foreign key (organization_id, client_id) references public.clients(organization_id, id) on delete restrict,
  foreign key (organization_id, client_id, project_id) references public.projects(organization_id, client_id, id) on delete restrict,
  foreign key (organization_id, client_id, contract_id) references public.contracts(organization_id, client_id, id) on delete restrict,
  unique (organization_id, number),
  created_by uuid references public.profiles(id) on delete restrict default auth.uid(),
  updated_by uuid references public.profiles(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create index invoices_organization_created_idx on public.invoices(organization_id, created_at desc);
create index invoices_client_idx on public.invoices(organization_id, client_id);
create index invoices_contract_id_idx on public.invoices(organization_id, client_id, contract_id);
create index invoices_project_id_idx on public.invoices(organization_id, client_id, project_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  invoice_id uuid not null,
  amount numeric(18,2) not null check (amount > 0 and amount <> 'NaN'::numeric),
  currency text not null default 'COP' check (currency = 'COP'),
  paid_on date not null,
  method text not null check (method in ('bank_transfer', 'card', 'cash', 'other')),
  reference text check (reference is null or length(btrim(reference)) between 1 and 120),
  status text not null default 'recorded' check (status in ('recorded', 'void')),
  foreign key (organization_id, invoice_id) references public.invoices(organization_id, id) on delete restrict,
  created_by uuid references public.profiles(id) on delete restrict default auth.uid(),
  updated_by uuid references public.profiles(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create index payments_organization_created_idx on public.payments(organization_id, created_at desc);
create index payments_invoice_id_idx on public.payments(organization_id, invoice_id);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  project_id uuid,
  supplier_name text not null check (length(btrim(supplier_name)) between 1 and 200),
  description text not null check (length(btrim(description)) between 1 and 1000),
  category text not null check (length(btrim(category)) between 1 and 100),
  amount numeric(18,2) not null check (amount > 0 and amount <> 'NaN'::numeric),
  currency text not null default 'COP' check (currency = 'COP'),
  incurred_on date not null,
  status text not null default 'recorded' check (status in ('recorded', 'void')),
  reference text check (reference is null or length(btrim(reference)) between 1 and 120),
  foreign key (organization_id, project_id) references public.projects(organization_id, id) on delete restrict,
  created_by uuid references public.profiles(id) on delete restrict default auth.uid(),
  updated_by uuid references public.profiles(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create index expenses_organization_created_idx on public.expenses(organization_id, created_at desc);
create index expenses_project_id_idx on public.expenses(organization_id, project_id);

create unique index clients_document_idx on public.clients(organization_id, document_type, document_number)
where document_number is not null;
create index invoices_due_idx on public.invoices(organization_id, due_on) where status = 'issued';
create unique index payments_reference_idx on public.payments(organization_id, reference) where reference is not null;

-- Auditar autor y marcas de tiempo, sin permitir reasignar un registro a otra empresa.
create function private.stamp_business_record() returns trigger
language plpgsql set search_path = '' as $$
begin
  if TG_OP = 'UPDATE' then
    if new.id is distinct from old.id or new.organization_id is distinct from old.organization_id then
      raise exception 'Record identity and organization are immutable' using errcode = '23514';
    end if;
    new.created_at := old.created_at;
    new.created_by := old.created_by;
  else
    new.created_at := statement_timestamp();
    new.created_by := auth.uid();
  end if;
  new.updated_at := statement_timestamp();
  new.updated_by := auth.uid();
  return new;
end;
$$;
revoke all on function private.stamp_business_record() from public, anon, authenticated;

create function private.stamp_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.id is distinct from old.id then
    raise exception 'Record identity is immutable' using errcode = '23514';
  end if;
  new.created_at := old.created_at;
  new.updated_at := statement_timestamp();
  return new;
end;
$$;
revoke all on function private.stamp_updated_at() from public, anon, authenticated;
create trigger organizations_stamp before update on public.organizations
for each row execute function private.stamp_updated_at();
create trigger profiles_stamp before update on public.profiles
for each row execute function private.stamp_updated_at();

create trigger clients_stamp before insert or update on public.clients
for each row execute function private.stamp_business_record();
create trigger contacts_stamp before insert or update on public.contacts
for each row execute function private.stamp_business_record();
create trigger opportunities_stamp before insert or update on public.opportunities
for each row execute function private.stamp_business_record();
create trigger quotes_stamp before insert or update on public.quotes
for each row execute function private.stamp_business_record();
create trigger contracts_stamp before insert or update on public.contracts
for each row execute function private.stamp_business_record();
create trigger projects_stamp before insert or update on public.projects
for each row execute function private.stamp_business_record();
create trigger invoices_stamp before insert or update on public.invoices
for each row execute function private.stamp_business_record();
create trigger payments_stamp before insert or update on public.payments
for each row execute function private.stamp_business_record();
create trigger expenses_stamp before insert or update on public.expenses
for each row execute function private.stamp_business_record();

-- Cerrar acceso antes del COMMIT inicial: si falla la segunda migración,
-- ninguna tabla hereda permisos públicos de los defaults de Supabase.
alter table public.organizations enable row level security;
alter table public.organizations force row level security;
revoke all on table public.organizations from public, anon, authenticated;
alter table public.profiles enable row level security;
alter table public.profiles force row level security;
revoke all on table public.profiles from public, anon, authenticated;
alter table public.roles enable row level security;
alter table public.roles force row level security;
revoke all on table public.roles from public, anon, authenticated;
alter table public.organization_memberships enable row level security;
alter table public.organization_memberships force row level security;
revoke all on table public.organization_memberships from public, anon, authenticated;
alter table public.clients enable row level security;
alter table public.clients force row level security;
revoke all on table public.clients from public, anon, authenticated;
alter table public.contacts enable row level security;
alter table public.contacts force row level security;
revoke all on table public.contacts from public, anon, authenticated;
alter table public.opportunities enable row level security;
alter table public.opportunities force row level security;
revoke all on table public.opportunities from public, anon, authenticated;
alter table public.quotes enable row level security;
alter table public.quotes force row level security;
revoke all on table public.quotes from public, anon, authenticated;
alter table public.contracts enable row level security;
alter table public.contracts force row level security;
revoke all on table public.contracts from public, anon, authenticated;
alter table public.projects enable row level security;
alter table public.projects force row level security;
revoke all on table public.projects from public, anon, authenticated;
alter table public.invoices enable row level security;
alter table public.invoices force row level security;
revoke all on table public.invoices from public, anon, authenticated;
alter table public.payments enable row level security;
alter table public.payments force row level security;
revoke all on table public.payments from public, anon, authenticated;
alter table public.expenses enable row level security;
alter table public.expenses force row level security;
revoke all on table public.expenses from public, anon, authenticated;

commit;
