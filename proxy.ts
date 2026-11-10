import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next 16: "middleware" pasó a llamarse "proxy". Renueva la sesión de Supabase en cada navegación.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Todo excepto archivos estáticos e imágenes.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
