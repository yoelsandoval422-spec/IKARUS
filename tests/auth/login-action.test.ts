import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ server: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.server }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  },
}));

import { signInAction, signOutAction } from "@/app/login/actions";
import { loginSchema, mapAuthError, MSG_NOT_CONFIGURED, MSG_NO_PROFILE } from "@/lib/auth/login";

const form = (v: Record<string, string>) => {
  const f = new FormData();
  for (const [k, val] of Object.entries(v)) f.set(k, val);
  return f;
};

function fakeClient(opts: {
  signIn?: unknown;
  signInThrows?: boolean;
  profile?: unknown;
}) {
  const signOut = vi.fn(async () => ({ error: null }));
  const signInWithPassword = vi.fn(async () => {
    if (opts.signInThrows) throw new TypeError("fetch failed");
    return opts.signIn;
  });
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq"]) b[m] = () => b;
  b.maybeSingle = async () => ({ data: opts.profile ?? null, error: null });
  return { client: { auth: { signInWithPassword, signOut }, from: () => b }, signOut, signInWithPassword };
}
const ok = (id = "u1") => ({ data: { user: { id, user_metadata: { role: "professional" } } }, error: null });

beforeEach(() => mocks.server.mockReset());

describe("validación del formulario", () => {
  it("acepta correo y contraseña válidos", () => {
    expect(loginSchema.safeParse({ email: " a@b.com ", password: "x" }).success).toBe(true);
  });
  it.each([
    [{ email: "", password: "x" }, "Ingresa tu correo."],
    [{ email: "no-es-correo", password: "x" }, "El correo no tiene un formato válido."],
    [{ email: "a@b.com", password: "" }, "Ingresa tu contraseña."],
  ])("rechaza %j", (input, msg) => {
    const r = loginSchema.safeParse(input);
    expect(r.success).toBe(false);
    expect(!r.success && r.error.issues[0]?.message).toBe(msg);
  });
});

describe("mapAuthError: mensajes claros, sin filtrar detalles", () => {
  it.each([
    [{ code: "invalid_credentials", status: 400 }, "Correo o contraseña incorrectos."],
    [{ code: "user_not_found" }, "Correo o contraseña incorrectos."],
    [{ code: "email_not_confirmed" }, "Debes confirmar tu correo antes de ingresar."],
    [{ code: "user_banned" }, "Tu cuenta está deshabilitada. Contacta al profesional responsable."],
    [{ status: 429 }, "Demasiados intentos. Espera unos minutos e intenta de nuevo."],
    [{ code: "over_request_rate_limit" }, "Demasiados intentos. Espera unos minutos e intenta de nuevo."],
    [{ name: "AuthRetryableFetchError", status: 0 }, "No se pudo conectar con el servicio de autenticación. Intenta de nuevo en un momento."],
    [{ status: 503 }, "No se pudo conectar con el servicio de autenticación. Intenta de nuevo en un momento."],
    [{}, "No se pudo iniciar sesión. Intenta de nuevo."],
  ])("%j", (err, msg) => expect(mapAuthError(err)).toBe(msg));
});

describe("signInAction", () => {
  it("campos inválidos → errores por campo y NO llama a Supabase", async () => {
    const r = await signInAction({}, form({ email: "mal", password: "" }));
    expect(r.fieldErrors).toEqual({ email: "El correo no tiene un formato válido.", password: "Ingresa tu contraseña." });
    expect(mocks.server).not.toHaveBeenCalled();
  });

  it("Supabase sin configurar → mensaje claro (modo demostración)", async () => {
    mocks.server.mockResolvedValue(null);
    expect(await signInAction({}, form({ email: "a@b.com", password: "x" }))).toEqual({ error: MSG_NOT_CONFIGURED, email: "a@b.com" });
  });

  it("credenciales incorrectas → mensaje único; conserva el correo y nunca devuelve la contraseña", async () => {
    const { client } = fakeClient({ signIn: { data: { user: null }, error: { code: "invalid_credentials", status: 400, message: "Invalid login credentials" } } });
    mocks.server.mockResolvedValue(client);
    const r = await signInAction({}, form({ email: "a@b.com", password: "secreto123" }));
    expect(r).toEqual({ error: "Correo o contraseña incorrectos.", email: "a@b.com" });
    expect(JSON.stringify(r)).not.toContain("secreto123");
  });

  it("falla de red al autenticar → mensaje de conexión (sin lanzar)", async () => {
    const { client } = fakeClient({ signInThrows: true });
    mocks.server.mockResolvedValue(client);
    const r = await signInAction({}, form({ email: "a@b.com", password: "x" }));
    expect(r.error).toMatch(/No se pudo conectar/);
  });

  it("profesional válido → redirige a /profesional", async () => {
    const { client, signInWithPassword } = fakeClient({ signIn: ok(), profile: { role: "professional", is_active: true } });
    mocks.server.mockResolvedValue(client);
    await expect(signInAction({}, form({ email: " a@b.com ", password: "x" }))).rejects.toThrow("NEXT_REDIRECT:/profesional");
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "a@b.com", password: "x" });
  });

  it("el rol sale de `profiles`, no de user_metadata: metadatos de profesional + perfil athlete → /deportista", async () => {
    const { client } = fakeClient({ signIn: ok("u2"), profile: { role: "athlete", is_active: true } });
    mocks.server.mockResolvedValue(client);
    await expect(signInAction({}, form({ email: "a@b.com", password: "x" }))).rejects.toThrow("NEXT_REDIRECT:/deportista");
  });

  it("un deportista no puede usar `next` para llegar al área profesional", async () => {
    const { client } = fakeClient({ signIn: ok("u2"), profile: { role: "athlete", is_active: true } });
    mocks.server.mockResolvedValue(client);
    await expect(signInAction({}, form({ email: "a@b.com", password: "x", next: "/profesional" }))).rejects.toThrow("NEXT_REDIRECT:/deportista");
  });

  it("`next` externo se ignora", async () => {
    const { client } = fakeClient({ signIn: ok(), profile: { role: "professional", is_active: true } });
    mocks.server.mockResolvedValue(client);
    await expect(signInAction({}, form({ email: "a@b.com", password: "x", next: "https://evil.com" }))).rejects.toThrow("NEXT_REDIRECT:/profesional");
  });

  it.each([[null], [{ role: "professional", is_active: false }], [{ role: "admin", is_active: true }]])(
    "perfil ausente/inactivo/inválido (%j) → cierra la sesión recién creada y avisa",
    async (profile) => {
      const { client, signOut } = fakeClient({ signIn: ok(), profile });
      mocks.server.mockResolvedValue(client);
      const r = await signInAction({}, form({ email: "a@b.com", password: "x" }));
      expect(r).toEqual({ error: MSG_NO_PROFILE, email: "a@b.com" });
      expect(signOut).toHaveBeenCalledTimes(1);
      expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    },
  );
});

describe("signOutAction", () => {
  it("cierra la sesión y vuelve al inicio", async () => {
    const { client, signOut } = fakeClient({});
    mocks.server.mockResolvedValue(client);
    await expect(signOutAction()).rejects.toThrow("NEXT_REDIRECT:/");
    expect(signOut).toHaveBeenCalledTimes(1);
  });
  it("cierra SOLO esta sesión (scope local), no la del usuario en todos sus dispositivos", async () => {
    const { client, signOut } = fakeClient({});
    mocks.server.mockResolvedValue(client);
    await expect(signOutAction()).rejects.toThrow("NEXT_REDIRECT:/");
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(signOut).not.toHaveBeenCalledWith();
    expect(signOut).not.toHaveBeenCalledWith({ scope: "global" });
  });
  it("sin Supabase configurado solo redirige", async () => {
    mocks.server.mockResolvedValue(null);
    await expect(signOutAction()).rejects.toThrow("NEXT_REDIRECT:/");
  });
  it("si falla la red al cerrar sesión igualmente redirige", async () => {
    const { client, signOut } = fakeClient({});
    signOut.mockRejectedValueOnce(new Error("red"));
    mocks.server.mockResolvedValue(client);
    await expect(signOutAction()).rejects.toThrow("NEXT_REDIRECT:/");
  });
});
