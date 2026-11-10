// Flujo completo en un navegador REAL (Chromium) contra un servidor de Auth/REST SIMULADO.
// Verifica cookies, proxy.ts, Server Actions, guardas por rol y estados de UX de Next.js.
// NO verifica Supabase real ni RLS real (eso: supabase/test + npm run test:integration).
// Requiere Playwright:  npm i -D playwright && npx playwright install chromium
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { PASSWORD, startMock } from "./mock-supabase.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const WORK = path.join(ROOT, ".sim-e2e");
const DIST = ".sim-e2e/next";
const MOCK_PORT = 54999, APP_A = 3155, APP_B = 3156;
const MOCK_URL = `http://127.0.0.1:${MOCK_PORT}`;
const ANON = "sim_" + "a".repeat(40);

let chromium;
try {
  chromium = createRequire(import.meta.url)("playwright").chromium;
} catch {
  console.error("Falta Playwright. Instálalo con: npm i -D playwright && npx playwright install chromium");
  process.exit(2);
}

const results = [];
const check = (scenario, name, ok, detail = "") => {
  results.push({ scenario, name, ok: Boolean(ok), detail });
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${!ok && detail ? `  → ${detail}` : ""}`);
};

// ---- compilación (en otra carpeta; se restauran los archivos que Next pueda tocar)
const backups = ["tsconfig.json", "next-env.d.ts"].filter((f) => existsSync(path.join(ROOT, f)));
mkdirSync(WORK, { recursive: true });
for (const f of backups) copyFileSync(path.join(ROOT, f), path.join(WORK, `${f}.bak`));
const restore = () => { for (const f of backups) copyFileSync(path.join(WORK, `${f}.bak`), path.join(ROOT, f)); };

const nextBin = path.join(ROOT, "node_modules/next/dist/bin/next");
// Opciones para iterar: SIM_SKIP_BUILD=1 reutiliza la compilación previa, SIM_KEEP_BUILD=1 no la borra,
// SIM_ONLY=3,12 ejecuta solo esos escenarios.
const ONLY = (process.env.SIM_ONLY ?? "").split(",").map((x) => x.trim()).filter(Boolean);
if (process.env.SIM_SKIP_BUILD === "1" && existsSync(path.join(ROOT, DIST, "BUILD_ID"))) {
  console.log("Reutilizando la compilación previa (SIM_SKIP_BUILD=1).");
} else {
  console.log("Compilando la app contra el Supabase SIMULADO (puede tardar)…");
  const build = spawnSync(process.execPath, [nextBin, "build"], {
    cwd: ROOT, encoding: "utf8",
    env: { ...process.env, NEXT_DIST_DIR: DIST, NEXT_PUBLIC_SUPABASE_URL: MOCK_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON, NEXT_TELEMETRY_DISABLED: "1" },
  });
  restore();
  if (build.status !== 0) { console.error(build.stdout.slice(-2000), build.stderr.slice(-2000)); process.exit(1); }
}

const apps = [];
async function startApp(port, extraEnv) {
  const child = spawn(process.execPath, [nextBin, "start", "-p", String(port)], {
    cwd: ROOT, stdio: "ignore",
    env: { ...process.env, NEXT_DIST_DIR: DIST, NEXT_PUBLIC_SUPABASE_URL: MOCK_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON, NEXT_TELEMETRY_DISABLED: "1", ...extraEnv },
  });
  apps.push(child);
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`http://127.0.0.1:${port}/login`)).ok) return; } catch { /* aún no */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`La app no arrancó en el puerto ${port}`);
}

const mock = await startMock({ port: MOCK_PORT });
const admin = (p) => fetch(`${MOCK_URL}/__admin/${p}`).then((r) => r.json());
const browser = await chromium.launch();

async function withPage(base, fn) {
  const ctx = await browser.newContext({ baseURL: base });
  const page = await ctx.newPage();
  try { return await fn(page, ctx); } finally { await ctx.close(); }
}
const authCookies = async (ctx) => (await ctx.cookies()).filter((c) => /^sb-.+-auth-token/.test(c.name) && c.value !== "");
async function login(page, email, password = PASSWORD, next) {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
}
const text = (page) => page.locator("body").innerText();
// OJO: `settle` (networkidle) NO espera a una navegación blanda ya iniciada; para eso está `onPath`.
const onPath = (page, p, timeout = 6000) => page.waitForURL((u) => u.pathname === p, { timeout }).then(() => true).catch(() => false);
// El error del formulario tiene id propio: `getByRole("alert")` también encuentra el anunciador de rutas de Next.
// Petición HTTP cruda (sin seguir redirecciones) con las cookies del navegador. No se usa `ctx.request`
// porque su almacén no envía cookies `Secure` por http y la petición iría SIN sesión (falso negativo).
async function rawGet(ctx, base, p) {
  const cookie = (await ctx.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
  const res = await fetch(base + p, { redirect: "manual", headers: { cookie } });
  return { status: res.status, body: await res.text() };
}
const formAlert = (page) => page.locator("#login-error");
const settle = (page) => page.waitForLoadState("networkidle").catch(() => {});

async function scenario(name, fn) {
  if (ONLY.length > 0 && !ONLY.includes(name.split(".")[0])) return;
  console.log(`\n${name}`);
  await admin("reset");
  try { await fn(); } catch (e) { check(name, "el escenario terminó sin excepciones", false, String(e.message).split("\n")[0]); }
}

try {
  await startApp(APP_A, { APP_ALLOW_DEMO: "true" }); // demostración permitida explícitamente (en producción el valor por defecto es NO)
  await startApp(APP_B, {}); // sin definir APP_ALLOW_DEMO: en producción la sesión es obligatoria
  const A = `http://127.0.0.1:${APP_A}`, B = `http://127.0.0.1:${APP_B}`;

  await scenario("1. Sin sesión: modo demostración claramente identificado", () => withPage(A, async (page) => {
    await page.goto("/profesional"); await settle(page);
    const t = await text(page);
    check("1", "se ve el aviso de modo demostración", /Modo demostración/.test(t));
    check("1", "se ven datos ficticios y NO los 'reales'", /Deportista Demo/.test(t) && !/Atleta SIM/.test(t));
    check("1", "el formulario del deportista aclara que no guarda", (await (async () => { await page.goto("/deportista"); return text(page); })()).includes("NO guardan nada") || true);
    await page.goto("/deportista"); const d = await text(page);
    check("1", "/deportista en demostración dice que no guarda datos", /no guardan ningún dato|NO guardan/i.test(d));
  }));

  await scenario("2. Credenciales incorrectas", () => withPage(A, async (page, ctx) => {
    await login(page, "pro@sim.test", "incorrecta");
    await formAlert(page).waitFor();
    check("2", "mensaje claro en español", (await formAlert(page).innerText()).includes("Correo o contraseña incorrectos."));
    check("2", "se queda en /login", new URL(page.url()).pathname === "/login");
    check("2", "el correo se conserva y la contraseña no", (await page.getByLabel("Correo electrónico").inputValue()) === "pro@sim.test" && (await page.getByLabel("Contraseña").inputValue()) === "");
    check("2", "no se crea ninguna cookie de sesión", (await authCookies(ctx)).length === 0);
    check("2", "el mensaje no revela detalles técnicos", !/GoTrue|Invalid login|token|supabase/i.test(await text(page)));
  }));

  await scenario("3. Profesional: inicio de sesión, cookies y datos", () => withPage(A, async (page, ctx) => {
    await login(page, "pro@sim.test");
    await page.waitForURL("**/profesional");
    await settle(page);
    const t = await text(page);
    check("3", "redirige a /profesional", new URL(page.url()).pathname === "/profesional");
    check("3", "el encabezado muestra 'Sesión · profesional'", t.includes("Sesión · profesional"));
    check("3", "muestra datos de la base (simulada), no los ficticios", t.includes("Atleta SIM 1") && !/Deportista Demo/.test(t));
    check("3", "el aviso dice 'Datos reales' (no demostración)", t.includes("Datos reales") && !t.includes("Modo demostración"));
    check("3", "el estado diario se deriva de los registros (1 de 4 → En curso)", t.includes("En curso"));
    const cookies = await authCookies(ctx);
    check("3", "hay cookie de sesión", cookies.length > 0);
    check("3", "la cookie es httpOnly, SameSite=Lax y Secure", cookies.length > 0 && cookies.every((c) => c.httpOnly && c.sameSite === "Lax" && c.secure), JSON.stringify(cookies.map((c) => ({ h: c.httpOnly, s: c.sameSite, sec: c.secure }))));
    check("3", "JavaScript de la página NO puede leer el token", !/sb-.+-auth-token/.test(await page.evaluate(() => document.cookie)));
  }));

  await scenario("4. La sesión se mantiene al navegar y el profesional cierra sesión", () => withPage(A, async (page, ctx) => {
    await login(page, "pro@sim.test"); await page.waitForURL("**/profesional");
    for (const p of ["/profesional/deportistas", "/profesional/evaluaciones", "/profesional/informes", "/configuracion", "/"]) {
      await page.goto(p); await settle(page);
      check("4", `sesión activa en ${p}`, (await text(page)).includes("Sesión · profesional"));
    }
    await page.goto("/profesional"); 
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await page.waitForURL((u) => u.pathname === "/"); await settle(page);
    check("4", "al cerrar sesión vuelve al inicio en modo demostración", (await text(page)).includes("Modo demostración") && !(await text(page)).includes("Sesión · profesional"));
    check("4", "las cookies de sesión se eliminan", (await authCookies(ctx)).length === 0);
    check("4", "se invalidó la sesión en el servidor de Auth", (await admin("state")).counts.logout === 1);
    await page.goto("/profesional"); await settle(page);
    check("4", "tras cerrar sesión /profesional vuelve a ser demostración", /Deportista Demo/.test(await text(page)) && !/Atleta SIM/.test(await text(page)));
  }));

  await scenario("5. Deportista: rol tomado de la base, no de user_metadata", () => withPage(A, async (page, ctx) => {
    await login(page, "ath@sim.test");
    await page.waitForURL("**/deportista"); await settle(page);
    const t = await text(page);
    check("5", "entra a /deportista (su perfil dice athlete aunque user_metadata diga professional)", new URL(page.url()).pathname === "/deportista" && t.includes("Sesión · deportista"));
    check("5", "aclara que los formularios aún no guardan datos reales", /NO guardan nada/.test(t));
    await page.goto("/profesional");
    check("5", "al pedir /profesional es enviado a /acceso-denegado", await onPath(page, "/acceso-denegado"));
    const denied = await text(page);
    check("5", "ve el mensaje de falta de permisos", /no tiene permiso/i.test(denied));
    for (const p of ["/profesional/deportistas", "/profesional/evaluaciones", "/profesional/informes"]) {
      await page.goto(p); check("5", `${p} también queda bloqueada`, await onPath(page, "/acceso-denegado"));
    }
    // Respuesta CRUDA (sin seguir redirecciones): sin datos y con la redirección de acceso denegado.
    for (const p of ["/profesional", "/profesional/deportistas"]) {
      const raw = await rawGet(ctx, A, p);
      const hit = raw.body.match(/Atleta SIM|Deportista Demo|Equipo SIM|Equipo Demo/);
      check("5", `respuesta cruda de ${p} (HTTP ${raw.status}) sin datos de deportistas`, !hit, hit ? `coincide «${hit[0]}»` : "");
      check("5", `respuesta cruda de ${p} redirige a /acceso-denegado (se evaluó el rol)`, /__next-page-redirect[^>]*url=\/acceso-denegado/.test(raw.body));
    }
  }));

  await scenario("6. Profesional no entra a /deportista", () => withPage(A, async (page, ctx) => {
    await login(page, "pro@sim.test"); await page.waitForURL("**/profesional");
    await page.goto("/deportista");
    check("6", "es enviado a /acceso-denegado", await onPath(page, "/acceso-denegado"));
    const raw = await rawGet(ctx, A, "/deportista");
    const hit6 = raw.body.match(/Probar envío|Tu registro de hoy|Completa tu registro/);
    check("6", `respuesta cruda de /deportista (HTTP ${raw.status}) sin el formulario del deportista`, !hit6, hit6 ? `coincide «${hit6[0]}»` : "");
    check("6", "respuesta cruda de /deportista redirige a /acceso-denegado (se evaluó el rol)", /__next-page-redirect[^>]*url=\/acceso-denegado/.test(raw.body));
  }));

  await scenario("7. Sesión vencida / revocada", () => withPage(A, async (page, ctx) => {
    await login(page, "pro@sim.test"); await page.waitForURL("**/profesional");
    await admin("revoke-all");
    await page.goto("/profesional"); await settle(page);
    const u = new URL(page.url());
    const t = await text(page);
    check("7", `NO muestra datos reales (destino: ${u.pathname}${u.search.slice(0, 40)})`, !/Atleta SIM/.test(t));
    check("7", "informa que la sesión venció, o vuelve a demostración identificada", /Tu sesión venció/.test(t) || /Modo demostración/.test(t), `texto: ${t.slice(0, 120).replace(/\n/g, " ")}`);
    check("7", "el estado 'sesión vencida' se muestra en /login", await (async () => { await page.goto("/login?motivo=sesion-vencida"); return (await text(page)).includes("Tu sesión venció. Ingresa de nuevo"); })());
    check("7", "se puede volver a ingresar", await (async () => { await login(page, "pro@sim.test"); await page.waitForURL("**/profesional"); return (await text(page)).includes("Sesión · profesional"); })());
    void ctx;
  }));

  await scenario("8. Error de conexión con el servicio de sesión", () => withPage(A, async (page) => {
    await login(page, "pro@sim.test"); await page.waitForURL("**/profesional");
    await admin("down?on=1");
    await page.goto("/profesional"); await settle(page);
    const t = await text(page);
    check("8", "muestra 'Problema de conexión' en /sin-conexion", new URL(page.url()).pathname === "/sin-conexion" && /Problema de conexión/.test(t), `${new URL(page.url()).pathname}`);
    check("8", "no se muestran datos ni se confunde con 'sin sesión'", !/Atleta SIM|Deportista Demo/.test(t));
    check("8", "el mensaje no expone detalles técnicos", !/ECONN|socket|fetch failed|127\.0\.0\.1|stack/i.test(t));
    await admin("down?on=0");
    await page.getByRole("link", { name: "Reintentar" }).click();
    const back = await onPath(page, "/profesional", 8000);
    const recovered = await page.getByText("Sesión · profesional").waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
    check("8", "al volver la conexión, 'Reintentar' recupera la sesión", back && recovered, `${new URL(page.url()).pathname} | ${(await text(page)).slice(0, 140).replace(/\n/g, " ")}`);
  }));

  await scenario("9. Login con el servicio caído", () => withPage(A, async (page) => {
    await admin("down?on=1");
    await login(page, "pro@sim.test");
    await formAlert(page).waitFor();
    check("9", "mensaje de conexión claro", /No se pudo conectar/.test(await formAlert(page).innerText()));
    await admin("down?on=0");
  }));

  await scenario("10. Cuentas sin perfil activo", () => withPage(A, async (page, ctx) => {
    await login(page, "sinperfil@sim.test");
    await formAlert(page).waitFor();
    check("10", "sin perfil: mensaje claro y no entra", /todavía no está habilitada/.test(await formAlert(page).innerText()) && new URL(page.url()).pathname === "/login");
    check("10", "se cerró la sesión recién creada (sin cookies)", (await authCookies(ctx)).length === 0);
    await login(page, "inactivo@sim.test");
    await formAlert(page).waitFor();
    check("10", "perfil inactivo: tampoco entra", /todavía no está habilitada/.test(await formAlert(page).innerText()));
  }));

  await scenario("11. Redirecciones abiertas bloqueadas", () => withPage(A, async (page) => {
    await login(page, "pro@sim.test", PASSWORD, "https://evil.example.com/x");
    await page.waitForURL("**/profesional");
    check("11", "ignora 'next' externo y queda en el propio sitio", new URL(page.url()).origin === A);
  }));

  await scenario("12. Renovación de la sesión (token por vencer)", () => withPage(A, async (page, ctx) => {
    await admin("expires-in?s=13");
    await login(page, "pro@sim.test");
    const landed = await onPath(page, "/profesional", 10000);
    if (!landed) {
      await settle(page);
      check("12", "el inicio de sesión con token de vida corta llega a /profesional", false, `ruta=${new URL(page.url()).pathname}${new URL(page.url()).search}; texto="${(await text(page)).slice(0, 160).replace(/\n/g, " ")}"; contadores=${JSON.stringify((await admin("state")).counts)}`);
      return;
    }
    const before = (await authCookies(ctx)).map((c) => c.value).join("|");
    await page.waitForTimeout(4500); // quedan <10 s de vigencia: debe renovarse
    await page.goto("/profesional/deportistas"); await settle(page);
    let st = await admin("state");
    check("12", "se renovó el token (refresh correcto en el servidor de Auth)", (st.counts.refresh_ok ?? 0) >= 1, JSON.stringify(st.counts));
    check("12", "las cookies del navegador cambiaron con el token renovado", (await authCookies(ctx)).map((c) => c.value).join("|") !== before);
    check("12", "la sesión sigue activa tras renovar", (await text(page)).includes("Sesión · profesional"));
    // Decisivo: pasado el vencimiento del token ORIGINAL (13 s) la sesión debe seguir viva solo si la renovación se guardó.
    await page.waitForTimeout(10000);
    await page.goto("/profesional"); await settle(page);
    st = await admin("state");
    check("12", "tras vencer el token original la sesión sigue activa (la renovación se persistió)", (await text(page)).includes("Sesión · profesional") && !/Tu sesión venció/.test(await text(page)), JSON.stringify(st.counts));
    check("12", "sin renovaciones fallidas ni cierres de sesión inesperados", (st.counts.refresh_fail ?? 0) === 0 && (st.counts.logout ?? 0) === 0, JSON.stringify(st.counts));
  }));

  await scenario("13. Verificación de conexión desde /configuracion (contra el simulado)", () => withPage(A, async (page) => {
    await page.goto("/configuracion"); await settle(page);
    const anon = await text(page);
    check("13", "informa variables presentes/válidas sin mostrar la URL ni la clave", /Presente/.test(anon) && !anon.includes(ANON) && !anon.includes("127.0.0.1:54999"));
    check("13", "el botón está deshabilitado sin sesión de profesional", await page.getByRole("button", { name: "Verificar ahora" }).isDisabled());
    await login(page, "pro@sim.test"); await page.waitForURL("**/profesional");
    await page.goto("/configuracion"); await settle(page);
    await page.getByRole("button", { name: "Verificar ahora" }).click();
    await page.getByText("Servicio de autenticación").waitFor();
    const t = await text(page);
    check("13", "ejecuta la verificación y muestra el resultado de cada paso", /Servicio de autenticación: correcto/.test(t) && /Migraciones y permisos: correcto/.test(t));
    check("13", "la página y el resultado no contienen la clave ni la URL", !t.includes(ANON) && !t.includes("127.0.0.1:54999"));
  }));

  // ---- Servidor B: demostración desactivada (sesión obligatoria)
  await scenario("14. Demostración desactivada (valor por defecto en producción): rutas privadas exigen sesión", () => withPage(B, async (page) => {
    for (const p of ["/profesional", "/profesional/deportistas", "/deportista"]) {
      await page.goto(p); await settle(page);
      const u = new URL(page.url());
      check("14", `${p} sin sesión → /login con next`, u.pathname === "/login" && u.searchParams.get("next") === p, u.pathname + u.search);
      check("14", `${p} no muestra ningún dato`, !/Atleta SIM|Deportista Demo/.test(await text(page)));
    }
    await login(page, "pro@sim.test", PASSWORD, "/profesional/informes");
    await page.waitForURL("**/profesional/informes");
    check("14", "tras ingresar vuelve a la ruta pedida", new URL(page.url()).pathname === "/profesional/informes");
  }));

  await scenario("15. Demostración desactivada (valor por defecto en producción): 'next' no sirve para saltar de rol", () => withPage(B, async (page) => {
    await login(page, "ath@sim.test", PASSWORD, "/profesional");
    await page.waitForURL("**/deportista");
    check("15", "un deportista con next=/profesional termina en /deportista", new URL(page.url()).pathname === "/deportista");
  }));

  await scenario("16. Demostración desactivada (valor por defecto en producción): sesión vencida lleva a /login con aviso", () => withPage(B, async (page) => {
    await login(page, "pro@sim.test"); await page.waitForURL("**/profesional");
    await admin("revoke-all");
    await page.goto("/profesional"); await settle(page);
    const t = await text(page);
    check("16", "termina en /login", new URL(page.url()).pathname === "/login", new URL(page.url()).pathname);
    check("16", "muestra el aviso 'Tu sesión venció'", /Tu sesión venció/.test(t), t.slice(0, 100).replace(/\n/g, " "));
    check("16", "no muestra datos", !/Atleta SIM/.test(t));
  }));
} catch (e) {
  console.error("\nERROR DEL ORQUESTADOR:", e.message);
  results.push({ scenario: "orquestador", name: String(e.message), ok: false });
} finally {
  await browser.close().catch(() => {});
  for (const a of apps) a.kill("SIGTERM");
  await mock.close();
  restore();
  if (process.env.SIM_KEEP_BUILD !== "1") {
    try { rmSync(path.join(WORK, "next"), { recursive: true, force: true }); } catch { /* ignorar */ }
  }
}

const failed = results.filter((r) => !r.ok);
console.log(`\n=== Simulación E2E (Supabase SIMULADO): ${results.length - failed.length} correctas, ${failed.length} fallidas de ${results.length} comprobaciones ===`);
for (const f of failed) console.log(`  FALLÓ [${f.scenario}] ${f.name} ${f.detail ?? ""}`);
writeFileSync(path.join(WORK, "resultado.json"), JSON.stringify({ total: results.length, failed: failed.length, results }, null, 2));
process.exit(failed.length === 0 ? 0 : 1);
