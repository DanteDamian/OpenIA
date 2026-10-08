# Desarrollo de AIGENTERRA Finance AI

- Trabajar en ramas de desarrollo y enviar cambios mediante Pull Request. No desplegar a producción sin autorización explícita.
- Usar este checkout aislado; no crear worktrees salvo solicitud explícita.
- Stack: Next.js App Router, TypeScript estricto, Tailwind CSS, Supabase y Vercel.
- Organizar rutas en src/app, funcionalidades en src/features, componentes compartidos en src/components y adaptadores en src/lib.
- Preferir Server Components. Usar componentes cliente solo para interactividad o APIs del navegador.
- Ejecutar npm run lint, npm run typecheck, npm test y npm run build antes de entregar. Documentar fallos y comprobaciones pendientes.
- No representar datos financieros ficticios como reales. Mostrar estados vacíos cuando no exista una fuente validada. Usar COP y es-CO; almacenar importes con precisión decimal en PostgreSQL al implementar persistencia.
- No integrar OpenAI o Alegra hasta autorización de alcance. No enviar datos personales o financieros a terceros de forma implícita.
- No versionar secretos, .env.local, tokens ni credenciales. NEXT_PUBLIC_* solo admite valores públicos. Nunca exponer claves service_role.
- Antes de gestionar datos reales: implementar autenticación, autorización en servidor, RLS por organización, validación de entradas y auditoría. No confiar en ocultar controles de interfaz como autorización.
- No registrar datos personales, cookies de sesión ni información financiera sensible. Revisar dependencias y no desactivar TLS o controles de integridad.
- Mantener accesibilidad: semántica, navegación por teclado, foco visible, etiquetas y responsive.
- Para cambios de Auth/RLS, ejecutar npm run test:db y npm run test:integration con fixtures locales descartables; nunca reutilizar secretos ni URLs remotas en el runner.
- Verificar identidad con Supabase Auth en servidor y membresía en cada entrada de datos. No confiar en getSession, user_metadata ni cookies de empresa para autorizar. Preferir SECURITY INVOKER; revisar search_path, grants y alcance de cada SECURITY DEFINER.
- No modificar otros repositorios. No sobrescribir trabajo ajeno.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
