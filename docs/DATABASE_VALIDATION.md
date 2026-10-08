# Verificación de la base de datos v1

## Ejecutado en esta entrega

| Comprobación | Resultado |
| --- | --- |
| `npm run test:db` | Aprobado en PostgreSQL 17 efímero; ambas migraciones aplicadas en orden |
| Primera migración sin políticas | 13 tablas cerradas para anon y authenticated, incluso con defaults amplios |
| Integridad SQL | PK, FK validadas, empresa en relaciones compuestas, índices de FK, precisión decimal, totales generados, restricciones de descuento/importe/fechas y triggers verificados |
| Seguridad SQL | RLS forzado, 37 políticas, grants mínimos, helpers privados con search_path fijo y 176 combinaciones de rol/recurso/operación verificadas |
| Roles PostgreSQL reales | SELECT anónimo rechazado; sesión authenticated sin membresía no ve datos empresariales; INSERT sin membresía y cambios del catálogo de roles rechazados |
| Escalamiento con metadata | Claims con metadata admin no conceden permisos sin membresía; no se crea usuario Auth |
| `npm test` | 8 pruebas de aplicación aprobadas, 2 archivos |
| `npm run lint` | Aprobado |
| `npm run typecheck` | Aprobado |
| `npm run build` | Aprobado |
| Bash y TOML | Script sin errores de sintaxis; config TOML válido; private excluido y seeds deshabilitados |

La validación SQL se repitió tras incorporar la protección al final de la primera migración. Cada ejecución comenzó con una base nueva y eliminó su contenedor al terminar. Solo persistió el catálogo de roles dentro del contenedor; no hubo usuarios, empresas, clientes ni movimientos financieros de ejemplo. Las restricciones monetarias se ejercitaron evaluando sus expresiones CHECK con escalares, sin insertar datos financieros.

## Límites de la evidencia

El bootstrap emula el contrato SQL de Auth, no su servicio HTTP. Las pruebas de FK entre empresas inspeccionan restricciones activas y validadas; no crean personas o empresas de ejemplo. La matriz de roles se comprueba como función pura. Al estar prohibida la creación de usuarios ficticios, no se ejecutó una prueba de acceso positivo/negativo con dos usuarios Auth y filas empresariales reales.

La integración completa Supabase Auth/PostgREST, altas legítimas y autorización multiempresa debe validarse en staging con identidades reales autorizadas antes de usar información real. La interfaz aún no integra login ni CRUD. No se realizaron operaciones sobre bases remotas ni producción.
