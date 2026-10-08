# Módulo Clientes

## Funcionalidades

- Alta con nombre o razón social obligatorio; correo, tipo/número de identificación, teléfono y dirección opcionales.
- Listado con identificación, correo, estado y enlace Ver ficha. Búsqueda literal por nombre/razón social, filtro por estado y paginación de 25 registros.
- Ficha `/clientes/[id]` con todos los datos y edición para admin/manager. Estado activo/inactivo editable; inactivar conserva el cliente y sus relaciones.
- Contactos vinculados al cliente: alta y edición de nombre obligatorio, cargo, correo y teléfono opcionales. Lectura paginada de 25 contactos por página.
- Formularios responsive, etiquetas accesibles, foco al abrir/cerrar, confirmaciones de guardado, bloqueo de envíos simultáneos y conservación de datos ante rechazo.

No se añaden borrados: los registros existentes se conservan. No hay datos precargados ni información financiera ficticia.

## Permisos y validación

Server Components verifican identidad y membresía antes de consultar. Viewer/accountant pueden leer dentro del alcance de RLS, sin formularios de edición. Admin/manager pueden crear y editar; cada POST/PATCH vuelve a verificar sesión, rol y Origin contra el origen confiable del servidor. No basta ocultar botones.

Las APIs solo admiten campos editables conocidos. Organización, IDs de relación y autores no son datos del formulario. El cliente padre del contacto se verifica en la organización de la sesión antes de guardar; la edición además filtra por contact_id, client_id y organization_id. Cliente/contacto ajeno o inexistente devuelve 404 sin divulgar información. Supabase utiliza la sesión de la persona y conserva las claves compuestas y políticas RLS ya instaladas. Los triggers existentes conservan autores/fechas de creación y sellan la actualización. No se utiliza service_role.

Límites: nombre 200 caracteres; correo 254; teléfono/documento 40; dirección 1000; cargo 200; JSON 8 KiB. Identificación exige tipo y número juntos (NIT, CC, CE, PASSPORT u OTHER). No se valida existencia del documento ante entidades externas. Nombre siempre obligatorio, también al editar. Campos opcionales omitidos en PATCH se conservan; null/vacío los limpia. Para cambiar o quitar identificación enviar ambos campos.

La búsqueda limita texto a 100 caracteres, escapa comodines de ILIKE y filtra explícitamente por organización. Orden por fecha e ID, conteo exacto y rango limitado. Los enlaces de paginación conservan filtros; la búsqueda vuelve a la primera página. Si una página queda fuera de rango, ofrece volver.

Los errores del proveedor no se envían al navegador ni se registran datos personales. Un fallo de red puede ocurrir después de guardar: el mensaje pide revisar la lista antes de reintentar. No hay garantía de deduplicación entre solicitudes distintas ni bloqueo de edición simultánea por dos personas. No se envían correos al guardar clientes/contactos.

## Endpoints

| Método y ruta | Comportamiento |
| --- | --- |
| GET /api/clients?q=…&status=active&page=1 | Lista paginada y total dentro de la empresa autorizada |
| POST /api/clients | Crea un cliente en la empresa de la sesión |
| PATCH /api/clients?id=UUID | Edita la ficha/estado dentro de la empresa |
| POST /api/clients/UUID/contacts | Crea un contacto del cliente autorizado |
| PATCH /api/clients/UUID/contacts?id=UUID | Edita un contacto de ese cliente y empresa |

Las APIs de escritura requieren JSON y Origin exacto; sesión ausente 401, permisos/origen inválidos 403, validación 400, registro no visible 404 y consulta no disponible 503. Las páginas y listados muestran estados vacíos o errores separados.

## Validación

Lint, typecheck y build aprobados; 113 pruebas unitarias en 13 archivos aprobadas (antes: 75 en 10). El build utiliza un override local de URL pública Supabase, sin cambiar secretos. Las pruebas con proveedores simulados verifican altas, edición, campos omitidos, identificación incompleta, mass assignment, roles, CSRF, aislamiento por empresa/cliente, paginación, fallos del proveedor y formularios. Resultados finales en el PR #2. No se insertan datos en Supabase durante estas comprobaciones.

No se modifican migraciones, RLS, usuarios, membresías, secretos ni configuración remota. No se ejecuta bootstrap, no se crean datos reales durante el desarrollo y no se hace merge ni despliegue a Production. El commit lleva [skip ci] para evitar jobs de migraciones/fixtures bajo las restricciones vigentes; test:db/test:integration no se repiten y sus resultados previos son históricos. No se cambia el workflow.

## Prueba en Preview

Abrir el deployment Preview de feature/supabase-data-model que incluya esta entrega, con su URL específica. Desde Clientes → Ver ficha del cliente real existente, editar teléfono/dirección/identificación únicamente cuando corresponda y recargar para confirmar persistencia. Añadir un contacto real, editarlo y recargar. Probar búsqueda y filtro de estado; inactivar solo si corresponde. No se declara ejecutada esa prueba remota ni se incluyen datos personales en evidencias.

Las métricas financieras, proyectos, cotizaciones, contratos y facturación pertenecen a módulos posteriores; OpenAI y Alegra siguen fuera del alcance.
