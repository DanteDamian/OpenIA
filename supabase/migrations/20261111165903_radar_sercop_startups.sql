begin;
alter table public.radar_sources drop constraint if exists radar_sources_query_method_check;
alter table public.radar_sources add constraint radar_sources_query_method_check
 check (query_method in ('manual','socrata','pncp','ted','sercop'));
update public.radar_sources
 set query_method='sercop', enabled=true, frequency='daily', technical_status='pending'
 where official_url='https://portal.compraspublicas.gob.ec/' and query_method='manual';
insert into public.radar_sources (organization_id,name,country,category,official_url,query_method,enabled,frequency)
select distinct organization_id,'iNNpulsa Colombia — Convocatorias','Colombia','Emprendimiento e innovación',
 'https://convocatorias.innpulsacolombia.com/','manual',false,'daily'
from public.radar_sources
on conflict (organization_id,official_url) do nothing;
commit;
