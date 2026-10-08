# Conexión de Next.js Preview con Supabase Auth

## Estado verificado — PR #2

PR #2 permanece abierto, sin merge. Las migraciones ya aplicadas a `wafzklaioidpqqmbglff` no se ejecutan de nuevo. `/login` envía email/password a `/api/auth/login`, que usa `signInWithPassword` en servidor con la clave pública. El proxy verifica identidad con `getUser`, renueva cookies HttpOnly/SameSite=Lax/Secure en HTTPS y restringe el workspace. La organización y el rol se obtienen de membresías en servidor, no de metadata o cookies sin validar.

La aplicación únicamente consume `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. No importa ni envía `SUPABASE_ACCESS_TOKEN`, service_role, secret key, contraseña de base de datos o signing secret al navegador. El formulario no recibe claves como props y no crea usuarios. `SUPABASE_ACCESS_TOKEN` pertenece al trabajo administrativo del entorno, **no se configura en Vercel**.

## Bloqueos comprobados

1. `NEXT_PUBLIC_SUPABASE_URL` está registrada como **secreto proxy** en el entorno de Codex. Su valor de proceso no es una URL HTTPS válida: el proxy sustituye secretos en peticiones salientes, pero no convierte un marcador en una URL interpretable por Next.js. El resultado es configuración ausente y formulario de login deshabilitado. En ajustes del entorno, retirar el binding secreto de **esa URL** y definirla como variable normal con `https://wafzklaioidpqqmbglff.supabase.co`. No hacen falta credenciales nuevas. La prueba local usa un override de esa URL pública únicamente en su proceso; no cambia ni publica el borrador del entorno.
2. La consulta autenticada con clave publishable a `GET /auth/v1/settings` devuelve `external.email=true`, `mailer_autoconfirm=false`, `disable_signup=false` y `external.anonymous_users=false`. Email/password está habilitado, la confirmación de correo es obligatoria y el registro público **está habilitado**. La ausencia de formulario de registro en Next.js no bloquea `signUp` desde otros clientes. Se corrigió el texto de `/login` para no afirmar lo contrario. No se cambió ninguna opción Auth. Para cumplir un modelo de altas exclusivamente autorizadas, el responsable debe revisar **Authentication → Sign In / Providers → Allow new users to sign up** y deshabilitarlo cuando tenga autorización para modificar esa configuración.
3. El token administrativo carece de `auth_config_read`, según el 403 ya documentado. No se pidieron nuevos permisos ni se repitió esa consulta. El endpoint público settings permitió revisar las opciones anteriores; no expone Site URL, allowlist completa de redirects, SMTP ni políticas administrativas. Esas opciones y la configuración efectiva de Vercel requieren revisión en sus dashboards; no se afirman verificadas.
4. No se crean identidades, organizaciones ni membresías en esta tarea. Sin una persona autorizada con membresía, no puede certificarse un login exitoso con acceso empresarial; una identidad sin membresía debe terminar en `/sin-acceso`.

## Variables exactas en Vercel Preview

En el proyecto Vercel que importa `DanteDamian/OpenIA`, abrir **Settings → Environment Variables**. Crear o revisar las siguientes entradas:

| Nombre | Valor | Environment | Rama específica |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://wafzklaioidpqqmbglff.supabase.co` | **Preview** | `feature/supabase-data-model` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave **publishable existente** del mismo proyecto, obtenida del dashboard Supabase → Settings → API Keys | **Preview** | `feature/supabase-data-model` |

No seleccionar Production. Si la UI permite asignar una rama Git a Preview, usar la indicada; sin esa opción, comprobar que el alcance Preview general no sustituya valores de otras ramas. No añadir claves `sb_secret_*`, service_role, access token, signing secret ni contraseña PostgreSQL. No copiar marcadores de secretos del proceso de Codex: introducir en Vercel la clave publishable existente por su mecanismo seguro. No enviar valores al chat ni versionarlos.

Mantener preset Next.js, Node 24, instalación `npm ci` y build `npm run build`. Las variables NEXT_PUBLIC se capturan al compilar: los previews ya construidos no cambian al guardar variables. Cuando se autorice la prueba de Preview, generar una nueva compilación de esta rama o usar **Redeploy** sobre su deployment Preview. No promoverlo a producción ni hacer merge. Esta entrega prepara instrucciones y no inicia un despliegue.

## Configuración Auth que debe revisar el responsable

En Supabase **Authentication → URL Configuration**, revisar Site URL y Redirect URLs con la URL HTTPS del Preview autorizado. Preferir un dominio estable de prueba o entradas exactas; evitar comodines que permitan otros proyectos/dominios. No sustituir una URL de producción existente para probar un Preview. No se modifican estas opciones en esta entrega.

El flujo actual de password grant inicia sesión sin callback externo; no necesita añadir `/auth/callback`. La aplicación no implementa confirmación por enlace, invitación, recuperación de contraseña ni MFA. No introducir rutas inexistentes en la allowlist ni dar esos flujos por disponibles. La confirmación obligatoria implica que las personas autorizadas deberán tener su correo confirmado mediante un procedimiento posterior aprobado antes de probar login satisfactorio.

## Validación sin cambios de datos

Con Preview HTTPS y variables correctas:

1. `/login` debe responder 200 y mostrar los campos de correo/contraseña. No debe mostrar el aviso de configuración pendiente.
2. Sin sesión, `/` debe redirigir a `/login`; `/api/clients` debe devolver 401 sin información empresarial.
3. Una entrada inválida en `/api/auth/login` debe devolver 400; un Origin ajeno debe devolver 403. No probar credenciales de personas ni crear cuentas en esta fase.
4. Cuando se autorice una persona y su membresía en otra tarea, comprobar login, renovación, logout y acceso según organización/rol. Verificar cookies HttpOnly/SameSite/Secure y relectura de permisos; no guardar tokens/cookies en evidencias.

En esta tarea no se ejecutan `test:db` ni `test:integration`: ambos aplican migraciones locales y el segundo crea identidades efímeras. Sus resultados previos permanecen documentados, pero no se presentan como ejecuciones nuevas bajo las restricciones actuales. Se ejecutan lint, typecheck, unitarias, build y smoke HTTP de Next.js sin usuarios.

## Resultados de esta revisión

Lint, typecheck, las 15 pruebas unitarias y build aprobados. Tras compilar con la URL pública correcta, el servidor Next.js de producción local respondió `/login` 200 con formulario y texto corregido, `/` 307 a login, `/api/clients` 401 sin sesión, POST login con Origin ajeno 403 y entrada inválida 400. No se enviaron credenciales de personas ni se realizó un password grant. El servidor usado para comprobarlo se detuvo al terminar.

La inspección del código no encontró uso del access token administrativo en src ni configuración de Vercel/Next que lo exponga. En los 13 archivos JavaScript del navegador generados por build no aparecieron los valores de proceso de los bindings access token/publishable. El formulario solo usa el endpoint de la aplicación. La consulta real de clientes con clave publishable sin sesión devolvió 401, sin acceso administrativo. Esto no sustituye revisar los valores y ámbitos efectivos de las variables del dashboard de Vercel, que no se consultó ni modificó.

Se publica este ajuste con `[skip ci]` para evitar que los jobs automáticos de Docker ejecuten migraciones y creen fixtures bajo las restricciones de esta tarea. No se desactiva ni modifica el workflow; no se afirma una nueva CI aprobada. No se ejecuta Vercel CLI ni se promueve un deployment a producción; la integración Git existente puede generar su Preview automáticamente al publicar la rama.
