import type { SupabaseClient } from "@supabase/supabase-js";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ server: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), check: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.server }));
vi.mock("@/app/login/actions", () => ({ signInAction: mocks.signIn, signOutAction: mocks.signOut }));
vi.mock("@/app/configuracion/actions", () => ({ checkConnectionAction: mocks.check }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  },
}));

import AccessDeniedPage from "@/app/acceso-denegado/page";
import SettingsPage from "@/app/configuracion/page";
import LoginPage from "@/app/login/page";
import AthleteHomePage from "@/app/deportista/page";
import ProfessionalDashboardPage from "@/app/profesional/page";
import AthletesPage from "@/app/profesional/deportistas/page";
import { ConnectionCheck } from "@/components/ConnectionCheck";
import { LoginForm } from "@/components/LoginForm";
import { SessionControls } from "@/components/SiteHeader";

const KEY = "sb_publishable_" + "z".repeat(30);
const URL_ = "https://proyecto-privado.supabase.co";
const ID1 = "11111111-1111-4111-8111-111111111111";

function stubConfigured() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", URL_);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", KEY);
}

/** Cliente de servidor falso: sesión + perfil + filas de `athletes` y registros de hoy. */
function serverClient(user: unknown, profile: unknown, athletes: unknown[] = []) {
  return {
    auth: { getUser: async () => ({ data: { user }, error: user ? null : { message: "x" } }) },
    from: (table: string) => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "order"]) b[m] = () => b;
      b.maybeSingle = async () => ({ data: profile, error: null });
      b.then = (resolve: (r: unknown) => unknown) =>
        resolve({ data: table === "athletes" ? athletes : [], error: null });
      return b;
    },
  } as unknown as SupabaseClient;
}

beforeEach(() => {
  vi.unstubAllEnvs();
  mocks.server.mockReset();
  mocks.signIn.mockReset();
  mocks.check.mockReset();
});

describe("LoginForm", () => {
  it("muestra el error de credenciales, conserva el correo y deja la contraseña vacía", async () => {
    mocks.signIn.mockResolvedValue({ error: "Correo o contraseña incorrectos.", email: "ana@demo.test" });
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText("Correo electrónico"), "ana@demo.test");
    await user.type(screen.getByLabelText("Contraseña"), "mala");
    await user.click(screen.getByRole("button", { name: "Ingresar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Correo o contraseña incorrectos.");
    expect(screen.getByLabelText("Correo electrónico")).toHaveValue("ana@demo.test");
    expect(screen.getByLabelText("Contraseña")).toHaveValue("");
    expect(mocks.signIn).toHaveBeenCalledTimes(1);
  });

  it("muestra errores por campo accesibles (aria-describedby)", async () => {
    mocks.signIn.mockResolvedValue({ fieldErrors: { email: "El correo no tiene un formato válido." }, email: "x" });
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.click(screen.getByRole("button", { name: "Ingresar" }));
    const email = await screen.findByLabelText("Correo electrónico");
    await waitFor(() => expect(email).toHaveAttribute("aria-invalid", "true"));
    expect(email).toHaveAccessibleDescription(/formato válido/);
  });

  it("deshabilitado cuando Supabase no está configurado", () => {
    render(<LoginForm disabled />);
    expect(screen.getByLabelText("Correo electrónico")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Ingresar" })).toBeDisabled();
  });

  it("incluye `next` oculto solo si se pasa", () => {
    const { container } = render(<LoginForm next="/profesional" />);
    expect(container.querySelector('input[name="next"]')).toHaveValue("/profesional");
  });
});

describe("indicador de sesión (encabezado)", () => {
  it("sin sesión: 'Modo demostración' y enlace para ingresar", () => {
    render(<SessionControls ctx={{ mode: "demo", reason: "no-session" }} />);
    expect(screen.getByText("Modo demostración")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ingresar" })).toHaveAttribute("href", "/login");
    expect(screen.queryByRole("button", { name: "Cerrar sesión" })).toBeNull();
  });
  it.each([["professional", "profesional"], ["athlete", "deportista"]] as const)("con sesión (%s): rol visible y botón de cerrar sesión", (role, label) => {
    render(<SessionControls ctx={{ mode: "authenticated", userId: ID1, role, client: {} as SupabaseClient }} />);
    expect(screen.getByText(`Sesión · ${label}`)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeInTheDocument();
    expect(screen.queryByText("Modo demostración")).toBeNull();
  });
});

describe("/login", () => {
  it("sin Supabase configurado: aviso, formulario deshabilitado y sin romper", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("alert")).toHaveTextContent(/no está configurado/i);
    expect(screen.getByRole("button", { name: "Ingresar" })).toBeDisabled();
  });
  it("configurado y sin sesión: formulario activo; `next` inseguro se descarta", async () => {
    stubConfigured();
    mocks.server.mockResolvedValue(serverClient(null, null));
    const { container } = render(await LoginPage({ searchParams: Promise.resolve({ next: "https://evil.com" }) }));
    expect(screen.getByRole("button", { name: "Ingresar" })).toBeEnabled();
    expect(container.querySelector('input[name="next"]')).toBeNull();
  });
  it("con sesión iniciada redirige al inicio del rol", async () => {
    stubConfigured();
    mocks.server.mockResolvedValue(serverClient({ id: ID1 }, { role: "athlete", is_active: true }));
    await expect(LoginPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("NEXT_REDIRECT:/deportista");
  });
});

describe("accesos no autorizados y sesiones válidas en las páginas", () => {
  it("deportista autenticado NO ve /profesional ni /profesional/deportistas", async () => {
    stubConfigured();
    mocks.server.mockResolvedValue(serverClient({ id: ID1 }, { role: "athlete", is_active: true }));
    await expect(ProfessionalDashboardPage()).rejects.toThrow("NEXT_REDIRECT:/acceso-denegado");
    await expect(AthletesPage()).rejects.toThrow("NEXT_REDIRECT:/acceso-denegado");
  });
  it("profesional autenticado NO entra a /deportista", async () => {
    stubConfigured();
    mocks.server.mockResolvedValue(serverClient({ id: ID1 }, { role: "professional", is_active: true }));
    await expect(AthleteHomePage()).rejects.toThrow("NEXT_REDIRECT:/acceso-denegado");
  });
  it("profesional autenticado ve datos REALES de la base (no los ficticios) y se identifica como tales", async () => {
    stubConfigured();
    mocks.server.mockResolvedValue(
      serverClient({ id: ID1 }, { role: "professional", is_active: true }, [
        { id: "22222222-2222-4222-8222-222222222222", display_name: "Ana Real", category: { name: "Juvenil" }, team_memberships: [] },
      ]),
    );
    render(await AthletesPage());
    expect(screen.getByText("Ana Real")).toBeInTheDocument();
    expect(screen.queryByText(/Deportista Demo/)).toBeNull();
    expect(screen.getByRole("note")).toHaveTextContent(/Datos reales/);
    expect(screen.queryByText(/DEMOSTRACIÓN/)).toBeNull();
  });
  it("sin sesión con Supabase configurado: demostración claramente identificada", async () => {
    stubConfigured();
    mocks.server.mockResolvedValue(serverClient(null, null));
    render(await ProfessionalDashboardPage());
    expect(screen.getByRole("note")).toHaveTextContent(/Modo demostración/);
    expect(screen.getAllByText(/Deportista Demo|\(demo\)/).length).toBeGreaterThan(0);
  });
  it("sin sesión y APP_ALLOW_DEMO=false: redirige a /login", async () => {
    stubConfigured();
    vi.stubEnv("APP_ALLOW_DEMO", "false");
    mocks.server.mockResolvedValue(serverClient(null, null));
    await expect(ProfessionalDashboardPage()).rejects.toThrow("NEXT_REDIRECT:/login?next=%2Fprofesional");
  });
  it("deportista autenticado en /deportista: aclara que los formularios no guardan nada", async () => {
    stubConfigured();
    mocks.server.mockResolvedValue(serverClient({ id: ID1 }, { role: "athlete", is_active: true }));
    render(await AthleteHomePage());
    expect(screen.getByRole("note")).toHaveTextContent(/NO guardan nada/);
  });
  it("/acceso-denegado enlaza al inicio del propio rol", async () => {
    stubConfigured();
    mocks.server.mockResolvedValue(serverClient({ id: ID1 }, { role: "athlete", is_active: true }));
    render(await AccessDeniedPage());
    expect(screen.getByRole("link", { name: "Ir a mi inicio" })).toHaveAttribute("href", "/deportista");
  });
});

describe("/configuracion", () => {
  it("sin variables: indica cuáles faltan y que la conexión no está verificada", async () => {
    const { container } = render(await SettingsPage());
    expect(container.textContent).toContain("Falta");
    expect(container.textContent).toContain("No verificada");
    expect(screen.getByRole("button", { name: "Verificar ahora" })).toBeDisabled();
  });
  it("con variables: informa 'Presente/Válido' y NUNCA imprime la URL ni la clave", async () => {
    stubConfigured();
    mocks.server.mockResolvedValue(serverClient(null, null));
    const { container } = render(await SettingsPage());
    expect(container.textContent).toContain("Válido");
    expect(container.textContent).not.toContain(KEY);
    expect(container.textContent).not.toContain("proyecto-privado");
    expect(container.innerHTML).not.toContain(KEY);
  });
  it("el botón de verificación solo se habilita para un profesional autenticado", async () => {
    stubConfigured();
    mocks.server.mockResolvedValue(serverClient({ id: ID1 }, { role: "professional", is_active: true }));
    render(await SettingsPage());
    expect(screen.getByRole("button", { name: "Verificar ahora" })).toBeEnabled();
  });
});

describe("ConnectionCheck", () => {
  it("muestra el resultado de cada paso", async () => {
    mocks.check.mockResolvedValue({ steps: [{ name: "Servicio de autenticación", ok: true, message: "Responde correctamente." }] });
    const user = userEvent.setup();
    render(<ConnectionCheck enabled />);
    await user.click(screen.getByRole("button", { name: "Verificar ahora" }));
    expect(await screen.findByText(/Responde correctamente/)).toBeInTheDocument();
  });
  it("muestra el error de permiso", async () => {
    mocks.check.mockResolvedValue({ error: "Inicia sesión como profesional para verificar la conexión." });
    const user = userEvent.setup();
    render(<ConnectionCheck enabled />);
    await user.click(screen.getByRole("button", { name: "Verificar ahora" }));
    expect(await screen.findByText(/Inicia sesión como profesional/)).toBeInTheDocument();
  });
});
