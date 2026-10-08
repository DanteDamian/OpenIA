export const modules = [
  {slug:"clientes",name:"Clientes",icon:"◎",description:"Clientes, identificación y contactos."},
  {slug:"oportunidades",name:"Oportunidades",icon:"◇",description:"Seguimiento comercial y cierre esperado."},
  {slug:"proyectos",name:"Proyectos",icon:"▧",description:"Presupuestos, relaciones y seguimiento de servicios."},
  {slug:"actividades",name:"Actividades y entregables",icon:"☑",description:"Actividades, hitos, entregables y responsables de proyectos."},
  {slug:"cotizaciones",name:"Cotizaciones",icon:"◇",description:"Propuestas, importes y aprobación comercial."},
  {slug:"contratos",name:"Contratos",icon:"▤",description:"Acuerdos, fechas y valores contractuales."},
  {slug:"gastos",name:"Gastos",icon:"↗",description:"Egresos reales vinculados a proyectos."},
  {slug:"tesoreria",name:"Tesorería",icon:"▥",description:"Ingresos y salidas efectivos, sin emisión de facturas."},
  {slug:"inteligencia-artificial",name:"Inteligencia Artificial",icon:"✧",description:"Consultas autorizadas, análisis y alertas operativas."},
] as const;
export function getModule(slug:string) { return modules.find(item=>item.slug === slug); }
