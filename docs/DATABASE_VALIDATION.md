# Verificación del modelo y acceso autenticado — PR #2

| Comprobación | Resultado ejecutado localmente |
| --- | --- |
| `npm run test:db` | Tres migraciones aplicadas en PostgreSQL 17 efímero; integridad, grants, RLS y matriz de 176 combinaciones aprobadas |
| `npm run test:integration` | 87 comprobaciones aprobadas con Supabase Auth GoTrue 2.196.0, PostgREST 14.17 y Next.js reales locales; migraciones como postgres NOSUPERUSER + BYPASSRLS |
| Controles de staging | Preflight y postflight de solo lectura aprobados localmente; preflight rechaza un operador cliente y colisiones después de aplicar el modelo |
| Aprovisionamiento | AIGENTERRA local registrada con administrador confirmado; repetición idempotente y auditoría única; IDs vacíos, duplicados, inexistentes, no confirmados y aprobaciones nuevas rechazados |
| Privilegios | Invocaciones de bootstrap como authenticated/service_role denegadas; RPC privadas no expuestas; resolver de permisos SECURITY INVOKER |
| Identidad | Password grant, perfil por trigger, renovación de tokens, rechazo de JWT falsificados/expirados y metadata sin elevación |
| Organización y roles | Lectura por miembros, edición CRM admin/manager, bloqueo de viewer/accountant, ocultamiento entre empresas, FK cruzada rechazada y membresías solo propias |
| Next.js | Login, cookies HttpOnly, workspace protegido, API con empresa autorizada, renovación de cookies desde proxy, cookie inválida, CSRF, asignación masiva y logout verificados |
| `npm test` | 15 pruebas unitarias aprobadas en 3 archivos |
| `npm run lint` | Aprobado |
| `npm run typecheck` | Aprobado |
| `npm run build` | Compilación y TypeScript aprobados con configuración Supabase vacía |

`test:db` usa el contrato SQL mínimo de Auth sin usuarios ni datos de negocio. `test:integration` usa el servicio Auth real para crear identidades efímeras `example.invalid`, organizaciones y clientes no financieros, con autorización del usuario. Claves y contraseñas se generan en tiempo de ejecución y no se incorporan al repositorio. Cada ejecución elimina sus contenedores, red, procesos y archivos temporales.

No se insertaron cotizaciones, contratos, facturas, pagos ni gastos. Los CHECK monetarios se prueban con expresiones escalares, sin movimientos financieros almacenados. El único catálogo insertado por migraciones es el de roles.

## Alcance y límites

La matriz SQL cubre todos los roles y recursos; los casos con filas reales locales de PostgREST cubren CRM, perfiles y membresías, sin fabricar registros financieros. El runner prueba HTTP de Next.js, no un navegador visual ni MFA.

El montaje local incluye el helper estándar auth.uid y las rutas Supabase de Auth/PostgREST; no representa todos los servicios gestionados de Supabase. El proyecto remoto puede tener otra configuración de Auth, redirects, límites de intentos y secretos. Su validación en staging queda pendiente y no se sustituye por estos resultados.

Las tres migraciones se aplicaron en orden con un operador no superusuario, propietario de la base y BYPASSRLS, con USAGE sobre auth y SELECT/REFERENCES/TRIGGER sobre auth.users. Esto evita que el superusuario de la imagen PostgreSQL estándar oculte permisos faltantes. No se certifica la distribución gestionada: descargar la imagen oficial Supabase PostgreSQL 17 falló por falta de espacio en Docker. No se ejecutó esa imagen. El proyecto real debe pasar los controles SQL y HTTP de [STAGING_RUNBOOK.md](STAGING_RUNBOOK.md).

Se verificó el checksum oficial del binario Supabase CLI 2.75.0 y sus flags `link`, `db push --linked --dry-run` mediante ayuda local. No se inició sesión, vinculó ni aplicó SQL a un proyecto remoto.

No se aplicaron migraciones remotas, no se usaron credenciales reales, no se modificó producción y no se hizo merge.
