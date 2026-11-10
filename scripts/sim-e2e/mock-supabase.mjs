// Servidor SIMULADO de Supabase (Auth + una pizca de REST) para probar la aplicación sin credenciales.
// NO es Supabase: no valida contraseñas con seguridad real, ni aplica RLS real, ni usa PostgreSQL.
// Sirve para ejercitar el flujo de cookies, proxy.ts, Server Actions y guardas de Next.js.
import http from "node:http";
import { randomUUID } from "node:crypto";

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
export const IDS = {
  pro: "11111111-1111-4111-8111-111111111111",
  ath: "22222222-2222-4222-8222-222222222222",
  noprofile: "33333333-3333-4333-8333-333333333333",
  inactive: "44444444-4444-4444-8444-444444444444",
};
export const A1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
export const A2 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
const PASSWORD = "clave-de-prueba-123";

const USERS = {
  "pro@sim.test": { id: IDS.pro, user_metadata: {} },
  // El deportista intenta colarse: su user_metadata dice "professional" (la app NO debe confiar en eso).
  "ath@sim.test": { id: IDS.ath, user_metadata: { role: "professional" } },
  "sinperfil@sim.test": { id: IDS.noprofile, user_metadata: {} },
  "inactivo@sim.test": { id: IDS.inactive, user_metadata: {} },
};
const PROFILES = {
  [IDS.pro]: { role: "professional", is_active: true },
  [IDS.ath]: { role: "athlete", is_active: true },
  [IDS.inactive]: { role: "professional", is_active: false },
};

/** Supabase tolera reutilizar un refresh token durante unos segundos tras rotarlo. */
const REUSE_WINDOW_MS = 10_000;

export function startMock({ port }) {
  const state = { sessions: new Map(), refresh: new Map(), used: new Map(), consumed: new Map(), expiresIn: 3600, down: false, counts: {} };
  const count = (k) => (state.counts[k] = (state.counts[k] ?? 0) + 1);

  const issue = (userId, email) => {
    const sid = randomUUID();
    const now = Math.floor(Date.now() / 1000);
    const exp = now + state.expiresIn;
    const access = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: userId, aud: "authenticated", role: "authenticated", email, session_id: sid, iat: now, exp })}.${Buffer.from(randomUUID()).toString("base64url")}`;
    const refresh = randomUUID();
    state.sessions.set(access, { userId, email, sid, revoked: false });
    state.refresh.set(refresh, { userId, email });
    return { access, refresh, exp };
  };
  const userObj = (email) => {
    const u = USERS[email];
    return { id: u.id, aud: "authenticated", role: "authenticated", email, email_confirmed_at: "2026-01-01T00:00:00Z",
      app_metadata: { provider: "email" }, user_metadata: u.user_metadata, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" };
  };

  const send = (res, status, body, headers = {}) => {
    res.writeHead(status, { "content-type": "application/json", "x-supabase-api-version": "2024-01-01", ...headers });
    res.end(body === undefined ? undefined : JSON.stringify(body));
  };
  const authErr = (res, status, code, message) => send(res, status, { code, error_code: code, message, msg: message });
  const sessionOf = (req) => {
    const token = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
    const s = state.sessions.get(token);
    return s && !s.revoked ? s : null;
  };
  const readBody = (req) => new Promise((r) => { let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => r(d ? JSON.parse(d) : {})); });

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const p = url.pathname;
    try {
      // ---- administración de la simulación
      if (p === "/__admin/state") return send(res, 200, { counts: state.counts, sessions: state.sessions.size });
      if (p === "/__admin/revoke-all") { for (const s of state.sessions.values()) s.revoked = true; state.refresh.clear(); state.consumed.clear(); state.used.clear(); return send(res, 200, { ok: true }); }
      if (p === "/__admin/down") { state.down = url.searchParams.get("on") === "1"; return send(res, 200, { down: state.down }); }
      if (p === "/__admin/expires-in") { state.expiresIn = Number(url.searchParams.get("s")); return send(res, 200, { ok: true }); }
      if (p === "/__admin/reset") { state.sessions.clear(); state.refresh.clear(); state.used.clear(); state.consumed.clear(); state.counts = {}; state.down = false; state.expiresIn = 3600; return send(res, 200, { ok: true }); }

      if (state.down) { count("dropped"); req.socket.destroy(); return; } // red caída: la conexión se corta

      // ---- Auth
      if (p === "/auth/v1/health") return send(res, 200, { name: "GoTrue-simulado" });
      if (p === "/auth/v1/token" && req.method === "POST") {
        const grant = url.searchParams.get("grant_type");
        const body = await readBody(req);
        if (grant === "password") {
          count("login");
          const u = USERS[String(body.email ?? "").toLowerCase()];
          if (!u || body.password !== PASSWORD) return authErr(res, 400, "invalid_credentials", "Invalid login credentials");
          const t = issue(u.id, body.email.toLowerCase());
          return send(res, 200, { access_token: t.access, token_type: "bearer", expires_in: state.expiresIn, expires_at: t.exp, refresh_token: t.refresh, user: userObj(body.email.toLowerCase()) });
        }
        if (grant === "refresh_token") {
          count("refresh");
          const reused = state.consumed.get(body.refresh_token);
          if (reused && Date.now() - reused.at <= REUSE_WINDOW_MS) { count("refresh_reuse_ok"); return send(res, 200, reused.payload); }
          const r = state.refresh.get(body.refresh_token);
          if (!r) { count("refresh_fail"); return authErr(res, 400, "refresh_token_not_found", "Invalid Refresh Token: Refresh Token Not Found"); }
          state.refresh.delete(body.refresh_token);
          const t = issue(r.userId, r.email);
          const payload = { access_token: t.access, token_type: "bearer", expires_in: state.expiresIn, expires_at: t.exp, refresh_token: t.refresh, user: userObj(r.email) };
          state.consumed.set(body.refresh_token, { at: Date.now(), payload });
          count("refresh_ok");
          return send(res, 200, payload);
        }
      }
      if (p === "/auth/v1/user") {
        count("getUser");
        const s = sessionOf(req);
        if (!s) return authErr(res, 403, "session_not_found", "Session from session_id claim in JWT does not exist");
        return send(res, 200, userObj(s.email));
      }
      if (p === "/auth/v1/logout" && req.method === "POST") {
        count("logout");
        const s = sessionOf(req);
        if (s) s.revoked = true;
        return send(res, 204);
      }

      // ---- REST mínimo (simula lo que RLS dejaría ver)
      if (p.startsWith("/rest/v1/")) {
        const s = sessionOf(req);
        if (!s) return send(res, 401, { code: "PGRST301", message: "JWT expired" });
        const table = p.slice("/rest/v1/".length);
        const accept = req.headers.accept ?? "";
        const asObj = (rows) => (accept.includes("vnd.pgrst.object") ? (rows[0] ?? null) : rows);
        if (table === "profiles") {
          count("profiles");
          const wanted = (url.searchParams.get("id") ?? "").replace(/^eq\./, "");
          const row = wanted === s.userId ? PROFILES[s.userId] : undefined; // RLS: solo el propio
          return send(res, 200, asObj(row ? [row] : []));
        }
        if (table === "athletes") {
          count("athletes");
          const rows = s.userId === IDS.pro
            ? [{ id: A1, display_name: "Atleta SIM 1", category: { name: "Juvenil" }, team_memberships: [{ ends_on: null, team: { name: "Equipo SIM" } }] },
               { id: A2, display_name: "Atleta SIM 2", category: { name: "Adulto" }, team_memberships: [] }]
            : [];
          return send(res, 200, rows);
        }
        if (table === "wellbeing_records") return send(res, 200, s.userId === IDS.pro ? [{ athlete_id: A1 }] : []);
        if (["nutrition_records", "hydration_records", "training_records"].includes(table)) return send(res, 200, []);
        if (table === "categories") return send(res, 200, [], { "content-range": "*/0" });
        return send(res, 404, { code: "42P01", message: "tabla desconocida en la simulación" });
      }
      send(res, 404, { message: "no encontrado" });
    } catch {
      send(res, 500, { message: "error en la simulación" });
    }
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve({ server, state, close: () => new Promise((r) => server.close(r)) })));
}
export { PASSWORD };
