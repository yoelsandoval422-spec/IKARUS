import Link from "next/link";
import { EmptyState } from "@/components/States";

export default function NotFound() {
  return (
    <EmptyState title="Página no encontrada">
      <Link href="/" className="font-semibold text-brand-700 underline">Volver al inicio</Link>
    </EmptyState>
  );
}
