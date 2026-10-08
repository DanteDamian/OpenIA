# Aplicación autorizada del modelo en Supabase

## Destino y autorización

- Proyecto: `wafzklaioidpqqmbglff`, nombre `aigenterra-finance-ai`, región `us-west-2`.
- Estado de la API: `ACTIVE_HEALTHY`; PostgreSQL gestionado `17.11` (build `17.11.0.003`).
- SQL aprobado: PR #2, commit `be96f7e2991f44c95053dc0a4ca5efb67302e259`.
- El usuario autorizó aplicar las tres migraciones a este proyecto definitivo si no había conflictos. No se trata de un staging independiente.
- Acceso administrativo mediante `SUPABASE_ACCESS_TOKEN`, suministrado de forma segura a la API HTTPS de administración. No se guardó su valor ni ninguna clave en Git.

## Estado previo y revisión

La consulta inicial devolvió operador `postgres`, cero usuarios Auth, ninguna tabla en `public`, ausencia del esquema `private`, ausencia de `supabase_migrations.schema_migrations` e historial API vacío. El control `supabase/checks/staging-preflight.sql` pasó contra la base real: versión 17, BYPASSRLS del operador, roles cliente sin bypass, contrato Auth, privilegios y ausencia de colisiones.

Se revisaron las tres migraciones y sus dependencias. No contienen DROP TABLE, TRUNCATE ni DELETE de datos. La tercera elimina y recrea exclusivamente `memberships_read`, creada por la segunda, para sustituir el resolver SECURITY DEFINER por SECURITY INVOKER y permitir solo lectura de membresías propias. Los REVOKE cierran permisos de las nuevas entidades y CREATE en public a roles cliente. No se modifican configuraciones del servicio Auth; el trigger de perfil pertenece al modelo autorizado.

## Aplicación e historial

Se aplicaron **001 → 002 → 003** mediante `POST /v1/projects/{ref}/database/query`. Este endpoint de administración es experimental; su contrato se revisó en el OpenAPI oficial antes de usarlo. Se conservó cada transacción original y se añadió el registro del historial **antes de su COMMIT**, para confirmar SQL e historial conjuntamente. No se editaron los archivos de migración del PR.

El esquema de historial sigue el contrato publicado de [Supabase CLI 2.75.0](https://github.com/supabase/cli/blob/v2.75.0/pkg/migration/history.go): `supabase_migrations.schema_migrations(version text PRIMARY KEY, statements text[], name text)`. Se creó dentro de la primera transacción y se revocó acceso a PUBLIC/anon/authenticated/service_role. Cada entrada conserva el SQL original completo como un elemento de statements; no se borró ni reparó historial existente. No se utilizó el endpoint de creación automática de migraciones, que no permite especificar la versión original.

| Versión | Nombre | SHA-256 del SQL aplicado e histórico |
| --- | --- | --- |
| `20261008000100` | initial_data_model | `9eaa293c347a9130dc62fe4755f2cfaf885cf5b97485e14f165e6ce63157cefb` |
| `20261008000200` | access_policies | `3dbe6cc08ed77b5ac52a3ebcc373ba52bb2f651f243fcb0f6ede6a8c8a50b689` |
| `20261008000300` | secure_bootstrap | `d44bbc1cb1181402c546735ed1beac86af13d5610d0875ff7ed64de46b9b6aff` |

Después de cada COMMIT se consultó `GET /database/migrations`. Al finalizar, `GET /database/migrations/{version}` devolvió statements idénticos, byte por byte, a los tres archivos revisados. No hubo fallos de aplicación ni reintentos automáticos.

## Resultados contra Supabase real

El postflight pasó. Todas las tablas siguientes tienen RLS habilitada y forzada, propietario `postgres`, PK y constraints validadas:

| Tabla | Claves foráneas | Índices válidos, incluidos PK/UNIQUE | Políticas RLS |
| --- | ---: | ---: | ---: |
| clients | 3 | 4 | 4 |
| contacts | 4 | 5 | 4 |
| contracts | 5 | 7 | 3 |
| expenses | 4 | 4 | 3 |
| invoices | 6 | 8 | 3 |
| opportunities | 5 | 6 | 4 |
| organization_memberships | 3 | 3 | 1 |
| organizations | 0 | 2 | 2 |
| payments | 4 | 5 | 3 |
| profiles | 1 | 1 | 2 |
| projects | 5 | 6 | 4 |
| quotes | 5 | 7 | 3 |
| roles | 0 | 2 | 1 |
| **Total public** | **45** | **60** | **37** |

La tabla de auditoría de bootstrap adicional está en `private` y queda fuera de estos totales públicos. Se verificaron seis funciones privadas, search_path vacío, propiedad confiable, un único SECURITY DEFINER reservado al trigger de perfil, resolver/bootstrap SECURITY INVOKER y ausencia de ejecución cliente sobre funciones privilegiadas.

| Comprobación ejecutada | Resultado |
| --- | --- |
| Bloque de integridad SQL en transacción read only | 97 comprobaciones aprobadas: claves, relaciones compuestas por empresa, índices FK, precisión decimal, CHECK escalares, triggers y ausencia de datos |
| Bloque de catálogo de seguridad SQL en read only | 248 comprobaciones aprobadas, incluidas las 176 combinaciones de roles/recursos/operaciones, ACL y modos de funciones |
| SELECT como anon sobre clients | Denegado por permisos |
| SELECT como authenticated sin identidad/membresía | Sin filas en las 12 tablas de usuarios/empresa; resolver sin permiso de escritura |
| Auth real `GET /auth/v1/health` con clave publishable | HTTP 200 |
| PostgREST real `GET /rest/v1/clients?select=id&limit=1` sin sesión | HTTP 401; no acceso anónimo |
| Auth real `GET /auth/v1/user` sin sesión | HTTP 401 |
| `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` | Aprobados; 15 pruebas unitarias en tres archivos |

No se ejecutó la emulación `supabase/tests/bootstrap.sql` contra Supabase ni se enviaron los scripts de pruebas completos: se extrajeron únicamente los bloques de lectura de integridad/catálogo, una vez confirmado que la base estaba vacía. Las comprobaciones remotas no intentaron INSERT/UPDATE, no crearon identidades, organizaciones, clientes ni movimientos financieros. Solo se insertó el catálogo de cuatro roles y las tres entradas del historial como parte de las migraciones. Las comprobaciones de integridad confirmaron que Auth y todas las tablas de usuarios/negocio permanecían vacías. `private.bootstrap_aigenterra` se instaló pero **no se invocó**.

## Límite de permisos y estado operativo

Después de las comprobaciones anteriores, `GET /v1/projects/{ref}/config/auth` devolvió **HTTP 403**, con `missing_permissions: ["auth_config_read"]`. Se detuvieron las operaciones remotas conforme a la instrucción del usuario. No se modificó Auth ni se intentó ampliar permisos. Para completar la revisión de configuración se necesita acceso con **auth_config_read** al mismo proyecto; la presencia de permisos de base de datos no implica ese permiso.

El esquema y las tres versiones están aplicados y verificados. La aplicación todavía no tiene personas, organización ni administradores autorizados: sin membresía debe denegar acceso empresarial. La aceptación HTTP con sesiones reales, renovación y aislamiento entre organizaciones sigue pendiente; no puede certificarse sin identidades y membresías autorizadas. Esta entrega no autoriza crearlas ni realizar bootstrap. Tampoco certifica la lista de esquemas expuestos o las opciones Auth, cuya revisión adicional se detuvo.

No se eliminó información existente, no se hizo merge ni se desplegó el frontend. No se integraron OpenAI ni Alegra.

## Repetición segura de verificaciones

No volver a ejecutar el preflight de instalación ni las migraciones: el primero ahora rechazará correctamente tablas existentes. Con acceso administrativo aprobado, consultar el historial mediante GET y ejecutar únicamente el postflight SQL en la API de query o con psql seguro. Comparar las tres versiones y sus statements/hashes con este informe. No usar reparación, reset, rollback remoto ni claves service_role para simular validación cliente.

Las pruebas de integridad descritas asumen la instalación inicial vacía; no repetir sus comprobaciones de vacío cuando existan datos legítimos. Para futuras verificaciones, conservar controles de catálogos y usar los casos aprobados de [STAGING_RUNBOOK.md](STAGING_RUNBOOK.md). Cualquier fallo o permiso faltante requiere detenerse e informar antes de continuar.
