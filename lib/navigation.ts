import type { NavItem } from "@/types";

/** Única fuente de verdad de la navegación. */
export const MAIN_NAV: NavItem[] = [
  { href: "/", label: "Inicio" },
  { href: "/deportista", label: "Deportista" },
  { href: "/profesional", label: "Profesional" },
  { href: "/configuracion", label: "Configuración" },
];

const HOME: NavItem = { href: "/", label: "Inicio" };

export type NavAudience = "visitor" | "demo" | "athlete" | "professional";

/**
 * Menú principal según quién mira la pantalla (la autorización real sigue en guards.ts y RLS;
 * esto solo evita mostrar enlaces que llevarían a "acceso denegado").
 *  - visitor: sin sesión y sin demostración → solo Inicio (el botón "Ingresar" está en el encabezado);
 *  - demo: demostración permitida (desarrollo) → todo, para poder recorrerla;
 *  - athlete / professional: solo lo suyo.
 */
export function mainNavFor(audience: NavAudience): NavItem[] {
  switch (audience) {
    case "athlete":
      return [HOME, { href: "/deportista", label: "Mi registro" }];
    case "professional":
      return [HOME, { href: "/profesional", label: "Panel profesional" }, { href: "/configuracion", label: "Configuración" }];
    case "demo":
      return MAIN_NAV;
    default:
      return [HOME];
  }
}

export const PROFESSIONAL_NAV: NavItem[] = [
  { href: "/profesional", label: "Panel", description: "Resumen general" },
  { href: "/profesional/deportistas", label: "Deportistas", description: "Seguimiento diario" },
  { href: "/profesional/evaluaciones", label: "Evaluaciones", description: "Módulo antropométrico" },
  { href: "/profesional/informes", label: "Informes", description: "Reportes" },
];

export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/profesional") return pathname === "/profesional";
  return pathname === href || pathname.startsWith(`${href}/`);
}
