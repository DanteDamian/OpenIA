# Usuarios e invitaciones desde la aplicación

`/usuarios` es exclusivo de administradores activos. **Nuevo usuario** pide correo y rol, crea la cuenta mediante Supabase Auth Admin si no existe y envía un enlace. No exige crear la identidad manualmente en Supabase. Las cuentas existentes reciben un enlace de verificación por correo. La persona valida su invitación, establece contraseña, acepta y usa `/login` para acceder al tablero.

Los usuarios activos permiten cambiar roles y suspender/reactivar acceso organizacional. Invitaciones muestra estado de envío, espera, aceptación, cancelación o vencimiento, con reenvío y cancelación. Una membresía nunca se asigna por `user_metadata` ni por campos recibidos del navegador.

## Configuración única del servidor

El registro público permanece deshabilitado. La creación por invitación requiere `SUPABASE_SECRET_KEY`, exclusivamente en servidor, con una **Secret key del mismo proyecto Supabase**, o la clave legacy service_role en `SUPABASE_SERVICE_ROLE_KEY`. Una publishable key o SUPABASE_ACCESS_TOKEN de Management no sirve para Auth Admin. El adaptador se encuentra en `src/lib/supabase/admin.ts` e importa `server-only`; no se pasa su configuración a componentes cliente.

En Vercel: Settings → Environment Variables → Add Environment Variable → nombre **SUPABASE_SECRET_KEY**, valor de Supabase → Project Settings → API Keys → Secret keys. Marcar Sensitive y seleccionar **Preview**, con la rama `feature/supabase-data-model`. Guardar y ejecutar Redeploy en Preview para aplicar la variable. No incluirla en NEXT_PUBLIC_ ni subirla al repositorio. No enviar su valor en chat. Este ajuste se realiza una sola vez, no por cada usuario.

Se reutilizan NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY y AUTH_RECOVERY_SECRET existentes. Preview obtiene su origen HTTPS de VERCEL_URL; Production requiere AUTH_SITE_URL explícito. No se usa una URL almacenada de otro deployment ni host/forwarded del cliente.

La SMTP de Supabase debe funcionar y las plantillas **Invite user** y **Magic link** deben utilizar el enlace estándar `{{ .ConfirmationURL }}`. El callback es `https://<deployment-preview>/invitacion/<UUID>`. La allowlist de Redirect URLs debe incluir las URL HTTPS de este proyecto Preview y esa ruta; para los deployments del equipo Aigen4 puede usarse `https://aigenterra-finance-*-aigen4.vercel.app/**`, limitado a estos previews. No añadir `https://*.vercel.app/**`. No cambiar la plantilla de recuperación existente. Las credenciales SMTP se mantienen en Supabase, no en Next.js.

## Seguridad y comportamiento ante fallos

El administrador se valida con getUser(), membresía y rol en cada API. Las RPC vuelven a autorizar al actor y la organización. POST/PATCH/DELETE exigen Origin exacto configurado en servidor. Campos cerrados, cuerpos JSON limitados a 8 KiB y UUID válidos. Reenvíos requieren 60 segundos y se limitan los intentos por administrador. Errores de correo son explícitos, sin imprimir claves, destinatarios o respuesta privada del proveedor. Si falta la conexión de Auth Admin, el formulario de alta no aparece operativo ni se escribe una invitación falsa.

La clave administrativa solo se usa para `auth.admin.inviteUserByEmail`. Todas las escrituras empresariales y de invitaciones emplean el cliente del actor autenticado y RPC verificadas. No se habilita signup ni se modifica el catálogo de roles. El token Management no se usa dentro de la aplicación. El adaptador Auth Admin solo importa funciones en servidor.

Los enlaces estándar de Auth producen tokens en fragmento, que nunca llega al servidor HTTP. La pantalla los retira de la URL antes de enviar peticiones y requiere confirmación explícita. No se admite next/redirectTo del visitante. Tokens solo se transmiten por POST al mismo origen, se verifican con getUser y se guardan durante un máximo de diez minutos en un grant AES-256-GCM HttpOnly/Secure/SameSite=strict. Su clave se deriva para el propósito de invitación, separado de recuperación. Rutas con no-store, no-referrer, noindex y protección contra embedding. No localStorage ni cookies accesibles por JavaScript.

La aceptación requiere correo confirmado coincidente con el destinatario, cuenta no bloqueada/eliminada, invitación vigente, estado sending/pending y administrador remitente todavía activo. El rol y organización salen de la invitación privada. Cancelación, vencimiento, otra identidad y replay se rechazan. Una membresía existente no se reactiva ni promueve por aceptar otro enlace. El alta y auditoría son transaccionales. El usuario empieza con su contraseña establecida e inicia sesión normalmente.

Auth y PostgreSQL no comparten transacción: si SMTP falla puede existir una identidad sin membresía, que no accede a la empresa. La invitación muestra Fallo de envío y permite reintentar. Si la contraseña se guarda y la aceptación falla, la interfaz explica ese estado parcial y permite reintentar; no promete éxito. Una invitación cancelada no elimina una identidad que pueda pertenecer a otra empresa.

## Modelo y migraciones

Versiones 001–005 aplicadas anteriormente y conservadas. La 005 añadió is_active, private.membership_audit y RPC de miembros. La suspensión bloquea RLS aun con JWT previo; las mutaciones bloquean organización y protegen al último administrador, incluida concurrencia.

La 006 añade `private.organization_invitations` y seis RPC delimitadas para listar, preparar, registrar envío, cancelar, validar y aceptar. Tabla con RLS forzada, sin permisos directos para anon/authenticated/service_role. Funciones SECURITY DEFINER, propietario postgres, search_path vacío, referencias cualificadas y EXECUTE limitado a authenticated. Las funciones de destinatario exigen identidad y correo verificados; las de administración exigen admin activo. La ventana de invitación es de siete días; la vigencia del enlace Auth puede ser menor y se respeta.

No se modifican tablas financieras ni las cuatro migraciones originales, ni se asignan miembros durante la instalación. No se ejecuta bootstrap ni se crean cuentas reales para comprobar despliegue. `supabase/checks/staging-postflight.sql` comprueba también esta superficie privilegiada.

## Pruebas reproducibles

Ejecutar lint, typecheck, test, test:db, test:integration y build. Integración usa PostgreSQL 17, GoTrue, PostgREST, Next.js y un SMTP local que captura en memoria, sin entregar correo a internet. Auth mantiene signup deshabilitado. Fixtures efímeros de identidades autorizados y eliminados al terminar; no datos financieros.

Cobertura: creación desde aplicación, correo real local, confirmación Auth, contraseña, membresía y auditoría, login/tablero, roles, identidad ajena, Origin externo, campos forjados, replay, reenvío, cancelación, fallo SMTP sin falso éxito y acceso de miembros suspendidos.

Referencias: [Auth Admin inviteUserByEmail](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail), [funciones PostgreSQL](https://supabase.com/docs/guides/database/functions). Auth Admin invita entre navegadores diferentes y no soporta PKCE; por eso se valida el flujo implícito de la plantilla estándar y se aísla el grant en servidor.

## Resultado de esta entrega

134 pruebas unitarias; 248 comprobaciones Auth/PostgREST/Next.js/SMTP local; lint, typecheck, build y validación PostgreSQL 17 aprobados. El recorrido nuevo se ejecutó desde la API de Next.js hasta el correo local, aceptación, login y dashboard. Fallo SMTP comprobado: respuesta de error, ledger failed y cero membresías concedidas. No se sustituyó ese fallo por éxito genérico.

Migración 006 aplicada al proyecto wafzklaioidpqqmbglff, preservando 001–005. SQL e historial en una transacción y recarga de PostgREST. MD5 original remoto/local coincidente: `97c61b96e917f83e64a4d1958072438f`. Postflight aprobado; 17 conteos/huellas previos coinciden, cero invitaciones reales y cero altas/cambios de membresía. En solo lectura, el administrador consulta el ledger vacío; empresas ajenas, invitaciones inexistentes y tabla privada se rechazan. HTTP anónimo devuelve 401/42501 para listado y validación. No se modificaron configuraciones de Auth/SMTP, usuarios, roles ni datos financieros.

Bloqueo de activación: SUPABASE_SECRET_KEY no está disponible en el entorno de herramientas; el usuario indicó que la configurará en Vercel Preview, sin afirmar aún que se guardó. El token Management no sustituye esa clave; tampoco dispone de acceso a Edge Functions (403), y no se amplían sus permisos. No se solicita contratar servicios ni cambiar signup.

Vercel Authentication protege actualmente el Preview: las consultas remotas sin acceso autorizado reciben 302 hacia Vercel antes de Next.js. Los destinatarios que prueben la invitación en Preview también necesitan acceso autorizado a ese deployment. No se desactiva la protección y no se afirma una prueba de correo remoto ni sesión privada. La protección de Vercel es independiente de Supabase Auth.
