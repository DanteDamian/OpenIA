# CRM Propuestas

Módulo adicional de AIGENTERRA Finance AI. No sustituye Clientes, Convocatorias, Cotizaciones ni ninguna otra sección existente.

## Alcance

- Ruta `/propuestas` dentro del espacio de trabajo y navegación existente.
- Relación obligatoria con `clients` y opcional con `calls_for_proposals` y `opportunities` de la misma organización.
- Código y número de versión únicos por organización.
- Plantilla corporativa AIGENTERRA con 14 secciones editables: carta, resumen, objetivos, alcance, metodología, entregables, cronograma, equipo, riesgos, responsabilidades y exclusiones, oferta económica, condiciones comerciales, garantías y aceptación.
- Presupuesto calculado con aritmética decimal determinista. Los totales almacenados son columnas generadas por PostgreSQL; la UI usa enteros en centavos y no `Number` de JavaScript.
- Estados de borrador, revisión, aprobación interna, envío, aceptación y vencimiento. Solo `admin` decide la aprobación; `admin` y `manager` editan.
- Snapshot inmutable al decidir una aprobación y clonación explícita para nuevas versiones.
- DOCX y PDF generados en el servidor con la paleta `#12233D`, `#0D8C87`, `#4AC5B5`, blanco y gris.
- Documentos guardados en el bucket privado `proposal-documents`; la ruta comienza con el UUID de la organización y Storage aplica RLS.

## IA segura

`POST /api/proposals/[id]/ai` usa el servicio de servidor únicamente cuando `OPENAI_ENABLED=true` y existe `OPENAI_API_KEY`. La respuesta usa Structured Outputs con JSON Schema estricto. El prompt prohíbe inventar cifras, fechas, NIT, impuestos, condiciones, garantías, equipo o compromisos; los faltantes se marcan `[POR DEFINIR]`. La sugerencia nunca se guarda sin acción del usuario.

No se incluyen identidad ni cláusulas internas de Procalculo. La plantilla tampoco presupone NIT ni tratamiento tributario de AIGENTERRA.

## Base de datos y seguridad

La migración `20261106143934_crm_propuestas.sql` crea siete tablas aisladas y amplía la matriz de permisos con el recurso `proposals`. Todas las tablas tienen RLS forzada, FKs compuestas por `organization_id`, privilegios mínimos y auditoría de autor/fecha. No usa `service_role` en la aplicación.

La migración debe validarse primero en una rama de Supabase y conectarse solo al entorno Preview de Vercel. No aplicar en producción ni mezclar la PR antes de aceptación funcional.

## Verificación

```sh
npm run lint
npm run typecheck
npm test
npm run test:db
npm run build
```

Pruebas manuales mínimas en Preview:

1. Iniciar sesión como `manager`, crear una propuesta y comprobar que solo aparecen Clientes y Convocatorias de la organización.
2. Editar las 14 secciones y agregar conceptos con decimales; comparar subtotal y total.
3. Solicitar aprobación y confirmar que un `manager` no puede aprobar, pero un `admin` sí.
4. Descargar DOCX/PDF y comprobar que se registre el archivo en el bucket privado.
5. Crear una nueva versión y comprobar que la anterior no cambia.
6. Entrar con otra organización o rol `viewer` y confirmar aislamiento/solo lectura.

