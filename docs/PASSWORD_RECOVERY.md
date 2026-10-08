# Recuperación de contraseña con Supabase Auth

## Flujo implementado

`/login` enlaza «¿Olvidaste tu contraseña?» a `/recuperar`. POST `/api/auth/recovery/request` solicita el correo con `resetPasswordForEmail` y un redirect fijo al origen HTTPS del frontend, terminado en `/recuperar/confirmar`. No acepta un redirect del formulario. Para cualquier email válido, devuelve el mismo HTTP/mensaje ante cuenta existente, inexistente, error SMTP, límite del proveedor o fallo de red. Añade una espera mínima de un segundo más jitter para amortiguar respuestas rápidas; no garantiza latencia constante de un proveedor externo. Los límites de Auth/SMTP siguen siendo necesarios para prevenir abuso.

El enlace contiene **token_hash en el fragmento**, nunca access_token/refresh_token ni un token en query. El fragmento no viaja al servidor al cargar la página. El cliente retira query y fragmento del historial al hidratar, mantiene el hash solo en memoria y espera que la persona pulse «Validar enlace». No consume OTP automáticamente, lo que reduce el riesgo de que lectores de correo agoten enlaces. POST `/api/auth/recovery/verify` valida únicamente `type: recovery` mediante Supabase `verifyOtp`; no acepta tipos/destinos del cliente. Un OTP inválido, vencido o usado no emite autorización.

La autorización de recuperación se cifra con AES-256-GCM y un secreto propio del servidor. Se guarda en una cookie **HttpOnly, SameSite=Strict, Secure en HTTPS**, con máximo diez minutos y nunca más allá de la expiración del access token. Está separada de las cookies de login: una sesión ordinaria no autoriza este flujo. Los tokens no se devuelven en JSON, props, DOM ni almacenamiento del navegador. Las páginas/APIs de recuperación tienen no-store, no-referrer, noindex y frame-ancestors 'none'. No hay RPC administrativa ni uso de service_role.

`/recuperar/nueva` muestra el formulario únicamente si la cookie cifrada es íntegra y vigente. POST `/api/auth/recovery/update` exige esa autorización, verifica identidad con `getUser` y coincidencia con el usuario del grant, establece la sesión aislada y ejecuta `updateUser({ password })`. Exige confirmación y longitud de 12–128 caracteres; Supabase conserva la última palabra sobre su política de contraseñas. Solicita cierre global de sesiones, elimina la autorización y las cookies de sesión del navegador y pide iniciar sesión de nuevo. Si Auth informa fallo de cierre global, avisa sin afirmar que todas las sesiones se cerraron. Los JWT ya emitidos pueden conservar validez hasta expirar en otros servicios: no se promete revocación instantánea de todos los bearer tokens.

Todos los POST exigen Origin exactamente igual al origen configurado. No se deriva la URL de Host, X-Forwarded-Host, next, returnTo o redirectTo del usuario. Los cuerpos JSON tienen límite de 8 KiB. No se imprimen contraseñas, hashes ni tokens en logs de aplicación. La autorización cifrada sigue siendo un bearer sensible: no debe registrarse ni compartirse.

Los formularios declaran method=post también para su comportamiento nativo: si JavaScript no se carga, no envían contraseñas/correos en la query de una navegación GET. La interfaz requiere JavaScript para completar el flujo; el fallback nativo no autentica ni actualiza contraseñas.

## Activación en Vercel Preview

No se modificó la configuración remota de Supabase, no se enviaron correos reales ni se cambiaron contraseñas de personas reales en esta entrega. Para activar el flujo, el responsable configura los siguientes valores en **Settings → Environment Variables**, ámbito **Preview** y rama `feature/supabase-data-model`:

| Variable | Valor / alcance |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://wafzklaioidpqqmbglff.supabase.co`; variable normal, no marcador proxy |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave pública existente de ese proyecto |
| `AUTH_SITE_URL` | Origen HTTPS exacto del frontend, sin ruta/query. Preferir URL Preview estable o dominio de pruebas |
| `AUTH_RECOVERY_SECRET` | **Secreto de servidor**, 32 bytes aleatorios en hexadecimal: 64 caracteres. Generarlo mediante `openssl rand -hex 32` en una terminal privada e introducirlo directamente en el campo seguro de Vercel. Nunca prefijo NEXT_PUBLIC, Git, logs o chat |

No usar access token administrativo, clave secret/service_role, contraseña de base de datos ni clave publishable como secreto de cifrado. La aplicación necesita el valor real de `AUTH_RECOVERY_SECRET` en su proceso; no sirve un binding de secreto que solo se sustituye en el proxy HTTPS. Usar el mismo secreto en las instancias del mismo deployment; rotarlo invalida autorizaciones de recuperación pendientes. No publicar su valor ni copiar un marcador de Codex a Vercel.

Si AUTH_SITE_URL está ausente en Preview, se usa `https://${VERCEL_URL}` suministrado por Vercel para ese deployment. No usar PUBLIC Supabase URL como origen del frontend. En producción el origen debe configurarse explícitamente; en cualquier despliegue Vercel y NODE_ENV=production se rechazan localhost/loopback incluso con HTTPS. HTTP loopback solo se acepta en desarrollo local sin Vercel. Configuración inválida/secreto ausente devuelve 503 y deshabilita el formulario; no cae a localhost ni usa un Host enviado por el cliente.

Guardar variables exige una nueva compilación Preview. No promover a producción ni hacer merge para probar. Si se usa una URL Preview diferente por deployment, registrar **su destino exacto** en Supabase antes de enviar enlaces; una URL estable de pruebas evita editar la allowlist en cada compilación.

## Plantilla y allowlist requeridas en Supabase

Estos son cambios de configuración para el responsable autorizado; **no se aplicaron en esta tarea** y no se ampliaron permisos administrativos:

1. En Authentication → URL Configuration, verificar Site URL **HTTPS** del frontend autorizado y añadir a Redirect URLs exactamente `https://<FRONTEND_AUTORIZADO>/recuperar/confirmar`. No comodines amplios ni localhost para Preview. El destino debe coincidir con AUTH_SITE_URL o VERCEL_URL efectivo. Si Supabase rechaza el redirect, puede usar Site URL: por eso ambos deben ser HTTPS adecuados antes de habilitar envíos.
2. En Authentication → Email Templates → Reset Password, usar una plantilla de recuperación que incluya:

```html
<p>Se solicitó recuperar el acceso a AIGENTERRA Finance AI.</p>
<p><a href="{{ .RedirectTo }}#token_hash={{ .TokenHash }}">Establecer contraseña nueva</a></p>
<p>Si no solicitaste este cambio, ignora este mensaje.</p>
```

3. No usar `{{ .ConfirmationURL }}` para este flujo: el enlace predeterminado puede consumir el OTP y entregar tokens de sesión en el fragmento. Esta implementación rechaza esos formatos y exige el hash de recuperación para verificarlo en servidor.
4. Revisar Email/password, SMTP autorizado, caducidad OTP, límites de envío e intentos, y política de contraseñas. El SMTP predeterminado puede limitar destinatarios; no afirmar envío público operativo sin verificar entrega. El token administrativo del entorno carece de auth_config_read; no se intentó modificar permisos para cambiar estas opciones. Si Preview tiene protección de acceso de Vercel, el destinatario necesita acceso al Preview; no se deshabilita esa protección automáticamente.

No se necesita `/auth/callback`: el callback de este flujo es `/recuperar/confirmar`, con validación OTP por POST y navegación fija a `/recuperar/nueva`. Abrir el enlace en otro navegador funciona sin depender del cookie PKCE del navegador que pidió el correo, gracias al token_hash de un solo uso y la autorización cifrada posterior.

No conectar analytics, grabación de sesión ni captura de cuerpos/URLs/cookies a estas páginas/APIs sin excluir los datos de recuperación. Aunque el fragmento no llega al servidor ni al Referrer, otros scripts del navegador pueden leerlo antes de retirarlo. No registrar cuerpos de POST en observabilidad/edge.

## Pruebas y límites

Los tests unitarios verifican orígenes HTTPS, rechazo de localhost en Preview, cifrado/manipulación/expiración del grant, CSRF, respuestas uniformes, destinos fijos, comprobación de identidad, eliminación de cookies y el tratamiento del fragmento incluso con StrictMode. Las pruebas de navegador simulado no consumen automáticamente el OTP ni permiten fragmentos con destinos adicionales.

El runner de integración usa GoTrue real exclusivamente en Docker local, con identidades efímeras ya autorizadas para pruebas. Solicita recuperación, genera un enlace para una identidad local existente, lo valida, rechaza reutilización de OTP y de grant consumido, cambia la contraseña y comprueba que la anterior falla y la nueva funciona. No envía correo real ni utiliza secretos/URLs remotos; destruye fixtures y servicios al terminar. No se modifican migraciones ni RLS, y no hay registros financieros de prueba.

La entrega y apertura del correo en un Preview real requieren plantilla, allowlist, secreto y SMTP configurados por el responsable. No se declara esa prueba remota ejecutada. No crear usuarios, asignar administradores ni invocar bootstrap para probar esta implementación sin autorización de ese alcance.

Resultados locales: 25 pruebas unitarias en seis archivos y 104 comprobaciones de integración Auth/PostgREST/Next.js aprobadas. Lint, typecheck y build aprobados; test:db conserva sus comprobaciones de integridad/RLS. Ejecutar el build y test:integration **secuencialmente**: el runner inicia Next dev y sus tipos generados comparten el checkout con el build. Una ejecución simultánea produjo TS6053 al desaparecer tipos dev durante la compilación; la compilación posterior secuencial pasó sin cambios en tsconfig ni deshabilitar TypeScript.
