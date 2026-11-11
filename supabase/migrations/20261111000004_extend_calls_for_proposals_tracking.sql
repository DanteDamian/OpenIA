-- Seguimiento comercial opcional para Convocatorias.
-- Todas las columnas son nullable para conservar sin cambios los registros existentes.
begin;

alter table public.calls_for_proposals
  add column link text,
  add column presentation_date date,
  add column status text,
  add column responsible text,
  add constraint calls_for_proposals_link_length
    check (link is null or length(btrim(link)) between 1 and 2048),
  add constraint calls_for_proposals_status_domain
    check (status is null or status in ('Sin iniciar','En proceso','terminado','vencido')),
  add constraint calls_for_proposals_responsible_domain
    check (responsible is null or responsible in ('Daniel Bula','Martha Valbuena'));

comment on column public.calls_for_proposals.link is 'Enlace de referencia de la convocatoria.';
comment on column public.calls_for_proposals.presentation_date is 'Fecha prevista o real de presentación.';
comment on column public.calls_for_proposals.status is 'Estado de seguimiento comercial.';
comment on column public.calls_for_proposals.responsible is 'Responsable interno de la convocatoria.';

commit;
