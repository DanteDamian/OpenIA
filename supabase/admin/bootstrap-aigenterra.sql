-- Ejecutar únicamente por un operador autorizado sobre una base local/staging revisada.
-- No es una migración ni se ejecuta automáticamente. Recibe UUIDs, nunca contraseñas.
-- Variables psql: admin_ids (array PostgreSQL de UUIDs), approval_reference.
\set ON_ERROR_STOP on
begin;
select private.bootstrap_aigenterra(:'admin_ids'::uuid[], :'approval_reference') as organization_id;
commit;
