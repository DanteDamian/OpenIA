export const modules = [
  {
    slug: "clientes",
    name: "Clientes",
    icon: "◎",
    description:
      "Centraliza contactos, datos comerciales y relaciones con tus clientes.",
  },
  {
    slug: "proyectos",
    name: "Proyectos",
    icon: "▧",
    description:
      "Organiza entregables, responsables y el avance de cada servicio.",
  },
  {
    slug: "cotizaciones",
    name: "Cotizaciones",
    icon: "◇",
    description:
      "Prepara propuestas comerciales y da seguimiento a su aprobación.",
  },
  {
    slug: "contratos",
    name: "Contratos",
    icon: "▤",
    description: "Gestiona acuerdos, vigencias y documentos de tus servicios.",
  },
  {
    slug: "facturacion",
    name: "Facturación",
    icon: "▥",
    description: "Consulta la facturación cuando conectes tu fuente de datos.",
  },
  {
    slug: "gastos",
    name: "Gastos",
    icon: "↗",
    description:
      "Organiza egresos y soportes para mantener el control administrativo.",
  },
  {
    slug: "inteligencia-artificial",
    name: "Inteligencia Artificial",
    icon: "✧",
    description:
      "Un espacio para futuras herramientas de asistencia y análisis.",
  },
] as const;
export function getModule(slug: string) {
  return modules.find((item) => item.slug === slug);
}
