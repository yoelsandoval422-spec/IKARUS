import { describe, expect, it } from "vitest";
import { areaOf, postLoginPath, roleHome, safeRedirectPath } from "@/lib/auth/redirect";
import { isDemoAllowed } from "@/lib/config";

describe("safeRedirectPath (evita redirecciones abiertas)", () => {
  it.each([
    ["/profesional", "/profesional"],
    ["/profesional/deportistas?x=1", "/profesional/deportistas?x=1"],
    ["/", "/"],
  ])("acepta %s", (input, out) => expect(safeRedirectPath(input)).toBe(out));

  it.each([
    "//evil.com", "https://evil.com", "http://evil.com/x", "javascript:alert(1)", "/\\evil.com",
    "\\\\evil.com", "evil.com", "", "/a\nb", "/a\u0000b", `/${"a".repeat(300)}`, "///evil.com",
  ])("rechaza %j", (input) => expect(safeRedirectPath(input)).toBeNull());

  it("rechaza null/undefined", () => {
    expect(safeRedirectPath(null)).toBeNull();
    expect(safeRedirectPath(undefined)).toBeNull();
  });
});

describe("destino tras iniciar sesión", () => {
  it("cada rol va a su inicio por defecto", () => {
    expect(postLoginPath("professional", undefined)).toBe("/profesional");
    expect(postLoginPath("athlete", null)).toBe("/deportista");
    expect(roleHome("athlete")).toBe("/deportista");
  });
  it("respeta `next` solo si es segura y corresponde al rol", () => {
    expect(postLoginPath("professional", "/profesional/informes")).toBe("/profesional/informes");
    expect(postLoginPath("athlete", "/deportista")).toBe("/deportista");
    expect(postLoginPath("athlete", "/configuracion")).toBe("/configuracion");
  });
  it("`next` no sirve para entrar a la zona de otro rol ni salir del sitio", () => {
    expect(postLoginPath("athlete", "/profesional")).toBe("/deportista");
    expect(postLoginPath("professional", "/deportista")).toBe("/profesional");
    expect(postLoginPath("professional", "https://evil.com")).toBe("/profesional");
    expect(postLoginPath("athlete", "//evil.com")).toBe("/deportista");
  });
  it("no vuelve a /login", () => {
    expect(postLoginPath("athlete", "/login?next=/x")).toBe("/deportista");
  });
  it("areaOf distingue áreas", () => {
    expect(areaOf("/profesional")).toBe("professional");
    expect(areaOf("/profesional/x")).toBe("professional");
    expect(areaOf("/profesionalX")).toBeNull();
    expect(areaOf("/deportista/x")).toBe("athlete");
    expect(areaOf("/")).toBeNull();
  });
});

describe("isDemoAllowed", () => {
  it("por defecto permite la demostración en desarrollo", () => expect(isDemoAllowed(undefined, false)).toBe(true));
  it("en PRODUCCIÓN la demostración está desactivada por defecto", () => {
    expect(isDemoAllowed(undefined, true)).toBe(false);
    expect(isDemoAllowed("", true)).toBe(false);
  });
  it("en producción solo se activa con un valor afirmativo explícito", () => {
    for (const v of ["true", "1", "yes", "si", "on"]) expect(isDemoAllowed(v, true)).toBe(true);
    for (const v of ["quizas", "tru", "enabled", "2"]) expect(isDemoAllowed(v, true)).toBe(false);
  });
  it("lee NODE_ENV por defecto: en las pruebas (no producción) permite la demostración", () => expect(isDemoAllowed(undefined)).toBe(true));
  it.each(["false", "FALSE", "0", "no", "off", " false "])("%j la desactiva", (v) => expect(isDemoAllowed(v, false)).toBe(false));
  it.each(["true", "1", "yes", ""])("%j la mantiene", (v) => expect(isDemoAllowed(v)).toBe(true));
});
