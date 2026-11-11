begin;
alter table public.radar_sources drop constraint if exists radar_sources_query_method_check;
alter table public.radar_sources add constraint radar_sources_query_method_check
 check (query_method in ('manual','socrata','pncp','ted'));
insert into public.radar_sources(organization_id,name,country,category,official_url,query_method,frequency,enabled,technical_status)
select distinct organization_id,'PNCP Brasil — Contratações abertas','Brasil','Contratación',
 'https://pncp.gov.br/app/editais','pncp','daily',true,'pending'
from public.radar_sources
on conflict (organization_id,official_url) do nothing;
insert into public.radar_sources(organization_id,name,country,category,official_url,query_method,frequency,enabled,technical_status)
select org.organization_id,src.name,src.country,src.category,src.url,'manual','daily',false,'pending'
from (select distinct organization_id from public.radar_sources) org
cross join (values
 
 ('Funding & Tenders — Unión Europea','Unión Europea','Innovación','https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/home'),
 ('PLACSP — España','España','Contratación','https://contrataciondelestado.es/'),
 ('Mercado Público — Chile','Chile','Contratación','https://www.mercadopublico.cl/'),
 ('SEACE — Perú','Perú','Contratación','https://www.gob.pe/osce'),
 ('ARCE — Uruguay','Uruguay','Contratación','https://www.comprasestatales.gub.uy/'),
 ('COMPR.AR — Argentina','Argentina','Contratación','https://comprar.gob.ar/'),
 ('SICOP — Costa Rica','Costa Rica','Contratación','https://www.sicop.go.cr/')
) src(name,country,category,url)
on conflict (organization_id,official_url) do nothing;
insert into public.radar_sources(organization_id,name,country,category,official_url,query_method,frequency,enabled,technical_status)
select distinct organization_id,'TED — Licitaciones UE','Unión Europea','Contratación','https://ted.europa.eu/es/','ted','daily',true,'pending'
from public.radar_sources
on conflict (organization_id,official_url) do nothing;
commit;