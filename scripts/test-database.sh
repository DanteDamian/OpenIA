#!/usr/bin/env bash
set -euo pipefail
# Siempre una base nueva dentro de un contenedor efímero, sin puertos ni volúmenes.
# No lee DATABASE_URL ni credenciales ni configura proyectos Supabase remotos.
cd "$(dirname "$0")/.."
container="aigenterra-db-test-$$"
image="postgres:17@sha256:2d2b8998d31037bf721cfdf764d76ba74171b4fab3431b7f72c27c56ddbdf9e3"
trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT
# Trust limitado al contenedor aislado sin red; no es configuración para despliegue.
docker run --detach --name "$container" --network none \
  -e POSTGRES_HOST_AUTH_METHOD=trust "$image" >/dev/null
ready=false
for attempt in $(seq 1 40); do
  if docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done
if [[ "$ready" != true ]]; then
  docker logs "$container"
  exit 1
fi
run_sql() { docker exec -i "$container" psql -X -U postgres -v ON_ERROR_STOP=1 < "$1"; }
run_sql supabase/tests/bootstrap.sql
for migration in supabase/migrations/*.sql; do
  echo "Applying $migration"
  run_sql "$migration"
  if [[ "$migration" == *"initial_data_model.sql" ]]; then
    run_sql supabase/tests/lockdown.sql
  fi
done
run_sql supabase/tests/integrity.sql
run_sql supabase/tests/security.sql
# No hay fixtures de usuarios, empresas o finanzas: solo catálogo de roles.
docker exec "$container" psql -X -U postgres -v ON_ERROR_STOP=1 \
  -c "select 'Database validation passed; ephemeral database will be removed' as result;"
