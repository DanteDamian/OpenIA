// Reference-only sources drawn from the supplied Directorio_Fuentes workbook.
export const sourceSeeds = [
 {name:"SECOP II - Datos Abiertos (procesos)",country:"Colombia",category:"Contratación",official_url:"https://www.datos.gov.co/Estad-sticas-Nacionales/SECOP-II-Procesos-de-Contrataci-n/p6dx-8zbt",query_method:"socrata",enabled:true},
 {name:"SECOP I",country:"Colombia",category:"Contratación",official_url:"https://www.colombiacompra.gov.co/secop/secop-i",query_method:"manual",enabled:false},
 {name:"SECOP II",country:"Colombia",category:"Contratación",official_url:"https://www.colombiacompra.gov.co/secop/secop-ii",query_method:"manual",enabled:false},
 {name:"TVEC",country:"Colombia",category:"Contratación",official_url:"https://www.colombiacompra.gov.co/secop/tvec",query_method:"manual",enabled:false},
 {name:"Minciencias Convocatorias",country:"Colombia",category:"Innovación",official_url:"https://minciencias.gov.co/convocatorias/todas",query_method:"manual",enabled:false},
 {name:"IDEAM Contratación",country:"Colombia",category:"Contratación",official_url:"https://www.ideam.gov.co/transparencia/contratacion",query_method:"manual",enabled:false},
 {name:"SERCOP",country:"Ecuador",category:"Contratación",official_url:"https://portal.compraspublicas.gob.ec/",query_method:"manual",enabled:false},
 {name:"SERCOP búsqueda",country:"Ecuador",category:"Contratación",official_url:"https://www.compraspublicas.gob.ec/ProcesoContratacion/compras/PC/buscarProceso.cpe?sg=1",query_method:"manual",enabled:false},
 {name:"SENESCYT convocatorias",country:"Ecuador",category:"Innovación",official_url:"https://siau.senescyt.gob.ec/convocatorias",query_method:"manual",enabled:false},
 {name:"PanamaCompra",country:"Panamá",category:"Contratación",official_url:"https://www.panamacompra.gob.pa/",query_method:"manual",enabled:false},
 {name:"SENACYT Open Calls",country:"Panamá",category:"Innovación",official_url:"https://www.senacyt.gob.pa/en/open-calls/",query_method:"manual",enabled:false},
 {name:"MiAmbiente avisos",country:"Panamá",category:"Ambiental",official_url:"https://miambiente.gob.pa/avisos/",query_method:"manual",enabled:false},
 {name:"UNGM",country:"Internacional",category:"Multilateral",official_url:"https://www.ungm.org/public/notice",query_method:"manual",enabled:false},
 {name:"UNDP Procurement",country:"Internacional",category:"Multilateral",official_url:"https://procurement-notices.undp.org/",query_method:"manual",enabled:false},
 {name:"World Bank Procurement",country:"Internacional",category:"Multilateral",official_url:"https://projects.worldbank.org/en/projects-operations/procurement",query_method:"manual",enabled:false},
 {name:"IDB Procurement",country:"Internacional",category:"Multilateral",official_url:"https://www.iadb.org/en/how-we-can-work-together/procurement",query_method:"manual",enabled:false},
 {name:"CAF Calls",country:"Internacional",category:"Multilateral",official_url:"https://www.caf.com/en/work-with-us/calls/",query_method:"manual",enabled:false},

 {name:"PNCP Brasil — Contratações abertas",country:"Brasil",category:"Contratación",official_url:"https://pncp.gov.br/app/editais",query_method:"pncp",enabled:true},
 {name:"TED — Licitaciones UE",country:"Unión Europea",category:"Contratación",official_url:"https://ted.europa.eu/es/",query_method:"ted",enabled:true},
 {name:"Funding & Tenders — Unión Europea",country:"Unión Europea",category:"Innovación",official_url:"https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/home",query_method:"manual",enabled:false},
 {name:"PLACSP — España",country:"España",category:"Contratación",official_url:"https://contrataciondelestado.es/",query_method:"manual",enabled:false},
 {name:"Mercado Público — Chile",country:"Chile",category:"Contratación",official_url:"https://www.mercadopublico.cl/",query_method:"manual",enabled:false},
 {name:"SEACE — Perú",country:"Perú",category:"Contratación",official_url:"https://www.gob.pe/osce",query_method:"manual",enabled:false},
 {name:"ARCE — Uruguay",country:"Uruguay",category:"Contratación",official_url:"https://www.comprasestatales.gub.uy/",query_method:"manual",enabled:false},
 {name:"COMPR.AR — Argentina",country:"Argentina",category:"Contratación",official_url:"https://comprar.gob.ar/",query_method:"manual",enabled:false},
 {name:"SICOP — Costa Rica",country:"Costa Rica",category:"Contratación",official_url:"https://www.sicop.go.cr/",query_method:"manual",enabled:false},
] as const;
export const aigenterraServices = [
 "GeoAI e inteligencia artificial geoespacial","Sistemas de información geográfica",
 "Analítica de imágenes satelitales","Detección de cambios y coberturas",
 "Monitoreo ambiental","Riesgo y vulnerabilidad",
 "Automatización y plataformas SaaS","Dashboards e inteligencia territorial",
 "Integración y procesamiento de datos geoespaciales"
] as const;
// Matching is conservative: it detects relevant topics, never asserts eligibility.
export const topicPattern = /geoespacial|geospatial|geográfica|geographic information|información geográfica|\bgis\b|\bsig\b|cartograf|sat[eé]lit|satellite|teledete|remote sensing|im[aá]gen|ambiental|cobertura|deforest|inteligencia artificial|machine learning|geoai|\bsaas\b|tablero|dashboard|riesgo|vulnerabil|an[aá]lisis espacial/i;
