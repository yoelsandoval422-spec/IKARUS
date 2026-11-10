import type { AthleteSummary } from "@/types";

/**
 * DATOS FICTICIOS DE DEMOSTRACIÓN.
 * No corresponden a personas reales. Este módulo es el único lugar donde viven;
 * las futuras consultas reales (Supabase) no deben importarlo.
 */
export const DEMO_DATA_NOTICE =
  "Datos de demostración: personas, equipos y estados ficticios. No son datos reales.";

export const DEMO_TEAMS = ["Equipo Demo Norte", "Equipo Demo Sur"] as const;
export const DEMO_CATEGORIES = ["Cadete", "Juvenil", "Adulto"] as const;

export const DEMO_ATHLETES: readonly AthleteSummary[] = [
  { id: "demo-01", displayName: "Deportista Demo 01", team: "Equipo Demo Norte", category: "Cadete", dailyStatus: "completed" },
  { id: "demo-02", displayName: "Deportista Demo 02", team: "Equipo Demo Norte", category: "Cadete", dailyStatus: "pending" },
  { id: "demo-03", displayName: "Deportista Demo 03", team: "Equipo Demo Norte", category: "Juvenil", dailyStatus: "in_progress" },
  { id: "demo-04", displayName: "Deportista Demo 04", team: "Equipo Demo Norte", category: "Juvenil", dailyStatus: "completed" },
  { id: "demo-05", displayName: "Deportista Demo 05", team: "Equipo Demo Sur", category: "Juvenil", dailyStatus: "pending" },
  { id: "demo-06", displayName: "Deportista Demo 06", team: "Equipo Demo Sur", category: "Adulto", dailyStatus: "completed" },
  { id: "demo-07", displayName: "Deportista Demo 07", team: "Equipo Demo Sur", category: "Adulto", dailyStatus: "in_progress" },
  { id: "demo-08", displayName: "Deportista Demo 08", team: "Equipo Demo Sur", category: "Adulto", dailyStatus: "pending" },
];
