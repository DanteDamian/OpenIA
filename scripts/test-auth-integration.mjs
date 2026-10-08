import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { randomBytes, createHmac, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";

// Siempre infraestructura propia descartable. No acepta URL ni secretos externos.
const run = `aigenterra-auth-${process.pid}-${randomBytes(3).toString("hex")}`;
const directory = mkdtempSync(join(tmpdir(), "aigenterra-auth-"));
const containers = [];
const secrets = [];
const secret = randomBytes(48).toString("hex");
const password = randomBytes(32).toString("hex");
secrets.push(secret, password);
const images = {
  db: "postgres:17@sha256:2d2b8998d31037bf721cfdf764d76ba74171b4fab3431b7f72c27c56ddbdf9e3",
  auth: "supabase/gotrue:v2.196.0@sha256:c0c25187a6b835e65a6f6e6c6b39d090e832d40e6de5186f2c038e0411944232",
  rest: "postgrest/postgrest:v14.17@sha256:c9dc201e555f5d8e37e7f39cdd4df0229774996e213bfd7de8d10ac609030f2c",
};
const docker = (...args) =>
  execFileSync("docker", args, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
let databaseOperator = "supabase_admin";
const sql = (query) =>
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      `${run}-db`,
      "psql",
      "-X",
      "-U",
      databaseOperator,
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
    ],
    { input: query, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  ).trim();
function jwt(role, claims = {}) {
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ role, iss: "supabase", aud: "authenticated", iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, ...claims })}`;
  const token = `${unsigned}.${createHmac("sha256", secret).update(unsigned).digest("base64url")}`;
  secrets.push(token);
  return token;
}
const anon = jwt("anon"),
  service = jwt("service_role");
let gateway,
  next,
  nextLogs = "";
let assertions = 0;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function envFile(name, env) {
  const path = join(directory, name);
  writeFileSync(
    path,
    Object.entries(env)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n"),
    { mode: 0o600 },
  );
  return path;
}
function start(name, image, env, port) {
  const container = `${run}-${name}`;
  containers.push(container);
  const args = [
    "run",
    "--detach",
    "--name",
    container,
    "--network",
    run,
    "--network-alias",
    name,
    "--env-file",
    envFile(name, env),
  ];
  if (port) args.push("--publish", `127.0.0.1::${port}`);
  docker(...args, image);
  return port
    ? Number(docker("port", container, `${port}/tcp`).split(":").at(-1))
    : null;
}
async function waitFor(label, check) {
  for (let i = 0; i < 60; i++) {
    try {
      if (await check()) return;
    } catch {
      /* startup */
    }
    await delay(500);
  }
  throw new Error(`${label} did not become ready`);
}
async function http(
  label,
  url,
  { token, method = "GET", body, headers = {} } = {},
  expected = 200,
) {
  const response = await fetch(url, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  assert.equal(
    response.status,
    expected,
    `${label}: HTTP ${response.status}, expected ${expected}`,
  );
  assertions++;
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { response, data };
}
function check(value, label) {
  assert.ok(value, label);
  assertions++;
}
function sqlDenied(query, message) {
  try {
    sql(query);
    assert.fail("Forbidden SQL unexpectedly succeeded");
  } catch (error) {
    assert.ok(
      String(error.stderr).includes(message),
      "Expected SQL guard did not reject operation",
    );
    assertions++;
  }
}
function scrub(text) {
  for (const value of secrets)
    text = text.replaceAll(value, "[ephemeral secret]");
  return text.replace(/eyJ[A-Za-z0-9_.-]+/g, "[ephemeral JWT]");
}
async function cleanup() {
  if (next && next.exitCode === null) {
    next.kill("SIGTERM");
    await Promise.race([once(next, "exit"), delay(3000)]);
    if (next.exitCode === null) next.kill("SIGKILL");
  }
  if (gateway) await new Promise((resolve) => gateway.close(resolve));
  for (const container of containers.reverse()) {
    try {
      docker("rm", "-f", container);
    } catch {
      /* own containers only */
    }
  }
  try {
    docker("network", "rm", run);
  } catch {
    /* absent */
  }
  rmSync(directory, { recursive: true, force: true });
}
process.on("SIGINT", () => {
  void cleanup().then(() => process.exit(130));
});
process.on("SIGTERM", () => {
  void cleanup().then(() => process.exit(143));
});
try {
  // Bridge privado sin NAT de salida. Solo Auth/PostgREST se publican en loopback.
  docker(
    "network",
    "create",
    "--opt",
    "com.docker.network.bridge.enable_ip_masquerade=false",
    run,
  );
  start("db", images.db, {
    POSTGRES_USER: "supabase_admin",
    POSTGRES_DB: "postgres",
    POSTGRES_PASSWORD: password,
  });
  await waitFor("PostgreSQL", () =>
    docker(
      "exec",
      `${run}-db`,
      "pg_isready",
      "-h",
      "127.0.0.1",
      "-U",
      "supabase_admin",
    ).includes("accepting"),
  );
  sql(`create role postgres login nosuperuser createdb createrole bypassrls password '${password}';
    alter database postgres owner to postgres;
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create role authenticator login noinherit password '${password}'; grant anon, authenticated, service_role to authenticator;
    create role supabase_auth_admin login noinherit password '${password}';
    create schema auth authorization supabase_auth_admin;
    alter role supabase_auth_admin set search_path to auth;
    grant create on database postgres to supabase_auth_admin;
    grant usage on schema public,auth to anon,authenticated,service_role;
    alter default privileges for role postgres in schema public grant all on tables to anon,authenticated,service_role;`);
  const authPort = start(
    "auth",
    images.auth,
    {
      GOTRUE_API_HOST: "0.0.0.0",
      GOTRUE_API_PORT: "9999",
      API_EXTERNAL_URL: "http://127.0.0.1:3000/auth/v1",
      GOTRUE_DB_DRIVER: "postgres",
      GOTRUE_DB_DATABASE_URL: `postgres://supabase_auth_admin:${password}@db:5432/postgres`,
      GOTRUE_DB_NAMESPACE: "auth",
      GOTRUE_SITE_URL: "http://127.0.0.1:3000",
      GOTRUE_DISABLE_SIGNUP: "true",
      GOTRUE_JWT_SECRET: secret,
      GOTRUE_JWT_ADMIN_ROLES: "service_role",
      GOTRUE_JWT_AUD: "authenticated",
      GOTRUE_JWT_DEFAULT_GROUP_NAME: "authenticated",
      GOTRUE_JWT_EXP: "3600",
      GOTRUE_EXTERNAL_EMAIL_ENABLED: "true",
      GOTRUE_MAILER_AUTOCONFIRM: "false",
      GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED: "false",
      GOTRUE_EXTERNAL_PHONE_ENABLED: "false",
    },
    9999,
  );
  const authURL = `http://127.0.0.1:${authPort}`;
  await waitFor(
    "Supabase Auth",
    async () => (await fetch(`${authURL}/health`)).ok,
  );
  // GoTrue instala su esquema real. Completar el helper de identidad moderno
  // que Supabase suministra para PostgREST con request.jwt.claims.
  sql(`create or replace function auth.uid() returns uuid language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),
      nullif(current_setting('request.jwt.claims',true),'')::jsonb ->> 'sub')::uuid $$;
    grant execute on function auth.uid() to anon,authenticated,service_role;`);
  // Aproximar el operador gestionado: no depender del superusuario de la
  // imagen estándar. Auth conserva su propietario; postgres recibe solo
  // los permisos sobre Auth que necesitan las migraciones/bootstrap.
  sql(`grant usage on schema auth to postgres;
    grant select, references, trigger on auth.users to postgres;
    grant anon, authenticated, service_role to postgres;`);
  databaseOperator = "postgres";
  check(sql("select not rolsuper and rolbypassrls from pg_roles where rolname='postgres'") === "t",
    "Migration operator is not a superuser");
  const preflight = readFileSync("supabase/checks/staging-preflight.sql", "utf8");
  sql(preflight);
  assertions++;
  sqlDenied(`set role authenticated; ${preflight}`, "reviewed postgres migration operator");
  for (const migration of readdirSync("supabase/migrations")
    .filter((name) => name.endsWith(".sql"))
    .sort())
    sql(readFileSync(`supabase/migrations/${migration}`, "utf8"));
  sqlDenied(preflight, "Initial deployment collides");
  sql(readFileSync("supabase/checks/staging-postflight.sql", "utf8"));
  assertions++;
  const restPort = start(
    "rest",
    images.rest,
    {
      PGRST_DB_URI: `postgres://authenticator:${password}@db:5432/postgres`,
      PGRST_DB_SCHEMAS: "public",
      PGRST_DB_ANON_ROLE: "anon",
      PGRST_JWT_SECRET: secret,
      PGRST_DB_USE_LEGACY_GUCS: "false",
    },
    3000,
  );
  const restURL = `http://127.0.0.1:${restPort}`;
  await waitFor("PostgREST", async () => (await fetch(restURL)).ok);
  // Puerta local de rutas Supabase: no expone claves de administración.
  gateway = createServer(async (req, res) => {
    const authRoute = req.url.startsWith("/auth/v1/");
    const target = authRoute
      ? authURL + req.url.slice("/auth/v1".length)
      : restURL + req.url.slice("/rest/v1".length);
    if (!authRoute && !req.url.startsWith("/rest/v1/")) {
      res.writeHead(404).end();
      return;
    }
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    try {
      const headers = { ...req.headers };
      delete headers.host;
      delete headers["content-length"];
      const response = await fetch(target, {
        method: req.method,
        headers,
        body: ["GET", "HEAD"].includes(req.method)
          ? undefined
          : Buffer.concat(chunks),
      });
      const responseHeaders = Object.fromEntries(response.headers);
      delete responseHeaders["content-encoding"];
      delete responseHeaders["content-length"];
      delete responseHeaders["transfer-encoding"];
      res.writeHead(response.status, responseHeaders);
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      res.writeHead(502).end();
    }
  });
  gateway.listen(0, "127.0.0.1");
  await once(gateway, "listening");
  const supabaseURL = `http://127.0.0.1:${gateway.address().port}`;
  const users = {};
  for (const role of ["admin", "manager", "accountant", "viewer", "outsider"]) {
    const email = `${role}-${randomBytes(4).toString("hex")}@example.invalid`;
    const created = await http(
      `Auth creates ${role}`,
      `${authURL}/admin/users`,
      {
        token: service,
        method: "POST",
        body: {
          email,
          password,
          email_confirm: true,
          user_metadata: { role: "admin" },
        },
      },
    );
    const id = created.data.id;
    check(typeof id === "string", `Auth user ID for ${role}`);
    const session = await http(
      `Auth password grant ${role}`,
      `${authURL}/token?grant_type=password`,
      { method: "POST", body: { email, password } },
    );
    secrets.push(session.data.access_token, session.data.refresh_token);
    users[role] = {
      id,
      email,
      token: session.data.access_token,
      refresh: session.data.refresh_token,
    };
  }
  check(
    sql("select count(*) from public.profiles") === "5",
    "Real Auth trigger created five profiles",
  );
  const approval = `local-test-approval-${randomUUID()}`;
  sqlDenied(
    "select private.bootstrap_aigenterra(array[]::uuid[],'local-test-approval')",
    "Explicit administrator IDs",
  );
  sqlDenied(
    `select private.bootstrap_aigenterra(array['${randomUUID()}']::uuid[],'local-test-approval')`,
    "existing confirmed",
  );
  sqlDenied(
    `select private.bootstrap_aigenterra(array['${users.admin.id}','${users.admin.id}']::uuid[],'local-test-approval')`,
    "Duplicate administrator",
  );
  sqlDenied(
    `set role authenticated; select private.bootstrap_aigenterra(array['${users.admin.id}']::uuid[],'local-test-approval')`,
    "permission denied",
  );
  sqlDenied(
    `set role service_role; select private.bootstrap_aigenterra(array['${users.admin.id}']::uuid[],'local-test-approval')`,
    "permission denied",
  );
  const unconfirmed = await http(
    "Auth creates unconfirmed local fixture",
    `${authURL}/admin/users`,
    {
      token: service,
      method: "POST",
      body: {
        email: `unconfirmed-${randomBytes(4).toString("hex")}@example.invalid`,
        password,
        email_confirm: false,
      },
    },
  );
  sqlDenied(
    `select private.bootstrap_aigenterra(array['${unconfirmed.data.id}']::uuid[],'local-test-approval')`,
    "existing confirmed",
  );
  const org = sql(
    `select private.bootstrap_aigenterra(array['${users.admin.id}']::uuid[],'${approval}')`,
  );
  check(validId(org), "Bootstrap created organization UUID");
  check(
    sql(
      `select private.bootstrap_aigenterra(array['${users.admin.id}']::uuid[],'${approval}')`,
    ) === org,
    "Bootstrap repeat is idempotent",
  );
  sqlDenied(
    `select private.bootstrap_aigenterra(array['${users.manager.id}']::uuid[],'another-local-approval')`,
    "already exists",
  );
  check(
    sql(
      `select count(*) from private.organization_bootstrap_audit where organization_id='${org}'`,
    ) === "1",
    "Bootstrap audit recorded once",
  );
  for (const role of ["manager", "accountant", "viewer"])
    sql(
      `insert into public.organization_memberships values ('${org}','${users[role].id}','${role}',now())`,
    );
  const otherOrg = sql(
    "insert into public.organizations(name,slug) values ('Isolated local fixture','isolated-local') returning id",
  ).split("\n")[0];
  sql(
    `insert into public.organization_memberships values ('${otherOrg}','${users.outsider.id}','admin',now())`,
  );
  // No se insertan facturas, pagos, gastos ni importes financieros.
  const client = (
    await http(
      "Admin creates scoped client",
      `${restURL}/clients`,
      {
        token: users.admin.token,
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: {
          organization_id: org,
          legal_name: "Local nonfinancial fixture",
        },
      },
      201,
    )
  ).data[0];
  for (const role of ["admin", "manager", "accountant", "viewer"]) {
    const rows = (
      await http(`${role} reads own client`, `${restURL}/clients?select=id`, {
        token: users[role].token,
      })
    ).data;
    check(
      rows.length === 1 && rows[0].id === client.id,
      `${role} scoped visibility`,
    );
  }
  check(
    (
      await http(
        "Other organization read isolation",
        `${restURL}/clients?select=id`,
        { token: users.outsider.token },
      )
    ).data.length === 0,
    "Other tenant cannot see rows",
  );
  await http(
    "Anonymous cannot read clients",
    `${restURL}/clients`,
    { token: anon },
    401,
  );
  for (const role of ["viewer", "accountant", "outsider"])
    await http(
      `${role} cannot insert CRM`,
      `${restURL}/clients`,
      {
        token: users[role].token,
        method: "POST",
        body: { organization_id: org, legal_name: "Denied fixture" },
      },
      403,
    );
  await http(
    "Manager edits own CRM",
    `${restURL}/clients?id=eq.${client.id}`,
    {
      token: users.manager.token,
      method: "PATCH",
      body: { legal_name: "Updated local fixture" },
    },
    204,
  );
  const deniedUpdate = await http(
    "Viewer update filtered by RLS",
    `${restURL}/clients?id=eq.${client.id}`,
    {
      token: users.viewer.token,
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: { legal_name: "Forbidden" },
    },
  );
  check(deniedUpdate.data.length === 0, "Viewer updated zero rows");
  check(
    (
      await http(
        "Stored value survives viewer update",
        `${restURL}/clients?id=eq.${client.id}&select=legal_name`,
        { token: users.admin.token },
      )
    ).data[0].legal_name === "Updated local fixture",
    "No unauthorized mutation",
  );
  await http(
    "Tenant reassignment rejected",
    `${restURL}/clients?id=eq.${client.id}`,
    {
      token: users.admin.token,
      method: "PATCH",
      body: { organization_id: otherOrg },
    },
    400,
  );
  await http(
    "Cross-organization FK rejected",
    `${restURL}/contacts`,
    {
      token: users.outsider.token,
      method: "POST",
      body: {
        organization_id: otherOrg,
        client_id: client.id,
        full_name: "Denied cross-tenant fixture",
      },
    },
    409,
  );
  for (const role of ["admin", "viewer", "outsider"])
    await http(
      `${role} cannot elevate membership`,
      `${restURL}/organization_memberships`,
      {
        token: users[role].token,
        method: "POST",
        body: {
          organization_id: org,
          user_id: users[role].id,
          role_id: "admin",
        },
      },
      403,
    );
  await http(
    "Private bootstrap not exposed",
    `${restURL}/rpc/bootstrap_aigenterra`,
    {
      token: users.admin.token,
      method: "POST",
      body: {
        authorized_admin_ids: [users.admin.id],
        approval_reference: approval,
      },
    },
    404,
  );
  await http(
    "Profile trigger not exposed",
    `${restURL}/rpc/create_auth_profile`,
    { token: users.viewer.token, method: "POST", body: {} },
    404,
  );
  check(
    (
      await http(
        "Only own membership visible",
        `${restURL}/organization_memberships`,
        { token: users.viewer.token },
      )
    ).data.every((row) => row.user_id === users.viewer.id),
    "Membership policy cannot leak other identities",
  );
  // Access tokens forged with a different signing key fail before RLS.
  const forged =
    users.viewer.token.slice(0, -15) + randomBytes(12).toString("base64url");
  await http(
    "Forged JWT rejected",
    `${restURL}/clients`,
    { token: forged },
    401,
  );
  await http(
    "Expired signed JWT rejected",
    `${restURL}/clients`,
    {
      token: jwt("authenticated", {
        sub: users.viewer.id,
        exp: Math.floor(Date.now() / 1000) - 60,
      }),
    },
    401,
  );
  const refreshed = await http(
    "Auth refresh grant",
    `${authURL}/token?grant_type=refresh_token`,
    { method: "POST", body: { refresh_token: users.viewer.refresh } },
  );
  secrets.push(refreshed.data.access_token, refreshed.data.refresh_token);
  check(
    typeof refreshed.data.access_token === "string",
    "Auth refresh returned session",
  );
  // Next.js usa exclusivamente la clave pública local, nunca service_role.
  const portServer = createServer();
  portServer.listen(0, "127.0.0.1");
  await once(portServer, "listening");
  const appPort = portServer.address().port;
  await new Promise((resolve) => portServer.close(resolve));
  const appURL = `http://127.0.0.1:${appPort}`;
  next = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "dev",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(appPort),
    ],
    {
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: supabaseURL,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: anon,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  next.stdout.on("data", (data) => {
    nextLogs = (nextLogs + data).slice(-8000);
  });
  next.stderr.on("data", (data) => {
    nextLogs = (nextLogs + data).slice(-8000);
  });
  await waitFor(
    "Next.js login",
    async () => (await fetch(`${appURL}/login`)).ok,
  );
  await http("Next guards workspace", `${appURL}/`, {}, 307);
  await http("Next anonymous API denied", `${appURL}/api/clients`, {}, 401);
  await http(
    "Next rejects CSRF",
    `${appURL}/api/auth/login`,
    { method: "POST", body: { email: users.admin.email, password } },
    403,
  );
  const login = await http("Next Auth login", `${appURL}/api/auth/login`, {
    method: "POST",
    headers: { Origin: appURL },
    body: { email: users.admin.email, password },
  });
  const cookie = login.response.headers
    .getSetCookie()
    .map((item) => item.split(";")[0])
    .join("; ");
  check(cookie.includes("sb-"), "Next login set SSR cookie");
  check(
    login.response.headers
      .getSetCookie()
      .every((item) => item.includes("HttpOnly")),
    "Session cookies are HttpOnly",
  );
  await http("Next authorized workspace", `${appURL}/`, {
    headers: { Cookie: cookie },
  });
  check(
    (
      await http("Next scoped client API", `${appURL}/api/clients`, {
        headers: { Cookie: cookie },
      })
    ).data.clients.length === 1,
    "Next API uses membership organization",
  );
  await http(
    "Next rejects organization cookie forgery",
    `${appURL}/api/clients`,
    { headers: { Cookie: `${cookie}; aigenterra-org=${otherOrg}` } },
    403,
  );
  await http(
    "Next rejects mass assignment",
    `${appURL}/api/clients`,
    {
      method: "POST",
      headers: { Origin: appURL, Cookie: cookie },
      body: { legal_name: "Denied", organization_id: otherOrg },
    },
    400,
  );
  const nextClient = await http(
    "Next authorized client mutation",
    `${appURL}/api/clients`,
    {
      method: "POST",
      headers: { Origin: appURL, Cookie: cookie },
      body: { legal_name: "Next local nonfinancial fixture" },
    },
    201,
  );
  check(validId(nextClient.data.client.id), "Next mutation returned UUID");
  const viewerLogin = await http(
    "Next viewer login",
    `${appURL}/api/auth/login`,
    {
      method: "POST",
      headers: { Origin: appURL },
      body: { email: users.viewer.email, password },
    },
  );
  const viewerCookie = viewerLogin.response.headers
    .getSetCookie()
    .map((item) => item.split(";")[0])
    .join("; ");
  await http(
    "Next viewer mutation denied",
    `${appURL}/api/clients`,
    {
      method: "POST",
      headers: { Origin: appURL, Cookie: viewerCookie },
      body: { legal_name: "Denied" },
    },
    403,
  );
  const sessionCookie = viewerLogin.response.headers
    .getSetCookie()
    .find((item) => item.startsWith("sb-"))
    .split(";")[0];
  const separator = sessionCookie.indexOf("=");
  const stored = JSON.parse(
    Buffer.from(
      sessionCookie.slice(separator + 1).replace(/^base64-/, ""),
      "base64url",
    ).toString(),
  );
  stored.expires_at = Math.floor(Date.now() / 1000) - 60;
  stored.access_token = jwt("authenticated", {
    sub: users.viewer.id,
    session_id: JSON.parse(
      Buffer.from(stored.access_token.split(".")[1], "base64url").toString(),
    ).session_id,
    exp: Math.floor(Date.now() / 1000) - 60,
  });
  const expiredCookie = `${sessionCookie.slice(0, separator)}=base64-${Buffer.from(JSON.stringify(stored)).toString("base64url")}`;
  const renewed = await http(
    "Next proxy refreshes expired session",
    `${appURL}/api/clients`,
    { headers: { Cookie: expiredCookie } },
  );
  check(
    renewed.response.headers
      .getSetCookie()
      .some((item) => item.startsWith("sb-")),
    "Proxy propagated refreshed cookie",
  );
  await http(
    "Next rejects invalid session cookie",
    `${appURL}/api/clients`,
    {
      headers: {
        Cookie: `${sessionCookie.slice(0, separator)}=invalid-session`,
      },
    },
    401,
  );
  const logout = await http("Next logout", `${appURL}/api/auth/logout`, {
    method: "POST",
    headers: { Origin: appURL, Cookie: cookie },
  });
  check(
    logout.response.headers
      .getSetCookie()
      .some((item) => item.includes("Max-Age=0")),
    "Logout clears session cookie",
  );
  check(
    sql("select count(*) from public.quotes") === "0" &&
      sql("select count(*) from public.contracts") === "0",
    "No commercial financial document fixtures",
  );
  check(
    sql("select count(*) from public.invoices") === "0" &&
      sql("select count(*) from public.payments") === "0" &&
      sql("select count(*) from public.expenses") === "0",
    "No financial fixtures",
  );
  console.log(
    `Auth/PostgREST/Next.js integration: ${assertions} assertions passed. Ephemeral fixtures will be removed.`,
  );
} catch (error) {
  console.error(scrub(error.message));
  if (nextLogs) console.error(scrub(nextLogs));
  for (const container of containers.filter(
    (name) => name.endsWith("-auth") || name.endsWith("-rest"),
  )) {
    try {
      const logs = spawnSync("docker", ["logs", "--tail", "20", container], {
        encoding: "utf8",
      });
      console.error(scrub(logs.stdout + logs.stderr));
    } catch {
      /* absent */
    }
  }
  process.exitCode = 1;
} finally {
  await cleanup();
}
function validId(value) {
  return /^[0-9a-f-]{36}$/.test(value);
}
