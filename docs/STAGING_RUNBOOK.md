# Primera instalación en Supabase staging — PR #2

## Estado y límites

El proyecto definitivo `wafzklaioidpqqmbglff` recibió las tres migraciones con autorización expresa del usuario. No se creó un staging independiente. Ver [SUPABASE_DEPLOYMENT_REPORT.md](SUPABASE_DEPLOYMENT_REPORT.md) para versiones/hashes, comprobaciones remotas y el bloqueo `auth_config_read`. No volver a aplicar las migraciones registradas ni ejecutar el preflight de instalación sobre esa base ya inicializada.

Este documento conserva el procedimiento para una futura instalación en **otro staging vacío y autorizado**. Los comandos no conceden autorización por sí mismos. Bootstrap, altas de personas, modificaciones de Auth y despliegue del frontend requieren su alcance autorizado; no se ejecutaron en la instalación descrita. Las recomendaciones de configuración Auth que siguen son futuras y no se aplicaron.

`SUPABASE_ACCESS_TOKEN` es un binding seguro restringido a `api.supabase.com`, no una contraseña PostgreSQL para psql. En la instalación se usó la API HTTPS de administración con SQL e historial en la misma transacción. Para la ruta CLI/libpq de este documento se necesita una conexión administrativa segura compatible. No guardar claves ni token en Git, logs o chat.

El esquema remoto está aplicado y verificado en PostgreSQL 17.11. La aceptación con sesiones reales y la revisión de configuración Auth/API siguen pendientes; no se crearon usuarios ni membresías remotas. Las pruebas locales no sustituyen esos casos.

## Dependencias y orden obligatorio

| Versión | Dependencias de entrada | Resultado |
| --- | --- | --- |
| `20261008000100` | PostgreSQL 17; roles `anon`, `authenticated`, `service_role`; `auth.users` y `auth.uid()`; operador `postgres` con CREATE y permisos sobre Auth | 13 tablas públicas, relaciones con organización, precisión decimal, índices, trigger de perfil; RLS forzada y privilegios cliente revocados al finalizar |
| `20261008000200` | Todas las entidades y funciones de 001 | 37 políticas, grants y matriz de roles; resolver inicialmente SECURITY DEFINER |
| `20261008000300` | Políticas/resolver de 002, columnas de estado y confirmación de Auth | Membresías propias, resolver SECURITY INVOKER, slug y bootstrap privado auditado; ningún bootstrap automático |

Aplicar **001 → 002 → 003**, sin tráfico de aplicación hasta completar las tres. Cada archivo tiene su propia transacción: si falla 003, 001/002 siguen aplicadas y el resolver todavía conserva su modo anterior. Detener la liberación, revisar el historial y corregir la causa; no dar el entorno por aprobado con solo dos versiones.

No se requieren extensiones adicionales: UUID, columnas generadas almacenadas, índices, claves compuestas, PL/pgSQL y RLS son funciones nativas de PostgreSQL 17. Los tests locales ahora aplican las tres migraciones como `postgres` **NOSUPERUSER + BYPASSRLS** sobre el esquema generado por GoTrue real. Esto verifica el contrato de privilegios sin certificar todas las diferencias del servicio gestionado. La descarga de `supabase/postgres:17.6.1.136` falló por falta de espacio en Docker; no se ejecutó ni se considera verificada esa distribución.

## Preparación sin ejecución remota

1. Revisar PR #2 y conservar este checkout/commit. No modificar las migraciones publicadas. Registrar `git rev-parse HEAD` y `sha256sum supabase/migrations/*.sql` como evidencia del SQL aprobado.
2. Cuando se autorice la creación, crear manualmente un proyecto independiente en el **plan gratuito**, si la cuota disponible lo permite. Si Supabase exige pago, detenerse; no contratar un plan ni actualizar uno existente. No reutilizar proyecto, base, claves o usuarios de producción.
3. Registrar nombre, referencia, región y organización propietaria del staging en el registro operativo privado. Comparar explícitamente con la referencia de producción. Confirmar PostgreSQL major 17 en SQL; la selección de una imagen local no cambia la versión de un proyecto gestionado.
4. Usar CLI oficial y una versión fija aprobada. El procedimiento se revisó con la CLI `2.75.0`; verificar el checksum oficial del artefacto antes de instalar. Para futuras versiones, revisar cambios/flags antes de ejecutar. No ejecutar `supabase projects create`, `db reset` remoto, `migration repair`, `--include-all` ni cambios de historial para saltar un error.
5. Ejecutar localmente `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:db` y `npm run test:integration`. Docker y Node 24 son necesarios para integración. Solo se crean fixtures locales efímeros; no se aceptan URLs ni secretos externos en esos runners.

## Controles contra el proyecto seleccionado (operador)

Estos pasos son una receta futura: **no se ejecutaron en esta entrega**. No copiar contraseñas a comandos, Git, informes o chat. Usar el almacén seguro del operador; para psql usar un servicio/libpq privado con TLS y verificación del certificado (por ejemplo `PGSERVICE=aigenterra-staging`, definido fuera del checkout). Nunca desactivar TLS. Usar conexión directa o pooler en modo sesión aprobado, no un pooler transaccional para migraciones.

Conectar como el operador `postgres`. Un nombre de usuario de pooler puede incluir la referencia; SQL debe devolver `current_user = 'postgres'`. Confirmar en el dashboard que conexión/CLI/URL de API pertenecen al mismo staging. El SQL no puede demostrar por sí solo la identidad comercial del proyecto.

```sh
# SOLO después de identificar el staging y habilitar su acceso administrativo.
supabase login
supabase link --project-ref "$STAGING_PROJECT_REF"
supabase migration list --linked
supabase db push --linked --dry-run

# Servicio de conexión privado preparado por el operador; no contiene valores aquí.
PGSERVICE=aigenterra-staging psql -X -v ON_ERROR_STOP=1 \
  -f supabase/checks/staging-preflight.sql
```

`link` guarda metadatos locales ignorados en `supabase/.temp/`; no aplica migraciones. El dry run muestra el plan sin aplicar las migraciones de negocio, pero debe tratarse como acceso remoto administrativo: no es un sustituto del control SQL ni de la autorización posterior. Aprobar exactamente las tres versiones pendientes y sus hashes. Ante tablas `profiles`/`roles` ya existentes, schema `private` existente o historial divergente, detenerse y diseñar una adaptación independiente, sin borrar objetos ni editar versiones publicadas.

El preflight se ejecuta en una transacción **read only** y termina en rollback. Comprueba versión, rol/BYPASSRLS, ausencia de bypass en roles cliente, existencia/tipos de columnas de Auth, UUID de `auth.uid()`, privilegios SELECT/REFERENCES/TRIGGER y CREATE, colisiones de tablas/esquema/trigger. No crea objetos ni muestra identidades. No garantiza que no existan otros triggers, políticas de plataforma o drift; revisar sus metadatos antes de aprobar.

## Aplicación — requiere autorización específica

Registrar la aprobación: referencia staging, commit, hashes, tres versiones, operador y ventana sin tráfico. Confirmar de nuevo la vinculación justo antes de aplicar. Respaldar previamente cualquier estado que deba conservarse con un mecanismo disponible en el plan gratuito; no asumir que incluye backups gestionados ni contratar uno. La instalación inicial requiere tablas empresariales inexistentes.

```sh
# NO ejecutar hasta recibir aprobación explícita para este staging.
supabase db push --linked
supabase migration list --linked
PGSERVICE=aigenterra-staging psql -X -v ON_ERROR_STOP=1 \
  -f supabase/checks/staging-postflight.sql
```

El postflight solo lee metadatos y catálogo de roles: comprueba las 13 tablas, propietarios, RLS forzada, constraints validadas, 37 políticas, membresías propias, ACL administrativas, seis funciones privadas con search_path vacío, único SECURITY DEFINER reservado al trigger y trigger Auth activo. No invoca bootstrap ni inserta datos. Son controles de configuración, no una prueba completa de aislamiento por HTTP. No ejecutar `supabase/tests/bootstrap.sql`, `integrity.sql` ni `security.sql` contra staging: contienen emulación o supuestos de una base efímera vacía.

## Auth/API y variables Next.js

`supabase/config.toml` configura el entorno local; **no configura automáticamente el dashboard del proyecto alojado**.

En staging, habilitar Email/password, deshabilitar registro público y acceso anónimo, conservar confirmación de correo y políticas de sesión apropiadas. No crear identidades remotas en esta tarea. Solo usar personas previamente autorizadas; invitación/alta y confirmación requieren un procedimiento separado aprobado. Exponer `public` para PostgREST y mantener `private` excluido. El acceso administrativo con service_role omite RLS y no sirve para validar permisos cliente.

Configurar Site URL y redirects permitidos con la URL **HTTPS exacta** del frontend staging; evitar comodines amplios. La versión actual usa password grant y no incluye flujo de invitaciones, recuperación, MFA ni callback por email. No anunciar esos flujos como disponibles. Revisar antes de ampliar el acceso.

| Variable | Valor que debe configurar el operador | Alcance |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<REFERENCIA_STAGING>.supabase.co`, URL API del proyecto independiente, sin query/credenciales | Público, capturado al compilar Next.js |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave **publishable** del mismo staging, tomada del dashboard y suministrada fuera de Git | Pública; permisos efectivos dependen de sesión y RLS |
| `STAGING_PROJECT_REF` | Referencia validada para vinculación CLI | Solo terminal del operador; no variable de Next.js |
| `PGSERVICE` | Servicio libpq seguro de staging para comprobaciones SQL | Solo operador; su archivo de conexión no se versiona |

El frontend no necesita DATABASE_URL, contraseña PostgreSQL, secret/service_role key, JWT signing secret, OpenAI ni Alegra. `.env.example` solo documenta las dos variables públicas. Para desarrollo usar `.env.local` ignorado; para Vercel usar un proyecto staging separado o variables limitadas a **Preview y su rama**, nunca al ámbito Production. Cambiar variables NEXT_PUBLIC exige nueva compilación. Preparar el preview no autoriza crear un despliegue en esta entrega.

Registrar administradores con `private.bootstrap_aigenterra` solo después de aprobación de UUID/organización; seguir [AUTH_AND_BOOTSTRAP.md](AUTH_AND_BOOTSTRAP.md). Los usuarios Auth sin membresía reciben acceso denegado. No asignar roles desde `user_metadata` ni desde el navegador.

## Aceptación con Auth y PostgREST gestionados

Preparar una hoja de evidencias por caso: fecha, referencia staging, commit, versión PostgreSQL/servicios si está disponible, rol, organización, endpoint, HTTP esperado/real y aprobado/fallido/pendiente. No guardar tokens, cuerpos con datos personales, emails, cookies ni claves. Obtener sesiones de las personas autorizadas mediante el login; todas las consultas usan clave publishable + **token de usuario**, nunca service_role.

| Caso | Resultado esperado |
| --- | --- |
| Sin sesión: workspace/API clientes; password incorrecto; JWT inválido/expirado | Redirección a login / 401; no información empresarial |
| Auth `GET /auth/v1/user`, login Next.js y logout | Identidad verificada; cookies HttpOnly/SameSite, Secure en HTTPS; logout invalida cookies |
| Renovación de sesión y navegación/API después de expirar el access token | Renovación válida; cookies nuevas; ninguna filtración de tokens |
| Persona confirmada sin membresía | Auth válido, membresías vacías, Next.js 403; tablas empresariales vacías vía RLS |
| `/rest/v1/organization_memberships?select=organization_id,user_id,role_id` | Solo membresías propias, incluso cambiando filtros |
| Cada rol consulta organizaciones/clientes y demás recursos autorizados | Solo filas de sus organizaciones; catálogo roles legible |
| JWT metadata admin falsa o cookie de organización ajena | Ninguna elevación; cookie ajena produce 403 en Next.js |
| RPC privada; edición de rol/membresía/catálogo desde PostgREST | Función privada no encontrada / operación denegada |
| Petición de escritura a Next.js desde otro Origin | 403 sin mutación |

Comprobar `GET /rest/v1/clients?select=id,organization_id&organization_id=eq.<UUID_AJENO>` con una persona de otra organización: 200 con `[]`, no necesariamente 403. Con clave publishable sin sesión la consulta a clientes debe denegarse. Una respuesta vacía en una base vacía **no demuestra aislamiento**: para certificarlo hacen falta dos organizaciones autorizadas y filas no financieras aprobadas, o mantener el caso pendiente.

La aceptación de escritura debe aprobarse por separado, con identidades/organizaciones autorizadas y registros no financieros permitidos: admin/manager pueden crear/editar cliente; accountant/viewer no; no se puede cambiar organization_id ni referenciar entidades de otra empresa. Un UPDATE filtrado por RLS puede devolver 200/204 y afectar **cero filas**: comprobar el conteo y relectura autorizada del registro, no solo el HTTP. Registrar/retirar los datos autorizados según su procedimiento, nunca borrar datos ajenos. No crear usuarios efímeros remotos ni datos financieros ficticios. La matriz completa financiera sigue cubierta por SQL local; si no hay registros financieros legítimos aptos para la prueba, sus casos de escritura remotos quedan pendientes, sin fabricar transacciones.

## Criterio de liberación y recuperación

Para aprobar el staging: tres versiones coincidentes en historial; pre/postflight aprobados; Auth/API configurados; bootstrap autorizado si corresponde; casos HTTP de identidad, permisos y aislamiento aprobados con evidencia significativa. Cualquier caso sin personas/datos autorizados queda pendiente y limita la declaración de preparación.

Si falla una migración, revisar transacción e historial; no intentar limpiar el servicio con DROP o reset. Corregir con una nueva migración revisada cuando ya se aplicó una versión. Si falla Auth después de aplicar, cerrar el acceso al frontend y revisar el trigger y sus privilegios; no desactivar RLS ni usar service_role para ocultar el fallo. El merge y la liberación de producción requieren decisiones independientes, fuera de este procedimiento.
