import { describe, expect, it } from "vitest";
import { readIntegrationConfig } from "../tests-integration/config";

const KEY = "sb_publishable_" + "x".repeat(30);
const good = (): Record<string, string> => ({
  TEST_SUPABASE_URL: "https://proyecto-de-prueba.supabase.co",
  TEST_SUPABASE_ANON_KEY: KEY,
  TEST_CONFIRM_TEST_PROJECT: "si",
  TEST_PRO1_EMAIL: "pro1@x.test", TEST_PRO1_PASSWORD: "p1",
  TEST_PRO2_EMAIL: "pro2@x.test", TEST_PRO2_PASSWORD: "p2",
  TEST_ATH1_EMAIL: "ath1@x.test", TEST_ATH1_PASSWORD: "a1",
  TEST_ATH2_EMAIL: "ath2@x.test", TEST_ATH2_PASSWORD: "a2",
  TEST_ATH3_EMAIL: "ath3@x.test", TEST_ATH3_PASSWORD: "a3",
});
const invalid = (env: Record<string, string>) => {
  const r = readIntegrationConfig(env);
  return r.status === "invalid" ? r.reason : `esperaba invalid y fue ${r.status}`;
};

describe("readIntegrationConfig (guardas de las pruebas de integración)", () => {
  it("sin variables → se omiten (unset), no es un error", () => {
    expect(readIntegrationConfig({})).toEqual({ status: "unset" });
    expect(readIntegrationConfig({ TEST_SUPABASE_URL: "  " })).toEqual({ status: "unset" });
  });
  it("configuración completa y confirmada → ok", () => {
    const r = readIntegrationConfig(good());
    expect(r.status).toBe("ok");
    expect(r.status === "ok" && r.config.accounts.PRO1.email).toBe("pro1@x.test");
  });
  it("incompleta → invalid (falla, no se omite en silencio) y nombra las variables que faltan", () => {
    const env = good();
    delete env.TEST_ATH3_PASSWORD;
    expect(invalid(env)).toContain("TEST_ATH3_PASSWORD");
  });
  it("sin la confirmación de proyecto de PRUEBAS → invalid", () => {
    for (const v of ["", "no", "yes", "SI", "true"]) {
      expect(invalid({ ...good(), TEST_CONFIRM_TEST_PROJECT: v })).toMatch(/PRUEBAS|Faltan/);
    }
  });
  it("rechaza claves privilegiadas (sb_secret_ y JWT service_role)", () => {
    const jwt = (role: string) => `${btoa('{"alg":"HS256"}')}.${btoa(JSON.stringify({ role }))}.firma`.replace(/=/g, "");
    expect(invalid({ ...good(), TEST_SUPABASE_ANON_KEY: "sb_secret_" + "y".repeat(30) })).toContain("privilegiada");
    expect(invalid({ ...good(), TEST_SUPABASE_ANON_KEY: jwt("service_role") })).toContain("privilegiada");
    expect(readIntegrationConfig({ ...good(), TEST_SUPABASE_ANON_KEY: jwt("anon") + "x".repeat(10) }).status).toBe("ok");
  });
  it("exige https (permite http solo en localhost)", () => {
    expect(invalid({ ...good(), TEST_SUPABASE_URL: "http://ejemplo.com" })).toContain("URL");
    expect(invalid({ ...good(), TEST_SUPABASE_URL: "no-es-url" })).toContain("URL");
    expect(readIntegrationConfig({ ...good(), TEST_SUPABASE_URL: "http://127.0.0.1:54321" }).status).toBe("ok");
  });
  it("las 5 cuentas deben ser distintas", () => {
    expect(invalid({ ...good(), TEST_ATH2_EMAIL: "ATH1@x.test" })).toContain("distintos");
  });
  it("los mensajes de error no contienen contraseñas ni claves", () => {
    const env = { ...good(), TEST_SUPABASE_ANON_KEY: "sb_secret_" + "z".repeat(30) };
    const r = JSON.stringify(readIntegrationConfig(env));
    expect(r).not.toContain("zzzz");
    expect(r).not.toContain("p1");
  });
});
