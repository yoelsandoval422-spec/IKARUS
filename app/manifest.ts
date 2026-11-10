import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

/**
 * Web App Manifest (permite "Agregar a la pantalla de inicio").
 * Es SOLO el manifest: no hay service worker ni modo sin conexión, a propósito
 * (ver docs/pwa-y-cache.md): los datos de deportistas nunca se guardan en el dispositivo por la app.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.name,
    short_name: BRAND.shortName,
    description: BRAND.description,
    lang: BRAND.locale,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: BRAND.colors.background,
    theme_color: BRAND.colors.theme,
    icons: [
      { src: BRAND.assets.icon192, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: BRAND.assets.icon512, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: BRAND.assets.iconMaskable512, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
