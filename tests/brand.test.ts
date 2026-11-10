import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import robots from "@/app/robots";
import { BRAND, BRAND_FULL_TAGLINE, pageTitle } from "@/lib/brand";
import { mainNavFor } from "@/lib/navigation";
import { metadata, viewport } from "@/app/layout";

const ROOT = path.resolve(__dirname, "..");

describe("identidad IKARU (una sola fuente de verdad)", () => {
  it("nombre, frase y títulos", () => {
    expect(BRAND.name).toBe("IKARU");
    expect(BRAND.shortName).toBe("IKARU");
    expect(BRAND_FULL_TAGLINE).toBe("IKARU — Evolucionamos juntos.");
    expect(pageTitle("Ingresar")).toBe("Ingresar · IKARU");
    expect(pageTitle()).toBe("IKARU");
  });
  it("el layout usa la marca y no se indexa en buscadores", () => {
    expect(metadata.title).toEqual({ default: "IKARU", template: "%s · IKARU" });
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(viewport.themeColor).toBe(BRAND.colors.theme);
  });
  it("robots.txt pide no rastrear nada", () => {
    expect(robots()).toEqual({ rules: { userAgent: "*", disallow: "/" } });
  });
  it("ningún texto visible del código fuente menciona la marca anterior", () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const full = path.join(dir, f);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(tsx?|css)$/.test(f) && /handball/i.test(readFileSync(full, "utf8"))) hits.push(path.relative(ROOT, full));
      }
    };
    for (const d of ["app", "components", "lib"]) walk(path.join(ROOT, d));
    expect(hits).toEqual([]);
  });
});

describe("manifest de la PWA", () => {
  const m = manifest();
  it("usa el nombre IKARU y es instalable", () => {
    expect(m.name).toBe("IKARU");
    expect(m.short_name).toBe("IKARU");
    expect(m.start_url).toBe("/");
    expect(m.display).toBe("standalone");
    expect(m.lang).toBe("es-AR");
  });
  it("los íconos declarados existen en public/", () => {
    expect(m.icons?.length).toBeGreaterThanOrEqual(3);
    for (const icon of m.icons ?? []) expect(existsSync(path.join(ROOT, "public", icon.src))).toBe(true);
    expect(m.icons?.some((i) => i.purpose === "maskable")).toBe(true);
  });
  it("no se registra ningún service worker (decisión de privacidad documentada)", () => {
    expect(existsSync(path.join(ROOT, "public", "sw.js"))).toBe(false);
    expect(existsSync(path.join(ROOT, "public", "service-worker.js"))).toBe(false);
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const full = path.join(dir, f);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(tsx?)$/.test(f) && /serviceWorker\.register/.test(readFileSync(full, "utf8"))) hits.push(full);
      }
    };
    for (const d of ["app", "components", "lib"]) walk(path.join(ROOT, d));
    expect(hits).toEqual([]);
  });
});

describe("menú principal según quién mira", () => {
  const hrefs = (a: Parameters<typeof mainNavFor>[0]) => mainNavFor(a).map((i) => i.href);
  it("visitante: solo Inicio", () => expect(hrefs("visitor")).toEqual(["/"]));
  it("deportista: no ve enlaces del área profesional", () => {
    expect(hrefs("athlete")).toEqual(["/", "/deportista"]);
  });
  it("profesional: no ve el área de deportista", () => {
    expect(hrefs("professional")).toEqual(["/", "/profesional", "/configuracion"]);
  });
  it("demostración (desarrollo): todo", () => expect(hrefs("demo")).toContain("/deportista"));
});
