import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Configuración SEPARADA para las pruebas de integración (npm run test:integration).
 * Lee `.env.test.local` (si existe) con `process.loadEnvFile` de Node: no pisa variables que ya
 * estén definidas en el entorno. Estas pruebas NO forman parte de `npm test`.
 */
try {
  process.loadEnvFile(path.join(import.meta.dirname, ".env.test.local"));
} catch {
  // Sin archivo: se usa solo el entorno actual (y si no hay variables TEST_*, las pruebas se omiten).
}

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname) } },
  test: {
    environment: "node",
    include: ["tests-integration/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
