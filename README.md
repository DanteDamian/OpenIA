# AIGENTERRA Finance AI

Base administrativa para una empresa colombiana de servicios tecnológicos. Next.js App Router, TypeScript, Tailwind CSS y adaptadores Supabase. Despliegue previsto en Vercel mediante revisión de Pull Request.

## Desarrollo local

Node.js 24 LTS y npm. Desde la raíz del repositorio:

```sh
npm ci
cp .env.example .env.local
npm run dev
```

La interfaz funciona sin credenciales. No contiene datos financieros de ejemplo ni persistencia. Clientes, Proyectos, Cotizaciones, Contratos, Facturación, Gastos e Inteligencia Artificial tienen rutas propias y estados vacíos. No incluye CRUD ni login en esta primera etapa.

## Supabase

Configurar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en `.env.local` o en variables de Vercel. La clave publishable es pública; nunca usar `service_role` ni claves privadas con prefijo `NEXT_PUBLIC_`. Reiniciar desarrollo y recompilar tras cambiar variables públicas.

`src/lib/supabase/client.ts` crea el cliente de navegador bajo demanda. `server.ts` está reservado a Route Handlers y Server Actions que pueden escribir cookies. Estos adaptadores no realizan llamadas mientras no se utilicen. El indicador de configuración solo comprueba presencia/formato de variables, no conectividad.

Antes de cargar datos reales: definir esquema y migraciones, RLS por organización, autenticación, validación de sesión en servidor (claims o usuario verificado), renovación de sesión y autorización de cada operación. No hay tablas, políticas ni flujo de autenticación desplegados todavía.

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

Requiere Docker y verifica migraciones en PostgreSQL 17 efímero. No crea usuarios ni movimientos financieros; emula el contrato SQL mínimo de Auth. La interfaz aún no usa las tablas ni implementa login o CRUD.
