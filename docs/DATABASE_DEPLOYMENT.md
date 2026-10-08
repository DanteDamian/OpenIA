# Migraciones y despliegue de base de datos

## Estado de esta entrega

Solo se ejecutaron migraciones en PostgreSQL efímero de Docker, aislado de la red, sin puertos publicados ni volúmenes. No se vinculó un proyecto remoto, no se configuraron credenciales y no se ejecutaron migraciones en producción.

Las versiones iniciales son:

1. `20261008000100_initial_data_model.sql`: entidades, relaciones, restricciones, índices y triggers de perfil/auditoría.
2. `20261008000200_access_policies.sql`: matriz de permisos, grants y RLS.

Son migraciones transaccionales para una base nueva; no deben ejecutarse manualmente dos veces. El historial de Supabase determina qué versiones aplicar. Después de publicar una migración, los cambios se realizan mediante una versión nueva, nunca editando el archivo ya aplicado.

## Verificación reproducible sin credenciales

Requiere Docker, Bash, Node.js 24 y npm:

```sh
npm run test:db
```

El script usa una imagen PostgreSQL 17 fijada por digest, crea una base descartable y ejecuta todas las migraciones y pruebas SQL con ON_ERROR_STOP. Al terminar, incluso ante fallo, elimina su contenedor. Nunca usa DATABASE_URL ni otras variables de conexión. No requiere usuarios de prueba, fixtures financieros ni secretos. El método trust se limita a un contenedor sin red; no debe copiarse a una instancia de despliegue.

`supabase/tests/bootstrap.sql` emula únicamente el contrato SQL mínimo de `auth.users`, `auth.uid()` y roles PostgREST para estas pruebas. No ejecutar ese archivo en Supabase. No se ha probado el servicio GoTrue, el inicio de sesión real ni la API PostgREST. No confundir estas pruebas con una validación completa de Auth.

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

Estos pasos son documentación, no una autorización de producción:

1. Crear/seleccionar un proyecto de **staging nuevo**. Verificar su identidad y que no contiene tablas públicas incompatibles con esta base inicial. No apuntar la CLI a producción.
2. Autenticarse mediante los mecanismos seguros de la CLI. No incluir tokens ni contraseñas en comandos versionados, capturas, archivos o chat.
3. Vincular explícitamente el proyecto de staging con `supabase link --project-ref <REFERENCIA_STAGING>`. La información local de vinculación `.temp` está ignorada por Git.
4. Revisar `supabase migration list --linked`, permisos del propietario de migraciones (BYPASSRLS), backups y la lista de esquemas expuestos. `private` debe quedar fuera de PostgREST.
5. Revisar el plan con `supabase db push --linked --dry-run`. Aprobar los SQL antes de aplicar únicamente a ese staging con `supabase db push --linked`.
6. Verificar restricciones, RLS, grants e índices y comprobar que la creación de una identidad real mediante Supabase Auth produce su perfil sin aceptar roles de user_metadata.
7. Con personas reales autorizadas y datos de prueba no financieros aprobados, validar acceso con sesiones de dos empresas y cada rol: lecturas, escrituras permitidas/denegadas, referencias cruzadas rechazadas y ausencia de escalamiento. No crear identidades ficticias para esta entrega.

La empresa inicial y membresías se aprovisionan con acceso administrativo auditado, usando personas reales previamente autenticadas y autorización expresa. No hay RPC pública de onboarding ni asignación automática de admin. Se requiere un procedimiento administrativo antes de comenzar a operar; la creación de un perfil no concede acceso a ninguna empresa.

## Recuperación y producción

No hay rollback automático ni scripts DROP sobre bases de negocio. Si una transacción falla, PostgreSQL revierte esa migración; revisar la causa y el historial antes de reintentar. Tras una aplicación exitosa, corregir mediante una migración nueva. Para recuperación de datos se requiere backup probado y procedimiento del proyecto.

Producción queda fuera de esta entrega. Requiere revisión del PR, validación completa en staging y aprobación explícita independiente. No hacer merge ni desplegar automáticamente.
