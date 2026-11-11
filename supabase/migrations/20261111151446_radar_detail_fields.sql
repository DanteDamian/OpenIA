-- Optional source-provided SECOP process details, preserving all existing rows.
begin;
alter table public.radar_opportunities
  add column if not exists duration_value integer,
  add column if not exists duration_unit text;
alter table public.radar_opportunities
  add constraint radar_duration_value_positive
  check (duration_value is null or duration_value > 0);
alter table public.radar_opportunities
  add constraint radar_duration_unit_length
  check (duration_unit is null or char_length(duration_unit) <= 60);
comment on column public.radar_opportunities.budget is 'Presupuesto base estimado reportado por la fuente, no remuneración ni valor adjudicado.';
comment on column public.radar_opportunities.duration_value is 'Duración estimada del proceso o contrato declarada por la fuente; puede diferir de vigencia contractual.';
commit;
