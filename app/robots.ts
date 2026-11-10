import type { MetadataRoute } from "next";

/** Plataforma privada: se pide a los buscadores que no rastreen nada. */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
