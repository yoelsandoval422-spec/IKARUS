import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConfigWarning } from "@/components/ConfigWarning";
import { getSupabaseClient } from "@/lib/supabase/client";
import { readSupabaseEnv } from "@/lib/supabase/env";

const KEY = "a".repeat(40);

describe("variables de Supabase", () => {
  it("detecta variables faltantes", () => {
    const s = readSupabaseEnv({});
    expect(s).toEqual({
      configured: false,
      reason: "missing",
      missing: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
    });
  });
  it("detecta formato inválido", () => {
    const s = readSupabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: "no-es-url", NEXT_PUBLIC_SUPABASE_ANON_KEY: KEY });
    expect(s.configured).toBe(false);
  });
  it("acepta variables válidas", () => {
    const s = readSupabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://demo.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: KEY });
    expect(s.configured).toBe(true);
  });
  it("getSupabaseClient devuelve null sin configuración (no lanza)", () => {
    expect(getSupabaseClient(readSupabaseEnv({}))).toBeNull();
  });
  it("muestra advertencia sin exponer valores cuando faltan", () => {
    render(<ConfigWarning status={readSupabaseEnv({})} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Supabase no está configurado");
    expect(screen.getByRole("alert")).toHaveTextContent("NEXT_PUBLIC_SUPABASE_URL");
  });
  it("no imprime la clave cuando está configurado", () => {
    const status = readSupabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://demo.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: KEY });
    const { container } = render(<ConfigWarning status={status} />);
    expect(container.textContent).not.toContain(KEY);
    expect(container.textContent).not.toContain("demo.supabase.co");
  });
});
