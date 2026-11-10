import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  applicationName: BRAND.name,
  title: { default: BRAND.name, template: `%s · ${BRAND.name}` },
  description: BRAND.description,
  // Plataforma privada con datos personales: ningún buscador debe indexarla.
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: BRAND.shortName, statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: { apple: BRAND.assets.appleTouch },
};

// El encabezado muestra la sesión: ninguna página se prerrenderiza con un estado de sesión fijo.
export const dynamic = "force-dynamic";

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: BRAND.colors.theme };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:p-2">
          Saltar al contenido
        </a>
        <SiteHeader />
        <main id="contenido" className="mx-auto max-w-6xl px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
