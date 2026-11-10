import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/profesional" }));

import HomePage from "@/app/page";
import AthleteHomePage from "@/app/deportista/page";
import ProfessionalDashboardPage from "@/app/profesional/page";
import AthletesPage from "@/app/profesional/deportistas/page";
import EvaluationsPage from "@/app/profesional/evaluaciones/page";
import ReportsPage from "@/app/profesional/informes/page";
import SettingsPage from "@/app/configuracion/page";
import { Nav } from "@/components/Nav";
import { PROFESSIONAL_NAV } from "@/lib/navigation";

const h1 = () => screen.getByRole("heading", { level: 1 });

describe("rutas principales", () => {
  it("/ muestra la marca IKARU, la frase y los accesos de demostración (solo si la demostración está permitida)", async () => {
    render(await HomePage());
    expect(screen.getAllByText("IKARU").length).toBeGreaterThan(0);
    expect(screen.getByText("Evolucionamos juntos.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ingresar" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: /Soy deportista/ })).toHaveAttribute("href", "/deportista");
    expect(screen.getByRole("link", { name: /Soy profesional/ })).toHaveAttribute("href", "/profesional");
  });
  it("/deportista indica que es demostrativo", async () => {
    render(await AthleteHomePage());
    expect(screen.getByRole("note")).toHaveTextContent(/demostrativos/i);
    expect(screen.getAllByRole("button", { name: /Bienestar|Alimentación|Hidratación|Entrenamiento/ })).toHaveLength(4);
  });
  it("/profesional muestra tarjetas y tabla con datos demo", async () => {
    render(await ProfessionalDashboardPage());
    expect(h1()).toHaveTextContent("Panel profesional");
    expect(screen.getByRole("note")).toHaveTextContent(/Modo demostración/);
    expect(screen.getByRole("table")).toBeInTheDocument();
  });
  it("/profesional/deportistas filtra en el navegador", async () => {
    const user = userEvent.setup();
    render(await AthletesPage());
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(9);
    await user.type(screen.getByLabelText("Buscar por nombre"), "demo 03");
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(2);
    await user.clear(screen.getByLabelText("Buscar por nombre"));
    await user.type(screen.getByLabelText("Buscar por nombre"), "nadie");
    expect(screen.getByText("Sin resultados")).toBeInTheDocument();
  });
  it("/profesional/evaluaciones indica que no está implementado", async () => {
    render(await EvaluationsPage());
    expect(screen.getByText(/etapa posterior/)).toBeInTheDocument();
  });
  it("/profesional/informes muestra estado vacío", async () => {
    render(await ReportsPage());
    expect(screen.getByText("Todavía no hay informes")).toBeInTheDocument();
  });
  it("/configuracion arranca sin variables de Supabase", async () => {
    render(await SettingsPage());
    expect(screen.getByRole("alert")).toHaveTextContent(/no está configurado/i);
    expect(screen.getByText(/Sin sesión · modo demostración/)).toBeInTheDocument();
  });
});

describe("formulario demostrativo", () => {
  it("muestra errores de validación y luego confirma sin guardar", async () => {
    const user = userEvent.setup();
    render(await AthleteHomePage());
    await user.click(screen.getByRole("button", { name: "Probar envío (demo)" }));
    expect(screen.getByText(/Horas de sueño: ingresa un valor/)).toBeInTheDocument();
    await user.type(screen.getByLabelText("Horas de sueño"), "8");
    await user.type(screen.getByLabelText(/Energía del día/), "4");
    await user.click(screen.getByRole("button", { name: "Probar envío (demo)" }));
    expect(screen.getByText(/No se guardó ningún dato real/)).toBeInTheDocument();
    expect(screen.getByText("En curso")).toBeInTheDocument();
  });
});

describe("navegación", () => {
  it("marca la página actual", () => {
    render(<Nav items={PROFESSIONAL_NAV} label="Test" />);
    expect(screen.getByRole("link", { name: /Panel/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /Informes/ })).not.toHaveAttribute("aria-current");
  });
});
