# Migraciones y despliegue de base de datos

## Estado de esta entrega

Las tres migraciones ya se aplicaron, con autorización expresa, al proyecto definitivo `wafzklaioidpqqmbglff` mediante la API de administración. El [informe de aplicación](SUPABASE_DEPLOYMENT_REPORT.md) registra el estado previo, historial, hashes y verificaciones remotas. La revisión adicional de Auth se detuvo por falta de `auth_config_read`. No se creó un staging independiente ni se hizo merge.

Las pruebas locales originales siguen siendo independientes: SQL en contenedor sin red e integración Auth/PostgREST en red privada sin NAT de salida y HTTP solo loopback. No reutilizar estos runners ni su emulación contra el proyecto remoto.

Las versiones son:

1. `20261008000100_initial_data_model.sql`: entidades, relaciones, restricciones, índices y triggers de perfil/auditoría.
2. `20261008000200_access_policies.sql`: matriz de permisos, grants y RLS.
3. `20261008000300_secure_bootstrap.sql`: aprovisionamiento inicial restringido y resolver de permisos SECURITY INVOKER.

Son migraciones transaccionales para una base nueva; no deben ejecutarse manualmente dos veces. El historial de Supabase determina qué versiones aplicar. Después de publicar una migración, los cambios se realizan mediante una versión nueva, nunca editando el archivo ya aplicado.

## Verificación reproducible sin credenciales

Requiere Docker, Bash, Node.js 24 y npm:

```sh
npm run test:db
```

El script usa una imagen PostgreSQL 17 fijada por digest, crea una base descartable y ejecuta todas las migraciones y pruebas SQL con ON_ERROR_STOP. Al terminar, incluso ante fallo, elimina su contenedor. Nunca usa DATABASE_URL ni otras variables de conexión. No requiere usuarios de prueba, fixtures financieros ni secretos. El método trust se limita a un contenedor sin red; no debe copiarse a una instancia de despliegue.

`supabase/tests/bootstrap.sql` emula únicamente el contrato SQL mínimo de `auth.users`, `auth.uid()` y roles PostgREST para estas pruebas. No ejecutar ese archivo en Supabase. El comando test:db no prueba el servicio HTTP de Auth. El comando test:integration descrito en AUTH_AND_BOOTSTRAP.md sí utiliza GoTrue y PostgREST reales, exclusivamente locales.

La CI incluye un job separado de PostgreSQL. No realiza conexiones a servicios externos ni despliegues.

## Supabase local completo (procedimiento pendiente)

Instalar la CLI oficial de Supabase compatible con PostgreSQL 17 y usar Docker. Desde la raíz del repositorio:

```sh
supabase start
supabase db reset --local --no-seed
supabase migration list --local
```

`db reset` es destructivo para la base local; usar solo un entorno local descartable sin información que deba conservarse. `supabase/config.toml` no contiene secretos, expone solo `public`, deshabilita seeds y mantiene el registro de usuarios deshabilitado. Los puertos de este procedimiento son locales. No copiar keys del estado local al repositorio ni a logs de CI.

No se ejecutó este procedimiento con el stack completo en esta entrega: la validación hecha usa el servidor PostgreSQL real y la emulación mínima descrita arriba.

## Staging: revisión y aplicación por un operador

Para la primera instalación, seguir el procedimiento detallado y los controles de solo lectura de [STAGING_RUNBOOK.md](STAGING_RUNBOOK.md). No se creó un staging independiente; la instalación autorizada del proyecto definitivo ya consta en SUPABASE_DEPLOYMENT_REPORT.md. El nuevo runner local también verifica las migraciones con un operador PostgreSQL 17 sin privilegios de superusuario.

Estos pasos son documentación, no una autorización de producción:

1. Crear/seleccionar un proyecto de **staging nuevo**. Verificar su identidad y que no contiene tablas públicas incompatibles con esta base inicial. No apuntar la CLI a producción.
2. Autenticarse mediante los mecanismos seguros de la CLI. No incluir tokens ni contraseñas en comandos versionados, capturas, archivos o chat.
3. Vincular explícitamente el proyecto de staging con `supabase link --project-ref <REFERENCIA_STAGING>`. La información local de vinculación `.temp` está ignorada por Git.
4. Revisar `supabase migration list --linked`, permisos del propietario de migraciones y del trigger de perfil, backups y la lista de esquemas expuestos. `private` debe quedar fuera de PostgREST.
5. Revisar el plan con `supabase db push --linked --dry-run`. Aprobar los SQL antes de aplicar únicamente a ese staging con `supabase db push --linked`.
6. Verificar restricciones, RLS, grants e índices y comprobar que la creación de una identidad real mediante Supabase Auth produce su perfil sin aceptar roles de user_metadata.
7. Con personas reales autorizadas y datos de prueba no financieros aprobados, validar acceso con sesiones de dos empresas y cada rol: lecturas, escrituras permitidas/denegadas, referencias cruzadas rechazadas y ausencia de escalamiento. Las identidades efímeras están autorizadas únicamente dentro del entorno local descartable; no crear usuarios de ejemplo en staging o producción.

La empresa inicial y membresías se aprovisionan con acceso administrativo auditado, usando personas reales previamente autenticadas y autorización expresa. No hay RPC pública de onboarding ni asignación automática de admin. El procedimiento reservado al operador se documenta en AUTH_AND_BOOTSTRAP.md; la creación de un perfil no concede acceso a ninguna empresa.

## Recuperación y producción

No hay rollback automático ni scripts DROP sobre bases de negocio. Si una transacción falla, PostgreSQL revierte esa migración; revisar la causa y el historial antes de reintentar. Tras una aplicación exitosa, corregir mediante una migración nueva. Para recuperación de datos se requiere backup probado y procedimiento del proyecto.

La instalación inicial de la base definitiva se realizó con autorización del usuario. El merge y el despliegue del frontend siguen fuera de esta entrega; requieren revisión y autorización independientes. No hacer merge ni desplegar automáticamente.
