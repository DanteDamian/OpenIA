# AIGENTERRA Finance AI

Base administrativa para una empresa colombiana de servicios tecnológicos. Next.js App Router, TypeScript, Tailwind CSS y adaptadores Supabase. Despliegue previsto en Vercel mediante revisión de Pull Request.

## Desarrollo local

Node.js 24 LTS y npm. Desde la raíz del repositorio:

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Sin configuración de Supabase, la aplicación muestra un acceso pendiente de configuración y bloquea el espacio administrativo. No contiene datos financieros de ejemplo ni persistencia. Clientes, Proyectos, Cotizaciones, Contratos, Facturación, Gastos e Inteligencia Artificial tienen rutas propias y estados vacíos. Incluye login/logout con Supabase Auth y consulta/API de clientes; los demás módulos mantienen estados vacíos.

## Supabase

Configurar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en `.env.local` o en variables de Vercel. La clave publishable es pública; nunca usar `service_role` ni claves privadas con prefijo `NEXT_PUBLIC_`. Reiniciar desarrollo y recompilar tras cambiar variables públicas.

`src/lib/supabase/server.ts` maneja sesiones en servidor con cookies HttpOnly; `src/proxy.ts` verifica y renueva sesiones. Nunca se usa getSession como prueba de identidad. La aplicación no tiene un cliente Supabase autenticado en navegador ni usa service_role. Para desarrollo local se admite HTTP solo en loopback; los destinos remotos requieren HTTPS.

Antes de cargar datos reales: definir esquema y migraciones, RLS por organización, autenticación, validación de sesión en servidor (claims o usuario verificado), renovación de sesión y autorización de cada operación. Las migraciones y el flujo de autenticación están implementados pero no se aplicaron a un proyecto remoto.

OpenAI y Alegra no están conectados y no requieren claves en esta etapa.

## Estructura

- `src/app`: rutas, layout y estilos globales.
- `src/components/layout`: navegación responsive compartida.
- `src/features`: dashboard y presentación de módulos.
- `src/lib`: catálogo de módulos y adaptadores de servicios.
- `tests`: configuración, rutas y comportamiento de navegación.
- `docs`: validación y entrega.

## Verificaciones

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

CI ejecuta instalación con lockfile, lint, tipos, pruebas y compilación. Resultados de esta entrega en `docs/VALIDATION.md`.

## Pull Request y Vercel

Trabajar en `develop/aigenterra-finance-ai`. Publicar la rama y abrir un PR hacia la rama principal una vez exista una base remota. El repositorio original está vacío y no tiene `main`; no se crea una rama de producción de forma implícita.

En Vercel importar el repositorio con preset Next.js, Node.js 24, instalación `npm ci` y compilación `npm run build`. Asignar variables de Supabase a Preview cuando se vaya a probar la integración. Usar despliegues Preview del PR para revisión; producción requiere aprobación independiente. Ningún despliegue se realiza con esta entrega.

## Base de datos v1

Migraciones versionadas en `supabase/migrations/`, sin aplicación remota automática. El modelo usa Supabase Auth y RLS por empresa. Ver [modelo de datos](docs/DATA_MODEL.md) y [procedimiento de despliegue](docs/DATABASE_DEPLOYMENT.md).

```sh
npm run test:db
```

Requiere Docker y verifica migraciones en PostgreSQL 17 efímero. Este comando emula el contrato SQL mínimo de Auth y no crea usuarios ni movimientos financieros. Para probar servicios reales locales, `npm run test:integration` crea identidades efímeras autorizadas, organizaciones y clientes no financieros; elimina todo al terminar. La interfaz usa Auth y consulta clientes. Ver [acceso y aprovisionamiento](docs/AUTH_AND_BOOTSTRAP.md).
