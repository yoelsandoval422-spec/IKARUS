import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

// HSTS solo en producción (en desarrollo local no hay HTTPS). Sin `includeSubDomains` a propósito:
// no se debe forzar HTTPS en subdominios del dominio propio que la aplicación no controla.
const hsts = { key: "Strict-Transport-Security", value: "max-age=31536000" };

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Permite compilar en otra carpeta (la usa `npm run sim:e2e` para no pisar tu `.next`).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async headers() {
    return [{ source: "/:path*", headers: process.env.NODE_ENV === "production" ? [...securityHeaders, hsts] : securityHeaders }];
  },
};

export default nextConfig;
