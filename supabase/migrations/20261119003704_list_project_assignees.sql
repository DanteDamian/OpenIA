begin;
create or replace function public.list_project_assignees(target_organization uuid)
returns table(user_id uuid,display_name text)
language sql stable security definer
set search_path = ''
as $$
 select m.user_id,coalesce(nullif(btrim(p.display_name),''),'Usuario '||left(m.user_id::text,8)) as display_name
 from public.organization_memberships m
 left join public.profiles p on p.id=m.user_id
 where m.organization_id=target_organization
   and m.is_active=true
   and auth.uid() is not null
   and exists (
     select 1 from public.organization_memberships requester
     where requester.organization_id=target_organization
       and requester.user_id=auth.uid() and requester.is_active=true
   )
 order by display_name,m.user_id
$$;
revoke all on function public.list_project_assignees(uuid) from public,anon;
grant execute on function public.list_project_assignees(uuid) to authenticated;
comment on function public.list_project_assignees(uuid)
 is 'Lists only active same-organization assignees for authenticated members, without revealing emails.';
commit;