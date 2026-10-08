import { startLocalSMTP } from "./local-smtp.mjs";
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
let smtp;
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
    "--add-host",
    "host.docker.internal:host-gateway",
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
  smtp=await startLocalSMTP();
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
      GOTRUE_URI_ALLOW_LIST: "http://127.0.0.1:*/**",
      GOTRUE_SMTP_HOST: "host.docker.internal",
      GOTRUE_SMTP_PORT: String(smtp.port),
      GOTRUE_SMTP_ADMIN_EMAIL: "noreply@example.invalid",
      GOTRUE_SMTP_SENDER_NAME: "Local fixtures",
      GOTRUE_SMTP_MAX_FREQUENCY: "1s",
      GOTRUE_RATE_LIMIT_EMAIL_SENT: "100",
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
  check(
    sql(
      "select not rolsuper and rolbypassrls from pg_roles where rolname='postgres'",
    ) === "t",
    "Migration operator is not a superuser",
  );
  const preflight = readFileSync(
    "supabase/checks/staging-preflight.sql",
    "utf8",
  );
  sql(preflight);
  assertions++;
  sqlDenied(
    `set role authenticated; ${preflight}`,
    "reviewed postgres migration operator",
  );
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
      `insert into public.organization_memberships(organization_id,user_id,role_id,created_at) values ('${org}','${users[role].id}','${role}',now())`,
    );
  const otherOrg = sql(
    "insert into public.organizations(name,slug) values ('Isolated local fixture','isolated-local') returning id",
  ).split("\n")[0];
  sql(
    `insert into public.organization_memberships(organization_id,user_id,role_id,created_at) values ('${otherOrg}','${users.outsider.id}','admin',now())`,
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
  // Nuevas relaciones operativas: fixtures exclusivamente locales, sin importes.
  const localProject = (await http("Manager creates nonfinancial project", `${restURL}/projects`, {
    token: users.manager.token, method: "POST", headers: {Prefer:"return=representation"},
    body: {organization_id:org,client_id:client.id,name:"Local project fixture"},
  },201)).data[0];
  const work = (await http("Manager creates assigned milestone", `${restURL}/project_work_items`, {
    token:users.manager.token,method:"POST",headers:{Prefer:"return=representation"},
    body:{organization_id:org,project_id:localProject.id,kind:"milestone",title:"Local milestone fixture",assignee_id:users.manager.id},
  },201)).data[0];
  check(validId(work.id),"Milestone persisted under RLS");
  await http("Cross-tenant assignee rejected", `${restURL}/project_work_items`, {
    token:users.manager.token,method:"POST",body:{organization_id:org,project_id:localProject.id,kind:"activity",title:"Denied fixture",assignee_id:users.outsider.id},
  },409);
  check((await http("Outsider cannot see milestones", `${restURL}/project_work_items`,{token:users.outsider.token})).data.length===0,"Work isolated by organization");
  await http("Viewer cannot create activities",`${restURL}/project_work_items`,{
    token:users.viewer.token,method:"POST",body:{organization_id:org,project_id:localProject.id,kind:"activity",title:"Denied fixture"},
  },403);
  for(let n=0;n<30;n++) await http(`Assistant quota local request ${n+1}`,`${restURL}/assistant_requests`,{
    token:users.viewer.token,method:"POST",body:{organization_id:org},
  },201);
  await http("Assistant quota rejects request 31",`${restURL}/assistant_requests`,{
    token:users.viewer.token,method:"POST",body:{organization_id:org},
  },400);
  await http("Assistant cannot reset consumption",`${restURL}/assistant_requests`,{
    token:users.viewer.token,method:"DELETE",
  },403);
  await http("Assistant cannot impersonate another user",`${restURL}/assistant_requests`,{
    token:users.manager.token,method:"POST",body:{organization_id:org,user_id:users.viewer.id},
  },403);
  check((await http("Other tenant cannot see consumption",`${restURL}/assistant_requests`,{token:users.outsider.token})).data.length===0,"Quota logs tenant isolation");
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
  // Administración de usuarios: únicamente fixtures locales y sin correos externos.
  const rpc = (name) => `${restURL}/rpc/${name}`;
  const memberBody = {target_organization:org,target_user:users.viewer.id,new_role:"viewer",new_active:false};
  const roster = await http("Admin reads organizational roster",rpc("manage_organization_members"),{token:users.admin.token,method:"POST",body:{target_organization:org}});
  check(roster.data.length === 4 && roster.data.every(row=>row.user_id!==users.outsider.id),"Roster excludes other organization");
  for (const role of ["manager","accountant","viewer","outsider"])
    await http(`${role} cannot read administrative roster`,rpc("manage_organization_members"),{token:users[role].token,method:"POST",body:{target_organization:org}},403);
  await http("Admin cannot read another organization",rpc("manage_organization_members"),{token:users.admin.token,method:"POST",body:{target_organization:otherOrg}},403);
  await http("Viewer cannot escalate membership",rpc("change_organization_member"),{token:users.viewer.token,method:"POST",body:{...memberBody,new_role:"admin",new_active:true}},403);
  await http("Last admin cannot be suspended",rpc("change_organization_member"),{token:users.admin.token,method:"POST",body:{...memberBody,target_user:users.admin.id,new_role:"admin"}},400);
  await http("Admin cannot change foreign membership",rpc("change_organization_member"),{token:users.admin.token,method:"POST",body:{...memberBody,target_user:users.outsider.id}},400);
  await http("Admin suspends viewer",rpc("change_organization_member"),{token:users.admin.token,method:"POST",body:memberBody},204);
  check((await http("Suspended JWT cannot read clients",`${restURL}/clients`,{token:users.viewer.token})).data.length===0,"Existing token loses organization access");
  await http("Suspended member cannot run privileged RPC",rpc("manage_organization_members"),{token:users.viewer.token,method:"POST",body:{target_organization:org}},403);
  await http("Admin restores viewer",rpc("change_organization_member"),{token:users.admin.token,method:"POST",body:{...memberBody,new_active:true}},204);
  await http("Unconfirmed account cannot be linked",rpc("add_organization_member"),{token:users.admin.token,method:"POST",body:{target_organization:org,target_email:unconfirmed.data.email,new_role:"viewer"}},400);
  await http("Auth bans isolated local fixture",`${authURL}/admin/users/${users.outsider.id}`,{token:service,method:"PUT",body:{ban_duration:"1h"}});
  await http("Banned account cannot be linked",rpc("add_organization_member"),{token:users.admin.token,method:"POST",body:{target_organization:org,target_email:users.outsider.email,new_role:"viewer"}},400);
  await http("Auth unbans isolated local fixture",`${authURL}/admin/users/${users.outsider.id}`,{token:service,method:"PUT",body:{ban_duration:"none"}});
  await http("Admin links existing confirmed account",rpc("add_organization_member"),{token:users.admin.token,method:"POST",body:{target_organization:org,target_email:users.outsider.email,new_role:"viewer"}},204);
  await http("Duplicate membership rejected",rpc("add_organization_member"),{token:users.admin.token,method:"POST",body:{target_organization:org,target_email:users.outsider.email,new_role:"viewer"}},409);
  await http("Unknown account cannot be linked",rpc("add_organization_member"),{token:users.admin.token,method:"POST",body:{target_organization:org,target_email:"missing@example.invalid",new_role:"admin"}},400);
  check(sql(`select count(*) from private.membership_audit where organization_id='${org}'`)==="3","Membership changes audited without duplicate failure records");
  sql(`delete from public.organization_memberships where organization_id='${org}' and user_id='${users.outsider.id}'`);

  await http("Admin promotes second local administrator",rpc("change_organization_member"),{token:users.admin.token,method:"POST",body:{...memberBody,new_role:"admin",new_active:true}},204);
  const race = await Promise.all(["admin","viewer"].map(role=>fetch(rpc("change_organization_member"),{method:"POST",headers:{Authorization:`Bearer ${users[role].token}`,"Content-Type":"application/json"},body:JSON.stringify({target_organization:org,target_user:users[role].id,new_role:"manager",new_active:true})})));
  check(race.map(result=>result.status).sort().join(",")==="204,400","Concurrent self-demotions cannot remove last admin");
  check(sql(`select count(*) from public.organization_memberships where organization_id='${org}' and role_id='admin' and is_active`)==="1","One administrator remains after race");
  // Restauración exclusiva de los fixtures del contenedor, no existe conexión remota.
  sql(`update public.organization_memberships set role_id='admin' where organization_id='${org}' and user_id='${users.admin.id}'`);
  sql(`update public.organization_memberships set role_id='viewer' where organization_id='${org}' and user_id='${users.viewer.id}'`);
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
        AUTH_SITE_URL: appURL,
        AUTH_RECOVERY_SECRET: secret.slice(0, 64),
        SUPABASE_SECRET_KEY: service,
        SUPABASE_SERVICE_ROLE_KEY: "",
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
  await http("Next administrators can open user management",`${appURL}/usuarios`,{headers:{Cookie:cookie}});
  await http("User management rejects CSRF",`${appURL}/api/users`,{method:"PATCH",headers:{Cookie:cookie,Origin:"https://external.invalid"},body:{user_id:users.viewer.id,role_id:"admin",is_active:"true"}},403);
  await http("User management rejects forged organization",`${appURL}/api/users`,{method:"PATCH",headers:{Cookie:cookie,Origin:appURL},body:{user_id:users.viewer.id,role_id:"viewer",is_active:"true",organization_id:otherOrg}},400);
  await http("Next protects last administrator",`${appURL}/api/users`,{method:"PATCH",headers:{Cookie:cookie,Origin:appURL},body:{user_id:users.admin.id,role_id:"viewer",is_active:"true"}},400);
  const managementViewerLogin = await http("Viewer logs in for user management denial",`${appURL}/api/auth/login`,{method:"POST",headers:{Origin:appURL},body:{email:users.viewer.email,password}});
  const managementViewerCookie = managementViewerLogin.response.headers.getSetCookie().map(item=>item.split(";")[0]).join("; ");
  await http("Next viewer cannot change users",`${appURL}/api/users`,{method:"PATCH",headers:{Cookie:managementViewerCookie,Origin:appURL},body:{user_id:users.viewer.id,role_id:"admin",is_active:"true"}},403);
  await http("Next suspends member",`${appURL}/api/users`,{method:"PATCH",headers:{Cookie:cookie,Origin:appURL},body:{user_id:users.viewer.id,role_id:"viewer",is_active:"false"}});
  await http("Suspended SSR session cannot mutate users",`${appURL}/api/users`,{method:"PATCH",headers:{Cookie:managementViewerCookie,Origin:appURL},body:{user_id:users.viewer.id,role_id:"admin",is_active:"true"}},401);
  await http("Next restores member",`${appURL}/api/users`,{method:"PATCH",headers:{Cookie:cookie,Origin:appURL},body:{user_id:users.viewer.id,role_id:"viewer",is_active:"true"}});
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
  // Recorrido real del montaje local: sin gastos, cobros ni facturas ficticias.
  for(const path of ["/","/oportunidades","/proyectos","/cotizaciones","/contratos","/gastos","/tesoreria","/actividades","/inteligencia-artificial","/configuracion",`/proyectos/${localProject.id}`]) {
    const page=await http(`Operational page ${path}`,`${appURL}${path}`,{headers:{Cookie:cookie}});
    check(typeof page.data==="string" && !page.data.includes('role="alert"'),`Operational page ${path} loads without data errors`);
  }
  const nextOpportunity=await http("Next creates opportunity without financial estimate",`${appURL}/api/business/oportunidades`,{
    method:"POST",headers:{Origin:appURL,Cookie:cookie},body:{client_id:nextClient.data.client.id,title:"Local opportunity fixture",stage:"new"},
  },201);
  await http("Next edits scoped opportunity",`${appURL}/api/business/oportunidades?id=${nextOpportunity.data.record.id}`,{
    method:"PATCH",headers:{Origin:appURL,Cookie:cookie},body:{client_id:nextClient.data.client.id,title:"Local opportunity updated",stage:"qualified"},
  });
  for(const resource of ["oportunidades","proyectos","cotizaciones","contratos","gastos","tesoreria","actividades"])
    await http(`Viewer cannot write ${resource}`,`${appURL}/api/business/${resource}`,{method:"POST",headers:{Origin:appURL,Cookie:viewerCookie},body:{}},403);
  const assistant=await http("Next deterministic assistant uses scoped data",`${appURL}/api/assistant`,{
    method:"POST",headers:{Origin:appURL,Cookie:cookie},body:{message:"Resumen de proyectos"},
  });
  check(assistant.data.mode==="deterministic" && assistant.data.answer.includes("Local project fixture"),"Assistant is deterministic without external provider");
  await http("Next business rejects foreign origin",`${appURL}/api/business/proyectos`,{method:"POST",headers:{Origin:"https://untrusted.invalid",Cookie:cookie},body:{}},403);
  await http("Next rejects invalid monetary data before write",`${appURL}/api/business/gastos`,{
    method:"POST",headers:{Origin:appURL,Cookie:cookie},body:{supplier_name:"Local",description:"Invalid fixture",category:"Local",amount:"NaN",incurred_on:"2026-10-08",status:"recorded"},
  },400);
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
  {
  // Alta completamente desde Next.js: Auth Admin -> SMTP local -> confirmación -> contraseña -> membresía.
  const inviteEmail=`invited-${randomBytes(4).toString("hex")}@example.invalid`;
  await http("Viewer cannot invite users",`${appURL}/api/users`,{method:"POST",headers:{Origin:appURL,Cookie:viewerCookie},body:{email:inviteEmail,role_id:"admin"}},403);
  const sent=await http("Admin invites new identity from application",`${appURL}/api/users`,{method:"POST",headers:{Origin:appURL,Cookie:cookie},body:{email:inviteEmail,role_id:"manager"}});
  check(sent.data.success,"Application confirms sent invitation");
  const inviteId=sql(`select id from private.organization_invitations where email='${inviteEmail}'`);
  check(validId(inviteId),"Invitation persisted without membership");
  check(sql(`select count(*) from public.organization_memberships m join auth.users u on u.id=m.user_id where u.email='${inviteEmail}'`)==="0","Unaccepted invitation grants no organization access");
  await waitFor("local invitation email",()=>smtp.messages.some(message=>message.recipients.includes(inviteEmail)));
  const message=smtp.messages.find(message=>message.recipients.includes(inviteEmail));
  const source=message.body.replace(/=\r\n/g,"").replace(/=3D/g,"=").replace(/&amp;/g,"&");
  const link=[...source.matchAll(/https?:[^\s"<>]+/g)].map(match=>match[0]).find(value=>value.includes("/verify?"));
  check(!!link,"SMTP captures actual Auth confirmation link");
  const confirmationLink=new URL(link);
  check(confirmationLink.hostname==="127.0.0.1" && confirmationLink.pathname.endsWith("/verify"),"Captured link belongs to isolated Auth service");
  const confirmation=await fetch(`${authURL}/verify${confirmationLink.search}`,{redirect:"manual"});
  check(confirmation.status===302 || confirmation.status===303,"Auth validates actual invitation email link");
  const target=new URL(confirmation.headers.get("location"));
  check(target.origin===appURL && target.pathname===`/invitacion/${inviteId}`,"Auth redirects to exact local invitation page");
  const params=new URLSearchParams(target.hash.slice(1));
  const inviteTokens={invitationId:inviteId,accessToken:params.get("access_token"),refreshToken:params.get("refresh_token")};
  secrets.push(inviteTokens.accessToken,inviteTokens.refreshToken);
  await http("Invitation landing page is public",`${appURL}/invitacion/${inviteId}`);
  await http("Invitation verification rejects external Origin",`${appURL}/api/auth/invitations/verify`,{method:"POST",headers:{Origin:"https://external.invalid"},body:inviteTokens},403);
  await http("Another email cannot validate invitation",`${appURL}/api/auth/invitations/verify`,{method:"POST",headers:{Origin:appURL},body:{...inviteTokens,accessToken:users.viewer.token,refreshToken:users.viewer.refresh}},403);
  const validated=await http("Recipient validates email-bound invitation",`${appURL}/api/auth/invitations/verify`,{method:"POST",headers:{Origin:appURL},body:inviteTokens});
  const invitationGrant=validated.response.headers.getSetCookie().find(item=>item.startsWith("aigenterra-invitation=") && !item.includes("Max-Age=0"));
  check(invitationGrant?.includes("HttpOnly") && invitationGrant.includes("SameSite=strict"),"Invitation grant isolated and HttpOnly");
  const inviteCookie=invitationGrant.split(";")[0];secrets.push(inviteCookie);
  await http("Invitation password rejects forged role",`${appURL}/api/auth/invitations/accept`,{method:"POST",headers:{Origin:appURL,Cookie:inviteCookie},body:{password,confirmation:password,role_id:"admin"}},400);
  await http("Recipient establishes password and accepts",`${appURL}/api/auth/invitations/accept`,{method:"POST",headers:{Origin:appURL,Cookie:inviteCookie},body:{password,confirmation:password}});
  await http("Accepted invitation grant cannot replay",`${appURL}/api/auth/invitations/accept`,{method:"POST",headers:{Origin:appURL,Cookie:inviteCookie},body:{password,confirmation:password}},401);
  check(sql(`select m.role_id from public.organization_memberships m join auth.users u on u.id=m.user_id where u.email='${inviteEmail}' and m.organization_id='${org}'`)==="manager","Role comes exclusively from administrator invitation");
  const invitedLogin=await http("Invited user can use normal login",`${appURL}/api/auth/login`,{method:"POST",headers:{Origin:appURL},body:{email:inviteEmail,password}});
  const invitedCookie=invitedLogin.response.headers.getSetCookie().map(item=>item.split(";")[0]).join("; ");
  await http("Invited user accesses dashboard",`${appURL}/`,{headers:{Cookie:invitedCookie}});
  await http("Invited manager cannot administrate users",`${appURL}/api/users`,{method:"PATCH",headers:{Origin:appURL,Cookie:invitedCookie},body:{user_id:users.viewer.id,role_id:"admin",is_active:"true"}},403);
  check(sql(`select count(*) from private.membership_audit a join auth.users u on u.id=a.user_id where u.email='${inviteEmail}'`)==="1","Accepted invitation audited exactly once");
  await http("Admin invites an existing Auth identity",`${appURL}/api/users`,{method:"POST",headers:{Origin:appURL,Cookie:cookie},body:{email:users.outsider.email,role_id:"viewer"}});
  const existingInviteId=sql(`select id from private.organization_invitations where email='${users.outsider.email}'`);
  await http("Immediate resend is rate limited",`${appURL}/api/users/invitations/${existingInviteId}`,{method:"POST",headers:{Origin:appURL,Cookie:cookie}},429);
  sql(`update private.organization_invitations set updated_at=now()-interval '61 seconds' where id='${existingInviteId}'`);
  await http("Admin can resend from app",`${appURL}/api/users/invitations/${existingInviteId}`,{method:"POST",headers:{Origin:appURL,Cookie:cookie}});
  await http("Admin can cancel from app",`${appURL}/api/users/invitations/${existingInviteId}`,{method:"DELETE",headers:{Origin:appURL,Cookie:cookie}});
  await http("Cancelled invitation cannot grant membership",rpc("accept_organization_invitation"),{token:users.outsider.token,method:"POST",body:{invitation_id:existingInviteId}},403);
  await http("Outside admin cannot list invitations",rpc("list_organization_invitations"),{token:users.outsider.token,method:"POST",body:{target_organization:org}},403);
  check(sql(`select status from private.organization_invitations where id='${existingInviteId}'`)==="cancelled","Cancellation persists without modifying Auth account");
  smtp.rejectNext();
  const failedEmail=`smtp-failed-${randomBytes(4).toString("hex")}@example.invalid`;
  await http("SMTP failure is reported without false success",`${appURL}/api/users`,{method:"POST",headers:{Origin:appURL,Cookie:cookie},body:{email:failedEmail,role_id:"viewer"}},502);
  check(sql(`select status from private.organization_invitations where email='${failedEmail}'`)==="failed","Failed invitation remains available for resend");
  check(sql(`select count(*) from public.organization_memberships m join auth.users u on u.id=m.user_id where u.email='${failedEmail}'`)==="0","Failed delivery does not grant membership");

  }
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
  // Solo identidades existentes del montaje local; no correos ni datos remotos.
  await http("Recovery page is public", `${appURL}/recuperar`);
  const resetKnown = await http(
    "Recovery request known account",
    `${appURL}/api/auth/recovery/request`,
    {
      method: "POST",
      headers: { Origin: appURL },
      body: {
        email: users.admin.email,
        redirectTo: "https://untrusted.invalid",
      },
    },
  );
  const resetUnknown = await http(
    "Recovery request unknown account",
    `${appURL}/api/auth/recovery/request`,
    {
      method: "POST",
      headers: { Origin: appURL },
      body: { email: "absent@example.invalid" },
    },
  );
  check(
    JSON.stringify(resetKnown.data) === JSON.stringify(resetUnknown.data),
    "Recovery does not enumerate users",
  );
  await http(
    "Recovery rejects CSRF",
    `${appURL}/api/auth/recovery/request`,
    { method: "POST", body: { email: users.admin.email } },
    403,
  );
  await http(
    "Normal session cannot reset without a recovery grant",
    `${appURL}/api/auth/recovery/update`,
    {
      method: "POST",
      headers: { Origin: appURL, Cookie: viewerCookie },
      body: {
        password: "not-used-local-password",
        confirmation: "not-used-local-password",
      },
    },
    401,
  );
  const link = await http(
    "Generate local recovery link",
    `${authURL}/admin/generate_link`,
    {
      token: service,
      method: "POST",
      body: { type: "recovery", email: users.admin.email },
    },
  );
  const tokenHash = link.data.hashed_token;
  check(
    typeof tokenHash === "string",
    "Local Auth generated recovery token hash",
  );
  secrets.push(tokenHash);
  const verified = await http(
    "Verify local recovery link",
    `${appURL}/api/auth/recovery/verify`,
    {
      method: "POST",
      headers: { Origin: appURL },
      body: { tokenHash },
    },
  );
  check(
    !JSON.stringify(verified.data).includes("token"),
    "Recovery response never returns session tokens",
  );
  const grantCookie = verified.response.headers
    .getSetCookie()
    .find(
      (item) =>
        item.startsWith("aigenterra-recovery=") && !item.includes("Max-Age=0"),
    );
  check(
    grantCookie?.includes("HttpOnly") &&
      grantCookie?.includes("SameSite=strict"),
    "Recovery uses isolated HttpOnly Strict cookie",
  );
  const grantHeader = grantCookie.split(";")[0];
  await http(
    "Recovery link cannot be reused",
    `${appURL}/api/auth/recovery/verify`,
    {
      method: "POST",
      headers: { Origin: appURL },
      body: { tokenHash },
    },
    400,
  );
  const resetPassword = randomBytes(32).toString("hex");
  secrets.push(resetPassword);
  const updated = await http(
    "Recovery updates local password",
    `${appURL}/api/auth/recovery/update`,
    {
      method: "POST",
      headers: { Origin: appURL, Cookie: grantHeader },
      body: { password: resetPassword, confirmation: resetPassword },
    },
  );
  check(
    updated.response.headers
      .getSetCookie()
      .some(
        (item) =>
          item.startsWith("aigenterra-recovery=") &&
          (item.includes("Max-Age=0") ||
            item.includes("Expires=Thu, 01 Jan 1970")),
      ),
    "Recovery clears grant after success",
  );
  await http(
    "Consumed recovery grant cannot update again",
    `${appURL}/api/auth/recovery/update`,
    {
      method: "POST",
      headers: { Origin: appURL, Cookie: grantHeader },
      body: { password: resetPassword, confirmation: resetPassword },
    },
    401,
  );
  await http(
    "Old local password rejected",
    `${authURL}/token?grant_type=password`,
    { method: "POST", body: { email: users.admin.email, password } },
    400,
  );
  await http(
    "New local password works",
    `${authURL}/token?grant_type=password`,
    {
      method: "POST",
      body: { email: users.admin.email, password: resetPassword },
    },
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
  smtp?.close();
  await cleanup();
}
function validId(value) {
  return /^[0-9a-f-]{36}$/.test(value);
}
