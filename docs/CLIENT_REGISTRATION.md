# Registro inicial de clientes

En `/clientes`, los roles `admin` y `manager` pueden abrir **Nuevo cliente**. El formulario solicita nombre o razón social (obligatorio, hasta 200 caracteres) y correo electrónico (opcional, hasta 254). No incluye datos precargados. El cliente queda activo por el valor predeterminado del modelo existente.

El formulario envía JSON por POST a `/api/clients`, muestra el estado de guardado, evita envíos simultáneos y conserva los campos ante un rechazo. Después de confirmar el alta, cierra el formulario, anuncia el resultado y refresca la lista del servidor. Una interrupción de red puede ocurrir después de guardar: el mensaje pide comprobar la lista antes de repetir, porque no se garantiza deduplicación entre solicitudes distintas. Cancelar descarta los campos sin enviarlos.

El servidor existente verifica Origin contra la configuración confiable del deployment, identidad y membresía, exige rol admin/manager y valida una lista cerrada de campos. `organization_id` procede de la membresía verificada, nunca del formulario. Supabase opera con la sesión de la persona y conserva RLS. Los roles viewer/accountant no reciben el formulario y el endpoint rechaza sus escrituras. Los errores de base de datos no se muestran al navegador.

## Validación de esta entrega

- 75 pruebas unitarias en 10 archivos aprobadas, incluyendo 15 comprobaciones nuevas de formulario, permisos, CSRF, mass assignment, errores y envíos simultáneos. Los proveedores de estas pruebas son simulados; no insertan datos en Supabase.
- Lint, typecheck y build aprobados. El build usa la URL pública Supabase como override de proceso local, sin cambiar secretos.
- No se modifican migraciones, RLS, usuarios, membresías, secretos ni configuraciones remotas. No se ejecuta bootstrap ni se crean clientes reales durante el desarrollo.
- No se repiten test:db/test:integration: esta entrega añade interfaz sobre un endpoint existente sin modificar Auth ni RLS. El commit omite CI con [skip ci] para evitar jobs de fixtures/migraciones automáticas bajo las restricciones vigentes. No se modifica el workflow.

## Prueba en Preview

Abrir el Preview de esta rama que contenga el nuevo commit, usando su URL específica. Iniciar sesión como administrador autorizado, abrir Clientes → Nuevo cliente y registrar únicamente un cliente real cuando corresponda. Guardar debe mostrar confirmación y el cliente en la lista; recargar la página confirma persistencia. No se declara realizada esta prueba remota ni se incorpora información personal a evidencias.

Esta versión incluye alta, listado y correo opcional. Edición visual, identificación tributaria, contactos y paginación quedan para tareas siguientes; la lista actual muestra hasta 100 registros recientes.
