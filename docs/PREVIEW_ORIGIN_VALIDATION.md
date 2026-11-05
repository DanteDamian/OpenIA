# Validación de origen Preview — PR #2

## Cambio

Preview obtiene su origen de `https://${VERCEL_URL}` exclusivamente, incluso si AUTH_SITE_URL contiene otro deployment. VERCEL_URL ausente/inválido falla cerrado. Production requiere AUTH_SITE_URL explícito y HTTPS; localhost y loopback se rechazan en deployments. Desarrollo local exige un AUTH_SITE_URL explícito de loopback para HTTP.

Login, logout, las tres rutas de recuperación y las escrituras de clientes comparten el selector. La comparación literal de Origin conserva CSRF y nunca usa Host, X-Forwarded-Host, X-Forwarded-Proto, Forwarded, la URL de la solicitud o parámetros de redirección para establecer confianza. No se permiten alias de Preview automáticamente.

## Verificaciones ejecutadas

- `npm run lint`: aprobado.
- `npm run typecheck`: aprobado.
- `npm test`: 60 pruebas aprobadas en ocho archivos (antes: 25 en seis).
- `NEXT_PUBLIC_SUPABASE_URL=https://wafzklaioidpqqmbglff.supabase.co npm run build`: aprobado; override de URL pública únicamente para el proceso local, sin editar secretos.
- Revisión de patrones de credenciales y archivos sensibles: sin coincidencias ni archivos .env privados incorporados. `.env.example` conserva valores vacíos; solo cambia comentarios.
- Sin cambios en supabase/migrations, tablas, RLS, usuarios, membresías ni configuraciones remotas.

La regresión usa la configuración real de recuperación y simula únicamente proveedores Auth/cookies: AUTH_SITE_URL antiguo, VERCEL_URL nuevo y Origin nuevo producen 200 y el callback del deployment nuevo. Login/logout aceptan ese mismo origen; verify/update superan la comprobación de origen pero conservan su validación de cuerpo y autorización. Las cinco rutas rechazan Origin antiguo, ajeno, null y ausente aun con encabezados manipulados. Production y Preview sin configuración fallan cerrado. Las pruebas existentes siguen cubriendo enumeración, OTP, grants cifrados y protección de tokens.

No se ejecutan test:db ni test:integration en esta corrección porque aplican migraciones y crean fixtures locales; las restricciones actuales prohíben modificar esas entidades. Las 104 comprobaciones de integración y resultados RLS documentados anteriormente corresponden a entregas previas. El commit utiliza [skip ci] para evitar esos jobs automáticos; no se modifica el workflow ni se declara una nueva CI aprobada.

## Activación y límites

1. Conservar variables Supabase y AUTH_RECOVERY_SECRET existentes. No se requieren nuevos secretos.
2. Comprobar exposición de variables de sistema de Vercel: VERCEL_URL debe estar disponible automáticamente, sin definir una URL manual.
3. Compilar un nuevo Preview de feature/supabase-data-model y abrir su URL HTTPS exacta, no el alias de rama. AUTH_SITE_URL anterior se ignora.
4. Para completar el correo, Supabase debe permitir exactamente ese callback /recuperar/confirmar y usar la plantilla token_hash documentada en PASSWORD_RECOVERY.md. No se verificó ni modificó la allowlist/SMTP/plantilla en esta tarea. No se enviaron correos ni se autenticaron personas reales.

Sin merge ni despliegue manual a Production. Publicar la rama puede generar un Preview por la integración Git existente de Vercel; no se promueve a producción.
