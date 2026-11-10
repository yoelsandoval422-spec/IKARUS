/**
 * IDENTIDAD DE MARCA · única fuente de verdad.
 * Para cambiar el nombre, la frase o los colores, edita SOLO este archivo.
 * La marca es independiente de la arquitectura técnica: no se renombran tablas, rutas ni variables.
 */
export const BRAND = {
  /** Nombre comercial (siempre en mayúsculas en logotipo y títulos). */
  name: "IKARU",
  /** Nombre corto para el icono del celular (PWA). */
  shortName: "IKARU",
  /** Frase provisional de marca (se muestra en bienvenida e inicio de sesión, no en todas las pantallas). */
  tagline: "Evolucionamos juntos.",
  /** Concepto central, para textos institucionales. */
  concept: "Cada persona tiene su propio camino, pero nadie tiene que recorrerlo en soledad.",
  /** Descripción breve (metadatos, buscador, instalación en el celular). */
  description:
    "Plataforma de seguimiento y bienestar para deportistas y personas físicamente activas: constancia, evolución y comunidad.",
  /** Descripción del tipo de plataforma, para el pie de la bienvenida. */
  locale: "es-AR",
  colors: {
    /** Color de la barra del navegador / pantalla de inicio al instalar (PWA). */
    theme: "#0b1220",
    background: "#f8fafc",
    /** Acento provisional de la marca. */
    accent: "#f59e0b",
  },
  /**
   * Piezas gráficas. Hoy solo hay un logotipo provisional de texto y un isotipo mínimo (la letra I).
   * Para incorporar el logotipo definitivo, reemplaza los archivos de `public/brand/` y `public/icons/`
   * conservando los nombres (ver `public/brand/LEEME.md`).
   */
  assets: {
    icon192: "/icons/icon-192.png",
    icon512: "/icons/icon-512.png",
    iconMaskable512: "/icons/icon-maskable-512.png",
    appleTouch: "/icons/apple-touch-icon.png",
  },
} as const;

/** "IKARU — Evolucionamos juntos." */
export const BRAND_FULL_TAGLINE = `${BRAND.name} — ${BRAND.tagline}`;

/** Título de página: "Pantalla · IKARU". */
export function pageTitle(section?: string): string {
  return section ? `${section} · ${BRAND.name}` : BRAND.name;
}
