import { Nav } from "@/components/Nav";
import { requireArea } from "@/lib/auth/guards";
import { PROFESSIONAL_NAV } from "@/lib/navigation";

export default async function ProfessionalLayout({ children }: { children: React.ReactNode }) {
  // Primera barrera; cada página y la capa de datos vuelven a comprobar (los layouts no se re-ejecutan al navegar).
  await requireArea("professional", "/profesional");
  return (
    <div className="grid gap-6 md:grid-cols-[14rem_1fr]">
      <aside aria-label="Panel profesional" className="md:sticky md:top-4 md:self-start">
        <p className="mb-2 hidden text-xs font-semibold uppercase tracking-wide text-slate-700 md:block">Área profesional</p>
        <div className="md:hidden"><Nav items={PROFESSIONAL_NAV} label="Secciones profesionales" /></div>
        <div className="hidden md:block"><Nav items={PROFESSIONAL_NAV} label="Secciones profesionales" orientation="vertical" /></div>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
