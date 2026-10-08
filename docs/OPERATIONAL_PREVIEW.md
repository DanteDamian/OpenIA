# Plataforma operativa — Preview

## Alcance

Se conserva Clientes completo. Resumen usa consultas reales y aritmética decimal exacta. Oportunidades, cotizaciones, contratos, proyectos, gastos y tesorería tienen listado paginado, detalle, alta/edición, búsqueda, estado y relaciones verificadas. Proyectos permiten presupuesto y actividades/entregables/hitos con responsables miembros de la misma organización, fechas y avance calculado. Configuración permite al administrador editar datos de la empresa, conservando moneda, usuarios y membresías. Facturación se excluye de navegación y desarrollo: no se crean facturas ni se integra Alegra.

Los registros se guardan desde formularios en `/api/business/[resource]`; el servidor usa exclusivamente la sesión autenticada, asigna organization_id, permite solo campos declarados y verifica relaciones. Admin puede editar; manager gestiona módulos comerciales y proyectos; accountant gestiona gastos/tesorería; viewer consulta. Las políticas existentes siguen siendo la última barrera. No se implementan borrados ni botones sin funcionalidad. Los detalles de proveedor no se exponen al navegador.

Importes COP se introducen sin separadores de miles y con punto decimal (hasta dos decimales). Se reciben como texto, se validan con BigInt y se consultan como NUMERIC::text para evitar pérdida de precisión. Total de cotización se calcula en PostgreSQL. No se asumen tarifas tributarias ni se consulta DIAN. Gastos y movimientos efectivos se calculan por separado para evitar duplicidad; contratos y oportunidades no se consideran ingresos. El flujo neto representa movimientos registrados, no un saldo bancario certificado. Anulados/cancelados se excluyen según el indicador. Alertas operativas usan fecha de Colombia.

## Migración

`20261008000400_operational_modules.sql` agrega datos empresariales opcionales y las tablas project_work_items, cash_movements y assistant_requests. Incluye relaciones compuestas por organización, índices, auditoría por triggers existentes y ocho políticas nuevas. Es transaccional, no elimina ni transforma datos existentes y conserva las tres migraciones originales.

Aplicada con autorización mediante Management API únicamente al proyecto wafzklaioidpqqmbglff. SQL original registrado en supabase_migrations.schema_migrations. Postflight aprobado: 16 tablas con RLS habilitada/forzada, 45 políticas y funciones privadas sin escalamiento adicional. Sigue existiendo un único SECURITY DEFINER histórico (trigger de perfil). El nuevo límite del asistente es SECURITY INVOKER con search_path vacío.

Conteos y huellas del cliente existente, membresías y organización coinciden antes/después. Se conserva un usuario y no se crean registros remotos de negocio. Una actualización idéntica sobre el cliente real con role authenticated y el administrador existente comprobó escritura autorizada dentro de una transacción revertida. No se crean identidades ni se ejecuta bootstrap. REST público rechazó acceso anónimo a las tres nuevas tablas (401, permission denied).

Para repetir en otro entorno: inspeccionar dependencias/historial, validar primero en PostgreSQL 17 local, ejecutar solo versiones pendientes y aplicar SQL más historial dentro de una única transacción. No volver a ejecutar esta versión en el proyecto actual. Verificar `supabase/checks/staging-postflight.sql` y conservación de datos después.

## Asistente

Consultas conversacionales determinísticas sobre proyectos, gastos, oportunidades, alertas y resumen. Todas las fuentes se filtran por organización bajo la sesión real. No genera SQL, no tiene herramientas de escritura y no guarda conversaciones. Diario UTC: máximo 30 consultas por persona/organización; registros de consumo solo insertables con organization_id, identidad/fecha fijadas por trigger, bloqueo transaccional y sin UPDATE/DELETE para usuarios. Una cuenta no puede reiniciar su consumo ni suplantar otras identidades.

No existe OPENAI_API_KEY en este entorno: no se realizan llamadas externas ni consumo. Integración servidor preparada mediante Responses API, salida máxima 600 tokens y resumen acotado. Activación futura exige clave de servidor y OPENAI_ENABLED=true después de autorizar consumo; modelo configurable por OPENAI_MODEL. Solo NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY son públicos. La clave OpenAI, AUTH_RECOVERY_SECRET y claves administrativas nunca se pasan al navegador. No se solicita ninguna credencial nueva para operar el modo determinístico.

## Verificaciones

- 123 pruebas unitarias aprobadas, 14 archivos: validación, roles, importes exactos, indicadores, CSRF, recuperación y Clientes.
- Lint, typecheck y build aprobados. ES2020 permite aritmética BigInt con navegadores soportados por Next.js.
- test:db aprobado en PostgreSQL 17 efímero: 109 comprobaciones de integridad y 257 de catálogo/matriz de permisos, más aislamiento sin membresía.
- 181 comprobaciones de integración GoTrue/PostgREST/Next.js locales aprobadas: páginas operativas, altas/edición no financieras, roles, aislamiento, responsables, cuota y asistente determinístico. Sin facturas, pagos, gastos ni importes financieros de prueba. Fixtures y contenedores eliminados al terminar.
- Build se ejecuta después de integración, para evitar carreras con tipos generados por Next dev.

## Despliegue y verificación

La rama feature/supabase-data-model mantiene el PR #2 abierto, sin merge. Publicar esta rama dispara la integración Git existente de Vercel, exclusivamente Preview; comprobar el deployment asociado al SHA publicado y su estado success/READY mediante GitHub deployments. No se usa Vercel Production ni main.

Las variables Supabase y AUTH_RECOVERY_SECRET existentes se conservan. Preview usa VERCEL_URL de sistema; abrir la URL específica del deployment, no un alias. La allowlist exacta de recuperación debe actualizarse por el responsable si desea recuperar contraseña desde otra URL; no se modifica Auth remoto en esta entrega. Login con contraseña existente no depende de esa allowlist.

Sin credenciales personales/sesión del administrador, la comprobación automatizada remota verifica login, redirecciones protegidas y rechazo de APIs sin sesión. La navegación y escritura autenticadas se validan con GoTrue real local y con la operación real revertida bajo RLS; no se afirma una sesión de navegador del administrador probada remotamente por el agente. El administrador puede entrar y registrar exclusivamente información real desde el Preview entregado. No se solicitan contraseñas ni cookies para pruebas.
