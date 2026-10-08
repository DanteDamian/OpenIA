# Gestión de usuarios: primera versión

Ruta `/usuarios`, visible solo para administradores. Permite listar miembros de la organización actual, vincular una identidad existente y confirmada por correo, cambiar entre admin/manager/accountant/viewer y suspender/reactivar acceso organizacional. No modifica identidades globales de Auth, contraseñas, usuarios de otra empresa ni registros comerciales. Una suspensión conserva las relaciones históricas, responsables y auditoría.

## Investigación y decisiones

Supabase distingue una identidad de Auth de la membresía empresarial. Una cuenta confirmada puede pertenecer a varias organizaciones con roles diferentes. El permiso se verifica en servidor con `getUser()` y nuevamente dentro de cada RPC; no procede de `user_metadata`. Se mantiene bloqueada la escritura directa de membresías mediante PostgREST.

- [Administración de usuarios en servidor](https://supabase.com/docs/guides/auth/server-side/creating-a-client).
- [Invitaciones de Supabase Auth](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail).
- [Funciones PostgreSQL y SECURITY DEFINER](https://supabase.com/docs/guides/database/functions).

Se usan tres RPC delimitadas, SECURITY DEFINER, propietario postgres, search_path vacío y referencias cualificadas. Solo authenticated puede ejecutarlas y cada función comprueba el rol admin activo de la organización solicitada. No se concede acceso de escritura general ni se instala una clave administrativa en Next.js. El navegador nunca recibe claves secretas ni datos de organizaciones ajenas.

## Seguridad

`private.has_permission` permanece SECURITY INVOKER y exige membresía activa, por lo que una suspensión deniega acceso mediante RLS incluso con un JWT previo. Next.js comprueba también esa condición en cada solicitud. Las consultas ya iniciadas pueden terminar; no se revocan globalmente las sesiones de otras organizaciones.

Las mutaciones bloquean la fila de organización antes de autorizar/cambiar miembros. No permiten suspender o degradar al último administrador activo. Los cambios y altas se registran transaccionalmente en `private.membership_audit`; solicitudes inválidas no dejan auditoría de éxito. La tabla privada tiene RLS forzada y ningún permiso para anon/authenticated/service_role. Su lectura queda reservada al operador PostgreSQL autorizado, sin interfaz de auditoría todavía.

Las APIs rechazan Origin externo, cuerpos mayores de 8 KiB, campos desconocidos y organization_id aportado por el navegador. Los errores de cuentas se muestran de forma genérica. La búsqueda por email únicamente está disponible al administrador autorizado; no se expone un directorio público de identidades.

## Instalación y orden de despliegue

1. Revisar `supabase/migrations/20261008000500_user_management.sql` y sus pruebas. Requiere las migraciones 001–004, PostgreSQL 17 y propietario postgres/BYPASSRLS.
2. Obtener autorización específica antes de aplicarla al proyecto remoto. Esta entrega no ejecuta migraciones remotas ni cambia membresías reales.
3. Aplicar solo la migración 005 mediante el procedimiento de migraciones revisado. No volver a ejecutar las cuatro anteriores. Añade una columna con valor inicial true, tres funciones y auditoría; no elimina datos ni asigna roles.
4. Desplegar/revisar la rama del PR en Vercel Preview. El código mantiene el acceso anterior mientras falta la migración: la sección Usuarios muestra el bloqueo y no habilita sus formularios.
5. Verificar `/usuarios` con administrador existente; comprobar que otros roles no reciben listados ni permisos de escritura. No probar suspensiones ni nuevas vinculaciones sobre personas reales sin autorización.

Se mantienen las variables `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y las existentes para recuperación de contraseña. No hay variables nuevas ni secretos administrativos requeridos para esta versión. Preview obtiene el origen HTTPS de `VERCEL_URL`; Production mantiene AUTH_SITE_URL explícito. No se modifican configuraciones de Auth, DNS ni SMTP.

## Cuentas nuevas: siguiente etapa

Esta versión **no envía invitaciones ni crea identidades**. Para incorporar personas que aún no tengan cuenta, la siguiente etapa necesita invitación privada, verificación del email, configuración inicial de contraseña y aceptación controlada de membresía. `auth.admin.inviteUserByEmail` requiere una clave administrativa exclusivamente de servidor; el token Management usado por herramientas no debe introducirse en la aplicación. No se añaden formularios de registro abierto ni se reutiliza el enlace de recuperación como invitación. El correo solo deberá enviarse por instrucción explícita y con URL HTTPS permitida en Supabase.

## Verificaciones

Ejecutar `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:db`, `npm run test:integration` y `npm run build`. Los runners de base de datos/Auth utilizan contenedores PostgreSQL 17, Auth y PostgREST descartables y únicamente identidades locales efímeras autorizadas. Nunca utilizan el proyecto remoto para fixtures.

Resultado de validación de esta entrega: 126 pruebas unitarias; comprobaciones de catálogo, integridad y permisos en PostgreSQL 17 aprobadas. 216 comprobaciones de integración validan Auth real local, PostgREST y Next.js, incluido el bloqueo con JWT/cookies previos a la suspensión y la concurrencia entre administradores. No se ejecuta bootstrap ni se asignan usuarios remotos.

`lint`, `typecheck` y `build` aprobados. El build incluye las rutas dinámicas `/usuarios` y `/api/users`. Inspección de cambios y escaneo de patrones de secretos sin coincidencias. Ninguna migración se ejecutó remotamente en esta entrega; no hubo merge ni despliegue a Production.
