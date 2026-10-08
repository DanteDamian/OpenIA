-- AIGENTERRA: permisos explícitos y aislamiento por empresa.
begin;

-- Matriz pura: comprobable sin crear usuarios ni registros financieros.
create function private.role_allows(member_role text, resource text, operation text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(
    member_role in ('admin', 'manager', 'accountant', 'viewer')
    and resource in ('organizations', 'memberships', 'clients', 'contacts', 'opportunities',
                     'quotes', 'contracts', 'projects', 'invoices', 'payments', 'expenses')
    and (
      operation = 'read'
      or (operation = 'write' and resource <> 'memberships' and (
        member_role = 'admin'
        or (member_role = 'manager' and resource in ('clients', 'contacts', 'opportunities', 'quotes', 'contracts', 'projects'))
        or (member_role = 'accountant' and resource in ('invoices', 'payments', 'expenses'))
      ))
      or (operation = 'delete' and resource in ('clients', 'contacts', 'opportunities', 'projects')
          and member_role in ('admin', 'manager'))
    ), false);
$$;
revoke all on function private.role_allows(text, text, text) from public, anon, authenticated;

-- Función no expuesta por PostgREST. Solo lee membresías; ignora user_metadata.
-- El propietario de migraciones debe tener BYPASSRLS (postgres en Supabase).
create function private.has_permission(target_organization uuid, resource text, operation text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_memberships m
    where m.organization_id = target_organization
      and m.user_id = (select auth.uid())
      and private.role_allows(m.role_id, resource, operation)
  );
$$;
revoke all on function private.has_permission(uuid, text, text) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.has_permission(uuid, text, text) to authenticated;

alter table public.organizations enable row level security;
alter table public.organizations force row level security;
revoke all on table public.organizations from public, anon, authenticated;
grant all on table public.organizations to service_role;
alter table public.profiles enable row level security;
alter table public.profiles force row level security;
revoke all on table public.profiles from public, anon, authenticated;
grant all on table public.profiles to service_role;
alter table public.roles enable row level security;
alter table public.roles force row level security;
revoke all on table public.roles from public, anon, authenticated;
grant all on table public.roles to service_role;
alter table public.organization_memberships enable row level security;
alter table public.organization_memberships force row level security;
revoke all on table public.organization_memberships from public, anon, authenticated;
grant all on table public.organization_memberships to service_role;
alter table public.clients enable row level security;
alter table public.clients force row level security;
revoke all on table public.clients from public, anon, authenticated;
grant all on table public.clients to service_role;
alter table public.contacts enable row level security;
alter table public.contacts force row level security;
revoke all on table public.contacts from public, anon, authenticated;
grant all on table public.contacts to service_role;
alter table public.opportunities enable row level security;
alter table public.opportunities force row level security;
revoke all on table public.opportunities from public, anon, authenticated;
grant all on table public.opportunities to service_role;
alter table public.quotes enable row level security;
alter table public.quotes force row level security;
revoke all on table public.quotes from public, anon, authenticated;
grant all on table public.quotes to service_role;
alter table public.contracts enable row level security;
alter table public.contracts force row level security;
revoke all on table public.contracts from public, anon, authenticated;
grant all on table public.contracts to service_role;
alter table public.projects enable row level security;
alter table public.projects force row level security;
revoke all on table public.projects from public, anon, authenticated;
grant all on table public.projects to service_role;
alter table public.invoices enable row level security;
alter table public.invoices force row level security;
revoke all on table public.invoices from public, anon, authenticated;
grant all on table public.invoices to service_role;
alter table public.payments enable row level security;
alter table public.payments force row level security;
revoke all on table public.payments from public, anon, authenticated;
grant all on table public.payments to service_role;
alter table public.expenses enable row level security;
alter table public.expenses force row level security;
revoke all on table public.expenses from public, anon, authenticated;
grant all on table public.expenses to service_role;

grant select on public.organizations, public.profiles, public.roles, public.organization_memberships to authenticated;
grant update (name) on public.organizations to authenticated;
grant update (display_name) on public.profiles to authenticated;

create policy organizations_read on public.organizations for select to authenticated
using (private.has_permission(id, 'organizations', 'read'));
create policy organizations_update on public.organizations for update to authenticated
using (private.has_permission(id, 'organizations', 'write'))
with check (private.has_permission(id, 'organizations', 'write'));
create policy profiles_read_self on public.profiles for select to authenticated
using (id = (select auth.uid()));
create policy profiles_update_self on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy roles_read on public.roles for select to authenticated using (true);
create policy memberships_read on public.organization_memberships for select to authenticated
using (private.has_permission(organization_id, 'memberships', 'read'));
-- No permisos de escritura a membresías/roles: alta y cambios solo por backend confiable.

grant select, insert, update on public.clients to authenticated;
create policy clients_read on public.clients for select to authenticated
using (private.has_permission(organization_id, 'clients', 'read'));
create policy clients_insert on public.clients for insert to authenticated
with check (private.has_permission(organization_id, 'clients', 'write'));
create policy clients_update on public.clients for update to authenticated
using (private.has_permission(organization_id, 'clients', 'write'))
with check (private.has_permission(organization_id, 'clients', 'write'));
grant delete on public.clients to authenticated;
create policy clients_delete on public.clients for delete to authenticated
using (private.has_permission(organization_id, 'clients', 'delete'));

grant select, insert, update on public.contacts to authenticated;
create policy contacts_read on public.contacts for select to authenticated
using (private.has_permission(organization_id, 'contacts', 'read'));
create policy contacts_insert on public.contacts for insert to authenticated
with check (private.has_permission(organization_id, 'contacts', 'write'));
create policy contacts_update on public.contacts for update to authenticated
using (private.has_permission(organization_id, 'contacts', 'write'))
with check (private.has_permission(organization_id, 'contacts', 'write'));
grant delete on public.contacts to authenticated;
create policy contacts_delete on public.contacts for delete to authenticated
using (private.has_permission(organization_id, 'contacts', 'delete'));

grant select, insert, update on public.opportunities to authenticated;
create policy opportunities_read on public.opportunities for select to authenticated
using (private.has_permission(organization_id, 'opportunities', 'read'));
create policy opportunities_insert on public.opportunities for insert to authenticated
with check (private.has_permission(organization_id, 'opportunities', 'write'));
create policy opportunities_update on public.opportunities for update to authenticated
using (private.has_permission(organization_id, 'opportunities', 'write'))
with check (private.has_permission(organization_id, 'opportunities', 'write'));
grant delete on public.opportunities to authenticated;
create policy opportunities_delete on public.opportunities for delete to authenticated
using (private.has_permission(organization_id, 'opportunities', 'delete'));

grant select, insert, update on public.quotes to authenticated;
create policy quotes_read on public.quotes for select to authenticated
using (private.has_permission(organization_id, 'quotes', 'read'));
create policy quotes_insert on public.quotes for insert to authenticated
with check (private.has_permission(organization_id, 'quotes', 'write'));
create policy quotes_update on public.quotes for update to authenticated
using (private.has_permission(organization_id, 'quotes', 'write'))
with check (private.has_permission(organization_id, 'quotes', 'write'));

grant select, insert, update on public.contracts to authenticated;
create policy contracts_read on public.contracts for select to authenticated
using (private.has_permission(organization_id, 'contracts', 'read'));
create policy contracts_insert on public.contracts for insert to authenticated
with check (private.has_permission(organization_id, 'contracts', 'write'));
create policy contracts_update on public.contracts for update to authenticated
using (private.has_permission(organization_id, 'contracts', 'write'))
with check (private.has_permission(organization_id, 'contracts', 'write'));

grant select, insert, update on public.projects to authenticated;
create policy projects_read on public.projects for select to authenticated
using (private.has_permission(organization_id, 'projects', 'read'));
create policy projects_insert on public.projects for insert to authenticated
with check (private.has_permission(organization_id, 'projects', 'write'));
create policy projects_update on public.projects for update to authenticated
using (private.has_permission(organization_id, 'projects', 'write'))
with check (private.has_permission(organization_id, 'projects', 'write'));
grant delete on public.projects to authenticated;
create policy projects_delete on public.projects for delete to authenticated
using (private.has_permission(organization_id, 'projects', 'delete'));

grant select, insert, update on public.invoices to authenticated;
create policy invoices_read on public.invoices for select to authenticated
using (private.has_permission(organization_id, 'invoices', 'read'));
create policy invoices_insert on public.invoices for insert to authenticated
with check (private.has_permission(organization_id, 'invoices', 'write'));
create policy invoices_update on public.invoices for update to authenticated
using (private.has_permission(organization_id, 'invoices', 'write'))
with check (private.has_permission(organization_id, 'invoices', 'write'));

grant select, insert, update on public.payments to authenticated;
create policy payments_read on public.payments for select to authenticated
using (private.has_permission(organization_id, 'payments', 'read'));
create policy payments_insert on public.payments for insert to authenticated
with check (private.has_permission(organization_id, 'payments', 'write'));
create policy payments_update on public.payments for update to authenticated
using (private.has_permission(organization_id, 'payments', 'write'))
with check (private.has_permission(organization_id, 'payments', 'write'));

grant select, insert, update on public.expenses to authenticated;
create policy expenses_read on public.expenses for select to authenticated
using (private.has_permission(organization_id, 'expenses', 'read'));
create policy expenses_insert on public.expenses for insert to authenticated
with check (private.has_permission(organization_id, 'expenses', 'write'));
create policy expenses_update on public.expenses for update to authenticated
using (private.has_permission(organization_id, 'expenses', 'write'))
with check (private.has_permission(organization_id, 'expenses', 'write'));

commit;
