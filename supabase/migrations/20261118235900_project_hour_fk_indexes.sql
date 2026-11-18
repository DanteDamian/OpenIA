-- Covers composite FK and user audit lookup indexes for hour tracking.
begin;
create index if not exists project_time_work_item_fk_idx on public.project_time_entries(organization_id,work_item_id);
create index if not exists project_time_act_fk_idx on public.project_time_entries(organization_id,act_id);
create index if not exists project_time_author_fk_idx on public.project_time_entries(created_by);
create index if not exists project_time_approver_fk_idx on public.project_time_entries(approved_by);
create index if not exists project_hour_act_prepared_fk_idx on public.project_hour_acts(prepared_by);
commit;