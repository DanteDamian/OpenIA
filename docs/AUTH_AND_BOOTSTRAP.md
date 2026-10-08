# Acceso y alta inicial autorizada

## Next.js y Supabase Auth

`/login` permite email/contraseña mediante el endpoint de servidor `/api/auth/login`. Usa `signInWithPassword` de Supabase Auth: no implementa un sistema de contraseñas propio ni almacena contraseñas en PostgreSQL público. El registro público sigue deshabilitado. No hay alta automática de administradores desde el navegador.

`proxy.ts` valida la identidad con `getUser()` y renueva la sesión, propagando cookies de solicitud/respuesta. No confía en `getSession()`, en un JWT decodificado por el navegador o en `user_metadata`. Las cookies de sesión son HttpOnly y SameSite=Lax, y Secure cuando el destino Supabase usa HTTPS. Los endpoints y respuestas de sesión usan Cache-Control private/no-store. Los componentes de servidor leen cookies; las modificaciones se realizan en proxy o Route Handlers.

La capa de acceso verifica nuevamente la identidad y consulta solo las membresías del usuario. Si no hay configuración, sesión o membresía autorizada, deniega acceso. La empresa activa es la primera membresía por UUID, o el valor de la cookie `aigenterra-org` si pertenece al usuario. La cookie nunca es una prueba de pertenencia; manipularla con otra empresa produce denegación. La selección visual de empresa queda pendiente.

El layout y las páginas administrativas validan acceso; las APIs también realizan sus propias comprobaciones. `/api/clients` implementa consulta, creación y actualización de cliente con lista blanca de campos, empresa tomada del contexto autorizado y filtros de empresa/ID. Admin y manager pueden editar; accountant y viewer solo consultar. RLS vuelve a aplicar el control en la base. No se usa service_role en la aplicación.

Las escrituras, login y logout requieren Origin idéntico al origen confiable configurado en servidor (VERCEL_URL en Preview; AUTH_SITE_URL obligatorio en Production), sin derivarlo de Host ni de encabezados reenviados. Las entradas JSON tienen límite de 8 KiB. Los errores de login son genéricos y no revelan si existe un correo. Los límites de intentos los aplica Supabase Auth; deben ajustarse en el proyecto al preparar staging.

`/api/auth/logout` cierra la sesión actual y borra cookies. Los JWT ya emitidos tienen la vida útil establecida por Auth; no se promete revocación inmediata de todos los bearer tokens. MFA, invitaciones y gestión visual de membresías quedan fuera de este incremento. La [recuperación de contraseña](PASSWORD_RECOVERY.md) incluye solicitud de correo, verificación OTP, autorización cifrada y cambio de contraseña; su activación en Preview requiere los ajustes de entorno/plantilla documentados.

## Procedimiento inicial de AIGENTERRA

La migración solo define el procedimiento; **no registra la organización ni asigna personas automáticamente**. No ejecutar el procedimiento con datos reales en esta entrega.

El operador autorizado debe verificar fuera de la aplicación la aprobación de cada primer administrador y su UUID de Supabase Auth. No basta con un correo proporcionado por un solicitante. Las identidades deben existir, estar confirmadas, no ser anónimas, no estar eliminadas ni bloqueadas, y tener perfil. No se crean usuarios desde este procedimiento.

El wrapper `supabase/admin/bootstrap-aigenterra.sql` invoca `private.bootstrap_aigenterra` en una transacción con ON_ERROR_STOP. Los parámetros son un array de 1 a 10 UUIDs distintos y una referencia de aprobación de 8 a 200 caracteres. Nunca introducir contraseñas o tokens como parámetros. La conexión y sus secretos deben gestionarse mediante los mecanismos seguros del operador; no escribirlos en el repositorio, la línea de comandos o el chat.

Plantilla de llamada, únicamente para un operador autorizado en una base local/staging previamente revisada:

```sql
begin;
select private.bootstrap_aigenterra(
  array[/* UUIDs de identidades confirmadas y autorizadas */]::uuid[],
  'REFERENCIA_DE_APROBACION'
);
commit;
```

La plantilla vacía no se puede usar para dar de alta una organización: se rechaza hasta introducir identidades válidas y aprobadas. No hay script que deduzca personas, busque emails o acepte metadata como autorización.

El procedimiento es SECURITY INVOKER y solo puede ejecutarlo `postgres`; anon, authenticated y service_role no tienen EXECUTE. El esquema private no está expuesto por PostgREST. Dentro de la transacción se adquiere un bloqueo asesor, se crea AIGENTERRA con slug único `aigenterra`, se asignan exclusivamente los primeros administradores aprobados y se registra la referencia, IDs y operador en una tabla privada.

Una repetición con exactamente el mismo conjunto y referencia es idempotente si las membresías siguen intactas. Una empresa ya registrada con una aprobación distinta, miembros cambiados o un nuevo administrador se rechaza; requiere un procedimiento administrativo separado y revisado. No se reactivan roles revocados de forma silenciosa. La tabla privada de aprobación no tiene permisos para clientes ni service_role y no se expone en APIs.

## Revisión de SECURITY DEFINER

El resolver de permisos dejó de ser SECURITY DEFINER. Opera con las restricciones del usuario porque la política de membresías es `user_id = auth.uid()`, que no llama al resolver. `role_allows` es una función pura de comparación; puede devolver un booleano pero no consulta datos ni cambia permisos.

El único SECURITY DEFINER de la aplicación es el trigger `create_auth_profile`. Tiene search_path vacío, referencias cualificadas, sin SQL dinámico, y solo inserta el UUID de `NEW.id`. No copia metadata ni crea membresías. EXECUTE está revocado a clientes y no existe RPC pública. Su propietario de migraciones sigue siendo un rol confiable de Supabase; este trigger debe mantenerse pequeño y revisarse en cada cambio.

## Integración local reproducible

```sh
npm ci
npm run test:db
npm run test:integration
```

El segundo comando verifica SQL sin usuarios. El tercero, autorizado para esta tarea, crea contenedores descartables con PostgreSQL 17, Supabase Auth GoTrue 2.196.0 y PostgREST 14.17, fijados por digest. Usa una red Docker privada sin NAT de salida y puertos HTTP publicados únicamente en 127.0.0.1; PostgreSQL no publica puertos. Genera claves y contraseñas efímeras en tiempo de ejecución, no utiliza bindings reales ni acepta URLs de conexión externas.

Los fixtures son cuentas `example.invalid`, empresas y clientes no financieros. No se insertan cotizaciones, contratos, facturas, pagos, gastos o importes. GoTrue crea las identidades y emite sesiones reales locales; PostgREST verifica sus firmas y ejecuta RLS. Una puerta HTTP local permite a Next.js utilizar las rutas estándar `/auth/v1` y `/rest/v1`. La puerta es infraestructura de pruebas, no una configuración de despliegue.

Las pruebas comprueban login, perfil por trigger, renovación de tokens, membresía, lectura y modificación por rol, aislamiento entre empresas, FK cruzadas, rechazo de metadata admin, RPC privadas, JWT falsificados, cookies HttpOnly, CSRF, empresa manipulada, asignación masiva y logout. Next.js se inicia solo con la clave pública local. Al terminar, incluso ante errores, el runner elimina sus contenedores, red y archivos de secretos y detiene su proceso Next.js. No limpia procesos o recursos ajenos.

Estos resultados no certifican la configuración de un proyecto remoto. La validación en staging con identidades reales autorizadas sigue siendo un paso independiente. No ejecutar migraciones remotas ni modificar producción en esta tarea.
