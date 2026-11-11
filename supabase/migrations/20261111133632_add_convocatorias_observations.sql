-- Migration is strictly additive; existing calls and permissions remain unchanged.
begin;
alter table public.calls_for_proposals
  add column if not exists observations text;
alter table public.calls_for_proposals
  add constraint calls_for_proposals_observations_length
  check (observations is null or char_length(observations) <= 4000);
comment on column public.calls_for_proposals.observations is 'Observaciones / Seguimiento: notas comerciales y avances de la convocatoria.';
commit;
