-- Add source scheduling preference without changing existing source IDs, URLs, evidence, or opportunities.
begin;
alter table public.radar_sources
  add column if not exists frequency text not null default 'manual';
alter table public.radar_sources
  add constraint radar_sources_frequency_enum
  check (frequency in ('daily','weekly','manual'));
update public.radar_sources set frequency='daily'
 where query_method='socrata' and frequency='manual'
 and official_url='https://www.datos.gov.co/Estad-sticas-Nacionales/SECOP-II-Procesos-de-Contrataci-n/p6dx-8zbt';
comment on column public.radar_sources.frequency is
 'Preferred polling cadence; actual scheduling is handled separately by the radar runner.';
commit;
