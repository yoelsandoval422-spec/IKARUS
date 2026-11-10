import { BRAND } from "@/lib/brand";

/**
 * Logotipo PROVISIONAL: solo el nombre en una tipografía fuerte y espaciada, con una barra de acento.
 * No es un símbolo definitivo. Para el logotipo final, ver `public/brand/LEEME.md`.
 */
export function BrandLogo({ size = "md" }: { size?: "md" | "lg" }) {
  const text = size === "lg" ? "text-4xl sm:text-5xl" : "text-xl";
  return (
    <span className="inline-flex flex-col leading-none">
      <span className={`${text} font-black uppercase tracking-[0.22em] text-slate-950`}>{BRAND.name}</span>
      <span aria-hidden="true" className={`mt-1 block h-1 rounded-full bg-amber-500 ${size === "lg" ? "w-16" : "w-8"}`} />
    </span>
  );
}
