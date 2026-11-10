import type { SupabaseClient } from "@supabase/supabase-js";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ server: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.server }));
vi.mock("@/app/login/actions", () => ({ signInAction: mocks.signIn, signOutAction: mocks.signOut }));
vi.mock("@/app/configuracion/actions", () => ({ checkConnectionAction: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  },
}));

import AccessDeniedPage from "@/app/acceso-denegado/page";
import SettingsPage from "@/app/configuracion/page";
import LoginPage from "@/app/login/page";
import AthletesPage from "@/app/profesional/deportistas/page";
import ProfessionalDashboardPage from "@/app/profesional/page";
import NoConnectionPage from "@/app/sin-conexion/page";
import { SessionControls } from "@/components/SiteHeader";

const ID = "11111111-1111-4111-8111-111111111111";
const JWT_SERVICE =
  "eyJhbGciOiJIUzI1NiJ9." + btoa(JSON.stringify({ role: "service_role" })).replace(/=+$/, "") + ".c2lnbmF0dXJl";

function configure() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "a".repeat(40));
}
function authDown() {
  return {
    auth: { getUser: async () => ({ data: { user: null }, error: { name: "AuthRetryableFetchError", status: 0, message: "TypeError: fetch failed https://abc.supabase.co" } }) },
  };
}
function authExpired() {
  return {
    auth: { getUser: async () => ({ data: { user: null }, error: { name: "AuthApiError", status: 400, code: "refresh_token_not_found", message: "Invalid Refresh Token" } }) },
  };
}
function authNoProfile() {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq"]) b[m] = () => b;
  b.maybeSingle = async () => ({ data: null, error: null });
  return { auth: { getUser: async () => ({ data: { user: { id: ID } }, error: null }) }, from: () => b };
}

beforeEach(() => {
  vi.unstubAllEnvs();
  mocks.server.mockReset();
});

describe("indicador de sesión: cada estado se ve distinto y claro", () => {
  const fake = {} as SupabaseClient;
  it("sesión vencida", () => {
    render(<SessionControls ctx={{ mode: "demo", reason: "expired" }} />);
    expect(screen.getByText("Sesión vencida")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ingresar" })).toHaveAttribute("href", "/login");
    expect(screen.queryByText("Modo demostración")).toBeNull();
  });
  it("cuenta sin acceso: permite cerrar sesión", () => {
    render(<SessionControls ctx={{ mode: "demo", reason: "no-access" }} />);
    expect(screen.getByText("Cuenta sin acceso")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeInTheDocument();
  });
  it("servicio no disponible: 'Sesión no verificada' y NO 'Modo demostración'", () => {
    render(<SessionControls ctx={{ mode: "unavailable" }} />);
    expect(screen.getByText("Sesión no verificada")).toBeInTheDocument();
    expect(screen.queryByText("Modo demostración")).toBeNull();
  });
  it("no configurado / sin sesión: Modo demostración", () => {
    for (const reason of ["not-configured", "no-session"] as const) {
      const { unmount } = render(<SessionControls ctx={{ mode: "demo", reason }} />);
      expect(screen.getByText("Modo demostración")).toBeInTheDocument();
      unmount();
    }
  });
  it("autenticado: rol y cierre de sesión", () => {
    render(<SessionControls ctx={{ mode: "authenticated", userId: ID, role: "athlete", client: fake }} />);
    expect(screen.getByText("Sesión · deportista")).toBeInTheDocument();
  });
});

describe("/login: aviso de sesión vencida", () => {
  it("por el parámetro `motivo`", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({ motivo: "sesion-vencida" }) }));
    expect(screen.getByRole("status")).toHaveTextContent("Tu sesión venció. Ingresa de nuevo para continuar.");
  });
  it("por el estado real de la sesión (token vencido)", async () => {
    configure();
    mocks.server.mockResolvedValue(authExpired());
    render(await LoginPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("status")).toHaveTextContent(/Tu sesión venció/);
    expect(screen.getByRole("button", { name: "Ingresar" })).toBeEnabled();
  });
  it("sin motivo no hay aviso", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({}) }));
    expect(screen.queryByText(/Tu sesión venció/)).toBeNull();
  });
});

describe("/sin-conexion y /acceso-denegado", () => {
  it("/sin-conexion explica el problema sin detalles técnicos y permite reintentar en la ruta segura", async () => {
    configure();
    mocks.server.mockResolvedValue(authDown());
    const { container } = render(await NoConnectionPage({ searchParams: Promise.resolve({ next: "/profesional/informes" }) }));
    expect(screen.getByRole("alert")).toHaveTextContent(/Problema de conexión/);
    expect(screen.getByRole("link", { name: "Reintentar" })).toHaveAttribute("href", "/profesional/informes");
    expect(container.textContent).not.toMatch(/fetch failed|supabase\.co|TypeError/i);
  });
  it("/sin-conexion ignora un `next` externo", async () => {
    render(await NoConnectionPage({ searchParams: Promise.resolve({ next: "https://evil.com" }) }));
    expect(screen.getByRole("link", { name: "Reintentar" })).toHaveAttribute("href", "/");
  });
  it("/acceso-denegado para una cuenta sin perfil activo", async () => {
    configure();
    mocks.server.mockResolvedValue(authNoProfile());
    render(await AccessDeniedPage());
    expect(screen.getByRole("alert")).toHaveTextContent(/no está habilitada/i);
  });
});

describe("páginas protegidas con servicio caído / sesión vencida / sin acceso", () => {
  it.each([
    ["servicio caído", authDown, "NEXT_REDIRECT:/sin-conexion?next=%2Fprofesional"],
    ["sesión vencida", authExpired, "NEXT_REDIRECT:/login?next=%2Fprofesional&motivo=sesion-vencida"],
    ["cuenta sin acceso", authNoProfile, "NEXT_REDIRECT:/acceso-denegado"],
  ])("%s: /profesional redirige y no muestra datos", async (_name, make, expected) => {
    configure();
    mocks.server.mockResolvedValue(make());
    await expect(ProfessionalDashboardPage()).rejects.toThrow(expected);
  });

  it("si la lista falla NO se rotula como 'Datos reales' (solo se muestra el error)", async () => {
    configure();
    const b: Record<string, unknown> = {};
    for (const m of ["select", "eq", "order"]) b[m] = () => b;
    b.maybeSingle = async () => ({ data: { role: "professional", is_active: true }, error: null });
    b.then = (resolve: (r: unknown) => unknown) => resolve({ data: null, error: { message: "relation public.athletes does not exist" } });
    mocks.server.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: ID } }, error: null }) }, from: () => b });
    const { container } = render(await AthletesPage());
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo cargar el listado");
    expect(screen.queryByText(/Datos reales/)).toBeNull();
    expect(container.textContent).not.toMatch(/relation|does not exist|public\.athletes/);
  });
});

describe("/configuracion: advertencias sin mostrar secretos", () => {
  it("avisa de variables públicas con nombre de secreto, mostrando solo el NOMBRE", async () => {
    configure();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY", "valor-secreto-123");
    mocks.server.mockResolvedValue(authExpired());
    const { container } = render(await SettingsPage());
    expect(container.textContent).toContain("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY");
    expect(container.textContent).not.toContain("valor-secreto-123");
  });
  it("clave privilegiada en la variable pública: advertencia y NO se imprime", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", JWT_SERVICE);
    const { container } = render(await SettingsPage());
    expect(container.textContent).toMatch(/clave privilegiada/i);
    expect(container.innerHTML).not.toContain(JWT_SERVICE);
    expect(container.innerHTML).not.toContain("abc.supabase.co");
  });
  it("sin sesión verificable, la pantalla lo indica", async () => {
    configure();
    mocks.server.mockResolvedValue(authDown());
    const { container } = render(await SettingsPage());
    expect(container.textContent).toContain("No verificada (error de conexión");
  });
  it("lista las cookies httpOnly y la conexión como no verificada", async () => {
    const { container } = render(await SettingsPage());
    expect(container.textContent).toContain("httpOnly");
    expect(container.textContent).toContain("No verificada (usa el botón de abajo)");
  });
});
