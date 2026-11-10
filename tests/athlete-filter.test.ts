import { describe, expect, it } from "vitest";
import { DEMO_ATHLETES } from "@/data/demo/athletes";
import { countByStatus, EMPTY_FILTERS, filterAthletes } from "@/lib/athlete-filter";
import { statusFromProgress } from "@/lib/status";

describe("filterAthletes", () => {
  it("sin filtros devuelve todos", () => {
    expect(filterAthletes(DEMO_ATHLETES, EMPTY_FILTERS)).toHaveLength(DEMO_ATHLETES.length);
  });
  it("busca por nombre sin importar mayúsculas ni tildes", () => {
    const r = filterAthletes(DEMO_ATHLETES, { ...EMPTY_FILTERS, query: "DEMO 03" });
    expect(r.map((a) => a.id)).toEqual(["demo-03"]);
  });
  it("filtra por equipo, categoría y estado combinados", () => {
    const r = filterAthletes(DEMO_ATHLETES, { query: "", team: "Equipo Demo Sur", category: "Adulto", status: "pending" });
    expect(r.map((a) => a.id)).toEqual(["demo-08"]);
  });
  it("devuelve vacío si nada coincide", () => {
    expect(filterAthletes(DEMO_ATHLETES, { ...EMPTY_FILTERS, query: "zzz" })).toEqual([]);
  });
  it("cuenta por estado", () => {
    const c = countByStatus(DEMO_ATHLETES);
    expect(c.completed + c.pending + c.in_progress).toBe(DEMO_ATHLETES.length);
  });
  it("deriva el estado del progreso", () => {
    expect(statusFromProgress(0, 4)).toBe("pending");
    expect(statusFromProgress(2, 4)).toBe("in_progress");
    expect(statusFromProgress(4, 4)).toBe("completed");
  });
});
